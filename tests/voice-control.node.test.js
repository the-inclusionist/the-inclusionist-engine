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
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { voiceGrammar } from '../app/js/input/voice-map.js';
import pt from '../app/js/i18n/pt.js';
import { loadVoskRuntime, createBundleLoader } from '../app/js/platform/vosk-runtime.js';

/** A fake recogniser bundle: the control never touches it, it only hands it to the listener. */
const MODEL = { KaldiRecognizer: function () { /* never built here */ } };

/**
 * The bench. Every dependency of the control is a double that RECORDS, so a case can ask what reached the outside world —
 * which is the only thing a wiring has to answer for.
 */
function bench(over = {}) {
  const log = {
    pressed: [], released: [], said: [], alerted: [], reported: [], grammars: [], pointed: [], stopped: 0, loads: 0, listens: 0, off: 0,
  };
  let timers = [];
  let onPartial = null, onFinal = null;
  const listener = {
    setGrammar(g) { log.grammars.push([...g]); },
    async stop() { log.stopped += 1; },
  };
  const deps = {
    t: translate,
    base: 'https://school.example/game/',
    language: () => 'pt-BR',
    controller: {
      press: (a, source) => log.pressed.push([a, source]),
      release: (a, source) => log.released.push([a, source]),
    },
    menuWords: () => [],
    // the root's menu navigation (`ui/menu-nav.pointAt`): records where the cursor was put, and finds the item only by the
    // exact name the menu showed
    pointAt: (name) => { log.pointed.push(name); return deps.menuWords().includes(name); },
    say: (s) => log.said.push(s),
    alert: (s) => log.alerted.push(s),
    report: (s) => log.reported.push(s),
    turnOff: () => { log.off += 1; },
    after: (fn, ms) => { timers.push([fn, ms]); },
    // the browser the root lends (ADR-0232 D4): never called here, only handed on — the doubles below record what reaches them
    hasFile: async () => true,
    loadBundle: async () => ({ createModel: async () => MODEL }),
    getUserMedia: async () => ({ getTracks: () => [] }),
    createContext: () => ({}),
    loadRuntime: async (d) => { log.loads += 1; log.lastLoad = d; return { ok: true, model: MODEL }; },
    listen: async (d) => { log.listens += 1; log.lastListen = d; onPartial = d.onPartial; onFinal = d.onFinal; return listener; },
    ...over,
  };
  return {
    log, listener, deps,
    control: createVoiceControl(deps),
    /** The recogniser heard something — the same call the microphone makes. */
    hear: (text) => onPartial?.(text),
    /** The utterance ended, with the recogniser's last word on it (`platform/voice-listener`). */
    endOfSentence: (text = '') => onFinal?.(text),
    /** Time passes: every pulse that was due fires. */
    tick: () => { const due = timers; timers = []; for (const [fn] of due) fn(); },
    pulses: () => timers.map(([, ms]) => ms),
  };
}

describe('ui/voice-control — a word becomes a press on the virtual controller', () => {
  // 🔴 ADR-0232 D4: the cache, the bundle's loader, the microphone and the audio context are the ROOT's, handed on untouched.
  it('🔴 [Right] the recogniser\'s loader and the listener receive the browser the root lent, not a global', async () => {
    const b = bench();
    await b.control.apply(true);
    expect(b.log.lastLoad.hasFile, 'the loader asks another cache than the lent one').toBe(b.deps.hasFile);
    expect(b.log.lastLoad.loadBundle, 'the bundle is loaded by another loader than the lent one').toBe(b.deps.loadBundle);
    expect(b.log.lastListen.getUserMedia, 'the listener opens another microphone than the lent one').toBe(b.deps.getUserMedia);
    expect(b.log.lastListen.createContext, 'the listener builds another audio context than the lent one').toBe(b.deps.createContext);
  });

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

  it('📌 [Boundary] a menu change that changes no name does not rebuild the recogniser', async () => {
    const b = bench({ menuWords: () => ['Acessibilidade visual'] });
    await b.control.apply(true);
    b.control.refreshGrammar();
    b.control.refreshGrammar();
    expect(b.log.grammars, 'the same grammar was handed on again — a new recogniser each time').toEqual([]);
  });
});

