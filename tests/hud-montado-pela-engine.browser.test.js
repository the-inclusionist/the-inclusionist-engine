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
  it('🔴 [Right] points top left and the mission under them, level with the quick bar, touching it nowhere (ADR-0175)', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(150);
    const regiao = caixa('#game-region');
    const esquerda = caixa('.hud-esquerda');
    const barra = caixa('#title-icons');
    const [pontosP, missao] = document.querySelectorAll('.hud-esquerda .hud-numero');
    expect(pontosP.textContent, 'the points are not the first line — declared after the mission, they must still lead').toBe('Pontos: 12');
    expect(missao.textContent).toMatch(/^3 (de|of) 10 moedas$/);
    expect(missao.getBoundingClientRect().top, 'the mission is not under the points').toBeGreaterThanOrEqual(pontosP.getBoundingClientRect().bottom);
    expect(esquerda.left - regiao.left, 'not at the left edge').toBeLessThanOrEqual(8);
    expect(Math.abs(esquerda.top - barra.top), 'not level with the bar').toBeLessThanOrEqual(2);
    expect(cruza(esquerda, barra), 'the left column covers the quick bar').toBe(false);
  });

  it('🔴 [Right] the power sits top right, level with the bar, touching it nowhere — and nothing sits under the bar', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(150);
    const regiao = caixa('#game-region');
    const direita = caixa('.hud-direita');
    const barra = caixa('#title-icons');
    expect(document.querySelector('.hud-direita').textContent).toBe('Superpoder: 1');
    expect(regiao.right - direita.right, 'not at the right edge').toBeLessThanOrEqual(8);
    expect(Math.abs(direita.top - barra.top), 'not level with the bar').toBeLessThanOrEqual(2);
    expect(cruza(direita, barra), 'the right column covers the quick bar').toBe(false);
    const sobABarra = [...document.querySelectorAll('.hud-numero')].filter((p) => {
      const r = p.getBoundingClientRect();
      return r.left < barra.right && barra.left < r.right && r.top >= barra.bottom;
    });
    expect(sobABarra.map((p) => p.textContent), 'a HUD number sits under the quick bar').toEqual([]);
  });

  it('🔴 [Right] a long line on either side is narrowed before it reaches the bar, and the room holds it', async () => {
    pontos = 1234567890;
    motor = abrir({ hud: [
      { band: 'identity', name: nome('Pontos acumulados nesta escola inteira'), value: () => pontos },
      { band: 'power', name: nome('Superpoder que dura uma rodada inteira'), value: () => 3 },
    ] });
    await esperar(150);
    const barra = caixa('#title-icons');
    expect(cruza(caixa('.hud-esquerda'), barra), 'a long left line ran into the bar').toBe(false);
    expect(cruza(caixa('.hud-direita'), barra), 'a long right line ran into the bar').toBe(false);
    const regiao = document.getElementById('game-region');
    const topo = regiao.getBoundingClientRect().top;
    const maisBaixa = Math.max(caixa('.hud-esquerda').bottom, caixa('.hud-direita').bottom) - topo;
    expect(maisBaixa, 'the case needs a column taller than the bar room').toBeGreaterThan(90);
    expect(parseFloat(regiao.style.getPropertyValue('--barra-a11y-h')), 'a wrapped column reaches into the game\'s room').toBeGreaterThan(maisBaixa);
  });

  it('🔴 [Right] the room the game leaves free at the top holds both columns — whichever reaches lower', async () => {
    const poderes = ['Escudo', 'Ímã', 'Asas', 'Fôlego'].map((n) => ({ band: 'power', name: nome(n), value: () => 1 }));
    motor = abrir({ hud: [...HUD(), ...poderes] });
    await esperar(150);
    const regiao = document.getElementById('game-region');
    const sala = parseFloat(regiao.style.getPropertyValue('--barra-a11y-h'));
    const topo = regiao.getBoundingClientRect().top;
    expect(sala, 'the room ends above the left column').toBeGreaterThan(caixa('.hud-esquerda').bottom - topo);
    expect(sala, 'the room ends above the right column').toBeGreaterThan(caixa('.hud-direita').bottom - topo);
    expect(caixa('.hud-direita').bottom, 'the case needs the right column to reach lower than the left').toBeGreaterThan(caixa('.hud-esquerda').bottom);
    expect(caixa('.hud-direita').bottom - topo, 'the case needs the right column below the bar room').toBeGreaterThan(90);
  });

  it('🔴 [Right] a number that changes shows on the next frame, with nothing called', async () => {
    motor = abrir({ hud: HUD() });
    await esperar(50);
    pontos = 13;
    await esperar(80);
    expect(document.querySelector('.hud-esquerda .hud-numero').textContent).toBe('Pontos: 13');
  });

  it('🎯 [Zero] a game that declares no numbers gets no HUD, and its room is the bar\'s alone', async () => {
    motor = abrir();
    await esperar(150);
    expect(document.querySelectorAll('.hud-faixa').length).toBe(0);
    const semHud = parseFloat(document.getElementById('game-region').style.getPropertyValue('--barra-a11y-h'));
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, hud: [...HUD(), { band: 'power', name: nome('Escudo'), value: () => 2 }, { band: 'power', name: nome('Ímã'), value: () => 1 }] });
    await esperar(80);
    const comHud = parseFloat(document.getElementById('game-region').style.getPropertyValue('--barra-a11y-h'));
    expect(comHud, 'mounting a cartridge with a tall column did not grow the room').toBeGreaterThan(semHud);
  });

  it('🔴 [Right] a column with no number is not shown', async () => {
    motor = abrir({ hud: [HUD()[2]] });
    await esperar(80);
    expect(document.querySelector('.hud-esquerda').hidden).toBe(true);
    expect(document.querySelector('.hud-direita').hidden).toBe(false);
  });

  it('🔴 [Right] mount replaces the numbers and unmount takes them away', async () => {
    motor = abrir({ hud: HUD() });
    motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, hud: [{ band: 'mission', name: nome('bolas'), value: () => 2 }] });
    await esperar(80);
    expect(document.querySelectorAll('.hud-numero').length).toBe(1);
    expect(document.querySelector('.hud-esquerda').textContent).toBe('bolas: 2');
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
    forcar.textContent = '.hud-direita{right:auto!important;left:50%!important;max-width:none!important}';
    document.head.appendChild(forcar);
    try {
      motor = abrir({ hud: HUD() });
      expect(cruza(caixa('.hud-direita'), caixa('#title-icons')), 'the case needs the column over the bar').toBe(true);
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
    // the ORDER on its own: the button legend and the sound caption share the footer and do not hide the bars, so the bars
    // must come before the footer in the region even when they are drawn
    const visiveis = document.createElement('style');
    visiveis.textContent = '.hud-aprendizagem{visibility:visible!important}';
    document.head.appendChild(visiveis);
    try { expect(coberta(), 'drawn, the bars paint over the footer').toBe(true); } finally { visiveis.remove(); }
    tocar.remove();
  });

  it('🔴 [Right] a malformed list is refused, at boot and at mount', () => {
    expect(() => abrir({ hud: [...BARRAS(), ...BARRAS()] }), 'four bars are not a reading').toThrow(/4 learning bars/);
    expect(() => abrir({ hud: [{ band: 'clock', name: nome('tempo'), value: () => 1 }] })).toThrow(/hud\[0\]\.band/);
    expect(() => abrir({ hud: [{ band: 'round', name: nome('moedas'), value: () => 1 }] }), 'the first cut\'s band name, never published').toThrow(/hud\[0\]\.band/);
    motor = abrir();
    expect(() => motor.mount(declaracao(), { acomodacoes: SEM_ASSUNTO, hud: [{ band: 'mission', name: nome(''), value: () => 1 }] }))
      .toThrow(/hud\[0\]\.name/);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (the two-column layout of ADR-0175 replaced the round band; the list was run again on it)
//   C1/C2 a column not narrowed from the bar             🔴 long line on either side
//   C3/C4 the room ignores the left / right column         🔴 long line · both columns (C4 SURVIVED until the right column was made the taller one)
//   C5 mission before identity in declared order           🔴 points first · next frame
//   C6 power in the left column · C7 right column on the left  🔴 power top right
//   C8 left column lower than the bar                      🔴 level with the bar
//   C9 no frame loop · C10 empty column shown · C11 no validation · C12 mount does not remount · C13 unmount keeps it  🔴
//   C14/C15 the HUD not excluded from the text floor / the bar check   🔴 not blamed
//   C16 the unpublished `round` band still accepted        🔴 refused
//   L1 bars after the footer (SURVIVED while hidden under the explanation: order checked with the bars forced visible)
//   L2 no accessible name · L3 not the last ten · L4 four bars · L8 off the bottom · L13 drawn under the explanation  🔴
