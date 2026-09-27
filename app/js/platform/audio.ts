// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio.ts — the audio base: the AudioContext's lifecycle (ensureAC), the master and mixer graph, and the
// oscillator and noise syntheses every game's cues are made of. One per root (ADR-0232 D4, issue #207): `createAudio` holds
// the context, the master, the mixer and the counters in its closure, and receives the host's context maker and store.
import { loadAudioCat, saveAudioCat, type AudioCatStore } from './audio-mixer.js'; // per-category mixer (data + persistence)

export type CatState = { on: boolean; vol: number };
type PlayerCtx = { ac: AudioContext; out: AudioNode }; // a per-player audio context (routes to that player's device)
type ACWithCache = AudioContext & { _noiseBuf?: AudioBuffer }; // the noise buffer is cached on the context itself

export interface AudioDeps {
  /**
   * Makes the engine's AudioContext, or answers `null` where the host has none. Called at the FIRST sound and not before: a
   * context made before the child's first gesture is born suspended, and the browser only lets it run from a gesture. The root
   * builds it from `host.win` (ADR-0232 point 2); REQUIRED, because a default would be the page's window reached from here.
   */
  readonly newContext: () => AudioContext | null;
  /** Where the mixer's categories are read from and kept: the page's store, built by the root. */
  readonly store: AudioCatStore;
}

/**
 * ONE ROOT'S SOUND. The reads are GETTERS, so `audio.soundOn` is the value of now; copying one into a local freezes it. The
 * methods hold no `this` and can be destructured.
 */
export interface Audio {
  /** The game's master switch. Session only (not stored). */
  readonly soundOn: boolean;
  setSoundOn(v: boolean): void;
  /** The master volume, 0..1, which every synthesis multiplies by. Session only. */
  readonly volume: number;
  setVolume(v: number): void;
  /** The engine's context, `null` until the first sound asks for one. */
  readonly audioCtx: AudioContext | null;
  /** The context, made on the first call and resumed if the browser suspended it; `null` where the host has none. */
  ensureAC(): AudioContext | null;
  /** The master node (master gain → optional hearing-loss filter → destination), made on the first call. */
  audioOut(): GainNode | null;
  /** Whether the hearing-loss empathy simulation is on the master node. */
  readonly hearingLoss: boolean;
  /** Switches the hearing-loss filter on the master node. Storing it and announcing it are the caller's. */
  setHearingLossGraph(on: boolean): void;
  /** The pause and title silence everything; playing brings it back. Acts only if the master exists — never makes one. */
  setMasterMuted(muted: boolean): void;
  /**
   * The mixer's live state per category, loaded from the store when the audio is built. Written in place — `on`, `vol`, or the
   * whole category — by the panels, the bar and any game, and EVERY write that changes a value is told to `onCatChange`.
   */
  readonly audioCat: Record<string, CatState>;
  /**
   * Listens to every change of a category — its `on` or its `vol` — WHOEVER made it: the engine's panels and bar, and a game
   * writing `audio.audioCat.tts.on = false` itself (ADR-0247). Called with the category's key, after the value changed; a write
   * of the value already there is no change. Answers the function that stops listening.
   */
  onCatChange(listener: (cat: string) => void): () => void;
  /** A category's bus, hanging off the master node. */
  catNode(cat: string): GainNode | null;
  /** Moves a category's bus to its state now, and keeps that state in the store. */
  setCatGain(cat: string): void;
  tone(freq: number, dur: number, type?: OscillatorType, when?: number, vol?: number): void;
  /** `pc` = a per-player audio context, passed to route the cue to that player's device. */
  tonePan(freq: number, dur: number, cat: string, pan?: number | null, vol?: number, type?: OscillatorType, pc?: PlayerCtx | null): void;
  noiseHit(mat: string, pan?: number | null, pc?: PlayerCtx | null): void;
  /** A count of steps and taps (an accessibility statistic). */
  readonly footCount: number;
}

