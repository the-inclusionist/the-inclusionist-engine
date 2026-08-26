// SPDX-License-Identifier: AGPL-3.0-or-later
// game/coin-spawning.ts — MATERIALIZAÇÃO e CICLO das moedas (Estágio 4). A ponte entre o DADO (game/coins.ts:
// findCoinCandidates/positionEasyCoins) e o RENDER (rebuildCoins cria os sprites; addCoinsForOwner/
// respawnCoinsForOwner geram+renovam o conjunto de UM dono; showPower reflete o poder ativo no HUD). PIXI
// (container/fábrica de sprite) e as fábricas de textura são INJETADAS via initCoinSpawning(ctx) — o módulo
// fica PIXI-free p/ o project node. rebuildExtras/setupExtras/pupTexFor (power-ups) NÃO entram aqui: já foram
// deixados no game.js numa extração anterior (ver o cabeçalho de game/powerups.ts) por estarem acoplados ao
// portão + textura; mantemos essa fronteira. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { TILE, COIN_TARGET } from '../core/constants.js';
import { shuffle } from '../core/rng.js';
import { players, vizMode } from '../core/state.js';
import { coins, setCoins } from './state.js'; // item 19: `coins`/`quizLevel` sao estado do JOGO
import { findCoinCandidates, positionEasyCoins, type Coin } from './coins.js';
import { SOMASUB_SHAPES, WORD_INITIALS } from './activity-content.js';
import type { DomQuery } from '../core/dom-query.js';
import type { Tingivel, CamadaEsvaziavel, CriarSprite } from '../render/port.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`) — injected, never imported, so the module stays node-testable. */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** Superfície mínima de um sprite PIXI que rebuildCoins precisa (estrutural — mantém o módulo testável no node). */
// O `tint` vem de `render/port` (`Tingivel`): `tint: number` era ESTREITAR um campo de outro dono — o
// `PIXI.Sprite` declara `ColorSource`, mais largo, e por isso não cabia aqui (ADR-0039).
//
// E o `alpha` está aqui mesmo sem este módulo tocá-lo: estes sprites são ENTREGUES ao `render/draw` por
// `getCoinSprites()`, e é lá que o item alheio esmaece. Uma fatia mínima do que se LÊ mentiria sobre o que
// se ENTREGA — a inversão que o ADR-0039 registra: em posição de saída, a fatia mínima é a do RECEPTOR.
export interface CoinSprite extends Tingivel {
  x: number; y: number;
  width?: number; height?: number;
  alpha: number;
  visible: boolean;
  destroy(): void;
}
/** O container PIXI onde os sprites de moeda vivem — a camada esvaziável da porta do renderizador.
 *  Era declarado aqui, com `removeChildren(): CoinSprite[]`: pedir de volta algo MAIS ESPECÍFICO do que o
 *  PixiJS entrega (`DisplayObject[]`) é o que não cabia — retorno é covariante. */
export type CoinContainer = CamadaEsvaziavel;
/** Handle opaco de textura — repassado direto do injetor para a fábrica de sprite, nunca inspecionado aqui. */
export type CoinTexture = unknown;

export interface CoinSpawningCtx {
  coinContainer: CoinContainer;                          // camada PIXI onde os sprites de moeda entram
  createSprite: CriarSprite<CoinSprite>;                   // fábrica de sprite (= `new PIXI.Sprite(tex)` na raiz)
  coinTexFor: (mode: string) => CoinTexture;              // textura padrão da moeda (varia por modo acessível)
  shapeTexFor: (shapeId: string) => CoinTexture;          // textura de forma (Soma-Sub; = SHAPE_TEX[id] cacheado)
  letterTexFor: (letter: string) => CoinTexture;          // textura de letra (Sílabas; NÃO cacheada no game.js — ver "Bugs surfados")
  pcolor: number[];                                       // PCOLOR — array mutado IN-PLACE pelo game.js; lido por referência
  getMode: () => string;                                  // MODE ('ludico'|'somasub'|'silabas') — ainda local ao game.js
  getOwnerColors: () => boolean;                          // itens na cor do dono? (opção de acessibilidade)
  invalidateSharedViz: () => void;                        // reseta o cache _lastSharedViz do game.js (força reaplicar viz por viewport)
  powerShort: (kind: string) => string;                   // POWER_SHORT — rótulo curto do HUD, JÁ traduzido (função: o idioma muda)
  $: DomQuery;                                             // seletor DOM (ui/dom.ts's `$`), injetado — showPower nunca toca `document`
}

