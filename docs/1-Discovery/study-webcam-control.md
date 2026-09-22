# Study — controlling a game with the webcam: gestures, face, eyes

> Issue #182 (the Dev's list of 2026-09-12, ADR-0151 §2 item 5: «webcam gestures (+ open); webcam face (+ open); webcam eyes
> (+ open)»). Written 2026-09-13 before any code: the runtimes are decided (ADR-0124, ADR-0132) and catalogued, but WHAT a
> gesture, a face movement or a gaze does in a game is not, and it is the Dev's. It becomes a record when the Dev chooses.

## What exists

| piece | where | state |
|---|---|---|
| MediaPipe `tasks-vision` 1.0.1 runtime (bundle, glue, 11.8 MB wasm) | `platform/heavy-catalogue` | catalogued with sha256; **nothing reads it** (`tests/o-que-desce-tem-quem-leia` declares the debt) |
| face landmarker model (float16, 3.8 MB) | same | catalogued; unread |
| gesture recogniser model (float16, 8.4 MB) and hand landmarker (7.8 MB) | same | catalogued; unread |
| WebGazer (1.9 MB) | same; `ui/webcam.ts` runs it from the checked cache (#169) | **wired, but to the platformer's keys**: gaze left/right/up → synthetic `KeyA`/`KeyD`/`Space` — a game's keys inside the engine |
| the transports' latch rule | `input/transport-in-use` (ADR-0113) | built: camera enabled ⇒ the move and hold latches are the law |
| the quick bar's 🧑 👀 👄 | `ui/pause-icons` | «under construction» |

## What each runtime gives (sources)

- **Gesture recogniser** — seven canned gestures and «None»: `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`, `Thumb_Up`,
  `Victory`, `ILoveYou`; live-stream mode; runs in the browser.
- **Face landmarker** — 478 landmarks, **52 blendshape scores** (facial expression coefficients: the mouth opening, each eye's
  blink, the brows, a smile…) and a **facial transformation matrix** (the head's pose: turn, tilt, nod); runs in the browser.
- **WebGazer** — a point on the screen, from a regression the child calibrates by looking and clicking.

## The design questions, with a recommendation each

**1. Where a recognised signal goes.** Recommendation: **to a POSITION the game names, never to a key.** The touch pad and the
keyboard already raise positions (`action2`, `left`…); the webcam transports do the same, stamped with their origin
(ADR-0109). This also removes the platformer's keys from `ui/webcam`.

**2. Gestures → positions.** Seven gestures; a game names up to fourteen positions. Recommendation: **a mapping panel like
«Mapear toque»** (gesture → one of the game's words), with a default that follows the order the game names its positions, and
gestures a hand with little movement can make first (`Open_Palm`, `Closed_Fist`, `Thumb_Up`, `Pointing_Up`). The recogniser
reports a held gesture every frame: a gesture raises its position once, and releases when it ends.

**3. Face → positions.** Recommendation: **head pose for the four directions (turn left/right, nod up/down) and mouth opening
for one action**, each past a threshold the child sets, with a dwell before it counts. ⚠️ Blinks are left out of the defaults:
they are involuntary and frequent, and a game that reads them punishes a child for blinking.

**4. Eyes.** Recommendation: **dwell selection on the menus first** (look at an item for a set time to pick it — the «8 sectors,
dwell» mode of ADR-0104) **and gaze direction as the four directions in play**, after WebGazer's calibration. The screen point
is kept for a pointer game (issue #105).

**5. Consent and privacy.** The camera prompt is the browser's; the video never leaves the device (the runtimes run in the page).
Recommendation: the panel says so before the browser asks, in the child's language, and a stored «enabled» never turns the
camera on by itself at the next boot.

## What has to be measured before building, with the Dev's permission for the downloads

1. The runtime and each model load under the engine's CSP from the delivery (`heavy/`).
2. Frames per second of the face landmarker and the gesture recogniser on the weakest school device available — a Chromebook or
   Positivo — since both run on the CPU.
3. A camera is needed to measure any of it; the preview pane has none.

## Sources

- [MediaPipe Gesture Recognizer](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer)
- [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker)
- ADR-0104 (eight sectors, dwell), ADR-0109 (a synthetic key declares its origin), ADR-0113 (transport rules), ADR-0124 and
  ADR-0132 (MediaPipe and WebGazer), issue #105 (the pointer)
