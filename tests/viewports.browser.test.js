// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of render/viewports — what only the browser proves (browser project: Chromium/Playwright).
// The pure part (matrices, filter selection by mode, caches, fake DOM) is in viewports.node.test.js; here is what needs a
// real DOM/canvas/PIXI:
//   · installCvdFilters in the REAL document — the <filter>s have to be born in the SVG namespace and be found by id,
//     because that is how `filter: url(#cvd-deuter)` finds them. A <filter> created in the wrong namespace gives no
//     error: it simply does not filter (or, worse, blanks the canvas). It is a silent accessibility failure.
//   · lvOverlayCanvas — low vision's haze/tunnel/blot/spots are DRAWING, not colour transformation; only getImageData
//     shows whether they are in the right place.
//   · the Direct Rendering path (high contrast) of parallaxTexFor/treeTexFor/playerVizTex + the caches.
//   · the stamping of the overlay inside the viewport's render-texture.
// ZOMBIES + Right-BICEP. See ADR-0011-visual-accessibility.yaml and docs/research/RESEARCH-DALTONIZATION.md.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CVD_KEYS, CVD_MATRIX, CVD_SVG_ID, installCvdFilters } from '../app/js/render/cvd-matrices.js';
import { initViewports } from '../app/js/render/viewports.js';
import { initHighContrast } from '../app/js/render/high-contrast.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// outlineFg > 0 → directSpriteTexture really outlines (with 0 it returns the source and the player cache test could not
// fail). The world/coin fields are not exercised here.
initHighContrast({
  W: 1, H: 1, outlineFg: () => 1, outlineBg: () => 0,
  getWorldCanvasNormal: () => null, getWorldTexNormal: () => null,
  sprites: () => ({}), roleOf: () => null,
});

const flatCanvas = (w, h, css) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.fillStyle = css; c.fillRect(0, 0, w, h);
  return cv;
};
// A structural srcTex (see DirectTexSource in render/high-contrast): valid=true → the paint runs SYNCHRONOUSLY.
const fakeTex = (cv) => ({ orig: { width: cv.width, height: cv.height }, baseTexture: { valid: true, resource: { source: cv }, once: () => {} } });
const alphaAt = (cv, x, y) => cv.getContext('2d').getImageData(x, y, 1, 1).data[3];

function mkCtx(over = {}) {
  const rendered = [];
  const spr = { texture: null };
  const treeTexNormal = fakeTex(flatCanvas(8, 8, '#207030'));
  const ctx = {
    ColorMatrixFilter: null, BlurFilter: null,
    parallaxTexNormal: [fakeTex(flatCanvas(8, 8, '#3060c0')), fakeTex(flatCanvas(8, 8, '#20a040')), fakeTex(flatCanvas(8, 8, '#c04020'))],
    getTreeTexNormal: () => treeTexNormal,
    getLvOverlaySpr: () => spr,
    // The renderer is the `renderInto` CAPABILITY (phase D): the module asks for the verb, not the PixiJS object.
    renderInto: (obj, alvo, limpar) => rendered.push([obj, { renderTexture: alvo, clear: limpar }]),
    getVpTex: () => ['RT0', 'RT1'],
    cvdDefsHost: null,
    ...over,
  };
  return { ctx, rendered, spr, treeTexNormal };
}

/* ===================== 1. os <filter> gerados no documento REAL ===================== */

