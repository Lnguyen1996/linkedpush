# Postiz — Self-Hosted LinkedIn Post Scheduler

## Overview
Postiz is a self-hosted LinkedIn post scheduler that lets professionals compose, schedule, and auto-publish LinkedIn posts with timezone awareness. It includes an image library, first-comment support, post analytics, and AI-assisted caption writing via the Claude API. Designed for solo operators and small teams who want full control over their LinkedIn publishing workflow without SaaS subscriptions.

## Tech Stack
- Frontend: React 18 + Vite + Tailwind CSS 3
- Backend: FastAPI + SQLite (with SQLAlchemy ORM)
- Testing: Vitest (frontend) + pytest (backend)
- Rich Text Editor: TipTap (ProseMirror-based)
- Calendar: FullCalendar React wrapper
- Image handling: Pillow (backend resize/thumbnails)
- Scheduling: APScheduler (in-process cron)
- AI: Anthropic Claude API (claude-sonnet-4-5-20250514)
- Auth: LinkedIn OAuth2 (OpenID Connect)

## Architecture
- SPA frontend served by Vite dev server (port 5173)
- FastAPI REST API backend (port 8000)
- Vite proxies /api/* to FastAPI
- SQLite database at ./data/postiz.db
- Uploaded images stored in ./data/uploads/
- APScheduler runs inside the FastAPI process, polling scheduled posts every 60 seconds
- LinkedIn API v2 for publishing and analytics

## Features

### Feature 1: Project Scaffolding and Base Layout
**Description:** Initialize the monorepo with frontend (React+Vite+Tailwind) and backend (FastAPI+SQLite). Create the app shell with sidebar navigation, top bar, and main content area. Set up Vite proxy to backend.
**Acceptance Criteria:**
- [ ] Running `npm run dev` in /frontend starts Vite on port 5173
- [ ] Running `uvicorn` in /backend starts FastAPI on port 8000
- [ ] GET /api/health returns {"status": "ok"} and is accessible from the frontend via Vite proxy
- [ ] App shell renders with a left sidebar containing navigation links (Dashboard, Compose, Calendar, Media, Analytics)
- [ ] Clicking sidebar links changes the main content area (client-side routing)
- [ ] Layout is responsive — sidebar collapses to hamburger on mobile widths
**Dependencies:** none

### Feature 2: Database Models and API Foundation
**Description:** Create SQLAlchemy models for Users, Posts, Comments (first-comment), Media, and Analytics. Build CRUD API endpoints for posts with pagination, filtering by status (draft/scheduled/published/failed).
**Acceptance Criteria:**
- [ ] POST /api/posts creates a post with title, content, scheduled_at, timezone, status fields and returns 201
- [ ] GET /api/posts returns paginated list with ?page=1&per_page=10&status=draft query params
- [ ] GET /api/posts/{id} returns a single post with all fields
- [ ] PUT /api/posts/{id} updates a post and returns 200
- [ ] DELETE /api/posts/{id} deletes a post and returns 204
- [ ] Database schema includes users, posts, comments, media, analytics tables
**Dependencies:** Feature 1

### Feature 3: LinkedIn OAuth2 Authentication
**Description:** Implement LinkedIn OAuth2 login flow. User clicks "Sign in with LinkedIn", gets redirected to LinkedIn, authorizes the app, and returns with an access token stored server-side. Protected routes require authentication.
**Acceptance Criteria:**
- [ ] Login page shows a "Sign in with LinkedIn" button
- [ ] Clicking the button redirects to LinkedIn OAuth2 authorization URL
- [ ] After authorization, user is redirected back and a session is created
- [ ] User's LinkedIn profile name and avatar are displayed in the top bar
- [ ] Unauthenticated requests to /api/posts return 401
- [ ] A logout button clears the session and redirects to login
**Dependencies:** Feature 1, Feature 2

### Feature 4: Post Composer with Rich Text Editor
**Description:** Build a post composition page with a TipTap rich text editor supporting bold, italic, lists, links, and mentions. Show a live character count (LinkedIn limit: 3000 chars). Include a "first comment" field for auto-posting a comment after the main post.
**Acceptance Criteria:**
- [ ] Compose page has a TipTap editor with toolbar (bold, italic, list, link)
- [ ] Character counter updates live and turns red when approaching 3000 chars
- [ ] A collapsible "First Comment" section shows a second text input
- [ ] "Save as Draft" button saves the post with status "draft"
- [ ] "Schedule" button opens a date/time picker and saves with status "scheduled"
- [ ] Saved posts appear in the post list on the Dashboard
**Dependencies:** Feature 2, Feature 3

### Feature 5: Image Upload and Media Library
**Description:** Allow users to upload images (JPEG, PNG, GIF) for posts. Build a media library page showing all uploads as a grid with thumbnails. Users can attach images to posts from the composer or the library.
**Acceptance Criteria:**
- [ ] Upload button in composer accepts image files (JPEG, PNG, GIF, max 5MB)
- [ ] Uploaded images are stored on disk and a record is created in the media table
- [ ] Media library page shows all uploads as a thumbnail grid
- [ ] Clicking a media item shows a larger preview with metadata (size, date, filename)
- [ ] Users can select images from the media library to attach to a post
- [ ] Attached images show as preview thumbnails in the composer
**Dependencies:** Feature 2, Feature 3

### Feature 6: Calendar View for Scheduled Posts
**Description:** Build a monthly/weekly calendar view showing scheduled posts on their planned publish dates. Posts are color-coded by status (scheduled=blue, published=green, failed=red, draft=gray). Clicking a post opens the composer for editing.
**Acceptance Criteria:**
- [ ] Calendar page renders a monthly calendar grid with current month
- [ ] Scheduled posts appear on their scheduled date cells
- [ ] Posts are color-coded: blue=scheduled, green=published, red=failed, gray=draft
- [ ] Week/Month view toggle works
- [ ] Clicking a post on the calendar navigates to the composer with that post loaded
- [ ] Navigation arrows move between months/weeks
**Dependencies:** Feature 2, Feature 4

### Feature 7: Timezone-Aware Scheduling Engine
**Description:** Implement an APScheduler-based engine that polls for posts due to be published. Scheduling respects the user's timezone. The engine runs inside the FastAPI process and checks every 60 seconds for posts whose scheduled_at has passed.
**Acceptance Criteria:**
- [ ] User can select a timezone from a dropdown when scheduling a post
- [ ] Scheduled times are stored in UTC and displayed in the user's timezone
- [ ] APScheduler job runs every 60 seconds checking for due posts
- [ ] When a post is due, its status changes from "scheduled" to "publishing"
- [ ] If publishing succeeds, status changes to "published" with linkedin_post_id stored
- [ ] If publishing fails, status changes to "failed" with error message stored
**Dependencies:** Feature 4, Feature 8

### Feature 8: LinkedIn API Publishing and First-Comment
**Description:** Integrate with LinkedIn API v2 to publish posts. After the main post is published, if a first-comment exists, auto-post it as a comment on the LinkedIn post. Handle API errors gracefully.
**Acceptance Criteria:**
- [ ] Publishing a post calls LinkedIn API v2 ugcPosts endpoint
- [ ] Text posts are published successfully and the LinkedIn post URN is stored
- [ ] Image posts upload the image to LinkedIn then publish with the image asset
- [ ] If a first-comment is set, it's posted as a comment on the LinkedIn post after publishing
- [ ] API errors (rate limit, auth expired, network) are caught and stored as error messages
- [ ] A "Publish Now" button on the composer immediately publishes without scheduling
**Dependencies:** Feature 3, Feature 2

### Feature 9: Post Analytics Dashboard
**Description:** Fetch post analytics from LinkedIn API (impressions, likes, comments, shares) and display them in a dashboard with summary cards and per-post stats table.
**Acceptance Criteria:**
- [ ] Analytics page shows summary cards: total posts, total impressions, total engagements
- [ ] A table lists all published posts with columns: title, published date, impressions, likes, comments, shares
- [ ] Analytics data is fetched from LinkedIn API and cached in the analytics table
- [ ] A "Refresh" button re-fetches analytics for all published posts
- [ ] Posts with zero engagement show "No data yet" instead of zeros
- [ ] Sorting by any column works (click column header)
**Dependencies:** Feature 8

### Feature 10: AI-Assisted Caption Writing
**Description:** Add an AI writing assistant to the composer powered by Claude API. User can describe their post idea in a prompt, and the AI generates a LinkedIn-optimized caption with hashtags, hooks, and CTA.
**Acceptance Criteria:**
- [ ] Composer has an "AI Assist" button that opens a prompt modal
- [ ] User enters a topic/idea and selects a tone (professional, casual, storytelling)
- [ ] Clicking "Generate" calls the backend /api/ai/generate endpoint
- [ ] Backend calls Claude API with a LinkedIn-optimized system prompt
- [ ] Generated caption is inserted into the editor (user can edit before saving)
- [ ] Loading state shows while the API call is in progress
**Dependencies:** Feature 4

### Feature 11: Final Polish and Responsive Design
**Description:** Add loading states, error boundaries, toast notifications, empty states for all pages. Ensure full responsive design across desktop, tablet, and mobile. Add keyboard shortcuts for common actions.
**Acceptance Criteria:**
- [ ] All API calls show loading spinners while in progress
- [ ] Error states show user-friendly messages with retry buttons
- [ ] Empty states show helpful illustrations/messages (e.g., "No posts yet — create your first!")
- [ ] Toast notifications appear for success/error actions (post saved, published, etc.)
- [ ] All pages are usable on mobile (375px width) without horizontal scrolling
- [ ] Keyboard shortcut Cmd/Ctrl+Enter submits the composer form
**Dependencies:** Feature 4, Feature 5, Feature 6, Feature 9, Feature 10

## Definition of Done

FINISHED when ALL are true:
1. All features in features.json have status: "passed"
2. Final evaluation passes (all pages load, all flows complete, no console errors)
3. Test suite passes (exit 0)
4. Security review finds no blockers
5. App runs with dev server commands, accessible at localhost, no manual setup beyond README.md

## Design Direction
- **Color palette:** Primary #0A66C2 (LinkedIn blue), Secondary #057642 (success green), Accent #E7A33E (warning amber), Background #F3F2EF (LinkedIn light gray), Dark surfaces #1B1F23
- **Typography:** Inter for UI, system monospace for code/technical text
- **Component style:** Rounded corners (8px), card-based layout, subtle shadows, generous whitespace
- **Mood:** LinkedIn-native feel — professional, clean, trustworthy. Think "if LinkedIn built a scheduling tool into their own platform."
- **Dark mode:** Not in v1 scope — light theme only
- **Icons:** Lucide React icon set
