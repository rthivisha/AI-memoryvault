"""
Memory management and search API route handlers.
Enforces per-user data isolation, soft-deletes, bulk operations, and advanced BM25 lexical search.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.api.deps import (
    get_current_user,
    memory_manager,
    search_service,
    db_storage,
)
from app.exceptions import InvalidInputException

router = APIRouter(prefix="/api", tags=["Memories & Search"])


class MemoryCreateDTO(BaseModel):
    title: str
    date: str
    description: str
    category: Optional[str] = None
    mood: Optional[str] = "neutral"
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    people: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    collection_id: Optional[str] = None
    is_favorite: Optional[bool] = False
    is_pinned: Optional[bool] = False


class MemoryUpdateDTO(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    mood: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    people: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    collection_id: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None


class BulkActionDTO(BaseModel):
    memory_ids: List[str]
    action: str  # "delete", "archive", "tag", "move"
    tag_name: Optional[str] = None
    collection_id: Optional[str] = None


@router.post("/memories", status_code=status.HTTP_201_CREATED)
def create_memory(
    req: MemoryCreateDTO,
    current_user: dict = Depends(get_current_user),
):
    """Creates a new memory with rich metadata, tag sync, and description encryption."""
    created = memory_manager.create_memory(
        owner_id=current_user["id"],
        title=req.title,
        date_str=req.date,
        description=req.description,
        category=req.category,
        mood=req.mood or "neutral",
        location_name=req.location_name,
        latitude=req.latitude,
        longitude=req.longitude,
        people=req.people,
        tags=req.tags,
        collection_id=req.collection_id,
        is_favorite=bool(req.is_favorite),
        is_pinned=bool(req.is_pinned),
    )
    # Map to camelCase for client compatibility
    return {
        "memoryId": created["id"],
        "ownerId": created["owner_id"],
        "title": created["title"],
        "category": created["category"],
        "date": created["memory_date"],
        "description": created["description"],
        "mood": created.get("mood", "neutral"),
        "locationName": created.get("location_name"),
        "latitude": created.get("latitude"),
        "longitude": created.get("longitude"),
        "people": created.get("people", []),
        "tags": created.get("tags", []),
        "keywords": created.get("keywords", []),
        "isFavorite": created.get("is_favorite", False),
        "isPinned": created.get("is_pinned", False),
        "suggestedCategory": created.get("suggestedCategory"),
        "suggestionConfidence": created.get("suggestionConfidence"),
    }


@router.get("/memories/search")
def search_memories(
    q: str = Query("", description="Natural search query with operators"),
    category: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    current_user: dict = Depends(get_current_user),
):
    """
    Inverted-index candidate retrieval + BM25 + Fuzzy matching + Query operator parsing.
    """
    user_memories = memory_manager.get_memories_for_user(current_user["id"], limit=5000)
    tokens, scored_results, elapsed_ms = search_service.search(
        owner_id=current_user["id"],
        user_memories=user_memories,
        raw_query=q,
        category_filter=category,
        from_date=from_date,
        to_date=to_date,
    )

    formatted = []
    for r in scored_results:
        m = r["memory"]
        formatted.append({
            "memory": {
                "memoryId": m["id"],
                "ownerId": m["owner_id"],
                "title": m["title"],
                "category": m["category"],
                "date": m["memory_date"],
                "description": m.get("description", ""),
                "keywords": m.get("keywords", []),
                "tags": m.get("tags", []),
                "mood": m.get("mood", "neutral"),
                "isFavorite": m.get("is_favorite", False),
            },
            "score": r["score"],
            "bm25Score": r.get("bm25_score"),
            "why": r.get("why"),
        })

    return {
        "tokens": tokens,
        "results": formatted,
        "elapsed_ms": elapsed_ms,
        "total": len(formatted),
    }


@router.get("/memories")
def list_memories(
    category: Optional[str] = Query(None),
    mood: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    collection_id: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    is_favorite: Optional[bool] = Query(None),
    is_archived: bool = Query(False),
    trash_only: bool = Query(False),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user),
):
    """Lists user memories sorted newest first, with soft-delete and rich filter support."""
    memories = memory_manager.get_memories_for_user(
        owner_id=current_user["id"],
        category=category,
        mood=mood,
        tag=tag,
        collection_id=collection_id,
        from_date=from_date,
        to_date=to_date,
        is_favorite=is_favorite,
        is_archived=is_archived,
        trash_only=trash_only,
        limit=limit,
        offset=offset,
    )

    return [
        {
            "memoryId": m["id"],
            "ownerId": m["owner_id"],
            "title": m["title"],
            "category": m["category"],
            "date": m["memory_date"],
            "description": m["description"],
            "keywords": m.get("keywords", []),
            "tags": m.get("tags", []),
            "mood": m.get("mood", "neutral"),
            "locationName": m.get("location_name"),
            "latitude": m.get("latitude"),
            "longitude": m.get("longitude"),
            "people": m.get("people", []),
            "isFavorite": bool(m.get("is_favorite")),
            "isPinned": bool(m.get("is_pinned")),
            "isArchived": bool(m.get("is_archived")),
            "attachments": m.get("attachments", []),
            "deletedAt": m.get("deleted_at"),
        }
        for m in memories
    ]


@router.get("/memories/{memory_id}")
def get_memory(
    memory_id: str,
    current_user: dict = Depends(get_current_user),
):
    m = memory_manager.get_memory_by_id(current_user["id"], memory_id, include_deleted=True)
    return {
        "memoryId": m["id"],
        "ownerId": m["owner_id"],
        "title": m["title"],
        "category": m["category"],
        "date": m["memory_date"],
        "description": m["description"],
        "keywords": m.get("keywords", []),
        "tags": m.get("tags", []),
        "mood": m.get("mood", "neutral"),
        "locationName": m.get("location_name"),
        "latitude": m.get("latitude"),
        "longitude": m.get("longitude"),
        "people": m.get("people", []),
        "isFavorite": bool(m.get("is_favorite")),
        "isPinned": bool(m.get("is_pinned")),
        "isArchived": bool(m.get("is_archived")),
        "attachments": db_storage.list_attachments_for_memory(current_user["id"], memory_id),
        "deletedAt": m.get("deleted_at"),
    }


@router.put("/memories/{memory_id}")
def update_memory(
    memory_id: str,
    req: MemoryUpdateDTO,
    current_user: dict = Depends(get_current_user),
):
    updated = memory_manager.update_memory(
        owner_id=current_user["id"],
        memory_id=memory_id,
        title=req.title,
        date_str=req.date,
        description=req.description,
        category=req.category,
        mood=req.mood,
        location_name=req.location_name,
        latitude=req.latitude,
        longitude=req.longitude,
        people=req.people,
        tags=req.tags,
        collection_id=req.collection_id,
        is_favorite=req.is_favorite,
        is_pinned=req.is_pinned,
        is_archived=req.is_archived,
    )
    return {
        "memoryId": updated["id"],
        "ownerId": updated["owner_id"],
        "title": updated["title"],
        "category": updated["category"],
        "date": updated["memory_date"],
        "description": updated["description"],
        "keywords": updated.get("keywords", []),
        "tags": updated.get("tags", []),
        "mood": updated.get("mood", "neutral"),
        "isFavorite": bool(updated.get("is_favorite")),
        "isPinned": bool(updated.get("is_pinned")),
    }


@router.delete("/memories/{memory_id}")
def delete_memory(
    memory_id: str,
    confirm: bool = Query(False),
    purge: bool = Query(False, description="Set true to hard purge immediately"),
    current_user: dict = Depends(get_current_user),
):
    """Soft deletes to Trash by default; hard purges if purge=true."""
    if not confirm:
        raise InvalidInputException("Confirmation required before deletion.")

    if purge:
        memory_manager.purge_memory(current_user["id"], memory_id)
        return {"message": f"Memory '{memory_id}' permanently purged.", "memoryId": memory_id}
    else:
        memory_manager.soft_delete_memory(current_user["id"], memory_id)
        return {"message": f"Memory '{memory_id}' moved to Trash.", "memoryId": memory_id}


@router.post("/memories/{memory_id}/restore")
def restore_memory(
    memory_id: str,
    current_user: dict = Depends(get_current_user),
):
    restored = memory_manager.restore_memory(current_user["id"], memory_id)
    return {"message": f"Memory '{memory_id}' restored from Trash.", "memoryId": memory_id}


@router.delete("/memories/{memory_id}/purge")
def purge_memory(
    memory_id: str,
    current_user: dict = Depends(get_current_user),
):
    memory_manager.purge_memory(current_user["id"], memory_id)
    return {"message": f"Memory '{memory_id}' permanently purged.", "memoryId": memory_id}


@router.get("/memories/{memory_id}/related")
def get_related(
    memory_id: str,
    current_user: dict = Depends(get_current_user),
):
    related = memory_manager.get_related_memories(current_user["id"], memory_id)
    formatted = [
        {
            "memory": {
                "memoryId": r["memory"]["id"],
                "ownerId": r["memory"]["owner_id"],
                "title": r["memory"]["title"],
                "category": r["memory"]["category"],
                "date": r["memory"]["memory_date"],
                "description": r["memory"]["description"],
                "keywords": r["memory"].get("keywords", []),
                "tags": r["memory"].get("tags", []),
            },
            "score": r["score"],
        }
        for r in related
    ]
    return {"targetId": memory_id, "related": formatted}


@router.post("/memories/bulk")
def bulk_action(
    req: BulkActionDTO,
    current_user: dict = Depends(get_current_user),
):
    """Executes bulk operations across multi-selected memories."""
    uid = current_user["id"]
    count = 0
    for mid in req.memory_ids:
        try:
            if req.action == "delete":
                memory_manager.soft_delete_memory(uid, mid)
                count += 1
            elif req.action == "archive":
                memory_manager.update_memory(uid, mid, is_archived=True)
                count += 1
            elif req.action == "unarchive":
                memory_manager.update_memory(uid, mid, is_archived=False)
                count += 1
            elif req.action == "tag" and req.tag_name:
                mem = memory_manager.get_memory_by_id(uid, mid)
                existing_tag_names = [t["name"] for t in mem.get("tags", [])]
                if req.tag_name not in existing_tag_names:
                    existing_tag_names.append(req.tag_name)
                    memory_manager.update_memory(uid, mid, tags=existing_tag_names)
                count += 1
            elif req.action == "move" and req.collection_id:
                memory_manager.update_memory(uid, mid, collection_id=req.collection_id)
                count += 1
        except Exception:
            pass

    return {"message": f"Bulk action '{req.action}' applied to {count} record(s).", "count": count}
