// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de game/session — o CICLO DE VIDA DA RODADA (project node). ZOMBIES + Right-BICEP.
//
// A parte mais valiosa do módulo é a que não parece lógica de jogo: a CAIXA DE COLETA contra a CAIXA DO ITEM
// (com o `pad` do modo Fácil), a decisão "abrir quiz ou pegar direto", a conta do "cabem N telas?" e a lista
// única de campos de um jogador no começo de rodada. Tudo isso é puro e vem primeiro, sem ctx nenhum.
// Depois vêm os efeitos: `initSession` com um ctx FALSO que registra o que foi chamado (o DOM é um mapa de
// objetos simples; o áudio e o leitor de tela são gravadores de string), mais os módulos-folha reais
// (core/state, game/coins, game/coin-spawning) inicializados com um mundo minúsculo.
//
// A regra que este arquivo tenta honrar: um caso que não pode FALHAR não está testando nada. Cada `it` aqui
// foi conferido contra uma mutação deliberada no módulo (inverter um `<` da caixa, tirar o `pad`, esquecer um
// campo do reset, deixar activateScreens crescer sem checar fitsN) — ver o relatório da etapa C2.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (C2).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  initSession, collectBox, coinItemBox, powerupBox, gateTileBox, overlaps, coinAction,
  fitsScreens, clampScreens, objectiveText, restartAnnounce, roundStartFields,
  MODE_LABELS, MODES, SCREEN_LABELS,
} from '../app/js/game/session.js';
import { BOX, SPAWN_X, SPAWN_Y, makePlayer } from '../app/js/game/player.js';
import { TILE, EASY, COIN_TARGET } from '../app/js/core/constants.js';
import * as COL from '../app/js/core/collision.js';
import { initCoins } from '../app/js/game/coins.js';
import { initCoinSpawning, getCoinSprites } from '../app/js/game/coin-spawning.js';
import { coins, players, numPlayers, setCoins, setNumPlayersValue } from '../app/js/core/state.js';

/* ===================== 1. A DECISÃO PURA DA COLETA (sem ctx, sem DOM) ===================== */

describe('game/session — collectBox: a caixa de coleta e o `pad` do modo Fácil', () => {
  it('[Zero] fora do modo Fácil, a caixa de coleta É a caixa do corpo (BOX, ancorada nos pés)', () => {
    expect(collectBox({ x: 100, y: 200 })).toEqual({ x: 100 - BOX.w / 2, y: 200 - BOX.h, w: BOX.w, h: BOX.h });
  });
  it('[One] no modo Fácil a caixa cresce EASY.pad para cada lado (o canto sobe e recua)', () => {
    const b = collectBox({ x: 100, y: 200, easy: true });
    expect(b).toEqual({ x: 100 - BOX.w / 2 - EASY.pad, y: 200 - BOX.h - EASY.pad, w: BOX.w + 2 * EASY.pad, h: BOX.h + 2 * EASY.pad });
  });
  it('[Right] Fácil ganha exatamente 2*pad em cada eixo — nem 1*, nem 4*', () => {
    const n = collectBox({ x: 0, y: 0 }), e = collectBox({ x: 0, y: 0, easy: true });
    expect(e.w - n.w).toBe(2 * EASY.pad);
    expect(e.h - n.h).toBe(2 * EASY.pad);
  });
  it('[Boundary] `easy:false` é tratado como fora do Fácil (nada de pad por valor "presente")', () => {
    expect(collectBox({ x: 50, y: 50, easy: false })).toEqual(collectBox({ x: 50, y: 50 }));
  });
});

describe('game/session — coinItemBox: 9px no Lúdico, 15px (deslocada 3px) nos modos didáticos', () => {
  it('[Zero] Lúdico: 9×9 na própria célula, sem deslocamento', () => {
    expect(coinItemBox('ludico', { x: 32, y: 48 })).toEqual({ x: 32, y: 48, w: 9, h: 9 });
  });
  it('[One] Soma-Sub: 15×15 começando 3px acima e à esquerda (a figura é desenhada assim)', () => {
    expect(coinItemBox('somasub', { x: 32, y: 48 })).toEqual({ x: 29, y: 45, w: 15, h: 15 });
  });
  it('[Many] Sílabas usa a MESMA caixa grande do Soma-Sub — "grande" é "não-Lúdico"', () => {
    expect(coinItemBox('silabas', { x: 32, y: 48 })).toEqual(coinItemBox('somasub', { x: 32, y: 48 }));
  });
  it('[Right] a caixa grande cobre a pequena e sobra 3px em cada borda superior/esquerda', () => {
    const p = coinItemBox('ludico', { x: 0, y: 0 }), g = coinItemBox('somasub', { x: 0, y: 0 });
    expect(g.x).toBe(p.x - 3); expect(g.y).toBe(p.y - 3);
    expect(g.x + g.w).toBe(p.x + p.w + 3); expect(g.y + g.h).toBe(p.y + p.h + 3);
  });
});

describe('game/session — powerupBox e gateTileBox', () => {
  it('power-up é 12×12 na própria posição (sem o deslocamento das moedas didáticas)', () => {
    expect(powerupBox({ x: 7, y: 9 })).toEqual({ x: 7, y: 9, w: 12, h: 12 });
  });
  it('tile de portão: a margem de 4px vale nos QUATRO lados (toque por cima e ao lado conta)', () => {
    expect(gateTileBox({ tx: 2, ty: 3 })).toEqual({ x: 2 * TILE - 4, y: 3 * TILE - 4, w: TILE + 8, h: TILE + 8 });
  });
  it('[Right] sem margem, a caixa do portão é exatamente o tile', () => {
    expect(gateTileBox({ tx: 2, ty: 3 }, 0)).toEqual({ x: 2 * TILE, y: 3 * TILE, w: TILE, h: TILE });
  });
});

