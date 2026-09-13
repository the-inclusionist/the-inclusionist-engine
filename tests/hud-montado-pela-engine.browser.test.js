// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE MOUNTS THE HUD, AND THE GAME DECLARES ITS NUMBERS BY BAND (ADR-0168; ADR-0059 §1; issue #162).
//
// 📏 Measured on 2026-09-13: six sibling games, six HUDs of their own — 2048 a left column, pinball four corners, whack-whack
// and 15-puzzle panels, soccer a line under the pitch —, none in the bands. The Dev: «a engine deve passar a montar o HUD com
// o jogo declarando os números por faixa», and «Superpoder e contador de objetivo ficam ABAIXO da barra de acessibilidade
// rápida».
//
// 📌 Geometry, so a real stylesheet and a 640×360 stage. The session clock is the adult's (ADR-0050) and nothing holds a session
// length yet: it is not mounted, and nothing here measures it.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import css from '../app/css/style.css?raw';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

const esperar = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const cruza = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
let createGame;
let raiz;
let motor;
let pontos;

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }),
  holdsAtOnce: () => 1,
  seguraTeclas: () => false,
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
  { band: 'identity', name: nome('Pontos'), value: () => pontos },
  { band: 'round', name: nome('moedas'), value: () => ({ have: 3, need: 10 }) },
];
/** Two skills: eleven questions of addition (the bar keeps the last ten) turned purple, and two of reading. */
const BARRAS = () => [
  { band: 'learning', name: nome('Adição'), value: () => ({
    segmentos: ['vermelho', 'verde', 'azul', 'azul', 'vermelho', 'azul', 'azul', 'azul', 'azul', 'azul', 'verde'], cor: 'roxa' }) },
  { band: 'learning', name: nome('Leitura'), value: () => ({ segmentos: ['azul', 'vermelho', 'verde'], cor: 'nenhuma' }) },
];
const abrir = (extra = {}) => createGame({
  acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, baixarPesados: false, ...extra,
});
const caixa = (sel) => document.querySelector(sel).getBoundingClientRect();

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
  motor?.unmount();
  motor = null;
  raiz.remove();
  document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
});

