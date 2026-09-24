// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CHARACTER PROBE — the instrument the "kage bunshin" report asked for, and why it lives in the debug panel.
//
// ========================= THE PROBLEM IT SOLVES =========================
// The Dev reported several copies of the character at different positions during the jump and idle. Four causes were
// ruled out by measurement — an orphan sprite in the scene, a wrong crop in the atlas (39 frames checked against the
// source, zero divergence), render-texture build-up (it exists only with 2+ players) and the accessibility bar. What is
// left lives in the moving frames, and those can only be seen on the Dev's screen.
//
// The probe exists so the MEASUREMENT can go where the screen is. It records a few seconds of frames and reduces
// everything to three questions that separate the remaining causes:
//
//   · how many distinct TEXTURES appeared, and each one's crop — a base larger than the crop is atlas bleeding (the
//     character appears with its neighbours inside its own frame);
//   · whether some SIBLING of the camera drew the character too — the case of someone drawing twice;
//   · which SCALES appeared — squash & stretch moves them, and a wild scale deforms without duplicating.
//
// If all three come back clean, the cause is in composition (post-effect, filter, camera) and not in the sprite — and
// that is an answer too.
//
// ========================= WHY A SUMMARY, AND NOT THE RAW DATA =========================
// 180 frames of raw data in a panel is a wall of numbers nobody reads, and in the console it is worse: the Dev asked
// explicitly for the probe to go INTO the panel. What they need to read is three lines.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { summariseProbe } from '../app/js/ui/debug-panel.js';

/** A clean sample: a crop that fills the whole base, with no siblings. */
const limpa = (tex, pos) => ({
  textureId: tex, crop: '0,0 26x35', base: '26x35', position: pos, scale: '1.00,1.00',
  siblingsDrawing: 0, siblingPositions: '',
});

describe('sonda do personagem · o resumo que separa as causas', () => {
  it('[Zero] sem amostras, diz que não gravou nada — e não inventa diagnóstico', () => {
    const r = summariseProbe([]);
    expect(r.frames).toBe(0);
    expect(r.verdict).toContain('nada');
  });

  it('[Right] quadros limpos → nenhum suspeito, e o veredito diz onde procurar em seguida', () => {
    const as = [limpa(0, '10,20'), limpa(1, '10,20'), limpa(2, '11,18'), limpa(3, '11,18')];
    const r = summariseProbe(as);
    expect(r.frames).toBe(4);
    expect(r.textures).toBe(4);
    expect(r.maxSiblings).toBe(0);
    expect(r.sangramento).toEqual([]);
    // The verdict must NOT say all is well: three clean questions move the search, they do not end it. Saying ok here
    // would turn absence of proof into proof of absence.
    expect(r.verdict).toMatch(/composi|filtro|câmera/i);
  });

  it('[Right] IRMÃO desenhando o personagem é apontado, com quantos e onde', () => {
    const as = [limpa(0, '10,20'), { ...limpa(1, '10,20'), siblingsDrawing: 2, siblingPositions: '40,20 70,20' }];
    const r = summariseProbe(as);
    expect(r.maxSiblings).toBe(2);
    expect(r.verdict).toMatch(/duas vezes|irmão/i);
    expect(r.siblingExample).toBe('40,20 70,20');
  });

  it('[Right] SANGRAMENTO de atlas é apontado por textura, com o recorte e a base', () => {
    // The case that describes the defect sought: a 26×35 crop on a 256×207 base is the right frame inside the atlas; the
    // problem is when the CROP is larger than the frame and swallows the neighbours. The heuristic here is what the probe
    // can see from outside: a crop larger than the base is impossible, and a crop covering the whole base when the base is
    // too big for one frame is suspect.
    const as = [{ ...limpa(0, '10,20'), crop: '0,0 256x207', base: '256x207' }];
    const r = summariseProbe(as);
    expect(r.sangramento).toHaveLength(1);
    expect(r.sangramento[0]).toContain('256x207');
    expect(r.verdict).toMatch(/recorte|atlas/i);
  });

  it('[Boundary] escalas distintas são listadas — o squash deforma sem duplicar', () => {
    const as = [limpa(0, '10,20'), { ...limpa(1, '10,20'), scale: '1.20,0.80' }];
    const r = summariseProbe(as);
    expect(r.scales).toEqual(['1.00,1.00', '1.20,0.80']);
  });

  it('[Interface] IRMÃO vence SANGRAMENTO no veredito — a causa mais grave primeiro', () => {
    // When both appear, what matters first is someone drawing twice: it is the cause that produces WHOLE copies at
    // different positions, which is exactly what was reported.
    const as = [{ ...limpa(0, '10,20'), crop: '0,0 256x207', base: '256x207', siblingsDrawing: 1, siblingPositions: '40,20' }];
    expect(summariseProbe(as).verdict).toMatch(/duas vezes|irmão/i);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · swapping the verdict's order (bleeding before sibling) → the [Interface] sibling-wins case fails.
//   · returning all ok when the three questions come back clean → the [Right] clean-frames case fails, and the real effect
//     would be worse than the test: it would end the search in the wrong place.
//   · counting `texturas` by equal crop instead of by id → the [Right] clean-frames case fails with 1, exactly the error
//     made when measuring by hand: the four idle frames have the same geometry.
