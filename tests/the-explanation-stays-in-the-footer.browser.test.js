// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EXPLANATION STAYS IN THE FOOTER — ALSO AFTER THE PANEL REDRAWS (ADR-0130 rule 2, ADR-0044 §7, issue #134).
//
// «The description belongs in the FOOTER — never a tooltip, never beside the menu item.» The record keeps this rule
// although ADR-0044 already decided it, because it is the rule with a record of failing: twice, in `settings-visual` and
// `settings-empathy`, the prose came back inside the rows on the first click after a redraw. It failed by memory, and a
// gate is what replaces memory.
//
// 📌 `a-panel-re-explains.node` holds the SOURCE half (a panel that rebuilds rows must call `fillExplain`); this is the
// BEHAVIOUR half, over every panel the quiz page mounts, by a loop and not by a list, under the real stylesheet. Each
// panel is read after the three ways a panel redraws: a press on each of its toggles, a language change with it open,
// and closing and reopening it. After each:
//   · no row shows prose — every `.opt-hint` inside a row is hidden;
//   · the card has ONE footer, `.opt-explain`, `aria-live`;
//   · a row the cursor reaches puts ITS explanation in that footer.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';
import { setLocale } from '../app/js/core/i18n.ts';

let regiao, cartao;
const esperar = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const offered = (el) => el.getClientRects().length > 0 && el.getAttribute('aria-disabled') !== 'true' && !el.disabled;

/** What is wrong with the card's footer rule right now, as sentences. */
function footerProblems(panel) {
  const card = panel.querySelector('.overlay__card');
  const out = [];
  const shown = [...card.querySelectorAll('.ctrl-row .opt-hint')].filter((h) => h.getClientRects().length > 0 && (h.textContent ?? '').trim());
  for (const h of shown) out.push(`#${panel.id}: prose beside a row — «${h.textContent.trim().slice(0, 40)}»`);
  const footers = card.querySelectorAll('.opt-explain');
  if (footers.length !== 1) out.push(`#${panel.id}: ${footers.length} footers`);
  else if (footers[0].getAttribute('aria-live') !== 'polite') out.push(`#${panel.id}: the footer is not announced`);
  // a row the cursor reaches explains itself in the footer
  const row = [...card.querySelectorAll('.ctrl-row')].find((r) => r.dataset.explain && offered(r));
  if (row && footers.length === 1) {
    row.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    if (footers[0].textContent !== row.dataset.explain) out.push(`#${panel.id}: the footer did not take the reached row's explanation`);
    row.dispatchEvent(new MouseEvent('mouseleave'));
  }
  return out;
}
const panelsOfTheList = () => [...cartao.querySelectorAll('.pause-menu[data-sub="opcoes"] .pm-btn')].map((b) => b.dataset.act).filter((a) => a !== 'pmback');
const openPanel = () => [...regiao.querySelectorAll('.overlay')].find((o) => !o.hidden);
async function open(act) {
  cartao.querySelector(`.pm-btn[data-act="${act}"]`).click();
  await esperar();
  return openPanel();
}
function close(panel) { panel.querySelector('.overlay__back')?.click(); }

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  document.querySelector('.stage-wrap').style.cssText = 'width:700px;height:420px;display:flex;flex:none';
  (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window });
  await esperar(120);
  regiao = document.getElementById('game-region');
  regiao.focus();
  regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true, cancelable: true }));
  await esperar(120);
  cartao = [...document.querySelectorAll('.screen-pause')].find((e) => !e.hidden);
  cartao.querySelector('.pm-btn[data-act="options"]').click();
  await esperar();
});
afterAll(async () => { await setLocale('pt'); });