export function noiseBuffer(ac: ACWithCache): AudioBuffer { if (ac._noiseBuf && ac._noiseBuf.length === ((ac.sampleRate * 0.2) | 0)) return ac._noiseBuf; const n = (ac.sampleRate * 0.2) | 0, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return ac._noiseBuf = b; }
// timbre per material: filter (f) + frequency (hz) + duration (d) + volume (v)
type FootTimbre = { f: BiquadFilterType; hz: number; d: number; v: number };
const FOOT: Record<string, FootTimbre> = { grama:{f:'highpass',hz:2000,d:0.09,v:0.10}, piso:{f:'bandpass',hz:1200,d:0.06,v:0.15}, pedra:{f:'highpass',hz:1600,d:0.05,v:0.19},
  areia:{f:'lowpass',hz:650,d:0.13,v:0.10}, madeira:{f:'bandpass',hz:480,d:0.08,v:0.15}, ferro:{f:'bandpass',hz:2600,d:0.12,v:0.16}, parede:{f:'highpass',hz:3200,d:0.10,v:0.08},
  terra:{f:'lowpass',hz:520,d:0.11,v:0.12}, agua:{f:'lowpass',hz:330,d:0.15,v:0.13} };

function buildHearingChain(ac: AudioContext): { input: AudioNode } {
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.7; // the highs go first
  const sp = ac.createScriptProcessor(512, 1, 1); const TH = 0.06, RED = 0.12; // a frame below the threshold → ×0.12 (a hearing aid in reverse)
  sp.onaudioprocess = (e) => { const inp = e.inputBuffer.getChannelData(0), out = e.outputBuffer.getChannelData(0); let s = 0; for (let i = 0; i < inp.length; i++) s += inp[i] * inp[i]; const g = Math.sqrt(s / inp.length) < TH ? RED : 1; for (let i = 0; i < inp.length; i++) out[i] = inp[i] * g; };
  lp.connect(sp); sp.connect(ac.destination); return { input: lp };
}

/**
 * THE CATEGORIES AS THE MIXER HOLDS THEM, each write heard (ADR-0247). A game reaches the mixer itself (`Engine.audio`), and
 * its door to a category is a plain property write — `audioCat.tts.on = false` — with no call after it that an event could
 * hang on. So the write IS the door: `on` and `vol` are accessors that tell `changed`, and so is the category itself, whose
 * replacement (`audioCat.tts = {…}`) is copied INTO the mixer's object — replaced, the object every surface reads would come
 * apart from the one the engine and the game write, and no later write would be heard.
 */
function heardCategories(stored: Record<string, CatState>, changed: (cat: string) => void): Record<string, CatState> {
  const cats: Record<string, CatState> = {};
  for (const [k, first] of Object.entries(stored)) {
    let on = first.on, vol = first.vol;
    const live = {} as CatState;
    Object.defineProperties(live, {
      on: { enumerable: true, get: () => on, set: (v: boolean) => { if (v !== on) { on = v; changed(k); } } },
      vol: { enumerable: true, get: () => vol, set: (v: number) => { if (v !== vol) { vol = v; changed(k); } } },
    });
    Object.defineProperty(cats, k, { enumerable: true, get: () => live, set: (v: CatState) => { live.on = v.on; live.vol = v.vol; } });
  }
  return cats;
}

/** The last node before the output: a panner clamped to the two ears when a pan is asked, the gain itself when not. */
function panned(ac: AudioContext, g: GainNode, pan?: number | null): AudioNode {
  if (pan == null || !ac.createStereoPanner) return g;
  const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); return p;
}

/**
 * Builds one root's sound. The mixer's state is read from `store` HERE, so a voice built after it finds its categories — the
 * order the second consumer once found by the silence (create-game, finding 3) is now the order of construction.
 */
