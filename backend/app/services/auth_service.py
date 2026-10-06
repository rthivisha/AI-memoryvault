"""
Authentication and Session Security Service for AI MemoVault.
Handles PBKDF2 hashing, transparent hash upgrade, account lockout,
short-lived JWT access tokens, rotating refresh tokens, and RFC 6238 TOTP 2FA.
"""

import base64
import hashlib
import hmac
import json
import secrets
import struct
import time
from datetime import datetime, timedelta
from typing import Optional, Tuple, Any

from app.config import (
    SECRET_KEY,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
    MAX_FAILED_LOGIN_ATTEMPTS,
    LOCKOUT_DURATION_MINUTES,
)
from app.exceptions import AuthenticationException, InvalidInputException
from app.models.user import User
from app.storage.db_storage import DBStorage
from app.utils.password_util import (
    generate_salt,
    hash_password,
    verify_password,
    check_password_strength,
)
from app.utils.validation_util import validate_username


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _base64url_decode(s: str) -> bytes:
    rem = len(s) % 4
    if rem > 0:
        s += "=" * (4 - rem)
    return base64.urlsafe_b64decode(s.encode("utf-8"))


def create_access_token(user_id: str, username: str) -> str:
    """Creates a short-lived 15-minute access JWT."""
    now = int(time.time())
    exp = now + (ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": user_id, "username": username, "iat": now, "exp": exp}

    header_b64 = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    sig = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_base64url_encode(sig)}"


def decode_access_token(token: str) -> dict:
    if not token or not isinstance(token, str):
        raise AuthenticationException("Please log in first.")
    parts = token.split(".")
    if len(parts) != 3:
        raise AuthenticationException("Please log in first.")

    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected_sig = _base64url_encode(
        hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    )
    if not hmac.compare_digest(sig_b64, expected_sig):
        raise AuthenticationException("Please log in first.")

    try:
        payload = json.loads(_base64url_decode(payload_b64).decode("utf-8"))
    except Exception:
        raise AuthenticationException("Please log in first.")

    if not payload.get("exp") or int(time.time()) > int(payload["exp"]):
        raise AuthenticationException("Session expired. Please log in again.")
    return payload


