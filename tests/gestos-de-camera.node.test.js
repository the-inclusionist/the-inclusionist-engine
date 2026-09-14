// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A HAND, A FACE AND THE EYES DO, READ AS COMMANDS (ADR-0197; issue #189).
//
// The Dev's first webcam mappings, measured here on synthetic frames — landmarks, gesture names, blendshapes and head matrices built
// by hand — because the camera and the vision runtime are not in this tree. The thresholds are a first reading.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  GESTOS_ESTATICOS, criarLeitorDaMao, criarLeitorDoRosto, criarLeitorDosOlhos, formaDaMao, tresDedos, poseDaCabeca,
  ESPERA_MS, FIRMEZA_MS,
} from '../app/js/input/camera-gestures.js';

/** A hand of palm size `p` (wrist to middle base) with the wrist at (x, y); `dedos` = which of index…little are extended. */
function mao({ x = 0.5, y = 0.7, p = 0.1, dedos = [true, true, true, true], polegarDobrado = false } = {}) {
  const l = Array.from({ length: 21 }, () => ({ x, y }));
  l[0] = { x, y };
  const bases = [5, 9, 13, 17];
  const colunas = [-0.3, 0, 0.3, 0.55];
  dedos.forEach((est, i) => {
    const cx = x + colunas[i] * p;
    const base = bases[i];
    l[base] = { x: cx, y: y - p };
    l[base + 1] = { x: cx, y: y - 1.4 * p }; // middle joint
    l[base + 2] = { x: cx, y: est ? y - 1.8 * p : y - 1.2 * p };
    l[base + 3] = { x: cx, y: est ? y - 2.2 * p : y - 0.9 * p }; // tip: farther than the joint when extended, closer when folded
  });
  l[4] = polegarDobrado ? { x: x - 0.25 * p, y: y - 0.95 * p } : { x: x - 1.2 * p, y: y - 0.6 * p };
  l[9] = { x, y: y - p };
  return l;
}

const correr = (leitor, quadros) => quadros.map(([ms, q]) => leitor.quadro(ms, q)).filter(Boolean);

/** A head turned `yawGraus` and tilted `pitchGraus`, as MediaPipe's column-major 4×4 matrix: R = Ry(yaw) · Rx(-pitch). */
const rotacao = (yawGraus, pitchGraus) => {
  const y = (yawGraus * Math.PI) / 180, p = (pitchGraus * Math.PI) / 180;
  const cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(-p), sp = Math.sin(-p);
  const R = [[cy, sy * sp, sy * cp], [0, cp, -sp], [-sy, cy * sp, cy * cp]];
  const m = new Array(16).fill(0);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c * 4 + r] = R[r][c];
  m[15] = 1;
  return m;
};

describe('static hand gestures (ADR-0197 §1)', () => {
  it('🔴 [Right] the Dev\'s seven canned gestures map to their commands', () => {
    expect(GESTOS_ESTATICOS).toEqual({
      Closed_Fist: 'confirm', Open_Palm: 'menu', Pointing_Up: 'up', Thumb_Down: 'down', Thumb_Up: 'up', Victory: 'back', ILoveYou: 'menu',
    });
  });

  it('🔴 [Right] a gesture held past the steadiness time commands once, then waits', () => {
    const l = criarLeitorDaMao();
    const q = { landmarks: mao({ dedos: [false, false, false, false] }), gesto: 'Closed_Fist' };
    const saidas = [];
    for (let ms = 0; ms <= ESPERA_MS + FIRMEZA_MS - 10; ms += 33) { const c = l.quadro(ms, q); if (c) saidas.push([ms, c]); }
    expect(saidas.map((s) => s[1])).toEqual(['confirm']);
    expect(saidas[0][0]).toBeGreaterThanOrEqual(FIRMEZA_MS);
  });

  it('⚠️ [Boundary] a gesture shown for less than the steadiness time commands nothing; an unmapped one never', () => {
    const l = criarLeitorDaMao();
    expect(correr(l, [[0, { landmarks: mao(), gesto: 'Victory' }], [150, { landmarks: mao(), gesto: 'Victory' }], [200, { landmarks: mao(), gesto: 'None' }]])).toEqual([]);
    expect(correr(criarLeitorDaMao(), Array.from({ length: 20 }, (_, i) => [i * 50, { landmarks: mao(), gesto: 'None' }]))).toEqual([]);
  });
});

