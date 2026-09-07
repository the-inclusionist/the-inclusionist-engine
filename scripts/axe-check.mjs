// SPDX-License-Identifier: AGPL-3.0-or-later
// a11y gate (#10) — runs axe-core against the RUNNING app (live DOM + CSS), the reliable method (cf. the old
// AUDITORIA-E13). Excludes the third-party VLibras widget. Fails (exit 1) on any WCAG A/AA violation in OUR app.
//
// Dev steps (Node runs on the Dev's machine / CI, not the sandbox):
//   npm i -D @axe-core/playwright
//   npm run build && npm run preview &            # serve dist/ (vite preview → http://localhost:4173/)
//   AXE_URL=http://localhost:4173/quiz.html node scripts/axe-check.mjs
// In CI: a job that builds, starts the preview, waits for it, then runs this script.
//
// ⚠️ O ALVO DEIXOU DE SER A RAIZ EM 2026-09-07, e o motivo é o mesmo corte de sempre: o `app/index.html` saiu
// com o cartucho (issue #111) e `dist/` já não tem `index.html` nenhum. O gate continuou a apontar para `/`,
// o servidor respondeu o que respondeu, e a espera por `#sr-status` estourou aos 10 s com um `TimeoutError`
// cru — que diz que um seletor não apareceu, não que a PÁGINA já não existe. O CI ficou vermelho a dizer a
// coisa errada, que é a pior forma de um gate falhar.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

/** A página que a ENGINE tem. Enquanto ela for a única, é ela o alvo — e o nome está aqui, não no workflow. */
const URL = process.env.AXE_URL || 'http://localhost:4173/quiz.html';

const browser = await chromium.launch();
try {
  // @axe-core/playwright needs a page from an explicit context (browser.newPage() → "Please use browser.newContext()").
  const context = await browser.newContext();
  const page = await context.newPage();
  const resposta = await page.goto(URL, { waitUntil: 'networkidle' });
  // ⚠️ O ESTADO HTTP É LIDO ANTES DE QUALQUER SELETOR. Uma página que não existe devolve 404 e depois falha
  // à espera de um elemento — e a mensagem que sobra fala do elemento. Perguntar primeiro pelo endereço faz
  // o gate dizer o que realmente aconteceu.
  if (resposta && !resposta.ok()) {
    console.error(`✗ axe: ${URL} respondeu ${resposta.status()}.`);
    console.error('  O alvo tem de ser uma PÁGINA que o build emite. `dist/` já não tem `index.html` — ele saiu');
    console.error('  com o cartucho (#111). Aponte o AXE_URL para a página da engine, ou construa antes.');
    process.exit(1);
  }
  // let the a11y shell settle (fonts/DOM); the canvas render itself isn't axe-scannable — its a11y is the DOM shell.
  try {
    await page.waitForSelector('#sr-status', { timeout: 10_000 });
  } catch {
    console.error(`✗ axe: ${URL} carregou, mas não tem \`#sr-status\`.`);
    console.error('  Esse é o anúncio para leitor de tela, e a casca de acessibilidade inteira pendura-se nele:');
    console.error('  sem ele não há o que auditar, e um axe verde sobre uma página sem casca não prova nada.');
    process.exit(1);
  }

  // VLibras (gov.br, third-party, interim — pillar #2/#5) is excluded by DECISION: we do not control its
  // markup and the plan is our own zdog interpreter. Getting the exclusion right is subtler than it looks.
  //
  // A lição desta exclusão é de QUE LADO DA FRONTEIRA o seletor mora: uma exclusão tem de nomear o espaço de
  // nomes do TERCEIRO, porque é isso que o terceiro garante manter — e não a nossa marcação, que ele pode
  // deixar de usar sem avisar. Foi o que aconteceu: os `[vw*]` eram o NOSSO ponto de montagem, o widget
  // deixou de renderizar lá dentro (`vlibras-plugin.js` pendura `#vlibras-access-wrapper` direto no `<body>`,
  // como shadow host), e as três exclusões passaram a esconder um contêiner vazio enquanto o widget real
  // entrava no relatório. Daí o prefixo `[id^="vlibras-"]` em vez do id exacto: sobrevive a eles renomearem o
  // invólucro, e continua estreito o bastante para nunca esconder uma violação nossa.
  //
  // ⚠️ AS TRÊS `[vw*]` SAÍRAM em 2026-09-07: elas nomeavam marcação do `app/index.html`, que foi com o
  // cartucho (#111). A página da engine não monta o VLibras, então excluíam um seletor que não casa nada —
  // e uma exclusão que não casa nada é ruído que a próxima pessoa tem de investigar para descobrir que é
  // inofensiva.
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('[id^="vlibras-"]')
    .analyze();

  if (results.violations.length) {
    console.error(JSON.stringify(results.violations, null, 2));
    console.error(`\n✗ axe: ${results.violations.length} WCAG A/AA violation(s) in our app.`);
    process.exit(1);
  }
  console.log('✓ axe: 0 WCAG A/AA violations in our app (VLibras widget excluded).');
} finally {
  await browser.close();
}
