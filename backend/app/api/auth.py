import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models.user import User

router = APIRouter()

# Simple in-memory rate limiter for login attempts
_login_attempts: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 5  # max attempts
_RATE_WINDOW = 60  # per 60 seconds


def _check_rate_limit(username: str):
    now = time.time()
    attempts = _login_attempts[username]
    # Purge old entries
    _login_attempts[username] = [t for t in attempts if now - t < _RATE_WINDOW]
    if len(_login_attempts[username]) >= _RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please try again later.",
        )


def _record_failed_attempt(username: str):
    _login_attempts[username].append(time.time())


class SignupRequest(BaseModel):
    username: str
    password: str
    email: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str | None
    totp_enabled: bool = False

    model_config = {"from_attributes": True}


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if len(body.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")

    if body.email and db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        username=body.username,
        email=body.email or None,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    _check_rate_limit(body.username)

    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        _record_failed_attempt(body.username)
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    # Check 2FA if enabled
    if user.totp_secret:
        # Return a partial token that requires 2FA verification
        return TokenResponse(access_token=create_access_token(user.id, pending_2fa=True))

    return TokenResponse(access_token=create_access_token(user.id))


class TwoFactorVerifyRequest(BaseModel):
    code: str


@router.post("/2fa/verify", response_model=TokenResponse)
def verify_2fa(
    body: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify a 2FA code and return a full access token."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA not enabled")

    from app.auth import verify_totp
    if not verify_totp(current_user.totp_secret, body.code):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")

    return TokenResponse(access_token=create_access_token(current_user.id))


class TwoFactorSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
def setup_2fa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a TOTP secret for 2FA setup."""
    import pyotp
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current_user.username, issuer_name="Kanakku Pulla")
    # Store temporarily — will be confirmed via /2fa/confirm
    current_user.totp_pending_secret = secret
    db.commit()
    return TwoFactorSetupResponse(secret=secret, otpauth_uri=uri)


class TwoFactorConfirmRequest(BaseModel):
    code: str


@router.post("/2fa/confirm")
def confirm_2fa(
    body: TwoFactorConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Confirm 2FA setup by verifying a code from the authenticator app."""
    if not current_user.totp_pending_secret:
        raise HTTPException(status_code=400, detail="No pending 2FA setup")

    from app.auth import verify_totp
    if not verify_totp(current_user.totp_pending_secret, body.code):
        raise HTTPException(status_code=401, detail="Invalid code — try again")

    current_user.totp_secret = current_user.totp_pending_secret
    current_user.totp_pending_secret = None
    db.commit()
    return {"ok": True, "message": "2FA enabled successfully"}


@router.post("/2fa/disable")
def disable_2fa(
    body: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disable 2FA. Requires a valid code to confirm."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA not enabled")

    from app.auth import verify_totp
    if not verify_totp(current_user.totp_secret, body.code):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")

    current_user.totp_secret = None
    db.commit()
    return {"ok": True, "message": "2FA disabled"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    resp = UserResponse.model_validate(current_user)
    resp.totp_enabled = bool(current_user.totp_secret)
    return resp
