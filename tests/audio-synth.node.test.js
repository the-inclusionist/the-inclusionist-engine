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
import { describe, it, expect, beforeEach } from 'vitest';
import { createAudio } from '../app/js/platform/audio.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

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

// One root's sound (ADR-0232 D4), whose own context is never asked for by the player's-device cases: a host with none.
let audio;
beforeEach(() => { audio = createAudio({ newContext: () => null, store: createStorage(memoryBackend()) }); });

describe('tonePan — a tone, panned, on a child\'s device', () => {
  it('🔴 [Right] plays ONE oscillator of the asked timbre and pitch, at the asked level times the master, for the asked time', () => {
    const { rec, pc } = contextoDoJogador();
    audio.tonePan(523, 0.2, 'sonar', null, 0.5, 'triangle', pc);
    expect(rec.osc).toHaveLength(1);
    expect([rec.osc[0].type, rec.osc[0].frequency.value]).toEqual(['triangle', 523]);
    expect(rec.picos[0][0]).toBeCloseTo(0.5 * 0.6, 6);
    expect(rec.paradas).toEqual([0.2 + 0.02]);
  });

  it('🔴 [Right] it reaches the PLAYER\'s device — the cue is for that child, not for the room', () => {
    const { rec, pc } = contextoDoJogador();
    audio.tonePan(523, 0.2, 'sonar', null, 0.5, 'triangle', pc);
    expect(rec.destinos.at(-1)).toEqual(['ganho', 'saida-do-jogador']);
  });

  it('📌 [Boundary] without a timbre it is a sine; without a level, 0.2 of the master; and never under a floor', () => {
    const { rec, pc } = contextoDoJogador();
    audio.tonePan(523, 0.2, 'sonar', null, undefined, undefined, pc);
    expect(rec.osc[0].type).toBe('sine');
    expect(rec.picos[0][0]).toBeCloseTo(0.2 * 0.6, 6);
    audio.setVolume(0.05);
    audio.tonePan(523, 0.2, 'sonar', null, 0.2, 'sine', pc);
    expect(rec.picos[1][0], 'a quiet master made the cue inaudible').toBeCloseTo(0.02, 6);
  });

  it('🔴 [Right] a pan is clamped to the two ears, and NO pan builds no panner', () => {
    const { rec, pc } = contextoDoJogador();
    audio.tonePan(523, 0.2, 'sonar', 3, 0.5, 'sine', pc);
    audio.tonePan(523, 0.2, 'sonar', -3, 0.5, 'sine', pc);
    expect(rec.panners.map((p) => p.pan.value)).toEqual([1, -1]);
    const semPan = contextoDoJogador();
    audio.tonePan(523, 0.2, 'sonar', null, 0.5, 'sine', semPan.pc);
    expect(semPan.rec.panners).toHaveLength(0);
  });

  it('🔴 [Zero] the game\'s sound off, or the master at zero: nothing is built', () => {
    const { rec, pc } = contextoDoJogador();
    audio.setSoundOn(false);
    audio.tonePan(523, 0.2, 'sonar', null, 0.5, 'sine', pc);
    audio.setSoundOn(true);
    audio.setVolume(0);
    audio.tonePan(523, 0.2, 'sonar', null, 0.5, 'sine', pc);
    expect(rec.osc).toHaveLength(0);
  });
});

