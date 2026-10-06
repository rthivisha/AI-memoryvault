"""
Password Hashing and Security Utility for AI MemoVault.
Implements PBKDF2-HMAC-SHA256 (600,000 iterations) and salted SHA-256 backward compatibility.
Transparently detects legacy hashes and upgrades them on successful login.
Rejects common weak passwords via built-in blocklist.
"""

import base64
import hashlib
import hmac
import secrets
from app.config import PBKDF2_ITERATIONS
from app.exceptions import InvalidInputException

COMMON_PASSWORDS: set[str] = {
    "123456", "12345678", "qwerty", "123456789", "111111",
}


def check_password_strength(password: str) -> None:
    """Enforces minimum length and rejects common blocklisted passwords."""
    if not password or len(password) < 6:
        raise InvalidInputException("Password must be at least 6 characters long.")
    if password.lower() in COMMON_PASSWORDS:
        raise InvalidInputException("This password is too common. Please choose a more secure password.")


def generate_salt(num_bytes: int = 16) -> str:
    """Generates a cryptographically secure random salt encoded in Base64."""
    salt_bytes = secrets.token_bytes(num_bytes)
    return base64.b64encode(salt_bytes).decode("utf-8")


def hash_password_pbkdf2(password: str, salt_base64: str, iterations: int = PBKDF2_ITERATIONS) -> str:
    """
    Computes PBKDF2-HMAC-SHA256 hash with 600,000 iterations.
    Prefixes with '$pbkdf2$' to distinguish from legacy SHA-256.
    """
    salt_bytes = base64.b64decode(salt_base64.encode("utf-8"))
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt_bytes,
        iterations,
    )
    b64_hash = base64.b64encode(derived).decode("utf-8")
    return f"$pbkdf2${iterations}${b64_hash}"


def hash_password_legacy(password: str, salt_base64: str) -> str:
    """Legacy SHA-256(salt || password)."""
    data = salt_base64.encode("utf-8") + password.encode("utf-8")
    digest = hashlib.sha256(data).digest()
    return base64.b64encode(digest).decode("utf-8")


def hash_password(password: str, salt_base64: str) -> str:
    """Default: Creates PBKDF2-HMAC-SHA256 hash."""
    return hash_password_pbkdf2(password, salt_base64, PBKDF2_ITERATIONS)


def verify_password(plain_password: str, stored_hash: str, salt_base64: str) -> tuple[bool, bool]:
    """
    Verifies plain password against stored hash using constant-time comparison.
    Returns: (is_valid, needs_upgrade)
    needs_upgrade is True if stored_hash is an old salted SHA-256 hash.
    """
    if stored_hash.startswith("$pbkdf2$"):
        parts = stored_hash.split("$")
        if len(parts) >= 4:
            iterations = int(parts[2])
            computed = hash_password_pbkdf2(plain_password, salt_base64, iterations)
            is_valid = hmac.compare_digest(computed, stored_hash)
            needs_upgrade = iterations < PBKDF2_ITERATIONS
            return is_valid, needs_upgrade

    # Legacy Salted SHA-256
    computed_legacy = hash_password_legacy(plain_password, salt_base64)
    is_valid = hmac.compare_digest(computed_legacy, stored_hash)
    # If legacy is valid, flag for upgrade to PBKDF2
    return is_valid, True
