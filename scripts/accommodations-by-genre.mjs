// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE CROSSING of the study in `docs/1-Discovery/study-accommodations-by-genre.md` (ADR-0145 §3).
//
// 🎯 EACH ACCOMMODATION HAS ONE KEY, AND ONLY ONE: an axis and the values of it where the accommodation has a subject.
// Each category declares, once, the values its games cover. A per-category list of accommodations (the Dev's
// correction) answered the same question many times and could answer it differently — `balancoDaCamara` sat under
// three categories when ONE axis governs it, the perspective, and `saidaDeAudio` under six when the player mode does.
// With one key, divergence is impossible by construction: there is no second cell to write a different answer in.
//
// 📌 AND THE AXES ARE OF TWO KINDS:
//   · the TAXONOMY's (`lib/taxonomy.mjs`) — genre, perspective, players: what the game IS;
//   · the DECLARATION's — tick, holds, input, world, topology: what the contract ALREADY ASKS every game
//     (`core/contract.ts`: `tick`, `holdsKeys()`, `needsPointer()`, `world()`, `topology()`). For these the accommodation
//     needs no genre: the engine can filter by what the game already declared.
//   · and four neither has yet (avatar, text, pieces, precision) — what phase 2c would have to add to the contract, if
//     the accommodations keyed by them come in.
//
// ⚠️ SEVEN GUARDS, and none is fussiness — each is a way for a forgotten cell to look like a decision:
//   1. category without a declaration · 2. declaration without a category · 3. empty axis or unknown value
//   4. accommodation without a key · 5. key on an axis that does not exist · 6. key with a value the axis does not have
//      (it would match ZERO categories, silently) · 7. keyed accommodation that reaches no category
//
//   node scripts/accommodations-by-genre.mjs [path-to-catalogue.html]
import { CATALOGO_PADRAO, lerCatalogo } from './lib/taxonomy.mjs';
import { U, EIXOS_DA_DECLARACAO, EIXOS_DERIVADOS, medir } from './lib/accommodations.mjs';

const categorias = lerCatalogo(process.argv[2] ?? CATALOGO_PADRAO, 'node scripts/accommodations-by-genre.mjs <minigames-catalog-v2.html>');
const { linhas, TOTAL, problemas } = medir(categorias);
if (problemas.length) { for (const p of problemas) console.error('⚠️ ' + p); process.exit(1); }

const nomeDaChave = (c) => (c === U ? 'universal' : `${c.eixo} ∈ ${c.valores.join('|')}`);
const pct = (n) => `${String(Math.round((n / TOTAL) * 100)).padStart(3)}%`;
console.log(`${categorias.length} categorias · ${TOTAL} jogos — cada acomodação com UMA chave\n`);
console.log('acomodação              tem?  categorias  jogos     %   chave');
console.log('─'.repeat(100));
for (const l of linhas) {
  console.log(`${l.k.padEnd(22)} ${l.tem ? ' sim' : ' NÃO'}     ${String(l.nGen).padStart(2)}/35    ${String(l.nJogos).padStart(3)}  ${pct(l.nJogos)}   ${nomeDaChave(l.chave)}`);
}
console.log('\n=== os eixos da DECLARAÇÃO, e de onde viriam ===');
for (const [eixo, e] of Object.entries({ ...EIXOS_DA_DECLARACAO, ...EIXOS_DERIVADOS })) {
  const usam = linhas.filter((l) => l.chave !== U && l.chave.eixo === eixo).map((l) => l.k);
  console.log(`  ${eixo.padEnd(9)} ${(e.fonte ?? '⚠️ o contrato ainda não pergunta').padEnd(46)} ${usam.join(', ') || '—'}`);
}
console.log('\n=== as que a engine NÃO tem, por alcance ===');
for (const l of linhas.filter((x) => !x.tem)) {
  console.log(`\n  ${l.k} — ${l.o}   [${nomeDaChave(l.chave)}]`);
  console.log(`     ${l.nGen} categorias · ${l.nJogos} jogos (${pct(l.nJogos).trim()})`);
  if (l.chave !== U) console.log(`     ${l.gens.join(' · ')}`);
}

if (process.env.ACOM_JSON) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.env.ACOM_JSON, JSON.stringify(Object.fromEntries(linhas.map((l) => [l.k, { gens: l.gens, nJogos: l.nJogos }])), null, 1));
}
