// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE MOUNTS THE HUD, AND THE GAME DECLARES ITS NUMBERS BY BAND (ADR-0168; ADR-0059 §1; issue #162).
//
// 📏 Measured on 2026-09-13: six sibling games, six HUDs of their own — 2048 a left column, pinball four corners, whack-whack
// and 15-puzzle panels, soccer a line under the pitch —, none in the bands. The Dev: «a engine deve passar a montar o HUD com
// o jogo declarando os números por faixa», and «Superpoder e contador de objetivo ficam ABAIXO da barra de acessibilidade
// rápida».
//
// 📌 Geometry, so a real stylesheet and a 640×360 stage. The clock (the adult's, ADR-0050) and the learning bars (ADR-0049 §5)
// have no producer yet and are not mounted — nothing here measures them.
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

  it('🔴 [Right] a malformed list is refused, at boot and at mount', () => {
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
