from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from models import User
from routers.auth import get_current_user
from config import ANTHROPIC_API_KEY

router = APIRouter(prefix="/api/ai", tags=["ai"])

SYSTEM_PROMPT = """You are a LinkedIn content strategist. Generate engaging LinkedIn posts that:
- Start with a strong hook (first line grabs attention)
- Use short paragraphs and line breaks for readability
- Include relevant hashtags (3-5 at the end)
- End with a clear call-to-action (question, invitation to comment, etc.)
- Stay within 3000 characters
- Sound authentic, not corporate or salesy

Adjust your tone based on the requested style:
- Professional: Data-driven, insightful, thought leadership
- Casual: Conversational, relatable, personal stories
- Storytelling: Narrative arc, lessons learned, emotional connection"""


class GenerateRequest(BaseModel):
    topic: str
    tone: str = "professional"  # professional, casual, storytelling
    additional_context: Optional[str] = None


class GenerateResponse(BaseModel):
    caption: str


@router.post("/generate", response_model=GenerateResponse)
async def generate_caption(
    data: GenerateRequest,
    user: User = Depends(get_current_user),
):
    if not ANTHROPIC_API_KEY:
        # Dev mode fallback: generate a template response
        templates = {
            "professional": f"Excited to share insights on {data.topic}.\n\nHere are 3 key takeaways:\n\n1. Innovation starts with understanding the problem deeply\n2. The best solutions are often the simplest ones\n3. Continuous learning is the competitive advantage\n\nWhat's your experience with {data.topic}? I'd love to hear your thoughts in the comments.\n\n#LinkedIn #ProfessionalGrowth #Innovation",
            "casual": f"Let me tell you something about {data.topic} that nobody talks about...\n\nI used to think it was all about the big wins. Turns out, it's the small daily habits that make the real difference.\n\nHere's what changed for me:\n\nI started paying attention to the details. And everything shifted.\n\nAnyone else feel the same way? Drop a comment!\n\n#RealTalk #Growth #CareerTips",
            "storytelling": f"3 years ago, I knew nothing about {data.topic}.\n\nToday, it's transformed how I work.\n\nHere's the story:\n\nIt started with a simple question from a colleague. That question led me down a rabbit hole I never expected.\n\nThe lesson? Sometimes the most valuable skills come from the most unexpected places.\n\nWhat unexpected skill has changed your career? Share below.\n\n#MyStory #CareerJourney #LessonsLearned",
        }
        caption = templates.get(data.tone, templates["professional"])
        return GenerateResponse(caption=caption)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        user_prompt = f"Write a LinkedIn post about: {data.topic}"
        if data.additional_context:
            user_prompt += f"\n\nAdditional context: {data.additional_context}"
        user_prompt += f"\n\nTone: {data.tone}"

        message = client.messages.create(
            model="claude-sonnet-4-5-20250514",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        caption = message.content[0].text
        return GenerateResponse(caption=caption)

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI generation failed: {str(e)[:200]}")
