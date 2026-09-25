// SPDX-License-Identifier: AGPL-3.0-or-later
// AN EXCLUSIVE CHOICE TAKES THE CONTROL ITS SIZE ASKS FOR (ADR-0130 rule 3 and its erratum, issue #134).
//
// «FIVE OR FEWER exclusive options are ONE CYCLE ROW whose whole text is «◀ Label: value ▶», stepped with left/right and
// by the arrows; MORE THAN FIVE are a dropdown. No radio group.» The threshold is the Dev's.
//
// 📌 A SIEVE OVER THE BUILT MENUS, not a promise per panel: a real root with every row that has a subject switched on — a
// walker (the cane row), an on-screen pad with five named positions (the touch map), the game's own options — opens every
// panel a child can reach from the pause card and reads every exclusive choice it OFFERS (visible and not locked):
//   · a `<select>` is a dropdown, and holds MORE than five options;
//   · a steps control (`role="spinbutton"`, `[data-passos]`) is a cycle row, and holds FIVE or fewer positions;
//   · nothing offered is a radio group, and no dropdown is empty.
// A seventh panel, or a row a later change adds, is read by the same loop without a line here.
//
// ⚠️ ONE NAMED EXCEPTION, by a later record: the hearing panel's «Voz» is a dropdown whatever it holds (ADR-0185 §1, «a
// list, since Kokoro English passes five»). In a language with five voices or fewer it is a dropdown of five or fewer —
// rule 3 read by the list's largest size rather than its size today. Named here so it is visible, not decided here.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import { comAssunto } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js'; // a game declares KEYS of its dictionary (ADR-0232 D3)

let motor;
const MAX_CYCLE = 5;
const LIST_WHATEVER_ITS_SIZE = new Set(['tts-voz']); // ADR-0185 §1
const declaracao = () => ({
  topology: () => ({ kind: 'grid', size: [3, 3], move: 'orthogonal', frame: 'compass' }), holdsAtOnce: () => 1,
  holdsKeys: () => false, tick: 'player', world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal', nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
/** Five named positions: the touch map's slots are a choice among five. */
const PRESET = {
  up: { label: 'Cima' }, down: { label: 'Baixo' }, action1: { label: 'Confirmar' }, action2: { label: 'Voltar' }, action3: { label: 'Menu' },
};
const valores = (n) => Array.from({ length: n }, (_, i) => ({ value: `v${i}`, label: `valor ${i + 1}` }));
const guardado = {};
const lista = (id, n) => ({
  id, kind: 'list', label: `Lista de ${n}`, values: valores(n),
  read: () => guardado[id] ?? 'v0', write: (v) => { guardado[id] = v; },
});
const GAME_OPTIONS = [lista('dois', 2), lista('cinco', 5), lista('seis', 6), lista('sete', 7),
  { id: 'quatro', kind: 'steps', label: 'Quatro', values: valores(4), read: () => guardado.quatro ?? 'v0', write: (v) => { guardado.quatro = v; } }];

const offered = (el) => el.getClientRects().length > 0 && !el.closest('[hidden]') && el.getAttribute('aria-disabled') !== 'true';
const nameOf = (el) => el.id || el.getAttribute('aria-label') || el.closest('.ctrl-row')?.textContent?.trim() || '?';

/** Every exclusive choice the panel offers, as `{ panel, id, shape, positions }`. */
function choicesIn(panel) {
  const out = [];
  for (const s of panel.querySelectorAll('select')) {
    if (offered(s)) out.push({ panel: panel.id, id: nameOf(s), shape: 'dropdown', positions: s.options.length });
  }
  for (const p of panel.querySelectorAll('[data-passos][role="spinbutton"]')) {
    if (offered(p)) out.push({ panel: panel.id, id: nameOf(p), shape: 'cycle', positions: +p.getAttribute('aria-valuemax') + 1 });
  }
  for (const r of panel.querySelectorAll('[role="radio"], [role="radiogroup"], input[type="radio"]')) {
    if (offered(r)) out.push({ panel: panel.id, id: nameOf(r), shape: 'radio', positions: 0 });
  }
  return out;
}
const openOverlays = () => [...document.querySelectorAll('#game-region .overlay')].filter((o) => !o.hidden);
function closeAll() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
}

/** Opens every panel a child reaches from the card: the settings list, the game's own options, and the motor panel's doors. */
function everyPanel() {
  const seen = [];
  const card = () => document.getElementById('vp-pause-0');
  const visit = () => { for (const o of openOverlays()) if (!seen.includes(o)) seen.push(o); };
  motor.pause.show(0);
  card().querySelector('.pm-btn[data-act="options"]').click();
  const doors = [...card().querySelectorAll('.pause-menu[data-sub="opcoes"] .pm-btn')].map((b) => b.dataset.act).filter((a) => a !== 'pmback');
  for (const act of doors) {
    card().querySelector(`.pm-btn[data-act="${act}"]`).click();
    visit();
    // a panel's own doors to another panel (the motor panel's «Mapear toque»), one level in
    for (const door of document.querySelectorAll('#motora #opt-toque')) {
      if (!offered(door)) continue;
      door.click();
      visit();
    }
    for (const o of openOverlays()) o.hidden = true;
  }
  card().querySelector('.pause-menu[data-sub="opcoes"] .pm-btn[data-act="pmback"]').click();
  card().querySelector('.pm-btn[data-act="opcoesdojogo"]').click();
  visit();
  closeAll();
  return seen;
}

let panels;
let choices;
beforeAll(async () => {
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    declaration: declaracao(),
    host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }],
    onScreenPad: true,
    // the game's words are KEYS of its dictionary (ADR-0232 D3): `keyed` writes the words above under keys
    ...keyed({ accommodations: comAssunto({ caneSpacing: { label: 'Bengala' } }), preset: PRESET, gameOptions: GAME_OPTIONS }),
  });
  panels = everyPanel();
  // the panels are closed again: read what each one drew while it was open
  choices = [];
  for (const p of panels) {
    p.hidden = false;
    choices.push(...choicesIn(p));
    p.hidden = true;
  }
});

