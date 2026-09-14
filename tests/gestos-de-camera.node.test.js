// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT A HAND, A FACE AND THE EYES DO, READ AS COMMANDS (ADR-0197; issue #189).
//
// The Dev's webcam mappings, one group read at a time, measured here on synthetic frames — landmarks, gesture names, blendshapes and head matrices built
// by hand — because the camera and the vision runtime are not in this tree. The thresholds are a first reading.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  GESTOS_ESTATICOS, criarLeitorDosGestosEstaticos, criarLeitorDosGestosDinamicos, criarLeitorDoRosto, criarLeitorDosOlhos,
  criarLeitorDaCamera, GRUPOS_DA_CAMERA, formaDaMao, tresDedos, poseDaCabeca, ESPERA_MS, FIRMEZA_MS, REPOUSO_MS,
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
    const l = criarLeitorDosGestosEstaticos();
    const q = { landmarks: mao({ dedos: [false, false, false, false] }), gesto: 'Closed_Fist' };
    const saidas = [];
    for (let ms = 0; ms <= ESPERA_MS + FIRMEZA_MS - 10; ms += 33) { const c = l.quadro(ms, q); if (c) saidas.push([ms, c]); }
    expect(saidas.map((s) => s[1])).toEqual(['confirm']);
    expect(saidas[0][0]).toBeGreaterThanOrEqual(FIRMEZA_MS);
  });

  it('⚠️ [Boundary] a gesture shown for less than the steadiness time commands nothing; an unmapped one never', () => {
    const l = criarLeitorDosGestosEstaticos();
    expect(correr(l, [[0, { landmarks: mao(), gesto: 'Victory' }], [150, { landmarks: mao(), gesto: 'Victory' }], [200, { landmarks: mao(), gesto: 'None' }]])).toEqual([]);
    expect(correr(criarLeitorDosGestosEstaticos(), Array.from({ length: 20 }, (_, i) => [i * 50, { landmarks: mao(), gesto: 'None' }]))).toEqual([]);
  });

  it('🔴 [Right] a gesture held never commands twice; after the hand rests, it does (ADR-0197 errata)', () => {
    const palma = { landmarks: mao(), gesto: 'Open_Palm' };
    const nada = { landmarks: mao(), gesto: 'None' };
    const trechos = (...partes) => { const q = []; let ms = 0; for (const [dur, quadro] of partes) for (const fim = ms + dur; ms < fim; ms += 33) q.push([ms, quadro]); return q; };
    expect(correr(criarLeitorDosGestosEstaticos(), trechos([2000, palma])), 'a held palm repeated').toEqual(['menu']);
    expect(correr(criarLeitorDosGestosEstaticos(), trechos([1000, palma], [REPOUSO_MS + 100, nada], [1000, palma]))).toEqual(['menu', 'menu']);
    expect(correr(criarLeitorDosGestosEstaticos(), trechos([1000, palma], [100, nada], [1000, palma])), 'a flicker of the recogniser taken for rest')
      .toEqual(['menu']);
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
    expect(correr(criarLeitorDosGestosDinamicos(), Array.from({ length: 60 }, (_, i) => [i * 33, q])), 'three fingers held repeated').toEqual(['menu']);
  });
});

