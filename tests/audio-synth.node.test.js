// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE'S TWO SYNTHS: a panned tone (`tonePan`) and a filtered noise hit (`noiseHit`) — the sounds the sonar, the cane
// and the guide are made of, for a child who plays by ear.
//
// 🔴 A probe (2026-09-23) disabled eighteen of their decisions one at a time and the whole suite stayed green for every one:
// every file that names these two functions hands a DOUBLE in their place, so the real synthesis had no case at all — whether
// the sound is silenced with the game's sound off, which device it reaches, how it is panned, how loud, which material it
// sounds like.
//
// Both are driven here through a PLAYER'S OWN audio context (`pc`), which is how the engine routes a cue to one child's device,
// and which needs no browser window. The context writes down what is built and where it is connected.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as audio from '../app/js/platform/audio.js';

function contextoDoJogador() {
  const rec = { osc: [], picos: [], panners: [], destinos: [], paradas: [], filtros: [], fontes: 0 };
  const no = (nome, extra = {}) => ({ _nome: nome, connect(n) { rec.destinos.push([nome, n._nome]); return n; }, ...extra });
  const ac = {
    currentTime: 0,
    sampleRate: 8000,
    destination: no('destination'),
    createOscillator: () => {
      const o = no('osc', { type: '', frequency: { value: 0, setValueAtTime() {} }, start() {}, stop(t) { rec.paradas.push(t); } });
      rec.osc.push(o);
      return o;
    },
    // the first ramp of a gain is its peak; the second is its fade
    createGain: () => {
      const rampas = [];
      rec.picos.push(rampas);
      return no('ganho', { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime(v) { rampas.push(v); } } });
    },
    createStereoPanner: () => { const p = no('panner', { pan: { value: 0 } }); rec.panners.push(p); return p; },
    createBiquadFilter: () => { const f = no('filtro', { type: '', frequency: { value: 0 }, Q: { value: 0 } }); rec.filtros.push(f); return f; },
    createBufferSource: () => { rec.fontes++; return no('ruido', { buffer: null, start() {}, stop(t) { rec.paradas.push(t); } }); },
    createBuffer: (_c, n) => ({ length: n, getChannelData: () => new Float32Array(n) }),
  };
  return { rec, pc: { ac, out: no('saida-do-jogador') } };
}

beforeEach(() => { audio.setSoundOn(true); audio.setVolume(0.6); });

describe('tonePan — a tone, panned, on a child\'s device', () => {
  it('🔴 [Right] plays ONE oscillator of the asked timbre and pitch, at the asked level times the master, for the asked time', () => {
    const { rec, pc } = contextoDoJogador();
    audio.tonePan(523, 0.2, 'guide', null, 0.5, 'triangle', pc);
    expect(rec.osc).toHaveLength(1);
    expect([rec.osc[0].type, rec.osc[0].frequency.value]).toEqual(['triangle', 523]);
    expect(rec.picos[0][0]).toBeCloseTo(0.5 * 0.6, 6);
    expect(rec.paradas).toEqual([0.2 + 0.02]);
  });

  it('🔴 [Right] it reaches the PLAYER\'s device — the cue is for that child, not for the room', () => {
    const { rec, pc } = contextoDoJogador();
    audio.tonePan(523, 0.2, 'guide', null, 0.5, 'triangle', pc);
    expect(rec.destinos.at(-1)).toEqual(['ganho', 'saida-do-jogador']);
  });

  it('📌 [Boundary] without a timbre it is a sine; without a level, 0.2 of the master; and never under a floor', () => {
    const { rec, pc } = contextoDoJogador();
    audio.tonePan(523, 0.2, 'guide', null, undefined, undefined, pc);
    expect(rec.osc[0].type).toBe('sine');
    expect(rec.picos[0][0]).toBeCloseTo(0.2 * 0.6, 6);
    audio.setVolume(0.05);
    audio.tonePan(523, 0.2, 'guide', null, 0.2, 'sine', pc);
    expect(rec.picos[1][0], 'a quiet master made the cue inaudible').toBeCloseTo(0.02, 6);
  });

  it('🔴 [Right] a pan is clamped to the two ears, and NO pan builds no panner', () => {
    const { rec, pc } = contextoDoJogador();
    audio.tonePan(523, 0.2, 'guide', 3, 0.5, 'sine', pc);
    audio.tonePan(523, 0.2, 'guide', -3, 0.5, 'sine', pc);
    expect(rec.panners.map((p) => p.pan.value)).toEqual([1, -1]);
    const semPan = contextoDoJogador();
    audio.tonePan(523, 0.2, 'guide', null, 0.5, 'sine', semPan.pc);
    expect(semPan.rec.panners).toHaveLength(0);
  });

  it('🔴 [Zero] the game\'s sound off, or the master at zero: nothing is built', () => {
    const { rec, pc } = contextoDoJogador();
    audio.setSoundOn(false);
    audio.tonePan(523, 0.2, 'guide', null, 0.5, 'sine', pc);
    audio.setSoundOn(true);
    audio.setVolume(0);
    audio.tonePan(523, 0.2, 'guide', null, 0.5, 'sine', pc);
    expect(rec.osc).toHaveLength(0);
  });
});

