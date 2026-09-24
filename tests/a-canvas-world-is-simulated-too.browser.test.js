// SPDX-License-Identifier: AGPL-3.0-or-later
// A WORLD THAT IS A CANVAS IS SIMULATED TOO (ADR-0187; ADR-0151 §2 item 2; issue #182).
//
// 🔴 WHY THIS FILE EXISTS, and it is measured rather than tidy: the contract lets a cartridge declare its world as any
// element, and `#game-region` — a div with the menus inside it — is the only shape the tree had a case for. 📏 Probed on
// 2026-09-22, THREE branches of «put the simulation over the world» were blind, and all three are the canvas path: a world
// that holds no menu being filtered as a whole, the drawn layer going into the canvas's PARENT, and that layer being placed
// over the canvas. A canvas cannot hold children, so getting this wrong means the layer never appears at all.
//
// 📌 ONE ROOT PER FILE, for the reason the gamepad file already carries: two roots on a page find each other through
// document-wide queries (`#vp-pause-0`), and then neither case measures what it says.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let motor;
const esperar = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const mundo = () => document.getElementById('mundo-canvas');
const camada = () => document.getElementById('viz-overlay');

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  // ⚠️ THE WORLD IS THE CANVAS, the other shape the contract allows — the one no case drove.
  world: () => ({ kind: 'element', selector: '#mundo-canvas' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

async function simular(chave) {
  motor.pause.show(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]').click();
  const sel = document.querySelector('#empathy #opt-simulacao');
  sel.value = chave;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await esperar();
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
  await esperar();
}

beforeAll(async () => {
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    // 📌 The canvas has a PARENT that is not the region: that parent must host the layer, because a canvas has no children.
    + '<div id="game-region" tabindex="-1"><div id="palco"><canvas id="mundo-canvas" width="320" height="180"'
    + ' style="position:absolute;left:12px;top:7px;width:640px;height:360px"></canvas></div><div id="title-icons"></div></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window },
    downloadHeavy: false, players: [{ ctrl: 0 }],
    // 📌 The cartridge DECLARES a correction writer, which is what makes the 🚥 exist on the bar (ADR-0106 §5: an icon is
    // mounted only where something acts on it). Through it the enhancement case turns a correction on as the child does.
    setPlayerCorrection: () => {},
  });
  await esperar();
});
afterAll(async () => { await simular('normal'); motor?.dispose(); document.body.innerHTML = ''; });

describe('a world that is a canvas', () => {
  it('🔴 [Right] is simulated AS A WHOLE — it holds no menu, so there is nothing inside it to spare', async () => {
    await simular('blind');
    expect(mundo().style.filter, 'the canvas world was not simulated at all').not.toBe('');
    // 📌 And the menus stay out because they are OUTSIDE it, which is what makes this world different from the other case.
    expect(document.getElementById('title-icons').style.filter, 'the quick bar was darkened with the world').toBe('');
  });

  it('🔴 [Right] and what HELPS is kept underneath: a correction does not disappear while a simulation runs', async () => {
    /*
     * 🔴 The branch the probe found blind: on a world with no menus the filter is `[improvement, simulation]` — what the
     * child turned on to SEE stays, and the simulation is laid over it. Dropping the improvement here takes her colour
     * correction away for as long as an adult is looking through her eyes.
     */
    // 📌 The enhancement is TURNED ON AS THE CHILD DOES IT, not injected: the world's filter is recomposed from the STATE at
    // every change, so a value set by hand would be erased at the next step and the case would measure nothing.
    // ⚠️ The previous case leaves the simulation ON, and without this line the before-value measured is the simulation's
    // filter — both `brightness(0)`, and the assertion compared the simulation with itself.
    await simular('normal');
    // 📌 The enhancement used is the CONTRAST ENHANCEMENT, the engine's own state: the colour correction depends on the
    // cartridge bringing a writer, and an empty double would write nowhere — the case would measure nothing again.
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="visual"]').click();
    await esperar();
    const passos = document.getElementById('opt-lq');
    expect(passos, 'no contrast-enhancement stepper — the case would measure nothing').toBeTruthy();
    passos.dispatchEvent(new CustomEvent('passo', { detail: 1, bubbles: true }));
    await esperar();
    for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
    motor.pause.hide(0);
    await esperar();
    const melhoria = mundo().style.filter;
    expect(melhoria, 'turning the contrast enhancement on did not reach the world').not.toBe('');
    await simular('blind');
    expect(mundo().style.filter, `the improvement was dropped: «${melhoria}» → «${mundo().style.filter}»`)
      .toContain(melhoria.trim());
    expect(mundo().style.filter.length, 'only one of the two filters is on the world')
      .toBeGreaterThan(melhoria.trim().length);
    await simular('normal');
    /*
     * ⚠️ AND THE ENHANCEMENT GOES BACK TO WHERE IT WAS, because it is PERSISTED: `incl_*` lives in the origin's storage, and
     * the origin is the same for every browser file of this suite. Left on, it failed two cases of
     * `boot-create-game.browser`, which read the world's filter expecting it clean. A test that changes a stored setting
     * and does not give it back is a test that writes into the others.
     */
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="visual"]').click();
    await esperar();
    document.getElementById('opt-lq')?.dispatchEvent(new CustomEvent('passo', { detail: -1, bubbles: true }));
    await esperar();
    for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
    motor.pause.hide(0);
    await esperar();
    expect(mundo().style.filter, 'the contrast enhancement was left on for every other file in this suite').toBe('');
  });

  it('🔴 [Right] the DRAWN layer goes into the canvas\'s PARENT — a canvas has no children to put it in', async () => {
    await simular('lv-tunnel');
    expect(camada(), 'no layer was drawn for a drawn simulation').not.toBeNull();
    expect(camada().parentElement, 'the layer was put inside the canvas, where it can never appear')
      .toBe(document.getElementById('palco'));
    expect(camada().hidden).toBe(false);
  });

  it('🔴 [Right] and it is placed OVER the canvas, not at the parent\'s origin', async () => {
    await simular('lv-tunnel');
    const c = mundo();
    expect(camada().style.left, 'the layer sits at the parent\'s origin instead of over the world').toBe(`${c.offsetLeft}px`);
    expect(camada().style.top).toBe(`${c.offsetTop}px`);
    expect(camada().style.width).toBe(`${c.offsetWidth}px`);
    expect(camada().style.height).toBe(`${c.offsetHeight}px`);
  });

  it('🎯 [Zero] a simulation that is not DRAWN hides the layer instead of leaving it up', async () => {
    await simular('lv-tunnel');
    expect(camada().hidden).toBe(false);
    await simular('blind');
    expect(camada().hidden, 'the tunnel stayed drawn over a child who had turned it off').toBe(true);
  });
});

// MUTATIONS CHECKED — see `scratchpad/probe-simulation-world.mjs`.
