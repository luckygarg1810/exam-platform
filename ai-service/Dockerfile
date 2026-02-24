# ─── Base image ─────────────────────────────────────────────────────────────
FROM python:3.11-slim

# ─── System dependencies ─────────────────────────────────────────────────────
# • cmake + build-essential → compile dlib (face_recognition)
# • ffmpeg                  → pydub audio conversion
# • libglib2.0-0, libgomp1  → OpenCV / MediaPipe shared libs
# • libsm6, libxext6        → OpenCV headless display shim (not actually displayed)
RUN apt-get update && apt-get install -y --no-install-recommends \
        cmake \
        build-essential \
        libboost-all-dev \
        ffmpeg \
        libglib2.0-0 \
        libgomp1 \
        libsm6 \
        libxext6 \
        libgl1 \
    && rm -rf /var/lib/apt/lists/*

# ─── Working directory ───────────────────────────────────────────────────────
WORKDIR /app

# ─── Python dependencies ─────────────────────────────────────────────────────
# Copy requirements first to exploit Docker layer caching
COPY requirements.txt .

# Upgrade pip, install wheel, then install project deps
RUN pip install --upgrade pip wheel \
    && pip install --no-cache-dir -r requirements.txt

# ─── Application code ────────────────────────────────────────────────────────
COPY . .

# ─── Pre-download / pre-build artefacts (optional cache warm-up) ─────────────
# YOLOv8n weights are downloaded on first use; pre-download to avoid
# container startup delays.  Comment out if offline / air-gapped.
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" 2>/dev/null || true

# ─── Models directory (for persisted XGBoost model) ──────────────────────────
RUN mkdir -p /app/models

# ─── Expose HTTP port ─────────────────────────────────────────────────────────
EXPOSE 8001

# ─── Entrypoint ──────────────────────────────────────────────────────────────
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
