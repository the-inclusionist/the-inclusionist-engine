// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/eye-control — PLAYING WITH THE EYES, PUT TOGETHER (ADR-0213; issues #194, #196).
//
// The pieces are each tested apart; this joins them for the root: the camera and the face tracker (platform/vision), a frame loop that
// cannot stop in silence (platform/vision-loop), the right eye's gaze read from its own rest (input/gaze-relative), the cycle that turns
// zones into actions (input/gaze-cycle), the presses as keys stamped `olhos` (input/gaze-keys), and the regions drawn over the game
// (ui/gaze-overlay). The stored 👀 position drives it: off lets the camera go.
// · Nothing commands before the rest is measured: until then, and on a frame with no face or a head turning fast, the cycle is frozen.
// · A reading that re-centres itself cancels the gesture in hand.
// · Only the RIGHT eye is read (ADR-0213): the Dev's brain suppresses the left one, and a child's may too.
// · What cannot work is said to the child and written in `problems`, once: the files not on the device, the camera refused, frames that
//   stop or crawl. A 👀 that is on and does nothing is the defect this module exists not to ship.

import { t } from '../core/i18n.js';
import type { EyeControlLevel } from '../core/state.js';
import type { KeyScheme } from '../core/entity.js';
import type { Action } from '../core/actions.js';
import { headPoseFromMatrix, scoresFromCategories, eyeGazeFromScores, bothEyesClosed } from '../input/face-signals.js';
import { createGazeReader, GAZE_DEFAULTS } from '../input/gaze-relative.js';
import { createGazeCycle } from '../input/gaze-cycle.js';
import { gazeKeyEvents, dispatchGazeKeys } from '../input/gaze-keys.js';
import { loadFaceTracker, openCamera, closeCamera, type FaceTracker, type FaceTrackerLoad, type VisionDeps } from '../platform/vision.js';
import { createVisionLoop, type VisionLoopDeps, type LoopHealth } from '../platform/vision-loop.js';
import { drawGazeOverlay } from './gaze-overlay.js';

/** A camera picture the tracker can read. */
export interface CameraFeed { readonly frame: unknown; ready(): boolean; close(): void }

export interface EyeControlDeps {
  readonly doc: Document;
  /** Where the keys go and the regions are drawn: `#game-region`. */
  readonly region: HTMLElement;
  /** The page's address, to reach `pesados/`. */
  readonly base: string;
  readonly loop: VisionLoopDeps;
  /** The child's keys (`kbFor(0)`), read at every press so a remap counts at once. */
  readonly scheme: () => KeyScheme;
  readonly say: (text: string) => void;
  readonly alert: (text: string) => void;
  /** A line for `problems`. */
  readonly report: (line: string) => void;
  /** Put the 👀 back to off: what cannot start must not show as on. */
  readonly turnOff: () => void;
  readonly loadTracker?: (deps: VisionDeps) => Promise<FaceTrackerLoad>;
  readonly openFeed?: () => Promise<CameraFeed>;
}

export interface EyeControl {
  /** Follow the 👀 position: start the camera, change the drawing, or let everything go. */
  apply(level: EyeControlLevel): Promise<void>;
}

function videoFeed(doc: Document, media: MediaDevices): () => Promise<CameraFeed> {
  return async () => {
    const stream = await openCamera(media);
    const video = doc.createElement('video');
    video.muted = true; video.playsInline = true; video.srcObject = stream;
    await video.play();
    return { frame: video, ready: () => video.readyState >= 2, close: () => { video.pause(); video.srcObject = null; closeCamera(stream); } };
  };
}

