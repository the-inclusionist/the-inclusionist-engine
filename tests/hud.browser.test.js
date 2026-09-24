// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/hud.initHud (BROWSER project: needs a real `document` — createElement/hidden/style/remove).
// The shell's contract: buildGameHud() empties #game-hud and mounts ONE .player-screen per player (HUD + quit badge +
// INJECTED pause panel) and reports through onScreensBuilt; updateGameHud() rewrites the objective/power and hides the
// counter of whoever quit; getScreen/showWaitingBadge/clearWaitingBadge operate on the mounted screens.
// `numPlayers`/`players` come from a local round double (below).
// ZOMBIES + Right-BICEP. See docs/5-Refactoring/plan-modularization-map.md.
import { describe, it, expect, beforeEach } from 'vitest';
import { initHud } from '../app/js/ui/hud.js';
/*
 * 🔴 THE ROUND IS A LOCAL DOUBLE (ADR-0228: `core/run-state` moved to `game-platformer` with the tile-world stack). This
 * file never tests the round — it HANDS one to what it measures — and the three members below are exactly the ones it
 * reads. A factory and not a literal: two rounds must be two objects.
 */
const createRunState = () => ({ numPlayers: 1, players: [], setNumPlayers(n) { this.numPlayers = n; } });
// `players`/`numPlayers` live in the instance the composition root owns (ADR-0038, Phase B), not in `core/state`. Here
// the test creates its own, and the aliases below keep the cases' bodies short.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);


const $ = (sel) => document.querySelector(sel);
// `powerShort`/`POWER_MSG` are FUNCTIONS (item 14), so they follow the current language. The fixture is still a table —
// it reads best in a test — and becomes a function at injection, which also proves the module indexes nothing: it ASKS.
const POWERS_TAB = { off: '—', fly: '🎈 Voo', superjump: '🐇 Super-pulo' };
const POWERS = (k) => POWERS_TAB[k] || '—';

/** A FAKE pause panel: the real one comes from the pause/icons slice and is never built here. */
function fakePause(i) {
  const sp = document.createElement('div');
  sp.className = 'screen-pause'; sp.hidden = true; sp.dataset.player = String(i);
  return sp;
}

function mount(html = '<div id="game-hud"></div>') { document.body.innerHTML = html; }

function makeCtx(over = {}) {
  const built = []; const announced = [];
  return {
    $,
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    powerShort: POWERS,
    // The OBJECTIVE comes in through the ctx: the HUD does not read the player's `collected` (item 19). The fixture still
    // declares players with `collected` because it is the GAME that has them — what turns that into "how much of how
    // much" is the composition root, not the engine module.
    hudObjective: (i) => ({
      name: { text: 'itens', gender: 'm', plural: true },
      have: (players[i] && players[i].collected) || 0,
      need: 10,
    }),
    hudIcon: '🎯',
    buildScreenPause: (i) => { built.push(i); return fakePause(i); },
    // The QUICK BAR is mounted here too (ADR-0044, item 7). Fake like the pause: what this file measures is the screen
    // GRID, not the content of what hangs on it.
    buildQuickBar: (i) => { const b = document.createElement('div'); b.className = 'screen-a11y'; b.dataset.player = String(i); return b; },
    onScreensBuilt: (panes) => announced.push(panes),
    built, announced, // test helpers (not part of HudCtx)
    ...over,
  };
}

function setPlayers(list) {
  players.length = 0;
  for (const p of list) players.push(p);
  setNumPlayersValue(list.length);
}

const mk = (over = {}) => ({ collected: 0, activePower: 'off', quit: false, ...over });

beforeEach(() => { setPlayers([mk()]); });

// ---------------------------------------------------------------------------------------------
// buildGameHud — a grade de telas
// ---------------------------------------------------------------------------------------------

