// SPDX-License-Identifier: AGPL-3.0-or-later
// input/default-bindings — WHAT EACH TRANSPORT OFFERS, BY DEFAULT, FOR EACH OF THE FOURTEEN ACTIONS.
//
// ========================= WHAT THIS IS, AND WHY IT LIVES WHERE IT DOES =========================
// ADR-0085 decided the fourteen POSITIONS (`core/actions.ts`) and said, in so many words, that the physical
// names — L1, R2, X, A — are BINDINGS and live in the transport, not in the vocabulary. This is the file where
// they live. A new transport (speech, gaze, touch) brings its own table and does not touch `core/actions`.
//
// ✅ ALL THREE ARE WIRED:
//
//   · `GAMEPAD_STANDARD` — `input/pad-reading` reads this table's indices instead of literals (and
//     `input/pad-defaults` lays the game's mapping over it). Wiring it caught a real disagreement: `action1` ran
//     on X, R1 and R2 while the table declared R1 and R2 as shoulder and trigger.
//   · `KEYBOARD_SOLO` / `KEYBOARD_DUO` — `input/keyboard` builds `KB_DEFAULTS` from them (`mutableCopy`). They
//     stopped being two parallel lists: they are the SAME decision, derived, so the old divergence cannot come
//     back by forgetting.
//
// ⚠️ AND THE DERIVATION IS BY DEEP COPY (`mutableCopy` is a JSON round-trip), in TWO layers. `input/keyboard`
// copies these tables into `KB_DEFAULTS`, and copies AGAIN into the mutable `kb`. The child's remapping mutates
// `kb` ("remapping one key MUTATES the object", says `setKB`), so it would not reach this even without the first
// copy. What the first layer buys is the rest: `KB_DEFAULTS` is exported, and without it any consumer writing
// into it would change this table's factory default for everyone.
//
// ========================= THE KEYBOARD'S SYMMETRY, WHICH IS NOT DECORATION =========================
// The default the Dev specified rests on a block of the QWERTY:
//
//        7  8          ← L1 over U, R1 over I
//     Y  U  I  O       ← L2 left of U, R2 right of I
//     H  J  K  L
//
// ⚠️ AND THE KEYBOARD↔XBOX MAPPING IS A 45° ROTATION, consistent across all four: X(west)→U(northwest),
// Y(north)→I(northeast), B(east)→K(southeast), A(south)→J(southwest). The pad's diamond lands on the `U I / J K`
// square by turning an eighth. That is why the table sits well under the finger: what muscle memory keeps is the
// RELATIVE POSITION, not the letter.
//
// ⚠️ AND IT WAS THAT SYMMETRY THAT EXPOSED AN ERROR IN THE SPECIFICATION. It arrived with `I` assigned TWICE —
// to `action4` and to R2 —, and the symmetric pair of `Y` (left of U) is `O` (right of I). `O` was adopted. This
// file's gate fails a repeated key, so the error would not have passed anyway; what the symmetry gave was the
// RIGHT key instead of only the news that one was wrong.

import { ACTIONS, type Action } from '../core/actions.js';

/** `null` = this transport does NOT reach this action by default. A declared absence, never an oversight. */
export type Binding<T> = T | null;

// ⚠️ `Space` IS ON `action2` because ADR-0086 §2 put jump there. It was left out of the first version of this
// table, and for a sound reason at the time: the bar has been jump's second shortcut forever, the specification
// did not mention it, and putting it on `action2` unasked would have decided where jump lives. Once the Dev
// decided that (ADR-0086 §2), the bar came back.

/**
 * Keyboard, SOLO scheme. `KeyboardEvent.code` codes — physical, not the printed letter, which changes with the
 * ABNT2/US layout and is the reason `key` is never used here.
 */
export const KEYBOARD_SOLO: Readonly<Record<Action, Binding<readonly string[]>>> = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  action1: ['KeyU'],
  action2: ['KeyJ', 'Space'],
  action3: ['KeyK'],
  action4: ['KeyI'],
  leftShoulder: ['Digit7'],  // L1
  leftTrigger: ['KeyY'],    // L2
  rightShoulder: ['Digit8'],  // R1
  rightTrigger: ['KeyO'],    // R2 — see the symmetry note above
  // ⚠️ AND THESE TWO CLOSE A DEBT ADR-0074 §1 RECORDED: `start` existed in two transports of nine and was missing
  // from the keyboard. It is no longer missing. The symmetry is one of HANDS: `F` sits by the thumb of the hand that
  // moves (the WASD block), `H` by the hand that acts (the UIJK block).
  // `Enter` goes with `H` because it ALREADY paused — `input/keydown` has `PAUSE_KEYS = {Escape, Enter}` —, so
  // declaring it here describes what the key has long done instead of giving it a new job.
  start: ['KeyH', 'Enter'],
  select: ['KeyF'],
};