# RFC 6238 TOTP in pure Python
def generate_totp_code(secret_b32: str, intervals_no: Optional[int] = None) -> str:
    """Generates standard 6-digit TOTP token using HMAC-SHA1."""
    if intervals_no is None:
        intervals_no = int(time.time()) // 30
    key = base64.b32decode(secret_b32.upper())
    msg = struct.pack(">Q", intervals_no)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[19] & 0xF
    code = (struct.unpack(">I", h[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000
    return f"{code:06d}"


def verify_totp_code(secret_b32: str, code: str) -> bool:
    """Verifies TOTP token allowing +/- 1 time interval clock drift."""
    if not code or len(code) != 6 or not code.isdigit():
        return False
    current_interval = int(time.time()) // 30
    for drift in (-1, 0, 1):
        if hmac.compare_digest(generate_totp_code(secret_b32, current_interval + drift), code):
            return True
    return False


class AuthService:
    """
    Business service layer managing user registration, authentication,
    transparent hash upgrade, account lockout, and tokens.
    """

    def __init__(self, db: Optional[Any] = None, storage: Optional[Any] = None) -> None:
        target = db if db is not None else storage
        self.db: Any = target
        self.storage: Any = target
        self.is_file_storage = hasattr(target, "load_users")

    def register(self, username_input: str, password_input: str, display_name: Optional[str] = None) -> Any:
        clean_username = validate_username(username_input)
        if len(password_input) < 6:
            raise InvalidInputException("Password must be at least 6 characters long.")
        check_password_strength(password_input)

        if self.is_file_storage:
            users = self.db.load_users()
            for u in users:
                if u.username.lower() == clean_username.lower():
                    raise InvalidInputException(f"Username '{clean_username}' is already taken.")
            salt = generate_salt(16)
            pw_hash = hash_password(password_input, salt)
            next_uid = self.db.get_next_user_id()
            user = User(
                user_id=next_uid,
                username=clean_username,
                password_hash_base64=pw_hash,
                salt_base64=salt,
                display_name=display_name or clean_username,
            )
            self.db.save_user(user)
            return user

        existing = self.db.get_user_by_username(clean_username)
        if existing:
            raise InvalidInputException(f"Username '{clean_username}' is already taken.")

        salt = generate_salt(16)
        pw_hash = hash_password(password_input, salt)
        user = self.db.create_user(
            username=clean_username,
            password_hash=pw_hash,
            salt=salt,
            display_name=display_name or clean_username,
        )

        self.db.log_activity(user["id"], "register", "user", user["id"])
        return user

    def authenticate(
        self,
        username_input: str,
        password_input: str,
        totp_code: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Any:
        clean_username = (username_input or "").strip()
        clean_password = password_input or ""

        if not clean_username or not clean_password:
            raise AuthenticationException("Invalid username or password.")

        if self.is_file_storage:
            users = self.db.load_users()
            user = next((u for u in users if u.username.lower() == clean_username.lower()), None)
            if not user:
                raise AuthenticationException("Invalid username or password.")
            is_valid, _ = verify_password(clean_password, user.password_hash_base64, user.salt_base64)
            if not is_valid:
                raise AuthenticationException("Invalid username or password.")
            token = create_access_token(user.user_id, user.username)
            return token, user

        user = self.db.get_user_by_username(clean_username)
        if not user:
            raise AuthenticationException("Invalid username or password.")

        # Check account lockout
        lockout = user.get("lockout_until")
        if lockout and lockout > datetime.utcnow().isoformat():
            raise AuthenticationException("Account temporarily locked due to repeated failures. Please try again later.")

        is_valid, needs_upgrade = verify_password(clean_password, user["password_hash"], user["salt"])
        if not is_valid:
            attempts = self.db.record_failed_login(clean_username)
            if attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
                raise AuthenticationException("Account temporarily locked due to repeated failures. Please try again in 15 minutes.")
            raise AuthenticationException("Invalid username or password.")

        # Check 2FA if enabled
        if user.get("two_factor_enabled"):
            secret = user.get("two_factor_secret")
            if not totp_code or not verify_totp_code(secret, totp_code):
                # Check backup codes
                backup_codes = json.loads(user.get("two_factor_backup_codes") or "[]")
                if totp_code not in backup_codes:
                    return {
                        "two_factor_required": True,
                        "userId": user["id"],
                        "message": "Two-factor authentication code required.",
                    }
                # Consume backup code
                backup_codes.remove(totp_code)
                with self.db.get_db_cursor() as cur:
                    cur.execute("UPDATE users SET two_factor_backup_codes = ? WHERE id = ?", (json.dumps(backup_codes), user["id"]))

        # Successful login: reset failed login attempts
        self.db.reset_failed_logins(user["id"])

        # Transparently upgrade legacy hash to PBKDF2
        if needs_upgrade:
            new_salt = generate_salt(16)
            new_hash = hash_password(clean_password, new_salt)
            self.db.update_user_password(user["id"], new_hash, new_salt)

        # Generate tokens
        access_token = create_access_token(user["id"], user["username"])
        refresh_token = secrets.token_urlsafe(48)
        refresh_hash = hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()
        exp_iso = (datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()

        # Store refresh token in DB
        with self.db.get_db_cursor() as cur:
            cur.execute("""
                INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (f"RT{secrets.token_hex(8)}", user["id"], refresh_hash, exp_iso, datetime.utcnow().isoformat()))

        self.db.log_activity(user["id"], "login", "user", user["id"], ip_address, user_agent)

        return {
            "token": access_token,
            "refreshToken": refresh_token,
            "user": {
                "userId": user["id"],
                "username": user["username"],
                "displayName": user.get("display_name") or user["username"],
                "avatarUrl": user.get("avatar_url"),
                "twoFactorEnabled": bool(user.get("two_factor_enabled")),
            },
        }

    def rotate_refresh_token(self, refresh_token_str: str) -> dict:
        """Rotates refresh token and issues a new access token."""
        h = hashlib.sha256(refresh_token_str.encode("utf-8")).hexdigest()
        now_iso = datetime.utcnow().isoformat()
        with self.db.get_db_cursor() as cur:
            cur.execute("SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0 AND expires_at > ?", (h, now_iso))
            row = cur.fetchone()
            if not row:
                raise AuthenticationException("Invalid or expired session. Please log in again.")

            token_data = dict(row)
            user = self.db.get_user_by_id(token_data["user_id"])
            if not user:
                raise AuthenticationException("User account not found.")

            # Revoke current token
            cur.execute("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?", (token_data["id"],))

            # Create new tokens
            new_access = create_access_token(user["id"], user["username"])
            new_refresh = secrets.token_urlsafe(48)
            new_h = hashlib.sha256(new_refresh.encode("utf-8")).hexdigest()
            new_exp = (datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()

            cur.execute("""
                INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (f"RT{secrets.token_hex(8)}", user["id"], new_h, new_exp, now_iso))

            return {
                "token": new_access,
                "refreshToken": new_refresh,
                "user": {
                    "userId": user["id"],
                    "username": user["username"],
                    "displayName": user.get("display_name") or user["username"],
                },
            }

    def get_current_user_from_token(self, token_str: str) -> Any:
        payload = decode_access_token(token_str)
        user_id = payload.get("sub")
        if not user_id:
            raise AuthenticationException("Please log in first.")
        if self.is_file_storage:
            users = self.db.load_users()
            user = next((u for u in users if u.user_id == user_id), None)
            if not user:
                raise AuthenticationException("Please log in first.")
            return user
        user = self.db.get_user_by_id(user_id)
        if not user:
            raise AuthenticationException("Please log in first.")
        return user
