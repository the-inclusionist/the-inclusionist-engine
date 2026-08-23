// SPDX-License-Identifier: GPL-3.0-or-later
// render/high-contrast — Renderização Direta (Estágio 4, Tier 2): o motor de alto contraste de acessibilidade
// (ADR-0011) — outline + color-blocking por papel + fundo recuado (dessaturado/escurecido), 3 níveis de
// contraste (3:1/4,5:1/7:1). worldToTextureDirect/directBgTexture/directSprite{Canvas,Texture} + os caches
// _worldTexHC/_coinTexHC (worldTexFor/coinTexFor) + a paleta HC_ROLE (persistida) vivem aqui. INJETADO via
// initHighContrast: os limites do grid (W/H), os dois níveis de contorno (outlineFg/outlineBg — mutados por
// setOutlineFg/setOutlineBg no game.js) e os canvases/texturas NORMAIS do mundo/moeda (mundo é `let` e muda de
// cenário → getter; moeda nunca é reatribuída → valor direto). `_lastSharedViz` FICA no game.js: não é cache de
// alto contraste, é o cache de "modo já aplicado" que TODO o pipeline de render estático (mundo/parallax/moedas/
// power-ups/portão) usa para decidir quando reaplicar texturas por viewport — 7 subsistemas fora daqui escrevem
// nele. `_pupTexHC`/`_playerDirect` (power-ups/player) também ficam no game.js: consomem directSpriteCanvas/
// directSpriteTexture DAQUI mas não estão na lista de extração desta onda.
// Ver docs/2-Architecture/adr/ADR-0011-visual-accessibility.yaml + docs/5-Refactoring/plano-modularizacao-mapa.md.

import { makeCanvas, tex } from './canvas.js';
import { outlineCanvas } from './sprite-fx.js';
import { TILE } from '../core/constants.js';
import { tileAt } from '../core/collision.js';
import * as store from '../platform/storage.js';

/* ===================== papel → cor (color-blocking) ===================== */
export type PaintableRole = 'hazard' | 'climb' | 'water';
export type HcRoleKey = PaintableRole | 'gate';

/** Cor RGB por papel semântico. L2: customizável pelo jogador (persistida); `gate` não vem de roleOf() — é
 *  usada à parte pelo desenho do portão trancado (game.js, rebuildExtras). */
export const HC_ROLE_DEF: Record<HcRoleKey, [number, number, number]> = {
  hazard: [255, 110, 45], climb: [55, 225, 205], water: [70, 140, 255], gate: [194, 58, 212],
};
export const HC_ROLE: Record<HcRoleKey, [number, number, number]> = (() => {
  const d = JSON.parse(JSON.stringify(HC_ROLE_DEF)) as Record<HcRoleKey, [number, number, number]>;
  const s = store.getJSON<Partial<Record<HcRoleKey, number[]>>>(store.KEYS.hcrole, null);
  if (s && typeof s === 'object') {
    for (const k of Object.keys(d) as HcRoleKey[]) {
      const v = s[k];
      if (Array.isArray(v) && v.length === 3) d[k] = v.map((n) => Math.max(0, Math.min(255, n | 0))) as [number, number, number];
    }
  }
  return d;
})();
/** Persiste HC_ROLE (chamado por setRoleColor/resetRoleColors no game.js). Migrado de localStorage direto → store. */
export function saveHcRole(): void { store.setJSON(store.KEYS.hcrole, HC_ROLE); }

/** Tile → papel semântico (null = estrutura, sem repintura). t===10 (portão) nunca chega aqui na prática — o
 *  boot do game.js remove o tile 10 do grid (vira MAP_GATE + ar); branch mantida verbatim do original. */
export function roleOf(t: number): PaintableRole | null {
  if (t === 9) return 'hazard';
  if (t === 4 || t === 5 || t === 10) return 'climb';
  if (t === 3) return 'water';
  return null;
}

/* ===================== 3 níveis de contraste ===================== */
export interface DirectCfg { off: number; mul: number; bgMul: number }
// off/mul = mapa da plataforma (mais off = mais clara → mais contraste); bgMul = fundo (menor = mais escuro/
// recuado). Contraste plataforma×fundo ≈ 3 / 4,5 / 7 (ver ADR-0011: 3:1 é o default, "7:1 fica feio").
export const DIRECT_CFG: Record<string, DirectCfg> = {
  'hc-direto': { off: 55, mul: 0.5, bgMul: 0.30 },
  'hc-direto-45': { off: 66, mul: 0.5, bgMul: 0.28 },
  'hc-direto-7': { off: 100, mul: 0.48, bgMul: 0.13 },
};
export function dcfg(mode: string): DirectCfg { return DIRECT_CFG[mode] || DIRECT_CFG['hc-direto']; }

