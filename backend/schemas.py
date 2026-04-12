from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PostCreate(BaseModel):
    title: Optional[str] = None
    content: str = ""
    scheduled_at: Optional[datetime] = None
    timezone: Optional[str] = "UTC"
    status: str = "draft"
    first_comment: Optional[str] = None
    image_id: Optional[int] = None


class PostUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    timezone: Optional[str] = None
    status: Optional[str] = None
    first_comment: Optional[str] = None
    image_id: Optional[int] = None


class PostResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    title: Optional[str] = None
    content: str
    status: str
    scheduled_at: Optional[datetime] = None
    timezone: Optional[str] = None
    published_at: Optional[datetime] = None
    linkedin_post_id: Optional[str] = None
    error_message: Optional[str] = None
    image_id: Optional[int] = None
    first_comment: Optional[str] = None
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PostList(BaseModel):
    posts: list[PostResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class MediaResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_path: str
    file_size: int
    mime_type: str
    width: Optional[int] = None
    height: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AnalyticsResponse(BaseModel):
    id: int
    post_id: int
    impressions: int
    likes: int
    comments: int
    shares: int
    engagement_rate: float
    fetched_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
