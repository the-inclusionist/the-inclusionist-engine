// SPDX-License-Identifier: AGPL-3.0-or-later
// `motor.medirFlashes(ms)` READS WHAT THE GAME DRAWS AND SAYS WHETHER IT PASSES WCAG 2.3.1 (study item B2, cut 2).
//
// The rule is gated in `limiar-de-flashes.node`; this file gates the SAMPLER on a real canvas: a world that flashes too
// fast is reported (and lands in `problems`), a slow one passes, and a world the engine cannot read says so instead of
// passing by silence — a canvas never drawn reads transparent, which is what a WebGL canvas without a preserved buffer
// also returns.
// 📌 It runs only when asked: reading pixels every frame costs a school machine (pillar 1), so play never pays for it.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#mundo' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'alvo', gender: 'm', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'alvos', gender: 'm', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});

let motor;
let piscando = 0; // flashes per second the canvas draws; 0 = draw nothing at all
let parar = false;
let cores = ['#fff', '#000'];

beforeAll(async () => {
  document.body.innerHTML = '<p id="sr-status"></p><div id="game-region" tabindex="-1">'
    + '<div id="mundo"><canvas width="320" height="180"></canvas></div></div>';
  const canvas = document.querySelector('#mundo canvas');
  const ctx = canvas.getContext('2d');
  const desenhar = (agora) => {
    if (parar) return;
    ctx.clearRect(0, 0, 320, 180);
    if (piscando > 0) {
      ctx.fillStyle = Math.floor(agora / (1000 / (2 * piscando))) % 2 ? cores[0] : cores[1];
      ctx.fillRect(0, 0, 320, 180);
    }
    requestAnimationFrame(desenhar);
  };
  requestAnimationFrame(desenhar);
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false });
});
afterAll(() => { parar = true; });

describe('measuring what the world flashes', () => {
  it('🔴 [Right] a canvas flashing 6 times a second fails, and `problems` says so', async () => {
    piscando = 6;
    const r = await motor.measureFlashes(1600);
    expect(r.measured, r.reason).toBe(true);
    expect(r.passes, `worst second ${r.worstSecond}`).toBe(false);
    expect(r.worstSecond).toBeGreaterThanOrEqual(5);
    expect(motor.problems.some((p) => /2\.3\.1/.test(p)), 'the failure is not in problems').toBe(true);
  });

  it('🎯 [Boundary] a canvas flashing twice a second passes', async () => {
    piscando = 2;
    const r = await motor.measureFlashes(1600);
    expect(r.measured, r.reason).toBe(true);
    expect(r.passes, `worst second ${r.worstSecond}`).toBe(true);
  });

  it('🎯 [Boundary] luminance is RELATIVE luminance: grey 128↔100 at 6/s is a change of 0.089, no flash', async () => {
    // sRGB linearised, WCAG's formula: 128 → 0.216, 100 → 0.127. Read as raw values (0.502 → 0.392) it would be 0.11 and fail.
    cores = ['#808080', '#646464'];
    piscando = 6;
    const r = await motor.measureFlashes(1600);
    cores = ['#fff', '#000'];
    expect(r.measured, r.reason).toBe(true);
    expect(r.passes, `worst second ${r.worstSecond}: the colours were read as raw sRGB`).toBe(true);
  });

  it('🎯 [Boundary] a dim flicker #000↔#141414 at 6/s is a change of 0.007 — the cell is an AVERAGE of its pixels', async () => {
    cores = ['#141414', '#000000'];
    piscando = 6;
    const r = await motor.measureFlashes(1600);
    cores = ['#fff', '#000'];
    expect(r.measured, r.reason).toBe(true);
    expect(r.passes, `worst second ${r.worstSecond}: a cell summed its pixels instead of averaging them`).toBe(true);
  });

  it('🎯 [Zero] a canvas that reads transparent is NOT READ — never a pass by silence', async () => {
    piscando = 0;
    await new Promise((res) => setTimeout(res, 50));
    const r = await motor.measureFlashes(400);
    expect(r.measured, 'an unreadable canvas was reported as read').toBe(false);
    expect(r.passes, 'an unreadable canvas passed').toBeUndefined();
    expect(r.reason).toMatch(/transparent|preserveDrawingBuffer/);
  });

  it('🎯 [Zero] a world that is not a canvas and holds none is not read, and says why', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    const sem = createGame({
      accommodations: SEM_ASSUNTO, declaration: { ...declaracao(), world: () => ({ kind: 'element', selector: '#sr-status' }) },
      host: { doc: document, win: window }, downloadHeavy: false,
    });
    const r = await sem.measureFlashes(100);
    expect(r.measured).toBe(false);
    expect(r.reason).toMatch(/not a canvas/);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   S1 a failure is not written                       🔴 6/s
//   S2 `problems` does not read the measured lines     🔴 6/s
//   S3 a transparent canvas counts as read             🔴 transparent
//   S4 raw sRGB instead of relative luminance          🔴 grey 128↔100
//   S5 a cell sums its 100 pixels                      🔴 dim flicker — FIRST SURVIVED: the other cases gave the same verdict
//   S6 one frame is sampled and the time ignored       🔴 6/s
//   ⚠️ NOT gated: the cross-origin (tainted) canvas, and the claim that 160×120 sees a small flash a 16×12 draw would miss.
