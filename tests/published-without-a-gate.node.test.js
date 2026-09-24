// SPDX-License-Identifier: AGPL-3.0-or-later
// PUBLISHED WITHOUT A GATE — the inventory of the modules the engine ships and that nothing here exercises.
//
// ========================= THE MEASUREMENT THAT ASKED FOR THIS FILE, AND THE ONE THAT UNDID IT =========================
// The first sweep compared the TEXT of the tests with the module names and accused five. It was false: `anel` matches
// inside `painel`, `speech` inside `interruptible-speech`. Redone through the IMPORT GRAPH — by specifier, one by one —,
// the list changed shape entirely. It stays written because it is the difference between a sieve and an alarm someone
// switches off.
//
// 📏 MEASURED ON 2026-09-08: 127 modules. FORTY had no internal importer at all, and that is **not a defect** — it is
// the architecture: the composition root is the cartridge, so a leaf the game wires on its own has no caller in here.
// Thirty-seven of the forty had a test. It is the INTERSECTION that matters.
//
// ⚠️ AND THE INTERSECTION CANNOT PRODUCE A FALSE ACCUSATION, which is why the sieve is this and not «módulo sem
// teste». A module with no internal importer is unreachable by a transitive path: if nothing in `app/js` imports it,
// no test reaches it except by importing it directly. So «no importer **and** no test» literally means «nobody here
// exercises it», and not «my detector did not see».
//
// 📌 `package.json` exports `./core/*.js`, `./input/*.js`, `./render/*.js`, `./platform/*.js`, `./ui/*.js`,
// `./educational/*.js` and `./i18n/*.js` — WILDCARDS. One of these modules is published the instant it exists. Being
// on this list means «the engine hands this to every game and has no way of knowing whether it broke».
//
// ⚠️ THE LIST HAS TO SHRINK: an entry leaves when its module gains a gate (as `platform/speech` did, `873618b`). A list
// that only grows is a monument.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_JS = fileURLToPath(new URL('../app/js/', import.meta.url));
const RAIZ_TESTES = fileURLToPath(new URL('./', import.meta.url));

/**
 * THE PUBLISHED MODULES THAT NOTHING HERE EXERCISES, and why each one is still so.
 *
 * ⚠️ A NEW entry without a hand-written reason is the engine publishing surface with no alarm, with nobody
 * deciding — which is exactly how these arrived.
 */
/*
 * 🔴 THE LIST IS EMPTY, AND THAT IS A PAYMENT, NOT A LOOSENING. Its last entry was `render/recycling-tex`, excused because
 * its only test lived in the CARTRIDGE's repository. ADR-0228 settled it: the module IS the cartridge's, and went there
 * with its test. The exemption disappeared because its subject disappeared, which is the only honest way for an
 * exception to leave a list.
 */
const SEM_GATE = {};

// ===== A varredura =====

/** Every `.ts` under `app/js`, except the ambient declarations (`*.d.ts`), which are not modules. */
function modulos(dir = RAIZ_JS, prefixo = '') {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) { saida.push(...modulos(caminho, `${prefixo}${nome}/`)); continue; }
    if (!nome.endsWith('.ts') || nome.endsWith('.d.ts')) continue;
    saida.push(`${prefixo}${nome.slice(0, -3)}`);
  }
  return saida;
}

/** Every test file, including helpers that do not end in `.test.js`. */
function ficheirosDeTeste(dir = RAIZ_TESTES) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) { saida.push(...ficheirosDeTeste(caminho)); continue; }
    if (/\.(js|ts|mjs)$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

const ESPECIFICADOR = /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]/g;
const especificadores = (src) => [...src.matchAll(ESPECIFICADOR)].map((m) => m[1] || m[2]);

const TODOS = modulos();

/** Module key (`ui/shell`) from a relative specifier seen inside `app/js/<from>`. */
function resolveInterno(de, spec) {
  if (!spec.startsWith('.')) return null;
  const base = posix.dirname(de);
  return posix.normalize(posix.join(base, spec)).replace(/\.js$/, '');
}

