// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/footer-scroll-driver — A FOOTER EXPLANATION LONGER THAN ITS LINES SCROLLS INSIDE THEM (ADR-0245): the DOM half of
// `ui/footer-scroll`, which holds the pace.
//
// Watches the region for the two explanation footers — the screen's band (`.barra-explicacao`) and a panel's
// (`.opt-explain`). A NEW text, or a footer that comes into view, starts from the top; a text that fits is measured once and
// left alone. The box does not change: `[data-scroll]` swaps the two-line clamp for a block of the same lines (style.css), and
// the text moves by `scrollTop` — the DOM of the live region is never touched, so narration and the screen reader still get
// the whole text once (ADR-0245 §4). Pointer over it or focus in it holds the motion (§3, WCAG 2.2.2); a footer that leaves
// the screen stops its timer.
//
// 📌 Everything it reaches arrives through the host (ADR-0232): the document, the timers, the styles and the observer.
import { footerScrollPlan, readLines, type FooterLines, type FooterScrollPlan } from './footer-scroll.js';

const FOOTERS = '.barra-explicacao, .opt-explain';

export interface FooterScrollHost {
  readonly doc: Pick<Document, 'createRange' | 'createTreeWalker'>;
  readonly getComputedStyle: (el: Element) => CSSStyleDeclaration;
  readonly MutationObserver: typeof MutationObserver;
  readonly setTimeout: (fn: () => void, ms: number) => number;
  readonly clearTimeout: (id: number) => void;
  /** The child's caption rate (ADR-0183 §4), read at every start. */
  readonly ppm: () => number;
  /** Reduced motion — the system's or the child's — read at every start. */
  readonly reduced: () => boolean;
}

/** What a footer was last measured with; `plan` only while it scrolls. */
interface Seen {
  readonly key: string;
  plan: FooterScrollPlan | null;
  lines: FooterLines;
  step: number;
  timer: number | null;
}

/** Starts watching `root`. Returns the way to stop: every timer cleared, the observer disconnected. */
export function watchFooterScroll(root: HTMLElement, host: FooterScrollHost): () => void {
  const seen = new Map<HTMLElement, Seen>();
  const held = new WeakSet<HTMLElement>();
  const wired = new WeakSet<HTMLElement>();

  const visible = (el: HTMLElement): boolean => el.isConnected && el.getClientRects().length > 0;
  const linesShown = (el: HTMLElement): number =>
    parseInt(host.getComputedStyle(el).getPropertyValue('--footer-lines'), 10) || 2;

  function wordTops(el: HTMLElement): number[] {
    const tops: number[] = [];
    const walker = host.doc.createTreeWalker(el, 4); // NodeFilter.SHOW_TEXT
    const range = host.doc.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (const m of (n.textContent ?? '').matchAll(/\S+/g)) {
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        const box = range.getClientRects()[0];
        if (box) tops.push(box.top);
      }
    }
    return tops;
  }

  function forget(el: HTMLElement): void {
    const s = seen.get(el);
    if (s?.timer != null) host.clearTimeout(s.timer);
    seen.delete(el);
    delete el.dataset.scroll;
    delete el.dataset.topLine;
    el.scrollTop = 0;
  }

  function arm(el: HTMLElement, s: Seen): void {
    if (s.timer != null) host.clearTimeout(s.timer);
    s.timer = null;
    if (!s.plan || held.has(el)) return;
    s.timer = host.setTimeout(() => {
      s.timer = null;
      if (s.step + 1 < s.plan!.steps.length) show(el, s, s.step + 1);
      else start(el, true); // the end: again from the top, measured again
    }, s.plan.steps[s.step]!.holdMs);
  }

  function show(el: HTMLElement, s: Seen, step: number): void {
    s.step = step;
    const line = s.plan!.steps[step]!.line;
    el.dataset.topLine = String(line);
    el.scrollTop = s.lines.starts[line]!;
    arm(el, s);
  }

  function wire(el: HTMLElement): void {
    if (wired.has(el)) return;
    wired.add(el);
    const hold = (): void => { held.add(el); const s = seen.get(el); if (s) arm(el, s); };
    const release = (): void => { held.delete(el); const s = seen.get(el); if (s) arm(el, s); };
    el.addEventListener('pointerenter', hold);
    el.addEventListener('pointerleave', release);
    el.addEventListener('focusin', hold);
    el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget as Node | null)) release(); });
  }

  /** A footer whose text or lines changed, or that came into view: measured, and moved only if it does not fit. */
  function start(el: HTMLElement, again = false): void {
    const key = `${linesShown(el)}|${el.textContent ?? ''}`;
    if (!again && seen.get(el)?.key === key) return; // the same text written again is not a new text
    forget(el);
    if (!visible(el)) return;
    el.dataset.scroll = ''; // measured as it will scroll: a block, no clamp
    const lines = readLines(wordTops(el), parseFloat(host.getComputedStyle(el).lineHeight));
    const plan = footerScrollPlan(lines.words, linesShown(el), host.ppm(), host.reduced());
    const s: Seen = { key, plan, lines, step: 0, timer: null };
    seen.set(el, s);
    if (!plan) { delete el.dataset.scroll; return; }
    el.dataset.scroll = plan.mode;
    wire(el);
    show(el, s, 0);
  }

  function footersIn(node: Node, into: Set<HTMLElement>): void {
    const el = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
    const own = el?.closest<HTMLElement>(FOOTERS);
    if (own) into.add(own);
    if (node.nodeType === 1) el!.querySelectorAll<HTMLElement>(FOOTERS).forEach((f) => into.add(f));
  }

  const observer = new host.MutationObserver((records) => {
    const touched = new Set<HTMLElement>();
    for (const r of records) { footersIn(r.target, touched); r.addedNodes.forEach((n) => footersIn(n, touched)); }
    // a `hidden` changed somewhere: every footer may have come into view, or changed its number of lines
    if (records.some((r) => r.type === 'attributes')) footersIn(root, touched);
    for (const el of [...seen.keys()]) if (!visible(el)) forget(el);
    touched.forEach((el) => start(el));
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  root.querySelectorAll<HTMLElement>(FOOTERS).forEach((el) => start(el));

  return () => {
    observer.disconnect();
    for (const el of [...seen.keys()]) forget(el);
  };
}
