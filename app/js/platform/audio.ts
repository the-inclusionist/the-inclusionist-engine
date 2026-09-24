// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio.ts — base do áudio: ciclo do AudioContext (ensureAC) + definições de SFX (dados). Módulo-folha.
// O grafo (master/mixer), soundOn/volume e as sínteses (tone/noiseHit/tonePan/sfx) ainda ficam no game.js —
// migram numa rodada dedicada (injeção de dependência). audioCtx é binding vivo; só ensureAC o (re)cria. (Fase 2)
import { loadAudioCat, saveAudioCat } from './audio-mixer.js'; // mixer por categoria (dados + persistência)

type CatState = { on: boolean; vol: number };
type PlayerCtx = { ac: AudioContext; out: AudioNode }; // contexto de áudio por-jogador (roteia ao dispositivo do jogador)
type ACWithCache = AudioContext & { _noiseBuf?: AudioBuffer }; // ensureAC cacheia o ruído no próprio contexto

// Som mestre: liga/desliga + volume (0..1). Sessão-only (sem persistência). Bindings vivos: as sínteses
// (tone/noiseHit/…) e a narração leem soundOn/volume; o botão/slider mestre do game.js escreve pelos setters.
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

// ===== Nó MESTRE: master gain → (filtro de perda auditiva opcional) → destino. =====
export let hearingLoss = false;
let _masterGain: GainNode | null = null, _hlChain: { input: AudioNode } | null = null;
export function audioOut(): GainNode | null { const ac = ensureAC(); if (!ac) return null; if (!_masterGain) { _masterGain = ac.createGain(); wireMaster(); } return _masterGain; }
function buildHearingChain(ac: AudioContext): { input: AudioNode } {
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.7; // agudos primeiro
  const sp = ac.createScriptProcessor(512, 1, 1); const TH = 0.06, RED = 0.12; // frame < limiar → ×0.12 (contrário de aparelho auditivo)
  sp.onaudioprocess = (e) => { const inp = e.inputBuffer.getChannelData(0), out = e.outputBuffer.getChannelData(0); let s = 0; for (let i = 0; i < inp.length; i++) s += inp[i] * inp[i]; const g = Math.sqrt(s / inp.length) < TH ? RED : 1; for (let i = 0; i < inp.length; i++) out[i] = inp[i] * g; };
  lp.connect(sp); sp.connect(ac.destination); return { input: lp };
}
function wireMaster(): void { const ac = audioCtx; if (!ac || !_masterGain) return; try { _masterGain.disconnect(); } catch (e) { /* noop */ }
  if (hearingLoss) { if (!_hlChain) _hlChain = buildHearingChain(ac); _masterGain.connect(_hlChain.input); } else _masterGain.connect(ac.destination); }
// Empatia de perda auditiva: liga/desliga o filtro no nó mestre. A persistência + srSay ficam no game.js.
export function setHearingLossGraph(on: boolean): void { hearingLoss = on; if (audioCtx) { audioOut(); wireMaster(); } }
// Mute mestre (pausa/título silenciam tudo; volta ao jogar). Só age se o nó mestre já existe (não o cria à toa).
export function setMasterMuted(muted: boolean): void { if (!_masterGain || !audioCtx) return; try { _masterGain.gain.setTargetAtTime(muted ? 0 : 1, audioCtx.currentTime, 0.04); } catch (e) { /* noop */ } }

// ===== Mixer por categoria: cada categoria tem seu gain (liga/desliga + volume), pendurado no nó mestre. =====
// audioCat é a fonte viva do estado do mixer (mutada pela UI/calmMode no game.js — objeto, nunca reatribuído
// APÓS init). NULL até initAudioMixer(): o import fica PURO (não lê localStorage). initAudioMixer é chamado no
// boot do game.js — todos os leitores de audioCat (mixer/ambiente/narração) rodam depois. (Fase 2.25)
export let audioCat: Record<string, CatState> | null = null;
// Carrega o estado do mixer (defaults do audio-mixer.js + o que estiver salvo). I/O EXPLÍCITO, idempotente.
export function initAudioMixer(): void { if (!audioCat) audioCat = loadAudioCat(); }
const _catNodes: Record<string, GainNode> = {};
export function catNode(cat: string): GainNode | null { const ac = ensureAC(); if (!ac || !audioCat) return null; const out = audioOut(); if (!out) return null; if (!_catNodes[cat]) { const g = ac.createGain(); g.gain.value = audioCat[cat].on ? audioCat[cat].vol : 0; g.connect(out); _catNodes[cat] = g; } return _catNodes[cat]; }
export function setCatGain(cat: string): void { if (!audioCat) return; const g = _catNodes[cat]; if (g && audioCtx) g.gain.setTargetAtTime(audioCat[cat].on ? audioCat[cat].vol : 0, audioCtx.currentTime, 0.02); saveAudioCat(cat, audioCat[cat]); }

