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
import type { Transporte } from './transporte-em-uso.js';

export interface VirtualCommand {
  readonly action: Action;
  readonly pressed: boolean;
  /** Who produced it (ADR-0111 §2); `undefined` when nobody said. */
  readonly source: Transporte | undefined;
  readonly player: number;
}

export interface VirtualControllerDeps {
  readonly scheme: (player: number) => KeyScheme;
  readonly menuOpen: () => boolean;
  readonly holdKey: (code: string, source: Transporte) => void;
  readonly releaseKey: (code: string) => void;
  /** A menu is moved by its key, as the touch pad does, stamped with the transport that pressed it. */
  readonly menuKey: (code: string, source: Transporte) => void;
  readonly deliver: (command: VirtualCommand) => void;
}

export interface VirtualController {
  press(action: Action, source: Transporte, player?: number): void;
  release(action: Action, source: Transporte, player?: number): void;
}

export function createVirtualController(d: VirtualControllerDeps): VirtualController {
  // `${player}:${action}` → the key held for a press the game received (or null when the scheme has none), so the release lets go of the
  // same key, and only a press the game heard is released to it
  const held = new Map<string, string | null>();
  return {
    press(action, source, player = 0) {
      const code = d.scheme(player)[action]?.[0];
      if (d.menuOpen()) { if (code) d.menuKey(code, source); return; }
      if (code) d.holdKey(code, source);
      held.set(`${player}:${action}`, code ?? null);
      d.deliver({ action, pressed: true, source, player });
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
