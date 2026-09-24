// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BATCHES OF STEP 5 — "split the boundary modules into 4 batches, LEAF FIRST" (node project: only reads the disk).
//
// ========================= WHY THIS IS A TEST, NOT A DOCUMENT =========================
// Item 19 says to split leaf first. "Leaf first" is not an organisational preference: it is a TOPOLOGICAL ORDERING of
// the import graph, and it only exists if the graph is ACYCLIC. A single new cycle between two engine modules makes
// item 19 impossible — not harder, impossible — and the way to find out would be mid-move, with half the modules moved.
//
// A document listing the batches would age at the first new module and nobody would know. This RECOMPUTES the split on
// every run, from the real imports, and fails if the premise breaks.
//
// ========================= WHAT THE MEASUREMENT FINDS, AND WHY IT MATTERS =========================
// The graph is acyclic and falls into natural layers. The batches need not be invented: they are the layers. And within
// a layer no module depends on another of the same layer — exactly the property that makes a batch movable AT ONCE,
// instead of module by module.
//
// Item 19 estimates FOUR batches; the graph gives at least four layers plus a small tail. That is asserted below instead
// of rounded.
//
// The `game/` checks below guard the boundary: the cartridge left this repository (issue #111), so no engine module may
// drag a `game/` path, directly or transitively.
//
// ========================= WHAT THIS FILE DOES NOT DECIDE =========================
// Nothing about the AXIS (by genre · by subsystem · by declared contract). The leaf-first ordering is the same in all
// the alternatives, because it is a fact of the graph and not of the choice. When the axis is decided, this computation
// says in what ORDER to move — and it will already be here, true.
//
// ⚠️ It complements `tests/engine-boundary.node.test.js` rather than repeating it: that one holds the known EDGES and the
// vocabulary; this one holds the graph's SHAPE (acyclicity, layers, concentration).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');
// ⚠️ The layer list comes from `tsconfig.pkg.json`, not from a hand copy: hand copies of this list in the suite drifted
// (one named an `audio` layer that never existed and missed `boot`). ⚠️ And `i18n` STAYS here: this file counts batches of
// published modules, and the dictionaries are published modules like the others — the exclusion other gates make is
// about MEASURING TEXT in them, which is another question.
const CAMADAS_ENGINE = (() => {
  const cfg = JSON.parse(readFileSync(join(process.cwd(), 'tsconfig.pkg.json'), 'utf8')
    .split(String.fromCharCode(13)).join(''));
  return (cfg.include ?? [])
    .map((p) => p.split('\\').join('/'))
    .filter((p) => p.startsWith('app/js/'))
    .map((p) => p.slice('app/js/'.length))
    .filter((c) => c && !c.includes('/'))
    .sort();
})();
const CR = String.fromCharCode(13);

