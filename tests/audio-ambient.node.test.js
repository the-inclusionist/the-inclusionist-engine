// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of platform/audio-ambient (NODE project: a fake Web Audio injected). Contracts: updateAmbient is gated by
// audioCat.ambient.on, builds the track ONCE (lazily), the rain gain follows _rainLevel and the water gain follows the
// nearness of water tiles (type 3); thunder respects soundOn/volume. See docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { createAudioAmbient } from '../app/js/platform/audio-ambient.js';

// A fake AC that records: the number of buffers created (= number of builds), of bufferSources (thunder) and ALL the
// setTargetAtTime {value} calls (to check the water/rain gains).
function fakeAC() {
  const rec = { buffers: 0, sources: 0, targets: [] };
  const chain = { connect: () => chain };
  const gainNode = () => ({ gain: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, setTargetAtTime: (v) => rec.targets.push(v) }, connect: () => chain });
  const ac = {
    sampleRate: 44100, currentTime: 0, destination: {},
    createBuffer: (_c, n) => { rec.buffers++; return { getChannelData: () => new Float32Array(n) }; },
    createBufferSource: () => { rec.sources++; return { buffer: null, loop: false, connect: () => chain, start: () => {}, stop: () => {} }; },
    createBiquadFilter: () => ({ type: '', frequency: { value: 0 }, Q: { value: 0 }, connect: () => chain }),
    createGain: gainNode,
  };
  return { rec, ac };
}

function setup(over = {}) {
  const { rec, ac } = fakeAC();
  const ctx = {
    ensureAC: () => ac, getAudioCtx: () => over.audioCtx === undefined ? ac : over.audioCtx,
    catNode: () => ({ connect: () => ({}) }), audioOut: () => ({ connect: () => ({}) }),
    noiseBuffer: () => ({}),
    getSoundOn: () => over.soundOn === undefined ? true : over.soundOn,
    getVolume: () => over.volume === undefined ? 0.6 : over.volume,
    getAudioCat: () => over.audioCat === undefined ? { ambient: { on: true } } : over.audioCat,
    getPlayers: () => over.players || [{ x: 80, y: 80 }],
    tileAt: over.tileAt || (() => 0),
    TILE: 16,
    getRainLevel: () => over.rainLevel === undefined ? 0 : over.rainLevel,
  };
  return { amb: createAudioAmbient(ctx), rec };
}

describe('platform/audio-ambient', () => {
  it('[Zero] updateAmbient não faz nada com ambient.on=false (não constrói a trilha)', () => {
    const { amb, rec } = setup({ audioCat: { ambient: { on: false } } });
    amb.updateAmbient();
    expect(rec.buffers).toBe(0);
  });

  it('[One] updateAmbient constrói a trilha UMA vez (lazy) em chamadas repetidas', () => {
    const { amb, rec } = setup();
    amb.updateAmbient(); amb.updateAmbient(); amb.updateAmbient();
    expect(rec.buffers).toBe(1); // buildAmbient ran only on the 1st frame
  });

  it('[Interface] ganho de CHUVA segue _rainLevel (0.09 × nível)', () => {
    const { amb, rec } = setup({ rainLevel: 1 });
    amb.updateAmbient();
    expect(rec.targets).toContain(0.09); // 0.09 × 1
  });

  it('[Boundary] ganho de ÁGUA sobe perto de tile de água (tipo 3) e fica 0 longe', () => {
    const near = setup({ players: [{ x: 80, y: 80 }], tileAt: (x, y) => (x === 5 && y === 5 ? 3 : 0) }); // px=py=5 → water right there
    near.amb.updateAmbient();
    expect(near.rec.targets).toContain(0.15); // 0.15 × nearWater(=1 na distância 0)
    const far = setup({ players: [{ x: 80, y: 80 }], tileAt: () => 0 });
    far.amb.updateAmbient();
    expect(far.rec.targets.every((v) => v !== 0.15)).toBe(true); // no water nearby
  });

  it('[Zero] thunder com som OFF ou volume 0: nenhum bufferSource', () => {
    const off = setup({ soundOn: false }); off.amb.thunder(0.5); expect(off.rec.sources).toBe(0);
    const mute = setup({ volume: 0 }); mute.amb.thunder(0.5); expect(mute.rec.sources).toBe(0);
  });

  it('[One] thunder com som ON: cria 1 bufferSource (rumor em loop)', () => {
    const { amb, rec } = setup();
    amb.thunder(0.7);
    expect(rec.sources).toBe(1);
  });
});
