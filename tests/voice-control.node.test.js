// SPDX-License-Identifier: AGPL-3.0-or-later
//
// ui/voice-control — THE FIVE PIECES JOINED (ADR-0189, ADR-0193, ADR-0194; issue #184).
//
// The four halves already had their own gates: the vocabulary and the firing rule (`input/voice-map`, 9 mutations), the runtime
// opened from the delivery (`platform/vosk-runtime`, 7), the microphone that stays open (`platform/voice-listener`, 11) and the
// virtual controller (ADR-0111). What NOBODY measured until here is the WIRING, and a wiring is where this project has found most
// of its defects: the pieces are right and the order between them is wrong.
//
// 🎯 THE THREE THINGS THIS FILE EXISTS TO PROVE, and each has a child inside it:
//  1. A WORD BECOMES A PRESS AND THEN A RELEASE. A spoken command is a TAP: the word arrives, the position is pressed, and the
//     pulse lets it go — because a child who says «acima» cannot also say «and keep holding it». What keeps a direction held
//     afterwards is the latch (ADR-0211), which is another module's job.
//  2. WHAT CANNOT START IS SAID, AND THE ICON GOES BACK TO OFF. A 👄 that stays lit over a microphone that never opened is the
//     defect ADR-0106 §5 names: a button that teaches the child the path is not for her.
//  3. NOTHING KEEPS LISTENING AFTER SHE TURNS IT OFF — including the listener that only arrives AFTER she let go of the icon.
//     An open microphone nobody asked for is not a bug in the same class as the others.
import { describe, it, expect } from 'vitest';
import { createVoiceControl, VOICE_PULSE_MS } from '../app/js/ui/voice-control.js';
import { voiceGrammar } from '../app/js/input/voice-map.js';
import pt from '../app/js/i18n/pt.js';

/** A fake recogniser bundle: the control never touches it, it only hands it to the listener. */
const MODEL = { KaldiRecognizer: function () { /* never built here */ } };

/**
 * The bench. Every dependency of the control is a double that RECORDS, so a case can ask what reached the outside world —
 * which is the only thing a wiring has to answer for.
 */
function bench(over = {}) {
  const log = {
    pressed: [], released: [], said: [], alerted: [], reported: [], grammars: [], stopped: 0, loads: 0, listens: 0, off: 0,
  };
  let timers = [];
  let onPartial = null, onFinal = null;
  const listener = {
    setGrammar(g) { log.grammars.push([...g]); },
    async stop() { log.stopped += 1; },
  };
  const deps = {
    base: 'https://school.example/game/',
    language: () => 'pt-BR',
    controller: {
      press: (a, source) => log.pressed.push([a, source]),
      release: (a, source) => log.released.push([a, source]),
    },
    menuWords: () => [],
    say: (s) => log.said.push(s),
    alert: (s) => log.alerted.push(s),
    report: (s) => log.reported.push(s),
    turnOff: () => { log.off += 1; },
    after: (fn, ms) => { timers.push([fn, ms]); },
    loadRuntime: async (d) => { log.loads += 1; log.lastLoad = d; return { ok: true, model: MODEL }; },
    listen: async (d) => { log.listens += 1; log.lastListen = d; onPartial = d.onPartial; onFinal = d.onFinal; return listener; },
    ...over,
  };
  return {
    log, listener, deps,
    control: createVoiceControl(deps),
    /** The recogniser heard something — the same call the microphone makes. */
    hear: (text) => onPartial?.(text),
    endOfSentence: () => onFinal?.(),
    /** Time passes: every pulse that was due fires. */
    tick: () => { const due = timers; timers = []; for (const [fn] of due) fn(); },
    pulses: () => timers.map(([, ms]) => ms),
  };
}

describe('ui/voice-control — a word becomes a press on the virtual controller', () => {
  it('🔴 [Right] turning it on loads the runtime for the CHILD\'S language and opens the microphone with the closed grammar', async () => {
    const b = bench();
    await b.control.apply(true);
    expect(b.log.loads).toBe(1);
    expect(b.log.lastLoad).toMatchObject({ base: 'https://school.example/game/', language: 'pt-BR' });
    expect(b.log.listens).toBe(1);
    expect(b.log.lastListen.model, 'the listener got some other model than the one that loaded').toBe(MODEL);
    expect([...b.log.lastListen.grammar].sort()).toEqual([...voiceGrammar('pt-BR')].sort());
    expect(b.log.said).toEqual([pt['sr.voice.ready']]);
  });

  it('🔴 [Right] a word heard PRESSES the position and lets it go after the pulse — a spoken command is a tap', async () => {
    const b = bench();
    await b.control.apply(true);
    b.hear('acima');
    expect(b.log.pressed, 'the word did not reach the controller').toEqual([['up', 'fala']]);
    expect(b.log.released, 'it was released before the game could see the press').toEqual([]);
    expect(b.pulses()).toEqual([VOICE_PULSE_MS]);
    b.tick();
    expect(b.log.released).toEqual([['up', 'fala']]);
  });

  it('⚠️ [Right] the press is stamped `fala`, and that is what makes the latch and the assisted transport apply', async () => {
    const b = bench();
    await b.control.apply(true);
    b.hear('abaixo');
    b.tick();
    for (const [, source] of [...b.log.pressed, ...b.log.released]) expect(source).toBe('fala');
  });

  it('🔴 [Right] a partial that GROWS fires only what is new — the second word is a second command', async () => {
    const b = bench();
    await b.control.apply(true);
    b.hear('acima');
    b.hear('acima abaixo');
    expect(b.log.pressed).toEqual([['up', 'fala'], ['down', 'fala']]);
  });

  it('⚠️ [Boundary] the end of a sentence resets the reader, so the same word said again commands again', async () => {
    const b = bench();
    await b.control.apply(true);
    b.hear('acima');
    b.endOfSentence();
    b.hear('acima');
    expect(b.log.pressed, 'the second «acima» was swallowed as if the child had not spoken').toEqual([['up', 'fala'], ['up', 'fala']]);
  });

  it('⚠️ [Zero] a partial that says nothing of the vocabulary presses nothing', async () => {
    const b = bench();
    await b.control.apply(true);
    b.hear('era uma vez');
    expect(b.log.pressed).toEqual([]);
  });
});

