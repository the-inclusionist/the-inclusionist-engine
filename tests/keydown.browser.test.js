// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de input/keydown — o que SÓ o navegador prova (project BROWSER): a PROPAGAÇÃO de verdade entre os
// dois ouvintes de teclado do jogo, e a visibilidade de verdade (`.hidden` de um elemento real).
// A cadeia de decisão está em keydown.node.test.js e NÃO é repetida aqui.
//
// ⚠️ O CASO PRINCIPAL DESTE ARQUIVO PINA UM COMPORTAMENTO ATUAL, NÃO UM COMPORTAMENTO DESEJADO.
// `ui/menu-nav.ts` registra o próprio `keydown` em fase de CAPTURA e dá `stopPropagation()`. Com o jogo
// PAUSADO, o ouvinte de BOLHA que este módulo instala NÃO É ALCANÇADO por Escape: a cadeia
// `overlays.escapeTarget()` e o `togglePause()` de Escape são, ali, código morto. Isso está medido no
// navegador e anotado no game.js e no cabeçalho de ui/menu-nav.ts (DEFEITO 2). Preservado de propósito: o
// conserto futuro (dar `inEscapeChain` a #help/#touchcfg antes de tirar o `stopPropagation()`) precisa desta
// rede — sem ela, Escape com a Ajuda aberta passaria a DESPAUSAR o jogo por baixo do diálogo.
// Se este caso falhar, alguém mexeu na região: confira o conserto inteiro antes de atualizar a expectativa.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initKeydown } from '../app/js/input/keydown.js';
import { initMenuNav } from '../app/js/ui/menu-nav.js';
import { setPhaseValue, phase } from '../app/js/core/state.js';

const SOLO = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], run: ['KeyU'], jump: ['KeyJ', 'Space'], swap: ['KeyI'], especial: ['KeyK'] };
const CONTROLS = { ...SOLO, gameKeys: Object.values(SOLO).flat() };
const actionOf = (code) => { for (const a in SOLO) if (SOLO[a].includes(code)) return a; return null; };

// `host` faz o papel da JANELA (ancestral) e `target` o do elemento que recebe a tecla. Precisa ser um
// ANCESTRAL de verdade: se os dois ouvintes morassem no próprio alvo, o navegador os dispararia na ordem de
// registro e a fase de captura deixaria de significar coisa alguma — que é justamente o que se testa aqui.
let host, target, log, players;

function wire({ pauseMenu = null } = {}) {
  players = [{ i: 0, ctrl: SOLO, waiting: false, easy: false }];
  const spy = (name) => (...args) => { log.push([name, ...args]); };
  const menuNav = initMenuNav({
    $: (sel) => document.querySelector(sel),
    getActiveElement: () => document.activeElement,
    topVisibleOverlay: () => null,
    closeById: () => false,
    getPauseMenu: () => pauseMenu,
    setPhase: spy('menuNav:setPhase'),
    setPauseActor: spy('menuNav:setPauseActor'),
    isNavigable: () => phase === 'paused', // a plataforma navega menu na pausa; ver o ctx de ui/menu-nav
    isCapturing: () => false,
    closePadWiz: spy('menuNav:closePadWiz'),
    whichPlayer: (code) => (actionOf(code) ? 0 : -1),
    actionOf: (code) => actionOf(code),
    win: host,
  });
  const keydown = initKeydown({
    attractOnInput: () => false,
    handleCaptureKeydown: () => false,
    getNumPlayers: () => 1,
    getPlayers: () => players,
    getControls: () => CONTROLS,
    heldKeys: new Set(),
    isOneButton: () => false,
    actionOf: (code) => actionOf(code),
    whichPlayer: (code) => (actionOf(code) ? 0 : -1),
    $: (sel) => document.querySelector(sel),
    escapeTarget: () => { log.push(['keydown:escapeTarget']); return null; },
    closeOverlayById: spy('keydown:closeOverlayById'),
    closePadWiz: spy('keydown:closePadWiz'),
    hideTouchControls: spy('keydown:hideTouchControls'),
    srSay: spy('keydown:srSay'),
    navTitle: spy('keydown:navTitle'),
    activateScreens: spy('keydown:activateScreens'),
    togglePause: spy('keydown:togglePause'),
    // UMA entrada onde havia quatro, e uma pergunta em vez do objeto (ADR-0033).
    modalInput: spy('keydown:modalInput'),
    hasModal: () => false,
    clearWaitingBadge: spy('keydown:clearWaitingBadge'),
    win: host,
  });
  menuNav.attach(); // CAPTURA — exatamente como o game.js instala
  keydown.attach(); // BOLHA — idem
  return { menuNav, keydown };
}

