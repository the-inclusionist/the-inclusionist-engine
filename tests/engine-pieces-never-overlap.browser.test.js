// SPDX-License-Identifier: AGPL-3.0-or-later
// NOTHING THE ENGINE DRAWS OVER THE GAME STANDS ON ANYTHING ELSE IT DRAWS — the quick bar, the HUD (its mission, points,
// power, learning bars and session clock) and the on-screen pad (its directional, its four buttons, both shoulders and the two
// pills), measured by box, at 640×360 and 1280×720, with the pad shown and hidden, on a
// page whose HUD bands a caller mounts WITHOUT the row (`mountHudBands` with no cells) and on the root's own HUD row.
//
// 📌 Which records place what: the quick bar on the top edge (ADR-0180, ADR-0148); the mission just under it (ADR-0239
// erratum); the row at the bottom, above the pad while the pad shows (ADR-0239 §6); the pad's shoulders in the TOP CORNERS,
// the trigger over the bumper (ADR-0160), drawn only when the game names them (ADR-0162). The shoulders are a question of
// physical REACH — a thumb finds a corner without looking — so where a shoulder and the HUD meet, the HUD moves.
// 📌 A parent and its child may overlap: a button and its words are one piece. The quick bar's NAME line is left out: it is
// momentary, and the Dev let it cover the mission (ADR-0239 erratum).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import css from '../app/css/style.css?raw';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { atSize, shown } from './fixtures/edge-measure.js';
import { mountHudBands } from '../app/js/ui/hud-bands.js';

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
/** What the engine draws that a child sees and may touch: each counted by its box, whatever it holds inside. */
const PIECES = 'button, .touch-stick, .touch-cross, .hud-numero, .hud-barra, .session-clock';
// every position named, so the pad draws its directional, its four buttons and both pairs of shoulders (ADR-0160, ADR-0162)
const PAD = { up: { label: 'Cima' }, down: { label: 'Baixo' }, left: { label: 'Esquerda' }, right: { label: 'Direita' },
  action1: { label: 'Um' }, action2: { label: 'Dois' }, action3: { label: 'Três' }, action4: { label: 'Quatro' },
  leftShoulder: { label: 'L1' }, leftTrigger: { label: 'L2' }, rightShoulder: { label: 'R1' }, rightTrigger: { label: 'R2' } };
const name = (text) => ({ text, gender: 'm', plural: true });
/** A number in every band; `bars` learning bars, one per skill — three at most (ADR-0049 §5). */
const HUD = (bars) => [
  { band: 'mission', name: name('estrelas'), value: () => ({ have: 3, need: 10 }) },
  { band: 'identity', name: name('pontos'), value: () => 12 },
  { band: 'power', name: name('Superpoder'), value: () => 7 },
  ...['Leitura', 'Adição', 'Escrita'].slice(0, bars).map((skill) => (
    { band: 'learning', name: name(skill), value: () => ({ segmentos: ['azul', 'verde', 'vermelho'], cor: 'nenhuma' }) })),
];

