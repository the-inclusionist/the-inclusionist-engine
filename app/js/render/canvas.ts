// SPDX-License-Identifier: GPL-3.0-or-later
// render/canvas.ts — primitivas-folha de desenho: canvas offscreen → textura PixiJS + disco pixel-art nítido.
// Base de toda a arte procedural do jogo (coin/tree/powerup/world/…). Depende só de document + PIXI (npm),
// ZERO estado de jogo. NEAREST em tudo (pixel art, sem anti-aliasing). (Fase 2, subsistema render)
import * as PIXI from 'pixi.js'; // 7.4.2 via npm (Vite empacota; substitui o PIXI global do vendor)

// Canvas offscreen do tamanho pedido (fonte de textura procedural).
export const makeCanvas = (w: number, h: number): HTMLCanvasElement => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// Canvas → PIXI.Texture com escala NEAREST (pixel art crisp).
export const tex = (cv: HTMLCanvasElement): PIXI.Texture => { const t = PIXI.Texture.from(cv); t.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST; return t; };
// Disco com pixels INTEIROS (serrilhado nítido, sem anti-aliasing dos arcos vetoriais). edge = cor da borda (opcional).
export function pixDisc(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, edge?: string): void { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r) { c.fillStyle = (edge && d > r - 1.05) ? edge : col; c.fillRect(x, y, 1, 1); } } }

/* ===================== o pintor de retângulos (px) ===================== */
// POR QUE EXISTE: o par `makeCanvas(w,h)` + `getContext('2d')` seguido de `fillStyle=…; fillRect(…)` aparece em
// ~24 pontos do projeto, e a arte procedural da Cidade no main.js chegou a definir TRÊS `mk`/`px` locais, com
// assinaturas incompatíveis entre si (4 args sem cor + cor fixa por fora; 5 args com cor; canvas de tamanho
// fixo embutido). Aqui a assinatura é UMA só: `px(x, y, w, h, cor)`.
// POR QUE DEVOLVE O CANVAS (e não a textura): metade dos usos pós-processa o bitmap antes de virar textura
// (`outlineCanvas`, `_silhouette`, `directSpriteCanvas`). Quem só quer a textura usa `pixelTexture` abaixo —
// dois nomes em vez de uma flag booleana, porque o tipo de retorno é justamente o que muda.
/** Pincel de retângulo cheio: pinta `w×h` em `(x,y)` com `col`. É o `px` que todo painter recebe. */
export type PixelBrush = (x: number, y: number, w: number, h: number, col: string) => void;
/** Corpo de uma pintura pixel-art: recebe o pincel e desenha. Sem retorno, sem estado próprio. */
export type PixelPainter = (px: PixelBrush) => void;
/** Canvas offscreen `w×h` pintado por `paint` — a rotina que os três `mk` locais do main.js duplicavam. */
export function pixelCanvas(w: number, h: number, paint: PixelPainter): HTMLCanvasElement {
  const cv = makeCanvas(w, h), c = cv.getContext('2d')!;
  paint((x, y, ww, hh, col) => { c.fillStyle = col; c.fillRect(x, y, ww, hh); });
  return cv;
}
/** `pixelCanvas` + `tex`: atalho de quem quer a textura NEAREST direto (arte de sprite que não pós-processa). */
export const pixelTexture = (w: number, h: number, paint: PixelPainter): PIXI.Texture => tex(pixelCanvas(w, h, paint));
