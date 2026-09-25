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
//
// 📌 A FACTORY since ADR-0232 D4: each case builds its own deaf mode over its own store and clock, so no case inherits
// another's state — the `afterEach` that turned the MODULE's state back off is gone with the module state.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLibras } from '../app/js/ui/vlibras.js';
import { createTranslator } from '../app/js/core/i18n.js';
import pt from '../app/js/i18n/pt.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

let backend;
/** A deaf mode over this case's own store; `now` is the clock the one-utterance queue reads. */
const build = (over = {}) => createLibras({ doc: document, win: window, store: createStorage(backend), now: () => Date.now(), ...over });

beforeEach(() => {
  document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';
  backend = memoryBackend(); // each case its own store: nothing stored, so the mode starts off
});

describe('ui/vlibras — o toggle é um toggle', () => {
  it('[Right] liga e desliga, e nada disso depende do widget existir', () => {
    // The case the defect made impossible: without the widget loaded, the toggle could only warn. Whoever needs the mode
    // cannot depend on an external library having loaded to be able to turn it on.
    const libras = build();
    expect(libras.isOpen()).toBe(false);
    libras.toggle(translate);
    expect(libras.isOpen()).toBe(true);
    libras.toggle(translate);
    expect(libras.isOpen()).toBe(false);
  });

  it('[Right] `isOpen()` lê o NOSSO estado, não o retângulo do widget', () => {
    // The regression this pins: a zero-height div in the legacy markup used to mean "on".
    document.body.innerHTML += '<div vw-access-button style="display:none"></div>';
    const libras = build();
    expect(libras.isOpen()).toBe(false); // hidden, and still OFF — because nobody turned it on
    libras.toggle(translate);
    expect(libras.isOpen()).toBe(true);
  });

  it('[Right] persiste — quem liga o modo o reencontra ligado (ADR-0028)', () => {
    const libras = build();
    libras.toggle(translate);
    expect(backend.getItem('incl_libras')).toBe('1');
    libras.toggle(translate);
    expect(backend.getItem('incl_libras')).toBe('0');
  });

  it('🔴 [Right] building READS the stored choice — at build, never at import (ADR-0232)', () => {
    backend = memoryBackend([['incl_libras', '1']]);
    expect(build().isOpen(), 'the child who left deaf mode on found it off').toBe(true);
  });

  it('[Interface] avisa o reflow do layout nas DUAS direções, e a soltura cala o aviso', () => {
    const libras = build();
    let n = 0;
    const release = libras.onChange(() => { n++; });
    libras.toggle(translate);
    expect(n).toBe(1);
    libras.toggle(translate);
    expect(n).toBe(2); // turning off reflows too: the layout cannot keep the shape of the previous state
    release();
    libras.toggle(translate);
    expect(n, 'a released reflow still ran').toBe(2);
  });

  it('[Interface] a confirmação de ligar sai EM LIBRAS, não no leitor de tela', async () => {
    // `say` sends the confirmation to the INTERPRETER, that is, it comes out in the language the mode is about. Whoever
    // announces to the screen reader is whoever calls the toggle (`ui/pause-icons`, with sr.icon.librasOn/Off), and that is
    // where that case lives.
    //
    // Without the widget loaded none of this is visible, and that is precisely why the toggle MUST NOT depend on it: the
    // mode turns on anyway, and the translator appears if it can.
    const libras = build();
    expect(() => libras.toggle(translate)).not.toThrow();
    await nextFrame();
    expect(libras.isOpen()).toBe(true);
    expect(document.querySelector('#sr-status').textContent).toBe(''); // the module does not speak here, by design
  });

  it('🔴 [Right] the confirmation goes to the interpreter in the language of the `t` it is given, never as a key (ADR-0232 D3)', () => {
    // The interpreter reads the text of a hidden node it clicks; the click is where the text can be read back.
    const heard = [];
    const click = vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(function () { heard.push(this.textContent); });
    try {
      build().toggle(translate);
      expect(heard, 'turning deaf mode on sent the interpreter nothing').toEqual([pt['sr.libras.on']]);
      expect(heard[0]).not.toBe('sr.libras.on');
    } finally {
      click.mockRestore();
    }
  });
});