/** Every piece shown now, and every pair of them whose boxes meet — neither holding the other. */
function overlaps(region) {
  const r = region.getBoundingClientRect();
  const pieces = [...region.querySelectorAll(PIECES)].filter(shown).map((el) => {
    const b = el.getBoundingClientRect();
    const what = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${[...el.classList].join('.')} «${el.textContent.trim().slice(0, 16)}»`;
    return { el, what, box: { left: b.left - r.left, top: b.top - r.top, right: b.right - r.left, bottom: b.bottom - r.top } };
  });
  const at = ({ box: b }) => `${b.left.toFixed(1)}–${b.right.toFixed(1)} × ${b.top.toFixed(1)}–${b.bottom.toFixed(1)}`;
  const found = [];
  pieces.forEach((a, i) => pieces.slice(i + 1).forEach((b) => {
    if (a.el.contains(b.el) || b.el.contains(a.el)) return;
    const x = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
    const y = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
    if (x > 0.05 && y > 0.05) found.push(`${a.what} ${at(a)}  ×  ${b.what} ${at(b)}`);
  }));
  return { found, pieces: pieces.map((p) => `${p.what} ${at(p)}`) };
}

/** The page: a 640×360 stage, the region with the quick bar, and a root with the pad on. */
async function openPage({ row, bars }) {
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div class="stage-wrap" style="width:640px;height:360px;display:flex;flex:none"><div id="game-region" class="game-region" '
    + 'tabindex="-1" style="position:relative"><div id="title-icons"></div></div></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  const { keyed } = await import('./fixtures/declared-words.js');
  const game = createGame({ accommodations: SEM_ASSUNTO, onScreenPad: true, ...keyed({ preset: PAD, ...(row ? { hud: HUD(bars) } : {}) }),
    host: { doc: document, win: window }, downloadHeavy: false,
    declaration: {
      topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
      world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
      nameAt: () => ({ text: 'item', gender: 'm', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
      objectiveOf: () => ({ name: { text: 'itens', gender: 'm', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
    } });
  const region = document.getElementById('game-region');
  if (!row) {
    // a caller's own bands, on the region itself, and no row: the footer column stands on the region's lowest edge
    const tr = { t: (key, p = {}) => (key === 'hud.contador' ? `${p.have} de ${p.need} ${p.nome}` : `${p.nome ?? key}: ${p.valor ?? p.count ?? ''}`), word: (k) => k };
    mountHudBands(tr, document, region, HUD(bars).map(({ name: n, ...rest }) => ({ ...rest, nameKey: n.text }))).refresh();
    region.querySelector(':scope > .hud-row')?.remove();
  }
  game.settings.setCaptionsOnValue(true);
  await wait(120);
  return { game, region };
}

// 📌 Each also with THREE learning bars, the most a game declares: in the row, stacked one skill a line, they are its tallest
// cell, and lifted above the pad at 640×360 they reach up to the left shoulders; on the region they are the widest band.
describe.each([
  ['without the HUD row (a caller\'s bands on the region)', false, 1],
  ['without the HUD row and with three learning bars', false, 3],
  ['with the root\'s HUD row', true, 1],
  ['with the root\'s HUD row and three learning bars', true, 3],
])('the engine\'s pieces, %s', (_, row, bars) => {
  let page;
  let captionsBefore;
  beforeAll(async () => {
    captionsBefore = localStorage.getItem('incl_captions');
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    page = await openPage({ row, bars });
  });
  afterAll(() => {
    page?.game.dispose();
    document.body.innerHTML = '';
    if (captionsBefore === null) localStorage.removeItem('incl_captions'); else localStorage.setItem('incl_captions', captionsBefore);
  });

  describe.each([[640, 360], [1280, 720]])('at %i×%i', (w, h) => {
    it.each([['shown', false], ['hidden', true]])('🔴 [Right] with the pad %s, no two of them stand on each other', async (_s, padHidden) => {
      // what a touch does (`touch-bindings`): the pad shows — before the resize, so the row's lift is measured with it
      document.getElementById('touch-controls').hidden = padHidden;
      await atSize(document, w, h);
      const { found, pieces } = overlaps(page.region);
      // the case sees what it is about: the bar, the HUD and — while it shows — every part of the pad
      const want = ['pi-btn', 'hud-numero «3 de 10', 'hud-numero «00012', 'hud-numero «Superpoder', 'hud-barra',
        ...(row ? ['session-clock'] : []), ...(padHidden ? [] : ['#touch-stick', '«L2', '«L1', '«R2', '«R1', '«1»', '«4»', '#touch-start', '#touch-select'])];
      for (const part of want) expect(pieces.some((p) => p.includes(part)), `nothing of ${part} measured:\n${pieces.join('\n')}`).toBe(true);
      expect(pieces.filter((p) => p.includes('hud-barra')).length, 'not every learning bar measured').toBe(bars);
      expect(found, pieces.join('\n')).toEqual([]);
      if (!padHidden || row) return;
      // …and a hidden pad keeps no corner: the points stand right under the bar's band
      const r = page.region.getBoundingClientRect();
      const margin = parseFloat(page.region.style.getPropertyValue('--margem-borda'));
      const band = parseFloat(page.region.style.getPropertyValue('--barra-a11y-h'));
      const points = page.region.querySelector(':scope > .hud-points').getBoundingClientRect();
      expect(Math.abs(points.top - r.top - Math.max(margin, band)), 'the points are held down by a hidden pad').toBeLessThan(0.5);
    });
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26; `scratchpad/corners-clear/mutate.mjs`, counting each target first, this file with the edge-margin page) — red:
//   M3 the no-row mission at the top margin   M4 `ui/top-band` writing no `--hud-mission-top`   M5/M6 the right stack blind
//   to the bar's band / to the shoulders   M7 two right shoulders counted as one   M9 the no-row bars not lifted above the pad
//   M10 the no-row bars side by side again   M11/M12 the row not clear of the left / right shoulders   M13 the power under the
//   points counted from the margin   M14 the points at the top margin   M15b a hidden pad still holding two right shoulders'
//   room   M16 the shoulder's size without the target floor (56 px at 1280×720, where the button is 88)
// ⚠️ SURVIVES, and says so: M15, a hidden pad still holding ONE right shoulder's room — inert on these pages, where the bar's
// band reaches lower than one shoulder (75 against 72 px at 640×360, 149 against 120 at 1280×720).
// 📏 Before the fix (640×360, pad shown): with no row the mission (y 8–28) under the bar's icons, the points (559–632 ×
// 8–32) and the power (477–632 × 34–54) under R2 (576–632 × 8–64) and the power under the bar's last two icons, the learning
// bar (241–400 × 330–352) under SELECT and START; with the row, the power over the score (434–590 × 121–141) 5 px into R1
// (576–632 × 70–126). The same at 1280×720, the power under the bar's last icon even with the pad hidden.
