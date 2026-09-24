// SPDX-License-Identifier: AGPL-3.0-or-later
// core/a11y-sr.ts — announcements for the SCREEN READER. srSay = the "polite" aria-live region (status);
// srAlert = the "assertive" region (alerts). Clear → requestAnimationFrame → write forces the reader to announce
// the same text again when it repeats. It also mirrors the speech into LIBRAS, and that arrives by INJECTION
// (setVlibrasSay) so this core module never imports ui/ (ADR-0173). ⚠️ Nothing inside the engine registers it
// today — the boot that did was the platformer's — so the mirror is a no-op until a host calls it.
// Depends only on core/dom-query ($). The #sr-status/#sr-alert regions live in the page.
import { $ } from './dom-query.js';

let _vlibrasSay: (text: string) => void = () => { /* no-op until setVlibrasSay() */ };
// Registers the Libras speech (the host calls it once vlibrasSay exists). See ui/vlibras.
export function setVlibrasSay(fn: (text: string) => void): void { _vlibrasSay = fn; }

// "Polite" announcement (status): does not interrupt what the reader is saying.
export const srSay = (t: string): void => { const el = $('#sr-status'); if (el) { el.textContent = ''; requestAnimationFrame(() => { el.textContent = t; }); } _vlibrasSay(t); };
// "Assertive" announcement (alert): interrupts and speaks now (errors, important warnings).
export const srAlert = (t: string): void => { const el = $('#sr-alert'); if (el) { el.textContent = ''; requestAnimationFrame(() => { el.textContent = t; }); } _vlibrasSay(t); };
