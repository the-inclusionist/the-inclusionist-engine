// SPDX-License-Identifier: AGPL-3.0-or-later
// render/city-tiles.ts — OS DOIS TILES DA CIDADE, como DADOS e não como PNG (pilar "arte = dados", ADR-0010).
//
// `tile_fill` e `tile_surface` eram dois PNG de 16×16 baixados por `carregarTilesDoTema`. Aqui eles voltam como
// `PixelPainter` — a mesma forma que `render/city-tex` já usa para os pombos, os gatos e as silhuetas: uma
// lista de retângulos `px(x, y, w, h, cor)`.
//
// POR QUE RETÂNGULOS E NÃO UMA REGRA DE ALVENARIA. A primeira tentativa foi inferir a regra (tijolo 7×6, junta
// de 1 px, fiada alternada, bisel) e gerá-la. Deu 66% de acerto exato: a arte tem variação FEITA À MÃO — o
// bisel muda de tijolo para tijolo, e nenhuma regra curta a alcança. A decomposição em retângulos custa 51 e
// 62 chamadas e acerta 100%. Entre uma regra elegante que erra um quinto dos pixels e uma lista que acerta
// todos, num tile de 16×16 desenhado à mão, a lista é a resposta honesta.
//
// O QUE ISSO COMPRA, além de tirar dois PNG do pacote: o desenho passa a ser recolorível (o alto contraste e
// as paletas seguras para daltonismo mexem em cores, não em bitmaps), some o carregamento assíncrono — e com
// ele a guarda de corrida de `set-scenery` e os 404 de boot dos temas que não têm arte própria.
import { pixelCanvas, type PixelPainter } from './canvas.js';

/** O TILE do miolo da parede: alvenaria em fiada alternada. 51 retângulos, 9 cores, fiel ao pixel. */
export const paintTileFill: PixelPainter = (px) => {
  px(0,0,1,1,'#403b48');
  px(1,0,3,1,'#b8b6c1');
  px(4,0,2,1,'#bcbdc9');
  px(6,0,2,1,'#828291');
  px(8,0,1,1,'#403b48');
  px(9,0,1,1,'#b1b0bc');
  px(10,0,4,1,'#b8b6c1');
  px(14,0,2,1,'#403b48');
  px(0,1,1,1,'#b1b0bc');
  px(1,1,6,5,'#828291');
  px(7,1,1,4,'#403b48');
  px(8,1,1,5,'#b8b6c1');
  px(9,1,6,5,'#828291');
  px(15,1,1,5,'#393543');
  px(0,2,1,3,'#b8b6c1');
  px(0,5,1,1,'#b1b0bc');
  px(7,5,1,1,'#3e2e3f');
  px(0,6,1,3,'#403b48');
  px(1,6,1,1,'#777485');
  px(2,6,4,1,'#828291');
  px(6,6,3,3,'#403b48');
  px(9,6,5,1,'#828291');
  px(14,6,2,2,'#403b48'); px(1,7,5,1,'#403b48'); px(9,7,5,1,'#403b48');
  px(1,8,1,1,'#b1b0bc');
  px(2,8,2,1,'#b8b6c1');
  px(4,8,1,1,'#bcbdc9');
  px(5,8,1,1,'#b1b0bc'); px(9,8,1,1,'#b1b0bc');
  px(10,8,2,1,'#b8b6c1');
  px(12,8,1,1,'#bcbdc9');
  px(13,8,1,1,'#b1b0bc');
  px(14,8,1,1,'#403b48');
  px(15,8,1,1,'#393543');
  px(0,9,1,5,'#b1b0bc');
  px(1,9,6,5,'#828291');
  px(7,9,1,3,'#403b48');
  px(8,9,1,5,'#b8b6c1');
  px(9,9,6,5,'#828291');
  px(15,9,1,2,'#403b48');
  px(15,11,1,3,'#393543'); px(7,12,1,2,'#393543');
  px(0,14,1,2,'#403b48');
  px(1,14,5,1,'#828291');
  px(6,14,3,2,'#403b48');
  px(9,14,5,1,'#828291');
  px(14,14,2,2,'#403b48');
  px(1,15,1,1,'#444653');
  px(2,15,4,1,'#403b48'); px(9,15,5,1,'#403b48');
};

