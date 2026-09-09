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

## ⚠️ The defect class that reddened two repositories: a test that measures the MACHINE

On 2026-09-08 CI ran four game repositories for the first time and two went red. **Seven failures, none of
them a defect in a game** — three tests measuring the machine: its LANGUAGE (`navigator.language`), its SPEED
(a fixed `setTimeout`), and its INSTALLED FONTS. A test like this is green on the developer's laptop for
years and red the first time it meets a different computer, which is the CI runner, which is also the school
Chromebook.

### 📏 Measured across the catalogue on 2026-09-09 — 225 test files, five repositories

| repository | BLIND wait (sleep and hope) | polling with a condition (the CURE) | font METRIC | system language |
|---|---|---|---|---|
| `game-soccer` | 🔴 **29** (up to **900 ms**) | 11 | 0 | 0 |
| `game-chess` | 🔴 **10** | 7 | 0 | 0 |
| `game-whackwhack` | 0 | 0 | 🔴 **2** | 0 |
| `pixi-15-puzzle` | 0 | 0 | 🔴 **1** | 0 |
| `game-2048` | ✅ clean | | | |
| `game-platformer` | ✅ clean | | | |

⚠️ **THE DETECTOR HAD TO SEPARATE THE CURE FROM THE DISEASE, and the first version did not.**
`while (Date.now() < until) await sleep(16)` is waiting for a CONDITION — it is the fix applied to
`game-soccer`, not the fault. A bare `await sleep(400)` is the fault. Counting them together produced a number
three times too large and would have reported the repair as damage.

### 🔴 And the biggest finding is that one repair was left half done

`game-soccer` had ONE blind wait replaced by `waitFor` and was called fixed. **Twenty-nine remain**, at 900 ms,
400 ms, 350 ms. It passes today because the runner is fast; every one of those lines is a green that depends
on a machine, and the red of 2026-09-08 was simply the first one to break. 📌 «Uma causa achada não é a causa
toda» — the lesson was already written down, and the same repository paid for it twice.

### The two rules, and the second is the one that hides

1. **NEVER wait on the clock — wait on the CONDITION.** `waitFor(() => x === true, { timeout })` passes as fast
   as the machine allows and fails with a reason. A fixed sleep encodes today's CPU into the assertion.
2. ⚠️ **A FONT-METRIC test has TWO legs, and copying it copies only the first.** It is valid when (a) the face
   is monospaced at 1em against a proportional control — pin that with a case — AND (b) **the family is not
   installed on the machine**. If it is installed, `font-family` resolves from the SYSTEM, the vendored
   `@font-face` is never consulted, and renaming that declaration so it can never match leaves the file GREEN.
   📌 The second leg is a property of the MACHINE and cannot be asserted from inside the test: it only shows up
   by breaking the `@font-face` on purpose and seeing whether anything fails. `tests/fonte-arcade.browser.test.js`
   in this repository carries the method with both legs documented; `game-whackwhack` copied it with one.

📌 `document.fonts.ready` and `fonts.load` are NOT this defect — they wait for a DECLARED face and are correct.
The defect is comparing measured widths.

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
