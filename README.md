# Postiz — Self-Hosted LinkedIn Post Scheduler

A self-hosted LinkedIn post scheduling tool with rich text editing, image uploads, calendar view, timezone-aware auto-publishing, post analytics, and AI-assisted caption writing.

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS 3
- **Backend:** FastAPI + SQLite (SQLAlchemy ORM)
- **Editor:** TipTap (ProseMirror-based)
- **Scheduling:** APScheduler (in-process, 60s polling)
- **AI:** Claude API (Anthropic) for caption generation
- **Auth:** LinkedIn OAuth2 (with dev mode bypass)

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.13 (or 3.11+)

### 1. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your LinkedIn OAuth credentials and Anthropic API key
# Or leave defaults for dev mode (simulated LinkedIn + template AI responses)

# Start backend
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. Open the App

Visit **http://localhost:5173**

In dev mode (default), click "Sign in with LinkedIn" to auto-create a dev user session.

## Configuration

Create `backend/.env` with:

```env
# LinkedIn OAuth2 (get from https://www.linkedin.com/developers/)
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:5173/auth/callback

# Claude API for AI caption generation
ANTHROPIC_API_KEY=your_anthropic_api_key

# Session security
SECRET_KEY=change-this-to-a-random-secret-key

# Set to false in production
DEV_MODE=true
```

## Features

| Feature | Description |
|---------|-------------|
| **Post Composer** | TipTap rich text editor with bold, italic, lists, links. Live character counter (3000 limit). |
| **First Comment** | Auto-post a comment immediately after your main post. |
| **Image Upload** | Attach images (JPEG/PNG/GIF, max 5MB) from upload or media library. |
| **Media Library** | Grid view of all uploaded images with metadata and preview. |
| **Calendar View** | Month/week calendar showing posts color-coded by status. |
| **Scheduling** | Timezone-aware scheduling with APScheduler auto-publishing every 60s. |
| **LinkedIn Publishing** | LinkedIn API v2 integration for text and image posts. |
| **Analytics** | Summary cards + sortable table with impressions, likes, comments, shares. |
| **AI Assist** | Claude-powered caption generator with professional/casual/storytelling tones. |
| **Responsive** | Full mobile support with collapsible sidebar. |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Save draft in composer |

## Project Structure

```
postiz-clone/
  backend/
    main.py              # FastAPI app entry point
    database.py          # SQLAlchemy setup
    models.py            # ORM models (User, Post, Comment, Media, Analytics)
    schemas.py           # Pydantic schemas
    config.py            # Environment config
    routers/
      auth.py            # LinkedIn OAuth2 + session management
      posts.py           # Post CRUD API
      media.py           # Image upload/library API
      publish.py         # LinkedIn publishing API
      analytics.py       # Post analytics API
      ai.py              # AI caption generation API
    services/
      linkedin.py        # LinkedIn API v2 client
      scheduler.py       # APScheduler background job
  frontend/
    src/
      App.jsx            # Routes and providers
      components/
        Layout.jsx       # App shell with sidebar
        TipTapEditor.jsx # Rich text editor
        Toast.jsx        # Toast notifications
      context/
        AuthContext.jsx   # Auth state management
      pages/
        Dashboard.jsx    # Post list with status filtering
        Compose.jsx      # Post composer
        Calendar.jsx     # Calendar view
        MediaLibrary.jsx # Image grid
        Analytics.jsx    # Analytics dashboard
        Login.jsx        # Login page
        AuthCallback.jsx # OAuth callback handler
```
