"""
MinIO client wrapper.

Provides:
  - upload_bytes()        — save snapshot/audio bytes and return the object key
  - download_bytes()      — fetch an object (used for identity verification)
  - ensure_bucket_exists()
"""
import io
import logging
import uuid
from datetime import datetime
from urllib.parse import urlparse

from minio import Minio
from minio.error import S3Error

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _build_client() -> Minio:
    endpoint = settings.minio_endpoint
    # Support both "minio:9000" and "http://minio:9000" formats
    if "://" in endpoint:
        parsed = urlparse(endpoint)
        host   = parsed.netloc    # e.g. "minio:9000"
        secure = parsed.scheme == "https"
    else:
        host   = endpoint         # e.g. "minio:9000" — use as-is
        secure = settings.minio_secure
    return Minio(
        host,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=secure,
    )


# Module-level singleton — safe to share across threads (Minio client is thread-safe)
_client: Minio | None = None


def get_client() -> Minio:
    global _client
    if _client is None:
        _client = _build_client()
    return _client


def ensure_bucket_exists(bucket: str) -> None:
    """Create the bucket if it doesn't exist yet."""
    client = get_client()
    try:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
            logger.info("Created MinIO bucket: %s", bucket)
    except S3Error as exc:
        logger.warning("Could not ensure bucket '%s': %s", bucket, exc)


def upload_bytes(
    bucket: str,
    data: bytes,
    content_type: str = "application/octet-stream",
    prefix: str = "",
    extension: str = "bin",
) -> str | None:
    """
    Upload raw bytes to MinIO.

    Returns the object key (path inside the bucket) so it can be stored
    as snapshotPath in the proctoring result message.
    Returns None on failure (non-fatal — proctoring continues without snapshot).
    """
    client = get_client()
    try:
        ensure_bucket_exists(bucket)
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        key = f"{prefix}/{timestamp}_{uuid.uuid4().hex[:8]}.{extension}".lstrip("/")
        client.put_object(
            bucket_name=bucket,
            object_name=key,
            data=io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
        logger.debug("Uploaded %d bytes → %s/%s", len(data), bucket, key)
        return key
    except S3Error as exc:
        logger.error("MinIO upload failed for bucket '%s': %s", bucket, exc)
        return None


def download_bytes(bucket: str, key: str) -> bytes | None:
    """
    Download an object from MinIO.
    Returns raw bytes, or None on failure.
    """
    client = get_client()
    try:
        response = client.get_object(bucket, key)
        data = response.read()
        response.close()
        response.release_conn()
        return data
    except S3Error as exc:
        logger.error("MinIO download failed (%s/%s): %s", bucket, key, exc)
        return None


def check_minio_connection() -> bool:
    """Returns True if MinIO is reachable."""
    try:
        get_client().list_buckets()
        return True
    except Exception as exc:
        logger.warning("MinIO connectivity check failed: %s", exc)
        return False


# ── Convenience class façade ────────────────────────────────────────────────
# Consumers and routes use `MinioClient.upload_bytes(...)` / `MinioClient.download_bytes(...)`.
# This thin wrapper class delegates to the module-level functions above.

class MinioClient:
    """Static façade over the module-level MinIO helpers."""

    @staticmethod
    def upload_bytes(
        bucket: str,
        object_key: str | None = None,
        data: bytes = b"",
        content_type: str = "application/octet-stream",
        prefix: str = "",
        extension: str = "bin",
    ) -> str | None:
        """
        Upload bytes to MinIO.

        If `object_key` is provided it is used directly as the object name.
        Otherwise a name is auto-generated from prefix/timestamp/uuid.
        Returns the object key on success, None on failure.
        """
        client = get_client()
        ensure_bucket_exists(bucket)
        try:
            if object_key is None:
                timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                object_key = f"{prefix}/{timestamp}_{uuid.uuid4().hex[:8]}.{extension}".lstrip("/")
            client.put_object(
                bucket_name  = bucket,
                object_name  = object_key,
                data         = io.BytesIO(data),
                length       = len(data),
                content_type = content_type,
            )
            logger.debug("Uploaded %d bytes → %s/%s", len(data), bucket, object_key)
            return object_key
        except S3Error as exc:
            logger.error("MinIO upload failed (%s/%s): %s", bucket, object_key, exc)
            return None

    @staticmethod
    def download_bytes(bucket: str, object_key: str) -> bytes | None:
        """Download an object from MinIO. Returns bytes or None on failure."""
        return download_bytes(bucket, object_key)

    @staticmethod
    def ensure_bucket_exists(bucket: str) -> None:
        """Create the bucket if it does not exist."""
        ensure_bucket_exists(bucket)
