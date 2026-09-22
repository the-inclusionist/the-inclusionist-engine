// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/hud.initHud (project BROWSER: precisa de `document` real — createElement/hidden/style/remove).
// Contrato da casca: buildGameHud() esvazia #game-hud e monta UMA .player-screen por jogador (HUD + selo de
// abandono + painel de pausa INJETADO), avisa por onScreensBuilt; updateGameHud() reescreve moedas/poder e
// esconde o contador de quem desistiu; getScreen/showWaitingBadge/clearWaitingBadge operam sobre as telas
// montadas. `numPlayers`/`players` vêm de core/state.js (bindings vivos, como no game.js real).
// ZOMBIES + Right-BICEP. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect, beforeEach } from 'vitest';
import { initHud } from '../app/js/ui/hud.js';
import { createRunState } from '../app/js/core/run-state.js';
// A RODADA é local a este arquivo desde 2026-08-26 (ADR-0038, Fase B): `players`/`numPlayers` deixaram de
// ser `let` de `core/state` e passaram a viver na instância que a raiz de composição possui. Aqui o teste
// cria a sua, e os apelidos abaixo mantêm o corpo dos casos escrito como sempre esteve.
const rodada = createRunState();
const players = rodada.players;
const setNumPlayersValue = (n) => rodada.setNumPlayers(n);


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
    getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers,
    powerShort: POWERS,
    // O OBJETIVO entra pelo ctx, como no `main.js`: o HUD não lê mais `collected` do jogador (item 19). O
    // fixture continua declarando jogadores com `collected` porque é o jogo QUE OS TEM — a diferença é que
    // agora quem traduz isso para "quanto de quanto" é a raiz de composição, e não o módulo de engine.
    hudObjective: (i) => ({
      name: { text: 'itens', gender: 'm', plural: true },
      have: (players[i] && players[i].collected) || 0,
      need: 10,
    }),
    hudIcon: '🎯',
    buildScreenPause: (i) => { built.push(i); return fakePause(i); },
    // A BARRA RÁPIDA passou a ser montada aqui também (ADR-0044, item 7). Falsa como a pausa: o que este
    // arquivo mede é a GRADE de telas, não o conteúdo do que se pendura nela.
    buildQuickBar: (i) => { const b = document.createElement('div'); b.className = 'screen-a11y'; b.dataset.player = String(i); return b; },
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

// ---------------------------------------------------------------------------------------------
// A SEPARAÇÃO ESTRUTURAL ENTRE EXPERIÊNCIA E CONTROLE (ADR-0046, issue #85)
// ---------------------------------------------------------------------------------------------
//
// ⚠️ O QUE ESTA SECÇÃO IMPEDE, e o efeito de errar não é cosmético: no modo cego a simulação aplica
// `brightness(0)` à `.screen-exp`, e `filter` de CSS DESCE para os descendentes sem que um filho consiga
// cancelá-lo. Um controlo que caia lá dentro é pintado de preto — e a pessoa fica TRANCADA na simulação,
// sem o botão que a desligaria.
//
// Até 2026-09-07 isto era garantido por dois comentários de código e um registo. O próprio ADR-0046 anota a
// dívida em vez de a esconder («the gate is owed»), e a issue #85 é essa dívida.
//
// ⚠️ MEDIÇÃO DE 07/09: das quatro cláusulas da issue, esta secção paga UMA — e as outras três não
// desapareceram por acaso:
//
//   · a cláusula 4 (`reachOfMode`: simulação → 'mundo', correção → 'mundo-e-menus') JÁ TEM gate, em
//     `viz-setters.node.test.js:687-711`, com mutação conferida. Escrevê-la aqui seria uma segunda opinião
//     sobre a mesma coisa, e duas fontes que se copiam divergem.
//   · as cláusulas 2 e 3 (`#touch-start`, `#caption`, `#touch-controls`) nomeiam marcação que vivia no
//     `app/index.html` e saiu com o cartucho (issue #111). A engine PROCURA esses elementos; não os cria.
//     Enquanto o dono deles for o consumidor, o gate deles é do consumidor — aqui não haveria o que montar.
//     (A bolinha do `vizDotFor` nunca foi DOM: é um `Graphics` do PixiJS, e o filtro que a alcança é o do
//     mundo, não o da `.screen-exp`.)
//
// O que sobra é a cláusula 1, que é a estrutural — e é a que nenhum outro ficheiro afere.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).

