// SPDX-License-Identifier: GPL-3.0-or-later
// render/textures — procedural texture generators for in-world GLYPHS: soma/subtração SHAPES, sílabas LETTERS,
// and power-up ICONS (+ their alto-contraste variant). Verbatim from game.js (behavior-preserving). `disp`
// (letterCase-aware) and the DIRECT_CFG/directSpriteCanvas alto-contraste plumbing are SHARED with other texture
// pipelines (world/coin/tree/parallax) that stay in game.js — INJECTED via initTextures, never read from a
// global. Caches are filled BY initTextures (not at import time) so importing this module stays I/O-free, same
// discipline as render/sprites.ts (Fase 2.24). See docs/5-Refactoring/plano-modularizacao-mapa.md.

import { makeCanvas, tex } from './canvas.js';
import { spriteToCanvas } from './sprite-fx.js';
import { powerupCanvas } from './props.js';
import { SOMASUB_SHAPES } from '../game/activity-content.js';

type Tex = ReturnType<typeof tex>;

/** Alto-contraste plumbing this module needs but does not own — game.js keeps the mutable source of truth
 *  (world/coin/tree/parallax texture pipelines share the same DIRECT_CFG/directSpriteCanvas; `disp` also
 *  serves quiz rendering outside textures). Call once at boot, before the first letterTexture/pupTexFor. */
export interface TexturesCtx {
  disp: (s: string) => string;
  directCfg: Record<string, { off: number; mul: number; bgMul: number }>;
  directSpriteCanvas: (src: HTMLCanvasElement, mode: string) => HTMLCanvasElement;
}
let disp: (s: string) => string = (s) => String(s).toLowerCase(); // safe pre-init default (matches letterCase='lower')
let directCfg: TexturesCtx['directCfg'] = {};
let directSpriteCanvas: TexturesCtx['directSpriteCanvas'] = (src) => src; // safe pre-init default (fg=0 → sem contorno)

/* ===================== soma/subtração: formas ===================== */
/** Vertex list for the polygon shapes (PURE — no canvas). null = drawn via an arc/ellipse/rect primitive instead. */
export function shapePoints(id: string, cx: number, cy: number, r: number): [number, number][] | null {
  switch (id) {
    case 'triangulo': return [[cx, cy - r], [cx + r, cy + r], [cx - r, cy + r]];
    case 'losango': return [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]];
    case 'paralelogramo': return [[cx - r + 3, cy - r * 0.6], [cx + r, cy - r * 0.6], [cx + r - 3, cy + r * 0.6], [cx - r, cy + r * 0.6]];
    case 'trapezio': return [[cx - r * 0.5, cy - r * 0.7], [cx + r * 0.5, cy - r * 0.7], [cx + r, cy + r * 0.7], [cx - r, cy + r * 0.7]];
    case 'pentagono': return Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number]; });
    case 'hexagono': return Array.from({ length: 6 }, (_, i) => { const a = i * 2 * Math.PI / 6; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number]; });
    default: return null;
  }
}
/** 16×16 icon for a soma/subtração shape id (cyan fill + dark outline). */
export function shapeTexture(id: string): Tex {
  const cv = makeCanvas(16, 16), c = cv.getContext('2d')!;
  c.fillStyle = '#7fdcff'; c.strokeStyle = '#04121a'; c.lineWidth = 1.5;
  const cx = 8, cy = 8, r = 6;
  c.beginPath();
  const pts = shapePoints(id, cx, cy, r);
  if (pts) { pts.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x, y)); c.closePath(); }
  else switch (id) {
    case 'circulo': c.arc(cx, cy, r, 0, 7); break;
    case 'oval': c.ellipse(cx, cy, r, r * 0.66, 0, 0, 7); break;
    case 'quadrado': c.rect(cx - r, cy - r, 2 * r, 2 * r); break;
    case 'retangulo': c.rect(cx - r, cy - r * 0.6, 2 * r, r * 1.2); break;
    default: c.arc(cx, cy, r, 0, 7);
  }
  c.fill(); c.stroke();
  return tex(cv);
}
/** Cache keyed by shape id — filled by initTextures (SOMASUB_SHAPES never changes at runtime). */
export const SHAPE_TEX: Record<string, Tex> = {};

