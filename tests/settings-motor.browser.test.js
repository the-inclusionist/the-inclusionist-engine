// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-motor — render/reflect/setEasy (project BROWSER: usa document). Contrato: DI por
// closure (ctx.$/srSay/store/players/getNumPlayers/setToggleMove/rebuildCoins), nenhum acesso a globais fora
// do ctx. A lógica pura (clamp/predicado/anúncio/HTML das abas) está coberta em settings-motor.node.test.js.
// Modelo: tests/a11y-sr.browser.test.js, tests/settings-typo.browser.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // os anúncios vêm do dicionário desde o item 14
import { initSettingsMotor } from '../app/js/ui/settings-motor.js';

const $ = (sel) => document.querySelector(sel);

function fullCtx(over = {}) {
  const said = [];
  const storeMap = new Map();
  const toggleMoveCalls = [];
  const toggleRunCalls = [];
  let rebuildCoinsCalls = 0;
  const players = over.players ?? [{ easy: false, toggleMove: false }];
  return {
    $,
    srSay: (msg) => said.push(msg),
    store: { setBool: (k, on) => storeMap.set(k, on ? '1' : '0') },
    players,
    getNumPlayers: () => (over.numPlayers ?? players.length),
    setToggleMove: (i, on) => { toggleMoveCalls.push([i, on]); players[i].toggleMove = on; },
    setToggleRun: (i, on) => { toggleRunCalls.push([i, on]); players[i].toggleRun = on; },
    rebuildCoins: () => { rebuildCoinsCalls++; },
    said,
    storeMap,
    toggleMoveCalls,
    toggleRunCalls,
    get rebuildCoinsCalls() { return rebuildCoinsCalls; },
    ...over,
  };
}

