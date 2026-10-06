"""
Configuration module for AI MemoVault backend.
Centralizes environment variables, file paths, security constants, and CORS settings.
"""

import os
from pathlib import Path

# Base directories
BASE_DIR: Path = Path(__file__).resolve().parent.parent
DATA_DIR: Path = BASE_DIR / "data"
USERS_FILE: Path = DATA_DIR / "users.csv"
MEMORIES_FILE: Path = DATA_DIR / "memories.csv"

# Security & Session Token Configuration
# Default development secret key; override via environment variable in production
SECRET_KEY: str = os.getenv("SECRET_KEY", "memovault-secret-key-change-in-production-2026-xyz987")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS: int = 8

# Password Hashing Strategy
# NOTE: SHA-256 with 16-byte random salt is fast by design and implemented using
# Python's standard library. For high-threat production environments, upgrade to PBKDF2
# or argon2id by toggling HASH_ALGORITHM below.
HASH_ALGORITHM: str = os.getenv("HASH_ALGORITHM", "SHA256")  # Options: "SHA256", "PBKDF2"
PBKDF2_ITERATIONS: int = 100_000

# Seeding configuration
SEED_DEMO: bool = os.getenv("SEED_DEMO", "true").lower() in ("true", "1", "yes")

# CORS Allowed Origins
CORS_ORIGINS: list[str] = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]