export function createAudio(deps: AudioDeps): Audio {
  let soundOn = true, volume = 0.6;
  let audioCtx: AudioContext | null = null;
  let hearingLoss = false;
  let masterGain: GainNode | null = null, hlChain: { input: AudioNode } | null = null;
  let footCount = 0;
  const catListeners = new Set<(cat: string) => void>();
  // a copy of the listeners, so one that stops listening while it is told does not skip the next
  const audioCat = heardCategories(loadAudioCat(deps.store), (cat) => { for (const l of [...catListeners]) l(cat); });
  const catNodes: Record<string, GainNode> = {};
  function onCatChange(listener: (cat: string) => void): () => void {
    catListeners.add(listener);
    return () => { catListeners.delete(listener); };
  }

  function ensureAC(): AudioContext | null {
    if (!audioCtx) audioCtx = deps.newContext();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // ===== The MASTER node: master gain → (optional hearing-loss filter) → destination. =====
  function audioOut(): GainNode | null { const ac = ensureAC(); if (!ac) return null; if (!masterGain) { masterGain = ac.createGain(); wireMaster(); } return masterGain; }
  function wireMaster(): void { const ac = audioCtx; if (!ac || !masterGain) return; try { masterGain.disconnect(); } catch (e) { /* noop */ }
    if (hearingLoss) { if (!hlChain) hlChain = buildHearingChain(ac); masterGain.connect(hlChain.input); } else masterGain.connect(ac.destination); }
  function setHearingLossGraph(on: boolean): void { hearingLoss = on; if (audioCtx) { audioOut(); wireMaster(); } }
  function setMasterMuted(muted: boolean): void { if (!masterGain || !audioCtx) return; try { masterGain.gain.setTargetAtTime(muted ? 0 : 1, audioCtx.currentTime, 0.04); } catch (e) { /* noop */ } }

  // ===== The per-category mixer: each category has its gain (on/off + volume), hanging off the master node. =====
  /** A category's level: silence when it is switched off, its volume when on — asked the same way when its bus is made and when the slider moves. */
  function catLevel(cat: string): number { const c = audioCat[cat]; return c.on ? c.vol : 0; }
  function catNode(cat: string): GainNode | null { const ac = ensureAC(); if (!ac) return null; const out = audioOut(); if (!out) return null; if (!catNodes[cat]) { const g = ac.createGain(); g.gain.value = catLevel(cat); g.connect(out); catNodes[cat] = g; } return catNodes[cat]; }
  function setCatGain(cat: string): void { const g = catNodes[cat]; if (g && audioCtx) g.gain.setTargetAtTime(catLevel(cat), audioCtx.currentTime, 0.02); saveAudioCat(deps.store, cat, audioCat[cat]); }

  // ===== The questions a cue asks before it sounds, the same for the tone and the noise. =====
  /** Whether a sound may play at all: the game's sound on, and the master above zero. */
  function audible(): boolean { return soundOn && volume > 0; }
  /** The context a cue plays in: the player's own device when one is given, the engine's otherwise. */
  function contextFor(pc?: PlayerCtx | null): AudioContext | null { return pc ? pc.ac : ensureAC(); }
  /** Where a cue goes out: the player's own device; otherwise its category's bus, the master, or the device itself. */
  function outFor(ac: AudioContext, cat: string, pc?: PlayerCtx | null): AudioNode { return pc ? pc.out : (catNode(cat) || audioOut() || ac.destination); }

  // ===== Oscillator syntheses (earcons/melodies). They read soundOn/volume and route through mixer → master. =====
  function tone(freq: number, dur: number, type?: OscillatorType, when?: number, vol?: number): void { if (!audible()) return; try { const ac = contextFor(); if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + (when || 0);
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.02, (vol || 0.22) * volume), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(outFor(ac, 'earcons')); o.start(t); o.stop(t + dur + 0.02); } catch (e) { /* noop */ } }
  function tonePan(freq: number, dur: number, cat: string, pan?: number | null, vol?: number, type?: OscillatorType, pc?: PlayerCtx | null): void { if (!audible()) return; const ac = contextFor(pc); if (!ac) return; try {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.02, (vol || 0.2) * volume), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); panned(ac, g, pan).connect(outFor(ac, cat, pc)); o.start(t); o.stop(t + dur + 0.02); } catch (e) { /* noop */ } }

  // ===== The NOISE synth (footsteps by material, the cane). noiseBuffer caches per context (supports one per player). =====
  function noiseHit(mat: string, pan?: number | null, pc?: PlayerCtx | null): void { if (!audible()) return; const ac = contextFor(pc); if (!ac) return; const f = FOOT[mat] || FOOT.piso; try {
    const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); const bq = ac.createBiquadFilter(); bq.type = f.f; bq.frequency.value = f.hz; bq.Q.value = 1.2;
    const g = ac.createGain(), t = ac.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.02, f.v * volume), t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + f.d);
    src.connect(bq).connect(g); panned(ac, g, pan).connect(outFor(ac, 'interact', pc)); src.start(t); src.stop(t + f.d + 0.03); footCount++;
  } catch (e) { /* noop */ } }

  return {
    get soundOn() { return soundOn; }, setSoundOn: (v) => { soundOn = v; },
    get volume() { return volume; }, setVolume: (v) => { volume = v; },
    get audioCtx() { return audioCtx; }, ensureAC, audioOut,
    get hearingLoss() { return hearingLoss; }, setHearingLossGraph, setMasterMuted,
    audioCat, onCatChange, catNode, setCatGain,
    tone, tonePan, noiseHit,
    get footCount() { return footCount; },
  };
}

/* What lives here is the SYNTHESIS — oscillator, envelope, noise, routing by category — which serves any game. A table of
 * earcons does not: "880 Hz of triangle for 0.14 s when a coin is taken" is one game's world, and it lives with that game. */