/* ===================== sílabas: letra ===================== */
/** 16×16 rounded-square tile with a single letter (uses the injected `disp`, which honors letterCase). */
export function letterTexture(ch: string): Tex {
  const cv = makeCanvas(16, 16), c = cv.getContext('2d')!;
  c.fillStyle = '#ffd23f'; c.strokeStyle = '#1a1400'; c.lineWidth = 1.5;
  c.beginPath();
  if (c.roundRect) c.roundRect(2, 2, 12, 12, 3); else c.rect(2, 2, 12, 12);
  c.fill(); c.stroke();
  c.fillStyle = '#1a1400'; c.font = 'bold 11px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(disp(ch), 8, 9);
  return tex(cv);
}

/* ===================== power-ups: ícone (+ alto contraste) ===================== */
const PUP_KINDS = ['superjump', 'ultrajump', 'turbo', 'fly', 'wallcling', 'key', 'runcane'] as const;
const PUP_CANVAS: Record<string, HTMLCanvasElement> = {};
/** Normal-mode cache — filled by initTextures. */
export const PUP_TEX: Record<string, Tex> = {};
const _pupTexHC: Record<string, Record<string, Tex>> = {}; // {mode:{kind:tex}} — outlined alto-contraste variant
/** Power-up texture for `mode` (normal or alto-contraste-direto). Cached per mode×kind. */
export function pupTexFor(kind: string, mode: string): Tex {
  const hc = (_pupTexHC[mode] = _pupTexHC[mode] || {});
  if (directCfg[mode]) { if (!hc[kind]) hc[kind] = tex(directSpriteCanvas(PUP_CANVAS[kind], mode)); return hc[kind]; }
  return PUP_TEX[kind];
}
/** Drops the alto-contraste power-up cache — game.js's _rebakeDirect clears world/coin/pup/player caches
 *  together whenever outline thickness or role colors change. Call it from there instead of touching a private. */
export function resetPupTexCache(): void {
  for (const k in _pupTexHC) delete _pupTexHC[k];
}

/** Fills SHAPE_TEX/PUP_TEX (+ wires the alto-contraste deps). Call ONCE at boot, before the first rebuildCoins/
 *  rebuildExtras — mirrors game.js's old eager `const SHAPE_TEX=...; SOMASUB_SHAPES.forEach(...)` / PUP_CANVAS
 *  forEach, just deferred past import time so this module stays side-effect-free to import (node tests included). */
export function initTextures(ctx: TexturesCtx): void {
  disp = ctx.disp; directCfg = ctx.directCfg; directSpriteCanvas = ctx.directSpriteCanvas;
  for (const s of SOMASUB_SHAPES) SHAPE_TEX[s.id] = shapeTexture(s.id);
  for (const k of PUP_KINDS) { PUP_CANVAS[k] = powerupCanvas(k); PUP_TEX[k] = tex(PUP_CANVAS[k]); }
}

/* ===================== personagem: arte indexada (DEFERRED — não é código morto) =====================
   FASE ATUAL: o jogo usa o PIXEL ART do PixelLab DIRETO (PNG nativo por quadro, render/sprites.ts — Fase 2.24).
   A conversão deste personagem PROCEDURAL SEMÂNTICO/indexado (PIP_* abaixo) para a arte real do jogo "fica para
   uma fase posterior" — comentário original de game.js, preservado aqui junto do código. ZERO chamadores hoje
   (indexedToCanvas/silhouetteCanvasIdx não são invocadas por ninguém) — isso é trabalho ESTACIONADO de propósito,
   não descartado. Ver docs/plano-arte-procedural.md. */