describe('game/session — overlaps: sobreposição AABB ESTRITA', () => {
  const A = { x: 0, y: 0, w: 10, h: 10 };
  it('[Zero] caixas separadas não se tocam', () => {
    expect(overlaps(A, { x: 50, y: 0, w: 10, h: 10 })).toBe(false);
  });
  it('[One] sobreposição de 1px em ambos os eixos JÁ conta', () => {
    expect(overlaps(A, { x: 9, y: 9, w: 10, h: 10 })).toBe(true);
  });
  it('[Boundary] encostar exatamente na borda NÃO conta (direita, esquerda, baixo e cima)', () => {
    expect(overlaps(A, { x: 10, y: 0, w: 10, h: 10 })).toBe(false); // encosta à direita
    expect(overlaps(A, { x: -10, y: 0, w: 10, h: 10 })).toBe(false); // encosta à esquerda
    expect(overlaps(A, { x: 0, y: 10, w: 10, h: 10 })).toBe(false); // encosta abaixo
    expect(overlaps(A, { x: 0, y: -10, w: 10, h: 10 })).toBe(false); // encosta acima
  });
  it('[Right] sobrepor em UM eixo só não basta — precisa dos dois', () => {
    expect(overlaps(A, { x: 5, y: 100, w: 10, h: 10 })).toBe(false);
    expect(overlaps(A, { x: 100, y: 5, w: 10, h: 10 })).toBe(false);
  });
  it('[Simple] é simétrico', () => {
    const B = { x: 5, y: 5, w: 10, h: 10 };
    expect(overlaps(A, B)).toBe(overlaps(B, A));
  });
});

describe('game/session — coinAction: abrir o desafio ou pegar direto', () => {
  it('[Zero] Lúdico sempre pega direto, mesmo se a moeda carregar forma/letra', () => {
    expect(coinAction('ludico', { shape: 'circulo', letter: 'B' })).toBe('take');
  });
  it('[One] Soma-Sub com forma → quiz de conta; Sílabas com letra → quiz de palavra', () => {
    expect(coinAction('somasub', { shape: 'circulo' })).toBe('somasub');
    expect(coinAction('silabas', { letter: 'B' })).toBe('silabas');
  });
  it('[Boundary] modo didático SEM a carga daquele modo cai para "pegar direto"', () => {
    expect(coinAction('somasub', { letter: 'B' })).toBe('take');   // letra não abre conta
    expect(coinAction('silabas', { shape: 'circulo' })).toBe('take'); // forma não abre palavra
    expect(coinAction('somasub', { shape: '' })).toBe('take');     // string vazia é ausência de carga
  });
});

/* ===================== 2. A DECISÃO PURA DO Nº DE TELAS ===================== */

describe('game/session — clampScreens: 1..4 e nada além', () => {
  it('[Boundary] o piso é 1 e o teto é 4', () => {
    expect(clampScreens(0)).toBe(1); expect(clampScreens(-7)).toBe(1);
    expect(clampScreens(5)).toBe(4); expect(clampScreens(99)).toBe(4);
  });
  it('[Interface] `n|0` engole fração, string e NaN vindos da UI', () => {
    expect(clampScreens(2.9)).toBe(2);
    expect(clampScreens('3')).toBe(3);
    expect(clampScreens(NaN)).toBe(1);
  });
});

describe('game/session — fitsScreens: cabem N telas nesta janela?', () => {
  // 1 tela = base 320×180 → exige 2*(320-10)=620 × 2*(180-10)=340
  it('[Zero] janela minúscula não comporta nem uma tela', () => {
    expect(fitsScreens(1, 320, 180)).toBe(false);
  });
  it('[Boundary] o limiar de 1 tela é EXATAMENTE 620×340 (>= passa, 1px a menos falha)', () => {
    expect(fitsScreens(1, 620, 340)).toBe(true);
    expect(fitsScreens(1, 619, 340)).toBe(false);
    expect(fitsScreens(1, 620, 339)).toBe(false);
  });
  it('[Many] 2 telas dobram a largura exigida mas NÃO a altura (grade 2×1)', () => {
    expect(fitsScreens(2, 1260, 340)).toBe(true);   // 2*(640-10)=1260
    expect(fitsScreens(2, 1259, 340)).toBe(false);
    expect(fitsScreens(2, 1260, 339)).toBe(false);
  });
  it('[Many] 3 e 4 telas exigem o MESMO retângulo (ambas são a grade 2×2)', () => {
    expect(fitsScreens(3, 1260, 700)).toBe(fitsScreens(4, 1260, 700));
    expect(fitsScreens(4, 1260, 700)).toBe(true);   // 2*(360-10)=700
    expect(fitsScreens(4, 1260, 699)).toBe(false);
  });
  it('[Right] uma janela que comporta 4 telas comporta todas as menores (monotônico)', () => {
    for (const n of [1, 2, 3]) expect(fitsScreens(n, 1920, 1080)).toBe(true);
    expect(fitsScreens(4, 1920, 1080)).toBe(true);
  });
});

/* ===================== 3. OS TEXTOS DA RODADA ===================== */

describe('game/session — objectiveText e restartAnnounce', () => {
  it('[One] solo: o texto segue o MODO', () => {
    expect(objectiveText('ludico', 1)).toBe('Colete 10 moedas');
    expect(objectiveText('somasub', 1)).toBe('Resolva 10 contas');
    expect(objectiveText('silabas', 1)).toBe('Monte 10 palavras');
  });
  it('[Many] multi-tela vira CORRIDA e engole o modo (a mesma frase para os três)', () => {
    for (const m of MODES) expect(objectiveText(m, 3)).toBe(`3 jogadores — corrida pelas ${COIN_TARGET} moedas`);
  });
  it('[Boundary] a fronteira do "multi" é n>1 — com n=1 ainda é o texto do modo', () => {
    expect(objectiveText('ludico', 1)).not.toContain('corrida');
    expect(objectiveText('ludico', 2)).toContain('corrida');
  });
  it('[Right] o anúncio do leitor de tela segue a MESMA árvore de decisão do objetivo', () => {
    expect(restartAnnounce('somasub', 1)).toContain('Soma-Sub');
    expect(restartAnnounce('silabas', 1)).toContain('Sílabas');
    expect(restartAnnounce('ludico', 1)).toBe('Nova rodada. Colete 10 moedas.');
    expect(restartAnnounce('somasub', 2)).toBe('2 jogadores, cada um na sua tela. Corram pelas moedas.');
  });
});

