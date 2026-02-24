#!/usr/bin/env python3
"""
Train (or retrain) the XGBoost behaviour-risk classifier.

Generates a small synthetic training dataset, trains an XGBoostClassifier
and saves the model to models/xgboost_behavior.pkl.

Usage:
    python scripts/train_model.py

Feature vector (must match BehaviourFeatures in risk_aggregator.py):
    [tab_switches, copy_paste_count, context_menu_count,
     fullscreen_exits, focus_loss_count, event_rate_per_min]

Labels:
    0 = normal behaviour
    1 = suspicious / high-risk behaviour
"""
from __future__ import annotations

import os
import sys

# Allow running from repo root or scripts/ directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import joblib
from xgboost import XGBClassifier

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "xgboost_behavior.pkl")
RANDOM_SEED = 42


def generate_dataset(n_samples: int = 2000):
    """
    Generate a synthetic dataset that captures plausible exam-fraud patterns.
    Each sample is one 5-minute rolling window.
    """
    rng = np.random.default_rng(RANDOM_SEED)

    X_list = []
    y_list = []

    # ── Normal behaviour (70 % of samples) ───────────────────────────────
    n_normal = int(n_samples * 0.70)
    for _ in range(n_normal):
        tab_sw     = rng.integers(0, 3)
        copy_paste = rng.integers(0, 2)
        ctx_menu   = rng.integers(0, 2)
        fs_exits   = rng.integers(0, 1)
        focus_loss = rng.integers(0, 2)
        event_rate = rng.uniform(0.0, 2.0)
        X_list.append([tab_sw, copy_paste, ctx_menu, fs_exits, focus_loss, event_rate])
        y_list.append(0)

    # ── Suspicious behaviour (30 % of samples) ──────────────────────────
    n_sus = n_samples - n_normal
    for _ in range(n_sus):
        tab_sw     = rng.integers(3, 20)
        copy_paste = rng.integers(2, 15)
        ctx_menu   = rng.integers(2, 10)
        fs_exits   = rng.integers(1, 8)
        focus_loss = rng.integers(2, 12)
        event_rate = rng.uniform(3.0, 20.0)
        X_list.append([tab_sw, copy_paste, ctx_menu, fs_exits, focus_loss, event_rate])
        y_list.append(1)

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int32)

    # Shuffle
    idx = rng.permutation(len(y))
    return X[idx], y[idx]


def train():
    print("Generating synthetic training data …")
    X, y = generate_dataset(n_samples=4000)

    split = int(len(X) * 0.80)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    print(f"Training samples: {len(X_train)}  Validation samples: {len(X_val)}")

    clf = XGBClassifier(
        n_estimators    = 200,
        max_depth       = 4,
        learning_rate   = 0.05,
        subsample       = 0.8,
        colsample_bytree= 0.8,
        use_label_encoder=False,
        eval_metric     = "logloss",
        random_state    = RANDOM_SEED,
    )
    clf.fit(
        X_train, y_train,
        eval_set        = [(X_val, y_val)],
        verbose         = 50,
    )

    # Quick validation accuracy
    val_acc = (clf.predict(X_val) == y_val).mean()
    print(f"Validation accuracy: {val_acc:.3f}")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    joblib.dump(clf, OUTPUT_PATH)
    print(f"Model saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    train()
