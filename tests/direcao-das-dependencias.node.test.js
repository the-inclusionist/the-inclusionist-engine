// SPDX-License-Identifier: AGPL-3.0-or-later
// MODULES DEPEND DOWNWARD THROUGH NAMED LAYERS, WITH NO CYCLES (ADR-0173, issue #167).
//
// The Dev: «o que garante que novos projetos não vão ser escrito com acoplamento se não houver ADR?» — a record, and this
// gate. 📏 Measured on 2026-09-13 over `app/js`: 141 modules, no cycle, and nine imports against the direction — listed
// below as a DEBT that only shrinks. `engine-boundary` already holds the engine↔game direction; this file holds the rest.
//
// 📌 The graph is read from the SOURCE (every `import … from`, `export … from`, `import type`, side-effect and dynamic
// `import()` of a relative path): a type-only import couples a lower layer to an upper one's shape just the same.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');

/** Bottom to top (ADR-0173 §1). `input` and `render` are peers: the same height, and they do not import each other. */
const ALTURA = { i18n: 0, core: 1, platform: 2, input: 3, render: 3, ui: 4, boot: 5 };
/** Outside the stack: curriculum data (§2), and the proof consumer, which imports what the package exports (§5). */
const FORA_DA_PILHA = new Set(['educational', 'consumer-quiz']);

/** The imports against the direction measured on 2026-09-13, each with its way out (issue #167). Only shrinks. */
const DIVIDA = {
  'core/entity.ts -> render/viz-axes.ts': 'a type: move `VisualState` down to core',
  'core/i18n.ts -> platform/storage.ts': 'the chosen language persists: inject the store, or move its pure half down',
  'core/state.ts -> platform/storage.ts': 'state persists: inject the store, or move its pure half down',
  'input/touch.ts -> render/minimap.ts': 'the pad corner moves the minimap: inject the setter',
  'render/viz-setters.ts -> ui/visual-axes-panel.ts': 'shared visual-axes data: move it down to render or core',
  'render/viz-setters.ts -> ui/simulation-refusal.ts': 'the refusal rule: move it down to core',
  'ui/activities-menu.ts -> educational/activities-registry.ts': 'curriculum reaches the menu: the platform passes it in',
};

function modulos() {
  const out = [];
  (function andar(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
    }
  })(RAIZ);
  return out;
}
const nome = (p) => relative(RAIZ, p).split(sep).join('/');
const camada = (m) => (m.includes('/') ? m.split('/')[0] : '(root)');

/** module → the local modules it imports. */
function grafo() {
  const g = new Map();
  const IMPORT = /(?:^|\s)(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;
  for (const p of modulos()) {
    const alvos = new Set();
    for (const m of readFileSync(p, 'utf8').matchAll(IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec?.startsWith('.')) continue;
      const alvo = resolve(dirname(p), spec).replace(/\.js$/, '.ts');
      if (existsSync(alvo)) alvos.add(nome(alvo));
    }
    g.set(nome(p), alvos);
  }
  return g;
}
const G = grafo();

function contraADirecao() {
  const out = [];
  for (const [de, alvos] of G) {
    const cd = camada(de);
    for (const para of alvos) {
      const cp = camada(para);
      if (cd === cp || cd === 'consumer-quiz') continue;
      const errado = cp === 'educational' || cd === 'educational'
        || (!FORA_DA_PILHA.has(cd) && !FORA_DA_PILHA.has(cp) && (ALTURA[cp] > ALTURA[cd] || (ALTURA[cp] === ALTURA[cd])));
      if (errado) out.push(`${de} -> ${para}`);
    }
  }
  return out.sort();
}

describe('the direction of dependencies (ADR-0173)', () => {
  it('[Interface] every layer on disk is named — a new folder cannot sit outside the rule', () => {
    const semLugar = [...new Set([...G.keys()].map(camada))].filter((c) => !(c in ALTURA) && !FORA_DA_PILHA.has(c));
    expect(semLugar, 'a layer with no height in ALTURA').toEqual([]);
    expect(G.size, 'the graph read almost nothing — the case would measure nothing').toBeGreaterThan(100);
  });

  it('🔴 [Right] no module cycle', () => {
    let i = 0; const ind = new Map(); const low = new Map(); const pilha = []; const na = new Set(); const ciclos = [];
    const forte = (v) => {
      ind.set(v, i); low.set(v, i); i++; pilha.push(v); na.add(v);
      for (const w of G.get(v) ?? []) {
        if (!G.has(w)) continue;
        if (!ind.has(w)) { forte(w); low.set(v, Math.min(low.get(v), low.get(w))); } else if (na.has(w)) low.set(v, Math.min(low.get(v), ind.get(w)));
      }
      if (low.get(v) === ind.get(v)) { const c = []; let w; do { w = pilha.pop(); na.delete(w); c.push(w); } while (w !== v); if (c.length > 1) ciclos.push(c.join(' ⇄ ')); }
    };
    for (const v of G.keys()) if (!ind.has(v)) forte(v);
    expect(ciclos).toEqual([]);
  });

  it('🔴 [Right] no import runs against the direction outside the named debt', () => {
    const novos = contraADirecao().filter((a) => !(a in DIVIDA));
    expect(novos, 'an import from a lower layer to a higher one (or between input and render, or touching educational)').toEqual([]);
  });

  it('🎯 [Zero] the debt holds no entry that is already paid — the list only shrinks', () => {
    const vivos = new Set(contraADirecao());
    expect(Object.keys(DIVIDA).filter((a) => !vivos.has(a)), 'paid debt still listed: delete it').toEqual([]);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   G1 a static import core → ui                    🔴 direction
//   G2 a debt entry deleted                         🔴 direction
//   G3 a paid debt still listed                     🔴 [Zero]
//   G4 a cycle (platform/storage ⇄ core/i18n)       🔴 cycle
//   G5 render → input, two peers                    🔴 direction
//   G6 a dynamic `import()` core → ui               🔴 direction
//   G7 an `export type … from` core → render        🔴 direction
//   G8 an engine layer importing educational        🔴 direction
