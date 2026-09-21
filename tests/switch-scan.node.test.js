// SPDX-License-Identifier: AGPL-3.0-or-later
// PLAYING WITH ONE BUTTON (ADR-0218, issue #201) — the scanner, measured without a switch.
//
// A child with one reliable movement cannot reach fourteen positions, so the machine offers them one at a time and her single
// press takes the one showing. Everything below is about the two ways that can hurt her: taking something she did not mean, and
// making her wait for something she cannot reach.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createSwitchScan, SCAN_CANCEL, SWITCH_SCAN_DEFAULTS } from '../app/js/input/switch-scan.js';

const DECLARED = ['up', 'down', 'action2', 'action3'];
const passo = SWITCH_SCAN_DEFAULTS.stepMs;

describe('the scan offers one thing at a time', () => {
  it('🔴 [Right] the first thing offered is «cancel», and it walks the list one item per step', () => {
    const scan = createSwitchScan(DECLARED);
    // 🎯 Cancel first: a press that lands by accident has to be able to mean nothing (ADR-0218).
    expect(scan(0).showing).toEqual({ item: SCAN_CANCEL, index: 0 });
    expect(scan(passo - 1).showing.item, 'it moved before the step was over').toBe(SCAN_CANCEL);
    expect(scan(passo).showing).toEqual({ item: 'up', index: 1 });
    expect(scan(passo * 2).showing.item).toBe('down');
    expect(scan(passo * 4).showing.item).toBe('action3');
  });

  it('📌 [Boundary] the pass repeats: after the last item it is «cancel» again', () => {
    const scan = createSwitchScan(DECLARED);
    scan(0);
    expect(scan(passo * 5).showing, 'the scan stopped at the end and the child could never reach the top again')
      .toEqual({ item: SCAN_CANCEL, index: 0 });
    expect(scan(passo * 6).showing.item).toBe('up');
  });

  it('📌 [Boundary] the step is the one asked for, not a number inside the module', () => {
    const scan = createSwitchScan(DECLARED, { stepMs: 2000 });
    scan(0);
    expect(scan(1999).showing.item).toBe(SCAN_CANCEL);
    expect(scan(2000).showing.item).toBe('up');
  });

  it('📌 [Right] time starts at the FIRST frame, not at zero — a scan turned on mid-game does not begin half way', () => {
    const scan = createSwitchScan(DECLARED);
    expect(scan(123_456).showing.item).toBe(SCAN_CANCEL);
    expect(scan(123_456 + passo).showing.item).toBe('up');
  });
});

describe('what a press takes', () => {
  it('🔴 [Right] a press takes what is showing, and holds it pressed for the pulse', () => {
    const scan = createSwitchScan(DECLARED);
    scan(0);
    const saida = scan(passo, { press: true });
    expect(saida.commanded, 'the press took nothing').toBe('up');
    expect(saida.pressed).toBe('up');
    expect(scan(passo + 100).pressed, 'the press was let go too early').toBe('up');
    expect(scan(passo + SWITCH_SCAN_DEFAULTS.pulseMs).pressed, 'the action stayed pressed for ever').toBeNull();
  });

  it('🔴 [Zero] a press on «cancel» takes nothing — and that is the whole point of it being first', () => {
    const scan = createSwitchScan(DECLARED);
    const saida = scan(0, { press: true });
    expect(saida.commanded).toBeNull();
    expect(saida.pressed).toBeNull();
  });

  it('🔴 [Right] EVERY press restarts the pass, so a hand that bounces takes «cancel» the second time', () => {
    const scan = createSwitchScan(DECLARED);
    scan(0);
    expect(scan(passo, { press: true }).commanded, 'the first press took nothing').toBe('up');
    // The bounce: the same hand, a few milliseconds later. Without the restart it would be showing «up» still, or its neighbour.
    expect(scan(passo + 30, { press: true }).commanded, 'a bounce took a second action').toBeNull();
    expect(scan(passo + 30).showing.item, 'the pass did not start over at cancel').toBe(SCAN_CANCEL);
  });

  it('🔴 [Right] a press on cancel restarts the pass too — a press is a press, whatever it lands on', () => {
    const scan = createSwitchScan(DECLARED);
    scan(0);
    // ⚠️ THE MOMENT IS CHOSEN SO THE TWO BEHAVIOURS DIFFER, and it took a surviving mutation to see that they must be: pressing
    // at the START of a pass leaves the phase where it already was, so any assertion after it passes with or without the
    // restart. LATE inside cancel's own second is the only window where restarting moves anything.
    expect(scan(passo * 5 + 900).showing.item, 'the case is not pressing on cancel at all').toBe(SCAN_CANCEL);
    scan(passo * 5 + 900, { press: true });
    expect(scan(passo * 6).showing.item, 'the press on cancel did not restart the pass: it moved on as if nothing was pressed')
      .toBe(SCAN_CANCEL);
    expect(scan(passo * 6 + 900).showing.item).toBe('up');
  });

  it('🔴 [Zero] a game that declares nothing offers only «cancel», and a press takes nothing', () => {
    // ⚠️ Offering the whole controller to a game that reads none of it would cost a full pass of fourteen items to reach the
    // one thing that works — the dead button of ADR-0106 §5, paid for in seconds.
    const scan = createSwitchScan([]);
    expect(scan(0).showing).toEqual({ item: SCAN_CANCEL, index: 0 });
    expect(scan(passo * 3).showing, 'an empty list moved to somewhere that does not exist').toEqual({ item: SCAN_CANCEL, index: 0 });
    expect(scan(passo * 3, { press: true }).commanded).toBeNull();
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-varredura.py`:
//   · cancel put LAST instead of first          → «the first thing offered is cancel» / «a press on cancel takes nothing»
//   · a press no longer restarts the pass       → «every press restarts the pass»
//   · only a TAKEN press restarts it            → «a press on cancel restarts the pass too»
//   · the pass stops at the end (no wrap)       → «the pass repeats»
//   · the step read from the module, not the option → «the step is the one asked for»
//   · time counted from zero, not the first frame  → «time starts at the FIRST frame»
//   · «cancel» commanded like any other item    → «a press on cancel takes nothing»
//   · the pulse never released                  → «holds it pressed for the pulse»
//   · the empty-list guard removed              → «a game that declares nothing»
