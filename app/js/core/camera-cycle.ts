// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * THE WEBCAM POSITIONS OF THE QUICK BAR'S 📷 (ADR-0215): off · hands · face · eyes, in that order, one at a time (ADR-0197).
 *
 * 📌 A STATELESS MODULE ON PURPOSE (ADR-0232, issue #207): the positions and their cycle are vocabulary, and a module that
 * only needs the vocabulary must not import `core/state` — the page's one settings store — to get it. `core/state` keeps
 * the stored position and imports its sanitiser from here, like `core/game-speed` for the hourglass.
 */
export type CameraControl = 'off' | 'hands' | 'face' | 'eyes';

/** The positions, in the order the 📷 cycles through them and the motor panel's camera row lists them. */
export const CAMERA_CONTROLS: readonly CameraControl[] = Object.freeze(['off', 'hands', 'face', 'eyes'] as const);

/** A stored value that is not a position reads as off: the camera must never switch itself on. */
export const toCameraControl = (v: string | null): CameraControl =>
  ((CAMERA_CONTROLS as readonly (string | null)[]).includes(v) ? v as CameraControl : 'off');

/** The next position of the 📷 cycle, wrapping back to off. */
export const nextCameraControl = (v: CameraControl): CameraControl =>
  CAMERA_CONTROLS[(CAMERA_CONTROLS.indexOf(v) + 1) % CAMERA_CONTROLS.length]!;
