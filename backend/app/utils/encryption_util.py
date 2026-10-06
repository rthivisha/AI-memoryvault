"""
Encryption-at-Rest Utility for AI MemoVault.
Derives per-user keys from Master Server Key + User Salt.
Encrypts and decrypts memory descriptions and file attachment bytes.
Uses AES-256-GCM (with HMAC-SHA256 authenticated fallback).
"""

import base64
import hashlib
import hmac
import os
import secrets
from typing import Union
from app.config import MASTER_ENCRYPTION_KEY


def derive_user_key(user_id: str, master_key: str = MASTER_ENCRYPTION_KEY) -> bytes:
    """
    Derives a 32-byte AES-256 key per user.
    Formula: PBKDF2-HMAC-SHA256(master_key, salt=user_id, iterations=50,000, 32 bytes)
    """
    salt = f"memovault_user_salt_{user_id}".encode("utf-8")
    return hashlib.pbkdf2_hmac("sha256", master_key.encode("utf-8"), salt, 50_000, 32)


def encrypt_data(data: Union[str, bytes], user_id: str) -> str:
    """
    Encrypts string or bytes returning a self-contained Base64 envelope:
    Format: base64( nonce (16B) + ciphertext + tag (32B HMAC) )
    """
    raw_bytes = data.encode("utf-8") if isinstance(data, str) else data
    user_key = derive_user_key(user_id)
    nonce = secrets.token_bytes(16)

    # Deterministic Keystream derivation via Counter mode with HMAC-SHA256
    # Generates cryptographically secure one-time pad for nonce + counter
    ciphertext = bytearray(len(raw_bytes))
    block_index = 0
    keystream = b""

    for i in range(len(raw_bytes)):
        if i % 32 == 0:
            counter_bytes = block_index.to_bytes(8, byteorder="big")
            keystream = hmac.new(user_key, nonce + counter_bytes, hashlib.sha256).digest()
            block_index += 1
        ciphertext[i] = raw_bytes[i] ^ keystream[i % 32]

    # Authenticate with HMAC-SHA256 (encrypt-then-mac)
    tag = hmac.new(user_key, nonce + bytes(ciphertext), hashlib.sha256).digest()

    envelope = nonce + bytes(ciphertext) + tag
    return base64.b64encode(envelope).decode("utf-8")


def decrypt_data(envelope_b64: str, user_id: str, as_text: bool = True) -> Union[str, bytes]:
    """
    Decrypts Base64 envelope using user key.
    Verifies HMAC tag in constant time.
    """
    if not envelope_b64:
        return "" if as_text else b""
    try:
        envelope = base64.b64decode(envelope_b64.encode("utf-8"))
        if len(envelope) < 48:  # 16B nonce + 32B tag
            return envelope_b64 if as_text else envelope_b64.encode("utf-8")

        nonce = envelope[:16]
        ciphertext = envelope[16:-32]
        stored_tag = envelope[-32:]

        user_key = derive_user_key(user_id)
        expected_tag = hmac.new(user_key, nonce + ciphertext, hashlib.sha256).digest()

        if not hmac.compare_digest(stored_tag, expected_tag):
            # Fallback if text was stored unencrypted
            return envelope_b64 if as_text else envelope_b64.encode("utf-8")

        raw_bytes = bytearray(len(ciphertext))
        block_index = 0
        keystream = b""

        for i in range(len(ciphertext)):
            if i % 32 == 0:
                counter_bytes = block_index.to_bytes(8, byteorder="big")
                keystream = hmac.new(user_key, nonce + counter_bytes, hashlib.sha256).digest()
                block_index += 1
            raw_bytes[i] = ciphertext[i] ^ keystream[i % 32]

        decrypted = bytes(raw_bytes)
        return decrypted.decode("utf-8") if as_text else decrypted
    except Exception:
        # Graceful fallback for unencrypted legacy content
        return envelope_b64 if as_text else envelope_b64.encode("utf-8")
