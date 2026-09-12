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
// ⚠️ E A PÁGINA ESTÁ FIXADA NUMA REVISÃO. Uma taxonomia tirada de uma wiki que muda todos os dias sem dizer de
// que dia é seria uma lista que um dia deixa de concordar consigo mesma, sem nada que o diga.
//
// ⚠️ QUATRO GUARDAS, e nenhuma é zelo — cada uma é uma forma de uma célula esquecida parecer uma decisão:
//   1. uma categoria do catálogo SEM mapeamento
//   2. um mapeamento que nomeia uma secção que NÃO existe na revisão fixada
//   3. uma categoria sem género nenhum que NÃO diz porquê
//   4. um mapeamento a mais, que já não corresponde a categoria nenhuma do catálogo
//
//   node scripts/taxonomia-de-generos.mjs [caminho-do-catalogo.html]
import { readFileSync, existsSync } from 'node:fs';

const CATALOGO = process.argv[2] ?? 'C:/Users/candi/Claude/minigames-catalog-v2.html';
if (!existsSync(CATALOGO)) {
  console.error(`catálogo não encontrado: ${CATALOGO}\npasse o caminho: node scripts/taxonomia-de-generos.mjs <catalogo.html>`);
  process.exit(2);
}

/* ===================== A TAXONOMIA, FIXADA =====================
 * `https://en.wikipedia.org/wiki/List_of_video_game_genres`, revisão 1367745358 de 2026-08-04T23:25:35Z.
 * Só as secções que o mapeamento abaixo usa, com o NÚMERO de secção da própria página — para que cada linha
 * possa ser conferida à mão contra a revisão, sem interpretação no meio.
 *
 * 📌 AS SECÇÕES 11 («por propósito») E 12 («sandbox / mundo aberto») estão aqui, mas o 11 NÃO é tratado como
 * género: a própria página o separa, e é o mesmo corte que a correcção do Dev pediu.
 */
const REVISAO = { id: 1367745358, data: '2026-08-04T23:25:35Z' };
const SECOES = Object.freeze({
  '1': 'Action', '1.1': 'Platform games', '1.2': 'Shooter games', '1.2.1': 'First-person shooters',
  '1.3': 'Fighting games', '1.5': 'Stealth games', '1.7': 'Rhythm games',
  '2': 'Action-adventure', '2.1': 'Survival horror',
  '8': 'Sports', '10': 'Other notable genres', '11': 'Video game genres by purpose', '12': 'Sandbox / open world games',
  '3': 'Adventure', '3.2': 'Graphic adventures', '3.3': 'Visual novels',
  '4': 'Puzzle', '4.2': 'Logical game', '4.2.1': 'Physics game', '4.3': 'Hidden object game',
  '4.6': 'Traditional puzzle game',
  '5': 'Role-playing',
  '6': 'Simulation', '6.1': 'Construction and management simulation',
  '7': 'Strategy',
  '8.1': 'Racing', '8.2': 'Sports game',
  '10.1': 'Board game or card game', '10.2': 'Casino game', '10.6': 'Horror game', '10.7': 'Idle game',
  '10.8': 'Party game', '10.11': 'Trivia game', '10.12': 'Typing game',
  '11.2': 'Art game', '11.5': 'Educational game',
  '12.1': 'Sandbox', '12.2': 'Creative',
});
/** O que um género é NÃO sendo: os eixos que a correcção do Dev separou. */
const RAZOES = new Set(['era', 'tecnica-de-render', 'perspectiva', 'modo-de-jogadores', 'mecanica', 'proposito', 'multigenero']);

/* ===================== AS 35 CATEGORIAS → A TAXONOMIA =====================
 * `generos` = secções da Wikipédia. `naoE` = o que a categoria é, quando o NOME dela não é um género.
 * `eixos` = perspectiva / modo de jogadores / propósito, que o estudo tinha misturado com género.
 *
 * ⚠️ ISTO É JUÍZO, e está escrito como dado para poder ser discordado linha a linha: editar uma entrada e voltar
 * a correr é mais honesto do que discutir uma tabela em prosa.
 */
