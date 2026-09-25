// SPDX-License-Identifier: AGPL-3.0-or-later
// THE COMPOSITION ROOT AGAINST A REAL DOCUMENT (ADR-0106 step 2).
//
// ========================= WHY THIS FILE EXISTS =========================
// A sweep once found SIX defects in the mounting of the bar and the pause card, five of them introduced the same day the
// engine started mounting them. All five went through the same place: the `domFalso` of `boot-create-game.node.test.js`,
// which had to be patched THREE SEPARATE TIMES for being poorer than the real thing — first with no `innerHTML`, then
// with no `appendChild`, and finally with `HTMLElement` being a browser global that, read where it does not exist,
// THROWS instead of returning `false`.
//
// ⚠️ THAT IS NOT A CRITICISM OF THE DOUBLE: it is its definition. A double knows only what whoever wrote it knew, so it is
// strong exactly where logic decides and blind exactly where the DOM decides. The pattern is not fixed by patching the
// double a fourth time — it is fixed by having a real document where the mounting lives.
//
// 🎯 EACH CASE'S RULE HERE, and it is what keeps this file from being an expensive duplicate: **a case comes in only if
// `domFalso` COULD NOT do it.** Where the double already answers — the mixer's order, what goes into `problems`, declaring
// badly throwing —, node stays the right place: it runs in milliseconds and needs no browser. What stays here is what only
// a document knows: whether the markup PARSES, whether the element is really IN THE TREE, whether the keyboard can reach
// it, and whether a real click walks the whole path.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let createGame;
let repor;

/** The minimal document a game offers: the world's region and the host of the first screen's bar. */
function montarHospedeiro() {
  const raiz = document.createElement('div');
  raiz.id = 'raiz-de-teste';
  // ⚠️ THE TWO SCREEN-READER REGIONS: without `#sr-status` in the document, `srSay` finds nowhere to write and fails
  // silently — precisely the kind of defect it exists to avoid —, and the ANNOUNCEMENT would never be exercised here. A
  // host without them is not realistic either: the root's `REQUIRED_MARKUP` asks for both.
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  return raiz;
}

const declaracaoValida = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1', 'q2', 'q3'] }),
  holdsAtOnce: () => 1,
  // A hotspots fixture holds nothing — ADR-0115's pair, beside the number that does not say so.
  holdsKeys: () => false,
  tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal',
  nameAt: () => ({ text: 'primeira pergunta', gender: 'f', plural: false }),
  focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 3 }),
  targetsOf: () => [{ x: 0, y: 0 }],
});

/*
 * 🔴 THE ROOTS A CASE OPENS ARE ENDED AT ITS END, and that is not tidiness — it fixes a defect that made this file's cases
 * change result depending on their neighbours. A root installs ~30 listeners on the WINDOW and, until `dispose()` existed,
 * nothing took them off: removing the host from the document silences nobody, and since every search a root makes is
 * document-wide (`getPauseMenu` is `doc.querySelector('#vp-pause-0')`), the dead root went on navigating the LIVE root's
 * card. 📏 Measured in this browser: one arrow down moved one item with one root, TWO with two, THREE with three.
 * The mechanism's gate is `tests/a-disposed-root-stops-listening.browser.test.js`; only the consequence stays here.
 */
const raizesAbertas = [];
const abrir = (extra = {}) => {
  const motor = createGame({ accommodations: SEM_ASSUNTO,
    declaration: declaracaoValida(),
    host: { doc: document, win: window }, downloadHeavy: false,
    ...extra,
  });
  raizesAbertas.push(motor);
  return motor;
};

