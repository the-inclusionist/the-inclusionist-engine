// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE MOUNTS THE HUD, AND THE GAME DECLARES ITS NUMBERS BY BAND (ADR-0168; ADR-0059 §1; issue #162) — and the HUD is ONE
// ROW AT THE BOTTOM (ADR-0239; issue #94): the learning bars left, the session clock centred, the power over the score between
// the centre and the right, the game's map right; the mission at the top centre, just under the quick bar (ADR-0239 erratum).
//
// 📏 Measured on 2026-09-13: six sibling games, six HUDs of their own — 2048 a left column, pinball four corners, whack-whack
// and 15-puzzle panels, soccer a line under the pitch —, none in the bands. The Dev: «a engine deve passar a montar o HUD com
// o jogo declarando os números por faixa». And on 2026-09-25, with Super Mario World's HUD as the reference: «Inferior
// esquerda: barra(s) de pontuação(ões) de ZDP. Inferior centro: relógio […]. inferior entre centro e direita: pontuação com 5
// dígitos e acima da pontuação, poder em uso. Inferior direita: mapa em jogos que tenham mapa.»
//
// ⚠️ THE PLACES PINNED HERE MOVED ON 2026-09-25 (ADR-0239 and its erratum): the points left the top left for the score, the
// power left the top right for the place above it, the learning bars left the footer's centre for the row's left, and the
// mission left the top left for the top centre under the bar. The cases that pinned the old places were rewritten.
//
// 📌 Geometry, so a real stylesheet and a 640×360 stage. The clock itself is measured in `tests/session-clock.browser.test.js`.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import css from '../app/css/style.css?raw';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const esperar = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const cruza = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
let createGame;
let raiz;
let motor;
let pontos;

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }),
  holdsAtOnce: () => 1,
  holdsKeys: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'moedas', gender: 'f', plural: true }, have: 3, need: 10 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});
const nome = (text) => ({ text, gender: 'm', plural: true });
const HUD = () => [
  { band: 'mission', name: nome('moedas'), value: () => ({ have: 3, need: 10 }) },
  { band: 'identity', name: nome('Pontos'), value: () => pontos },
  { band: 'power', name: nome('Superpoder'), value: () => 1 },
];
/** Two skills: eleven questions of addition (the bar keeps the last ten) turned purple, and two of reading. */
const BARRAS = () => [
  { band: 'learning', name: nome('Adição'), value: () => ({
    segmentos: ['vermelho', 'verde', 'azul', 'azul', 'vermelho', 'azul', 'azul', 'azul', 'azul', 'azul', 'verde'], cor: 'roxa' }) },
  { band: 'learning', name: nome('Leitura'), value: () => ({ segmentos: ['azul', 'vermelho', 'verde'], cor: 'nenhuma' }) },
];
const abrir = (extra = {}) => createGame({
  accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, ...extra,
});
const caixa = (sel) => document.querySelector(sel).getBoundingClientRect();
const variavel = (nomeVar) => parseFloat(getComputedStyle(document.getElementById('game-region')).getPropertyValue(nomeVar));

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  ({ createGame } = await import('../app/js/boot/create-game.js'));
});

beforeEach(() => {
  pontos = 12;
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" class="sr-only" role="status"></p><p id="sr-alert" class="sr-only" role="alert"></p>'
    + '<div id="stage-wrap" class="stage-wrap" style="width:640px;height:360px;display:flex;flex:none">'
    + '<div id="stage" class="stage"><section id="game-region" class="game-region" tabindex="-1">'
    + '<div id="title-icons" class="pause-icons"></div></section></div></div>';
  document.body.appendChild(raiz);
});

afterEach(() => {
  motor?.dispose();
  motor = null;
  raiz.remove();
  document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
});