describe('an exclusive choice takes the control its size asks for', () => {
  it('🎯 [Right] the sieve reached what it has to judge — the panels, the cane, the touch map and the game\'s lists', () => {
    const ids = panels.map((p) => p.id);
    for (const id of ['audio', 'motora', 'touchcfg', 'game-options']) expect(ids, `the sieve never opened #${id}`).toContain(id);
    const named = choices.map((c) => c.id);
    for (const id of ['cane-div', 'tm-b0', 'game-option-dois', 'game-option-sete']) {
      expect(named, `the sieve never read «${id}» — the case would measure nothing there`).toContain(id);
    }
  });

  it('🔴 [Right] five or fewer positions are a cycle row, never a dropdown', () => {
    const small = choices.filter((c) => c.shape === 'dropdown' && c.positions <= MAX_CYCLE && !LIST_WHATEVER_ITS_SIZE.has(c.id));
    expect(small.map((c) => `#${c.panel} ${c.id}: a dropdown of ${c.positions}`).join('; '), 'a small choice hidden in a dropdown').toBe('');
  });

  it('🔴 [Right] more than five positions are a dropdown, never a cycle row', () => {
    const big = choices.filter((c) => c.shape === 'cycle' && c.positions > MAX_CYCLE);
    expect(big.map((c) => `#${c.panel} ${c.id}: a cycle of ${c.positions}`).join('; '), 'a long choice made to cycle').toBe('');
    expect(choices.find((c) => c.id === 'game-option-seis')?.shape, 'six positions are not a dropdown').toBe('dropdown');
  });

  it('🔴 [Right] the cane cycles its two positions in the GAME\'s word, stores the step and says it', async () => {
    // 📏 Before: the cane row was a `<select>` with NO option, offered to every game with a walker — nothing to choose.
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    await new Promise((r) => setTimeout(r, 150)); // the panel's own «you are in» first, as a child hears it before touching a row
    const cane = document.getElementById('cane-div');
    const passo = (d) => cane.dispatchEvent(new CustomEvent('passo', { detail: d, bubbles: true }));
    passo(-1);
    expect(cane.querySelector('.passo-valor')?.textContent, 'the row is not «◀ the game\'s word: position ▶»').toBe('Bengala: uma por bloco');
    passo(1);
    expect(cane.getAttribute('aria-valuetext')).toBe('a cada meio bloco');
    for (let i = 0; i < 20 && !/meio bloco pisado/.test(document.getElementById('sr-status').textContent); i++) await new Promise((r) => setTimeout(r, 25));
    expect(document.getElementById('sr-status').textContent, 'the step was not said').toMatch(/meio bloco pisado/);
    closeAll();
    // reopened, the row reads the setting back: the step was stored, not only drawn
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    expect(document.getElementById('cane-div').dataset.value, 'the cane forgot the step').toBe('2');
    passo(-1); // leave it as the case found it
    closeAll();
  });

  it('🔴 [Zero] no radio group, and no dropdown offered empty', () => {
    expect(choices.filter((c) => c.shape === 'radio').map((c) => c.id), 'a radio group is offered (erratum: no radio group)').toEqual([]);
    const empty = choices.filter((c) => c.shape === 'dropdown' && c.positions === 0);
    expect(empty.map((c) => `#${c.panel} ${c.id}`), 'a dropdown with nothing to choose').toEqual([]);
  });
});

/*
 * MUTATIONS CHECKED (applied by script, restored from a copy), each red here:
 *   · `MAX_CYCLE_POSITIONS` 5 → 4 → the «five or fewer» case red (the five touch slots and the five-list drop down).
 *   · `MAX_CYCLE_POSITIONS` 5 → 6 → the «more than five» case red (the six-list cycles).
 *   · `mountChoice` with `<` for `<=` → the «five or fewer» case red.
 *   · `game-options` drawing by KIND again (`o.kind === 'list'`) → the «five or fewer» case red (lists of 2 and 5).
 *   · `createGame` not handing `drawChoice` to the touch map → the «five or fewer» case red (`input/touch`'s own select).
 *   · the cane built by the kit's `escolha` again → three cases red, the empty dropdown among them.
 *   · the cane's name never the game's → the cane case red; its step not read from `data-value` → the cane case red.
 */