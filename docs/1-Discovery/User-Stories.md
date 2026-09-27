<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# User Stories (engine layer)

The **negotiable software features** of the engine — the second layer of our two-layer requirements model (the
fixed curriculum layer lives in `../educational/`; rationale in `../CONTRIBUTING.md`). Format: Connextra
("As a `<role>`, I want `<goal>`, so that `<benefit>`").

Keep these small and negotiable; anything that is a *learning target* belongs in `../educational/`, not here.

## Roles, and why there are five

**player (child)** · **teacher** · **responsible adult** (parent or professional — psychologist, physio,
neuropsych) · **professional author** (ADR-0052) · and one the seed list did not have:

⚠️ **game developer.** The engine is published as `@the-inclusionist/engine` and every game is its own
repository (ADR-0068). A person integrating it is a user of this software, and the stories they need are not
the child's: they are about the package boundary, the transports and the assets. Leaving them out is how a
library ends up serving only the game its authors happened to write first.

## How to read the status

| | meaning |
|---|---|
| ✅ | built **and** held by a gate — the modules and the test are named on the line |
| 🟡 | built, and the gate is partial or absent — the line says which |
| ⬜ | not built; the issue that tracks it is named |
| 🎮 | the engine's half is done and the rest needs a **game** — not this repository's to finish alone |

