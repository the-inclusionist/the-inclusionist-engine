// SPDX-License-Identifier: AGPL-3.0-or-later
// PAUSED IS ONLY THE WORD — white letters with a black outline, and no box (ADR-0155, erratum).
//
// «Borda nas letras, não numa caixa» (the Dev). The first build drew a dark rounded box with a light border; the
// rule is read from the stylesheet itself, because the look is the decision and no DOM case measures a box.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(process.cwd(), 'app', 'css', 'style.css'), 'utf8');
/** The declarations of the `.pausa-rapida{…}` rule (not the `[hidden]` one). */
function regra() {
  const m = CSS.match(/\.pausa-rapida\{([^}]*)\}/);
  return m ? m[1] : null;
}

describe('PAUSED is outlined white letters, with no box', () => {
  it('[Zero] the rule exists — otherwise every case below would pass on nothing', () => {
    expect(regra(), 'no `.pausa-rapida{…}` rule in style.css').not.toBeNull();
  });

  it('🔴 no box: no background and no border around the word', () => {
    expect(regra()).not.toMatch(/(^|;|\s)background\s*:/);
    expect(regra()).not.toMatch(/(^|;|\s)border(-radius)?\s*:/);
    expect(regra(), 'padding only makes sense for a box').not.toMatch(/(^|;|\s)padding\s*:/);
  });

  it('🎯 white letters with a BLACK outline on the letters', () => {
    expect(regra()).toMatch(/(^|;|\s)color\s*:\s*#fff\b/i);
    expect(regra(), 'no black stroke on the letters').toMatch(/-webkit-text-stroke\s*:\s*[^;]*#000/i);
    // the fallback where text-stroke is not drawn: a black shadow in every direction
    expect((regra().match(/#000/g) ?? []).length, 'the eight-direction shadow is missing').toBeGreaterThanOrEqual(9);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   B1 the dark background comes back           🔴 no box
//   B2 the light border comes back              🔴 no box
//   B3 the stroke is dropped                    🔴 black outline