describe('createGame num documento de verdade', () => {
  let raiz;

  beforeEach(async () => {
    // `await import` and not static, for the same reason as the node file: the boot graph is big, and a broken module
    // must not bring down the whole collection before the first case runs.
    if (!createGame) ({ createGame } = await import('../app/js/boot/create-game.js'));
    // ⚠️ BLIND MODE IS MODULE STATE AND PERSISTS — in `core/state` and in storage. Without this reset, a case that turns it
    // on leaves the next one starting on, and the next one measures the opposite of what it says.
    if (!repor) ({ setBlindModeValue: repor } = await import('../app/js/core/state.js'));
    repor(false);
    raiz = montarHospedeiro();
  });

  afterEach(() => {
    // ⚠️ `dispose()` and not `unmount()`: the second releases the CARTRIDGE and leaves the root listening (ADR-0142), which
    // is exactly what piled up. See the note on `abrir`.
    for (const motor of raizesAbertas.splice(0)) motor.dispose();
    raiz.remove(); document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
  });

  it('⚠️ [Right] a marcação da barra PARSEIA — o duplo só sabia que uma string foi atribuída', () => {
    // ⚠️ `domFalso` keeps `innerHTML` as text. In a real document, assigning `innerHTML` PARSES the markup, and one that does
    // not close a tag produces ZERO elements — no error, no warning, and the double green. The child who depends on blind
    // mode opens the game and the bar is simply not there.
    abrir();
    const barra = document.querySelector('#title-icons');
    const botoes = barra.querySelectorAll('[data-pi]');
    expect(botoes.length, 'a barra montou marcação que o navegador não conseguiu ler').toBeGreaterThan(0);
    // and they are ELEMENTS in the tree, not text: each answers to the document that holds it
    expect(botoes[0].isConnected).toBe(true);
  });

  it('⚠️ [Right] os ícones da primeira tela são ALCANÇÁVEIS PELO TECLADO', () => {
    // ⚠️ IT IS STEP 2'S ARGUMENT TURNED ASSERTION, and no double reaches it. The mounting deliberately does NOT use
    // `buildQuickBar`, which sets `tabIndex = -1` because during play ten stops separate the child from the game. On the
    // FIRST screen nobody is playing, and taking the icons out of the tab order there would hide them from whoever
    // navigates by keyboard — exactly the person they exist for.
    abrir();
    const alvo = document.querySelector('#title-icons [data-pi]');
    expect(alvo.tabIndex, 'ícone fora da ordem de tabulação na tela onde ninguém está a jogar').toBeGreaterThanOrEqual(0);
    // and truly focus: `tabIndex` is a promise, `activeElement` is keeping it
    alvo.focus();
    expect(document.activeElement).toBe(alvo);
  });

  it('⚠️ [Right] o cartão de pausa é ENCONTRÁVEL pelo id que a própria engine procura', () => {
    // ⚠️ THIS IS THE FILE'S STRONGEST CASE, and the only one that truly closes the loop. The engine's `getPauseMenu` looks
    // for `#vp-pause-0` in the DOCUMENT. Setting `cartao.id = 'vp-pause-0'` satisfies any double — but a card with the
    // right id hung on a host DISCONNECTED from the tree is invisible to `querySelector`, and the engine would again
    // conclude, silently, that this game has no pause menu. Only a document knows the difference between having the id and
    // being there.
    abrir();
    expect(document.querySelector('#vp-pause-0'), 'a engine monta o cartão e depois não o encontra').not.toBeNull();
  });

  it('⚠️ [Right] MONTAR não é MOSTRAR, e `pausa.mostrar` mostra DE FACTO', () => {
    // The card is born hidden — a pause OPENS. The double can only see the `hidden` property change; here the layout is
    // asked, which is what the child consults.
    const motor = abrir();
    const cartao = document.querySelector('#vp-pause-0');
    expect(cartao.offsetParent, 'o cartão nasceu visível — uma pausa ABRE, não está sempre aberta').toBeNull();
    motor.pause.show(0);
    expect(cartao.hidden).toBe(false);
    expect(cartao.offsetParent, '`hidden` saiu mas o cartão continua sem ocupar espaço nenhum').not.toBeNull();
    motor.pause.hide(0);
    expect(cartao.offsetParent).toBeNull();
  });

  it('⚠️ [Right] um clique DE VERDADE num ícone percorre o caminho todo', () => {
    // ⚠️ The double records that `addEventListener` was called; it cannot fire the listener with an event that BUBBLES up
    // from a child, which is how a real click arrives. `iconAct` reads `e.target.closest(...)`, and a target that is not an
    // element — or a listener hung in the wrong place — fails only here.
    // 📌 THE ICON CHOSEN IS BLIND MODE on purpose: step 1b gave it to the engine by default (`setBlindModeValue`), so a
    // game that injects nothing must see it work — and that is exactly where the button once went mute. The path measured
    // is the whole one: real click → `iconAct` → the blind-mode writer → state event → `reflectIconsIn` → the DOM says the
    // new state.
    abrir();
    const barra = document.querySelector('#title-icons');
    const alvo = barra.querySelector('[data-pi="blind"]');
    expect(alvo, 'o modo cego não está na primeira tela').not.toBeNull();
    alvo.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // ⚠️ Re-read from the DOCUMENT and not the reference: reflecting may have REWRITTEN the bar, and a node kept from before
    // the click would be an orphan saying the old state.
    const depois = document.querySelector('#title-icons [data-pi="blind"]');
    expect(depois.getAttribute('aria-pressed'), 'o clique chegou mas o ícone não diz o estado novo').toBe('true');
  });

  // 🔴 THE ANNOUNCEMENT, which a check in a browser with a HIDDEN panel could not measure: `requestAnimationFrame` was frozen
  // (zero frames in 600 ms) and `srSay` writes inside one. An unchanged `#sr-status` was no proof of silence. Here the page
  // renders, and it can be measured.
  //
  // ⚠️ AND WHAT THIS CASE HOLDS IS THE ORDER, where the interesting defect lives: the announcement reads the `aria-label`
  // AFTER the reflection, because that carries the NEW state. Announcing before would tell the child the state she just
  // LEFT — and the button would lie to whoever only hears it: an output whose only destination is the screen reader has
  // nobody to notice when it lies.
  //
  // 📏 THE ICON IS `tea` AND NOT BLIND MODE, and the choice was MEASURED by a mutation that survived. With blind mode,
  // swapping the order changes nothing: `create-game` subscribes to `state.on('blindMode')` and the reflection has already
  // happened INSIDE `iconAct`, so the label read is the new one either way. That was equivalence, not coverage. `tea` has
  // no state subscription in the root, so it walks the path the icons without one take.
  it('🔴 [Zero] o clique ANUNCIA, e anuncia o estado NOVO — não o que a criança deixou', async () => {
    abrir();
    // 🔴 WAITING FOR THE LANGUAGE IS WHAT WAS MISSING, and CI showed it — green here, red there: `expected 'Modo TEA: calmo'
    // to be 'Autism mode: calm'`. This case compares TWO readings made at different instants — the announcement, composed
    // on the click, and the label, read after. `initI18n` applies pt synchronously and asks for en/es in ASYNCHRONOUS
    // chunks; on a slower runner the chunk lands BETWEEN the two, and the comparison measures the machine's clock instead
    // of the behaviour.
    //
    // ⚠️ IT IS A TEST THAT MEASURES THE MACHINE: it reproduces neither locally, alone nor paired; only on a runner with
    // another timing.
    //
    // 📌 WHAT IT UNCOVERS IN THE PRODUCT, said instead of fixed blindly: a child who presses the icon BEFORE the dictionary
    // lands hears the fallback language while the label has already changed. It is the same boundary as the bilingual bar
    // (`424ee36`), on the ANNOUNCEMENT's side instead of the label's — and there the answer was to repaint when the
    // language arrives (today the `i18n:change` listener). Here the announcement is composed once and not repainted.
    const { localeReady } = await import('../app/js/core/i18n.js');
    await localeReady();
    const alvo = document.querySelector('#title-icons [data-pi="tea"]');
    const rotuloAntes = alvo.getAttribute('aria-label');
    alvo.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // `srSay` clears and writes on the next frame (that is how it forces the reader to re-announce repeated text).
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const dito = document.querySelector('#sr-status').textContent;
    expect(dito.trim().length, 'o clique não anunciou nada a quem navega por ouvido').toBeGreaterThan(0);

    // ⚠️ THE ASSERTION IS EQUALITY WITH THE LABEL: `toContain('ligado')` would be EXACTLY the defect this case exists to
    // catch, committed inside it — `desligado` CONTAINS `ligado`. The mutation that swaps the order survived because of
    // that and only that. Equality with the post-click label catches all three: no announcement, announcement before the
    // reflection, and an announcement of the internal id.
    const rotulo = document.querySelector('#title-icons [data-pi="tea"]').getAttribute('aria-label');
    expect(dito, 'o que se ouve não é o que o ícone diz').toBe(rotulo);
    expect(dito, 'anunciou o estado que a criança acabou de deixar').not.toBe(rotuloAntes);
  });

  // 🎯 THE ROOT ANSWERS FOR THE DEVICE IN USE (ADR-0113), and this is the only case that measures it end to end. The
  // `ui/pause-icons` cases inject their own `transportInUse`, so the ROOT's line — the one that reads
  // `input/state.inputOf(i)` — had nobody asserting it. Two mutations survived because of that, and this case kills them:
  // without it, the root could answer keyboard for everyone and nothing would fail.
  it('🎯 [Right] a raiz lê o aparelho do jogador, e o ícone escreve na chave DELE', async () => {
    const { playerEdge, forgetInputs } = await import('../app/js/input/state.js');
    forgetInputs();
    try {
      playerEdge(0, 'gamepad');           // the child picked up the gamepad
      // ⚠️ `holdsKeys: true`, AND THE REASON IS THE CASE'S POINT: since ADR-0115 the root mounts `altmove` only in a game
      // that holds some key, and this file's default fixture is a hotspots one (it declares `false`). Without this line
      // the case would measure the icon's absence instead of the device wiring — green for the wrong reason.
      abrir({
        declaration: { ...declaracaoValida(), holdsKeys: () => true },
        players: [{ toggleMove: false, walkDir: 0, viz: 'normal' }],
      });

      const alvo = document.querySelector('#title-icons [data-pi="altmove"]');
      expect(alvo, 'o ícone da alternância não está na barra').not.toBeNull();
      alvo.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // ⚠️ A literal, not the function that writes the key: asserting through the same table would measure the round trip.
      expect(localStorage.getItem('incl_togglemove_p0_gamepad'),
        'a raiz não levou o aparelho em uso até à escrita').toBe('1');
    } finally {
      forgetInputs();
      localStorage.removeItem('incl_togglemove_p0_gamepad');
      localStorage.removeItem('incl_togglemove_p0');
    }
  });

  // 📌 THE PAIR: with ANOTHER device, the key is another. Without it, always writing to the gamepad would pass the case
  // above — exactly the shape of the mutation that survived before this block existed.
  it('📌 [Right] com outro aparelho, a chave é a desse aparelho', async () => {
    const { playerEdge, forgetInputs } = await import('../app/js/input/state.js');
    forgetInputs();
    try {
      playerEdge(0, 'toque');
      // `holdsKeys: true` for the same reason as the case above — without the icon there is no click to measure.
      abrir({
        declaration: { ...declaracaoValida(), holdsKeys: () => true },
        players: [{ toggleMove: false, walkDir: 0, viz: 'normal' }],
      });
      document.querySelector('#title-icons [data-pi="altmove"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(localStorage.getItem('incl_togglemove_p0_toque'), 'escreveu na chave do aparelho errado').toBe('1');
      expect(localStorage.getItem('incl_togglemove_p0_gamepad'), 'escreveu numa chave que ninguém usou').toBeNull();
    } finally {
      forgetInputs();
      localStorage.removeItem('incl_togglemove_p0_toque');
      localStorage.removeItem('incl_togglemove_p0');
    }
  });

  it('🔴 [Zero] o modo cego DESLIGA — sem isto ele liga uma vez e a criança fica lá dentro', () => {
    // 🔴 THIS CASE EXISTS BECAUSE OF A REAL DEFECT ONLY A REAL DOM COULD SHOW.
    //
    // The blind-mode pair got its two defaults on different days and they did not talk: the WRITER got
    // `setBlindModeValue` (ADR-0106 step 1b), which writes to `core/state`; the READER kept `() => false`, a CONSTANT
    // already there. With a game that does not inject `isBlindMode`:
    //
    //   1. the child presses → the writer stores `!false` → the mode really turns ON;
    //   2. the reflection reads `false` → the icon still says off, and so does the announcement;
    //   3. she presses again → `setBlindModeValue(!false)` = `true` AGAIN → the equality guard returns early → nothing
    //      happens.
    //
    // ⚠️ That is: blind mode turned on once and THERE WAS NO WAY TO TURN IT OFF. For someone who does not depend on it, it
    // is a game that suddenly describes everything aloud and does not stop. No error anywhere.
    //
    // 📌 And `domFalso` could NEVER catch it: its `addEventListener` is a stub, so the listener's body — where the pair is
    // exercised — never ran in any test.
    abrir();
    const q = () => document.querySelector('#title-icons [data-pi="blind"]');
    q().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(q().getAttribute('aria-pressed'), 'não ligou').toBe('true');
    q().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(q().getAttribute('aria-pressed'), 'ligou e não há como voltar').toBe('false');
  });

  /*
   * ⚠️ WHAT A CONSUMER COULD NOT HAND OVER, AND SO NO GAME HAD.
   *
   * `initPauseIcons` has always accepted `getPauseActs`, `setPauseActor`, `setPlayerTheme` and `setPlayerCorrection` —
   * all optional, all documented. `CreateGameOptions` now carries them; before, a game mounted by this root could wire no
   * item of the pause card nor bring up the high-contrast and colour-correction icons.
   *
   * Measured from outside, by `game-pinball`, the external consumer: it read the absence of the two icons as this game
   * having its own, which is true about the result and false about the cause — it COULD NOT hand over a writer. A gap
   * the consumer reads as a choice is the worst kind of gap.
   */
  describe('o que o jogo pode entregar ao cartão e à barra', () => {
    it('⚠️ [Zero] sem `getPauseActs`, o item que SÓ o jogo acciona nasce TRAVADO (ADR-0161)', () => {
      // `refreshPauseItems` hid what has no action (ADR-0106 §5); since ADR-0161 it locks it with the reason.
      //
      // ⚠️ THE EXAMPLE IS `addplayer`, NOT `quit`: the engine acts on `resume`, `ajuda`, `print` and `quit` itself (ADR-0144
      // erratum, ADR-0147 §4 and §5), so `quit` no longer serves as an example of an item only the game acts on — it
      // appears without the game saying anything. `addplayer` is still the game's: letting a second player in is a
      // decision only the game can make. 📌 A case whose example stops being an example measures the opposite of what it
      // says.
      const motor = abrir();
      motor.pause.show(0);

      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="addplayer"]');
      expect(item, 'o cartão nem sequer desenha o item').not.toBeNull();
      expect(item.hidden, 'the item vanished instead of being locked').toBe(false);
      expect(item.getAttribute('aria-disabled'), 'um item sem acção tem de estar travado').toBe('true');
    });

    it('🔴 [Right] the cursor NEVER lands on a hidden item — the ring walks only what the child sees', () => {
      // 📏 Measured in dist (quiz, 2026-09-12): ArrowDown from «Voltar ao jogo» put the cursor on «Ajuda», which is
      // hidden without a `preset`. `PM_VISIBLE_ITEMS` excluded hidden LISTS and not hidden ITEMS, so the child pressed
      // down and saw nothing selected; the count «N of M» counted the invisible ones too.
      // ⚠️ Since ADR-0161 the engine hides nothing, but a game may pass its own lists: the item is hidden by hand here.
      const motor = abrir();
      motor.pause.show(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="ajuda"]').hidden = true;
      const visiveis = [...document.querySelectorAll('#vp-pause-0 .pause-menu:not([hidden]) .pm-btn')].filter((b) => !b.hidden);
      expect(visiveis.length, 'nothing is hidden — the case would measure nothing').toBeLessThan(
        document.querySelectorAll('#vp-pause-0 .pause-menu:not([hidden]) .pm-btn').length);
      const regiao = document.getElementById('game-region') ?? document.body;
      for (let i = 0; i < visiveis.length + 1; i++) {
        regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true, cancelable: true }));
        const sel = document.querySelector('#vp-pause-0 .pm-sel');
        expect(sel, 'no item selected after a step').not.toBeNull();
        expect(sel.hidden, `the cursor landed on the hidden «${sel.dataset.act}»`).toBe(false);
      }
      document.querySelector('#vp-pause-0 .pm-btn[data-act="ajuda"]').hidden = false;
      motor.pause.hide(0);
    });

    it('🔴 [Right] opening the card puts the cursor on item 1 of the ROOT — even if it was closed inside the submenu (ADR-0158)', () => {
      // 📏 Measured in dist: opened by SELECT, no item was marked, and the first ArrowDown jumped to item 2.
      const motor = abrir();
      motor.pause.show(0);
      expect(document.querySelector('#vp-pause-0 .pm-sel')?.dataset.act, 'no cursor on open').toBe('resume');
      document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
      motor.pause.hide(0);
      motor.pause.show(0);
      expect(document.querySelector('#vp-pause-0 .pause-menu[data-sub="raiz"]').hidden, 'reopened inside the submenu').toBe(false);
      expect(document.querySelector('#vp-pause-0 .pm-sel')?.dataset.act).toBe('resume');
      motor.pause.hide(0);
    });

    it('🔴 [Right] a game that declares NOTHING still gets the six root items and the seven of the submenu, in order (ADR-0161)', () => {
      // The Dev found three items in the quiz and listed both menus in full. Order is literal, from their list.
      const motor = abrir();
      motor.pause.show(0);
      const lista = (sub) => [...document.querySelectorAll(`#vp-pause-0 .pause-menu[data-sub="${sub}"] .pm-btn`)]
        .filter((b) => !b.hidden).map((b) => b.dataset.act);
      expect(lista('raiz')).toEqual(['resume', 'ajuda', 'addplayer', 'options', 'opcoesdojogo', 'quit']);
      expect(lista('opcoes')).toEqual(['pmback', 'empatia', 'audio', 'som', 'motora', 'visual', 'anim']);
      // «Conforto auditivo (era Audio)» — the Dev's rename, on the item and on the panel it opens
      expect(document.querySelector('#vp-pause-0 .pm-btn[data-act="som"]').textContent).toContain('Conforto auditivo');
      motor.pause.hide(0);
    });

    it('🔴 [Right] a locked item SAYS WHY — reached by the cursor, and activated — and does nothing (ADR-0161)', async () => {
      const motor = abrir();
      motor.pause.show(0);
      const jogadores = document.querySelector('#vp-pause-0 .pm-btn[data-act="addplayer"]');
      expect(jogadores.getAttribute('aria-disabled'), '«Número de jogadores» is not locked in a game that does not act on it').toBe('true');
      // reached: the cursor stops on it, and the reason follows its name
      const regiao = document.getElementById('game-region') ?? document.body;
      const seta = () => regiao.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown', key: 'ArrowDown', bubbles: true, cancelable: true }));
      for (let i = 0; i < 6 && document.querySelector('#vp-pause-0 .pm-sel') !== jogadores; i++) seta();
      expect(document.querySelector('#vp-pause-0 .pm-sel'), 'the cursor skips the locked item').toBe(jogadores);
      await new Promise((r) => requestAnimationFrame(r)); // `srSay` writes on the next frame
      expect(document.querySelector('#sr-status')?.textContent, 'reaching it did not say the reason')
        .toContain('Quem decide quantos jogadores podem jogar é o jogo.');
      expect([...document.querySelectorAll('#game-region .barra-explicacao')].at(-1)?.textContent, 'the reason is not in the footer')
        .toBe('Quem decide quantos jogadores podem jogar é o jogo.');
      // activated: a locked DOOR does not open — «Opções do jogo» would switch to its (empty) list if the click passed
      const opcoes = document.querySelector('#vp-pause-0 .pm-btn[data-act="opcoesdojogo"]');
      expect(opcoes.getAttribute('aria-disabled')).toBe('true');
      opcoes.click();
      expect(document.querySelector('#vp-pause-0 .pause-menu[data-sub="raiz"]').hidden, 'the locked door opened').toBe(false);
      expect([...document.querySelectorAll('#game-region .barra-explicacao')].at(-1)?.textContent).toBe('Este jogo não tem opções próprias.');
      motor.pause.hide(0);
    });

    it('⚠️ [Right] com `getPauseActs`, o item APARECE e o clique chega ao jogo', () => {
      let entrou = 0;
      const motor = abrir({ getPauseActs: () => ({ addplayer: () => { entrou += 1; } }) });
      motor.pause.show(0);

      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="addplayer"]');
      expect(item.hidden, 'o jogo ligou o item e ele continua escondido').toBe(false);

      item.click();
      expect(entrou, 'o clique percorreu o caminho todo até à função do jogo').toBe(1);
    });

    it('🔴 [Right] o `quit` do JOGO ganha ao da engine — o padrão não é uma tomada', () => {
      /*
       * 🎯 The engine offers a `quit` («voltar à tela de press start», the Dev's decision), and this case keeps that from
       * becoming a seizure: `getPauseActs` spreads the GAME's table OVER the engine's, so a game that needs to save
       * something, confirm, or close a connection before leaving is still in charge. 📌 It is the same shape as `resume`
       * in the ADR-0144 erratum.
       */
      let saiuPeloJogo = 0;
      let fase = null;
      const motor = abrir({
        getPauseActs: () => ({ quit: () => { saiuPeloJogo += 1; } }),
        setPhase: (p) => { fase = p; },
      });
      motor.pause.show(0);

      document.querySelector('#vp-pause-0 .pm-btn[data-act="quit"]').click();

      expect(saiuPeloJogo, 'o `quit` da engine atropelou o do jogo').toBe(1);
      expect(fase, 'a engine pediu a fase por cima do jogo, que já tinha decidido como sair').toBeNull();
    });

    it('🎯 [Right] sem `quit` do jogo, a engine leva à TELA DE PRESS START', () => {
      // The other half: the game that declares nothing still gets a way out (ADR-0144 §5 erratum).
      // ⚠️ The check asserts the CALL and not the pixels, because whoever draws that screen is `ui/shell`, which this root
      // does not mount on purpose — the engine hides its card and ASKS for the phase.
      const fases = [];
      const motor = abrir({ setPhase: (p) => fases.push(p) });
      motor.pause.show(0);
      const sair = document.querySelector('#vp-pause-0 .pm-btn[data-act="quit"]');
      expect(sair.hidden, 'a engine oferece `quit` e o item continua escondido').toBe(false);

      sair.click();

      expect(fases, 'a saída não pediu a tela de press start').toEqual(['title']);
      expect(document.querySelector('#vp-pause-0').hidden, 'saiu do jogo e o cartão ficou aberto').toBe(true);
    });

    it('🔴 [Zero] o PRINT SAIU da raiz (ADR-0151) — o item não está no cartão, nem escondido', () => {
      /*
       * ⚠️ THIS CASE MEASURED print's BEHAVIOUR (hide the card; any key, after 80 ms, brings it back), and its door was the
       * root's item. The Dev took it out of there: «basta apertar SELECT que se tem a visão apropriada pra print». What
       * SELECT shows for print is an open question in ADR-0151, and the engine's print action STAYS in the code waiting
       * for that answer — with no door, and so with no case to exercise it. Said here so nobody reads the absence as
       * coverage.
       */
      const motor = abrir();
      motor.pause.show(0);
      expect(document.querySelector('#vp-pause-0 .pm-btn[data-act="print"]'), 'o print continua na raiz').toBeNull();
      expect(document.querySelector('#vp-pause-0 .pm-btn[data-act="quit"]'), 'o caso mediria um cartão vazio').not.toBeNull();
    });
    it('🔴 [Right] o jogo que escreve POR CIMA da barra é acusado, com o nó pelo nome', () => {
      /*
       * 🔴 The Dev's case, in a real document: `#title-icons` is absolute INSIDE `#game-region`, and in the quiz the
       * question's `H2` took the same pixels. ⚠️ Nothing failed — no error, no type, no console —, and whoever depends on
       * those buttons most is whoever cannot see they are covered.
       *
       * 📌 IT MUST BE IN THE BROWSER: what is asserted is an INTERSECTION of real rectangles. A double would return whatever
       * the double wanted, and the pure half is already held in `the-a11y-bar-is-hud.node`.
       */
      const regiao = raiz.querySelector('#game-region');
      regiao.style.position = 'relative';
      const titulo = document.createElement('h2');
      // ⚠️ A NEUTRAL name: the `engine-boundary` check fails an engine fixture that needs a genre's vocabulary. The defect
      // was measured in a quiz, but what is asserted — a heading over the bar — is any game's that draws a heading.
      titulo.className = 'titulo-da-atividade';
      titulo.textContent = 'Um título qualquer';
      titulo.style.cssText = 'position:absolute;left:0;top:0;width:400px;height:120px';
      regiao.appendChild(titulo);
      // The bar must be INSIDE the region and taking room, or the case measures its absence.
      const barra = raiz.querySelector('#title-icons');
      regiao.appendChild(barra);
      barra.style.cssText = 'position:absolute;left:10px;top:10px;width:300px;height:44px';

      const motor = abrir({ host: { doc: document, win: window, a11yBarHost: barra } });

      const linha = motor.problems.filter((p) => /accessibility bar/.test(p) && /draws over/.test(p));
      expect(linha, 'o jogo desenha por cima da barra e a engine cala-se').toHaveLength(1);
      expect(linha[0], 'a linha não nomeia o nó que invade — o consumidor fica a caçar').toMatch(/titulo-da-atividade/);
      expect(linha[0], 'a linha não diz por onde se conserta').toMatch(/--barra-a11y-h/);
    });

    it('🎯 [Boundary] a CONTAINER whose padding keeps its content below the bar paints nothing over it — not accused', () => {
      // 📏 Measured in dist/quiz.html: the quiz was accused at every boot because `#quiz-app` — a transparent box the size
      // of the region, whose top padding is exactly the bar's room (ADR-0148) — intersects the bar's rectangle. The
      // box draws nothing there; its text starts below. An accusation that is always there teaches the reader to skip it.
      const regiao = raiz.querySelector('#game-region');
      regiao.style.position = 'relative';
      const caixa = document.createElement('div');
      caixa.className = 'conteudo-do-jogo';
      caixa.style.cssText = 'position:absolute;left:0;top:0;width:400px;height:200px;padding-top:80px;box-sizing:border-box';
      const texto = document.createElement('p');
      texto.className = 'texto-abaixo';
      texto.textContent = 'Texto abaixo da barra';
      texto.style.margin = '0';
      caixa.appendChild(texto);
      regiao.appendChild(caixa);
      const barra = raiz.querySelector('#title-icons');
      regiao.appendChild(barra);
      barra.style.cssText = 'position:absolute;left:10px;top:10px;width:300px;height:44px';

      const motor = abrir({ host: { doc: document, win: window, a11yBarHost: barra } });
      expect(motor.problems.filter((p) => /draws over the accessibility bar/.test(p)), 'a transparent container was accused').toEqual([]);
    });

    it('🔴 [Right] a box with NO text that PAINTS a background over the bar is accused', () => {
      const regiao = raiz.querySelector('#game-region');
      regiao.style.position = 'relative';
      const faixa = document.createElement('div');
      faixa.className = 'faixa-pintada';
      faixa.style.cssText = 'position:absolute;left:0;top:0;width:400px;height:60px;background:#123';
      regiao.appendChild(faixa);
      const barra = raiz.querySelector('#title-icons');
      regiao.appendChild(barra);
      barra.style.cssText = 'position:absolute;left:10px;top:10px;width:300px;height:44px';
      const motor = abrir({ host: { doc: document, win: window, a11yBarHost: barra } });
      const linha = motor.problems.filter((p) => /draws over the accessibility bar/.test(p));
      expect(linha, 'a painted box over the bar was not said').toHaveLength(1);
      expect(linha[0]).toMatch(/faixa-pintada/);
    });

    it('🎯 [Zero] sem nada por cima, a engine NÃO acusa — e declara a faixa reservada', () => {
      // The pair. Without it, a check that always accused would pass the case above without proving anything.
      const motor = abrir();
      expect(motor.problems.filter((p) => /draws over the accessibility bar/.test(p)),
        'acusou sobreposição num jogo que não desenhou nada').toEqual([]);
      // 📌 And the band is DECLARED where the game reads it, beside `--tap` and `--alvo-min`.
      const regiao = document.querySelector('#game-region');
      expect(regiao.style.getPropertyValue('--barra-a11y-h'), 'a engine não disse que faixa reserva').toMatch(/^\d+px$/);
    });

    it('🔴 [Right] COM host de filtros, a engine acciona 🚥 sozinha — e 🌗 continua a ser do jogo', () => {
      /*
       * 📏 Without a default, the bar left the 🚥 out while the engine had everything at hand: `installCvdFilters` mounts
       * the six `<filter>` and `applyVisionFilter` knows how to put them on the world; what was missing was wiring them to
       * the icon.
       *
       * 🔴 AND THE PAIR IS WHAT KEEPS THIS FROM BECOMING ONE MORE PROMISE: the 🌗 does NOT appear, because `setPlayerTheme`
       * is not a filter — it is a REPAINT of textures in the game's render, and the levels `hc-direto-45`/`hc-direto-7` are
       * WCAG's 4.5:1 and 7:1 ratios. The engine has no textures, and approximating it with `filter: contrast()` would be
       * announcing a ratio nothing guarantees.
       */
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      raiz.appendChild(svg);
      abrir({ host: { doc: document, win: window, cvdHost: svg } });

      expect(document.querySelector('#title-icons [data-pi="cvd"]'),
        'a engine tem os filtros e o ícone de daltonismo continua a faltar').not.toBeNull();
      expect(document.querySelector('#title-icons [data-pi="contrast"]'),
        'o 🌗 apareceu, e a engine não sabe repintar as texturas de jogo nenhum').toBeNull();
    });

    it('🎯 [Right] carregar no 🚥 põe MESMO o filtro no mundo — não só anuncia', () => {
      // ⚠️ Without this the case above would stay green with an inert icon, §5's dead button in other clothes.
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      raiz.appendChild(svg);
      abrir({ host: { doc: document, win: window, cvdHost: svg } });
      const mundo = document.querySelector('#game-region');
      expect(mundo.style.filter, 'o mundo já nasceu com filtro').toBe('');

      document.querySelector('#title-icons [data-pi="cvd"]').click();

      // ⚠️ The assertion accepts quotes: the browser normalises `url(#x)` to `url("#x")` when returning the style, and the
      // first version of this case failed because of that — with the filter ALREADY applied. Measure what the browser
      // returns, not what was written.
      expect(mundo.style.filter, 'o ícone anunciou uma correcção que não aconteceu').toMatch(/url\(["']?#cvd-fix-/);
    });

    it('🔴 [Right] the contrast enhancement COMPOSES with the colour correction — one never switches the other off', async () => {
      // Two writers of one `style.filter`: written apart, the last one erased the first, and turning the enhancement on
      // would silently undo the correction a colour-blind child had chosen.
      const { setLq } = await import('../app/js/render/lq-filter.js');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      raiz.appendChild(svg);
      const motor = abrir({ host: { doc: document, win: window, cvdHost: svg } });
      const mundo = document.querySelector('#game-region');
      try {
        document.querySelector('#title-icons [data-pi="cvd"]').click();
        motor.pause.show(0);
        document.querySelector('#vp-pause-0 .pm-btn[data-act="visual"]').click();
        const passo = (d) => document.getElementById('opt-lq').dispatchEvent(new CustomEvent('passo', { detail: d }));
        passo(1);
        expect(mundo.style.filter, 'the enhancement erased the correction').toMatch(/cvd-fix-/);
        expect(mundo.style.filter, 'the enhancement is not on the world').toMatch(/lq-enh/);
        passo(-1);
        expect(mundo.style.filter, 'turning the enhancement off erased the correction').toMatch(/cvd-fix-/);
        expect(mundo.style.filter).not.toMatch(/lq-enh/);
      } finally {
        setLq(0);
        document.getElementById('visual-close')?.click();
        motor.pause.hide(0);
      }
    });

    it('🔴 [Right] the VISUAL panel offers the two rows the engine can drive — and none of a game it does not know', () => {
      const motor = abrir();
      motor.pause.show(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="visual"]');
      expect(item.getAttribute('aria-disabled'), 'the visual item is still locked').toBeNull();
      item.click();
      expect(document.getElementById('visual').hidden, 'the panel did not open').toBe(false);
      expect(document.getElementById('opt-lq'), 'no contrast enhancement').not.toBeNull();
      const paleta = document.getElementById('opt-cbsafe');
      expect(paleta, 'no safe palette').not.toBeNull();
      // 🔴 the platformer's rows — item owners, and «lava, ladder, water, gate» — are not the engine's to offer
      expect(document.getElementById('opt-ownercolors')).toBeNull();
      expect(document.getElementById('opt-role-reset')).toBeNull();
      // the palette row does what it says: the menus and HUD switch palette
      const antes = document.documentElement.dataset.paleta;
      paleta.click();
      expect(document.documentElement.dataset.paleta, 'the safe palette did nothing').not.toBe(antes);
      document.getElementById('opt-cbsafe').click(); // back (the panel re-rendered the row)
      expect(document.documentElement.dataset.paleta).toBe(antes);
      document.getElementById('visual-close').click();
      motor.pause.hide(0);
    });

    /** A simulation chosen in the panel's list, the way a mouse or a touch picks an option. */
    const escolherSimulacao = (chave) => {
      const lista = document.getElementById('opt-simulacao');
      lista.value = chave;
      lista.dispatchEvent(new Event('change', { bubbles: true }));
    };

    it('🔴 [Right] the EMPATHY panel offers the simulations the engine can draw, and hearing loss — nothing it cannot', async () => {
      const audio = await import('../app/js/platform/audio.js');
      const motor = abrir();
      const mundo = document.querySelector('#game-region');
      motor.pause.show(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]');
      expect(item.getAttribute('aria-disabled'), 'the empathy item is still locked').toBeNull();
      item.click();
      try {
        expect(document.getElementById('empathy').hidden, 'the panel did not open').toBe(false);
        // ADR-0159 rule 7: one choice among SEVEN positions is a dropdown list, not seven buttons (>5 → list)
        expect(document.querySelectorAll('#empathy-list button[data-viz], #empathy-list [role="radio"]'), 'the simulations are still seven buttons').toHaveLength(0);
        const chaves = [...document.getElementById('opt-simulacao').options].map((o) => o.value);
        expect(chaves).toEqual(['normal', 'sim-protan', 'sim-deuter', 'sim-tritan', 'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind']);
        expect(document.getElementById('opt-simulacao').closest('.ctrl-row').querySelector('strong')?.textContent, 'the list has no label').toBe('Simulações');
        // the three drawn simulations are offered since issue #182 (the engine lays their drawing over the world); wheelchair was cut
        expect(document.getElementById('opt-wheelchair'), 'opt-wheelchair').toBeNull();
      // ADR-0181: the two motor simulations the engine can now apply are offered
      for (const id of ['opt-onebtn', 'opt-semforca']) expect(document.getElementById(id), id).not.toBeNull();
        // a simulation runs in the game, never under an open menu (issue #182): with this panel open the world is not simulated
        escolherSimulacao('sim-deuter');
        expect(mundo.style.filter, 'the simulation runs under the open panel').not.toMatch(/cvd-deuter/);
        // closed and opened again, the list shows the simulation that runs — not its first option
        document.getElementById('empathy-close').click();
        document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]').click();
        expect(document.getElementById('opt-simulacao').value, 'the reopened list forgot the running simulation').toBe('sim-deuter');
        escolherSimulacao('normal');
        expect(mundo.style.filter).toBe('');
        // hearing loss switches the audio graph, both ways
        const antes = audio.hearingLoss;
        document.getElementById('opt-hearing').click();
        expect(audio.hearingLoss, 'the hearing-loss row did nothing').toBe(!antes);
        document.getElementById('opt-hearing').click();
        expect(audio.hearingLoss).toBe(antes);
      } finally {
        if (document.getElementById('opt-simulacao')) escolherSimulacao('normal');
        document.getElementById('empathy-close').click();
        motor.pause.hide(0);
      }
    });

    it('🔴 [Boundary] with a colour CORRECTION on, a simulation is REFUSED and says why (ADR-0076)', async () => {
      // A demonstration drawn over a correction shows neither the disability nor the correction.
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      raiz.appendChild(svg);
      const motor = abrir({ host: { doc: document, win: window, cvdHost: svg } });
      const mundo = document.querySelector('#game-region');
      document.querySelector('#title-icons [data-pi="cvd"]').click();
      motor.pause.show(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]').click();
      try {
        // by the KEYBOARD, the way a child adjusts a list: the refusal must not be spoken over by the list's new value
        const lista = document.getElementById('opt-simulacao');
        lista.value = 'normal'; // the world's state: the arrow asks for protanopia, which the correction refuses
        lista.focus();
        document.querySelector('#game-region').dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true, cancelable: true }));
        expect(lista.value, 'a refused simulation stayed selected in the list').toBe('normal');
        expect(mundo.style.filter, 'the simulation ran over the correction').not.toMatch(/brightness\(0\)/);
        expect(mundo.style.filter, 'the refusal erased the correction').toMatch(/cvd-fix-/);
        await new Promise((r) => requestAnimationFrame(r));
        expect(document.querySelector('#sr-status')?.textContent, 'the refusal was silent').toMatch(/correção de cor/);
      } finally {
        document.getElementById('empathy-close').click();
        motor.pause.hide(0);
      }
    });

    it('🔴 [Boundary] turning a correction ON while a simulation runs STOPS the simulation — the adaptation wins (ADR-0076)', async () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      raiz.appendChild(svg);
      const motor = abrir({ host: { doc: document, win: window, cvdHost: svg } });
      const mundo = document.querySelector('#game-region');
      // the game's own part of the world: a simulation runs there, never on the menus beside it (issue #182)
      const parte = mundo.appendChild(document.createElement('div'));
      const tick = () => new Promise((r) => setTimeout(r, 20));
      motor.pause.show(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]').click();
      try {
        escolherSimulacao('blind');
        document.getElementById('empathy-close').click();
        motor.pause.hide(0);
        await tick();
        expect(parte.style.filter, 'the case would measure nothing').toMatch(/brightness\(0\)/);
        document.querySelector('#title-icons [data-pi="cvd"]').click();
        expect(mundo.style.filter, 'the correction did not reach the world').toMatch(/cvd-fix-/);
        expect(parte.style.filter + mundo.style.filter, 'the simulation kept running over the correction').not.toMatch(/brightness\(0\)/);
        // and the panel's list says what runs now, not the simulation that was stopped from outside it
        motor.pause.show(0);
        document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]').click();
        expect(document.getElementById('opt-simulacao').value, 'the list still shows the stopped simulation').toBe('normal');
        document.getElementById('empathy-close').click();
      } finally {
        motor.pause.hide(0);
      }
    });

    it('🔴 [Boundary] o ciclo ANDA e LIMPA quando o jogo declara jogadores', () => {
      /*
       * 🔴 THIS CASE WAS BORN OF A SURVIVING MUTATION: always applying a filter and never clearing stayed green, because
       * the case above presses ONCE. The cycle has four positions — trichromat, protan, deuter, tritan — and the fourth
       * goes back to the start.
       *
       * ⚠️ AND GOING BACK TO THE START MUST TRULY CLEAR. The child who tries all three and decides none serves would, without
       * it, keep the last one over the game forever — with the icon announcing trichromatic vision. It is the control lying
       * about its state in the cruellest direction: she moved it to undo.
       *
       * 📌 The `players` here once decided the case: with an empty list the cycle stuck on the first position (issue #147).
       * Since that fix the root answers one seat for a game that declares none; the case keeps the players a game with
       * seats has.
       */
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      raiz.appendChild(svg);
      abrir({ host: { doc: document, win: window, cvdHost: svg }, players: [{ ctrl: {} }] });
      const mundo = document.querySelector('#game-region');
      const icone = document.querySelector('#title-icons [data-pi="cvd"]');

      const vistos = [];
      for (let n = 0; n < 4; n += 1) { icone.click(); vistos.push(mundo.style.filter); }

      expect(vistos.slice(0, 3).every((f) => /url\(["']?#cvd-fix-/.test(f)),
        `as três correcções não pintaram: ${JSON.stringify(vistos)}`).toBe(true);
      expect(new Set(vistos.slice(0, 3)).size, 'as três correcções pintaram o MESMO filtro').toBe(3);
      expect(vistos[3], 'a volta ao tricromata deixou a última correcção por cima do jogo').toBe('');
    });

    it('🔴 [Right] o `setPlayerCorrection` do JOGO ganha ao padrão da engine', () => {
      // The default is a floor, not a seizure: a game that corrects colour in its own render — `game-pinball` does it in a
      // framebuffer — hands in its own and the engine steps aside.
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      raiz.appendChild(svg);
      const vistas = [];
      abrir({
        host: { doc: document, win: window, cvdHost: svg },
        setPlayerCorrection: (i, c) => vistas.push(c),
      });
      const mundo = document.querySelector('#game-region');

      document.querySelector('#title-icons [data-pi="cvd"]').click();

      expect(vistas.length, 'o padrão da engine atropelou o escritor do jogo').toBe(1);
      expect(mundo.style.filter, 'a engine pintou por cima de um jogo que já sabia corrigir').toBe('');
    });

    it('⚠️ [Zero] sem escritores visuais, os ícones de contraste e cor NÃO são montados', () => {
      // `iconsThatAct` mounts `contrast` only for whoever hands in its writer. It is the right rule: an icon that does not
      // act is worse than one icon fewer. What was missing was the DOOR.
      abrir();

      expect(document.querySelector('#title-icons [data-pi="contrast"]')).toBeNull();
      expect(document.querySelector('#title-icons [data-pi="cvd"]')).toBeNull();
    });

    it('⚠️ [Right] com eles, os dois ícones aparecem — e o §4 do ADR-0044 fica alcançável', () => {
      abrir({ setPlayerTheme: () => {}, setPlayerCorrection: () => {} });

      expect(document.querySelector('#title-icons [data-pi="contrast"]'), 'alto contraste').not.toBeNull();
      expect(document.querySelector('#title-icons [data-pi="cvd"]'), 'correcção de cor').not.toBeNull();
    });

    it('⚠️ [Right] e UM escritor só monta UM ícone, porque são duas perguntas diferentes', () => {
      // The pair is not a two-state button: a game may know how to repaint for high contrast and have no way to correct
      // colour, or the other way round — exactly `game-pinball`'s case, whose image is a 320x180 framebuffer with no
      // texture to repaint, but which applies a colour filter.
      abrir({ setPlayerCorrection: () => {} });

      expect(document.querySelector('#title-icons [data-pi="cvd"]'), 'o que ele sabe fazer').not.toBeNull();
      expect(document.querySelector('#title-icons [data-pi="contrast"]'), 'o que ele não sabe').toBeNull();
    });
  });

  it('⚠️ [Boundary] a barra monta no hospedeiro DECLARADO, e não caça um id fixo', () => {
    // The game says where it fits in its layout; the engine does not guess. In a real document this is proved by where
    // the nodes ended up, the one thing a double with a map of ids cannot tell apart.
    const meu = document.createElement('nav');
    meu.id = 'a-minha-barra';
    raiz.appendChild(meu);
    abrir({ host: { doc: document, win: window, a11yBarHost: meu } });
    expect(meu.querySelectorAll('[data-pi]').length).toBeGreaterThan(0);
    expect(document.querySelector('#title-icons').children.length, 'montou nos DOIS sítios').toBe(0);
  });

  /*
   * THE REACH NOTICE BETWEEN CARTRIDGES (ADR-0142).
   *
   * ⚠️ THIS CASE CAN ONLY LIVE HERE, and this file's header rule says why: the node project's `domFalso` returns an element
   * for ANY selector not in `ausentes`, so `#reach-notice` answers that it exists whether it was created or not; and its
   * `removeChild` is an empty function. Both halves of the question — did it appear? did it leave? — are invisible to the
   * double. Here there is a real tree.
   *
   * 🎯 And what is measured is not the notice APPEARING: it is it LEAVING when the next cartridge has nothing to warn
   * about. `removeReachNotice()` always runs, and not only when there is something to show, exactly for this — a quiet
   * cartridge must erase the previous one's noise, and that is the case that gets forgotten.
   */
  it('🎯 [Zero] um cartucho sem nada a avisar APAGA o aviso de alcance do anterior', () => {
    // ⚠️ A DEVICE WITH NOTHING, and not touch only, which was the first attempt and passed: the reach's `ok` is
    // `actions.length > 0 && availableNow.some(serve)`, and touch POINTS — so it served the game that asks for a pointer,
    // and the notice never existed. With no transport available, `some` is false and the engine has something to say,
    // which is this case's precondition.
    const semNada = {
      gamepad: () => false, touch: () => false, keyboard: () => false, mouse: () => false,
    };
    const motor = abrir({
      declaration: { ...declaracaoValida(), needsPointer: () => true },
      availability: semNada,
      preset: { up: { label: 'Cima' }, down: { label: 'Baixo' }, action1: { label: 'Agir' } },
    });
    expect(document.querySelector('#reach-notice'), 'o aviso nem chegou a aparecer — o caso não mede nada')
      .not.toBeNull();

    // No hooks: the new cartridge declares no `preset`, so it has no actions to warn about.
    motor.mount(declaracaoValida(), { accommodations: SEM_ASSUNTO });
    expect(document.querySelector('#reach-notice'), 'o aviso do cartucho anterior ficou na página')
      .toBeNull();
  });

  /*
   * ===================== THE SETTINGS PANELS (ADR-0106 §1) =====================
   *
   * 🔴 WHAT THESE CASES MEASURE: a game that called only `createGame` got ZERO panels. `ui/panel-shell.mountShell` existed
   * and no engine module called it; each `ui/settings-*` filled the inside of ids nobody created, and the quiz recorded the
   * symptom as finding 6: the panel opens EMPTY, with no error.
   *
   * 🎯 AND THEY MUST LIVE HERE, by the header's rule: the question is whether the panel is IN THE TREE, whether a real
   * click opens it, whether its markup PARSES and whether focus lands inside the card. A double answers yes to all four
   * without any being true.
   */
  describe('os painéis de ajustes, que a engine passou a montar', () => {
    // ⚠️ IT WAS THE `tipo` ITEM. Since ADR-0151 typography has neither panel nor door, and the cases that measured the
    // panels' MACHINERY (the §5 filter, the click to focus, the Escape chain, the overriding cartridge) measure it on the
    // visual-sensitivity panel, which is the engine's and is still on the list.
    const itemAnim = () => document.querySelector('#vp-pause-0 .pm-btn[data-act="anim"]');

    it('🎯 [Right] com ZERO campos opcionais, o painel de SENSIBILIDADE VISUAL está no documento e nasce escondido', () => {
      // The case that carries the step: no `getPauseActs`, no writers. The game only called `createGame`.
      abrir();
      const painel = document.querySelector('#animation');
      expect(painel, 'a engine não montou painel nenhum — é o estado de antes').not.toBeNull();
      expect(painel.isConnected).toBe(true);
      expect(painel.hidden, 'um painel que nasce aberto é um painel que ninguém abriu').toBe(true);
      // The ids `ui/settings-motion` demands and nobody declared. The contract is built now.
      for (const id of ['motion-list', 'animation-reset', 'animation-close']) {
        expect(document.getElementById(id), `a casca não criou #${id}`).not.toBeNull();
      }
    });

    it('🔴 [Right] a AJUDA abre por um clique e diz POSIÇÃO ↔ tecla ↔ a palavra do jogo', () => {
      /*
       * 🔴 The `ajuda` item has been on the list since ADR-0044 and the engine could not act on it — the screen that filled
       * it left with the cartridge (#111). This case is the child's whole path: pause item → dispatch → engine table →
       * `open()` → `render()` → the rows in the document.
       *
       * 📌 AND IT MUST LIVE HERE and not in the `node` file: there the pure half is already held (`helpRows`), but the panel
       * being IN THE TREE, a real click opening it and the list being filled are the three things only a document knows
       * — this file's header rule.
       */
      const motor = abrir({
        preset: {
          action2: { label: 'Confirmar', hint: 'Escolhe a alternativa em que está o cursor.' },
          left: { label: 'Alternativa anterior' },
        },
      });
      motor.pause.show(0);

      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="ajuda"]');
      expect(item, 'o item de ajuda nem foi montado').not.toBeNull();
      expect(item.hidden, 'o item existe e está escondido: o filtro do §5 não o viu accionar').toBe(false);

      item.click();

      const painel = document.querySelector('#help');
      expect(painel, 'a engine não montou o painel de ajuda').not.toBeNull();
      expect(painel.hidden, 'o clique não abriu a ajuda').toBe(false);
      // A SLIDE SHOW, NOT A MENU (interface log, 2026-09-13): no settings rows and no «restore defaults».
      expect(document.querySelectorAll('#help-list .ctrl-row').length, 'the help is drawn as menu rows').toBe(0);
      const repor = document.querySelector('#help-reset');
      expect(repor === null || repor.offsetParent === null, 'the help offers «restore defaults»').toBe(true);      const slides = document.querySelector('#help .slides');
      expect(slides, 'no slide show in the help').not.toBeNull();
      const slide = () => slides.querySelector('.slide');
      // The order is `ACTIONS`' canonical one: `left` before `action2`, not the game object's order.
      expect(slide().dataset.act, 'the show does not open on the first position').toBe('left');
      expect(slide().querySelectorAll('.slide-ponto').length, 'one dot per slide').toBe(2);
      slides.dispatchEvent(new CustomEvent('passo', { detail: 1, bubbles: true }));
      expect(slide().dataset.act, 'right did not turn the page').toBe('action2');
      // 🔴 THE WORD IS THE GAME'S, and the slide shows no identifier.
      expect(slide().querySelector('.slide-palavra').textContent).toBe('Confirmar');
      expect(slide().querySelector('.slide-texto').textContent).toBe('Escolhe a alternativa em que está o cursor.');
      expect(painel.textContent, 'a ajuda mostrou um identificador a uma criança').not.toContain('action2');
      // The key is this child's scheme's, resolved by the keyboard runtime and not invented here.
      expect(slide().querySelector('.slide-tecla').hasAttribute('data-sem-tecla'), 'the child\'s key is not drawn').toBe(false);
      expect(slide().querySelector('.slide-tecla').textContent.trim().length).toBeGreaterThan(0);
      // The last slide is a wall, as every steps control's end is.
      slides.dispatchEvent(new CustomEvent('passo', { detail: 1, bubbles: true }));
      expect(slide().dataset.act, 'the show wrapped past its last slide').toBe('action2');
      slides.dispatchEvent(new CustomEvent('passo', { detail: -1, bubbles: true }));
      expect(slide().dataset.act, 'left did not turn back').toBe('left');
    });

    it('🔴 [Right] «how to play» is the cartridge\'s: its slides open the help, before the button slides (ADR-0195)', () => {
      const motor = abrir({
        preset: { action2: { label: 'Confirmar' } },
        howToPlay: [{ text: () => 'Leia a pergunta.' }, { text: () => 'Escolha a resposta certa.', figure: () => {} }],
      });
      motor.pause.show(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="ajuda"]').click();
      const slides = document.querySelector('#help .slides');
      const slide = () => slides.querySelector('.slide');
      const passo = (d) => slides.dispatchEvent(new CustomEvent('passo', { detail: d, bubbles: true }));
      expect([slide().dataset.kind, slide().querySelector('.slide-texto').textContent], 'the help does not open on the game\'s first slide')
        .toEqual(['play', 'Leia a pergunta.']);
      passo(1);
      expect(slide().querySelector('.slide-figura').hidden, 'the second slide\'s figure is not shown').toBe(false);
      passo(1);
      expect([slide().dataset.kind, slide().dataset.act], 'the button slides do not follow').toEqual(['button', 'action2']);
      expect(slides.querySelectorAll('.slide-ponto').length).toBe(3);
    });

    it('⚠️ [Boundary] a cartridge with «how to play» and no preset still has a help — its slides alone', () => {
      const motor = abrir({ howToPlay: [{ text: () => 'Toque na figura certa.' }] });
      motor.pause.show(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="ajuda"]');
      expect(item.getAttribute('aria-disabled'), 'the help is locked though the game tells how to play').not.toBe('true');
      item.click();
      const slides = document.querySelector('#help .slides');
      expect(slides, 'no help mounted for a game that only tells how to play').not.toBeNull();
      expect(slides.querySelectorAll('.slide-ponto').length).toBe(1);
    });

    it('🔴 [Zero] a «how to play» slide without text refuses the boot, naming it (ADR-0169)', () => {
      expect(() => abrir({ howToPlay: [{ figure: () => {} }] })).toThrow(/howToPlay\[0\]\.text/);
    });

    it('🔴 [Zero] SEM `preset` o item de ajuda fica TRAVADO — presente, e sem painel por trás (ADR-0161)', () => {
      // The pair of the case above. Without the game's words the help is not mounted (ADR-0074); since ADR-0161 the item
      // stays in view and locked with the reason, instead of vanishing. Measuring only presence would let an empty help by.
      const motor = abrir();
      motor.pause.show(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="ajuda"]');
      expect(item.hidden, 'the help item vanished — the card changes shape per game').toBe(false);
      expect(item.getAttribute('aria-disabled'), 'a ajuda acendeu sem o jogo declarar uma palavra sequer').toBe('true');
      expect(document.querySelector('#help'), 'o painel foi montado sem ter o que dizer').toBeNull();
    });

    it('🎯 [Right] o item `anim` SOBREVIVE ao filtro do §5 — a tabela da engine deixou de ser vazia', () => {
      // 📏 The cascade that produced a one-button card: without `getPauseActs` the table is `{}`, `itemsThatAct` keeps only
      // `ENGINE_ITEMS`, and `rootThatActs` also drops `options` because it would be «uma porta para uma sala vazia». With
      // a real action, the door and the room exist.
      const motor = abrir();
      motor.pause.show(0);
      expect(itemAnim(), 'o item de sensibilidade visual nem foi montado').not.toBeNull();
      expect(itemAnim().hidden, 'o item existe e está escondido: o filtro do §5 não o viu accionar').toBe(false);
      const porta = document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]');
      expect(porta.hidden, 'a porta de opções continua fechada sobre uma sala que agora tem gente').toBe(false);
    });

    it('🎯 [Right] UM CLIQUE DE VERDADE no item abre o painel, com as fontes desenhadas e o foco dentro', () => {
      // The whole path: pause button -> `ui/pause-icons` dispatch -> engine table -> `open()` -> the panel's `render()`.
      // No double walks this; and it is the path the child takes.
      const motor = abrir();
      motor.pause.show(0);
      itemAnim().click();

      const painel = document.querySelector('#animation');
      expect(painel.hidden, 'o clique não revelou o painel').toBe(false);
      const linhas = painel.querySelectorAll('#motion-list button');
      expect(linhas.length, 'o painel abriu VAZIO — é o achado 6, outra vez').toBeGreaterThan(0);
      expect(painel.querySelector('.overlay__card').contains(document.activeElement),
        'o foco ficou FORA de um diálogo `aria-modal`').toBe(true);
    });

    it('⚠️ [Right] o painel ENTRA na cadeia do Escape — o registo estava vazio sob o `createGame`', () => {
      const motor = abrir();
      motor.pause.show(0);
      expect(motor.overlays.escapeTarget(), 'com tudo fechado a cadeia não tem alvo').toBeNull();
      itemAnim().click();
      expect(motor.overlays.escapeTarget(), 'o painel abriu e nenhuma tecla o fecha — a armadilha do ADR-0044 §2')
        .toBe('animation');
    });

    it('⚠️ [Right] o CARTUCHO sobrepõe a acção da engine — não-declinável é a pausa, não cada item dela', () => {
      // ADR-0122 makes the pause EXISTING non-declinable; it does not make the engine the owner of every item in it. A game
      // that already has its own visual-sensitivity panel is still the one that answers for the item.
      let meu = 0;
      const motor = abrir({ getPauseActs: () => ({ anim: () => { meu += 1; } }) });
      motor.pause.show(0);
      itemAnim().click();
      expect(meu, 'a engine ganhou ao jogo na própria mesa dele').toBe(1);
      expect(document.querySelector('#animation').hidden,
        'abriu o painel da engine por cima do jogo — dois painéis para o mesmo ajuste').toBe(true);
    });

    it('🔴 [Zero] os painéis de COMUNICAÇÃO e de TIPOGRAFIA não são montados, nem têm porta (ADR-0151)', () => {
      // ⚠️ THESE CASES MEASURED THE AAC PANEL (the letter case, the close owner, the Escape chain) through the
      // «Comunicação» door. The Dev took it out of the inclusion settings: the letter case moves with the 11th button's
      // cycle. A panel with no door would be a dialog in the document nobody reaches, so the engine no longer mounts it —
      // the cases of its behaviour left with the mounting, and the module has its own in `settings-caa.browser.test.js`.
      const motor = abrir();
      motor.pause.show(0);
      expect(document.querySelector('#caa'), 'o painel de CAA continua montado sem porta').toBeNull();
      expect(document.querySelector('#vp-pause-0 .pm-btn[data-act="caa"]'), 'a porta «Comunicação» continua').toBeNull();
      expect(document.querySelector('#vp-pause-0 .pm-btn[data-act="tipo"]'), 'a porta «Tipografia» continua').toBeNull();
      // ⚠️ AND THE TWO CASES ONLY TYPOGRAPHY HAD — the sample and the reset — left with its shell; the `ui/settings-typo`
      // module keeps its own in `settings-typo.browser.test.js`.
      expect(document.querySelector('#typo'), 'o painel de tipografia continua no documento sem porta').toBeNull();
    });

    it('🔴 [Right] sem o painel, o ESCRITOR da tipografia continua vivo — o 11.º botão ainda troca a face', () => {
      // 📌 The pair of the case above, and the reason `initSettingsTypo` still runs: removing the shell must not take the
      // writing with it. Without this case, a `createGame` that stopped starting the module would pass everything.
      abrir();
      const botao = document.querySelector('#title-icons [data-pi="tipografia"]');
      expect(botao, 'o 11.º botão não montou — o caso mediria nada').not.toBeNull();
      const antes = document.documentElement.dataset.fonte;
      botao.click();
      expect(document.documentElement.dataset.fonte, 'o ciclo carregou e a face do documento não mudou').not.toBe(antes);
    });

    it('🎯 [Right] o painel de SENSIBILIDADE VISUAL abre, e a lista dele é `#motion-list`', () => {
      // ⚠️ A SILENT ID DIVERGENCE: `settings-motion` lives in `#animation` — with `#animation-reset` and `#animation-close`,
      // which match — and reads its list in `#motion-list`. A shell that created `#animation-list` would give a panel that
      // opens EMPTY, with no error, which is finding 6 again.
      const motor = abrir();
      motor.pause.show(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="anim"]');
      expect(item, 'o item de sensibilidade visual nem foi montado').not.toBeNull();
      expect(item.hidden).toBe(false);

      item.click();
      expect(document.querySelector('#animation').hidden, 'o clique não revelou o painel').toBe(false);
      const lista = document.querySelector('#motion-list');
      expect(lista, 'a casca criou a lista com o id errado — o painel abre vazio e ninguém sabe').not.toBeNull();
      expect(lista.querySelectorAll('button').length, 'a lista existe e está vazia').toBeGreaterThan(0);
      // and no orphan list was left with the id the convention would give
      expect(document.querySelector('#animation-list'), 'ficaram DUAS listas no cartão').toBeNull();
    });

    it('🔴 [Right] o BOTÃO-MESTRE congela tudo de um gesto — e existe antes do `init`, ou é morto', () => {
      // ⚠️ The panels' order rule: `initSettingsMotion` wires its click ONCE, at boot. And it is not a convenience — it is
      // the way out for someone who felt sick with the screen moving and needs to stop EVERYTHING in one gesture, instead
      // of going through seven rows one by one.
      const motor = abrir();
      motor.pause.show(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="anim"]').click();

      const mestre = document.querySelector('#motion-master');
      expect(mestre, 'o painel abriu sem o botão de parar tudo').not.toBeNull();
      expect(mestre.textContent.length, 'o botão-mestre está sem rótulo: ninguém sabe o que ele faz')
        .toBeGreaterThan(0);
      const antes = mestre.getAttribute('aria-pressed');
      mestre.click();
      expect(document.querySelector('#motion-master').getAttribute('aria-pressed'),
        'o clique não fez nada — a casca montou DEPOIS do `init` e o botão ficou sem escuta').not.toBe(antes);

      // back to the default so as not to leave everything frozen for the next cases
      document.querySelector('#animation-reset').click();
    });

    it('🔴 [Right] the root asks the HOST window whether the system wants less motion (ADR-0232)', () => {
      // `defaultReducedMotion` reaches no `window` any more: the root passes `win.matchMedia`. A window whose system asks
      // for reduction must reach the motion panel — a root that passed a constant `false` would switch the scene back on
      // at the reset for exactly the child who asked for less.
      const reduce = new Proxy(window, {
        get: (t, p) => {
          if (p === 'matchMedia') return (q) => ({ matches: q === '(prefers-reduced-motion: reduce)' });
          const v = Reflect.get(t, p);
          // a method runs on the REAL window, or the browser answers «Illegal invocation» (see `platform/listener-scope`)
          return typeof v === 'function' && !Object.hasOwn(v, 'prototype') ? v.bind(t) : v;
        },
      });
      // The reset STORES what it restores: the keys it writes are put back, so the next cases start where they did.
      const written = ['inclusionist.reducedmotion.v1', 'incl_rmWalk_p0', 'incl_rmBreath_p0', 'incl_rmFlavor_p0'];
      const before = written.map((k) => localStorage.getItem(k));
      try {
        const motor = abrir({ host: { doc: document, win: reduce } });
        motor.pause.show(0);
        document.querySelector('#vp-pause-0 .pm-btn[data-act="anim"]').click();
        document.querySelector('#animation-reset').click();
        const scene = [...document.querySelectorAll('#motion-list [data-rm]')];
        expect(scene.length, 'the motion panel has no scene rows').toBeGreaterThan(0);
        // The switch shows «animated»: after the reset on a reduce machine, every scene row is OFF.
        for (const b of scene) expect(b.getAttribute('aria-pressed'), `${b.dataset.rm} came back animated`).toBe('false');
      } finally {
        written.forEach((k, i) => { if (before[i] === null) localStorage.removeItem(k); else localStorage.setItem(k, before[i]); });
      }
    });

    it('🔴 [Right] opening a panel says where the child is in the root\'s language — no raw key (ADR-0232 D3)', async () => {
      // `ui/where-the-child-is` names the panel and the item under the cursor through the `t` its ctx receives; the root
      // hands it its translator's. Either one dropping it would read a key such as `sr.papel.interruptor` to a blind child.
      const motor = abrir();
      motor.pause.show(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="anim"]').click();
      const status = document.querySelector('#sr-status');
      let said = '';
      for (let i = 0; i < 40; i++) { said = status.textContent; if (/\d de \d/.test(said)) break; await new Promise((r) => { setTimeout(r, 10); }); }
      expect(said, 'the panel opened and nothing said where the child is').toMatch(/\d de \d/);
      expect(said, 'where-the-child-is spoke a raw key').not.toMatch(/\b(sr|state)\.[a-z]/);
      document.getElementById('animation-close')?.click();
    });

    it('🔴 [Right] the sonar speaks the root\'s language — the root hands it its translator\'s `t` (ADR-0232 D3)', async () => {
      // The sonar no longer imports `t`; what it says comes from the `t` its ctx receives. A root that handed it anything
      // else would read a raw key to a blind child.
      const motor = abrir();
      const status = document.querySelector('#sr-status');
      motor.sonar.sonar({ i: 0, x: 0, y: 0 });
      for (let i = 0; i < 40 && !status.textContent; i++) await new Promise((r) => { setTimeout(r, 10); });
      expect(status.textContent, 'the sonar said nothing — this case would measure nothing').not.toBe('');
      expect(status.textContent, 'the sonar spoke a raw key').not.toMatch(/\bsr\.nav\./);
    });

    it('🔴 [Right] the handle answers the spoken index from the settings store, LIVE (ADR-0044 item 3; ADR-0232 D2c)', async () => {
      // A game that announces its own items — the demo quiz does — asks the engine instead of reading `core/state` by import.
      const state = await import('../app/js/core/state.js');
      const motor = abrir();
      const before = state.menuIndexOn;
      try {
        state.setMenuIndexOnValue(false);
        expect(motor.menuIndexOn(), 'the handle kept saying the index is on').toBe(false);
        state.setMenuIndexOnValue(true);
        expect(motor.menuIndexOn(), 'the handle did not follow the store back on').toBe(true);
      } finally {
        state.setMenuIndexOnValue(before);
      }
    });

    it('🔴 [Right] ONE set of reduced-motion flags: the calm mode the quick bar sets is what the motion panel shows and keeps', () => {
      // The quick bar's calm icon and the motion panel both write the scene flags. Each used to build its own copy from
      // storage, so the panel showed the scene still animated after the bar reduced it, and its next switch stored its stale
      // copy over the calm mode — the child's choice undone by a neighbouring row. The root builds ONE object for both.
      const before = new Map(Object.entries({ ...localStorage }));
      try {
        const motor = abrir();
        document.querySelector('#title-icons [data-pi="tea"]').click(); // calm level 1: the scene's motion is reduced
        motor.pause.show(0);
        document.querySelector('#vp-pause-0 .pm-btn[data-act="anim"]').click();
        const scene = [...document.querySelectorAll('#motion-list [data-rm]')];
        expect(scene.length, 'the motion panel has no scene rows').toBe(4);
        for (const b of scene) {
          expect(b.getAttribute('aria-pressed'), `${b.dataset.rm} still shows animated after the calm mode reduced it`).toBe('false');
        }
        // one row switched back on keeps the other three where the calm mode put them
        document.querySelector('#motion-list [data-rm="parallax"]').click();
        const stored = JSON.parse(localStorage.getItem('inclusionist.reducedmotion.v1'));
        expect(stored, 'the panel stored its own copy over the calm mode').toEqual({ parallax: false, decor: true, items: true, particles: true });
      } finally {
        for (const k of Object.keys({ ...localStorage })) if (!before.has(k)) localStorage.removeItem(k);
        for (const [k, v] of before) localStorage.setItem(k, v);
      }
    });

    it('🎯 [Right] o painel AUDITIVO abre com os seus controles, cada um com a tag certa', () => {
      // The biggest panel: nodes it reached and never created. What is measured here is the whole path — pause item,
      // engine table, `open()`, `renderAudio()` — and that the tag survived it.
      const motor = abrir();
      motor.pause.show(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]');
      expect(item, 'o item de acessibilidade auditiva nem foi montado').not.toBeNull();
      expect(item.hidden).toBe(false);

      item.click();
      expect(document.querySelector('#audio').hidden, 'o clique não revelou o painel').toBe(false);
      expect(document.querySelector('#cane-div').tagName, 'a bengala não é uma escolha').toBe('SELECT');
      expect(document.querySelector('#tts-vol').type, 'o volume da narração não é um cursor').toBe('range');
      // and the navigation-sound list was FILLED by the panel: an empty group is finding 6 again
      expect([...document.querySelectorAll('#navsound-list [data-acat]')].map((b) => b.dataset.acat),
        'o painel abriu sem sonar, guarda e guia').toEqual(['sonar', 'guard', 'guide']);
      // 🔴 WHAT ADR-0151 TOOK OUT OF THIS PANEL, asserted ABSENT inside it
      const painel = document.querySelector('#audio');
      for (const sel of ['#audio-master', '#audio-master-vol', '#navsound-master', '[data-acat="music"]']) {
        expect(painel.querySelector(sel), `${sel} continua na acessibilidade auditiva`).toBeNull();
      }

      // ⚠️ AND THE STATIC CONTROLS ARE WIRED — the order rule, measured in what it produces. `initSettingsAudio` wires them
      // ONCE, at boot; with the inside mounted AFTER, there would be buttons in the document with no listener at all.
      // Without this piece the order mutation survived.
      const indice = document.querySelector('#opt-menuindex');
      const antes = indice.getAttribute('aria-pressed');
      indice.click();
      expect(document.querySelector('#opt-menuindex').getAttribute('aria-pressed'),
        'o clique no índice falado não fez nada — o interior montou DEPOIS do `init`').not.toBe(antes);
      indice.click(); // gives it back: the index is module state
    });

    it('🎯 [Right] o painel ÁUDIO abre pelo submenu, com o SOM GERAL e as quatro categorias de gosto (ADR-0151)', () => {
      const motor = abrir();
      motor.pause.show(0);
      const item = document.querySelector('#vp-pause-0 .pm-btn[data-act="som"]');
      expect(item, 'o item «Áudio» nem foi montado').not.toBeNull();
      expect(item.hidden, 'o item «Áudio» está escondido: a engine não o acciona').toBe(false);
      item.click();
      expect(document.querySelector('#som').hidden, 'o clique não revelou o painel Áudio').toBe(false);
      expect([...document.querySelectorAll('#som #audio-list [data-acat]')].map((b) => b.dataset.acat),
        'as categorias de gosto não são as quatro — ou `other` voltou').toEqual(['music', 'ambient', 'interact', 'earcons']);
      // «toggle + barra para som geral voltam» — and WIRED before the `init`, by the same order rule
      expect(document.querySelector('#som #audio-master-vol')?.type, 'o volume geral não voltou').toBe('range');
      const mestre = document.querySelector('#som #audio-master');
      const antesDoSom = mestre.getAttribute('aria-pressed');
      mestre.click();
      expect(document.querySelector('#audio-master').getAttribute('aria-pressed'),
        'o clique no som geral não fez nada — o painel montou DEPOIS do `init`').not.toBe(antesDoSom);
      mestre.click();
    });

    it('🔴 [Right] EVERY panel of the submenu opens on «Voltar», item 1, and ends on its reset — no close after the rows (ADR-0158)', () => {
      // 📏 Measured in dist before this case: the hearing panel appended its rows AFTER the actions, so the reset sat
      // between «Voltar» and the first row. The shell alone cannot promise the order; the interiors can break it.
      const motor = abrir();
      for (const [act, id] of [['anim', 'animation'], ['audio', 'audio'], ['som', 'som'], ['motora', 'motora'], ['visual', 'visual'], ['empatia', 'empathy']]) {
        motor.pause.show(0);
        const item = document.querySelector(`#vp-pause-0 .pm-btn[data-act="${act}"]`);
        expect(item?.hidden, `the «${act}» item is not live — the case would skip it`).toBe(false);
        item.click();
        const card = document.querySelector(`#${id} .overlay__card`);
        expect(card, `#${id} did not open`).not.toBeNull();
        const botoes = [...card.querySelectorAll('button')].filter((b) => !b.closest('.opt-explain'));
        expect(botoes[0]?.id, `#${id}: «Voltar» is not item 1`).toBe(`${id}-close`);
        expect(botoes.at(-1)?.id, `#${id}: something comes after the reset`).toBe(`${id}-reset`);
        expect(document.activeElement?.id, `#${id} opened with the cursor away from «Voltar»`).toBe(`${id}-close`);
        document.getElementById(`${id}-close`).click();
      }
    });

    it('🔴 [Zero] NO row of an engine panel carries an explanation in parentheses — it belongs to the footer (ADR-0158)', () => {
      // The Dev: «Você está colocando entre parênteses informações que deveriam ir para o rodapé.» Read as the child
      // sees it: after the panel's own render and `fillExplain`, the text left INSIDE each visible row, hints excluded
      // (a hint is in the footer by then, or hidden until it moves there).
      const motor = abrir();
      const achados = [];
      for (const [act, id] of [['anim', 'animation'], ['audio', 'audio'], ['som', 'som'], ['motora', 'motora'], ['visual', 'visual'], ['empatia', 'empathy']]) {
        motor.pause.show(0);
        document.querySelector(`#vp-pause-0 .pm-btn[data-act="${act}"]`).click();
        for (const linha of document.querySelectorAll(`#${id} .ctrl-row`)) {
          if (!linha.offsetParent) continue;
          const copia = linha.cloneNode(true);
          copia.querySelectorAll('.opt-hint').forEach((h) => h.remove());
          const texto = copia.textContent.replace(/\s+/g, ' ').trim();
          if (/\(/.test(texto)) achados.push(`#${id}: «${texto}»`);
        }
        document.getElementById(`${id}-close`).click();
      }
      expect(achados, achados.join(' · ')).toEqual([]);
    });

    it('🔴 [Right] ligar o TTS pelo ÍCONE refresca o painel — o guarda morto do monólito voltou a valer', () => {
      // ⚠️ `ui/pause-icons` documents the defect and kept it verbatim: in the monolith this call sat behind
      // `typeof reflectTTS === 'function'`, a symbol that no longer existed, «so it never fires». The
      // `reflectTtsPanelEnabled` field exists to switch it back on, and now there is a panel to refresh.
      //
      // 📌 Without it, the child turns narration on with the 🗣 icon and the panel goes on saying it is off — the family of
      // a control lying about its state.
      const motor = abrir();
      motor.pause.show(0);
      document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
      const botao = document.querySelector('#opt-tts');
      const antes = botao.getAttribute('aria-pressed');

      // the first screen bar's icon, which is another surface of the SAME engine
      const icone = document.querySelector('#title-icons [data-pi="tts"]');
      expect(icone, 'o ícone de narração não está na barra: o caso não mede nada').not.toBeNull();
      icone.click();

      expect(document.querySelector('#opt-tts').getAttribute('aria-pressed'),
        'o ícone mudou o estado e o painel continua a anunciar o anterior').not.toBe(antes);
    });

    it('🔴 [Boundary] hospedeiro FORA de `#game-region` vira linha em `problems`, e não silêncio', () => {
      // ⚠️ THIS IS THE CASE OF SILENCE. `ui/settings-panel.topVisibleOverlay` scans `'#game-region .overlay'`, and that is
      // how `ui/menu-nav` finds the top dialog to move with the arrows. A panel hung outside that scope OPENS and closes
      // with Escape — and the arrows do not move inside it, with no error anywhere.
      const fora = document.createElement('div');
      fora.id = 'fora-da-regiao';
      raiz.appendChild(fora); // a sibling of #game-region, not a child
      const motor = abrir({ host: { doc: document, win: window, pauseHost: fora } });

      const linha = motor.problems.find((p) => p.includes('#game-region'));
      expect(linha, 'a engine montou fora do escopo dos overlays e calou-se').toBeTruthy();
      expect(linha, 'a linha tem de nomear a saída, ou é queixa em vez de conserto').toMatch(/pauseHost/);
      // And the gap is SAID, not faked: the panel really was mounted where the game said.
      // (The typography panel is gone since ADR-0151; the visual-sensitivity one measures the same.)
      expect(fora.querySelector('#animation'), 'acusou e não montou — pior do que montar e calar').not.toBeNull();
    });

    it('🎯 [Zero] DOIS cartuchos em sequência deixam UM de cada — o terceiro gate do ADR-0139', () => {
      // ⚠️ The gate existed as a sentence and not as a count. With the panels mounted, one bar became one bar, one card and
      // the panels — and a `mount()` that one day started remounting them would leave two of each, the second stealing
      // the first's ids.
      const motor = abrir();
      motor.mount(declaracaoValida(), { accommodations: SEM_ASSUNTO });
      motor.mount(declaracaoValida(), { accommodations: SEM_ASSUNTO });

      expect(document.querySelectorAll('#title-icons').length).toBe(1);
      expect(document.querySelectorAll('[id^="vp-pause-"]').length, 'sobrou mais de um cartão de pausa').toBe(1);
      for (const id of ['animation', 'audio']) {
        expect(document.querySelectorAll('#' + id).length, `#${id} ficou duplicado`).toBe(1);
      }
      // and the bar did not grow a second row of icons inside itself
      const porIcone = [...document.querySelectorAll('#title-icons [data-pi]')].map((b) => b.dataset.pi);
      expect(new Set(porIcone).size, 'a barra remontou por cima de si mesma').toBe(porIcone.length);
    });

    it('🔴 [Inverse] `unmount` NÃO leva a acessibilidade — ela é da PÁGINA, não do cartucho (ADR-0038)', () => {
      // ⚠️ THIS CASE ASSERTS AN ABSENCE OF EFFECT, the half a teardown forgets. ADR-0038 cuts state into PAGE / ROUND /
      // GAME, and the bar, the card and the panels are the PAGE's: a child who changed game cannot lose blind mode, the
      // typography and the pause on the way.
      //
      // 📌 What `unmount` releases is what is the cartridge's — mappings, reach notice, scene stack —, and that already
      // has cases in the node file. What is guarded here is what it may NOT touch.
      const motor = abrir();
      motor.unmount();

      expect(document.querySelector('#title-icons [data-pi]'), 'a barra de acessibilidade saiu com o cartucho')
        .not.toBeNull();
      expect(document.querySelector('#vp-pause-0'), 'o cartão de pausa saiu com o cartucho').not.toBeNull();
      for (const id of ['animation', 'audio']) {
        expect(document.getElementById(id), `#${id} saiu com o cartucho`).not.toBeNull();
      }
      // and what remains still OPENS: a panel that stays in the document and stops answering is worse than one that leaves
      motor.pause.show(0);
      // Since ADR-0151 typography has no door: the panel that OPENS for the measurement is the hearing one.
      document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
      expect(document.querySelector('#audio').hidden, 'o painel sobreviveu ao `unmount` e deixou de abrir')
        .toBe(false);
    });

    it('🎯 [Zero] com hospedeiro DENTRO da região, `problems` não inventa a lacuna', () => {
      // The pair of the case above, and without it the check would approve an engine that always accuses.
      const motor = abrir();
      expect(motor.problems.filter((p) => p.includes('#game-region') && p.includes('setas')),
        'acusou o escopo dos overlays com o hospedeiro no sítio certo').toEqual([]);
    });
  });

  /*
   * 🔴 THIS CASE WAS BORN IN THE BROWSER, and the defect was served on a page: with the microphone refused,
   * `ui/voice-control` told the child that it did not open and put the stored key back to off — and the button went on
   * saying `Comando de voz: ligado`. A control that lies about its state is worse than one icon fewer (ADR-0106 §5).
   *
   * ⚠️ AND THE CLICK PATH DOES NOT COVER THIS: `iconAct` reflects right after itself. What was missing was the subscription,
   * which is how a change from OUTSIDE the bar arrives — the same line the 📷 has had since ADR-0215.
   *
   * 📌 Its position in the file no longer matters: the roots a case opens are disposed of in `afterEach`, so a case that
   * opens one more root no longer shifts another case's cursor.
   */
  it('🔴 [Zero] ligado o 👄 onde nada consegue começar, o botão VOLTA a dizer desligado', async () => {
    const estado = await import('../app/js/core/state.js');
    abrir();
    expect(document.querySelector('#title-icons [data-pi="voice"]'), 'o 👄 não está na barra desta raiz').not.toBeNull();
    estado.setVoiceControlValue(true);
    expect(document.querySelector('#title-icons [data-pi="voice"]').getAttribute('aria-pressed'),
      'a barra não seguiu a escolha da criança').toBe('true');
    // there is no delivery nor microphone here: `ui/voice-control` fails, says why and puts the key back to off
    for (let i = 0; i < 120 && estado.voiceControl; i++) await new Promise((r) => { setTimeout(r, 10); });
    expect(estado.voiceControl, 'o comando de voz ficou ligado sobre um reconhecedor que nunca abriu').toBe(false);
    const depois = document.querySelector('#title-icons [data-pi="voice"]');
    expect(depois.getAttribute('aria-pressed'), 'o botão ficou a dizer que o comando de voz está ligado').toBe('false');
    expect(depois.getAttribute('aria-label')).toBe('Comando de voz: desligado');
  });

  it('🔴 [Right] the 📷 that cannot start tells the child why in the root\'s language — the root hands the camera controls its `t` (ADR-0232 D3)', async () => {
    // The face control no longer imports `t`: what it says comes from the `t` the root puts in its deps. There are no heavy
    // files here, so it fails, says why and turns the 📷 back off — and a root that handed it anything else would read the
    // key `sr.face.…` to the child.
    const estado = await import('../app/js/core/state.js');
    abrir();
    const alerta = document.querySelector('#sr-alert');
    alerta.textContent = '';
    try {
      estado.setCameraControlValue('face');
      for (let i = 0; i < 200 && estado.cameraControl !== 'off'; i++) await new Promise((r) => { setTimeout(r, 10); });
      for (let i = 0; i < 40 && !alerta.textContent; i++) await new Promise((r) => { setTimeout(r, 10); });
      expect(alerta.textContent, 'the 📷 failed and said nothing — this case would measure nothing').not.toBe('');
      expect(alerta.textContent, 'the face control spoke a raw key').not.toMatch(/\bsr\.face\./);
    } finally {
      estado.setCameraControlValue('off');
    }
  });

  /*
   * 🔴 SWITCHED TO A LANGUAGE WHOSE COMMAND MODEL IS NOT IN THE DELIVERY (ADR-0225, ADR-0169). The heavy files are chosen at
   * boot for the boot language, so the flag can reach a language the delivery never carried. The child hears why the 👄 went
   * off; `problems` names the missing model AND the fix for that language — the path runs from `i18n:change` on the window
   * through `languageChanged` to the root's diagnostic channel, which the node double cannot walk (it has no microphone, so
   * the 👄 is never mounted there).
   */
  it('🔴 [Zero] switched to a language whose command model did not come, `problems` says which and how to put it in the delivery', async () => {
    const estado = await import('../app/js/core/state.js');
    const { setLocale, t } = await import('../app/js/core/i18n.js');
    const motor = abrir();
    try {
      await setLocale('en');
      estado.setVoiceControlValue(true);
      // 📌 WAITED ON THE LINE, not on the key: the line is what this case measures, and the key going off is only its echo.
      // (A disposed root no longer hears `voiceControl` — ADR-0220, `a-disposed-root-stops-listening.browser.test.js`.)
      const said = () => motor.problems.find((p) => p.startsWith('voice control:'));
      for (let i = 0; i < 200 && !said(); i++) await new Promise((r) => { setTimeout(r, 10); });
      expect(estado.voiceControl, 'the 👄 stayed on over a model that is not here').toBe(false);
      const line = said();
      expect(line, 'no line in `problems` explains why the 👄 did not start').toBeTruthy();
      expect(line, 'the line does not name the model of the new language').toContain('commands:model:en');
      expect(line, 'the line does not say how to put that model in the delivery').toContain('npx inclusionist-heavy --commands en');
      // `srAlert` empties the region and writes the sentence on the NEXT frame (`core/a11y-sr`), so it is read a frame later.
      await new Promise((r) => { requestAnimationFrame(() => requestAnimationFrame(r)); });
      expect(document.querySelector('#sr-alert').textContent, 'the child did not hear why')
        .toBe(t('sr.voice.needsInternet'));
    } finally {
      await setLocale('pt');
    }
  });
});

