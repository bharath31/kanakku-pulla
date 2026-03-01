import base64
import hashlib
import hmac
import json
import time
from datetime import timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# Minimal HS256 JWT using Python stdlib — avoids cryptography C-extension dependency
def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_access_token(user_id: int) -> str:
    expire = int(time.time()) + int(timedelta(minutes=settings.jwt_expire_minutes).total_seconds())
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = _b64url_encode(json.dumps({"sub": str(user_id), "exp": expire}).encode())
    msg = f"{header}.{body}"
    sig = _b64url_encode(hmac.new(settings.jwt_secret_key.encode(), msg.encode(), hashlib.sha256).digest())
    return f"{msg}.{sig}"


def _decode_token(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("bad format")
        header_b64, body_b64, sig_b64 = parts
        msg = f"{header_b64}.{body_b64}"
        expected = _b64url_encode(hmac.new(settings.jwt_secret_key.encode(), msg.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig_b64, expected):
            raise ValueError("bad signature")
        payload = json.loads(_b64url_decode(body_b64))
        if payload.get("exp", 0) < time.time():
            raise ValueError("expired")
        return payload
    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        raise ValueError(str(exc)) from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = _decode_token(credentials.credentials)
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id), User.is_active == True).first()  # noqa: E712
    if user is None:
        raise credentials_exception
    return user
