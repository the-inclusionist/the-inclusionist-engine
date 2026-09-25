// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE GENRE TAXONOMY — from Wikipedia's list, not from the catalogue's backlog (ADR-0145, the Dev's correction).
//
// 🔴 THE CORRECTION BEHIND THIS, in the Dev's words: «Você está tomando uma lista de pesquisa rápida feita em uma tarde
// como a lista canônica de gênero para uma engine que será usada por milhões de pessoas». The accommodations study had
// used the 35 categories of `minigames-catalog-v2.html` as the genre key — and they are a PRODUCTION BACKLOG, not a
// taxonomy.
//
// 📌 THE 35 CATEGORIES ARE THE COVERAGE PROOF, not the key: the catalogue's games have to fit the taxonomy.
//
// ⚠️ THE TABLE LIVES IN `lib/taxonomy.mjs`, shared with `accommodations-by-genre.mjs`: both scripts must read the
// catalogue and key the categories the same way. The GUARDS and the count stay here.
//
// ⚠️ SIX GUARDS, and none is fussiness — each is a way for a forgotten cell to look like a decision:
//   1. a catalogue category WITHOUT a mapping
//   2. a mapping that names a section that does NOT exist in the pinned revision
//   3. a category with no genre at all that does NOT say why
//   4. one mapping too many, which no longer matches any catalogue category
//   5. an axis (perspective, players) EMPTY or with a value that is not a known one
//   6. a category whose NAME is an axis and whose axis does not say so — «Isométrico» with two perspectives
//
//   node scripts/genre-taxonomy.mjs [path-to-catalogue.html]
import { CATALOGO_PADRAO, lerCatalogo, REVISAO, SECOES, RAZOES, EIXOS_DA_TAXONOMIA, MAPA } from './lib/taxonomy.mjs';

const categorias = lerCatalogo(process.argv[2] ?? CATALOGO_PADRAO, 'node scripts/genre-taxonomy.mjs <catalogo.html>');

/* ===================== the six guards ===================== */
const nomes = categorias.map((c) => c.nome);
const problemas = [];
for (const n of nomes) if (!(n in MAPA)) problemas.push(`categoria SEM mapeamento: ${n}`);
for (const n of Object.keys(MAPA)) if (!nomes.includes(n)) problemas.push(`mapeamento SEM categoria no catálogo: ${n}`);
for (const [n, m] of Object.entries(MAPA)) {
  for (const s of [...m.generos, ...m.proposito]) {
    if (!(s in SECOES)) problemas.push(`${n}: secção «${s}» NÃO existe na revisão ${REVISAO.id}`);
  }
  for (const s of m.proposito) if (!s.startsWith('11.')) problemas.push(`${n}: propósito «${s}» não é da secção 11 («by purpose»)`);
  if (!m.generos.length && !m.naoE) problemas.push(`${n}: sem género nenhum e sem dizer PORQUÊ`);
  if (m.naoE && !RAZOES.has(m.naoE)) problemas.push(`${n}: razão «${m.naoE}» não é uma das conhecidas`);
  for (const [eixo, validos] of Object.entries(EIXOS_DA_TAXONOMIA)) {
    const v = m[eixo];
    if (!Array.isArray(v) || !v.length) problemas.push(`${n}: eixo «${eixo}» vazio — toda categoria declara o seu`);
    else for (const x of v) if (!validos.has(x)) problemas.push(`${n}: «${x}» não é um valor de «${eixo}»`);
  }
  // 6 · a name that IS an axis must pin it to a single value; otherwise the category says one thing and the data another.
  if (m.naoE === 'perspectiva' && m.perspectiva?.length !== 1) problemas.push(`${n}: é uma PERSPECTIVA e declara ${m.perspectiva?.length ?? 0}`);
  if (m.naoE === 'modo-de-jogadores' && String(m.jogadores) !== 'local') problemas.push(`${n}: é um MODO DE JOGADORES e não declara só «local»`);
  if (m.naoE === 'proposito' && !m.proposito.length) problemas.push(`${n}: é um PROPÓSITO e não declara nenhum`);
}
if (problemas.length) { for (const p of problemas) console.error('⚠️ ' + p); process.exit(1); }

/* ===================== count ===================== */
const TOTAL = categorias.reduce((a, c) => a + c.jogos, 0);
const jogosDe = Object.fromEntries(categorias.map((c) => [c.nome, c.jogos]));
const topo = (s) => s.split('.')[0];
const porTopo = {};
for (const [n, m] of Object.entries(MAPA)) {
  for (const t of new Set(m.generos.map(topo))) {
    (porTopo[t] ??= { categorias: [], jogos: 0 }).categorias.push(n);
    porTopo[t].jogos += jogosDe[n];
  }
}
const naoGenero = Object.entries(MAPA).filter(([, m]) => m.naoE);
const semGeneroNenhum = Object.entries(MAPA).filter(([, m]) => !m.generos.length);

console.log(`taxonomy: Wikipedia rev ${REVISAO.id} (${REVISAO.data})`);
console.log(`catalogue: ${categorias.length} categories · ${TOTAL} games — ${categorias.length} of ${categorias.length} mapped\n`);
// ⚠️ THE COLUMN IS NOT A PARTITION: a category with two genres counts in both (RPG / Aventura falls in 5 and in 3).
// Said here so nobody adds up the column and concludes the catalogue has more games than it has.
console.log('=== where the categories fall, by the page\'s TOP-level genre (overlapping) ===');
for (const t of Object.keys(porTopo).sort((a, b) => Number(a) - Number(b))) {
  const e = porTopo[t];
  console.log(`  ${t.padStart(2)} ${String(SECOES[t] ?? '').padEnd(28)} ${String(e.categorias.length).padStart(2)} categories · ${String(e.jogos).padStart(3)} games`);
}
console.log(`\n=== ${naoGenero.length} categories whose NAME is not a genre ===`);
for (const [n, m] of naoGenero) console.log(`  ${n.padEnd(26)} ${m.naoE.padEnd(18)} ${m.nota ?? ''}`);
console.log(`\n=== ${semGeneroNenhum.length} with no genre at all to assign (${semGeneroNenhum.reduce((a, [n]) => a + jogosDe[n], 0)} games) ===`);
for (const [n, m] of semGeneroNenhum) console.log(`  ${n.padEnd(26)} ${jogosDe[n]} games · ${m.naoE}`);
console.log('\n=== the axes that are NOT genre — reach in games (overlapping) ===');
for (const eixo of Object.keys(EIXOS_DA_TAXONOMIA)) {
  const partes = [...EIXOS_DA_TAXONOMIA[eixo]].map((v) => {
    const j = Object.entries(MAPA).filter(([, m]) => m[eixo].includes(v)).reduce((a, [n]) => a + jogosDe[n], 0);
    return `${v} ${j}`;
  });
  console.log(`  ${eixo.padEnd(12)} ${partes.join(' · ')}`);
}