/* ===================== dessaturação/escurecimento (fundo/estrutura) ===================== */
export function dimDesat(c: CanvasRenderingContext2D, w: number, h: number, mul: number, blue: number, off?: number): void {
  off = off || 0;
  const img = c.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2], g = off + l * mul;
    d[i] = Math.min(255, g) | 0; d[i + 1] = Math.min(255, g * 1.02) | 0; d[i + 2] = Math.min(255, g * blue) | 0;
  }
  c.putImageData(img, 0, 0);
}

/* ===================== DI: limites do grid + contornos + canvases/texturas NORMAIS ===================== */
export interface HighContrastCtx {
  W: number; H: number; // WORLD_W/WORLD_H — tileAt (core/collision.js) já resolve fora-de-grade; os loops usam W/H como limite
  outlineFg: () => number; // hcOutlineFg (0/1/2) — mutado por setOutlineFg (game.js)
  outlineBg: () => number; // hcOutlineBg (0/1/2) — mutado por setOutlineBg (game.js)
  getWorldCanvasNormal: () => HTMLCanvasElement; // worldCanvasNormal É `let` (reescrito por setCenario ao trocar tema) → getter
  getWorldTexNormal: () => unknown; // worldTexNormal idem
  coinCanvasNormal: HTMLCanvasElement; // const, nunca reatribuído após o boot → valor direto
  coinTexNormal: unknown;
}
let ctx: HighContrastCtx | null = null;
export function initHighContrast(c: HighContrastCtx): void { ctx = c; }
function requireCtx(): HighContrastCtx {
  if (!ctx) throw new Error('render/high-contrast: initHighContrast(ctx) ainda não foi chamado');
  return ctx;
}

/* ===================== Renderização Direta: mundo + fundo + sprites de 1º plano ===================== */

/** Mundo em alto contraste: base dessaturada/clareada + repintura por papel (com escada como caso especial:
 *  trilhos/degraus, não faixa sólida) + contorno de 2º plano no perímetro externo (navegável × não-navegável). */
export function worldToTextureDirect(srcCanvas: HTMLCanvasElement, mode: string): unknown {
  const hc = requireCtx();
  const cfg = dcfg(mode);
  const cv = makeCanvas(srcCanvas.width, srcCanvas.height), c = cv.getContext('2d')!;
  c.drawImage(srcCanvas, 0, 0);
  dimDesat(c, cv.width, cv.height, cfg.mul, 1.22, cfg.off); // base: estrutura vira cinza-azulado (mais clara = mais contraste)
  for (let y = 0; y < hc.H; y++) for (let x = 0; x < hc.W; x++) {
    const t = tileAt(x, y), role = roleOf(t); if (!role) continue; // repinta tiles não-estruturais pela cor do papel
    const X = x * TILE, Y = y * TILE;
    if (t === 4) { // ESCADA: preto + trilhos e degraus ciano → lê como escada (não faixa verde sólida)
      c.fillStyle = '#0a0e14'; c.fillRect(X, Y, TILE, TILE);
      c.fillStyle = 'rgb(' + HC_ROLE.climb.join(',') + ')'; c.fillRect(X + 1, Y, 2, TILE); c.fillRect(X + TILE - 3, Y, 2, TILE); // trilhos laterais (cor do papel, customizável)
      for (let ry = 2; ry < TILE - 1; ry += 5) c.fillRect(X + 1, Y + ry, TILE - 2, 2); // degraus
      continue;
    }
    const rc = HC_ROLE[role], img = c.getImageData(X, Y, TILE, TILE), d = img.data, lo = role === 'hazard' ? 0.58 : 0.44;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, f = lo + (1 - lo) * g;
      d[i] = Math.min(255, rc[0] * f) | 0; d[i + 1] = Math.min(255, rc[1] * f) | 0; d[i + 2] = Math.min(255, rc[2] * f) | 0;
    }
    c.putImageData(img, X, Y);
  }
  const th = hc.outlineBg(); // contorno de 2º plano: SÓ o perímetro externo (bordas voltadas ao ar) — não em cada bloco
  if (th > 0) {
    const air = (x: number, y: number): boolean => { const t = tileAt(x, y); return t === 0 || t === 1; };
    c.fillStyle = 'rgba(200,222,255,0.97)';
    for (let y = 0; y < hc.H; y++) for (let x = 0; x < hc.W; x++) {
      const t = tileAt(x, y); if (t === 0 || t === 1) continue;
      const X = x * TILE, Y = y * TILE;
      if (air(x, y - 1)) c.fillRect(X, Y, TILE, th); if (air(x, y + 1)) c.fillRect(X, Y + TILE - th, TILE, th);
      if (air(x - 1, y)) c.fillRect(X, Y, th, TILE); if (air(x + 1, y)) c.fillRect(X + TILE - th, Y, th, TILE);
    }
  }
  return tex(cv);
}

/** Superfície mínima de PIXI.Texture que directBgTexture/directSpriteTexture tocam (resource.source pode ser
 *  canvas OU imagem — parallax de tema "cidade" carrega PNG via PIXI.Texture.from(img)). Estrutural (como o
 *  FxGraphics de render/fx.ts) para não arrastar os tipos de união de Resource do PIXI aqui dentro. */
