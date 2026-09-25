// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SESSION CLOCK: A LABEL OVER THE TIME LEFT IN DIGITS, AND A TIME TIMER PIE, IN THE CENTRE OF THE HUD ROW (ADR-0236 and its
// erratum; ADR-0239; ADR-0050 §3; issue #94).
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

/** The module with a hand-held hour: `avancar(ms)` moves the time and fires the one-second interval. */
function relogio(opcoes = {}) {
  const slot = document.createElement('div');
  document.body.appendChild(slot);
  let agora = 1000;
  let tique = null;
  const ditos = [];
  const parados = [];
  let desenhos = 0;
  const o = { minutes: 60, ending: 'red', systemReduced: false, sceneMotion: { parallax: false, decor: false, items: false, particles: false }, ...opcoes };
  const montado = mountSessionClock({
    doc: document, slot, t: (key, p) => (key === 'clock.label' ? 'TIME' : `${key}|${p?.minutes}`),
    performance: { now: () => agora },
    setInterval: (fn, ms) => { tique = { fn, ms }; return 7; },
    clearInterval: (h) => { parados.push(h); },
    minutes: () => o.minutes, ending: () => o.ending,
    systemReducedMotion: () => o.systemReduced, sceneMotion: o.sceneMotion,
    announce: (s) => { ditos.push(s); },
    drawn: () => { desenhos += 1; },
  });
  const el = slot.querySelector('.session-clock');
  return {
    slot, el, montado, o, ditos, parados,
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

  it('🔴 [Right] the digits count down in ONE format for the session: an hour reads H:MM:SS, and keeps it', () => {
    r = relogio();
    expect(r.digitos()).toBe('1:00:00');
    r.avancar(1000);
    expect(r.digitos(), 'the digits did not move with the second').toBe('0:59:59');
    r.o.minutes = 30; // an adult shortens it mid-session: the unit does NOT change
    r.avancar(1000);
    expect(r.digitos(), 'the format changed mid-session').toBe('0:29:58');
  });

  it('🔴 [Right] a session under an hour reads MM:SS, and keeps it even when lengthened past an hour', () => {
    r = relogio({ minutes: 45 });
    expect(r.digitos()).toBe('45:00');
    r.o.minutes = 90;
    r.avancar(1000);
    expect(r.digitos(), 'the format changed mid-session').toBe('89:59');
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

  it('🔴 [Right] at the end the whole pie turns RED, it is said ONCE, and the screen is not locked', () => {
    r = relogio({ minutes: 1 });
    r.avancar(59_000);
    expect(r.el.getAttribute('aria-label')).toBe('clock.left.one|1');
    r.avancar(1000);
    expect(r.el.dataset.look).toBe('red');
    expect(getComputedStyle(r.pie()).backgroundColor, 'the end is not the Okabe-Ito vermillion').toBe('rgb(213, 94, 0)');
    expect(getComputedStyle(r.pie()).backgroundImage, 'the end still draws the pie').toBe('none');
    expect(r.digitos()).toBe('00:00');
    expect(r.el.getAttribute('aria-label')).toBe('clock.over|0');
    r.avancar(1000); r.avancar(1000);
    expect(r.ditos, 'the end is said once, not on every tick').toEqual(['clock.over|0']);
    expect(getComputedStyle(r.el).pointerEvents, 'the clock catches the child\'s touches').toBe('none');
  });

  it('🔴 [Right] a longer length set mid-session gives the pie back, within a tick', () => {
    r = relogio({ minutes: 10 });
    r.avancar(10 * MIN);
    expect(r.el.dataset.look).toBe('red');
    r.o.minutes = 20;
    r.avancar(1000);
    expect(r.el.dataset.look).toBe('running');
    expect(parseFloat(r.pie().style.getPropertyValue('--left'))).toBeGreaterThan(0.45);
  });

  it('🔴 [Right] «pulse» breathes slowly — far below three flashes a second (WCAG 2.3.1)', () => {
    r = relogio({ minutes: 1, ending: 'pulse' });
    r.avancar(MIN);
    expect(r.el.dataset.look).toBe('pulse');
    const cs = getComputedStyle(r.pie());
    expect(cs.animationName).toBe('session-clock-pulse');
    const periodo = parseFloat(cs.animationDuration) * (cs.animationDuration.endsWith('ms') ? 0.001 : 1);
    expect(1 / periodo, 'pulses a second').toBeLessThanOrEqual(1);
    expect(cs.backgroundColor, 'a pulsing clock is still red').toBe('rgb(213, 94, 0)');
  });

  it('🔴 [Right] under the system\'s reduced motion the pulse stops, and the clock stays plain red', () => {
    r = relogio({ minutes: 1, ending: 'pulse', systemReduced: true });
    r.avancar(MIN);
    expect(r.el.dataset.look).toBe('red');
    expect(getComputedStyle(r.pie()).animationName).toBe('none');
  });

  it('🔴 [Right] under the ENGINE\'s reduced motion too — any of its switches on — and it follows a change within a tick', () => {
    r = relogio({ minutes: 1, ending: 'pulse' });
    r.avancar(MIN);
    expect(r.el.dataset.look).toBe('pulse');
    r.o.sceneMotion.particles = true;
    r.avancar(1000);
    expect(r.el.dataset.look, 'the engine\'s reduced motion did not stop the pulse').toBe('red');
    expect(getComputedStyle(r.pie()).animationName).toBe('none');
  });

  it('🔴 [Right] «lock» is stored, not built: the clock turns red and nothing covers the screen', () => {
    r = relogio({ minutes: 1, ending: 'lock' });
    r.avancar(MIN);
    expect(r.el.dataset.look).toBe('red');
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
    const base = {
      doc: document, slot, t: (k) => k, clearInterval: undefined, drawn: () => {},
      minutes: () => 60, ending: () => 'red', systemReducedMotion: () => false, sceneMotion: {}, announce: () => {},
    };
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
    expect(cruza(relogioBox, caixa('#title-icons')), 'the clock covers the quick bar').toBe(false);
    const sala = parseFloat(getComputedStyle(document.getElementById('game-region')).getPropertyValue('--hud-row-h'));
    expect(sala, 'the row\'s room does not hold the clock').toBeGreaterThanOrEqual(relogioBox.height);
  });

  it('🔴 [Right] an hour when nothing is stored, named in the interface language — and a stored length is read', async () => {
    motor = abrir();
    await esperar(50);
    expect(document.querySelector('.session-clock').getAttribute('aria-label'))
      .toMatch(/^(Tempo de jogo: faltam 60 minutos|Play time: 60 minutes left|Tiempo de juego: quedan 60 minutos)$/);
    expect(document.querySelector('.session-clock-label').textContent).toMatch(/^(TEMPO|TIME|TIEMPO)$/);
    expect(document.querySelector('.session-clock-digits').textContent).toBe('1:00:00');
    motor.dispose();
    localStorage.setItem('incl_session_minutes', '45');
    motor = abrir();
    await esperar(50);
    expect(document.querySelector('.session-clock').getAttribute('aria-label')).toMatch(/\b45\b/);
    expect(document.querySelector('.session-clock-digits').textContent).toBe('45:00');
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
    expect(motor.problems.filter((l) => /session ending/.test(l)), 'red is the default, and nothing is owed').toEqual([]);
  });

  it('🔴 [Right] a stored «lock» is reported in `problems`, and the screen is not locked', async () => {
    localStorage.setItem('incl_session_ending', 'lock');
    motor = abrir();
    expect(motor.settings.sessionEnding).toBe('lock');
    expect(motor.problems.filter((l) => /session ending is set to 'lock'/.test(l))).toHaveLength(1);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Each applied to the code, seen RED here, and undone (the results are in the commit that brought this file).
