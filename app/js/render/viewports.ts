// SPDX-License-Identifier: GPL-3.0-or-later
// render/viewports — a FÁBRICA de imagem dos modos de visão acessível: como um MODO vira PIXEL.
//
// Par de render/viz-setters, que levou a POLÍTICA ("qual modo vale onde": por jogador, global, overlays, painéis).
// Aqui mora a outra metade — a produção do pixel em si, que a política consome:
//   · `pixiFilterFor`  — modo → filtro GPU do viewport (daltonismo, cegueira, baixa visão)
//   · `parallaxTexFor` — camada de fundo i, recolorida (ou não) para o modo
//   · `treeTexFor`     — decoração de fundo, idem
//   · `playerVizTex`   — quadro do jogador com contorno escuro no alto contraste
//   · `lvOverlay*` / `renderVpOverlay` — a névoa/túnel/mancha de baixa visão DENTRO da render-texture do viewport
// Os quatro primeiros entravam em viz-setters por injeção (`parallaxTexFor`/`treeTexFor`/`playerVizTex`/
// `pixiFilterFor` no `VizSettersCtx`) enquanto ainda moravam no game.js; a partir daqui quem os fornece é este
// módulo. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (B2).
//
// A DUPLICAÇÃO QUE ESTA EXTRAÇÃO CUROU: as seis matrizes de daltonismo estavam escritas duas vezes — como
// `<feColorMatrix>` no app/index.html (caminho de tela única) e como `PIXI.ColorMatrixFilter` dentro de
// `pixiFilterFor` (caminho multi-tela). Saíram para render/cvd-matrices (folha, zero deps); `pixiFilterFor` lê
// de lá e `initViewports` GERA os `<filter>` do documento de lá também. O sintoma da divergência era silencioso
// e de acessibilidade: a mesma pessoa daltônica veria cores diferentes em tela única e em multi-tela.
//
// Fronteiras que este módulo NÃO reabre:
//  · `parallaxTexNormal` e `treeTexNormal` (as texturas CRUAS, fonte do recolor) continuam nascendo no game.js
//    — a primeira é preenchida por `setCenario` (carrega PNG por tema), a segunda pelo desenho procedural da
//    árvore. Entram injetadas. `parallaxTexNormal` é `const` cujos ELEMENTOS `setCenario` troca in place → entra
//    por VALOR (o array é o mesmo objeto); `vpTex` é `let` que `configureRender` REATRIBUI a cada troca de nº de
//    telas → entra por GETTER.
//  · `lvOverlaySpr` e o renderer são objetos PIXI criados no game.js e entram por interface ESTRUTURAL, para o
//    módulo rodar no project `node` sem importar PIXI. Mesmo precedente de render/scene-sky e game/traffic.
//  · `_lastSharedViz` NÃO é daqui (é o registro do render estático, fica no game.js) — ver o topo de viz-setters.
//
// POR QUE `getTreeTexNormal`/`getLvOverlaySpr` são GETTERS e não valores, sendo os dois `const` no game.js:
// não é reatribuição, é ORDEM DE BOOT. `clearParallaxTexCache` precisa existir dentro de `setCenario`, que o
// game.js chama no topo do módulo (na restauração do cenário salvo) — bem ANTES de `treeTexNormal` e
// `lvOverlaySpr` serem declarados. Com getters, `initViewports` pode ser chamado cedo o bastante para aquela
// chamada não cair em TDZ; com valores, o `const` ainda não inicializado derrubaria a restauração do tema
// dentro de um `try/catch` que apenas cai para 'cidade' — o jogador perderia o cenário escolhido em silêncio.
//
// SEM I/O no import: nada de makeCanvas/tex no corpo do módulo (precedente de render/textures). O único efeito
// de `initViewports` é gerar os `<filter>` SVG, que é justamente o ponto da cura da duplicação.

import { LOGICAL_W, LOGICAL_H } from '../core/constants.js';
import { makeCanvas, tex } from './canvas.js';
import { DIRECT_CFG, directBgTexture, directSpriteTexture } from './high-contrast.js';
import { VIZ_BY_KEY } from './viz-modes.js';
import { CVD_MATRIX, installCvdFilters, type CvdKey } from './cvd-matrices.js';

/* ===================== interfaces estruturais (PIXI sem importar PIXI) ===================== */

/** O que `pixiFilterFor` toca de um `PIXI.ColorMatrixFilter` — e só isso. */
interface ColorMatrixLike {
  matrix: number[];
  brightness(b: number, multiply: boolean): void;
  contrast(amount: number, multiply: boolean): void;
}
interface ColorMatrixCtor { new (): ColorMatrixLike }
/** `PIXI.BlurFilter` é opaco aqui: só se constrói com a força e se entrega para o `filters` do sprite. */
interface BlurCtor { new (strength: number): unknown }
/** O sprite reaproveitado para carimbar o overlay de baixa visão — só a textura é trocada. */
interface TexturedSprite { texture: unknown }
/** `app.renderer` — só a passada extra em render-texture (`clear:false` = por cima da cena já desenhada). */
interface RendererLike { render(displayObject: unknown, options: { renderTexture: unknown; clear?: boolean }): void }

