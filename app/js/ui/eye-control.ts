// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/eye-control — PLAYING WITH THE EYES, PUT TOGETHER (ADR-0213; issues #194, #196).
//
// The pieces are each tested apart; this joins them for the root: the camera and the face tracker (platform/vision), a frame loop that
// cannot stop in silence (platform/vision-loop), the right eye's gaze read from its own rest (input/gaze-relative), the cycle that turns
// zones into actions (input/gaze-cycle), the presses on the virtual controller with the source `olhos` (input/virtual-controller, ADR-0111:
// never a disguised keyboard), and the regions drawn over the game
// (ui/gaze-overlay). The 📷 at its eyes position drives it (ADR-0215); any other position lets the camera go.
// · Nothing commands before the rest is measured: until then, and on a frame with no face or a head turning fast, the cycle is frozen.
// · A reading that re-centres itself cancels the gesture in hand.
// · Only the RIGHT eye is read (ADR-0213): the Dev's brain suppresses the left one, and a child's may too.
// · What cannot work is said to the child and written in `problems`, once: the files not on the device, the camera refused, frames that
//   stop or crawl. A 📷 that is on and does nothing is the defect this module exists not to ship.

import type { Translate } from '../core/i18n.js';
import type { Action } from '../core/actions.js';
import { headPoseFromMatrix, scoresFromCategories, eyeGazeFromScores, bothEyesClosed } from '../input/face-signals.js';
import { createGazeReader, GAZE_DEFAULTS, type GazeReading } from '../input/gaze-relative.js';
import { createGazeCycle, type GazeFrame, type GazeCycleOutput } from '../input/gaze-cycle.js';
import type { VirtualController } from '../input/virtual-controller.js';
import { loadFaceTracker, openCamera, closeCamera, type FaceTracker, type FaceTrackerLoad, type VisionDeps } from '../platform/vision.js';
import { createVisionLoop, type VisionLoopDeps, type LoopHealth } from '../platform/vision-loop.js';
import { drawGazeOverlay } from './gaze-overlay.js';
import type { SwitchableControl } from './switchable-control.js';

/** A camera picture the tracker can read. */
export interface CameraFeed { readonly frame: unknown; ready(): boolean; close(): void }

export interface EyeControlDeps {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  readonly doc: Document;
  /** Where the regions are drawn: `#game-region`. */
  readonly region: HTMLElement;
  /** The page's address, to reach `heavy/`. */
  readonly base: string;
  readonly loop: VisionLoopDeps;
  /** Where the presses go: seat 0's virtual controller. */
  readonly controller: VirtualController;
  readonly say: (text: string) => void;
  readonly alert: (text: string) => void;
  /** A line for `problems`. */
  readonly report: (line: string) => void;
  /** Put the 📷 back to off: what cannot start must not show as on. */
  readonly turnOff: () => void;
  readonly loadTracker?: (deps: VisionDeps) => Promise<FaceTrackerLoad>;
  readonly openFeed?: () => Promise<CameraFeed>;
}

// 📌 THE SHAPE IS THE FAMILY'S (ADR-0221 step 7f): what this module returns IS a SwitchableControl — following the 📷: on in
// the eyes position it opens the camera and the drawing, off it lets go of everything.

export function videoFeed(doc: Document, media: MediaDevices): () => Promise<CameraFeed> {
  return async () => {
    const stream = await openCamera(media);
    const video = doc.createElement('video');
    video.muted = true; video.playsInline = true; video.srcObject = stream;
    await video.play();
    return { frame: video, ready: () => video.readyState >= 2, close: () => { video.pause(); video.srcObject = null; closeCamera(stream); } };
  };
}

type Detection = ReturnType<FaceTracker['detect']>;
type Scores = ReturnType<typeof scoresFromCategories>;

/** What one detection says: the blendshapes (none without a face), the head's pose, and the RIGHT eye's gaze. */
function readDetection(det: Detection): { scores: Scores | null; pose: ReturnType<typeof headPoseFromMatrix>; eye: { h: number; v: number } | null } {
  const cats = det?.faceBlendshapes?.[0]?.categories;
  const scores = cats ? scoresFromCategories(cats) : null;
  return { scores, pose: headPoseFromMatrix(det?.facialTransformationMatrixes?.[0]?.data), eye: scores ? eyeGazeFromScores(scores).right : null };
}

/** What the cycle is told: frozen while nothing can be trusted — no rest yet, no face, a head turning fast — and cancelled when
 *  the reader re-centres under the gaze, because what was held was never a decision. */
