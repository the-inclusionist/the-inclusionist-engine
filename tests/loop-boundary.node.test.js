// SPDX-License-Identifier: AGPL-3.0-or-later
// THE FRAME LOOP MUST FAIL LOUDLY — a game that throws cannot become a frozen screen and silence.
//
// ========================= THE DEFECT THIS CLOSES =========================
// `startLoop` registers the frame function on the ticker. Unguarded, a frame that throws throws AGAIN on the next frame,
// and the next, forever: the screen freezes, the console fills, and nothing on screen says what happened.
//
// It is D16 of the `demos` spec, and the reason there is scale: "across 383 games, one bad game has to be
// distinguishable from a broken engine". The reason here is another and more urgent — **a blind child does not see a
// frozen screen**. Without an announcement, blind mode cannot tell "the game froze" from "the game is thinking", and
// the only information the child has is silence.
//
// ========================= FAIL LOUDLY, NOT QUIETLY =========================
// The temptation is `try { frame() } catch { /* segue */ }`, and it is worse than the defect: it turns a hard crash into
// a silently wrong game, running forever computing garbage. The rule here is the one ADR-0047 applied to the CRT: catch
// ONCE, STOP, and ANNOUNCE.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import * as loopModule from '../app/js/core/loop.js';
import { startLoop } from '../app/js/core/loop.js';

/** A minimal ticker with the shape `startLoop` asks for, and with `remove` to prove the loop unregisters itself. */
function fakeTicker(deltaTime = 1) {
  const fns = [];
  return {
    deltaTime,
    add: (fn) => fns.push(fn),
    remove: (fn) => { const i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); },
    /** Runs one frame. Returns how many functions are still registered. */
    tick() { [...fns].forEach((f) => f()); return fns.length; },
    get inscritas() { return fns.length; },
  };
}

describe('core/loop · o laço para e anuncia quando o quadro lança', () => {
  it('[Right] sem exceção, nada muda — o quadro roda a cada tick, com o dt clampado', () => {
    const t = fakeTicker(5);
    const dts = [];
    startLoop(t, (dt) => dts.push(dt), 2, { speed: () => 1 });
    t.tick(); t.tick();
    expect(dts, 'dt clampado em maxDt').toEqual([2, 2]);
  });

  it('[Right] quando o quadro lança, o laço PARA de chamá-lo', () => {
    const t = fakeTicker();
    let chamadas = 0;
    startLoop(t, () => { chamadas++; throw new Error('jogo quebrou'); }, 2, { speed: () => 1, onFailure: () => {} });
    t.tick();
    t.tick();
    t.tick();
    expect(chamadas, 'chamou uma vez e nunca mais').toBe(1);
  });

  it('[Right] e ANUNCIA, com o erro, uma vez só', () => {
    // The announcement is the point: it is the only channel of whoever cannot see the screen freeze.
    const t = fakeTicker();
    const falhas = [];
    const boom = new Error('jogo quebrou');
    startLoop(t, () => { throw boom; }, 2, { speed: () => 1, onFailure: (e) => falhas.push(e) });
    t.tick(); t.tick();
    expect(falhas).toEqual([boom]);
  });

  it('[Boundary] o laço se DESREGISTRA do ticker, não fica rodando um no-op', () => {
    // A difference that matters on weak hardware: a callback running 60 times a second to do nothing still costs. And it
    // leaves the ticker lying about how many things the game has.
    const t = fakeTicker();
    startLoop(t, () => { throw new Error('x'); }, 2, { speed: () => 1, onFailure: () => {} });
    expect(t.inscritas).toBe(1);
    t.tick();
    expect(t.inscritas, 'saiu do ticker').toBe(0);
  });

  it('[Boundary] ticker SEM `remove` também para — degrada, não quebra', () => {
    // The type asks only for `add` and `deltaTime`. A ticker without `remove` cannot unregister, but it still must not
    // call the frame again.
    const fns = [];
    const t = { deltaTime: 1, add: (fn) => fns.push(fn) };
    let chamadas = 0;
    startLoop(t, () => { chamadas++; throw new Error('x'); }, 2, { speed: () => 1, onFailure: () => {} });
    fns[0](); fns[0](); fns[0]();
    expect(chamadas).toBe(1);
  });

  it('[Zero] a caller that omits `onFailure` (plain JavaScript) still stops — stopping never depends on the notice', () => {
    // The type REQUIRES it (ADR-0232 D4); this is the caller the type cannot reach, and the latch must still hold.
    const t = fakeTicker();
    let chamadas = 0;
    expect(() => {
      startLoop(t, () => { chamadas++; throw new Error('x'); }, 2, { speed: () => 1 });
      t.tick(); t.tick();
    }, 'a exceção não pode escapar para o ticker').not.toThrow();
    expect(chamadas).toBe(1);
  });

  // ADR-0232 D4 (the D2b erratum's reasoning): the root used to REGISTER a default notice here, and a registration a root
  // fills is module state — a second root overwrote the first root's notice. The notice is now each caller's own.
  it('🔴 [Interface] the module holds no notice: there is nothing to register, only `startLoop`', () => {
    expect(Object.keys(loopModule), 'a registration came back to core/loop').toEqual(['startLoop']);
  });
  it('[Interface] o que `onFailure` lançar não pode ressuscitar o problema', () => {
    // If the announcement itself breaks (no screen reader, the DOM is gone), that cannot become an exception inside the
    // ticker — which is where it would be invisible again.
    const t = fakeTicker();
    expect(() => {
      startLoop(t, () => { throw new Error('x'); }, 2, { speed: () => 1, onFailure: () => { throw new Error('o anúncio também'); } });
      t.tick();
    }).not.toThrow();
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · removing `parado = true` (only calling `remove`) → "[Boundary] ticker SEM `remove`" fails, and the real effect
//     is the loop still calling the broken frame on any ticker that cannot remove.
//   · replacing the `catch` with `catch { /* segue */ }` without stopping → "[Right] o laço PARA" fails, and the real
//     effect is the worst of both worlds: a game running forever computing garbage, with nobody knowing.
//   · calling `onFailure` every frame instead of once → "[Right] e ANUNCIA... uma vez só" fails, and the real effect is
//     the screen reader repeating the same sentence 60 times a second.
