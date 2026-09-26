// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/libras-avatar-plan — WHAT THE FREE PLAYER SIGNS, IN WHICH ORDER, AND WHEN EACH CLIP STARTS (ADR-0234, route B, phase B2).
//
// Route B signs with LAViD-UFPB's own sign sources, exported once to ONE avatar and ONE three.js clip per sign
// (`scripts/libras-export.mjs`, phase B1). This module is the player's pure half — no three.js, no DOM — so the queue, the
// timing and the fingerspelling are held in node (`tests/libras-avatar-plan.node.test.js`); `ui/libras-avatar-stage` plays what
// it decides and `ui/libras-avatar-player` puts it behind the `Interpreter` port.
//
// THE GLOSS IS THE ONE ROUTE A PLAYS: the delivery's build-time glosses (`ui/libras-glosses`), where a word with no sign is
// already written as the child reads it on the screen. A token the delivery carries a clip for is signed; any other is
// FINGERSPELLED letter by letter from the clips named by a single letter or digit — the word as written, capitals, accents
// stripped (`provisionalGloss`), which is route A's rule. 📌 A word whose letters the avatar does not all carry is LEFT OUT
// WHOLE, and said: spelling only the letters it has would show the child another word («ENTROU» with only its O is «O»).
//
// THE TIMING: each clip plays its window once, and the next one starts `CROSS_FADE_S` before it ends, fading in while the other
// fades out — every exported clip starts and ends in the same pose (arms down), so the overlap joins them without passing
// through the avatar's rest. The last one plays to its end and its final pose is held: that moment is the player's «stopped».

import { provisionalGloss } from './libras-glosses.js';

/** Where the delivery puts the free player's avatar, clips and manifest, beside the game's page (`inclusionist-heavy --libras-avatar`). */
export const LIBRAS_AVATAR_FOLDER = 'libras/avatar/';
/** The manifest the delivery writes in that folder: the avatar's file and every clip it carries, with its window. */
export const LIBRAS_AVATAR_MANIFEST = 'manifest.json';
/**
 * How long two clips overlap, fading one into the other, in seconds. Every clip is at least 1.2 s (📏 the 632 of the export:
 * 1.2–7.1 s, median 2.47 s), and the overlap never exceeds half of either clip, so no clip is swallowed by its neighbours.
 */
export const CROSS_FADE_S = 0.3;

/** One clip the delivery carries: its file under the folder, and the stretch of it that is played. */
export interface ClipWindow {
  readonly file: string;
  /** The clip's length in seconds, as exported. */
  readonly duration: number;
  /**
   * Where the sign starts, in seconds — 0 for every clip but one: the export of FALA begins at a stray keyframe 1404 frames
   * before the sign (46.8 s at 30 fps), which the delivery's pins name, so the player plays from the sign and not from the stray.
   */
  readonly from: number;
}

/** The delivery's manifest, read: the avatar's file and the clips by name. */
export interface AvatarManifest {
  readonly avatar: string;
  readonly clips: ReadonlyMap<string, ClipWindow>;
}

const isWindow = (w: unknown): w is ClipWindow => {
  const c = w as Partial<ClipWindow> | null;
  return !!c && typeof c.file === 'string' && typeof c.duration === 'number' && c.duration > 0
    && (c.from === undefined || (typeof c.from === 'number' && c.from >= 0 && c.from < c.duration));
};

/**
 * The manifest the delivery wrote, or `null` for anything else — no file, a fallback page, another format: a delivery that did
 * not ship the avatar. A clip entry of the wrong shape is left out, not trusted.
 */
export function avatarManifestOf(data: unknown): AvatarManifest | null {
  const m = data as { format?: unknown; avatar?: unknown; clips?: unknown } | null;
  if (!m || m.format !== 1 || typeof m.avatar !== 'string' || !m.avatar || typeof m.clips !== 'object' || m.clips === null) return null;
  const clips = new Map<string, ClipWindow>();
  for (const [name, w] of Object.entries(m.clips as Record<string, unknown>)) {
    if (isWindow(w)) clips.set(name, { file: w.file, duration: w.duration, from: w.from ?? 0 });
  }
  return { avatar: m.avatar, clips };
}

/** How long a clip plays: its window, from `from` to its end. */
export const playedLength = (w: ClipWindow): number => w.duration - w.from;

/** One clip to play: a sign, or a letter of a word being fingerspelled (`spells`, the word). */
export interface SignStep {
  readonly clip: string;
  readonly spells?: string;
}

/** A word the avatar could not sign: no clip of its own, and letters it has no clip for. */
export interface UnsignedWord {
  readonly word: string;
  readonly missing: readonly string[];
}

export interface SignPlan {
  readonly steps: readonly SignStep[];
  readonly unsigned: readonly UnsignedWord[];
}

/** A gloss token that is not a sign: punctuation (`[PONTO]`) or a template hole the lookup left (`{n}`). */
const NOT_A_SIGN = /^\[.*\]$|^\{.*\}$/u;