interface DirectTexSource {
  orig: { width: number; height: number };
  baseTexture: {
    valid: boolean;
    resource?: { source?: (HTMLCanvasElement | HTMLImageElement) | null } | null;
    once(event: 'loaded', cb: () => void): void;
  };
}

/** Fundo/decoração em alto contraste: só dessaturação/escurecimento (recua) — sem repintura por papel nem
 *  contorno. Usada por game.js para árvores (treeTexFor) e parallax (parallaxTexFor). */
export function directBgTexture(srcTex: DirectTexSource, mode: string): unknown {
  const cfg = dcfg(mode);
  const cv = makeCanvas(Math.max(1, srcTex.orig.width), Math.max(1, srcTex.orig.height)), dst = tex(cv);
  const paint = (): void => {
    const s = srcTex.baseTexture.resource && srcTex.baseTexture.resource.source;
    if (!s || !s.width) return;
    cv.width = s.width; cv.height = s.height;
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, cv.width, cv.height); c.drawImage(s, 0, 0); dimDesat(c, cv.width, cv.height, cfg.bgMul, 1.2);
    dst.update();
  };
  if (srcTex.baseTexture.valid) paint(); else srcTex.baseTexture.once('loaded', paint);
  return dst;
}

/** Sprite de 1º plano (player/moeda/power-up) em alto contraste: mantém a cor da arte + contorno ESCURO
 *  (WCAG 2.4.7 — "salta" do fundo recuado). `mode` não é usado (mantido só p/ paridade de assinatura com as
 *  outras 3 funções "direct*" — o dispatch por DIRECT_CFG[mode] já aconteceu no chamador). fg=0 → sem contorno. */
export function directSpriteCanvas(srcCanvas: HTMLCanvasElement, mode: string): HTMLCanvasElement {
  void mode;
  const fg = requireCtx().outlineFg();
  return fg > 0 ? outlineCanvas(srcCanvas, fg) : srcCanvas;
}
/** Variante PIXI.Texture de directSpriteCanvas (player: a textura de origem já é uma PIXI.Texture, não um
 *  canvas cru). `mode` idem — não usado, mantido por paridade de assinatura. */
export function directSpriteTexture(srcTex: DirectTexSource, mode: string): unknown {
  void mode;
  const fg = requireCtx().outlineFg();
  if (fg <= 0) return srcTex;
  const th = fg;
  const cv = makeCanvas(Math.max(1, srcTex.orig.width), Math.max(1, srcTex.orig.height)), dst = tex(cv);
  const paint = (): void => {
    const s = srcTex.baseTexture.resource && srcTex.baseTexture.resource.source;
    if (!s || !s.width) return;
    // outlineCanvas só declara HTMLCanvasElement, mas directSpriteTexture só é chamada p/ texturas de player
    // (sempre canvas-sourced, nunca PNG); cast preserva o runtime idêntico ao original (sem checagem de tipo).
    const o = outlineCanvas(s as HTMLCanvasElement, th);
    cv.width = o.width; cv.height = o.height;
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, cv.width, cv.height); c.drawImage(o, 0, 0);
    dst.update();
  };
  if (srcTex.baseTexture.valid) paint(); else srcTex.baseTexture.once('loaded', paint);
  return dst;
}

/* ===================== caches preguiçosos (mundo/moeda) + seletor por modo ===================== */
const _worldTexHC: Record<string, unknown> = {};
const _coinTexHC: Record<string, unknown> = {};

/** Textura do MUNDO para `mode` (normal → a textura viva; hc-* → Renderização Direta, cacheada). */
export function worldTexFor(mode: string): unknown {
  const hc = requireCtx();
  if (DIRECT_CFG[mode]) {
    if (!_worldTexHC[mode]) _worldTexHC[mode] = worldToTextureDirect(hc.getWorldCanvasNormal(), mode);
    return _worldTexHC[mode];
  }
  return hc.getWorldTexNormal();
}
/** Textura da MOEDA para `mode` (mesma lógica de worldTexFor, cache próprio). */
export function coinTexFor(mode: string): unknown {
  const hc = requireCtx();
  if (DIRECT_CFG[mode]) {
    if (!_coinTexHC[mode]) _coinTexHC[mode] = tex(directSpriteCanvas(hc.coinCanvasNormal, mode));
    return _coinTexHC[mode];
  }
  return hc.coinTexNormal;
}
/** Invalida o cache de mundo (tema/cenário mudou → worldCanvasNormal é outro canvas). */
export function clearWorldTexCache(): void { for (const k in _worldTexHC) delete _worldTexHC[k]; }
/** Invalida o cache de moeda (cor de papel mudou → _rebakeDirect no game.js). */
export function clearCoinTexCache(): void { for (const k in _coinTexHC) delete _coinTexHC[k]; }
