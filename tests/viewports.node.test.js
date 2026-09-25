// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of render/viewports + render/cvd-matrices — the image FACTORY of the accessible vision modes ("how a mode becomes
// pixels"), the counterpart of render/viz-setters (which carries the POLICY, "which mode holds where").
//
// NODE project: what does NOT need a canvas — the six colour-blindness matrices, filter selection by mode, the caches,
// the generation of the SVG <filter>s (with a fake DOM) and the detours that return the raw texture. PIXI is FAKED through
// a structural interface (the same precedent as viz-setters.node). What needs a real canvas — lvOverlayCanvas, the three
// Direct Rendering levels, the stamping of the overlay in the render-texture — is in viewports.browser.test.js.
//
// WHAT THIS FILE EXISTS TO CATCH: the six colour-blindness matrices have ONE source (render/cvd-matrices) feeding two
// paths in two languages — the SVG `<feColorMatrix values="…">` of the SINGLE-SCREEN path and the `ColorMatrixFilter` of
// the MULTI-SCREEN path. Written twice, they would agree by luck, and if they diverged the failure would be SILENT and of
// ACCESSIBILITY: the same colour-blind person would see different colours on one screen and on several, with no error, no
// log, no red test. The witnesses tied to the single source below are the research (docs/research/
// RESEARCH-DALTONIZATION.md, read and compared value by value) and the ids VIZ_FILTER asks for.
//
// ZOMBIES + Right-BICEP. (parallaxTexFor/treeTexFor/playerVizTex/pixiFilterFor/lvOverlayTex/renderVpOverlay.)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { VIZ_MODES, VIZ_FILTER } from '../app/js/render/viz-modes.js';
import { CVD_KEYS, CVD_MATRIX, CVD_SVG_ID, cvdMatrixValues, installCvdFilters } from '../app/js/render/cvd-matrices.js';
import { initViewports } from '../app/js/render/viewports.js';

const readRepo = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

/* ===================== fakes: PIXI and DOM through a structural interface ===================== */

// A fake PIXI.ColorMatrixFilter: keeps the matrix and the LOG of brightness/contrast calls (with the arguments), which is
// what tells 'blind' from 'lv-haze' from a colour-blindness mode.
function fakeCM() {
  const made = [];
  class CM {
    constructor() { this.matrix = null; this.calls = []; made.push(this); }
    brightness(b, multiply) { this.calls.push(['brightness', b, multiply]); }
    contrast(a, multiply) { this.calls.push(['contrast', a, multiply]); }
  }
  return { CM, made };
}
function fakeBL() {
  const made = [];
  class BL { constructor(strength) { this.strength = strength; made.push(this); } }
  return { BL, made };
}

function fakeSvgNode(ns, name) {
  return {
    ns, name, attrs: {}, children: [],
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(c) { this.children.push(c); return c; },
  };
}
// A fake `<defs>` with a real firstChild/removeChild — it is what lets the idempotence test fail if installCvdFilters
// stops emptying the host before filling it (duplicate ids = a silent failure).
function fakeDefsHost() {
  const host = fakeSvgNode('svg', 'defs');
  host.ownerDocument = { createElementNS: (ns, name) => fakeSvgNode(ns, name) };
  Object.defineProperty(host, 'firstChild', { get: () => host.children[0] || null });
  host.removeChild = (c) => { const i = host.children.indexOf(c); if (i >= 0) host.children.splice(i, 1); return c; };
  return host;
}

function mkCtx(over = {}) {
  const rendered = [];
  const spr = { texture: null };
  const ctx = {
    ColorMatrixFilter: null, BlurFilter: null,
    parallaxTexNormal: ['TEX_SKY', 'TEX_FAR', 'TEX_NEAR'],
    getTreeTexNormal: () => 'TEX_TREE',
    getLvOverlaySpr: () => spr,
    // The renderer is the `renderInto` CAPABILITY (phase D): the module asks for the verb, not the PixiJS object.
    renderInto: (obj, alvo, limpar) => rendered.push([obj, { renderTexture: alvo, clear: limpar }]),
    getVpTex: () => ['RT0', 'RT1'],
    cvdDefsHost: null,
    // no canvas in the node project: a document that is touched throws, so a case that draws says so
    doc: { createElement: () => { throw new Error('no canvas in the node project'); } },
    // the world's high contrast (ADR-0232 D4): recorded, so a case can see which instance the recolour went through
    hc: {
      directBgTexture: (src, mode) => ({ bg: src, mode }),
      directSpriteTexture: (src, mode) => ({ sprite: src, mode }),
    },
    ...over,
  };
  return { ctx, rendered, spr };
}

