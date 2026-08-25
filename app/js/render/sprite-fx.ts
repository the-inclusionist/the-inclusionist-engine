// SPDX-License-Identifier: AGPL-3.0-or-later
// render/sprite-fx.ts — helpers de canvas p/ SPRITES/silhuetas, sobre render/canvas.ts. Módulo-folha (só makeCanvas):
//  • spriteToCanvas: pinta arte ASCII 16×32 (1 char = 1 px) pela paleta unificada APP.
//  • outlineCanvas: contorno ESCURO único atrás da arte (1º plano do alto contraste) — silhueta deslocada em anel
//    + arte por cima (sem cortar vãos internos). APP / _silhouette / OUTLINE_DARK são privados. (Fase 2.21)
import { makeCanvas } from './canvas.js';

// Paleta UNIFICADA (E15) — luz de cima-esquerda, contorno escuro. H cabelo · S pele · D pele-sombra · K contorno/olho
// · W branco · R camisa · T camisa-sombra · B calça · P calça-sombra.
const APP: Record<string, string> = { H: '#403020', S: '#c08070', D: '#9a5f50', K: '#1a1420', W: '#e8eef0', R: '#3090d0', T: '#2566a0', B: '#303050', P: '#20203a' };

export function spriteToCanvas(art: string[]): HTMLCanvasElement {
  const cv = makeCanvas(16, 32), c = cv.getContext('2d')!;
  for (let y = 0; y < 32; y++) { const row = art[y]; if (!row) continue;
    for (let x = 0; x < 16; x++) { const ch = row[x]; if (ch === '.' || !ch) continue; c.fillStyle = APP[ch] || '#f0f'; c.fillRect(x, y, 1, 1); } }
  return cv;
}

const OUTLINE_DARK = '#0a0a08'; // contorno escuro (José refará o gráfico visando 3:1 depois)
function _silhouette(src: HTMLCanvasElement, color: string): HTMLCanvasElement { const cv = makeCanvas(src.width, src.height), c = cv.getContext('2d')!; c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = color; c.fillRect(0, 0, cv.width, cv.height); return cv; }
// Contorno ESCURO único: preserva a arte (contorno ATRÁS, arte por cima → só aparece nas bordas externas, sem cortar vãos).
export function outlineCanvas(src: HTMLCanvasElement, thick: number): HTMLCanvasElement { const cv = makeCanvas(src.width, src.height), c = cv.getContext('2d')!;
  const dark = _silhouette(src, OUTLINE_DARK), r = thick >= 2 ? 2 : 1;
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { if (!dx && !dy) continue; c.drawImage(dark, dx, dy); } // anel escuro
  c.drawImage(src, 0, 0); return cv; // arte por cima → sem corte interno
}
