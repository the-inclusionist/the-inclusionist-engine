// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio-jingles — sound rewards (jingles) with NO game state: victory, puzzle solved and fireworks.
// It depends only on the primitives of platform/audio (tone/ensureAC/catNode/audioOut) plus the live soundOn/volume — no
// tiles, players, coins or DOM. Injection by closure.
//   playVictory      — a rising 8-bit jingle (C5 E5 G5 C6 B5 E6) + 4 fireworks.
//   playPuzzleSolved — a SWEET rising sine phrase (E5 G5 B5 E6 over a C6), Zelda OoT; NEVER aggressive (the Dev's call).
//   firework         — a rising whistle (sine 300→1200 Hz) + burst/crackle (5 square oscillators); used by playVictory.

type ToneFn = (freq: number, dur: number, type?: OscillatorType, when?: number, vol?: number) => void;

export interface AudioJinglesCtx {
  tone: ToneFn;                          // platform/audio's oscillator synth (already honours soundOn/volume)
  ensureAC: () => AudioContext | null;   // the AudioContext's lifecycle
  catNode: (cat: string) => AudioNode | null; // the mixer's per-category bus
  audioOut: () => AudioNode | null;      // the master node (catNode's fallback)
  getSoundOn: () => boolean;             // a live binding (the mixer reassigns it)
  getVolume: () => number;               // a live binding
}

export interface AudioJingles {
  playVictory: () => void;
  playPuzzleSolved: () => void;
  firework: (when?: number) => void;
}

export function createAudioJingles(ctx: AudioJinglesCtx): AudioJingles {
  // Fireworks: raw oscillators only (no `tone`), so they check soundOn/volume here and scale the gain by the volume.
  function firework(when?: number): void {
    if (!ctx.getSoundOn() || ctx.getVolume() <= 0) return;
    try {
      const ac = ctx.ensureAC(); if (!ac) return;
      const vol = ctx.getVolume(), t = ac.currentTime + (when || 0);
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(1200, t + 0.35); // rising whistle
      const out = ctx.catNode('earcons') || ctx.audioOut() || ac.destination;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 * vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.4);
      [0, 0.04, 0.09, 0.15, 0.22].forEach((dt, i) => { // burst/crackle
        const po = ac.createOscillator(), pg = ac.createGain(), tt = t + 0.36 + dt;
        po.type = 'square'; po.frequency.setValueAtTime(180 + ((i * 131) % 520), tt);
        pg.gain.setValueAtTime(0.18 * vol, tt); pg.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09);
        po.connect(pg).connect(out); po.start(tt); po.stop(tt + 0.11);
      });
    } catch (e) { /* no Web Audio */ }
  }

  function playVictory(): void {
    ([[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [988, 0.52], [1319, 0.64]] as [number, number][])
      .forEach(([f, w]) => ctx.tone(f, 0.16, 'square', w, 0.22));
    [0.2, 0.8, 1.35, 1.9].forEach((w) => firework(w));
  }

  function playPuzzleSolved(): void { // E5 G5 B5 E6 over a C6
    ([[659, 0], [784, 0.13], [988, 0.26], [1319, 0.42]] as [number, number][])
      .forEach(([f, w]) => ctx.tone(f, 0.32, 'sine', w, 0.12));
    ctx.tone(1047, 0.6, 'sine', 0.42, 0.07);
  }

  return { playVictory, playPuzzleSolved, firework };
}
