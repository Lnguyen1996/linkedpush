---
name: linkedpush
description: CLI for scheduling and publishing LinkedIn posts via the LinkedPush API
allowed-tools: Bash(linkedpush:*)
---

| Property | Value |
|----------|-------|
| **name** | linkedpush |
| **description** | LinkedIn post scheduler CLI |
| **allowed-tools** | Bash(linkedpush:*) |

## Setup

```bash
export LINKEDPUSH_URL=http://localhost:8000    # Backend URL (default)
export LINKEDPUSH_SESSION=<session_cookie>     # Session token from auth:login
```

## Core Workflow

```bash
# 1. Authenticate
linkedpush auth login                          # Get session token (dev mode)
export LINKEDPUSH_SESSION=<token>

# 2. Create a post
linkedpush posts create -c "Your LinkedIn post content"

# 3. Publish immediately
linkedpush posts create -c "Content" --publish

# 4. Or schedule for later
linkedpush posts create -c "Content" -s "2026-04-15T09:00:00Z"

# 5. Check analytics
linkedpush analytics summary
```

## Commands

### auth
```bash
linkedpush auth login                         # Dev-mode login, prints session token
linkedpush auth me                            # Show current user info
```

### posts
```bash
linkedpush posts list [--status X]            # List posts (draft|scheduled|published|failed)
linkedpush posts get <id>                     # Get single post details
linkedpush posts create -c "content"          # Create draft post
linkedpush posts create -c "content" --publish  # Create and publish immediately
linkedpush posts create -c "content" -s "2026-04-15T09:00:00Z"  # Schedule post
linkedpush posts create -c "content" -t "Title" -i 3  # With title and image ID
linkedpush posts publish <id>                 # Publish existing post to LinkedIn
linkedpush posts delete <id>                  # Delete a post
```

### media
```bash
linkedpush media list                         # List uploaded media
linkedpush media upload <file>                # Upload image (returns ID for posts)
linkedpush media delete <id>                  # Delete media item
```

### ai
```bash
linkedpush ai caption --topic "C# tips"       # Generate AI caption
linkedpush ai caption --topic "React" --tone casual  # With tone (professional|casual|technical)
```

### analytics
```bash
linkedpush analytics summary                  # Get analytics for all published posts
linkedpush analytics refresh                  # Re-fetch analytics from LinkedIn
```

## Common Patterns

### Create and publish with image
```bash
# Upload image first
MEDIA=$(linkedpush media upload screenshot.png)
IMAGE_ID=$(echo "$MEDIA" | jq -r '.id')

# Create post with image and publish
linkedpush posts create -c "Check out this feature!" -i "$IMAGE_ID" --publish
```

### AI-assisted post creation
```bash
# Generate caption
CAPTION=$(linkedpush ai caption --topic "5 .NET 10 patterns" --tone professional | jq -r '.caption')

# Create post with generated caption
linkedpush posts create -c "$CAPTION" --publish
```

### Schedule a batch
```bash
DATES=("2026-04-14T09:00:00Z" "2026-04-15T09:00:00Z" "2026-04-16T09:00:00Z")
TOPICS=("C# tips" "React patterns" ".NET performance")

for i in "${!DATES[@]}"; do
  CAPTION=$(linkedpush ai caption --topic "${TOPICS[$i]}" | jq -r '.caption')
  linkedpush posts create -c "$CAPTION" -s "${DATES[$i]}"
  echo "Scheduled: ${TOPICS[$i]} for ${DATES[$i]}"
done
```

## Quick Reference

```bash
linkedpush auth login                          # Login
linkedpush auth me                             # Current user
linkedpush posts list                          # List all posts
linkedpush posts create -c "text" --publish    # Create + publish
linkedpush posts create -c "text" -s "date"    # Schedule
linkedpush posts publish <id>                  # Publish existing
linkedpush posts delete <id>                   # Delete
linkedpush media upload <file>                 # Upload image
linkedpush media list                          # List media
linkedpush ai caption --topic "topic"          # AI caption
linkedpush analytics summary                   # Analytics
linkedpush analytics refresh                   # Refresh analytics
```
