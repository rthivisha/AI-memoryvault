"""
Shared API dependencies and service singletons for AI MemoVault.
Uses DBStorage (SQLite/PostgreSQL) and initializes attachment, dashboard, search, and auth services.
"""

from typing import Optional
from fastapi import Header
from app.exceptions import AuthenticationException
from app.storage.db_storage import DBStorage
from app.storage.inverted_index import UserInvertedIndex
from app.services.auth_service import AuthService
from app.services.memory_manager import MemoryManager
from app.services.search_service import SearchService
from app.services.attachment_service import AttachmentService
from app.services.dashboard_service import DashboardService

# Singletons
db_storage = DBStorage()
index_manager = UserInvertedIndex()
memory_manager = MemoryManager(db=db_storage, index_manager=index_manager)
search_service = SearchService(index_manager=index_manager)
auth_service = AuthService(db=db_storage)
attachment_service = AttachmentService(db=db_storage)
dashboard_service = DashboardService(db=db_storage)


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Extracts user from Bearer token."""
    if not authorization:
        raise AuthenticationException("Please log in first.")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthenticationException("Please log in first.")

    token = parts[1]
    return auth_service.get_current_user_from_token(token)
