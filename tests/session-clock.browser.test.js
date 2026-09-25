// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SESSION CLOCK: A LABEL OVER THE TIME LEFT IN DIGITS, AND A TIME TIMER PIE, IN THE CENTRE OF THE HUD ROW (ADR-0236;
// ADR-0239; ADR-0240 — one hour, red at the end, always on, and no setting on the child's side; ADR-0050 §3; issue #94).
//
// Two halves. The MODULE (`ui/session-clock`) with the time in the case's hand — a clock that must be watched for an hour is
// measured by lending it the hour. And the ROOT on a 640×360 stage with the real stylesheet, because where the clock sits and
// what it covers is geometry: measured, never read off the stylesheet.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import css from '../app/css/style.css?raw';
import { mountSessionClock } from '../app/js/ui/session-clock.js';
import { mountHudRow, reserveBottomBand } from '../app/js/ui/hud-row.js';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const MIN = 60_000;
const esperar = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const cruza = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

beforeAll(() => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
});

/**
 * The module with a hand-held hour: `avancar(ms)` moves the time and fires the one-second interval. `extra` is spread into the
 * context — how a case hands the module ports it must NOT read.
 */
function relogio(extra = {}) {
  const slot = document.createElement('div');
  document.body.appendChild(slot);
  let agora = 1000;
  let tique = null;
  const ditos = [];
  const parados = [];
  let desenhos = 0;
  const montado = mountSessionClock({
    doc: document, slot, t: (key, p) => (key === 'clock.label' ? 'TIME' : `${key}|${p?.minutes}`),
    performance: { now: () => agora },
    setInterval: (fn, ms) => { tique = { fn, ms }; return 7; },
    clearInterval: (h) => { parados.push(h); },
    announce: (s) => { ditos.push(s); },
    drawn: () => { desenhos += 1; },
    ...extra,
  });
  const el = slot.querySelector('.session-clock');
  return {
    slot, el, montado, ditos, parados,
    pie: () => el.querySelector('.session-clock-pie'),
    digitos: () => el.querySelector('.session-clock-digits').textContent,
    get tique() { return tique; },
    get desenhos() { return desenhos; },
    avancar(ms) { agora += ms; tique.fn(); },
    fim() { slot.remove(); },
  };
}

