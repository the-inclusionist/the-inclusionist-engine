// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio-sonar — NAVIGATION BY SOUND, the part of audio navigation that serves ANY genre (item 19).
//
// ========================= A FINDING, TURNED INTO A CUT =========================
// A second consumer recorded it and did not work around it: the sonar could not be used by anything but a platformer.
// Its context asked for tiles, a solid test, a hitbox, the tile size, a coin array and a scenery — a quiz would have had
// to invent fake tiles, a fake hitbox and a fake scenery to ask "point at the nearest option". The module was TWO
// modules under one name.
//
// This is one of them: what navigates by SOUND — pointing at the nearest target, the looping beacon, the pan by relative
// position and the question "does this child need audio cues?". The CANE and BLIND SWIMMING, which read tiles, floor and
// hitbox, are the platformer's and live in its repository (ADR-0228, note CC). So is the continuous audio GUIDE, which
// is that game's decision: it left this module for the platformer's `platform/audio-guide` (ADR-0257, note DZ).
//
// ========================= WHAT REPLACED THE PLATFORMER THINGS =========================
// None of them crossed over. The sonar used to ask the game for an array of coins and filter by taken/owner; now it
// receives the CONTRACT (ADR-0030):
//
//   · the coins + the filter  →  `targetsOf(i)`, the "target" half of field 5. The game hands over the spots that still
//     count for that player, and never says what they are.
//   · the tile size (the ruler of "near")  →  `topology()` + `distance()`, the metric declared in field 1. In a
//     platformer it is pixels over `unit`; on a grid, king's steps; in a quiz, a difference of index.
//   · the target's name  →  `nameAt(spot)`, field 3. It is what lets the announcement say "coin", "question" or "box"
//     without the engine knowing any of the three.
//
// ⚠️ AND ONE WAS LEFT, THE LAST AND THE WORST: the pan measured the stereo width as `LOGICAL_W * 0.55` — the SCREEN's
// width. The `wx` it divides comes from the TOPOLOGY, and dividing a world measure by a screen's width only works when
// both use the same ruler. Measured building a football game (#121): on a 90-METRE pitch, a team-mate ten metres to the
// right gives `10 / 176 = 0.057` — mono, in practice. The sonar would be **right and inaudible**. For the platformer it
// was true by chance (its world is measured in pixels) and for `grid`/`hotspots` it was vacuous, which is why it was
// never seen.
//
// The stereo width comes from the declared metric: `PAN_PACES * step`, where the step is the continuous space's `unit`,
// one cell on a grid, and nothing in a list — which has no space.
//
// ========================= NO I/O AT IMPORT =========================
// Nothing here touches `window`: a player's own context comes from the injected `newContext` (ADR-0232 D4). It runs in the
// `node` project.
import { distance, bearing, type Bearing, type Spot, type Topology, type Speakable } from '../core/contract.js';
import type { Translate } from '../core/i18n.js';

export type SinkAC = AudioContext & { setSinkId?: (id: string) => Promise<void> };

/**
 * How many STEPS of the declared metric saturate the stereo. Beyond this, "to the right" is just to the right.
 *
 * ⚠️ ELEVEN IS NOT A NEW NUMBER — it is what the platformer always had, reread on the right ruler. The old denominator was
 * `LOGICAL_W * 0.55 = 320 × 0.55 = 176` pixels, and the platformer declares `unit: TILE` = 16: **exactly 11 tiles**.
 * Rewriting it in steps keeps what that child already hears, and says the same in any genre — 11 squares on a board,
 * 11 metres on a pitch.
 *
 * And it fits the ruler the rest of the module uses: `distanceKey` cuts "very near" at 4 steps and "near" at 9. The
 * stereo saturates just after the thing becomes "far", which is where direction stops needing more precision.
 */
export const PAN_PACES = 11;

/**
 * What ONE step is worth, in world units. Zero = this space has no sides.
 *
 * Continuous: the declared `unit`. Grid: one cell, by definition. List: nothing — `hotspots` is an order, not a geometry,
 * and inventing a stereo width for it would point at a side that does not exist.
 */