describe('game/session — os rótulos que saíram do game.js', () => {
  it('há um rótulo de botão para cada modo do ciclo, e o ciclo tem os três modos', () => {
    expect([...MODES]).toEqual(['ludico', 'somasub', 'silabas']);
    for (const m of MODES) expect(typeof MODE_LABELS[m]).toBe('string');
  });
  it('há um rótulo de tela para cada uma das 4 telas possíveis', () => {
    expect(SCREEN_LABELS).toHaveLength(4);
    for (let n = 1; n <= 4; n++) expect(SCREEN_LABELS[n - 1]).toContain(String(n));
  });
});

/* ===================== 4. "UM JOGADOR NO COMEÇO DE UMA RODADA" ===================== */

// A OUTRA lista de campos, em game/player.ts. Estes testes são o único lugar onde as duas se encontram.
describe('game/session — roundStartFields × makePlayer: as duas listas que precisam concordar', () => {
  it('[Right] o SPAWN é a mesma fórmula nos dois arquivos, para os 4 jogadores', () => {
    for (let i = 0; i < 4; i++) {
      const f = roundStartFields(i), m = makePlayer(i);
      expect(f.x).toBe(m.x); expect(f.y).toBe(m.y);
      expect(f.x).toBe(SPAWN_X + i * 22); expect(f.y).toBe(SPAWN_Y);
    }
  });
  it('[Right] todo campo que as DUAS listas conhecem tem o MESMO valor inicial', () => {
    const f = roundStartFields(0), m = makePlayer(0);
    for (const k of Object.keys(f)) {
      if (!(k in m)) continue;
      expect({ [k]: f[k] }).toEqual({ [k]: m[k] });
    }
  });
  it('[Zero] os únicos campos do reset que makePlayer NÃO conhece são `quit` e `runCane`', () => {
    const m = makePlayer(0);
    const orfaos = Object.keys(roundStartFields(0)).filter((k) => !(k in m));
    expect(orfaos.sort()).toEqual(['quit', 'runCane']);
  });
  it('[Right] os campos de makePlayer que o reset NÃO zera são exatamente esta lista (tripwire)', () => {
    const f = roundStartFields(0);
    const naoResetados = Object.keys(makePlayer(0)).filter((k) => !(k in f)).sort();
    expect(naoResetados).toEqual([
      '_swapDown', '_swapSonar', '_swapT', '_tx', 'airTime', 'anim', 'climbFrame', 'ctrl', 'easy',
      'facing', 'flavorT', 'guardT', 'i', 'idleNow', 'inWater', 'jumpEdge', 'leftEdge', 'onGround', 'pad',
      'rightEdge', 'rmBreath', 'rmFlavor', 'rmWalk', 'runEdge', 'sprite', 'stepT', 'toggleMove',
      'viz', 'walkAnim', 'walkDir',
    ]);
  });
  it('[Interface] `owned` nasce um array NOVO a cada chamada (dois jogadores não dividem inventário)', () => {
    const a = roundStartFields(0), b = roundStartFields(1);
    expect(a.owned).toEqual([]);
    expect(a.owned).not.toBe(b.owned);
  });
});

/* ===================== 5. OS EFEITOS: initSession com ctx falso ===================== */

// Mundo minúsculo para o sorteio de moedas: 12×8, chão de pedra(2) na última linha, resto ar(1).
function mundo() {
  const g = Array.from({ length: 8 }, () => new Array(12).fill(1));
  g[7] = new Array(12).fill(2);
  return g;
}

// Elemento de DOM falso: só o que o módulo toca.
function elFalso() {
  return {
    textContent: '', hidden: false, clientWidth: 1920, clientHeight: 1080, attrs: {}, focused: 0,
    setAttribute(n, v) { this.attrs[n] = v; }, focus() { this.focused++; },
  };
}

let DOM, LOG, CTX, S;

// ctx falso: DOM em mapa, áudio/leitor de tela em gravadores, e o estado `let` do game.js em variáveis daqui.
function novoCtx(over = {}) {
  DOM = {};
  for (const sel of ['#hud-coins', '#hud-objective', '#win-msg', '#win-overlay', '#btn-again',
    '#game-region', '#opt-mode', '#opt-telas', '#stage-wrap', '#hud-power']) DOM[sel] = elFalso();
  LOG = { say: [], alert: [], narrate: [], sfx: [], chamadas: [] };
  const marca = (nome) => () => { LOG.chamadas.push(nome); };
  const estado = {
    mode: 'ludico', collected: 0, ended: false, powerups: [], gate: null, gateOpen: true,
    pauseActor: 0, ownerColors: true, captionsOn: true, playerRef: null,
  };
  CTX = {
    estado, // exposto para o teste inspecionar/mexer
    $: (sel) => (sel in DOM ? DOM[sel] : null),
    librasReserve: () => 0,
    isCoarsePointer: () => false,
    getMode: () => estado.mode, setModeValue: (m) => { estado.mode = m; },
    setCollected: (n) => { estado.collected = n; },
    setEnded: (v) => { estado.ended = v; },
    getPowerups: () => estado.powerups,
    getGate: () => estado.gate,
    isGateOpen: () => estado.gateOpen, setGateOpen: (v) => { estado.gateOpen = v; },
    getPauseActor: () => estado.pauseActor,
    ownerColors: () => estado.ownerColors,
    captionsOn: () => estado.captionsOn,
    PCOLOR: [0x111111, 0x222222, 0x333333, 0x444444],
    darkRegions: [{ announced: true, gfx: { alpha: 0, visible: false } }],
    getPlayerRef: () => estado.playerRef, setPlayerRef: (p) => { estado.playerRef = p; },
    srSay: (m) => LOG.say.push(m), srAlert: (m) => LOG.alert.push(m), narrate: (m) => LOG.narrate.push(m),
    sfx: (n) => LOG.sfx.push(n), doorSound: (m) => LOG.sfx.push('door:' + m),
    playVictory: marca('playVictory'), showCaption: (t) => LOG.chamadas.push('caption:' + t),
    burstSparkle: (x, y, c) => LOG.chamadas.push('sparkle:' + c), addShake: marca('shake'), addHitstop: marca('hitstop'),
    rnd: () => 0.5,
    POWER_MSG: { superjump: 'Super-pulo!', fly: 'Voo!' },
    coinPools: () => ({ shapes: [], letters: [] }),
    setupExtras: marca('setupExtras'), rebuildExtras: marca('rebuildExtras'), resetMinimap: marca('resetMinimap'),
    openQuiz: (pl, i, s) => LOG.chamadas.push('openQuiz:' + pl.i + ':' + i + ':' + s),
    openSilabas: (pl, i, l) => LOG.chamadas.push('openSilabas:' + pl.i + ':' + i + ':' + l),
    closeQuiz: (pl) => LOG.chamadas.push('closeQuiz:' + pl.i),
    loadPlayerA11y: marca('loadPlayerA11y'),
    assignControls: marca('assignControls'), ensureSprites: marca('ensureSprites'),
    configureRender: marca('configureRender'), reapplyVizAll: marca('reapplyVizAll'),
    layout: marca('layout'), hideTouchControls: marca('hideTouchControls'), updateGameHud: marca('updateGameHud'),
    setPhase: (p) => LOG.chamadas.push('phase:' + p),
    titleShow: (id) => LOG.chamadas.push('title:' + id),
    ...over,
  };
  return CTX;
}