describe('ui/hud · o que dá ACESSO fica fora da subárvore que a empatia degrada (ADR-0046, #85)', () => {
  /** As três peças de uma tela, pelo papel que o ADR-0046 lhes dá. */
  function pecasDaTela(i) {
    const scr = document.querySelectorAll('#game-hud .player-screen')[i];
    return {
      scr,
      exp: scr.querySelector('.screen-exp'),
      barra: scr.querySelector('.screen-a11y'),   // CONTROLE: a barra rápida de acessibilidade
      pausa: scr.querySelector('.screen-pause'),  // CONTROLE: o painel de pausa
      hud: scr.querySelector('.vphud'),           // EXPERIÊNCIA
      abandono: scr.querySelector('.vphud-quit'), // EXPERIÊNCIA
    };
  }

  it('[Right] barra rápida e painel de pausa NÃO são descendentes da .screen-exp', () => {
    mount();
    initHud(makeCtx()).buildGameHud();
    const { scr, exp, barra, pausa } = pecasDaTela(0);
    expect(exp, 'a sub-camada de experiência sumiu — não há o que isentar').not.toBe(null);
    expect(barra, 'a barra rápida não foi montada').not.toBe(null);
    expect(pausa, 'o painel de pausa não foi montado').not.toBe(null);

    // ⚠️ `contains` e não `parentElement`, de propósito: o que desce é o `filter`, e ele desce a QUALQUER
    // profundidade. Aferir só o pai deixaria passar a barra pendurada dois níveis abaixo da `.screen-exp`,
    // que sofreria o filtro exactamente igual.
    expect(exp.contains(barra), 'a barra rápida caiu DENTRO da .screen-exp: no modo cego ela fica preta').toBe(false);
    expect(exp.contains(pausa), 'o painel de pausa caiu DENTRO da .screen-exp: a pessoa fica trancada').toBe(false);
    expect(scr.contains(barra) && scr.contains(pausa), 'os controlos saíram da própria tela').toBe(true);
  });

  it('[Interface] e o que é EXPERIÊNCIA continua DENTRO — senão a simulação deixaria de simular', () => {
    // O contrapeso do caso acima, e ele é necessário: mover TUDO para fora da `.screen-exp` faria o
    // primeiro caso passar e esvaziaria o modo empatia, que existe para que a pessoa SINTA o prejuízo.
    // Um gate só do lado do controlo aprovaria a supressão do outro lado.
    mount();
    initHud(makeCtx()).buildGameHud();
    const { exp, hud, abandono } = pecasDaTela(0);
    expect(exp.contains(hud), 'o HUD saiu da experiência — a empatia deixou de o alcançar').toBe(true);
    expect(exp.contains(abandono), 'o selo de abandono saiu da experiência').toBe(true);
  });

  it('[Boundary] a .player-screen NÃO é ela própria a .screen-exp — senão não haveria fora nenhum', () => {
    // O buraco que o `contains` sozinho não fecha. Se a tela inteira ganhasse a classe filtrada, a barra e a
    // pausa continuariam a NÃO ser descendentes do `<div>` interno — e seriam filtradas na mesma, porque o
    // filtro passaria a estar acima delas. A separação depende de a subárvore ser PRÓPRIA.
    mount();
    initHud(makeCtx()).buildGameHud();
    const { scr, exp } = pecasDaTela(0);
    expect(scr.classList.contains('screen-exp'), 'a tela inteira virou experiência: já não há fora').toBe(false);
    expect(exp).not.toBe(scr);
    expect(scr.contains(exp), 'a experiência deixou de ser uma subárvore da tela').toBe(true);
  });

  it('[Many] vale em TODAS as telas do multi-tela, e não só na primeira', () => {
    // O laço do `buildGameHud` monta uma tela por jogador com o mesmo código, mas um gate que medisse só a
    // tela 0 não distinguiria "está certo" de "está certo uma vez". Quatro jogadores = quatro telas.
    mount();
    setPlayers([mk(), mk(), mk(), mk()]);
    initHud(makeCtx()).buildGameHud();
    const telas = document.querySelectorAll('#game-hud .player-screen');
    expect(telas.length).toBe(4);
    for (let i = 0; i < telas.length; i++) {
      const { exp, barra, pausa } = pecasDaTela(i);
      expect(exp.contains(barra), `tela ${i}: a barra rápida caiu dentro da .screen-exp`).toBe(false);
      expect(exp.contains(pausa), `tela ${i}: o painel de pausa caiu dentro da .screen-exp`).toBe(false);
    }
  });
});

// ========================= MUTAÇÕES CONFERIDAS (secção do ADR-0046) =========================
//   · em `ui/hud.ts`, trocando `scr.appendChild(bar)` por `exp.appendChild(bar)` → "[Right]" e "[Many]"
//     reprovam, e é exactamente o defeito da issue #85.
//   · trocando `scr.appendChild(sp)` por `exp.appendChild(sp)` (o painel de pausa) → "[Right]" e "[Many]"
//     reprovam na segunda asserção — e com elas cai também o "[Interface] onScreensBuilt recebe os painéis
//     em ordem e JÁ ancorados na tela certa", que já existia. Registado porque diz uma coisa útil: a pausa
//     tinha meia guarda desde sempre (alguém verificava a ÂNCORA), e a barra rápida não tinha nenhuma.
//   · trocando `exp.appendChild(d)` por `scr.appendChild(d)` (o HUD) → "[Interface]" reprova. É a mutação
//     que prova que o gate não aprova esvaziar a experiência para satisfazer o primeiro caso.
//   · pondo `scr.className = 'player-screen screen-exp'` → "[Boundary]" reprova. ⚠️ E "[Right]" continua
//     VERDE, porque a barra deixa de ser descendente do `<div>` interno enquanto passa a estar sob o filtro:
//     é o caso que mostra por que a descendência sozinha não basta.
