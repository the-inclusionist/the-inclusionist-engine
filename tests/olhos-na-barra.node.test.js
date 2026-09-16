// SPDX-License-Identifier: AGPL-3.0-or-later
// THE 👀 ON THE QUICK BAR (ADR-0213 §7, ADR-0212 §6; issue #194) — playing with the eyes, three positions: off · the regions' outlines and
// the eye lines · outlines, hatching and the eye lines. Kept on the device. It mounts only where the root has a camera to ask for.
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

describe('the 👀 icon', () => {
  it('is no longer under construction, and keeps its place', () => {
    const i = PAUSE_ICONS.findIndex((ic) => ic.k === 'eyes');
    expect(PAUSE_ICONS[i].soon).toBeFalsy();
    expect(PAUSE_ICONS[i - 1].k).toBe('face'); expect(PAUSE_ICONS[i + 1].k).toBe('voice');
  });
  it('mounts where the root can play with the eyes, and not where it cannot', () => {
    expect(iconesQueAccionam({ ...todos, olhos: true }).map((ic) => ic.k)).toContain('eyes');
    expect(iconesQueAccionam({ ...todos, olhos: false }).map((ic) => ic.k)).not.toContain('eyes');
    expect(iconesQueAccionam(todos).map((ic) => ic.k), 'no answer is no 👀').not.toContain('eyes');
  });
  it('its name says the position, and it shows as on in both on positions', () => {
    expect(computeIconLabel('eyes', snap({ olhos: 'off' }))).toMatch(/desligado/);
    expect(computeIconLabel('eyes', snap({ olhos: 'outlines' }))).toMatch(/contornos$/);
    expect(computeIconLabel('eyes', snap({ olhos: 'hatched' }))).toMatch(/contornos e hachuras/);
    expect(computeIconVisual('eyes', snap({ olhos: 'off' }))).toMatchObject({ on: false, active: false });
    expect(computeIconVisual('eyes', snap({ olhos: 'outlines' }))).toMatchObject({ on: true, active: true });
    expect(computeIconVisual('eyes', snap({ olhos: 'hatched' }))).toMatchObject({ on: true, active: true });
  });
});

describe('the stored position', () => {
  beforeEach(() => { state.carregarEstado(portaFalsa()); });
  it('cycles off → outlines → hatched → off', () => {
    expect(['off', 'outlines', 'hatched'].map(state.nextEyeControl)).toEqual(['outlines', 'hatched', 'off']);
  });
  it('is loaded from the child\'s storage and written back', () => {
    const p = portaFalsa({ incl_eye_control: 'hatched' });
    state.carregarEstado(p);
    expect(state.eyeControl).toBe('hatched');
    state.setEyeControlValue('outlines');
    expect(state.eyeControl).toBe('outlines'); expect(p.dados.incl_eye_control).toBe('outlines');
  });
  it('nothing stored, or anything that is not a position, is off — the camera never switches itself on', () => {
    expect(state.eyeControl).toBe('off');
    state.carregarEstado(portaFalsa({ incl_eye_control: 'on' }));
    expect(state.eyeControl).toBe('off');
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-olhos-na-barra.py`:
//   · the 👀 mounted in every game                 → «not where it cannot»
//   · the label without the position                → «its name says the position»
//   · on only at the hatched position               → «on in both on positions»
//   · the cycle skipping outlines                   → «cycles»
//   · an unknown stored value read as outlines      → «the camera never switches itself on»