export const PIP_W = 24, PIP_H = 32;
export const PIP_PAL = ['#fcd7ab', '#e2aa86', '#9d6e62', '#5d2e22', '#472a1e', '#231c1c', '#1e1011', '#ff00ff', '#050809', '#010909'];
export const PIP_IDLE = ['.....99444446666888.....', '...9444444444444448.....', '..924444444444444488....', '.9422442444444444439....', '.94424222442424495338...', '894444444424224495348...', '964664444444444915548...', '966664455444449101658...', '966666595689998000859...', '966659986991891000859...', '96656919911011009819....', '.99969111890000910119...', '990099198999008998819...', '902281890990001920929...', '91133119889000089099....', '.911111121500003409.....', '....991100003330009.....', '.....9821000000009......', '.....999821111198.......', '....92223999998429......', '...9022222399823229.....', '...99888822222283829....', '...91118892222281008....', '..9910000182224910089...', '.939211001844449300829..', '.9335821139999999229329.', '92355589985335229999939.', '939955955255552589..99..', '99..99952555958129......', '.....928899.9925489.....', '....991999..99554339....', '........................'];
export const PIP_WALK = [
  ['.....5566655...........', '...69344433365666......', '..533344434444336......', '.66224444444443466.....', '.54324444443444436.....', '6644442234424499346....', '66466433422323999444...', '66666344434434929445...', '66666448944939313935...', '66666659969856121945...', '66666889992191000945...', '6699681601102018929....', '6921981999900040026....', '9013891806960689926....', '903382190550009905.....', '.41231100220002306.....', '...592100000220006.....', '.....921100000006......', '.....56661111186.......', '....9622269999825......', '....9522222992525......', '....9968862222989......', '....8910062222929......', '.....810082222828......', '.....8100922229919.....', '.....9100996699914.....', '.....6200092559916.....', '.....5100094558988.....', '.....98112989689.......', '.....99889899119.......', '.....9558...95554......', '.....94444.............'],
  ['.....6656655...........', '...68443344466665......', '..933444444444336......', '.98224444443344466.....', '.63424444443444435.....', '6544442244424499446....', '65366434422413695444...', '66566444434433618445...', '66666449944939213845...', '65656869969946122945...', '66666889992191000845...', '6588690911101019919....', '6900881998600080026....', '6012891509950499926....', '813362191860005805.....', '.51131100230002306.....', '...992100000220019.....', '.....921100000008......', '.....98951111189.......', '....8422299989924......', '...99411222992925......', '...89996992222999......', '...99910082222999......', '....981009222299.......', '.....81009222299.......', '.....89206198999.......', '......9200095499.......', '.....54622292499.......', '.....9556999659........', '.....999999.1198.......', '.....9349...64444......', '.....83455.............'],
  ['.....6665656...........', '...96444444466665......', '..633444443444446......', '.55324444443444466.....', '.64424444333444435.....', '6644432244222369334....', '66466433422413699444...', '66666444444444929634...', '66566339944948813934...', '66666649969958121635...', '66666999992081000945...', '6699681922101016629....', '6921991989800081016....', '8002961505950499625....', '903361160550005506.....', '.50131110440003306.....', '...861100000330004.....', '.....961200000115......', '.....59891111189.......', '....9222266989926......', '...99222222992629......', '...99999992222999......', '...99920060022999......', '....99200610229........', '....992229222299.......', '.....992200999999......', '.....999200925999......', '.....55822292598.......', '....95599999969........', '....985589992289.......', '....9489...933223......', '....94469..............'],
  ['.....5665566...........', '...98444443366666......', '..644444444444446......', '.96224444444444456.....', '.63313444443443436.....', '6543332243424469434....', '65466434422324499434...', '66666334444444939444...', '66665349944936312934...', '66666859958968122934...', '66666999992081000934...', '6686691611101009625....', '6922991989800060015....', '9013991508960699825....', '903381190650006506.....', '.51221110420002406.....', '...992200000220006.....', '.....931100000116......', '......9991111169.......', '.....522299899315......', '...89222222992225......', '...99888922222866......', '...99200942222929......', '....8100992222829......', '....810099222298166....', '....810899998899216....', '....810099925999216....', '....91006454459895.....', '....91216355928........', '.....99959992158.......', '......8689.943444......', '......94465............'],
  ['.....6665655...........', '...56444444356665......', '..633333344443446......', '.86314444443444466.....', '.83423434433434445.....', '6633432243423399434....', '66456434422413899434...', '66566434434434828636...', '66566349944949213935...', '66666659969968111636...', '66666989982091000645...', '6699691922201018829....', '6811991999900081016....', '6002961505960499625....', '603361160560005506.....', '.51131100440002206.....', '...981100000230015.....', '.....961100000116......', '.....99991111189.......', '....9222296966825......', '...89222222992625......', '...99998922222996......', '...99200932222826......', '....62009922229138.....', '....810099222299169....', '....910699898899206....', '....810099525599219....', '....91008545559988.....', '....82119946529........', '.....99899991169.......', '......9555.833323......', '......95555............'],
  ['.....6556656...........', '...56443344456566......', '..833444444443336......', '.56224444444443466.....', '.64324434343444435.....', '6644442244424499349....', '65466444422313695444...', '66566344444333619446...', '66666439944939223945...', '65665669969949121945...', '66666899982190000845...', '6699690911101019919....', '6911991996600081026....', '8113891609960499925....', '913381191980005606.....', '.51131100430002306.....', '...992100000220019.....', '.....821100000006......', '.....99961111196.......', '....9222269899924......', '...99222222992625......', '...99998922222995......', '...89100922222929......', '....92008822229215.....', '....920089222299139....', '....620099988999108....', '....610009523399129....', '....91000855249998.....', '....9922299989998......', '.....899999.81198......', '.....99559..943445.....', '.....995548............'],
];
/** Valid palette digit (7 = transparent background, skipped); robust to short/ragged rows. */
export const isPix = (ch: string): boolean => ch >= '0' && ch <= '9' && ch !== '7';
export function indexedToCanvas(rows: string[]): HTMLCanvasElement {
  const cv = makeCanvas(PIP_W, PIP_H), c = cv.getContext('2d')!;
  for (let y = 0; y < PIP_H; y++) { const r = rows[y]; if (!r) continue;
    for (let x = 0; x < PIP_W; x++) { const ch = r[x]; if (!isPix(ch)) continue; c.fillStyle = PIP_PAL[+ch]; c.fillRect(x, y, 1, 1); } }
  return cv;
}
export function silhouetteCanvasIdx(rows: string[]): HTMLCanvasElement {
  const cv = makeCanvas(PIP_W, PIP_H), c = cv.getContext('2d')!;
  c.fillStyle = '#ffe600';
  for (let y = 0; y < PIP_H; y++) { const r = rows[y]; if (!r) continue;
    for (let x = 0; x < PIP_W; x++) { if (isPix(r[x])) c.fillRect(x, y, 1, 1); } }
  return cv;
}

