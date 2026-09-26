// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/footer-scroll-driver — A FOOTER EXPLANATION LONGER THAN ITS LINES MOVES INSIDE THEM (ADR-0245): the DOM half of
// `ui/footer-scroll`, which holds the pace.
//
// Watches the region for the two explanation footers — the screen's band (`.barra-explicacao`) and a panel's
// (`.opt-explain`). A NEW text, or a footer that comes into view, starts from the top; a text that fits is measured once and
// left alone, its DOM untouched. The box does not change: `[data-scroll]` swaps the two-line clamp for a block of the same
// lines (style.css).
//   · GLIDE: the words rise continuously (ADR-0245 erratum, 2026-09-26 — a line at a time was what the Dev rejected). They are
//     moved into one `.footer-scroll-text` block, and a Web Animation translates it: sub-pixel and on the compositor, where
//     `scrollTop` stands on whole pixels. The text node the game wrote is MOVED, not copied, in the same task as the write and
//     before a frame is drawn, and nothing is written into the live region after — narration and the screen reader still get
//     the whole text once (§4).
//   · PAGES (reduced motion): no slide, so `scrollTop` and a timer per page, as the plan says.
// Pointer over it or focus in it holds the motion where it is (§3, WCAG 2.2.2): the animation paused, or the page timer
// cleared. A footer that leaves the screen keeps no animation and no timer.
//
// 📌 Everything it reaches arrives through the host (ADR-0232): the document, the timers, the styles and the observer.
import { footerScrollPlan, readLines, type FooterGlidePlan, type FooterLines, type FooterPagesPlan, type FooterScrollPlan } from './footer-scroll.js';

const FOOTERS = '.barra-explicacao, .opt-explain';
/** The block the words glide in (style.css makes it a block while the footer scrolls). */
const TEXT = 'footer-scroll-text';

export interface FooterScrollHost {
  readonly doc: Pick<Document, 'createRange' | 'createTreeWalker' | 'createElement'>;
  readonly getComputedStyle: (el: Element) => CSSStyleDeclaration;
  readonly MutationObserver: typeof MutationObserver;
  readonly setTimeout: (fn: () => void, ms: number) => number;
  readonly clearTimeout: (id: number) => void;
  /** The child's caption rate (ADR-0183 §4), read at every start. */
  readonly ppm: () => number;
  /** Reduced motion — the system's or the child's — read at every start. */
  readonly reduced: () => boolean;
}

/** What a footer was last measured with; `plan` only while it moves. */
interface Seen {
  readonly key: string;
  plan: FooterScrollPlan | null;
  lines: FooterLines;
  step: number;
  timer: number | null;
  /** The glide: the block the words are in, and the animation moving it. */
  glide: { readonly text: HTMLElement; readonly anim: Animation } | null;
}

/** Starts watching `root`. Returns the way to stop: every animation cancelled and timer cleared, the observer disconnected. */
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
    if (s?.glide) { s.glide.anim.onfinish = null; s.glide.anim.cancel(); }
    seen.delete(el);
    delete el.dataset.scroll;
    delete el.dataset.topLine;
    el.scrollTop = 0;
  }

  /**
   * The words inside the one block that glides, MOVED there (never copied: the game's text node stays the one it wrote). The
   * block a footer already has is kept — a restart, or the same text written again, goes on in it.
   */
  function gather(el: HTMLElement, text?: HTMLElement): HTMLElement {
    let block = text;
    if (!block) {
      const only = el.childNodes.length === 1 ? el.firstElementChild : null;
      if (only instanceof HTMLElement && only.classList.contains(TEXT)) return only;
      block = host.doc.createElement('span');
      block.className = TEXT;
    }
    const loose = [...el.childNodes].filter((n) => n !== block);
    if (loose.length) block.replaceChildren(...loose);
    if (block.parentNode !== el) el.append(block);
    return block;
  }

  /** Paces a footer as it is now: held, it stays where it is; free, it goes on from there. */
  function pace(el: HTMLElement, s: Seen): void {
    if (s.glide) {
      if (held.has(el)) s.glide.anim.pause(); else s.glide.anim.play();
      return;
    }
    arm(el, s);
  }

  function glide(el: HTMLElement, s: Seen, plan: FooterGlidePlan): void {
    const text = gather(el);
    const rise = `translateY(${-s.lines.starts[plan.toLine]!}px)`;
    const total = plan.waitMs + plan.travelMs + plan.holdMs;
    // still while the first view is read, one speed to the last view, still while it is read
    const anim = text.animate([
      { transform: 'translateY(0)', offset: 0 },
      { transform: 'translateY(0)', offset: plan.waitMs / total },
      { transform: rise, offset: (plan.waitMs + plan.travelMs) / total },
      { transform: rise, offset: 1 },
    ], { duration: total, easing: 'linear' });
    anim.onfinish = () => start(el, true); // the end: again from the top, measured again
    s.glide = { text, anim };
    pace(el, s);
  }

  const pagesOf = (s: Seen): FooterPagesPlan | null => (s.plan?.mode === 'pages' ? s.plan : null);

  function arm(el: HTMLElement, s: Seen): void {
    if (s.timer != null) host.clearTimeout(s.timer);
    s.timer = null;
    const pages = pagesOf(s);
    if (!pages || held.has(el)) return;
    s.timer = host.setTimeout(() => {
      s.timer = null;
      if (s.step + 1 < pages.steps.length) show(el, s, pages, s.step + 1);
      else start(el, true); // the end: again from the top, measured again
    }, pages.steps[s.step]!.holdMs);
  }

  function show(el: HTMLElement, s: Seen, pages: FooterPagesPlan, step: number): void {
    s.step = step;
    const line = pages.steps[step]!.line;
    el.dataset.topLine = String(line);
    el.scrollTop = s.lines.starts[line]!;
    arm(el, s);
  }

  function wire(el: HTMLElement): void {
    if (wired.has(el)) return;
    wired.add(el);
    const hold = (): void => { held.add(el); const s = seen.get(el); if (s) pace(el, s); };
    const release = (): void => { held.delete(el); const s = seen.get(el); if (s) pace(el, s); };
    el.addEventListener('pointerenter', hold);
    el.addEventListener('pointerleave', release);
    el.addEventListener('focusin', hold);
    el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget as Node | null)) release(); });
  }

  /** A footer whose text or lines changed, or that came into view: measured, and moved only if it does not fit. */
  function start(el: HTMLElement, again = false): void {
    const key = `${linesShown(el)}|${el.textContent ?? ''}`;
    const had = seen.get(el);
    if (!again && had?.key === key) {
      // the same text written again is not a new text: it goes on gliding, in the block it was in
      if (had.glide) gather(el, had.glide.text);
      return;
    }
    forget(el);
    if (!visible(el)) return;
    el.dataset.scroll = ''; // measured as it will scroll: a block, no clamp
    const lines = readLines(wordTops(el), parseFloat(host.getComputedStyle(el).lineHeight));
    // a page without Web Animations turns pages: the text still passes whole, at the same pace
    const reduced = host.reduced() || typeof el.animate !== 'function';
    const plan = footerScrollPlan(lines.words, linesShown(el), host.ppm(), reduced);
    const s: Seen = { key, plan, lines, step: 0, timer: null, glide: null };
    seen.set(el, s);
    if (!plan) { delete el.dataset.scroll; return; }
    el.dataset.scroll = plan.mode;
    wire(el);
    if (plan.mode === 'glide') glide(el, s, plan);
    else show(el, s, plan, 0);
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
