from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import httpx
import hashlib
import hmac
import json
import base64

from database import get_db
from models import User
from config import (
    SECRET_KEY,
    LINKEDIN_CLIENT_ID,
    LINKEDIN_CLIENT_SECRET,
    LINKEDIN_REDIRECT_URI,
    DEV_MODE,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo"


def create_session_token(user_id: int) -> str:
    payload = json.dumps({"user_id": user_id, "ts": datetime.now(timezone.utc).isoformat()})
    payload_b64 = base64.urlsafe_b64encode(payload.encode()).decode()
    sig = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{sig}"


def verify_session_token(token: str) -> int | None:
    try:
        payload_b64, sig = token.rsplit(".", 1)
        expected_sig = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("user_id")
    except Exception:
        return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = verify_session_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid session")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = request.cookies.get("session")
    if not token:
        return None
    user_id = verify_session_token(token)
    if user_id is None:
        return None
    return db.query(User).filter(User.id == user_id).first()


@router.get("/login")
def login():
    if DEV_MODE and not LINKEDIN_CLIENT_ID:
        return {"redirect_url": "/api/auth/dev-login"}

    params = {
        "response_type": "code",
        "client_id": LINKEDIN_CLIENT_ID,
        "redirect_uri": LINKEDIN_REDIRECT_URI,
        "scope": "openid profile email w_member_social",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return {"redirect_url": f"{LINKEDIN_AUTH_URL}?{query}"}


@router.get("/callback")
async def callback(code: str, db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            LINKEDIN_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": LINKEDIN_REDIRECT_URI,
                "client_id": LINKEDIN_CLIENT_ID,
                "client_secret": LINKEDIN_CLIENT_SECRET,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to exchange code for token")

    token_data = token_resp.json()
    access_token = token_data["access_token"]

    async with httpx.AsyncClient() as client:
        profile_resp = await client.get(
            LINKEDIN_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if profile_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to fetch LinkedIn profile")

    profile = profile_resp.json()
    linkedin_id = profile.get("sub", "")
    name = profile.get("name", "LinkedIn User")
    email = profile.get("email")
    avatar_url = profile.get("picture")

    user = db.query(User).filter(User.linkedin_id == linkedin_id).first()
    if user:
        user.name = name
        user.email = email
        user.avatar_url = avatar_url
        user.access_token = access_token
        user.updated_at = datetime.now(timezone.utc)
    else:
        user = User(
            linkedin_id=linkedin_id,
            name=name,
            email=email,
            avatar_url=avatar_url,
            access_token=access_token,
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    session_token = create_session_token(user.id)
    response = RedirectResponse(url="/", status_code=302)
    response.set_cookie(
        key="session",
        value=session_token,
        httponly=True,
        samesite="lax",
        max_age=86400 * 7,
    )
    return response


@router.get("/dev-login")
def dev_login(db: Session = Depends(get_db)):
    if not DEV_MODE:
        raise HTTPException(status_code=404, detail="Not found")

    user = db.query(User).filter(User.linkedin_id == "dev-user").first()
    if not user:
        user = User(
            linkedin_id="dev-user",
            name="Dev User",
            email="dev@postiz.local",
            avatar_url=None,
            access_token="dev-token",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    session_token = create_session_token(user.id)
    response = RedirectResponse(url="/", status_code=302)
    response.set_cookie(
        key="session",
        value=session_token,
        httponly=True,
        samesite="lax",
        max_age=86400 * 7,
    )
    return response


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "avatar_url": user.avatar_url,
    }


@router.post("/logout")
def logout():
    response = JSONResponse(content={"ok": True})
    response.delete_cookie("session")
    return response