describe('the clock the module draws', () => {
  let r;
  afterEach(() => r?.fim());

  it('🔴 [Right] a full pie at the start, and one second later a smaller one — continuous, ticking every second', () => {
    r = relogio();
    expect(r.pie().style.getPropertyValue('--left')).toBe('1.0000');
    expect(r.tique.ms, 'the pie must move at least every second').toBeLessThanOrEqual(1000);
    r.avancar(1000);
    expect(parseFloat(r.pie().style.getPropertyValue('--left')), 'a second passed and the pie stood still').toBeLessThan(1);
    r.avancar(30 * MIN - 1000);
    expect(parseFloat(r.pie().style.getPropertyValue('--left'))).toBeCloseTo(0.5, 3);
    expect(getComputedStyle(r.pie()).backgroundImage, 'the pie is not drawn as a pie').toMatch(/conic-gradient/);
  });

  it('🔴 [Right] the pie empties CLOCKWISE, like a Time Timer: the spent share is the face, from twelve o\'clock round to the edge', () => {
    // The Dev, 2026-09-25: it was emptying anticlockwise. A conic gradient starts at twelve and runs clockwise, so the
    // spent share must come FIRST (the face) and the green must end at twelve.
    r = relogio();
    r.avancar(15 * MIN); // a quarter spent: the face from 0° to 90°, the green from 90° round to 360°
    const bg = getComputedStyle(r.pie()).backgroundImage;
    const stops = [...bg.matchAll(/rgb\((\d+), (\d+), (\d+)\)/g)].map((m) => m.slice(1).join(','));
    expect(stops[0], `the first colour from twelve o'clock is not the face: ${bg}`).toBe('246,245,240');
    expect(stops.at(-1), `the last colour before twelve o'clock is not the green: ${bg}`).toBe('0,158,115');
    // Chromium writes it as «face 0deg, face 90deg, green 0deg»: the face's last stop is where the green starts.
    const faceEnd = bg.match(/rgb\(246, 245, 240\) (\d+(?:\.\d+)?)deg, rgb\(0, 158, 115\)/);
    expect(faceEnd && parseFloat(faceEnd[1]), `the face does not end at the spent share (90°): ${bg}`).toBeCloseTo(90, 0);
  });

  it('🔴 [Right] a label over the digits, and the pie to their RIGHT (ADR-0239)', () => {
    r = relogio();
    const rotulo = r.el.querySelector('.session-clock-label').getBoundingClientRect();
    const digitos = r.el.querySelector('.session-clock-digits').getBoundingClientRect();
    const pie = r.pie().getBoundingClientRect();
    expect(r.el.querySelector('.session-clock-label').textContent).toBe('TIME');
    expect(rotulo.bottom, 'the label is not over the digits').toBeLessThanOrEqual(digitos.top + 1);
    expect(pie.left, 'the pie is not to the right of the digits').toBeGreaterThanOrEqual(digitos.right);
    expect(pie.width).toBe(pie.height);
  });

  it('🔴 [Right] the digits count down with hours only while there are hours: 1:00:00, then 59:59 (ADR-0239 errata)', () => {
    r = relogio();
    expect(r.digitos()).toBe('1:00:00');
    r.avancar(1000);
    expect(r.digitos(), 'the «0:» of no hours is still drawn').toBe('59:59');
    r.avancar(15 * MIN - 1000);
    expect(r.digitos()).toBe('45:00');
  });

  it('🔴 [Zero] the hour is FIXED: a length or an ending lent to the module is not read (ADR-0240)', () => {
    // the ports the clock had while its length and ending were settings; a caller that still passes them changes nothing
    r = relogio({ minutes: () => 30, ending: () => 'pulse', systemReducedMotion: () => false, sceneMotion: {} });
    expect(r.digitos(), 'a length lent by the caller became the session').toBe('1:00:00');
    expect(r.el.getAttribute('aria-label')).toBe('clock.left|60');
    r.avancar(60 * MIN);
    expect(r.el.dataset.look, 'an ending lent by the caller changed the end').toBe('red');
  });

  it('🔴 [Right] a listener gets words, rewritten by the WHOLE minute, and no live region speaks them on a tick', () => {
    r = relogio();
    expect(r.el.getAttribute('role')).toBe('img');
    expect(r.el.getAttribute('aria-label')).toBe('clock.left|60');
    const obs = new MutationObserver(() => {});
    obs.observe(r.el, { attributes: true, attributeFilter: ['aria-label'] });
    for (let i = 0; i < 20; i++) r.avancar(1000); // twenty ticks inside the first minute: the digits move, the name does not
    expect(obs.takeRecords().length, 'the name was rewritten inside a minute').toBe(0);
    r.avancar(41_000); // into the next minute
    const mudancas = obs.takeRecords();
    obs.disconnect();
    expect(mudancas.length).toBe(1);
    expect(r.el.getAttribute('aria-label')).toBe('clock.left|59');
    expect(r.el.closest('[aria-live]'), 'the clock sits in a live region').toBeNull();
    expect(r.ditos, 'something was said before the end').toEqual([]);
  });

  it('🔴 [Right] at the end of the hour the whole pie turns RED and stays still, it is said ONCE, and nothing covers the screen', () => {
    r = relogio();
    r.avancar(59 * MIN);
    expect(r.el.getAttribute('aria-label')).toBe('clock.left.one|1');
    r.avancar(MIN);
    expect(r.el.dataset.look).toBe('red');
    expect(getComputedStyle(r.pie()).backgroundColor, 'the end is not the Okabe-Ito vermillion').toBe('rgb(213, 94, 0)');
    expect(getComputedStyle(r.pie()).backgroundImage, 'the end still draws the pie').toBe('none');
    expect(getComputedStyle(r.pie()).animationName, 'the red end moves (ADR-0240: red, no pulse)').toBe('none');
    expect(r.digitos()).toBe('00:00');
    expect(r.el.getAttribute('aria-label')).toBe('clock.over|0');
    r.avancar(1000); r.avancar(1000);
    expect(r.ditos, 'the end is said once, not on every tick').toEqual(['clock.over|0']);
    expect(getComputedStyle(r.el).pointerEvents, 'the clock catches the child\'s touches').toBe('none');
    expect(r.slot.children.length, 'something besides the clock was mounted').toBe(1);
  });

  it('🔴 [Right] every redraw tells the root, so the row is measured again; `remove()` stops the tick', () => {
    r = relogio();
    const antes = r.desenhos;
    r.avancar(1000);
    expect(r.desenhos).toBe(antes + 1);
    r.montado.remove();
    expect(r.parados).toEqual([7]);
    expect(r.slot.querySelector('.session-clock')).toBeNull();
  });

  it('🎯 [Zero] a host with no clock or no tick mounts nothing — there is no session to measure', () => {
    const slot = document.createElement('div');
    const base = { doc: document, slot, t: (k) => k, clearInterval: undefined, drawn: () => {}, announce: () => {} };
    expect(mountSessionClock({ ...base, performance: undefined, setInterval: () => 1 })).toBeNull();
    expect(mountSessionClock({ ...base, performance: { now: () => 0 }, setInterval: undefined })).toBeNull();
    expect(mountSessionClock({ ...base, slot: null, performance: { now: () => 0 }, setInterval: () => 1 })).toBeNull();
    expect(slot.children.length).toBe(0);
  });
});

