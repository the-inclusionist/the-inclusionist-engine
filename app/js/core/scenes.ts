// SPDX-License-Identifier: AGPL-3.0-or-later
// core/scenes — THE SCENE STACK (item 22, option C3 of ADR-0030). A LEAF module: no dependencies, no I/O.
//
// ========================= WHAT IT REPLACES, AND WHY IT IS NOT A BIGGER ENUM =========================
// A `phase: 'title' | 'playing' | 'paused'` union is a vocabulary, and ADR-0030 records widening it (C1) as a
// NON-OPTION for a short reason: a second game would stay tied to OUR enum. A game with a map screen, one with a
// results screen, one with a password between sessions would each have to ask the engine for a new constant to exist.
//
// A STACK does not have that problem because it has no vocabulary: it knows scenes are stacked and nothing about what
// each means. `title/playing/paused` becomes `[title]`, `[game]`, `[game, pause]` — and a level map becomes `[map]`
// without this file changing a line.
//
// ========================= THE THREE RULES, AND WHAT EACH PRESERVES =========================
// They are not library convention: each reproduces a behaviour the game already has.
//
//   · `update` ONLY AT THE TOP. It is the pause freeze — structural here: a scene that is not on top gets no time.
//   · `draw` FROM THE BOTTOM UP. It is the pause menu drawn OVER the world, with the world still visible. Drawing only
//     the top would make pausing erase the game from the screen.
//   · `input` ONLY AT THE TOP, and it SAYS whether it consumed. The shape ADR-0033 gave modal input: whoever is on
//     top decides, and what they do not want goes back down. Without the return value the stack would have to guess.
//
// ========================= WHAT IT DOES NOT DO =========================
// It does not draw, listen for events, or know PIXI or the DOM. It takes `dt` and returns nothing; it takes an intent
// and returns a boolean. That is what makes it testable without a browser and importable from both sides of the boundary.

/**
 * A scene. Every hook is OPTIONAL on purpose: a title screen that only draws should not have to declare an empty
 * `update`, and a dialog that only listens should not have to declare a `draw`.
 */
export interface Scene {
  /** A readable name — for debugging, and so tests assert the stack by name, not identity. */
  readonly name: string;
  /** Called on ENTERING (push, or reappearing on top after a pop). */
  enter?(): void;
  /** Called on LEAVING (pop, or being covered by a push). */
  exit?(): void;
  /** Time. Only the top gets it. */
  update?(dt: number): void;
  /** Drawing. All get it, bottom up. */
  draw?(): void;
  /** Input. Only the top gets it. Return `true` if consumed — `false`/nothing lets the key go on. */
  input?(intent: string): boolean | void;
}

export interface SceneStack {
  /** Pushes `s` on top. The previous one gets `exit()` but STAYS on the stack (and is still drawn). */
  push(s: Scene): void;
  /** Pops the top and returns it (or `null` if empty). Whoever reappears gets `enter()`. */
  pop(): Scene | null;
  /** Swaps the top — `pop` then `push` in one call, because that is what "go to another screen" means. */
  replace(s: Scene): void;
  /** The top scene, or `null`. */
  top(): Scene | null;
  /** The names, bottom to top. A copy: whoever reads cannot mutate the stack by accident. */
  names(): string[];
  update(dt: number): void;
  draw(): void;
  /** Returns `true` if the top scene consumed the intent. */
  input(intent: string): boolean;
}

/**
 * Creates an empty stack.
 *
 * ⚠️ Are `enter`/`exit` called inside TRY/CATCH? NO — and it is a decision, not an oversight. An error inside `enter()`
 * means the scene did not mount; swallowing it would leave the stack in a state nobody declared, and the symptom would
 * show three frames later, far from the cause. `update`/`draw`/`input` propagate too: the engine is not the place to
 * decide that a game's error does not matter.
 */
export function createSceneStack(): SceneStack {
  const stack: Scene[] = [];

  return {
    push(s) {
      stack[stack.length - 1]?.exit?.();
      stack.push(s);
      s.enter?.();
    },

    pop() {
      const out = stack.pop() ?? null;
      out?.exit?.();
      stack[stack.length - 1]?.enter?.();
      return out;
    },

    replace(s) {
      // NOT `this.pop()` then `this.push(s)`: that would give the scene below an `enter()` for an instant, and it
      // would reappear on top between the two calls. Swapping is ONE transition, not two.
      const out = stack.pop() ?? null;
      out?.exit?.();
      stack.push(s);
      s.enter?.();
    },

    top() { return stack[stack.length - 1] ?? null; },
    names() { return stack.map((s) => s.name); },

    update(dt) { stack[stack.length - 1]?.update?.(dt); },

    draw() { for (const s of stack) s.draw?.(); },

    input(intent) { return stack[stack.length - 1]?.input?.(intent) === true; },
  };
}

/**
 * WHAT THE SHELL NEEDS TO KNOW ABOUT THE SCENE — three booleans, and no phase name.
 *
 * It was a `Phase` union. Widening it is a NON-OPTION (ADR-0030): a second game would stay tied to OUR vocabulary.
 *
 * And the repository already learned this once, by evidence and not taste: the demo quiz had to declare itself
 * "paused" to walk its own menus, because the menu navigation imported the phase. The fix there was a BOOLEAN,
 * `isNavigable()`. This is the same fix, applied to the whole shell.
 *
 * Whoever NAMES the scenes is the composition root. It builds the stack and translates the top into these three facts.
 * A fourth scene the shell does not know answers `false` to all three, and the projection still makes sense: no splash,
 * no pause menu, sound muted, focus on the title.
 */
export interface SceneFacts {
  /** The top is the title screen (the splash covers the world). */
  titleScreen: boolean;
  /** The top is the GAME — the world gets time, sound plays, the touch pad may appear. */
  worldRunning: boolean;
  /** The top is the pause menu. The game stays on the stack below, still drawn. */
  pauseMenu: boolean;
}
