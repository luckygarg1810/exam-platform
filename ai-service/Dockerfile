FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=200

# ✅ Faster apt (no recommended packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
        cmake \
        build-essential \
        ffmpeg \
        libglib2.0-0 \
        libgomp1 \
        libsm6 \
        libxext6 \
        libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# ✅ Upgrade pip using official PyPI
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip wheel \
    --retries 5 --timeout 200

# ✅ Install dlib separately (long compile — cached as its own layer)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install "dlib==19.24.4" \
    --retries 5 --timeout 200

# ✅ Install torch CPU-only (avoids pulling the massive CUDA build ~2GB)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu \
    --retries 5 --timeout 200

# ✅ Install remaining deps from official PyPI
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt \
    --retries 5 --timeout 200

# ✅ Pre-download YOLO model (cached)
RUN --mount=type=cache,target=/root/.cache/ultralytics \
    python - <<EOF
from ultralytics import YOLO
YOLO("yolov8n.pt")
EOF

COPY . .

RUN mkdir -p /app/models

EXPOSE 8001

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]