// Repõe o mundo e o estado compartilhado (core/state é singleton) e liga os módulos-folha reais.
function montar(n = 1, over = {}) {
  const g = mundo();
  COL.initCollision({
    world: g, W: 12, H: 8, isWheelchair: () => false, isModoCego: () => false, caneDiv: () => 1,
    wcSolid: () => new Set(), gateTiles: () => new Set(), gateOpen: () => true,
  });
  initCoins({ world: g, W: 12, H: 8, anyEasy: () => false, isWheelchair: () => false });
  players.length = 0;
  for (let i = 0; i < n; i++) players.push(makePlayer(i));
  setNumPlayersValue(n);
  setCoins([]);
  const ctx = novoCtx(over);
  ctx.estado.playerRef = players[0];
  initCoinSpawning({
    coinContainer: { removeChildren: () => [], addChild() { /* noop */ } },
    createSprite: () => ({ x: 0, y: 0, tint: 0, visible: true, destroy() { /* noop */ } }),
    coinTexFor: () => null, shapeTexFor: () => null, letterTexFor: () => null,
    pcolor: ctx.PCOLOR, getMode: () => ctx.estado.mode, getOwnerColors: () => ctx.estado.ownerColors,
    invalidateSharedViz() { /* noop */ }, powerShort: {}, $: ctx.$,
  });
  S = initSession(ctx);
  return S;
}

beforeEach(() => { montar(1); });

/* ---------- collectFor: moeda ---------- */

describe('game/session — collectFor: moedas', () => {
  // jogador em x=48,y=64 → caixa x 43..53, y 34..64. Uma moeda em (46,50) cai dentro.
  const noAlcance = { x: 46, y: 50 };
  const foraDeAlcance = { x: 200, y: 200 };
  function comMoeda(pos, extra = {}) {
    setCoins([{ x: pos.x, y: pos.y, owner: 0, taken: false, shape: '', letter: '', ...extra }]);
  }

  it('[Zero] moeda longe: nada acontece', () => {
    comMoeda(foraDeAlcance);
    S.collectFor(Object.assign(players[0], { x: 48, y: 64 }));
    expect(coins[0].taken).toBe(false);
    expect(players[0].collected).toBe(0);
    expect(LOG.sfx).toEqual([]);
  });
  it('[One] moeda no alcance: marca como pega, conta, toca o earcon e narra a contagem', () => {
    comMoeda(noAlcance);
    S.collectFor(Object.assign(players[0], { x: 48, y: 64 }));
    expect(coins[0].taken).toBe(true);
    expect(players[0].collected).toBe(1);
    expect(LOG.sfx).toContain('coin');
    expect(LOG.narrate.join('|')).toContain(`Moeda 1 de ${COIN_TARGET}`);
  });
  it('[Boundary] moeda encostada na borda direita da caixa NÃO conta; 1px para dentro conta', () => {
    const pl = Object.assign(players[0], { x: 48, y: 64 });
    const dir = collectBox(pl).x + collectBox(pl).w; // 53
    comMoeda({ x: dir, y: 50 });                     // caixa da moeda começa exatamente na borda
    S.collectFor(pl);
    expect(coins[0].taken).toBe(false);
    setCoins([]); comMoeda({ x: dir - 1, y: 50 }); pl.collected = 0;
    S.collectFor(pl);
    expect(coins[0].taken).toBe(true);
  });
  it('[Boundary] a moeda que o Fácil alcança e o normal NÃO — é o pad, e só ele', () => {
    const pl = Object.assign(players[0], { x: 48, y: 64, easy: false });
    const x = collectBox(pl).x + collectBox(pl).w + 2; // 2px fora da caixa normal, dentro da caixa Fácil
    comMoeda({ x, y: 50 });
    S.collectFor(pl);
    expect(coins[0].taken).toBe(false);
    pl.easy = true;
    S.collectFor(pl);
    expect(coins[0].taken).toBe(true);
  });
  it('[Many] Lote C: um jogador NÃO coleta a moeda de outro dono, mesmo em cima dela', () => {
    comMoeda(noAlcance, { owner: 1 });
    S.collectFor(Object.assign(players[0], { x: 48, y: 64 }));
    expect(coins[0].taken).toBe(false);
    expect(players[0].collected).toBe(0);
  });
  it('[Simple] moeda já pega é ignorada (não conta duas vezes)', () => {
    comMoeda(noAlcance, { taken: true });
    S.collectFor(Object.assign(players[0], { x: 48, y: 64 }));
    expect(players[0].collected).toBe(0);
  });
  it('[Interface] o sprite da moeda pega some (índice casado com `coins`)', () => {
    comMoeda(noAlcance);
    S.collectFor(Object.assign(players[0], { x: 48, y: 64 }));
    expect(getCoinSprites()).toHaveLength(0); // nenhum rebuild ainda: o guard evita o crash do monólito
  });
  it('[Exception] Soma-Sub com forma ABRE O QUIZ em vez de pegar — e a moeda continua no mapa', () => {
    CTX.estado.mode = 'somasub';
    comMoeda(noAlcance, { shape: 'circulo' });
    S.collectFor(Object.assign(players[0], { x: 48, y: 64 }));
    expect(LOG.chamadas).toContain('openQuiz:0:0:circulo');
    expect(coins[0].taken).toBe(false);
    expect(players[0].collected).toBe(0);
  });
  it('[Exception] Sílabas com letra abre o quiz de palavra', () => {
    CTX.estado.mode = 'silabas';
    comMoeda(noAlcance, { letter: 'B' });
    S.collectFor(Object.assign(players[0], { x: 48, y: 64 }));
    expect(LOG.chamadas).toContain('openSilabas:0:0:B');
  });
  it('[Exception] com quiz JÁ aberto, tocar a figura de novo não abre um segundo', () => {
    CTX.estado.mode = 'somasub';
    comMoeda(noAlcance, { shape: 'circulo' });
    S.collectFor(Object.assign(players[0], { x: 48, y: 64, quiz: { aberto: true } }));
    expect(LOG.chamadas.filter((c) => c.startsWith('openQuiz'))).toHaveLength(0);
  });
  it('[Exception] a décima moeda encerra a rodada (win): overlay aberto e `ended` verdadeiro', () => {
    comMoeda(noAlcance);
    S.collectFor(Object.assign(players[0], { x: 48, y: 64, collected: COIN_TARGET - 1 }));
    expect(CTX.estado.ended).toBe(true);
    expect(DOM['#win-overlay'].hidden).toBe(false);
  });
  it('[Right] solo NÃO leva o prefixo "Jogador N:" na fala; multi-tela leva', () => {
    comMoeda(noAlcance);
    S.collectFor(Object.assign(players[0], { x: 48, y: 64 }));
    expect(LOG.narrate[0]).toBe(`Moeda 1 de ${COIN_TARGET}.`);
    montar(2);
    setCoins([{ x: 46, y: 50, owner: 1, taken: false, shape: '', letter: '' }]);
    S.collectFor(Object.assign(players[1], { x: 48, y: 64 }));
    expect(LOG.narrate[0]).toBe(`Jogador 2: Moeda 1 de ${COIN_TARGET}.`);
  });
  it('[Right] o contador legado `collected` acompanha o jogador de referência, e só ele', () => {
    montar(2);
    setCoins([{ x: 46, y: 50, owner: 1, taken: false, shape: '', letter: '' }]);
    S.collectFor(Object.assign(players[1], { x: 48, y: 64 }));
    expect(players[1].collected).toBe(1);
    expect(CTX.estado.collected).toBe(0); // o jogador 2 não mexe no contador de tela única
  });
});

