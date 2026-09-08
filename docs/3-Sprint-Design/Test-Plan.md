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

### ⚠️ The Chromebook battery is FOUR players with peripherals — decided by the Dev, 2026-09-08

Verbatim: *«Teclado para dois jogadores é para teclado full. Se a criança joga num chromebook, não há como
jogar dois jogadores e pronto. Teste no chromebook é para quatro jogadores mas usando teclado completo ligado
ao dispositivo assim como 4 controles via USB.»*

Two things are fixed by that, and neither is derivable from the code:

1. **Two players on one keyboard requires a FULL keyboard.** A Chromebook's built-in keyboard does not carry
   two seats, and that is the answer rather than a limitation to work around — the two-player split depends on
   the numpad, and a Chromebook has none.
2. **The Chromebook battery is a FOUR-player test**: a full keyboard attached to the device, plus **four USB
   gamepads**. It is not the device on its own; it is the device as it would sit in a classroom, peripherals
   included.

📌 This also feeds the open question in **#112** — *what «places» means for a keyboard*. It does not answer it
whole, but it settles the two-player case: a Chromebook's own keyboard does **not** carry two seats, and the
reach screen has to be able to say so **before** the child starts, instead of the child finding out by trying.

⚠️ And it is why #112 depends on this battery from two sides: the card must be **seen** on this device
(issue #8) and its sentence must be **understood** by a child (issue #7).

- [ ] Two players on the Chromebook's own keyboard is correctly reported as UNREACHABLE, not attempted.
- [ ] Four players: full keyboard + 4 USB gamepads, all four seats reachable and remappable.
- [ ] Boots and holds interactive FPS on the low-end target.
- [ ] Integer real-pixel scaling holds on the device's actual dpr (see ADR-0001) — uniform pixels, even scanlines.
- [ ] Touch targets meet the physical-mm sizing on the real screen.
- [ ] Offline (PWA) works after first load with no network.
