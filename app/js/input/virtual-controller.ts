// SPDX-License-Identifier: AGPL-3.0-or-later
// input/virtual-controller — THE ENGINE CARRIES THE VIRTUAL BUTTON TO THE GAME (ADR-0111 and its erratum of 2026-09-16; issue #197).
//
// The Dev: «a engine lida com o hardware e passa para o jogo o nome virtual do botão, o jogo por sua vez devolve o nome do que é executado
// ao apertar cada botão… a engine leva o evento para o jogo». A transport that reads positions (the eyes, and later the face and the
// hands) presses and releases a position here, with its source; this decides what that reaches:
// · with a menu open, the position is the menu's key — the way the touch pad already moves menus (ADR-0157), since menus read keys —
//   unless the engine answers it there itself (`menuAnswers`: the sonar reads the menu, ADR-0234);
// · in play, the child's key for that position is held (games that ask what is held keep answering), and the command is delivered to the
//   cartridge: the position, pressed or released, the source, the seat. The cartridge's map (its `preset`) says what it executes.
// A position the child's scheme gives no key is still delivered: the map belongs to the game, not to the keyboard.
// 🔴 EXCEPT THE TWO SYSTEM POSITIONS, which never reach play (ADR-0144 §4, ADR-0155 §4): `start` is the quick pause and `select`
// opens the menus, a cartridge may not declare either, so the game has no word for them and nothing to do with them. 📏 Before
// this, Enter in play opened the quick pause AND the quiz's `onCommand` heard `start`; F opened the card AND it heard `select`.
// In play they go to the ENGINE instead (`systemPress`), so START and SELECT open the pause «from any transport» (ADR-0144 §1):
// the eyes, the face, the hands, the voice and the scan press here and have no key in the world for the engine to hear.
// With a menu open they are the menu's key like any other position — that is how a camera's START leaves the quick pause.

import { SYSTEM, type Action } from '../core/actions.js';
import type { KeyScheme } from '../core/entity.js';
import type { TransportName } from './transport-in-use.js';

export interface VirtualCommand {
  readonly action: Action;
  readonly pressed: boolean;
  /** Who produced it (ADR-0111 §2); `undefined` when nobody said. */
  readonly source: TransportName | undefined;
  readonly player: number;
}

export interface VirtualControllerDeps {
  readonly scheme: (player: number) => KeyScheme;
  readonly menuOpen: () => boolean;
  /**
   * Holds the child's key for this position.
   *
   * ⚠️ `source` CAN BE UNDEFINED, and that is not sloppiness: a real key press carries no stamp, so the keyboard —
   * the one transport whose native currency IS the key — arrives unsigned. `input/state` already has the narrow
   * door for exactly that (`markKeyWithoutSource`), and the host wires this to it: a key whose producer nobody
   * declared must ERASE the previous producer rather than inherit it (ADR-0109).
   */
  readonly holdKey: (code: string, source: TransportName | undefined) => void;
  readonly releaseKey: (code: string) => void;
  /**
   * A menu is moved by its key, as the touch pad does, stamped with the transport that pressed it.
   *
   * 📌 This is the POSITION → KEY translator, and it exists for transports that do not produce keys. The keyboard
   * does, so its key is already in the world before this is reached — the host's implementation says so.
   */
  readonly menuKey: (code: string, source: TransportName | undefined) => void;
  readonly deliver: (command: VirtualCommand) => void;
  /**
   * A position the ENGINE answers itself while a menu is open, before it becomes a menu key: the sonar reads the menu in
   * front (ADR-0234, `ui/screen-text.menuSonarPress`). Answers whether it took the press. Absent: every position is a key.
   */
  readonly menuAnswers?: (action: Action, player: number) => boolean;
  /**
   * A SYSTEM position pressed in play: the engine opens its pause for that seat — `start` the quick pause, `select` the menus
   * (ADR-0144 §1, ADR-0155). Absent: it does nothing, as before.
   *
   * ⚠️ The keyboard does not come here: its key is already in the world, and the engine's own key listeners answer it even for
   * a cartridge with no `onCommand` — the host's keyboard conductor does not press these two, or one key would pause twice.
   */
  readonly systemPress?: (action: Action, player: number) => void;
}

export interface VirtualController {
  /**
   * Presses a position. Answers whether it reached PLAY — `false` means a menu took it, or it was held back (`toPlay`).
   *
   * 🔴 THE ANSWER EXISTS BECAUSE EVERY TRANSPORT NEEDS IT AND EACH WAS GUESSING IT (ADR-0223). The touch pad asked its own
   * `emMenu()` before deciding what to do, which is the same question this function has just answered — and two answers to
   * one question is how the two doors came to disagree about what happens with a menu open. A transport that raises an edge,
   * or hides its tips, or announces something, does it only when the press reached the game; now it is told.
   *
   * `toPlay` false: in play the press belongs to something else — the keyboard knows what has the focus, a field being typed
   * into or the engine's own control being pressed (`input/key-default`) — so it reaches nobody: nothing held, nothing delivered.
   * With a menu open it is the menu's all the same, as every press is (ADR-0111 erratum of 2026-09-26: one press, one action).
   *
   * A system position (`start`, `select`) never reaches play, whatever `toPlay` says: it is the engine's (ADR-0144 §4), and in
   * play it goes to `systemPress` — unless `toPlay` is false, when the press belongs to something else and reaches nobody.
   */
  press(action: Action, source: TransportName | undefined, player?: number, toPlay?: boolean): boolean;
  release(action: Action, source: TransportName | undefined, player?: number): void;
}

/** The positions that are the engine's and never the game's (`core/actions.SYSTEM`). */
const ENGINE_POSITIONS: ReadonlySet<Action> = new Set(SYSTEM);

export function createVirtualController(d: VirtualControllerDeps): VirtualController {
  // `${player}:${action}` → the key held for a press the game received (or null when the scheme has none), so the release lets go of the
  // same key, and only a press the game heard is released to it
  const held = new Map<string, string | null>();
  return {
    press(action, source, player = 0, toPlay = true) {
      const code = d.scheme(player)[action]?.[0];
      if (d.menuOpen()) {
        if (!d.menuAnswers?.(action, player) && code) d.menuKey(code, source);
        return false;
      }
      if (!toPlay) return false;
      if (ENGINE_POSITIONS.has(action)) { d.systemPress?.(action, player); return false; }
      if (code) d.holdKey(code, source);
      held.set(`${player}:${action}`, code ?? null);
      d.deliver({ action, pressed: true, source, player });
      return true;
    },
    release(action, source, player = 0) {
      const key = `${player}:${action}`;
      if (!held.has(key)) return;
      const code = held.get(key);
      held.delete(key);
      if (code) d.releaseKey(code);
      // delivered even if a menu opened meanwhile: a game must never be left believing a button is still down
      d.deliver({ action, pressed: false, source, player });
    },
  };
}
