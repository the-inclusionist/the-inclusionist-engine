// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/motion-scene — SCENE REDUCED MOTION BELONGS TO THE ENGINE (ADR-0106 §4, step 1).
//
// The four things a game used to hand over — the flags, the scene keys, the character animations and the save — hold
// no choice of the game: the scene keys are the WHOLE `MotionSceneKey` union, the character animations are the three
// `MotionCharProp`s with keys `RM_LABEL` already translates, and the flags are read and saved under an engine key with
// an engine default. ADR-0106 called them the game's BY ACCIDENT. A copy is not a decision, and the cost was not
// elegance: every cartridge had to remember four lines, and a child who needs to stop the scene's motion had nowhere
// to do it in the games that forgot.
//
// ⚠️ WHAT STAYS THE GAME'S, by nature: the EFFECT. Whoever reads `rm.decor` to freeze the clouds is the game — the
// engine owns the switch, not what it turns off. The value is the engine's, the side effect is the cartridge's.
//
// ⚠️ AND THE OBJECT IS SHARED BY REFERENCE, on purpose. A cartridge reads `rm.decor`/`rm.particles` from many modules
// every frame. Handing out a copy would make each reader see a value frozen at boot, and the switch would stop doing
// anything — silently.
//
// ⚠️ THE VOCABULARY LIVES HERE, not in `settings-motion`: the panel imports the values from here, so the types there
// would make an import cycle. The vocabulary belongs to whoever owns the VALUES, and the panel consumes it;
// `settings-motion` keeps the published names by alias, so no consumer's import line changes.
import * as store from '../platform/storage.js';
import { defaultReducedMotion } from '../core/state.js';
import type { PlayerView } from '../core/entity.js';

/** The four SCENE animations, as a closed vocabulary. */
export type MotionSceneKey = 'parallax' | 'decor' | 'items' | 'particles';
/** The three CHARACTER ones, which are player fields. */
export type MotionCharProp = 'rmWalk' | 'rmBreath' | 'rmFlavor';
/** A character animation and the i18n key of its label. */
export interface MotionCharDef {
  readonly prop: MotionCharProp;
  readonly lbl: string;
}
/** ⚠️ `PlayerView` and not `Record`: a `Record` accepts any object with those keys, player or not. */
export type MotionPlayer = PlayerView<'rmWalk' | 'rmBreath' | 'rmFlavor'>;
/** The four scene switches. A LIVE object — see the note on sharing by reference at the top. */
export type MotionSceneFlags = Record<MotionSceneKey, boolean>;

/** The four SCENE animations. They are the whole union, and the compiler proves it just below. */
export const SCENE_KEYS = ['parallax', 'decor', 'items', 'particles'] as const;

/**
 * ⚠️ THE PROOF THAT THE LIST COVERS THE UNION, made by the COMPILER and not by a test.
 *
 * A hand-written list beside a union is the defect this file exists to undo — it would swap the cartridge's copy for an
 * engine copy. If someone adds a fifth key to `MotionSceneKey` and forgets the list, `_Missing` stops being `never` and
 * this line does not compile.
 *
 * `[X] extends [never]` and not `X extends never`: the conditional distributes over `never` and would give `never`
 * instead of `true`, making the guard always pass — a guard that cannot fail is not a guard.
 */
type _Missing = Exclude<MotionSceneKey, (typeof SCENE_KEYS)[number]>;
const _COVERS_THE_UNION: [_Missing] extends [never] ? true : false = true;
void _COVERS_THE_UNION;

/** The three CHARACTER animations, with the keys `RM_LABEL` in this same layer already translates. */
export const CHARACTER_ANIMATIONS = Object.freeze([
  { prop: 'rmWalk', lbl: 'rm.walk' },
  { prop: 'rmBreath', lbl: 'rm.breath' },
  { prop: 'rmFlavor', lbl: 'rm.flavor' },
] as const) satisfies readonly MotionCharDef[];

/** The same proof, for the three character ones: one missing from the list and this stops compiling. */
type _MissingChar = Exclude<MotionCharProp, (typeof CHARACTER_ANIMATIONS)[number]['prop']>;
const _COVERS_THE_CHARACTER: [_MissingChar] extends [never] ? true : false = true;
void _COVERS_THE_CHARACTER;

/** The four switches at the system default — `prefers-reduced-motion`, through `defaultReducedMotion()`. */
export function sceneDefault(): MotionSceneFlags {
  const o = {} as MotionSceneFlags;
  const byDefault = defaultReducedMotion();
  for (const k of SCENE_KEYS) o[k] = byDefault;
  return o;
}

/**
 * The stored state, or the system default when nothing is stored.
 *
 * ⚠️ EACH KEY IS READ ONE BY ONE, not spread. What is in storage came from a child's browser and may be truncated or
 * from an earlier version: spreading the object would bring extra keys and leave missing ones unfilled, and a missing
 * key reads as `undefined` — which is "not reduced" for whoever asked for reduction. The loop guarantees exactly four.
 */
export function readStoredScene(): MotionSceneFlags {
  const stored = store.getJSON<Record<string, unknown> | null>(store.KEYS.reducedMotion, null);
  if (!stored || typeof stored !== 'object') return sceneDefault();
  const o = {} as MotionSceneFlags;
  for (const k of SCENE_KEYS) o[k] = !!stored[k];
  return o;
}

/** Stores the four switches. Called after each change. */
export function storeScene(rm: MotionSceneFlags): void {
  store.setJSON(store.KEYS.reducedMotion, rm);
}
