// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/scan-overlay — WHAT «ONE BUTTON ONLY» IS OFFERING RIGHT NOW (ADR-0218, issue #201).
//
// A scan is the machine offering and the child taking, and she cannot take what she cannot see: the whole accommodation is the
// list going by, so the list going by has to be ON SCREEN, in the game's own words, and it has to reach a child who plays by
// ear as well — which is why the chip is a live region and not a picture.
//
// 📌 THE WORDS ARE THE GAME'S. What is offered is a position the cartridge declared and NAMED (`preset`), so the chip says
// «Confirmar» or «Dizer a resposta», never `action2` (ADR-0074). A position the game did not name is not offered at all — the
// list is built from the named ones — because a scan that stopped on a word nobody wrote would cost the child a full pass.

import type { Action } from '../core/actions.js';
import { SCAN_CANCEL, type ScanItem } from '../input/switch-scan.js';

/** What the chip reads for one item. Pure: the caller brings the game's labeller and the word for «take nothing». */
export function scanItemText(item: ScanItem, label: (a: Action) => string | null, cancelWord: string): string {
  return item === SCAN_CANCEL ? cancelWord : (label(item) ?? '');
}

export interface ScanOverlay {
  /**
   * Puts the item on screen, and answers whether the words CHANGED. The same item twice does not rewrite the node — a live
   * region that repeats itself says it twice — and the answer is what lets the caller re-measure the room only when a word of
   * a different length arrives, instead of every frame.
   */
  showing(text: string): boolean;
  /** Takes the chip off screen; the scan is off. */
  hide(): void;
  remove(): void;
}

/**
 * Mounts the chip inside the game's region, under the quick bar's band.
 *
 * ⚠️ `role="status"`, not `alert`: a child who plays by ear hears each item as it comes, and an alert would interrupt whatever
 * the game is saying at every step of a scan that never stops.
 */
export function mountScanOverlay(doc: Document, host: HTMLElement): ScanOverlay {
  const el = doc.createElement('div');
  el.className = 'scan-now';
  el.setAttribute('role', 'status');
  el.hidden = true;
  host.appendChild(el);
  let last: string | null = null;
  return {
    showing(text) {
      const appeared = el.hidden;
      el.hidden = false;
      if (text === last) return appeared;
      last = text;
      el.textContent = text;
      return true;
    },
    hide() { el.hidden = true; last = null; el.textContent = ''; },
    remove() { el.remove(); },
  };
}