/**
 * Keyboard, TWO-PLAYER scheme — the fourteen positions for each (ADR-0096).
 *
 * ⚠️ PLAYER 1 HERE IS NOT `KEYBOARD_SOLO`, and the difference is ONE and mandatory: the ARROWS leave it. In solo
 * they are a second path for the d-pad; in duo they are the OTHER player's d-pad. Leaving them in both would make
 * the two characters walk together — a defect that raises no error anywhere and only shows when playing as two.
 * `conflictsBetweenTables` exists because of this line.
 *
 * ⚠️ AND PLAYER 2'S GEOMETRY IS PLAYER 1'S, MOVED TO THE NUMERIC KEYPAD — which is what carries muscle memory from
 * one side of the table to the other:
 *
 *        7  8            /  *          shoulders on the TOP row
 *     Y  U  I  O      7  8  9  +       triggers at the ENDS of the action row
 *        J  K            5  6
 *
 *   action1 U ↔ Numpad8 (top-left)      action4 I ↔ Numpad9 (top-right)
 *   action2 J ↔ Numpad5 (bottom-left)   action3 K ↔ Numpad6 (bottom-right)
 *
 * The `U I / J K` block and the `8 9 / 5 6` block have the SAME shape, so the 45° rotation this file's header
 * describes for the Xbox holds for player 2 as well. It is not a keyboard coincidence: it is what makes the default
 * teachable once.
 *
 * ⚠️ `Digit7`/`Digit8` (player 1) and `Numpad7` (player 2) ARE DIFFERENT KEYS, which is why the Dev's specification
 * says «alphanumeric» and «numeric» in so many words. `KeyboardEvent.code` always tells them apart; `key` does not —
 * with Num Lock off the keypad arrives as `ArrowUp`/`Home`, and a scheme read by `key` would merge player 2's d-pad
 * with their actions. One more reason this file only speaks `code`.
 */
export const KEYBOARD_DUO: readonly Readonly<Record<Action, Binding<readonly string[]>>>[] = Object.freeze([
  {
    // PLAYER 1 — the left hand moves (WASD), the right acts (UIJK). No arrows: they are player 2's.
    up: ['KeyW'],
    down: ['KeyS'],
    left: ['KeyA'],
    right: ['KeyD'],
    action1: ['KeyU'],
    action2: ['KeyJ', 'Space'],
    action3: ['KeyK'],
    action4: ['KeyI'],
    leftShoulder: ['Digit7'],
    leftTrigger: ['KeyY'],
    rightShoulder: ['Digit8'],
    rightTrigger: ['KeyO'],
    start: ['KeyH', 'Enter'],
    select: ['KeyF'],
  },
  {
    // PLAYER 2 — the arrows move, the numeric keypad acts. `Enter` stays with player 1; `NumpadEnter` is left out on
    // purpose, because `ui/menu-intent` already uses it as CONFIRM in every menu (KEY_YES) and `input/keydown`
    // records that it does NOT pause. Giving it a third job would overlap.
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    action1: ['Numpad8'],
    action2: ['Numpad5'],
    action3: ['Numpad6'],
    action4: ['Numpad9'],
    leftShoulder: ['NumpadDivide'],     // the keypad's `/` key
    leftTrigger: ['Numpad7'],
    rightShoulder: ['NumpadMultiply'],  // the `*` key
    rightTrigger: ['NumpadAdd'],        // the `+` key
    /**
     * ⚠️ `ShiftRight` IS THE WAY OUT, AND IT WAS MISSING (#122).
     *
     * A Chromebook has no numeric keypad, and a Chromebook is the hardware pillar 1 names. Of this seat's fourteen
     * positions, **TEN are reachable only through the keypad** — the eight actions plus `start` and `select`. The
     * child in the second chair moves with the arrows, acts on nothing, and **cannot open the menu to fix it**,
     * because the key that opens the menu is in the same missing block.
     *
     * That is what the audit called «um padrão do qual a criança não escapa», and the fix it asks for is literal:
     * *«tornar o próprio padrão remapeável, e não trocar as teclas que ele escolheu».* The keys stay — the keypad
     * layout is better where it exists, it is one physical block under one hand, and it takes nothing from the first
     * player. What enters is ONE door every keyboard has, so the remapping is reachable.
     *
     * ⚠️ AND ONLY ON `start`, on purpose: from the pause the remapping screen is reachable, and from there ALL the
     * other thirteen positions. One door is enough to escape; each extra default is a key taken from the common pool,
     * and this keyboard is already shared by two children.
     *
     * `ShiftRight` because every keyboard has it, it sits beside the arrow block (the same hand that already uses
     * them), it is not a text key — and it is FREE in all four tables, which was measured and not assumed.
     */
    start: ['Numpad1', 'ShiftRight'],
    select: ['Numpad0'],
  },
]);