describe('ui/hud · initHud(ctx).buildGameHud', () => {
  it('[One] solo: uma .player-screen ocupando tudo, com HUD, selo de abandono e o painel de pausa injetado', () => {
    mount();
    const ctx = makeCtx();
    initHud(ctx).buildGameHud();
    const screens = document.querySelectorAll('#game-hud .player-screen');
    expect(screens.length).toBe(1);
    const scr = screens[0];
    expect(scr.dataset.player).toBe('0');
    expect(scr.style.left).toBe('0%');
    expect(scr.style.width).toBe('100%');
    expect(scr.querySelector('.vphud')).not.toBe(null);
    expect(scr.querySelector('.vphud-quit')).not.toBe(null);
    expect(scr.querySelector('.screen-pause')).not.toBe(null);
    expect(ctx.built).toEqual([0]);
  });

  it('[Right] o selo "Jogo abandonado" nasce escondido e o contador nasce em 0', () => {
    mount();
    initHud(makeCtx()).buildGameHud();
    expect($('#game-hud .vphud-quit').hidden).toBe(true);
    expect($('#game-hud .vphud-quit').textContent).toBe('Jogo abandonado');
    expect($('#game-hud .vphud-n').textContent).toBe('0');
    expect($('#game-hud .vphud-pw').textContent).toBe('—');
  });

  it('[Many] 3 jogadores: 3 telas, uma pausa por tela, e a 3ª centralizada na linha de baixo', () => {
    mount();
    setPlayers([mk(), mk(), mk()]);
    const ctx = makeCtx();
    initHud(ctx).buildGameHud();
    const screens = [...document.querySelectorAll('#game-hud .player-screen')];
    expect(screens.length).toBe(3);
    expect(ctx.built).toEqual([0, 1, 2]);
    expect(screens.map((s) => s.dataset.player)).toEqual(['0', '1', '2']);
    expect(screens[2].style.left).toBe('25%');
    expect(screens[2].style.top).toBe('50%');
    expect(document.querySelectorAll('#game-hud .screen-pause').length).toBe(3);
  });

  it('[Zero] com players[] ainda vazio o boot monta 1 tela mesmo assim (buildGameHud roda antes dos jogadores)', () => {
    mount();
    setPlayers([]);
    initHud(makeCtx()).buildGameHud();
    expect(document.querySelectorAll('#game-hud .player-screen').length).toBe(1);
  });

  it('[Exercise] remontar não acumula: 2 telas depois de 4 deixa exatamente 2 (o container é esvaziado)', () => {
    mount();
    setPlayers([mk(), mk(), mk(), mk()]);
    const api = initHud(makeCtx());
    api.buildGameHud();
    expect(document.querySelectorAll('#game-hud .player-screen').length).toBe(4);
    setPlayers([mk(), mk()]);
    api.buildGameHud();
    expect(document.querySelectorAll('#game-hud .player-screen').length).toBe(2);
    expect(document.querySelectorAll('#game-hud .screen-pause').length).toBe(2);
  });

  it('[Interface] onScreensBuilt recebe os painéis em ordem e JÁ ancorados na tela certa', () => {
    mount();
    setPlayers([mk(), mk()]);
    const ctx = makeCtx();
    initHud(ctx).buildGameHud();
    expect(ctx.announced.length).toBe(1);
    const panes = ctx.announced[0];
    expect(panes.length).toBe(2);
    const screens = [...document.querySelectorAll('#game-hud .player-screen')];
    panes.forEach((sp, i) => { expect(sp.parentElement).toBe(screens[i]); });
  });

  it('[Interface] onScreensBuilt é OPCIONAL: sem o gancho a grade monta igual e nada lança', () => {
    mount();
    const ctx = makeCtx({ onScreensBuilt: undefined });
    expect(() => initHud(ctx).buildGameHud()).not.toThrow();
    expect(document.querySelectorAll('#game-hud .player-screen').length).toBe(1);
  });

  it('[Error] sem #game-hud no documento: não lança, não monta tela e NÃO pede painel de pausa', () => {
    mount('<div id="outro"></div>');
    const ctx = makeCtx();
    expect(() => initHud(ctx).buildGameHud()).not.toThrow();
    expect(document.querySelectorAll('.player-screen').length).toBe(0);
    expect(ctx.built).toEqual([]);
    expect(ctx.announced).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// updateGameHud — the HUD's content every frame
// ---------------------------------------------------------------------------------------------

describe('ui/hud · initHud(ctx).updateGameHud', () => {
  it('[Right] escreve o progresso e o rótulo do poder de cada jogador na SUA tela', () => {
    mount();
    setPlayers([mk({ collected: 3, activePower: 'fly' }), mk({ collected: 7, activePower: 'superjump' })]);
    const api = initHud(makeCtx());
    api.buildGameHud();
    api.updateGameHud();
    const huds = [...document.querySelectorAll('#game-hud .vphud')];
    expect(huds[0].querySelector('.vphud-n').textContent).toBe('3');
    expect(huds[0].querySelector('.vphud-pw').textContent).toBe('🎈 Voo');
    expect(huds[1].querySelector('.vphud-n').textContent).toBe('7');
    expect(huds[1].querySelector('.vphud-pw').textContent).toBe('🐇 Super-pulo');
  });

  it('[Right] quem desistiu: selo "Jogo abandonado" aparece e o contador some (visibility hidden)', () => {
    mount();
    setPlayers([mk({ collected: 5, quit: true })]);
    const api = initHud(makeCtx());
    api.buildGameHud();
    api.updateGameHud();
    expect($('#game-hud .vphud-quit').hidden).toBe(false);
    expect($('#game-hud .vphud').style.visibility).toBe('hidden');
  });

  it('[Inverse] desistir e voltar devolve o contador: o HUD reflete o estado ATUAL, não o histórico', () => {
    mount();
    setPlayers([mk({ collected: 5, quit: true })]);
    const api = initHud(makeCtx());
    api.buildGameHud();
    api.updateGameHud();
    players[0].quit = false;
    api.updateGameHud();
    expect($('#game-hud .vphud-quit').hidden).toBe(true);
    expect($('#game-hud .vphud').style.visibility).toBe('visible');
  });

  it('[Error] mais telas do que jogadores (jogador removido sem remontar): não lança e deixa a tela órfã intacta', () => {
    mount();
    setPlayers([mk({ collected: 2 }), mk({ collected: 9 })]);
    const api = initHud(makeCtx());
    api.buildGameHud();
    api.updateGameHud();
    players.length = 1; // the array shrank; the screen grid is still for 2
    expect(() => api.updateGameHud()).not.toThrow();
    const huds = [...document.querySelectorAll('#game-hud .vphud')];
    expect(huds[1].querySelector('.vphud-n').textContent).toBe('9'); // last value written, no garbage
  });

  it('[Zero] chamar updateGameHud ANTES de buildGameHud é no-op silencioso (sem tela montada)', () => {
    mount();
    const api = initHud(makeCtx());
    expect(() => api.updateGameHud()).not.toThrow();
    expect(document.querySelectorAll('#game-hud .player-screen').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// getScreen + selo de espera
// ---------------------------------------------------------------------------------------------

describe('ui/hud · getScreen', () => {
  it('[Right] devolve a .player-screen daquele índice (é onde o quiz de MP se pendura)', () => {
    mount();
    setPlayers([mk(), mk()]);
    const api = initHud(makeCtx());
    api.buildGameHud();
    const screens = [...document.querySelectorAll('#game-hud .player-screen')];
    expect(api.getScreen(1)).toBe(screens[1]);
  });

  it('[Boundary/Error] índice fora da grade devolve null (nunca undefined — o game.js testa com `if`)', () => {
    mount();
    const api = initHud(makeCtx());
    api.buildGameHud();
    expect(api.getScreen(3)).toBe(null);
    expect(api.getScreen(-1)).toBe(null);
  });
});

describe('ui/hud · showWaitingBadge / clearWaitingBadge', () => {
  it('[Right] mostra o convite dentro da tela do jogador que está entrando, com o número dele', () => {
    mount();
    setPlayers([mk(), mk()]);
    const api = initHud(makeCtx());
    api.buildGameHud();
    api.showWaitingBadge(1);
    const w = document.querySelectorAll('#game-hud .vp-wait');
    expect(w.length).toBe(1);
    expect(w[0].textContent).toContain('Jogador 2:');
    expect(w[0].parentElement).toBe(api.getScreen(1));
  });

  it('[Exercise] chamar duas vezes não duplica o selo', () => {
    mount();
    const api = initHud(makeCtx());
    api.buildGameHud();
    api.showWaitingBadge(0);
    api.showWaitingBadge(0);
    expect(document.querySelectorAll('#game-hud .vp-wait').length).toBe(1);
  });

  it('[Inverse] clearWaitingBadge remove o selo e preserva o HUD e o selo de abandono da tela', () => {
    mount();
    const api = initHud(makeCtx());
    api.buildGameHud();
    api.showWaitingBadge(0);
    api.clearWaitingBadge(0);
    expect(document.querySelectorAll('#game-hud .vp-wait').length).toBe(0);
    expect($('#game-hud .vphud')).not.toBe(null);
    expect($('#game-hud .vphud-quit')).not.toBe(null);
  });

  it('[Zero/Error] limpar tela sem selo, ou índice inexistente, é no-op silencioso', () => {
    mount();
    const api = initHud(makeCtx());
    api.buildGameHud();
    expect(() => api.clearWaitingBadge(0)).not.toThrow();
    expect(() => api.clearWaitingBadge(9)).not.toThrow();
    expect(() => api.showWaitingBadge(9)).not.toThrow();
    expect(document.querySelectorAll('#game-hud .vp-wait').length).toBe(0);
  });

  it('[Exercise] remontar a grade descarta o selo junto com a tela antiga', () => {
    mount();
    const api = initHud(makeCtx());
    api.buildGameHud();
    api.showWaitingBadge(0);
    api.buildGameHud();
    expect(document.querySelectorAll('#game-hud .vp-wait').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------
// THE STRUCTURAL SEPARATION BETWEEN EXPERIENCE AND CONTROL (ADR-0046, issue #85)
// ---------------------------------------------------------------------------------------------
//
// ⚠️ WHAT THIS SECTION PREVENTS, and getting it wrong is not cosmetic: in blind mode the simulation applies
// `brightness(0)` to `.screen-exp`, and a CSS `filter` GOES DOWN to the descendants with no way for a child to cancel
// it. A control that falls inside is painted black — and the person is LOCKED in the simulation, without the button
// that would turn it off. ADR-0046 records that the gate was owed («the gate is owed»); issue #85 is that debt.
//
// Of the issue's four clauses, this section pays ONE (clause 1, the structural one, which no other file measures):
//
//   · clause 4 (`reachOfMode`: simulation → 'mundo', correction → 'mundo-e-menus') has its gate in
//     `viz-setters.node.test.js`, with a checked mutation. Writing it here would be a second opinion on the same thing,
//     and two sources that copy each other drift apart.
//   · clauses 2 and 3 (`#touch-start`, `#caption`, `#touch-controls`) name markup the CONSUMER owns: the engine LOOKS
//     FOR those elements and does not create them, so their gate belongs to the consumer. (The `vizDotFor` dot was
//     never DOM: it is a PixiJS `Graphics`, and the filter that reaches it is the world's, not `.screen-exp`'s.)
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).

describe('ui/hud · o que dá ACESSO fica fora da subárvore que a empatia degrada (ADR-0046, #85)', () => {
  /** A screen's three pieces, by the role ADR-0046 gives them. */
  function pecasDaTela(i) {
    const scr = document.querySelectorAll('#game-hud .player-screen')[i];
    return {
      scr,
      exp: scr.querySelector('.screen-exp'),
      barra: scr.querySelector('.screen-a11y'),   // CONTROL: the accessibility quick bar
      pausa: scr.querySelector('.screen-pause'),  // CONTROL: the pause panel
      hud: scr.querySelector('.vphud'),           // EXPERIENCE
      abandono: scr.querySelector('.vphud-quit'), // EXPERIENCE
    };
  }

  it('[Right] barra rápida e painel de pausa NÃO são descendentes da .screen-exp', () => {
    mount();
    initHud(makeCtx()).buildGameHud();
    const { scr, exp, barra, pausa } = pecasDaTela(0);
    expect(exp, 'a sub-camada de experiência sumiu — não há o que isentar').not.toBe(null);
    expect(barra, 'a barra rápida não foi montada').not.toBe(null);
    expect(pausa, 'o painel de pausa não foi montado').not.toBe(null);

    // ⚠️ `contains` and not `parentElement`, on purpose: what goes down is the `filter`, and it goes down to ANY depth.
    // Checking only the parent would let through the bar hanging two levels below `.screen-exp`, which would suffer the
    // filter just the same.
    expect(exp.contains(barra), 'a barra rápida caiu DENTRO da .screen-exp: no modo cego ela fica preta').toBe(false);
    expect(exp.contains(pausa), 'o painel de pausa caiu DENTRO da .screen-exp: a pessoa fica trancada').toBe(false);
    expect(scr.contains(barra) && scr.contains(pausa), 'os controlos saíram da própria tela').toBe(true);
  });

  it('[Interface] e o que é EXPERIÊNCIA continua DENTRO — senão a simulação deixaria de simular', () => {
    // The counterweight of the case above, and it is needed: moving EVERYTHING out of `.screen-exp` would make the first
    // case pass and empty the empathy mode, which exists so the person FEELS the impairment. A gate only on the control
    // side would approve deleting the other side.
    mount();
    initHud(makeCtx()).buildGameHud();
    const { exp, hud, abandono } = pecasDaTela(0);
    expect(exp.contains(hud), 'o HUD saiu da experiência — a empatia deixou de o alcançar').toBe(true);
    expect(exp.contains(abandono), 'o selo de abandono saiu da experiência').toBe(true);
  });

  it('[Boundary] a .player-screen NÃO é ela própria a .screen-exp — senão não haveria fora nenhum', () => {
    // The hole `contains` alone does not close. If the whole screen got the filtered class, the bar and the pause would
    // still NOT be descendants of the inner `<div>` — and would be filtered all the same, because the filter would sit
    // above them. The separation depends on the subtree being ITS OWN.
    mount();
    initHud(makeCtx()).buildGameHud();
    const { scr, exp } = pecasDaTela(0);
    expect(scr.classList.contains('screen-exp'), 'a tela inteira virou experiência: já não há fora').toBe(false);
    expect(exp).not.toBe(scr);
    expect(scr.contains(exp), 'a experiência deixou de ser uma subárvore da tela').toBe(true);
  });

  it('[Many] vale em TODAS as telas do multi-tela, e não só na primeira', () => {
    // `buildGameHud`'s loop mounts one screen per player with the same code, but a gate measuring only screen 0 would
    // not tell "it is right" from "it is right once". Four players = four screens.
    mount();
    setPlayers([mk(), mk(), mk(), mk()]);
    initHud(makeCtx()).buildGameHud();
    const telas = document.querySelectorAll('#game-hud .player-screen');
    expect(telas.length).toBe(4);
    for (let i = 0; i < telas.length; i++) {
      const { exp, barra, pausa } = pecasDaTela(i);
      expect(exp.contains(barra), `tela ${i}: a barra rápida caiu isInside da .screen-exp`).toBe(false);
      expect(exp.contains(pausa), `tela ${i}: o painel de pausa caiu isInside da .screen-exp`).toBe(false);
    }
  });
});

// ========================= MUTATIONS CHECKED (the ADR-0046 section) =========================
//   · in `ui/hud.ts`, replacing `scr.appendChild(bar)` with `exp.appendChild(bar)` → [Right] and [Many] fail, and it is
//     exactly issue #85's defect.
//   · replacing `scr.appendChild(sp)` with `exp.appendChild(sp)` (the pause panel) → [Right] and [Many] fail on the second
//     assertion — and with them the older [Interface] case of onScreensBuilt receiving the panels in order and ALREADY
//     anchored on the right screen. Recorded because it says something useful: the pause had half a guard all along
//     (someone checked the ANCHOR), and the quick bar had none.
//   · replacing `exp.appendChild(d)` with `scr.appendChild(d)` (the HUD) → [Interface] fails. It is the mutation that
//     proves the gate does not approve emptying the experience to satisfy the first case.
//   · setting `scr.className = 'player-screen screen-exp'` → [Boundary] fails. ⚠️ And [Right] stays GREEN, because the
//     bar stops being a descendant of the inner `<div>` while falling under the filter: the case that shows why
//     descent alone is not enough.
