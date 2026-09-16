// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/camera-control — THE 📷 POSITION TO THE THREE CAMERA CONTROLS (ADR-0215; issue #199).
//
// One stored position (`core/state.cameraControl`): off · hands · face · eyes. Each control starts only at its own position, so one camera
// mode at a time holds by construction (ADR-0197). The ones turning off are told first, so a camera is let go before the next mode asks.

import type { CameraControl } from '../core/state.js';

/** What a camera control needs from the root: be on, or let everything go. */
export interface CameraModeControl { apply(on: boolean): Promise<void> }

export function followCameraMode(mode: CameraControl, controls: { readonly [M in Exclude<CameraControl, 'off'>]: CameraModeControl }): void {
  const all = Object.entries(controls) as [Exclude<CameraControl, 'off'>, CameraModeControl][];
  for (const [m, c] of all) if (m !== mode) void c.apply(false);
  for (const [m, c] of all) if (m === mode) void c.apply(true);
}