describe('render/cvd-matrices — installCvdFilters no DOM de verdade', () => {
  let svg, defs;
  beforeEach(() => {
    svg = document.createElementNS(SVG_NS, 'svg');
    defs = document.createElementNS(SVG_NS, 'defs');
    defs.id = 'cvd-defs-test';
    svg.appendChild(defs); document.body.appendChild(svg);
  });
  afterEach(() => { svg.remove(); });

  it('[Right] cria os seis <filter> NO NAMESPACE SVG — fora dele o filtro não filtra', () => {
    expect(installCvdFilters(defs)).toBe(6);
    expect(defs.children).toHaveLength(6);
    for (const f of defs.children) {
      expect(f.namespaceURI).toBe(SVG_NS);
      expect(f.localName).toBe('filter');
      expect(f.firstElementChild.namespaceURI).toBe(SVG_NS);
      expect(f.firstElementChild.localName).toBe('feColorMatrix');
    }
  });

  it.each([...CVD_KEYS])('[Right] %s: o filtro é achável por id e traz os 20 números da fonte única', (k) => {
    installCvdFilters(defs);
    const f = document.getElementById(CVD_SVG_ID[k]); // it is EXACTLY what url(#…) does
    expect(f).not.toBeNull();
    expect(f.getAttribute('color-interpolation-filters')).toBe('sRGB');
    const vals = f.firstElementChild.getAttribute('values').trim().split(/\s+/).map(Number);
    expect(vals).toEqual([...CVD_MATRIX[k]]);
  });

  it('[Right] rodar duas vezes não deixa id duplicado (o navegador usaria só o primeiro)', () => {
    installCvdFilters(defs); installCvdFilters(defs);
    expect(defs.children).toHaveLength(6);
    expect(document.querySelectorAll('#' + CVD_SVG_ID['sim-deuter'])).toHaveLength(1);
  });

  it('[Interface] initViewports instala no host injetado — o boot do jogo é quem gera o SVG', () => {
    const { ctx } = mkCtx({ cvdDefsHost: defs });
    initViewports(ctx);
    expect(document.getElementById(CVD_SVG_ID['fix-tritan'])).not.toBeNull();
  });
});

describe('app/index.html — o host dos filtros existe no documento servido', () => {
  it('[Interface] o <defs id="cvd-defs"> é o contrato entre o HTML e installCvdFilters', () => {
    // The test runs on a blank page, so the host markup a page provides is recreated: what is asserted is that ONE empty
    // <defs> is enough as the host — no hand-written <filter> is needed.
    const host = document.createElement('div');
    host.innerHTML = '<svg aria-hidden="true" width="0" height="0"><defs id="cvd-defs"></defs></svg>';
    document.body.appendChild(host);
    const defs = document.getElementById('cvd-defs');
    expect(defs).not.toBeNull();
    expect(defs.children).toHaveLength(0);
    expect(installCvdFilters(defs)).toBe(6);
    expect(document.getElementById('cvd-protan')).not.toBeNull();
    host.remove();
  });
});

/* ===================== 2. the low-vision overlay (drawing) ===================== */

describe('render/viewports — lvOverlayCanvas', () => {
  const vp = () => initViewports(mkCtx().ctx);
  const W = 320, H = 180, CX = 160, CY = 90;

  it('[Right] o overlay tem o tamanho lógico da tela (320×180)', () => {
    const cv = vp().lvOverlayCanvas('haze');
    expect([cv.width, cv.height]).toEqual([W, H]);
  });

  it('[Right] haze (catarata) cobre a tela INTEIRA com o mesmo véu claro', () => {
    const cv = vp().lvOverlayCanvas('haze');
    const a = alphaAt(cv, 0, 0);
    expect(a).toBeGreaterThan(100); // 0.42 × 255 ≈ 107
    expect(alphaAt(cv, CX, CY)).toBe(a);
    expect(alphaAt(cv, W - 1, H - 1)).toBe(a);
  });

  it('[Right] tunnel (glaucoma) deixa o CENTRO limpo e fecha a periferia', () => {
    const cv = vp().lvOverlayCanvas('tunnel');
    expect(alphaAt(cv, CX, CY)).toBe(0);
    expect(alphaAt(cv, 0, 0)).toBeGreaterThan(240);
  });

  // The exact inverse of the tunnel — it is the pair that stops the two gradients from being swapped for each other.
  it('[Right] macular (degeneração) faz o oposto: mancha no CENTRO, periferia limpa', () => {
    const cv = vp().lvOverlayCanvas('macular');
    expect(alphaAt(cv, CX, CY)).toBeGreaterThan(200);
    expect(alphaAt(cv, 0, 0)).toBe(0);
  });

  it('[Right] diabetic espalha manchas: escuro sobre uma delas, limpo no canto', () => {
    const cv = vp().lvOverlayCanvas('diabetic');
    expect(alphaAt(cv, Math.round(0.22 * W), Math.round(0.3 * H))).toBeGreaterThan(200);
    expect(alphaAt(cv, 0, 0)).toBe(0);
  });

  it('[Zombie] lv desconhecido devolve canvas do tamanho certo e TOTALMENTE transparente', () => {
    const cv = vp().lvOverlayCanvas('nao-existe');
    expect([cv.width, cv.height]).toEqual([W, H]);
    expect(alphaAt(cv, CX, CY)).toBe(0);
    expect(alphaAt(cv, 0, 0)).toBe(0);
  });
});

