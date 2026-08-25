// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/viewports + render/cvd-matrices — a FÁBRICA de imagem dos modos de visão acessível
// ("como um modo vira pixel"), par de render/viz-setters (que leva a POLÍTICA, "qual modo vale onde").
//
// project NODE: o que NÃO precisa de canvas — as seis matrizes de daltonismo, a seleção de filtro por modo,
// os caches, a geração dos <filter> SVG (com um DOM falso) e os desvios que devolvem a textura crua. PIXI é
// FALSIFICADO por interface estrutural (mesmo precedente de traffic.node/viz-setters.node). O que exige canvas
// de verdade — lvOverlayCanvas, os três níveis de Renderização Direta, o carimbo do overlay na render-texture —
// está em viewports.browser.test.js.
//
// O QUE ESTE ARQUIVO EXISTE PARA PEGAR (a duplicação curada): as seis matrizes de daltonismo estavam escritas
// DUAS vezes, em linguagens diferentes — como `<feColorMatrix values="…">` em app/index.html (caminho de TELA
// ÚNICA) e como `PIXI.ColorMatrixFilter` dentro de `pixiFilterFor` no game.js (caminho MULTI-TELA). Batiam por
// sorte. Se divergissem, a falha seria SILENCIOSA e de ACESSIBILIDADE: a mesma pessoa daltônica veria cores
// diferentes em tela única e em multi-tela, sem erro, sem log, sem teste vermelho. Agora há uma fonte só
// (render/cvd-matrices) e três testemunhas amarradas a ela aqui embaixo: a pesquisa (docs/research/
// PESQUISA-DALTONIZACAO.md, lida e comparada valor a valor), os ids que VIZ_FILTER pede, e o index.html — que
// não pode voltar a ter uma segunda cópia escrita à mão.
//
// ZOMBIES + Right-BICEP. Comportamento verbatim do game.js (parallaxTexFor/treeTexFor/playerVizTex/
// pixiFilterFor/lvOverlayTex/renderVpOverlay).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { VIZ_MODES, VIZ_FILTER } from '../app/js/render/viz-modes.js';
import { CVD_KEYS, CVD_MATRIX, CVD_SVG_ID, cvdMatrixValues, installCvdFilters } from '../app/js/render/cvd-matrices.js';
import { initViewports } from '../app/js/render/viewports.js';

const readRepo = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

/* ===================== fakes: PIXI e DOM por interface estrutural ===================== */

// PIXI.ColorMatrixFilter de mentira: guarda a matriz e o LOG das chamadas de brightness/contrast (com os
// argumentos), que é o que distingue 'blind' de 'lv-haze' de um modo de daltonismo.
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
// `<defs>` de mentira com firstChild/removeChild de verdade — é o que deixa o teste de idempotência falhar
// se installCvdFilters parar de esvaziar o host antes de preencher (ids duplicados = falha silenciosa).
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
    renderer: { render: (obj, opts) => rendered.push([obj, opts]) },
    getVpTex: () => ['RT0', 'RT1'],
    cvdDefsHost: null,
    ...over,
  };
  return { ctx, rendered, spr };
}

