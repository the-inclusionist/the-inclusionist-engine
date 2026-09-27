// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/libras-avatar-player.ts — THE INTERPRETER THAT SIGNS: LAViD-UFPB's signs on a three.js avatar, behind the `Interpreter`
// port (ADR-0234, route B).
//
// 📌 THE ROOT'S OWN (phase B3): `createGame` builds this one when the host lends no interpreter (`EngineHost.interpreter`
// always wins), over the page's own address.
//
// THE RULES, as the Dev set them for the interpreter: the gloss is the delivery's (`glosses.json`, beside the avatar, where a
// word with no sign is written as the child reads it), and a text it does not cover is its words in capitals, accents stripped,
// Ç kept; the avatar appears at the bottom right when a request is played, in front of the screen, never taking the keyboard; a
// new request replaces what is being signed (the players' turns are deaf mode's); the avatar LEAVES the screen `leaveAfterMs` after it stopped signing — hidden, kept
// loaded for the next press — and a press in those seconds cancels the leaving; `hide()` takes it off at once and `dispose()`
// releases it. A delivery that did not ship it answers exactly as `NO_INTERPRETER` does («signing unavailable», with the flag
// that ships it), and a device that cannot draw it (no WebGL) or a load that never ends answers «unavailable» with its own
// reason (`ui/libras-avatar-load`).
//
// WHAT IS ITS OWN: the player is this engine's code, so «stopped» is not a message to wait for — it is the moment the last clip
// reaches its end (`ui/libras-avatar-plan`'s sequencer), its final pose held; a fingerspelled word is signed with the hand held
// up between its letters (the sequencer's chaining, the Dev's rule of 2026-09-26). And a word it can neither sign nor fingerspell is
// left out and SAID: the request still signs the rest, and what it left out comes back in `unsigned`, which deaf mode reports
// in `problems` (ADR-0169: what works in part is reported).
//
// 📌 three.js ARRIVES ONLY HERE, AND LATE: `ui/libras-avatar-stage` is imported dynamically when the avatar is first opened, so
// a page that never signs never downloads it (ADR-0234 errata; `tests/three-arrives-late.node.test.js`).

import type { Interpreter, SignResult } from './vlibras.js';
import { loadGlosser, provisionalGloss, type Glosser } from './libras-glosses.js';
import {
  createSignSequencer, leftOutText, nothingSigned, planSigns, playedLength, type AvatarManifest, type SignStep,
} from './libras-avatar-plan.js';
import {
  NOT_SHIPPED, RELEASED, avatarCanvas, avatarPlace, openAvatar, prepareClips, readManifest, type AvatarPlace,
} from './libras-avatar-load.js';
import type { AvatarStage } from './libras-avatar-stage.js';

/** What the free interpreter is built over. Every port is the host's. */
export interface LibrasAvatarPorts {
  /** The host's document: the avatar's canvas is created in it and put in front of the screen. */
  readonly doc: Document;
  /** The host's window: it keeps the timers and draws the frames. */
  readonly win: Pick<Window, 'setTimeout' | 'clearTimeout' | 'requestAnimationFrame' | 'cancelAnimationFrame'>
    & { readonly devicePixelRatio?: number };
  /** The host's `fetch`, for the delivery's manifest, avatar, clips and glosses; `undefined` where it has none. */
  readonly fetch: ((url: string) => Promise<Response>) | undefined;
  /** The page's address the delivery's folders are resolved against (`document.baseURI`). */
  readonly base: string;
  /** The avatar's accessible name, read when its canvas is made — the page's language at that moment. */
  readonly title: () => string;
  /** Where the avatar, the clips, the manifest and the glosses are, under `base`. The delivery's folder unless a test points elsewhere. */
  readonly avatarFolder?: string;
  /** How long the avatar may take to load before the request is answered «unavailable». */
  readonly loadTimeoutMs?: number;
  /** How long the avatar stays after it stopped signing before it leaves. `LEAVE_AFTER_MS` unless a test says. */
  readonly leaveAfterMs?: number;
  /** Builds the stage on the canvas from the avatar's bytes. `ui/libras-avatar-stage`, imported when first needed, unless a test says. */
  readonly loadStage?: (canvas: HTMLCanvasElement, avatar: ArrayBuffer) => Promise<AvatarStage>;
}

