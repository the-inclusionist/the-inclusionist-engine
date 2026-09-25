// SPDX-License-Identifier: AGPL-3.0-or-later
// render/sprite-fx.ts — canvas helpers for SPRITES/silhouettes, over render/canvas.ts. A leaf module (only makeCanvas):
//  • spriteToCanvas: paints 16×32 ASCII art (1 char = 1 px) with the unified APP palette, in the document it is handed.
//  • outlineCanvas: a single DARK outline behind the art (high contrast's foreground) — the silhouette offset in a ring
//    + the art on top (no cut into inner gaps). APP / _silhouette / OUTLINE_DARK are private.
// ADR-0232: no global document. A helper that already holds a canvas makes its scratch canvases in THAT canvas's
// document (`src.ownerDocument`); the one that holds none takes the document as a parameter.
import { makeCanvas, type CanvasDoc } from './canvas.js';

// The UNIFIED palette — light from the top left, dark outline. H hair · S skin · D skin shadow · K outline/eye
// · W white · R shirt · T shirt shadow · B trousers · P trousers shadow.
const APP: Record<string, string> = { H: '#403020', S: '#c08070', D: '#9a5f50', K: '#1a1420', W: '#e8eef0', R: '#3090d0', T: '#2566a0', B: '#303050', P: '#20203a' };

export function spriteToCanvas(doc: CanvasDoc, art: string[]): HTMLCanvasElement {
  const cv = makeCanvas(doc, 16, 32), c = cv.getContext('2d')!;
  for (let y = 0; y < 32; y++) { const row = art[y]; if (!row) continue;
    for (let x = 0; x < 16; x++) { const ch = row[x]; if (ch === '.' || !ch) continue; c.fillStyle = APP[ch] || '#f0f'; c.fillRect(x, y, 1, 1); } }
  return cv;
}

const OUTLINE_DARK = '#0a0a08'; // dark outline (the Dev will redraw the art aiming at 3:1)
function _silhouette(src: HTMLCanvasElement, color: string): HTMLCanvasElement { const cv = makeCanvas(src.ownerDocument, src.width, src.height), c = cv.getContext('2d')!; c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height); return cv; }
// A single DARK outline: it keeps the art (outline BEHIND, art on top → it only shows on the outer edges, no cut into gaps).
export function outlineCanvas(src: HTMLCanvasElement, thick: number): HTMLCanvasElement { const cv = makeCanvas(src.ownerDocument, src.width, src.height), c = cv.getContext('2d')!;
  const dark = _silhouette(src, OUTLINE_DARK), r = thick >= 2 ? 2 : 1;
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { if (!dx && !dy) continue; c.drawImage(dark, dx, dy); } // the dark ring
  c.drawImage(src, 0, 0); return cv; // the art on top → no inner cut
}
