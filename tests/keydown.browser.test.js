// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of input/keydown — what ONLY the browser proves (BROWSER project): the real PROPAGATION between the game's two
// keyboard listeners, and real visibility (`.hidden` of a real element).
// The decision chain is in keydown.node.test.js and is NOT repeated here.
//
// ⚠️ THIS FILE'S MAIN CASE PINS A CURRENT BEHAVIOUR, NOT A DESIRED ONE.
// `ui/menu-nav.ts` registers its own `keydown` in the CAPTURE phase and calls `stopPropagation()`. With the game
// PAUSED, the BUBBLE listener this module installs is NOT REACHED by Escape: the `overlays.escapeTarget()` chain and
// Escape's `togglePause()` are dead code there. Measured in the browser and noted in the header of ui/menu-nav.ts
// (DEFECT 2). Kept on purpose: the future fix (giving `inEscapeChain` to #help/#touchcfg before removing the
// `stopPropagation()`) needs this net — without it, Escape with Help open would UNPAUSE the game under the dialog.
// If this case fails, someone touched the area: check the whole fix before updating the expectation.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t;
import { initKeydown } from '../app/js/input/keydown.js';
import { initMenuNav } from '../app/js/ui/menu-nav.js';
// The `input/state` PAIR (ADR-0109) — the same one `keydown.node.test.js` injects, for the same reason.
import { createInputState } from '../app/js/input/state.js';
const {
  keys: keysReais, markKey, markKeyWithoutSource, releaseKey, releaseAllKeys,
} = createInputState();
// The SCENE belongs to the TEST: the phase is the `core/scenes` stack and its three names live in the composition root
// (ADR-0030 C3); engine code receives BOOLEANS. This `let` plays that role.
let faseFalsa = 'playing';
const setPhaseValue = (p) => { faseFalsa = p; };

const SOLO = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], action1: ['KeyU'], action2: ['KeyJ', 'Space'], action4: ['KeyI'], action3: ['KeyK'] };
const CONTROLS = { ...SOLO, gameKeys: Object.values(SOLO).flat() };
const actionOf = (code) => { for (const a in SOLO) if (SOLO[a].includes(code)) return a; return null; };

// `host` plays the WINDOW (ancestor) and `target` the element receiving the key. It must be a real ANCESTOR: if both
// listeners lived on the target itself, the browser would fire them in registration order and the capture phase would
// stop meaning anything — which is exactly what is tested here.
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
    isNavigable: () => faseFalsa === 'paused', // menus are navigable while paused; see ui/menu-nav's ctx
    // The `accessibility` mode (ADR-0044, item 7) is asked before the phase guard. Nobody is in it here: what this file
    // measures is the ORDER between menu-nav's capture and keydown's bubble listener.
    srSay: () => {},
    withIndex: () => true,
    onBar: () => false,
    navBar: () => {},
    isCapturing: () => false,
    closePadWiz: spy('menuNav:closePadWiz'),
    whichPlayer: (code) => (actionOf(code) ? 0 : -1),
    actionOf: (code) => actionOf(code),
    win: host,
  });
  const keydown = initKeydown({
    t: translate, // the root's translator, played by the test (ADR-0232 D3)
    attractOnInput: () => false,
    handleCaptureKeydown: () => false,
    isTitleScreen: () => faseFalsa === 'title',
    isInGame: () => faseFalsa === 'playing' || faseFalsa === 'paused',
    getNumPlayers: () => 1,
    getPlayers: () => players,
    getControls: () => CONTROLS,
    // 🔴 A stale double here fails the worst way: `ctx.markKeyWithoutSource is not a function` comes out as an UNHANDLED
    // ERROR, not a failed assertion, so the cases go on PASSING (it happened at `a78816c`; CI caught it, not the local
    // suite). ⚠️ The REAL pair and not a double of it, for the reason the node file carries: a second implementation of
    // the rule would make the case assert that a copy agrees with its own assertion.
    heldKeys: keysReais,
    markKey,
    markKeyWithoutSource,
    releaseKey,
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
    // ONE entry, and a question instead of the object (ADR-0033).
    modalInput: spy('keydown:modalInput'),
    hasModal: () => false,
    clearWaitingBadge: spy('keydown:clearWaitingBadge'),
    win: host,
  });
  menuNav.attach(); // CAPTURE — exactly as the composition root installs it
  keydown.attach(); // BUBBLE — likewise
  return { menuNav, keydown };
}

const press = (code) => target.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));

beforeEach(() => {
  log = [];
  // ⚠️ The key set is MODULE state and survives between cases: without this reset, a key one case left pressed makes
  // the next measure a world it did not build. It is the same line the node sibling has, for the same reason.
  releaseAllKeys();
  document.body.innerHTML = '<div id="stage"><button id="target"></button></div>';
  host = document.getElementById('stage');
  target = document.getElementById('target');
  setPhaseValue('playing');
});
afterEach(() => { document.body.innerHTML = ''; setPhaseValue('playing'); });

describe('a captura do menu-nav chega antes (comportamento ATUAL, pinado)', () => {
  it('PAUSADO: Escape morre na captura — o ouvinte de bolha nem é consultado', () => {
    const pauseMenu = document.createElement('div'); // without it menu-nav consumes the key and stops there
    wire({ pauseMenu });
    setPhaseValue('paused');
    press('Escape');
    // neither `togglePause` nor even the state read the snapshot would make:
    expect(log.some(([n]) => n === 'keydown:togglePause')).toBe(false);
    expect(log.some(([n]) => n === 'keydown:escapeTarget')).toBe(false);
    // and menu-nav handled it: "no" at the pause menu's root goes back to the game
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
    press('KeyU'); // `run`: menu-nav has no intent for it, so it does not stopPropagation
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
    expect(players[0].jumpEdge).toBe(true); // hidden: blocks nothing

    players[0].jumpEdge = false;
    cfg.hidden = false;
    press('KeyJ');
    expect(players[0].jumpEdge).toBe(false); // visible: the key is swallowed
    press('Escape');
    expect(cfg.hidden).toBe(true);           // and Escape really hides it
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