/* ===================== 1. the single source of the matrices ===================== */

describe('render/cvd-matrices — forma das seis matrizes', () => {
  it('[Right] são exatamente os seis modos de daltonismo, e cada um traz 20 números (4 linhas × 5)', () => {
    expect([...CVD_KEYS]).toEqual(['sim-protan', 'sim-deuter', 'sim-tritan', 'fix-protan', 'fix-deuter', 'fix-tritan']);
    expect(Object.keys(CVD_MATRIX).sort()).toEqual([...CVD_KEYS].sort());
    for (const k of CVD_KEYS) expect(CVD_MATRIX[k]).toHaveLength(20);
  });

  it('[Right] nenhum dos seis modos mexe em alfa — a última linha é a identidade', () => {
    for (const k of CVD_KEYS) expect(CVD_MATRIX[k].slice(15)).toEqual([0, 0, 0, 1, 0]);
  });

  it('[Right] as colunas de deslocamento (5ª de cada linha) são zero — nenhum modo soma luz constante', () => {
    for (const k of CVD_KEYS) for (const i of [4, 9, 14]) expect(CVD_MATRIX[k][i]).toBe(0);
  });

  // A property of both families: each row sums to 1 → white and greys stay intact, the matrix only moves where there is
  // chroma. It catches almost every digit typo (it changes the sum by ~1e-4, a hundred times the tolerance).
  it('[Right] cada linha soma 1 — branco e cinza preservados nas seis matrizes', () => {
    for (const k of CVD_KEYS) for (const r of [0, 5, 10]) {
      const soma = CVD_MATRIX[k].slice(r, r + 3).reduce((a, b) => a + b, 0);
      expect(Math.abs(soma - 1)).toBeLessThan(1e-5);
    }
  });

  it('[Right] nas três CORREÇÕES a linha R é identidade — não se modula o canal que a pessoa não distingue', () => {
    for (const k of ['fix-protan', 'fix-deuter', 'fix-tritan']) expect(CVD_MATRIX[k].slice(0, 5)).toEqual([1, 0, 0, 0, 0]);
  });

  it('[Boundary] as três SIMULAÇÕES NÃO têm linha R identidade — senão não simulariam nada', () => {
    for (const k of ['sim-protan', 'sim-deuter', 'sim-tritan']) expect(CVD_MATRIX[k].slice(0, 5)).not.toEqual([1, 0, 0, 0, 0]);
  });

  it('[Right] cvdMatrixValues devolve os mesmos 20 números que o array, em ordem', () => {
    for (const k of CVD_KEYS) expect(cvdMatrixValues(k).trim().split(/\s+/).map(Number)).toEqual([...CVD_MATRIX[k]]);
  });
});

/* ===================== 2. as três testemunhas contra a divergência ===================== */

describe('render/cvd-matrices — a fonte única confere com a pesquisa', () => {
  // The research (Machado 2009 + canonical daltonisation) is the PRIMARY source. The tables are read from the markdown and
  // compared value by value: if someone "adjusts" a number in the module without updating the research (or vice versa),
  // this case goes red — which is the only thing that stops the two from drifting apart in silence again.
  const DOC_ROW = {
    Protanopia: 'sim-protan', Deuteranopia: 'sim-deuter', Tritanopia: 'sim-tritan',
    'fix-protan': 'fix-protan', 'fix-deutan': 'fix-deuter', 'fix-tritan': 'fix-tritan',
  };
  const doc = (() => {
    const md = readRepo('docs/research/RESEARCH-DALTONIZATION.md');
    const out = {};
    for (const line of md.split(/\r?\n/)) {
      const m = /^\|\s*\*\*([A-Za-z-]+)\*\*\s*\|(.*)\|\s*$/.exec(line);
      if (!m || !DOC_ROW[m[1]]) continue;
      const cells = m[2].split('|').map((s) => s.trim());
      if (cells.length !== 3) continue;
      // the research uses the TYPOGRAPHIC MINUS (U+2212), not the ASCII hyphen
      out[DOC_ROW[m[1]]] = cells.map((c) => c.replace(/−/g, '-').split(',').map((s) => Number(s.trim())));
    }
    return out;
  })();

  it('[Interface] a pesquisa documenta as seis matrizes — nem uma a menos', () => {
    expect(Object.keys(doc).sort()).toEqual([...CVD_KEYS].sort());
  });

  it.each([...CVD_KEYS])('[Cross-check] %s: os 9 coeficientes batem com a tabela da pesquisa', (k) => {
    const linhas = [0, 5, 10].map((r) => [...CVD_MATRIX[k].slice(r, r + 3)]);
    expect(linhas).toEqual(doc[k]);
  });
});