describe('the HUD row itself (ADR-0239)', () => {
  it('🎯 [Zero] an EMPTY row — no clock (a host with no timer), no band, no map — is not drawn and takes no room', () => {
    const regiao = document.createElement('section');
    regiao.style.cssText = 'position:relative;width:640px;height:360px';
    document.body.appendChild(regiao);
    try {
      const linha = mountHudRow(document, regiao);
      reserveBottomBand({ region: regiao, row: linha.row, pad: null });
      expect(regiao.style.getPropertyValue('--hud-row-h'), 'an empty row took room from the game').toBe('0px');
      const algo = document.createElement('div');
      algo.style.height = '30px';
      linha.map.appendChild(algo);
      reserveBottomBand({ region: regiao, row: linha.row, pad: null });
      expect(parseFloat(regiao.style.getPropertyValue('--hud-row-h')), 'the case needs a row that does take room').toBeGreaterThanOrEqual(30);
    } finally { regiao.remove(); }
  });

});

describe('the clock the engine mounts, in the HUD row (issue #94)', () => {
  let createGame;
  let raiz;
  let motor;
  const declaracao = () => ({
    topology: () => ({ kind: 'hotspots', order: ['q1'] }),
    holdsAtOnce: () => 1,
    holdsKeys: () => false,
    tick: 'player',
    world: () => ({ kind: 'element', selector: '#game-region' }),
    roleAt: () => 'goal',
    nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
    focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
    objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }),
    targetsOf: () => [{ x: 0, y: 0 }],
  });
  const abrir = (extra = {}) => createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, ...extra,
  });
  const caixa = (sel) => document.querySelector(sel).getBoundingClientRect();

  beforeAll(async () => {
    ({ createGame } = await import('../app/js/boot/create-game.js'));
  });
  beforeEach(() => {
    raiz = document.createElement('div');
    raiz.innerHTML = '<p id="sr-status" class="sr-only" role="status"></p><p id="sr-alert" class="sr-only" role="alert"></p>'
      + '<div id="stage-wrap" class="stage-wrap" style="width:640px;height:360px;display:flex;flex:none">'
      + '<div id="stage" class="stage"><section id="game-region" class="game-region" tabindex="-1">'
      + '<div id="title-icons" class="pause-icons"></div></section></div></div>';
    document.body.appendChild(raiz);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    motor?.dispose();
    motor = null;
    raiz.remove();
    localStorage.removeItem('incl_session_minutes');
    localStorage.removeItem('incl_session_ending');
    document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
  });

  it('🔴 [Right] at 640×360: bottom centre, on the region\'s lower edge, a target tall, its text at the 16 px floor', async () => {
    motor = abrir();
    await esperar(150);
    const regiao = caixa('#game-region');
    const relogioBox = caixa('.session-clock');
    expect(regiao.width, 'the case needs the 640×360 stage').toBe(640);
    expect(Math.abs((relogioBox.left + relogioBox.right) / 2 - (regiao.left + regiao.right) / 2), 'not centred').toBeLessThanOrEqual(2);
    expect(regiao.bottom - relogioBox.bottom, 'not at the bottom').toBeLessThanOrEqual(8);
    expect(caixa('.session-clock-pie').height, 'the pie is smaller than a target at 640×360').toBeGreaterThanOrEqual(44);
    for (const sel of ['.session-clock-label', '.session-clock-digits']) {
      expect(parseFloat(getComputedStyle(document.querySelector(sel)).fontSize), `${sel} under the text floor`).toBeGreaterThanOrEqual(16);
    }
    // The Dev: the label-and-digits block takes no more than two and a half pies (ADR-0239 errata), with the widest digits
    // an hour-long session draws («1:00:00»).
    expect(document.querySelector('.session-clock-digits').textContent).toBe('1:00:00');
    expect(caixa('.session-clock-text').width, 'the TEMPO block is wider than two and a half pies')
      .toBeLessThanOrEqual(2.5 * caixa('.session-clock-pie').width);
    expect(cruza(relogioBox, caixa('#title-icons')), 'the clock covers the quick bar').toBe(false);
    const sala = parseFloat(getComputedStyle(document.getElementById('game-region')).getPropertyValue('--hud-row-h'));
    expect(sala, 'the row\'s room does not hold the clock').toBeGreaterThanOrEqual(relogioBox.height);
  });

  it('🔴 [Right] an hour, named in the interface language', async () => {
    motor = abrir();
    await esperar(50);
    expect(document.querySelector('.session-clock').getAttribute('aria-label'))
      .toMatch(/^(Tempo de jogo: faltam 60 minutos|Play time: 60 minutes left|Tiempo de juego: quedan 60 minutos)$/);
    expect(document.querySelector('.session-clock-label').textContent).toMatch(/^(TEMPO|TIME|TIEMPO)$/);
    expect(document.querySelector('.session-clock-digits').textContent).toBe('1:00:00');
  });

  it('🔴 [Zero] whatever is stored under the keys the clock once had, it shows 1:00:00, ends red and still, and says nothing in `problems` (ADR-0240)', async () => {
    const real = performance.now.bind(performance);
    let salto = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => real() + salto);
    localStorage.setItem('incl_session_minutes', '45');
    localStorage.setItem('incl_session_ending', 'pulse');
    motor = abrir();
    await esperar(50);
    expect(document.querySelector('.session-clock-digits').textContent, 'a stored length became the session').toBe('1:00:00');
    expect(document.querySelector('.session-clock').getAttribute('aria-label')).toMatch(/\b60\b/);
    expect('sessionMinutes' in motor.settings || 'sessionEnding' in motor.settings, 'the settings store keeps the clock').toBe(false);
    salto = 61 * MIN;
    await esperar(1150); // the one-second tick
    const el = document.querySelector('.session-clock');
    expect(el.dataset.look, 'a stored ending changed the end').toBe('red');
    expect(getComputedStyle(el.querySelector('.session-clock-pie')).animationName, 'a stored «pulse» moves the end').toBe('none');
    motor.dispose();
    localStorage.setItem('incl_session_ending', 'lock');
    motor = abrir();
    expect(motor.problems.filter((l) => /session|lock/i.test(l)), 'a stored «lock» is still read').toEqual([]);
  });

  it('🔴 [Zero] a whole session, to its end and past it, writes no `incl_session_*` key', async () => {
    const real = performance.now.bind(performance);
    let salto = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => real() + salto);
    motor = abrir();
    salto = 61 * MIN;
    await esperar(1150);
    expect(document.querySelector('.session-clock').dataset.look).toBe('red');
    motor.dispose();
    motor = null;
    // by `key(i)`, not `Object.keys`: the test page's storage lists its methods as own keys and none of what it keeps
    const guardadas = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      .filter((k) => k?.startsWith('incl_session'));
    expect(localStorage.length, 'the case needs a storage that lists what it keeps').toBeGreaterThan(0);
    expect(guardadas, 'the clock stored something on the child\'s device').toEqual([]);
  });

  it('🔴 [Right] the SESSION, not the cartridge: a `mount()` keeps the same clock; `dispose()` takes the row away', async () => {
    motor = abrir();
    const antes = document.querySelector('.session-clock');
    motor.mount(declaracao(), { accommodations: SEM_ASSUNTO });
    motor.unmount();
    expect(document.querySelector('.session-clock'), 'a new cartridge restarted the session').toBe(antes);
    motor.dispose();
    expect(document.querySelectorAll('.session-clock, .hud-row').length).toBe(0);
  });

  it('🔴 [Right] at the end of the length the clock turns red and the polite region says so, once', async () => {
    const real = performance.now.bind(performance);
    let salto = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => real() + salto);
    motor = abrir();
    salto = 61 * MIN;
    await esperar(1150); // the one-second tick
    const el = document.querySelector('.session-clock');
    expect(el.dataset.look).toBe('red');
    expect(document.getElementById('sr-status').textContent).toMatch(/acabou|over|se acabó/);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Each applied to the code, seen RED here, and undone (the results are in the commits that brought and changed this file).
// The digits at 1.5× the floor instead of 1.125×: 🔴 the TEMPO block is wider than two and a half pies (ADR-0239 errata).
// The pie drawn green-first (anticlockwise emptying, the defect the Dev saw): 🔴 the CLOCKWISE case.
// ADR-0240, every new or changed [Zero] case:
//   B0 the parent commit's app/ (stored length and ending, pulse, lock line), each case alone:
//      🔴 «the hour is FIXED» (30:00 from the lent length) and «whatever is stored» (45:00 from the stored length)
//   B1 `animation:session-clock-pulse` back on the red pie                  🔴 «at the end … stays still» and «whatever is stored»
//   B2 the settings store writing `incl_session_minutes` when built          🔴 «a whole session … writes no key»
//   B3 a `problems` line for a stored «lock» back in the root                🔴 «whatever is stored»