export interface ViewportsCtx {
  /* --- construtores de filtro do PIXI (podem faltar: o original testa `&&CM` / `&&BL` antes de usar) --- */
  ColorMatrixFilter: ColorMatrixCtor | null | undefined; // PIXI.ColorMatrixFilter — daltonismo, cegueira, névoa
  BlurFilter: BlurCtor | null | undefined;               // PIXI.BlurFilter — desfoque, túnel, mancha, manchas

  /* --- texturas NORMAIS: a fonte crua de todo recolor de alto contraste --- */
  parallaxTexNormal: unknown[];          // `const` do game.js; setCenario troca os ELEMENTOS in place → valor
  getTreeTexNormal: () => unknown;       // GETTER por ordem de boot (ver o cabeçalho): declarada DEPOIS desta init

  /* --- objetos PIXI criados no game.js (z-order e ciclo de vida soldados lá) --- */
  getLvOverlaySpr: () => TexturedSprite; // GETTER idem; sprite de carimbo, nunca entra em container
  renderer: RendererLike;                // `app.renderer` (app é `const`, criado no início do boot)
  getVpTex: () => unknown[];             // GETTER: `let vpTex` é REATRIBUÍDO por configureRender a cada troca de nº de telas

  /* --- DOM: o host dos <filter> gerados (cura da duplicação das matrizes) --- */
  cvdDefsHost: Element | null;  // `<defs id="cvd-defs">` do index.html; ausente = os seis filtros não são gerados
}

export interface ViewportsApi {
  /** Camada de parallax `i` no `mode`: alto contraste recua o fundo (dessatura/escurece); resto = textura crua. */
  parallaxTexFor(i: number, mode: string): unknown;
  /** Decoração de fundo (árvore) no `mode`: mesma regra do parallax, cache próprio. */
  treeTexFor(mode: string): unknown;
  /** Quadro do jogador no `mode`: alto contraste ganha contorno escuro (salta do fundo recuado). */
  playerVizTex(base: unknown, mode: string): unknown;
  /** Filtro GPU do viewport para o `mode` (array de filtros, ou `null` quando o modo não usa filtro). */
  pixiFilterFor(mode: string): unknown;
  /** Canvas 320×180 do overlay de baixa visão (`haze`/`tunnel`/`macular`/`diabetic`). */
  lvOverlayCanvas(lv: string): HTMLCanvasElement;
  /** Textura do overlay de baixa visão (memoizada). `blur` não tem overlay — é filtro puro → `null`. */
  lvOverlayTex(lv: string): unknown;
  /** Carimba o overlay de baixa visão do jogador `i` DENTRO da render-texture do viewport, por cima da cena. */
  renderVpOverlay(i: number, mode: string): void;
  /** Invalida o cache de parallax recolorido — o cenário mudou, as texturas cruas são outras. */
  clearParallaxTexCache(): void;
  /** Invalida o cache de quadros do jogador com contorno (chamado por `rebakeDirect` em viz-setters). */
  clearPlayerDirectCache(): void;
}