/* ===================== AN ITEM SAID BY NAME IS ACTIVATED (ADR-0194 §2–§3) ===================== */
// 🎯 THE PATH, and why it is the one tested: the name puts the menu navigation's cursor on the item (`pointAt`), and the
// confirm position is pressed on the virtual controller stamped `fala` — the same press a child who says «confirma» makes, so
// the item is activated by the menu's own «yes», with its own spoken feedback. There is no second, voice-only click.
describe('ui/voice-control — a name heard activates its item', () => {
  const MENU = ['Voltar ao jogo', 'Configurações de inclusão', 'Voltar'];
  const withMenu = async (over = {}) => {
    let menu = [];
    const b = bench({ menuWords: () => menu, ...over });
    await b.control.apply(true);
    menu = MENU; // a menu opens after the microphone did — the root's observer refreshes
    b.control.refreshGrammar();
    return { ...b, closeMenu: () => { menu = []; b.control.refreshGrammar(); } };
  };

  it('🔴 [Right] a whole name puts the cursor on THAT item and presses the menu\'s confirm, stamped `fala`', async () => {
    const b = await withMenu();
    b.hear('configurações de inclusão');
    expect(b.log.pointed, 'the name never reached the menu navigation').toEqual(['Configurações de inclusão']);
    expect(b.log.pressed, 'the cursor moved and nothing confirmed it').toEqual([['action2', 'fala']]);
    b.tick();
    expect(b.log.released).toEqual([['action2', 'fala']]);
  });

  it('⚠️ [Boundary] «voltar» waits while «voltar ao jogo» may still be said; the end of the utterance decides', async () => {
    const b = await withMenu();
    b.hear('voltar');
    expect(b.log.pressed, '«voltar» fired before «voltar ao jogo» could be said').toEqual([]);
    b.hear('voltar ao jogo');
    expect(b.log.pointed).toEqual(['Voltar ao jogo']);
    expect(b.log.pressed).toEqual([['action2', 'fala']]);
    b.endOfSentence('voltar ao jogo');
    expect(b.log.pressed, 'the end of the utterance fired the name a second time').toHaveLength(1);

    b.hear('voltar');
    b.endOfSentence('voltar');
    expect(b.log.pointed, 'an utterance that ended on «voltar» never reached its item').toEqual(['Voltar ao jogo', 'Voltar']);
    expect(b.log.pressed).toHaveLength(2);
  });

  it('🔴 [Right] with the menu open, direction words still press their positions', async () => {
    const b = await withMenu();
    b.hear('abaixo');
    expect(b.log.pressed).toEqual([['down', 'fala']]);
    expect(b.log.pointed, 'a direction word was taken for a name').toEqual([]);
  });

  it('⚠️ [Zero] a name whose item is gone confirms NOTHING — the cursor did not move, a confirm would hit another item', async () => {
    const b = await withMenu({ pointAt: (name) => { b.log.pointed.push(name); return false; } });
    b.hear('configurações de inclusão');
    expect(b.log.pointed).toEqual(['Configurações de inclusão']);
    expect(b.log.pressed, 'a confirm was pressed with the cursor wherever it was').toEqual([]);
  });

  it('[Zero] a name from a menu that closed is not a command any more', async () => {
    const b = await withMenu();
    b.closeMenu();
    b.hear('configurações de inclusão');
    expect(b.log.pointed).toEqual([]);
    expect(b.log.pressed).toEqual([]);
  });

  it('📌 [Boundary] a one-letter name stays out of the grammar — in a closed grammar every short noise lands on it', async () => {
    const b = bench({ menuWords: () => ['A', 'Acessibilidade visual'] });
    await b.control.apply(true);
    expect(b.log.lastListen.grammar).toContain('acessibilidade visual');
    expect(b.log.lastListen.grammar).not.toContain('a');
  });
});

