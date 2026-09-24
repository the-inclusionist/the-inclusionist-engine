// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio.ts — the audio base: the AudioContext's lifecycle (ensureAC), the master and mixer graph, and the
// oscillator and noise syntheses every game's cues are made of. `audioCtx` is a live binding; only ensureAC (re)creates it.
import { loadAudioCat, saveAudioCat, type AudioCatStore } from './audio-mixer.js'; // per-category mixer (data + persistence)

type CatState = { on: boolean; vol: number };
type PlayerCtx = { ac: AudioContext; out: AudioNode }; // a per-player audio context (routes to that player's device)
type ACWithCache = AudioContext & { _noiseBuf?: AudioBuffer }; // the noise buffer is cached on the context itself

// Master sound: on/off + volume (0..1). Session only (not stored). Live bindings: the syntheses and the narration read
// soundOn/volume; the master controls write through the setters.
export let soundOn = true;
export function setSoundOn(v: boolean): void { soundOn = v; }
export let volume = 0.6;
export function setVolume(v: number): void { volume = v; }

export let audioCtx: AudioContext | null = null;
export function ensureAC(): AudioContext | null {
  if (!audioCtx) { const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (AC) audioCtx = new AC(); }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// ===== The MASTER node: master gain → (optional hearing-loss filter) → destination. =====
export let hearingLoss = false;
let _masterGain: GainNode | null = null, _hlChain: { input: AudioNode } | null = null;
export function audioOut(): GainNode | null { const ac = ensureAC(); if (!ac) return null; if (!_masterGain) { _masterGain = ac.createGain(); wireMaster(); } return _masterGain; }
function buildHearingChain(ac: AudioContext): { input: AudioNode } {
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.7; // the highs go first
  const sp = ac.createScriptProcessor(512, 1, 1); const TH = 0.06, RED = 0.12; // a frame below the threshold → ×0.12 (a hearing aid in reverse)
  sp.onaudioprocess = (e) => { const inp = e.inputBuffer.getChannelData(0), out = e.outputBuffer.getChannelData(0); let s = 0; for (let i = 0; i < inp.length; i++) s += inp[i] * inp[i]; const g = Math.sqrt(s / inp.length) < TH ? RED : 1; for (let i = 0; i < inp.length; i++) out[i] = inp[i] * g; };
  lp.connect(sp); sp.connect(ac.destination); return { input: lp };
}
function wireMaster(): void { const ac = audioCtx; if (!ac || !_masterGain) return; try { _masterGain.disconnect(); } catch (e) { /* noop */ }
  if (hearingLoss) { if (!_hlChain) _hlChain = buildHearingChain(ac); _masterGain.connect(_hlChain.input); } else _masterGain.connect(ac.destination); }
// The hearing-loss empathy simulation: switches the filter on the master node. Storing it and announcing it are the caller's.
export function setHearingLossGraph(on: boolean): void { hearingLoss = on; if (audioCtx) { audioOut(); wireMaster(); } }
// Master mute (pause and title silence everything; playing brings it back). Acts only if the master node exists — never
// creates one for nothing.
export function setMasterMuted(muted: boolean): void { if (!_masterGain || !audioCtx) return; try { _masterGain.gain.setTargetAtTime(muted ? 0 : 1, audioCtx.currentTime, 0.04); } catch (e) { /* noop */ } }

// ===== The per-category mixer: each category has its gain (on/off + volume), hanging off the master node. =====
// `audioCat` is the mixer state's live source (mutated by the panels — an object, never reassigned AFTER init). NULL until
// initAudioMixer(store): importing stays PURE (no storage read). The root calls it at boot, before any reader, with the page's
// store (ADR-0232, issue #207) — the one `setCatGain` persists through.
export let audioCat: Record<string, CatState> | null = null;
let mixerStore: AudioCatStore | null = null;
// Loads the mixer state (audio-mixer's defaults + whatever is stored). EXPLICIT I/O; the state loads once per page, and the
// latest root's store is the one written to (a second root on the page shares this module state until ADR-0232 D4).
export function initAudioMixer(store: AudioCatStore): void { mixerStore = store; if (!audioCat) audioCat = loadAudioCat(store); }
const _catNodes: Record<string, GainNode> = {};
/** A category's level: silence when it is switched off, its volume when on — asked the same way when its bus is made and when the slider moves. */
function catLevel(cat: string): number { const c = audioCat![cat]; return c.on ? c.vol : 0; }
export function catNode(cat: string): GainNode | null { const ac = ensureAC(); if (!ac || !audioCat) return null; const out = audioOut(); if (!out) return null; if (!_catNodes[cat]) { const g = ac.createGain(); g.gain.value = catLevel(cat); g.connect(out); _catNodes[cat] = g; } return _catNodes[cat]; }
export function setCatGain(cat: string): void { if (!audioCat) return; const g = _catNodes[cat]; if (g && audioCtx) g.gain.setTargetAtTime(catLevel(cat), audioCtx.currentTime, 0.02); if (mixerStore) saveAudioCat(mixerStore, cat, audioCat[cat]); }

// ===== Oscillator syntheses (earcons/melodies). They read soundOn/volume and route through mixer → master. =====
// pc = a per-player audio context (optional; passed to route the cue to that player's device).
export function tone(freq: number, dur: number, type?: OscillatorType, when?: number, vol?: number): void { if (!audible()) return; try { const ac = contextFor(); if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + (when || 0);
  o.type = type || 'square'; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.02, (vol || 0.22) * volume), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(outFor(ac, 'earcons')); o.start(t); o.stop(t + dur + 0.02); } catch (e) { /* noop */ } }
