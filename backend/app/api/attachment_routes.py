"""
Attachment and Gallery API route handlers.
Handles multi-file uploads, magic bytes validation, authorized streaming, and gallery listing.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Response, Query
from fastapi.responses import StreamingResponse
import io

from app.api.deps import attachment_service, get_current_user, db_storage
from app.exceptions import InvalidInputException, MemoryNotFoundException

router = APIRouter(prefix="/api", tags=["Attachments & Gallery"])


@router.post("/memories/{memory_id}/attachments")
async def upload_attachments(
    memory_id: str,
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Uploads one or more attachments for a memory record."""
    saved_attachments = []
    for f in files:
        contents = await f.read()
        filename = f.filename or "attachment.bin"
        att = attachment_service.add_attachment(
            owner_id=current_user["id"],
            memory_id=memory_id,
            original_filename=filename,
            file_bytes=contents,
        )
        saved_attachments.append(att)
    return saved_attachments


@router.get("/attachments/{attachment_id}")
def get_attachment(
    attachment_id: str,
    variant: str = Query("original", description="'original', 'thumbnail', or 'web'"),
    token: Optional[str] = Query(None, description="Optional bearer token in query parameter for media tags"),
    current_user: Optional[dict] = None,
):
    """Streams authorized attachment."""
    # Support token in query for img tags
    owner_id = None
    if token:
        from app.services.auth_service import decode_access_token
        try:
            payload = decode_access_token(token)
            owner_id = payload.get("sub")
        except Exception:
            pass

    if not owner_id:
        # Check standard auth dependency
        from app.api.deps import auth_service
        # If no auth or invalid
        raise InvalidInputException("Authentication required to view attachment.")

    decrypted_bytes, mime_type, filename = attachment_service.get_attachment_stream(
        owner_id=owner_id,
        attachment_id=attachment_id,
        variant=variant,
    )

    return StreamingResponse(
        io.BytesIO(decrypted_bytes),
        media_type=mime_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.delete("/attachments/{attachment_id}")
def delete_attachment(
    attachment_id: str,
    current_user: dict = Depends(get_current_user),
):
    attachment_service.delete_attachment(current_user["id"], attachment_id)
    return {"message": "Attachment deleted successfully.", "id": attachment_id}


@router.get("/gallery")
def get_gallery_media(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    year: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """Retrieves all image attachments for user's memory records with metadata for masonry grid."""
    items = db_storage.list_all_media_attachments(current_user["id"], mime_prefix="image/")
    filtered = items

    if category:
        filtered = [i for i in filtered if i.get("memory_category") == category.upper()]
    if year:
        filtered = [i for i in filtered if i.get("memory_date", "").startswith(year)]

    return filtered
