# AI Service — Implementation Documentation

## Overview

The AI Service is a Python FastAPI application that provides real-time proctoring analysis for the Exam Platform. It processes video frames, audio clips, and behavioral events to detect cheating attempts during online exams.

---

## Architecture

```
RabbitMQ queues                 AI Service                   RabbitMQ queue
──────────────                  ──────────                   ──────────────
frame.analysis   ──────────→  FrameConsumer                      ↓
audio.analysis   ──────────→  AudioConsumer   ───────────→  proctoring.results
behavior.events  ──────────→  BehaviorConsumer                    ↓
                                                          Spring Boot Backend
HTTP client      ──────────→  FastAPI Routes             (ProctoringResultConsumer)
(Spring Boot)                 GET  /health                        ↓
                              POST /ai/verify-identity        PostgreSQL
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| AI service does NOT write to PostgreSQL directly | Spring Boot owns all DB writes — avoids dual-write race conditions |
| Thread-local pika connections | `pika.BlockingConnection` is not thread-safe; each consumer thread owns one connection |
| Model fallback / degraded mode | Missing models degrade gracefully (YOLO → skip object detection; face_recognition → disable verify endpoint) |
| Single uvicorn worker | Consumers are threads inside the process; multiple workers would duplicate threads |
| Synthetic XGBoost training | Provides a functional model out of the box without labelled production data |

---

## Module Structure

```
ai-service/
├── app/
│   ├── config.py           Settings (pydantic-settings, env vars)
│   ├── main.py             FastAPI app + lifespan (model loading + consumer start)
│   ├── api/
│   │   └── routes.py       GET /health, POST /ai/verify-identity
│   ├── consumers/
│   │   ├── base_consumer.py    Abstract RabbitMQ consumer thread (reconnect logic)
│   │   ├── frame_consumer.py   Processes frame.analysis messages
│   │   ├── audio_consumer.py   Processes audio.analysis messages
│   │   └── behavior_consumer.py Processes behavior.events messages
│   ├── db/
│   │   ├── database.py     SQLAlchemy engine, get_db() context manager
│   │   └── models.py       Read-only ORM models (ExamSession, User, Enrollment)
│   ├── ml/
│   │   ├── model_loader.py     Loads YOLO, XGBoost, face_recognition, MediaPipe
│   │   └── risk_aggregator.py  Weighted risk scoring + violation generation
│   ├── modules/
│   │   ├── face_monitor.py     MediaPipe BlazeFace — face count + presence
│   │   ├── gaze_tracker.py     MediaPipe FaceMesh + OpenCV solvePnP — head pose
│   │   ├── mouth_monitor.py    Lip distance ratio — mouth open detection
│   │   ├── object_detector.py  YOLOv8n — phone / book / extra person
│   │   └── audio_vad.py        webrtcvad — speech activity detection
│   ├── publisher/
│   │   └── result_publisher.py Thread-local pika publisher → proctoring.results
│   └── storage/
│       └── minio_client.py     MinIO upload/download wrapper
├── models/                     ML model weights (auto-downloaded / trained)
├── scripts/
│   └── train_model.py          Synthetic XGBoost behaviour classifier training
├── tests/
│   ├── test_audio_vad.py
│   ├── test_risk_aggregator.py
│   └── test_object_detector.py
├── Dockerfile
└── requirements.txt
```

---

## Message Contracts

### Spring Boot → AI (`frame.analysis`)
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "frameData": "<base64-encoded JPEG>",
  "timestamp": 1700000000000
}
```

### Spring Boot → AI (`audio.analysis`)
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "audioData": "<base64-encoded WebM/Opus>",
  "timestamp": 1700000000000
}
```

### Spring Boot → AI (`behavior.events`)
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "TAB_SWITCH",
  "timestamp": 1700000000000
}
```

Supported `type` values (match `BehavioralEventType.java`):
`TAB_SWITCH`, `COPY_PASTE`, `CONTEXT_MENU`, `FULLSCREEN_EXIT`, `FOCUS_LOSS`

