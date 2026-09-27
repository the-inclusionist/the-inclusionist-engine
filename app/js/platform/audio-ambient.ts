// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio-ambient — a synthesised AMBIENT track (loops of filtered noise) + thunder. Only the SOUND lives here;
// the visual weather is the game's. The bridge to it: the rain level (0..1) is computed by the game's weather and READ
// here through a getter, so the rain's volume "follows the picture". Injection by closure.
//   updateAmbient() — per frame: builds the track once (lazily) and sets the WATER gain (nearness of what the game
//                     calls 'water') and the RAIN gain (follows the rain level). Gated by audioCat.ambient.on.
//   thunder(inten)  — a synthesised low rumble (low-passed noise) of variable intensity; called by the weather.

import type { Role, Spot } from '../core/contract.js';
import { noiseBuffer } from './audio.js';

interface AmbientNodes { hum: GainNode; wind: GainNode; water: GainNode; rain: GainNode; }
interface Vec2 { x: number; y: number; }

export interface AudioAmbientCtx {
  /**
   * WHERE THE WATER IS, ASKED OF THE GAME through the contract's `roleAt` — never read off a tile number. "Water is
   * tile 3" is true of ONE map (the platformer's), not of the engine: a game with another numbering would hear a river
   * in its lava and silence in its lake, with no error and no red test (ADR-0027's no. 1 coupling, the one
   * `render/high-contrast` shed by receiving `roleOf`). `roleAt` and not a bespoke `isWater`, because every cartridge
   * already answers it (`GameDeclaration.roleAt` is required) and 'water' is already a contract `Role`: a second
   * question would be a second table to drift from the one that paints high contrast and routes the sonar. Asked in
   * world units, at the corner of each cell of the neighbourhood (`TILE` per cell).
   * ⚠️ REQUIRED, by ADR-0224's precedent: an optional port would let a game forget it, and forgetting it would silence
   * the water without a word.
   */
  roleAt: (at: Spot) => Role;
  ensureAC: () => AudioContext | null;
  getAudioCtx: () => AudioContext | null;
  catNode: (cat: string) => AudioNode | null;
  audioOut: () => AudioNode | null;
  getSoundOn: () => boolean;
  getVolume: () => number;
  getAudioCat: () => Record<string, { on: boolean }> | null;
  getPlayers: () => Vec2[];
  TILE: number; // the step of the water sampling, in the world units `roleAt` receives (one cell of the game's grid)
  getRainLevel: () => number; // 0..1, computed by the game's weather
}

export interface AudioAmbient {
  updateAmbient: () => void;
  thunder: (inten: number) => void;
}

export function createAudioAmbient(ctx: AudioAmbientCtx): AudioAmbient {
  let _ambient: AmbientNodes | null = null;

  function buildAmbient(ac: AudioContext): AmbientNodes | null {
    const cat = ctx.catNode('ambient'); if (!cat) return null;
    const n = (ac.sampleRate * 2) | 0, buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } // looping pink noise
    const mk = (type: BiquadFilterType, freq: number, q: number, vol: number): GainNode => {
      const s = ac.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = ac.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(cat); try { s.start(); } catch (e) { /* noop */ } return g;
    };
    // traffic/rumble · leaves/wind · water (nearness) · rain (cycle)
    return { hum: mk('lowpass', 480, 0, 0.055), wind: mk('highpass', 3200, 0, 0.028), water: mk('bandpass', 820, 1.4, 0), rain: mk('highpass', 1700, 0, 0) };
  }

  function updateAmbient(): void {
    const ac = ctx.getAudioCtx(), cat = ctx.getAudioCat();
    if (!ac || !ctx.getSoundOn() || !cat || !cat.ambient || !cat.ambient.on) return;
    if (!_ambient) { _ambient = buildAmbient(ac); if (!_ambient) return; }
    const pl = ctx.getPlayers()[0], px = Math.floor(pl.x / ctx.TILE), py = Math.floor(pl.y / ctx.TILE);
    let nearWater = 0;
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
      if (ctx.roleAt({ x: (px + dx) * ctx.TILE, y: (py + dy) * ctx.TILE }) === 'water') nearWater = Math.max(nearWater, 1 - Math.hypot(dx, dy) / 4.2);
    }
    _ambient.water.gain.setTargetAtTime(0.15 * nearWater, ac.currentTime, 0.3);
    _ambient.rain.gain.setTargetAtTime(0.09 * ctx.getRainLevel(), ac.currentTime, 0.5); // the rain follows the rain level; 0 = full silence
  }

  function thunder(inten: number): void { // a synthesised low rumble (variable intensity)
    if (!ctx.getSoundOn() || ctx.getVolume() <= 0) return; const ac = ctx.ensureAC(); if (!ac) return;
    try {
      const vol = ctx.getVolume();
      // the engine's own white noise (ADR-0258): a game could only ever hand back this same function
      const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac); src.loop = true;
      const bq = ac.createBiquadFilter(); bq.type = 'lowpass'; bq.frequency.value = 140 + Math.random() * 220; bq.Q.value = 0.7;
      const g = ac.createGain(), t = ac.currentTime, dur = 0.7 + inten * 1.4;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.min(0.55, 0.2 * inten) * vol, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bq).connect(g).connect(ctx.catNode('ambient') || ctx.audioOut() || ac.destination); src.start(t); src.stop(t + dur + 0.1);
    } catch (e) { /* no Web Audio */ }
  }

  return { updateAmbient, thunder };
}