describe('the hand\'s shape and three fingers', () => {
  it('🔴 [Right] open, closed, and three fingers with the little finger and thumb folded', () => {
    expect([formaDaMao(mao()), formaDaMao(mao({ dedos: [false, false, false, false] })), formaDaMao(mao({ dedos: [true, false, false, false] }))])
      .toEqual(['aberta', 'fechada', 'outra']);
    expect(tresDedos(mao({ dedos: [true, true, true, false], polegarDobrado: true }))).toBe(true);
    expect(tresDedos(mao({ dedos: [true, true, true, true], polegarDobrado: true })), 'four fingers are not three').toBe(false);
    expect(tresDedos(mao({ dedos: [true, true, true, false], polegarDobrado: false })), 'the thumb out is not three').toBe(false);
  });

  it('🔴 [Right] three fingers held command «menu»', () => {
    const q = { landmarks: mao({ dedos: [true, true, true, false], polegarDobrado: true }) };
    expect(correr(criarLeitorDaMao(), Array.from({ length: 12 }, (_, i) => [i * 33, q]))).toEqual(['menu']);
  });
});

describe('moving hand gestures (ADR-0197 §2)', () => {
  it('🔴 [Right] the index moving up by more than the threshold commands «up»; moving down, «down»', () => {
    const sobe = criarLeitorDaMao();
    const ponto = [true, false, false, false];
    const quadros = [0, 50, 100, 150].map((ms, i) => {
      const m = mao({ dedos: ponto });
      m[8] = { x: m[8].x, y: m[8].y - i * 0.03 }; // 0.09 in 150 ms = 0.9 palms
      return [ms, { landmarks: m }];
    });
    expect(correr(sobe, quadros)).toEqual(['up']);
    const desce = criarLeitorDaMao();
    expect(correr(desce, quadros.map(([ms, q], i) => { const m = mao({ dedos: ponto }); m[8] = { x: m[8].x, y: m[8].y + i * 0.03 }; return [ms, { landmarks: m }]; })))
      .toEqual(['down']);
  });

  it('⚠️ [Boundary] a tremor under the threshold commands nothing — and the threshold is in palms, not pixels', () => {
    const treme = criarLeitorDaMao();
    const quadros = [0, 50, 100, 150].map((ms, i) => { const m = mao({ dedos: [true, false, false, false] }); m[8] = { x: m[8].x, y: m[8].y - (i % 2) * 0.02 }; return [ms, { landmarks: m }]; });
    expect(correr(treme, quadros)).toEqual([]);
    // the same 0.09 of the frame, for a hand twice as large (the child closer), is under the threshold
    const perto = criarLeitorDaMao();
    const grandes = [0, 50, 100, 150].map((ms, i) => { const m = mao({ dedos: [true, false, false, false], p: 0.2 }); m[8] = { x: m[8].x, y: m[8].y - i * 0.03 }; return [ms, { landmarks: m }]; });
    expect(correr(perto, grandes)).toEqual([]);
  });

  it('🔴 [Right] an open hand falling quickly commands «confirm»; a closed one, «back»', () => {
    const queda = (dedos) => [0, 60, 120, 180].map((ms, i) => [ms, { landmarks: mao({ dedos, y: 0.4 + i * 0.05 }) }]); // 1.5 palms in 180 ms
    expect(correr(criarLeitorDaMao(), queda([true, true, true, true]))).toEqual(['confirm']);
    expect(correr(criarLeitorDaMao(), queda([false, false, false, false]))).toEqual(['back']);
  });

  it('⚠️ [Boundary] a slow fall is no gesture', () => {
    const lenta = Array.from({ length: 16 }, (_, i) => [i * 100, { landmarks: mao({ y: 0.4 + i * 0.01 }) }]); // 0.1 palm every 100 ms
    expect(correr(criarLeitorDaMao(), lenta)).toEqual([]);
  });

  it('🔴 [Right] after a command the reader waits before the next one (ADR-0197 §5)', () => {
    const l = criarLeitorDaMao();
    const q = { landmarks: mao(), gesto: 'Open_Palm' };
    const saidas = correr(l, Array.from({ length: 40 }, (_, i) => [i * 33, q]));
    // 1.3 s of a steady palm: the first after 300 ms, the next only after the 500 ms wait and another 300 ms of steadiness
    expect(saidas).toEqual(['menu', 'menu']);
  });
});

