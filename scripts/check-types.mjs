// SPDX-License-Identifier: AGPL-3.0-or-later
// O GATE DE TIPOS, com orçamento — e ele existe por causa de um erro operacional meu.
//
// ========================= O QUE ACONTECEU =========================
// Enquanto `main.js` era JavaScript, o `tsc` não o lia (`checkJs: false`) e `npm run typecheck` passava. No
// dia em que ele virou `main.ts` (commit 1aedb64), 277 erros ficaram visíveis de uma vez — o que era o
// OBJETIVO da conversão. O efeito colateral não foi objetivo nenhum: `npm run typecheck` é o SEGUNDO passo do
// job `test` do `.gitlab-ci.yml`, e um passo que falha aborta o job.
//
// Ou seja, desde aquele commit o CI parou de rodar `npm test`, `npm run build` E `npm run check:precache` —
// e o job de acessibilidade, que vem no estágio seguinte, também nunca chegou a rodar. O pipeline ficou
// vermelho por uma dívida CONHECIDA e, com isso, deixou de proteger contra as desconhecidas.
//
// ========================= POR QUE ORÇAMENTO, E NÃO "DESLIGA ATÉ ZERAR" =========================
// Duas saídas ruins estavam à mão. Deixar vermelho até a conversão terminar transforma o pipeline em ruído:
// um gate que está sempre vermelho é um gate que ninguém lê, e os outros quatro morrem junto. Tornar o
// `typecheck` não-bloqueante é afrouxar o gate para caber nele — a mesma coisa que este repositório já
// recusou no precache e na lista de exceções do item 14.
//
// A terceira saída é a que o projeto já usa em três outros lugares (fronteira, i18n de engine, fixtures): uma
// dívida NOMEADA que só pode encolher. O gate afirma duas coisas diferentes, e a primeira é a que importa:
//
//   1. FORA do `main.ts`, ZERO erros. Sem orçamento, sem tolerância. É o que garante que a conversão não está
//      empurrando erro para os vizinhos — e foi conferido a cada commit desta série.
//   2. DENTRO do `main.ts`, no máximo `ORCAMENTO`. Ele só desce. Quando chegar a zero, este arquivo inteiro
//      some e o `tsc --noEmit` volta a ser o gate direto, que é o estado final desejado.
import { execSync } from 'node:child_process';

/**
 * A dívida de tipos do composition root, em 2026-08-25.
 *
 * ⚠️ ESTE NÚMERO SÓ DESCE. Se um commit seu o faz subir, o commit está errado — não o número. Baixá-lo é
 * obrigatório sempre que a contagem real cair: um orçamento folgado deixa de medir qualquer coisa, e o gate
 * volta a ser decoração.
 */
const ORCAMENTO = 8;
const RAIZ_EM_CONVERSAO = 'app/js/main.ts';

let saida = '';
try {
  execSync('npx tsc --noEmit -p tsconfig.json', { stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  // `tsc` sai com código != 0 quando há erro — que é o caso esperado enquanto houver dívida.
  saida = String(e.stdout || '') + String(e.stderr || '');
}

const erros = saida.split('\n').filter((l) => / error TS\d+: /.test(l));
const fora = erros.filter((l) => !l.startsWith(RAIZ_EM_CONVERSAO));
const dentro = erros.length - fora.length;

/**
 * NOME QUE NAO EXISTE — e este e o unico codigo de erro sem orcamento em lugar nenhum, nem dentro do
 * `main.ts`. Aceito pelo Dev em 2026-08-25, e o motivo e uma medicao, nao uma preferencia:
 *
 * Os dois defeitos de acessibilidade consertados naquele dia sairam exatamente daqui. O `setModoCego`
 * guardava a atualizacao do painel com `typeof reflectModoCego === 'function'`, testando um nome LIVRE que
 * nao existe desde que a funcao mudou para `ui/settings-audio` — e `typeof` sobre identificador nao
 * declarado devolve 'undefined' em vez de lancar, entao a guarda era SEMPRE falsa. O botao do modo cego
 * passou a mentir o estado para o leitor de tela (WCAG 2.2 SC 4.1.2). O compilador viu isso no dia em que o
 * `main.js` virou `main.ts`, e a fila do orcamento o segurou 82 numeros atras.
 *
 * A DISTINCAO QUE JUSTIFICA A EXCECAO: TS7006 (parametro sem tipo) e DIVIDA DE ANOTACAO — o codigo funciona
 * e falta descreve-lo. TS2552/TS2304 e SEMPRE DEFEITO — o codigo cita algo que nao esta la. Orcamento serve
 * para divida; defeito nao entra em fila.
 */
const CODIGOS_SEM_ORCAMENTO = /error TS(2552|2304):/;
const nomesInexistentes = erros.filter((l) => CODIGOS_SEM_ORCAMENTO.test(l));

if (nomesInexistentes.length > 0) {
  console.error(`gate de tipos: ${nomesInexistentes.length} NOME(S) QUE NAO EXISTE(M) — sem orcamento, nem no ${RAIZ_EM_CONVERSAO}.`);
  console.error('TS2552/TS2304 nao e divida de anotacao, e defeito: o codigo cita algo que nao esta la.');
  for (const l of nomesInexistentes) console.error('  ' + l);
  process.exit(1);
}

if (fora.length > 0) {
  console.error(`gate de tipos: ${fora.length} erro(s) FORA de ${RAIZ_EM_CONVERSAO} — aqui não há orçamento.\n`);
  for (const l of fora.slice(0, 20)) console.error('  ' + l);
  if (fora.length > 20) console.error(`  … e mais ${fora.length - 20}`);
  process.exit(1);
}

if (dentro > ORCAMENTO) {
  console.error(`gate de tipos: ${RAIZ_EM_CONVERSAO} subiu de ${ORCAMENTO} para ${dentro} erros.`);
  console.error('A conversão anda para trás. Conserte o que subiu — não o orçamento.');
  process.exit(1);
}

if (dentro < ORCAMENTO) {
  console.error(`gate de tipos: ${dentro} erros, e o orçamento diz ${ORCAMENTO}. BAIXE o orçamento em`);
  console.error(`scripts/check-types.mjs para ${dentro} no mesmo commit — um número folgado não mede nada.`);
  process.exit(1);
}

console.log(`gate de tipos: 0 fora de ${RAIZ_EM_CONVERSAO}, ${dentro} dentro (orçamento ${ORCAMENTO}). Só desce.`);
