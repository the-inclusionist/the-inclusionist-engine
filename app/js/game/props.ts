// SPDX-License-Identifier: AGPL-3.0-or-later
// game/props.ts — arte procedural dos "props" DESTE JOGO: a moeda, a árvore urbana e os sete ícones de
// power-up. Desenhados por ALGORITMO (pixel a pixel, sem PNG embutido) sobre as primitivas de
// `render/canvas`. As variantes *Texture embrulham o canvas numa PIXI.Texture. (Fase 2.19)
//
// ========================= POR QUE ISTO SAIU DE `render/` (item 19) =========================
// Estava em `render/props.ts`, na camada de ENGINE, e nada aqui é de engine: uma moeda, uma árvore de rua e
// os ícones de super-pulo, voo e bengala de corrida são o CONTEÚDO de The Inclusionist. Um segundo jogo do
// catálogo não quer nenhum dos três, e não teria como não os levar — eles vinham dentro do pacote.
//
// A saída é MUDANÇA DE ENDEREÇO, e não conserto. Vale dizer com todas as letras, porque as duas se parecem
// no gate e não se parecem em nada mais: o código é o mesmo, byte por byte. O que muda é que ele deixou de
// estar do lado errado da fronteira — e, com isso, `render/` perdeu o único módulo que PINTAVA uma moeda.
//
// O que fica em `render/canvas` é a primitiva (`makeCanvas`, `pixDisc`, `tex`): desenhar um disco de pixels
// serve a qualquer jogo; desenhar UMA MOEDA de 11×11 com brilho no canto superior esquerdo, não.
import { makeCanvas, tex, pixDisc } from '../render/canvas.js';

export function coinCanvas(): HTMLCanvasElement {
  const cv = makeCanvas(11, 11), c = cv.getContext('2d')!;
  pixDisc(c, 5, 5, 5, '#ffd23f', '#7a5400');                                // disco dourado + contorno
  c.fillStyle = '#fff3b0'; c.fillRect(3, 2, 2, 1); c.fillRect(2, 3, 1, 2);  // brilho (canto sup-esq)
  c.fillStyle = '#e0a82a'; c.fillRect(7, 7, 2, 1); c.fillRect(8, 6, 1, 2);  // sombra (inf-dir)
  return cv;
}
export function coinTexture() { return tex(coinCanvas()); }

export function treeCanvas(): HTMLCanvasElement { // árvore urbana caprichada (R-cidade): tronco sombreado c/ raízes + copa em 3 tons + luz de borda
  const cv = makeCanvas(30, 52), c = cv.getContext('2d')!;
  c.fillStyle = '#241a0e'; c.fillRect(12, 28, 7, 22); c.fillRect(9, 47, 13, 3); // contorno tronco + raízes
  c.fillStyle = '#5c4033'; c.fillRect(13, 28, 5, 21);                           // tronco
  c.fillStyle = '#7a5a48'; c.fillRect(13, 28, 2, 21);                           // luz do tronco
  c.fillStyle = '#3f2c20'; c.fillRect(16, 30, 2, 19);                           // sombra do tronco
  c.fillStyle = '#5c4033'; c.fillRect(10, 47, 4, 2); c.fillRect(17, 47, 4, 2);  // raízes
  pixDisc(c, 15, 17, 13, '#175e3c', '#0e3a24');                                 // copa base (escura + contorno)
  pixDisc(c, 10, 15, 8, '#1f7a4d'); pixDisc(c, 20, 14, 7, '#1f7a4d');           // volumes médios
  pixDisc(c, 9, 12, 5, '#2fa35f'); pixDisc(c, 19, 10, 5, '#2fa35f');            // tufos claros
  pixDisc(c, 12, 9, 3, '#46b06a'); pixDisc(c, 21, 8, 2, '#46b06a');             // luz de topo
  c.fillStyle = '#0e3a24'; c.fillRect(6, 25, 18, 3);                            // sombra sob a copa
  c.fillStyle = 'rgba(255,255,255,.20)'; c.fillRect(8, 7, 3, 1); c.fillRect(18, 5, 2, 1); // brilhinhos
  return cv;
}
export function treeTexture() { return tex(treeCanvas()); }

// Ícone 12×12 de power-up/chave por tipo (fundo escuro cantos-cortados + glifo nítido). triU/triR = triângulo ↑
// e chevron → pixel-perfect (locais). O game.js embrulha em textura e aplica alto-contraste à parte (pupTexFor).
export function powerupCanvas(kind: string): HTMLCanvasElement {
  const cv = makeCanvas(12, 12), c = cv.getContext('2d')!;
  const COL: Record<string, string> = { superjump: '#7fdcff', ultrajump: '#b388ff', turbo: '#34e29b', fly: '#c8a2ff', wallcling: '#ff9a4d', key: '#ffd23f', runcane: '#eaeaea' };
  const col = COL[kind] || '#7fdcff', BG = '#04121a';
  c.fillStyle = BG; c.fillRect(1, 0, 10, 12); c.fillRect(0, 1, 12, 10);   // fundo escuro, cantos cortados (pixel-rounded, sem AA)
  c.fillStyle = col;
  const triU = (cx: number, topY: number, baseW: number, H: number) => { for (let i = 0; i < H; i++) { const w = Math.max(1, Math.round(baseW * (i + 1) / H)); c.fillRect(cx - (w >> 1), topY + i, w, 1); } }; // triângulo ↑ nítido
  const triR = (lx: number, cy: number, baseH: number, W: number) => { for (let i = 0; i < W; i++) { const h = Math.max(1, Math.round(baseH * (W - i) / W)); c.fillRect(lx + i, cy - (h >> 1), 1, h); } };       // chevron → nítido
  if (kind === 'superjump') { triU(6, 1, 8, 4); triU(6, 6, 8, 4); }                                  // ▲▲ super-pulo
  else if (kind === 'ultrajump') { triU(6, 1, 9, 4); c.fillRect(5, 5, 2, 6); }                        // ↑ ultra-pulo (cabeça + haste)
  else if (kind === 'turbo') { triR(2, 6, 9, 4); triR(6, 6, 9, 4); }                                  // » super-corrida
  else if (kind === 'fly') { triR(1, 5, 9, 6); c.fillStyle = BG; c.fillRect(4, 6, 1, 1); c.fillRect(6, 6, 1, 1); } // asa = voo (com nervuras)
  else if (kind === 'wallcling') { pixDisc(c, 6, 6, 4, col); pixDisc(c, 6, 6, 1.6, BG); }               // ventosa
  else if (kind === 'runcane') { for (let i = 0; i < 6; i++) c.fillRect(3 + i, 2 + i, 2, 1); pixDisc(c, 9, 10, 1.9, col); pixDisc(c, 9, 10, 0.8, BG); c.fillStyle = '#d23b3b'; c.fillRect(7, 6, 2, 1); } // bengala de corrida: haste diagonal + roda + faixa vermelha
  else { pixDisc(c, 4, 6, 3, col); pixDisc(c, 4, 6, 1.3, BG); c.fillStyle = col; c.fillRect(6, 5, 5, 2); c.fillRect(9, 7, 1, 1); c.fillRect(10, 7, 1, 2); } // ⚷ chave (anel + haste + dentes)
  return cv;
}