describe('face and head (ADR-0197 §3)', () => {
  it('🔴 [Right] the head pose is read from the matrix', () => {
    const p = poseDaCabeca(rotacao(30, -10));
    expect([Math.round(p.yaw), Math.round(p.pitch)]).toEqual([30, -10]);
  });

  it('🔴 [Right] turn and tilt past the threshold, held, command the four directions', () => {
    const cmd = (yaw, pitch) => correr(criarLeitorDoRosto(), Array.from({ length: 12 }, (_, i) => [i * 33, { blendshapes: {}, matriz: rotacao(yaw, pitch) }]));
    expect([cmd(30, 0), cmd(-30, 0), cmd(0, 25), cmd(0, -25)]).toEqual([['right'], ['left'], ['up'], ['down']]);
    expect(cmd(10, 5), 'a small movement of the head commands nothing').toEqual([]);
  });

  it('🔴 [Right] mouth open → confirm, smile → menu, brows up → back', () => {
    const cmd = (b) => correr(criarLeitorDoRosto(), Array.from({ length: 12 }, (_, i) => [i * 33, { blendshapes: b, matriz: rotacao(0, 0) }]));
    expect([cmd({ jawOpen: 0.7 }), cmd({ mouthSmileLeft: 0.8, mouthSmileRight: 0.7 }), cmd({ browInnerUp: 0.6 })]).toEqual([['confirm'], ['menu'], ['back']]);
    expect(cmd({ jawOpen: 0.3 }), 'a mouth slightly open commands nothing').toEqual([]);
  });

  it('⚠️ [Boundary] a neutral pose the child calibrated is the zero', () => {
    const l = criarLeitorDoRosto({ yaw: 25, pitch: 0 });
    expect(correr(l, Array.from({ length: 12 }, (_, i) => [i * 33, { blendshapes: {}, matriz: rotacao(30, 0) }]))).toEqual([]);
  });

  it('⚠️ [Boundary] an expression is its rise from the face\'s rest: brows that rest high are not «back»; raised from there, they are', () => {
    const neutro = { yaw: 0, pitch: 0, pontuacoes: { browInnerUp: 0.6 } };
    const cmd = (b) => correr(criarLeitorDoRosto(neutro), Array.from({ length: 12 }, (_, i) => [i * 33, { blendshapes: b, matriz: rotacao(0, 0) }]));
    expect(cmd({ browInnerUp: 0.6 }), 'the face at rest commanded').toEqual([]);
    expect(cmd({ browInnerUp: 0.95 })).toEqual(['back']);
  });
});

