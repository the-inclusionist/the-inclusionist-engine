// SPDX-License-Identifier: AGPL-3.0-or-later
// PLAYING WITH ONE BUTTON (ADR-0218, issue #201) — the scanner, measured without a switch.
//
// A child with one reliable movement cannot reach fourteen positions, so the machine offers them one at a time and her single
// press takes the one showing. Everything below is about the two ways that can hurt her: taking something she did not mean, and
// making her wait for something she cannot reach.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createSwitchScan, playScanList, SCAN_CANCEL, SWITCH_SCAN_DEFAULTS } from '../app/js/input/switch-scan.js';
import { MENU_SCAN, menuScanFor, menuStepKeys } from '../app/js/ui/menu-intent.js';
import { scanItemText } from '../app/js/ui/scan-overlay.js';
import { createTranslator } from '../app/js/core/i18n.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

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

/*
 * ===================== INSIDE A MENU (ADR-0218 erratum of 2026-09-26) =====================
 * With a menu in front, the scan offers that menu's own steps, and a step is the INTENT a key with that meaning carries — so it
 * moves the menu the way the key does (`ui/menu-nav.navIntent`). The order and the words are an interface choice, recorded in
 * the interface log; what is held here is that each step is exactly one intent and that the chip says the engine's word.
 */
describe('inside a menu, the scan offers the menu\'s own steps', () => {
  it('🔴 [Right] after «cancel» the pass is «next · confirm · back · previous» — the order of the interface log', () => {
    const scan = createSwitchScan(MENU_SCAN);
    const seen = [0, 1, 2, 3, 4].map((i) => scan(i * passo).showing.item);
    expect(seen).toEqual([SCAN_CANCEL, 'next', 'confirm', 'back', 'previous']);
    expect(scan(2 * passo, { press: true }).commanded, 'a press on «confirm» took something else').toBe('confirm');
  });

  it('🔴 [Right] each step is ONE intent, the one a key with that meaning carries', () => {
    expect(menuStepKeys('next')).toEqual({ down: true });
    expect(menuStepKeys('previous')).toEqual({ up: true });
    expect(menuStepKeys('confirm')).toEqual({ yes: true });
    expect(menuStepKeys('back')).toEqual({ no: true });
  });

  it('[Interface] a step handed out is a copy: a caller that writes into it does not change the next one', () => {
    menuStepKeys('next').up = true;
    expect(menuStepKeys('next')).toEqual({ down: true });
  });

  it('🔴 [Right] the chip says the ENGINE\'s word for «cancel» and for a menu\'s step — never the game\'s word for a position', () => {
    const { t } = createTranslator();
    // the game named `down` «Pular»: in a menu, «next» must not read as the game's verb
    const gameWord = (a) => ({ down: 'Pular', up: 'Cima' })[a] ?? null;
    expect(scanItemText(SCAN_CANCEL, gameWord, t)).toBe(pt['scan.nothing']);
    expect(MENU_SCAN.map((s) => scanItemText(s, gameWord, t)))
      .toEqual([pt['scan.menu.next'], pt['scan.menu.confirm'], pt['scan.menu.back'], pt['scan.menu.previous']]);
    expect(scanItemText('up', gameWord, t), 'a position lost the game\'s own word').toBe('Cima');
    expect(scanItemText('action4', gameWord, t), 'a position nobody named got a word').toBe('');
  });
});

/*
 * ===================== THE SIDEWAYS STEP (ADR-0218 erratum; interface log, the sideways step) =====================
 * A slider, a list or a ⯇ ⯈ row in a panel is adjusted by the left and right keys, and the menu steps above had neither — so a
 * child scanning could reach a slider and never move it. On a control with a value the pass offers «increase» and «decrease»,
 * which are the right and left keys' intents; anywhere else it does not, because a cycle never stops on a position that does
 * nothing (ADR-0155) — and for the same reason «confirm», which does nothing on a slider or a steps control, leaves there.
 */
