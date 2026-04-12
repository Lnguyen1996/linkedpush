import httpx
import os
from datetime import datetime, timezone

LINKEDIN_API_BASE = "https://api.linkedin.com/v2"


class LinkedInPublisher:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        }

    async def get_user_urn(self) -> str:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{LINKEDIN_API_BASE}/userinfo",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
            resp.raise_for_status()
            data = resp.json()
            return f"urn:li:person:{data['sub']}"

    async def publish_text_post(self, author_urn: str, text: str) -> str:
        payload = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            },
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{LINKEDIN_API_BASE}/ugcPosts",
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("id", "")

    async def upload_image(self, author_urn: str, image_path: str) -> str:
        # Step 1: Register upload
        register_payload = {
            "registerUploadRequest": {
                "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                "owner": author_urn,
                "serviceRelationships": [
                    {
                        "relationshipType": "OWNER",
                        "identifier": "urn:li:userGeneratedContent",
                    }
                ],
            }
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{LINKEDIN_API_BASE}/assets?action=registerUpload",
                headers=self.headers,
                json=register_payload,
            )
            resp.raise_for_status()
            data = resp.json()

        upload_url = data["value"]["uploadMechanism"][
            "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
        ]["uploadUrl"]
        asset = data["value"]["asset"]

        # Step 2: Upload binary
        with open(image_path, "rb") as f:
            image_data = f.read()

        async with httpx.AsyncClient() as client:
            resp = await client.put(
                upload_url,
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/octet-stream",
                },
                content=image_data,
            )
            resp.raise_for_status()

        return asset

    async def publish_image_post(self, author_urn: str, text: str, image_path: str) -> str:
        asset = await self.upload_image(author_urn, image_path)

        payload = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text},
                    "shareMediaCategory": "IMAGE",
                    "media": [
                        {
                            "status": "READY",
                            "media": asset,
                        }
                    ],
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            },
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{LINKEDIN_API_BASE}/ugcPosts",
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("id", "")

    async def post_comment(self, post_urn: str, author_urn: str, text: str) -> str:
        payload = {
            "actor": author_urn,
            "message": {"text": text},
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{LINKEDIN_API_BASE}/socialActions/{post_urn}/comments",
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("id", "")


def strip_html(html: str) -> str:
    """Convert HTML content to plain text for LinkedIn."""
    import re
    text = re.sub(r'<br\s*/?>', '\n', html)
    text = re.sub(r'</p>\s*<p>', '\n\n', text)
    text = re.sub(r'<li>', '- ', text)
    text = re.sub(r'</li>', '\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = text.strip()
    return text


async def publish_post(post, user, db):
    """Publish a post to LinkedIn. Updates post status in DB."""
    from models import Post, Comment

    try:
        post.status = "publishing"
        db.commit()

        publisher = LinkedInPublisher(user.access_token)
        author_urn = await publisher.get_user_urn()

        plain_text = strip_html(post.content)

        if post.image and os.path.exists(post.image.file_path):
            post_urn = await publisher.publish_image_post(
                author_urn, plain_text, post.image.file_path
            )
        else:
            post_urn = await publisher.publish_text_post(author_urn, plain_text)

        post.linkedin_post_urn = post_urn
        post.linkedin_post_id = post_urn
        post.published_at = datetime.now(timezone.utc)
        post.status = "published"
        post.error_message = None

        # Post first comment if exists
        if post.first_comment and post.first_comment.content:
            try:
                comment_id = await publisher.post_comment(
                    post_urn, author_urn, post.first_comment.content
                )
                post.first_comment.linkedin_comment_id = comment_id
                post.first_comment.posted = 1
            except Exception as e:
                post.error_message = f"Post published but first comment failed: {str(e)}"

        db.commit()
        return True

    except httpx.HTTPStatusError as e:
        post.status = "failed"
        error_body = e.response.text if e.response else str(e)
        if e.response and e.response.status_code == 429:
            post.error_message = "LinkedIn rate limit exceeded. Try again later."
        elif e.response and e.response.status_code == 401:
            post.error_message = "LinkedIn access token expired. Please re-authenticate."
        else:
            post.error_message = f"LinkedIn API error ({e.response.status_code}): {error_body[:500]}"
        db.commit()
        return False

    except Exception as e:
        post.status = "failed"
        post.error_message = f"Publishing failed: {str(e)[:500]}"
        db.commit()
        return False