describe('render/cvd-matrices — os ids são o contrato com o caminho de tela única', () => {
  // VIZ_FILTER keeps only the `url(#cvd-deuter)`; what promises that filter exists in the document is CVD_SVG_ID.
  // Renaming on one side only blanks the canvas (a reference to a non-existent filter does not render).
  it.each([...CVD_KEYS])('[Interface] %s: VIZ_FILTER pede exatamente o id que o gerador cria', (k) => {
    expect(VIZ_FILTER[k]).toBe('url(#' + CVD_SVG_ID[k] + ')');
  });

  it('[Interface] os seis modos de kind "filter" de VIZ_MODES são exatamente as seis chaves CVD', () => {
    const doViz = VIZ_MODES.filter((m) => m.kind === 'filter').map((m) => m.key);
    expect(doViz.sort()).toEqual([...CVD_KEYS].sort());
  });

  it('[Interface] os seis ids são distintos — id repetido faria o navegador usar só o primeiro filtro', () => {
    expect(new Set(Object.values(CVD_SVG_ID)).size).toBe(CVD_KEYS.length);
  });
});


/* ===================== 3. installCvdFilters ===================== */

describe('render/cvd-matrices — installCvdFilters (DOM falso)', () => {
  it('[Right] cria os seis <filter> no namespace SVG, com id, sRGB e os values da fonte única', () => {
    const host = fakeDefsHost();
    expect(installCvdFilters(host)).toBe(6);
    expect(host.children).toHaveLength(6);
    host.children.forEach((f, i) => {
      const k = CVD_KEYS[i];
      expect(f.ns).toBe('http://www.w3.org/2000/svg');
      expect(f.name).toBe('filter');
      expect(f.attrs.id).toBe(CVD_SVG_ID[k]);
      expect(f.attrs['color-interpolation-filters']).toBe('sRGB');
      expect(f.children).toHaveLength(1);
      const fe = f.children[0];
      expect(fe.ns).toBe('http://www.w3.org/2000/svg');
      expect(fe.name).toBe('feColorMatrix');
      expect(fe.attrs.type).toBe('matrix');
      expect(fe.attrs.values.trim().split(/\s+/).map(Number)).toEqual([...CVD_MATRIX[k]]);
    });
  });

  it('[Right] é idempotente — duas chamadas deixam seis filtros, não doze com id repetido', () => {
    const host = fakeDefsHost();
    installCvdFilters(host);
    expect(installCvdFilters(host)).toBe(6);
    expect(host.children).toHaveLength(6);
    expect(host.children.map((f) => f.attrs.id)).toEqual(CVD_KEYS.map((k) => CVD_SVG_ID[k]));
  });

  it('[Zombie] host ausente (null/undefined) devolve 0 e não estoura', () => {
    expect(installCvdFilters(null)).toBe(0);
    expect(installCvdFilters(undefined)).toBe(0);
  });

  it('[Zombie] host sem ownerDocument devolve 0 — nada de criar nó sem documento', () => {
    expect(installCvdFilters({ ownerDocument: null })).toBe(0);
  });

  it('[Interface] initViewports gera os filtros no boot — é o que substitui o SVG escrito à mão', () => {
    const host = fakeDefsHost();
    const { ctx } = mkCtx({ cvdDefsHost: host });
    initViewports(ctx);
    expect(host.children.map((f) => f.attrs.id)).toEqual(CVD_KEYS.map((k) => CVD_SVG_ID[k]));
  });
});

/* ===================== 4. pixiFilterFor: modo → filtro do viewport ===================== */