function medir() {
  const comImportador = new Set();
  for (const m of TODOS) {
    const src = readFileSync(join(RAIZ_JS, `${m}.ts`), 'utf8');
    for (const spec of especificadores(src)) {
      const alvo = resolveInterno(m, spec);
      if (alvo) comImportador.add(alvo);
    }
  }
  const comTeste = new Set();
  for (const f of ficheirosDeTeste()) {
    const src = readFileSync(f, 'utf8');
    for (const spec of especificadores(src)) {
      const i = spec.indexOf('app/js/');
      if (i === -1) continue;
      comTeste.add(spec.slice(i + 'app/js/'.length).replace(/\.js$/, ''));
    }
  }
  return TODOS.filter((m) => !comImportador.has(m) && !comTeste.has(m));
}

describe('publicado sem gate · o inventário encolhe, e uma entrada nova tem de ser declarada', () => {
  const achados = medir();

  // ⚠️ THE ENGINE HAS NO ROOT MODULE: in a CARTRIDGE the root is `app/js/main.ts` (and a `**` glob has hidden it before),
  // but the root of this `app/js` holds **only** `env.d.ts`. The case asserts what is true of this tree, including the
  // exclusion of the ambient declarations, which is a rule and not luck.
  it('[Vácuo] a varredura desce a árvore, e a declaração ambiente fica de fora', () => {
    expect(TODOS.length).toBeGreaterThan(100);
    expect(TODOS).toContain('boot/create-game');
    expect(TODOS).toContain('platform/speech');
    expect(TODOS).not.toContain('env.d');
  });

  it('[Feliz] nenhum módulo publicado ficou sem gate e sem razão escrita', () => {
    const novos = achados.filter((m) => !(m in SEM_GATE));
    expect(novos, `módulo publicado que ninguém aqui exercita e ninguém declarou: ${novos.join(', ')}`).toEqual([]);
  });

  // ⚠️ THE WAY OUT. Without this half the list becomes a monument: a fixed entry would keep saying there is a hole,
  // and the next person would read the whole list as history instead of state.
  it('[Fronteira] nenhuma entrada da lista já foi resolvida — se foi, sai daqui', () => {
    const resolvidas = Object.keys(SEM_GATE).filter((m) => !achados.includes(m));
    expect(resolvidas, `já tem gate (ou deixou de existir); apague a entrada: ${resolvidas.join(', ')}`).toEqual([]);
  });

  // 🎯 The case that proves the sieve measures what it says it measures, and not «módulo cujo nome não aparece num teste».
  it('[Fronteira] um módulo muito importado e nunca nomeado num teste NÃO é acusado', () => {
    // `core/entity` has many internal importers and no test imports it directly: it is exercised by a transitive
    // path, and accusing it would be the false accusation that gets a gate switched off.
    expect(achados).not.toContain('core/entity');
    expect(achados).not.toContain('core/dom-query');
  });

  it('[Fronteira] `platform/speech` saiu da lista e não pode voltar em silêncio', () => {
    expect(achados).not.toContain('platform/speech');
    expect(SEM_GATE).not.toHaveProperty('platform/speech');
  });
});

// ===== MUTATIONS CHECKED (2026-09-08) =====
// Each applied BY SCRIPT to the file, with the occurrence count asserted at exactly 1 — a `replace` with `\n` matches
// zero in CRLF and the mutation «sobrevive» without having been applied. And what is here is what was MEASURED, not what
// I predicted: four of the six failed different cases from the ones I had written.
//
// 1. renaming the key `render/recycling-tex` in `SEM_GATE`  → fails [Feliz] **and** the way-out [Fronteira]. The
//    second because the renamed key stops appearing in the findings — both halves working together.
// 2. adding `platform/speech` to `SEM_GATE`               → fails the way-out [Fronteira] and the speech case
// 3. removing the «sem importador interno» clause         → fails [Feliz] and the FALSE ACCUSATION case, which is
//    the proof that the intersection is the sieve and not a convenience
// 4. removing the «sem teste» clause                      → fails [Feliz] and the speech case
// 5. `medir()` returning `[]`                              → fails **only** the way-out [Fronteira]
//    🎯 IT IS THE MUTATION THAT MATTERS MOST: with the sieve blind, [Feliz] stays green forever — a blind sieve
//    approves everything. What catches it is the WAY-OUT half, and that is why it is not tidying.
// 6. counting only `*.test.js` as a test                  → SURVIVES. A MEASURED equivalence: today no helper in
//    `tests/` imports `app/js`. It stays recorded instead of erased — the detector's generosity is what prevents the
//    false accusation the day a helper appears.