let ctx: CoinSpawningCtx | null = null;
let _coinSprites: CoinSprite[] = [];

/** Liga as camadas PIXI + fábricas de textura (todas injetadas — o módulo nunca importa PIXI nem game.js). */
export function initCoinSpawning(c: CoinSpawningCtx): void {
  ctx = c;
}
function need(): CoinSpawningCtx {
  if (!ctx) throw new Error('coin-spawning: initCoinSpawning(ctx) não foi chamado');
  return ctx;
}

/** Sprites atualmente na tela, na MESMA ordem/índice de `coins` (game.js indexa coinSprites[i] junto de coins[i]). */
export function getCoinSprites(): CoinSprite[] { return _coinSprites; }

// Recria os sprites de TODAS as moedas a partir do estado `coins` (verbatim do game.js: rebuildCoins).
// Chamado de MUITOS pontos do game.js (troca de cenário, cores do dono, daltonismo, cadeirante, modo sílabas,
// restart) — é o ÚNICO ponto de materialização; por isso fica aqui como contrato estável (mesmo nome/assinatura
// zero-arg), e o game.js mantém um wrapper local que delega pra cá (ver o retorno da tarefa: linhas da religação).
export function rebuildCoins(): void {
  const c = need();
  positionEasyCoins();
  c.coinContainer.removeChildren().forEach((s) => s.destroy());
  const mode = c.getMode();
  _coinSprites = coins.map((cn) => {
    let s: CoinSprite;
    if (mode === 'somasub' && cn.shape) { s = c.createSprite(c.shapeTexFor(cn.shape)); s.width = 15; s.height = 15; s.x = cn.x - 3; s.y = cn.y - 3; }
    else if (mode === 'silabas' && cn.letter) { s = c.createSprite(c.letterTexFor(cn.letter)); s.width = 14; s.height = 14; s.x = cn.x - 2; s.y = cn.y - 2; }
    else { s = c.createSprite(c.coinTexFor(vizMode)); s.x = cn.x; s.y = cn.y; }
    s.tint = c.getOwnerColors() ? (c.pcolor[cn.owner] || 0xffffff) : 0xffffff; // Lote C: cor do dono (opção; solo=branco → sem alteração)
    s.visible = !cn.taken; c.coinContainer.addChild(s); return s;
  });
  c.invalidateSharedViz(); // moedas recriadas → força re-aplicar texturas por viewport no próximo draw
}

// L1: gera/renova os itens de UM dono sem tocar os dos outros (entrada/recomeço em jogo EM ANDAMENTO). Verbatim.
export function addCoinsForOwner(owner: number): void {
  const c = need();
  const a = shuffle(findCoinCandidates());
  const mode = c.getMode();
  const sh = mode === 'somasub' ? shuffle(SOMASUB_SHAPES.map((s) => s.id)) : [];
  const lt = mode === 'silabas' ? shuffle(WORD_INITIALS) : [];
  a.slice(0, Math.min(COIN_TARGET, a.length)).forEach((cand, i2) => coins.push({
    x: cand.tx * TILE + 3, y: cand.ty * TILE + 3, owner, taken: false,
    shape: sh.length ? sh[i2 % sh.length] : '', letter: lt.length ? lt[i2 % lt.length] : '',
  }));
  rebuildCoins();
}

// Recomeço SÓ de um jogador: descarta os itens dele e sorteia um conjunto novo. Verbatim.
export function respawnCoinsForOwner(owner: number): void {
  setCoins(coins.filter((cn) => cn.owner !== owner));
  addCoinsForOwner(owner);
}

// Reflete o poder ativo do jogador 1 no HUD (multiplayer: telas 2-4 não têm esse elemento). Verbatim de showPower;
// `players[0]` vem do leaf core/state.js; `$`/POWER_SHORT são injetados (o módulo nunca toca `document`).
export function showPower(pl: { activePower: string; owned?: string[] }): void {
  if (pl !== players[0]) return; // guard clause: só a tela 1 tem #hud-power
  const c = need();
  const el = c.$('#hud-power');
  if (!el) return;
  el.textContent = c.powerShort(pl.activePower) + (pl.owned && pl.owned.length > 1 ? ' (' + pl.owned.length + ')' : '');
}
