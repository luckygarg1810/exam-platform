FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100

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

# ✅ 🔥 Use fast mirror + cache
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip wheel \
    -i https://pypi.tuna.tsinghua.edu.cn/simple

# ✅ 🔥 Install ALL deps together (better resolver + fewer layers)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt \
    -i https://pypi.tuna.tsinghua.edu.cn/simple

# ❗ OPTIONAL: If you DON'T need GPU → REMOVE THIS from requirements.txt:
# nvidia_nccl_cu12
# torch with CUDA

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