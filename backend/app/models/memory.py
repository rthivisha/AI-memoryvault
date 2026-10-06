"""
Memory entity and DTO schemas for AI MemoVault.
Implements entity ordering (newest date first) and camelCase serialization.
"""

from typing import Optional, Literal, Any

try:
    from pydantic import BaseModel, Field
except ImportError:
    class BaseModel:  # type: ignore
        def __init__(self, **kwargs: Any) -> None:
            for k, v in kwargs.items():
                setattr(self, k, v)

    def Field(default: Any = ..., **kwargs: Any) -> Any:  # type: ignore
        return default

VALID_CATEGORIES: set[str] = {
    "ACHIEVEMENT",
    "EVENT",
    "STUDY",
    "TRAVEL",
    "REMINDER",
    "PERSONAL",
}


class Memory:
    """
    Core domain entity representing a personal memory record.
    Ordering rule: newest date first. If dates tie, higher memoryId first.
    """

    def __init__(
        self,
        memory_id: str,
        owner_id: str,
        title: str,
        category: str,
        date: str,
        description: str,
        keywords: Optional[list[str]] = None,
    ) -> None:
        self.memory_id: str = memory_id
        self.owner_id: str = owner_id
        self.title: str = title
        self.category: str = category
        self.date: str = date
        self.description: str = description
        self.keywords: list[str] = keywords or []

    def __getitem__(self, item: str) -> Any:
        mapping = {
            "id": self.memory_id,
            "memory_id": self.memory_id,
            "memoryId": self.memory_id,
            "owner_id": self.owner_id,
            "ownerId": self.owner_id,
            "title": self.title,
            "category": self.category,
            "date": self.date,
            "memory_date": self.date,
            "description": self.description,
            "description_encrypted": self.description,
            "keywords": self.keywords,
        }
        if item in mapping:
            return mapping[item]
        raise KeyError(item)

    def get(self, item: str, default: Any = None) -> Any:
        try:
            return self[item]
        except KeyError:
            return default

    def __lt__(self, other: "Memory") -> bool:
        """
        Sort order: newest date first.
        If dates are identical, higher memoryId ranks first.
        """
        if not isinstance(other, Memory):
            return NotImplemented
        if self.date != other.date:
            return self.date > other.date
        return self.memory_id > other.memory_id

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Memory):
            return False
        return self.memory_id == other.memory_id

    def to_dict(self) -> dict:
        return {
            "memoryId": self.memory_id,
            "ownerId": self.owner_id,
            "title": self.title,
            "category": self.category,
            "date": self.date,
            "description": self.description,
            "keywords": self.keywords,
        }

    def __repr__(self) -> str:
        return f"<Memory {self.memory_id} [{self.category}] {self.date}: {self.title}>"


# Pydantic schemas for REST API
class MemoryCreateRequest(BaseModel):
    title: str = Field(..., description="Title (1-60 characters)")
    date: str = Field(..., description="ISO Date (yyyy-MM-dd, cannot be in future)")
    description: str = Field(..., description="Description (5-500 characters)")
    category: Optional[str] = Field(None, description="Category (optional; auto-classified if omitted)")


class MemoryUpdateRequest(BaseModel):
    title: str = Field(..., description="Updated title (1-60 characters)")
    date: str = Field(..., description="Updated ISO Date (yyyy-MM-dd)")
    description: str = Field(..., description="Updated description (5-500 characters)")
    category: str = Field(..., description="Updated category")


class MemoryResponse(BaseModel):
    memoryId: str
    ownerId: str
    title: str
    category: str
    date: str
    description: str
    keywords: list[str]


class SearchResultItem(BaseModel):
    memory: MemoryResponse
    score: float


class SearchResponse(BaseModel):
    tokens: list[str]
    results: list[SearchResultItem]
    elapsed_ms: float
    total: int


class SuggestRequest(BaseModel):
    title: str
    description: str


class SuggestResponse(BaseModel):
    category: str
    confidence: float
    keywords_preview: list[str]
    tokens: list[str]


class RelatedResponse(BaseModel):
    targetId: str
    related: list[SearchResultItem]


class StatsResponse(BaseModel):
    total: int
    by_category: dict[str, int]
    recent: list[MemoryResponse]