export function worldStep(shape: Topology): number {
  return shape.kind === 'continuous' ? shape.unit : shape.kind === 'grid' ? 1 : 0;
}

/**
 * The player as navigation by sound sees them. The MINIMAL slice, which shrank with the cut: `facing` stayed with the cane
 * (it is the cane that taps "ahead") and `wnT` with swimming. What remains is identity, position, sight and the device.
 */
export interface SonarPlayer extends PlayerAudioOut {
  readonly i: number;
  readonly x: number;
  readonly y: number;
  // ⚠️ There is no `viz` here, and the absence is the point: this module no longer knows what a visual mode is. The
  // question it used to ask the string — "is this blindness or low vision?" — arrives answered, by `ctx.visionImpaired`.
  readonly audioSink?: string | null;
}

/**
 * A player's DEDICATED OUTPUT, and this module OWNS it: it is here the two fields are BORN (`new AC()` + `createGain()`,
 * below). By ADR-0039 the owner declares where a field is born, and `core/entity` does not mention them — they are not
 * the engine entity's, they are scratch the audio hangs on the player.
 *
 * `_acOut` allows `null` because the audio panel writes `null` to both when the device changes; an `unknown` on the
 * entity used to hide that the owner declared a non-null `GainNode`.
 */
export interface PlayerAudioOut {
  _ac?: SinkAC | null;
  _acOut?: GainNode | null;
}

export interface PlayerCtxOut { ac: AudioContext; out: GainNode; }

export interface SonarCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /* --- the CONTRACT: what was platformer and became a question (ADR-0030) --- */
  /** Field 1: the metric. A function, because a game with stages changes topology between them. */
  topology: () => Topology;
  /** Field 5, the "target" half: where this player's still-valid targets are. Empty = nothing to point at. */
  targetsOf: (playerIndex: number) => readonly Spot[];
  /** Field 3: what the thing there is called. `null` = no name, and the announcement falls back to the generic. */
  nameAt: (at: Spot) => Speakable | null;

  /* --- audio --- */
  tonePan: (freq: number, dur: number, cat: string, pan?: number | null, vol?: number, type?: OscillatorType, pc?: PlayerCtxOut | null) => void;
  srSay: (text: string) => void;
  /**
   * Speaks the sonar's words. `seat` is the player who pressed: a reading takes turns with the other players' and cuts that
   * player's own (ADR-0234, errata 2026-09-26 — the root's narration does it; a ctx built by hand may ignore it).
   */
  narrate: (text: string, seat: number) => void;
  /**
   * WHAT IS ON THE SCREEN NOW, as text in reading order — `''` when there is none the engine can read (ADR-0234: «sonar do que
   * está na tela»). With text, the sonar's WORDS are that text, read at the press; the tone still points at the nearest
   * target. Without (a world drawn on a canvas, or no text), the words are the navigation sentence. Absent: always the latter.
   */
  screenText?: () => string;

  /* --- accessibility and screen --- */
  /**
   * Is this child's sight impaired — simulated blindness or low vision?
   *
   * ⚠️ It replaced the table of render modes (#104), and the swap shrank this module instead of migrating it: it used to
   * receive the TABLE and walk it with `pl.viz`; now it receives the ANSWER. The composition root gives it — it knows the
   * two axes and may import `render/`, which this file, in `platform/`, cannot without inverting a layer edge.
   *
   * The whole `pl` and not the index: whoever answers already has the player in hand.
   */
  visionImpaired: (pl: SonarPlayer) => boolean;
  getBlindMode: () => boolean;
  /**
   * @deprecated ⚠️ NO READER (#121). It was the pan's denominator, and it was the defect: it measured the stereo width in
   * screen pixels and divided a WORLD distance by it. The width now comes from the topology (`PAN_PACES * worldStep`).
   *
   * It stayed OPTIONAL instead of removed — making a required field optional is backward compatible. Removing it for good
   * is a candidate for the next major.
   */
  LOGICAL_W?: number;
  getNumPlayers: () => number;
  /**
   * Makes a NEW AudioContext, or `null` where the host has none: each player with an audio device of their own gets one, so
   * `setSinkId` can send that child's cues to that device. The root's maker, from `host.win` — the same one its `createAudio`
   * receives. REQUIRED (ADR-0232 D4): a default would be the page's window reached from `platform/`.
   */
  newContext: () => AudioContext | null;
}

