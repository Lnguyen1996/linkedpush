# Notifications Feature Design

## Context

The app has a functional but limited notification system today:
- `GET /api/notifications` computes a live feed from `Posts` + `SocialConnections` tables (no storage)
- `useNotifications.js` polls every 60s; dismiss is localStorage-only
- `NotificationBell.jsx` shows a bell with unread badge and popover list
- Settings tab for Notifications is a stub (`available: false`) with no panel

**Goal**: Full notifications system — in-app + email, persistent, real-time, with user preferences.

---

## Notification Types

| Kind | Trigger | Severity | In-App | Email |
|------|---------|----------|--------|-------|
| `post_published` | Post status → published | info | Yes | Yes (opt) |
| `post_failed` | Post status → failed | error | Yes | Yes (urgent) |
| `post_scheduled` | Post status → scheduled | info | Yes | No |
| `linkedin_token_expiring` | `TokenExpiresAt` within 7 days | warning | Yes | No |
| `linkedin_token_expired` | Token past expiry | error | Yes | No |
| `ai_compose_complete` | AI draft generation done | info | Yes | No |
| `weekly_digest` | Every 7 days (configurable) | info | Yes | Yes (weekly) |

---

## Architecture

### Storage Layer

New `Notification` model and `UserNotificationPreference` model.

**Notification table** — stores individual notification records:
- `id` (GUID), `user_id` FK, `kind` (string), `title`, `body` (nullable), `post_id` FK nullable, `severity` (info/warning/error), `read_at` (nullable timestamp), `created_at`
- Indexes: `(user_id, created_at DESC)`, `(user_id, read_at)` for unread queries

**UserNotificationPreference table** — per-user settings:
- `user_id` FK (PK), `email_enabled` (bool), `weekly_digest_email_day` (enum: monday-sunday), `post_published_email` (bool), `post_failed_email` (bool), `digest_time_of_day` (HH:MM string)
- Defaults: email off, weekly digest on Monday 9am

### Backend Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET /api/notifications` | List (live, not stored) — existing, keeps for real-time |
| `GET /api/notifications/stored` | Paginated stored notifications (new, replaces live for history) |
| `POST /api/notifications` | Mark notification as read (new) |
| `POST /api/notifications/read-all` | Mark all as read (new) |
| `GET /api/notifications/preferences` | Get user preferences (new) |
| `PUT /api/notifications/preferences` | Update preferences (new) |
| `POST /api/notifications/trigger/{kind}` | Internally triggered when events fire (internal) |

SignalR hub at `/hubs/notifications` for real-time push to connected clients.

### Email System

- Provider: configured via `SMTP_*` env vars (or pluggable via `IEmailSender` interface)
- Templates: inline Razor/templated strings for each notification kind
- Queue: notifications that need email go through a background `EmailNotificationService` (HostedService) that dequeues and sends
- Digest: `WeeklyDigestService` (HostedService) runs weekly, queries users with `email_enabled=true`, batches into single email

### Frontend Pages

1. **Notification Bell** (existing, upgraded)
   - Connects to SignalR hub on mount
   - On new notification, shows toast + updates badge count
   - "Mark all read" button

2. **Notifications page** (`/app/notifications`)
   - Full page with grouped notification history (Today, Yesterday, Earlier)
   - Filter tabs: All / Unread / Posts / System
   - Each notification links to relevant page

3. **Settings → Notifications panel** (new)
   - Toggle email notifications on/off
   - Per-event toggles (post published, post failed, weekly digest)
   - Weekly digest day and time picker
   - "Test notification" button

---

## Real-time Implementation

SignalR hub with two methods:
- `JoinUserGroup(userId)` — subscribes client to user-specific group
- `SendToUser(userId, notification)` — called by `INotificationService` when events fire

Client (`useNotifications` upgrade):
- Initialize SignalR connection on `AuthProvider` mount
- Subscribe to `NotificationReceived` hub event → prepend to list + increment badge
- Fallback to polling every 60s if SignalR disconnects

---

## Data Flow

```
PostStatus changes / TokenRefresh / AICompose
        ↓
INotificationService.Publish(kind, userId, ...)
        ↓
┌───────────────────────────────┐
│ Save Notification to DB       │  ← Persistence
│ Publish SignalR to user group  │  ← Real-time
│ Enqueue to email queue        │  ← Email (if enabled)
└───────────────────────────────┘
```

---

## Migration

1. Add `Notifications` table, `UserNotificationPreferences` table
2. Seed existing users with default preferences
3. Switch `GET /api/notifications` to use stored records (backfill existing events as notifications)
4. Add SignalR hub to Program.cs
5. Add email sender service and SMTP config

---

## Estimated Scope

| Layer | Work |
|-------|------|
| DB migration | Small |
| Notification model + service | Medium |
| SignalR hub + client | Medium |
| Email sender + templates | Medium |
| Notifications page (frontend) | Medium |
| Settings notifications panel | Small |
| Background services (email queue, digest) | Medium |

**Total**: ~3-4 agent-iterations to build fully.