describe('the HUD the engine mounts (issue #162), in one row at the bottom (ADR-0239)', () => {
  it('🔴 [Right] the mission sits at the TOP CENTRE, just under the quick bar, touching it nowhere (ADR-0239 erratum)', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(150);
    const regiao = caixa('#game-region');
    const missao = caixa('.hud-esquerda');
    const barra = caixa('#title-icons');
    expect(document.querySelector('.hud-esquerda').textContent).toMatch(/^3 (de|of) 10 moedas$/);
    expect(Math.abs((missao.left + missao.right) / 2 - (regiao.left + regiao.right) / 2), 'not centred').toBeLessThanOrEqual(2);
    expect(missao.top, 'not under the bar').toBeGreaterThanOrEqual(barra.bottom);
    expect(missao.top - barra.bottom, 'not JUST under the bar').toBeLessThanOrEqual(8);
    expect(cruza(missao, barra), 'the mission covers the quick bar').toBe(false);
    const sala = parseFloat(document.getElementById('game-region').style.getPropertyValue('--barra-a11y-h'));
    expect(sala, 'the room the game leaves at the top ends above the mission').toBeGreaterThan(missao.bottom - regiao.top);
    expect(document.querySelector('.hud-esquerda .hud-points, .hud-esquerda [data-band="identity"]'), 'the points are still at the top').toBeNull();
  });

  it('🔴 [Right] while an icon\'s name shows, the NAME covers the mission — it is momentary, the mission is not', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(150);
    const icone = document.querySelector('#title-icons .pi-btn');
    icone.focus();
    icone.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await esperar();
    const nomeDoIcone = document.querySelector('#title-icons .pause-icons-cap');
    expect(nomeDoIcone.textContent, 'no name showing — the case measures nothing').not.toBe('');
    const n = nomeDoIcone.getBoundingClientRect();
    const m = caixa('.hud-esquerda');
    expect(cruza(n, m), 'the case needs the name over the mission').toBe(true);
    // both are `pointer-events: none`, which `elementFromPoint` skips: turned on here only, so the hit test reads paint order
    const tocar = document.createElement('style');
    tocar.textContent = '.hud-faixa, .hud-faixa *, .pause-icons-cap { pointer-events: auto !important }';
    document.head.appendChild(tocar);
    try {
      const x = Math.max(n.left, m.left) + 2;
      const y = (Math.max(n.top, m.top) + Math.min(n.bottom, m.bottom)) / 2;
      expect(document.elementFromPoint(x, y)?.closest('.pause-icons-cap'), 'the mission is drawn over the name').not.toBeNull();
    } finally { tocar.remove(); }
  });

  it('🔴 [Right] the SCORE sits in the row between the clock and the right edge, the power ABOVE it', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(150);
    const regiao = caixa('#game-region');
    const relogio = caixa('.session-clock');
    const pontosBox = caixa('.hud-points');
    const poder = caixa('.hud-direita');
    expect(regiao.bottom - pontosBox.bottom, 'the score is not at the bottom').toBeLessThanOrEqual(8);
    expect(pontosBox.left, 'the score is not to the right of the clock').toBeGreaterThanOrEqual(relogio.right);
    expect(pontosBox.right).toBeLessThanOrEqual(regiao.right);
    expect(poder.bottom, 'the power is not above the score').toBeLessThanOrEqual(pontosBox.top + 0.5);
    expect(Math.abs((poder.left + poder.right) / 2 - (pontosBox.left + pontosBox.right) / 2), 'the power is not over the score').toBeLessThanOrEqual(2);
    expect(document.querySelector('.hud-direita').textContent).toBe('Superpoder: 1');
  });

  it('🔴 [Right] the score is FIVE DIGITS with leading zeros, and a listener hears the number, never the zeros (ADR-0238)', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(80);
    const p = document.querySelector('.hud-points .hud-numero');
    expect(p.textContent).toBe('00012');
    expect(p.getAttribute('role')).toBe('img');
    expect(p.getAttribute('aria-label')).toBe('12 Pontos');
    expect(parseFloat(getComputedStyle(p).fontSize), 'the digits under the text floor').toBeGreaterThanOrEqual(16);
  });

  it('🔴 [Boundary] above 99999 the score stays 99999; below zero, 00000; a fraction is not a digit', async () => {
    pontos = 123_456;
    motor = abrir({ hud: HUD() });
    await esperar(80);
    const p = document.querySelector('.hud-points .hud-numero');
    expect(p.textContent, 'a sixth digit grew').toBe('99999');
    expect(p.getAttribute('aria-label')).toBe('99999 Pontos');
    pontos = -3;
    await esperar(80);
    expect(p.textContent).toBe('00000');
    pontos = 7.9;
    await esperar(80);
    expect(p.textContent).toBe('00007');
  });

  it('🔴 [Right] five digits keep one width: the score does not move as it grows', async () => {
    pontos = 1;
    motor = abrir({ hud: HUD() });
    await esperar(80);
    const antes = caixa('.hud-points .hud-numero');
    pontos = 88_888;
    await esperar(80);
    const depois = caixa('.hud-points .hud-numero');
    expect(Math.abs(depois.width - antes.width), 'the width changed with the digits').toBeLessThanOrEqual(0.5);
    expect(Math.abs(depois.left - antes.left)).toBeLessThanOrEqual(0.5);
  });

  it('🔴 [Right] a long mission wraps inside the screen, never onto the bar, and the room holds it', async () => {
    motor = abrir({ hud: [
      { band: 'mission', name: nome('estrelas escondidas em todas as salas desta escola inteira, do porão até o telhado'), value: () => ({ have: 3, need: 10 }) },
    ] });
    await esperar(150);
    const regiao = caixa('#game-region');
    const missao = caixa('.hud-esquerda');
    expect(cruza(missao, caixa('#title-icons')), 'a long mission ran into the bar').toBe(false);
    expect(missao.left, 'it left the screen').toBeGreaterThanOrEqual(regiao.left);
    expect(missao.right).toBeLessThanOrEqual(regiao.right);
    const maisBaixa = missao.bottom - regiao.top;
    expect(maisBaixa, 'the case needs a mission taller than the bar room').toBeGreaterThan(100);
    expect(parseFloat(document.getElementById('game-region').style.getPropertyValue('--barra-a11y-h')), 'a wrapped mission reaches into the game\'s room').toBeGreaterThan(maisBaixa);
  });

  it('🔴 [Right] the room the game leaves at the TOP no longer holds the row: the row\'s room is at the bottom', async () => {
    const poderes = ['Escudo', 'Ímã', 'Asas', 'Fôlego'].map((n) => ({ band: 'power', name: nome(n), value: () => 1 }));
    motor = abrir({ hud: [...HUD(), ...poderes] });
    await esperar(150);
    const regiao = document.getElementById('game-region');
    const topo = regiao.getBoundingClientRect().top;
    expect(variavel('--barra-a11y-h'), 'the bottom row\'s power column became room at the top').toBeLessThan(caixa('.hud-direita').top - topo);
    const linha = caixa('.hud-row');
    expect(variavel('--hud-row-h'), 'the row\'s room does not hold its tallest cell').toBeGreaterThanOrEqual(Math.floor(linha.height));
    expect(caixa('.hud-direita').top, 'the power column climbed out of the row').toBeGreaterThanOrEqual(linha.top);
  });

  it('🔴 [Right] a number that changes shows on the next frame, with nothing called', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(50);
    pontos = 13;
    await esperar(80);
    expect(document.querySelector('.hud-points .hud-numero').textContent).toBe('00013');
    expect(document.querySelector('.hud-points .hud-numero').getAttribute('aria-label')).toBe('13 Pontos');
  });

  it('🎯 [Zero] a game that declares no numbers gets no bands — the row holds the clock alone', async () => {
    motor = abrir();
    await esperar(150);
    expect(document.querySelectorAll('.hud-faixa').length).toBe(0);
    expect(document.querySelectorAll('.hud-row .session-clock').length).toBe(1);
    const semHud = variavel('--hud-row-h');
    motor.mount(declaracao(), { accommodations: SEM_ASSUNTO, hud: [...HUD(), { band: 'power', name: nome('Escudo'), value: () => 2 }, { band: 'power', name: nome('Ímã'), value: () => 1 }] });
    await esperar(80);
    expect(variavel('--hud-row-h'), 'mounting a cartridge with a tall score cell did not grow the row\'s room').toBeGreaterThan(semHud);
  });

  it('🔴 [Right] a band with no number is not shown', async () => {
    motor = abrir({ hud: [HUD()[2]] });
    await esperar(80);
    expect(document.querySelector('.hud-esquerda').hidden).toBe(true);
    expect(document.querySelector('.hud-points').hidden).toBe(true);
    expect(document.querySelector('.hud-direita').hidden).toBe(false);
  });

  it('🔴 [Right] mount replaces the numbers and unmount takes them away', async () => {
    motor = abrir({ hud: HUD() });
    motor.mount(declaracao(), { accommodations: SEM_ASSUNTO, hud: [{ band: 'mission', name: nome('bolas'), value: () => 2 }] });
    await esperar(80);
    expect(document.querySelectorAll('.hud-numero').length).toBe(1);
    expect(document.querySelector('.hud-esquerda').textContent).toBe('bolas: 2');
    motor.unmount();
    expect(document.querySelectorAll('.hud-faixa').length).toBe(0);
  });

  it('🔴 [Right] the engine does not accuse its own HUD of drawing over the bar or under the text floor', async () => {
    motor = abrir({ hud: [...HUD(), ...BARRAS()] });
    await esperar(150);
    expect(motor.problems.filter((l) => /hud-|session-clock/.test(l)), 'a problems line blames the HUD the engine mounted').toEqual([]);
    // and even where the HUD is small (read when `problems` is), its sizes are the engine's own gates', not the cartridge's
    document.querySelectorAll('.hud-numero, .session-clock-text > *').forEach((p) => { p.style.fontSize = '10px'; });
    expect(motor.problems.filter((l) => /hud-|session-clock/.test(l)), 'the text floor blamed the cartridge for the engine HUD').toEqual([]);
  });

  it('🔴 [Right] where the HUD does reach the bar — the engine\'s own defect — the game is not blamed for it', async () => {
    const forcar = document.createElement('style');
    forcar.textContent = '.hud-row{bottom:auto!important;top:0!important}';
    document.head.appendChild(forcar);
    try {
      motor = abrir({ hud: HUD() });
      expect(cruza(caixa('.session-clock'), caixa('#title-icons')), 'the case needs the row over the bar').toBe(true);
      expect(motor.problems.filter((l) => /hud-|session-clock/.test(l)), 'the bar check blamed the game for the engine HUD').toEqual([]);
    } finally { forcar.remove(); }
  });

  it('🔴 [Right] one learning bar per skill, stacked at the bottom LEFT, left of the clock', async () => {
    motor = abrir({ hud: BARRAS() });
    await esperar(80);
    const regiao = caixa('#game-region');
    const barras = [...document.querySelectorAll('.hud-barra')].map((b) => b.getBoundingClientRect());
    expect(barras.length).toBe(2);
    const faixa = caixa('.hud-aprendizagem');
    expect(regiao.bottom - faixa.bottom, 'not at the bottom').toBeLessThanOrEqual(8);
    expect(faixa.left - regiao.left, 'not at the left').toBeLessThanOrEqual(8);
    expect(faixa.right, 'the bars reach the clock').toBeLessThanOrEqual(caixa('.session-clock').left);
    expect(barras[1].top, 'not stacked').toBeGreaterThanOrEqual(barras[0].bottom);
    expect(cruza(barras[0], barras[1])).toBe(false);
    expect(getComputedStyle(document.querySelector('.hud-row')).visibility, 'no explanation shows, and the row is hidden').toBe('visible');
  });

  it('🔴 [Right] a bar shows the last ten segments, oldest first, and each state has a cue besides colour', async () => {
    motor = abrir({ hud: BARRAS() });
    await esperar(80);
    const [adicao, leitura] = document.querySelectorAll('.hud-barra');
    const segs = (b) => [...b.querySelectorAll('.hud-seg')].map((s) => s.dataset.seg);
    expect(segs(adicao)).toEqual(['verde', 'azul', 'azul', 'vermelho', 'azul', 'azul', 'azul', 'azul', 'azul', 'verde']);
    expect(segs(leitura)).toEqual(['azul', 'vermelho', 'verde', 'vazio', 'vazio', 'vazio', 'vazio', 'vazio', 'vazio', 'vazio']);
    const estilo = (b, i) => getComputedStyle(b.querySelectorAll('.hud-seg')[i]);
    expect(estilo(leitura, 0).backgroundColor, 'first-time right is not the Okabe-Ito blue').toBe('rgb(0, 114, 178)');
    expect(estilo(leitura, 2).backgroundImage, 'a green segment has no cue but colour').not.toBe('none');
    expect(estilo(leitura, 1).backgroundImage, 'a red segment has no cue but colour').not.toBe('none');
    expect(estilo(leitura, 0).backgroundImage, 'blue carries a pattern too — the cues no longer tell the states apart').toBe('none');
    expect(estilo(leitura, 3).borderTopWidth, 'an empty slot has no outline').not.toBe('0px');
    expect(getComputedStyle(adicao, '::after').content, 'a purple bar has no cue but colour').toBe('"▲"');
    expect(estilo(adicao, 1).backgroundColor, 'the purple bar does not cover its segments').toBe('rgb(204, 121, 167)');
  });

  it('🔴 [Right] a bar is named for a listener: the skill, the counts and the level', async () => {
    motor = abrir({ hud: BARRAS() });
    await esperar(80);
    const [adicao, leitura] = document.querySelectorAll('.hud-barra');
    expect(adicao.getAttribute('role')).toBe('img');
    expect(adicao.getAttribute('aria-label')).toMatch(/^Adição: 7 .*2 .*1 .*(sobe|goes up|sube)/);
    expect(leitura.getAttribute('aria-label')).toMatch(/^Leitura: 1 .*1 .*1 /);
    expect(leitura.getAttribute('aria-label')).not.toMatch(/sobe|goes up|sube|desce|goes down|baja/);
  });

  it('🔴 [Right] the explanation covers the row while it shows: the row is not drawn, and the band stands where it stood', async () => {
    motor = abrir({ hud: [...HUD(), ...BARRAS()] });
    await esperar(80);
    const linhaAntes = caixa('.hud-row');
    const icone = document.querySelector('#title-icons .pi-btn');
    icone.focus();
    icone.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await esperar();
    expect(document.querySelector('.barra-explicacao')?.hidden, 'no explanation showing — the case measures nothing').toBe(false);
    expect(getComputedStyle(document.querySelector('.hud-row')).visibility, 'the row shows through the explanation').toBe('hidden');
    expect(Math.abs(caixa('.barra-explicacao').bottom - linhaAntes.bottom), 'the explanation is not where the row stands').toBeLessThanOrEqual(1);
    // the ORDER: the row comes before the footer in the region, so the footer paints over it on the same layer
    const filhos = [...document.getElementById('game-region').children];
    expect(filhos.indexOf(document.querySelector('.hud-row'))).toBeLessThan(filhos.indexOf(document.querySelector('.rodape-da-tela')));
  });

  /** `--rodape-h` is a `calc()` a custom property keeps unresolved: a probe of that height resolves it, as a game reads it. */
  const salaDoJogo = () => {
    const sonda = document.createElement('div');
    sonda.style.cssText = 'position:absolute;height:var(--rodape-h)';
    document.getElementById('game-region').appendChild(sonda);
    const h = sonda.getBoundingClientRect().height;
    sonda.remove();
    return h;
  };

  // ⚠️ REWRITTEN ON 2026-09-25 (ADR-0239 erratum): this case demanded that `--rodape-h` hold the caption too. The caption is
  // momentary and OVERLAYS the workspace; the room a game leaves free is the row's, which is always there.
  it('🔴 [Right] the sound caption stands ABOVE the row, and a game\'s room is the ROW\'s — the caption overlays the workspace', async () => {
    motor = abrir({ hud: [...HUD(), ...BARRAS()] });
    await esperar(80);
    const regiao = caixa('#game-region');
    const antes = salaDoJogo();
    expect(Math.abs(antes - (regiao.bottom - caixa('.hud-row').top)), 'the room a game leaves is not the row\'s').toBeLessThanOrEqual(1);
    motor.captionSound('Porta rangendo');
    await esperar(80);
    const legenda = document.querySelector('.legenda-de-som');
    expect(legenda?.hidden, 'no caption showing — the case measures nothing').toBe(false);
    expect(legenda.getBoundingClientRect().bottom, 'the caption covers the row').toBeLessThanOrEqual(caixa('.hud-row').top + 0.5);
    expect(salaDoJogo(), 'a momentary caption pushed the game\'s workspace').toBe(antes);
    expect(legenda.getBoundingClientRect().top, 'the case needs the caption to reach into the workspace').toBeLessThan(regiao.bottom - antes);
  });

  it('🔴 [Right] where the on-screen pad shows, the row stands ABOVE the pad', async () => {
    motor = abrir({ hud: HUD(), onScreenPad: true });
    await esperar(80);
    const pad = document.getElementById('touch-controls');
    expect(pad, 'the case needs the pad').not.toBeNull();
    pad.hidden = false;
    await esperar(1150); // measured at the clock's next tick
    const partes = [...pad.children].map((c) => c.getBoundingClientRect()).filter((b) => b.height > 0);
    expect(partes.length, 'the case needs pad parts on the screen').toBeGreaterThan(0);
    const topoDoPad = Math.min(...partes.filter((b) => caixa('#game-region').bottom - b.bottom <= 24).map((b) => b.top));
    expect(caixa('.hud-row').bottom, 'the row sits over the pad').toBeLessThanOrEqual(topoDoPad + 0.5);
    pad.hidden = true;
    await esperar(1150);
    expect(caixa('#game-region').bottom - caixa('.hud-row').bottom, 'the row did not come back down').toBeLessThanOrEqual(1);
  });

  it('🔴 [Right] the MAP slot: empty it is not drawn; a game\'s map shows at the bottom right; unmount clears it', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(80);
    expect(motor.mapSlot, 'the engine offers no map slot').not.toBeNull();
    expect(motor.mapSlot.getBoundingClientRect().width, 'an empty map slot takes room').toBe(0);
    const mapa = document.createElement('canvas');
    mapa.width = 60; mapa.height = 40;
    motor.mapSlot.appendChild(mapa);
    await esperar(80);
    const regiao = caixa('#game-region');
    const m = mapa.getBoundingClientRect();
    expect(regiao.right - m.right, 'the map is not at the right').toBeLessThanOrEqual(8);
    expect(regiao.bottom - m.bottom, 'the map is not at the bottom').toBeLessThanOrEqual(8);
    expect(m.left, 'the map covers the score').toBeGreaterThanOrEqual(caixa('.hud-points').right);
    motor.unmount();
    expect(motor.mapSlot.children.length, 'the released cartridge\'s map stayed').toBe(0);
  });

  it('🔴 [Right] a malformed list is refused, at boot and at mount', () => {
    expect(() => abrir({ hud: [...BARRAS(), ...BARRAS()] }), 'four bars are not a reading').toThrow(/4 learning bars/);
    expect(() => abrir({ hud: [{ band: 'clock', name: nome('tempo'), value: () => 1 }] })).toThrow(/hud\[0\]\.band/);
    expect(() => abrir({ hud: [{ band: 'round', name: nome('moedas'), value: () => 1 }] }), 'the first cut\'s band name, never published').toThrow(/hud\[0\]\.band/);
    motor = abrir();
    expect(() => motor.mount(declaracao(), { accommodations: SEM_ASSUNTO, hud: [{ band: 'mission', name: nome(''), value: () => 1 }] }))
      .toThrow(/hud\[0\]\.name/);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (the two-column layout of ADR-0175 replaced the round band; the list was run again on it — and again on 2026-09-25 on
// ADR-0239's bottom row; the results of that run are in the commit that brought it)
//   C1 the top column not narrowed from the bar                    🔴 long line at the top
//   C5 mission before identity in declared order                   (retired: the points left the column)
//   C8 left column lower than the bar                              🔴 level with the bar
//   C9 no frame loop · C10 empty band shown · C11 no validation · C12 mount does not remount · C13 unmount keeps it  🔴
//   C14/C15 the HUD not excluded from the text floor / the bar check   🔴 not blamed
//   C16 the unpublished `round` band still accepted                🔴 refused
//   L2 no accessible name · L3 not the last ten · L4 four bars      🔴