// ===== Sínteses de oscilador (earcons/melodias). Leem soundOn/volume; roteiam pelo mixer→mestre. =====
// pc = contexto de áudio por-jogador (opcional; o game.js o passa p/ rotear a pista ao dispositivo do jogador).
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

// ===== Synth de RUÍDO (passos por material, bengala). noiseBuffer cacheia por-contexto (suporta AC por jogador). =====
export let _footCount = 0; // contador de passos/pancadas (estatística de a11y; o __incl do game.js lê via getter)
export function noiseBuffer(ac: ACWithCache): AudioBuffer { if (ac._noiseBuf && ac._noiseBuf.length === ((ac.sampleRate * 0.2) | 0)) return ac._noiseBuf; const n = (ac.sampleRate * 0.2) | 0, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return ac._noiseBuf = b; }
// timbre por material: filtro (f) + frequência (hz) + duração (d) + volume (v)
type FootTimbre = { f: BiquadFilterType; hz: number; d: number; v: number };
const FOOT: Record<string, FootTimbre> = { grama:{f:'highpass',hz:2000,d:0.09,v:0.10}, piso:{f:'bandpass',hz:1200,d:0.06,v:0.15}, pedra:{f:'highpass',hz:1600,d:0.05,v:0.19},
  areia:{f:'lowpass',hz:650,d:0.13,v:0.10}, madeira:{f:'bandpass',hz:480,d:0.08,v:0.15}, ferro:{f:'bandpass',hz:2600,d:0.12,v:0.16}, parede:{f:'highpass',hz:3200,d:0.10,v:0.08},
  terra:{f:'lowpass',hz:520,d:0.11,v:0.12}, agua:{f:'lowpass',hz:330,d:0.15,v:0.13} };
export function noiseHit(mat: string, pan?: number | null, pc?: PlayerCtx | null): void { if (!audible()) return; const ac = contextFor(pc); if (!ac) return; const f = FOOT[mat] || FOOT.piso; try {
  const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); const bq = ac.createBiquadFilter(); bq.type = f.f; bq.frequency.value = f.hz; bq.Q.value = 1.2;
  const g = ac.createGain(), t = ac.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.02, f.v * volume), t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + f.d);
  src.connect(bq).connect(g); panned(ac, g, pan).connect(outFor(ac, 'interact', pc)); src.start(t); src.stop(t + f.d + 0.03); _footCount++;
} catch (e) { /* noop */ } }

/* A TABELA DE EARCONS SAIU daqui em 2026-08-25 (item 19) — está em `game/earcons`.
 *
 * De dez earcons, sete eram deste jogo: `coin`/`key`/`gate`/`power` são objetos deste mundo e
 * `correct`/`wrong`/`place` são eventos da atividade. O gate acusava só a linha do `coin`, porque é a única
 * com palavra que o casador conhece — e a linha acusada era a menos interessante das dez.
 *
 * As legendas eram pt-BR CRU (`'🔊 Coletou'`, `'🔊 Portão abriu'`): nove frases dentro de um módulo de
 * plataforma, que o gate de i18n do `main.js` não alcança. Viraram CHAVES, e quem exibe resolve.
 *
 * O que ficou aqui é a SÍNTESE — oscilador, envelope, ruído, roteamento por categoria —, que serve a
 * qualquer jogo. O que é 880 Hz de triangular por 0,14 s ao pegar uma moeda, não. */
