// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MOUNTED PAUSE CARD DOES NOT EAT THE GAME'S KEYS — only the OPEN card owns the keyboard.
//
// ========================= WHY THIS FILE EXISTS, AND IT IS A STORY OF METHOD =========================
// 🔴 A sentence written in a consumer's code became the premise of an accepted record without ever being measured.
// `pixi-15-puzzle` wrote beside its own declaration: «if `semMenuDePausa` were omitted, every arrow, Enter and Space would
// start being eaten the moment anything created an element with a pause id». It was cited in ADR-0121, which reverted
// retiring the field because of it.
//
// 📏 MEASURED AFTERWARDS, it is true of the OPEN card and false of the MOUNTED card:
//
//   · `ui/menu-nav`, the keydown handler — `if (menu && !menu.hidden) { consume(e); navPause(menu, pi, k); }`
//   · `input/gamepad` — the same guard, on the other transport
//   · `ui/pause-icons`, `buildScreenPause` — `sp.hidden = true`: the card is born hidden
//
// ⚠️ AND THAT DIFFERENCE IS WHAT DECIDED ADR-0122: with it, adopting the engine's pause does not take the arrows from a
// game played with arrows, and the pause menu belongs to the engine in every game — which is the Dev's rule.
//
// 📌 THIS HAS TO BE A BROWSER CASE and not a node one, and the reason is the defect itself: what is asserted is the
// PROPAGATION of an event through a real document — capture on `window`, `preventDefault`, and a game listener further
// down the tree. A fake DOM answers whatever the double tells it to, and this file was born from a claim nobody had
// exercised.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let createGame;
let raiz;
let motor;
let vistas;
let ouvinteDoJogo;

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

/** The key as the game sees it: dispatched on the game region, bubbling up to whoever listens. */
function apertar(code) {
  const alvo = raiz.querySelector('#game-region');
  const ev = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true });
  alvo.dispatchEvent(ev);
  return ev;
}

beforeEach(async () => {
  ({ createGame } = await import('../app/js/boot/create-game.js'));
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);

  // 📌 AND THE ROOT TURNS NAVIGATION ON BY ITSELF — `nav.attach()` in `boot/create-game`. Calling `motor.nav.attach()` here
  // again would do nothing: `attach` always passes the SAME function with the same capture flag, and the DOM does not
  // register the same listener twice (mutation 3).
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracaoValida(), host: { doc: document, win: window }, downloadHeavy: false });

  // The GAME's listener: an arrow is a game command, and it is the game that loses it when someone consumes it first.
  vistas = [];
  ouvinteDoJogo = (e) => vistas.push(e.code);
  raiz.querySelector('#game-region').addEventListener('keydown', ouvinteDoJogo);
});

afterEach(() => {
  raiz.querySelector('#game-region')?.removeEventListener('keydown', ouvinteDoJogo);
  raiz.remove();
});

