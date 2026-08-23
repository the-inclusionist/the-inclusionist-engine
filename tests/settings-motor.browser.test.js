// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de ui/settings-motor — render/reflect/setEasy (project BROWSER: usa document). Contrato: DI por
// closure (ctx.$/srSay/store/players/getNumPlayers/setToggleMove/rebuildCoins), nenhum acesso a globais fora
// do ctx. A lógica pura (clamp/predicado/anúncio/HTML das abas) está coberta em settings-motor.node.test.js.
// Modelo: tests/a11y-sr.browser.test.js, tests/settings-typo.browser.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { initSettingsMotor } from '../app/js/ui/settings-motor.js';

const $ = (sel) => document.querySelector(sel);

function fullCtx(over = {}) {
  const said = [];
  const storeMap = new Map();
  const toggleMoveCalls = [];
  let rebuildCoinsCalls = 0;
  const players = over.players ?? [{ easy: false, toggleMove: false }];
  return {
    $,
    srSay: (msg) => said.push(msg),
    store: { setBool: (k, on) => storeMap.set(k, on ? '1' : '0') },
    players,
    getNumPlayers: () => (over.numPlayers ?? players.length),
    setToggleMove: (i, on) => { toggleMoveCalls.push([i, on]); players[i].toggleMove = on; },
    rebuildCoins: () => { rebuildCoinsCalls++; },
    said,
    storeMap,
    toggleMoveCalls,
    get rebuildCoinsCalls() { return rebuildCoinsCalls; },
    ...over,
  };
}

function mountDom() {
  document.body.innerHTML =
    '<div id="opt-movement" class="mode-btn"></div>' +
    '<div id="movement-players"></div>' +
    '<button id="opt-facil" class="mode-btn" type="button" aria-pressed="false">▶ Desligado</button>' +
    '<button id="opt-altmove" class="mode-btn" type="button" aria-pressed="false">▶ Desligado</button>';
}

describe('ui/settings-motor', () => {
  beforeEach(() => {
    mountDom();
  });

  it('[Zero] initSettingsMotor reflete o estado inicial (tudo desligado) sem anunciar', () => {
    const ctx = fullCtx();
    initSettingsMotor(ctx);
    expect($('#opt-facil').classList.contains('is-on')).toBe(false);
    expect($('#opt-altmove').classList.contains('is-on')).toBe(false);
    expect($('#opt-movement').classList.contains('is-on')).toBe(false);
    expect(ctx.said).toHaveLength(0); // boot não fala
  });

  it('[Interface] initSettingsMotor reflete Fácil já ligado no jogador 0 ao montar', () => {
    const ctx = fullCtx({ players: [{ easy: true, toggleMove: false }] });
    initSettingsMotor(ctx);
    expect($('#opt-facil').classList.contains('is-on')).toBe(true);
    expect($('#opt-facil').getAttribute('aria-pressed')).toBe('true');
    expect($('#opt-facil').textContent).toBe('❚❚ Ligado');
    expect($('#opt-movement').classList.contains('is-on')).toBe(true); // barra acende
  });

  it('[Right] clicar em #opt-facil chama setEasy, persiste, reflete e anuncia', () => {
    const ctx = fullCtx();
    initSettingsMotor(ctx);
    $('#opt-facil').click();
    expect(ctx.players[0].easy).toBe(true);
    expect(ctx.storeMap.get('incl_easy_p0')).toBe('1');
    expect($('#opt-facil').classList.contains('is-on')).toBe(true);
    expect(ctx.rebuildCoinsCalls).toBe(1);
    expect(ctx.said).toEqual([
      'Modo Fácil ligado: gravidade menor, pulo mais alto, coleta tolerante, moedas no chão, sem perigos e sem quedas acidentais (segure ↓ para descer).',
    ]);
  });

  it('[Right] clicar de novo em #opt-facil desliga e anuncia a versão curta', () => {
    const ctx = fullCtx({ players: [{ easy: true, toggleMove: false }] });
    initSettingsMotor(ctx);
    $('#opt-facil').click();
    expect(ctx.players[0].easy).toBe(false);
    expect(ctx.said.at(-1)).toBe('Modo Fácil desligado.');
  });

  it('[Right] clicar em #opt-altmove delega no setToggleMove INJETADO (compartilhado) e reflete', () => {
    const ctx = fullCtx();
    initSettingsMotor(ctx);
    $('#opt-altmove').click();
    expect(ctx.toggleMoveCalls).toEqual([[0, true]]);
    expect($('#opt-altmove').classList.contains('is-on')).toBe(true);
    expect($('#opt-altmove').getAttribute('aria-pressed')).toBe('true');
  });

  it('[Interface] renderMovPlayers mantém #movement-players hidden mesmo com >1 jogador (decisão E3)', () => {
    const ctx = fullCtx({ players: [{ easy: false, toggleMove: false }, { easy: false, toggleMove: false }] });
    const api = initSettingsMotor(ctx);
    api.renderMovPlayers();
    const tabs = $('#movement-players');
    expect(tabs.hidden).toBe(true);
    expect(tabs.querySelectorAll('button[data-mp]')).toHaveLength(2);
  });

  it('[Right] clicar numa aba de jogador troca a seleção e re-reflete Fácil/alternância desse jogador', () => {
    const ctx = fullCtx({
      players: [{ easy: false, toggleMove: false }, { easy: true, toggleMove: true }],
    });
    const api = initSettingsMotor(ctx);
    api.renderMovPlayers();
    $('#movement-players').querySelector('button[data-mp="1"]').click();
    expect(api.getSelPlayer()).toBe(1);
    expect($('#opt-facil').classList.contains('is-on')).toBe(true);
    expect($('#opt-altmove').classList.contains('is-on')).toBe(true);
  });

  it('[Boundary/Edge-case] jogador selecionado >= numPlayers clampa para 0 (o clamp do código atual)', () => {
    const ctx = fullCtx({
      players: [{ easy: true, toggleMove: false }, { easy: false, toggleMove: false }],
      numPlayers: 1, // encolheu de 2 para 1 jogador
    });
    const api = initSettingsMotor(ctx);
    api.setSelPlayer(1); // seleção antiga, agora fora do intervalo
    api.renderMovPlayers();
    expect(api.getSelPlayer()).toBe(0); // clampou de volta
  });

  it('[Right] setSelPlayer troca a seleção (mirrors `selMovPlayer = pauseActor` do game.js)', () => {
    const ctx = fullCtx({
      players: [{ easy: false, toggleMove: false }, { easy: true, toggleMove: false }],
    });
    const api = initSettingsMotor(ctx);
    api.setSelPlayer(1);
    api.reflectFacil();
    expect($('#opt-facil').classList.contains('is-on')).toBe(true);
  });

  it('[Error] setEasy com índice fora do array não lança (mirrors o guard `if(!p)return`)', () => {
    const ctx = fullCtx();
    const api = initSettingsMotor(ctx);
    expect(() => api.setEasy(5, true)).not.toThrow();
    expect(ctx.said).toHaveLength(0); // no-op: não anunciou
  });

  it('[Zero] sem os elementos no DOM, render/reflect não lançam (só não desenham)', () => {
    document.body.innerHTML = '';
    const ctx = fullCtx();
    const api = initSettingsMotor(ctx);
    expect(() => { api.renderMovPlayers(); api.reflectFacil(); api.reflectAltMove(); }).not.toThrow();
  });
});
