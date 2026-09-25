// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/vlibras — DEAF PERSON MODE (BROWSER project: uses the DOM, and a store of each case's own, ADR-0232).
//
// THE CONTRACT: the state is the PERSON'S CHOICE, persisted, and the widget is at most a translator that may or may not
// be present. An accessibility mode whose state depends on the geometry of a third-party library is a mode that turns
// itself off when the library changes its mind.
//
// Why it matters: deducing the mode from the VLibras widget's GEOMETRY ("access button hidden ⇒ panel OPEN") broke when
// the widget started attaching `#vlibras-access-wrapper` to the `<body>` instead of rendering inside our `<div vw>`. What
// was left in our markup was an EMPTY zero-height div, and zero height was the signature of "open" — so the mode was
// permanently on: the layout reserved 380px for an interpreter that did not exist (canvas measured at `left: -136`, off
// screen) and the button did not turn it off, because it sent a close event to nobody listening. A test asserting the
// inference passed the whole time; no case asked whether the result made sense for a person. It is the difference
// between testing what the code does and testing what the person needs it to do.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as V from '../app/js/ui/vlibras.js';
import { createTranslator } from '../app/js/core/i18n.js';
import pt from '../app/js/i18n/pt.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

let backend;
beforeEach(() => {
  document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';
  backend = memoryBackend(); // each case its own store: nothing stored, so `initLibras` starts it off
  V.initLibras(createStorage(backend));
  V.setOnLibrasChange(() => {});
});
afterEach(() => {
  if (V.librasOpen) V.toggleLibras(translate); // the state is MODULE state
});

describe('ui/vlibras — o toggle é um toggle', () => {
  it('[Right] liga e desliga, e nada disso depende do widget existir', () => {
    // The case the defect made impossible: without the widget loaded, `toggleLibras` could only warn. Whoever needs the mode
    // cannot depend on an external library having loaded to be able to turn it on.
    expect(V.librasOpen).toBe(false);
    V.toggleLibras(translate);
    expect(V.librasOpen).toBe(true);
    V.toggleLibras(translate);
    expect(V.librasOpen).toBe(false);
  });

  it('[Right] `vlibrasOpen()` lê o NOSSO estado, não o retângulo do widget', () => {
    // The regression this pins: a zero-height div in the legacy markup used to mean "on".
    document.body.innerHTML += '<div vw-access-button style="display:none"></div>';
    expect(V.vlibrasOpen()).toBe(false); // hidden, and still OFF — because nobody turned it on
    V.toggleLibras(translate);
    expect(V.vlibrasOpen()).toBe(true);
  });

  it('[Right] persiste — quem liga o modo o reencontra ligado (ADR-0028)', () => {
    V.toggleLibras(translate);
    expect(backend.getItem('incl_libras')).toBe('1');
    V.toggleLibras(translate);
    expect(backend.getItem('incl_libras')).toBe('0');
  });

  it('🔴 [Right] `initLibras` READS the stored choice — at init, never at import (ADR-0232)', () => {
    V.initLibras(createStorage(memoryBackend([['incl_libras', '1']])));
    expect(V.vlibrasOpen(), 'the child who left deaf mode on found it off').toBe(true);
  });

  it('[Interface] avisa o reflow do layout nas DUAS direções', () => {
    let n = 0;
    V.setOnLibrasChange(() => { n++; });
    V.toggleLibras(translate);
    expect(n).toBe(1);
    V.toggleLibras(translate);
    expect(n).toBe(2); // turning off reflows too: the layout cannot keep the shape of the previous state
  });

  it('[Interface] a confirmação de ligar sai EM LIBRAS, não no leitor de tela', async () => {
    // `vlibrasSay` sends the confirmation to the INTERPRETER, that is, it comes out in the language the mode is about.
    // Whoever announces to the screen reader is whoever calls the toggle (`ui/pause-icons`, with sr.icon.librasOn/Off), and
    // that is where that case lives.
    //
    // Without the widget loaded none of this is visible, and that is precisely why the toggle MUST NOT depend on it: the
    // mode turns on anyway, and the translator appears if it can.
    expect(() => V.toggleLibras(translate)).not.toThrow();
    await nextFrame();
    expect(V.librasOpen).toBe(true);
    expect(document.querySelector('#sr-status').textContent).toBe(''); // the module does not speak here, by design
  });
  it('🔴 [Right] the confirmation goes to the interpreter in the language of the `t` it is given, never as a key (ADR-0232 D3)', () => {
    // The interpreter reads the text of a hidden node it clicks; the click is where the text can be read back. The clock is
    // moved past the one-utterance queue, which the cases above leave busy.
    const heard = [];
    const click = vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(function () { heard.push(this.textContent); });
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 86_400_000);
    try {
      V.toggleLibras(translate);
      expect(heard, 'turning deaf mode on sent the interpreter nothing').toEqual([pt['sr.libras.on']]);
      expect(heard[0]).not.toBe('sr.libras.on');
    } finally {
      click.mockRestore();
      now.mockRestore();
    }
  });
});

describe('ui/vlibras — vlTick já não decide nada', () => {  it('[Zero] chamar vlTick não muda o estado nem dispara reflow', () => {
    // It used to be the polling that read the geometry every 250ms and flipped the switch by itself. It only mirrors now,
    // and this case exists so nobody turns it back into a decider without noticing.
    let n = 0; V.setOnLibrasChange(() => { n++; });
    V.vlTick(); V.vlTick(); V.vlTick();
    expect(n).toBe(0);
    expect(V.librasOpen).toBe(false);
    V.toggleLibras(translate);
    const antes = V.librasOpen;
    V.vlTick();
    expect(V.librasOpen).toBe(antes);
  });
});
