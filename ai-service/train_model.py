"""
train_model.py — Trains a Random Forest classifier for no-show prediction.

Reads training_data.csv, one-hot encodes the category feature,
trains the model, evaluates it, and saves as model.pkl.

Run: python train_model.py
"""

import pandas as pd
import numpy as np
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, roc_auc_score

def train():
    # Load data
    data_path = os.path.join(os.path.dirname(__file__), 'training_data.csv')
    df = pd.read_csv(data_path)
    print(f"Loaded {len(df)} records")
    print(f"Overall no-show rate: {df['no_show'].mean():.1%}\n")

    # One-hot encode the category column
    df_encoded = pd.get_dummies(df, columns=['category'], prefix='cat')

    # Separate features and target
    feature_cols = [c for c in df_encoded.columns if c != 'no_show']
    X = df_encoded[feature_cols]
    y = df_encoded['no_show']

    # Train/test split (80/20)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"Training set: {len(X_train)} records")
    print(f"Test set: {len(X_test)} records\n")

    # Train Random Forest
    model = RandomForestClassifier(
        n_estimators=100,       # 100 decision trees
        max_depth=10,           # Prevent overfitting
        min_samples_split=5,
        min_samples_leaf=3,
        random_state=42,
        class_weight='balanced' # Handle class imbalance (fewer no-shows than shows)
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    print("=" * 50)
    print("MODEL EVALUATION")
    print("=" * 50)
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.1%}")
    print(f"ROC-AUC:  {roc_auc_score(y_test, y_prob):.3f}")
    print(f"\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['Showed Up', 'No-Show']))

    # Feature importance
    importance = pd.Series(model.feature_importances_, index=feature_cols).sort_values(ascending=False)
    print("\nFeature Importance (Top 7):")
    for feat, imp in importance.head(7).items():
        bar = "█" * int(imp * 50)
        print(f"  {feat:25s} {imp:.3f} {bar}")

    # Save model and feature columns (needed for prediction)
    model_path = os.path.join(os.path.dirname(__file__), 'model.pkl')
    metadata = {
        'model': model,
        'feature_columns': feature_cols,
        'categories': ['Hair', 'Nails', 'Skincare', 'Body', 'Makeup']
    }
    joblib.dump(metadata, model_path)
    print(f"\n✅ Model saved to: {model_path}")
    print(f"   Feature columns: {feature_cols}")

if __name__ == '__main__':
    train()
