// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT EACH REGION OF THE EYE CONTROL SHOWS (ADR-0213 §6 and its erratum; issue #194). Ported from the lab's `apresentacao.check.mjs`.
// The drawing itself is measured in `gaze-overlay.browser.test.js`.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { whatRegionShows, gazeFontPx, FACE_BUTTON, SHOULDER, LUCIDE_ARROWS, GAZE_REGIONS } from '../app/js/ui/gaze-overlay.js';
import { GAZE_GROUPS, CANCEL } from '../app/js/input/gaze-cycle.js';
import { t } from '../app/js/core/i18n.js';

const ZONES = ['up', 'right', 'down', 'left'];
const view = (o) => ({ zone: null, armed: false, preparing: false, preview: null, restReady: true, ...o });
const at = (zone, item) => view({ zone, armed: true, preview: { zone, item, index: 0 } });

describe('what a region shows', () => {
  it('a region the gaze is not in shows nothing', () => {
    for (const r of ZONES) expect(whatRegionShows(r, at(r === 'up' ? 'down' : 'up', 'up')).kind).toBe('nothing');
  });
  it('a preparing look says where to go — the opposite of itself', () => {
    expect(ZONES.map((r) => whatRegionShows(r, view({ zone: r, preparing: true })))).toEqual(ZONES.map((r) => ({ kind: 'text', key: `gaze.prepare.${r}` })));
    expect(['up', 'right', 'down', 'left'].map((r) => t(`gaze.prepare.${r}`))).toEqual(['Desça!', 'Pra Esquerda!', 'Suba!', 'Pra Direita!']);
  });
  it('an unarmed look that cannot prepare (the dead time after a command) says nothing', () => {
    expect(whatRegionShows('up', view({ zone: 'up' })).kind).toBe('nothing');
  });
  it('an armed look says «Carregando...» while it settles and on the cancel step', () => {
    expect(whatRegionShows('down', view({ zone: 'down', armed: true }))).toEqual({ kind: 'text', key: 'gaze.loading' });
    expect(whatRegionShows('down', at('down', CANCEL))).toEqual({ kind: 'text', key: 'gaze.loading' });
    expect(t('gaze.loading')).toBe('Carregando...');
  });
  it('then its arrow, its face button, and its shoulder: R1, R2, L2, L1', () => {
    for (const r of ZONES) {
      expect(whatRegionShows(r, at(r, GAZE_GROUPS[r][0])).kind).toBe('arrow');
      expect(whatRegionShows(r, at(r, GAZE_GROUPS[r][1])).kind).toBe('button');
      expect(whatRegionShows(r, at(r, GAZE_GROUPS[r][2]))).toEqual({ kind: 'shoulder', label: SHOULDER[r] });
    }
    expect(SHOULDER).toEqual({ up: 'R1', right: 'R2', down: 'L2', left: 'L1' });
  });
  it('the middle asks to be looked at only while the rest is being measured', () => {
    expect(whatRegionShows('middle', view({ restReady: false }))).toEqual({ kind: 'text', key: 'gaze.lookHere' });
    expect(whatRegionShows('middle', view({ restReady: true })).kind).toBe('nothing');
  });
});

describe('the pieces', () => {
  it('the face buttons are the Xbox letter and the PlayStation shape of that side — north is Y (the erratum)', () => {
    expect(FACE_BUTTON).toEqual({ up: ['Y', 'triangle'], right: ['B', 'circle'], down: ['A', 'cross'], left: ['X', 'square'] });
  });
  it('the arrows are Lucide\'s, pointing the region\'s way', () => {
    expect([LUCIDE_ARROWS.up[1], LUCIDE_ARROWS.right[0], LUCIDE_ARROWS.down[0], LUCIDE_ARROWS.left[1]]).toEqual(['M12 19V5', 'M5 12h14', 'M12 5v14', 'M19 12H5']);
  });
  it('the writing is 16 px at 720×360 and grows with the region, bounded by the tighter side', () => {
    expect([gazeFontPx(720, 360), gazeFontPx(1440, 720), gazeFontPx(1440, 360)]).toEqual([16, 32, 16]);
  });
  it('the four regions sit at the edges and the middle at the centre', () => {
    expect(GAZE_REGIONS.up[1]).toBeLessThan(0.5); expect(GAZE_REGIONS.down[1]).toBeGreaterThan(0.5);
    expect(GAZE_REGIONS.left[0]).toBeLessThan(0.5); expect(GAZE_REGIONS.right[0]).toBeGreaterThan(0.5);
    expect(GAZE_REGIONS.middle.slice(0, 2)).toEqual([0.5, 0.5]);
  });
});

// MUTATIONS CHECKED (2026-09-16), each red before this file counted — `scratchpad/mutar-gaze-overlay.py`:
//   · a region shows its content wherever the gaze is          → «not in shows nothing»
//   · an unarmed look always prepares                           → «cannot prepare … says nothing»
//   · cancel shows the arrow                                    → «on the cancel step»
//   · button and shoulder swapped                               → «arrow, face button, shoulder»
//   · the middle always asks                                    → «only while the rest is being measured»
//   · north back to X                                           → «north is Y»
//   · the font by the wider side                                → «bounded by the tighter side»