describe('the explanation stays in the footer after a redraw', () => {
  it('🎯 [Right] the sieve reaches the settings panels, and they have rows that explain themselves', async () => {
    const acts = panelsOfTheList();
    expect(acts.length, 'the settings list is empty — the case would measure nothing').toBeGreaterThan(4);
    let explained = 0;
    for (const act of acts) {
      const p = await open(act);
      expect(p, `«${act}» opened no panel`).toBeTruthy();
      explained += p.querySelectorAll('.ctrl-row[data-explain]').length;
      close(p);
      await esperar(20);
    }
    expect(explained, 'no row carries an explanation — the footer half would measure nothing').toBeGreaterThan(10);
  });

  it('🔴 [Right] after a press on each of its toggles, every panel keeps the prose in the footer', async () => {
    const found = [];
    let presses = 0;
    for (const act of panelsOfTheList()) {
      const p = await open(act);
      for (const b of [...p.querySelectorAll('.overlay__card [aria-pressed]')]) {
        if (!offered(b)) continue;
        b.click(); // twice, so the child's settings come out as they went in
        b.click();
        presses++;
      }
      await esperar(20);
      found.push(...footerProblems(p));
      close(p);
      await esperar(20);
    }
    expect(presses, 'no toggle pressed — the redraw half would measure nothing').toBeGreaterThan(5);
    expect(found.join('\n')).toBe('');
  });

  it('🔴 [Right] after a language change with the panel open, every panel keeps the prose in the footer', async () => {
    const found = [];
    for (const act of panelsOfTheList()) {
      const p = await open(act);
      await setLocale('en');
      await esperar(120);
      found.push(...footerProblems(p).map((s) => `(en) ${s}`));
      await setLocale('pt');
      await esperar(120);
      found.push(...footerProblems(p).map((s) => `(pt) ${s}`));
      close(p);
      await esperar(20);
    }
    expect(found.join('\n')).toBe('');
  });

  it('🔴 [Right] a row BORN during the redraw puts its prose in the footer too — the case the defect came back by', async () => {
    // The two recorded failures were rows rebuilt by a render with the `.opt-hint` back inside them. Here each panel loses
    // its explained rows and is redrawn open (a language change): whatever rows its render builds again are new nodes,
    // born after the panel opened — and their prose must still land in the footer.
    const found = [];
    let reborn = 0;
    for (const act of panelsOfTheList()) {
      const p = await open(act);
      // the rows a panel's render builds when they are missing: a label row of the kit (a `<strong>` and a control with an id).
      // ⚠️ Removing a row is the TRIGGER, not a path a child takes — it stands for a render that rebuilds rows by markup.
      const gone = [...p.querySelectorAll('.overlay__card .ctrl-row[data-explain]')].filter((r) => r.querySelector(':scope > span > strong') && r.querySelector('[id]'));
      const ids = gone.map((r) => r.querySelector('[id]').id);
      for (const r of gone) r.remove();
      await setLocale('en');
      await esperar(120);
      reborn += ids.filter((id) => p.querySelector(`#${CSS.escape(id)}`)).length;
      found.push(...footerProblems(p).map((s) => `(en) ${s}`));
      await setLocale('pt');
      await esperar(120);
      close(p);
      await esperar(20);
    }
    expect(reborn, 'no panel rebuilt a row it lost — the case would measure nothing').toBeGreaterThan(3);
    expect(found.join('\n')).toBe('');
  });

  it('🔴 [Right] closed and reopened, every panel keeps the prose in the footer', async () => {
    const found = [];
    for (const act of panelsOfTheList()) {
      close(await open(act));
      await esperar(20);
      const p = await open(act);
      found.push(...footerProblems(p));
      close(p);
      await esperar(20);
    }
    expect(found.join('\n')).toBe('');
  });
});

/*
 * MUTATIONS CHECKED (applied by script, restored from a copy):
 *   · `fillExplain` leaving the hint beside the row instead of hiding it → the press, language and reopen cases red.
 *   · the footer without `aria-live` → the same three red.
 *   · `settings-visual` and `settings-audio` without their `fillExplain` after a render → the reborn-row case red.
 *   · `settings-motion` without it SURVIVES: its render does not rebuild a label row it lost, so nothing is born to
 *     explain — the source gate (`a-panel-re-explains.node`) is what keeps that call required.
 */