/**
 * Gamepad, the Gamepad API's STANDARD map (`mapping: "standard"`), which is what an Xbox controller reports.
 * The number is the index into `gamepad.buttons`.
 */
export const GAMEPAD_STANDARD: Readonly<Record<Action, Binding<number>>> = {
  // The directions do not come from buttons: they come from stick 0/1 and the D-pad 12–15, in `stdDirs`. Declaring
  // `null` here would say "does not reach", which is false — that is why the D-pad indices are named.
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  action1: 2,   // X
  action2: 0,   // A
  action3: 1,   // B
  action4: 3,   // Y
  leftShoulder: 4,   // L1
  leftTrigger: 6,   // L2 — ⚠️ ANALOGUE trigger: the API exposes it as a button with `.value`, and on some
                //     controllers also as an axis. `bindActive` already handles both; `padActions` only reads
                //     `pressed`, which works but throws away the trigger's travel.
  rightShoulder: 5,   // R1
  rightTrigger: 7,   // R2 — same analogue caveat
  start: 9,     // Start / Menu
  select: 8,    // Select / Back / View
};

/**
 * Every problem in a binding table. EMPTY means conformant.
 *
 * ⚠️ WHAT THIS EXISTS TO CATCH IS THE DOUBLE, and it has already happened: the specification arrived with `I` on two
 * actions. A duplicated binding raises no error anywhere — the two actions fire together, and the child sees an
 * intermittent double action nobody can reproduce on purpose.
 */
export function bindingProblems<T>(table: Readonly<Record<Action, Binding<T | readonly T[]>>>): string[] {
  const p: string[] = [];
  const actionOfKey = new Map<string, Action>();

  for (const action of ACTIONS) {
    if (!(action in table)) { p.push(`binding: ${action} is not declared - write null if the transport cannot reach it`); continue; }
    const v = table[action];
    if (v === null) continue;
    const keyList = Array.isArray(v) ? v : [v];
    if (keyList.length === 0) { p.push(`binding: ${action} has an empty list - write null instead`); continue; }
    for (const item of keyList) {
      const key = String(item);
      const previous = actionOfKey.get(key);
      if (previous) p.push(`binding: ${key} is bound to both ${previous} and ${action}`);
      else actionOfKey.set(key, action);
    }
  }
  return p;
}

/**
 * The keys TWO OR MORE tables claim. EMPTY means the players do not trample each other.
 *
 * ⚠️ THIS IS A DIFFERENT PROBLEM FROM `bindingProblems`, WHICH IS WHY IT NEEDED ITS OWN FUNCTION: that one looks at
 * ONE table and catches the same key on two actions; this one looks at TWO tables and catches the same key on two
 * PLAYERS. Each `KEYBOARD_DUO` scheme passes the first on its own — and the arrows, if they stayed in both, would make
 * the two characters walk together with nothing failing.
 *
 * The message names both owners, because "repeated key" sends someone looking for what the function already knows.
 */
export function conflictsBetweenTables<T>(
  tables: readonly Readonly<Record<Action, Binding<T | readonly T[]>>>[],
): string[] {
  const p: string[] = [];
  const actionOfKey = new Map<string, string>();
  tables.forEach((table, i) => {
    for (const action of ACTIONS) {
      const v = table[action];
      if (v === null || v === undefined) continue;
      for (const item of (Array.isArray(v) ? v : [v]) as readonly T[]) {
        const key = String(item);
        const here = `p${i + 1}.${action}`;
        const previous = actionOfKey.get(key);
        if (previous) p.push(`cross: ${key} is claimed by both ${previous} and ${here}`);
        else actionOfKey.set(key, here);
      }
    }
  });
  return p;
}

/** The actions this transport does NOT reach. It is what a selection screen has to say BEFORE the child starts. */
export function unreachable<T>(table: Readonly<Record<Action, Binding<T | readonly T[]>>>): Action[] {
  return ACTIONS.filter((a) => table[a] === null || table[a] === undefined);
}
