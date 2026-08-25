// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de platform/audio-earcons (project NODE: Web Audio/SFX/showCaption/noiseHit falsos injetados por closure).
// Contrato-chave de a11y: a LEGENDA sai ANTES da checagem de som → surdo "vê" o earcon mesmo com áudio OFF. sfx toca
// 1 oscilador; doorSound escolhe timbre por material + dispara noiseHit. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { createAudioEarcons } from '../app/js/platform/audio-earcons.js';

function fakeAC() {
  const rec = { osc: 0, types: [] };
  const chain = { connect: () => chain };
  const mkOsc = () => { rec.osc++; const o = {
    type: '', frequency: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    connect: () => chain, start: () => {}, stop: () => {} };
    Object.defineProperty(o, 'type', { set: (v) => rec.types.push(v), get: () => rec.types[rec.types.length - 1] });
    return o; };
  const mkGain = () => ({ gain: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => chain });
  return { rec, ac: { currentTime: 0, destination: {}, createOscillator: mkOsc, createGain: mkGain } };
}

// A tabela é do JOGO (item 19) e `cap` guarda a CHAVE, não o texto. O fixture usa uma chave que NÃO existe
// no dicionário de propósito: `t()` devolve a própria chave quando não acha, então o caso continua podendo
// afirmar o que interessa — que a legenda sai — sem depender do texto de nenhum idioma.
const SFX = { alvo: { t: 'square', f: 880, d: 0.1, cap: 'sfx.teste' }, plain: { t: 'sine', f: 440, d: 0.1 } };

function setup(over = {}) {
  const caps = [], hits = [];
  const { rec, ac } = fakeAC();
  const ctx = {
    SFX,
    ensureAC: () => ac,
    catNode: () => null,
    audioOut: () => ({ connect: () => ({}) }),
    noiseHit: (mat) => hits.push(mat),
    getSoundOn: () => true,
    getVolume: () => 0.6,
    getCaptionsOn: () => true,
    showCaption: (t) => caps.push(t),
    ...over,
  };
  return { earcons: createAudioEarcons(ctx), rec, caps, hits };
}

describe('platform/audio-earcons', () => {
  it('[Zero] sfx com nome inexistente: no-op (sem legenda, sem som)', () => {
    const { earcons, rec, caps } = setup();
    earcons.sfx('nope');
    expect(caps).toEqual([]);
    expect(rec.osc).toBe(0);
  });

  it('[Cross-check a11y] som OFF mas legendas ON: legenda SAI, mas 0 osciladores', () => {
    const { earcons, rec, caps } = setup({ getSoundOn: () => false });
    earcons.sfx('alvo');
    expect(caps).toEqual(['sfx.teste']); // surdo vê o earcon mesmo sem áudio
    expect(rec.osc).toBe(0);
  });

  it('[Interface] legendas OFF: nenhuma legenda mesmo com .cap (mas o som toca)', () => {
    const { earcons, rec, caps } = setup({ getCaptionsOn: () => false });
    earcons.sfx('alvo');
    expect(caps).toEqual([]);
    expect(rec.osc).toBe(1);
  });

  it('[One] sfx com som ON: 1 oscilador; earcon sem .cap não legenda', () => {
    const { earcons, rec, caps } = setup();
    earcons.sfx('plain');
    expect(rec.osc).toBe(1);
    expect(caps).toEqual([]); // 'plain' não tem cap
  });

  it('[Boundary] doorSound(ferro)=square + noiseHit(ferro); doorSound(madeira)=sawtooth + noiseHit(madeira)', () => {
    const a = setup(); a.earcons.doorSound('ferro');
    expect(a.rec.types).toContain('square');
    expect(a.hits).toEqual(['ferro']);
    const b = setup(); b.earcons.doorSound('madeira');
    expect(b.rec.types).toContain('sawtooth');
    expect(b.hits).toEqual(['madeira']);
  });

  it('[Zero] doorSound com volume 0: 0 osciladores e nenhum noiseHit', () => {
    const { earcons, rec, hits } = setup({ getVolume: () => 0 });
    earcons.doorSound('ferro');
    expect(rec.osc).toBe(0);
    expect(hits).toEqual([]);
  });
});
