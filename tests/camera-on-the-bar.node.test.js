// SPDX-License-Identifier: AGPL-3.0-or-later
// THE 📷 ON THE QUICK BAR (ADR-0215; issue #199) — playing through the webcam is ONE icon: off · hands · face · eyes. The Dev, 2026-09-16:
// «Vamos de um ícone só que alterna entre a) off, b) linhas das mãos, c) face + lábio d) olhos + retângulos (sem hachuras).» Kept on the
// device in one key, so one camera mode at a time holds by construction. It mounts only where the root has a camera to ask for.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach } from 'vitest';
import { iconsThatAct, computeIconLabel, computeIconVisual } from '../app/js/ui/pause-icons.js';
import { PAUSE_ICONS } from '../app/js/core/pause-icon-catalogue.js';
import * as state from '../app/js/core/state.js';
import { PADRAO } from '../app/js/core/visual-state.js';

const snap = (over = {}) => ({ blindMode: false, ttsOn: false, librasOn: false, calmMode: 0, toggleMove: false, visual: PADRAO, privateOutput: true, ...over });
const todos = { tema: true, correcao: true, seguraTeclas: () => true, tipografia: true, relogio: () => true, menus: true };
function portaFalsa(guardado = {}) {
  const dados = { ...guardado };
  return {
    dados, get: (k, f) => (k in dados ? String(dados[k]) : f), set: (k, v) => { dados[k] = v; },
    getBool: (k, f = false) => (k in dados ? dados[k] === true : f), setBool: (k, on) => { dados[k] = on; },
    getNum: (k, f = 0) => (k in dados ? Number(dados[k]) : f),
    KEYS: { letterCase: 'a', captions: 'b', menuIndex: 'c', cbsafe: 'd', ownercolors: 'e', outfg: 'f', outbg: 'g' },
  };
}

describe('the 📷 icon', () => {
  it('is ONE icon where 🧑 and 👀 were, and neither of those is left', () => {
    const chaves = PAUSE_ICONS.map((ic) => ic.k);
    expect(chaves.filter((k) => k === 'camera')).toHaveLength(1);
    expect(chaves).not.toContain('eyes');
    expect(chaves).not.toContain('face');
    const i = chaves.indexOf('camera');
    expect([chaves[i - 1], chaves[i + 1]]).toEqual(['cvd', 'voice']);
  });
  it('mounts where the root has a camera to ask for, and not where it has none', () => {
    expect(iconsThatAct({ ...todos, camera: true }).map((ic) => ic.k)).toContain('camera');
    expect(iconsThatAct({ ...todos, camera: false }).map((ic) => ic.k)).not.toContain('camera');
    expect(iconsThatAct(todos).map((ic) => ic.k), 'no answer is no 📷').not.toContain('camera');
  });
  it('its name says the mode, and it shows as on in every mode that plays', () => {
    expect(computeIconLabel('camera', snap({ camera: 'off' }))).toBe('Webcam: desligado');
    expect(computeIconLabel('camera', snap({ camera: 'hands' }))).toBe('Webcam: gestos das mãos');
    expect(computeIconLabel('camera', snap({ camera: 'face' }))).toBe('Webcam: rosto');
    expect(computeIconLabel('camera', snap({ camera: 'eyes' }))).toBe('Webcam: olhos');
    expect(computeIconVisual('camera', snap({ camera: 'off' })).on).toBe(false);
    for (const modo of ['hands', 'face', 'eyes']) expect(computeIconVisual('camera', snap({ camera: modo })).on, modo).toBe(true);
  });
});

describe('the stored position', () => {
  beforeEach(() => { state.loadState(portaFalsa()); });
  it('cycles off → hands → face → eyes → off, in the Dev\'s order', () => {
    expect(['off', 'hands', 'face', 'eyes'].map(state.nextCameraControl)).toEqual(['hands', 'face', 'eyes', 'off']);
  });
  it('is one key, loaded from the child\'s storage and written back', () => {
    const p = portaFalsa({ incl_camera_control: 'face' });
    state.loadState(p);
    expect(state.cameraControl).toBe('face');
    state.setCameraControlValue('eyes');
    expect(state.cameraControl).toBe('eyes');
    expect(p.dados).toEqual({ incl_camera_control: 'eyes' });
  });
  it('nothing stored, anything that is not a mode, or the old per-mode keys, is off — the camera never switches itself on', () => {
    expect(state.cameraControl).toBe('off');
    state.loadState(portaFalsa({ incl_camera_control: 'outlines' }));
    expect(state.cameraControl).toBe('off');
    state.loadState(portaFalsa({ incl_eye_control: 'hatched', incl_face_control: 'lines' }));
    expect(state.cameraControl).toBe('off');
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-camera.py`:
//   · the 📷 mounted in every game                 → «not where it has none»
//   · the label without the mode                    → «its name says the mode»
//   · on only at the eyes                           → «on in every mode that plays»
//   · the cycle in another order (eyes before face) → «in the Dev's order»
//   · an unknown stored value read as hands          → «the camera never switches itself on»