describe('moving hand gestures (ADR-0197 §2)', () => {
  it('🔴 [Right] the index moving up by more than the threshold commands «up»; moving down, «down»', () => {
    const sobe = criarLeitorDosGestosDinamicos();
    const ponto = [true, false, false, false];
    const quadros = [0, 50, 100, 150].map((ms, i) => {
      const m = mao({ dedos: ponto });
      m[8] = { x: m[8].x, y: m[8].y - i * 0.03 }; // 0.09 in 150 ms = 0.9 palms
      return [ms, { landmarks: m }];
    });
    expect(correr(sobe, quadros)).toEqual(['up']);
    const desce = criarLeitorDosGestosDinamicos();
    expect(correr(desce, quadros.map(([ms, q], i) => { const m = mao({ dedos: ponto }); m[8] = { x: m[8].x, y: m[8].y + i * 0.03 }; return [ms, { landmarks: m }]; })))
      .toEqual(['down']);
  });

  it('⚠️ [Boundary] a tremor under the threshold commands nothing — and the threshold is in palms, not pixels', () => {
    const treme = criarLeitorDosGestosDinamicos();
    const quadros = [0, 50, 100, 150].map((ms, i) => { const m = mao({ dedos: [true, false, false, false] }); m[8] = { x: m[8].x, y: m[8].y - (i % 2) * 0.02 }; return [ms, { landmarks: m }]; });
    expect(correr(treme, quadros)).toEqual([]);
    // the same 0.09 of the frame, for a hand twice as large (the child closer), is under the threshold
    const perto = criarLeitorDosGestosDinamicos();
    const grandes = [0, 50, 100, 150].map((ms, i) => { const m = mao({ dedos: [true, false, false, false], p: 0.2 }); m[8] = { x: m[8].x, y: m[8].y - i * 0.03 }; return [ms, { landmarks: m }]; });
    expect(correr(perto, grandes)).toEqual([]);
  });

  it('🔴 [Right] an open hand falling quickly commands «confirm»; a closed one, «back»', () => {
    const queda = (dedos) => [0, 60, 120, 180].map((ms, i) => [ms, { landmarks: mao({ dedos, y: 0.4 + i * 0.05 }) }]); // 1.5 palms in 180 ms
    expect(correr(criarLeitorDosGestosDinamicos(), queda([true, true, true, true]))).toEqual(['confirm']);
    expect(correr(criarLeitorDosGestosDinamicos(), queda([false, false, false, false]))).toEqual(['back']);
  });

  it('⚠️ [Boundary] a slow fall is no gesture', () => {
    const lenta = Array.from({ length: 16 }, (_, i) => [i * 100, { landmarks: mao({ y: 0.4 + i * 0.01 }) }]); // 0.1 palm every 100 ms
    expect(correr(criarLeitorDosGestosDinamicos(), lenta)).toEqual([]);
  });

  it('🔴 [Right] after a command the reader waits before the next one (ADR-0197 §5)', () => {
    const l = criarLeitorDosGestosEstaticos();
    const saidas = [];
    for (let ms = 0; ms < 1500; ms += 33) {
      const c = l.quadro(ms, { landmarks: mao(), gesto: ms < 400 ? 'Closed_Fist' : 'Victory' });
      if (c) saidas.push([ms, c]);
    }
    expect(saidas.map((s) => s[1])).toEqual(['confirm', 'back']);
    expect(saidas[1][0] - saidas[0][0], 'the next gesture did not wait').toBeGreaterThanOrEqual(ESPERA_MS);
  });

  it('⚠️ [Boundary] a hand still falling after its gesture is not a second one; still, then falling again, it is', () => {
    const cai = (y0, n, t0) => Array.from({ length: n }, (_, i) => [t0 + i * 60, { landmarks: mao({ dedos: [true, true, true, true], y: y0 + i * 0.05 }) }]);
    const parada = (y, t0, dur) => Array.from({ length: Math.ceil(dur / 60) }, (_, i) => [t0 + i * 60, { landmarks: mao({ y }) }]);
    expect(correr(criarLeitorDosGestosDinamicos(), cai(0.1, 16, 0)), 'one long fall commanded twice').toEqual(['confirm']);
    expect(correr(criarLeitorDosGestosDinamicos(), [...cai(0.1, 4, 0), ...parada(0.25, 240, 900), ...cai(0.25, 4, 1200)])).toEqual(['confirm', 'confirm']);
  });
});

