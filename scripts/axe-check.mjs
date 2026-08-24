// SPDX-License-Identifier: GPL-3.0-or-later
// a11y gate (#10) — runs axe-core against the RUNNING app (live DOM + CSS), the reliable method (cf. the old
// AUDITORIA-E13). Excludes the third-party VLibras widget. Fails (exit 1) on any WCAG A/AA violation in OUR app.
//
// Dev steps (Node runs on the Dev's machine / CI, not the sandbox):
//   npm i -D @axe-core/playwright
//   npm run build && npm run preview &            # serve dist/ (vite preview → http://localhost:4173/)
//   AXE_URL=http://localhost:4173/ node scripts/axe-check.mjs
// In CI: a job that builds, starts the preview, waits for it, then runs this script.
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const URL = process.env.AXE_URL || 'http://localhost:4173/';

const browser = await chromium.launch();
try {
  // @axe-core/playwright needs a page from an explicit context (browser.newPage() → "Please use browser.newContext()").
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  // let the a11y shell settle (fonts/DOM); the canvas render itself isn't axe-scannable — its a11y is the DOM shell.
  await page.waitForSelector('#sr-status', { timeout: 10_000 });

  // VLibras (gov.br, third-party, interim — pillar #2/#5) is excluded by DECISION: we do not control its
  // markup and the plan is our own zdog interpreter. Getting the exclusion right is subtler than it looks.
  //
  // The `[vw*]` attributes below are OUR mount point in index.html. The widget USED to render inside them;
  // it no longer does — `vlibras-plugin.js` appends `#vlibras-access-wrapper` directly to <body>, as a shadow
  // host, outside our div entirely. So those three selectors were excluding an empty container while the real
  // widget sailed straight into the report, and the gate failed on an <img> with no alt that is not ours.
  //
  // The lesson is which side of the boundary the selector belongs to: an exclusion must name the THIRD PARTY's
  // namespace, because that is what the third party is guaranteed to keep, not our markup, which they can stop
  // using without telling us. Hence the `[id^="vlibras-"]` prefix rather than the exact id — it survives them
  // renaming the wrapper, and it is still narrow enough that it can never hide a violation of ours.
  // The `[vw*]` selectors stay: the legacy markup is still in index.html and still theirs to render into.
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('[vw]')
    .exclude('[vw-access-button]')
    .exclude('[vw-plugin-wrapper]')
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
