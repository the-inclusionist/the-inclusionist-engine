// SPDX-License-Identifier: AGPL-3.0-or-later
// A ROOT THAT WAS DISPOSED STOPS LISTENING — AND ONE THAT WAS ONLY UNMOUNTED DOES NOT.
//
// 🔴 THE DEFECT THIS EXISTS FOR, AND IT WAS FOUND BY A TEST THAT CHANGED ANSWER DEPENDING ON ITS NEIGHBOURS. Adding a case to
// `boot-create-game.browser.test.js` moved the pause cursor of a case written days earlier: «a locked item SAYS WHY» counts
// ArrowDown presses, and with one more root opened before it the six presses ended somewhere else. A case whose result depends on
// its neighbours does not measure what it says.
//
// 📏 THE CAUSE, MEASURED IN THIS BROWSER WITH THE REAL ENGINE, before a line was written: one ArrowDown moved the cursor ONE item
// with one root, TWO with a second root alive, THREE with a third. `createGame` installs ~30 listeners on the window — the five
// of `ui/menu-nav.attach()` among them — and nothing ever took them off. Removing the host element from the document does not
// silence a root: every query it makes is document-wide (`getPauseMenu` is `doc.querySelector('#vp-pause-0')`), so the dead root
// finds THE LIVE ROOT'S card and navigates it too. And `stopPropagation()` cannot help, because all of them sit on the same node
// in the same phase — siblings there are only stopped by `stopImmediatePropagation()`, which would mean the first root ever built
// silences all the others.
//
// 🔴 AND THE SECOND CASE IS WHY THE CURE IS NOT IN `unmount()`, which is where it first looks like it belongs. `unmount()`
// releases the CURRENT CARTRIDGE (ADR-0142) and a `mount()` after it must find a root that still hears the keyboard. Take the
// listeners off there and the child who swapped cartridges has no keyboard, which is a worse defect than the one being cured —
// and one that no case in the tree would have caught.
//
// MUTATIONS CONFIRMED at the end of the file.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import rootSource from '../app/js/boot/create-game.ts?raw';
import { createSettingsStore } from '../app/js/core/state.js';
import { filePort } from './fixtures/file-storage.js';

let createGame;

function montarHospedeiro() {
  const raiz = document.createElement('div');
  raiz.id = 'raiz-de-teste';
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  return raiz;
}

const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  holdsKeys: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'primeira pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

describe('o tempo de vida de uma raiz', () => {
  let raiz;
  const vivos = [];

  const abrir = () => {
    const motor = createGame({
      accommodations: SEM_ASSUNTO, declaration: declaracaoValida(),
      host: { doc: document, win: window }, downloadHeavy: false,
    });
    vivos.push(motor);
    return motor;
  };

  /** One arrow down, along the path the child sends it: the game region, bubbling up to the window. */
  const seta = () => {
    const regiao = document.getElementById('game-region') ?? document.body;
    regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true, cancelable: true }));
  };

  /** How many items the cursor moved with ONE arrow, on the open pause card. */
  const passosDeUmaSeta = (motor) => {
    motor.pause.show(0);
    const cartao = document.querySelector('#vp-pause-0');
    const itens = [...cartao.querySelectorAll('.pause-menu[data-sub="raiz"] .pm-btn:not([hidden])')];
    const antes = itens.indexOf(cartao.querySelector('.pm-sel'));
    seta();
    const depois = itens.indexOf(cartao.querySelector('.pm-sel'));
    motor.pause.hide(0);
    return depois - antes;
  };

  beforeEach(async () => {
    if (!createGame) ({ createGame } = await import('../app/js/boot/create-game.js'));
    raiz = montarHospedeiro();
  });

  afterEach(() => {
    for (const m of vivos.splice(0)) m.dispose?.();
    raiz.remove();
    document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
  });

  it('🔴 [Right] uma raiz encerrada não mexe mais no cursor da raiz seguinte', () => {
    // The root that ended: `dispose()` is its end, and its document leaves as it would on a real page.
    const velha = abrir();
    velha.dispose();

    expect(passosDeUmaSeta(abrir()), 'uma seta para baixo andou mais de um item — há outra raiz a navegar o mesmo cartão').toBe(1);
  });

  it('🔴 [Right] e com DUAS raízes encerradas continua a andar um item só', () => {
    // Two, because one does not tell ending the right root from ending any root: with the defect, the number of steps
    // IS the count of live roots, and the third measurement is what shows it growing.
    abrir().dispose();
    abrir().dispose();

    expect(passosDeUmaSeta(abrir()), 'cada raiz por encerrar soma um passo à seta').toBe(1);
  });

  it('🔴 [Right] mas `unmount()` NÃO cala a raiz — ela volta do `mount()` com teclado', () => {
    // ⚠️ THIS IS THE CASE THAT PREVENTS THE WRONG FIX. `unmount()` releases the CARTRIDGE (ADR-0142), not the root: an engine
    // that dropped the listeners here would leave a child who changes cartridge with no keyboard at all, and nothing else in
    // the tree would see it.
    const motor = abrir();
    motor.unmount();
    // ⚠️ The hooks go here, and they are not optional as the interface says: `mount` reads `hooks.preset` with no guard, so
    // `mount(declaration)` throws a `TypeError` instead of the engine's own sentence. Reported to the Dev; not this fix's.
    motor.mount(declaracaoValida(), { accommodations: SEM_ASSUNTO });

    expect(passosDeUmaSeta(motor), 'depois de `unmount()` + `mount()` a raiz deixou de ouvir a seta').toBe(1);
  });

  it('⚠️ [Boundary] encerrar duas vezes não estoura e não desfaz nada de quem está vivo', () => {
    const velha = abrir();
    velha.dispose();
    velha.dispose();

    expect(passosDeUmaSeta(abrir()), 'o segundo `dispose()` estragou a raiz viva').toBe(1);
  });
});