function mountDom() {
  document.body.innerHTML =
    '<div id="opt-movement" class="mode-btn"></div>' +
    '<div id="movement-players"></div>' +
    '<div class="ctrl-row"><span>Modo Fácil</span><button id="opt-facil" class="mode-btn" type="button" aria-pressed="false">▶ Desligado</button></div>' +
    '<div class="ctrl-row"><span>Alternância</span><button id="opt-altmove" class="mode-btn" type="button" aria-pressed="false">▶ Desligado</button></div>' +
    '<div class="ctrl-row"><span>Alternância do correr</span><button id="opt-togglerun" class="mode-btn" type="button" aria-pressed="false">▶ Desligado</button></div>' +
    '<button id="movement-reset" class="mode-btn" type="button">Restaurar</button>' +
    '<button data-act="motora" class="pm-btn" type="button">Acessibilidade motora</button>' +
    '<button id="opt-eyes" class="mode-btn" type="button" aria-pressed="false">▶ Desligado</button>';
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
    // Contra `t()` e não contra a frase: fixar o português aqui devolveria ao teste o texto que o item 14
    // tirou do código. O caso continua pegando chave trocada — `easyOn` e `easyOff` dão frases diferentes.
    expect(ctx.said).toEqual([t('sr.motor.easyOn')]);
  });

  it('[Right] clicar de novo em #opt-facil desliga e anuncia a versão curta', () => {
    const ctx = fullCtx({ players: [{ easy: true, toggleMove: false }] });
    initSettingsMotor(ctx);
    $('#opt-facil').click();
    expect(ctx.players[0].easy).toBe(false);
    expect(ctx.said.at(-1)).toBe('Modo Fácil desligado.');
  });

  it('[Right] clicar em #opt-togglerun delega no setToggleRun INJETADO e reflete', () => {
    // A alternância do CORRER é irmã da de movimento e segue a mesma forma: quem persiste e anuncia é a raiz
    // (ela conhece `players` e o armazenamento); o painel só delega e reflete. O ajuste existe porque a
    // alternância de movimento resolvia METADE — quem toca com um dedo andava sem segurar e continuava sem
    // conseguir CORRER, que ainda exigia manter pressionado.
    const ctx = fullCtx();
    const api = initSettingsMotor(ctx);
    $('#opt-togglerun').click();
    expect(ctx.toggleRunCalls).toEqual([[0, true]]);
    expect($('#opt-togglerun').getAttribute('aria-pressed')).toBe('true');
    expect($('#opt-togglerun').classList.contains('is-on')).toBe(true);
    $('#opt-togglerun').click();
    expect(ctx.toggleRunCalls.at(-1)).toEqual([0, false]);
    expect(api.reflectToggleRun, 'o painel tem de expor o reflexo — a raiz o chama ao ligar no toque').toBeTypeOf('function');
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

describe('ui/settings-motor — restaurar padrões DESTE menu (ADR-0028)', () => {
  beforeEach(() => { mountDom(); });

  it('[Right] devolve Modo Fácil e alternância de TODOS os jogadores, não só o selecionado', () => {
    // O painel edita um jogador por vez, mas o reset é do MENU: deixar o jogador 2 em Modo Fácil porque a aba
    // aberta era a do jogador 1 daria dois estados diferentes com um só nome.
    const players = [{ easy: true, toggleMove: true }, { easy: true, toggleMove: false }];
    const ctx = fullCtx({ players });
    initSettingsMotor(ctx);
    $('#movement-reset').click();
    expect(players).toEqual([{ easy: false, toggleMove: false }, { easy: false, toggleMove: false }]);
  });

  it('[Interface] NÃO desliga o controle pelos olhos — um reset não pode tirar o ponteiro de quem clica com ele', () => {
    // A criança que joga com os olhos aponta com os olhos. Desligar a webcam a deixaria sem como clicar o
    // botão de volta: o reset teria criado a armadilha que existe para desfazer.
    const ctx = fullCtx();
    initSettingsMotor(ctx);
    $('#opt-eyes').setAttribute('aria-pressed', 'true');
    $('#movement-reset').click();
    expect($('#opt-eyes').getAttribute('aria-pressed')).toBe('true');
  });

  it('[Interface] o anúncio DIZ o que ficou de fora — senão a criança conclui que o botão não funcionou', () => {
    const ctx = fullCtx({ players: [{ easy: true, toggleMove: false }] });
    initSettingsMotor(ctx);
    $('#movement-reset').click();
    expect(ctx.said.at(-1)).toContain('olhos');
    expect(ctx.said.at(-1)).toContain('mapeamento');
  });

  it('[Zero] com tudo já no padrão, não escreve nem chama setToggleMove', () => {
    const ctx = fullCtx();
    initSettingsMotor(ctx);
    ctx.storeMap.clear();
    $('#movement-reset').click();
    expect(ctx.toggleMoveCalls).toEqual([]);
    expect(ctx.storeMap.size).toBe(0);
  });
});

describe('ui/settings-motor — marca o que saiu do padrão (ADR-0029)', () => {
  beforeEach(() => { mountDom(); });

  const linha = (id) => $(id).closest('.ctrl-row');

  it('[Right] Modo Fácil ligado marca a linha dele e o botão do menu', () => {
    const ctx = fullCtx({ players: [{ easy: true, toggleMove: false }] });
    initSettingsMotor(ctx);
    expect(linha('#opt-facil').classList.contains('is-changed')).toBe(true);
    expect(linha('#opt-altmove').classList.contains('is-changed')).toBe(false);
    expect($('[data-act="motora"]').classList.contains('is-changed')).toBe(true);
  });

  it('[Boundary] o menu só desmarca quando a ÚLTIMA opção volta — não quando a primeira volta', () => {
    // Se o menu limpasse a marca cedo demais, a opção ainda alterada ficaria escondida atrás de um menu que
    // diz estar intocado, e a criança procuraria em todo lugar menos onde está.
    const players = [{ easy: true, toggleMove: true }];
    const ctx = fullCtx({ players });
    const api = initSettingsMotor(ctx);
    api.setEasy(0, false);
    expect($('[data-act="motora"]').classList.contains('is-changed')).toBe(true);
    $('#movement-reset').click();
    expect($('[data-act="motora"]').classList.contains('is-changed')).toBe(false);
  });

  it('[Zero] tudo no padrão: nada marcado', () => {
    const ctx = fullCtx();
    initSettingsMotor(ctx);
    expect(document.querySelectorAll('.is-changed')).toHaveLength(0);
  });
});
