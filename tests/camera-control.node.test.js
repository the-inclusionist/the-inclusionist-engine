// SPDX-License-Identifier: AGPL-3.0-or-later
// THE 📷 POSITION REACHES THE THREE CAMERA CONTROLS (ADR-0215; issue #199): each position starts only its own mode, off stops them all, and
// the ones turning off hear it before the one turning on — so a camera is let go before another mode asks for it.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { followCameraMode } from '../app/js/ui/camera-control.js';

const controls = () => {
  const log = [];
  const c = (name) => ({ apply: async (on) => { log.push(`${name}:${on ? 'on' : 'off'}`); } });
  return { log, controls: { eyes: c('eyes'), face: c('face'), hands: c('hands') } };
};

describe('followCameraMode', () => {
  it.each([['hands'], ['face'], ['eyes']])('%s starts only its own control, after telling the other two to stop', (mode) => {
    const { log, controls: cs } = controls();
    followCameraMode(mode, cs);
    expect(log.filter((l) => l.endsWith(':on'))).toEqual([`${mode}:on`]);
    expect(log.at(-1)).toBe(`${mode}:on`);
    expect(log).toHaveLength(3);
  });
  it('off stops all three and starts none', () => {
    const { log, controls: cs } = controls();
    followCameraMode('off', cs);
    expect(log.sort()).toEqual(['eyes:off', 'face:off', 'hands:off']);
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-camera.py`:
//   · the one turning on told first                → «after telling the other two to stop»
//   · every control turned on                      → «starts only its own control» · «starts none»