⚠️ **Every path on a line is checked by `tests/user-stories.node.test.js`.** A story that names a module or a
gate that no longer exists fails the build. That gate exists because this exact rot was measured on 2026-09-07
across the issue tracker: three open issues pointed at files that left with the cartridge (#111), and nothing
said so. A document that describes the code has to be able to notice when it stops.

---

## Player (child)

- ✅ As a **player**, I want to act with **one input at a time**, so that switch and one-button access works —
  on the keyboard **and on a controller**. `app/js/input/keydown.ts`, `app/js/input/gamepad.ts` ·
  `tests/gamepad.node.test.js`
- ✅ As a **player**, I want to **remap my controls and have it persist**, so that my adaptive mapping survives a
  reload. `app/js/input/keyboard.ts`, `app/js/ui/settings-controls.ts` · `tests/keyboard.node.test.js`,
  `tests/settings-controls.browser.test.js`
- ✅ As a **player**, I want my old saved mapping to keep working after the engine renames its actions, so that
  an update never silently kills my keys. `app/js/input/vocabulary-migration.ts` ·
  `tests/keyboard-vocabulary-migration.node.test.js`
- ✅ As a **player using a screen reader**, I want **every announcement to reach me in order**, so that I do not
  miss what happened. `app/js/core/a11y-sr.ts` · `tests/a11y-sr.browser.test.js`
- ✅ As a **deaf player**, I want **sound events captioned**, so that an earcon is never the only carrier of
  information. `app/js/platform/audio-earcons.ts` · `tests/audio-earcons.node.test.js`
- ✅ As a **player**, I want to **see which settings I changed**, so that I can undo what I did without resetting
  what I did not. `app/js/ui/changed-mark.ts` · `tests/changed-mark.browser.test.js`,
  `tests/changed-mark-contrast.node.test.js`
- ✅ As a **player**, I want **every settings menu to restore its own defaults**, so that a wrong turn is always
  one button from undone. `app/js/ui/settings-panel.ts` · `tests/settings-panel.browser.test.js`
- ✅ As a **player on a small screen**, I want touch targets **big enough to hit and far enough apart**, without
  the list scrolling out of reach. `app/js/ui/layout.ts` · `tests/pause-target-44px.browser.test.js`
- ✅ As a **player**, I want to **choose the typeface**, and have the choice actually change what I see.
  `app/js/ui/fonts.ts` · `tests/an-offered-font-loads.node.test.js`
- ✅ As a **player with low vision**, I want **high contrast** that keeps the cursor findable, so that reading
  better does not cost me my place. `app/js/render/high-contrast.ts` · `tests/high-contrast.browser.test.js`,
  `tests/menu-contrast-measured.node.test.js`
- ✅ As a **colour-blind player**, I want a **correction**, and I want it applied last so nothing re-tints it.
  `app/js/render/cvd-matrices.ts`, `game-platformer:app/js/core/layers.ts` · `tests/viz-modes.node.test.js`,
  `game-platformer:tests/layers.node.test.js`
- ✅ As a **player**, I want the **empathy simulation never to reach my controls**, so that a simulation can
  always be switched off. `app/js/ui/hud.ts` · `tests/hud.browser.test.js`
- ✅ As a **player**, I want the game to **tell me when it crashed** instead of freezing, so that I know it is
  not me. `app/js/ui/loop-crash.ts` · `tests/loop-crash.node.test.js`
- ✅ As a **player**, I want the **menus navigable by controller and by keyboard**, so that the pad that plays
  the game also configures it. `app/js/ui/menu-nav.ts` · `tests/menu-nav.browser.test.js`
- ✅ As a **player**, I want the **game in my language**, so that I am not reading a second language to play.
  `app/js/core/i18n.ts` · `tests/i18n-dicts.node.test.js`
- ✅ As a **blind player**, I want **audio navigation** towards what matters, so that I can find a target
  without seeing it. `app/js/platform/audio-sonar.ts` · `tests/audio-sonar.node.test.js` (the cane and the
  blind swim, which read a tile world, live in the `game-platformer` since note CC, and so does the continuous
  guide since note DZ)
- ✅ As a **player**, I want **narration of what is on screen**, so that reading is not the price of playing.
  `app/js/platform/tts.ts`, `app/js/platform/interruptible-speech.ts` · `tests/tts.node.test.js`
- ✅ As a **deaf player**, I want **every sound captioned** in deaf mode, so that nothing the game says by sound is lost.
  `app/js/ui/vlibras.ts` · `tests/vlibras.node.test.js`
- 🟡 As a **deaf player who signs**, I want the **sonar to call a sign-language interpreter**, so that what is on screen
  reaches me in Libras. The sonar hands its text to an interpreter port; which Libras player fills it is the Dev's open
  choice (ADR-0234), and until then the child is told signing is unavailable. `app/js/ui/vlibras.ts`
- ✅ As a **player who cannot use hands**, I want to **play with my eyes**, so that a webcam replaces the pad.
  `app/js/ui/eye-control.ts` · `tests/eye-control.browser.test.js`
- ✅ As a **player**, I want **my own screen** when several of us play, so that nobody has to share half a view.
  `app/js/render/viewports.ts` · `tests/viewports.browser.test.js`
- 🟡 As a **player**, I want to be **told before I start** which of my actions the controller in my hand cannot
  reach. `app/js/ui/reach-notice.ts` · `tests/reach-notice.node.test.js`, `tests/reach-notice.browser.test.js`
  — the notice exists; what it measures is still being settled in **#112** and **#114**.
- ⬜ As a **player without a keyboard**, I want to **type a room code with the pad**, so that a console-shaped
  machine can still take text. The mechanics are built and tested — `game-platformer:app/js/core/letter-grid.ts`,
  `game-platformer:app/js/core/password.ts` · `game-platformer:tests/letter-grid.node.test.js`, `game-platformer:tests/password.node.test.js` — and **no screen
  uses them**: neither module has a production importer. **#77**
- ⬜ As a **player**, I want the game to **notice when I am struggling and adjust**, so that difficulty follows
  me instead of the other way round. **#92**
- ⬜ As a **player**, I want to **see how much of my time is left**, so that the limit is something I can plan
  around instead of something that interrupts me. **#94**

## Teacher

- 🟡 As a **teacher**, I want to **pick the activity per screen**, so that each child gets the right one.
  `app/js/educational/activities-registry.ts` — the registry exists here; the title menu that offers it is the platformer's
  since ADR-0174 (in `game-platformer`); the per-child assignment is
  **#92**/**#96**.
- 🟡 As a **teacher**, I want to **set the difficulty per player**, so that children at different levels play
  together. `app/js/ui/settings-mobility.ts` · `tests/settings-mobility.browser.test.js` — "Modo Fácil" is per
  player; a graded difficulty is **#92**.
- ⬜ As a **teacher**, I want a **room code** children can enter, so that a class shares a session without
  anyone logging in. Blocked on the same screen as the letter grid. **#77**

## Responsible adult

- ⬜ As a **responsible adult**, I want **one place** to set time, content and resources, so that the controls
  are not spread across five menus. ADR-0050 puts the panel in Bússola Escolar and the **enforcement** in this
  engine. **#94**, **#101**
- ⬜ As a **responsible adult**, I want a **night window**, so that the software is not available at hours it
  should not be. ADR-0050 §5 — a pure function over `(allowance, now)` with **no age input**, which is how it
  proves it collects nothing. **#94**

## Professional author

- ⬜ As a **professional**, I want to **author an activity for one student and answer for it**, so that
  authorship and responsibility travel together. ADR-0052 declares this out of the first stage until consent,
  segregation and logging exist. **#96**

## Game developer

- ✅ As a **game developer**, I want to **install the engine and build against it**, so that a game is its own
  repository. `package.json` · `tests/engine-package.node.test.js`
- ✅ As a **game developer**, I want the engine to **not speak my game's vocabulary**, so that my game is not
  the one it was shaped around. `tests/engine-boundary.node.test.js`,
  `tests/action-vocabulary-boundary.node.test.js`
- ✅ As a **game developer**, I want each control method to **declare the slots it offers** so that I bind my
  own actions to them. `app/js/input/transports.ts`, `app/js/input/default-bindings.ts` ·
  `tests/transports.node.test.js`, `tests/default-bindings.node.test.js`
- ✅ As a **game developer**, I want the engine to **name the actions and let me say what they mean**, so that
  a platformer and a board game can use the same input layer. `app/js/core/actions.ts` ·
  `tests/the-fourteen-actions.node.test.js`
- 🟡 As a **game developer**, I want the engine's **assets to arrive with the package**, so that a menu that
  offers seventeen typefaces can load them. `package.json` — the door promises more than it delivers today:
  **#119**
- 🎮 As a **game developer**, I want the engine to **carry no game state**, so that two games on one page do
  not collide. `game-platformer:app/js/core/run-state.ts` · `game-platformer:tests/run-state.node.test.js` — done on the engine's side; each
  game owns its own round.

---

## Status of this document

- Audited against `app/js` on **2026-09-07**, after the cartridge left (#111). The five seed stories of the
  previous version are all still here, three of them now ✅ with the gate named.
- **Not** tied to traceability IDs (deferred — see `../CONTRIBUTING.md`).
- Game-layer stories (levels, characters, scoring in a particular game) belong to that game's repository, not
  here. That is why the title says *engine layer* and no longer *engine / game layer*.
