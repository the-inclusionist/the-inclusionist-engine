// SPDX-License-Identifier: AGPL-3.0-or-later
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
import { HC_ROLE_DEF, type HcRoleKey, type PaintableRole } from './hc-role-data.js';
import * as store from '../platform/storage.js';

/* ===================== papel → cor (color-blocking) ===================== */
// Os papéis e suas cores padrão moram em render/hc-role-data (folha, sem dependências), porque o painel de
// acessibilidade visual precisa da MESMA lista para oferecer um seletor de cor por papel. Reexportados aqui
// para que os importadores deste módulo não precisem saber que houve uma separação.
export type { PaintableRole, HcRoleKey } from './hc-role-data.js';
export { HC_ROLE_KEYS, HC_ROLE_DEF } from './hc-role-data.js';
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
  W: number; H: number; // WORLD_W/WORLD_H — 	ileAt já resolve fora-de-grade; os loops usam W/H como limite
  /**
   * QUE TILE ESTÁ EM (tx,ty) — uma PERGUNTA e não um import, desde 2026-09-23. Este módulo é da engine (o
   * assunto dele é o alto contraste da WCAG 1.4.6), mas para pintar papel a papel precisa de saber o que há em
   * cada célula — e isso é a grade de UM jogo. Perguntando, a engine deixa de importar a geometria de tiles e
   * quem tem uma grade responde; quem não tem nunca monta este módulo.
   * ⚠️ OBRIGATÓRIA, pelo precedente do ADR-0224: uma porta opcional é mais um campo que um jogo pode esquecer, e
   * esquecê-la aqui pintaria o mundo inteiro de uma cor só.
   */
  tileAt: (tx: number, ty: number) => number;
  outlineFg: () => number; // hcOutlineFg (0/1/2) — mutado por setOutlineFg (game.js)
  outlineBg: () => number; // hcOutlineBg (0/1/2) — mutado por setOutlineBg (game.js)
  getWorldCanvasNormal: () => HTMLCanvasElement; // worldCanvasNormal É `let` (reescrito por setCenario ao trocar tema) → getter
  getWorldTexNormal: () => unknown; // worldTexNormal idem
  /**
   * OS SPRITES QUE O JOGO QUER RECOLORIDOS, POR ID. A engine cacheia por `(id, modo)` e nunca sabe o que o id
   * significa — pode ser uma moeda, uma sílaba, uma peça de tabuleiro.
   *
   * Era um par cravado, `coinCanvasNormal` + `coinTexNormal`, e o nome era a dívida: a API do cache de alto
   * contraste tinha a forma de UM sprite de UM jogo. Um segundo jogo que quisesse recolorir a peça dele não
   * tinha por onde — teria de chamar a peça de "moeda", ou de reimplementar o cache.
   *
   * Função e não valor porque o canvas de um sprite pode ser reescrito no boot (o mesmo motivo do
   * `getWorldCanvasNormal`), e um valor lido uma vez congelaria o do primeiro instante.
   */
  sprites: () => Record<string, { canvas: HTMLCanvasElement | null; tex: unknown }>;
  /**
   * TILE → PAPEL SEMÂNTICO, e é o consumidor quem sabe. `null` = estrutura (sem repintura).
   *
   * Era uma tabela fixa AQUI DENTRO — `9` perigo, `4|5|10` escalável, `3` água — e o ADR-0027 a nomeia como o
   * acoplamento nº 1 da base: quatro linhas das quais TODO o alto contraste dependia. Elas diziam, pela
   * estrutura, que "perigo é o tile 9" era verdade da engine. É verdade DESTE MAPA. Um segundo jogo com outra
   * numeração pintava o chão de laranja e a lava de cinza — sem erro, sem teste vermelho, para quem menos
   * pode conferir isso olhando.
   *
   * A tabela do jogo de plataforma mora em `game/tile-roles`. Trocar de tabela é trocar de jogo, e é só isso.
   */
  roleOf: (t: number) => PaintableRole | null;
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
    const t = hc.tileAt(x, y), role = hc.roleOf(t); if (!role) continue; // repinta tiles não-estruturais pela cor do papel
    // ⚠️ O QUE SOBRA DE PLATAFORMA AQUI. A escada é desenhada com trilhos e degraus porque uma faixa sólida
    // não LÊ como escada — decisão de acessibilidade, que serviria a qualquer jogo com algo escalável. Mas a
    // forma da pergunta injetada ("este tile se desenha como escada?" · "que pintor este papel usa?") ainda
    // não tem evidência que a escolha, e foi um consumidor que mostrou, no menu-nav, que a forma importa mais
    // que a existência da injeção. Declarado em vez de adivinhado. Ver game/tile-roles.
    if (t === 4) drawLadder(c, x * TILE, y * TILE);
    else repaintByRole(c, x * TILE, y * TILE, role);
  }
  outlineSecondPlane(c, hc, hc.outlineBg());
  return tex(cv);
}