function cycleFrameOf(reading: GazeReading, scores: Scores | null): GazeFrame {
  return {
    zone: reading.zone,
    eyesClosed: !!scores && bothEyesClosed(scores),
    frozen: !reading.ready || !scores || reading.reason === 'head-moving',
    cancel: reading.reason === 'recentring',
  };
}

/** The reading, written on the drawing's own element: when a child's eyes are not answered, this says at which step it stops. */
function writeDiagnosis(canvas: HTMLCanvasElement, reading: GazeReading, out: GazeCycleOutput, face: boolean, delegate: string): void {
  const f2 = (n: number | undefined): string => (n === undefined ? '' : n.toFixed(2));
  Object.assign(canvas.dataset, {
    face: String(face), ready: String(reading.ready), reason: reading.reason ?? '', zone: reading.zone ?? '',
    tremorH: f2(reading.tremor?.h), tremorV: f2(reading.tremor?.v), dh: f2(reading.displacement?.h), dv: f2(reading.displacement?.v),
    stillMs: String(Math.round(reading.stillMs ?? 0)), armed: String(out.armed), preparing: String(out.preparing), preview: out.preview?.item ?? '',
    delegate,
  });
}

/** The regions over the game at the region's size, the middle counting down while the rest is measured, and the face's lines. */
function drawFrame(canvas: HTMLCanvasElement, region: HTMLElement, reading: GazeReading, out: GazeCycleOutput, det: Detection, lines: FaceTracker['eyeLines']): void {
  const w = canvas.width = region.clientWidth, h = canvas.height = region.clientHeight;
  drawGazeOverlay(canvas.getContext('2d')!, w, h, {
    zone: reading.zone, armed: out.armed, preparing: out.preparing, preview: out.preview, restReady: reading.ready,
    restLeftMs: reading.ready ? undefined : Math.max(0, GAZE_DEFAULTS.restMs - (reading.stillMs ?? 0)),
  }, { face: det?.faceLandmarks?.[0] ? { landmarks: det.faceLandmarks[0], lines } : null });
}

export function createEyeControl(d: EyeControlDeps): SwitchableControl {
  const { t } = d;
  const loadTracker = d.loadTracker ?? loadFaceTracker;
  const openFeed = d.openFeed ?? videoFeed(d.doc, d.doc.defaultView!.navigator.mediaDevices);
  const said = new Set<string>();
  const once = (kind: string, line: string, spoken: string): void => {
    if (!said.has(kind)) { said.add(kind); d.report(line); }
    d.alert(spoken);
  };

  let on = false, running = false, starting: Promise<void> | null = null;
  const current = (): boolean => on; // read through a call: `apply` awaits, and `on` can change meanwhile
  let tracker: FaceTracker | null = null, feed: CameraFeed | null = null, canvas: HTMLCanvasElement | null = null;
  let pressed: Action | null = null, wasReady = false;
  let reader = createGazeReader(), cycle = createGazeCycle();
  let loop: ReturnType<typeof createVisionLoop> | null = null;

  const release = (): void => { if (pressed) d.controller.release(pressed, 'olhos'); pressed = null; };

  /** Only a change reaches the controller: the old action is let go, the new one pressed, from the eyes. */
  const followPress = (next: Action | null): void => {
    if (next === pressed) return;
    if (pressed) d.controller.release(pressed, 'olhos');
    if (next) d.controller.press(next, 'olhos');
    pressed = next;
  };

  const frame = (ms: number): void => {
    if (!tracker || !feed || !canvas || !feed.ready()) return;
    const det = tracker.detect(feed.frame, ms);
    const { scores, pose, eye } = readDetection(det);
    const reading = reader(ms, { h: eye?.h, v: eye?.v, pose });
    if (reading.ready && !wasReady) d.say(t('sr.eyes.ready'));
    wasReady = reading.ready;
    const out = cycle(ms, cycleFrameOf(reading, scores));
    followPress(out.pressed);
    writeDiagnosis(canvas, reading, out, !!scores, tracker.delegate());
    drawFrame(canvas, d.region, reading, out, det, tracker.eyeLines);
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
    async apply(next: boolean) {
      on = next;
      if (starting) await starting;
      if (!on) { if (running) stop(); return; }
      if (running) return;
      starting = start().finally(() => { starting = null; });
      await starting;
      if (!current() && running) stop(); // turned off while the camera was opening
    },
  };
}
