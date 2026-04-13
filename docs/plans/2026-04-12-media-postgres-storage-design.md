# Media Storage: Migrate from Filesystem to PostgreSQL

**Date:** 2026-04-12
**Status:** Approved
**Goal:** Store uploaded images in PostgreSQL bytea column instead of local filesystem, with Cloudflare CDN caching for performance.

## Motivation

Deploying to a VPS where disk persists, but want:
- Single backup (pg_dump = everything)
- Easy server migration (no file sync)
- CDN-backed image serving via Cloudflare

## Design

### Database

Add `data bytea NOT NULL` column to existing `media` table. Make `file_path` nullable (deprecated). All other columns stay.

### Upload (POST /api/media)

- Read IFormFile into byte array in memory
- Extract dimensions via ImageSharp from the memory stream
- Store bytes in `data` column
- No filesystem writes

### Serving (GET /api/media/{id}/file)

New endpoint that:
- Reads `data` bytea from the media row
- Returns binary with correct `Content-Type` from `mime_type` column
- Cache headers: `Cache-Control: public, max-age=31536000, immutable`
- ETag based on media ID + filename
- Supports `If-None-Match` (304 Not Modified)

Cloudflare proxy caches these responses at the edge.

### LinkedIn Publishing

Change `UploadImage` and `PublishImagePost` to accept `byte[] imageData` instead of `string imagePath`. The `PublishPost` method loads the image bytes from the eager-loaded Media entity.

### Frontend

- Image URLs change from `/uploads/{filename}` to `/api/media/{id}/file`
- No component changes needed (all use `post.image_url` from DTO)
- Remove `/uploads` proxy from vite.config.js

### Cleanup

- Remove `UseStaticFiles` block for `/uploads` from Program.cs
- Remove `Directory.CreateDirectory("data/uploads")` from Program.cs
- Remove `/uploads` proxy from vite.config.js

### Migration

Backfill existing images: read files from `data/uploads/`, write bytes into `data` column, then delete the files.

## Constraints

- 5MB max file size (unchanged)
- JPEG, PNG, GIF only (unchanged)
- Single VPS deployment
