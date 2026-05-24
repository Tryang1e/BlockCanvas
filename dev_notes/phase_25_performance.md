# Phase 25: Performance Optimizations & Background Fixes

## UI/UX Changes
- Fixed background color bleed (removed `bg-white/95` and `backdrop-blur` from `content-wrapper`) to ensure a pure white background across the site, preventing any red tint from `theme_bg_color`.
- Removed light/dark mode toggles and scripts entirely to enforce a consistent light mode.

## Performance Improvements
- Applied `React.memo` to `ProjectCard` and `SectionContainer` components to heavily reduce React rendering overhead.
- This resolves sluggish rendering performance during drag-and-drop operations, as React will now skip rendering these heavy components when only their dragged coordinates change.
