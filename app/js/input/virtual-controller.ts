// SPDX-License-Identifier: AGPL-3.0-or-later
// input/virtual-controller — THE ENGINE CARRIES THE VIRTUAL BUTTON TO THE GAME (ADR-0111 and its erratum of 2026-09-16; issue #197).
//
// The Dev: «a engine lida com o hardware e passa para o jogo o nome virtual do botão, o jogo por sua vez devolve o nome do que é executado
// ao apertar cada botão… a engine leva o evento para o jogo». A transport that reads positions (the eyes, and later the face and the
// hands) presses and releases a position here, with its source; this decides what that reaches:
// · with a menu open, the position is the menu's key — the way the touch pad already moves menus (ADR-0157), since menus read keys;
// · in play, the child's key for that position is held (games that ask what is held keep answering), and the command is delivered to the
//   cartridge: the position, pressed or released, the source, the seat. The cartridge's map (its `preset`) says what it executes.
// A position the child's scheme gives no key is still delivered: the map belongs to the game, not to the keyboard.

import type { Action } from '../core/actions.js';
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
}

export interface VirtualController {
  /**
   * Presses a position. Answers whether it reached PLAY — `false` means a menu took it.
   *
   * 🔴 THE ANSWER EXISTS BECAUSE EVERY TRANSPORT NEEDS IT AND EACH WAS GUESSING IT (ADR-0223). The touch pad asked its own
   * `emMenu()` before deciding what to do, which is the same question this function has just answered — and two answers to
   * one question is how the two doors came to disagree about what happens with a menu open. A transport that raises an edge,
   * or hides its tips, or announces something, does it only when the press reached the game; now it is told.
   */
  press(action: Action, source: TransportName | undefined, player?: number): boolean;
  release(action: Action, source: TransportName | undefined, player?: number): void;
}

export function createVirtualController(d: VirtualControllerDeps): VirtualController {
  // `${player}:${action}` → the key held for a press the game received (or null when the scheme has none), so the release lets go of the
  // same key, and only a press the game heard is released to it
  const held = new Map<string, string | null>();
  return {
    press(action, source, player = 0) {
      const code = d.scheme(player)[action]?.[0];
      if (d.menuOpen()) { if (code) d.menuKey(code, source); return false; }
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