const MAPA = {
  'Arcade Clássico': { generos: ['1'], naoE: 'era', nota: 'uma ÉPOCA; os jogos dela são, na maioria, acção' },
  'Shooters / Tiros': { generos: ['1.2'] },
  'Endless Runner': { generos: ['1.1'] },
  'Puzzle Lógico': { generos: ['4.2'] },
  'Puzzle de Palavras': { generos: ['4'], nota: 'a página não tem subsecção de palavras; fica no Puzzle de topo' },
  'Puzzle Físico': { generos: ['4.2.1'] },
  'Memória': { generos: ['4.6'] },
  'Platformer': { generos: ['1.1'] },
  'Corrida / Racing': { generos: ['8.1'] },
  'Esportes': { generos: ['8.2'] },
  'Cartas': { generos: ['10.1'] },
  'Tabuleiro': { generos: ['10.1'] },
  'Cassino / Sorte': { generos: ['10.2'] },
  'Simulação / Idle': { generos: ['6', '10.7'] },
  'RPG / Aventura': { generos: ['5', '3'] },
  'Estratégia': { generos: ['7'] },
  'Ritmo / Música': { generos: ['1.7'] },
  'Digitação': { generos: ['10.12'] },
  'Desenho / Criativo': { generos: ['12.2'] },
  'Educativo / Quiz': { generos: ['10.11'], eixos: { proposito: '11.5' }, nota: 'metade GÉNERO (quiz), metade PROPÓSITO (educativo)' },
  'Reação / Reflexo': { generos: ['1'], naoE: 'mecanica', nota: 'reagir depressa é uma MECÂNICA que atravessa géneros' },
  'Party / Microgames': { generos: ['10.8'], eixos: { modoDeJogadores: 'local' } },
  'Stealth / Furtivo': { generos: ['1.5'] },
  'Luta / Fighting': { generos: ['1.3'] },
  'Terror / Atmosfera': { generos: ['10.6', '2.1'] },
  'Sandbox / Sim Físico': { generos: ['12.1', '4.2.1'] },
  'Pseudo-3D / Raycasting': { generos: ['1.2.1'], naoE: 'tecnica-de-render', eixos: { perspectiva: 'primeira-pessoa' }, nota: 'uma TÉCNICA; os raycasters são quase todos tiro em 1.ª pessoa' },
  'Isométrico': { generos: ['5', '7'], naoE: 'perspectiva', eixos: { perspectiva: 'isometrica' }, nota: 'uma PERSPECTIVA; os isométricos são quase todos RPG e estratégia' },
  'Multiplayer Local': { generos: [], naoE: 'modo-de-jogadores', eixos: { modoDeJogadores: 'local' }, nota: 'um MODO DE JOGADORES que atravessa qualquer género' },
  'Experimentais / Arte': { generos: [], naoE: 'proposito', eixos: { proposito: '11.2' }, nota: 'a própria página põe «art game» em «por propósito»' },
  'Cozinha Produção': { generos: ['6.1'] },
  'Point-and-Click / Hidden': { generos: ['3.2', '4.3'] },
  'Narrativo Detetive': { generos: ['3', '3.3'] },
  'Labirinto Exploração': { generos: ['1'], naoE: 'mecanica', nota: 'o labirinto é uma MECÂNICA; a página não lista «maze» como género' },
  'Híbridos / Mashups': { generos: [], naoE: 'multigenero', nota: 'multi-género POR DEFINIÇÃO — não há género único a atribuir' },
};

/* ===================== ler o catálogo — o MESMO leitor de `acomodacoes-por-genero.mjs` ===================== */
// ⚠️ Copiado verbatim de propósito: os dois scripts têm de ler o catálogo da mesma forma, senão um conta 380
// jogos e o outro 379 e ninguém sabe qual está certo.
const html = readFileSync(CATALOGO, 'utf8');
const limpo = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const categorias = [...html.matchAll(/<article class="card[^"]*"[\s\S]*?<\/article>/g)].map((m) => ({
  nome: limpo((m[0].match(/<h3[^>]*class="card-title"[^>]*>([\s\S]*?)<\/h3>/) ?? [, ''])[1]),
  jogos: [...m[0].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].length,
}));
if (!categorias.length) { console.error('nenhuma categoria lida — o markup do catálogo mudou?'); process.exit(2); }

/* ===================== as quatro guardas ===================== */
const nomes = categorias.map((c) => c.nome);
const problemas = [];
for (const n of nomes) if (!(n in MAPA)) problemas.push(`categoria SEM mapeamento: ${n}`);
for (const n of Object.keys(MAPA)) if (!nomes.includes(n)) problemas.push(`mapeamento SEM categoria no catálogo: ${n}`);
for (const [n, m] of Object.entries(MAPA)) {
  for (const s of [...m.generos, ...Object.values(m.eixos ?? {}).filter((v) => /^\d/.test(v))]) {
    if (!(s in SECOES)) problemas.push(`${n}: secção «${s}» NÃO existe na revisão ${REVISAO.id}`);
  }
  if (!m.generos.length && !m.naoE) problemas.push(`${n}: sem género nenhum e sem dizer PORQUÊ`);
  if (m.naoE && !RAZOES.has(m.naoE)) problemas.push(`${n}: razão «${m.naoE}» não é uma das conhecidas`);
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
