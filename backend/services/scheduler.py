import asyncio
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Post, User
from services.linkedin import publish_post


def check_and_publish_due_posts():
    """Check for posts that are due to be published and publish them."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        # Find all posts that are scheduled and due
        due_posts = (
            db.query(Post)
            .filter(Post.status == "scheduled")
            .filter(Post.scheduled_at <= now)
            .all()
        )

        for post in due_posts:
            user = db.query(User).filter(User.id == post.user_id).first()
            if not user:
                post.status = "failed"
                post.error_message = "User not found"
                db.commit()
                continue

            if not user.access_token or user.access_token == "dev-token":
                # Dev mode: simulate publishing
                post.status = "published"
                post.linkedin_post_id = f"dev-scheduled-{post.id}"
                post.linkedin_post_urn = f"urn:li:share:dev-scheduled-{post.id}"
                post.published_at = datetime.now(timezone.utc)
                post.error_message = None
                if post.first_comment:
                    post.first_comment.posted = 1
                    post.first_comment.linkedin_comment_id = f"dev-comment-{post.id}"
                db.commit()
                print(f"[Scheduler] Published post {post.id} (dev mode)")
                continue

            # Real publishing via LinkedIn API
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                success = loop.run_until_complete(publish_post(post, user, db))
                loop.close()

                if success:
                    print(f"[Scheduler] Published post {post.id}")
                else:
                    print(f"[Scheduler] Failed to publish post {post.id}: {post.error_message}")
            except Exception as e:
                post.status = "failed"
                post.error_message = f"Scheduler error: {str(e)[:500]}"
                db.commit()
                print(f"[Scheduler] Error publishing post {post.id}: {e}")

    except Exception as e:
        print(f"[Scheduler] Error in check cycle: {e}")
    finally:
        db.close()


_scheduler = None


def start_scheduler():
    """Start the APScheduler background job."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        check_and_publish_due_posts,
        "interval",
        seconds=60,
        id="publish_due_posts",
        replace_existing=True,
    )
    _scheduler.start()
    print("[Scheduler] Started — checking for due posts every 60 seconds")
    return _scheduler


def stop_scheduler():
    """Stop the scheduler."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        print("[Scheduler] Stopped")
