// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A SCREEN READER IS HANDED, read from the BROWSER'S accessibility tree and not from the DOM (the Dev with NVDA, 2026-09-25).
//
// 🔴 The Dev heard the demo quiz with NVDA as «Pular para o jogo. Comando de voz: desligado. Qual animal põe ovos e tem bico?
// TEMPO. 56:07.» — the session clock read as its raw label and digits. The clock's own gate (`session-clock.browser`) was green
// the whole time: it asks the DOM for `role="img"` and an `aria-label`, and both were there. What it could not see is that the
// picture's PARTS were exposed as well — two text nodes under the image — and an accessibility API that does not prune them
// (Gecko exposes a graphic's children unless it has exactly one text child) hands the reader «TEMPO» and «56:07» instead of the
// words. Only the tree the browser builds says that, so this file reads that tree, through the DevTools protocol.
//
// Three demands, each on the tree of the real quiz page booted through `createGame`:
//   · the five options are radios in the «Alternativas» group, named by their words, none pruned;
//   · every icon the quick bar shows is a button named by its label, none pruned;
//   · the clock is ONE image whose name is words (no «mm:ss»), with nothing exposed beneath it.
//
// 📌 Chromium's tree before platform pruning (`Accessibility.getFullAXTree`): what it exposes under a node is what an API that
// does not prune — Gecko's, for a graphic with several children — hands the reader. A node is «exposed» when it is not
// ignored; `inert`, `aria-hidden` and `hidden` all make it ignored, so each case also stands for «nothing pruned it».
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import { cdp } from 'vitest/browser';
import pagina from '../app/quiz.html?raw';
import css from '../app/css/style.css?raw';
import { openSkill } from './fixtures/quiz-page.js';
import { THREE_SKILLS } from './fixtures/quiz-skills.js';

/** This file's frame: the tests run in an iframe of the tester page, and the CDP session belongs to the page. */
async function ownFrameId(session) {
  const { frameTree } = await session.send('Page.getFrameTree');
  const frames = [];
  const walk = (f) => { frames.push(f.frame); (f.childFrames ?? []).forEach(walk); };
  walk(frameTree);
  const mine = frames.find((f) => f.url === location.href);
  expect(mine, 'this file\'s frame is not in the page\'s frame tree — the case would read another document').toBeTruthy();
  return mine.id;
}

/** The accessibility tree of this file's document, as the browser built it now. */
async function accessibilityTree() {
  const session = cdp();
  await session.send('Accessibility.enable');
  const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId: await ownFrameId(session) });
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const role = (n) => n.role?.value ?? '';
  const name = (n) => String(n.name?.value ?? '');
  const exposed = nodes.filter((n) => !n.ignored);
  /** Every exposed node under `n`, at any depth — an ignored node in between hides nothing below it by itself. */
  const exposedUnder = (n) => {
    const out = [];
    const visit = (id) => { const c = byId.get(id); if (!c) return; if (!c.ignored && role(c) !== 'InlineTextBox') out.push(c); (c.childIds ?? []).forEach(visit); };
    (n.childIds ?? []).forEach(visit);
    return out;
  };
  const describe = (list) => list.map((n) => `${role(n)} «${name(n)}»`).join(', ') || '(none)';
  return { nodes, exposed, role, name, exposedUnder, describe };
}

/** Waits for the next painted frame: the tree follows layout. */
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

beforeAll(async () => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  // the quiz page's own boot, which hands its document and window to `createGame` (ADR-0232 D4)
  (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window, skills: THREE_SKILLS });
  // the quiz opens on its start screen since it became a test bench: into the first skill, as a pointer does
  await openSkill(document, 0);
  await frame();
  await frame();
});

