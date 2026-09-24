# Game Feel — juice & camera

How controlling the game *feels* (Swink's "game feel"). **Already implemented** — concrete decisions + commits in
ADR-0018; this doc states the rules. Every effect is **individually toggleable** so it can be
tested and switched off on weak target hardware.

## Juice effects (each an independent `?debug` toggle + a "low-performance" profile that disables all)

- Dust on landing · collect glow · squash & stretch · hit-stop (micro-freeze on impact) · calibrated screenshake ·
  animated tile shimmer · camera easing.

## Juice × reduced-motion (WCAG 2.3.3, per player)

- particles → `rm.particles` · shimmer → `rm.items` · screenshake → `rm.parallax` (camera-motion class) · squash →
  `rmWalk` per player. **Hit-stop is a pause, not motion** → stays out of reduced-motion.

## CRT post-processing

Scanlines + vignette + rounded corners as **CSS overlays** on `#game-region`, **default OFF** (opt-in aesthetic),
z-index above the game but **below** menus/dialogs (legibility wins); `prefers-reduced-transparency` disables it.
Scanline period anchored in real pixels (ADR-0001) so it stays regular at any dpr.

## Camera

Follow + easing; screenshake as above. (Rogers, *Level Up!*, camera chapter.)

## Audio feel

Earcons / SFX feedback are part of feel; the 9-category **mixer** and blind-mode audio are **accessibility**, in
`../1-Discovery/plan-audio-phase-f.md` (→ moves to the a11y layer). This doc covers only the *feel* aspect of audio cues.