export function createEyeControl(d: EyeControlDeps): EyeControl {
  const loadTracker = d.loadTracker ?? loadFaceTracker;
  const openFeed = d.openFeed ?? videoFeed(d.doc, d.doc.defaultView!.navigator.mediaDevices);
  const said = new Set<string>();
  const once = (kind: string, line: string, spoken: string): void => {
    if (!said.has(kind)) { said.add(kind); d.report(line); }
    d.alert(spoken);
  };

  let level: EyeControlLevel = 'off', running = false, starting: Promise<void> | null = null;
  const current = (): EyeControlLevel => level; // read through a call: `apply` awaits, and `level` can change meanwhile
  let tracker: FaceTracker | null = null, feed: CameraFeed | null = null, canvas: HTMLCanvasElement | null = null;
  let pressed: Action | null = null, wasReady = false;
  let reader = createGazeReader(), cycle = createGazeCycle();
  let loop: ReturnType<typeof createVisionLoop> | null = null;

  const release = (): void => { dispatchGazeKeys(d.region, gazeKeyEvents(pressed, null, d.scheme())); pressed = null; };

  const frame = (ms: number): void => {
    if (!tracker || !feed || !canvas || !feed.ready()) return;
    const det = tracker.detect(feed.frame, ms);
    const cats = det?.faceBlendshapes?.[0]?.categories;
    const scores = cats ? scoresFromCategories(cats) : null;
    const pose = headPoseFromMatrix(det?.facialTransformationMatrixes?.[0]?.data);
    const eye = scores ? eyeGazeFromScores(scores).right : null;
    const reading = reader(ms, { h: eye?.h, v: eye?.v, pose });
    if (reading.ready && !wasReady) d.say(t('sr.eyes.ready'));
    wasReady = reading.ready;
    const out = cycle(ms, {
      zone: reading.zone,
      eyesClosed: !!scores && bothEyesClosed(scores),
      frozen: !reading.ready || !scores || reading.reason === 'head-moving',
      cancel: reading.reason === 'recentring',
    });
    dispatchGazeKeys(d.region, gazeKeyEvents(pressed, out.pressed, d.scheme()));
    pressed = out.pressed;
    const w = canvas.width = d.region.clientWidth, h = canvas.height = d.region.clientHeight;
    drawGazeOverlay(canvas.getContext('2d')!, w, h, {
      zone: reading.zone, armed: out.armed, preparing: out.preparing, preview: out.preview, restReady: reading.ready,
      restLeftMs: reading.ready ? undefined : Math.max(0, GAZE_DEFAULTS.restMs - (reading.stillMs ?? 0)),
    }, { level, face: det?.faceLandmarks?.[0] ? { landmarks: det.faceLandmarks[0], lines: tracker.eyeLines } : null });
  };

  const health = (h: LoopHealth, fps: number): void => {
    if (h === 'stalled') once('stalled', 'eye control: a second without a camera frame — meanwhile the child\'s gaze commands nothing; keep the tab in front and the camera free', t('sr.eyes.stopped'));
    if (h === 'slow') once('slow', `eye control: ${fps} frames a second, under 8 — the reading misses movements and the child may not be answered; close other heavy tabs or use a lighter device`, t('sr.eyes.slow'));
  };

  const stop = (): void => {
    loop?.stop(); loop = null;
    release();
    feed?.close(); feed = null;
    tracker?.close(); tracker = null;
    canvas?.remove(); canvas = null;
    running = false; wasReady = false;
  };

  const start = async (): Promise<void> => {
    const load = await loadTracker({ base: d.base });
    if (!load.ok) {
      once('files', `eye control: ${load.missing.join(', ')} not on this device — the child cannot play with the eyes; open the game once online so the install fetches them`, t('sr.eyes.needsInternet'));
      d.turnOff();
      return;
    }
    try { feed = await openFeed(); } catch {
      load.tracker.close();
      once('camera', 'eye control: the camera did not open — the child cannot play with the eyes; allow the camera for this page, or plug one in', t('sr.eyes.noCamera'));
      d.turnOff();
      return;
    }
    tracker = load.tracker;
    canvas = d.doc.createElement('canvas');
    canvas.className = 'gaze-overlay';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '5' });
    d.region.appendChild(canvas);
    reader = createGazeReader(); cycle = createGazeCycle(); pressed = null;
    loop = createVisionLoop(d.loop, { onFrame: frame, onError: (e) => once('frame', `eye control: a frame failed (${String(e)}) — the loop goes on, but a repeated failure means the child is not being read`, t('sr.eyes.stopped')), onHealth: health });
    running = true;
    d.say(t('sr.eyes.lookMiddle'));
    loop.start();
  };

  return {
    async apply(next) {
      level = next;
      if (starting) await starting;
      if (level === 'off') { if (running) stop(); return; }
      if (running) return;
      starting = start().finally(() => { starting = null; });
      await starting;
      if (current() === 'off' && running) stop(); // turned off while the camera was opening
    },
  };
}
