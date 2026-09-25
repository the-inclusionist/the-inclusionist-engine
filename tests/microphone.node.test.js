// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CHILD'S VOICE, CAPTURED AND LET GO (ADR-0216 §2, ADR-0200 erratum; issues #185, #200).
//
// No microphone here and none needed: the Web Audio parts are doubles and the clock is the case's. What is measured is the
// promise — a reading ends when SHE stops, not on a number somebody guessed; what she said is what comes back; and when it ends
// the microphone is closed, which is the difference between a game that listened and a game that is listening.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, vi } from 'vitest';
import { createMicrophone, READING_RATE } from '../app/js/platform/microphone.js';

/** A device: a stream whose tracks remember being stopped, and a context that hands blocks to whoever connected. */
function aparelho({ rate = READING_RATE } = {}) {
  const parados = [];
  const stream = { getTracks: () => [{ stop: () => parados.push('track') }] };
  let processor = null;
  const ligados = [];
  const context = {
    sampleRate: rate,
    destination: 'saida',
    closed: false,
    createMediaStreamSource: () => ({ connect: (to) => ligados.push(to), disconnect: () => ligados.push('source-off') }),
    createScriptProcessor: () => {
      processor = { onaudioprocess: null, connect: (to) => ligados.push(to), disconnect: () => ligados.push('processor-off') };
      return processor;
    },
    close: () => { context.closed = true; },
  };
  let t = 0;
  const deps = {
    getUserMedia: async () => stream,
    createContext: () => context,
    now: () => t,
  };
  return {
    deps, context, parados, ligados,
    /** One block of sound at `level`, `ms` after the last: the clock moves and the processor is handed samples. */
    bloco(level, ms = 256) { t += ms; processor?.onaudioprocess?.({ inputBuffer: { getChannelData: () => sinal(level) } }); },
    get temProcessador() { return !!processor?.onaudioprocess; },
  };
}

/** A block whose RMS is `level`: a constant is enough, and its sign alternates so nothing reads it as a bias. */
const sinal = (level, n = 64) => Float32Array.from({ length: n }, (_, i) => (i % 2 ? level : -level));

