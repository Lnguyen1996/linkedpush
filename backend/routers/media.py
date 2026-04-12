from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import os
import uuid
from PIL import Image as PILImage

from database import get_db
from models import Media, User
from schemas import MediaResponse
from routers.auth import get_current_user

router = APIRouter(prefix="/api/media", tags=["media"])

UPLOAD_DIR = "data/uploads"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif"}
MAX_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("", status_code=201, response_model=MediaResponse)
async def upload_media(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and GIF files are allowed")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")

    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(filepath, "wb") as f:
        f.write(contents)

    width, height = None, None
    try:
        img = PILImage.open(filepath)
        width, height = img.size
    except Exception:
        pass

    media = Media(
        user_id=user.id,
        filename=filename,
        original_filename=file.filename,
        file_path=filepath,
        file_size=len(contents),
        mime_type=file.content_type,
        width=width,
        height=height,
    )
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


@router.get("", response_model=list[MediaResponse])
def list_media(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = (
        db.query(Media)
        .filter(Media.user_id == user.id)
        .order_by(Media.created_at.desc())
        .all()
    )
    return items


@router.get("/{media_id}", response_model=MediaResponse)
def get_media(media_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Media).filter(Media.id == media_id, Media.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")
    return item


@router.delete("/{media_id}", status_code=204)
def delete_media(media_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Media).filter(Media.id == media_id, Media.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Media not found")

    if os.path.exists(item.file_path):
        os.remove(item.file_path)

    db.delete(item)
    db.commit()
