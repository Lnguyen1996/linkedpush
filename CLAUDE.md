# LinkedPush — Self-Hosted LinkedIn Post Scheduler

## Project Overview

LinkedPush is a self-hosted LinkedIn post scheduling tool with rich text editing, image uploads, calendar view, timezone-aware auto-publishing, post analytics, and AI-assisted caption writing via Claude API. Built for solo operators and small teams who want full control without SaaS subscriptions.

**Status:** All 11 features complete. Backend is ASP.NET Core (.NET 10) in `backend/`.

## Tech Stack

### Frontend (port 5173 dev / port 3000 Docker)
- **React 19** + **Vite 8** + **Tailwind CSS 4** (v4 uses `@theme` directive, not `tailwind.config.js`)
- **React Router v7** (file: `App.jsx`) — routes nested under `<Layout />`
- **TipTap v3** (ProseMirror-based) rich text editor with character counting, links, placeholders
- **Lucide React** icons throughout the UI
- **shadcn/ui** components (Card, Button, Badge, Separator, Skeleton, Table)
- No TypeScript — pure JSX
- No test framework configured yet

### Backend — .NET (port 8000)
- **ASP.NET Core** (.NET 10) minimal hosting via `Program.cs`
- **Entity Framework Core** with **PostgreSQL** (Npgsql) — `AppDbContext` in `Data/`
- **BackgroundService** (`SchedulerService`) — polls every 60s for due posts via `Task.Delay`
- **IHttpClientFactory** for all external HTTP calls (LinkedIn API, Claude API)
- **SixLabors.ImageSharp** for image dimension extraction on upload
- **System.Text.Json** with `SnakeCaseLower` naming policy (matches frontend expectations)
- **SessionService** (singleton) for HMAC-SHA256 session token creation/verification
- **LinkedInService** (scoped) for LinkedIn API operations + token refresh
- **CancellationToken** propagated through all async methods for clean shutdown
- No Anthropic SDK — direct HTTP to `api.anthropic.com/v1/messages` with `x-api-key` header

## Architecture

```
Frontend (Vite :5173)  -->  Vite proxy /api/*  -->  ASP.NET Core (:8000)
                                                        |
                                                PostgreSQL (linkedpush_dev)
                                                  - Posts, Users, Comments, Analytics
                                                  - Media (images stored as bytea)
                                                SchedulerService (BackgroundService)
                                                        |
                                                LinkedIn API v2
                                                Claude API (direct HTTP)
```

**Docker deployment:**
```
Frontend (nginx :3000)  -->  Backend (:8000)  -->  PostgreSQL (:5432)
```

## Running Locally (Development)

```bash
# Prerequisites: .NET 10 SDK, PostgreSQL, Node.js 18+

# Create database (first time only)
createdb linkedpush_dev

# Backend
cd backend && dotnet run

# Frontend (separate terminal)
cd frontend && npm run dev
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- Health check: http://localhost:8000/api/health

**Dev mode (default):** `"DevMode": "true"` in `appsettings.json` — click "Sign in with LinkedIn" to auto-create a dev user. No real LinkedIn credentials needed. AI captions return templates instead of calling Claude API.

**Direct dev login:** Navigate to `http://localhost:8000/api/auth/dev-login` to bypass OAuth entirely.

## Docker Deployment

```bash
# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f backend

# Stop
docker compose down

# Full reset (drops database volume)
docker compose down -v
```

**Docker ports:**
- Frontend (nginx): http://localhost:3000
- Backend: http://localhost:8000
- PostgreSQL: localhost:5432

**Docker environment (set in docker-compose.yml):**
- `DevMode: "false"` — requires real LinkedIn OAuth credentials
- `LinkedIn__RedirectUri: "http://localhost:3000/api/auth/callback"` — nginx proxies to backend
- Connection string points to the `db` service container

**Production deployment:** Set these environment variables on the backend container:
- `LinkedIn__ClientId` and `LinkedIn__ClientSecret` — from LinkedIn Developer Portal
- `SecretKey` — strong random string for session signing
- `AnthropicApiKey` — for AI caption generation
- `FrontendUrl` — your domain (for CORS)

## Project Structure