describe('render/viewports — pixiFilterFor', () => {
  const withPixi = (over) => {
    const cm = fakeCM(), bl = fakeBL();
    const { ctx } = mkCtx({ ColorMatrixFilter: cm.CM, BlurFilter: bl.BL, ...over });
    return { vp: initViewports(ctx), cm, bl };
  };

  it.each([...CVD_KEYS])('[Right] %s vira UM ColorMatrixFilter com a matriz da fonte única', (k) => {
    const { vp } = withPixi();
    const f = vp.pixiFilterFor(k);
    expect(f).toHaveLength(1);
    expect(f[0].matrix).toEqual([...CVD_MATRIX[k]]);
    expect(f[0].calls).toEqual([]); // colour blindness is a pure matrix: no brightness/contrast
  });

  // Without the copy, the filter would hold the MODULE's array: any PIXI c.brightness()/c.contrast() would rewrite the
  // single source in memory and contaminate every other mode.
  it('[Interface] o filtro recebe uma CÓPIA da matriz — mexer nele não corrompe a fonte única', () => {
    const { vp } = withPixi();
    const f = vp.pixiFilterFor('sim-deuter');
    expect(f[0].matrix).not.toBe(CVD_MATRIX['sim-deuter']);
    f[0].matrix[0] = 999;
    expect(CVD_MATRIX['sim-deuter'][0]).toBe(0.367322);
  });

  it('[Right] blind = brightness(0) NÃO multiplicativo — a tela fica preta, não escurecida', () => {
    const { vp, cm } = withPixi();
    const f = vp.pixiFilterFor('blind');
    expect(f).toHaveLength(1);
    expect(f[0].calls).toEqual([['brightness', 0, false]]);
    expect(cm.made).toHaveLength(1);
  });

  it('[Right] lv-haze = contraste rebaixado e DEPOIS brilho multiplicativo (a ordem é o efeito de catarata)', () => {
    const { vp } = withPixi();
    expect(vp.pixiFilterFor('lv-haze')[0].calls).toEqual([['contrast', -0.45, false], ['brightness', 1.12, true]]);
  });

  it.each([['lv-blur', 5], ['lv-tunnel', 1.5], ['lv-diabetic', 2], ['lv-macular', 2]])(
    '[Right] %s = BlurFilter(%s)', (mode, forca) => {
      const { vp, bl } = withPixi();
      const f = vp.pixiFilterFor(mode);
      expect(f).toHaveLength(1);
      expect(bl.made).toHaveLength(1);
      expect(f[0].strength).toBe(forca);
    });

  it.each(['normal', 'hc-direto', 'hc-direto-45', 'hc-direto-7'])(
    '[Zombie] %s não usa filtro de viewport → null (o alto contraste é textura, não filtro)', (mode) => {
      const { vp } = withPixi();
      expect(vp.pixiFilterFor(mode)).toBeNull();
    });

  it('[Zombie] modo inventado → null', () => {
    const { vp } = withPixi();
    expect(vp.pixiFilterFor('modo-que-nao-existe')).toBeNull();
  });

  // AN INHERITED DEFECT, PINNED ON PURPOSE. The cache is a plain `{}` and the presence test is `mode in _vpFilterCache`,
  // which sees the PROTOTYPE: a mode called 'toString' returns Object.prototype.toString as if it were a filter. The same
  // hole exists in resolveViz's `VIZ_BY_KEY[key]` (render/viz-setters), which is what feeds `mode` — so the decision to
  // close both is one and does not fit here. If someone swaps the cache for Object.create(null), this case goes red: it is
  // the reminder to close the hole in BOTH places, not only in this one.
  it('[Zombie] nome de propriedade de Object.prototype ainda vaza pelo cache (defeito conhecido)', () => {
    const { vp } = withPixi();
    expect(vp.pixiFilterFor('toString')).toBe(Object.prototype.toString);
  });

  it('[Performance] memoiza por modo: a MESMA referência volta e o filtro é construído uma vez só', () => {
    const { vp, cm } = withPixi();
    const a = vp.pixiFilterFor('sim-tritan');
    const b = vp.pixiFilterFor('sim-tritan');
    expect(b).toBe(a);
    expect(cm.made).toHaveLength(1);
  });

  it('[Performance] memoiza o null também — modo sem filtro não é reprocessado a cada frame', () => {
    const cm = fakeCM();
    let chamadas = 0;
    const { ctx } = mkCtx({ BlurFilter: fakeBL().BL });
    Object.defineProperty(ctx, 'ColorMatrixFilter', { get: () => { chamadas++; return cm.CM; } });
    const vp = initViewports(ctx);
    vp.pixiFilterFor('normal'); vp.pixiFilterFor('normal'); vp.pixiFilterFor('normal');
    expect(chamadas).toBe(1); // the 2nd and 3rd calls leave through the cache, before reading the constructor
  });

  it('[Boundary] PIXI sem ColorMatrixFilter: os modos de matriz caem para null em vez de estourar', () => {
    const { vp } = withPixi({ ColorMatrixFilter: null });
    expect(vp.pixiFilterFor('sim-protan')).toBeNull();
    expect(vp.pixiFilterFor('blind')).toBeNull();
    expect(vp.pixiFilterFor('lv-haze')).toBeNull();
    expect(vp.pixiFilterFor('lv-blur')).not.toBeNull(); // BlurFilter continua disponível
  });

  it('[Boundary] PIXI sem BlurFilter: os modos de desfoque caem para null e os de matriz seguem', () => {
    const { vp } = withPixi({ BlurFilter: null });
    expect(vp.pixiFilterFor('lv-blur')).toBeNull();
    expect(vp.pixiFilterFor('lv-tunnel')).toBeNull();
    expect(vp.pixiFilterFor('sim-protan')).not.toBeNull();
  });

  it('[Interface] cada initViewports tem cache PRÓPRIO — nada vaza entre instâncias', () => {
    const a = withPixi(), b = withPixi();
    expect(a.vp.pixiFilterFor('sim-deuter')).not.toBe(b.vp.pixiFilterFor('sim-deuter'));
  });
});