export function tonePan(freq: number, dur: number, cat: string, pan?: number | null, vol?: number, type?: OscillatorType, pc?: PlayerCtx | null): void { if (!audible()) return; const ac = contextFor(pc); if (!ac) return; try {
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type || 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.02, (vol || 0.2) * volume), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); panned(ac, g, pan).connect(outFor(ac, cat, pc)); o.start(t); o.stop(t + dur + 0.02); } catch (e) { /* noop */ } }

// ===== The questions a cue asks before it sounds, the same for the tone and the noise. =====
/** Whether a sound may play at all: the game's sound on, and the master above zero. */
function audible(): boolean { return soundOn && volume > 0; }
/** The context a cue plays in: the player's own device when one is given, the engine's otherwise. */
function contextFor(pc?: PlayerCtx | null): AudioContext | null { return pc ? pc.ac : ensureAC(); }
/** The last node before the output: a panner clamped to the two ears when a pan is asked, the gain itself when not. */
function panned(ac: AudioContext, g: GainNode, pan?: number | null): AudioNode {
  if (pan == null || !ac.createStereoPanner) return g;
  const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); return p;
}
/** Where a cue goes out: the player's own device; otherwise its category's bus, the master, or the device itself. */
function outFor(ac: AudioContext, cat: string, pc?: PlayerCtx | null): AudioNode { return pc ? pc.out : (catNode(cat) || audioOut() || ac.destination); }

// ===== The NOISE synth (footsteps by material, the cane). noiseBuffer caches per context (supports one per player). =====
export let _footCount = 0; // a count of steps/taps (an accessibility statistic, read through a getter)
export function noiseBuffer(ac: ACWithCache): AudioBuffer { if (ac._noiseBuf && ac._noiseBuf.length === ((ac.sampleRate * 0.2) | 0)) return ac._noiseBuf; const n = (ac.sampleRate * 0.2) | 0, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return ac._noiseBuf = b; }
// timbre per material: filter (f) + frequency (hz) + duration (d) + volume (v)
type FootTimbre = { f: BiquadFilterType; hz: number; d: number; v: number };
const FOOT: Record<string, FootTimbre> = { grama:{f:'highpass',hz:2000,d:0.09,v:0.10}, piso:{f:'bandpass',hz:1200,d:0.06,v:0.15}, pedra:{f:'highpass',hz:1600,d:0.05,v:0.19},
  areia:{f:'lowpass',hz:650,d:0.13,v:0.10}, madeira:{f:'bandpass',hz:480,d:0.08,v:0.15}, ferro:{f:'bandpass',hz:2600,d:0.12,v:0.16}, parede:{f:'highpass',hz:3200,d:0.10,v:0.08},
  terra:{f:'lowpass',hz:520,d:0.11,v:0.12}, agua:{f:'lowpass',hz:330,d:0.15,v:0.13} };
export function noiseHit(mat: string, pan?: number | null, pc?: PlayerCtx | null): void { if (!audible()) return; const ac = contextFor(pc); if (!ac) return; const f = FOOT[mat] || FOOT.piso; try {
  const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); const bq = ac.createBiquadFilter(); bq.type = f.f; bq.frequency.value = f.hz; bq.Q.value = 1.2;
  const g = ac.createGain(), t = ac.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.02, f.v * volume), t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + f.d);
  src.connect(bq).connect(g); panned(ac, g, pan).connect(outFor(ac, 'interact', pc)); src.start(t); src.stop(t + f.d + 0.03); _footCount++;
} catch (e) { /* noop */ } }

/* What lives here is the SYNTHESIS — oscillator, envelope, noise, routing by category — which serves any game. A table of
 * earcons does not: "880 Hz of triangle for 0.14 s when a coin is taken" is one game's world, and it lives with that game. */
