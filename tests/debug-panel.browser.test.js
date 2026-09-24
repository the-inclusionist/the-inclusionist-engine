// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/debug-panel (BROWSER project: uses document). Contract: mounts only with ?debug=true; the sliders mutate the
// LIVE TUNE/ANIM objects (the same reference the game holds); the toggles mutate JUICE and call saveJuice. Closure DI.
// See docs/5-Refactoring/plan-modularization-map.md (Tier 1, ui/debug-panel).
import { describe, it, expect, beforeEach } from 'vitest';
import { initDebugPanel } from '../app/js/ui/debug-panel.js';

const fullCtx = (over = {}) => ({
  TUNE: { hWalk: 2, hRun: 3, hTurbo: 4, jumpVel: 5, ultraJumpVel: 8, trampBase: 4, trampMax: 8, waterJump: 3, waterJumpRun: 4, waterStrokeFrames: 20, climbSpeed: 2, gravity: 0.2, maxFall: 8, waterMaxFall: 4 },
  ANIM: { walkHold: 5, runHold: 4, idleHold: 12, swimHold: 8 },
  JUICE: { dust: true, sparkle: true, squash: true, hitstop: true, shake: true, shimmer: true },
  saveJuice: () => {},
  search: '?debug=true',
  ...over,
});

describe('ui/debug-panel', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('[Zero] sem ?debug=true retorna null e não monta painel', () => {
    expect(initDebugPanel(fullCtx({ search: '' }))).toBeNull();
    expect(document.querySelector('#debug-panel')).toBeNull();
  });

  it('[Interface] com ?debug=true monta um painel acessível (role=group, aria-label, começa oculto)', () => {
    const el = initDebugPanel(fullCtx());
    expect(el).not.toBeNull();
    expect(document.querySelector('#debug-panel')).toBe(el);
    expect(el.getAttribute('role')).toBe('group');
    expect(el.getAttribute('aria-label')).toBeTruthy();
    expect(el.hidden).toBe(true); // opened by the 🐞 Debug button
  });

  it('[Interface] um slider muta o objeto TUNE VIVO (mesma referência injetada)', () => {
    const ctx = fullCtx();
    initDebugPanel(ctx);
    const range = document.querySelector('#debug-panel input[type=range]'); // 1st = walking speed (hWalk)
    range.value = '3.5';
    range.dispatchEvent(new Event('input'));
    expect(ctx.TUNE.hWalk).toBe(3.5);
  });

  it('[Interface] um toggle de juice muta JUICE e chama saveJuice', () => {
    let saved = 0;
    const ctx = fullCtx({ saveJuice: () => { saved++; } });
    initDebugPanel(ctx);
    const chk = document.querySelector('#debug-panel input[type=checkbox]'); // 1st toggle = dust
    chk.checked = false;
    chk.dispatchEvent(new Event('change'));
    expect(ctx.JUICE.dust).toBe(false);
    expect(saved).toBe(1);
  });

  it('[Boundary] um knob de cadência mostra os fps (60/valor): walkHold=6 → 10fps', () => {
    initDebugPanel(fullCtx({ ANIM: { walkHold: 6, runHold: 4, idleHold: 12, swimHold: 8 } }));
    expect(document.querySelector('#debug-panel').textContent).toContain('10fps');
  });
});