/** ESCADA: preto + trilhos e degraus na cor do papel → lê como escada, e não como faixa sólida. */
function drawLadder(c: CanvasRenderingContext2D, X: number, Y: number): void {
  c.fillStyle = '#0a0e14'; c.fillRect(X, Y, TILE, TILE);
  c.fillStyle = 'rgb(' + HC_ROLE.climb.join(',') + ')'; c.fillRect(X + 1, Y, 2, TILE); c.fillRect(X + TILE - 3, Y, 2, TILE); // trilhos laterais (cor do papel, customizável)
  for (let ry = 2; ry < TILE - 1; ry += 5) c.fillRect(X + 1, Y + ry, TILE - 2, 2); // degraus
}

/** A tile repainted in its role's colour, by the brightness of each pixel (BT.601 luma); a hazard starts from brighter. */
function repaintByRole(c: CanvasRenderingContext2D, X: number, Y: number, role: PaintableRole): void {
  const rc = HC_ROLE[role], img = c.getImageData(X, Y, TILE, TILE), d = img.data, lo = role === 'hazard' ? 0.58 : 0.44;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 8) continue;
    const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255, f = lo + (1 - lo) * g;
    d[i] = Math.min(255, rc[0] * f) | 0; d[i + 1] = Math.min(255, rc[1] * f) | 0; d[i + 2] = Math.min(255, rc[2] * f) | 0;
  }
  c.putImageData(img, X, Y);
}

/** Tiles 0 and 1 are this map's air (see the note in the loop above: a platformer's numbering, declared, not generalised). */
const isAir = (t: number): boolean => t === 0 || t === 1;

/** Contorno de 2º plano: SÓ o perímetro externo — as bordas de um bloco voltadas ao ar —, não cada bloco. */
function outlineSecondPlane(c: CanvasRenderingContext2D, hc: HighContrastCtx, th: number): void {
  if (th <= 0) return;
  const air = (x: number, y: number): boolean => isAir(hc.tileAt(x, y));
  c.fillStyle = 'rgba(200,222,255,0.97)';
  for (let y = 0; y < hc.H; y++) for (let x = 0; x < hc.W; x++) {
    if (air(x, y)) continue;
    const X = x * TILE, Y = y * TILE;
    if (air(x, y - 1)) c.fillRect(X, Y, TILE, th);
    if (air(x, y + 1)) c.fillRect(X, Y + TILE - th, TILE, th);
    if (air(x - 1, y)) c.fillRect(X, Y, th, TILE);
    if (air(x + 1, y)) c.fillRect(X + TILE - th, Y, th, TILE);
  }
}

/** Superfície mínima de PIXI.Texture que directBgTexture/directSpriteTexture tocam (resource.source pode ser
 *  canvas OU imagem — parallax de tema "cidade" carrega PNG via PIXI.Texture.from(img)). Estrutural (como o
 *  FxGraphics de render/fx.ts) para não arrastar os tipos de união de Resource do PIXI aqui dentro. */