/* ===================== 5. textures: the detours that do not touch a canvas ===================== */

describe('render/viewports — parallaxTexFor', () => {
  it('[Right] modo não-direto devolve a textura CRUA da camada pedida', () => {
    const { ctx } = mkCtx();
    const vp = initViewports(ctx);
    expect(vp.parallaxTexFor(0, 'normal')).toBe('TEX_SKY');
    expect(vp.parallaxTexFor(2, 'sim-deuter')).toBe('TEX_NEAR');
  });

  // A scenery swap replaces the ELEMENTS of parallaxTexNormal in place (the array is `const`). That is why it comes in by
  // VALUE and not by getter: if the module had copied the array, the new theme would never appear.
  it('[Interface] enxerga a troca de textura feita pelo cenário (o array é o mesmo objeto)', () => {
    const { ctx } = mkCtx();
    const vp = initViewports(ctx);
    ctx.parallaxTexNormal[1] = 'TEX_TEMA_NOVO';
    expect(vp.parallaxTexFor(1, 'normal')).toBe('TEX_TEMA_NOVO');
  });

  it('[Zombie] camada fora do array devolve undefined (verbatim: o original também não checa)', () => {
    const { ctx } = mkCtx();
    expect(initViewports(ctx).parallaxTexFor(9, 'normal')).toBeUndefined();
  });
});

describe('render/viewports — treeTexFor', () => {
  it('[Right] modo não-direto devolve a árvore crua', () => {
    const { ctx } = mkCtx();
    const vp = initViewports(ctx);
    expect(vp.treeTexFor('normal')).toBe('TEX_TREE');
    expect(vp.treeTexFor('lv-tunnel')).toBe('TEX_TREE');
  });

  // The tree is a `const` a host may declare AFTER the point where initViewports has to run (restoring a saved scenery at
  // the top of boot clears the parallax cache). That is why it comes in through a getter: if the module read the value at
  // init, the boot would fall into the TDZ and the player's saved scenery would be lost inside a silent try/catch.
  it('[Interface] lê a árvore no momento da CHAMADA — a init pode preceder a declaração dela', () => {
    let arvore = null;
    const { ctx } = mkCtx({ getTreeTexNormal: () => arvore });
    const vp = initViewports(ctx);
    arvore = 'TEX_TREE_TARDIA';
    expect(vp.treeTexFor('normal')).toBe('TEX_TREE_TARDIA');
  });
});

describe('render/viewports — playerVizTex', () => {
  it('[Right] modo não-direto devolve a MESMA textura recebida, sem tocar nela', () => {
    const { ctx } = mkCtx();
    const vp = initViewports(ctx);
    const base = { quadro: 3 };
    expect(vp.playerVizTex(base, 'normal')).toBe(base);
    expect(vp.playerVizTex(base, 'blind')).toBe(base);
  });

  it.each([[null], [undefined], [0], ['']])('[Zombie] base falsy (%p) volta como veio, em qualquer modo', (base) => {
    const { ctx } = mkCtx();
    const vp = initViewports(ctx);
    expect(vp.playerVizTex(base, 'hc-direto')).toBe(base);
  });

  it('[Zombie] limpar o cache sem nunca ter cacheado nada não estoura', () => {
    const { ctx } = mkCtx();
    expect(() => initViewports(ctx).clearPlayerDirectCache()).not.toThrow();
  });
});

