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
// hitbox, are the platformer's and live in its repository (ADR-0228, note CC), and the audio guide is its decision.
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
import { distance, bearing, type Bearing, type Spot, type Topology, type Speakable, type Role } from '../core/contract.js';
import type { Translate } from '../core/i18n.js';
// THE GUIDE (#84 item 2) is made of these two and nothing else: the ROUTE says how many steps remain going round walls,
// and the INTENSITY turns that number into brightness and volume. Neither touches Web Audio; the wiring — the only part
// that does — is `updateGuide` below, which is why the design can be checked in `node`.
import { routeTo } from '../core/route.js';
import { guideIntensity, FAR_CUT, STEPS_TO_FLOOR } from './guide-intensity.js';

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

/** The guide's continuous graph: oscillator → low-pass → gain → pan → the `guide` category. */
export interface LiveGuide {
  /** The context that built it — each `setTargetAtTime` takes its `currentTime` from it. */
  readonly ac: AudioContext;
  readonly osc: OscillatorNode;
  readonly filter: BiquadFilterNode;
  readonly gain: GainNode;
  /** `null` on an engine without `createStereoPanner` — the guide goes mono instead of not existing. */
  readonly panner: StereoPannerNode | null;
  /** Frames since the ROUTE was last recomputed. The route is costly; the sound cannot wait for it. */
  framesSinceRoute: number;
  /** The last measured steps. The intensity comes from here every frame. */
  steps: number;
  /** The last measured pan, for the same reason: it comes from the target, which is found only with the route. */
  pan: number;
}

/**
 * ⚠️ THE TIMBRE MUST HAVE HARMONICS, and it is a technical requirement, not taste.
 *
 * The axis of #84 item 2 is BRIGHTNESS, and brightness is a low-pass opening and closing. **A low-pass over a `sine` wave
 * does absolutely nothing**: a sine has nothing above its fundamental for the filter to cut, and the guide would be left
 * with a dead axis and only the volume working. The sawtooth is the richest of Web Audio's four waves — it has ALL the
 * harmonics — which is why it is the choice.
 *
 * And it solves, for free, the plan's other constraint: the sonar and the cane use `sine`. A different timbre was
 * required so they would not collide on one channel; here the different timbre IS the mechanism.
 */
export const GUIDE_WAVE: OscillatorType = 'sawtooth';

/**
 * The guide's fundamental, fixed.
 *
 * ⚠️ FIXED ON PURPOSE: PITCH is already the sonar's language (`380 + 740 * near`, nearer = higher). If the guide also
 * rose in pitch, both would say the same thing through the same means, and whoever hears both at once could not tell them
 * apart. The guide says distance by brightness; the sonar, by pitch.
 */
const GUIDE_HZ = 220;

/**
 * How many frames between two route computations.
 *
 * ⚠️ THE ROUTE IS A BREADTH-FIRST SEARCH, and `__incl.update(dt)` counts FRAMES: running a BFS every frame on a platform
 * map spends the whole frame budget on the target device (Positivo/Chromebook, pillar 1). Twelve frames are ~0.2 s at
 * 60 fps — faster than a child takes a step, and the sound does not wait for them: the intensity is rewritten EVERY
 * frame, with the steps the last route left.
 */
export const FRAMES_BETWEEN_ROUTES = 12;

/**
 * The ceiling of spots for the guide's route. Well below `core/route`'s 4096, and that module says why: a cue every
 * frame tolerates far less than a calculation when a level loads. Hitting it returns `null`, which is "I cannot say" —
 * and the guide falls back to the straight line, which still sounds.
 */
const ROUTE_BUDGET = 1024;

/**
 * The guide's base gain, before the intensity and the master volume multiply it.
 *
 * ⚠️ LOWER THAN THE BEEP IT REPLACES (0.11), and not by mistake: a sound that **never stops** is perceived as louder
 * than a transient of the same peak, and it tires by persistence rather than intensity — exactly what autism-support
 * mode exists not to do.
 */
export const GUIDE_VOL = 0.06;

/** The `setTargetAtTime` time constant. Short enough to follow a step, long enough that a change is a glide and not a
 *  stair — a stair on every route would be a beep again. */