interface DirectTexSource {
  orig: { width: number; height: number };
  /**
   * O RECORTE do quadro dentro da base. Passou a existir aqui com o atlas (item 22): antes toda textura de
   * personagem era uma tela própria e base e recorte coincidiam. Opcional porque `directBgTexture` recebe
   * texturas que de fato ocupam a base inteira (parallax, árvore) e não precisa dele.
   */
  frame?: { x: number; y: number; width: number; height: number };
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
    // ===================== O RECORTE VEM ANTES DO CONTORNO =====================
    // Aqui morava o "kage bunshin". Esta função lia a BASE e ignorava o `frame`, e havia um comentário
    // explicando por que isso era seguro: "só é chamada p/ texturas de player (sempre canvas-sourced)". A
    // afirmação era verdadeira e VIROU FALSA — o item 22 empacotou os sprites num atlas de 256×207, e desde
    // então só os quadros que passam pelo tapa-costuras (idle/andar/correr) viram tela própria. Pulo, escada,
    // parede, teto, nado e voo são RECORTE dentro do atlas, e contornar a base deles desenhava o atlas
    // inteiro: todos os quadros do personagem de uma vez, em grade.
    //
    // O tapa-costuras é assíncrono, e por isso o idle também aparecia: com alto contraste ligado cedo, o
    // cache `_playerDirect` memoriza a versão baseada no atlas e a guarda para sempre.
    const f = srcTex.frame;
    const needsClipping = !!f && (f.x !== 0 || f.y !== 0 || f.width !== s.width || f.height !== s.height);
    let fonte: HTMLCanvasElement | HTMLImageElement = s;
    if (needsClipping && f) {
      const rec = makeCanvas(Math.max(1, f.width), Math.max(1, f.height));
      const rc = rec.getContext('2d')!;
      rc.imageSmoothingEnabled = false; // pixel art: reamostrar aqui borraria o contorno que o modo promete
      rc.drawImage(s, f.x, f.y, f.width, f.height, 0, 0, f.width, f.height);
      fonte = rec;
    }
    // outlineCanvas só declara HTMLCanvasElement; o recorte já devolve canvas, e a base sem recorte é
    // canvas-sourced pelos caminhos que restam. O cast preserva o runtime idêntico ao original.
    const o = outlineCanvas(fonte as HTMLCanvasElement, th);
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
/** Cache de sprite recolorido, chaveado por `id|modo`. Era `_coinTexHC[modo]` — um cache por jogo. */
const _spriteTexHC: Record<string, unknown> = {};

/** Textura do MUNDO para `mode` (normal → a textura viva; hc-* → Renderização Direta, cacheada). */
export function worldTexFor(mode: string): unknown {
  const hc = requireCtx();
  if (DIRECT_CFG[mode]) {
    if (!_worldTexHC[mode]) _worldTexHC[mode] = worldToTextureDirect(hc.getWorldCanvasNormal(), mode);
    return _worldTexHC[mode];
  }
  return hc.getWorldTexNormal();
}
/**
 * Textura do sprite `id` para `mode` (mesma lógica de `worldTexFor`, cache por `id|modo`).
 *
 * Fora dos modos de renderização direta devolve a textura normal declarada pelo jogo — e devolve `undefined`
 * para um id que o jogo não declarou, em vez de lançar: um sprite ausente vira "sem textura" no desenho, que
 * é degradação; lançar aqui derrubaria o quadro inteiro por causa de um item.
 */
export function spriteTexFor(id: string, mode: string): unknown {
  const hc = requireCtx();
  const src = hc.sprites()[id];
  if (!src) return undefined;
  if (DIRECT_CFG[mode]) {
    const chave = id + '|' + mode;
    if (!_spriteTexHC[chave] && src.canvas) _spriteTexHC[chave] = tex(directSpriteCanvas(src.canvas, mode));
    return _spriteTexHC[chave] ?? src.tex;
  }
  return src.tex;
}
/** Invalida o cache de mundo (tema/cenário mudou → worldCanvasNormal é outro canvas). */
export function clearWorldTexCache(): void { for (const k in _worldTexHC) delete _worldTexHC[k]; }
/**
 * Invalida o cache de sprites (cor de papel mudou → `_rebakeDirect` no game.js). Sem argumento limpa TUDO;
 * com um `id`, só as entradas daquele sprite — o que um jogo com muitos sprites vai querer, e o que um cache
 * chaveado só por modo não conseguia oferecer.
 */
export function clearSpriteTexCache(id?: string): void {
  for (const k in _spriteTexHC) {
    if (id === undefined || k.startsWith(id + '|')) delete _spriteTexHC[k];
  }
}
