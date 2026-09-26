// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EDGE MARGIN, SECOND PASS: what the quiz page does not show (interface log 2026-09-26). The Dev: «é necessário haver uma
// margem mínima entre o texto, botões (exceto botões da barra de acessibilidade rápida) e a borda do jogo.» The first pass,
// `edge-margin.browser.test.js`, walks the quiz's screens; this page shows the rest, with the same measure
// (`fixtures/edge-measure`): the HUD bands a caller mounts WITHOUT the row (`mountHudBands` with no cells — the mission, the
// power, the points and the learning bars on the region itself), the sound caption alone at the foot, the quick-pause legend
// alone at the foot, the on-screen pad's START and SELECT pills (and a page's own pill, outside the engine's container), and a
// simulation's indicator dot. The quick bar stays excluded.
//
// 📌 A page of its own and not a describe in the first pass: that file boots the demo quiz, and `engine-boundary` refuses an
// engine test (this one imports `ui/hud-bands`) that needs the quiz to run.
// 📌 The page has NO row: under the root's row the footer column stands above it, and the caption's and the legend's own
// bottom spacing never meet the edge — they do where a host mounts no row.
//
// 📏 Measured before the fix, at 640×360 / 1280×720 (margin 8 / 16): the mission's words 0 px from the top; the power 0 from
// the top (and 13.6 from the right at 1280); the points' digits −1 from the top and 4 from the right; the learning bars 4
// from the bottom; the START and SELECT pills 6, and a page's own pill 6; the viz dot 6 from the top and the right; the
// caption alone at the foot 6.8 / 7.6 (4 of margin); the legend alone at the foot 9.6 at 1280 — its 8 px a literal that did
// not grow.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import css from '../app/css/style.css?raw';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { tooClose, atSize } from './fixtures/edge-measure.js';
import { mountHudBands } from '../app/js/ui/hud-bands.js';

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
let game, region, captionsBefore;
const LONG = 'Missão: '.repeat(40); // wider than the region, so the mission's box is as wide as it may be