describe('the quiz, as the browser hands it to a screen reader', () => {
  it('🔴 [Right] the five options are exposed as radios of «Alternativas», each named by its words', async () => {
    const words = [...document.querySelectorAll('.quiz-alt')].map((b) => b.textContent.trim());
    expect(words.length, 'no options on the page — the case would measure nothing').toBe(5);
    const ax = await accessibilityTree();
    const group = ax.exposed.filter((n) => ax.role(n) === 'radiogroup');
    expect(group.length, `the options' group is not exposed; exposed: ${ax.describe(ax.exposed.filter((n) => /radio/.test(ax.role(n))))}`).toBe(1);
    const radios = ax.exposedUnder(group[0]).filter((n) => ax.role(n) === 'radio');
    expect(radios.map(ax.name), `the group «${ax.name(group[0])}» exposes: ${ax.describe(ax.exposedUnder(group[0]))}`).toEqual(words);
  });

  it('🔴 [Right] every icon the quick bar shows is exposed as a button named by its label', async () => {
    const labels = [...document.querySelectorAll('#title-icons .pi-btn')].filter((b) => !b.hidden).map((b) => b.getAttribute('aria-label'));
    expect(labels.length, 'the bar shows fewer icons than the quiz mounts — the case would measure little').toBeGreaterThanOrEqual(10);
    const ax = await accessibilityTree();
    const buttons = ax.exposed.filter((n) => ax.role(n) === 'button').map(ax.name);
    const missing = labels.filter((l) => !buttons.includes(l));
    expect(missing, `icons a screen reader is not handed; exposed buttons: ${buttons.join(' | ')}`).toEqual([]);
  });

  it('🔴 [Right] the session clock is ONE image whose name is words, and nothing beneath it is exposed', async () => {
    const clock = document.querySelector('.session-clock');
    expect(clock, 'no session clock on the page — the case would measure nothing').not.toBeNull();
    const digits = document.querySelector('.session-clock-digits')?.textContent ?? '';
    const label = document.querySelector('.session-clock-label')?.textContent ?? '';
    expect(digits, 'the clock shows no digits — the case could not tell them from its name').toMatch(/\d:\d\d/);
    const ax = await accessibilityTree();
    // two pictures in the HUD row since the test bench: the clock and the skill's ten-segment bar, each ONE image named by words
    const bar = document.querySelector('.hud-row .hud-barra');
    const images = ax.exposed.filter((n) => ax.role(n) === 'image');
    expect(images.map(ax.name).sort(), `images exposed: ${ax.describe(images)}`).toEqual([clock.getAttribute('aria-label'), bar?.getAttribute('aria-label')].sort());
    const clockImage = images.find((n) => ax.name(n) === clock.getAttribute('aria-label'));
    const name = ax.name(clockImage);
    expect(name, 'the image\'s name is not the clock\'s words').toBe(clock.getAttribute('aria-label'));
    expect(name, 'the name reads the digits instead of words').not.toMatch(/\d:\d\d/);
    expect(name, 'the name has no words').toMatch(/\p{L}{3,}/u);
    // 🔴 the defect the Dev heard: the picture's parts handed to the reader as text
    expect(ax.describe(ax.exposedUnder(clockImage)), 'the clock\'s parts are exposed under the image — a reader that does not prune reads them').toBe('(none)');
    const leaks = ax.exposed.filter((n) => ax.role(n) === 'StaticText' && [digits, label].includes(ax.name(n).trim()));
    expect(ax.describe(leaks), 'the clock\'s label or digits are exposed as text somewhere').toBe('(none)');
  });

  it('📌 [Inverse] the demands can fail: an option made inert is no longer exposed', async () => {
    // the case above would be green for a tree that never lists anything; this one shows the reading sees a pruned node go
    const option = document.querySelector('.quiz-alt');
    option.inert = true;
    try {
      await frame();
      const ax = await accessibilityTree();
      const group = ax.exposed.find((n) => ax.role(n) === 'radiogroup');
      expect(ax.exposedUnder(group).filter((n) => ax.role(n) === 'radio').map(ax.name)).not.toContain(option.textContent.trim());
    } finally {
      option.inert = false;
    }
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Applied by script to the source, the file run, the source restored from a copy:
//   T1 the clock's parts lose `aria-hidden` (the cause, since 2cc76738)   🔴 clock: «StaticText «TEMPO», StaticText «1:00:00»» exposed
//   T2 the clock loses `role="img"`                                       🔴 clock: images exposed (none)
//   T3 `inert` on the quiz's options group (`main-quiz.ts`)               🔴 options: the group is not exposed (and the inverse case)
//   T4 `aria-hidden` on the quick bar's host (`quiz.html`)                🔴 icons: all eleven labels missing
