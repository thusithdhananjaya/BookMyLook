# BookMyLook

**An AI-Enhanced Salon Discovery and Booking Platform for Sri Lanka**

BookMyLook is a Progressive Web Application that digitises salon appointment booking, replacing the phone-call and walk-in booking culture common in the Sri Lankan salon industry with a real-time, intelligent booking platform. It combines a standard booking engine with two AI-powered features — no-show risk prediction and face-shape-based style recommendations — to bring modern digital tooling to an underserved market.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [AI Features](#ai-features)
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Test Credentials](#test-credentials)
- [Firestore Data Model](#firestore-data-model)
- [Known Limitations](#known-limitations)
- [Future Work](#future-work)

---

## Overview

Salon booking in Sri Lanka is still handled almost entirely through phone calls and walk-ins — a process that is inefficient for customers and operationally disruptive for salon staff. No-shows are a significant source of lost revenue, and salons have no digital way to showcase their work or reward loyal customers.

BookMyLook addresses this with a dual-portal system:

- **Customer Portal** — discover salons, browse visual lookbooks, book appointments in a guided multi-step flow, pay online or at the salon, earn and redeem loyalty points, and get AI-powered hairstyle recommendations.
- **Admin (Salon Owner) Portal** — manage bookings with AI-generated no-show risk scores, run the service menu, manage staff and lookbook photos, and track performance through a real-time analytics dashboard.

---

## Key Features

| Feature | Description |
|---|---|
| **Role-Based Authentication** | Separate customer and salon owner portals secured with Firebase Authentication and Firestore Security Rules |
| **Multi-Step Booking Engine** | 4-step wizard with live slot availability — booked times are automatically disabled |
| **Stripe Payments** | Online payment via Stripe Checkout Sessions, or pay-at-salon option |
| **Visual Lookbook** | Salon portfolio photo galleries stored in Firebase Storage, filterable by category |
| **Loyalty Points** | Automatic point accrual on confirmed bookings, redeemable for discounts |
| **Reviews & Ratings** | Customers rate and review completed appointments; live average ratings on salon cards |
| **Real-Time Notifications** | In-app notification bell for both portals using Firestore `onSnapshot` listeners |
| **Interactive Map Search** | Salon discovery via Leaflet + OpenStreetMap with location markers |
| **Analytics Dashboard** | Revenue trends, bookings-by-day, and popular-services charts for salon owners (Recharts) |
| **Email Confirmations** | Automated booking confirmation emails via EmailJS |
| **Progressive Web App** | Installable on any device with offline-capable service worker — no app store required |

---

## AI Features

BookMyLook's core differentiator is a dedicated Python FastAPI microservice providing two machine learning features, kept fully decoupled from the main application so a failure in the AI layer never blocks core booking functionality.

### 1. No-Show Risk Prediction

A **Random Forest classifier** (scikit-learn) trained on a 2,000-record synthetic dataset predicts the likelihood that a customer will miss their appointment.

- **7 input features:** `day_of_week`, `hour_of_day`, `service_category`, `lead_time_days`, `payment_online`, `used_loyalty`, `previous_no_shows`
- **Performance:** 76% accuracy, ROC-AUC 0.703
- **Strongest predictor:** `previous_no_shows` (feature importance 0.237)
- Risk is scored 0–100 and classified as **Low / Medium / High**, displayed as a colour-coded badge to salon owners at booking time.

### 2. AI Style Recommender ("Find Your Look")

Uses **Google's MediaPipe Face Landmarker** to analyse a customer's selfie and recommend hairstyles suited to their face shape.

- Detects **468 facial landmarks** per image
- Derives forehead, cheekbone, and jawline width ratios to classify face shape (Oval, Round, Square, Heart, Oblong)
- Cross-references the result with the salon's own lookbook to surface **personalised, salon-specific** style suggestions

---

## Tech Stack

**Frontend**
- React.js (Vite) + React Router v6
- Tailwind CSS
- Context API for state management
- Recharts (analytics) · React-Leaflet (maps)

**Backend / Infrastructure**
- Firebase Authentication
- Cloud Firestore (NoSQL database, real-time listeners)
- Firebase Storage (images)

**AI Microservice**
- Python 3.12 + FastAPI
- scikit-learn (Random Forest)
- MediaPipe (Face Landmarker)
- OpenCV, NumPy, Pandas, Joblib

**Third-Party Integrations**
- Stripe (payments, test mode)
- EmailJS (transactional email)
- Leaflet + OpenStreetMap (maps)

---

## System Architecture

BookMyLook uses a **decoupled three-tier architecture**:

```
┌─────────────────────┐        ┌──────────────────────┐
│   React.js PWA       │ ─────▶ │  Firebase (BaaS)      │
│   (Vite, port 5173)  │        │  Auth · Firestore ·    │
│                       │        │  Storage               │
└──────────┬───────────┘        └──────────────────────┘
           │  REST (JSON)
           ▼
┌──────────────────────┐        ┌──────────────────────┐
│  FastAPI AI Service   │ ─────▶ │  Stripe API            │
│  (Python, port 8000)  │        │  EmailJS               │
│  /predict              │        └──────────────────────┘
│  /analyze-face         │
│  /create-checkout-session │
│  /verify-payment       │
└──────────────────────┘
```

The frontend talks directly to Firebase for all core data operations, and separately to the FastAPI service for AI predictions and Stripe session handling. This means the booking and management features work independently even if the AI service is offline — bookings simply proceed without a risk score.

---

## Project Structure

```
BookMyLook/
├── src/
│   ├── AdminAppointments.jsx      # Admin: booking management + AI risk badges
│   ├── AdminDashboard.jsx         # Admin: KPIs + analytics charts
│   ├── AdminLoginPage.jsx         # Admin: registration (with approval flow) + login
│   ├── AdminLookbook.jsx          # Admin: portfolio photo management
│   ├── AdminLoyalty.jsx           # Admin: loyalty program settings
│   ├── AdminServices.jsx          # Admin: service menu CRUD
│   ├── AdminSettings.jsx          # Admin: salon profile & map coordinates
│   ├── AuthContext.jsx            # Firebase auth state provider
│   ├── BookingContext.jsx         # Shared booking flow state
│   ├── BookingStep1-4.jsx         # 4-step booking wizard
│   ├── BookingSuccess.jsx         # Post-payment confirmation page
│   ├── HomePage.jsx               # Customer dashboard
│   ├── SalonDetails.jsx           # Salon profile, services, gallery, reviews, staff
│   ├── SavedSalons.jsx            # Customer favourites
│   ├── MyAppointments.jsx         # Customer booking status view
│   ├── BookingHistory.jsx         # Customer past bookings
│   ├── Profile.jsx                # Customer profile management
│   ├── ProtectedRoute.jsx         # Role-based route guarding
│   └── firebase.js                # Firebase SDK configuration
├── ai-service/
│   ├── main.py                    # FastAPI app: predict, analyze-face, Stripe endpoints
│   ├── train_model.py             # Random Forest training script
│   ├── generate_data.py           # Synthetic dataset generator
│   ├── model.pkl                  # Serialised trained model
│   └── requirements.txt
├── public/
│   ├── manifest.json              # PWA manifest
│   └── sw.js                      # Service worker
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.12.x (required for MediaPipe/scikit-learn compatibility)
- A Firebase project with Authentication, Firestore, and Storage enabled
- A Stripe account (test mode is sufficient)
- An EmailJS account

### 1. Clone the repository

```bash
git clone https://github.com/thusithdhananjaya/BookMyLook.git
cd BookMyLook
```

### 2. Install frontend dependencies

```bash
npm install
```

### 3. Install AI service dependencies

```bash
cd ai-service
py -3.12 -m pip install -r requirements.txt
cd ..
```

### 4. Start the AI microservice

```bash
cd ai-service
py -3.12 main.py
```
You should see `Model loaded successfully` and `Uvicorn running on http://0.0.0.0:8000`. Leave this terminal running.

### 5. Start the frontend (in a new terminal)

```bash
npm run dev
```

Open the app at **http://localhost:5173**.

---

## Test Credentials

| Role | How to Access |
|---|---|
| Customer | Register a new account at `/login` — no approval needed |
| Salon Owner | Register at `/admin-login`. New salon accounts default to `status: "pending"` and must be manually approved in Firebase Console → Firestore → `users` collection → change `status` to `"approved"` before login is permitted |

**Stripe test card:** `4242 4242 4242 4242` · any future expiry · any 3-digit CVV

---

## Firestore Data Model

| Collection | Purpose |
|---|---|
| `users` | Customer and salon owner profiles (role-based fields) |
| `bookings` | Appointment records including AI risk fields |
| `services` | Per-salon service menu |
| `lookbook` | Portfolio photo metadata + Storage URLs |
| `reviews` | Customer ratings and feedback |
| `loyaltyLogs` | Point earn/redeem transaction history |
| `staff` | Salon team member profiles |
| `notifications` | Real-time alerts for both portals |

---

## Known Limitations

- No-show prediction model is trained on **synthetic data** (no historical bookings existed at build time) — accuracy would improve with real data
- Face shape classification favours certain shapes under poor lighting or non-frontal photos
- Search is keyword-based, not semantic
- Single-salon demo environment — multi-salon marketplace scaling untested
- No push notification system (in-app notifications only)

---

## Future Work

- Retrain the no-show model on real operational data
- Semantic/NLP-based salon and service search
- Push notifications via Firebase Cloud Messaging
- Multi-salon marketplace with a super-admin approval dashboard
- Native mobile apps (React Native) sharing the same Firebase backend
- Local payment gateway integration (e.g. PayHere) alongside Stripe
- Hair texture/colour analysis added to the Style Recommender
- Real-time chat between customers and salon owners

---

*This project was developed as a final year individual project and is intended for academic demonstration purposes.*
