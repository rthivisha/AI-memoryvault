"""
Attachment Service for AI MemoVault.
Handles MIME magic byte verification, executable rejection, EXIF GPS stripping,
auto-rotation, 400px thumbnailing, 1600px web sizing, and encrypted storage.
"""

import io
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

from app.config import (
    MAX_FILE_SIZE_BYTES,
    MAX_MEMORY_ATTACHMENT_BYTES,
    MAX_ATTACHMENTS_PER_MEMORY,
)
from app.exceptions import InvalidInputException, MemoryNotFoundException
from app.storage.db_storage import DBStorage
from app.services.storage_backend import get_storage_backend, StorageBackend
from app.utils.encryption_util import encrypt_data, decrypt_data

# Allowed MIME types and Magic Bytes
MAGIC_SIGNATURES = [
    # JPEG: \xFF\xD8\xFF
    (b"\xFF\xD8\xFF", "image/jpeg"),
    # PNG: \x89PNG\r\n\x1a\n
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    # WebP: RIFF....WEBP
    (b"RIFF", "image/webp"),
    # PDF: %PDF-
    (b"%PDF-", "application/pdf"),
    # MP3: ID3 or \xFF\xFB / \xFF\xF3 / \xFF\xF2
    (b"ID3", "audio/mpeg"),
    (b"\xFF\xFB", "audio/mpeg"),
    (b"\xFF\xF3", "audio/mpeg"),
    # WAV: RIFF....WAVE
    (b"RIFF", "audio/wav"),
]

# Explicit executable/script blacklists
EXECUTABLE_MAGIC = [
    b"MZ",           # Windows PE executable / DLL
    b"\x7FELF",      # Linux ELF binary
    b"\xCA\xFE\xBA\xBE",  # Java class / Mach-O fat binary
    b"#!",           # Unix shell script
    b"<?php",        # PHP script
    b"<script",      # HTML/JS payload
]


def detect_mime_type(data: bytes, original_name: str) -> str:
    """
    Validates MIME type by checking magic bytes at start of file.
    Rejects dangerous executables and scripts.
    """
    if not data:
        raise InvalidInputException("File is empty.")

    # Check executable signatures
    for sig in EXECUTABLE_MAGIC:
        if data.startswith(sig):
            raise InvalidInputException("Executable and script files are strictly prohibited.")

    lower_name = original_name.lower()

    # Check magic signatures
    for sig, mime in MAGIC_SIGNATURES:
        if data.startswith(sig):
            if sig == b"RIFF":
                # Disambiguate WebP vs WAV
                if len(data) >= 12:
                    if data[8:12] == b"WEBP":
                        return "image/webp"
                    if data[8:12] == b"WAVE":
                        return "audio/wav"
            else:
                return mime

    # Extension-based fallback for audio containers (m4a/aac)
    if lower_name.endswith(".m4a") or lower_name.endswith(".aac"):
        if len(data) >= 8 and (b"ftyp" in data[:12] or data[:2] in (b"\xff\xf1", b"\xff\xf9")):
            return "audio/mp4"

    if lower_name.endswith(".mp3"):
        return "audio/mpeg"

    raise InvalidInputException(
        "Unsupported file format. Allowed: Images (JPG, PNG, WebP), Documents (PDF), Audio (MP3, WAV, M4A)."
    )


