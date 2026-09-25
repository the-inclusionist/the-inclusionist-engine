// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hand-control — PLAYING WITH HAND GESTURES, PUT TOGETHER (ADR-0210, ADR-0206, ADR-0212 §2; issue #191).
//
// The camera and MediaPipe's Gesture Recognizer (platform/vision), the frame loop, the Dev's hands map (input/hand-map), the presses on the
// virtual controller with the source `gestos` (input/virtual-controller, ADR-0111), and the hands' lines over the game. The 📷 at its
// hands position drives it (ADR-0215): it reads the hand and draws its bones — never the camera's picture; any other position lets go.
// · No rest to measure: a gesture is a shape, not a movement from a rest, and presses once seen for 300 ms.
// · A frame with no hand lets go of every held action.
// · What cannot start is said, written once in `problems`, and puts the 📷 back to off.

import type { Translate } from '../core/i18n.js';
import type { Action } from '../core/actions.js';
import { gesturesSeen, createHandMapReader } from '../input/hand-map.js';
import type { VirtualController } from '../input/virtual-controller.js';
import { loadHandTracker, type HandTracker, type HandTrackerLoad, type VisionDeps } from '../platform/vision.js';
import { createVisionLoop, type VisionLoopDeps, type LoopHealth } from '../platform/vision-loop.js';
import { gazeFontPx } from './gaze-overlay.js';
import type { CameraFeed } from './eye-control.js';
import type { SwitchableControl } from './switchable-control.js';

export interface HandControlDeps {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  readonly doc: Document;
  readonly region: HTMLElement;
  readonly base: string;
  /** Whether a file is in the checked cache, handed to the tracker's loader (ADR-0232 D4: the root lends the cache). */
  readonly hasFile: VisionDeps['hasFile'];
  readonly loop: VisionLoopDeps;
  readonly controller: VirtualController;
  readonly say: (text: string) => void;
  readonly alert: (text: string) => void;
  readonly report: (line: string) => void;
  readonly turnOff: () => void;
  readonly openFeed: () => Promise<CameraFeed>;
  readonly loadTracker?: (deps: VisionDeps) => Promise<HandTrackerLoad>;
}

// 📌 THE SHAPE IS THE FAMILY'S (ADR-0221 step 7f): what this module returns is a SwitchableControl, not a fourth copy of it.

/** The hand's bones, mirrored so they move the way the child moves; a bone to a landmark the hand does not have is skipped. */
function drawBones(g: CanvasRenderingContext2D, w: number, h: number, bones: HandTracker['handLines'],
  hand: ReadonlyArray<{ readonly x: number; readonly y: number }>): void {
  g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(2, gazeFontPx(w, h) / 6); g.shadowColor = '#000'; g.shadowBlur = 3;
  for (const { start, end } of bones) {
    const a = hand[start], b = hand[end];
    if (!a || !b) continue;
    g.beginPath(); g.moveTo((1 - a.x) * w, a.y * h); g.lineTo((1 - b.x) * w, b.y * h); g.stroke();
  }
  g.shadowBlur = 0;
}

export function createHandControl(d: HandControlDeps): SwitchableControl {
  const { t } = d;
  const loadTracker = d.loadTracker ?? loadHandTracker;
  const said = new Set<string>();
  const once = (kind: string, line: string, spoken: string): void => { if (!said.has(kind)) { said.add(kind); d.report(line); } d.alert(spoken); };

  let on = false, running = false, starting: Promise<void> | null = null;
  const current = (): boolean => on;
  let tracker: HandTracker | null = null, feed: CameraFeed | null = null, canvas: HTMLCanvasElement | null = null;
  let loop: ReturnType<typeof createVisionLoop> | null = null;
  let read = createHandMapReader();
  const held = new Set<Action>();

  const releaseAll = (): void => { for (const a of held) d.controller.release(a, 'gestos'); held.clear(); };

  const frame = (ms: number): void => {
    if (!tracker || !feed || !canvas || !feed.ready()) return;
    const det = tracker.detect(feed.frame, ms);
    const hand = det?.landmarks?.[0];
    const w = canvas.width = d.region.clientWidth, h = canvas.height = d.region.clientHeight;
    const g = canvas.getContext('2d')!; // setting the width above already cleared the layer
    // a hand that leaves starts the reading over: one that flickers out for a frame must be held again when it comes back
    if (!hand) { releaseAll(); read = createHandMapReader(); return; }
    // only the recognizer's TOP answer is a gesture; its «None» is a name the map does not know, and reads nothing
    const names = (det?.gestures?.[0] ?? []).slice(0, 1).map((c) => c.categoryName);
    holdExactly(new Set(read(ms, gesturesSeen(hand, names)).held));
    drawBones(g, w, h, tracker.handLines, hand);
  };

  /** Hold exactly what the reading holds now: let go of what left it, press what joined it — once. */
  const holdExactly = (now: ReadonlySet<Action>): void => {
    for (const a of held) if (!now.has(a)) { d.controller.release(a, 'gestos'); held.delete(a); }
    for (const a of now) if (!held.has(a)) { d.controller.press(a, 'gestos'); held.add(a); }
  };

  const health = (hh: LoopHealth, fps: number): void => {
    if (hh === 'stalled') once('stalled', 'gesture control: a second without a camera frame — meanwhile the child\'s gestures command nothing; keep the tab in front and the camera free', t('sr.hands.stopped'));
    if (hh === 'slow') once('slow', `gesture control: ${fps} frames a second, under 8 — gestures are missed and the child may not be answered; close other heavy tabs or use a lighter device`, t('sr.hands.slow'));
  };

  const stop = (): void => {
    loop?.stop(); loop = null;
    releaseAll();
    feed?.close(); feed = null;
    tracker?.close(); tracker = null;
    canvas?.remove(); canvas = null;
    running = false;
  };

  const start = async (): Promise<void> => {
    const load = await loadTracker({ base: d.base, hasFile: d.hasFile });
    if (!load.ok) {
      once('files', `gesture control: ${load.missing.join(', ')} not on this device — the child cannot play with gestures; open the game once online so the install fetches them`, t('sr.hands.needsInternet'));
      d.turnOff();
      return;
    }
    try { feed = await d.openFeed(); } catch {
      load.tracker.close();
      once('camera', 'gesture control: the camera did not open — the child cannot play with gestures; allow the camera for this page, or plug one in', t('sr.hands.noCamera'));
      d.turnOff();
      return;
    }
    tracker = load.tracker;
    canvas = d.doc.createElement('canvas');
    canvas.className = 'hand-overlay';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '5' });
    d.region.appendChild(canvas);
    read = createHandMapReader();
    loop = createVisionLoop(d.loop, { onFrame: frame, onError: (e) => once('frame', `gesture control: a frame failed (${String(e)}) — the loop goes on, but a repeated failure means the child is not being read`, t('sr.hands.stopped')), onHealth: health });
    running = true;
    d.say(t('sr.hands.ready'));
    loop.start();
  };

  return {
    async apply(next) {
      on = next;
      if (starting) await starting;
      if (!on) { if (running) stop(); return; }
      if (running) return;
      starting = start().finally(() => { starting = null; });
      await starting;
      if (!current() && running) stop();
    },
  };
}
