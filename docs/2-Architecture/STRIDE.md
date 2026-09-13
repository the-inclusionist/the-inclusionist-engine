# STRIDE — threat model

Two passes. The **client pass** below is done (2026-09-13, at the Dev's request) and describes the engine as it ships.
The **server pass** waits for a backend, the Student Manager or telemetry — no accounts and no server exist yet — and will
run per trust boundary in `DFD.md`, with child-data protection (LGPD/COPPA) as the top asset.

⚠️ **The stub this file replaces said «nothing leaves the device». That was false**, measured below: the engine fetches
executable code and models from four third-party hosts, by default, on the child's machine.

## Client pass — measured on 2026-09-13

### What crosses a trust boundary today

| # | Boundary | What crosses | Where in the code |
|---|---|---|---|
| B1 | device → Hugging Face | the four neural voices (~241 MB of `.onnx` + `.onnx.json`) | `platform/voice-plan`, `platform/pesados` |
| B2 | device → jsDelivr | `@mintplex-labs/piper-tts-web@1.0.5` (JavaScript) and `onnxruntime-web@1.20.1` (JavaScript + WebAssembly), `@mediapipe/tasks-vision@1.0.1` (JavaScript + WebAssembly) | `platform/pesados-catalogo` |
| B3 | device → Google Storage | the MediaPipe `.task` models | `platform/pesados-catalogo` |
| B4 | device → webgazer.cs.brown.edu | `webgazer.js`, a `<script src>` executed in the page, on first use of eye control | `ui/webcam` |
| B5 | author → page | activity text written by adults (ADR-0052) reaching the DOM | the `innerHTML` sinks |
| B6 | page ↔ device storage | the child's settings (`incl_*`) and each game's data (`incl.<game>.*`) in `localStorage` / Cache Storage | `platform/storage`, `platform/pesados` |
| B7 | host → page | the bundle and its service worker | Cloudflare Pages, `vite-plugin-pwa` |

📌 **B1–B3 run by default at every boot** (`createGame`'s `baixarPesados`, idempotent: what is cached is not fetched
again), one download at a time, in the background.

### Threats, what holds them, and what does not

| STRIDE | Threat | Boundary | What holds it today | Gap |
|---|---|---|---|---|
| **T**ampering | A CDN or a mirror serves altered JavaScript or WebAssembly, and it runs in the child's page | B2, B4 | Versions pinned in the URL; the host list is an inventory (`nada-vem-de-fora`, `nada-de-cdn-a-mao`) | ✅ Heavy files held since #168: a measured `sha256` per entry, checked before `cache.put`; the service worker only reads that cache. ✅ And `webgazer.js` since #169: it runs from those checked bytes (a `blob:`), never fetched on first use |
| **T**ampering | An altered model is cached and served offline from then on | B1, B3 | Cache versioned by name; `incl-pesados-v2` holds only checked bytes (#168) | ✅ Held — an altered body is refused and reported |
| **T**ampering | Adult-written text injects markup | B5 | The sink census (#106, closed; none left to review) and the `html-sinks` gate; `registerDict` refuses markup; `escaparHtml` in the quiz | ✅ Held — every new sink is a gate failure |
| **T**ampering | The bundle is altered between host and device | B7 | HTTPS; Workbox precache by content hash | ✅ Held since #170: a Content-Security-Policy in `_headers` — script only from this origin, the checked `blob:` and the pinned jsDelivr runtimes; fetches only to the catalogue's hosts; measured blocking an outside script and an inline one |
| **I**nformation disclosure | Every fetch tells a third party the school's IP address and when a child played | B1–B4 | — | 🔴 **Not held.** An IP address is personal data under LGPD; the requests go to four companies before any adult is asked. This is a decision, not only code |
| **I**nformation disclosure | A game reads the child's settings or another game's data | B6 | Two storage scopes (ADR-0027 step 7); keys outside them said in `problems` (E2) | ⚠️ Same-origin games share `localStorage` by design (the child's settings follow them); no child data is stored (ADR-0037) |
| **E**levation of privilege | Third-party script runs with the page's powers: storage, DOM, speech, camera once granted | B4, B2 | — | ⚠️ Reduced, not removed: since #168/#169 only the pinned bytes run, but `webgazer.js` and the JS runtimes still execute as the page, and eye control holds the camera stream |
| **D**enial of service | 241 MB fetched by every machine of a school on its first day saturates the school's link | B1 | One download at a time per machine | ⚠️ No coordination between machines; the platform-level cache of ADR-0117 would pay it once per site |
| **S**poofing | — | — | No accounts, no identity | n/a until the server pass |
| **R**epudiation | — | — | No server actions | n/a until the server pass |

### Work this pass opens

- ✅ Every heavy download is verified against a pinned `sha256` before it enters Cache Storage (#168).
- ✅ `webgazer.js` runs from the checked cache, not the network (#169).
- ✅ A Content-Security-Policy in `_headers` names the hosts that may serve script and be fetched (#170).
- ⏸ **For the Dev:** whether a child's machine may contact Hugging Face, jsDelivr, Google and Brown without an adult
  being told — or the heavy files are served from the project's own origin.

## Server pass — not started

Trigger: backend, Student Manager or telemetry (see `../1-Discovery/Event-Storming.md`). Run STRIDE per trust boundary
in `DFD.md`, child data first.