export function initViewports(ctx: ViewportsCtx): ViewportsApi {
  // Gera os seis <filter> de daltonismo do documento a partir de render/cvd-matrices — a MESMA fonte que
  // pixiFilterFor lê logo abaixo. É por isso que tela única e multi-tela não podem mais divergir.
  installCvdFilters(ctx.cvdDefsHost);

  /* ===================== fundo: parallax e decoração ===================== */

  const _parallaxTexHC: Record<string, unknown[]> = {}; // {mode: [tex,tex,tex]}
  function parallaxTexFor(i: number, mode: string): unknown {
    if (DIRECT_CFG[mode]) {
      (_parallaxTexHC[mode] = _parallaxTexHC[mode] || []);
      if (!_parallaxTexHC[mode][i]) _parallaxTexHC[mode][i] = directBgTexture(ctx.parallaxTexNormal[i] as never, mode);
      return _parallaxTexHC[mode][i]; // direto: fundo recua
    }
    return ctx.parallaxTexNormal[i];
  }
  function clearParallaxTexCache(): void { for (const k in _parallaxTexHC) delete _parallaxTexHC[k]; }

  const _treeTexHC: Record<string, unknown> = {};
  function treeTexFor(mode: string): unknown {
    if (DIRECT_CFG[mode]) {
      if (!_treeTexHC[mode]) _treeTexHC[mode] = directBgTexture(ctx.getTreeTexNormal() as never, mode);
      return _treeTexHC[mode]; // direto: decoração recua
    }
    return ctx.getTreeTexNormal();
  }

  /* ===================== frente: o jogador ===================== */

  // {mode: Map<texturaBase, texturaComContorno>} — chaveado pela textura de ORIGEM porque o jogador troca de
  // quadro toda frame; um Map por modo evita recontornar o mesmo quadro a cada volta da animação.
  let _playerDirect: Record<string, Map<unknown, unknown>> = {};
  function playerVizTex(base: unknown, mode: string): unknown {
    if (!base) return base;
    if (DIRECT_CFG[mode]) {
      const mm = (_playerDirect[mode] = _playerDirect[mode] || new Map());
      if (!mm.has(base)) mm.set(base, directSpriteTexture(base as never, mode));
      return mm.get(base); // direto: player com contorno escuro → salta
    }
    return base;
  }
  function clearPlayerDirectCache(): void { _playerDirect = {}; }

  /* ===================== o filtro do viewport ===================== */

  // Cacheado por MODO e por identidade: o mesmo array de filtros volta sempre, então trocar de viewport não
  // reconstrói o filtro (nem invalida o shader do PIXI). Guarda `null` também — `mode in cache` e não
  // `cache[mode]` — para que modo sem filtro (normal, hc-*) não seja reprocessado a cada frame.
  const _vpFilterCache: Record<string, unknown> = {};
  function pixiFilterFor(mode: string): unknown {
    if (mode in _vpFilterCache) return _vpFilterCache[mode];
    let f: unknown = null;
    const CM = ctx.ColorMatrixFilter, BL = ctx.BlurFilter;
    const cvd = CVD_MATRIX[mode as CvdKey]; // fonte única: os MESMOS números que geram o <feColorMatrix> do HTML
    if (cvd && CM) { const c = new CM(); c.matrix = cvd.slice(); f = [c]; } // slice: o filtro não fica com o array do módulo
    else if (mode === 'blind' && CM) { const c = new CM(); c.brightness(0, false); f = [c]; }
    else if (mode === 'lv-blur' && BL) { f = [new BL(5)]; }
    else if (mode === 'lv-haze' && CM) { const c = new CM(); c.contrast(-0.45, false); c.brightness(1.12, true); f = [c]; }
    else if ((mode === 'lv-tunnel' || mode === 'lv-diabetic' || mode === 'lv-macular') && BL) { f = [new BL(mode === 'lv-tunnel' ? 1.5 : 2)]; }
    return _vpFilterCache[mode] = f;
  }

  /* ===================== baixa visão: o overlay como textura ===================== */

  // O que o filtro GPU não sabe fazer: névoa de catarata, o túnel do glaucoma, a mancha central da degeneração
  // macular e as manchas espalhadas da retinopatia. São desenho, não transformação de cor — vêm como textura.
  function lvOverlayCanvas(lv: string): HTMLCanvasElement {
    const W = LOGICAL_W, H = LOGICAL_H, cv = makeCanvas(W, H), c = cv.getContext('2d')!, cx = W / 2, cy = H / 2;
    if (lv === 'haze') { c.fillStyle = 'rgba(244,246,250,0.42)'; c.fillRect(0, 0, W, H); }
    else if (lv === 'tunnel') { const g = c.createRadialGradient(cx, cy, H * 0.12, cx, cy, H * 0.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,.99)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    else if (lv === 'macular') { const g = c.createRadialGradient(cx, cy, 2, cx, cy, H * 0.34); g.addColorStop(0, 'rgba(12,12,15,.95)'); g.addColorStop(.55, 'rgba(12,12,15,.5)'); g.addColorStop(1, 'rgba(12,12,15,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    else if (lv === 'diabetic') { for (const [fx, fy, fr] of [[.22, .3, .1], [.64, .22, .075], [.8, .58, .11], [.4, .7, .085], [.16, .8, .07], [.54, .48, .06]]) { const x = fx * W, y = fy * H, r = fr * W, g = c.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, 'rgba(10,10,14,.95)'); g.addColorStop(.5, 'rgba(10,10,14,.7)'); g.addColorStop(1, 'rgba(10,10,14,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } }
    return cv;
  }

  const _lvOverlayTex: Record<string, unknown> = {};
  function lvOverlayTex(lv: string): unknown {
    if (lv === 'blur') return null; // desfoque é filtro puro, não tem o que carimbar
    if (!_lvOverlayTex[lv]) _lvOverlayTex[lv] = tex(lvOverlayCanvas(lv));
    return _lvOverlayTex[lv];
  }

  // Overlay DENTRO da render-texture (a bolinha indicadora do viewport fica por cima, FORA do filtro — é por
  // isso que ela continua visível no modo cegueira; ver updateVpDots em render/viz-setters).
  function renderVpOverlay(i: number, mode: string): void {
    const m = VIZ_BY_KEY[mode];
    if (!m || m.kind !== 'lowvision') return;
    const t = lvOverlayTex(m.lv as string);
    if (t) { const spr = ctx.getLvOverlaySpr(); spr.texture = t; ctx.renderer.render(spr, { renderTexture: ctx.getVpTex()[i], clear: false }); }
  }

  return {
    parallaxTexFor, treeTexFor, playerVizTex, pixiFilterFor,
    lvOverlayCanvas, lvOverlayTex, renderVpOverlay,
    clearParallaxTexCache, clearPlayerDirectCache,
  };
}
