// SPDX-License-Identifier: AGPL-3.0-or-later
//
// A TAXONOMIA DE GÉNEROS — da lista da Wikipédia, e não do backlog do catálogo (ADR-0145, correcção do Dev).
//
// 🔴 A CORRECÇÃO QUE ORIGINOU ISTO, palavras do Dev em 2026-09-12: «Você está tomando uma lista de pesquisa
// rápida feita em uma tarde como a lista canônica de gênero para uma engine que será usada por milhões de
// pessoas». O estudo das acomodações tinha usado as 35 categorias do `minigames-catalog-v2.html` como chave de
// género — e elas são um BACKLOG DE PRODUÇÃO, não uma taxonomia.
//
// 📌 AS 35 CATEGORIAS PASSAM A SER A PROVA DE COBERTURA, e não a chave: os 380 jogos têm de caber na taxonomia.
//
// ⚠️ A TABELA MORA EM `lib/taxonomy.mjs`, partilhada com `accommodations-by-genre.mjs`: os dois scripts têm de
// ler o catálogo e chavear as categorias da mesma forma. Aqui ficam as GUARDAS e a contagem.
//
// ⚠️ SEIS GUARDAS, e nenhuma é zelo — cada uma é uma forma de uma célula esquecida parecer uma decisão:
//   1. uma categoria do catálogo SEM mapeamento
//   2. um mapeamento que nomeia uma secção que NÃO existe na revisão fixada
//   3. uma categoria sem género nenhum que NÃO diz porquê
//   4. um mapeamento a mais, que já não corresponde a categoria nenhuma do catálogo
//   5. um eixo (perspectiva, jogadores) VAZIO ou com um valor que não é dos conhecidos
//   6. uma categoria cujo NOME é um eixo e cujo eixo não o diz — «Isométrico» com duas perspectivas
//
//   node scripts/genre-taxonomy.mjs [caminho-do-catalogo.html]
import { CATALOGO_PADRAO, lerCatalogo, REVISAO, SECOES, RAZOES, EIXOS_DA_TAXONOMIA, MAPA } from './lib/taxonomy.mjs';

const categorias = lerCatalogo(process.argv[2] ?? CATALOGO_PADRAO, 'node scripts/genre-taxonomy.mjs <catalogo.html>');

/* ===================== as seis guardas ===================== */
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
  // 6 · o nome que É um eixo tem de o fixar num valor só; senão a categoria diz uma coisa e o dado outra.
  if (m.naoE === 'perspectiva' && m.perspectiva?.length !== 1) problemas.push(`${n}: é uma PERSPECTIVA e declara ${m.perspectiva?.length ?? 0}`);
  if (m.naoE === 'modo-de-jogadores' && String(m.jogadores) !== 'local') problemas.push(`${n}: é um MODO DE JOGADORES e não declara só «local»`);
  if (m.naoE === 'proposito' && !m.proposito.length) problemas.push(`${n}: é um PROPÓSITO e não declara nenhum`);
}
if (problemas.length) { for (const p of problemas) console.error('⚠️ ' + p); process.exit(1); }

/* ===================== contar ===================== */
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

console.log(`taxonomia: Wikipédia rev ${REVISAO.id} (${REVISAO.data})`);
console.log(`catálogo: ${categorias.length} categorias · ${TOTAL} jogos — ${categorias.length} de ${categorias.length} mapeadas\n`);
// ⚠️ A COLUNA NÃO É UMA PARTIÇÃO: uma categoria de dois géneros conta nos dois (RPG / Aventura cai em 5 e em
// 3). Dita aqui para ninguém somar a coluna e concluir que o catálogo tem mais jogos do que tem.
console.log('=== onde as categorias caem, por género de TOPO da página (com sobreposição) ===');
for (const t of Object.keys(porTopo).sort((a, b) => Number(a) - Number(b))) {
  const e = porTopo[t];
  console.log(`  ${t.padStart(2)} ${String(SECOES[t] ?? '').padEnd(28)} ${String(e.categorias.length).padStart(2)} categorias · ${String(e.jogos).padStart(3)} jogos`);
}
console.log(`\n=== ${naoGenero.length} categorias cujo NOME não é um género ===`);
for (const [n, m] of naoGenero) console.log(`  ${n.padEnd(26)} ${m.naoE.padEnd(18)} ${m.nota ?? ''}`);
console.log(`\n=== ${semGeneroNenhum.length} sem género nenhum a atribuir (${semGeneroNenhum.reduce((a, [n]) => a + jogosDe[n], 0)} jogos) ===`);
for (const [n, m] of semGeneroNenhum) console.log(`  ${n.padEnd(26)} ${jogosDe[n]} jogos · ${m.naoE}`);
console.log('\n=== os eixos que NÃO são género — alcance em jogos (com sobreposição) ===');
for (const eixo of Object.keys(EIXOS_DA_TAXONOMIA)) {
  const partes = [...EIXOS_DA_TAXONOMIA[eixo]].map((v) => {
    const j = Object.entries(MAPA).filter(([, m]) => m[eixo].includes(v)).reduce((a, [n]) => a + jogosDe[n], 0);
    return `${v} ${j}`;
  });
  console.log(`  ${eixo.padEnd(12)} ${partes.join(' · ')}`);
}