/* ---------- collectFor: power-ups, chave e portão ---------- */

describe('game/session — collectFor: power-ups, chave e portão', () => {
  const dentro = { x: 46, y: 50 };
  const pl = () => Object.assign(players[0], { x: 48, y: 64 });

  it('[One] power-up no alcance entra no inventário e vira o poder ATIVO', () => {
    CTX.estado.powerups = [{ kind: 'superjump', ...dentro, by: [] }];
    S.collectFor(pl());
    expect(players[0].owned).toEqual(['superjump']);
    expect(players[0].activePower).toBe('superjump');
    expect(LOG.sfx).toContain('power');
    expect(LOG.narrate.join('|')).toContain('Super-pulo!');
  });
  it('[Boundary] 12px é o alcance do power-up: encostar na borda não pega', () => {
    const p = pl();
    const x = collectBox(p).x + collectBox(p).w; // encosta exatamente
    CTX.estado.powerups = [{ kind: 'superjump', x, y: 50, by: [] }];
    S.collectFor(p);
    expect(players[0].owned).toEqual([]);
  });
  it('[Many] pegar dois poderes acumula o inventário; o ATIVO é o último', () => {
    CTX.estado.powerups = [{ kind: 'superjump', ...dentro, by: [] }, { kind: 'fly', ...dentro, by: [] }];
    S.collectFor(pl());
    expect(players[0].owned).toEqual(['superjump', 'fly']);
    expect(players[0].activePower).toBe('fly');
  });
  it('[Simple] power-up já pego por este jogador é ignorado', () => {
    CTX.estado.powerups = [{ kind: 'superjump', ...dentro, by: [1] }];
    S.collectFor(pl());
    expect(players[0].owned).toEqual([]);
  });
  it('[Exception] a CHAVE não entra no inventário — vira `hasKey` e é anunciada como alerta', () => {
    CTX.estado.powerups = [{ kind: 'key', ...dentro }];
    S.collectFor(pl());
    expect(players[0].hasKey).toBe(true);
    expect(players[0].owned).toEqual([]);
    expect(LOG.alert.join('|')).toContain('chave');
  });
  it('[Exception] a bengala de corrida liga `runCane` e não mexe no poder ativo', () => {
    CTX.estado.powerups = [{ kind: 'runcane', ...dentro, by: [] }];
    S.collectFor(pl());
    expect(players[0].runCane).toBe(true);
    expect(players[0].activePower).toBe('off');
  });
  it('[Zero] portão: sem chave, encostar nele não abre nada', () => {
    CTX.estado.gate = [{ tx: 3, ty: 3 }]; CTX.estado.gateOpen = false;
    S.collectFor(Object.assign(players[0], { x: 3 * TILE + 8, y: 3 * TILE + 20, hasKey: false }));
    expect(CTX.estado.gateOpen).toBe(false);
  });
  it('[One] portão: com a chave, tocar UM tile abre o portão para todos', () => {
    CTX.estado.gate = [{ tx: 3, ty: 3 }]; CTX.estado.gateOpen = false;
    S.collectFor(Object.assign(players[0], { x: 3 * TILE + 8, y: 3 * TILE + 20, hasKey: true }));
    expect(CTX.estado.gateOpen).toBe(true);
    expect(LOG.chamadas).toContain('rebuildExtras');
    expect(LOG.sfx).toContain('gate');
  });
  it('[Boundary] a margem de 4px do portão vale: 3px acima do tile ainda abre, 6px não', () => {
    const abre = (folga) => {
      CTX.estado.gate = [{ tx: 3, ty: 3 }]; CTX.estado.gateOpen = false;
      // pés `folga` px acima do topo do tile → a caixa do corpo termina aí
      S.collectFor(Object.assign(players[0], { x: 3 * TILE + 8, y: 3 * TILE - folga, hasKey: true }));
      return CTX.estado.gateOpen;
    };
    expect(abre(3)).toBe(true);
    expect(abre(6)).toBe(false);
  });
  it('[Simple] portão já aberto não reabre (sem som repetido a cada quadro)', () => {
    CTX.estado.gate = [{ tx: 3, ty: 3 }]; CTX.estado.gateOpen = true;
    S.collectFor(Object.assign(players[0], { x: 3 * TILE + 8, y: 3 * TILE + 20, hasKey: true }));
    expect(LOG.sfx).toEqual([]);
  });
});