describe('the microphone, for a reading', () => {
  it('🔴 [Right] it ends when the child goes quiet, and answers with what she said', async () => {
    const dev = aparelho();
    const mic = createMicrophone(dev.deps);
    const p = mic.record({ silenceMs: 1000 });
    await Promise.resolve();
    dev.bloco(0.001, 100);   // the room, before she starts
    dev.bloco(0.001, 100);
    dev.bloco(0.2, 200);     // she reads
    dev.bloco(0.2, 200);
    dev.bloco(0.0005, 600);  // and stops
    dev.bloco(0.0005, 600);
    const samples = await p;
    expect(samples.length, 'nothing was kept of what she read').toBeGreaterThan(0);
    expect(dev.parados, 'the microphone was left open after the reading').toEqual(['track']);
    expect(dev.context.closed, 'the audio context was left running').toBe(true);
  });

  /**
   * 🔴 «QUIET» IS THE ROOM, NOT A NUMBER. The same reading happens in a classroom with twenty children and in a bedroom at
   * night. A threshold picked by hand ends the first one in the middle of a word or never ends the second.
   */
  it('🔴 [Right] a noisy room does not end the reading, and the same voice in it is still heard', async () => {
    const dev = aparelho();
    const mic = createMicrophone(dev.deps);
    const p = mic.record({ silenceMs: 500 });
    await Promise.resolve();
    dev.bloco(0.05, 100);    // a loud room
    dev.bloco(0.05, 100);
    dev.bloco(0.05, 300);    // the room alone must NOT read as a voice…
    dev.bloco(0.05, 300);
    expect(dev.temProcessador, 'the room itself was taken for a child speaking, and then for her silence').toBe(true);
    dev.bloco(0.4, 200);     // …and her voice over it must
    dev.bloco(0.05, 300);
    dev.bloco(0.05, 300);
    const samples = await p;
    expect(samples.length).toBeGreaterThan(0);
  });

  it('📌 [Boundary] silence BEFORE she starts never ends the reading — a child who takes her time is not finished', async () => {
    const dev = aparelho();
    const mic = createMicrophone(dev.deps);
    const p = mic.record({ silenceMs: 400, maxMs: 10_000 });
    await Promise.resolve();
    for (let i = 0; i < 12; i++) dev.bloco(0.0002, 500);  // six seconds of her thinking
    expect(dev.temProcessador, 'her silence before the first word was read as the end of the reading').toBe(true);
    dev.bloco(0.3, 200);
    dev.bloco(0.0002, 500);
    dev.bloco(0.0002, 500);
    expect((await p).length).toBeGreaterThan(0);
  });

  it('📌 [Boundary] the ceiling ends a reading nobody ended, and the microphone is let go there too', async () => {
    const dev = aparelho();
    const mic = createMicrophone(dev.deps);
    const p = mic.record({ silenceMs: 10_000, maxMs: 1000 });
    await Promise.resolve();
    dev.bloco(0.3, 400);
    dev.bloco(0.3, 400);
    dev.bloco(0.3, 400);   // past the ceiling
    await p;
    expect(dev.parados).toEqual(['track']);
    expect(dev.context.closed).toBe(true);
  });

  it('🔴 [Right] `stop()` gives the microphone back now, and what was heard is still answered', async () => {
    const dev = aparelho();
    const mic = createMicrophone(dev.deps);
    const p = mic.record();
    await Promise.resolve();
    dev.bloco(0.2, 200);
    dev.bloco(0.2, 200);
    mic.stop();
    expect((await p).length).toBeGreaterThan(0);
    expect(dev.parados).toEqual(['track']);
  });

  /**
   * 🔴 A DEVICE THAT GIVES ANOTHER RATE IS NOT REFUSED — it is resampled. `AudioContext({ sampleRate })` is a REQUEST, and a
   * device that answers 48 kHz would otherwise hand the model three times the sound it expects: every word stretched, and a
   * transcript of something nobody said.
   */
  it('🔴 [Right] whatever the device gives, the model gets 16 kHz', async () => {
    // The SAME reading on two devices: one that granted the rate that was asked for, one that answered 48 kHz. What the model
    // receives has to be the same length in seconds, which is a third of the samples on the second.
    const mesmaLeitura = async (rate) => {
      const dev = aparelho({ rate });
      const p = createMicrophone(dev.deps).record({ silenceMs: 200 });
      await Promise.resolve();
      dev.bloco(0.0002, 100);  // the room comes first, always: what follows is measured against it
      dev.bloco(0.0002, 100);
      dev.bloco(0.3, 200);     // she reads
      dev.bloco(0.0002, 300);  // and stops
      return (await p).length;
    };
    const proprio = await mesmaLeitura(READING_RATE);
    const rapido = await mesmaLeitura(48_000);
    expect(proprio, 'the device that granted 16 kHz was resampled anyway').toBe(4 * 64);
    expect(rapido, 'the model was handed three times the sound, so every word would be stretched')
      .toBe(Math.round((4 * 64 * READING_RATE) / 48_000));
  });

  it('⚠️ [Error] a device with no microphone is SAID, never silently empty', async () => {
    const mic = createMicrophone({ getUserMedia: undefined, createContext: () => { throw new Error('never'); }, now: () => 0 });
    await expect(mic.record()).rejects.toThrow(/microphone/);
  });

  /*
   * 🔴 THE MICROPHONE, THE AUDIO CONTEXT AND THE CLOCK ARE THE ONES THE ROOT LENT (ADR-0232 D4). The case above passed with a
   * fallback to the page's `navigator` in place, because node has no `mediaDevices`; here the page HAS all three, and a
   * reading must not touch any of them.
   */
  it('🔴 [Right] the page\'s own microphone, AudioContext and clock are never reached — even where they exist', async () => {
    const globalMic = vi.fn(async () => ({ getTracks: () => [] }));
    const GlobalContext = vi.fn();
    const globalNow = vi.fn(() => 0);
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: globalMic } });
    vi.stubGlobal('AudioContext', GlobalContext);
    vi.stubGlobal('performance', { now: globalNow });
    try {
      await expect(createMicrophone({ getUserMedia: undefined, createContext: () => ({}), now: () => 0 }).record())
        .rejects.toThrow(/microphone/);
      const dev = aparelho();
      const leitura = createMicrophone(dev.deps).record({ silenceMs: 300 });
      await Promise.resolve(); await Promise.resolve();
      dev.bloco(0.001, 100); dev.bloco(0.001, 100); dev.bloco(0.001, 100); dev.bloco(0.5); dev.bloco(0.001, 400);
      expect((await leitura).length, 'the lent device was not the one heard').toBeGreaterThan(0);
      expect(globalMic, 'the page\'s microphone was opened in place of the lent one').not.toHaveBeenCalled();
      expect(GlobalContext, 'the page\'s AudioContext was built in place of the lent one').not.toHaveBeenCalled();
      expect(globalNow, 'the silence was timed by the page\'s clock, not the lent one').not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-microphone.py`:
//   · the silence threshold fixed instead of the room's  → «a noisy room does not end the reading»
//   · silence counted before she ever spoke              → «silence BEFORE she starts never ends the reading»
//   · the ceiling ignored                                → «the ceiling ends a reading nobody ended»
//   · the tracks left running                            → «it ends when the child goes quiet» (and the ceiling case)
//   · the context left open                              → same
//   · the samples answered at the device's rate           → «whatever the device gives, the model gets 16 kHz»
//   · `stop()` answering nothing                          → «`stop()` gives the microphone back now»
