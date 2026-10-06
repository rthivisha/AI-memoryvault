"""Models package for AI MemoVault."""
from .user import User, UserRegisterRequest, UserLoginRequest, UserResponse, TokenResponse
from .memory import (
    Memory,
    MemoryCreateRequest,
    MemoryUpdateRequest,
    MemoryResponse,
    SearchResponse,
    SearchResultItem,
    SuggestRequest,
    SuggestResponse,
    RelatedResponse,
    StatsResponse,
    VALID_CATEGORIES,
)

__all__ = [
    "User",
    "UserRegisterRequest",
    "UserLoginRequest",
    "UserResponse",
    "TokenResponse",
    "Memory",
    "MemoryCreateRequest",
    "MemoryUpdateRequest",
    "MemoryResponse",
    "SearchResponse",
    "SearchResultItem",
    "SuggestRequest",
    "SuggestResponse",
    "RelatedResponse",
    "StatsResponse",
    "VALID_CATEGORIES",
]
