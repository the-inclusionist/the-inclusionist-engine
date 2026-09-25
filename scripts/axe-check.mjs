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
// ⚠️ THE TARGET IS THE ENGINE'S PAGE, `quiz.html`, NOT THE ROOT: `app/index.html` left with the cartridge (issue #111)
// and `dist/` has no `index.html`. Pointed at `/`, the wait for `#sr-status` timed out with a raw `TimeoutError` — which
// says a selector did not appear, not that the PAGE does not exist. A gate red for the wrong reason is the worst way for
// a gate to fail.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

/** The page the ENGINE has. While it is the only one, it is the target — and the name is here, not in the workflow. */
const URL = process.env.AXE_URL || 'http://localhost:4173/quiz.html';

const browser = await chromium.launch();
try {
  // @axe-core/playwright needs a page from an explicit context (browser.newPage() → "Please use browser.newContext()").
  const context = await browser.newContext();
  const page = await context.newPage();
  const resposta = await page.goto(URL, { waitUntil: 'networkidle' });
  // ⚠️ THE HTTP STATUS IS READ BEFORE ANY SELECTOR. A page that does not exist returns 404 and then fails waiting for an
  // element — and the message left talks about the element. Asking about the address first makes the gate say what
  // really happened.
  if (resposta && !resposta.ok()) {
    console.error(`✗ axe: ${URL} answered ${resposta.status()}.`);
    console.error('  The target has to be a PAGE the build emits. `dist/` no longer has an `index.html` — it left');
    console.error('  with the cartridge (#111). Point AXE_URL at the engine\'s page, or build first.');
    process.exit(1);
  }
  // let the a11y shell settle (fonts/DOM); the canvas render itself isn't axe-scannable — its a11y is the DOM shell.
  try {
    await page.waitForSelector('#sr-status', { timeout: 10_000 });
  } catch {
    console.error(`✗ axe: ${URL} loaded, but has no \`#sr-status\`.`);
    console.error('  That is the screen-reader announcement, and the whole accessibility shell hangs on it:');
    console.error('  without it there is nothing to audit, and a green axe over a page with no shell proves nothing.');
    process.exit(1);
  }

  // VLibras (gov.br, third-party, interim — pillar #2/#5) is excluded by DECISION: we do not control its
  // markup and the plan is our own zdog interpreter. Getting the exclusion right is subtler than it looks.
  //
  // The lesson of this exclusion is WHICH SIDE OF THE BOUNDARY the selector lives on: an exclusion must name the THIRD
  // PARTY's namespace, because that is what the third party promises to keep — not our markup, which it may stop using
  // without notice. It did: `vlibras-plugin.js` hangs `#vlibras-access-wrapper` straight on `<body>`, as a shadow host,
  // so exclusions of our own mounting point hid an empty container while the real widget entered the report. Hence the
  // `[id^="vlibras-"]` prefix instead of the exact id: it survives them renaming the wrapper, and stays narrow enough to
  // never hide a violation of ours.
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
