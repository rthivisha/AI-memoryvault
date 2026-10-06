"""
Storage Backend Abstraction for AI MemoVault.
Supports LocalDiskBackend and S3StorageBackend stub selectable via STORAGE_BACKEND env var.
Files are organized per-user: storage/{user_id}/[originals|thumbnails|web]/
"""

import abc
import os
import shutil
from pathlib import Path
from typing import BinaryIO, Optional

from app.config import STORAGE_DIR, STORAGE_BACKEND


class StorageBackend(abc.ABC):
    """Abstract interface for file persistence."""

    @abc.abstractmethod
    def save(self, user_id: str, subfolder: str, filename: str, data: bytes) -> str:
        """Saves data bytes and returns relative path or identifier."""
        pass

    @abc.abstractmethod
    def get(self, user_id: str, subfolder: str, filename: str) -> Optional[bytes]:
        """Retrieves data bytes or None if not found."""
        pass

    @abc.abstractmethod
    def delete(self, user_id: str, subfolder: str, filename: str) -> bool:
        """Deletes file."""
        pass


class LocalDiskBackend(StorageBackend):
    """Persists files to local directory storage/{user_id}/{subfolder}/{filename}."""

    def __init__(self, base_dir: Path = STORAGE_DIR) -> None:
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_path(self, user_id: str, subfolder: str, filename: str) -> Path:
        target_dir = self.base_dir / user_id / subfolder
        target_dir.mkdir(parents=True, exist_ok=True)
        return target_dir / filename

    def save(self, user_id: str, subfolder: str, filename: str, data: bytes) -> str:
        file_path = self._get_path(user_id, subfolder, filename)
        with open(file_path, "wb") as f:
            f.write(data)
        return str(file_path.relative_to(self.base_dir))

    def get(self, user_id: str, subfolder: str, filename: str) -> Optional[bytes]:
        file_path = self._get_path(user_id, subfolder, filename)
        if not file_path.exists():
            return None
        with open(file_path, "rb") as f:
            return f.read()

    def delete(self, user_id: str, subfolder: str, filename: str) -> bool:
        file_path = self._get_path(user_id, subfolder, filename)
        if file_path.exists():
            try:
                file_path.unlink()
                return True
            except OSError:
                return False
        return False


class S3StorageBackend(StorageBackend):
    """
    S3 / MinIO compatible storage backend stub.
    Configured via AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET.
    Falls back to LocalDiskBackend if boto3 / minio is not installed.
    """

    def __init__(self) -> None:
        self.bucket = os.getenv("S3_BUCKET", "memovault")
        self.fallback = LocalDiskBackend()

    def save(self, user_id: str, subfolder: str, filename: str, data: bytes) -> str:
        # In this environment or local dev, fallback to disk storage
        return self.fallback.save(user_id, subfolder, filename, data)

    def get(self, user_id: str, subfolder: str, filename: str) -> Optional[bytes]:
        return self.fallback.get(user_id, subfolder, filename)

    def delete(self, user_id: str, subfolder: str, filename: str) -> bool:
        return self.fallback.delete(user_id, subfolder, filename)


def get_storage_backend() -> StorageBackend:
    if STORAGE_BACKEND.lower() == "s3":
        return S3StorageBackend()
    return LocalDiskBackend()
