// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/camera-control — THE 📷 POSITION TO THE THREE CAMERA CONTROLS (ADR-0215; issue #199), AND HOW EACH ONE STARTS.
//
// One stored position (`core/state.cameraControl`): off · hands · face · eyes. Each control starts only at its own position, so one camera
// mode at a time holds by construction (ADR-0197). The ones turning off are told first, so a camera is let go before the next mode asks.

import type { CameraControl } from '../core/camera-cycle.js';
/*
 * 🔴 A CONTROL'S SHAPE HAS A NAME OF ITS OWN (ADR-0221 step 7f): the family's four members — eyes, face, hands and voice —
 * share one shape, `SwitchableControl`, and the VOICE declares it too: it answers the 👄 and not the 📷, so the family's
 * name could not be "camera".
 */
import type { SwitchableControl } from './switchable-control.js';

export function followCameraMode(mode: CameraControl, controls: { readonly [M in Exclude<CameraControl, 'off'>]: SwitchableControl }): void {
  const all = Object.entries(controls) as [Exclude<CameraControl, 'off'>, SwitchableControl][];
  for (const [m, c] of all) if (m !== mode) void c.apply(false);
  for (const [m, c] of all) if (m === mode) void c.apply(true);
}

/** Why a camera mode did not start: its files are not on the device, its runtime did not load, or the camera did not open. */
export type CameraStartFailure = 'files' | 'runtime' | 'camera';

/** How one camera mode names itself when it cannot start. */
export interface CameraWords {
  /** Its name in `problems`: «gesture control». */
  readonly subject: string;
  /** What the child loses, after «the child cannot»: «play with gestures». */
  readonly loses: string;
  /**
   * What the child hears for each failure, in the page's language at the moment it happens. Each is the mode's own `t('…')`
   * with a literal key, so `tests/no-key-reaches-the-child-unresolved` still reads it — a key built here would not be checked.
   */
  readonly spoken: { readonly [K in CameraStartFailure]: () => string };
}

export interface CameraStartDeps<T extends { close(): void }, F> {
  /** The reader's loader (`platform/vision`), already given the page and the checked cache. */
  readonly load: () => Promise<{ readonly ok: true; readonly tracker: T } | { readonly ok: false; readonly missing: readonly string[] }>;
  readonly openFeed: () => Promise<F>;
  /** Nothing started: the control says it, writes it once, and puts the 📷 back to off — if it is still wanted. */
  readonly failed: (kind: CameraStartFailure, line: string, spoken: string) => void;
}

/**
 * THE READER, THEN THE CAMERA — or the reason neither is running, said through `failed`; `null` when nothing started.
 *
 * 🔴 A LOADER THAT REJECTS IS A FAILURE LIKE ANY OTHER (ADR-0169). `platform/vision` answers the files it cannot find, but a
 * runtime that cannot be IMPORTED (a server that sends `.mjs` as `text/plain`, an address that answers 404) or a vision task
 * that cannot be built on the GPU nor on the CPU rejects instead, and the three controls awaited it with nothing around it: the
 * rejection went up through `apply` into `followCameraMode`'s `void` and died unhandled, with the 📷 lit, nothing said and
 * nothing in `problems` — measured in a real page on 2026-09-25. The 👄 had met the same defect on 2026-09-21
 * (`ui/voice-control`); this is the one place the three camera modes now start through, so a fourth cannot miss it.
 */
export async function startCameraReader<T extends { close(): void }, F>(words: CameraWords, d: CameraStartDeps<T, F>): Promise<{ tracker: T; feed: F } | null> {
  const { subject, loses, spoken } = words;
  let load: Awaited<ReturnType<CameraStartDeps<T, F>['load']>>;
  try { load = await d.load(); } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    d.failed('runtime', `${subject}: the vision runtime did not load (${why}) — the child cannot ${loses}; check that the delivery carries the vision files and that the server serves .mjs files with the MIME type text/javascript`, spoken.runtime());
    return null;
  }
  if (!load.ok) {
    d.failed('files', `${subject}: ${load.missing.join(', ')} not on this device — the child cannot ${loses}; open the game once online so the install fetches them`, spoken.files());
    return null;
  }
  try { return { tracker: load.tracker, feed: await d.openFeed() }; } catch {
    load.tracker.close();
    d.failed('camera', `${subject}: the camera did not open — the child cannot ${loses}; allow the camera for this page, or plug one in`, spoken.camera());
    return null;
  }
}