describe('noiseHit — a material, heard', () => {
  it('🔴 [Right] each material has its own filter, on the player\'s device, and a hit is counted', () => {
    const { rec, pc } = contextoDoJogador();
    const antes = audio.footCount;
    audio.noiseHit('agua', null, pc);
    expect([rec.filtros[0].type, rec.filtros[0].frequency.value]).toEqual(['lowpass', 330]);
    expect(rec.destinos.at(-1)).toEqual(['ganho', 'saida-do-jogador']);
    expect(audio.footCount).toBe(antes + 1);
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

  it('🔴 [Right] with no player\'s device, a hit goes out through the `interact` category — the slider that says so moves it', () => {
    // The only path that runs the engine's OWN context: the root's maker hands in the same recording context. `interact` is
    // switched off and `earcons` on: a hit on the right bus lands on a silent category gain, on the wrong one it is heard.
    const { rec, pc } = contextoDoJogador();
    const ganhos = [];
    const criarGanho = pc.ac.createGain;
    pc.ac.createGain = () => { const g = criarGanho(); ganhos.push(g); return g; };
    pc.ac.state = 'running';
    const novo = createAudio({ newContext: () => pc.ac, store: createStorage(memoryBackend()) });
    novo.audioCat.interact.on = false;
    novo.audioCat.earcons.on = true;
    novo.noiseHit('piso', null);
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

describe('tone — the engine\'s own earcon synth', () => {
  // `tone` has no player's device: it only ever plays in the ENGINE's context, so every case hands the root's maker a recording
  // context, the way the `interact` case above does. It was left out of the cut of 2026-09-23 because it had no case at all;
  // these are written against its current shape.
  async function engineWith(setup = () => {}) {
    const { rec, pc } = contextoDoJogador();
    const ganhos = [];
    const criarGanho = pc.ac.createGain;
    // ⚠️ A gain is born at 1 in Web Audio, and the recording context above starts it at 0: here that difference decides the
    // routing case, because the master is never set by the engine and would pass for a silenced category (the probe caught it).
    pc.ac.createGain = () => { const g = criarGanho(); g.gain.value = 1; ganhos.push(g); return g; };
    pc.ac.state = 'running';
    const fresh = createAudio({ newContext: () => pc.ac, store: createStorage(memoryBackend()) });
    setup(fresh);
    return { rec, ganhos, fresh, done: () => {} };
  }

  it('🔴 [Right] one square oscillator by default, at 0.22 of the master, stopped after its time plus a tail, delayed by `when`', async () => {
    const { rec, fresh, done } = await engineWith();
    fresh.tone(440, 0.1, undefined, 0.5);
    done();
    expect([rec.osc[0].type, rec.osc.length]).toEqual(['square', 1]);
    expect(rec.picos[0][0]).toBeCloseTo(0.22 * 0.6, 6);
    expect(rec.paradas).toEqual([0.5 + 0.1 + 0.02]);
  });

  it('📌 [Boundary] the asked timbre and level are used, and never below the floor', async () => {
    const { rec, fresh, done } = await engineWith((m) => m.setVolume(0.05));
    fresh.tone(440, 0.1, 'triangle', 0, 0.2);
    done();
    expect(rec.osc[0].type).toBe('triangle');
    expect(rec.picos[0][0], 'a quiet master made the earcon inaudible').toBeCloseTo(0.02, 6);
  });

  it('🔴 [Zero] the game\'s sound off, or the master at zero: nothing is built', async () => {
    for (const setup of [(m) => m.setSoundOn(false), (m) => m.setVolume(0)]) {
      const { rec, fresh, done } = await engineWith(setup);
      fresh.tone(440, 0.1);
      done();
      expect(rec.osc).toHaveLength(0);
    }
  });

  it('🔴 [Right] it goes out through the `earcons` category — the slider that says so silences it', async () => {
    const { ganhos, fresh, done } = await engineWith((m) => {
      m.audioCat.earcons.on = false;
      m.audioCat.interact.on = true;
    });
    fresh.tone(440, 0.1);
    done();
    expect(ganhos.at(-1).gain.value, 'the earcon went to a category that is on — not `earcons`').toBe(0);
  });
});

describe('the mixer — each category\'s level, when its bus is made and when the slider moves', () => {
  // Found by the probe of 2026-09-24: only a category SWITCHED OFF had a case (born silent). A category on was never checked to be
  // born at its volume, and `setCatGain` — what the mixer's slider and switch call on every change — had no case at all.
  async function mixer() {
    const { pc } = contextoDoJogador();
    const ganhos = [];
    const criarGanho = pc.ac.createGain;
    pc.ac.createGain = () => {
      const g = criarGanho();
      g.gain.value = 1;
      g.gain.setTargetAtTime = (v) => { g.gain.alvo = v; };
      ganhos.push(g);
      return g;
    };
    pc.ac.state = 'running';
    const store = createStorage(memoryBackend());
    const fresh = createAudio({ newContext: () => pc.ac, store });
    return { fresh, ganhos, store, done: () => {} };
  }

  it('🔴 [Right] a category that is ON is born at ITS volume, not at full', async () => {
    const { fresh, ganhos, done } = await mixer();
    fresh.audioCat.earcons.on = true;
    fresh.audioCat.earcons.vol = 0.3;
    fresh.tone(440, 0.1);
    done();
    expect(ganhos.at(-1).gain.value).toBeCloseTo(0.3, 6);
  });

  it('🔴 [Right] moving the slider or the switch reaches the bus: off is silence, on is the new volume', async () => {
    const { fresh, ganhos, store, done } = await mixer();
    fresh.tone(440, 0.1); // makes the `earcons` bus
    const bus = ganhos.at(-1);
    fresh.audioCat.earcons.on = false;
    fresh.setCatGain('earcons');
    expect(bus.gain.alvo, 'switching the category off did not silence it').toBe(0);
    fresh.audioCat.earcons.on = true;
    fresh.audioCat.earcons.vol = 0.5;
    fresh.setCatGain('earcons');
    done();
    expect(bus.gain.alvo, 'the slider moved and the bus did not follow').toBeCloseTo(0.5, 6);
    // and it is kept in the store the root handed to `createAudio` (ADR-0232), not in a storage of its own
    expect(store.getJSON('incl_audiocat_earcons'), 'the change was not kept in the injected store').toEqual({ on: true, vol: 0.5 });
  });
});

describe('one root\'s sound — `createAudio` (ADR-0232 D4)', () => {
  // The module held ONE context, ONE master and ONE mixer per page; two roots shared them. These cases hold what the factory
  // promises instead: the context comes from the root's maker at the first sound, the mixer from the root's store, and a
  // second root's sound is a second everything.
  function graphContext() {
    const links = [];
    const made = { gains: [], filters: [], processors: [] };
    const node = (name, extra = {}) => {
      const n = {
        _nome: name,
        connect(to) { links.push([n, to]); return to; },
        disconnect() { for (let i = links.length - 1; i >= 0; i--) if (links[i][0] === n) links.splice(i, 1); },
        ...extra,
      };
      return n;
    };
    const ac = {
      state: 'running', currentTime: 0, resumed: 0,
      destination: node('destination'),
      resume() { this.resumed++; this.state = 'running'; },
      createGain: () => { const g = node('gain', { gain: { value: 1, alvo: null, setTargetAtTime(v) { this.alvo = v; } } }); made.gains.push(g); return g; },
      createBiquadFilter: () => { const f = node('lowpass', { type: '', frequency: { value: 0 }, Q: { value: 0 } }); made.filters.push(f); return f; },
      createScriptProcessor: () => { const p = node('processor', { onaudioprocess: null }); made.processors.push(p); return p; },
    };
    const targetsOf = (n) => links.filter(([from]) => from === n).map(([, to]) => to);
    return { ac, made, targetsOf };
  }
  const built = (newContext, store = createStorage(memoryBackend())) => createAudio({ newContext, store });

  it('🔴 [Right] no context is made at construction; the first sound asks the root\'s maker ONCE, and the getter shows it', () => {
    const { ac } = graphContext();
    let asked = 0;
    const a = built(() => { asked++; return ac; });
    expect([a.audioCtx, asked], 'a context made before the child\'s first gesture is born suspended').toEqual([null, 0]);
    expect(a.ensureAC()).toBe(ac);
    expect(a.ensureAC()).toBe(ac);
    expect(asked, 'every sound made a new context').toBe(1);
    expect(a.audioCtx).toBe(ac);
  });

  it('🔴 [Right] a context the browser suspended is resumed at the next sound, and a running one is left alone', () => {
    const { ac } = graphContext();
    const a = built(() => ac);
    a.ensureAC();
    expect(ac.resumed).toBe(0);
    ac.state = 'suspended';
    a.ensureAC();
    expect(ac.resumed).toBe(1);
  });

  it('📌 [Zero] a host with no audio context: every question answers null and no cue throws', () => {
    const a = built(() => null);
    expect([a.ensureAC(), a.audioOut(), a.catNode('earcons')]).toEqual([null, null, null]);
    expect(() => { a.tone(440, 0.1); a.noiseHit('piso'); a.tonePan(440, 0.1, 'sonar'); a.setMasterMuted(true); a.setHearingLossGraph(true); }).not.toThrow();
  });

  it('🔴 [Right] TWO ROOTS SHARE NOTHING: each its own context, master volume, switch and categories', () => {
    const one = graphContext(), two = graphContext();
    const a = built(() => one.ac), b = built(() => two.ac);
    a.setVolume(0.1); a.setSoundOn(false); a.audioCat.earcons.on = false;
    expect([b.volume, b.soundOn, b.audioCat.earcons.on], 'the second root heard the first one\'s mixer').toEqual([0.6, true, true]);
    expect([a.volume, a.soundOn]).toEqual([0.1, false]);
    expect(a.ensureAC()).not.toBe(b.ensureAC());
  });

  it('🔴 [Right] the mixer is read from the root\'s store as the sound is built — the voice built after it finds its categories', () => {
    const store = createStorage(memoryBackend());
    store.setJSON('incl_audiocat_earcons', { on: false, vol: 0.2 });
    const a = built(() => null, store);
    expect(a.audioCat.earcons).toEqual({ on: false, vol: 0.2 });
  });

  it('🔴 [Right] the master goes to the device; hearing loss sends it through the filter, and switching it off brings it back', () => {
    const { ac, made, targetsOf } = graphContext();
    const a = built(() => ac);
    const master = a.audioOut();
    expect(targetsOf(master)).toEqual([ac.destination]);
    a.setHearingLossGraph(true);
    expect(a.hearingLoss).toBe(true);
    expect(targetsOf(master), 'the simulation did not reach the master').toEqual([made.filters[0]]);
    expect(targetsOf(made.filters[0])).toEqual([made.processors[0]]);
    expect(targetsOf(made.processors[0])).toEqual([ac.destination]);
    a.setHearingLossGraph(false);
    expect(a.hearingLoss).toBe(false);
    expect(targetsOf(master), 'switched off, the simulation kept filtering').toEqual([ac.destination]);
    a.setHearingLossGraph(true);
    expect(made.filters, 'the filter was built again at every switch').toHaveLength(1);
  });

  it('📌 [Boundary] hearing loss switched on before any sound makes no context for it; the first master is born filtered', () => {
    const { ac, made, targetsOf } = graphContext();
    let asked = 0;
    const a = built(() => { asked++; return ac; });
    a.setHearingLossGraph(true);
    expect(asked, 'restoring the simulation at boot made a context outside a gesture').toBe(0);
    expect(targetsOf(a.audioOut())).toEqual([made.filters[0]]);
  });

  it('🔴 [Right] the filter lowers a quiet frame to 0.12 and lets a loud one through — hearing loss, not silence', () => {
    const { ac, made } = graphContext();
    const a = built(() => ac);
    a.audioOut();
    a.setHearingLossGraph(true);
    const run = (level) => {
      const inp = new Float32Array(512).fill(level), out = new Float32Array(512);
      made.processors[0].onaudioprocess({ inputBuffer: { getChannelData: () => inp }, outputBuffer: { getChannelData: () => out } });
      return out[0];
    };
    expect(run(0.05)).toBeCloseTo(0.05 * 0.12, 6);
    expect(run(0.5)).toBeCloseTo(0.5, 6);
    expect(made.filters[0].frequency.value, 'the highs go first').toBe(1400);
  });

  it('🔴 [Right] the pause mutes the master and playing brings it back — and a mute with no master makes none', () => {
    const { ac, made } = graphContext();
    const a = built(() => ac);
    a.setMasterMuted(true);
    expect([a.audioCtx, made.gains.length], 'muting made a context and a master for nothing').toEqual([null, 0]);
    const master = a.audioOut();
    a.setMasterMuted(true);
    expect(master.gain.alvo).toBe(0);
    a.setMasterMuted(false);
    expect(master.gain.alvo).toBe(1);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/sonda-audio.py --novos`: the eighteen decisions of the two synths, all green before this file, all red with it.
// Re-probed after the cut into shared questions (`audible`, `contextFor`, `panned`, `outFor` — `sonda-audio-3.py`): 19 of 19,
// with «a hit goes out through the `interact` category», added with the cut — every other case hands a player's device, so the
// CATEGORY a hit is routed to (the mixer slider that moves the cane) was never run; green on the old shape too.
