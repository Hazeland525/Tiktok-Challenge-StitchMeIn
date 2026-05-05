# Project: TikTok "Stitch Me In" Prototype

## Context

This is a demo prototype for a TikTok design interview take-home.
It simulates TikTok's FYP feed and demonstrates a new AI feature
called "Stitch Yourself In" — where users can insert themselves
into videos they love using AI.

## Design direction

STRICT: Replicate TikTok's existing visual language. Do NOT invent
a new aesthetic. This needs to look like the real TikTok app.

## TikTok design tokens (use these exactly)

- Background: #000000
- Primary text: #FFFFFF
- Secondary text: #888888
- Accent / CTA button: #FE2C55
- Like active state: #FE2C55
- Font: system-ui (mimics SF Pro on iOS)
- Font weights: 400 body, 600 username, 700 CTA
- Video: full-bleed 9:16, fills viewport
- Right sidebar icons: white, 28px, stacked with 4px label below
- Caption area: bottom-left, max-width 70% of screen
- Bottom nav: 83px height, 5 tabs (Home / Discover / + / Inbox / Profile)
- All UI: overlaid on black, semi-transparent where needed

## Viewport

Mobile only. Fixed width 390px in browser. Height 100dvh.
Center the 390px container on desktop with black side gutters.

## Tech stack

- React + Vite
- Tailwind CSS
- No backend, no auth, no external APIs yet
- Videos loaded from /public/videos/ as local files

## Screens needed

1. FYP Feed — vertical snap scroll, one video per screen,
   autoplay in view, pause when scrolled away, right sidebar
   with heart/comment/share/bookmark/avatar, bottom caption
2. "Stitch Yourself In" creation flow — triggered from a
   button on the feed (add later)
3. Output preview — shows result (add later)

## Video data

Hardcode a videos array in the feed component:
[
{ id: 1, src: '/videos/video1.mp4', user: '@goldenpup',
caption: 'sunday zoomies 🐾', likes: '284K', comments: '3.2K' },
{ id: 2, src: '/videos/video2.mp4', user: '@tablefortwo',
caption: 'when the tasting menu hits different ✨', likes: '91K', comments: '1.8K' },
{ id: 3, src: '/videos/video3.mp4', user: '@wanderlust.reel',
caption: 'santorini at magic hour 🌅', likes: '512K', comments: '7.4K' },
]

## Important constraints

- This is a pitch demo, not production. Keep code clean but prioritize
  visual accuracy and scroll feel over perfect architecture.
- The snap scroll interaction is the most important thing to get right.
  Use scroll-snap-type on the container, scroll-snap-align on each video.
- Autoplay/pause must use IntersectionObserver.
- Videos should be muted by default (required for autoplay).
- Tap video to toggle mute.
