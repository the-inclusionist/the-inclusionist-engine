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
 */
