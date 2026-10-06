"""
Shared dependencies and service singletons for AI MemoVault API routes.
"""

from typing import Optional
from fastapi import Header
from app.config import USERS_FILE, MEMORIES_FILE
from app.exceptions import AuthenticationException
from app.models.user import User
from app.storage.file_storage import FileStorage
from app.storage.inverted_index import UserInvertedIndex
from app.services.auth_service import AuthService
from app.services.memory_manager import MemoryManager
from app.services.search_service import SearchService

# Application singletons
storage = FileStorage(users_file=USERS_FILE, memories_file=MEMORIES_FILE)
index_manager = UserInvertedIndex()
memory_manager = MemoryManager(storage=storage, index_manager=index_manager)
search_service = SearchService(index_manager=index_manager)
auth_service = AuthService(storage=storage)


def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    """
    Extracts Bearer token from Authorization header and returns authenticated User entity.
    Raises AuthenticationException(401) on missing or invalid token.
    """
    if not authorization:
        raise AuthenticationException("Please log in first.")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthenticationException("Please log in first.")

    token = parts[1]
    return auth_service.get_current_user_from_token(token)
