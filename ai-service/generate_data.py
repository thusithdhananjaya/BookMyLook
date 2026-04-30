"""
generate_data.py — Generates 2,000 synthetic salon booking records with realistic no-show patterns.

Features:
  1. day_of_week      (0=Mon to 6=Sun)
  2. hour_of_day      (9-17 typical salon hours)
  3. category         (Hair, Nails, Skincare, Body, Makeup)
  4. lead_time_days   (0-30, days between booking creation and appointment)
  5. payment_online   (0 or 1)
  6. used_loyalty     (0 or 1)
  7. previous_no_shows (0-5, customer's historical no-show count)

Target:
  no_show (0 = showed up, 1 = no-show)

No-show probability is influenced by realistic patterns:
  - Same-day bookings → higher risk
  - Evening hours → higher risk
  - Monday/Friday → slightly higher risk
  - Pay-at-salon → higher risk than online payment
  - No loyalty points used → higher risk
  - Previous no-shows → significantly higher risk (strongest predictor)
"""

import pandas as pd
import numpy as np
import os

np.random.seed(42)

NUM_RECORDS = 2000
NUM_CUSTOMERS = 300  # Simulate repeat customers

def generate_data():
    records = []

    # Pre-assign no-show history to customers (some are reliable, some aren't)
    customer_no_show_history = {}
    for cid in range(NUM_CUSTOMERS):
        # 70% of customers have 0 no-shows, 20% have 1-2, 10% have 3-5
        r = np.random.random()
        if r < 0.70:
            customer_no_show_history[cid] = 0
        elif r < 0.90:
            customer_no_show_history[cid] = np.random.randint(1, 3)
        else:
            customer_no_show_history[cid] = np.random.randint(3, 6)

    categories = ['Hair', 'Nails', 'Skincare', 'Body', 'Makeup']

    for _ in range(NUM_RECORDS):
        # Random customer
        customer_id = np.random.randint(0, NUM_CUSTOMERS)
        previous_no_shows = customer_no_show_history[customer_id]

        # Features
        day_of_week = np.random.randint(0, 7)       # 0=Mon, 6=Sun
        hour_of_day = np.random.choice(range(9, 18)) # 9 AM to 5 PM
        category = np.random.choice(categories)
        lead_time_days = max(0, int(np.random.exponential(7)))  # Most book within a week
        lead_time_days = min(lead_time_days, 30)
        payment_online = np.random.choice([0, 1], p=[0.6, 0.4])
        used_loyalty = np.random.choice([0, 1], p=[0.75, 0.25])

        # Calculate no-show probability based on realistic patterns
        base_prob = 0.12  # 12% base no-show rate (industry average)

        # Previous no-shows — strongest predictor
        if previous_no_shows >= 3:
            base_prob += 0.35
        elif previous_no_shows >= 1:
            base_prob += 0.15

        # Same-day booking = impulsive, higher risk
        if lead_time_days == 0:
            base_prob += 0.10
        elif lead_time_days > 14:
            base_prob += 0.08  # Very far out = might forget

        # Late afternoon slightly higher
        if hour_of_day >= 16:
            base_prob += 0.06

        # Monday and Friday slightly higher
        if day_of_week in [0, 4]:
            base_prob += 0.04

        # Online payment = commitment, reduces risk
        if payment_online == 1:
            base_prob -= 0.10

        # Loyalty points = engaged customer, reduces risk
        if used_loyalty == 1:
            base_prob -= 0.08

        # Category effects (minor)
        if category == 'Body':  # Massage — easier to skip
            base_prob += 0.03
        elif category == 'Hair':  # Haircut — more committed
            base_prob -= 0.02

        # Clamp probability
        prob = np.clip(base_prob, 0.02, 0.92)

        # Sample outcome
        no_show = np.random.choice([0, 1], p=[1 - prob, prob])

        records.append({
            'day_of_week': day_of_week,
            'hour_of_day': hour_of_day,
            'category': category,
            'lead_time_days': lead_time_days,
            'payment_online': payment_online,
            'used_loyalty': used_loyalty,
            'previous_no_shows': previous_no_shows,
            'no_show': no_show
        })

    df = pd.DataFrame(records)

    # Save to CSV
    output_path = os.path.join(os.path.dirname(__file__), 'training_data.csv')
    df.to_csv(output_path, index=False)

    # Print stats
    print(f"Generated {len(df)} records")
    print(f"No-show rate: {df['no_show'].mean():.1%}")
    print(f"\nNo-show rate by previous_no_shows:")
    print(df.groupby('previous_no_shows')['no_show'].mean().round(3))
    print(f"\nNo-show rate by payment method:")
    print(df.groupby('payment_online')['no_show'].mean().round(3))
    print(f"\nSaved to: {output_path}")

if __name__ == '__main__':
    generate_data()
