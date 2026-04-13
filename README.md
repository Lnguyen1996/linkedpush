# LinkedPush — Self-Hosted LinkedIn Post Scheduler

A self-hosted LinkedIn post scheduling tool with rich text editing, image uploads, calendar view, timezone-aware auto-publishing, post analytics, and AI-assisted caption writing.

## Tech Stack

- **Frontend:** React 19 + Vite 8 + Tailwind CSS 4
- **Backend:** ASP.NET Core (.NET 10) + PostgreSQL (EF Core)
- **Editor:** TipTap v3 (ProseMirror-based)
- **Scheduling:** BackgroundService (in-process, 60s polling)
- **AI:** Claude API (direct HTTP) for caption generation
- **Auth:** LinkedIn OAuth2 with HMAC-SHA256 session cookies

## Quick Start

### Prerequisites

- .NET 10 SDK
- Node.js 18+
- PostgreSQL running locally

### 1. Database Setup

```bash
createdb linkedpush_dev
```

### 2. Backend Setup

```bash
cd backend
dotnet run
```

The backend starts on **http://localhost:8000** (configured in `appsettings.json`).

In dev mode (default `DevMode: true`), no LinkedIn credentials are needed — clicking "Sign in with LinkedIn" auto-creates a dev user.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Open the App

Visit **http://localhost:5173**

## Configuration

Edit `backend/appsettings.json`:

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `ConnectionStrings:DefaultConnection` | Yes | `Host=localhost;...` | PostgreSQL connection string |
| `SecretKey` | Yes (prod) | `dev-secret-key-...` | HMAC session signing key |
| `LinkedIn:ClientId` | For prod | `""` | LinkedIn OAuth app ID |
| `LinkedIn:ClientSecret` | For prod | `""` | LinkedIn OAuth app secret |
| `LinkedIn:RedirectUri` | No | `http://localhost:8000/api/auth/callback` | OAuth redirect URI |
| `AnthropicApiKey` | For AI | `""` | Claude API key for captions |
| `DevMode` | No | `true` | Enable dev login bypass |
| `Kestrel:Endpoints:Http:Url` | No | `http://localhost:8000` | Server listen URL |

## Features

| Feature | Description |
|---------|-------------|
| **Post Composer** | TipTap rich text editor with bold, italic, lists, links. Live character counter (3000 limit). |
| **First Comment** | Auto-post a comment immediately after your main post. |
| **Image Upload** | Attach images (JPEG/PNG/GIF, max 5MB) from upload or media library. |
| **Media Library** | Grid view of all uploaded images with metadata and preview. |
| **Calendar View** | Month/week calendar showing posts color-coded by status. |
| **Scheduling** | Timezone-aware scheduling with BackgroundService auto-publishing every 60s. |
| **LinkedIn Publishing** | LinkedIn API v2 integration for text and image posts. |
| **Analytics** | Summary cards + sortable table with impressions, likes, comments, shares. |
| **AI Assist** | Claude-powered caption generator with professional/casual/storytelling tones. |
| **Responsive** | Full mobile support with collapsible sidebar. |

## Project Structure

```
linkedpush/
  backend/
    Program.cs                # App startup: DI, middleware, CORS, static files
    appsettings.json          # Configuration
    Controllers/
      AuthController.cs       # LinkedIn OAuth2 + session management
      PostsController.cs      # Post CRUD + publish-now
      MediaController.cs      # Image upload/library
      AnalyticsController.cs  # Post analytics
      AiController.cs         # AI caption generation
    Data/
      AppDbContext.cs          # EF Core DbContext
    Models/                   # EF Core entities
    DTOs/                     # Request/response DTOs
    Services/
      SessionService.cs       # HMAC-SHA256 session tokens
      LinkedInService.cs      # LinkedIn API v2 client
      SchedulerService.cs     # BackgroundService scheduler
  frontend/
    src/
      App.jsx                 # Routes and providers
      components/
        Layout.jsx            # App shell with sidebar
        TipTapEditor.jsx      # Rich text editor
        Toast.jsx             # Toast notifications
      context/
        AuthContext.jsx        # Auth state management
      pages/
        Dashboard.jsx         # Post list with status filtering
        Compose.jsx           # Post composer
        Calendar.jsx          # Calendar view
        MediaLibrary.jsx      # Image grid
        Analytics.jsx         # Analytics dashboard
        Login.jsx             # Login page
        AuthCallback.jsx      # OAuth callback handler
```