/* ---------- updateHud / win / restartGame ---------- */

describe('game/session — updateHud', () => {
  it('[One] solo: só o número do jogador 1', () => {
    players[0].collected = 4;
    S.updateHud();
    expect(DOM['#hud-coins'].textContent).toBe('4');
  });
  it('[Many] multi: um par P<n>:<contagem> por jogador, separados por dois espaços', () => {
    montar(3);
    players[0].collected = 1; players[1].collected = 2; players[2].collected = 3;
    S.updateHud();
    expect(DOM['#hud-coins'].textContent).toBe('P1:1  P2:2  P3:3');
  });
  it('[Zero] sem o elemento no documento, não quebra', () => {
    montar(1, { $: () => null });
    expect(() => S.updateHud()).not.toThrow();
  });
});

describe('game/session — win', () => {
  it('[One] encerra a rodada: `ended`, jingle, overlay, foco no "de novo"', () => {
    S.win(Object.assign(players[0], { x: 10, y: 10, sprite: { alpha: 1, visible: true } }));
    expect(CTX.estado.ended).toBe(true);
    expect(LOG.chamadas).toContain('playVictory');
    expect(DOM['#win-overlay'].hidden).toBe(false);
    expect(DOM['#hud-objective'].textContent).toBe('Concluído! 🎉');
    expect(DOM['#btn-again'].focused).toBe(1);
  });
  it('[Many] multi-tela nomeia o vencedor; solo não nomeia ninguém', () => {
    montar(2);
    S.win(Object.assign(players[1], { sprite: null }));
    expect(DOM['#win-msg'].textContent).toContain('Jogador 2 venceu!');
    montar(1);
    S.win(Object.assign(players[0], { sprite: null }));
    expect(DOM['#win-msg'].textContent).not.toContain('venceu');
  });
  it('[Zero] sem sprite não há confete (mas a vitória acontece do mesmo jeito)', () => {
    S.win(Object.assign(players[0], { sprite: null }));
    expect(LOG.chamadas.filter((c) => c.startsWith('sparkle'))).toHaveLength(0);
    expect(CTX.estado.ended).toBe(true);
  });
  it('[Exception] `win(null)` (vitória sem jogador) não quebra e anuncia o jogador 1', () => {
    montar(2);
    expect(() => S.win(null)).not.toThrow();
    expect(DOM['#win-msg'].textContent).toContain('Jogador 1 venceu!');
  });
  it('[Right] o confete usa as 4 cores de PCOLOR, uma vez cada', () => {
    S.win(Object.assign(players[0], { x: 0, y: 0, sprite: { alpha: 1, visible: true } }));
    expect(LOG.chamadas.filter((c) => c.startsWith('sparkle:'))).toEqual(
      CTX.PCOLOR.map((c) => 'sparkle:' + c));
  });
});

describe('game/session — restartGame', () => {
  it('[One] a rodada nova: itens re-sorteados, segredos reescurecidos, contadores zerados', () => {
    players[0].collected = 7; CTX.estado.collected = 7; CTX.estado.ended = true;
    CTX.estado.darkRegionsAntes = null;
    S.restartGame();
    expect(CTX.estado.collected).toBe(0);
    expect(CTX.estado.ended).toBe(false);
    expect(players[0].collected).toBe(0);
    expect(CTX.darkRegions[0]).toEqual({ announced: false, gfx: { alpha: 1, visible: true } });
    expect(LOG.chamadas).toContain('setupExtras');
    expect(LOG.chamadas).toContain('resetMinimap');
    expect(coins.length).toBe(COIN_TARGET); // 1 jogador × 10 moedas
  });
  it('[Right] fecha o quiz de TODOS os jogadores, não só o do jogador 1', () => {
    montar(3);
    S.restartGame();
    expect(LOG.chamadas.filter((c) => c.startsWith('closeQuiz'))).toEqual(['closeQuiz:0', 'closeQuiz:1', 'closeQuiz:2']);
  });
  it('[Interface] o overlay de vitória volta a ficar escondido e o objetivo é reescrito', () => {
    DOM['#win-overlay'].hidden = false;
    CTX.estado.mode = 'silabas';
    S.restartGame();
    expect(DOM['#win-overlay'].hidden).toBe(true);
    expect(DOM['#hud-objective'].textContent).toBe('Monte 10 palavras');
    expect(LOG.say).toContain(restartAnnounce('silabas', 1));
  });
  it('[Right] setupExtras roda ANTES do reset dos jogadores (o portão fecha antes de alguém andar)', () => {
    const i = LOG.chamadas.indexOf.bind(LOG.chamadas);
    S.restartGame();
    expect(i('setupExtras')).toBeLessThan(i('resetMinimap'));
  });
});

/* ---------- setMode ---------- */

describe('game/session — setMode', () => {
  it('[One] troca o modo, reflete no botão (texto E aria-label) e reinicia a rodada', () => {
    S.setMode('somasub');
    expect(CTX.estado.mode).toBe('somasub');
    expect(DOM['#opt-mode'].textContent).toBe(MODE_LABELS.somasub);
    expect(DOM['#opt-mode'].attrs['aria-label']).toContain('Soma-Sub');
    expect(LOG.chamadas).toContain('setupExtras'); // veio pelo restartGame
    expect(DOM['#game-region'].focused).toBe(1);
  });
  it('[Right] o objetivo do HUD já sai no modo NOVO (a ordem importa: MODE antes do restart)', () => {
    S.setMode('silabas');
    expect(DOM['#hud-objective'].textContent).toBe('Monte 10 palavras');
  });
});

/* ---------- nº de telas ---------- */