const press = (code) => target.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));

beforeEach(() => {
  log = [];
  document.body.innerHTML = '<div id="stage"><button id="target"></button></div>';
  host = document.getElementById('stage');
  target = document.getElementById('target');
  setPhaseValue('playing');
});
afterEach(() => { document.body.innerHTML = ''; setPhaseValue('playing'); });

describe('a captura do menu-nav chega antes (comportamento ATUAL, pinado)', () => {
  it('PAUSADO: Escape morre na captura — o ouvinte de bolha nem é consultado', () => {
    const pauseMenu = document.createElement('div'); // sem ele o menu-nav consome a tecla e para aí
    wire({ pauseMenu });
    setPhaseValue('paused');
    press('Escape');
    // nem `togglePause`, nem sequer a leitura de estado que o snapshot faria:
    expect(log.some(([n]) => n === 'keydown:togglePause')).toBe(false);
    expect(log.some(([n]) => n === 'keydown:escapeTarget')).toBe(false);
    // e quem tratou foi o menu-nav: "não" na raiz do menu de pausa volta ao jogo
    expect(log).toContainEqual(['menuNav:setPhase', 'playing']);
  });

  it('JOGANDO: o menu-nav sai pelo guarda de fase e a MESMA tecla chega ao ouvinte de bolha e pausa', () => {
    wire();
    press('Escape');
    expect(log).toContainEqual(['keydown:escapeTarget']);
    expect(log).toContainEqual(['keydown:togglePause']);
    expect(log.some(([n]) => n === 'menuNav:setPhase')).toBe(false);
  });

  it('PAUSADO: tecla de JOGO (sem intenção de menu) atravessa a captura e chega ao jogo', () => {
    wire();
    setPhaseValue('paused');
    press('KeyU'); // `run`: o menu-nav não tem intenção para ela, logo não dá stopPropagation
    expect(log).toContainEqual(['keydown:hideTouchControls', 'teclado']);
    expect(players[0].runEdge).toBe(true);
  });
});

describe('visibilidade de verdade', () => {
  it('elemento com `hidden` real bloqueia o jogo; sem ele, a tecla passa', () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="touchcfg" hidden></div>');
    wire();
    const cfg = document.getElementById('touchcfg');
    press('KeyJ');
    expect(players[0].jumpEdge).toBe(true); // escondido: não bloqueia nada

    players[0].jumpEdge = false;
    cfg.hidden = false;
    press('KeyJ');
    expect(players[0].jumpEdge).toBe(false); // visível: a tecla é engolida
    press('Escape');
    expect(cfg.hidden).toBe(true);           // e Escape o esconde de verdade
  });

  it('o botão "Jogar de novo" é clicado de verdade pela tecla de pulo', () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="win-overlay"><button id="btn-again"></button></div>');
    wire();
    let clicks = 0;
    document.getElementById('btn-again').addEventListener('click', () => { clicks++; });
    press('Space');
    expect(clicks).toBe(1);
  });

  it('a tecla de jogo previne o padrão; a tecla de fora não', () => {
    wire();
    expect(press('KeyJ')).toBe(false);  // dispatchEvent devolve false = preventDefault foi chamado
    expect(press('KeyQ')).toBe(true);
  });
});