describe('on a control with a value, the scan offers the sideways step', () => {
  it('🔴 [Right] on a plain item the pass is the menu\'s four steps — no sideways step where nothing is adjusted', () => {
    expect(menuScanFor('item')).toEqual(['next', 'confirm', 'back', 'previous']);
    expect(menuScanFor('item')).toBe(MENU_SCAN);
  });

  it('🔴 [Right] on a list: «next», then «increase» and «decrease», then the rest — «confirm» stays, it goes round the list', () => {
    expect(menuScanFor('list')).toEqual(['next', 'increase', 'decrease', 'confirm', 'back', 'previous']);
  });

  it('🔴 [Right] on a slider or a ⯇ ⯈ row: the same, without «confirm», which does nothing there (ADR-0155)', () => {
    expect(menuScanFor('value')).toEqual(['next', 'increase', 'decrease', 'back', 'previous']);
  });

  it('🔴 [Right] and the scan offers them in that order after «cancel», and a press on «increase» takes «increase»', () => {
    const scan = createSwitchScan(menuScanFor('value'));
    const seen = [0, 1, 2, 3, 4, 5].map((i) => scan(i * passo).showing.item);
    expect(seen).toEqual([SCAN_CANCEL, 'next', 'increase', 'decrease', 'back', 'previous']);
    expect(scan(2 * passo + 6 * passo, { press: true }).commanded, 'a press on «increase» took something else').toBe('increase');
  });

  it('🔴 [Right] «increase» is the RIGHT key\'s intent and «decrease» the LEFT one\'s — the keyboard\'s own adjustment', () => {
    expect(menuStepKeys('increase')).toEqual({ right: true });
    expect(menuStepKeys('decrease')).toEqual({ left: true });
  });

  it('[Interface] the list handed out for a value is a new one: writing into it changes neither the next nor the plain list', () => {
    const first = menuScanFor('value');
    first.push('confirm');
    expect(menuScanFor('value')).toEqual(['next', 'increase', 'decrease', 'back', 'previous']);
    expect(MENU_SCAN).toEqual(['next', 'confirm', 'back', 'previous']);
  });

  it('🔴 [Right] the chip says the engine\'s word for them, in the three languages', () => {
    for (const [locale, dict, up, down] of [['pt', pt, 'aumentar', 'diminuir'], ['en', en, 'increase', 'decrease'], ['es', es, 'aumentar', 'disminuir']]) {
      const t = (key) => dict[key] ?? key; // the dictionary itself, so each language is read without switching the page's
      expect(dict['scan.menu.increase'], `${locale} has no word for «increase»`).toBe(up);
      expect(dict['scan.menu.decrease'], `${locale} has no word for «decrease»`).toBe(down);
      // the game named `right` «Pular»: in a menu, «increase» must not read as the game's verb
      expect(scanItemText('increase', () => 'Pular', t)).toBe(up);
      expect(scanItemText('decrease', () => 'Pular', t)).toBe(down);
    }
  });
});

/*
 * ===================== THE ENGINE'S DOORS (ADR-0218 §3) =====================
 * After the game's positions, the doors the engine itself opens: the menus (SELECT), then the quick pause (START) — each only
 * where it has something behind it, because a cycle never stops on a position that does nothing (ADR-0155).
 */
describe('in play, the engine\'s doors come after the game\'s positions', () => {
  const GAME = ['up', 'action2'];
  it('🔴 [Right] both doors, after the game\'s positions, menus first: «the menu and … the pause»', () => {
    expect(playScanList(GAME, { menus: true, quickPause: true })).toEqual(['up', 'action2', 'select', 'start']);
  });
  it('🔴 [Boundary] a game with no quick pause to show gets no START; with no card, no SELECT', () => {
    expect(playScanList(GAME, { menus: true, quickPause: false })).toEqual(['up', 'action2', 'select']);
    expect(playScanList(GAME, { menus: false, quickPause: true })).toEqual(['up', 'action2', 'start']);
    expect(playScanList(GAME, { menus: false, quickPause: false })).toEqual(GAME);
  });
  it('[Zero] a game that named nothing still has the doors — the pause is not declinable (ADR-0122)', () => {
    expect(playScanList([], { menus: true, quickPause: true })).toEqual(['select', 'start']);
  });
  it('[Interface] the game\'s list is not written into', () => {
    const game = ['up'];
    playScanList(game, { menus: true, quickPause: true });
    expect(game).toEqual(['up']);
  });
  it('🔴 [Right] the chip says the ENGINE\'s word for a door — no game may name START or SELECT', () => {
    const { t } = createTranslator();
    const gameWord = (a) => ({ start: 'Pular', select: 'Trocar' })[a] ?? null;
    expect(scanItemText('select', gameWord, t)).toBe(pt['scan.door.menus']);
    expect(scanItemText('start', gameWord, t)).toBe(pt['scan.door.pause']);
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
// And (2026-09-26, inside a menu) — `scratchpad/scan-doors/mutate.mjs`, restored and checked by SHA-256:
//   · the order of `MENU_SCAN` changed        → «after cancel the pass is …», «the chip says the ENGINE's word»
//   · «next» and «previous» swapped           → «each step is ONE intent», «a step handed out is a copy»
//   · the menu steps left out of the engine's words → «the chip says the ENGINE's word»
// And (2026-09-26, the doors):
//   · «pause» before «menu»                   → «both doors … menus first», «named nothing still has the doors»
//   · SELECT offered with no card             → «a game with no quick pause … no SELECT»
//   · START offered with no quick pause       → the same case
//   · the doors left out of the engine's words → «the chip says the ENGINE's word for a door»