/* ===================== A NAME THE MODEL CANNOT HEAR IS REPORTED (ADR-0194 §4, ADR-0169) ===================== */
// 🎯 Kaldi drops a grammar word its vocabulary lacks, in silence, inside the runtime's worker — the item goes mute for the
// child, who can still walk to it with the direction words. The adult reads it once in `problems`: the item and the word by
// name, what it costs, and the fix. The vocabulary here is the fake runtime's (`load.vocabulary`), as the real one reads it
// from the model's archive (`platform/vosk-vocabulary`).
describe('ui/voice-control — a menu name with a word the model lacks is reported', () => {
  const KNOWN = new Set(['configurações', 'de', 'inclusão', 'voltar', 'ao', 'jogo', 'acima', 'abaixo']);
  /** A bench whose runtime knows `words`, answered when `release()` is called (or at once), and whose menu a case can change. */
  const withVocabulary = async (words = KNOWN, { menu: first = [], held = false } = {}) => {
    let menu = first, release;
    const answer = held ? new Promise((r) => { release = () => r(words); }) : Promise.resolve(words);
    const b = bench({
      menuWords: () => menu,
      loadRuntime: async (d) => { b.log.loads += 1; b.log.lastLoad = d; return { ok: true, model: MODEL, vocabulary: () => answer }; },
    });
    await b.control.apply(true);
    if (!held) { await answer; await Promise.resolve(); }
    return { ...b, show: (names) => { menu = names; b.control.refreshGrammar(); }, release: async () => { release(); await answer; await Promise.resolve(); } };
  };

  it('🔴 [Right] one line, in English, naming the item, the word, the cost for the child and the fix', async () => {
    const b = await withVocabulary();
    b.show(['Voltar ao jogo', 'Boreste']);
    expect(b.log.reported, 'the unsayable name went unreported').toHaveLength(1);
    const line = b.log.reported[0];
    expect(line, 'the line does not name the item').toContain('"Boreste"');
    expect(line, 'the line does not name the word the model lacks').toContain('"boreste"');
    expect(line, 'the line does not say what it costs the child').toMatch(/cannot choose this item by saying its name/);
    expect(line, 'the line does not give the fix').toMatch(/reword the item's label in the pt-BR dictionary/);
    expect(line).toMatch(/ADR-0194/);
  });

  it('🔴 [Right] only the words the model lacks are named — and accents are the model\'s spelling, not noise', async () => {
    const b = await withVocabulary();
    b.show(['Configurações de inclusão', 'Configuracoes do jogo']);
    expect(b.log.reported).toHaveLength(1);
    expect(b.log.reported[0]).toContain('"Configuracoes do jogo"');
    expect(b.log.reported[0], 'a word the model knows was named as missing').not.toContain('"jogo"');
    expect(b.log.reported[0]).toContain('"configuracoes", "do"');
  });

  it('⚠️ [Boundary] reported ONCE per item — a menu that opens again does not fill `problems` with the same line', async () => {
    const b = await withVocabulary();
    b.show(['Boreste']);
    b.show([]);
    b.show(['Boreste']);
    expect(b.log.reported).toHaveLength(1);
  });

  it('🔴 [Right] names already showing when the vocabulary arrives are checked then — it is read after the child can speak', async () => {
    const b = await withVocabulary(KNOWN, { menu: ['Boreste'], held: true });
    expect(b.log.said, 'the vocabulary delayed «ready»').toEqual([pt['sr.voice.ready']]);
    expect(b.log.reported).toEqual([]);
    await b.release();
    expect(b.log.reported, 'the name on screen when the words arrived was never checked').toHaveLength(1);
    expect(b.log.reported[0]).toContain('"Boreste"');
  });

  it('🎯 [Zero] every word known: nothing is reported', async () => {
    const b = await withVocabulary();
    b.show(['Voltar ao jogo', 'Configurações de inclusão']);
    expect(b.log.reported).toEqual([]);
  });

  it('🎯 [Zero] a vocabulary that cannot be read (null), or a runtime with none: nothing is reported — no line beats a false one', async () => {
    const unknown = await withVocabulary(null);
    unknown.show(['Boreste']);
    expect(unknown.log.reported).toEqual([]);
    let menu = [];
    const none = bench({ menuWords: () => menu });
    await none.control.apply(true);
    menu = ['Boreste'];
    none.control.refreshGrammar();
    expect(none.log.reported).toEqual([]);
  });

  it('⚠️ [Boundary] the words of a recogniser already replaced are dropped — a late pt vocabulary does not judge es names', async () => {
    let lang = 'pt-BR', release;
    const late = new Promise((r) => { release = () => r(new Set(['voltar'])); });
    const b = bench({
      language: () => lang,
      menuWords: () => ['Volver al juego'],
      loadRuntime: async (d) => {
        b.log.loads += 1; b.log.lastLoad = d;
        return { ok: true, model: MODEL, vocabulary: () => (d.language === 'pt-BR' ? late : Promise.resolve(null)) };
      },
    });
    await b.control.apply(true);
    lang = 'es-MX';
    await b.control.languageChanged();
    release();
    await late;
    await Promise.resolve();
    expect(b.log.reported, 'the old model\'s words reported the new language\'s names').toEqual([]);
  });

  it('🔴 [Right] the runtime is handed the fetch the root lent — it is how the real vocabulary is read', async () => {
    const fetch = async () => ({ ok: false, body: null });
    const b = bench({ fetch });
    await b.control.apply(true);
    expect(b.log.lastLoad.fetch, 'the runtime reads the archive with another fetch than the lent one').toBe(fetch);
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
   * 🔴 THIS CASE WAS WRITTEN BY THE BROWSER, on 2026-09-21, and it is the one the first version of this module did not have: the
   * delivery's bundle turned out to be an ES module, `loadVoskRuntime` THREW, nothing caught it — the rejection died as an
   * unhandled promise and the 👄 stayed lit over a microphone that had never opened. Sixteen mutations were red and none of them
   * could see this, because every double answered instead of throwing. A failure with no name is still one the child is told about.
   */
  it('🔴 [Zero] the recogniser THROWS on the way up: said, reported, and back to off — never a lit icon over silence', async () => {
    const b = bench({ loadRuntime: async () => { throw new Error('the delivery has the wrong file'); } });
    await b.control.apply(true);
    expect(b.log.alerted).toEqual([pt['sr.voice.failed']]);
    expect(b.log.off, 'the 👄 stayed on over a recogniser that never opened').toBe(1);
    expect(b.log.listens, 'a microphone was opened after the recogniser failed').toBe(0);
    expect(b.log.reported[0], 'the line does not carry what actually broke').toContain('the delivery has the wrong file');
  });

  /*
   * 🎯 THE SAME FAILURE THROUGH THE REAL LOADER, checked on 2026-09-25 when the 📷 was found swallowing it: a server that sends
   * `.mjs` as `text/plain`, or a runtime address that answers 404, makes the ROOT's `import()` reject. The case above proves the
   * control catches a loader that throws; this one proves the loader the root builds — `createBundleLoader` over `import`, then
   * `loadVoskRuntime` — does throw it up instead of swallowing it or hanging, so the 👄 already had the path the 📷 lacked.
   */
  it('🔴 [Error] the runtime import REJECTS (text/plain, 404) through the real loader: said, reported, back to off', async () => {
    const failing = createBundleLoader(async (u) => { throw new TypeError(`Failed to fetch dynamically imported module: ${u}`); });
    const b = bench({ loadBundle: failing, loadRuntime: (deps) => loadVoskRuntime(deps) });
    await expect(b.control.apply(true)).resolves.toBeUndefined();
    expect(b.log.alerted).toEqual([pt['sr.voice.failed']]);
    expect(b.log.off).toBe(1);
    expect(b.log.listens, 'a microphone was opened after the recogniser failed').toBe(0);
    expect(b.log.reported).toHaveLength(1);
    expect(b.log.reported[0]).toMatch(/^voice control: the recogniser did not open \(Failed to fetch dynamically imported module: .+vosk/);
  });

  /*
   * 🔴 A START THAT FAILS AFTER THE 👄 WAS TURNED OFF (or the root was disposed, which turns it off) says nothing and writes
   * nothing: nobody is waiting for it any more, and turning the icon "off" again would store off over a choice the child — or
   * another root on the page — may have made since. Found when `dispose()` started switching voice off (ADR-0220).
   */
  it('🔴 [Boundary] a start that fails AFTER it was turned off stays silent and does not write off again', async () => {
    let fail;
    const b = bench({ loadRuntime: () => new Promise((_, reject) => { fail = reject; }) });
    const going = b.control.apply(true);
    await b.control.apply(false);
    fail(new Error('the delivery has the wrong file'));
    await going;
    expect(b.log.off, 'a failure nobody waits for turned the 👄 off again').toBe(0);
    expect(b.log.alerted, 'a failure nobody waits for was announced to the child').toEqual([]);
  });

  it('⚠️ [Boundary] and it never reaches the caller as a rejection — `createGame` calls `apply` with `void`', async () => {
    const b = bench({ loadRuntime: async () => { throw new Error('boom'); } });
    await expect(b.control.apply(true)).resolves.toBeUndefined();
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

/* ===================== THE LANGUAGE CHANGED (ADR-0225) ===================== */
// 🔴 The recogniser used to choose its language ONCE, when the 👄 was switched on. A child who changed language while
// listening went on being heard in the old one — and that is worse than being heard by nobody, because the grammar DOES
// follow the open menu (ADR-0194), so the new language's words were fed to the old language's model and a closed grammar
// answers with the nearest candidate. Measured in the lab on 2026-09-14: «configurações de inclusão» came back as «quatro».
describe('the language changed', () => {
  /** A bench whose language a case can change, the way the icon bar's flag button does. */
  const benchWithLanguage = (first, over = {}) => {
    let lang = first;
    const b = bench({ language: () => lang, ...over });
    return { ...b, setLanguage: (l) => { lang = l; } };
  };

  it('🔴 [Right] while it is LISTENING, the model and the vocabulary are chosen again', async () => {
    const b = benchWithLanguage('pt-BR');
    await b.control.apply(true);
    expect(b.log.lastLoad.language, 'it did not open the language it booted in').toBe('pt-BR');
    b.setLanguage('es-MX');
    await b.control.languageChanged();
    expect(b.log.loads, 'the recogniser was not opened again for the new language').toBe(2);
    expect(b.log.lastLoad.language, 'it went on listening in the old language').toBe('es-MX');
    expect(b.log.stopped, 'the old recogniser was left running underneath the new one').toBe(1);
    expect(b.log.listens).toBe(2);
  });

  it('🔴 [Right] and the GRAMMAR that reaches the microphone is the new language\'s', async () => {
    // 📌 It is the half that made the defect worse than stopping: the words followed and the model did not.
    const b = benchWithLanguage('pt-BR');
    await b.control.apply(true);
    b.setLanguage('en-US');
    await b.control.languageChanged();
    expect(b.log.lastListen.grammar, 'the new model was fed the old language\'s words')
      .toEqual([...voiceGrammar('en-US', [])]);
  });

  it('🎯 [Zero] while it is OFF there is nothing to do — the next start already reads the new language', async () => {
    const b = benchWithLanguage('pt-BR');
    b.setLanguage('es-MX');
    await b.control.languageChanged();
    expect(b.log.loads, 'a recogniser nobody asked for was opened by a language change').toBe(0);
    expect(b.log.stopped).toBe(0);
    await b.control.apply(true);
    expect(b.log.lastLoad.language, 'the start after the change read the old language').toBe('es-MX');
  });

  it('🔴 [Zero] a language whose model is NOT in the delivery is SAID, and the icon goes back to off', async () => {
    // ⚠️ ADR-0169, and this is the path a change reaches: a delivery whose `--commands` list left a language out never carries
    // its model, so a child who switches to it may be asking for a model that never arrived. A microphone listening in the
    // wrong language would be the silent answer; this is the loud one.
    let lang = 'pt-BR';
    const b = bench({
      language: () => lang,
      loadRuntime: async (d) => { b.log.loads += 1; b.log.lastLoad = d; return d.language === 'pt-BR' ? { ok: true, model: MODEL } : { ok: false, missing: ['vosk-model-small-es'] }; },
    });
    await b.control.apply(true);
    expect(b.log.reported).toEqual([]);
    lang = 'es-MX';
    await b.control.languageChanged();
    expect(b.log.reported, 'the missing model was not said anywhere').toHaveLength(1);
    expect(b.log.reported[0]).toMatch(/vosk-model-small-es/);
    expect(b.log.off, 'the 👄 stayed lit over a recogniser that never opened').toBe(1);
    expect(b.log.listens, 'a microphone was opened for a model that is not there').toBe(1);
  });

  /*
   * 🔴 THE LINE NAMES THE FIX FOR THE LANGUAGE THE CHILD SWITCHED TO (ADR-0225 and its erratum, ADR-0169). The delivery carries
   * every language unless a `--commands` list narrowed it, so a model missing after a switch is one that list left out — and a
   * line that only said «open the game once online» sent the adult after a download that cannot happen. The fix it names is
   * both halves of the flag: the default (no `--commands`), or that language in the list — `--commands <lang>` ALONE would
   * narrow the delivery to it and drop the language the school had. The reading's line names `--reading <language>` the same way.
   */
  const switchedTo = (models) => {
    let lang = 'pt-BR';
    const b = bench({
      language: () => lang,
      loadRuntime: async (d) => {
        b.log.loads += 1; b.log.lastLoad = d;
        const base = d.language.split('-')[0];
        return models.includes(base) ? { ok: true, model: MODEL } : { ok: false, missing: [`commands:model:${base}`] };
      },
    });
    return { ...b, setLanguage: (l) => { lang = l; } };
  };

  it('🔴 [Right] the missing model\'s line names `--commands` for THAT language — the delivery is what lacks it', async () => {
    const b = switchedTo(['pt']);
    await b.control.apply(true);
    b.setLanguage('es-MX');
    await b.control.languageChanged();
    expect(b.log.reported, 'the missing model was not said anywhere').toHaveLength(1);
    expect(b.log.reported[0], 'the line does not say how to put this language\'s model in the delivery')
      .toContain('`npx inclusionist-heavy` without `--commands`');
    expect(b.log.reported[0], 'the line does not name this language in the flag\'s list').toContain('`--commands es` in its list');
    expect(b.log.reported[0], 'the line does not name the language the child switched to').toContain('es-MX');
    expect(b.log.alerted, 'the child was not told why the 👄 went off').toEqual([pt['sr.voice.needsInternet']]);
  });

  it('🔴 [Right] a SECOND language whose model is absent gets a line of its own — the first one named another language', async () => {
    // ⚠️ `problems` is still written once per cause: the same language failing twice is one line (the case above, «trying
    // again»). A different language is a different missing file, and a different fix.
    const b = switchedTo(['pt']);
    await b.control.apply(true);
    b.setLanguage('en-US');
    await b.control.languageChanged();
    await b.control.apply(true);
    b.setLanguage('es-MX');
    await b.control.languageChanged();
    await b.control.apply(true);
    expect(b.log.reported, 'the second language\'s missing model was swallowed by the first one\'s line').toHaveLength(2);
    expect(b.log.reported[0]).toContain('--commands en');
    expect(b.log.reported[1]).toContain('commands:model:es');
    expect(b.log.reported[1]).toContain('--commands es');
  });

  it('⚠️ [Boundary] a change WHILE IT IS STARTING replaces the start in flight, and does not race it', async () => {
    // 📌 The start in flight is in the OLD language. Letting it finish and replacing it costs one opening; skipping the
    // wait would let it install the old model on top of the new one.
    let arrive;
    let lang = 'pt-BR';
    // 📌 Only the FIRST opening is left hanging: it is the one in flight when the language changes. The second answers at
    // once, or the case would measure the double not answering instead of the controller replacing the start.
    const b = bench({
      language: () => lang,
      listen: (d) => {
        b.log.listens += 1; b.log.lastListen = d;
        if (b.log.listens > 1) return Promise.resolve(b.listener);
        return new Promise((r) => { arrive = r; });
      },
    });
    const starting = b.control.apply(true);
    await new Promise((r) => { setTimeout(r, 0); });
    lang = 'es-MX';
    const changed = b.control.languageChanged();
    arrive(b.listener);
    await Promise.all([starting, changed]);
    expect(b.log.lastLoad.language, 'the old language won the race').toBe('es-MX');
    expect(b.log.stopped, 'the start in flight was left listening underneath').toBe(1);
  });
});

// ============================== MUTATIONS CHECKED (2026-09-25, ADR-0194 §2–§3) ==============================
//   W5  a name moves the cursor and nothing confirms it                     🔴 a whole name … presses the menu's confirm; «voltar» waits
//   W7  the end of the utterance is not read (`onFinal` ignores its text)    🔴 the end of a sentence resets; «voltar» waits
//   W8  an unchanged grammar is handed on again                             🔴 a menu change that changes no name
//   W9  one-letter names enter the grammar                                  🔴 a one-letter name stays out
//   W11 an item command answers with the spoken form, not the shown name   🔴 a whole name …; «voltar» waits (and voice-map)
//   W12 the confirm position is another one (`MENU_CONFIRM = 'action1'`)    🔴 a whole name …; «voltar» waits
//   W13 position commands dropped                                           🔴 a word heard PRESSES …; a partial that GROWS …
// ADR-0194 §4 (2026-09-25):
//   C1 a menu change does not check its names                               🔴 one line …; only the words …; reported ONCE
//   C2 the same item reported on every opening                              🔴 reported ONCE per item
//   C3 names showing when the vocabulary arrives are not checked            🔴 names already showing …
//   C4 a replaced recogniser's vocabulary is kept                           🔴 the words of a recogniser already replaced
//   C5 names compared without their accents                                 🔴 only the words …; every word known
//   C6 the lent fetch not handed to the runtime                             🔴 the runtime is handed the fetch
//   C8 an unknown vocabulary taken as an empty one                          🔴 names already showing; a vocabulary that cannot be read; replaced
// The runtime import that rejects (2026-09-25, when the 📷 was found swallowing it — this file was already green):
//   R1 the control rethrows the loader's rejection instead of catching it     🔴 THROWS on the way up; REJECTS through the real loader;
//                                                                              fails AFTER it was turned off; never reaches the caller
//   R2 `loadVoskRuntime` HANGS on a rejected import instead of rejecting      🔴 REJECTS through the real loader — and only it: the case
//                                                                              before it injects a loader that throws by itself
