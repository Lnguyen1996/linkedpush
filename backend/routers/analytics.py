from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import httpx
import random

from database import get_db
from models import Post, User, Analytics
from routers.auth import get_current_user
from config import DEV_MODE

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


async def fetch_linkedin_analytics(post: Post, user: User) -> dict:
    """Fetch analytics from LinkedIn API for a published post."""
    if not user.access_token or user.access_token == "dev-token":
        # Dev mode: generate simulated analytics
        return {
            "impressions": random.randint(50, 5000),
            "likes": random.randint(0, 200),
            "comments": random.randint(0, 50),
            "shares": random.randint(0, 30),
        }

    headers = {
        "Authorization": f"Bearer {user.access_token}",
        "X-Restli-Protocol-Version": "2.0.0",
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.linkedin.com/v2/socialActions/{post.linkedin_post_urn}",
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "impressions": 0,  # LinkedIn doesn't expose impressions via this endpoint
                    "likes": data.get("likesSummary", {}).get("totalLikes", 0),
                    "comments": data.get("commentsSummary", {}).get("totalFirstLevelComments", 0),
                    "shares": 0,
                }
    except Exception:
        pass

    return {"impressions": 0, "likes": 0, "comments": 0, "shares": 0}


@router.get("")
async def get_analytics(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    published_posts = (
        db.query(Post)
        .filter(Post.user_id == user.id, Post.status == "published")
        .order_by(Post.published_at.desc())
        .all()
    )

    results = []
    total_impressions = 0
    total_likes = 0
    total_comments = 0
    total_shares = 0

    for post in published_posts:
        analytics = db.query(Analytics).filter(Analytics.post_id == post.id).first()

        has_engagement = analytics and (
            analytics.impressions > 0 or analytics.likes > 0 or
            analytics.comments > 0 or analytics.shares > 0
        )

        results.append({
            "post_id": post.id,
            "title": post.title or "",
            "published_at": post.published_at.isoformat() if post.published_at else None,
            "impressions": analytics.impressions if analytics else 0,
            "likes": analytics.likes if analytics else 0,
            "comments": analytics.comments if analytics else 0,
            "shares": analytics.shares if analytics else 0,
            "has_engagement": has_engagement,
        })

        if analytics:
            total_impressions += analytics.impressions
            total_likes += analytics.likes
            total_comments += analytics.comments
            total_shares += analytics.shares

    return {
        "summary": {
            "total_posts": len(published_posts),
            "total_impressions": total_impressions,
            "total_engagements": total_likes + total_comments + total_shares,
        },
        "posts": results,
    }


@router.post("/refresh")
async def refresh_analytics(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    published_posts = (
        db.query(Post)
        .filter(Post.user_id == user.id, Post.status == "published")
        .all()
    )

    refreshed = 0
    for post in published_posts:
        stats = await fetch_linkedin_analytics(post, user)

        analytics = db.query(Analytics).filter(Analytics.post_id == post.id).first()
        if analytics:
            analytics.impressions = stats["impressions"]
            analytics.likes = stats["likes"]
            analytics.comments = stats["comments"]
            analytics.shares = stats["shares"]
            analytics.fetched_at = datetime.now(timezone.utc)
        else:
            analytics = Analytics(
                post_id=post.id,
                impressions=stats["impressions"],
                likes=stats["likes"],
                comments=stats["comments"],
                shares=stats["shares"],
            )
            db.add(analytics)

        refreshed += 1

    db.commit()
    return {"refreshed": refreshed}