describe('render/viewports — lvOverlayTex', () => {
  it('[Performance] memoiza por lv: a mesma textura volta, não se repinta a cada frame', () => {
    const v = initViewports(mkCtx().ctx);
    const a = v.lvOverlayTex('haze');
    expect(a).not.toBeNull();
    expect(v.lvOverlayTex('haze')).toBe(a);
  });

  it('[Boundary] lv diferentes não compartilham textura', () => {
    const v = initViewports(mkCtx().ctx);
    expect(v.lvOverlayTex('tunnel')).not.toBe(v.lvOverlayTex('macular'));
  });

  it('[Boundary] blur segue sendo null mesmo com canvas disponível — é filtro, não desenho', () => {
    expect(initViewports(mkCtx().ctx).lvOverlayTex('blur')).toBeNull();
  });
});

/* ===================== 3. the stamp inside the render-texture ===================== */

describe('render/viewports — renderVpOverlay', () => {
  it('[Right] baixa visão carimba o overlay na render-texture do viewport, SEM limpar a cena', () => {
    const { ctx, rendered, spr } = mkCtx();
    const v = initViewports(ctx);
    v.renderVpOverlay(1, 'lv-haze');
    expect(rendered).toHaveLength(1);
    const [obj, opts] = rendered[0];
    expect(obj).toBe(spr);
    expect(opts.renderTexture).toBe('RT1');   // the requested viewport, not another
    expect(opts.clear).toBe(false);           // clear:true would erase the scene already drawn
    expect(spr.texture).toBe(v.lvOverlayTex('haze'));
  });

  // The same boot-order reason as getTreeTexNormal: the stamp sprite is born after the point where initViewports has to
  // run, so it is read at the CALL, not kept at init.
  it('[Interface] pega o sprite de carimbo no momento da chamada, não no init', () => {
    let sprite = null;
    const { ctx, rendered } = mkCtx({ getLvOverlaySpr: () => sprite });
    const v = initViewports(ctx);
    sprite = { texture: null };
    v.renderVpOverlay(0, 'lv-haze');
    expect(rendered[0][0]).toBe(sprite);
    expect(sprite.texture).not.toBeNull();
  });

  // configureRender REASSIGNS `vpTex` at every change in the number of screens — that is why it comes in through a getter.
  it('[Interface] lê as render-textures no momento da chamada, não as do init', () => {
    let atual = ['A0', 'A1'];
    const { ctx, rendered } = mkCtx({ getVpTex: () => atual });
    const v = initViewports(ctx);
    v.renderVpOverlay(0, 'lv-tunnel');
    atual = ['B0', 'B1'];
    v.renderVpOverlay(0, 'lv-tunnel');
    expect(rendered.map(([, o]) => o.renderTexture)).toEqual(['A0', 'B0']);
  });

  it('[Zombie] viewport inexistente passa undefined adiante (verbatim: o original não checa)', () => {
    const { ctx, rendered } = mkCtx();
    initViewports(ctx).renderVpOverlay(9, 'lv-macular');
    expect(rendered).toHaveLength(1);
    expect(rendered[0][1].renderTexture).toBeUndefined();
  });
});

/* ===================== 4. Renderização Direta (alto contraste) ===================== */

