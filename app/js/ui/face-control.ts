// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/face-control — PLAYING WITH THE FACE, PUT TOGETHER (ADR-0210 and its erratum, ADR-0212 §3; issue #191).
//
// The camera and the face tracker (platform/vision), the frame loop (platform/vision-loop), the Dev's face map (input/face-map), the
// presses on the virtual controller with the source `rosto` (input/virtual-controller, ADR-0111), and what is drawn over the game. The
// stored 🧑 position drives it: off lets the camera go; on reads the face; lines also draws the eyes, brows and mouth — never the camera's
// picture (ADR-0212).
// · The rest measures itself (the Dev, 2026-09-16): the face still, looking at the middle, for 3 s in a row; until then the middle asks for
//   it and nothing commands.
// · A frame with no face lets go of every held action: a face that left the camera is not holding anything.
// · What cannot start is said, written once in `problems`, and puts the 🧑 back to off — the same promise as the eyes.

import { t } from '../core/i18n.js';
import type { FaceControlLevel } from '../core/state.js';
import type { Action } from '../core/actions.js';
import { faceScoresFromCategories, headTurn, createFaceMapReader, createFaceRest, type FaceRest } from '../input/face-map.js';
import type { VirtualController } from '../input/virtual-controller.js';
import { loadFaceTracker, type FaceTracker, type FaceTrackerLoad, type VisionDeps, type FaceLines } from '../platform/vision.js';
import { createVisionLoop, type VisionLoopDeps, type LoopHealth } from '../platform/vision-loop.js';
import { gazeFontPx } from './gaze-overlay.js';
import type { CameraFeed } from './eye-control.js';

export interface FaceControlDeps {
  readonly doc: Document;
  readonly region: HTMLElement;
  readonly base: string;
  readonly loop: VisionLoopDeps;
  readonly controller: VirtualController;
  readonly say: (text: string) => void;
  readonly alert: (text: string) => void;
  readonly report: (line: string) => void;
  readonly turnOff: () => void;
  readonly openFeed: () => Promise<CameraFeed>;
  readonly loadTracker?: (deps: VisionDeps) => Promise<FaceTrackerLoad>;
}

export interface FaceControl { apply(level: FaceControlLevel): Promise<void> }

const REST_MS = 3000;

/** The middle's request while the rest is measured, and the face lines, mirrored so they move the way the child moves. */
function draw(ctx: CanvasRenderingContext2D, w: number, h: number, restLeftMs: number | null, lines: FaceLines | null,
  landmarks: ReadonlyArray<{ readonly x: number; readonly y: number }> | undefined, say: (k: string) => string): void {
  ctx.clearRect(0, 0, w, h);
  const f = gazeFontPx(w, h);
  if (restLeftMs !== null) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd23f'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
    ctx.font = `bold ${f}px system-ui`; ctx.fillText(say('gaze.lookHere'), w / 2, h / 2 - f * 0.7);
    ctx.font = `${f * 0.85}px system-ui`; ctx.fillText(`${(restLeftMs / 1000).toFixed(1)} s`, w / 2, h / 2 + f * 0.8);
    ctx.shadowBlur = 0;
  }
  if (lines && landmarks) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, f / 8); ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
    for (const { start, end } of [...lines.eyes, ...lines.brows, ...lines.lips]) {
      const a = landmarks[start], b = landmarks[end];
      if (!a || !b) continue;
      ctx.beginPath(); ctx.moveTo((1 - a.x) * w, a.y * h); ctx.lineTo((1 - b.x) * w, b.y * h); ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
}