describe('face and head (ADR-0197 §3)', () => {
  it('🔴 [Right] the head pose is read from the matrix', () => {
    const p = poseDaCabeca(rotacao(30, -10));
    expect([Math.round(p.yaw), Math.round(p.pitch)]).toEqual([30, -10]);
  });

  it('🔴 [Right] turn and tilt up past the threshold, held, command right, left and up; a tilt down commands nothing (ADR-0199)', () => {
    const cmd = (yaw, pitch) => correr(criarLeitorDoRosto(), Array.from({ length: 12 }, (_, i) => [i * 33, { blendshapes: {}, matriz: rotacao(yaw, pitch) }]));
    expect([cmd(30, 0), cmd(-30, 0), cmd(0, 25), cmd(0, -25)]).toEqual([['right'], ['left'], ['up'], []]);
    expect(cmd(10, 5), 'a small movement of the head commands nothing').toEqual([]);
  });

  it('🔴 [Right] mouth open → down, pucker → confirm, smile → menu, brows up → back (ADR-0199)', () => {
    const cmd = (b) => correr(criarLeitorDoRosto(), Array.from({ length: 12 }, (_, i) => [i * 33, { blendshapes: b, matriz: rotacao(0, 0) }]));
    expect([cmd({ jawOpen: 0.7 }), cmd({ mouthPucker: 0.8 }), cmd({ mouthSmileLeft: 0.8, mouthSmileRight: 0.7 }), cmd({ browInnerUp: 0.6 })])
      .toEqual([['down'], ['confirm'], ['menu'], ['back']]);
    const inclinada = correr(criarLeitorDoRosto(), Array.from({ length: 12 }, (_, i) => [i * 33, { blendshapes: { jawOpen: 0.8 }, matriz: rotacao(0, -25) }]));
    expect(inclinada, 'a mouth opened while the head tilts down still says down').toEqual(['down']);
    expect(cmd({ jawOpen: 0.3 }), 'a mouth slightly open commands nothing').toEqual([]);
  });

  it('🔴 [Right] a head held turned commands once; back at rest and turned again, twice (ADR-0197 errata)', () => {
    const quadros = (partes) => { const q = []; let ms = 0; for (const [dur, yaw] of partes) for (const fim = ms + dur; ms < fim; ms += 33) q.push([ms, { blendshapes: {}, matriz: rotacao(yaw, 0) }]); return q; };
    expect(correr(criarLeitorDoRosto(), quadros([[2000, 30]]))).toEqual(['right']);
    expect(correr(criarLeitorDoRosto(), quadros([[1000, 30], [REPOUSO_MS + 100, 0], [1000, 30]]))).toEqual(['right', 'right']);
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
  const cima = { eyeLookUpLeft: 0.8, eyeLookUpRight: 0.8 };

  /** Two quick blinks, or one slow one, with the eyes held at `olhar` (ADR-0202). */
  const duas = (olhar) => olhos([[0, 100, olhar], [100, 250, { ...fechado, ...olhar }], [250, 400, olhar], [400, 550, { ...fechado, ...olhar }], [550, 1500, olhar]]);
  const lenta = (olhar) => olhos([[0, 100, olhar], [100, 800, { ...fechado, ...olhar }], [800, 1500, olhar]]);

  it('🔴 [Right] look up and blink twice → up; look down and blink twice → down; looking ahead, nothing (ADR-0202)', () => {
    expect([correr(criarLeitorDosOlhos(), duas(cima)), correr(criarLeitorDosOlhos(), duas(baixo)), correr(criarLeitorDosOlhos(), duas(aberto))])
      .toEqual([['up'], ['down'], []]);
  });

  it('🔴 [Right] a slow blink looking up → confirm, looking down → back, looking ahead → menu (ADR-0202)', () => {
    expect([correr(criarLeitorDosOlhos(), lenta(cima)), correr(criarLeitorDosOlhos(), lenta(baixo)), correr(criarLeitorDosOlhos(), lenta(aberto))])
      .toEqual([['confirm'], ['back'], ['menu']]);
  });

  it('⚠️ [Boundary] a camera above the screen: eyes resting low, a weak look up is still up — the look is one axis from rest', () => {
    const neutro = { yaw: 0, pitch: 0, pontuacoes: { eyeLookDownLeft: 0.35, eyeLookDownRight: 0.35 } };
    const repouso = { eyeLookDownLeft: 0.35, eyeLookDownRight: 0.35 };
    const olharFraco = { eyeLookUpLeft: 0.3, eyeLookUpRight: 0.34 }; // measured 2026-09-14: the Dev's look up reached 0.34
    const lentaCom = (olhar) => olhos([[0, 100, olhar], [100, 800, { ...fechado, ...olhar }], [800, 1500, olhar]]);
    expect(correr(criarLeitorDosOlhos(neutro), lentaCom(olharFraco)), 'a look up from a low rest was not up').toEqual(['confirm']);
    expect(correr(criarLeitorDosOlhos(neutro), lentaCom(repouso)), 'rest itself read as a look down').toEqual(['menu']);
  });

  it('⚠️ [Boundary] two quick blinks with the look changed between them are no command', () => {
    expect(correr(criarLeitorDosOlhos(), olhos([[0, 100, cima], [100, 250, { ...fechado, ...cima }], [250, 400, baixo], [400, 550, { ...fechado, ...baixo }], [550, 1500, aberto]])))
      .toEqual([]);
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
    expect(correr(criarLeitorDosOlhos(neutro), olhos([[0, 100, repouso], [100, 800, fechado], [800, 1500, repouso]])), 'a real slow blink from rest')
      .toEqual(['menu']);
  });

  it('🔴 [Zero] while the head is turned or tilted the eyes command nothing — they move against the head to keep the screen in view', () => {
    const cabeca = (matriz, trechos) => olhos(trechos).map(([ms, q]) => [ms, { ...q, matriz }]);
    const olharEPiscar = [[0, 100, cima], [100, 250, { ...fechado, ...cima }], [250, 400, cima], [400, 550, { ...fechado, ...cima }], [550, 1500, cima]];
    expect(correr(criarLeitorDosOlhos(), cabeca(rotacao(0, -25), olharEPiscar)), 'the head tilted down, the eyes up').toEqual([]);
    expect(correr(criarLeitorDosOlhos(), cabeca(rotacao(-30, 0), [[0, 100, aberto], [100, 250, fechado], [250, 400, aberto], [400, 550, fechado], [550, 1500, aberto]])))
      .toEqual([]);
    expect(correr(criarLeitorDosOlhos(), cabeca(rotacao(0, 0), olharEPiscar)), 'the head at rest').toEqual(['up']);
    expect(correr(criarLeitorDosOlhos({ yaw: 0, pitch: -25 }), cabeca(rotacao(0, -25), olharEPiscar)), 'rest is the calibrated pose').toEqual(['up']);
  });

  it('🔴 [Zero] a plain look up or down commands nothing (ADR-0199)', () => {
    expect(correr(criarLeitorDosOlhos(), olhos([[0, 2500, cima]]))).toEqual([]);
    expect(correr(criarLeitorDosOlhos(), olhos([[0, 2500, baixo]]))).toEqual([]);
  });

  it('🔴 [Zero] one quick blink looking up or down commands nothing — a single blink is not worth it (ADR-0202)', () => {
    const uma = (olhar) => olhos([[0, 300, olhar], [300, 450, { ...fechado, ...olhar }], [450, 2500, olhar]]);
    expect([correr(criarLeitorDosOlhos(), uma(cima)), correr(criarLeitorDosOlhos(), uma(baixo))]).toEqual([[], []]);
  });
});

describe('one group at a time (ADR-0197 errata)', () => {
  const quadros = (n, q) => Array.from({ length: n }, (_, i) => [i * 33, q]);
  const punho = { landmarks: mao({ dedos: [false, false, false, false] }), gesto: 'Closed_Fist' };

  it('🔴 [Right] four groups, in the order the Dev named them', () => {
    expect(GRUPOS_DA_CAMERA).toEqual(['dinamicos', 'rostoEOlhos', 'olhos', 'estaticos']);
  });

  it('🔴 [Zero] reading moving gestures, a held fist commands nothing; reading static gestures, it confirms', () => {
    expect(correr(criarLeitorDaCamera('dinamicos'), quadros(30, punho))).toEqual([]);
    expect(correr(criarLeitorDaCamera('estaticos'), quadros(30, punho))).toEqual(['confirm']);
  });

  it('🔴 [Zero] reading static gestures, a moving index and three fingers command nothing', () => {
    const indice = [0, 50, 100, 150].map((ms, i) => { const m = mao({ dedos: [true, false, false, false] }); m[8] = { x: m[8].x, y: m[8].y - i * 0.03 }; return [ms, { landmarks: m }]; });
    expect(correr(criarLeitorDaCamera('estaticos'), indice)).toEqual([]);
    expect(correr(criarLeitorDaCamera('estaticos'), quadros(30, { landmarks: mao({ dedos: [true, true, true, false], polegarDobrado: true }) }))).toEqual([]);
    expect(correr(criarLeitorDaCamera('dinamicos'), indice)).toEqual(['up']);
  });

  it('🔴 [Zero] reading the eyes, the head and the mouth command nothing, and no hand is read', () => {
    expect(correr(criarLeitorDaCamera('olhos'), quadros(30, { blendshapes: { jawOpen: 0.9 }, matriz: rotacao(30, 0), ...punho }))).toEqual([]);
    expect(correr(criarLeitorDaCamera('rostoEOlhos'), quadros(30, { blendshapes: {}, matriz: rotacao(0, 0), ...punho })), 'the face group read a hand').toEqual([]);
  });

  it('🔴 [Right] reading face and eyes, a mouth opened and a slow blink looking ahead both command', () => {
    const f = { eyeBlinkLeft: 0.9, eyeBlinkRight: 0.9 };
    const q = [];
    for (let ms = 0; ms < 700; ms += 33) q.push([ms, { blendshapes: { jawOpen: 0.8 }, matriz: rotacao(0, 0) }]);
    const piscadas = [[700, 1300, {}], [1300, 2000, f], [2000, 2600, {}]]; // a slow blink looking ahead → menu
    for (const [a, b, bs] of piscadas) for (let ms = a; ms < b; ms += 33) q.push([ms, { blendshapes: bs, matriz: rotacao(0, 0) }]);
    expect(correr(criarLeitorDaCamera('rostoEOlhos'), q)).toEqual(['down', 'menu']);
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
//   G12 a held signal repeats (the last command forgotten)     🔴 held never twice · head held · look held · three fingers
//   G13 a flicker counts as rest                               🔴 held never twice (flicker)
//   G14 a motion re-arms without the hand stilling (or at once) 🔴 still falling
//   G15 the moving group reads static gestures                 🔴 held fist
//   G16 the eyes group reads the face                          🔴 head and mouth
//   G17 the face group reads the hand readers                  🔴 face and eyes both command
//   G18 a tilt down commands down again                         🔴 turn and tilt up
//   G19 the mouth back to confirm, the pucker unread            🔴 mouth open → down, pucker → confirm
//   G20 a plain look commands                                   🔴 a plain look commands nothing
//   G23 a single quick blink commands again                      🔴 one quick blink commands nothing
//   G24 a double ignores the look (always up)                    🔴 blink twice · looking ahead · look changed
//   G25 a slow blink ignores the look (always back)              🔴 slow blink looking up/down/ahead
//   G26 two blinks with different looks still command            🔴 look changed between them
//   G27 the look read per score against 0.5 (not one axis)      🔴 camera above the screen
//   G28 the look's axis ignores rest                             🔴 camera above the screen (rest read as down)