describe('the eyes (ADR-0197 §4)', () => {
  /** Frames every 33 ms from `ate` blendshape states: [msStart, msEnd, blendshapes]. */
  const olhos = (trechos) => {
    const q = [];
    for (const [a, b, bs] of trechos) for (let ms = a; ms < b; ms += 33) q.push([ms, { blendshapes: bs }]);
    return q;
  };
  const aberto = {};
  const fechado = { eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 };
  const baixo = { eyeLookDownLeft: 0.7, eyeLookDownRight: 0.7 };
  const fechadoBaixo = { ...fechado, ...baixo };

  it('🔴 [Right] two quick blinks → confirm', () => {
    expect(correr(criarLeitorDosOlhos(), olhos([[0, 100, aberto], [100, 250, fechado], [250, 400, aberto], [400, 550, fechado], [550, 1500, aberto]])))
      .toEqual(['confirm']);
  });

  it('🔴 [Right] one slow blink → back', () => {
    expect(correr(criarLeitorDosOlhos(), olhos([[0, 100, aberto], [100, 800, fechado], [800, 1500, aberto]]))).toEqual(['back']);
  });

  it('🔴 [Right] two quick blinks while looking down → menu', () => {
    expect(correr(criarLeitorDosOlhos(), olhos([[0, 100, baixo], [100, 250, fechadoBaixo], [250, 330, baixo], [330, 480, fechadoBaixo], [480, 520, baixo], [520, 1500, aberto]])))
      .toEqual(['menu']);
  });

  it('🔴 [Zero] one ordinary quick blink commands nothing — it is how people blink', () => {
    expect(correr(criarLeitorDosOlhos(), olhos([[0, 100, aberto], [100, 250, fechado], [250, 2000, aberto]]))).toEqual([]);
  });

  it('⚠️ [Boundary] two quick blinks too far apart are two ordinary blinks', () => {
    expect(correr(criarLeitorDosOlhos(), olhos([[0, 100, aberto], [100, 250, fechado], [250, 1100, aberto], [1100, 1250, fechado], [1250, 2500, aberto]])))
      .toEqual([]);
  });

  it('⚠️ [Boundary] lids that rest low — eyes lowered to a screen — are open; a blink is their rise from rest', () => {
    const neutro = { yaw: 0, pitch: 0, pontuacoes: { eyeBlinkLeft: 0.6, eyeBlinkRight: 0.6 } };
    const repouso = { eyeBlinkLeft: 0.6, eyeBlinkRight: 0.6 }, arregalado = { eyeBlinkLeft: 0.4, eyeBlinkRight: 0.4 };
    const tremor = olhos([[0, 100, repouso], [100, 250, arregalado], [250, 400, repouso], [400, 550, arregalado], [550, 1500, repouso]]);
    expect(correr(criarLeitorDosOlhos(neutro), tremor), 'resting lids read as two quick blinks').toEqual([]);
    expect(correr(criarLeitorDosOlhos(neutro), olhos([[0, 100, repouso], [100, 250, fechado], [250, 400, repouso], [400, 550, fechado], [550, 1500, repouso]])))
      .toEqual(['confirm']);
  });

  it('🔴 [Zero] while the head is turned or tilted the eyes command nothing — they move against the head to keep the screen in view', () => {
    const cabeca = (matriz, trechos) => olhos(trechos).map(([ms, q]) => [ms, { ...q, matriz }]);
    const cima = [[0, 450, { eyeLookUpLeft: 0.8, eyeLookUpRight: 0.8 }]];
    expect(correr(criarLeitorDosOlhos(), cabeca(rotacao(0, -25), cima)), 'the head tilted down, the eyes up').toEqual([]);
    expect(correr(criarLeitorDosOlhos(), cabeca(rotacao(-30, 0), [[0, 100, aberto], [100, 250, fechado], [250, 400, aberto], [400, 550, fechado], [550, 1500, aberto]])))
      .toEqual([]);
    expect(correr(criarLeitorDosOlhos(), cabeca(rotacao(0, 0), cima)), 'the head at rest').toEqual(['up']);
    expect(correr(criarLeitorDosOlhos({ yaw: 0, pitch: -25 }), cabeca(rotacao(0, -25), cima)), 'rest is the calibrated pose').toEqual(['up']);
  });

  it('🔴 [Right] looking up or down, held, commands up or down', () => {
    expect(correr(criarLeitorDosOlhos(), olhos([[0, 450, { eyeLookUpLeft: 0.8, eyeLookUpRight: 0.8 }]]))).toEqual(['up']);
    expect(correr(criarLeitorDosOlhos(), olhos([[0, 450, baixo]]))).toEqual(['down']);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   G1 no steadiness time (a passing gesture commands)        🔴 held once · shown briefly
//   G2 no wait after a command                                 🔴 waits
//   G3 thresholds in frame units instead of palms              🔴 palms, not pixels
//   G4 a quick fall ignores the hand's shape                   🔴 open/closed fall
//   G5 a single quick blink commands confirm                   🔴 ordinary blink
//   G6 slow blink threshold at the quick one                   🔴 slow blink · (quick doubles)
//   G7 double blink ignores looking down                       🔴 menu
//   G8 the neutral pose ignored                                🔴 calibrated zero
//   G9 expressions read as absolute scores                     🔴 brows at rest · lids at rest
//   G10 the eyes read while the head is off rest               🔴 head turned or tilted
//   G11 the eyes' head check ignores the calibrated pose       🔴 head turned or tilted (rest is calibrated)
