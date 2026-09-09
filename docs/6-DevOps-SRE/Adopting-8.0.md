# Adopting `8.0.0` — the per-repository cut

`Breaking-Changes.md` is organised by CHANGE: what moved, and why. This file is the other cut of the same
facts — **organised by REPOSITORY**: what YOU have to edit, and on which line.

⚠️ **It deliberately does not repeat the reasons.** A fact written twice rots (`CLAUDE.md` §6), and the reason
a change exists belongs beside the change. Every row here points at the section that carries it. What is new
in this file, and exists nowhere else, is the **measurement of each consumer's tree**.

📏 **Measured on 2026-09-09**, by reading the six repositories. Line numbers age; the file and the symbol do
not. If a line has moved, `git grep` the symbol — the row still tells you what to look for.

---

## The ORDER, and it is not a preference

1. **The engine publishes `8.0.0` first.** Editing a game before that is not possible: adding a field to a
   declaration typed by the `7.0.1` `GameDeclaration` is `TS2353: Object literal may only specify known
   properties` — tried on `pixi-15-puzzle` and reverted.
2. **Then each game bumps the dependency AND adapts in the SAME commit.** Splitting them leaves a repository
   red against the version it has installed.
3. Publishing `8.0.0` reaches nobody by itself: `pixi-15-puzzle` and `game-whackwhack` pin `7.0.1` exactly,
   `game-2048` and `game-soccer` ask for `^7.0.1` (`>=7.0.1 <8.0.0`). **No game moves until somebody moves
   it**, which is what makes this order safe rather than lucky.

📌 `game-chess` is the exception and the canary: it consumes `file:../SP-the-inclusionist-tracer`, so it
compiles against the tree and sees every break the day it lands. It has already paid for two of them.

---

## Every game that boots through `createGame`

`game-chess` · `pixi-15-puzzle` · `game-2048` · `game-whackwhack` · `game-soccer`

| what | where, measured | section |
|---|---|---|
| **Declare `holdsAtOnce(): number`** — required | in your `GameDeclaration`. `game-chess` already has it (`app/js/declaration/chess-declaration.ts:119`); the other four do not, because `7.0.1` does not know the field | §4 |
| **Declare `seguraTeclas(): boolean`** — required | same object. ⚠️ **Do NOT derive it from `holdsAtOnce`**: that counts simultaneous positions and refuses zero, so a game that holds nothing still declares 1. `game-chess` shows both side by side (`:119` and `:139`) | §6 |
| **Delete `semMenuDePausa` from `declines`** | `game-chess` `app/js/boot/game-shell.ts:439` · `pixi-15-puzzle` `app/js/boot/main.ts:108` · `game-2048` `app/js/boot/main.ts:96` · `game-whackwhack` `app/js/boot/main.ts:94` | §6 |
| **Give the accessibility bar a host** | 🔴 **Measured: none of the five has one.** No `#title-icons` element and no `host.a11yBarHost` anywhere. Without it the engine reports a `problems` line and the child gets **no accessibility bar on the first screen** — which is the rule this major exists to keep | ADR-0106 |
| **Give the pause card a host, or accept the default** | none of the five declares `host.pauseHost`; all five have `#game-region` in their HTML, so the card mounts THERE. ⚠️ For `game-chess` that is probably wrong: its own markup says `#game-region` is only the BOARD and `#stage` is «the game as seen» | ADR-0122 |
| **`mapeamentoDoTeclado?` · `mapeamentoDoPad?`** | nothing to do. Both optional, and silence keeps today's behaviour: the engine's factory tables. Declare one only if this game wants a different default — and remember the child's own remapping still wins over it | §6 |

### `game-chess` has one more, and it is design work

Its own pause menu lives in `app/js/ui/pause-menu.ts` — opened by START, holding «leave the lesson», with a
focus trap and a keyboard reference at its foot. Adopting the engine's card means deciding what happens to
those items: they are `getPauseActs()` material, and the engine's card offers only what the game can action.

⚠️ Its header also raises a real question this project has not answered: *«the engine pauses a running
simulation for a platformer. Chess has no clock to stop.»* ADR-0122 names it as deliberately not decided.

---

## Every game that assembles its own INPUT

| repository | what it consumes | where |
|---|---|---|
| `game-platformer` | `initKeydown` · `initTouchBindings` · `initGamepad` | `app/js/main.ts:479` · `:2018` · imported at `:163` |
| `game-soccer` | `initGamepad` only | `app/js/boot/main.ts:246` |

**Both contexts gain a required `arestaDoJogador`.** Pass the SAME instance to all of them:

```js
import { criarArestaComAlternancia } from '@the-inclusionist/engine/input/latch-edge.js';

const arestaDoJogador = criarArestaComAlternancia(() => players);
// … then hand `arestaDoJogador` to initKeydown, initTouchBindings and initGamepad.
```

⚠️ **Do not pass the raw `arestaDoJogador` from `input/state.js`.** It compiles, it feeds the automaton, and
it leaves `p.toggleMove` frozen on the keyboard's value — which is the half of ADR-0113 that a child actually
feels. See §6.

📌 **And `game-platformer` can then delete a patch it no longer needs**: `onTouchControlsShown`
(`app/js/main.ts:1695`) exists to compensate for exactly the edge this change delivers.

### One behaviour change that needs no code, and should be READ

`resetKB()` — «restore defaults» — now returns to the GAME's default mapping instead of the engine's. Both
repositories wire that button: `game-soccer` at `app/js/ui/controls-panel.ts:255`, `game-platformer` at
`app/js/main.ts:1765`. Nothing to edit; but if either declares `mapeamentoDoTeclado` later, that button
starts behaving differently, and correctly.

---

## What to run before committing, in each repository

By EXIT CODE, not by reading output — a pipe hides the code, and `N passed` coexists with a non-zero exit:

```bash
npx tsc --noEmit && npx vitest run && npm run build
```

⚠️ **`npm ci` is deliberately NOT on that list.** It rewrites another repository's `node_modules`, and this
project has already paid for touching a consumer's dependencies. Bumping the version is an edit to
`package.json` plus whatever the repository's own routine is — not a step this document invents.

📌 And the boot check the `CLAUDE.md` already requires: canvas ≥ 1 and `window.__incl` in the preview, not a
screenshot of the title screen.
