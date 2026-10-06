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
        display_name: Optional[str] = None,
    ) -> None:
        self.user_id: str = user_id
        self.username: str = username
        self.password_hash_base64: str = password_hash_base64
        self.salt_base64: str = salt_base64
        self.display_name: str = display_name or username

    def __getitem__(self, item: str) -> Any:
        mapping = {
            "id": self.user_id,
            "user_id": self.user_id,
            "userId": self.user_id,
            "username": self.username,
            "display_name": self.display_name,
            "password_hash": self.password_hash_base64,
            "salt": self.salt_base64,
        }
        if item in mapping:
            return mapping[item]
        raise KeyError(item)

    def get(self, item: str, default: Any = None) -> Any:
        try:
            return self[item]
        except KeyError:
            return default

    def to_dict(self) -> dict[str, str]:
        return {
            "userId": self.user_id,
            "username": self.username,
            "displayName": self.display_name,
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
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
