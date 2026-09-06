# Test Plan

Formalizes what we already do, as a per-feature / per-release **checklist**. The automated suites are the source of
truth (Vitest node + browser); this plan is the human checklist around them, plus the checks a machine can't run yet.

## Per feature (before marking an issue done)

- [ ] Unit/logic covered by Vitest **node** (ZOMBIES + Right-BICEP); each extracted module born with a test.
- [ ] Render/DOM covered by Vitest **browser** (Playwright) where it touches PIXI/DOM.
- [ ] Boot verified in the preview: canvas >= 1 and `window.__incl` (real boot, not just a title screenshot).
- [ ] `tsc --noEmit` and `vitest run` green (Dev runs Node).
- [ ] Acceptance criteria in the issue "Done when" met; for educational activities, the Gherkin `.feature` passes
  (see `bdd/README.md`).

## Per release

- [ ] Full Vitest suite green in CI (`.github/workflows/ci.yml`).
- [ ] `vite build` clean; PWA updates (content-hash SW) verified in the preview.
- [ ] Accessibility spot-check: keyboard-only, screen-reader captions (`aria-live`), reduced-motion, high-contrast.

## Hardware batteries (prospective — run when the devices exist)

We do **not** own the target hardware yet (public-school Positivo / Chromebook). Build these batteries now, run them
**when the devices arrive** — they do not block development.

- [ ] Boots and holds interactive FPS on the low-end target.
- [ ] Integer real-pixel scaling holds on the device's actual dpr (see ADR-0001) — uniform pixels, even scanlines.
- [ ] Touch targets meet the physical-mm sizing on the real screen.
- [ ] Offline (PWA) works after first load with no network.
