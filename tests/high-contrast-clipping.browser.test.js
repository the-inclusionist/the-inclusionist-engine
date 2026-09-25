// SPDX-License-Identifier: AGPL-3.0-or-later
// THE "KAGE BUNSHIN": high contrast outlining the WHOLE ATLAS — several copies of the character, in different poses, in a
// regular grid.
//
// ========================= THE DEFECT =========================
// `directSpriteTexture` draws the dark outline that makes a sprite stand out in high contrast. A sprite packed in an
// ATLAS is a CROP (`frame`) inside a larger image; outlining the texture's BASE instead of its frame draws the whole
// atlas — every frame of the character, in a grid, at once. It passes build and tests and only shows on screen, so the
// gate is here: the outline must respect the texture's frame.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { createHighContrast } from '../app/js/render/high-contrast.js';

/** A "sheet" with 4 frames of 10×10 side by side — the atlas in miniature. */
function folhaDeQuadros() {
  const cv = document.createElement('canvas');
  cv.width = 40; cv.height = 10;
  const c = cv.getContext('2d');
  for (let i = 0; i < 4; i++) { c.fillStyle = ['#f00', '#0f0', '#00f', '#ff0'][i]; c.fillRect(i * 10, 0, 10, 10); }
  return cv;
}

/** The minimal `PIXI.Texture` surface `directSpriteTexture` touches, with a CROP inside the sheet. */
function texturaComRecorte(fonte, recorte) {
  return {
    orig: { width: recorte.width, height: recorte.height },
    frame: recorte,
    baseTexture: { valid: true, resource: { source: fonte }, once: () => {} },
  };
}

/** The world's high contrast, rebuilt per case (ADR-0232 D4: an instance, not module state). */
let hc;
/** `createHighContrast` asks for a handful of the game's reads; here only the outline matters. */
function ligarHC(espessura) {
  hc = createHighContrast({ doc: document, store: createStorage(memoryBackend()),
    outlineFg: () => espessura,
    outlineBg: () => 0,
    getWorldCanvasNormal: () => document.createElement('canvas'),
    getWorldTexNormal: () => null,
    roleOf: () => 'chao',
  });
}

describe('alto contraste · o contorno respeita o RECORTE do quadro', () => {
  it('[Right] um quadro DENTRO de uma folha vira um sprite do tamanho do QUADRO', () => {
    // The defect's case, written inside out: a 10×10 crop inside a 40×10 sheet. Without respecting the crop, the result
    // is 40 wide — the four frames at once, which is the kage bunshin.
    ligarHC(1);
    const t = hc.directSpriteTexture(texturaComRecorte(folhaDeQuadros(), { x: 20, y: 0, width: 10, height: 10 }), 'hc-direto');
    const cv = t.baseTexture.resource.source;
    expect(cv.width, 'o contorno pegou a folha inteira — é o "kage bunshin"').toBeLessThan(20);
    expect(cv.height).toBeLessThan(20);
  });

  it('[Right] e é o quadro CERTO: o recorte pedido, não o primeiro da folha', () => {
    // Respecting the SIZE and taking the wrong frame would trade a visible defect for an invisible one: the character
    // would stand out in high contrast showing another animation's pose — and nobody would connect the two.
    //
    // Thickness 1, not 0: thickness 0 is a shortcut that never crops, and with it the case passed with the mutation
    // "always crop at 0,0" applied. Reading the PIXEL is what makes it bite.
    ligarHC(1);
    const t = hc.directSpriteTexture(texturaComRecorte(folhaDeQuadros(), { x: 20, y: 0, width: 10, height: 10 }), 'hc-direto');
    const cv = t.baseTexture.resource.source;
    const c = cv.getContext('2d');
    const meio = c.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data;
    // The sheet's third frame is BLUE (#00f). The first is red — which is what the mutation would bring.
    expect([meio[0], meio[1], meio[2]], 'o recorte pegou o quadro errado da folha').toEqual([0, 0, 255]);
  });

  it('[Boundary] textura SEM recorte (a folha inteira é o quadro) continua funcionando', () => {
    // A frame that is its own canvas: there the crop IS the whole base. The fix must not break the path that was
    // already right.
    ligarHC(1);
    const fonte = folhaDeQuadros();
    const t = hc.directSpriteTexture(texturaComRecorte(fonte, { x: 0, y: 0, width: 40, height: 10 }), 'hc-direto');
    const cv = t.baseTexture.resource.source;
    expect(cv.width).toBeGreaterThanOrEqual(40);
  });

  it('[Zero] espessura 0 devolve a origem — sem canvas novo, sem cópia', () => {
    ligarHC(0);
    const orig = texturaComRecorte(folhaDeQuadros(), { x: 0, y: 0, width: 10, height: 10 });
    expect(hc.directSpriteTexture(orig, 'hc-direto')).toBe(orig);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · returning `outlineCanvas(s, th)` over the base (the old code) → the [Right] case of a frame INSIDE a sheet fails
//     with width 42, which is the whole sheet outlined.
//   · always cropping at 0,0 → the [Right] case of the RIGHT frame fails.