describe('noiseHit — a material, heard', () => {
  it('🔴 [Right] each material has its own filter, on the player\'s device, and a hit is counted', () => {
    const { rec, pc } = contextoDoJogador();
    const antes = audio._footCount;
    audio.noiseHit('agua', null, pc);
    expect([rec.filtros[0].type, rec.filtros[0].frequency.value]).toEqual(['lowpass', 330]);
    expect(rec.destinos.at(-1)).toEqual(['ganho', 'saida-do-jogador']);
    expect(audio._footCount).toBe(antes + 1);
  });

  it('📌 [Boundary] a material the table does not know sounds like the floor, not like nothing', () => {
    const { rec, pc } = contextoDoJogador();
    audio.noiseHit('lava', null, pc);
    expect([rec.filtros[0].type, rec.filtros[0].frequency.value]).toEqual(['bandpass', 1200]);
  });

  it('🔴 [Right] a hit is panned when asked', () => {
    const { rec, pc } = contextoDoJogador();
    audio.noiseHit('piso', -0.5, pc);
    expect(rec.panners.map((p) => p.pan.value)).toEqual([-0.5]);
    expect(rec.destinos.at(-1)).toEqual(['panner', 'saida-do-jogador']);
  });

  it('🔴 [Right] with no player\'s device, a hit goes out through the `interact` category — the slider that says so moves it', async () => {
    // The only path that runs the engine's OWN context, so it needs a window: one is lent, with the same recording context, and
    // the module is imported afresh so its context is this one. `interact` is switched off and `earcons` on: a hit on the right
    // bus lands on a silent category gain, on the wrong one it is heard.
    const { rec, pc } = contextoDoJogador();
    const ganhos = [];
    const criarGanho = pc.ac.createGain;
    pc.ac.createGain = () => { const g = criarGanho(); ganhos.push(g); return g; };
    pc.ac.state = 'running';
    vi.stubGlobal('window', { AudioContext: function AudioContextFalso() { return pc.ac; } });
    vi.resetModules();
    const novo = await import('../app/js/platform/audio.js');
    novo.initAudioMixer();
    novo.audioCat.interact.on = false;
    novo.audioCat.earcons.on = true;
    novo.noiseHit('piso', null);
    vi.unstubAllGlobals();
    expect(rec.fontes).toBe(1);
    expect(ganhos.at(-1).gain.value, 'the hit went to a category that is on — not `interact`').toBe(0);
  });

  it('🔴 [Zero] the game\'s sound off: no noise is made', () => {
    const { rec, pc } = contextoDoJogador();
    audio.setSoundOn(false);
    audio.noiseHit('piso', null, pc);
    expect(rec.fontes).toBe(0);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/sonda-audio.py --novos`: the eighteen decisions of the two synths, all green before this file, all red with it.
// Re-probed after the cut into shared questions (`audible`, `contextFor`, `panned`, `outFor` — `sonda-audio-3.py`): 19 of 19,
// with «a hit goes out through the `interact` category», added with the cut — every other case hands a player's device, so the
// CATEGORY a hit is routed to (the mixer slider that moves the cane) was never run; green on the old shape too.