/*
 * 🔴 AND THE STATE BUS, WHICH THE WINDOW'S SCOPE NEVER SAW (ADR-0220). `core/state` keeps its subscribers in one map for the
 * whole page, so a root that subscribed with `state.on(...)` stayed subscribed after `dispose()`: with the stored 👄 switched on,
 * the ended root started a recogniser of its own, failed, and turned the key OFF — which is how it was found, in
 * `boot-create-game.browser.test.js`, turning the key off before the live root had written its line.
 *
 * 📌 EVERY OBSERVATION HERE IS THE ENDED ROOT'S OWN: its bar, its `problems`, its `onLocaleChange`, or a page attribute that only
 * a subscriber writes while no root is alive. The cases open no live root beside it, so nothing measured depends on a neighbour.
 */
describe('a disposed root stops hearing the state bus — and an unmounted one does not', () => {
  let host;
  let state;
  let i18n;
  const alive = [];

  const open = () => {
    const root = createGame({
      accommodations: SEM_ASSUNTO, declaration: declaracaoValida(),
      host: { doc: document, win: window }, downloadHeavy: false,
    });
    alive.push(root);
    state = root.settings; // the ROOT's store: a write here is the child's, heard only through this root's door (ADR-0232 D4)
    return root;
  };
  /** The keys these cases turn on, cleared in this file's storage so each root is born with them off. */
  const KEYS_TURNED_ON = ['incl_voice_control', 'incl_cbsafe', 'incl_switch_scan'];
  const icon = (name) => document.querySelector(`#title-icons [data-pi="${name}"]`);
  const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

  beforeEach(async () => {
    if (!createGame) ({ createGame } = await import('../app/js/boot/create-game.js'));
    // the PAGE's language, switched by a translator that is not the ended root's — every root follows the page (ADR-0232 D3)
    i18n ??= (await import('./fixtures/page-locale.js')).pageTranslator();
    for (const k of KEYS_TURNED_ON) localStorage.removeItem(k);
    host = montarHospedeiro();
  });

  afterEach(() => {
    for (const r of alive.splice(0)) r.dispose?.();
    for (const k of KEYS_TURNED_ON) localStorage.removeItem(k);
    host.remove();
    document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
  });

  it('🔴 [Right] the stored 👄 switched on does not wake a disposed root: its icon, its key and its `problems` stay still', async () => {
    const ended = open();
    ended.dispose();
    expect(icon('voice').getAttribute('aria-pressed')).toBe('false');

    state.setVoiceControlValue(true);
    expect(icon('voice').getAttribute('aria-pressed'), 'the ended root redrew its 👄 — it still hears `voiceControl`').toBe('false');
    // Long enough for a live root to fail and turn the key off (the unmount case below measures that path).
    await wait(600);
    expect(state.voiceControl, 'the ended root started a recogniser, failed, and turned the key off').toBe(true);
    expect(ended.problems.some((p) => p.startsWith('voice control:')), 'the ended root wrote a voice line in its `problems`').toBe(false);
  });

  it('🔴 [Right] nor do blind mode, the safe palette, the letter case or the one-button scan', () => {
    const ended = open();
    ended.dispose();
    const root = document.documentElement;
    const blindBefore = icon('blind').getAttribute('aria-pressed');
    const lettersBefore = root.dataset.letras;
    const chip = host.querySelector('.scan-now');
    const blind = state.blindMode;
    const letters = state.letterCase;
    try {
      state.setBlindModeValue(!blind);
      state.setCbSafeValue(true);
      state.setLetterCaseValue(letters === 'upper' ? 'mixed' : 'upper');
      state.setSwitchScanValue(true);

      expect(icon('blind').getAttribute('aria-pressed'), 'the ended root redrew its blind-mode icon').toBe(blindBefore);
      expect(root.dataset.paleta, 'the ended root wrote the safe palette on the page').toBeUndefined();
      expect(root.dataset.letras, 'the ended root wrote the letter case on the page').toBe(lettersBefore);
      expect(chip, 'the root mounts no scan chip — this case would measure nothing').not.toBeNull();
      expect(chip.hidden, 'the ended root started the one-button scan and shows its chip').toBe(true);
    } finally {
      state.setBlindModeValue(blind);
      state.setLetterCaseValue(letters);
      if (lettersBefore === undefined) delete root.dataset.letras; else root.dataset.letras = lettersBefore;
    }
  });

  it('🔴 [Right] nor does the hearing panel: its blind-mode row stays as the ended root left it (ADR-0220; ADR-0232 D2c)', () => {
    // `ui/settings-audio` subscribed to `blindMode` on the page's bus by import, underneath the root's door: the panel of an
    // ended root went on redrawing its row. It now subscribes through the door its ctx hands it — the root's `stateOn`.
    const ended = open();
    const row = host.ownerDocument.querySelector('#opt-modocego');
    expect(row, 'the root mounts no hearing panel — this case would measure nothing').not.toBeNull();
    ended.dispose();
    const before = row.getAttribute('aria-pressed');
    const blind = state.blindMode;
    try {
      state.setBlindModeValue(!blind);
      expect(row.getAttribute('aria-pressed'), 'the ended root\'s hearing panel redrew its blind-mode row').toBe(before);
    } finally {
      state.setBlindModeValue(blind);
    }
  });

  it('🔴 [Right] and what a subscription had STARTED ends too: a scan running at `dispose()` stops and takes its chip away', async () => {
    createSettingsStore(filePort).setSwitchScanValue(true); // the child chose the scan before this root was born
    const root = open();
    const chip = host.querySelector('.scan-now');
    expect(chip?.hidden, 'the scan did not start with the root — this case would measure nothing').toBe(false);
    root.dispose();
    expect(chip.hidden, 'the ended root left its scan chip on the page').toBe(true);
    // and its frame loop is gone: a frame later, nothing has drawn the chip back
    await new Promise((r) => { requestAnimationFrame(() => requestAnimationFrame(r)); });
    expect(chip.hidden, 'the ended root\'s scan loop is still drawing').toBe(true);
  });

  it('🔴 [Right] a language change does not reach a disposed root, nor the cartridge it had', async () => {
    const ended = open();
    let heard = 0;
    ended.onLocaleChange(() => { heard += 1; });
    ended.dispose();
    try {
      await i18n.setLocale('en');
      expect(heard, 'the ended root handed a language change to its cartridge').toBe(0);
    } finally {
      await i18n.setLocale('pt');
    }
  });

  it('🔴 [Right] but `unmount()` does NOT end the root: it goes on hearing the state bus', async () => {
    // ⚠️ THE CASE THAT PREVENTS THE WRONG FIX, as the arrow's case above: `unmount()` releases the CARTRIDGE (ADR-0142), and a
    // root that stopped hearing the state there would come back from the next `mount()` with a bar that lies.
    const root = open();
    root.unmount();

    state.setCbSafeValue(true);
    expect(document.documentElement.dataset.paleta, 'after `unmount()` the root stopped following the safe palette').toBe('okabe-ito');

    state.setVoiceControlValue(true);
    expect(icon('voice').getAttribute('aria-pressed'), 'after `unmount()` the root stopped following the 👄').toBe('true');
    // and the whole path is alive: no microphone here, so the root's recogniser fails and puts the key back to off
    for (let i = 0; i < 120 && state.voiceControl; i++) await wait(10);
    expect(state.voiceControl, 'after `unmount()` the root no longer answers `voiceControl`').toBe(false);
  });

  it('🎯 [Cross-check] the root subscribes to the state bus through ONE door, the one `dispose()` closes', () => {
    // The behaviour cases above cover the keys a test can see; this covers the ones it cannot (`inputCooldown`, `menuIndexOn`,
    // the camera's) and the next one somebody adds: a bare `state.on(` in the root outlives `dispose()`.
    const bare = rootSource.split('\n').filter((line) => /\bstate\.on\(/.test(line) && !/^\s*(\/\/|\*)/.test(line));
    expect(bare, 'a subscription that does not go through the root\'s seam').toHaveLength(1);
    expect(bare[0], 'the one `state.on(` left is not the seam').toMatch(/const off = state\.on\(/);
  });
});

/*
 * ========================= MUTATIONS CHECKED =========================
 * Run over THIS file and over `reading-no-createGame.browser.test.js`, which measures the half of the Proxy that is not
 * about listeners. This file's four cases are called 1, 2, 3 (the `unmount` one) and 4 (the [Boundary]) here.
 *
 * 1. `platform/listener-scope`: `releaseAll` removes nothing (it only empties the list) ........ all 4 RED
 *    — it is the defect itself: the ended root goes on navigating the live one's card.
 * 2. `platform/listener-scope`: `listen` does not keep the listener (the `push` goes) ........... all 4 RED
 *    — empty list, nothing to release; the same failure by another path.
 * 3. `boot/create-game`: `dispose` only calls `unmountAll()` (the `releaseAll` goes) ............ all 4 RED
 *    — proves that what silences the root is the listener scope, not the cartridge's teardown.
 * 4. `boot/create-game`: `unmountAll` also calls `listeners.releaseAll()` ....................... 1 RED, case 3
 *    — THE FIX IN THE WRONG PLACE, and the mutation that matters most: only the `unmount()` case catches it. Without it,
 *      silencing the root in the cartridge's teardown would be green across the tree and a child who changes cartridge
 *      would lose the keyboard.
 * 5. `platform/listener-scope`: the Proxy passes the PROXY as receiver to `Reflect.get` .......... all 7 RED
 *    — «Illegal invocation»: a window getter (`innerWidth`) does not run with the proxy as `this`.
 * 6. `platform/listener-scope`: the Proxy returns the raw function, with no `bind` or exception .. 6 RED
 *    — «Illegal invocation» again, now at the first `getComputedStyle`.
 * 7. `platform/listener-scope`: the Proxy binds EVERY function, constructors included ............ 2 RED, the reading ones
 *    — `bind` erases `prototype`, and `platform/speech-recognition` asks `'processLocally' in api.prototype` before opening
 *      the microphone. The suite found this: the child who reads aloud was left with no microphone at all.
 *
 * ⚠️ AND ONE SURVIVED FIRST, and it was inert code: `Reflect.get(real, prop, real)` passed the receiver the language
 * already uses by default inside a trap. The comment beside it claimed that line decided everything, and it decided
 * nothing. The argument went, and the mutation became the real one — passing the PROXY —, which is 5 above.
 *
 * ========================= AND THE STATE BUS (the second `describe`) =========================
 * Applied by script to `boot/create-game`, one at a time, each anchor counted to occur once; the file restored from a copy.
 * Before the fix, the 👄 case, the four-keys case and the cross-check were RED; the locale and `unmount()` cases were green.
 *
 *  8. `stateOn` keeps no release (the `whenDisposed(off)` goes) ................................. 2 RED, the 👄 and the four keys
 *  9. one subscription left bare, `state.on(` instead of `stateOn(` — tried for `cbSafe`, `letterCase`, `switchScan`, the bar's
 *     `blindMode`, the bar's `voiceControl` and the recogniser's `voiceControl` .................. 2 RED each: its behaviour case
 *     and the cross-check
 * 10. `whenDisposed(stopScan)` goes ........................................................... 1 RED, the running scan's case
 * 11. the releases run in `unmountAll` instead of `dispose` ................................... 1 RED, the `unmount()` case
 * 12. the root's language listener subscribed with `translator.onChange` bare, not through `localeOn` (ADR-0232 D3) — once
 *     `i18n:change` hung on `o.host.win` instead of the scoped window ................................ 1 RED, the locale case
 *     — the locale case was green before this fix: that listener already went through the scope. The mutation is what shows
 *       the case can see it leak.
 */
