# Video & Document Carousel Uploads — Design

**Date**: 2026-04-14
**Status**: Approved

## Overview

Add video uploads and PDF/PowerPoint carousel post support to LinkedPush. Extends the existing image-only media system to support three media types with type-specific storage, validation, and LinkedIn API publishing.

## Decisions

| Decision | Choice |
|----------|--------|
| Video storage | Filesystem (`/data/uploads/videos/`) |
| Image storage | bytea in PostgreSQL (no change) |
| Document storage | Filesystem (`/data/uploads/documents/`) |
| PPTX support | Yes — auto-convert to PDF via LibreOffice headless |
| Multi-image | Up to 9 per post |
| Video limit | 200MB, 15 min duration |
| Document limit | 100MB |
| Image limit | 5MB (no change) |
| Type mixing | Not allowed per post (matches LinkedIn API) |
| Post-media model | Junction table `post_media` with position ordering |
| Video duration check | ffprobe (from ffmpeg) |
| LinkedIn video flow | Async — register, upload, poll until ALLOWED |
| VPS dependencies | ffmpeg, libreoffice-core |

## 1. Media Storage Model

### media table (expanded columns)

```
+ media_type: text ('image' | 'video' | 'document')  -- NEW
+ duration: int? (seconds, video only)                -- NEW
  file_path: text (used for video/document on disk)   -- EXISTS but currently unused
  data: bytea (stays for images, NULL for video/document)
```

### post_media table (NEW junction table)

```
- post_id: int FK → posts
- media_id: int FK → media
- position: int (ordering for multi-image)
- PK: (post_id, media_id)
```

### Storage rules

- **Images** (≤ 5MB): bytea in PostgreSQL (no change)
- **Videos** (≤ 200MB): filesystem at `/data/uploads/videos/{guid}.mp4`
- **Documents** (≤ 100MB): filesystem at `/data/uploads/documents/{guid}.pdf`
- PPTX uploaded → converted to PDF via LibreOffice → stored as PDF

### Post attachment rules

- Up to 9 images per post
- OR 1 video per post
- OR 1 document per post
- No mixing types
- Existing `image_id` FK stays for backward compatibility

## 2. Backend API Changes

### New/modified endpoints

| Method | Endpoint | Change |
|--------|----------|--------|
| POST | `/api/media` | Accept video (mp4, webm, mov) and document (pdf, pptx). Return `media_type` in response. |
| GET | `/api/media/{id}/file` | Serve from filesystem for video/document, bytea for images |
| POST | `/api/posts` | Accept `media_ids: [int]` array instead of single `image_id`. Validate type-mixing rules. |
| PUT | `/api/posts/{id}` | Same — accept `media_ids` array |
| GET | `/api/posts/{id}` | Return `media` array with type, url, position |

### Upload validation

| Type | MIME types | Max size | Extra validation |
|------|-----------|----------|-----------------|
| Image | jpeg, png, gif | 5MB | Width/height via ImageSharp |
| Video | mp4, webm, quicktime | 200MB | Duration ≤ 15 min via ffprobe |
| Document | pdf, pptx | 100MB | PPTX auto-converted to PDF |

### PPTX conversion flow

1. Upload PPTX → save to temp file
2. Run `libreoffice --headless --convert-to pdf`
3. Store resulting PDF on filesystem
4. Store original filename but set `mime_type` to `application/pdf`

## 3. LinkedIn API Publishing

### Image posts (existing + multi-image)

- Current flow loops for multiple images
- Recipe: `urn:li:digitalmediaRecipe:feedshare-image`
- `shareMediaCategory: "IMAGE"`
- Upload each image → collect asset URNs → include all in `media` array

### Video posts (new)

- Recipe: `urn:li:digitalmediaRecipe:feedshare-video`
- `shareMediaCategory: "VIDEO"`
- Register upload → PUT binary → poll for processing status
- Poll `GET /v2/assets/{asset}` until `status.status` = `ALLOWED`
- Timeout after 5 minutes of polling

### Document/carousel posts (new)

- `shareMediaCategory: "NATIVE_DOCUMENT"`
- Recipe: `urn:li:digitalmediaRecipe:feedshare-document`
- Upload PDF binary → get asset URN → publish with document category
- LinkedIn renders each PDF page as a carousel slide

### SchedulerService update

- Check `post_media` → determine media type → call appropriate publish method
- Video posts: scheduler handles async polling with retry loop

## 4. Frontend Changes

### Compose page

- Media attachment bar with buttons: Image, Video, Document
- **Image mode**: multi-select up to 9, thumbnail strip with drag-to-reorder
- **Video mode**: single file, thumbnail + duration preview, upload progress bar
- **Document mode**: PDF or PPTX, page count display, "(converting...)" for PPTX
- Switching type clears previous attachments
- Upload progress bar for large files

### Media Library page

- Filter tabs: All | Images | Videos | Documents
- Video thumbnails: play icon overlay + duration badge
- Document thumbnails: PDF icon + page count
- Preview modal: video player for video, PDF embed for documents

### LinkedIn Preview (Compose sidebar)

- Image: thumbnail grid (1-9 images)
- Video: thumbnail with play button overlay
- Document: "Carousel - X pages" indicator

### Dashboard post list

- Media type icon next to post title (image/video/document)

## 5. VPS Dependencies

```bash
apt-get install -y ffmpeg libreoffice-core
mkdir -p /opt/linkedpush/data/uploads/videos
mkdir -p /opt/linkedpush/data/uploads/documents
chown -R www-data:www-data /opt/linkedpush/data
```

## 6. Breaking Changes

None. Existing image-only posts continue working. `image_id` stays populated for old posts. New posts use `media_ids` array but API falls back to `image_id` if `media_ids` is absent.