describe('o cartão de pausa que a engine monta', () => {
  it('🔴 [Zero] MONTADO e escondido: a seta chega ao jogo e ninguém a cancela', () => {
    const cartao = document.getElementById('vp-pause-0');
    expect(cartao, 'o cartão não montou; o caso mediria a ausência dele e não a guarda').not.toBeNull();
    // 📌 And it mounted WITH NO decline at all — `semMenuDePausa` left the contract (ADR-0122), and with a `#game-region`
    // present the root has nothing to complain about.
    expect(motor.problems.filter((p) => p.includes('pausa')), 'a pausa acusou com hospedeiro válido').toEqual([]);
    expect(cartao.hidden, 'o cartão tem de NASCER escondido — é essa a metade que a citação ignorava').toBe(true);

    const ev = apertar('ArrowRight');

    expect(vistas, 'a seta não chegou ao jogo: o cartão montado comeu-a').toContain('ArrowRight');
    expect(ev.defaultPrevented, 'alguém cancelou a seta com o menu fechado').toBe(false);
  });

  it('⚠️ ABERTO: a MESMA seta é consumida — um menu aberto é dono do teclado, e isso é o certo', () => {
    const cartao = document.getElementById('vp-pause-0');
    cartao.hidden = false;

    const ev = apertar('ArrowRight');

    expect(ev.defaultPrevented, 'com o menu ABERTO a seta tinha de ser consumida pela navegação').toBe(true);
    expect(vistas, 'a seta desceu ao jogo por baixo de um menu aberto').not.toContain('ArrowRight');
  });

  it('📌 [Boundary] as teclas de JOGO que a citação nomeia — seta e Space — passam com o cartão fechado', () => {
    for (const code of ['ArrowLeft', 'ArrowUp', 'Space']) {
      const ev = apertar(code);
      expect(ev.defaultPrevented, `${code} foi cancelada com o menu fechado`).toBe(false);
      expect(vistas, `${code} não chegou ao jogo`).toContain(code);
    }
  });

  it('⚠️ `Enter` SAIU dessa lista por DECISÃO e não por regressão — ele é `start` (ADR-0144, ADR-0155)', () => {
    /*
     * 🔴 THIS CASE WAS THE FOURTH KEY OF THE CASE ABOVE, and it is worth saying why it left, instead of the number
     * changing in silence. The quote that founded this file named «every arrow, Enter and Space», and what it accused was
     * the MOUNTED card eating keys through menu navigation. That is still true and still measured — the arrow and `Space`
     * above.
     *
     * 🎯 WHAT CHANGED IS SOMETHING ELSE, AND IT IS A DECISION: since ADR-0144 the engine listens to the `start` ACTION and
     * pauses with it — since ADR-0155, the QUICK PAUSE (PAUSED and the bar), no longer the card. The solo scheme puts
     * `start` on `KeyH` AND `Enter` (`input/default-bindings`), and the note there explains that `Enter` was chosen
     * because it ALREADY paused (`PAUSE_KEYS = {Escape, Enter}`) — declaring it described what the key had done for
     * years, it did not give it new work.
     *
     * ⚠️ AND THE CAUSE IS NOT THE DEFECT THIS FILE GUARDS, which is why the case lives here: the card was HIDDEN when the
     * key arrived. What consumed it was the pause hook, on purpose, and not menu navigation running over a card nobody
     * opened.
     */
    const cartao = document.getElementById('vp-pause-0');
    expect(cartao.hidden, 'o cartão já estava aberto: o caso mediria a navegação e não o gancho').toBe(true);

    const ev = apertar('Enter');

    const pausado = document.querySelector('#game-region .pausa-rapida');
    expect(pausado?.hidden, '`Enter` está em `start` e não pausou').toBe(false);
    expect(cartao.hidden, 'o START abriu o cartão de menus, que é do SELECT desde o ADR-0155').toBe(true);
    expect(ev.defaultPrevented, 'a engine pausou e deixou a tecla seguir para o jogo por baixo').toBe(true);
  });
});

// ================================ MUTATIONS CHECKED ================================
// 1. removing `&& !menu.hidden` from `ui/menu-nav.ts:485`  → [Zero] and [Boundary] fail (2 of 3): the mounted card starts
//    eating the four keys, which is EXACTLY the 15-puzzle's sentence coming true. It is the mutation that proves this file
//    measures the guard, and not chance.
// 2. `sp.hidden = true` → `false` in `buildScreenPause`  → [Zero] and [Boundary] fail: being born hidden is the other half
//    of the same promise, and without it the guard of mutation 1 never gets to protect anything.
// 3. 🔴 SURVIVED, AND FOUND A FACT INSTEAD OF A HOLE. The first version of this file called `motor.nav.attach()` in the
//    `beforeEach`, with a comment saying the root does not turn navigation on by itself — copied from `pixi-15-puzzle`,
//    which writes `engine.nav.attach(); // createGame does not`. Removing it left the three cases GREEN. Measured: the
//    root DOES turn it on (`create-game.ts:729`, `dfaec02`, contained in `v7.0.1`), and a second call registers no
//    listener at all — same function, same capture flag. The line left, and the equivalent line in the 15-puzzle is
//    noise the migration to 8.0.0 can clean.
//    ⚠️ A mutation that cannot fail is not proof of coverage; it stays recorded for having measured something else, which
//    is what mutation 1 of `viz-setters` already taught in this repository.