const GUIDE_TAU = 0.08;

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
  /**
   * This player's LIVE GUIDE GRAPH, and it lives HERE, beside the other two, for their reason (ADR-0039: the owner
   * declares where a field is born; ADR-0033: the engine's entity declares what the ENGINE owns, and an oscillator is
   * not). `null`/absent = quiet.
   *
   * ⚠️ IT HAS TO SURVIVE FRAMES, and that is where it differs from everything else in this file. The sonar and the old
   * beep created an oscillator, played it and threw it away; a CONTINUOUS presence (#84 item 2) is an oscillator that
   * STAYS, with the filter and gain moving under it. That is why it hangs on the player: there is nowhere else a
   * per-player thing lasts from one frame to the next.
   *
   * ⚠️ AND THAT IS WHY THERE IS A WAY TO STOP IT. A field that lasts is a field that leaks: with nobody stopping it,
   * turning the `guide` category off in the mixer would leave the sound playing.
   */
  _guide?: LiveGuide | null;
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
  /**
   * Field 2: what is at this spot. It is what `core/route` crosses (or not) to find the way.
   *
   * ⚠️ OPTIONAL HERE, and required in `GameDeclaration` — the difference is not carelessness. Making a `SonarCtx` field
   * required breaks every consumer that builds this ctx by hand, and the composition root (which really builds it) always
   * has it, because the declaration's validation requires it. Absent here, the guide does not go quiet: it falls back to
   * the straight-line distance, which is what it did before.
   */
  roleAt?: (at: Spot) => Role;

  /* --- audio --- */
  tonePan: (freq: number, dur: number, cat: string, pan?: number | null, vol?: number, type?: OscillatorType, pc?: PlayerCtxOut | null) => void;
  srSay: (text: string) => void;
  narrate: (text: string) => void;
  /**
   * A mixer category's bus. The SAME shape the other audio modules receive — the guide cannot use `tonePan`, because
   * `tonePan` plays and forgets, and a continuous presence is a graph that STAYS.
   *
   * Optional for the reason of `roleAt`: whoever does not inject it falls back to `audioOut` and, lacking that, to the
   * `destination`. What is lost is the `guide` category's slider, not the sound.
   */
  catNode?: (cat: string) => AudioNode | null;
  /** The master node, `catNode`'s fallback. */
  audioOut?: () => AudioNode | null;
  /**
   * The master volume (0..1), which each synthesis multiplies by itself — `platform/audio`'s master gain is the pause's
   * mute, not the slider. Absent = 1: the guide sounds and ignores the slider. That is why the root injects it.
   */
  getVolume?: () => number;

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
  getPlayers: () => SonarPlayer[];
  getNumPlayers: () => number;
  getAudioCtx: () => AudioContext | null;
  getSoundOn: () => boolean;
  getAudioCat: () => Record<string, { on: boolean }> | null;
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
  updateGuide: () => void;
  readonly sonarCount: number;
  /**
   * ⚠️ It counts FRAMES IN WHICH THE GUIDE SOUNDS (#84 item 2), not beeps: there is nothing discrete left to count.
   * Reading it to say "the guide is working" is right; reading it to say "it played three times" asks about something
   * that no longer exists.
   */
  readonly guideCount: number;
}