describe('ui/vlibras — the interpreter\'s queue, on the clock and in the document it is given (ADR-0232 D4)', () => {
  it('🔴 [Right] a text said while the interpreter is busy waits for it, on the INJECTED clock and timer', () => {
    const heard = [];
    const click = vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(function () { heard.push(this.textContent); });
    const timers = [];
    let clock = 1000;
    try {
      const libras = build({ now: () => clock, win: { dispatchEvent: () => true, setTimeout: (fn) => { timers.push(fn); return 0; } } });
      libras.toggle(translate); // signs the confirmation: busy for 4 s of THIS clock
      libras.say('segunda');
      expect(heard, 'the queue did not wait for the interpreter').toEqual([pt['sr.libras.on']]);
      timers.shift()(); // the injected timer drains the queue
      expect(heard).toEqual([pt['sr.libras.on'], 'segunda']);
      // and it is THIS clock that says the interpreter is free: 5 s later by it, a text is signed at once
      clock += 5000;
      libras.say('terceira');
      expect(heard, 'the queue read a clock it was not given').toEqual([pt['sr.libras.on'], 'segunda', 'terceira']);
    } finally {
      click.mockRestore();
    }
  });

  it('🔴 [Right] the hidden node the interpreter clicks lives in the INJECTED document', () => {
    const other = document.implementation.createHTMLDocument('another host');
    const libras = build({ doc: other });
    libras.toggle(translate);
    expect(other.body.querySelector('span[aria-hidden="true"]'), 'the interpreter\'s node is not in the injected document').not.toBeNull();
    expect(document.body.querySelector('span[aria-hidden="true"]'), 'the interpreter\'s node reached the global document').toBeNull();
  });

  it('🎯 [Boundary] two deaf modes share nothing — one root\'s toggle is not another\'s', () => {
    const first = build();
    const second = createLibras({ doc: document, win: window, store: createStorage(memoryBackend()), now: () => Date.now() });
    first.toggle(translate);
    expect(second.isOpen(), 'one root\'s deaf mode switched another root\'s').toBe(false);
  });
});

describe('ui/vlibras — tick já não decide nada', () => {
  it('[Zero] chamar tick não muda o estado nem dispara reflow', () => {
    // It used to be the polling that read the geometry every 250ms and flipped the switch by itself. It only mirrors now,
    // and this case exists so nobody turns it back into a decider without noticing.
    const libras = build();
    let n = 0; libras.onChange(() => { n++; });
    libras.tick(); libras.tick(); libras.tick();
    expect(n).toBe(0);
    expect(libras.isOpen()).toBe(false);
    libras.toggle(translate);
    const antes = libras.isOpen();
    libras.tick();
    expect(libras.isOpen()).toBe(antes);
  });

  it('🎯 [Right] a choice RESTORED from storage signs only after a tick — the behaviour kept (DD1)', () => {
    // A child who left deaf mode on finds it on, and the interpreter opens on the loop's first tick: the games that sign
    // call `tick` from their loop. Kept exactly as the module did it.
    backend = memoryBackend([['incl_libras', '1']]);
    const heard = [];
    const click = vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(function () { heard.push(this.textContent); });
    try {
      const libras = build();
      libras.say('antes do tick');
      expect(heard).toEqual([]);
      libras.tick();
      libras.say('depois do tick');
      expect(heard).toEqual(['depois do tick']);
    } finally {
      click.mockRestore();
    }
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · the clock back to `Date.now()` → the queue case is red; the timer back to the global `setTimeout` → red too.
//   · the node APPENDED to the global `document.body` → the «INJECTED document» case is red. ⚠️ Built by the global
//     `document.createElement` and appended to the injected body it stays GREEN: appending adopts a node across
//     documents, so which document created it is not observable. That line is not gated, and it is said here.
//   · the choice as module state again → the «two deaf modes share nothing» case is red.
//   · the release of `onChange` doing nothing → the reflow case is red.
//   · `say` ignoring the tick latch (signing whenever the choice is on) → the «restored choice» case is red.
