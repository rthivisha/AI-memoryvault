"""
Authentication route handlers for AI MemoVault.
Clean presentation layer delegating to AuthService with no inline business rules.
"""

from fastapi import APIRouter, Depends, status
from app.models.user import (
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    TokenResponse,
    User,
)
from app.api.deps import auth_service, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(req: UserRegisterRequest) -> dict:
    """
    Registers a new user account.
    Validates username format, minimum password length, and checks uniqueness.
    """
    new_user = auth_service.register(req.username, req.password)
    return new_user.to_dict()


@router.post("/login", response_model=TokenResponse)
def login_user(req: UserLoginRequest) -> dict:
    """
    Authenticates user and returns an 8-hour HS256 Bearer JWT token.
    Uses constant-time comparison and uniform invalid-credentials error.
    """
    token, user = auth_service.authenticate(req.username, req.password)
    return {
        "token": token,
        "user": user.to_dict(),
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> dict:
    """
    Returns profile information for the currently authenticated user.
    """
    return current_user.to_dict()