export function createAudioSonar(ctx: SonarCtx): AudioSonar {
  const { t } = ctx;
  let _sonarCount = 0, _guideCount = 0;

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
   * Impaired sight? The edge guard and the guide exist only when the answer is yes (or in blind mode).
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

  function sonar(pl: SonarPlayer): void {
    _sonarCount++;
    const pc = playerCtx(pl);
    const target = nearestSpot(pl);
    // A sonar that no longer knows what the target is cannot name it when there is NO target at all: it says "nothing
    // nearby", which is true in any genre.
    if (!target) { ctx.tonePan(300, 0.2, 'sonar', 0, 0.2, 'sine', pc); ctx.srSay(t('sr.nav.noTargetNear')); return; }

    const pan = panFor(target.at.x, pl), near = Math.max(0, 1 - target.d / 12);
    ctx.tonePan(380 + 740 * near, 0.16, 'sonar', pan, 0.26, 'sine', pc); // nearer = higher

    // The NAME comes from the game (field 3); the engine used to say "coin" because it only knew coins. The fallback is
    // for a game that declares a target without a name: "target" is better than a raw key.
    const name = ctx.nameAt(target.at);
    const foundSentence = t('sr.nav.sonarFound', {
      alvo: name ? name.text : t('sr.nav.target'),
      lado: inWords(bearing(ctx.topology(), { x: pl.x, y: pl.y }, target.at)),
      dist: t(distanceKey(target.d)),
    });
    const msg = (ctx.getNumPlayers() > 1 ? t('sr.player.prefix', { n: pl.i + 1 }) : '') + foundSentence;
    ctx.srSay(msg); ctx.narrate(msg);
  }

  /**
   * HOW MANY STEPS REMAIN, and the preferred answer is the one that goes round walls.
   *
   * ⚠️ BOTH ANSWERS ARE ALREADY IN THE SAME UNIT, which is the only reason this is a line and not a conversion: the route
   * counts steps by definition, and `distance()` returns steps in EVERY topology — it divides by the `unit` itself in the
   * continuous branch. Dividing again by the world step here was the mistake waiting to be made, and in a game with
   * `unit = 16` it would put the guide at full brightness forever — the defect #121 took out of `panFor`: mixing a world
   * ruler with a screen ruler.
   *
   * The route is lost two ways — a game that did not inject `roleAt`, and a budget run out — and both fall back to the
   * STRAIGHT LINE. ⚠️ It lies behind a wall (says "near" of a target that needs going round), which is why it is a
   * fallback and not a choice. But continuing to say it is strictly better than going quiet — quiet would claim there is
   * no target.
   */
  function stepsToTarget(pl: SonarPlayer, target: { at: Spot; d: number }): number {
    const roleAt = ctx.roleAt;
    if (roleAt) {
      const path = routeTo(
        { topology: ctx.topology(), roleAt, budget: ROUTE_BUDGET },
        { x: pl.x, y: pl.y }, [target.at],
      );
      if (path) return path.steps;
    }
    return target.d;
  }

  /** Lights this player's continuous graph. `null` = it could not (no context, or an engine without Web Audio). */
  function startGuide(pl: SonarPlayer): LiveGuide | null {
    const pc = playerCtx(pl);
    const ac = pc ? pc.ac : ctx.getAudioCtx();
    if (!ac) return null;
    try {
      const osc = ac.createOscillator(), lowpass = ac.createBiquadFilter(), level = ac.createGain();
      osc.type = GUIDE_WAVE;
      osc.frequency.value = GUIDE_HZ;
      lowpass.type = 'lowpass';
      lowpass.frequency.value = FAR_CUT; // born at the bottom of the scale and rising; born open would be a fright
      level.gain.value = 0;                 // and born quiet, so it does not click when it starts
      let migrated: AudioNode = level;
      let panner: StereoPannerNode | null = null;
      if (ac.createStereoPanner) { panner = ac.createStereoPanner(); level.connect(panner); migrated = panner; }
      osc.connect(lowpass).connect(level);
      migrated.connect(pc ? pc.out : (ctx.catNode?.('guide') || ctx.audioOut?.() || ac.destination));
      osc.start();
      // `framesSinceRoute` is born at the ceiling so the FIRST pass measures the route, instead of sounding for twelve
      // frames on invented steps.
      return { ac, osc, filter: lowpass, gain: level, panner, framesSinceRoute: FRAMES_BETWEEN_ROUTES, steps: STEPS_TO_FLOOR, pan: 0 };
    } catch (e) { return null; }
  }

  /**
   * Puts the graph out — and it HAS to be put out, because an oscillator that stays is the difference between this shape
   * and the old one. The beep died by itself; this plays until someone stops it. Without this, turning the `guide`
   * category off in the mixer would leave the sound playing, and changing visual mode would leave a second graph adding
   * to the first.
   *
   * It ramps down (does not cut) because a dry cut on a live oscillator is a click — a transient, precisely what this item
   * exists to take out of the child's ear.
   */
  function stopGuide(pl: SonarPlayer): void {
    const g = pl._guide;
    if (!g) return;
    pl._guide = null;
    try {
      const audioNow = g.ac.currentTime;
      g.gain.gain.setTargetAtTime(0, audioNow, 0.05);
      g.osc.stop(audioNow + 0.3);
    } catch (e) { /* noop */ }
  }

  /**
   * THE CONTINUOUS PRESENCE, one frame at a time (#84 item 2).
   *
   * ⚠️ WHAT LEFT HERE WAS A BEEP, forever, whether or not the child moved or anything changed. The Dev's verdict: «um
   * ping é a pior escolha possível, tenebroso para quem tem TEA». What replaces it fires nothing — the sound is already
   * there, and changes brightness.
   *
   * ⚠️ AND GOING QUIET IS STILL A STATEMENT, with one meaning only: THERE IS NO TARGET. That is why "no target" puts the
   * graph out and "far" does not: `guide-intensity`'s floor (`FAR_VOL`) exists exactly so the child does not confuse "it
   * is far" with "there is nothing to find".
   */
  function updateGuide(): void {
    const audible = guideAudible();
    const vol = ctx.getVolume ? ctx.getVolume() : 1;
    for (const pl of ctx.getPlayers()) {
      if (!audible || !needsAudioCues(pl)) { stopGuide(pl); continue; }
      // no guide lit (no target, or a device that refused it), or the target gone: silence says «nothing to find»
      const g = liveGuide(pl);
      if (!g || !remeasure(pl, g)) { stopGuide(pl); continue; }
      glide(g, vol);
      _guideCount++;
    }
  }

  /** Can the guide be heard at all: the engine's audio started, the game's sound on, and a `guide` category that is on. */
  function guideAudible(): boolean {
    const cat = ctx.getAudioCat();
    return !!ctx.getAudioCtx() && ctx.getSoundOn() && !!cat && !!cat.guide && cat.guide.on;
  }

  /** This player's live guide — lit here only if there is a target to point to, and `null` where it cannot be lit. */
  function liveGuide(pl: SonarPlayer): LiveGuide | null {
    if (pl._guide) return pl._guide;
    // ⚠️ THE QUESTION "IS THERE A TARGET?" COMES BEFORE LIGHTING, and the gate insisted: with the graph born first, a
    // player with no target created an oscillator, measured the route, found nothing and put it out — SIXTY TIMES A
    // SECOND. The beep did not have this problem because nothing of it lasted; permanence brought it. `nearestSpot` is a
    // loop over `targetsOf`, not the BFS: asking every frame costs nothing when the list is empty, which is the case here.
    if (!nearestSpot(pl)) return null;
    return (pl._guide = startGuide(pl));
  }

  /**
   * Every FRAMES_BETWEEN_ROUTES frames the route and the side are measured again — the BFS on a cadence, not sixty times a
   * second. Answers `false` when the target is gone.
   */
  function remeasure(pl: SonarPlayer, g: LiveGuide): boolean {
    if (++g.framesSinceRoute < FRAMES_BETWEEN_ROUTES) return true;
    g.framesSinceRoute = 0;
    const target = nearestSpot(pl);
    if (!target) return false;
    g.steps = stepsToTarget(pl, target);
    g.pan = panFor(target.at.x, pl);
    return true;
  }

  /** EVERY frame, not only when the route is new: this is what makes the change a glide. */
  function glide(g: LiveGuide, vol: number): void {
    const i = guideIntensity(g.steps);
    try {
      const audioNow = g.ac.currentTime;
      g.filter.frequency.setTargetAtTime(i.cutoff, audioNow, GUIDE_TAU);
      g.gain.gain.setTargetAtTime(GUIDE_VOL * i.volume * vol, audioNow, GUIDE_TAU);
      g.panner?.pan.setTargetAtTime(g.pan, audioNow, GUIDE_TAU);
    } catch (e) { /* noop */ }
  }

  return {
    playerCtx, panFor, needsAudioCues, sonar, updateGuide,
    get sonarCount() { return _sonarCount; },
    get guideCount() { return _guideCount; },
  };
}
