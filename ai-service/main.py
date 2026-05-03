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


# ===== AI STYLE RECOMMENDER =====

import base64
import cv2
import mediapipe as mp

# Initialize MediaPipe Face Mesh — handle both old and new API versions
try:
    mp_face_mesh = mp.solutions.face_mesh
    MEDIAPIPE_LEGACY = True
except AttributeError:
    # Newer MediaPipe version — use FaceLandmarker Tasks API
    MEDIAPIPE_LEGACY = False
    import mediapipe.tasks as tasks
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision
    import urllib.request
    
    # Download face landmarker model if not present
    model_path = os.path.join(os.path.dirname(__file__), 'face_landmarker.task')
    if not os.path.exists(model_path):
        print("Downloading face landmarker model...")
        urllib.request.urlretrieve(
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
            model_path
        )
        print("Model downloaded successfully")

# Face shape to style recommendations mapping
STYLE_RECOMMENDATIONS = {
    "Oval": {
        "description": "Your oval face shape is wonderfully balanced and versatile — almost any hairstyle will complement your features beautifully.",
        "recommended_styles": ["Layered Cuts", "Classic Bob", "Side-Swept Bangs", "Long Waves", "Pixie Cut"],
        "recommended_categories": ["Haircuts", "Coloring", "Bridal"],
        "avoid": "Very heavy, blunt bangs that hide your balanced proportions.",
        "tips": "You have the most versatile face shape — feel free to experiment with different styles!"
    },
    "Round": {
        "description": "Your round face has soft, equal proportions. Styles that add height and length will create a beautifully elongated look.",
        "recommended_styles": ["Long Layers", "Side Part", "Angular Bob", "Textured Waves", "Volume on Top"],
        "recommended_categories": ["Haircuts", "Coloring"],
        "avoid": "Chin-length bobs and centre parts that emphasise width.",
        "tips": "Adding height at the crown and keeping sides sleek will flatter your features most."
    },
    "Square": {
        "description": "Your square face has a strong jawline and defined angles. Soft, layered styles will complement your features elegantly.",
        "recommended_styles": ["Soft Layers", "Side-Swept Styles", "Textured Waves", "Wispy Bangs", "Long Bob"],
        "recommended_categories": ["Haircuts", "Coloring", "Skincare"],
        "avoid": "Very blunt, straight cuts that mirror your jaw's angular shape.",
        "tips": "Softening the angles around your jaw with layers or waves creates a stunning balance."
    },
    "Heart": {
        "description": "Your heart-shaped face has a wider forehead tapering to a delicate chin. Styles that add width at the chin level look amazing.",
        "recommended_styles": ["Chin-Length Bob", "Side Bangs", "Medium Layers", "Textured Lob", "Curtain Bangs"],
        "recommended_categories": ["Haircuts", "Makeup", "Skincare"],
        "avoid": "Styles with heavy volume at the crown that make the forehead appear wider.",
        "tips": "Adding fullness around your chin and jawline creates perfect harmony."
    },
    "Oblong": {
        "description": "Your oblong face is longer than it is wide with elegant proportions. Styles that add width and break the length look fantastic.",
        "recommended_styles": ["Bangs", "Shoulder-Length Cuts", "Waves and Curls", "Side Volume", "Layered Bob"],
        "recommended_categories": ["Haircuts", "Coloring"],
        "avoid": "Very long, straight hair without layers that elongates the face further.",
        "tips": "Adding bangs and width at the sides will beautifully balance your proportions."
    }
}


class FaceAnalysisRequest(BaseModel):
    image: str  # Base64 encoded image


class FaceAnalysisResponse(BaseModel):
    face_shape: str
    confidence: float
    description: str
    recommended_styles: list
    recommended_categories: list
    avoid: str
    tips: str


