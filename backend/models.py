from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    linkedin_id = Column(String(100), unique=True, index=True)
    email = Column(String(255), nullable=True)
    name = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    access_token = Column(String(1000), nullable=True)
    refresh_token = Column(String(1000), nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    posts = relationship("Post", back_populates="user")
    media = relationship("Media", back_populates="user")


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False, default="")
    status = Column(String(20), nullable=False, default="draft")  # draft, scheduled, publishing, published, failed
    scheduled_at = Column(DateTime, nullable=True)
    timezone = Column(String(50), nullable=True, default="UTC")
    published_at = Column(DateTime, nullable=True)
    linkedin_post_id = Column(String(255), nullable=True)
    linkedin_post_urn = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)
    image_id = Column(Integer, ForeignKey("media.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="posts")
    image = relationship("Media", foreign_keys=[image_id])
    first_comment = relationship("Comment", back_populates="post", uselist=False)
    analytics = relationship("Analytics", back_populates="post", uselist=False)


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    content = Column(Text, nullable=False)
    linkedin_comment_id = Column(String(255), nullable=True)
    posted = Column(Integer, default=0)  # 0=not posted, 1=posted
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    post = relationship("Post", back_populates="first_comment")


class Media(Base):
    __tablename__ = "media"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="media")


class Analytics(Base):
    __tablename__ = "analytics"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, unique=True)
    impressions = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    engagement_rate = Column(Float, default=0.0)
    fetched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    post = relationship("Post", back_populates="analytics")