### AI → Spring Boot (`proctoring.results`)
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "PHONE_DETECTED",
  "severity": "HIGH",
  "confidence": 0.87,
  "description": "Mobile phone detected in frame",
  "snapshotPath": "proctoring-snapshots/session-id/abc123.jpg",
  "riskScore": 0.72,
  "metadata": {
    "phone_confidence": 0.87,
    "head_yaw": 12.5,
    "head_pitch": -3.2
  }
}
```

### POST `/ai/verify-identity`
Request:
```json
{
  "live_selfie_base64": "<base64-encoded JPEG/PNG>",
  "student_id": "550e8400-e29b-41d4-a716-446655440000"
}
```
Response:
```json
{
  "match": true,
  "confidence": 0.91,
  "message": "Identity verified"
}
```

---

## Risk Scoring

### Frame Analysis Weights
| Component | Weight | Score Drivers |
|---|---|---|
| Face detection | 30% | face_missing=1.0, multiple_faces=0.7 |
| Gaze tracking | 20% | gaze_off_screen=1.0, eyes_closed=0.6 |
| Object detection | 20% | phone=1.0, notes=0.8, extra_person=0.9 |
| Mouth monitor | 10% | mouth_open=0.4 |
| Behavior | 20% | XGBoost probability OR rule-based |

### Severity Thresholds
| Severity | Risk Score |
|---|---|
| NONE | 0.0 |
| LOW | 0.0 – 0.40 |
| MEDIUM | 0.40 – 0.75 |
| HIGH | 0.75 – 0.90 |
| CRITICAL | ≥ 0.90 |

Only MEDIUM/HIGH/CRITICAL violations are published. LOW violations are suppressed to reduce noise.

### Violation Event Types
| Event Type | Trigger |
|---|---|
| `FACE_NOT_DETECTED` | No face in frame |
| `MULTIPLE_FACES` | ≥ 2 faces detected |
| `GAZE_AWAY` | Head yaw or pitch beyond threshold |
| `PHONE_DETECTED` | YOLO detects cell phone |
| `NOTES_DETECTED` | YOLO detects book/notes |
| `MULTIPLE_PERSONS` | ≥ 2 persons in frame |
| `SUSPICIOUS_AUDIO` | Speech detected in audio clip |
| `SUSPICIOUS_BEHAVIOR` | Behavior risk score elevated |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `examdb` | Database name |
| `DB_USER` | `examuser` | Database user |
| `DB_PASSWORD` | `exampass` | Database password |
| `RABBITMQ_URL` | *(computed)* | Full AMQP URL override |
| `RABBITMQ_HOST` | `rabbitmq` | Used to compute URL if not set |
| `RABBITMQ_USER` | `examuser` | |
| `RABBITMQ_PASSWORD` | `exampass` | |
| `MINIO_ENDPOINT` | `minio:9000` | `host:port` or `http://host:port` |
| `MINIO_ACCESS_KEY` | `minioadmin` | |
| `MINIO_SECRET_KEY` | `minioadmin` | |
| `MINIO_SECURE` | `false` | Use TLS |
| `FACE_CONFIDENCE_THRESHOLD` | `0.7` | MediaPipe face detection threshold |
| `GAZE_YAW_THRESHOLD` | `25` | Max head yaw (degrees) before GAZE_AWAY |
| `GAZE_PITCH_THRESHOLD` | `25` | Max head pitch (degrees) |
| `LIP_DISTANCE_THRESHOLD` | `0.06` | Lip-gap ratio for mouth-open detection |
| `PHONE_CONFIDENCE_THRESHOLD` | `0.50` | YOLO score for phone alert |
| `NOTES_CONFIDENCE_THRESHOLD` | `0.55` | YOLO score for notes alert |
| `SPEECH_RATIO_THRESHOLD` | `0.20` | Speech fraction for audio alert |
| `FACE_RECOGNITION_THRESHOLD` | `0.6` | Max face distance for identity match |
| `PORT` | `8001` | HTTP listen port |

---

## Running Locally

### 1. Install dependencies
```bash
cd ai-service
pip install -r requirements.txt
```
> Note: `face-recognition` requires `dlib` which requires `cmake` and build tools.
> On Ubuntu: `sudo apt-get install cmake build-essential libboost-all-dev`

### 2. (Optional) Train XGBoost model
```bash
python scripts/train_model.py
```

### 3. Start the service
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 4. With Docker Compose
```bash
# From project root
docker compose up ai-service
```

### 5. Run tests
```bash
cd ai-service
pytest tests/ -v
```

---

## Identity Verification Flow

1. Student submits `live_selfie_base64` (taken live in browser) + their `student_id`
2. Service fetches the reference photo from MinIO bucket: `profile-photos/{student_id}.jpg`
3. `face_recognition.face_encodings()` computes 128-d embeddings for both images
4. Euclidean distance compared against `FACE_RECOGNITION_THRESHOLD` (default 0.6)
5. Returns `{match, confidence, message}`

Reference photos must be uploaded to MinIO `profile-photos/` bucket during enrollment.

---

## Healthcheck

`GET /health` returns:
```json
{
  "status": "ok",
  "models": {
    "yolo_loaded": true,
    "xgboost_loaded": true,
    "face_rec_loaded": true,
    "mediapipe_ready": true
  },
  "dependencies": {
    "database": "ok",
    "minio": "ok"
  }
}
```

`status` is `"degraded"` if database or MinIO is unreachable.
The service still processes messages even in degraded state (consumers are resilient).
