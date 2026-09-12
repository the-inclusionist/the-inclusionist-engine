// SPDX-License-Identifier: AGPL-3.0-or-later
//
// O CRUZAMENTO do estudo de `docs/1-Discovery/estudo-acomodacoes-por-genero.md` (ADR-0145 §3).
//
// 🔴 RE-CHAVEADO EM 2026-09-12, depois da correcção do Dev. A primeira versão guardava, por categoria do
// catálogo, a LISTA de acomodações que lá tinham assunto — 35 listas escritas à mão. Com isso a mesma pergunta
// era respondida muitas vezes e podia ser respondida de formas diferentes: `balancoDaCamara` estava sob três
// categorias (Corrida, Pseudo-3D, Isométrico) quando o que o governa é UM eixo, a perspectiva; e `saidaDeAudio`
// sob seis, quando o que o governa é o modo de jogadores.
//
// 🎯 AGORA CADA ACOMODAÇÃO TEM UMA CHAVE, E UMA SÓ: um eixo e os valores dele onde ela tem assunto. Cada
// categoria declara, uma vez, os valores que os jogos dela cobrem. A divergência deixa de ser possível por
// construção — não há segunda célula onde escrever uma resposta diferente.
//
// 📌 E OS EIXOS SÃO DE DUAS ESPÉCIES, o que é o achado desta versão:
//   · os da TAXONOMIA (`lib/taxonomia.mjs`) — género, perspectiva, jogadores: o que o jogo É;
//   · os da DECLARAÇÃO — tick, segura, entrada, mundo, topologia: o que o contrato JÁ PERGUNTA a todo jogo
//     (`core/contract.ts`: `tick`, `seguraTeclas()`, `needsPointer()`, `world()`, `topology()`). Para estes, a acomodação
//     não precisa de género nenhum: a engine pode filtrar pelo que o jogo já declarou.
//   · e quatro que nenhum dos dois tem ainda (avatar, texto, peças, precisão) — são o que a fase 2c teria de
//     acrescentar ao contrato, se as acomodações chaveadas por eles entrarem.
//
// ⚠️ SETE GUARDAS, e nenhuma é zelo — cada uma é uma forma de uma célula esquecida parecer uma decisão:
//   1. categoria sem declaração · 2. declaração sem categoria · 3. eixo vazio ou valor desconhecido
//   4. acomodação sem chave · 5. chave num eixo que não existe · 6. chave com um valor que o eixo não tem
//      (casaria ZERO categorias, em silêncio) · 7. acomodação chaveada que não alcança categoria nenhuma
//
//   node scripts/acomodacoes-por-genero.mjs [caminho-do-catalogo.html]
import { CATALOGO_PADRAO, lerCatalogo } from './lib/taxonomia.mjs';
import { U, EIXOS_DA_DECLARACAO, EIXOS_DERIVADOS, medir } from './lib/acomodacoes.mjs';

const categorias = lerCatalogo(process.argv[2] ?? CATALOGO_PADRAO, 'node scripts/acomodacoes-por-genero.mjs <minigames-catalog-v2.html>');
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
