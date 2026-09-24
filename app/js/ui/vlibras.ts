// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/vlibras.ts — DEAF MODE (the Libras sign-language interpreter).
//
// THE STATE IS OURS. `librasOpen` is the person's choice, persisted, and never a reading of a third party's
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
import { t } from '../core/i18n.js';
import type { Store } from '../platform/storage.js';

/** What deaf mode is read and written through: the page's store, built by the root (ADR-0232, issue #207). */
export type LibrasStore = Pick<Store, 'getBool' | 'setBool'>;

/**
 * Deaf-mode state. The PERSON's choice, persisted — not an inference about a third-party widget. OFF until `initLibras`
 * reads the stored choice: at init, never at import (ADR-0232).
 */
export let librasOpen = false;
let _store: LibrasStore | null = null;

/**
 * Reads the stored choice and keeps the store `toggleLibras` writes to. Called once by the root (`createGame`); a page that
 * toggles deaf mode without it keeps the choice for the session only.
 */
export function initLibras(store: LibrasStore): void {
  _store = store;
  librasOpen = store.getBool('incl_libras', false);
}

let _vlOpen = false, _vlNode: HTMLElement | null = null, _vlBusyUntil = 0, _vlNext: string | null = null;
let _onLibrasChange: () => void = () => { /* the host registers its reflow here */ };
// Registers the reflow to run when the panel opens/closes. Called by the host at boot.
export function setOnLibrasChange(fn: () => void): void { _onLibrasChange = fn; }

// Signs in Libras: sends the text to the interpreter (only while the panel is open). A queue of 1 — a new utterance replaces the pending one.
export function vlibrasSay(text: string): void {
  if (!_vlOpen || !text) return;
  const now = Date.now();
  if (now < _vlBusyUntil) { _vlNext = text; return; }
  _vlBusyUntil = now + 4000;
  if (!_vlNode) {
    _vlNode = document.createElement('span'); _vlNode.setAttribute('aria-hidden', 'true');
    _vlNode.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:.01;z-index:1;pointer-events:auto';
    document.body.appendChild(_vlNode);
  }
  _vlNode.textContent = text; try { _vlNode.click(); } catch (e) { /* noop */ }
  setTimeout(() => { const nx = _vlNext; _vlNext = null; _vlBusyUntil = 0; if (nx) vlibrasSay(nx); }, 4100);
}

const vwBtn = (): HTMLElement | null => document.querySelector<HTMLElement>('[vw-access-button]');
/** Is deaf mode on? Reads OUR state — never the widget's geometry. */
export function vlibrasOpen(): boolean { return librasOpen; }

/** Turns deaf mode on/off. A real toggle: the state is ours, so it always flips. */
export function toggleLibras(): void {
  librasOpen = !librasOpen; _vlOpen = librasOpen;
  _store?.setBool('incl_libras', librasOpen);
  // A BEST-EFFORT attempt to wake the VLibras widget, if it is loaded. Failing here must not stop the mode from
  // turning on: the state is the person's choice, and the widget is only one possible translator for them.
  const b = vwBtn();
  if (librasOpen && b) { try { b.click(); } catch (e) { /* noop */ } }
  else if (!librasOpen) { try { window.dispatchEvent(new CustomEvent('vp-widget-close')); } catch (e) { /* noop */ } }
  _onLibrasChange();
  if (librasOpen) vlibrasSay(t('sr.libras.on'));
}

/** Kept for a game loop that calls it every frame. It decides nothing — the state is ours. */
export function vlTick(): void { _vlOpen = librasOpen; }