describe('ui/voice-control — the grammar follows the open menu (ADR-0194)', () => {
  it('🔴 [Right] the names the menu is showing join the grammar when it opens', async () => {
    let menu = [];
    const b = bench({ menuWords: () => menu });
    await b.control.apply(true);
    expect(b.log.lastListen.grammar).not.toContain('acessibilidade visual');
    menu = ['Acessibilidade visual', 'Voltar'];
    b.control.refreshGrammar();
    expect(b.log.grammars).toHaveLength(1);
    expect(b.log.grammars[0]).toContain('acessibilidade visual');
    expect(b.log.grammars[0], 'the vocabulary left with the menu').toContain('acima');
  });

  it('⚠️ [Zero] refreshing with nothing listening does not throw — a menu opens before the microphone does', () => {
    const b = bench();
    expect(() => b.control.refreshGrammar()).not.toThrow();
  });
});

describe('ui/voice-control — what cannot start is SAID, and the icon goes back to off', () => {
  it('🔴 [Right] files that never came down: the microphone is NEVER opened, the child hears why, and the 👄 turns off', async () => {
    const b = bench({ loadRuntime: async () => ({ ok: false, missing: ['comandos:pt:modelo'] }) });
    await b.control.apply(true);
    expect(b.log.listens, 'a microphone was opened with no recogniser to feed').toBe(0);
    expect(b.log.alerted).toEqual([pt['sr.voice.needsInternet']]);
    expect(b.log.off).toBe(1);
    expect(b.log.reported).toHaveLength(1);
    expect(b.log.reported[0], 'the line does not name the file that is missing').toContain('comandos:pt:modelo');
  });

  it('🔴 [Right] a microphone that does not open: said, reported, and back to off — nothing is left half-started', async () => {
    const b = bench({ listen: async () => { throw new Error('NotAllowedError'); } });
    await b.control.apply(true);
    expect(b.log.alerted).toEqual([pt['sr.voice.noMicrophone']]);
    expect(b.log.off).toBe(1);
    expect(b.log.said, 'it announced itself ready over a microphone that failed').toEqual([]);
    expect(b.log.reported[0]).toMatch(/microphone/i);
  });

  /*
   * 📌 `problems` IS READ ONCE, BY AN ADULT; the alert is for the CHILD, every time. So the line is written once per kind and the
   * sentence is said on every try — the opposite choice fills a diagnostic vector with the same line for as long as she keeps
   * pressing, and the one who needed to hear it hears nothing on the second press.
   */
  it('⚠️ [Boundary] trying again says it again, and reports it ONCE', async () => {
    const b = bench({ loadRuntime: async () => ({ ok: false, missing: ['comandos:pt:modelo'] }) });
    await b.control.apply(true);
    await b.control.apply(true);
    expect(b.log.alerted).toHaveLength(2);
    expect(b.log.reported).toHaveLength(1);
  });
});

describe('ui/voice-control — nothing keeps listening after she turns it off', () => {
  it('🔴 [Right] turning it off stops the listener', async () => {
    const b = bench();
    await b.control.apply(true);
    await b.control.apply(false);
    expect(b.log.stopped).toBe(1);
  });

  it('⚠️ [Right] a word heard after it stopped presses nothing — the reader went with the listener', async () => {
    const b = bench();
    await b.control.apply(true);
    await b.control.apply(false);
    b.hear('acima');
    expect(b.log.pressed).toEqual([]);
  });

  /*
   * 🔴 TURNED OFF WHILE IT WAS STARTING, and this is the case the whole guard exists for: opening a microphone is not
   * instantaneous, so the child can let go of the icon before the listener arrives. Without the check the listener lands into a
   * control that is already off and goes on hearing her — an open microphone nobody asked for.
   */
  it('🔴 [Zero] turned off WHILE starting: the listener that arrives is stopped, and «ready» is never said', async () => {
    let arrive;
    const b = bench({ listen: () => new Promise((r) => { arrive = r; }) });
    const starting = b.control.apply(true);
    await b.control.apply(false);
    arrive(b.listener);
    await starting;
    expect(b.log.stopped, 'the microphone stayed open after she turned it off').toBe(1);
    expect(b.log.said, 'it announced itself ready to a child who had already turned it off').toEqual([]);
  });

  it('⚠️ [Boundary] two presses while it starts do not open TWO microphones', async () => {
    let arrive, asked = 0;
    const b = bench({ listen: () => { asked += 1; return new Promise((r) => { arrive = r; }); } });
    const first = b.control.apply(true);
    const second = b.control.apply(true);
    await new Promise((r) => { setTimeout(r, 0); }); // the runtime resolves first; only then is the microphone asked for
    arrive(b.listener);
    await Promise.all([first, second]);
    expect(asked, 'a second press opened a second microphone while the first was still starting').toBe(1);
  });

  it('⚠️ [Zero] turning off what never started does not stop anything and does not throw', async () => {
    const b = bench();
    await expect(b.control.apply(false)).resolves.toBeUndefined();
    expect(b.log.stopped).toBe(0);
    expect(b.log.loads).toBe(0);
  });
});
