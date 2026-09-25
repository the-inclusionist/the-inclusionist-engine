// SPDX-License-Identifier: AGPL-3.0-or-later
// «BACK» RETURNS THE CURSOR TO THE ITEM THAT OPENED THE MENU (ADR-0130 rule 1, issue #134).
//
// 🎯 The clause the record turns on, and the one it said was unmeasured: «the last option of that new menu is "back",
// which erases the front card and places the CURSOR ON THE ITEM THAT OPENED IT, in the menu underneath» — with «back» as
// item 1 since ADR-0158. 📏 Measured before the change, in a real root: Escape or «Voltar» from the options list landed the
// cursor on «Voltar» (item 1 of the root), not on «Opções»; and a panel opened by a POINTER came back with the cursor on
// whatever item the arrows had last reached, because a press never moved the mark.
//
// 📌 A real root (`createGame`) in a real document: the pause card selects by CLASS (`.pm-sel`) and speaks through the
// root's observer (`ui/where-the-child-is`), so the case reads both the mark and what the child hears.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let motor;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2'] }), holdsAtOnce: () => 1, holdsKeys: () => false,
  tick: 'player', world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 2 }), targetsOf: () => [{ x: 0, y: 0 }],
});

const card = () => document.getElementById('vp-pause-0');
const marked = () => card().querySelector('.pm-sel')?.dataset.act;
const visibleList = () => card().querySelector('.pause-menu:not([hidden])')?.dataset.sub;
const item = (act) => card().querySelector(`.pm-btn[data-act="${act}"]`);
const openPanels = () => [...document.querySelectorAll('#game-region .overlay')].filter((o) => !o.hidden);
/** A key as the keyboard sends it: to whoever has focus, or to the region, and bubbling to the window. */
function key(code) {
  const target = document.activeElement && document.activeElement !== document.body ? document.activeElement : document.getElementById('game-region');
  target.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
}
/** The root's observer speaks on a microtask and `srSay` writes on the next frame. */
const said = async () => {
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  return document.getElementById('sr-status')?.textContent ?? '';
};
function closeAll() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
}

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  const raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false,
    preset: { action1: { label: 'Confirm' }, action2: { label: 'Back' } },
  });
});
beforeEach(() => { closeAll(); });

describe('the pause card: back from a list lands on the door that opened it', () => {
  it('🔴 [Right] Escape in the options list returns to the root ON «Opções», and says so with its place', async () => {
    motor.pause.show(0);
    for (let i = 0; i < 8 && marked() !== 'options'; i++) key('ArrowDown');
    expect(marked(), 'the arrows never reached «Opções» — the case would measure nothing').toBe('options');
    key('Enter');
    expect(visibleList(), 'Enter on «Opções» did not open the list').toBe('opcoes');
    expect(marked(), 'the list opened with the cursor elsewhere than its item 1').toBe('pmback');
    await said();
    key('Escape');
    expect(visibleList()).toBe('raiz');
    expect(marked(), 'back from the list put the cursor on the root\'s first item, not on the door').toBe('options');
    const roots = [...card().querySelectorAll('.pause-menu:not([hidden]) .pm-btn:not([hidden])')];
    const place = `${roots.indexOf(item('options')) + 1} de ${roots.length}`;
    expect(await said(), 'the return did not name the item the cursor came back to').toContain(place);
  });

  it('🔴 [Right] «Voltar», pressed, does the same — the item and the key are one way out', () => {
    motor.pause.show(0);
    item('options').click();
    expect(visibleList()).toBe('opcoes');
    card().querySelector('.pause-menu[data-sub="opcoes"] .pm-btn[data-act="pmback"]').click();
    expect(visibleList()).toBe('raiz');
    expect(marked(), '«Voltar» pressed put the cursor on the root\'s first item').toBe('options');
  });

  it('🔴 [Right] a panel opened by a POINTER comes back with the cursor on the item that opened it', () => {
    motor.pause.show(0);
    item('options').click(); // the list opens with the cursor on its «Voltar»
    expect(marked()).toBe('pmback');
    item('visual').click(); // a finger, straight on the item: the arrows never walked there
    expect(openPanels().map((o) => o.id), 'the visual panel did not open').toEqual(['visual']);
    document.getElementById('visual-close').click();
    expect(openPanels(), 'its «Voltar» did not close the panel').toEqual([]);
    expect(marked(), 'the cursor came back to an item the child never chose').toBe('visual');
  });

  it('🔴 [Right] and a panel opened by the KEYBOARD, closed by Escape, too', () => {
    motor.pause.show(0);
    item('options').click();
    for (let i = 0; i < 8 && marked() !== 'motora'; i++) key('ArrowDown');
    key('Enter');
    expect(openPanels().map((o) => o.id)).toEqual(['motora']);
    key('Escape');
    expect(openPanels()).toEqual([]);
    expect(visibleList(), 'one Escape closed the panel AND the list').toBe('opcoes');
    expect(marked()).toBe('motora');
  });

  it('🔴 [Zero] OPENING the card is not coming back: it still lands on item 1 (ADR-0158)', () => {
    motor.pause.show(0);
    item('options').click();
    card().querySelector('.pause-menu[data-sub="opcoes"] .pm-btn[data-act="pmback"]').click();
    expect(marked()).toBe('options');
    motor.pause.hide(0);
    motor.pause.show(0);
    expect(marked(), 'the card reopened on the last door instead of item 1').toBe('resume');
  });
});

/*
 * MUTATIONS CHECKED (applied by script, restored from a copy):
 *   · `backToRoot` returning `showPauseOptions(sp, 'raiz')` untouched (the old behaviour) → the Escape, «Voltar» and
 *     reopen-after-back cases red (the last only in its setup line).
 *   · `menu-nav`'s «no» putting the mark back on the root's first item after `backToRoot` → the Escape case red;
 *     «Voltar» pressed stays green, since it goes through `pause-icons`.
 *   · `pressPauseItem` without its two marking lines → the pointer case red; the keyboard case stays green, since the
 *     arrows already put the mark there.
 *   · `pause.show` calling `backToRoot` instead of `showPauseOptions` → the [Zero] case red.
 */
