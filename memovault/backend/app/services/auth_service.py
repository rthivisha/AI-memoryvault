"""
Authentication Service for AI MemoVault.
Handles registration, constant-time credential verification, and standard HS256 JWT generation.
Prevents account enumeration via identical invalid-credential error messages.
"""

import base64
import hashlib
import hmac
import json
import time
from typing import Optional

from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_HOURS
from app.exceptions import AuthenticationException, InvalidInputException
from app.models.user import User
from app.storage.file_storage import FileStorage
from app.utils.password_util import generate_salt, hash_password, verify_password
from app.utils.validation_util import validate_username, validate_password


def _base64url_encode(data: bytes) -> str:
    """Base64URL encoding without padding according to RFC 7515."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _base64url_decode(s: str) -> bytes:
    """Base64URL decoding with padding restored."""
    rem = len(s) % 4
    if rem > 0:
        s += "=" * (4 - rem)
    return base64.urlsafe_b64decode(s.encode("utf-8"))


def create_access_token(user_id: str, username: str) -> str:
    """
    Creates an RFC 7519 compliant HS256 JWT signed token valid for 8 hours.
    Uses Python standard library (hmac, hashlib, json, base64) for maximum portability.
    """
    now = int(time.time())
    exp = now + (ACCESS_TOKEN_EXPIRE_HOURS * 3600)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "username": username,
        "iat": now,
        "exp": exp,
    }

    header_b64 = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_b64 = _base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_access_token(token: str) -> dict:
    """
    Verifies and decodes an HS256 JWT token.
    Raises AuthenticationException on signature mismatch or expiration.
    """
    if not token or not isinstance(token, str):
        raise AuthenticationException("Please log in first.")

    parts = token.split(".")
    if len(parts) != 3:
        raise AuthenticationException("Please log in first.")

    header_b64, payload_b64, signature_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    expected_sig_b64 = _base64url_encode(expected_sig)

    if not hmac.compare_digest(signature_b64, expected_sig_b64):
        raise AuthenticationException("Please log in first.")

    try:
        payload_bytes = _base64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        raise AuthenticationException("Please log in first.")

    exp = payload.get("exp")
    if not exp or int(time.time()) > int(exp):
        raise AuthenticationException("Please log in first.")

    return payload


class AuthService:
    """
    Business service layer managing user registration, authentication, and session tokens.
    """

    def __init__(self, storage: FileStorage) -> None:
        self.storage: FileStorage = storage

    def register(self, username_input: str, password_input: str) -> User:
        """
        Registers a new user after verifying username validity and uniqueness.
        Passwords are salted with a 16-byte random salt and stored as SHA-256 hashes.
        """
        clean_username = validate_username(username_input)
        clean_password = validate_password(password_input)

        users = self.storage.load_users()
        for u in users:
            if u.username.lower() == clean_username.lower():
                raise InvalidInputException(f"Username '{clean_username}' is already taken.")

        user_id = self.storage.get_next_user_id()
        salt = generate_salt(16)
        pw_hash = hash_password(clean_password, salt)

        new_user = User(
            user_id=user_id,
            username=clean_username,
            password_hash_base64=pw_hash,
            salt_base64=salt,
        )
        self.storage.save_user(new_user)
        return new_user

    def authenticate(self, username_input: str, password_input: str) -> tuple[str, User]:
        """
        Authenticates user with constant-time verification.
        Returns (token, user).
        Error message is strictly identical for missing user and invalid password
        to protect against username enumeration attacks.
        """
        clean_username = (username_input or "").strip()
        clean_password = password_input or ""

        if not clean_username or not clean_password:
            raise AuthenticationException("Invalid username or password.")

        users = self.storage.load_users()
        matched_user: Optional[User] = None
        for u in users:
            if u.username.lower() == clean_username.lower():
                matched_user = u
                break

        if not matched_user:
            raise AuthenticationException("Invalid username or password.")

        is_valid = verify_password(clean_password, matched_user.password_hash_base64, matched_user.salt_base64)
        if not is_valid:
            raise AuthenticationException("Invalid username or password.")

        token = create_access_token(matched_user.user_id, matched_user.username)
        return token, matched_user

    def get_current_user_from_token(self, token_str: str) -> User:
        """
        Extracts authenticated User from Bearer token.
        Raises AuthenticationException if invalid or user no longer exists.
        """
        payload = decode_access_token(token_str)
        user_id = payload.get("sub")
        if not user_id:
            raise AuthenticationException("Please log in first.")

        users = self.storage.load_users()
        for u in users:
            if u.user_id == user_id:
                return u

        raise AuthenticationException("Please log in first.")