def classify_face_shape(landmarks, img_w, img_h):
    """Classify face shape based on facial landmark ratios."""
    
    def get_point(idx):
        lm = landmarks[idx]
        # Both legacy and Tasks API use normalized .x/.y (0-1)
        return (lm.x * img_w, lm.y * img_h)
    
    def dist(a, b):
        ax, ay = get_point(a)
        bx, by = get_point(b)
        return ((ax - bx)**2 + (ay - by)**2) ** 0.5
    
    forehead_width = dist(71, 301)
    cheekbone_width = dist(234, 454)
    jawline_width = dist(172, 397)
    face_height = dist(10, 152)
    
    # Calculate key ratios
    width_to_height = cheekbone_width / face_height if face_height > 0 else 0
    forehead_to_cheek = forehead_width / cheekbone_width if cheekbone_width > 0 else 0
    jaw_to_cheek = jawline_width / cheekbone_width if cheekbone_width > 0 else 0
    forehead_to_jaw = forehead_width / jawline_width if jawline_width > 0 else 0
    
    # Debug logging
    print(f"[FaceShape] Measurements: forehead={forehead_width:.1f}, cheek={cheekbone_width:.1f}, jaw={jawline_width:.1f}, height={face_height:.1f}")
    print(f"[FaceShape] Ratios: w/h={width_to_height:.3f}, fh/cheek={forehead_to_cheek:.3f}, jaw/cheek={jaw_to_cheek:.3f}, fh/jaw={forehead_to_jaw:.3f}")
    
    # Score each face shape — highest score wins
    scores = {"Oval": 0, "Round": 0, "Square": 0, "Heart": 0, "Oblong": 0}
    
    # ROUND: face width close to face height, cheeks are widest
    if width_to_height > 0.68:
        scores["Round"] += 2
    if width_to_height > 0.75:
        scores["Round"] += 3
    if width_to_height > 0.82:
        scores["Round"] += 2
    if jaw_to_cheek < 0.90:
        scores["Round"] += 1
    
    # SQUARE: strong jaw nearly as wide as cheekbones
    if jaw_to_cheek > 0.90:
        scores["Square"] += 2
    if jaw_to_cheek > 0.95:
        scores["Square"] += 3
    if width_to_height > 0.68 and jaw_to_cheek > 0.88:
        scores["Square"] += 2
    
    # HEART: forehead significantly wider than jaw
    if forehead_to_jaw > 1.15:
        scores["Heart"] += 2
    if forehead_to_jaw > 1.25:
        scores["Heart"] += 3
    if jaw_to_cheek < 0.82:
        scores["Heart"] += 2
    
    # OBLONG: face much longer than wide
    if width_to_height < 0.62:
        scores["Oblong"] += 3
    if width_to_height < 0.55:
        scores["Oblong"] += 3
    if 0.82 < jaw_to_cheek < 0.95:
        scores["Oblong"] += 1
    
    # OVAL: balanced — moderate width-to-height, forehead slightly wider than jaw
    if 0.62 <= width_to_height <= 0.70:
        scores["Oval"] += 3
    if 1.05 < forehead_to_jaw < 1.20:
        scores["Oval"] += 2
    if 0.82 < jaw_to_cheek < 0.92:
        scores["Oval"] += 2
    
    print(f"[FaceShape] Scores: {scores}")
    
    # Get the winning shape
    shape = max(scores, key=scores.get)
    max_score = scores[shape]
    total_score = sum(scores.values()) or 1
    
    # If all scores are 0, default to Oval
    if max_score == 0:
        shape = "Oval"
        confidence = 0.70
    else:
        confidence = 0.65 + min(0.30, (max_score / total_score) * 0.45)
    
    print(f"[FaceShape] Result: {shape} ({confidence:.0%})")
    return shape, min(confidence, 0.95)


@app.post("/analyze-face", response_model=FaceAnalysisResponse)
def analyze_face(request: FaceAnalysisRequest):
    try:
        # Decode base64 image
        try:
            # Handle data URL format (data:image/jpeg;base64,...)
            image_data = request.image
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            img_bytes = base64.b64decode(image_data)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            
            if img is None:
                raise ValueError("Could not decode image")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image. Please upload a clear photo.")
        
        img_h, img_w = img.shape[:2]
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        face_landmarks = None
        
        if MEDIAPIPE_LEGACY:
            # Legacy MediaPipe solutions API
            with mp_face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5
            ) as face_mesh:
                results = face_mesh.process(img_rgb)
            
            if not results.multi_face_landmarks:
                raise HTTPException(
                    status_code=422, 
                    detail="No face detected. Please upload a clear, front-facing photo with good lighting."
                )
            face_landmarks = results.multi_face_landmarks[0].landmark
        else:
            # New MediaPipe Tasks API
            model_path = os.path.join(os.path.dirname(__file__), 'face_landmarker.task')
            base_options = mp_python.BaseOptions(model_asset_path=model_path)
            options = mp_vision.FaceLandmarkerOptions(
                base_options=base_options,
                running_mode=mp_vision.RunningMode.IMAGE,
                num_faces=1,
                min_face_detection_confidence=0.5,
                min_face_presence_confidence=0.5,
            )
            
            with mp_vision.FaceLandmarker.create_from_options(options) as landmarker:
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
                result = landmarker.detect(mp_image)
            
            if not result.face_landmarks:
                raise HTTPException(
                    status_code=422,
                    detail="No face detected. Please upload a clear, front-facing photo with good lighting."
                )
            
            # Convert Tasks API landmarks to match legacy format (has .x, .y attributes)
            face_landmarks = result.face_landmarks[0]
        
        # Classify face shape
        face_shape, confidence = classify_face_shape(face_landmarks, img_w, img_h)
        
        # Get recommendations for this shape
        rec = STYLE_RECOMMENDATIONS.get(face_shape, STYLE_RECOMMENDATIONS["Oval"])
        
        return FaceAnalysisResponse(
            face_shape=face_shape,
            confidence=round(confidence, 2),
            description=rec["description"],
            recommended_styles=rec["recommended_styles"],
            recommended_categories=rec["recommended_categories"],
            avoid=rec["avoid"],
            tips=rec["tips"]
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)