describe('render/viewports — high contrast goes through the INJECTED world instance (ADR-0232 D4)', () => {
  // The recolours used to be module functions over the page's one palette and outline; now they are the world's
  // `createHighContrast` instance, handed in as `ctx.hc`. These cases see each recolour arrive THERE, with the mode.
  it('🔴 [Right] parallax, tree and player are recoloured by `ctx.hc`, once per mode (cached)', () => {
    const calls = [];
    const { ctx } = mkCtx({ hc: {
      directBgTexture: (src, mode) => { calls.push(['bg', src, mode]); return 'BG:' + src; },
      directSpriteTexture: (src, mode) => { calls.push(['sprite', src.q, mode]); return 'SPR'; },
    } });
    const vp = initViewports(ctx);
    expect(vp.parallaxTexFor(1, 'hc-direto')).toBe('BG:TEX_FAR');
    expect(vp.treeTexFor('hc-direto-7')).toBe('BG:TEX_TREE');
    const base = { q: 1 };
    expect(vp.playerVizTex(base, 'hc-direto-45')).toBe('SPR');
    vp.parallaxTexFor(1, 'hc-direto'); vp.treeTexFor('hc-direto-7'); vp.playerVizTex(base, 'hc-direto-45'); // cached
    expect(calls).toEqual([['bg', 'TEX_FAR', 'hc-direto'], ['bg', 'TEX_TREE', 'hc-direto-7'], ['sprite', 1, 'hc-direto-45']]);
  });
});

describe('render/viewports — lvOverlayTex', () => {
  it('[Boundary] blur não tem overlay — é filtro puro, então a textura é null', () => {
    const { ctx } = mkCtx();
    expect(initViewports(ctx).lvOverlayTex('blur')).toBeNull();
  });
});

/* ===================== 6. renderVpOverlay: who does NOT draw ===================== */

describe('render/viewports — renderVpOverlay', () => {
  // The early-exit detours are exactly the ones that do not touch a canvas; the stamp itself is a browser case.
  it.each(['normal', 'blind', 'hc-direto', 'sim-deuter'])(
    '[Zombie] %s não é baixa visão → nenhuma passada extra de render', (mode) => {
      const { ctx, rendered } = mkCtx();
      initViewports(ctx).renderVpOverlay(0, mode);
      expect(rendered).toHaveLength(0);
    });

  it('[Zombie] modo inventado não existe em VIZ_BY_KEY → sai antes de qualquer render', () => {
    const { ctx, rendered } = mkCtx();
    initViewports(ctx).renderVpOverlay(0, 'modo-que-nao-existe');
    expect(rendered).toHaveLength(0);
  });

  it('[Boundary] lv-blur É baixa visão, mas não tem overlay → também não renderiza nada', () => {
    const { ctx, rendered, spr } = mkCtx();
    initViewports(ctx).renderVpOverlay(0, 'lv-blur');
    expect(rendered).toHaveLength(0);
    expect(spr.texture).toBeNull(); // not even the sprite's texture is touched
  });
});

// ⚠️ Assertions about the CARTRIDGE — its composition root (`main.ts`) or its `app/index.html` — live in `game-platformer`
// (issue #111), where those files are. What stays here is the ENGINE's behaviour, which is what this file has always had
// to prove.

// MUTATIONS CHECKED (2026-09-23) on `pixiFilterFor`, before and after it became two tables (`MATRIX_OF`, `BLUR_OF`) —
// `scratchpad/sonda-vp.py` and `sonda-vp-3.py`. Before: 16 of 16 red, every rung of the old ladder already held by a case
// above. After: 16 of 17, including three only the tables let one ask — colour vision reading the single source and not a
// row, the blindness row itself, and the cataract's ORDER (contrast, then brightness). The survivor is EQUIVALENT by the
// table and declared rather than caught: a missing strength tested as `!== undefined` or as falsy answers the same while no
// row has a strength of 0.
