// SPDX-License-Identifier: AGPL-3.0-or-later
// THE HUD ROW AND THE FOOTER FOLLOW THE ON-SCREEN PAD AT ONCE (ADR-0239 §6; ADR-0164; ADR-0166).
//
// Where a game shows the pad, the HUD row stands ABOVE it, and the explanation band — which covers the row while it shows —
// stands where the row stands; with the pad hidden both come back down to the lower edge. `ui/hud-row` measures how high the
// pad's lower parts reach and writes it as `--hud-row-bottom`. The pad shows and hides by many doors — a touch shows it, a key
// or a gamepad hides it, a menu takes it away and gives it back (ADR-0166), a new cartridge rebuilds it —, and the measure
// must follow each of them before the next frame is drawn.
//
// 📏 Measured before the fix, at 640×360 with the root's row (a game with no HUD bands: the row holds the session clock), the
// pad hidden and `Engine.explain` showing one line: the pad shown by a touch's door left `--hud-row-bottom` at 0 px for up to
// one tick of the session clock (sampled every 50 ms: 0 px until 584–821 ms, then 187 px), since the clock's tick, a resize
// and a HUD text change were the only measures. Meanwhile the explanation band stood at 327.2–360 over the START pill
// (296–352) and the directional (173–352), and the row at 308–360 behind the pad. Hidden again, the row stayed lifted to
// 121–173 for up to the same second.
//
// 📌 The measure is read right after the change, at the microtask checkpoint — before any timer, so no tick of the session
// clock can do the work for the code under test, and before any frame, which is the promise.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import css from '../app/css/style.css?raw';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { atSize, shown } from './fixtures/edge-measure.js';

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
/** After the mutation observers, before any timer or frame. */
const checkpoint = () => Promise.resolve();
// a directional and two buttons, so the pad has its tallest part (the directional) on the lower edge
const PAD = { up: { label: 'Cima' }, down: { label: 'Baixo' }, left: { label: 'Esquerda' }, right: { label: 'Direita' },
  action1: { label: 'Um' }, action2: { label: 'Dois' } };
const TEXT = 'EF05MA08 — Resolver problemas.';
let game, region, captionsBefore;

const pad = () => document.getElementById('touch-controls');
const band = () => region.querySelector('.barra-explicacao');
const row = () => region.querySelector(':scope > .hud-row');
const box = (el) => el.getBoundingClientRect();
const meet = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.05 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.05;
const at = (b) => `${b.left.toFixed(1)}–${b.right.toFixed(1)} × ${b.top.toFixed(1)}–${b.bottom.toFixed(1)}`;
/** Every part of the pad in view, and what of `el` stands on any of them. */
function onThePad(el) {
  const parts = [...pad().querySelectorAll('.touch-stick, .touch-cross, .touch-btn')].filter(shown);
  expect(parts.length, 'no part of the pad is in view').toBeGreaterThan(0);
  return parts.filter((p) => meet(box(el), box(p))).map((p) => `${p.id || p.className} ${at(box(p))} under ${el.className} ${at(box(el))}`);
}

