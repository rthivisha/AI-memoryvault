"""API package for AI MemoVault."""
from .auth_routes import router as auth_router
from .memory_routes import router as memory_router
from .ai_routes import router as ai_router

__all__ = ["auth_router", "memory_router", "ai_router"]