describe('the HUD the engine mounts (issue #162)', () => {
  it('🔴 [Right] the identity number sits top left, level with the quick bar, and touches it nowhere', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(150);
    const regiao = caixa('#game-region');
    const identidade = caixa('.hud-identidade');
    const barra = caixa('#title-icons');
    expect(document.querySelector('.hud-identidade').textContent).toBe('Pontos: 12');
    expect(identidade.left - regiao.left, 'not at the left edge').toBeLessThanOrEqual(8);
    expect(Math.abs(identidade.top - barra.top), 'not level with the bar').toBeLessThanOrEqual(2);
    expect(cruza(identidade, barra), 'the identity band covers the quick bar').toBe(false);
  });

  it('🔴 [Right] a long identity is narrowed before it reaches the bar', async () => {
    pontos = 1234567890;
    motor = abrir({ hud: [{ band: 'identity', name: nome('Pontos acumulados nesta escola inteira'), value: () => pontos }] });
    await esperar(150);
    expect(cruza(caixa('.hud-identidade'), caixa('#title-icons')), 'a long number ran into the bar').toBe(false);
    // narrowed, it wraps and grows taller than the bar's room: the game's room must still start below it
    const regiao = document.getElementById('game-region');
    const topo = regiao.getBoundingClientRect().top;
    expect(caixa('.hud-identidade').bottom - topo, 'the case needs an identity taller than the bar room').toBeGreaterThan(90);
    expect(parseFloat(regiao.style.getPropertyValue('--barra-a11y-h')), 'the wrapped identity reaches into the game\'s room')
      .toBeGreaterThan(caixa('.hud-identidade').bottom - topo);
  });

  it('🔴 [Right] the round number sits below the bar and its name line, centred', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(150);
    const rodada = caixa('.hud-rodada');
    const barra = caixa('#title-icons');
    const regiao = caixa('#game-region');
    const cap = document.querySelector('#title-icons .pause-icons-cap');
    const fundoDoNome = cap ? cap.getBoundingClientRect().top + parseFloat(getComputedStyle(cap).lineHeight) : barra.bottom;
    expect(document.querySelector('.hud-rodada').textContent).toMatch(/^3 (de|of) 10 moedas$/);
    expect(rodada.top, 'the round band is not below the bar and the icon name line').toBeGreaterThanOrEqual(Math.max(barra.bottom, fundoDoNome));
    expect(Math.abs((rodada.left + rodada.right) / 2 - (regiao.left + regiao.right) / 2), 'not centred').toBeLessThanOrEqual(2);
  });

  it('🔴 [Right] the round numbers sit side by side while the region has room for them', async () => {
    motor = abrir({ hud: [...HUD(), { band: 'round', name: nome('Superpoder'), value: () => 1 }] });
    await esperar(150);
    const [a, b] = [...document.querySelectorAll('.hud-rodada .hud-numero')].map((p) => p.getBoundingClientRect());
    expect(Math.abs(a.top - b.top), 'two short round numbers broke onto two lines').toBeLessThanOrEqual(1);
  });

  it('🔴 [Right] the room the game leaves free at the top holds the HUD', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(150);
    const regiao = document.getElementById('game-region');
    const sala = parseFloat(regiao.style.getPropertyValue('--barra-a11y-h'));
    const topo = regiao.getBoundingClientRect().top;
    expect(sala, 'the room ends above the round band').toBeGreaterThan(caixa('.hud-rodada').bottom - topo);
    expect(sala).toBeGreaterThan(caixa('.hud-identidade').bottom - topo);
  });

  it('🔴 [Right] a number that changes shows on the next frame, with nothing called', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(50);
    pontos = 13;
    await esperar(80);
    expect(document.querySelector('.hud-identidade').textContent).toBe('Pontos: 13');
  });

  it('🎯 [Zero] a game that declares no numbers gets no HUD, and its room is the bar\'s alone', async () => {
    motor = abrir();
    await esperar(150);
    expect(document.querySelectorAll('.hud-faixa').length).toBe(0);
    const semHud = parseFloat(document.getElementById('game-region').style.getPropertyValue('--barra-a11y-h'));
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, hud: HUD() });
    await esperar(80);
    const comHud = parseFloat(document.getElementById('game-region').style.getPropertyValue('--barra-a11y-h'));
    expect(comHud, 'mounting a cartridge with numbers did not grow the room').toBeGreaterThan(semHud);
  });

  it('🔴 [Right] a band with no number is not shown', async () => {
    motor = abrir({ hud: [HUD()[1]] });
    await esperar(80);
    expect(document.querySelector('.hud-identidade').hidden).toBe(true);
    expect(document.querySelector('.hud-rodada').hidden).toBe(false);
  });

  it('🔴 [Right] mount replaces the numbers and unmount takes them away', async () => {
    motor = abrir({ hud: HUD() });
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, hud: [{ band: 'round', name: nome('bolas'), value: () => 2 }] });
    await esperar(80);
    expect(document.querySelectorAll('.hud-numero').length).toBe(1);
    expect(document.querySelector('.hud-rodada').textContent).toBe('bolas: 2');
    motor.unmount();
    expect(document.querySelectorAll('.hud-faixa').length).toBe(0);
  });

  it('🔴 [Right] the engine does not accuse its own HUD of drawing over the bar or under the text floor', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(150);
    expect(motor.problems.filter((l) => /hud-/.test(l)), 'a problems line blames the HUD the engine mounted').toEqual([]);
    // and even where the HUD is small (read when `problems` is), its sizes are the engine's own gates', not the cartridge's
    document.querySelectorAll('.hud-numero').forEach((p) => { p.style.fontSize = '10px'; });
    expect(motor.problems.filter((l) => /hud-/.test(l)), 'the text floor blamed the cartridge for the engine HUD').toEqual([]);
  });

  it('🔴 [Right] where the HUD does reach the bar — the engine\'s own defect — the game is not blamed for it', async () => {
    const forcar = document.createElement('style');
    forcar.textContent = '.hud-rodada{top:10px!important}';
    document.head.appendChild(forcar);
    try {
      motor = abrir({ hud: HUD() });
      expect(cruza(caixa('.hud-rodada'), caixa('#title-icons')), 'the case needs the band over the bar').toBe(true);
      expect(motor.problems.filter((l) => /hud-/.test(l)), 'the bar check blamed the game for the engine HUD').toEqual([]);
    } finally { forcar.remove(); }
  });

  it('🔴 [Right] one learning bar per skill, side by side, centred at the bottom', async () => {
    motor = abrir({ hud: BARRAS() });
    await esperar(80);
    const regiao = caixa('#game-region');
    const barras = [...document.querySelectorAll('.hud-barra')].map((b) => b.getBoundingClientRect());
    expect(barras.length).toBe(2);
    const faixa = caixa('.hud-aprendizagem');
    expect(regiao.bottom - faixa.bottom, 'not at the bottom').toBeLessThanOrEqual(8);
    expect(Math.abs((faixa.left + faixa.right) / 2 - (regiao.left + regiao.right) / 2), 'not centred').toBeLessThanOrEqual(2);
    expect(Math.abs(barras[0].top - barras[1].top), 'not side by side').toBeLessThanOrEqual(1);
    expect(cruza(barras[0], barras[1])).toBe(false);
    expect(getComputedStyle(document.querySelector('.hud-aprendizagem')).visibility, 'no explanation shows, and the bars are hidden').toBe('visible');
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

  it('🔴 [Right] the explanation band covers the bars while it shows — also when the footer was there first', async () => {
    // both are `pointer-events: none`, which `elementFromPoint` skips: turned on here only, so the hit test reads paint order
    const tocar = document.createElement('style');
    tocar.textContent = '.rodape-da-tela, .rodape-da-tela *, .hud-faixa, .hud-faixa * { pointer-events: auto !important }';
    document.head.appendChild(tocar);
    const coberta = () => [...document.querySelectorAll('.hud-barra')].every((b) => {
      const r = b.getBoundingClientRect();
      // the runner's frame can be narrower than the 640 px stage, and a point outside it hits nothing: sample inside both
      const x = Math.max(r.left + 2, Math.min((r.left + r.right) / 2, window.innerWidth - 2));
      if (x >= r.right) throw new Error('the bar is outside the runner viewport; nothing to measure');
      return document.elementFromPoint(x, (r.top + r.bottom) / 2)?.closest('.rodape-da-tela') != null;
    });
    motor = abrir({ hud: BARRAS() });
    await esperar(80);
    const icone = document.querySelector('#title-icons .pi-btn');
    icone.focus();
    icone.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await esperar();
    expect(document.querySelector('.barra-explicacao')?.hidden, 'no explanation showing — the case measures nothing').toBe(false);
    expect(coberta(), 'the explanation does not cover the learning bars').toBe(true);
    // and not only on top: the band is translucent, and seen in a demo page the segments showed through its words
    expect(getComputedStyle(document.querySelector('.hud-aprendizagem')).visibility, 'the bars show through the explanation').toBe('hidden');
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, hud: BARRAS() });
    await esperar(80);
    expect(coberta(), 'a cartridge mounted after the footer drew its bars over the explanation').toBe(true);
    tocar.remove();
  });

  it('🔴 [Right] a malformed list is refused, at boot and at mount', () => {
    expect(() => abrir({ hud: [...BARRAS(), ...BARRAS()] }), 'four bars are not a reading').toThrow(/4 learning bars/);
    expect(() => abrir({ hud: [{ band: 'clock', name: nome('tempo'), value: () => 1 }] })).toThrow(/hud\[0\]\.band/);
    motor = abrir();
    expect(() => motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, hud: [{ band: 'round', name: nome(''), value: () => 1 }] }))
      .toThrow(/hud\[0\]\.name/);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   H1 the identity band not narrowed by the bar             🔴 long identity
