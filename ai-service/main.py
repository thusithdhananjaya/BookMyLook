"""
main.py — FastAPI service for no-show risk prediction.

Endpoints:
  GET  /           → Health check
  POST /predict    → Takes booking features, returns risk score 0-100

Run: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
import os
import stripe

# Stripe test mode configuration
stripe.api_key = "sk_test_51TSEYLRyHld98HoEcwjbiSW5XdB9saP4VIek0ZHfE6q752AOiZPUvyKLJtVeub66SMgqx5Ehfpx9SUnzFZJljjea008AeIri1M"

app = FastAPI(
    title="BookMyLook AI Service",
    description="No-Show Prediction Model for Salon Bookings",
    version="1.0.0"
)

# Allow React dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model on startup
model_path = os.path.join(os.path.dirname(__file__), 'model.pkl')
try:
    metadata = joblib.load(model_path)
    model = metadata['model']
    feature_columns = metadata['feature_columns']
    valid_categories = metadata['categories']
    print(f"✅ Model loaded successfully")
    print(f"   Features: {feature_columns}")
except Exception as e:
    print(f"❌ Failed to load model: {e}")
    model = None
    feature_columns = []
    valid_categories = []


class PredictionRequest(BaseModel):
    day_of_week: int        # 0=Mon to 6=Sun
    hour_of_day: int        # 9-17 typical
    category: str           # Hair, Nails, Skincare, Body, Makeup
    lead_time_days: int     # Days between booking and appointment
    payment_online: int     # 0 or 1
    used_loyalty: int       # 0 or 1
    previous_no_shows: int  # Count of past no-shows


class PredictionResponse(BaseModel):
    risk_score: int         # 0-100 percentage
    risk_level: str         # "Low", "Medium", "High"
    factors: list           # Top contributing factors


@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "service": "BookMyLook AI No-Show Prediction"
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Run train_model.py first.")

    try:
        # Build feature dictionary
        features = {
            'day_of_week': request.day_of_week,
            'hour_of_day': request.hour_of_day,
            'lead_time_days': request.lead_time_days,
            'payment_online': request.payment_online,
            'used_loyalty': request.used_loyalty,
            'previous_no_shows': request.previous_no_shows,
        }

        # One-hot encode category to match training data
        for cat in valid_categories:
            features[f'cat_{cat}'] = 1 if request.category == cat else 0

        # Create DataFrame with correct column order
        df = pd.DataFrame([features])[feature_columns]

        # Get probability of no-show (class 1)
        probability = model.predict_proba(df)[0][1]
        risk_score = int(round(probability * 100))

        # Determine risk level
        if risk_score >= 70:
            risk_level = "High"
        elif risk_score >= 40:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        # Identify top contributing factors for explainability
        factors = []
        if request.previous_no_shows >= 3:
            factors.append(f"Customer has {request.previous_no_shows} previous no-shows")
        elif request.previous_no_shows >= 1:
            factors.append(f"Customer has {request.previous_no_shows} previous no-show(s)")

        if request.lead_time_days == 0:
            factors.append("Same-day booking (impulsive)")
        elif request.lead_time_days > 14:
            factors.append(f"Booked {request.lead_time_days} days in advance (may forget)")

        if request.payment_online == 0:
            factors.append("Pay-at-salon (no upfront commitment)")
        else:
            factors.append("Paid online (committed)")

        if request.used_loyalty == 1:
            factors.append("Loyalty points used (engaged customer)")

        if request.hour_of_day >= 16:
            factors.append("Late afternoon appointment")

        if request.day_of_week in [0, 4]:
            day_name = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][request.day_of_week]
            factors.append(f"{day_name} appointment (higher no-show day)")

        return PredictionResponse(
            risk_score=risk_score,
            risk_level=risk_level,
            factors=factors[:4]  # Return top 4 factors
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# ===== STRIPE CHECKOUT =====

class CheckoutRequest(BaseModel):
    amount: int              # Amount in LKR (e.g., 3500)
    salon_name: str          # For the checkout description
    services: str            # Comma-separated service names
    booking_id: str          # Firestore booking doc ID to track

@app.post("/create-checkout-session")
def create_checkout_session(request: CheckoutRequest):
    try:
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'lkr',
                    'product_data': {
                        'name': f'Booking at {request.salon_name}',
                        'description': request.services,
                    },
                    'unit_amount': request.amount * 100,  # Stripe expects cents/smallest currency unit
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'http://localhost:5173/payment-success?session_id={{CHECKOUT_SESSION_ID}}&booking_id={request.booking_id}',
            cancel_url=f'http://localhost:5173/book-step4?cancelled=true',
        )
        return {"checkout_url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")

@app.get("/verify-payment/{session_id}")
def verify_payment(session_id: str):
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        return {
            "status": session.payment_status,
            "paid": session.payment_status == "paid",
            "amount": session.amount_total / 100 if session.amount_total else 0,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)