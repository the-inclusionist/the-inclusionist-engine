// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TWO MOTOR EMPATHY SIMULATIONS, AS KEY DECISIONS (ADR-0181; issue #177).
//
// 📌 The Dev: «trava-se o controle para nunca aceitar um segundo botão quando o primeiro estiver pressionado» and «"sem força
// para segurar botão", que lê qualquer contato permanente do botão como um toque só». A simulation makes play harder on
// purpose, to show a cost — it is not an accommodation.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createEmpathyFilter } from '../app/js/input/empathy-filter.js';

const DESLIGADAS = { noChords: false, noGripStrength: false };
const UM = { noChords: true, noGripStrength: false };
const FORCA = { noChords: false, noGripStrength: true };
const AMBAS = { noChords: true, noGripStrength: true };

describe('one button at a time', () => {
  it('🔴 [Right] while one game key is held, a second is never accepted — nor its release', () => {
    const f = createEmpathyFilter();
    expect(f.keydown('KeyD', false, UM)).toBe('passar');
    expect(f.keydown('Space', false, UM), 'the second key got through').toBe('barrar');
    expect(f.keyup('Space'), 'the release of a key the game never saw got through').toBe('barrar');
    expect(f.keyup('KeyD')).toBe('passar');
  });

  it('📌 [Right] once the first is released, another is accepted — and the held key\'s own repeats go on', () => {
    const f = createEmpathyFilter();
    f.keydown('KeyD', false, UM);
    expect(f.keydown('KeyD', true, UM), 'the held key\'s repeat was taken as a second button').toBe('passar');
    f.keyup('KeyD');
    expect(f.keydown('Space', false, UM)).toBe('passar');
  });

  it('🎯 [Zero] off, two keys together both pass', () => {
    const f = createEmpathyFilter();
    expect(f.keydown('KeyD', false, DESLIGADAS)).toBe('passar');
    expect(f.keydown('Space', false, DESLIGADAS)).toBe('passar');
  });
});

describe('no strength to hold', () => {
  it('🔴 [Right] a held key reads as one tap: the press passes and is released at once; its repeats and real release do not', () => {
    const f = createEmpathyFilter();
    expect(f.keydown('KeyD', false, FORCA), 'the press is not a tap').toBe('tocar');
    expect(f.keydown('KeyD', true, FORCA), 'holding kept pressing').toBe('barrar');
    expect(f.keyup('KeyD'), 'the real release came after the engine already released it').toBe('barrar');
    expect(f.keydown('KeyD', false, FORCA), 'a new press after the release is not a new tap').toBe('tocar');
  });

  it('📌 [Right] with both on, a second key while the first is physically held is still refused', () => {
    const f = createEmpathyFilter();
    expect(f.keydown('KeyD', false, AMBAS)).toBe('tocar');
    expect(f.keydown('Space', false, AMBAS)).toBe('barrar');
    expect(f.keyup('Space')).toBe('barrar');
    f.keyup('KeyD');
    expect(f.keydown('Space', false, AMBAS)).toBe('tocar');
  });

  it('🎯 [Zero] a key pressed with the simulations off is released normally after they turn on', () => {
    const f = createEmpathyFilter();
    f.keydown('KeyD', false, DESLIGADAS);
    expect(f.keyup('KeyD')).toBe('passar');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   M1 one-at-a-time lets the second key through            🔴 second never accepted
//   M2 the refused key's release passes                     🔴 second never accepted
//   M3 no-strength passes the repeat                        🔴 one tap
//   M4 no-strength passes the real release                  🔴 one tap
//   M5 a physically held tapped key not counted as held     🔴 both on
