// SPDX-License-Identifier: AGPL-3.0-or-later
// input/switch-scan — PLAYING WITH ONE BUTTON: the machine offers, the child takes (ADR-0218, issue #201).
//
// The Dev, 2026-09-21: «vamos ciclar entre controle padrão > teclas de aderência > jogar com um botão só». This module is the
// third position, and it answers a different question from the second one. Sticky keys are about HOW LONG a press lasts — the
// child taps instead of holding, and still has to reach every position. This is about HOW MANY inputs exist in the world: with
// one switch, fourteen positions cannot be reached at all, so the controller stops being fourteen places and becomes one place
// plus TIME. It is scanning, the technique switch access has used since long before this engine.
//
// 🎯 THE FIRST ITEM IS «CANCEL», AND IT IS ALSO THE PROTECTION. A press that lands by accident has to be able to mean nothing;
// and because the scan RESTARTS on cancel after every press, a hand that bounces twice takes cancel the second time. That is why
// there is no dead time here: the restart already is one, and it costs the child nothing to explain.
//
// ⚠️ This module knows nothing about keys, switches or pixels. It is given a list and a clock, and it says what is showing and
// what a press just took — the same division that let `input/gaze-cycle` be tested without a camera.
//
// MUTATIONS CHECKED: `tests/switch-scan.node.test.js`.

import type { Action } from '../core/actions.js';

/** The safe item: taking it commands nothing. Same word the gaze cycle uses, and the same job. */
export const SCAN_CANCEL = 'cancel';
export type ScanItem = Action | typeof SCAN_CANCEL;

export interface SwitchScanOptions {
  /** How long each item is offered. 1 s is the gaze cycle's step, which the Dev ran for a day (ADR-0213). */
  readonly stepMs?: number;
  /** How long the taken action stays pressed, so a game and a menu see a normal press and release. */
  readonly pulseMs?: number;
}

export const SWITCH_SCAN_DEFAULTS = { stepMs: 1000, pulseMs: 400 } as const;
// 📌 The four steps a child chooses from (0.8, 1, 1.5, 2 s) live with the ROW that offers them, and are not exported here ahead
// of it: a list nobody reads is the hook with no consumer this repository refuses, and the gate said so before this comment did.

export interface ScanFrame {
  /** Her switch went down on this frame. Whatever sends it — a key, a touch, a gesture, a word. */
  readonly press?: boolean;
}

export interface ScanOutput {
  /** The action being pressed, for `pulseMs` after it was taken. */
  readonly pressed: Action | null;
  /** The action taken on THIS frame — what a caller turns into a press. */
  readonly commanded: Action | null;
  /** What is being offered right now, and where it sits in the list. Never `null`: something is always showing. */
  readonly showing: { readonly item: ScanItem; readonly index: number };
}

export interface SwitchScan {
  (nowMs: number, frame?: ScanFrame): ScanOutput;
}

/**
 * The scanner. `actions` is what THIS game offers — its declared positions and the engine's own doors — and `cancel` is put in
 * front of them.
 *
 * ⚠️ An empty list is not an error: a game that declared nothing leaves a scan of one item, `cancel`, and a press takes nothing.
 * The alternative — offering the whole controller to a game that reads none of it — is the dead button ADR-0106 §5 refuses, and
 * here it would cost a child a full pass of fourteen items to reach the one thing that works.
 */
export function createSwitchScan(actions: readonly Action[], options: SwitchScanOptions = {}): SwitchScan {
  const o = { ...SWITCH_SCAN_DEFAULTS, ...options };
  const items: readonly ScanItem[] = [SCAN_CANCEL, ...actions];
  let startedAt: number | null = null;
  let pressed: Action | null = null, pressedAt = 0;

  return (now, frame = {}) => {
    startedAt ??= now;
    const stepMs = Math.max(1, o.stepMs);
    const index = items.length < 2 ? 0 : Math.floor((now - startedAt) / stepMs) % items.length;
    let commanded: Action | null = null;

    if (frame.press) {
      const item = items[index]!;
      if (item !== SCAN_CANCEL) { commanded = item; pressed = item; pressedAt = now; }
      // 📌 EVERY PRESS RESTARTS THE PASS, taken or not: the next thing offered is «cancel», never the neighbour of what she just
      // took. Without it a second bounce of the same hand would take the item beside the one she chose.
      startedAt = now;
    }
    if (pressed && now - pressedAt >= o.pulseMs) pressed = null;
    return { pressed, commanded, showing: { item: items[index]!, index } };
  };
}