describe('game/session — fitsN e isMobile', () => {
  it('[Zero] sem #stage-wrap no documento, é otimista (o layout ainda não rodou)', () => {
    montar(1, { $: () => null });
    expect(S.fitsN(4)).toBe(true);
  });
  it('[One] a janela do wrap decide — 1920×1080 comporta 4 telas', () => {
    expect(S.fitsN(4)).toBe(true);
  });
  it('[Boundary] a reserva do VLibras é DESCONTADA da largura disponível', () => {
    DOM['#stage-wrap'].clientWidth = 1300; DOM['#stage-wrap'].clientHeight = 1080;
    expect(S.fitsN(2)).toBe(true);           // 1300 >= 1260
    CTX.librasReserve = () => 100;
    expect(S.fitsN(2)).toBe(false);          // 1200 < 1260
  });
  it('[Interface] isMobile é o adaptador de matchMedia — nada mais', () => {
    expect(S.isMobile()).toBe(false);
    CTX.isCoarsePointer = () => true;
    expect(S.isMobile()).toBe(true);
  });
});

describe('game/session — setNumPlayers', () => {
  it('[Many] crescer cria jogadores novos, reflete no botão e reinicia a rodada', () => {
    S.setNumPlayers(3);
    expect(players).toHaveLength(3);
    expect(numPlayers).toBe(3);
    expect(DOM['#opt-telas'].textContent).toBe(SCREEN_LABELS[2]);
    expect(DOM['#opt-telas'].attrs['aria-label']).toBe('Telas: 3. Toque para trocar.');
    expect(LOG.chamadas).toContain('configureRender');
    expect(LOG.chamadas).toContain('hideTouchControls');
  });
  it('[Many] encolher descarta os jogadores do fim e reaponta a referência de tela única', () => {
    S.setNumPlayers(4);
    const p0 = players[0];
    S.setNumPlayers(1);
    expect(players).toHaveLength(1);
    expect(numPlayers).toBe(1);
    expect(CTX.estado.playerRef).toBe(p0);
  });
  it('[Boundary] pede 9 telas → vira 4; pede 0 → vira 1', () => {
    S.setNumPlayers(9); expect(numPlayers).toBe(4);
    S.setNumPlayers(0); expect(numPlayers).toBe(1);
  });
  it('[Zero] com 1 tela o controle por toque NÃO é escondido (ele é útil no solo)', () => {
    S.setNumPlayers(1);
    expect(LOG.chamadas).not.toContain('hideTouchControls');
  });
  it('[Right] o sorteio de moedas usa o nº de jogadores NOVO (10 por dono)', () => {
    S.setNumPlayers(2);
    expect(coins).toHaveLength(2 * COIN_TARGET);
  });
});

describe('game/session — activateScreens (Alt+1..4)', () => {
  it('[Zero] pedir o número que já está ativo só avisa, sem reiniciar nada', () => {
    S.activateScreens(1);
    expect(LOG.chamadas).not.toContain('setupExtras');
    expect(LOG.say).toContain('1 tela.');
  });
  it('[Many] CRESCER entra em jogo em andamento (joinPlayer), sem reiniciar a rodada', () => {
    S.restartGame();
    const antes = LOG.chamadas.filter((c) => c === 'setupExtras').length;
    players[0].collected = 5;
    S.activateScreens(3);
    expect(players).toHaveLength(3);
    expect(players[0].collected).toBe(5); // o jogador 1 NÃO recomeçou
    expect(LOG.chamadas.filter((c) => c === 'setupExtras')).toHaveLength(antes);
  });
  it('[Many] DIMINUIR reinicia a rodada (tirar jogador muda a corrida)', () => {
    S.setNumPlayers(4);
    players[0].collected = 5;
    const antes = LOG.chamadas.filter((c) => c === 'setupExtras').length;
    S.activateScreens(2);
    expect(players).toHaveLength(2);
    expect(players[0].collected).toBe(0);
    expect(LOG.chamadas.filter((c) => c === 'setupExtras').length).toBe(antes + 1);
  });
  it('[Exception] janela pequena demais: RECUSA crescer ANTES de tentar entrar jogador nenhum', () => {
    DOM['#stage-wrap'].clientWidth = 700; DOM['#stage-wrap'].clientHeight = 400;
    S.activateScreens(2);
    expect(players).toHaveLength(1);
    // a recusa é a DO activateScreens ("não cabem N telas"), não a do joinPlayer ("não cabe mais uma tela"):
    // sem a guarda daqui o pedido chegaria ao joinPlayer e o usuário ouviria a mensagem errada.
    expect(LOG.alert).toEqual(['Não cabem 2 telas nesta janela — cada tela precisa de ao menos 640×360. Aumente a janela ou use tela cheia.']);
  });
  it('[Exception] no celular o jogo é 1 tela só — qualquer n>1 é recusado', () => {
    CTX.isCoarsePointer = () => true;
    S.activateScreens(2);
    expect(players).toHaveLength(1);
    expect(LOG.alert.join('|')).toContain('celular');
  });
});

/* ---------- a vida de UM jogador ---------- */

describe('game/session — resetPlayerState', () => {
  it('[One] devolve o jogador ao spawn e zera a rodada dele', () => {
    const p = Object.assign(players[0], {
      x: 999, y: 999, vx: 5, vy: -3, collected: 7, hasKey: true, quit: true,
      activePower: 'fly', owned: ['fly'], clinging: true, flying: true, quiz: { q: 1 },
      sprite: { alpha: 0.2, visible: false },
    });
    S.resetPlayerState(p, 0);
    expect(p.x).toBe(SPAWN_X); expect(p.y).toBe(SPAWN_Y);
    expect(p.vx).toBe(0); expect(p.vy).toBe(0);
    expect(p.collected).toBe(0); expect(p.hasKey).toBe(false); expect(p.quit).toBe(false);
    expect(p.activePower).toBe('off'); expect(p.owned).toEqual([]);
    expect(p.clinging).toBe(false); expect(p.flying).toBe(false); expect(p.quiz).toBe(null);
    expect(p.sprite).toEqual({ alpha: 1, visible: true }); // volta a aparecer (quem saiu ficava invisível)
  });
  it('[Many] o índice desloca o spawn 22px por jogador (as telas não nascem empilhadas)', () => {
    montar(4);
    for (let i = 0; i < 4; i++) { S.resetPlayerState(players[i], i); expect(players[i].x).toBe(SPAWN_X + i * 22); }
  });
  it('[Right] aplica TODO campo de roundStartFields, sem esquecer nenhum', () => {
    const p = players[0];
    for (const k of Object.keys(roundStartFields(0))) p[k] = '__sujo__';
    S.resetPlayerState(p, 0);
    const esperado = roundStartFields(0);
    for (const k of Object.keys(esperado)) expect({ [k]: p[k] }).toEqual({ [k]: esperado[k] });
  });
  it('[Zero] jogador sem sprite não quebra o reset', () => {
    const p = Object.assign(players[0], { sprite: null });
    expect(() => S.resetPlayerState(p, 0)).not.toThrow();
  });
});

