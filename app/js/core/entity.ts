// SPDX-License-Identifier: AGPL-3.0-or-later
// core/entity — THE PLAYER, written ONCE. Step 1 of ADR-0027, the one that record calls the prerequisite of all the
// others. It moves nothing and changes nothing at run time: `tsc --noEmit` is its whole test.
//
// THE PROBLEM THIS SOLVES. `core/state.players` is `unknown[]`. The type is lost exactly at the boundary where the
// entity crosses the program, so every module that needed a player wrote its own structural view by hand and cast.
// There were twenty-three, and they no longer agreed: the same field required in one module and optional in another
// for the SAME object, so a player was accepted by half the program and rejected by the other half. That is the
// failure that already cost a broken climb in Easy mode, when three copies of the action→edge table diverged: a copy
// nobody forces to agree, diverges.
//
// HOW IT IS USED — and why modules must NOT import the whole `Player`. What makes the project testable in the Vitest
// `node` project is that each module declares the MINIMAL slice it needs and the test builds a fake with only those
// fields. Swapping the narrow views for one fat interface would destroy that: every fixture would have to invent every
// field.
//
// The way out is to derive instead of retyping: `Pick<Player, 'x' | 'y' | 'vx'>` instead of rewriting three fields.
// The module stays coupled only to its slice and the test still builds only that — but each field's NAME and TYPE have
// one source, and renaming a field breaks every consumer's compilation at the same instant.
//
// THE LAYER BOUNDARY. `core/` may not import upward (ADR-0173), so fields that point at other layers enter here as the
// STRUCTURAL MINIMUM: the rich types (a sprite in `render/`) are assignable to these, and the compiler checks it where
// they are used.

// ⚠️ This file's imports are same-layer data on purpose: `core/actions` is the single source of the fourteen positions,
// and depending on a pure-data neighbour in the same layer is what lets `KeyScheme` be closed.
import type { Action } from './actions.js';
import type { VisualState } from './visual-state.js';

/**
 * Action → list of physical codes (`KeyA`, `ArrowLeft`…). The single source: it was written three times in input/.
 *
 * ⚠️ CLOSED OVER `Action` (issue #118, the Dev's decision); it was `Record<string, string[]>`. While it was open,
 * **a missing position was no compile error** — that is how a two-player scheme ended up with eight of the fourteen and
 * player 1's `Space` vanished with nothing going off. The defect was not a typo: the type accepted an incomplete scheme
 * as complete.
 *
 * ⚠️ AND `null` IS NOT A HOLE — it is a DECLARED ABSENCE, the half that gives closing the type its meaning. A keyboard
 * split four ways may have no physical room for shoulders and triggers; `null` says so, and it is what the reach notice
 * (`ui/reach-notice`, issue #112) reads to tell the child, BEFORE they start, which of the game's actions their
 * controls cannot reach. Inventing keys to fill it would lie to them in silence.
 *
 * Consumers have to handle the `null`, and that is what keeps a `null` from becoming an `undefined.includes`.
 */
export type KeyScheme = Record<Action, readonly string[] | null>;

/** The sides a clinging player can stick to: right, left, ceiling, floor. */
export type ClingSide = 'R' | 'L' | 'U' | 'D';

/**
 * The player's sprite as the game sees it: position, opacity, scale and texture. A PIXI.Sprite reduced to what the
 * game writes on it, on purpose, so the logic runs in the `node` project with a fake sprite.
 */
export interface PlayerSpriteLike {
  x: number;
  y: number;
  alpha: number;
  visible: boolean;
  scale: { set(x: number, y: number): void };
  texture: unknown;
}

/**
 * THE PLAYER. The fields down to `_swapSonar` are the ones the player factory creates — all required, because the
 * factory always writes them. After them come the ones other subsystems ADD at run time, optional because a freshly
 * made player genuinely does not have them.
 *
 * The split is not cosmetic: two modules reading the SAME object used to disagree about which side of this line a
 * field falls on. Writing it down is half the value of this file.
 */
export interface Player {
  // --- identity and body ---
  i: number;
  x: number;
  y: number;
  vx: number;
  vy: number;

  // --- contact with the world ---
  onGround: boolean;
  onLadder: boolean;
  inWater: boolean;
  clinging: boolean;
  /** The side the player is clinging to; `null` when not clinging. */
  clingN: ClingSide | null;
  flying: boolean;
  airTime: number;

  // --- animation ---
  facing: number; // 1 = right, -1 = left
  anim: number;
  walkAnim: number;
  climbFrame: number;
  idleNow: boolean;
  idleTime: number;
  groundIdle: number;
  flavor: number;
  flavorT: number;
  /** The current frame. Opaque to the game — the texture is the renderer's business. */
  _tx: unknown;

  // --- movement ---
  jumpBuffer: number;
  jumpChain: number;
  waterStroke: number;
  walkDir: number;
  hurtTimer: number;

  // --- input edges (one frame long; the input layer sets them) ---
  jumpEdge: boolean;
  runEdge: boolean;
  swapEdge: boolean;
  specialEdge: boolean;
  leftEdge: boolean;
  rightEdge: boolean;

  // --- progress ---
  collected: number;
  owned: string[];
  activePower: string;
  hasKey: boolean;