/* ===================== personagem: sprite indexado ANTIGO (achado, não é o mesmo caso do PIP_*) =====================
   ACHADO — relatado, não consertado: TEX + PLAYER_IDLE/WALK/CLIMB/HURT abaixo já tinham ZERO chamadores no
   game.js original (nenhuma referência além da própria definição de TEX) — diferente do bloco PIP_* acima, este
   não carrega comentário de "fase posterior"; é vestígio pré-PixelLab, plenamente substituído pelo pipeline PNG
   (render/sprites.ts: TEX_IDLE/TEX_WALK/TEX_CLIMB/…, Fase 2.24). Preservado verbatim (a tarefa pede não apagar);
   TEX passou de constante eager para função sob demanda (buildLegacyPlayerTex) só para este módulo poder ser
   importado sem `document` (disciplina de render/sprites.ts) — comportamento IDÊNTICO se algum dia for chamada. */
export const PLAYER_IDLE = [
  '................', '................', '.....HHHHHH.....', '....HHHHHHHH....',
  '....HHSSSSHH....', '....HSSSSSSH....', '....HSKSSKSH....', '....HSSSSSSH....',
  '....HSSWWSSH....', '....HSSSSSSH....', '.....HSSSSH.....', '......SSSS......',
  '.....RRRRRR.....', '....RRRRRRRR....', '...RRRRRRRRRR...', '..SRRRRRRRRRRS..',
  '..SRRRRRRRRRRS..', '..SRRRRRRRRRRS..', '..SRRRRRRRRRRS..', '...RRRRRRRRRR...',
  '...RRRRRRRRRR...', '....RRRRRRRR....', '....BBBBBBBB....', '....BBBBBBBB....',
  '....BBB..BBB....', '....BBB..BBB....', '....BBB..BBB....', '....BBB..BBB....',
  '....BBB..BBB....', '....BBB..BBB....', '...KKKK..KKKK...', '...KKKK..KKKK...',
];
export const PLAYER_WALK = [
  '................', '................', '.....HHHHHH.....', '....HHHHHHHH....',
  '....HHSSSSHH....', '....HSSSSSSH....', '....HSKSSKSH....', '....HSSSSSSH....',
  '....HSSWWSSH....', '....HSSSSSSH....', '.....HSSSSH.....', '......SSSS......',
  '.....RRRRRR.....', '....RRRRRRRR....', '...RRRRRRRRRR...', '..SRRRRRRRRRRS..',
  '..SRRRRRRRRRRS..', '..SRRRRRRRRRRS..', '..SRRRRRRRRRRS..', '...RRRRRRRRRR...',
  '...RRRRRRRRRR...', '....RRRRRRRR....', '....BBBBBBBB....', '...BBBB..BBB....',
  '..BBB....BBB....', '.BBB.....BBB....', 'KKKK.....KKKK...', '................',
  '................', '................', '................', '................',
];
export const PLAYER_CLIMB = [ // vista de costas, ALTURA CHEIA (pés na base) — corrige o "encolhimento" na escada
  '................', '................', '.....HHHHHH.....', '....HHHHHHHH....',
  '....HHHHHHHH....', '....HHHHHHHH....', '....HHHHHHHH....', '....HHHHHHHH....',
  '....HHHHHHHH....', '....HHHHHHHH....', '.....HHHHHH.....', '......SSSS......',
  '.....RRRRRR.....', '....RRRRRRRR....', '...RRRRRRRRRR...', '..SRRRRRRRRRRS..',
  '..SRRRRRRRRRRS..', '..SRRRRRRRRRRS..', '..SRRRRRRRRRRS..', '...RRRRRRRRRR...',
  '...RRRRRRRRRR...', '....RRRRRRRR....', '....BBBBBBBB....', '....BBBBBBBB....',
  '....BBB..BBB....', '....BBB..BBB....', '....BBB..BBB....', '....BBB..BBB....',
  '....BBB..BBB....', '....BBB..BBB....', '...KKKK..KKKK...', '...KKKK..KKKK...',
];
export const PLAYER_HURT = [
  '................', '................', '.....HHHHHH.....', '....HHHHHHHH....',
  '....HHSSSSHH....', '....HSSSSSSH....', '....HSWWWWSH....', '....HSWKKWSH....',
  '....HSSSSSSH....', '....HSKKKKSH....', '.....HSSSSH.....', '......SSSS......',
  '.....RRRRRR.....', '....RRRRRRRR....', '...RRRRRRRRRR...', '..SRRRRRRRRRRS..',
  '..SRRRRRRRRR.S..', '..SRRRRRRRR.SS..', '...RRRRRRRRSS...', '...RRRRRRRRRR...',
  '...RRRRRRRRRR...', '....RRRRRRRR....', '....BBBBBBBB....', '....BBBBBBBB....',
  '....BBB..BBB....', '....BBB..BBB....', '....BBB..BBB....', '....BBB..BBB....',
  '....BBB..BBB....', '....BBB..BBB....', '...KKKK..KKKK...', '...KKKK..KKKK...',
];
/** Verbatim reproduction of game.js's old eager `const TEX={idle:tex(spriteToCanvas(PLAYER_IDLE)),...}` — never
 *  auto-run (see header note above). Unused today; kept callable in case a future caller resurfaces. */
export function buildLegacyPlayerTex(): Record<string, Tex> {
  return { idle: tex(spriteToCanvas(PLAYER_IDLE)), walk: tex(spriteToCanvas(PLAYER_WALK)), climb: tex(spriteToCanvas(PLAYER_CLIMB)), hurt: tex(spriteToCanvas(PLAYER_HURT)) };
}
