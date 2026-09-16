// SPDX-License-Identifier: AGPL-3.0-or-later
// THE 🧑 ON THE QUICK BAR (ADR-0212 §3; issue #191) — playing with the face: off · on · on with the eyes, brows and mouth lines. Kept on the
// device. One camera group at a time (ADR-0197): the face and the eyes turn each other off.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach } from 'vitest';
import { PAUSE_ICONS, iconesQueAccionam, computeIconLabel, computeIconVisual } from '../app/js/ui/pause-icons.js';
import * as state from '../app/js/core/state.js';
import { PADRAO } from '../app/js/core/visual-state.js';

const snap = (over = {}) => ({ modoCego: false, ttsOn: false, librasOn: false, calmMode: 0, toggleMove: false, visual: PADRAO, privateOutput: true, ...over });
const todos = { tema: true, correcao: true, seguraTeclas: () => true, tipografia: true, relogio: () => true };
function portaFalsa(guardado = {}) {
  const dados = { ...guardado };
  return {
    dados, get: (k, f) => (k in dados ? String(dados[k]) : f), set: (k, v) => { dados[k] = v; },
    getBool: (k, f = false) => (k in dados ? dados[k] === true : f), setBool: (k, on) => { dados[k] = on; },
    getNum: (k, f = 0) => (k in dados ? Number(dados[k]) : f),
    KEYS: { letterCase: 'a', captions: 'b', menuIndex: 'c', cbsafe: 'd', ownercolors: 'e', outfg: 'f', outbg: 'g' },
  };
}

describe('the 🧑 icon', () => {
  it('is no longer under construction, mounts only with a camera to ask for', () => {
    expect(PAUSE_ICONS.find((ic) => ic.k === 'face').soon).toBeFalsy();
    expect(iconesQueAccionam({ ...todos, olhos: true }).map((ic) => ic.k)).toContain('face');
    expect(iconesQueAccionam(todos).map((ic) => ic.k)).not.toContain('face');
  });
  it('its name says the position, and it shows as on in both on positions', () => {
    expect(computeIconLabel('face', snap({ rosto: 'off' }))).toMatch(/desligado/);
    expect(computeIconLabel('face', snap({ rosto: 'on' }))).toMatch(/: ligado$/);
    expect(computeIconLabel('face', snap({ rosto: 'lines' }))).toMatch(/com as linhas/);
    expect(computeIconVisual('face', snap({ rosto: 'off' })).on).toBe(false);
    expect(computeIconVisual('face', snap({ rosto: 'on' })).on).toBe(true);
    expect(computeIconVisual('face', snap({ rosto: 'lines' })).on).toBe(true);
  });
});

describe('the stored position, and one camera group at a time', () => {
  beforeEach(() => { state.carregarEstado(portaFalsa()); });
  it('cycles off → on → lines → off, and is stored', () => {
    expect(['off', 'on', 'lines'].map(state.nextFaceControl)).toEqual(['on', 'lines', 'off']);
    const p = portaFalsa();
    state.carregarEstado(p);
    state.setFaceControlValue('lines');
    expect(p.dados.incl_face_control).toBe('lines');
  });
  it('turning the face on turns the eyes off, and the eyes turn the face off', () => {
    state.setEyeControlValue('outlines');
    state.setFaceControlValue('on');
    expect([state.faceControl, state.eyeControl]).toEqual(['on', 'off']);
    state.setEyeControlValue('hatched');
    expect([state.faceControl, state.eyeControl]).toEqual(['off', 'hatched']);
  });
  it('nothing stored, or anything else, is off; both stored on from before the rule leaves the eyes', () => {
    expect(state.faceControl).toBe('off');
    state.carregarEstado(portaFalsa({ incl_face_control: 'yes' }));
    expect(state.faceControl).toBe('off');
    state.carregarEstado(portaFalsa({ incl_face_control: 'on', incl_eye_control: 'outlines' }));
    expect([state.faceControl, state.eyeControl]).toEqual(['off', 'outlines']);
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-rosto-na-barra.py`:
//   · the 🧑 mounted in every game                     → «mounts only with a camera»
//   · on only at the lines position                     → «on in both on positions»
//   · the face not turning the eyes off                 → «turns the eyes off»
//   · the eyes not turning the face off                 → «the eyes turn the face off»
//   · both stored on kept at load                       → «leaves the eyes»