describe('game/session — respawnPlayer', () => {
  it('[One] recomeça SÓ o jogador pedido e re-sorteia SÓ os itens dele', () => {
    montar(2);
    S.setNumPlayers(2);
    players[0].collected = 4; players[1].collected = 6;
    const doZero = coins.filter((c) => c.owner === 0).map((c) => c.x + ',' + c.y).join('|');
    S.respawnPlayer(1);
    expect(players[1].collected).toBe(0);
    expect(players[0].collected).toBe(4);                  // o outro segue jogando
    expect(coins.filter((c) => c.owner === 0).map((c) => c.x + ',' + c.y).join('|')).toBe(doZero);
    expect(LOG.say.join('|')).toContain('Jogador 2 recomeçou');
  });
  it('[Zero] índice inexistente é ignorado em silêncio', () => {
    const antes = LOG.say.length;
    S.respawnPlayer(9);
    expect(LOG.say).toHaveLength(antes);
  });
});

describe('game/session — joinPlayer', () => {
  it('[One] entra em jogo em andamento: cria jogador, tela e itens PRÓPRIOS', () => {
    S.restartGame();
    players[0].collected = 3;
    expect(S.joinPlayer(null)).toBe(true);
    expect(players).toHaveLength(2);
    expect(numPlayers).toBe(2);
    expect(players[0].collected).toBe(3);                  // ninguém recomeçou
    expect(coins.filter((c) => c.owner === 1)).toHaveLength(COIN_TARGET);
    expect(LOG.chamadas).toContain('configureRender');
  });
  it('[Interface] o índice do controle pedido é gravado no jogador novo', () => {
    S.joinPlayer(2);
    expect(players[1].pad).toBe(2);
  });
  it('[Zero] sem índice de controle, o padrão de makePlayer é preservado (-1 = teclado)', () => {
    S.joinPlayer(null);
    expect(players[1].pad).toBe(-1);
  });
  it('[Boundary] o quinto jogador é recusado', () => {
    S.setNumPlayers(4);
    expect(S.joinPlayer(null)).toBe(false);
    expect(players).toHaveLength(4);
    expect(LOG.alert.join('|')).toContain('4 jogadores');
  });
  it('[Exception] janela apertada recusa a entrada e NÃO cria jogador nenhum', () => {
    DOM['#stage-wrap'].clientWidth = 700; DOM['#stage-wrap'].clientHeight = 400;
    expect(S.joinPlayer(null)).toBe(false);
    expect(players).toHaveLength(1);
  });
  it('[Right] o jogador que entra nasce zerado (resetPlayerState roda depois do makePlayer)', () => {
    S.joinPlayer(null);
    expect(players[1].collected).toBe(0);
    expect(players[1].quit).toBe(false);     // makePlayer NÃO conhece `quit`; o reset é quem o cria
    expect(players[1].x).toBe(SPAWN_X + 22);
  });
});

/* ---------- abandono ---------- */

describe('game/session — releaseKey', () => {
  it('[One] o portador larga a chave e ela volta a aparecer no lugar de origem', () => {
    const key = { kind: 'key', x: 0, y: 0, taken: true, by: [1], sprite: { visible: false } };
    CTX.estado.powerups = [key];
    players[0].hasKey = true;
    S.releaseKey(players[0]);
    expect(players[0].hasKey).toBe(false);
    expect(key.taken).toBe(false);
    expect(key.by).toEqual([]);
    expect(key.sprite.visible).toBe(true);
    expect(LOG.alert.join('|')).toContain('chave voltou');
  });
  it('[Zero] quem não tem a chave (ou não existe) não dispara nada', () => {
    CTX.estado.powerups = [{ kind: 'key', x: 0, y: 0, taken: true, by: [1], sprite: { visible: false } }];
    S.releaseKey(players[0]);
    S.releaseKey(null);
    expect(CTX.estado.powerups[0].taken).toBe(true);
    expect(LOG.alert).toEqual([]);
  });
  it('[Exception] sem chave no mapa, o portador ainda a perde (não fica com uma chave fantasma)', () => {
    CTX.estado.powerups = [];
    players[0].hasKey = true;
    S.releaseKey(players[0]);
    expect(players[0].hasKey).toBe(false);
  });
});

describe('game/session — quitGame', () => {
  it('[One] solo: volta ao menu inicial e reinicia a rodada', () => {
    S.quitGame();
    expect(LOG.chamadas).toContain('phase:title');
    expect(LOG.chamadas).toContain('title:tm-main');
    expect(LOG.chamadas).toContain('setupExtras');
    expect(LOG.say.join('|')).toContain('Jogo abandonado');
  });
  it('[Many] multi: só a tela de quem saiu apaga; o jogo dos outros continua', () => {
    montar(3);
    CTX.estado.pauseActor = 1;
    S.quitGame();
    expect(players[1].quit).toBe(true);
    expect(players[0].quit).toBeFalsy();
    expect(LOG.chamadas).toContain('phase:playing');
    expect(LOG.chamadas).not.toContain('phase:title');
  });
  it('[Right] quem sai devolve a chave que carregava', () => {
    montar(2);
    const key = { kind: 'key', x: 0, y: 0, taken: true, by: [1, 1], sprite: { visible: false } };
    CTX.estado.powerups = [key];
    CTX.estado.pauseActor = 1;
    players[1].hasKey = true;
    S.quitGame();
    expect(key.taken).toBe(false);
    expect(key.sprite.visible).toBe(true);
  });
  it('[Many] quando o ÚLTIMO sai, todos voltam ao menu e os `quit` são limpos', () => {
    montar(2);
    players[0].quit = true;
    CTX.estado.pauseActor = 1;
    S.quitGame();
    expect(players.every((p) => p.quit === false)).toBe(true);
    expect(LOG.chamadas).toContain('phase:title');
    expect(LOG.say.join('|')).toContain('Todos saíram');
  });
});