/**
 * The clips a gloss is signed with, in order: a token with a clip is its clip; any other is fingerspelled from the letter and
 * digit clips, as written (capitals, accents stripped); a word with a letter the avatar lacks is left out whole and listed.
 */
export function planSigns(gloss: string, carried: (name: string) => boolean): SignPlan {
  const steps: SignStep[] = [];
  const unsigned: UnsignedWord[] = [];
  for (const token of gloss.split(/\s+/u)) {
    if (!token || NOT_A_SIGN.test(token)) continue;
    if (carried(token)) { steps.push({ clip: token }); continue; }
    const letters = [...provisionalGloss(token).replace(/\s+/gu, '')];
    if (!letters.length) continue;
    const missing = [...new Set(letters.filter((c) => !carried(c)))];
    if (missing.length) { unsigned.push({ word: token, missing }); continue; }
    for (const c of letters) steps.push({ clip: c, spells: token });
  }
  return { steps, unsigned };
}

/**
 * What the avatar left out of a text, said for `problems` (the `unsigned` of a `SignResult`): the words, and the letters it
 * lacks clips for. `undefined` when it left nothing out.
 */
export function unsignedText(unsigned: readonly UnsignedWord[]): string | undefined {
  if (!unsigned.length) return undefined;
  const words = [...new Set(unsigned.map((u) => `«${u.word}»`))];
  const letters = [...new Set(unsigned.flatMap((u) => u.missing))].sort();
  const one = words.length === 1;
  return `${words.join(', ')} ${one ? 'lacks a sign of its' : 'lack a sign of their'} own and could not be fingerspelled: `
    + `the avatar lacks the clips for ${letters.join(', ')}`;
}

/**
 * Everything a request left out: the words it could neither sign nor spell, and the clips the delivery could not give (`unread`).
 * `undefined` when it left nothing out.
 */
export function leftOutText(unsigned: readonly UnsignedWord[], unread: readonly string[]): string | undefined {
  const parts = [unsignedText(unsigned), unread.length ? `the clips of ${unread.map((n) => `«${n}»`).join(', ')} could not be read from the delivery` : ''];
  return parts.filter(Boolean).join('; ') || undefined;
}

/** Why a request with nothing left to sign was not signed. */
export const nothingSigned = (leftOut: string | undefined): string =>
  `none of the text could be signed: ${leftOut ?? 'it holds not a single word'}`;

/** A clip to put on the stage now: fading in over `fade` seconds from what is there, starting `at` seconds into its window. */
export interface StartClip {
  readonly clip: string;
  readonly fade: number;
  readonly at: number;
}

export interface SignSequencer {
  /** Replaces whatever was being signed with `steps`; returns the clip to start now (none for no steps). */
  readonly play: (steps: readonly SignStep[]) => StartClip[];
  /** Moves the clock `dt` seconds: the clips to start, and whether the last one just reached its end («stopped»). */
  readonly tick: (dt: number) => { readonly starts: StartClip[]; readonly finished: boolean };
  /** Drops the queue: nothing more starts, and nothing finishes. */
  readonly stop: () => void;
}

/**
 * The queue's clock. `lengthOf` is a clip's played length (`playedLength`). Two neighbours overlap by `fade`, never by more than
 * half of either; the first clip of a queue fades in only when a pose is already on the stage (a queue that replaced another,
 * or the one held since the last), and appears at once otherwise.
 */
export function createSignSequencer(lengthOf: (clip: string) => number, fade = CROSS_FADE_S): SignSequencer {
  let queue: readonly SignStep[] = [];
  /** The step on the stage now; -1 when none is playing. */
  let index = -1;
  /** Seconds into the current step's window. */
  let elapsed = 0;
  /** Whether a pose is on the stage: after the first clip, the last frame of the last one is held. */
  let shown = false;

  const overlapAfter = (i: number): number => (i + 1 < queue.length
    ? Math.min(fade, lengthOf(queue[i]!.clip) / 2, lengthOf(queue[i + 1]!.clip) / 2)
    : 0);

  return {
    play: (steps) => {
      queue = steps;
      elapsed = 0;
      index = steps.length ? 0 : -1;
      if (!steps.length) return [];
      const first = steps[0]!.clip;
      const start = { clip: first, fade: shown ? Math.min(fade, lengthOf(first) / 2) : 0, at: 0 };
      shown = true;
      return [start];
    },
    tick: (dt) => {
      const starts: StartClip[] = [];
      if (index < 0) return { starts, finished: false };
      elapsed += Math.max(0, dt);
      for (;;) {
        const length = lengthOf(queue[index]!.clip);
        if (index + 1 < queue.length) {
          const handOver = length - overlapAfter(index);
          if (elapsed < handOver) break;
          elapsed -= handOver;
          index += 1;
          starts.push({ clip: queue[index]!.clip, fade: overlapAfter(index - 1), at: elapsed });
          continue;
        }
        if (elapsed < length) break;
        index = -1;
        queue = [];
        return { starts, finished: true };
      }
      return { starts, finished: false };
    },
    stop: () => {
      index = -1;
      queue = [];
      elapsed = 0;
    },
  };
}
