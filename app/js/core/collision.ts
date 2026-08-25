// SPDX-License-Identifier: AGPL-3.0-or-later
// core/collision.ts — consultas de colisão da GRADE do mundo (determinístico). Extraído do game.js (Estágio 4).
// Design testável: o módulo NÃO guarda cópias do estado mutável — recebe CLOSURES em initCollision() que leem o
// estado VIVO do game.js (wheelchair/modoCego/caneBlockDiv/wcSolid/gateTiles/gateOpen). Assim a colisão sempre
// enxerga o valor atual (sem risco de dessincronização) e os testes passam um ctx falso → funções 100% puras.
// TILE/TILE_TYPES são constantes (import direto). Consumido pela física (resolveX/resolveY/stepPlayer) no game.js.
import { TILE, TILE_TYPES, ehPerigo, ehTrampolim } from './constants.js';

// (`TileType` era declarado AQUI, privado, e era por isso que a tabela semântica não era usável de fora.
//  Mudou de casa para `core/constants`, junto da tabela que ele descreve.)
const TYPES = TILE_TYPES;

export type CollisionCtx = {
  world: number[][];          // grade WORLD[y][x] (tipos de tile)
  W: number; H: number;       // dimensões em tiles
  isWheelchair: () => boolean; // empatia motora: lava(9)+trampolim(5) viram chão atravessável
  isModoCego: () => boolean;   // empatia cegueira (auditiva): lava(9) vira chão (remove o perigo)
  caneDiv: () => number;       // divisor da batida de bengala (1 = 1/bloco; 2 = 1/meio-bloco)
  // `ReadonlySet` e não `Set`: este módulo só chama `.has()`. Pedir `Set` era pedir capacidade de escrita
  // que ele não usa — o mesmo erro que `PlayerView` existe para impedir do lado do jogador, e o que fazia
  // o `ReadonlySet` do `core/state` não conseguir atravessar até aqui.
  wcSolid: () => ReadonlySet<string>;  // sólidos SÓ-cadeirante ("x,y") — pontes/plataformas que não existem no modo normal
  gateTiles: () => ReadonlySet<string>; // tiles do portão dinâmico ("tx,ty")
  gateOpen: () => boolean;     // portão aberto? (fechado ⇒ seus tiles são sólidos)
};

// closures no-op até initCollision() (evita null-check no caminho quente da física).
let _world: number[][] = [], _W = 0, _H = 0;
let _isWheelchair: () => boolean = () => false;
let _isModoCego: () => boolean = () => false;
let _caneDiv: () => number = () => 1;
let _wcSolid: () => ReadonlySet<string> = () => new Set();
let _gateTiles: () => ReadonlySet<string> = () => new Set();
let _gateOpen: () => boolean = () => true;

// Liga a colisão ao mundo + estado vivo. Chamado UMA vez no boot do game.js (após WORLD pronto). Idempotente.
export function initCollision(ctx: CollisionCtx): void {
  _world = ctx.world; _W = ctx.W; _H = ctx.H;
  _isWheelchair = ctx.isWheelchair; _isModoCego = ctx.isModoCego; _caneDiv = ctx.caneDiv;
  _wcSolid = ctx.wcSolid; _gateTiles = ctx.gateTiles; _gateOpen = ctx.gateOpen;
}

// distância (px) entre batidas de bengala = TILE / divisor.
export const caneBlockPx = (): number => TILE / _caneDiv();

// Um TIPO de tile é sólido? Cadeirante: PERIGO e TRAMPOLIM viram chão. Modo cego: o PERIGO vira chão.
// Pelas perguntas e não pelos números 9 e 5: a regra é sobre o que o tile É, e assim ela continua verdadeira
// num mapa com outra numeração — que é exatamente o que um segundo jogo tem.
export const isSolidType = (t: number): boolean =>
  ((_isWheelchair() && (ehPerigo(t) || ehTrampolim(t))) || (_isModoCego() && ehPerigo(t))) ? true : !!TYPES[t]?.solid;

// Tile na posição (fora do mundo = pedra(2), parede natural). Coordenadas em TILES.
export const tileAt = (tx: number, ty: number): number =>
  (tx < 0 || tx >= _W || ty < 0 || ty >= _H) ? 2 : _world[ty][tx];

// Sólido "de pisar" (inclui sólidos só-cadeirante). isSolidType já cobre lava/trampolim no modo cadeira.
export const solidTile = (x: number, y: number): boolean => {
  const t = tileAt(x, y); return (_isWheelchair() && _wcSolid().has(x + ',' + y)) || isSolidType(t);
};

// Sólido "de barrar" (inclui portão fechado + sólidos só-cadeirante). Usado pela física.
export const solidAt = (tx: number, ty: number): boolean =>
  (!_gateOpen() && _gateTiles().has(tx + ',' + ty)) || (_isWheelchair() && _wcSolid().has(tx + ',' + ty)) || isSolidType(tileAt(tx, ty));

// Topo caminhável: sólido com ar logo acima (é uma superfície onde se anda).
export const surfTop = (x: number, y: number): boolean => solidTile(x, y) && !solidTile(x, y - 1);

// Cadeirante: (col,row) é o "degrau" que uma rampa de 1 tile cobre? (superfície com vizinho-diagonal 1 acima)
export const isWcRampRiser = (col: number, row: number): boolean =>
  surfTop(col, row) && (surfTop(col - 1, row + 1) || surfTop(col + 1, row + 1));

// Altura (px) da diagonal 45° de uma rampa de 1 tile no x=cx do mundo; null se não há rampa por perto de py.
export function rampSurfaceY(cx: number, py: number): number | null {
  const tcx = Math.floor(cx / TILE), fx = cx - tcx * TILE, ty = Math.floor(py / TILE);
  for (let y = ty - 1; y <= ty + 1; y++) {
    if (y < 1 || !surfTop(tcx, y)) continue;
    if (surfTop(tcx + 1, y - 1)) return y * TILE - fx;       // degrau sobe p/ direita: y*TILE → (y-1)*TILE
    if (surfTop(tcx - 1, y - 1)) return (y - 1) * TILE + fx; // degrau sobe p/ esquerda: (y-1)*TILE → y*TILE
  }
  return null;
}
