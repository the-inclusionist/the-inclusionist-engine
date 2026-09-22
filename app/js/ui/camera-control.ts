// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/camera-control — THE 📷 POSITION TO THE THREE CAMERA CONTROLS (ADR-0215; issue #199).
//
// One stored position (`core/state.cameraControl`): off · hands · face · eyes. Each control starts only at its own position, so one camera
// mode at a time holds by construction (ADR-0197). The ones turning off are told first, so a camera is let go before the next mode asks.

import type { CameraControl } from '../core/state.js';
/*
 * 🔴 A FORMA DE UM CONTROLE PASSOU A TER NOME PRÓPRIO (ADR-0221 passo 7f): era o `CameraModeControl`, declarado aqui, e os
 * quatro membros da família — olhos, rosto, mãos e voz — tinham a mesma forma sem nunca o dizerem. O `SwitchableControl` é
 * essa forma, e a VOZ também a declara: ela responde ao 👄 e não ao 📷, logo o nome da família não podia ser «câmera».
 */
import type { SwitchableControl } from './switchable-control.js';

export function followCameraMode(mode: CameraControl, controls: { readonly [M in Exclude<CameraControl, 'off'>]: SwitchableControl }): void {
  const all = Object.entries(controls) as [Exclude<CameraControl, 'off'>, SwitchableControl][];
  for (const [m, c] of all) if (m !== mode) void c.apply(false);
  for (const [m, c] of all) if (m === mode) void c.apply(true);
}
