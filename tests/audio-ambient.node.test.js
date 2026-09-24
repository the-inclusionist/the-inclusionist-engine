// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of platform/audio-ambient (NODE project: a fake Web Audio injected). Contracts: updateAmbient is gated by
// audioCat.ambient.on, builds the track ONCE (lazily), the rain gain follows the rain level and the water gain follows the
// nearness of the spots the GAME calls 'water' through `roleAt` (never a tile number); thunder respects soundOn/volume.
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

const TILE = 16;
/** The cell a spot falls in, in the metric `roleAt` receives (world units, `TILE` per cell). */
const cellOf = (at) => ({ tx: Math.floor(at.x / TILE), ty: Math.floor(at.y / TILE) });

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
    roleAt: over.roleAt || (() => 'free'),
    TILE,
    getRainLevel: () => over.rainLevel === undefined ? 0 : over.rainLevel,
    ...(over.extra || {}),
  };
  return { amb: createAudioAmbient(ctx), rec };
}

/** The WATER gain is the first target set each frame (then the rain's). */
const waterGain = (rec) => rec.targets[0];

describe('platform/audio-ambient', () => {
  it('[Zero] updateAmbient does nothing with ambient.on=false (does not build the track)', () => {
    const { amb, rec } = setup({ audioCat: { ambient: { on: false } } });
    amb.updateAmbient();
    expect(rec.buffers).toBe(0);
  });

  it('[One] updateAmbient builds the track ONCE (lazily) across repeated calls', () => {
    const { amb, rec } = setup();
    amb.updateAmbient(); amb.updateAmbient(); amb.updateAmbient();
    expect(rec.buffers).toBe(1); // buildAmbient ran only on the 1st frame
  });

  it('[Interface] the RAIN gain follows the rain level (0.09 × level)', () => {
    const { amb, rec } = setup({ rainLevel: 1 });
    amb.updateAmbient();
    expect(rec.targets).toContain(0.09); // 0.09 × 1
  });

  it('[Water · game says] water sounds where the GAME says water, whatever tile number its map uses', () => {
    // Player at cell (5,5); the game's map calls its water tile 7 — the engine never sees that number, only the role.
    const tileNumber = (tx, ty) => (tx === 5 && ty === 5 ? 7 : 0);
    const { amb, rec } = setup({ roleAt: (at) => { const { tx, ty } = cellOf(at); return tileNumber(tx, ty) === 7 ? 'water' : 'free'; } });
    amb.updateAmbient();
    expect(waterGain(rec)).toBe(0.15); // 0.15 × nearness 1 (distance 0)
  });

  it('[Water · metric] roleAt is asked in the world metric, and the gain falls with the distance in cells', () => {
    // Water two cells east of the player: nearness = 1 − 2/4.2. A mutation that passed cell indices to `roleAt`
    // (instead of world units) would find the water at cell (0,0) and never here.
    const { amb, rec } = setup({ roleAt: (at) => { const { tx, ty } = cellOf(at); return tx === 7 && ty === 5 ? 'water' : 'structure'; } });
    amb.updateAmbient();
    expect(waterGain(rec)).toBeCloseTo(0.15 * (1 - 2 / 4.2), 10);
  });

  it('[Water · game says none] no water sound where the game says there is none', () => {
    const { amb, rec } = setup({ roleAt: () => 'structure' });
    amb.updateAmbient();
    expect(waterGain(rec)).toBe(0);
  });

  it('[Water · no magic number] a map whose tile 3 is NOT water does not sound like water', () => {
    // Every cell is tile 3 here, and the game says it is a hazard. A `tileAt` is even offered, to catch a module that
    // still reads tile numbers: the role is the only thing allowed to decide.
    const { amb, rec } = setup({ roleAt: () => 'hazard', extra: { tileAt: () => 3 } });
    amb.updateAmbient();
    expect(waterGain(rec)).toBe(0);
  });

  it('[Zero] thunder with sound OFF or volume 0: no bufferSource', () => {
    const off = setup({ soundOn: false }); off.amb.thunder(0.5); expect(off.rec.sources).toBe(0);
    const mute = setup({ volume: 0 }); mute.amb.thunder(0.5); expect(mute.rec.sources).toBe(0);
  });

  it('[One] thunder with sound ON: creates 1 bufferSource (a looping rumble)', () => {
    const { amb, rec } = setup();
    amb.thunder(0.7);
    expect(rec.sources).toBe(1);
  });
});
