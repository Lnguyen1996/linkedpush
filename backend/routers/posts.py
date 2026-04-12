from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
import math
from database import get_db
from models import Post, Comment, User
from schemas import PostCreate, PostUpdate, PostResponse, PostList
from routers.auth import get_current_user, get_optional_user

router = APIRouter(prefix="/api/posts", tags=["posts"])


def post_to_response(post: Post) -> PostResponse:
    first_comment_content = None
    if post.first_comment:
        first_comment_content = post.first_comment.content

    image_url = None
    if post.image:
        image_url = f"/uploads/{post.image.filename}"

    return PostResponse(
        id=post.id,
        user_id=post.user_id,
        title=post.title,
        content=post.content,
        status=post.status,
        scheduled_at=post.scheduled_at,
        timezone=post.timezone,
        published_at=post.published_at,
        linkedin_post_id=post.linkedin_post_id,
        error_message=post.error_message,
        image_id=post.image_id,
        first_comment=first_comment_content,
        image_url=image_url,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


@router.post("", status_code=201, response_model=PostResponse)
def create_post(data: PostCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = Post(
        user_id=user.id,
        title=data.title,
        content=data.content,
        scheduled_at=data.scheduled_at,
        timezone=data.timezone,
        status=data.status,
        image_id=data.image_id,
    )
    db.add(post)
    db.flush()

    if data.first_comment:
        comment = Comment(post_id=post.id, content=data.first_comment)
        db.add(comment)

    db.commit()
    db.refresh(post)
    return post_to_response(post)


@router.get("", response_model=PostList)
def list_posts(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    status: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Post).filter(Post.user_id == user.id)
    if status:
        query = query.filter(Post.status == status)

    total = query.count()
    total_pages = max(1, math.ceil(total / per_page))
    posts = (
        query.order_by(Post.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return PostList(
        posts=[post_to_response(p) for p in posts],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/{post_id}", response_model=PostResponse)
def get_post(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post_to_response(post)


@router.put("/{post_id}", response_model=PostResponse)
def update_post(post_id: int, data: PostUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    update_data = data.model_dump(exclude_unset=True)
    first_comment_content = update_data.pop("first_comment", None)

    for key, value in update_data.items():
        setattr(post, key, value)

    if first_comment_content is not None:
        if post.first_comment:
            post.first_comment.content = first_comment_content
        else:
            comment = Comment(post_id=post.id, content=first_comment_content)
            db.add(comment)

    db.commit()
    db.refresh(post)
    return post_to_response(post)


@router.delete("/{post_id}", status_code=204)
def delete_post(post_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.first_comment:
        db.delete(post.first_comment)
    db.delete(post)
    db.commit()
    return Response(status_code=204)