```
linkedpush/
  backend/               # ASP.NET Core API
    Program.cs                  # App startup: DI, middleware, CORS, health check
    LinkedPushApi.csproj        # .NET 10, Npgsql.EFCore, SixLabors.ImageSharp
    Dockerfile                  # Multi-stage build (sdk -> aspnet runtime)
    appsettings.json            # Config: connection string, LinkedIn creds, secrets
    Controllers/
      AuthController.cs         # LinkedIn OAuth2, dev-login, session cookies
      PostsController.cs        # Full CRUD + publish-now
      MediaController.cs        # Image upload (to bytea) + serve + library
      AnalyticsController.cs    # Analytics fetch + refresh from LinkedIn
      AiController.cs           # AI caption generation via Claude API
    Data/
      AppDbContext.cs            # EF Core DbContext — Users, Posts, Comments, Media, Analytics
    Models/
      User.cs                   # LinkedIn profile + tokens
      Post.cs                   # Content + scheduling + status + LinkedIn IDs
      Comment.cs                # First-comment for posts
      Media.cs                  # Image binary (bytea) + metadata
      Analytics.cs              # Post engagement metrics
    DTOs/
      PostDtos.cs               # PostCreateDto, PostUpdateDto, PostResponseDto, PostListDto
      MediaDtos.cs              # MediaResponseDto (includes Url field)
      AiDtos.cs                 # GenerateRequest, GenerateResponse
      AnalyticsDtos.cs          # AnalyticsSummaryDto, AnalyticsPostDto, AnalyticsResponseDto
    Services/
      SessionService.cs         # HMAC-SHA256 session tokens (singleton)
      LinkedInService.cs        # LinkedIn API client: publish, images, comments, analytics
      SchedulerService.cs       # BackgroundService: polls every 60s for due posts
  frontend/
    Dockerfile                  # Multi-stage build (node -> nginx)
    nginx.conf                  # Reverse proxy /api/* to backend
    src/
      App.jsx                   # BrowserRouter, AuthProvider, ThemeProvider, Routes
      main.jsx                  # ReactDOM.createRoot entry
      index.css                 # Tailwind + custom animations
      components/
        Layout.jsx              # App shell: icon sidebar, topbar, Outlet
        AppLogo.jsx             # SVG BrandMark (purple gradient + arrow), all logo variants
        TipTapEditor.jsx        # TipTap with toolbar, char count, placeholder
        Toast.jsx               # Toast notification system
      context/
        AuthContext.jsx          # Auth state: user, login, logout
        ThemeContext.jsx         # Theme management
      pages/
        Landing.jsx             # Public landing page
        Login.jsx               # Dark login card with LinkedIn OAuth
        AuthCallback.jsx        # OAuth redirect handler
        Dashboard.jsx           # Post list + weekly calendar with post popups
        Compose.jsx             # TipTap editor, first comment, schedule, image attach, AI
        PostReview.jsx          # Read-only post preview with status, metadata, publish action
        MediaLibrary.jsx        # Drag-drop upload, thumbnail grid, preview modal
        Analytics.jsx           # Summary cards, engagement bar chart, sortable table
  docker-compose.yml            # PostgreSQL + backend + frontend (nginx)
  docs/plans/                   # Design and implementation plans
```

## Key Patterns and Conventions

### Backend (.NET)
- **All routes prefixed with `/api/`** — e.g., `/api/posts`, `/api/auth/login`
- **JSON snake_case:** `JsonNamingPolicy.SnakeCaseLower` in `Program.cs` — C# PascalCase properties serialize as snake_case
- **Auth via HMAC-SHA256 session cookies** — `SessionService.CreateSessionToken()` / `VerifySessionToken()` using URL-safe Base64
- **Auth enforcement:** `RequireCurrentUser()` throws `UnauthorizedAccessException`, caught by middleware returning 401 JSON
- **DI registration:** `SessionService` = singleton, `LinkedInService` = scoped, `SchedulerService` = hosted service, `AppDbContext` = scoped
- **Post statuses:** `draft` -> `scheduled` -> `publishing` -> `published` or `failed`
- **Token refresh:** `LinkedInService.GetValidAccessToken()` checks expiry with 5-min buffer, returns null if refresh fails (caller handles)
- **CancellationToken:** All async methods accept `CancellationToken ct = default` and propagate to HTTP calls and DB operations
- **Image storage:** Images stored as `bytea` in PostgreSQL `media` table (no filesystem). Served via `GET /api/media/{id}/file` with CDN cache headers
- **Database creation:** `db.Database.EnsureCreatedAsync()` at startup — no EF migrations. Drop database to reset schema.
- **Scheduler:** `SchedulerService` extends `BackgroundService`, uses `IServiceProvider.CreateScope()` for per-cycle DI

### Frontend
- **All API calls use `credentials: 'include'`** for cookie-based auth
- **No global state management** beyond React Context (`AuthContext`)
- **Vite proxy:** `/api/*` forwarded to `:8000` (.NET backend)
- **Image URLs:** `/api/media/{id}/file` (served from PostgreSQL bytea with CDN cache headers)
- **SVG brand mark:** `AppLogo.jsx` renders inline SVG (purple gradient + white arrow), no raster PNG dependency
- **Toast notifications via context:** `useToast()` hook returns `showToast(message, type)`
- **Auth guard in Layout.jsx:** Redirects to `/login` if no user
- **Route structure:** `/` (Landing), `/login`, `/app` (Dashboard), `/app/compose`, `/app/compose/:id`, `/app/post/:id` (Review), `/app/media`, `/app/analytics`