def process_image(data: bytes) -> Tuple[bytes, Optional[bytes], Optional[bytes], Optional[str]]:
    """
    Uses Pillow to:
    1. Strip EXIF GPS for privacy
    2. Auto-rotate based on EXIF orientation
    3. Generate 400px thumbnail and 1600px web preview
    4. Extract EXIF capture date if present
    Returns: (cleaned_original, thumbnail_bytes, web_bytes, exif_date)
    """
    try:
        from PIL import Image, ImageOps, ExifTags

        img = Image.open(io.BytesIO(data))
        exif_date: Optional[str] = None

        # Extract date from EXIF if available
        try:
            exif = img.getexif()
            if exif:
                for tag_id, value in exif.items():
                    tag = ExifTags.TAGS.get(tag_id, tag_id)
                    if tag in ("DateTimeOriginal", "DateTime"):
                        # Convert "YYYY:MM:DD HH:MM:SS" -> "YYYY-MM-DD"
                        parts = str(value).split(" ")[0].replace(":", "-")
                        if len(parts) == 10:
                            exif_date = parts
                        break
        except Exception:
            pass

        # Auto-rotate according to EXIF
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # Convert RGBA/P to RGB for JPEG/WebP compatibility
        if img.mode in ("RGBA", "P"):
            rgb_img = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "RGBA":
                rgb_img.paste(img, mask=img.split()[3])
            else:
                rgb_img.paste(img)
            img = rgb_img

        # 1. Cleaned original (EXIF stripped)
        orig_buf = io.BytesIO()
        img.save(orig_buf, format="JPEG", quality=90)
        clean_original = orig_buf.getvalue()

        # 2. Web version (max 1600px)
        web_img = img.copy()
        web_img.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        web_buf = io.BytesIO()
        web_img.save(web_buf, format="JPEG", quality=85)
        web_bytes = web_buf.getvalue()

        # 3. Thumbnail (max 400px)
        thumb_img = img.copy()
        thumb_img.thumbnail((400, 400), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        thumb_img.save(thumb_buf, format="JPEG", quality=80)
        thumb_bytes = thumb_buf.getvalue()

        return clean_original, thumb_bytes, web_bytes, exif_date
    except Exception:
        # Fallback if Pillow is not available or non-image
        return data, None, None, None


class AttachmentService:
    """Manages file attachments validation, resizing, encrypted storage, and authorized retrieval."""

    def __init__(self, db: DBStorage, backend: Optional[StorageBackend] = None) -> None:
        self.db: DBStorage = db
        self.backend: StorageBackend = backend or get_storage_backend()

    def add_attachment(
        self,
        owner_id: str,
        memory_id: str,
        original_filename: str,
        file_bytes: bytes,
    ) -> dict:
        """
        Validates, processes, encrypts, and stores a new file attachment.
        """
        # Verify memory ownership
        memory = self.db.get_memory_by_id(owner_id, memory_id)
        if not memory:
            raise MemoryNotFoundException(f"No memory record with ID '{memory_id}' exists for the current user.")

        # Check attachment count limit
        existing = self.db.list_attachments_for_memory(owner_id, memory_id)
        if len(existing) >= MAX_ATTACHMENTS_PER_MEMORY:
            raise InvalidInputException(f"A memory can have at most {MAX_ATTACHMENTS_PER_MEMORY} attachments.")

        # Check file size limit (10MB)
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise InvalidInputException(f"File '{original_filename}' exceeds 10MB maximum limit.")

        # Check total memory attachment bytes (50MB)
        total_existing_bytes = sum(a["file_size"] for a in existing)
        if total_existing_bytes + len(file_bytes) > MAX_MEMORY_ATTACHMENT_BYTES:
            raise InvalidInputException("Total memory attachment storage exceeds 50MB limit.")

        # Magic byte validation
        mime_type = detect_mime_type(file_bytes, original_filename)

        # Process images (thumbnail, web version, exif)
        exif_date: Optional[str] = None
        thumb_bytes: Optional[bytes] = None
        web_bytes: Optional[bytes] = None

        if mime_type.startswith("image/"):
            file_bytes, thumb_bytes, web_bytes, exif_date = process_image(file_bytes)

        # Generate unique storage filenames (UUID)
        ext = os.path.splitext(original_filename)[1].lower() or ".bin"
        stored_base = uuid.uuid4().hex
        stored_filename = f"{stored_base}{ext}"
        thumb_filename = f"{stored_base}_thumb.jpg" if thumb_bytes else None
        web_filename = f"{stored_base}_web.jpg" if web_bytes else None

        # Encrypt files at rest
        enc_original = encrypt_data(file_bytes, owner_id)
        self.backend.save(owner_id, "originals", stored_filename, enc_original.encode("utf-8"))

        if thumb_bytes and thumb_filename:
            enc_thumb = encrypt_data(thumb_bytes, owner_id)
            self.backend.save(owner_id, "thumbnails", thumb_filename, enc_thumb.encode("utf-8"))

        if web_bytes and web_filename:
            enc_web = encrypt_data(web_bytes, owner_id)
            self.backend.save(owner_id, "web", web_filename, enc_web.encode("utf-8"))

        # Save metadata to DB
        attachment = self.db.create_attachment(
            memory_id=memory_id,
            owner_id=owner_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            mime_type=mime_type,
            file_size=len(file_bytes),
            thumbnail_filename=thumb_filename,
            web_filename=web_filename,
            exif_date=exif_date,
        )

        # Log activity
        self.db.log_activity(
            user_id=owner_id,
            action="attach",
            entity_type="attachment",
            entity_id=attachment["id"],
        )

        return attachment

    def get_attachment_stream(
        self,
        owner_id: str,
        attachment_id: str,
        variant: str = "original",  # "original", "thumbnail", "web"
    ) -> Tuple[bytes, str, str]:
        """
        Retrieves, decrypts, and streams attachment bytes.
        Returns: (decrypted_bytes, mime_type, filename)
        """
        attachment = self.db.get_attachment_by_id(owner_id, attachment_id)
        if not attachment:
            raise MemoryNotFoundException("Attachment not found.")

        subfolder = "originals"
        target_file = attachment["stored_filename"]
        mime = attachment["mime_type"]

        if variant == "thumbnail" and attachment.get("thumbnail_filename"):
            subfolder = "thumbnails"
            target_file = attachment["thumbnail_filename"]
            mime = "image/jpeg"
        elif variant == "web" and attachment.get("web_filename"):
            subfolder = "web"
            target_file = attachment["web_filename"]
            mime = "image/jpeg"

        encrypted_payload = self.backend.get(owner_id, subfolder, target_file)
        if not encrypted_payload:
            raise MemoryNotFoundException("File blob missing from storage.")

        decrypted = decrypt_data(encrypted_payload.decode("utf-8"), owner_id, as_text=False)
        return decrypted, mime, attachment["original_filename"]

    def delete_attachment(self, owner_id: str, attachment_id: str) -> bool:
        attachment = self.db.delete_attachment(owner_id, attachment_id)
        if not attachment:
            raise MemoryNotFoundException("Attachment not found.")

        # Purge files from disk
        self.backend.delete(owner_id, "originals", attachment["stored_filename"])
        if attachment.get("thumbnail_filename"):
            self.backend.delete(owner_id, "thumbnails", attachment["thumbnail_filename"])
        if attachment.get("web_filename"):
            self.backend.delete(owner_id, "web", attachment["web_filename"])

        self.db.log_activity(
            user_id=owner_id,
            action="delete",
            entity_type="attachment",
            entity_id=attachment_id,
        )
        return True