describe('render/viewports — parallaxTexFor no alto contraste', () => {
  it('[Right] modo direto devolve uma textura NOVA (fundo recuado), não a crua', () => {
    const { ctx } = mkCtx();
    const v = initViewports(ctx);
    const t = v.parallaxTexFor(0, 'hc-direto');
    expect(t).not.toBe(ctx.parallaxTexNormal[0]);
    expect(t).toBeTruthy();
  });

  it('[Performance] memoiza por modo E por camada — cada camada recolore uma vez só', () => {
    const v = initViewports(mkCtx().ctx);
    const a0 = v.parallaxTexFor(0, 'hc-direto');
    expect(v.parallaxTexFor(0, 'hc-direto')).toBe(a0);
    expect(v.parallaxTexFor(1, 'hc-direto')).not.toBe(a0);       // camada diferente
    expect(v.parallaxTexFor(0, 'hc-direto-7')).not.toBe(a0);     // a different contrast level
  });

  // A scenery swap replaces the raw textures and calls clearParallaxTexCache: without that the new theme would keep the
  // old theme's recoloured background — and nobody would see any error.
  it('[Interface] clearParallaxTexCache força o recolor com a textura crua do cenário novo', () => {
    const { ctx } = mkCtx();
    const v = initViewports(ctx);
    const antes = v.parallaxTexFor(0, 'hc-direto');
    ctx.parallaxTexNormal[0] = fakeTex(flatCanvas(8, 8, '#ffffff'));
    expect(v.parallaxTexFor(0, 'hc-direto')).toBe(antes); // still the old cache
    v.clearParallaxTexCache();
    expect(v.parallaxTexFor(0, 'hc-direto')).not.toBe(antes);
  });

  it('[Zombie] limpar o cache vazio não estoura', () => {
    expect(() => initViewports(mkCtx().ctx).clearParallaxTexCache()).not.toThrow();
  });
});

describe('render/viewports — treeTexFor no alto contraste', () => {
  it('[Right] modo direto recolore a árvore; [Performance] memoiza por modo', () => {
    const { ctx, treeTexNormal } = mkCtx();
    const v = initViewports(ctx);
    const t = v.treeTexFor('hc-direto-45');
    expect(t).not.toBe(treeTexNormal);
    expect(v.treeTexFor('hc-direto-45')).toBe(t);
    expect(v.treeTexFor('hc-direto-7')).not.toBe(t);
    expect(v.treeTexFor('normal')).toBe(treeTexNormal);
  });
});

describe('render/viewports — playerVizTex no alto contraste', () => {
  const base = () => fakeTex(flatCanvas(8, 8, '#ffcc00'));

  it('[Right] modo direto entrega uma textura contornada, diferente do quadro cru', () => {
    const v = initViewports(mkCtx().ctx);
    const b = base();
    expect(v.playerVizTex(b, 'hc-direto')).not.toBe(b);
  });

  // The player changes frame EVERY frame: the cache is per source texture, not per player.
  it('[Performance] memoiza por quadro dentro do modo — quadros distintos, texturas distintas', () => {
    const v = initViewports(mkCtx().ctx);
    const b1 = base(), b2 = base();
    const t1 = v.playerVizTex(b1, 'hc-direto');
    expect(v.playerVizTex(b1, 'hc-direto')).toBe(t1);
    expect(v.playerVizTex(b2, 'hc-direto')).not.toBe(t1);
    expect(v.playerVizTex(b1, 'hc-direto-7')).not.toBe(t1); // nível diferente = cache diferente
  });

  // rebakeDirect (viz-setters) calls this when the outline thickness changes in the panel; without invalidating, the
  // player would keep the old outline while the scenery has already changed — a silent inconsistency.
  it('[Interface] clearPlayerDirectCache faz o quadro ser recontornado do zero', () => {
    const v = initViewports(mkCtx().ctx);
    const b = base();
    const t1 = v.playerVizTex(b, 'hc-direto');
    v.clearPlayerDirectCache();
    expect(v.playerVizTex(b, 'hc-direto')).not.toBe(t1);
  });
});
