"""
Memory management and search API route handlers.
Enforces per-user data isolation on every endpoint.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.models.memory import (
    MemoryCreateRequest,
    MemoryUpdateRequest,
    MemoryResponse,
    SearchResponse,
    SearchResultItem,
    RelatedResponse,
    StatsResponse,
)
from app.models.user import User
from app.api.deps import (
    get_current_user,
    memory_manager,
    search_service,
)

router = APIRouter(prefix="/api", tags=["Memories & Search"])


@router.post("/memories", status_code=status.HTTP_201_CREATED)
def create_memory(
    req: MemoryCreateRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Creates and persists a new memory record.
    If category is omitted, auto-classifies with AI service.
    Returns record + suggestion info + generated ID.
    ID is only returned after persistence succeeds.
    """
    memory, suggested_cat, conf = memory_manager.create_memory(
        owner_id=current_user.user_id,
        title=req.title,
        date_str=req.date,
        description=req.description,
        category=req.category,
    )
    result = memory.to_dict()
    result["suggestedCategory"] = suggested_cat
    result["suggestionConfidence"] = conf
    return result


@router.get("/memories/search", response_model=SearchResponse)
def search_memories(
    q: str = Query("", description="Natural search query"),
    category: Optional[str] = Query(None, description="Filter category"),
    from_date: Optional[str] = Query(None, alias="from", description="From date yyyy-MM-dd"),
    to_date: Optional[str] = Query(None, alias="to", description="To date yyyy-MM-dd"),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Performs inverted-index accelerated lexical search with weighted relevance scoring.
    Formula: score(q, m) = 0.50*body + 0.30*title + 0.20*category
    """
    user_memories = memory_manager.get_memories_for_user(current_user.user_id)
    tokens, scored_results, elapsed_ms = search_service.search(
        owner_id=current_user.user_id,
        user_memories=user_memories,
        query=q,
        category_filter=category,
        from_date=from_date,
        to_date=to_date,
    )

    results = [
        {"memory": m.to_dict(), "score": score}
        for m, score in scored_results
    ]

    return {
        "tokens": tokens,
        "results": results,
        "elapsed_ms": elapsed_ms,
        "total": len(results),
    }


@router.get("/memories", response_model=list[MemoryResponse])
def list_memories(
    category: Optional[str] = Query(None, description="Optional category filter"),
    from_date: Optional[str] = Query(None, alias="from", description="From date yyyy-MM-dd"),
    to_date: Optional[str] = Query(None, alias="to", description="To date yyyy-MM-dd"),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """
    Lists memories for the current user sorted newest first.
    Accepts optional category and date-range filters.
    """
    memories = memory_manager.get_memories_for_user(
        owner_id=current_user.user_id,
        category=category,
        from_date=from_date,
        to_date=to_date,
    )
    return [m.to_dict() for m in memories]


@router.get("/memories/{memory_id}", response_model=MemoryResponse)
def get_memory(
    memory_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Retrieves a single memory by ID. Enforces user isolation.
    """
    memory = memory_manager.get_memory_by_id(current_user.user_id, memory_id)
    return memory.to_dict()


@router.put("/memories/{memory_id}", response_model=MemoryResponse)
def update_memory(
    memory_id: str,
    req: MemoryUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Updates an existing memory record. Refreshes TF-IDF keywords and inverted index.
    """
    updated = memory_manager.update_memory(
        owner_id=current_user.user_id,
        memory_id=memory_id,
        title=req.title,
        date_str=req.date,
        description=req.description,
        category=req.category,
    )
    return updated.to_dict()


@router.delete("/memories/{memory_id}")
def delete_memory(
    memory_id: str,
    confirm: bool = Query(False, description="Explicit confirmation flag required"),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Deletes a memory record. Requires explicit ?confirm=true query parameter.
    """
    memory_manager.delete_memory(
        owner_id=current_user.user_id,
        memory_id=memory_id,
        confirm=confirm,
    )
    return {"message": f"Memory '{memory_id}' deleted successfully.", "memoryId": memory_id}


@router.get("/memories/{memory_id}/related", response_model=RelatedResponse)
def get_related_memories(
    memory_id: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Retrieves top 5 related records of the current user computed via Jaccard similarity.
    Formula: J(A, B) = |A ∩ B| / |A ∪ B|
    """
    related = memory_manager.get_related_memories(current_user.user_id, memory_id)
    results = [
        {"memory": m.to_dict(), "score": score}
        for m, score in related
    ]
    return {
        "targetId": memory_id,
        "related": results,
    }


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Calculates summary metrics: total records, per-category breakdown, and recent records.
    """
    return memory_manager.get_stats(current_user.user_id)