/* ===================== 1. a fonte única das matrizes ===================== */

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

  // Propriedade das duas famílias: soma de cada linha = 1 → branco e cinzas ficam intactos, a matriz só mexe
  // onde há croma. Pega quase todo erro de digitação de dígito (muda a soma em ~1e-4, cem vezes a tolerância).
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
  // A pesquisa (Machado 2009 + daltonização canônica) é a fonte PRIMÁRIA. As tabelas são lidas do markdown e
  // comparadas valor a valor: se alguém "ajustar" um número no módulo sem atualizar a pesquisa (ou vice-versa),
  // este caso fica vermelho — que é a única coisa que impede as duas de tornarem a divergir em silêncio.
  const DOC_ROW = {
    Protanopia: 'sim-protan', Deuteranopia: 'sim-deuter', Tritanopia: 'sim-tritan',
    'fix-protan': 'fix-protan', 'fix-deutan': 'fix-deuter', 'fix-tritan': 'fix-tritan',
  };
  const doc = (() => {
    const md = readRepo('docs/research/PESQUISA-DALTONIZACAO.md');
    const out = {};
    for (const line of md.split(/\r?\n/)) {
      const m = /^\|\s*\*\*([A-Za-z-]+)\*\*\s*\|(.*)\|\s*$/.exec(line);
      if (!m || !DOC_ROW[m[1]]) continue;
      const cells = m[2].split('|').map((s) => s.trim());
      if (cells.length !== 3) continue;
      // a pesquisa usa o MENOS TIPOGRÁFICO (U+2212), não o hífen ASCII
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
  // VIZ_FILTER guarda só o `url(#cvd-deuter)`; quem promete que esse filtro existe no documento é CVD_SVG_ID.
  // Renomear de um lado só apaga a canvas (referência de filtro inexistente não renderiza).
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

describe('app/index.html — a segunda cópia das matrizes não pode voltar', () => {
  const html = readRepo('app/index.html');

  it('[Interface] o host <defs id="cvd-defs"> existe — sem ele os seis filtros não têm onde nascer', () => {
    expect(html).toMatch(/<defs\s+id="cvd-defs"\s*>/);
  });

  // ESTE é o caso que discrimina: enquanto os números estavam no HTML, nada os ligava ao ColorMatrixFilter.
  it('[Interface] o HTML não escreve nenhuma matriz à mão — feColorMatrix só existe gerado', () => {
    expect(html).not.toMatch(/feColorMatrix/);
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
    expect(f[0].calls).toEqual([]); // daltonismo é matriz pura: nada de brightness/contrast
  });

  // Sem a cópia, o filtro ficaria com o array do MÓDULO nas mãos: qualquer c.brightness()/c.contrast() do PIXI
  // reescreveria a fonte única em memória e contaminaria todos os outros modos.
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

  // DEFEITO HERDADO, PINADO DE PROPÓSITO (não consertado nesta extração — comportamento verbatim do game.js).
  // O cache é um `{}` comum e o teste de presença é `mode in _vpFilterCache`, que enxerga o PROTÓTIPO: um modo
  // chamado 'toString' devolve Object.prototype.toString como se fosse um filtro. O mesmo buraco existe no
  // `VIZ_BY_KEY[key]` de resolveViz (render/viz-setters), que é quem alimenta `mode` — então a decisão de fechar
  // os dois é uma só e não cabe aqui. Se alguém trocar o cache por Object.create(null), este caso fica vermelho:
  // é o lembrete de fechar o buraco nos DOIS lugares, não só neste.
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
    expect(chamadas).toBe(1); // 2ª e 3ª chamadas saem pelo cache, antes de ler o construtor
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

/* ===================== 5. texturas: os desvios que não tocam canvas ===================== */

describe('render/viewports — parallaxTexFor', () => {
  it('[Right] modo não-direto devolve a textura CRUA da camada pedida', () => {
    const { ctx } = mkCtx();
    const vp = initViewports(ctx);
    expect(vp.parallaxTexFor(0, 'normal')).toBe('TEX_SKY');
    expect(vp.parallaxTexFor(2, 'sim-deuter')).toBe('TEX_NEAR');
  });

  // setCenario troca os ELEMENTOS de parallaxTexNormal in place (o array é `const`). É por isso que ele entra
  // por VALOR e não por getter: se o módulo tivesse copiado o array, o tema novo nunca apareceria.
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

  // A árvore é um `const` declarado DEPOIS do ponto em que initViewports precisa rodar (setCenario é chamado
  // no topo do boot e limpa o cache de parallax). Por isso ela entra por getter: se o módulo lesse o valor no
  // init, o boot cairia em TDZ e o cenário salvo do jogador seria perdido dentro de um try/catch mudo.
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

describe('render/viewports — lvOverlayTex', () => {
  it('[Boundary] blur não tem overlay — é filtro puro, então a textura é null', () => {
    const { ctx } = mkCtx();
    expect(initViewports(ctx).lvOverlayTex('blur')).toBeNull();
  });
});

/* ===================== 6. renderVpOverlay: quem NÃO desenha ===================== */

describe('render/viewports — renderVpOverlay', () => {
  // Os desvios de saída antecipada são justamente os que não tocam canvas; o carimbo em si é browser.
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
    expect(spr.texture).toBeNull(); // nem a textura do sprite é tocada
  });
});
