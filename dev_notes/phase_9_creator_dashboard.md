# Phase 9: Creator Dashboard & Portfolio Management

## Overview
Phase 9 transitions the BlockCanvas platform from just a project editor into a fully fledged Creator Portfolio Management system, heavily inspired by the UX of Behance.

## Key Features Implemented

### 1. Dedicated Settings Page (`/creator/[creator_name]/settings`)
- Replaced the previous modal-based profile editor with a full-page Settings Dashboard.
- **Form Data Managed:**
  - Basic Info: Display Name, Headline, About Text, Contact Email.
  - SNS Links: Discord, YouTube, Twitter (X), Instagram, Patreon.
- **SNS Visibility Toggles:**
  - Integrated a `sns_settings` JSONB column in the `portfolios` table.
  - Creators can individually toggle the visibility of each SNS link without deleting the URL data.
  - HTML5 `type="url"` validation was relaxed to `type="text"` to prevent silent form submission blocks when creators paste incomplete URLs.

### 2. Direct Portfolio Editing (Behance-style UX)
- **Banner Customization:**
  - `banner_url` column added to `portfolios` table.
  - A floating `BannerUploadButton` is dynamically rendered on the Hero Header when hovered.
  - Positioned outside the z-0 image layer with `z-40` to guarantee clickability, preventing the central content `div` from swallowing pointer events.
- **Avatar Customization:**
  - Interactive `AvatarUploadButton` embedded directly into the central circular profile picture slot.
  - Hovering over the avatar reveals a "사진 변경" (Change Photo) overlay.
  - Instantly updates `avatar_url` in the `profiles` table and refreshes the UI.

### 3. Server Actions & File Upload Architecture
- Reused the `uploadFileAction` (Next.js 16 Server Action) built during Phase 8 to bypass traditional API route buffer constraints.
- Created `updateBannerAction` and `updateAvatarAction` that directly target `portfolios` and `profiles` tables respectively.
- **Critical Fix (Upsert Logic):** `updateBannerAction` uses an `upsert` query instead of a standard `update` query. This ensures that if a creator has never manually saved their settings (resulting in no existing row in the `portfolios` table), the banner upload process will seamlessly initialize their portfolio record instead of failing silently.

## UI / Layout Tweaks
- **Hero Header:** Reduced height to a fixed `h-[320px] md:h-[400px]` to constrain the banner area.
- **Z-Index Layering:**
  - `z-0`: Banner Background Container
  - `z-10`: Gradient Overlay
  - `z-20`: Central Text Content (Avatar, Display Name, Headline, SNS links)
  - `z-40`: Banner Upload Button (Positioned over everything to guarantee interaction).
- **SNS Badges:** Rendered as beautifully styled, rounded buttons with distinct gradient/color branding for each platform (e.g., Red for YouTube, Black for X, Gradient for Instagram) directly beneath the creator's contact info.

## Database Migrations Applied
```sql
ALTER TABLE public.portfolios
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS patreon_url TEXT,
ADD COLUMN IF NOT EXISTS sns_settings JSONB DEFAULT '{}'::jsonb;
```

## Next Steps
- Implement Authentication / Authorization. Currently, edit buttons are visible to anyone viewing the portfolio. We must wrap these in ownership checks.
- Build Project Editing capabilities (loading existing project blocks back into the Tiptap editor).