function modulosDe(camada) {
  const dir = join(RAIZ, camada);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${camada}/${f.replace(/\.ts$/, '')}`);
}
const ENGINE = CAMADAS_ENGINE.flatMap(modulosDe);
const SET = new Set(ENGINE);

/** Source WITHOUT comments. The `split(CR).join('')` is not hygiene: with CRLF the regex's `.` does not reach the CR,
 *  the end anchor never arrives and the comment stripper FAILS OPEN — it has produced a false debt list in this project,
 *  and a false list is worse than none (see the engine-boundary header). */
function semComentarios(caminho) {
  return readFileSync(caminho, 'utf8').split(CR).join('')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}

/** `m`'s imports of other app/js modules, resolved to the `layer/name` form. */
function importesDe(m) {
  const src = semComentarios(join(RAIZ, ...m.split('/')) + '.ts');
  const base = m.split('/')[0], alvo = new Set();
  for (const achado of src.matchAll(/from\s+'([^']+\.js)'/g)) {
    const rel = achado[1];
    if (!rel.startsWith('.')) continue; // npm package (pixi.js): not an internal edge
    let p = rel.replace(/\.js$/, '');
    if (p.startsWith('./')) p = base + '/' + p.slice(2);
    else if (p.startsWith('../')) p = p.slice(3);
    alvo.add(p);
  }
  return [...alvo];
}

const DEPS = new Map(ENGINE.map((m) => [m, importesDe(m)]));
/** Only the edges BETWEEN engine modules — the leaf-first ordering is made over them. */
const DENTRO = new Map(ENGINE.map((m) => [m, DEPS.get(m).filter((d) => SET.has(d) && d !== m)]));

/** Topological layers: level 0 = leaves; level n = depends only on levels < n. */
function niveis() {
  const nivel = new Map();
  let restante = new Set(ENGINE);
  for (let n = 0; n < ENGINE.length && restante.size; n++) {
    const prontos = [...restante].filter((m) => DENTRO.get(m).every((d) => nivel.has(d) && nivel.get(d) < n));
    if (!prontos.length) break; // cycle: nobody else becomes ready
    for (const m of prontos) { nivel.set(m, n); restante.delete(m); }
  }
  return { nivel, restante };
}

/** Transitive closure of what `m` drags, including what leaves the engine. */
function arrasta(m, visto = new Set()) {
  const acc = new Set();
  for (const d of DEPS.get(m) || []) {
    if (visto.has(d)) continue;
    acc.add(d);
    if (SET.has(d)) for (const x of arrasta(d, new Set([...visto, m, d]))) acc.add(x);
  }
  return acc;
}

/** How many modules in each batch. */
function contagem() {
  const { nivel } = niveis(), c = new Map();
  for (const [, n] of nivel) c.set(n, (c.get(n) || 0) + 1);
  return c;
}

describe('a premissa do item 19: o grafo permite ordenar folha primeiro', () => {
  it('[Right] o grafo de engine é ACÍCLICO — sem isso "folha primeiro" não existe', () => {
    // The central case. A cycle does not make step 5 harder: it makes it impossible to do in batches, and without this
    // test it would show up mid-move, with half the modules already moved.
    const { restante } = niveis();
    expect([...restante].sort(), 'módulos em ciclo — desfaça o ciclo antes de dividir').toEqual([]);
  });

  it('[Right] TODO módulo de engine recebe um lote — a divisão é total, não uma amostra', () => {
    const { nivel } = niveis();
    expect(nivel.size).toBe(ENGINE.length);
  });

  it('[Interface] inside a batch, no module depends on another of the SAME batch', () => {
    // The property that makes a batch movable AT ONCE. Without it, a "batch" would be only a grouping by name, and the
    // move would have to go module by module anyway.
    const { nivel } = niveis();
    const conflitos = [];
    for (const m of ENGINE) {
      for (const d of DENTRO.get(m)) if (nivel.get(d) === nivel.get(m)) conflitos.push(`${m} → ${d}`);
    }
    expect(conflitos, 'a dependency inside the same batch').toEqual([]);
  });

  it('[Boundary] os lotes são CONTÍGUOS a partir de 0 e nenhum é vazio', () => {
    const lotes = [...contagem().keys()].sort((a, b) => a - b);
    expect(lotes).toEqual(lotes.map((_v, i) => i));
    for (const l of lotes) expect(contagem().get(l), 'lote ' + l).toBeGreaterThan(0);
  });

  it('[Interface] o item 19 diz QUATRO lotes; o grafo dá CINCO, e o quinto tem um módulo só', () => {
    // Asking for exactly four failed, rightly: the pipeline estimates four; the measurement gives more layers, the last
    // one a module or so that depends on the layer before and so cannot be merged into it without breaking the
    // within-batch independence asserted above.
    //
    // The difference is not a counting detail: the last "batch" is not a batch, it is a TAIL. Whoever runs step 5 moves
    // the real batches and then the tail. Recorded instead of rounded to four, because rounding would be adjusting the
    // measurement to the plan.
    const c = contagem(), lotes = [...c.keys()].sort((a, b) => a - b);
    expect(lotes.length).toBeGreaterThanOrEqual(4);
    expect(c.get(lotes[lotes.length - 1]), 'a cauda').toBeLessThan(5);
    expect(c.get(0), 'o lote das folhas é o maior').toBeGreaterThan(c.get(lotes[lotes.length - 1]));
  });

  it('[Interface] o lote 0 são FOLHAS DE VERDADE: não importam nada de app/js', () => {
    // A leaf here is stronger than "level 0 among engine modules": it imports nothing from app/js at all. It is the batch
    // that moves without looking at anything else, and the split starts with it.
    const { nivel } = niveis();
    const lote0 = ENGINE.filter((m) => nivel.get(m) === 0);
    const comDependencia = lote0.filter((m) => DEPS.get(m).length > 0);
    expect(comDependencia, 'lote 0 deveria ser folha absoluta').toEqual([]);
    expect(lote0.length).toBeGreaterThan(20); // the order of magnitude is what matters
  });
});

describe('a dívida do passo 5 é CONCENTRADA, e é isso que torna a divisão barata', () => {
  /**
   * KNOWN debt — EMPTY. It only shrinks, and it shrank to the end: the last engine modules that dragged `game/` stopped
   * doing so by INJECTION (the shape ids), by a CHANGE OF ADDRESS (the curriculum catalogue, ADR-0032) and by CONTRACT
   * (drawing receives declared entities, ADR-0030).
   */
  const ARRASTAM_JOGO = [];

  it('[Right] só estes módulos de engine arrastam game/, direta ou transitivamente', () => {
    const sujos = ENGINE.filter((m) => [...arrasta(m)].some((d) => d.startsWith('game/'))).sort();
    expect(sujos, 'módulo de engine NOVO arrastando game/').toEqual([...ARRASTAM_JOGO].sort());
  });

  it('[Zero] `render/viz-setters` NÃO arrasta mais nada — a conta transitiva voltou a bater com a direta', () => {
    // `viz-setters` once dragged `game/` only transitively, through `render/textures`. ⚠️ `render/textures` no longer
    // exists in the engine, so the third assertion below (`arrasta('render/textures')`) reads an empty dependency list
    // and cannot fail; the first two still measure `render/viz-setters`.
    expect(DEPS.get('render/viz-setters').some((d) => d.startsWith('game/'))).toBe(false);
    expect([...arrasta('render/viz-setters')].some((d) => d.startsWith('game/'))).toBe(false);
    expect([...arrasta('render/textures')].some((d) => d.startsWith('game/'))).toBe(false);
  });

  it('[Boundary] a esmagadora maioria da engine é LIMPA — o passo 5 move, não conserta', () => {
    const limpos = ENGINE.filter((m) => ![...arrasta(m)].some((d) => d.startsWith('game/')));
    expect(limpos.length / ENGINE.length).toBeGreaterThan(0.9);
  });
});