beforeAll(async () => {
  captionsBefore = localStorage.getItem('incl_captions');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div class="stage-wrap" style="width:640px;height:360px;display:flex;flex:none"><div id="game-region" class="game-region" '
    + 'tabindex="-1" style="position:relative"><div id="title-icons"></div>'
    + '<button id="viz-indicator" type="button" class="blind" aria-label="Simulação de cegueira"></button></div></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  const { keyed } = await import('./fixtures/declared-words.js');
  // every position named, so the pad draws its directional, its four buttons and both shoulders (ADR-0162)
  const PAD = { up: { label: 'Cima' }, down: { label: 'Baixo' }, left: { label: 'Esquerda' }, right: { label: 'Direita' },
    action1: { label: 'Um' }, action2: { label: 'Dois' }, action3: { label: 'Três' }, action4: { label: 'Quatro' },
    leftShoulder: { label: 'L1' }, rightShoulder: { label: 'R1' } };
  game = createGame({ accommodations: SEM_ASSUNTO, onScreenPad: true, ...keyed({ preset: PAD }), host: { doc: document, win: window }, downloadHeavy: false,
    declaration: {
      topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
      world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
      nameAt: () => ({ text: 'item', gender: 'm', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
      objectiveOf: () => ({ name: { text: 'itens', gender: 'm', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
    } });
  region = document.getElementById('game-region');
  const tr = { t: (key, p = {}) => (key === 'hud.contador' ? `${LONG}${p.have}/${p.need}` : `${p.nome ?? key}: ${p.valor ?? p.count ?? ''}`), word: (k) => k };
  mountHudBands(tr, document, region, [
    { band: 'mission', nameKey: 'missão', value: () => ({ have: 3, need: 10 }) },
    { band: 'power', nameKey: 'poder', value: () => 7 },
    { band: 'identity', nameKey: 'pontos', value: () => 12 },
    { band: 'learning', nameKey: 'leitura', value: () => ({ segmentos: ['azul', 'verde', 'vermelho'], cor: 'nenhuma' }) },
  ]).refresh();
  // no row: the footer column stands on the region's lowest edge (see the header)
  region.querySelector(':scope > .hud-row')?.remove();
  // a page's OWN pill, outside the engine's `.touch-sistema` — the markup a consumer may carry, which places itself
  const own = document.createElement('button');
  own.id = 'own-pill';
  own.className = 'touch-btn touch-select';
  own.textContent = 'SELECT';
  region.appendChild(own);
  game.settings.setCaptionsOnValue(true);
  await wait(120);
});
afterAll(() => {
  if (captionsBefore === null) localStorage.removeItem('incl_captions'); else localStorage.setItem('incl_captions', captionsBefore);
});

describe.each([[640, 360, 8], [1280, 720, 16]])('the edge margin with no HUD row, at %i×%i', (w, h, margin) => {
  it(`🔴 [Right] the HUD bands on the region, the pad's pills and the viz dot stand ${margin} px off the edges`, async () => {
    await atSize(document, w, h);
    expect(region.style.getPropertyValue('--margem-borda')).toBe(`${margin}px`);
    document.getElementById('viz-indicator').hidden = false;
    document.getElementById('touch-controls').hidden = false; // what a touch does (`touch-bindings`): the pad shows
    await wait();
    const { found, items } = tooClose(region, 'bands');
    // the mission, the power and the points by their words; the bars, the dot and the pills by their boxes
    for (const part of ['«Missão', '«poder: 7', '«00012', 'div.hud-barra', '#viz-indicator', '#touch-start', '#touch-select', '#own-pill']) {
      expect(items.some(([what]) => what.includes(part)), `nothing of ${part} measured — the case would not see it`).toBe(true);
    }
    // the mission as wide as its words make it: its lines may end short of its box, so the box itself stands the margin off
    // the sides. 📏 It never gets wider than HALF the region — `left:50%` leaves it that much to shrink into, so its
    // `max-width` does not bind (measured: 320 px at 640×360, 640 at 1280×720, for a text wider than the region).
    const r = region.getBoundingClientRect();
    const mission = region.querySelector(':scope > .hud-esquerda').getBoundingClientRect();
    expect(mission.width, 'the mission\'s text is not long enough to fill its box').toBeGreaterThanOrEqual(w / 2 - 1);
    expect([mission.left - r.left, r.right - mission.right].map((d) => d >= margin - 0.05), 'the mission\'s box is nearer a side than the margin')
      .toEqual([true, true]);
    // and the pad's own buttons — the four actions and both shoulders, not only its pills (the Dev: «botões (exceto botões da
    // barra de acessibilidade rápida)»)
    const padButtons = items.filter(([what]) => what.includes('touch-btn') && !/touch-(start|select)|own-pill/.test(what));
    expect(padButtons.length, 'the pad\'s own buttons were not measured').toBeGreaterThanOrEqual(6);
    expect(found).toEqual([]);
  });

  // THE POINTS AND THE POWER SHARE THE RIGHT EDGE WITHOUT A ROW (ADR-0239 §3: the score, and «above it the power in use»).
  // In the row the power stands over the points; at the top there is no room over them, so the same pair reads top-down:
  // the points first, the power directly under them, both on the same right edge — never one box over the other. And the
  // pair starts under what owns the top: the quick bar's band (ADR-0239's driver) and, while the pad shows it, the right
  // shoulder in its corner (ADR-0160) — `engine-pieces-never-overlap` measures every other piece against them.
  it('🔴 [Right] the POINTS head the right edge under the bar and the shoulder, and the POWER stands directly under them', async () => {
    await atSize(document, w, h);
    const r = region.getBoundingClientRect();
    const box = (sel) => {
      const b = region.querySelector(`:scope > ${sel}`).getBoundingClientRect();
      return { left: b.left - r.left, top: b.top - r.top, right: b.right - r.left, bottom: b.bottom - r.top };
    };
    const points = box('.hud-points');
    const power = box('.hud-direita');
    // what the stack stands under, measured: the band `ui/top-band` wrote, and the right shoulder's column
    const band = parseFloat(region.style.getPropertyValue('--barra-a11y-h'));
    const shoulders = box('#touch-controls > .touch-ombros--dir');
    const head = Math.max(margin, band, shoulders.bottom + margin);
    const seen = JSON.stringify({ points, power, band, shoulders });
    expect(band, 'no bar band measured — the case would not see the bar').toBeGreaterThan(margin);
    const meet = power.left < points.right && points.left < power.right && power.top < points.bottom && points.top < power.bottom;
    expect(meet, `the power's box and the points' box overlap: ${seen}`).toBe(false);
    expect(Math.abs(points.top - head), `the points do not head the right edge's stack: ${seen}`).toBeLessThan(0.5);
    expect(Math.abs(r.width - points.right - margin), `the points are not on the right edge: ${seen}`).toBeLessThan(0.5);
    expect(power.top - points.bottom, `the power is not directly under the points: ${seen}`).toBeGreaterThanOrEqual(0);
    expect(power.top - points.bottom, `the power is not directly under the points: ${seen}`).toBeLessThanOrEqual(4);
    expect(Math.abs(power.right - points.right), `the power is not on the points' right edge: ${seen}`).toBeLessThan(0.5);
    // a game with no points: the power is the stack's first line, not a line under an empty place
    const pointsBand = region.querySelector(':scope > .hud-points');
    pointsBand.hidden = true;
    try {
      await wait();
      expect(Math.abs(box('.hud-direita').top - head), 'with no points the power does not head the stack').toBeLessThan(0.5);
    } finally {
      pointsBand.hidden = false;
      await wait();
    }
  });

  it('🔴 [Right] the SOUND CAPTION alone at the foot stands the margin off the bottom', async () => {
    game.captionSound('Porta rangendo');
    await wait();
    const { found, items } = tooClose(region, 'caption');
    expect(items.some(([what]) => what.includes('legenda-de-som')), 'no caption measured').toBe(true);
    expect(region.querySelector('.barra-explicacao:not([hidden]), .pausa-legenda:not([hidden])'), 'the caption is not alone at the foot').toBeNull();
    expect(found).toEqual([]);
  });

  it('🔴 [Right] the quick-pause LEGEND alone at the foot (no explanation under it) stands the margin off the bottom', async () => {
    document.getElementById('touch-start').click(); // START: the quick pause, whose legend sits in the footer
    await wait();
    try {
      const band = region.querySelector('.barra-explicacao');
      if (band) band.hidden = true; // as when the pointed item has no explanation: the legend is the lowest line
      const caption = region.querySelector('.legenda-de-som');
      if (caption) caption.hidden = true;
      await wait();
      const { found, items } = tooClose(region, 'legend');
      expect(items.some(([what]) => what.includes('lg-nome')), 'no legend measured').toBe(true);
      expect(found).toEqual([]);
    } finally {
      document.getElementById('touch-start').click();
      await wait();
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-26; `scratchpad/footer-scroll/mutate.mjs`, set 2, counting each target first) — red:
//   M1 the mission at the top edge   M3/M4 the power band right:4px / top:0   M5 the learning bars bottom:4px
//   M6/M7 the points right:4px / top:0   M8 the points' digits back on their 1.1 line (the glyph box 1 px into the margin)
//   M9 the legend's bottom padding a literal 8 px (red at 1280×720)   M10 the lowest caption's 4 px   M11/M14 the viz dot at 6 px
//   M12 the engine's pill container bottom:6px   M13 a page's own pill bottom:6px
// (2026-09-26, the points and the power in one corner; `scratchpad/hud-corner/mutate.mjs`, counting each target first) — red:
//   M15 the power back at top:margin (📏 before the fix, 640×360: points 559–632 × 8–32, power 532–632 × 8–28, one over the
//   other)   M16 the power under the points with no points shown   M17 12 px under them, not directly   M18 the height term
//   one text line, not the digits' 1.25 × 1.2   M19 the power 12 px off the points' right edge
// ⚠️ SURVIVES, and says so: M2, the mission's `max-width` back to `100% - 8px` — inert, since `left:50%` leaves the band half
// the region to shrink into and the max-width never binds (measured above).