beforeAll(async () => {
  captionsBefore = localStorage.getItem('incl_captions');
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div class="stage-wrap" style="width:640px;height:360px;display:flex;flex:none"><div id="game-region" class="game-region" '
    + 'tabindex="-1" style="position:relative"><div id="title-icons"></div></div></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  const { keyed } = await import('./fixtures/declared-words.js');
  // NO `hud`: the row the root keeps holds only the session clock — the case the footer was suspected over
  game = createGame({ accommodations: SEM_ASSUNTO, onScreenPad: true, ...keyed({ preset: PAD }), host: { doc: document, win: window }, downloadHeavy: false,
    declaration: {
      topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
      world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
      nameAt: () => ({ text: 'item', gender: 'm', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
      objectiveOf: () => ({ name: { text: 'itens', gender: 'm', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
    } });
  region = document.getElementById('game-region');
  await wait(120);
});
afterAll(() => {
  game?.dispose();
  document.body.innerHTML = '';
  if (captionsBefore === null) localStorage.removeItem('incl_captions'); else localStorage.setItem('incl_captions', captionsBefore);
});

describe.each([[640, 360], [1280, 720]])('at %i×%i', (w, h) => {
  beforeAll(async () => {
    game.explain(null);
    pad().hidden = true;
    await atSize(document, w, h);
  });

  it('🔴 [Right] the pad shown: the HUD row stands above it before the next frame', async () => {
    game.explain(null);
    await wait(20);
    const r = box(region);
    expect(Math.abs(box(row()).bottom - r.bottom), 'the row is not on the lower edge with the pad hidden').toBeLessThan(0.5);
    pad().hidden = false; // what a touch does (`touch-bindings`)
    await checkpoint();
    expect(onThePad(row()), 'the row stands behind the pad').toEqual([]);
    expect(box(row()).bottom, 'the row is not lifted off the lower edge').toBeLessThan(r.bottom - 0.5);
  });

  it('🔴 [Right] the pad shown under an explanation: the band stands clear of the START pill and every part, and the pill takes the touch', async () => {
    pad().hidden = true;
    game.explain(TEXT);
    await wait(20);
    expect(band().textContent, 'the explanation is not in the band').toBe(TEXT);
    pad().hidden = false;
    await checkpoint();
    expect(onThePad(band()), 'the explanation band stands on the pad').toEqual([]);
    const pill = box(document.getElementById('touch-start'));
    expect(meet(box(band()), pill), `the band ${at(box(band()))} covers the START pill ${at(pill)}`).toBe(false);
    // the pill takes a touch at its centre, where it is in the page's view
    const x = pill.left + pill.width / 2, y = pill.top + pill.height / 2;
    if (y < window.innerHeight && x < window.innerWidth) expect(document.elementFromPoint(x, y)?.id).toBe('touch-start');
    game.explain(null);
  });

  it('🔴 [Right] the pad hidden: the row comes back to the lower edge before the next frame', async () => {
    pad().hidden = false;
    await atSize(document, w, h); // a resize measures the pad in view, on the old code as on the new
    pad().hidden = true; // what a key or a gamepad does
    await checkpoint();
    expect(Math.abs(box(row()).bottom - box(region).bottom), `the row stays lifted over a pad that left: ${at(box(row()))}`).toBeLessThan(0.5);
  });

  it('🔴 [Right] a menu takes the pad away and gives it back (ADR-0166): the row follows both', async () => {
    pad().hidden = false;
    await atSize(document, w, h); // a resize measures the pad in view, on the old code as on the new
    // by the region's edge: the page above it moves while the card is open
    const lifted = box(region).bottom - box(row()).bottom;
    document.getElementById('touch-select').click(); // SELECT opens the pause card; the pad leaves
    await wait(0);
    expect(pad().hidden, 'the pad did not leave the pause card').toBe(true);
    await checkpoint();
    expect(Math.abs(box(row()).bottom - box(region).bottom), 'the row stays lifted with the pad gone to the menu').toBeLessThan(0.5);
    document.querySelector('.screen-pause:not([hidden]) .pause-card')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    await wait(0);
    expect(pad().hidden, 'the pad did not come back when the card closed').toBe(false);
    await checkpoint();
    expect(Math.abs(box(region).bottom - box(row()).bottom - lifted), 'the pad came back and the row did not rise with it').toBeLessThan(0.5);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (2026-09-27; each anchor counted once, applied, this file run, the source restored from a copy) — all red:
//   M1 the root does not follow the pad (`followThePad(null, …)`: the code before the fix)   M2 only the pad coming or going
//   counts, not its `hidden`   M3 the observer watches `class` instead of `hidden`   M4 the pad matched by a wrong selector
//   M5 the observer answers and measures nothing
