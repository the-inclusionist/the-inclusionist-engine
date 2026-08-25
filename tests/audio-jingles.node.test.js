// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de platform/audio-jingles (project NODE: sem Web Audio real — AudioContext/tone falsos injetados por closure).
// Contrato: playVictory = 6 tons square + 4 fogos; playPuzzleSolved = 5 tons sine; firework = 6 osciladores (1 assobio
// + 5 crepitar) e respeita soundOn/volume/when. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Tier 2, áudio r1).
import { describe, it, expect } from 'vitest';
import { createAudioJingles } from '../app/js/platform/audio-jingles.js';

// AudioContext falso: conta osciladores e registra o `t` de cada frequency.setValueAtTime (p/ checar o offset `when`).
function fakeAC() {
  const rec = { osc: 0, gain: 0, freqTimes: [] };
  const chain = { connect: () => chain }; // connect encadeável (o.connect(g).connect(out))
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
    catNode: () => null,        // força o fallback audioOut()
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
    expect(toneCalls.length).toBe(6); // tone é responsável por silenciar internamente
    expect(rec.osc).toBe(0);          // firework guarda aqui → nenhum oscilador cru
  });
});