export function createFaceControl(d: FaceControlDeps): FaceControl {
  const loadTracker = d.loadTracker ?? loadFaceTracker;
  const said = new Set<string>();
  const once = (kind: string, line: string, spoken: string): void => { if (!said.has(kind)) { said.add(kind); d.report(line); } d.alert(spoken); };

  let level: FaceControlLevel = 'off', running = false, starting: Promise<void> | null = null;
  const current = (): FaceControlLevel => level;
  let tracker: FaceTracker | null = null, feed: CameraFeed | null = null, canvas: HTMLCanvasElement | null = null;
  let loop: ReturnType<typeof createVisionLoop> | null = null;
  let rest: FaceRest | null = null, measure = createFaceRest({ restMs: REST_MS }), read: ReturnType<typeof createFaceMapReader> | null = null;
  const held = new Set<Action>();

  const releaseAll = (): void => { for (const a of held) d.controller.release(a, 'rosto'); held.clear(); };

  const frame = (ms: number): void => {
    if (!tracker || !feed || !canvas || !feed.ready()) return;
    const det = tracker.detect(feed.frame, ms);
    const cats = det?.faceBlendshapes?.[0]?.categories;
    const landmarks = det?.faceLandmarks?.[0];
    const w = canvas.width = d.region.clientWidth, h = canvas.height = d.region.clientHeight;
    const g = canvas.getContext('2d')!;
    if (!cats) { releaseAll(); draw(g, w, h, rest ? null : REST_MS, null, undefined, t); return; }
    const scores = faceScoresFromCategories(cats);
    let restLeft: number | null = null;
    if (!rest) {
      const m = measure(ms, scores, headTurn(landmarks).x);
      if (m.rest) { rest = m.rest; read = createFaceMapReader({ rest }); d.say(t('sr.face.ready')); }
      else restLeft = Math.max(0, REST_MS - m.stillMs);
    }
    if (read) {
      const now = new Set(read(ms, scores, landmarks).held);
      for (const a of held) if (!now.has(a)) { d.controller.release(a, 'rosto'); held.delete(a); }
      for (const a of now) if (!held.has(a)) { d.controller.press(a, 'rosto'); held.add(a); }
    }
    draw(g, w, h, restLeft, level === 'lines' ? tracker.faceLines : null, landmarks, t);
  };

  const health = (hh: LoopHealth, fps: number): void => {
    if (hh === 'stalled') once('stalled', 'face control: a second without a camera frame — meanwhile the child\'s face commands nothing; keep the tab in front and the camera free', t('sr.face.stopped'));
    if (hh === 'slow') once('slow', `face control: ${fps} frames a second, under 8 — expressions are missed and the child may not be answered; close other heavy tabs or use a lighter device`, t('sr.face.slow'));
  };

  const stop = (): void => {
    loop?.stop(); loop = null;
    releaseAll();
    feed?.close(); feed = null;
    tracker?.close(); tracker = null;
    canvas?.remove(); canvas = null;
    running = false; rest = null; read = null;
  };

  const start = async (): Promise<void> => {
    const load = await loadTracker({ base: d.base });
    if (!load.ok) {
      once('files', `face control: ${load.missing.join(', ')} not on this device — the child cannot play with the face; open the game once online so the install fetches them`, t('sr.face.needsInternet'));
      d.turnOff();
      return;
    }
    try { feed = await d.openFeed(); } catch {
      load.tracker.close();
      once('camera', 'face control: the camera did not open — the child cannot play with the face; allow the camera for this page, or plug one in', t('sr.face.noCamera'));
      d.turnOff();
      return;
    }
    tracker = load.tracker;
    canvas = d.doc.createElement('canvas');
    canvas.className = 'face-overlay';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '5' });
    d.region.appendChild(canvas);
    rest = null; read = null; measure = createFaceRest({ restMs: REST_MS });
    loop = createVisionLoop(d.loop, { onFrame: frame, onError: (e) => once('frame', `face control: a frame failed (${String(e)}) — the loop goes on, but a repeated failure means the child is not being read`, t('sr.face.stopped')), onHealth: health });
    running = true;
    d.say(t('sr.face.lookMiddle'));
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
      if (current() === 'off' && running) stop();
    },
  };
}
