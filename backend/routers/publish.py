from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Post, User
from routers.auth import get_current_user
from services.linkedin import publish_post

router = APIRouter(prefix="/api/posts", tags=["publish"])


@router.post("/{post_id}/publish")
async def publish_now(
    post_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id, Post.user_id == user.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.status == "published":
        raise HTTPException(status_code=400, detail="Post is already published")

    if post.status == "publishing":
        raise HTTPException(status_code=400, detail="Post is currently being published")

    if not user.access_token or user.access_token == "dev-token":
        # In dev mode, simulate publishing
        from datetime import datetime, timezone
        post.status = "published"
        post.linkedin_post_id = f"dev-post-{post.id}"
        post.linkedin_post_urn = f"urn:li:share:dev-{post.id}"
        post.published_at = datetime.now(timezone.utc)
        post.error_message = None
        if post.first_comment:
            post.first_comment.posted = 1
            post.first_comment.linkedin_comment_id = f"dev-comment-{post.id}"
        db.commit()
        return {"status": "published", "linkedin_post_id": post.linkedin_post_id, "simulated": True}

    success = await publish_post(post, user, db)
    db.refresh(post)

    if success:
        return {"status": "published", "linkedin_post_id": post.linkedin_post_id}
    else:
        raise HTTPException(status_code=502, detail=post.error_message or "Publishing failed")