  // --- per-player settings ---
  /**
   * The key scheme. A player is born with `null` and `assignControls` fills it at boot — hence the `| null`. Modules
   * that only run after boot may treat it as non-null, which is true at that instant but not in the type: a REAL
   * divergence, left visible on purpose — whoever narrows it does so explicitly, where they know it was assigned.
   */
  ctrl: KeyScheme | null;
  /** The gamepad index, or -1 when the player has no physical pad. */
  pad: number;
  /**
   * This child's VISUAL STATE, in TWO AXES plus the simulation (ADR-0076, issue #104).
   *
   * The shape lives in `core/visual-state`; `render/viz-axes` applies it (issue #167).
   */
  visual: VisualState;
  /**
   * @deprecated ⚠️ THE LEGACY MIRROR, and it dies in this migration. While both exist, `setPlayerViz` writes BOTH and a
   * gate requires they never disagree — that lets each reader migrate on its own, with the tree green between steps.
   *
   * ⚠️ AND IT CANNOT EXPRESS WHAT #104 EXISTS TO ALLOW: a child with `hc7` AND a colour correction at once has no single
   * key describing them. So the mirror survives only while the controls still write one value at a time.
   */
  viz: string;
  easy: boolean;
  toggleMove: boolean;
  /**
   * THE RUN-BUTTON TOGGLE (asked for by the Dev): running becomes a STATE instead of "holding".
   *
   * Sibling of `toggleMove` for the same reason — whoever cannot keep a button held could walk without holding and
   * still could not RUN. Automatic on the touch pad.
   */
  toggleRun: boolean;
  /** The run latch: with `toggleRun`, it says whether the player is running now. Lives for a ROUND. */
  runLatch: boolean;
  rmWalk: boolean;
  rmBreath: boolean;
  rmFlavor: boolean;

  // --- audio cadence and hold-to-swap detection (sonar) ---
  stepT: number;
  guardT: number;
  _swapDown: boolean;
  _swapT: number;
  _swapSonar: boolean;

  // --- sprite (made by the renderer, not by the factory) ---
  sprite: PlayerSpriteLike | null;

  // ============================================================================================
  // Added at run time by other subsystems — optional because a freshly made player lacks them.
  // ============================================================================================

  /** The player asked to quit. */
  quit?: boolean;
  /** Joined mid-game and waits for the next round. */
  waiting?: boolean;
  /** The target floor of the lift the player is on. */
  elevTarget?: number | null;
  /** The fall speed remembered for the landing sound. */
  _fallV?: number;
  /** The distance walked since the last cane tap. */
  caneDist?: number;
  /** Uses the running cane (a blind player only runs with it). */
  runCane?: boolean;
  /** The squash factor and the timer that decays it (8 → 0). The two GO TOGETHER — one step writes both and the
   *  drawing reads both. Declaring only `sq` is the half-pair mistake: the field left over has no type at all and
   *  nobody notices, because half the rule still compiles. */
  sq?: number;
  sqT?: number;
  /** The player is walking / running. Derived each frame from speed and contact; they exist because the CANE needs to
   *  know (the running cane only shows when running, and running needs `runCane`). Written by the renderer, never by
   *  the factory. */
  walking?: boolean;
  running?: boolean;
  /** Wins in the literacy activity, reset at each new game. */
  literacyWins?: number;
  /** The player's own audio output; `null`/absent = shared. */
  audioSink?: string | null;
  // `_ac` and `_acOut` do NOT live here (ADR-0039, option A1). They are the AudioContext and gain node of a dedicated
  // output, created by `platform/audio-sonar`, which declares them in `PlayerAudioOut`. The engine's entity declares
  // what the ENGINE owns (ADR-0033), and an AudioContext per player belongs to the audio platform. While they were
  // here, the minimal description disagreed with the real one and an `unknown` hid the disagreement.
  /**
   * The wall-sonar timer, read by the platformer's `platform/audio-nav` (moved there in note CC).
   *
   * ⚠️ `guideT` is gone (#84 item 2): it counted the frames between two guide beeps, and there is no beep left to time.
   * What replaced it — the live audio graph — is not the engine entity's and so is not born here: it lives in
   * `PlayerAudioOut`, beside `_ac`, by the rule the paragraph above explains.
   */
  wnT?: number;
}

/**
 * A player AFTER `assignControls` — `ctrl` is no longer `null`.
 *
 * It names an invariant otherwise assumed in silence: modules that only run after boot treat `ctrl` as non-null. That
 * is true — but it was an assertion hidden inside a retyped interface, where nobody read it as one. Here it has a name,
 * and whoever uses it is saying "I only run after boot", a checkable sentence, instead of not mentioning the `null`.
 */
export type ControlledPlayer = Player & { ctrl: KeyScheme };

/**
 * A shortcut for the narrow views: `PlayerView<'x' | 'y'>` instead of rewriting the fields.
 *
 * The point of not using the whole `Player` is in the header: the Vitest `node` project builds fake players with only
 * the fields a module reads, and a fat interface would make every fixture invent all of them. Deriving keeps the module
 * coupled to its slice while each field's NAME and TYPE have one source.
 */
export type PlayerView<K extends keyof Player> = Pick<Player, K>;
