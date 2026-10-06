"""
Configuration module for AI MemoVault backend.
Centralizes environment variables, file paths, security constants, and CORS settings.
"""

import os
from pathlib import Path

# Base directories
BASE_DIR: Path = Path(__file__).resolve().parent.parent
if (BASE_DIR.parent / "data").exists():
    DATA_DIR: Path = BASE_DIR.parent / "data"
    STORAGE_DIR: Path = BASE_DIR.parent / "storage"
else:
    DATA_DIR: Path = BASE_DIR / "data"
    STORAGE_DIR: Path = BASE_DIR / "storage"

USERS_FILE: Path = DATA_DIR / "users.csv"
MEMORIES_FILE: Path = DATA_DIR / "memories.csv"

# Database Configuration (SQLAlchemy 2.0 / SQLite / PostgreSQL)
DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR}/memovault.db")

# Security & Session Token Configuration
SECRET_KEY: str = os.getenv("SECRET_KEY", "memovault-secret-key-change-in-production-2026-xyz987")
MASTER_ENCRYPTION_KEY: str = os.getenv("MASTER_ENCRYPTION_KEY", "memovault-master-encryption-key-32bytes-min!")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # Short-lived access tokens
ACCESS_TOKEN_EXPIRE_HOURS: int = 8      # Fallback for backward compatibility
REFRESH_TOKEN_EXPIRE_DAYS: int = 30

# Password Hashing Strategy
# Default PBKDF2-HMAC-SHA256 with 600,000 iterations for production security
HASH_ALGORITHM: str = os.getenv("HASH_ALGORITHM", "PBKDF2")  # Options: "PBKDF2", "ARGON2", "SHA256"
PBKDF2_ITERATIONS: int = 600_000

# Rate limiting and Account lockout
MAX_FAILED_LOGIN_ATTEMPTS: int = 5
LOCKOUT_DURATION_MINUTES: int = 15

# Attachment storage configuration
STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")  # "local" or "s3"
MAX_FILE_SIZE_BYTES: int = 10 * 1024 * 1024       # 10 MB per file
MAX_MEMORY_ATTACHMENT_BYTES: int = 50 * 1024 * 1024  # 50 MB per memory
MAX_ATTACHMENTS_PER_MEMORY: int = 10

# AI Configuration
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
SEED_DEMO: bool = os.getenv("SEED_DEMO", "true").lower() in ("true", "1", "yes")

# CORS Allowed Origins
CORS_ORIGINS: list[str] = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
