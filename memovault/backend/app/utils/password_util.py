"""
Password hashing and verification utilities.
Implements salted SHA-256 with constant-time verification.
Provides documented hook for PBKDF2 production hardening.
"""

import base64
import hashlib
import hmac
import secrets
from app.config import HASH_ALGORITHM, PBKDF2_ITERATIONS


def generate_salt(num_bytes: int = 16) -> str:
    """
    Generates a cryptographically secure random salt encoded in Base64.
    Formula: Base64(secrets.token_bytes(16))
    """
    salt_bytes = secrets.token_bytes(num_bytes)
    return base64.b64encode(salt_bytes).decode("utf-8")


def hash_password(password: str, salt_base64: str) -> str:
    """
    Computes password hash using salted SHA-256 (or PBKDF2 if configured).
    Formula:
      digest = SHA-256(salt_string_utf8 + password_utf8)
      result = Base64(digest)
    Never stores plain-text passwords.
    """
    if HASH_ALGORITHM.upper() == "PBKDF2":
        salt_bytes = base64.b64decode(salt_base64.encode("utf-8"))
        derived = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt_bytes,
            PBKDF2_ITERATIONS,
        )
        return base64.b64encode(derived).decode("utf-8")

    # Default: Salted SHA-256
    # digest = SHA-256(salt_string_utf8 || password_utf8)
    data = salt_base64.encode("utf-8") + password.encode("utf-8")
    digest = hashlib.sha256(data).digest()
    return base64.b64encode(digest).decode("utf-8")


def verify_password(plain_password: str, stored_hash_base64: str, salt_base64: str) -> bool:
    """
    Verifies a supplied password against the stored hash and salt.
    Uses hmac.compare_digest for constant-time evaluation to eliminate timing attacks.
    """
    computed_hash = hash_password(plain_password, salt_base64)
    return hmac.compare_digest(computed_hash, stored_hash_base64)
