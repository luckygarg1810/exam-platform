# ─────────────────────────────────────────────────────────────
# Base image
# ─────────────────────────────────────────────────────────────
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# ─────────────────────────────────────────────────────────────
# System dependencies (cached aggressively)
#
# Removed: libboost-all-dev  — dlib 19.24+ does NOT require Boost on Linux.
#          Removing it saves ~500 MB of apt downloads (~5-10 min).
# ─────────────────────────────────────────────────────────────
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

# ─────────────────────────────────────────────────────────────
# Workdir
# ─────────────────────────────────────────────────────────────
WORKDIR /app

# ─────────────────────────────────────────────────────────────
# Python deps (MAX CACHE HIT)
#
# dlib is installed in its own layer BEFORE the rest of requirements.txt.
# This means:
#   - A change to any other requirement does NOT trigger a dlib recompile.
#   - The pip cache mount persists the compiled .whl between builds on the
#     same machine, so subsequent builds reuse the cached wheel instantly.
# ─────────────────────────────────────────────────────────────
COPY requirements.txt .

# Step 1: install dlib alone (C++ compile — slow first time, cached after).
# CMAKE_BUILD_PARALLEL_LEVEL and MAKEFLAGS are set inline (not in ENV) because
# ENV does not support shell command substitution — $(nproc) would be treated
# as a literal string there.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip wheel \
    && CMAKE_BUILD_PARALLEL_LEVEL=$(nproc) MAKEFLAGS="-j$(nproc)" \
       pip install "dlib==19.24.4"

# Step 2: install everything else (fast — all pure Python or pre-built wheels)
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# ─────────────────────────────────────────────────────────────
# Pre-download ML models (before app code)
# ─────────────────────────────────────────────────────────────
RUN --mount=type=cache,target=/root/.cache/ultralytics \
    python - <<EOF
from ultralytics import YOLO
YOLO("yolov8n.pt")
EOF

# ─────────────────────────────────────────────────────────────
# App code (changes often → last)
# ─────────────────────────────────────────────────────────────
COPY . .

# ─────────────────────────────────────────────────────────────
# Persistent directories
# ─────────────────────────────────────────────────────────────
RUN mkdir -p /app/models

# ─────────────────────────────────────────────────────────────
# Expose & run
# ─────────────────────────────────────────────────────────────
EXPOSE 8001

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]