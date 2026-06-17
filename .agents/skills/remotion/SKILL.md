---
name: remotion
description: Work with the Startline Remotion product demo video. Use when the user wants to preview, edit, or render the video, or mentions "remotion", "the video", or "product demo".
---

# Remotion — Startline Product Demo

The video project lives in `video/` at the repo root. It is a self-contained npm project with its own `node_modules` and `package.json` — always run commands from inside `video/`.

## Quick start

```bash
cd video
npm run dev       # opens Remotion Studio at http://localhost:3001
npm run render    # renders full video → video/out/startline-demo.mp4 (H.264, 1080p)
npm run still     # renders a single frame (frame 30) as JPEG
```

## Composition

- **ID:** `StartlineDemo`
- **Resolution:** 1920 × 1080
- **FPS:** 30
- **Total duration:** ~28 s (calculated dynamically from scene durations)
- **Output format:** JPEG frames, H.264 MP4

## Scene structure

Scenes are defined in `video/src/Video.tsx` and rendered in sequence with an 18-frame (0.6 s) overlap for motion-cut transitions.

| Scene | File | Duration |
|---|---|---|
| Intro | `scenes/Intro.tsx` | 120 frames / 4.0 s |
| Stats | `scenes/Stats.tsx` | 105 frames / 3.5 s |
| Dashboard | `scenes/Dashboard.tsx` | 135 frames / 4.5 s |
| New Listing | `scenes/NewListing.tsx` | 135 frames / 4.5 s |
| Review | `scenes/Review.tsx` | 135 frames / 4.5 s |
| Go Live | `scenes/GoLive.tsx` | 135 frames / 4.5 s |
| CTA | `scenes/CTA.tsx` | 105 frames / 3.5 s |

To add a scene: create the component in `scenes/`, import it in `Video.tsx`, and add it to the `SCENES` array with a `duration`.

## Shared utilities

- `lib/colors.ts` — brand colour tokens (matches the main app's Tailwind theme)
- `lib/fonts.ts` — loads Chakra Petch + Inter; import this in `Root.tsx` as a side effect before rendering
- `lib/transition.ts` — easing helpers for cross-scene motion

## Conventions

- All animation values derive from `useCurrentFrame()` and `interpolate()` — no CSS transitions.
- Frame arithmetic uses the exported `OVERLAP`, `SCENE_STARTS`, and `TOTAL_FRAMES` constants from `Video.tsx`; never hardcode frame offsets.
- Brand primary colour is `#B3E153`. Dark background is `#0A0A0A`.
