// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/hud.initHud (project BROWSER: precisa de `document` real — createElement/hidden/style/remove).
// Contrato da casca: buildGameHud() esvazia #game-hud e monta UMA .player-screen por jogador (HUD + selo de
// abandono + painel de pausa INJETADO), avisa por onScreensBuilt; updateGameHud() reescreve moedas/poder e
// esconde o contador de quem desistiu; getScreen/showWaitingBadge/clearWaitingBadge operam sobre as telas
// montadas. `numPlayers`/`players` vêm de core/state.js (bindings vivos, como no game.js real).
// ZOMBIES + Right-BICEP. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect, beforeEach } from 'vitest';
import { initHud } from '../app/js/ui/hud.js';
import { players, setNumPlayersValue } from '../app/js/core/state.js';

const $ = (sel) => document.querySelector(sel);
// `powerShort`/`POWER_MSG` são FUNÇÕES desde o item 14: eram tabelas de texto em português, congeladas no
// idioma do boot. O fixture continua sendo uma tabela — é o que se lê melhor num teste — e vira função na
// injeção, o que também prova que o módulo não indexa nada: ele PERGUNTA.
const POWERS_TAB = { off: '—', fly: '🎈 Voo', superjump: '🐇 Super-pulo' };
const POWERS = (k) => POWERS_TAB[k] || '—';

/** Painel de pausa FALSO: o real vem do slice de pausa/ícones e nunca é construído aqui. */
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
    powerShort: POWERS,
    buildScreenPause: (i) => { built.push(i); return fakePause(i); },
    onScreensBuilt: (panes) => announced.push(panes),
    built, announced, // helpers de teste (não fazem parte de HudCtx)
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
// updateGameHud — o conteúdo do HUD a cada frame
// ---------------------------------------------------------------------------------------------

describe('ui/hud · initHud(ctx).updateGameHud', () => {
  it('[Right] escreve as moedas e o rótulo do poder de cada jogador na SUA tela', () => {
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
    players.length = 1; // o array encolheu; a grade de telas ainda é de 2
    expect(() => api.updateGameHud()).not.toThrow();
    const huds = [...document.querySelectorAll('#game-hud .vphud')];
    expect(huds[1].querySelector('.vphud-n').textContent).toBe('9'); // último valor escrito, sem lixo
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
