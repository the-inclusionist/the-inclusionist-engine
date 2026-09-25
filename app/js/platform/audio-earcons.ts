// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio-earcons — a game's earcons (sound icons) + the bridge to the visual CAPTIONS (deaf accessibility).
// It depends on platform/audio's primitives and, by injection, on the host's caption state. Injection by closure.
//   sfx(name)      — plays the earcon from the table (an oscillator) AND, when captions are ON and the earcon has a `.cap`,
//                    shows the caption BEFORE checking the sound → a deaf player "sees" the sound even with audio off.
//   doorSound(mat) — a door: a creak (wood, sawtooth) or a clang (iron, square) + a noise thud (noiseHit).

/**
 * The definition of ONE earcon. The table is the GAME's; this is the shape the engine knows how to play.
 *
 * ⚠️ EXPORTED (#124), and its absence was an interface defect: a game declared its own copy of this type, word for word,
 * because it had no way to name it. A shape each consumer rediscovers by copying is a shape that diverges.
 */
export interface SfxDef {
  /** The timbre. */
  t: OscillatorType;
  /** The starting frequency, in hertz. */
  f: number;
  /** The duration, in seconds. */
  d: number;
  /** The caption's i18n KEY (deaf accessibility). Whoever shows it resolves it. */
  cap?: string;
  /**
   * The FINAL frequency, in hertz. Absent = a held note, which is what there always was.
   *
   * ⚠️ IT EXISTS BECAUSE AN EARCON HAS TO BE ABLE TO GO SOMEWHERE (#124). Measured building a football game: scoring and
   * conceding must be told apart **by ear alone** — a blind child hears the room react and needs to know which way before
   * the narration arrives. The obvious design is a figure that RISES for their goal and FALLS for the other's, and the
   * table could not say it. What was left was high-and-long against low-and-short: distinguishable, and less information
   * than the moment carries.
   *
   * ⚠️ AND THE CAPABILITY WAS ALREADY IN THIS FILE, unreachable from the table: `doorSound` does exactly this with
   * `frequency.exponentialRampToValueAtTime`. The fix was not new synthesis — it was opening the door.
   *
   * The ramp is EXPONENTIAL and not linear because pitch is perceived as a ratio, not a difference: a linear ramp from 200
   * to 800 rises fast at the start and slowly at the end, and sounds crooked.
   */
  f2?: number;
}
import type { Translate } from '../core/i18n.js'; // `cap` holds a KEY, and whoever shows it resolves it

export interface AudioEarconsCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  SFX: Record<string, SfxDef | undefined>;      // the earcon table (the game's)
  ensureAC: () => AudioContext | null;
  catNode: (cat: string) => AudioNode | null;   // the per-category bus (earcons/interact)
  audioOut: () => AudioNode | null;             // the master node (fallback)
  noiseHit: (mat: string) => void;              // the per-material noise synth (the door's thud)
  getSoundOn: () => boolean;                     // live bindings (the mixer reassigns them)
  getVolume: () => number;
  getCaptionsOn: () => boolean;                  // are captions on? (the panels toggle it)
  showCaption: (txt: string) => void;            // draws the caption (the host's DOM)
}

export interface AudioEarcons {
  sfx: (name: string) => void;
  doorSound: (mat: string) => void;
}

export function createAudioEarcons(ctx: AudioEarconsCtx): AudioEarcons {
  const { t } = ctx;
  /** Whether a sound may play at all: the game's sound on, and a volume above zero. */
  const audible = (): boolean => ctx.getSoundOn() && ctx.getVolume() > 0;
  /** A category's bus; without one, the master; without that, the device itself. */
  const busFor = (cat: string, ac: AudioContext): AudioNode => ctx.catNode(cat) || ctx.audioOut() || ac.destination;

  function sfx(name: string): void {
    const c = ctx.SFX[name]; if (!c) return;
    // The CAPTION first (visual + aria-live through role=status) — and RESOLVED where it is used: `cap` holds the KEY,
    // because the table lives in the game and a `const` table of text would freeze in the boot's language.
    if (ctx.getCaptionsOn() && c.cap) ctx.showCaption(t(c.cap));
    if (!audible()) return;    // ...only then the sound — for a deaf player the caption is already out
    try { play(c); } catch (e) { /* no Web Audio */ }
  }

  /** One earcon: its timbre, its figure when the table asks for one, a peak that follows the master volume, and its length. */
  function play(c: SfxDef): void {
    const ac = ctx.ensureAC(); if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = c.t; o.frequency.value = c.f; g.gain.value = 0.0001;
    o.connect(g).connect(busFor('earcons', ac));
    const now = ac.currentTime, vol = ctx.getVolume();
    glide(o, c, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.02, 0.25 * vol), now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + c.d);
    o.start(now); o.stop(now + c.d + 0.02);
  }

  /**
   * THE FIGURE, when the table asks for one (#124). `setValueAtTime` before the ramp as in `doorSound`: without it the
   * curve's starting point is up to the implementation, and the glissando starts wherever it happens to.
   *
   * ⚠️ THE TWO GUARDS ARE NEEDED, NOT FUSSINESS. `exponentialRampToValueAtTime` THROWS on a zero or negative target — a
   * table with `f2: 0` would kill the whole earcon through the `catch`, in silence. And `f2 === f` is no ramp at all:
   * asking the browser for it would be work to produce the held note that was already there.
   */
  function glide(o: OscillatorNode, c: SfxDef, now: number): void {
    if (typeof c.f2 !== 'number' || c.f2 <= 0 || c.f2 === c.f) return;
    o.frequency.setValueAtTime(c.f, now);
    o.frequency.exponentialRampToValueAtTime(c.f2, now + c.d);
  }

  function doorSound(mat: string): void {
    if (!audible()) return;
    const ac = ctx.ensureAC(); if (!ac) return;
    try { // a door: a creak (wood) or a clang (iron) + a thud
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime, vol = ctx.getVolume();
      o.type = mat === 'ferro' ? 'square' : 'sawtooth';
      o.frequency.setValueAtTime(mat === 'ferro' ? 520 : 200, t);
      o.frequency.exponentialRampToValueAtTime(mat === 'ferro' ? 300 : 110, t + 0.3);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14 * vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(busFor('interact', ac));
      o.start(t); o.stop(t + 0.4); ctx.noiseHit(mat === 'ferro' ? 'ferro' : 'madeira');
    } catch (e) { /* no Web Audio */ }
  }

  return { sfx, doorSound };
}
