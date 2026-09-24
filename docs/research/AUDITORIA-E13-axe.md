<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
Historical audit (2026-06-01, engine v4.0.0): kept as a record; the current state lives in `docs/6-DevOps-SRE/CI-QA.md` (the axe gate, `scripts/axe-check.mjs`) and `docs/3-Sprint-Design/Test-Plan.md` (the human gates).

# E13 — Accessibility audit + the 5 gates of ADR-001

> Engine **v4.0.0** (PixiJS). Automated audit run on 2026-06-01 with **axe-core 4.10.2**
> (injected by Playwright). Tags: `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`.

## 1. Touch controls (mobile) — done

- **Digital joystick** (124px base circle + 58px knob that slides toward the touched direction → 8
  directions, with a dead zone) in the bottom-left corner + **run** (») and **jump** (⤒) in the bottom-right
  corner. **They do not cover the centre** of the gameplay (overlay on the edges only).
- Action buttons **56×56 px** and joystick base **124px** → they meet **WCAG 2.5.5 Target Size (AAA, 44×44)**.
- They appear only on **touch screens** (`ontouchstart`/`maxTouchPoints`); on desktop they stay hidden
  (force them with `?touch=1` or `window.__incl.showTouch()`).
- They map to the **P1** keys (remappable, E10) through the same `keys` Set → `pointerdown/up`,
  with `touch-action:none` (no accidental zoom/scroll). Jump is *edge-triggered*, as on the keyboard.
- **Validated** (Playwright, pointer events): move-right ✅, jump ✅, 56×56 target ✅.

## 2. axe-core — result

| Scope | A/AA violations | Passes | Manual review (incomplete) |
|---|---|---|---|
| **Our app** (excludes the VLibras widget) | **0** | 23 | 1 — contrast of the touch buttons over the canvas |
| Whole page (with VLibras) | 2–3 transient | 24 | + `.vp-more-option` (VLibras) |

- **Our code: zero WCAG 2.0/2.1/2.2 A and AA violations.**
- The `button-name`/`label` violations appear **only** in the DOM injected by the **VLibras widget**
  (gov.br) — third-party, **interim**, outside our control. It will be replaced by the **own engine
  in zdog** (pillars P2/P5). Documented honestly; it is not a regression of ours.
- **Incomplete `color-contrast`** on the touch buttons: axe cannot measure the background because the
  buttons sit **over the WebGL canvas**. The effective contrast is **~16:1** (white text `#fff` on
  `rgba(13,17,32,.92)` ≈ `#0d1120`) → passes AAA (7:1) in practice; needs manual confirmation.

## 3. The 5 gates of ADR-001 (§validation)

| # | Gate | Who | Status |
|---|---|---|---|
| 1 | **Lighthouse Performance ≥ 90** in Positivo Tablet emulation (mobile + 3G + CPU 4×) | `[DEV]` | ⏳ pending — needs Chrome/Lighthouse on the target. Current data: stable **60 FPS** on the test desktop (PixiJS WebGL, `renderer.type=1`). |
| 2 | Test on **real Positivo Tablet + Chromebook** (perf + a11y, ChromeVox) | `[DEV]` | ⏳ pending — requires physical hardware. |
| 3 | **Automated audit axe + Lighthouse + WAVE** | `[CLAUDE]`/`[DEV]` | 🟡 **partial** — **axe ✅ (0 violations in our app)**. Lighthouse a11y and WAVE pending (they need a CLI/extension). |
| 4 | **NVDA + JAWS + VoiceOver** (desktop and iOS), manual | `[DEV]` | ⏳ pending — play by screen reader only and note the friction. |
| 5 | **Test with 5 children** (incl. 1 with SEN) + Mom Test | `[DEV]` | ⏳ pending — field work. Last gate for `fully_ratified`. |

**Summary:** what AI can automate is **done** (gate 3 — axe clean). Gates 1, 2, 4 and 5
depend on **real hardware, local screen readers and children** — they are `[DEV]` by nature
(physical/human access). Per pillar P2, the **"AAA + GAG complete"** seal will only be affixed when the
5 gates close.

## 4. GAG/WCAG coverage already implemented in v4 (E1–E13)

- **Text/UI in the DOM** (not in the canvas) → screen readers read the HUD, instructions, quizzes, captions.
- `aria-live` (status/alert), visible focus (`:focus-visible` 4px), skip-link, `prefers-contrast`,
  `prefers-reduced-motion`.
- **C1** SFX captions · **C2** assist mode · **B2** remap+persistence · **A1** (partial)
  touch controls · 44px+ targets · multiplayer on separate screens (P7, no split-screen).

## How to reproduce the axe audit

```js
// on a clean port (no cached service worker), with the page open:
const s=document.createElement('script');
s.src='https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js'; document.head.appendChild(s);
// then:
axe.run({exclude:[['[vw]'],['[vw-access-button]'],['[vw-plugin-wrapper]']]},
        {runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']})
   .then(r=>console.log(r.violations));   // → []
```
