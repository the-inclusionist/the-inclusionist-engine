// SPDX-License-Identifier: AGPL-3.0-or-later
// input/edges — the "action → input edge" table, and the rule of who may raise it. A LEAF module: no imports, no DOM,
// no state.
//
// WHY THIS EXISTS AS A MODULE
// An "edge" is the instant the player JUST triggered something — `jumpEdge`, `runEdge`, `leftEdge`… — as opposed to
// holding it. The three input paths raise edges, and each had its own copy of the same table: three copies that had to
// agree, with nothing forcing them.
//
// They diverged. The touch copy lacked the Easy-mode guard, and since `runEdge` is not the running speed — it is the
// trigger that clings to and lets go of a wall — a child in Easy mode (which exists for motor difficulty) could not climb
// with keyboard or pad and could with the on-screen button. On a public-school tablet, touch is not the alternative path:
// it is the only one. The symptom was fixed before this module; this module is what keeps the divergence from coming
// back, because there is only one place left for it to live.
//
// THE TABLE'S ORDER IS OBSERVABLE: the edges come back in the order it is walked, and a test anchors it.

/** The six input edges, by the name of the field they raise on the player. */
export type EdgeFlag = 'jumpEdge' | 'runEdge' | 'leftEdge' | 'rightEdge' | 'swapEdge' | 'specialEdge';
/** The six actions that raise an edge. Named (not `string`) so the compiler matches it with the pad transport, which
 *  reads the table passing the action on. */
export type EdgeAction = 'action2' | 'action1' | 'left' | 'right' | 'action4' | 'action3';

/** Action → edge, in the ORDER the three paths raise them. */
export const EDGE_BY_ACTION: ReadonlyArray<readonly [EdgeAction, EdgeFlag]> = Object.freeze([
  ['action2', 'jumpEdge'], ['action1', 'runEdge'], ['left', 'leftEdge'],
  ['right', 'rightEdge'], ['action4', 'swapEdge'], ['action3', 'specialEdge'],
] as ReadonlyArray<readonly [EdgeAction, EdgeFlag]>);

/**
 * May this player raise this action's edge?
 *
 * There is one rule today, and it is about accessibility: in Easy mode `action1` raises no edge — no running, and so no
 * wall climbing. It holds for keyboard, pad and touch, which is exactly the point. A second rule would enter HERE and
 * hold for all three at once.
 */
export function edgeAllowed(action: EdgeAction, easy: boolean | undefined): boolean {
  return !(action === 'action1' && !!easy);
}

// ---------------------------------------------------------------------------------------------
// THE INTENT TO NAVIGATE A MENU
// ---------------------------------------------------------------------------------------------

/**
 * The six menu-navigation intents — the edges' story, one floor up.
 *
 * It was declared FOUR times, and three of them carried a comment saying "SAME shape as…", which is a copy asking to be
 * noticed. They had already diverged: one declared the six fields OPTIONAL and the other three required.
 *
 * It lives in `input/` because it is an INPUT intent: the translators (keyboard, pad, touch, voice, camera) produce it and
 * the UI consumes it. `input/` never imports `ui/`; `ui/` imports `input/`. That is the direction.
 *
 * OPTIONAL on purpose, unlike the edges: a translator sends only what happened. `{ down: true }` is a whole sentence —
 * "down" — and requiring the other five `false`s would make every call carry five negations nobody reads.
 */
export interface NavKeys {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
  /** Confirm / enter. */
  yes?: boolean;
  /** Back / cancel. */
  no?: boolean;
}

/**
 * Was any intent expressed this frame? With no intent, the key is NOT consumed — no `preventDefault`, no
 * `stopPropagation`, no navigation.
 *
 * It was written TWICE, with the same body under two names; the canonical one erases both, and the two modules re-export
 * it under the names their callers and tests already use.
 *
 * The `!!` matters: with optional fields, the `||` chain returns `boolean | undefined`. The compiler pointed it out when
 * the type narrowed — both functions had been returning `undefined` as if it were `false`.
 */
export function hasNavIntent(k: NavKeys): boolean {
  return !!(k.yes || k.no || k.up || k.down || k.left || k.right);
}