### Media Storage
- **Images stored in PostgreSQL** as `bytea` column in `media` table — no local filesystem
- **Upload:** `POST /api/media` reads file into memory, extracts dimensions via ImageSharp, stores bytes in DB
- **Serving:** `GET /api/media/{id}/file` returns binary with:
  - `Cache-Control: public, max-age=31536000, immutable`
  - `ETag` header for conditional requests (304 Not Modified)
  - Correct `Content-Type` from stored `mime_type`
- **CDN-ready:** Cloudflare or any reverse proxy will cache responses at the edge
- **LinkedIn publishing:** `LinkedInService.UploadImage()` accepts `byte[]` directly from the DB, uploads to LinkedIn's asset API
- **Constraints:** 5MB max, JPEG/PNG/GIF only

### Database (PostgreSQL)
- **Connection:** `Host=localhost;Port=5432;Database=linkedpush_dev;Username=lamnguyen;Password=`
- **5 tables:** users, posts, comments, media, analytics (snake_case via `[Table]` attributes)
- **All columns** explicitly mapped with `[Column("snake_case")]` attributes
- **Schema creation:** `EnsureCreatedAsync()` at startup — no migrations. Drop the database to reset.
- **To reset:** `dropdb linkedpush_dev && createdb linkedpush_dev`

### Design System
- **Primary:** `#7C3AED` (purple)
- **Dark:** `#6D28D9` (purple-dark)
- **Logo:** Purple gradient rounded square with white "push" arrow (SVG, inline)
- **Favicon:** SVG with optimized stroke weights for small sizes
- **Dark theme** — Discord-inspired dark surfaces (`#0a0a0a`, `#111111`, `#171717`)
- **Font:** Inter + Plus Jakarta Sans (display headings)
- **Style:** Rounded corners, card-based, subtle shadows, purple accent glows

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/health | No | Health check |
| GET | /api/auth/login | No | LinkedIn OAuth URL (or dev-login redirect) |
| GET | /api/auth/callback | No | OAuth callback, creates session |
| GET | /api/auth/dev-login | No | Dev mode auto-login |
| GET | /api/auth/me | Yes | Current user profile |
| POST | /api/auth/logout | Yes | Clear session |
| POST | /api/posts | Yes | Create post |
| GET | /api/posts | Yes | List posts (paginated, filterable) |
| GET | /api/posts/{id} | Yes | Get single post |
| PUT | /api/posts/{id} | Yes | Update post |
| DELETE | /api/posts/{id} | Yes | Delete post |
| POST | /api/posts/{id}/publish | Yes | Publish post immediately |
| POST | /api/media | Yes | Upload image (multipart, stored as bytea) |
| GET | /api/media | Yes | List media metadata |
| GET | /api/media/{id} | Yes | Get single media metadata |
| GET | /api/media/{id}/file | No | Serve image binary (CDN-cacheable) |
| DELETE | /api/media/{id} | Yes | Delete media item |
| GET | /api/analytics | Yes | Analytics for all published posts |
| POST | /api/analytics/refresh | Yes | Re-fetch analytics from LinkedIn |
| POST | /api/ai/generate | Yes | Generate AI caption |

## Configuration (appsettings.json)

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| ConnectionStrings:DefaultConnection | Yes | `Host=localhost;...` | PostgreSQL connection string |
| SecretKey | Yes (prod) | `dev-secret-key-...` | HMAC session signing key |
| LinkedIn:ClientId | For prod | `""` | LinkedIn OAuth app ID |
| LinkedIn:ClientSecret | For prod | `""` | LinkedIn OAuth app secret |
| LinkedIn:RedirectUri | No | `http://localhost:8000/api/auth/callback` | OAuth redirect URI |
| AnthropicApiKey | For AI | `""` | Claude API key for captions |
| DevMode | No | `true` | Enable dev login bypass |
| Kestrel:Endpoints:Http:Url | No | `http://localhost:8000` | Server listen URL |

## Important Notes

- **Never commit** `appsettings.json` secrets, `data/`, `obj/`, `bin/`, or `node_modules/`
- **No EF migrations** — schema created via `EnsureCreatedAsync()`. To reset: `dropdb linkedpush_dev && createdb linkedpush_dev`
- **Kestrel listens on port 8000** — configured in `appsettings.json`, NOT in `launchSettings.json`
- **Vite proxy points to :8000** — `vite.config.js` proxies `/api/*` to the .NET backend
- **OAuth redirect goes to :8000** (local) or through nginx (Docker) — backend handles the redirect
- **Snake_case JSON** — `SnakeCaseLower` naming policy means C# `PropertyName` serializes as `property_name`
- **LinkedIn API uses ugcPosts v2** — requires `w_member_social` scope
- **Session tokens** — HMAC-SHA256 signed, httpOnly cookies, 7-day expiry, constant-time comparison
- **Tailwind CSS v4** — uses `@import "tailwindcss"` and `@theme` blocks, NOT `tailwind.config.js`
- **React 19** — new JSX transform (no `import React` needed)
- **Images in PostgreSQL** — stored as `bytea`, served via `/api/media/{id}/file` with immutable cache headers. No filesystem storage. `pg_dump` backs up everything.
