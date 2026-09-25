// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/vlibras.ts — DEAF MODE (the Libras sign-language interpreter).
//
// THE STATE IS OURS. Deaf mode is the person's choice, persisted, and never a reading of a third party's
// rectangle. It used to be inferred from the GEOMETRY of VLibras's access button, and when the widget moved its
// markup to `<body>` the detector answered "open" forever: the layout reserved space for an interpreter that did not
// exist and pushed the game off screen, and the toggle could not turn it off. An accessibility mode whose state is
// inferred from another library's geometry is a mode that switches itself off when that library changes — and the
// one who pays is whoever depends on it.
//
// WHAT IT IS NOT YET: the Dev decided the interpreter should appear IN FRONT of the screen when audio plays and
// disappear afterwards, with no click and no dependence on clicking text. The VLibras widget does not do that (it is
// a docked panel that translates the text of the clicked element), which is why pillar 2 of ADR-0010 plans an
// interpreter engine of our own in zdog. This file gives an honest toggle; the on-demand interpreter is separate
// work.
//
// 🔴 A FACTORY (ADR-0232 D4, issue #207): the choice, the interpreter's queue, the hidden node it clicks and the reflow
// callback were module state, so two roots on one page shared one deaf mode and one queue. Each root builds its own over
// the document, window, store and clock its host lends. What it does is unchanged — including who feeds it: the root
// toggles it from the bar and does NOT send it announcements; a game that wants them signed connects its announcer's
// mirror (decision DD1, pending the Dev).
import type { Translate } from '../core/i18n.js';
import type { Store } from '../platform/storage.js';

/** What deaf mode is read and written through: the page's store, built by the root (ADR-0232, issue #207). */
export type LibrasStore = Pick<Store, 'getBool' | 'setBool'>;

/** What a deaf mode is built over. */
export interface LibrasPorts {
  /** Where the hidden node the interpreter clicks lives (its `body`), and where the widget's access button is looked for. */
  readonly doc: Document;
  /** Where the widget's close event is dispatched, and whose timer drains the one-utterance queue. */
  readonly win: Pick<Window, 'dispatchEvent' | 'setTimeout'>;
  /** The page's store: the person's choice is read once, at build, and written at each toggle. */
  readonly store: LibrasStore;
  /** Milliseconds now — the queue's clock (`Date.now`). */
  readonly now: () => number;
}

/** One root's deaf mode. */
export interface Libras {
  /** Is deaf mode on? Reads OUR state — never the widget's geometry. */
  readonly isOpen: () => boolean;
  /** Turns deaf mode on/off. A real toggle: the state is ours, so it always flips; the confirmation is signed in `t`'s language. */
  readonly toggle: (t: Translate) => void;
  /** Signs in Libras: sends the text to the interpreter (only while it is open). A queue of 1 — a new utterance replaces the pending one. */
  readonly say: (text: string) => void;
  /** Kept for a game loop that calls it every frame: it opens the interpreter for a choice restored from storage. It decides nothing. */
  readonly tick: () => void;
  /** Runs `fn` when the mode opens or closes (a host's reflow); returns its release. */
  readonly onChange: (fn: () => void) => () => void;
}

/**
 * Builds a deaf mode. The PERSON's choice, persisted — not an inference about a third-party widget — read from the store
 * here, at build, never at import (ADR-0232).
 */
export function createLibras({ doc, win, store, now }: LibrasPorts): Libras {
  let open = store.getBool('incl_libras', false);
  let vlOpen = false, node: HTMLElement | null = null, busyUntil = 0, next: string | null = null;
  const changeListeners = new Set<() => void>();

  const say = (text: string): void => {
    if (!vlOpen || !text) return;
    const at = now();
    if (at < busyUntil) { next = text; return; }
    busyUntil = at + 4000;
    if (!node) {
      node = doc.createElement('span'); node.setAttribute('aria-hidden', 'true');
      node.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:.01;z-index:1;pointer-events:auto';
      doc.body.appendChild(node);
    }
    node.textContent = text; try { node.click(); } catch (e) { /* noop */ }
    win.setTimeout(() => { const nx = next; next = null; busyUntil = 0; if (nx) say(nx); }, 4100);
  };

  const toggle = (t: Translate): void => {
    open = !open; vlOpen = open;
    store.setBool('incl_libras', open);
    // A BEST-EFFORT attempt to wake the VLibras widget, if it is loaded. Failing here must not stop the mode from
    // turning on: the state is the person's choice, and the widget is only one possible translator for them.
    const b = doc.querySelector<HTMLElement>('[vw-access-button]');
    if (open && b) { try { b.click(); } catch (e) { /* noop */ } }
    else if (!open) { try { win.dispatchEvent(new CustomEvent('vp-widget-close')); } catch (e) { /* noop */ } }
    for (const fn of [...changeListeners]) fn();
    if (open) say(t('sr.libras.on'));
  };

  return {
    isOpen: () => open,
    toggle,
    say,
    tick: () => { vlOpen = open; },
    onChange: (fn) => { changeListeners.add(fn); return () => { changeListeners.delete(fn); }; },
  };
}