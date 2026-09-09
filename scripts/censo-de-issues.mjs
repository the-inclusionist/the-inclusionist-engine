// SPDX-License-Identifier: AGPL-3.0-or-later
// O CENSO DAS ISSUES — quantas são problemas resolvíveis por código, e quantas são livros (ADR-0126).
//
// ========================= POR QUE ISTO EXISTE, E POR QUE NÃO REPROVA =========================
// 📏 EM 2026-09-09 O DEV MEDIU-ME: das 33 issues abertas, DEZASSEIS não eram problemas de código, e das 126
// de sempre a mediana do corpo era 1499 caracteres com caixas de checklist em 14 delas — 11%. O instrumento
// que era o propósito inteiro («transformar planos em issues para facilitar a marcação das partes cumpridas»)
// estava em um décimo do tracker; a prosa estava em todo ele.
//
// ⚠️ E ELE TEVE DE O DESCOBRIR. Foi por isso que o ADR-0126 pediu um censo REPETÍVEL: um número que só
// aparece quando alguém desconfia é um número que chega tarde.
//
// 🛑 REPORTA E NÃO REPROVA, DE PROPÓSITO. A forma de um tracker não é coisa para segurar um build vermelho —
// não há commit que a conserte, e um gate permanentemente vermelho é um gate que alguém desliga (é a lição
// que o `check:annual-report` já carrega e a que a corrida cruzada do ADR-0123 pagou). Sai sempre 0.
//
// ⚠️ E ELE DIZ O QUE NÃO CONSEGUIU CLASSIFICAR. Um crivo que não olha para nada e imprime «está tudo bem» é
// pior do que crivo nenhum: o primeiro é lido como garantia.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const REPO = process.argv[2] ?? 'the-inclusionist/the-inclusionist-engine';

/** O orçamento do ADR-0126: uma issue é um item de checklist, não um livro. */
const ORCAMENTO_CHARS = 600;

/**
 * OS PADRÕES DE TÍTULO QUE DENUNCIAM UMA NÃO-ISSUE. ⚠️ São HEURÍSTICA e o relatório di-lo — o que é
 * mecânico é o TAMANHO e a CAIXA; isto é uma pista, e uma pista apresentada como medição é a forma de falso
 * relatório que este repositório já apanhou três vezes.
 */
// ⚠️ E O `[JOSÉ]` DIZ QUEM FAZ, NÃO O QUE É — a #9 («diagnosticar o erro do VLibras») é diagnóstico de
// campo cujo CONSERTO é código. A pista acerta na issue como está escrita e erraria se ela fosse reescrita
// como o defeito. É a razão de isto ser pista e não veredicto.
export const PISTAS = [
  [/^roadmap\b/i, 'fase de roadmap → `ROADMAP.md`'],
  [/^\[jos[ée]\]/i, 'trabalho de campo → `Test-Plan.md`'],
  [/^\[research\]|^research:/i, 'produz documento ou registo'],
  [/\bdecis[ãa]o\b|\bdecidir\b|^choose\b|\bde onde vem\b/i, 'decisão → um REGISTO, não uma issue'],
];

/** As caixas de checklist de um corpo. A metade que o ADR-0126 diz ser o propósito inteiro do tracker. */
export const contarCaixas = (corpoDaIssue) => (String(corpoDaIssue ?? '').match(/^\s*[-*]\s*\[[ xX]\]/gm) ?? []).length;

/** A pista que um título dá, ou `null`. Pura, para que um caso a conduza. */
export const pistaDoTitulo = (titulo) => PISTAS.find(([re]) => re.test(String(titulo ?? '')))?.[1] ?? null;

function issuesAbertas() {
  try {
    const out = execFileSync('gh', [
      'issue', 'list', '--repo', REPO, '--state', 'open', '--limit', '200',
      '--json', 'number,title,body',
    ], { encoding: 'utf8', maxBuffer: 1 << 28 });
    return JSON.parse(out);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}

// 🛑 O RUNNER SÓ CORRE QUANDO O FICHEIRO É EXECUTADO, nunca quando é IMPORTADO. Sem esta guarda, o caso
// que exercita as metades puras iria à REDE ao importar — e um teste que depende do `gh` é um teste que
// fica vermelho por causa de um token, que é como um gate deixa de ser lido.
function main() {
  const dados = issuesAbertas();

  // 🛑 DORMENTE E EM VOZ ALTA: sem `gh`, sem rede ou sem acesso, o censo não mediu NADA — e dizer «0 problemas»
  // aqui seria exactamente a mentira que o ficheiro existe para não contar. ⚠️ E um 404 sem autenticação não é
  // ausência: é falta de acesso, que já custou a este projecto um plano refeito em cima de um vazio.
  if (dados.erro) {
    console.log('censo de issues: DORMENTE — não consegui ler o tracker.');
    console.log(`  motivo: ${dados.erro.split('\n')[0]}`);
    console.log('  ⚠️ isto NÃO é «zero problemas»: é zero medições. Corra com `gh auth status` a passar.');
    process.exit(0);
  }

  const corpo = (i) => (i.body ?? '').replace(/\r/g, '');
  const caixas = (i) => contarCaixas(corpo(i));
  const pistaDe = (i) => pistaDoTitulo(i.title);

  const grandes = dados.filter((i) => corpo(i).length > ORCAMENTO_CHARS);
  const semCaixa = dados.filter((i) => caixas(i) === 0);
  const suspeitas = dados.map((i) => [i, pistaDe(i)]).filter(([, p]) => p);
  const tamanhos = dados.map((i) => corpo(i).length).sort((a, b) => a - b);
  const mediana = tamanhos.length ? tamanhos[Math.floor(tamanhos.length / 2)] : 0;

  console.log(`censo de issues · ${REPO}`);
  console.log(`  ABERTAS: ${dados.length}   mediana do corpo: ${mediana} chars   orçamento: ${ORCAMENTO_CHARS}`);
  console.log(`  📏 MECÂNICO — acima do orçamento: ${grandes.length}/${dados.length}` +
    `   ·   sem uma única caixa de checklist: ${semCaixa.length}/${dados.length}`);

  if (grandes.length) {
    console.log('\n  as maiores (o corpo tem de ser mais curto do que o commit que a fecha):');
    for (const i of [...grandes].sort((a, b) => corpo(b).length - corpo(a).length).slice(0, 8)) {
      console.log(`    #${String(i.number).padStart(3)} ${String(corpo(i).length).padStart(5)} chars · ${caixas(i)} caixas · ${i.title.slice(0, 58)}`);
    }
  }

  console.log(`\n  🔎 HEURÍSTICA (pista pelo TÍTULO, não medição): ${suspeitas.length} podem não ser problemas de código`);
  for (const [i, p] of suspeitas) console.log(`    #${String(i.number).padStart(3)} ${p} — ${i.title.slice(0, 52)}`);

  // 🎯 A METADE QUE SEPARA INVENTÁRIO DE MONUMENTO: dizer quantas NÃO foram classificadas. Sem esta linha, um
  // tracker inteiro de casos que a heurística não alcança sairia daqui com ar de aprovado.
  const naoClassificadas = dados.length - suspeitas.length;
  console.log(`\n  ⚠️ ${naoClassificadas} issues NÃO foram classificadas por nenhuma pista — a heurística lê TÍTULOS,`);
  console.log('     e uma decisão com título de tarefa passa-lhe ao lado. O número acima é um piso, não um total.');
  console.log('\n  (relatório: este comando nunca reprova — ver o cabeçalho e o ADR-0126)');
  return;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