export interface AudioSonar {
  playerCtx: (pl: SonarPlayer) => PlayerCtxOut | null;
  panFor: (wx: number, pl: SonarPlayer) => number;
  needsAudioCues: (pl: SonarPlayer) => boolean;
  sonar: (pl: SonarPlayer) => void;
  readonly sonarCount: number;
}

export function createAudioSonar(ctx: SonarCtx): AudioSonar {
  const { t } = ctx;
  let _sonarCount = 0;

  /** The player's AudioContext (for `setSinkId` on their device), or null → the global context. */
  function playerCtx(pl: SonarPlayer): PlayerCtxOut | null {
    if (!pl || !pl.audioSink) return null;
    try {
      if (!pl._ac) {
        const ac = ctx.newContext();
        if (!ac) return null;
        pl._ac = ac; pl._acOut = pl._ac.createGain(); pl._acOut.connect(pl._ac.destination);
        if (pl._ac.setSinkId) pl._ac.setSinkId(pl.audioSink).catch(() => {});
      }
      if (pl._ac.state === 'suspended') pl._ac.resume();
      return { ac: pl._ac, out: pl._acOut! };
    } catch (e) { return null; }
  }

  function panFor(wx: number, pl: SonarPlayer): number {
    const pace = worldStep(ctx.topology());
    // `hotspots` has no space, so no side. `bearing` already answers `none` for the same reason, and centring is the only
    // honest answer — a pan computed over list indices points at nothing.
    if (!(pace > 0)) return 0;
    return Math.max(-1, Math.min(1, (wx - pl.x) / (PAN_PACES * pace)));
  }

  /**
   * Impaired sight? A game's audio cues — its edge guard, its guide — ask this, and exist only when the answer is yes (or in
   * blind mode).
   *
   * ⚠️ THE VISUAL HALF IS INJECTED (#104), and the module got SMALLER instead of migrating. It used to consult a table of
   * RENDER modes, walked with a render key, from inside `platform/`. The choice was: import `render/` (an edge the wrong
   * way — `render/` imports `platform/`, never the reverse), or stop knowing what a visual mode is.
   *
   * The second is right, and it is the move of `isNavigable`: inject the BOOLEAN, not the state. What this module needs to
   * know is "does this child need audio cues", and that is not a question about filter tables — the composition root
   * answers it, because it knows the two axes.
   *
   * What STAYS here is the rule that really is this module's: **blind mode turns the cues on for everyone**, whatever
   * sight says.
   */
  function needsAudioCues(pl: SonarPlayer): boolean {
    return ctx.getBlindMode() || ctx.visionImpaired(pl);
  }

  /**
   * THE BEARING IN WORDS, in the player's language and in the frame the GAME declared.
   *
   * ⚠️ WHAT THIS REPLACED WAS AN ACCESSIBILITY DEFECT, not a style detail. The sonar computed the side by hand, from a raw
   * `x`, with a ±4 dead zone:
   *
   *     target.at.x < pl.x - 4 ? 'left' : target.at.x > pl.x + 4 ? 'right' : 'ahead'
   *
   * Three words where the contract has eight — and MIXING FRAMES: left/right is relative to the SCREEN, ahead is relative
   * to the BODY, and a listener cannot know which origin each one speaks from. Worse: everything above or below the child
   * became "ahead", exactly the information most missing for someone who cannot see the screen — erased by a dead zone.
   *
   * ⚠️ AND THE FRAME IS THE GAME'S. On a board one says "to the north-east"; in a 2D platformer seen from the side, north
   * means nothing, and what one says is "at 2 o'clock".
   */
  function inWords(r: Bearing): string {
    if (r.kind === 'none') return t('sr.nav.here');
    // One key with `{h}` and not twelve — but the singular has its own, because "at 1 hours" is not a sentence in any of
    // the three languages the way the plural key would write it. Where two forms coincide, having both costs nothing.
    if (r.kind === 'clock') return r.hour === 1 ? t('sr.nav.clockOne') : t('sr.nav.clock', { h: r.hour });
    return t('sr.nav.dir.' + r.heading);
  }

  /**
   * This player's nearest target, in the DECLARED METRIC — and `null` if there is none.
   *
   * It was a loop over coins that skipped the taken and the unowned and measured with `Math.hypot`. The three things it
   * knew about the game (that targets are coins, that coins have owners, that distance is Euclidean in pixels) became a
   * question to the contract and a call to `distance`.
   */
  function nearestSpot(pl: SonarPlayer): { at: Spot; d: number } | null {
    const shape = ctx.topology();
    const here: Spot = { x: pl.x, y: pl.y };
    let nearest: Spot | null = null, bd = Infinity;
    for (const target of ctx.targetsOf(pl.i)) {
      const d = distance(shape, here, target);
      if (d < bd) { bd = d; nearest = target; }
    }
    return nearest ? { at: nearest, d: bd } : null;
  }

  /**
   * "Near" in STEPS of the declared metric, not in pixels.
   *
   * The original thresholds of 4 and 9 tiles become 4 and 9 UNITS: in a platformer with `unit = TILE` the sum is the same
   * as before; on a grid it is four and nine squares; in a quiz, four and nine items away in the list. The same sentence
   * for the child in any genre, which is the contract's point.
   */
  const distanceKey = (d: number): string =>
    d < 4 ? 'sr.nav.veryClose' : d < 9 ? 'sr.nav.close' : 'sr.nav.far';

  /**
   * THE SONAR: a tone that points, and words (ADR-0234). The tone is the same with or without text on screen — pitch says how
   * near the nearest target is, the pan which side, and a low tone that there is none. The WORDS are what is on the screen
   * when there is text there, read now; only a screen with no text the engine can read gets the navigation sentence.
   */
  function sonar(pl: SonarPlayer): void {
    _sonarCount++;
    const pc = playerCtx(pl);
    const target = nearestSpot(pl);
    if (target) ctx.tonePan(380 + 740 * Math.max(0, 1 - target.d / 12), 0.16, 'sonar', panFor(target.at.x, pl), 0.26, 'sine', pc); // nearer = higher
    else ctx.tonePan(300, 0.2, 'sonar', 0, 0.2, 'sine', pc);

    const onScreen = ctx.screenText?.() ?? '';
    if (onScreen) { ctx.srSay(onScreen); ctx.narrate(onScreen, pl.i); return; }
    // A sonar that no longer knows what the target is cannot name it when there is NO target at all: it says "nothing
    // nearby", which is true in any genre.
    if (!target) { ctx.srSay(t('sr.nav.noTargetNear')); return; }

    // The NAME comes from the game (field 3); the engine used to say "coin" because it only knew coins. The fallback is
    // for a game that declares a target without a name: "target" is better than a raw key.
    const name = ctx.nameAt(target.at);
    const foundSentence = t('sr.nav.sonarFound', {
      alvo: name ? name.text : t('sr.nav.target'),
      lado: inWords(bearing(ctx.topology(), { x: pl.x, y: pl.y }, target.at)),
      dist: t(distanceKey(target.d)),
    });
    const msg = (ctx.getNumPlayers() > 1 ? t('sr.player.prefix', { n: pl.i + 1 }) : '') + foundSentence;
    ctx.srSay(msg); ctx.narrate(msg, pl.i);
  }

  return {
    playerCtx, panFor, needsAudioCues, sonar,
    get sonarCount() { return _sonarCount; },
  };
}
