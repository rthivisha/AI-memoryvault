"""
Authentication and Profile API routes for AI MemoVault.
Includes login, refresh token rotation, lockout handling, profile management, and 2FA TOTP.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field

from app.api.deps import auth_service, get_current_user, db_storage
from app.exceptions import InvalidInputException, AuthenticationException

router = APIRouter(prefix="/api/auth", tags=["Authentication & Profile"])


class RegisterDTO(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None


class LoginDTO(BaseModel):
    username: str
    password: str
    totp_code: Optional[str] = None


class RefreshDTO(BaseModel):
    refreshToken: str


class ProfileUpdateDTO(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class PasswordUpdateDTO(BaseModel):
    current_password: str
    new_password: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(req: RegisterDTO):
    new_user = auth_service.register(req.username, req.password, req.display_name)
    return {
        "userId": new_user["id"],
        "username": new_user["username"],
        "displayName": new_user.get("display_name"),
    }


@router.post("/login")
def login_user(req: LoginDTO, request: Request):
    ip = request.client.host if request.client else None
    agent = request.headers.get("user-agent")
    res = auth_service.authenticate(
        username_input=req.username,
        password_input=req.password,
        totp_code=req.totp_code,
        ip_address=ip,
        user_agent=agent,
    )
    return res


@router.post("/refresh")
def refresh_token(req: RefreshDTO):
    return auth_service.rotate_refresh_token(req.refreshToken)


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "userId": current_user["id"],
        "username": current_user["username"],
        "displayName": current_user.get("display_name") or current_user["username"],
        "avatarUrl": current_user.get("avatar_url"),
        "twoFactorEnabled": bool(current_user.get("two_factor_enabled")),
    }


@router.put("/profile")
def update_profile(req: ProfileUpdateDTO, current_user: dict = Depends(get_current_user)):
    updated = db_storage.update_user_profile(
        user_id=current_user["id"],
        display_name=req.display_name,
        avatar_url=req.avatar_url,
    )
    return {
        "userId": updated["id"],
        "username": updated["username"],
        "displayName": updated.get("display_name"),
        "avatarUrl": updated.get("avatar_url"),
    }


@router.put("/password")
def update_password(req: PasswordUpdateDTO, current_user: dict = Depends(get_current_user)):
    from app.utils.password_util import verify_password, hash_password, generate_salt, check_password_strength
    is_valid, _ = verify_password(req.current_password, current_user["password_hash"], current_user["salt"])
    if not is_valid:
        raise InvalidInputException("Current password is incorrect.")
    check_password_strength(req.new_password)

    new_salt = generate_salt(16)
    new_hash = hash_password(req.new_password, new_salt)
    db_storage.update_user_password(current_user["id"], new_hash, new_salt)
    db_storage.log_activity(current_user["id"], "change_password", "user", current_user["id"])
    return {"message": "Password updated successfully."}


@router.delete("/account")
def delete_account(current_user: dict = Depends(get_current_user)):
    db_storage.delete_user_account(current_user["id"])
    return {"message": "Account and all associated records permanently purged."}
