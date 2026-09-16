# C4 — Context (Level 1)

The system, its users, and the systems it talks to. **Level 2 (Container)** is deferred until there is more than
one deployable unit (i.e. when the backend lands — see `backend-cloud-roadmap.md`); today it is a single client app.

## The system

**The Inclusionist** — an accessibility-first educational platformer (the MVP of the EdSP engine). A **client-side
PWA**: PixiJS (WebGL/Canvas) render + DOM UI (for a11y), fully **offline** (Workbox service worker, content-hash
cache), shipped as `dist/` on **Cloudflare Pages** (git-connected, builds on push to `main`).

## Actors

- **Player (child)** — plays the games; may use assistive input (keyboard/switch, gamepad, eye control, touch).
- **Teacher** — picks activity/difficulty per screen (in-game menus).
- *(future)* **Parent / professional** (psychologist, physiotherapist, neuropsychologist) — the local Student
  Manager, once it exists.

## External systems / dependencies (edge)

| Dependency | Role | Notes |
|---|---|---|
| PixiJS 7.4.2 | rendering | bundled (npm), tree-shaken |
| VLibras | sign-language interpreter | online widget; read-only |
| MediaPipe tasks-vision | eye, face and hand control | fetched by the build into the delivery, served from the game's origin (ADR-0177) |
| neural TTS (Kokoro, through the game's port) | speech | offline-capable once fetched; Piper left (ADR-0207) |
| Web Speech / Gamepad / Web Audio | assistive I/O | browser APIs |
| Cloudflare Pages | hosting/CD | static; git-connected |

## Non-goals (today) & future

- **Non-goals now:** server API, microservices, K8s — this is a single static client.
- **Future backend:** when logged-in users make sense, a self-hostable backend (**Nakama**, fits LGPD/data-locality).
  Learning telemetry (xAPI/Caliper/LTI) is **store-and-forward**, not a live cloud. The staged path is in
  `backend-cloud-roadmap.md`; each step is recorded as an ADR when adopted.