// ========================= MUTATIONS CHECKED =========================
// Six, applied by script to the file and always with an occurrence count.
//
//   1. ⚠️ `getBlindMode` going back to `() => false` -> TWO fail. It is not an invented mutation: it is the STATE THE CODE
//      WAS IN when this file was born. The rest of the suite stays green with it applied, the exact measure of how much
//      the double did not reach.
//   2. the bar mounting EMPTY markup -> FIVE fail. It is this file's vacuum case: without a bar, almost everything it
//      asserts loses its subject, and a check that finds nothing proves no absence.
//   3. the card with another id -> TWO fail. The engine looks for `#vp-pause-0`; mounting under another name reopens the
//      loop step 2 closed, silently.
//   4. `show` not revealing -> ONE fails. Mounting is not showing, and the distinction must cost something.
//   5. the DECLARED host ignored -> ONE fails. The engine does not guess where the bar fits in someone else's game.
//   6. `tabindex="-1"` on the icons -> ONE fails. It is step 2's argument paying off: on the first screen nobody is
//      playing, and taking the icons out of the tab order hides them from whoever navigates by keyboard.
//
// ========================= AND SEVEN MORE, BY THE PANELS =========================
// ⚠️ 7, 8, 10 and 11 were checked against the typography panel, which is no longer mounted (ADR-0151); the cases they
// failed now measure the visual-sensitivity panel.
//   7. the panel's action never entering the engine's table (`engineActions.tipo` deleted) -> FOUR fail. Without an
//      action, the §5 cascade hides the item, the `options` door closes over an empty room, and the child reaches the
//      pause and finds one button.
//   8. the engine's table not joining the cartridge's (`...engineActions` out of the merge) -> the same four. Two ways
//      for the same wiring to die, and both had to cost.
//   9. the CARTRIDGE no longer overriding the engine (merge order swapped) -> ONE fails, and only one. ADR-0122 makes the
//      pause EXISTING non-declinable; it does not make the engine the owner of every item in it.
//  10. the panel's `init` running BEFORE the shell enters the document -> ONE fails: the reset. `initSettingsTypo` wires
//      `#typo-reset` once, at boot, and the inverted order leaves a button in the document with no listener at all —
//      dead looking alive (ADR-0106 §5). The ORDER of the two calls is the decision.
//  11. the sample not entering the card -> TWO fail. A font menu with no sample does not answer the only question it
//      exists to answer, and that is not answered by a font's name.
//  12. `insideScope` always TRUE -> fails the host-outside-the-region case: the engine goes quiet again about a panel where
//      the arrows do not move.
//  13. `insideScope` always FALSE -> fails its pair. Without this one, the check would approve an engine that always
//      accuses, as useless as one that never does.
//  14. (ADR-0158) the hearing panel's rows appended AFTER the actions again -> the «Voltar first» case is red: the reset
//      sits between «Voltar» and the first row again, as measured in dist.
//      ⚠️ The twin in the «Áudio» interior (its list appended after the actions) SURVIVES: under the shell the list is
//      already a child of the card, so that line only runs for a card without the shell.

// ---- ADR-0159 rule 7 in the empathy panel (2026-09-12) ----
//   S1 an explicit put-back of a refused choice    ✅ SURVIVED: the render writes the list from the world — removed
//   S2 the list speaks over the refusal (menu-nav)  🔴 the refusal case
//   S3 the list does not follow the world on opening 🔴 the reopen step

// ---- ADR-0148 check counts only what paints (2026-09-12) ----
//   V1 every intersecting box counts                  🔴 the container case
//   V2 a node's own text does not count               🔴 the title case
//   V3 a painted background does not count            🔴 the painted-box case
//   V4 excluding the engine's own nodes              ✅ SURVIVED: the check runs at boot, cards hidden — the exclusion was removed

// ---- ADR-0232 one set of scene reduced-motion flags, built by the root ----
//   R1 the shared flags withheld from the motion panel    🔴 the «ONE set of reduced-motion flags» case
//   R2 the shared flags withheld from the quick bar       🔴 the same case: each writer back on its own copy