/** O TILE do TOPO da plataforma: mesma alvenaria com a borda superior iluminada. 62 retângulos, 23 cores. */
export const paintTileSurface: PixelPainter = (px) => {
  px(0,0,1,1,'#8b8994');
  px(1,0,3,1,'#bbbac5');
  px(4,0,2,1,'#bdbdc8');
  px(6,0,2,1,'#a6a5b2');
  px(8,0,1,1,'#8b8994');
  px(9,0,1,1,'#b8b7c3');
  px(10,0,4,1,'#bbbac5');
  px(14,0,2,1,'#8b8994');
  px(0,1,1,1,'#b6b5c1');
  px(1,1,6,1,'#9b9aa8');
  px(7,1,1,1,'#74717d');
  px(8,1,1,1,'#bab8c3');
  px(9,1,6,1,'#9b9aa8');
  px(15,1,1,1,'#706e7a');
  px(0,2,1,1,'#b9b7c2');
  px(1,2,6,1,'#90909e');
  px(7,2,1,1,'#5e5a66');
  px(8,2,1,1,'#b9b7c2');
  px(9,2,6,1,'#90909e');
  px(15,2,1,1,'#585562');
  px(0,3,1,2,'#b8b6c1');
  px(1,3,6,3,'#828291');
  px(7,3,1,2,'#403b48');
  px(8,3,1,3,'#b8b6c1');
  px(9,3,6,3,'#828291');
  px(15,3,1,3,'#393543');
  px(0,5,1,1,'#b1b0bc');
  px(7,5,1,1,'#3e2e3f');
  px(0,6,1,3,'#403b48');
  px(1,6,1,1,'#777485');
  px(2,6,4,1,'#828291');
  px(6,6,3,3,'#403b48');
  px(9,6,5,1,'#828291');
  px(14,6,2,2,'#403b48'); px(1,7,5,1,'#403b48'); px(9,7,5,1,'#403b48');
  px(1,8,1,1,'#b1b0bc');
  px(2,8,2,1,'#b8b6c1');
  px(4,8,1,1,'#bcbdc9');
  px(5,8,1,1,'#b1b0bc'); px(9,8,1,1,'#b1b0bc');
  px(10,8,2,1,'#b8b6c1');
  px(12,8,1,1,'#bcbdc9');
  px(13,8,1,1,'#b1b0bc');
  px(14,8,1,1,'#403b48');
  px(15,8,1,1,'#393543');
  px(0,9,1,5,'#b1b0bc');
  px(1,9,6,5,'#828291');
  px(7,9,1,3,'#403b48');
  px(8,9,1,5,'#b8b6c1');
  px(9,9,6,5,'#828291');
  px(15,9,1,2,'#403b48');
  px(15,11,1,3,'#393543'); px(7,12,1,2,'#393543');
  px(0,14,1,2,'#403b48');
  px(1,14,5,1,'#828291');
  px(6,14,3,2,'#403b48');
  px(9,14,5,1,'#828291');
  px(14,14,2,2,'#403b48');
  px(1,15,1,1,'#444653');
  px(2,15,4,1,'#403b48'); px(9,15,5,1,'#403b48');
};

/** Os dois tiles como canvas 16×16 — a forma que `worldCanvas` consumia das imagens carregadas. */
export function cityTiles(): { fill: HTMLCanvasElement; surface: HTMLCanvasElement } {
  return { fill: pixelCanvas(16, 16, paintTileFill), surface: pixelCanvas(16, 16, paintTileSurface) };
}