/** A school machine gets many times a fast one's load before it is given up on. */
const LOAD_TIMEOUT_MS = 60_000;
/** The Dev's five seconds (interface log, «The interpreter leaves 5 s after the player itself says it stopped»). */
const LEAVE_AFTER_MS = 5000;
/** The sharpest the avatar is drawn: above this, a school machine pays for pixels a child a metre away does not see. */
const MAX_PIXEL_RATIO = 1.5;
/** The longest step one frame may take: a tab that slept does not jump the signs ahead. */
const MAX_FRAME_S = 0.1;

/** The stage the delivery's player draws on, loaded — three.js with it — only when the avatar is first opened. */
async function stageOf(canvas: HTMLCanvasElement, avatar: ArrayBuffer): Promise<AvatarStage> {
  const { createAvatarStage } = await import('./libras-avatar-stage.js');
  return createAvatarStage({ canvas, avatar });
}

/** Builds the free interpreter over the avatar the delivery shipped — or, where it shipped none, «signing unavailable». */
export function createLibrasAvatarInterpreter(ports: LibrasAvatarPorts): Interpreter {
  // ⚠️ `fetch` is taken OUT of the ports and called bare: the host lends `window.fetch` unbound, and called as `ports.fetch(…)`
  // it would run with the ports object as `this` — an «Illegal invocation» in the browser, and no avatar.
  const { doc, win, fetch: fetchFile } = ports;
  const leaveAfterMs = ports.leaveAfterMs ?? LEAVE_AFTER_MS;

  let place: AvatarPlace | null = null;
  let shipped: Promise<AvatarManifest | null> | null = null;
  let manifest: AvatarManifest | null = null;
  let glosser: Promise<Glosser> | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let stage: AvatarStage | null = null;
  let loading: Promise<SignResult> | null = null;
  let cancelOpening: (() => void) | null = null;
  /** Each clip is fetched and prepared once per stage. */
  const clipLoads = new Map<string, Promise<boolean>>();
  /** The request being signed now, answered when its last clip reached its end — with what it left out. */
  let playing: ((r: SignResult) => void) | null = null;
  let playingLeftOut: string | undefined;
  /** Moves on every `hide()` and at `dispose()`: a request that waited across one is not played. */
  let generation = 0;
  let disposed = false;
  /** The seconds after the avatar stopped, at whose end it leaves the screen; `null` when none is running. */
  let leaving: number | null = null;
  let frameId: number | null = null;
  let lastFrame: number | null = null;

  // a spelled word's letters are chained through where each is held up, which the delivery measured (`ClipWindow.held`)
  const sequencer = createSignSequencer((clip) => {
    const w = manifest?.clips.get(clip);
    return w ? playedLength(w) : 0;
  }, undefined, (clip) => manifest?.clips.get(clip)?.held);

  const signedWith = (leftOut: string | undefined): SignResult => (leftOut ? { signed: true, unsigned: leftOut } : { signed: true });
  const answerPlaying = (r: SignResult): void => { const answer = playing; playing = null; answer?.(r); };
  const released = (): SignResult => ({ signed: false, reason: RELEASED });
  /** Whether a request that started at `asked` was overtaken by a `hide()` or the root's end while it waited. */
  const overtaken = (asked: number): boolean => disposed || asked !== generation;
  const stayOnScreen = (): void => {
    if (leaving !== null) win.clearTimeout(leaving);
    leaving = null;
  };
  const stopDrawing = (): void => {
    if (frameId !== null) win.cancelAnimationFrame(frameId);
    frameId = null;
    lastFrame = null;
  };
  /** The avatar stopped: after `leaveAfterMs` at rest, it leaves — hidden, the stage kept loaded behind it. */
  const leaveWhenAtRest = (): void => {
    stayOnScreen();
    leaving = win.setTimeout(() => {
      leaving = null;
      if (canvas) canvas.hidden = true;
    }, leaveAfterMs);
  };

  const frame = (now: number): void => {
    frameId = null;
    if (!stage) return;
    const dt = lastFrame === null ? 0 : Math.min(MAX_FRAME_S, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    const { starts, finished } = sequencer.tick(dt);
    for (const s of starts) stage.start(s.clip, s.fade, s.at);
    stage.advance(dt);
    if (!finished) { frameId = win.requestAnimationFrame(frame); return; }
    // «stopped»: the last clip reached its end and its final pose is held — nothing moves, so nothing more is drawn
    lastFrame = null;
    answerPlaying(signedWith(playingLeftOut));
    leaveWhenAtRest();
  };

  /** Takes the canvas and the stage away; the next press opens them again. */
  const release = (): void => {
    stopDrawing();
    cancelOpening?.();
    cancelOpening = null;
    stage?.dispose();
    stage = null;
    clipLoads.clear();
    canvas?.remove();
    canvas = null;
    loading = null;
  };

  /** Opens the canvas and the stage once, and answers when the avatar is ready to sign — or why it cannot. */
  const load = (at: AvatarPlace, m: AvatarManifest): Promise<SignResult> => {
    if (loading) return loading;
    const made = avatarCanvas(doc, ports.title());
    canvas = made;
    const opening = openAvatar(made, {
      fetchFile, avatarUrl: new URL(m.avatar, at.folder).href, loadStage: ports.loadStage ?? stageOf,
      timeoutMs: ports.loadTimeoutMs ?? LOAD_TIMEOUT_MS, win,
    }, () => canvas === made);
    cancelOpening = opening.cancel;
    loading = opening.done.then((r): SignResult => {
      if ('stage' in r) { stage = r.stage; return { signed: true }; }
      if (canvas === made) release(); // the next press tries again, from a fresh canvas
      return { signed: false, reason: r.reason };
    });
    return loading;
  };

  /** The delivery's avatar, ready to sign: its place and manifest — or the answer the request gets instead. */
  const reach = async (asked: number): Promise<{ at: AvatarPlace; m: AvatarManifest } | SignResult> => {
    const at = (place ??= avatarPlace(ports.base, ports.avatarFolder));
    const m = at ? await (shipped ??= readManifest(fetchFile, at)) : null;
    if (!at || !m) return { signed: false, reason: NOT_SHIPPED };
    manifest = m;
    if (overtaken(asked)) return released();
    const loaded = await load(at, m);
    return loaded.signed ? { at, m } : loaded;
  };

  /** The clips a text is signed with, all prepared, and what was left out — or the answer the request gets instead. */
  const planFor = async (text: string, at: AvatarPlace, m: AvatarManifest, asked: number):
    Promise<{ steps: SignStep[]; leftOut: string | undefined } | SignResult> => {
    const glossOf = await (glosser ??= loadGlosser(fetchFile, at.glosses));
    const plan = planSigns(glossOf(text) || provisionalGloss(text), (name) => m.clips.has(name));
    const unread = stage ? await prepareClips(stage, [...new Set(plan.steps.map((s) => s.clip))], m, at, fetchFile, clipLoads) : [];
    if (overtaken(asked) || !stage || !canvas) return released();
    const steps = plan.steps.filter((s) => !unread.includes(s.clip));
    const leftOut = leftOutText(plan.unsigned, unread);
    return steps.length ? { steps, leftOut } : { signed: false, reason: nothingSigned(leftOut) };
  };

  /** Puts the avatar in front of the screen and signs `steps`; answered when the last one reached its end. */
  const perform = (on: AvatarStage, shown: HTMLCanvasElement, steps: readonly SignStep[], leftOut: string | undefined):
    Promise<SignResult> => {
    // 📌 A new request replaces what is being signed. The turns among players are deaf mode's (`ui/vlibras`, ADR-0234 errata
    // 2026-09-26): it asks again only for the same player, or for a request that names none. The one replaced is not a
    // failure: the child asked again.
    answerPlaying(signedWith(playingLeftOut));
    shown.hidden = false;
    const box = shown.getBoundingClientRect();
    on.resize(box.width, box.height, Math.min(MAX_PIXEL_RATIO, win.devicePixelRatio || 1));
    for (const s of sequencer.play(steps)) on.start(s.clip, s.fade, s.at);
    lastFrame = null;
    if (frameId === null) frameId = win.requestAnimationFrame(frame);
    return new Promise<SignResult>((resolve) => {
      playing = resolve;
      playingLeftOut = leftOut;
    });
  };

  return {
    sign: async (text) => {
      // nothing to sign is not a failure, and nothing goes to `problems`
      if (!provisionalGloss(text)) return { signed: true };
      // a press in the seconds at rest keeps the avatar where it is: it is about to sign again
      stayOnScreen();
      const asked = generation;
      const reached = await reach(asked);
      if ('signed' in reached) return reached;
      const plan = await planFor(text, reached.at, reached.m, asked);
      if ('signed' in plan || !stage || !canvas) return 'signed' in plan ? plan : released();
      return perform(stage, canvas, plan.steps, plan.leftOut);
    },
    hide: () => {
      generation += 1;
      stayOnScreen();
      sequencer.stop();
      stopDrawing();
      if (canvas) canvas.hidden = true;
      answerPlaying(released());
    },
    dispose: () => {
      disposed = true;
      generation += 1;
      stayOnScreen(); // no timer of this root outlives it
      sequencer.stop();
      answerPlaying(released());
      release();
    },
  };
}
