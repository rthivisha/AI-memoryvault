"""
User entity and schemas for authentication and profile management.
"""

from typing import Optional, Any

try:
    from pydantic import BaseModel, Field
except ImportError:
    class BaseModel:  # type: ignore
        def __init__(self, **kwargs: Any) -> None:
            for k, v in kwargs.items():
                setattr(self, k, v)

    def Field(default: Any = ..., **kwargs: Any) -> Any:  # type: ignore
        return default


class User:
    """
    Domain entity representing a registered user in AI MemoVault.
    Passwords are never stored in plain text.
    """

    def __init__(
        self,
        user_id: str,
        username: str,
        password_hash_base64: str,
        salt_base64: str,
    ) -> None:
        self.user_id: str = user_id
        self.username: str = username
        self.password_hash_base64: str = password_hash_base64
        self.salt_base64: str = salt_base64

    def to_dict(self) -> dict[str, str]:
        return {
            "userId": self.user_id,
            "username": self.username,
        }

    def __repr__(self) -> str:
        return f"<User userId={self.user_id} username={self.username}>"


# Pydantic DTOs for request/response validation
class UserRegisterRequest(BaseModel):
    username: str = Field(..., description="Unique username (3-30 chars, alphanumeric/underscore)")
    password: str = Field(..., min_length=6, description="Password (at least 6 characters)")


class UserLoginRequest(BaseModel):
    username: str = Field(..., description="Username")
    password: str = Field(..., description="Password")


class UserResponse(BaseModel):
    userId: str
    username: str


class TokenResponse(BaseModel):
    token: str
    user: UserResponse
