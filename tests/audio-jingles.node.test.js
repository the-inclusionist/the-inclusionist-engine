// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of platform/audio-jingles (NODE project: no real Web Audio — a fake AudioContext/tone injected by closure).
// Contract: playVictory = 6 square tones + 4 fireworks; playPuzzleSolved = 5 sine tones; firework = 6 oscillators (1
// whistle + 5 crackles) and respects soundOn/volume/when. See docs/5-Refactoring/plano-modularizacao-mapa.md (Tier 2, audio r1).
import { describe, it, expect } from 'vitest';
import { createAudioJingles } from '../app/js/platform/audio-jingles.js';

// A fake AudioContext: counts oscillators and records the `t` of each frequency.setValueAtTime (to check the `when` offset).
function fakeAC() {
  const rec = { osc: 0, gain: 0, freqTimes: [] };
  const chain = { connect: () => chain }; // a chainable connect (o.connect(g).connect(out))
  const mkOsc = () => { rec.osc++; return {
    type: '', frequency: { setValueAtTime: (_f, t) => rec.freqTimes.push(t), exponentialRampToValueAtTime: () => {} },
    connect: () => chain, start: () => {}, stop: () => {} }; };
  const mkGain = () => { rec.gain++; return {
    gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => chain }; };
  return { rec, ac: { currentTime: 100, destination: {}, createOscillator: mkOsc, createGain: mkGain } };
}

function setup(over = {}) {
  const toneCalls = [];
  const { rec, ac } = fakeAC();
  const ctx = {
    tone: (freq, dur, type, when, vol) => toneCalls.push({ freq, dur, type, when, vol }),
    ensureAC: () => ac,
    catNode: () => null,        // forces the audioOut() fallback
    audioOut: () => ({ connect: () => ({}) }),
    getSoundOn: () => true,
    getVolume: () => 0.6,
    ...over,
  };
  return { jingles: createAudioJingles(ctx), toneCalls, rec, ac };
}

describe('platform/audio-jingles', () => {
  it('[Zero] firework com soundOn=false: NÃO toca o AudioContext (0 osciladores)', () => {
    const { jingles, rec } = setup({ getSoundOn: () => false });
    jingles.firework();
    expect(rec.osc).toBe(0);
  });

  it('[Zero] firework com volume 0: 0 osciladores (guarda de volume)', () => {
    const { jingles, rec } = setup({ getVolume: () => 0 });
    jingles.firework();
    expect(rec.osc).toBe(0);
  });

  it('[Boundary] firework = 6 osciladores (1 assobio + 5 crepitar)', () => {
    const { jingles, rec } = setup();
    jingles.firework();
    expect(rec.osc).toBe(6);
    expect(rec.gain).toBe(6);
  });

  it('[Interface] firework respeita o offset `when` (t = currentTime + when no assobio)', () => {
    const { jingles, rec } = setup();
    jingles.firework(2); // currentTime=100 → assobio em t=102
    expect(rec.freqTimes[0]).toBe(102);
  });

  it('[One] playPuzzleSolved = 5 tons, todos sine (4 da frase + 1 de fundo)', () => {
    const { jingles, toneCalls } = setup();
    jingles.playPuzzleSolved();
    expect(toneCalls.length).toBe(5);
    expect(toneCalls.every((c) => c.type === 'sine')).toBe(true);
    expect(toneCalls.map((c) => c.freq)).toEqual([659, 784, 988, 1319, 1047]);
  });

  it('[Many] playVictory = 6 tons square na sequência ascendente + 4 fogos (24 osciladores)', () => {
    const { jingles, toneCalls, rec } = setup();
    jingles.playVictory();
    expect(toneCalls.length).toBe(6);
    expect(toneCalls.every((c) => c.type === 'square')).toBe(true);
    expect(toneCalls.map((c) => c.freq)).toEqual([523, 659, 784, 1047, 988, 1319]);
    expect(rec.osc).toBe(24); // 4 fogos × 6 osciladores
  });

  it('[Right-BICEP:Cross-check] playVictory com som desligado: tons ainda chamam `tone` (ele guarda), mas 0 fogos', () => {
    const { jingles, toneCalls, rec } = setup({ getSoundOn: () => false });
    jingles.playVictory();
    expect(toneCalls.length).toBe(6); // tone is responsible for muting internally
    expect(rec.osc).toBe(0);          // firework guards here → no raw oscillator
  });
});
