"""
Feature routes for Tags, Collections, Reminders, Activity Log, Share Links, and Backup/Export.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel

from app.api.deps import db_storage, get_current_user, memory_manager
from app.exceptions import InvalidInputException, MemoryNotFoundException

router = APIRouter(prefix="/api", tags=["Product Features"])


# DTOs
class TagCreateDTO(BaseModel):
    name: str
    color: Optional[str] = "#06b6d4"


class CollectionCreateDTO(BaseModel):
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None


class ReminderCreateDTO(BaseModel):
    memory_id: str
    due_at: str
    repeat_interval: Optional[str] = "none"


class ShareLinkCreateDTO(BaseModel):
    entity_type: str  # "memory" or "collection"
    entity_id: str
    password: Optional[str] = None
    expires_at: Optional[str] = None


# ==========================
# TAGS
# ==========================

@router.get("/tags")
def list_tags(current_user: dict = Depends(get_current_user)):
    return db_storage.list_tags_with_counts(current_user["id"])


@router.post("/tags")
def create_tag(req: TagCreateDTO, current_user: dict = Depends(get_current_user)):
    return db_storage.get_or_create_tag(current_user["id"], req.name, req.color or "#06b6d4")


@router.put("/tags/{tag_id}")
def rename_tag(tag_id: str, req: TagCreateDTO, current_user: dict = Depends(get_current_user)):
    db_storage.rename_tag(current_user["id"], tag_id, req.name)
    return {"message": "Tag updated."}


@router.delete("/tags/{tag_id}")
def delete_tag(tag_id: str, current_user: dict = Depends(get_current_user)):
    db_storage.delete_tag(current_user["id"], tag_id)
    return {"message": "Tag deleted."}


# ==========================
# COLLECTIONS
# ==========================

@router.get("/collections")
def list_collections(current_user: dict = Depends(get_current_user)):
    return db_storage.list_collections(current_user["id"])


@router.post("/collections")
def create_collection(req: CollectionCreateDTO, current_user: dict = Depends(get_current_user)):
    return db_storage.create_collection(
        owner_id=current_user["id"],
        name=req.name,
        description=req.description,
        cover_image_url=req.cover_image_url,
    )


@router.get("/collections/{collection_id}")
def get_collection(collection_id: str, current_user: dict = Depends(get_current_user)):
    c = db_storage.get_collection_by_id(current_user["id"], collection_id)
    if not c:
        raise MemoryNotFoundException("Collection not found.")
    mems = memory_manager.get_memories_for_user(current_user["id"], collection_id=collection_id)
    c["memories"] = mems
    return c


@router.delete("/collections/{collection_id}")
def delete_collection(collection_id: str, current_user: dict = Depends(get_current_user)):
    db_storage.delete_collection(current_user["id"], collection_id)
    return {"message": "Collection deleted."}


# ==========================
# REMINDERS
# ==========================

@router.get("/reminders")
def list_reminders(
    include_completed: bool = Query(False),
    current_user: dict = Depends(get_current_user),
):
    return db_storage.list_reminders(current_user["id"], include_completed=include_completed)


@router.post("/reminders")
def create_reminder(req: ReminderCreateDTO, current_user: dict = Depends(get_current_user)):
    return db_storage.create_reminder(
        owner_id=current_user["id"],
        memory_id=req.memory_id,
        due_at=req.due_at,
        repeat_interval=req.repeat_interval or "none",
    )


@router.put("/reminders/{reminder_id}/complete")
def complete_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    db_storage.mark_reminder_completed(current_user["id"], reminder_id)
    return {"message": "Reminder marked completed."}


@router.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    db_storage.delete_reminder(current_user["id"], reminder_id)
    return {"message": "Reminder deleted."}


# ==========================
# ACTIVITY AUDIT LOG
# ==========================

@router.get("/activity")
def get_activity_log(limit: int = 50, current_user: dict = Depends(get_current_user)):
    return db_storage.get_recent_activity(current_user["id"], limit=limit)


# ==========================
# SHARE LINKS (PUBLIC ACCESSIBLE)
# ==========================

@router.post("/share")
def create_share_link(req: ShareLinkCreateDTO, current_user: dict = Depends(get_current_user)):
    pw_hash = None
    if req.password:
        import hashlib
        pw_hash = hashlib.sha256(req.password.encode("utf-8")).hexdigest()

    link = db_storage.create_share_link(
        owner_id=current_user["id"],
        entity_type=req.entity_type,
        entity_id=req.entity_id,
        password_hash=pw_hash,
        expires_at=req.expires_at,
    )
    return link


@router.get("/share/{token}")
def access_shared_item(
    token: str,
    password: Optional[str] = Query(None),
):
    """Public read-only endpoint that does not expose owner account credentials."""
    link = db_storage.get_share_link_by_token(token)
    if not link:
        raise MemoryNotFoundException("Shared link does not exist, has expired, or was revoked.")

    if link.get("password_hash"):
        import hashlib
        if not password or hashlib.sha256(password.encode("utf-8")).hexdigest() != link["password_hash"]:
            return {"requires_password": True, "token": token}

    db_storage.increment_share_views(token)

    if link["entity_type"] == "memory":
        mem = memory_manager.get_memory_by_id(link["owner_id"], link["entity_id"])
        return {
            "entity_type": "memory",
            "memory": mem,
            "created_at": link["created_at"],
            "view_count": link["view_count"] + 1,
        }
    else:
        coll = db_storage.get_collection_by_id(link["owner_id"], link["entity_id"])
        mems = memory_manager.get_memories_for_user(link["owner_id"], collection_id=link["entity_id"])
        return {
            "entity_type": "collection",
            "collection": coll,
            "memories": mems,
            "view_count": link["view_count"] + 1,
        }


# ==========================
# EXPORT & IMPORT
# ==========================

@router.get("/export/json")
def export_user_data_json(current_user: dict = Depends(get_current_user)):
    """Full user data backup in JSON format."""
    uid = current_user["id"]
    memories = memory_manager.get_memories_for_user(uid, limit=5000)
    tags = db_storage.list_tags_with_counts(uid)
    collections = db_storage.list_collections(uid)
    reminders = db_storage.list_reminders(uid, include_completed=True)
    activity = db_storage.get_recent_activity(uid, limit=100)

    db_storage.log_activity(uid, "export", "backup")

    return {
        "export_version": "2.0",
        "user": {
            "userId": uid,
            "username": current_user["username"],
            "displayName": current_user.get("display_name"),
        },
        "memories": memories,
        "tags": tags,
        "collections": collections,
        "reminders": reminders,
        "activity": activity,
    }


class ImportDTO(BaseModel):
    memories: List[dict]


@router.post("/import/json")
def import_user_data_json(req: ImportDTO, current_user: dict = Depends(get_current_user)):
    """Imports memories from a JSON backup."""
    imported_count = 0
    uid = current_user["id"]
    for m in req.memories:
        try:
            memory_manager.create_memory(
                owner_id=uid,
                title=m.get("title", "Imported Memory"),
                date_str=m.get("memory_date") or m.get("date", "2025-01-01"),
                description=m.get("description", "Imported record description."),
                category=m.get("category", "PERSONAL"),
                mood=m.get("mood", "neutral"),
                location_name=m.get("location_name"),
                tags=[t["name"] if isinstance(t, dict) else t for t in m.get("tags", [])],
            )
            imported_count += 1
        except Exception:
            pass

    db_storage.log_activity(uid, "import", "backup", str(imported_count))
    return {"message": f"Successfully imported {imported_count} memories.", "count": imported_count}