//   H2 the round band's top not set                          🔴 round below the bar
//   H3 the room does not count the round band                🔴 room · [Zero]
//   H4 no frame loop                                         🔴 next frame
//   H5 an empty band shown                                   🔴 band with no number
//   H6 no validation of the list                             🔴 refused
//   H7 mount does not remount the HUD                        🔴 [Zero] · mount replaces
//   H8 unmount keeps the HUD                                 🔴 mount replaces (2)
//   H9 the identity band lower than the bar                  🔴 level with the bar
//   H10 the round band not centred                           🔴 round below the bar
//   H11 the HUD not excluded from the text floor              🔴 not accused
//   H12 the wrapped identity not counted in the room          🔴 long identity (SURVIVED with one line: case strengthened)
//   H13 the HUD not excluded from the bar check               🔴 not blamed (SURVIVED with the HUD in place: case added)
//   L1 the learning band appended after the footer            🔴 covered, footer there first
//   L2 a bar without its accessible name                      🔴 named
//   L3 not the last ten segments                              🔴 segments · named
//   L4 four bars accepted                                     🔴 refused
//   L5 green without its dot                                  🔴 cue besides colour
//   L6 red without its stripes                                🔴 cue besides colour
//   L7 purple without its arrow                               🔴 cue besides colour
//   L8 the bars off the bottom                                🔴 at the bottom · covered
//   L9 empty slots unmarked                                   🔴 segments
//   L10 the bar's colour not applied                          🔴 purple covers
//   L11 the level not said                                    🔴 named
//   L12 the bars on a layer above the footer                  🔴 covered
//   L13 the bars drawn under the translucent explanation      🔴 covered (seen in a demo page, not by the first cases)
//   L14 the round band without max-content                     🔴 side by side (seen in the same demo page)
