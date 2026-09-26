// SPDX-License-Identifier: AGPL-3.0-or-later
// PLAYING WITH ONE BUTTON, END TO END (ADR-0218, issue #201) — the Dev: «vamos ciclar entre controle padrão > teclas de
// aderência > jogar com um botão só».
//
// The scan's rule is measured without a browser in `switch-scan.node`. What is measured HERE is the half that only exists once
// it is wired: that a press stops meaning what it meant, that it takes what is showing instead, that what is showing is on the
// screen in the GAME's words, and that with the scan off nothing of this happens.
//
// 🔴 THE ORDER OF THE LISTENERS IS PART OF THE BEHAVIOUR. One press must do ONE thing, so the interception is registered above
// the menu navigation: registered below it, the menu would move AND the scan would take. That is why the menu case is here.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js'; // a game declares KEYS of its dictionary (ADR-0232 D3)
import pt from '../app/js/i18n/pt.js';
import { SWITCH_SCAN_DEFAULTS } from '../app/js/input/switch-scan.js';
// ⚠️ THE ENGINE'S STYLESHEET IS LOADED, and without it this file would measure something else: the scan notice is positioned BY
// CSS, so without the sheet it is born at the top of the region and the reserved-room case would have nothing to see.
import css from '../app/css/style.css?raw';

let motor;
/** The ROOT's settings store: the one its bar and its scan hear (ADR-0232 D4). */
let estado;
let raiz;
const comandos = [];
const assentos = [{ ctrl: 0 }];
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
// ⚠️ `action3` IS DECLARED AND NOT NAMED, on purpose: it is the position the scan must NOT offer (ADR-0074 — the chip says the
// game's words, and a position nobody named would cost the child a pass of silence).
const PRESET = { up: { label: 'Cima' }, down: { label: 'Baixo' }, action2: { label: 'Confirmar' }, action3: { label: '  ' } };
const PASSO = SWITCH_SCAN_DEFAULTS.stepMs;

/** The key of a position in the solo scheme, which is what a child's switch sends. */
const TECLA = { up: 'KeyW', down: 'KeyS', action2: 'KeyJ' };
/*
 * ⚠️ THE KEY IS DISPATCHED ON THE GAME REGION, not on the window, and that is the point, not a detail: an event dispatched ON the
 * window reaches its listeners «no alvo», where capture and bubble run in the same registration order — so a listener moved out
 * of the capture phase would go unnoticed. A real key is born on the focused element and RISES, and that is where the window's
 * capture runs first. A mutation survived for exactly this reason.
 */
const apertar = (code) => {
  const e = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true });
  (document.getElementById('game-region') ?? window).dispatchEvent(e);
  return e;
};
const chip = () => document.querySelector('#game-region .scan-now');

beforeAll(async () => {
  localStorage.removeItem('incl_switch_scan');
  const folha = document.createElement('style');
  folha.textContent = css;
  document.head.appendChild(folha);
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1" style="position:relative;width:640px;height:360px"><div id="title-icons"></div></div>';
  document.body.appendChild(raiz);
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window },
    downloadHeavy: false, players: assentos, ...keyed({ preset: PRESET }),
    onCommand: (c) => comandos.push(c),
  });
  estado = motor.settings;
});
afterAll(() => {
  estado.setSwitchScanValue(false);
  localStorage.removeItem('incl_switch_scan');
  motor?.unmount?.();
  raiz?.remove();
});
beforeEach(() => { comandos.length = 0; });

describe('with one button only, every press takes what is showing', () => {
  it('🔴 [Zero] with the scan OFF, a key reaches the game as itself and nothing is shown', () => {
    estado.setSwitchScanValue(false);
    apertar(TECLA.up);
    expect(comandos.map((c) => `${c.action}:${c.pressed}`), 'the scan swallowed a key while it was off')
      .toEqual(['up:true']);
    expect(chip()?.hidden, 'the chip is on screen with the scan off').not.toBe(false);
  });

  it('🔴 [Right] with it ON, the same key no longer means «up» — it takes what the chip is showing', async () => {
    estado.setSwitchScanValue(true);
    // The pass opens on «cancelar», which is the item a press that lands by accident has to be able to mean.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(chip().hidden, 'nothing tells the child what is being offered').toBe(false);
    expect(chip().textContent).toBe(pt['scan.nothing']);

    apertar(TECLA.up);
    expect(comandos, 'a press on «cancelar» took something').toEqual([]);
    expect(comandos.length).toBe(0);
  });

  it('🔴 [Right] and what it takes is delivered to the game as that position — with the GAME\'s word on screen', async () => {
    estado.setSwitchScanValue(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    // Walk the pass to the first named position. The scan's clock is the page's, so the wait is real.
    await new Promise((r) => setTimeout(r, PASSO + 60));
    expect(chip().textContent, 'the chip is not saying the game\'s own word').toBe('Cima');

    apertar(TECLA.action2); // ⚠️ ANY key: the child has one switch, and which one it is means nothing here
    expect(comandos.map((c) => `${c.action}:${c.pressed}`), 'the press did not take the position being offered')
      .toEqual(['up:true']);
    // 📌 AND THE PASS STARTS OVER, on screen: the press frame still shows what it TOOK — which is the only feedback she gets
    // that it landed — and the very next frame is back on «cancelar», so a hand that bounces takes nothing.
    expect(chip().textContent, 'the chip did not show what the press took').toBe('Cima');
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(chip().textContent, 'the pass went on from where it was taken instead of starting over').toBe(pt['scan.nothing']);
    // and it is let go by itself: a scan press is a tap, not a hand holding a button down
    await new Promise((r) => setTimeout(r, SWITCH_SCAN_DEFAULTS.pulseMs + 60));
    expect(comandos.map((c) => `${c.action}:${c.pressed}`)).toEqual(['up:true', 'up:false']);
  });

  it('🔴 [Zero] a position the game declared but never NAMED is not offered at all', async () => {
    estado.setSwitchScanValue(true);
    const vistos = new Set();
    for (let i = 0; i <= 6; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 30 : PASSO));
      vistos.add(chip().textContent);
    }
    // 📌 The three named ones, «cancelar» and the engine's two doors — `action3` is declared in the preset and has no word, so it
    // never shows.
    expect([...vistos].sort())
      .toEqual([pt['scan.nothing'], 'Baixo', 'Cima', 'Confirmar', pt['scan.door.menus'], pt['scan.door.pause']].sort());
  }, 15_000);

  it('🔴 [Right] a key HELD does not take an item at every repeat', async () => {
    estado.setSwitchScanValue(true);
    await new Promise((r) => setTimeout(r, PASSO + 60));
    document.getElementById('game-region').dispatchEvent(new KeyboardEvent('keydown', { code: TECLA.up, repeat: true, bubbles: true, cancelable: true }));
    document.getElementById('game-region').dispatchEvent(new KeyboardEvent('keydown', { code: TECLA.up, repeat: true, bubbles: true, cancelable: true }));
    expect(comandos, 'a child who cannot let go took an item at every repeat').toEqual([]);
  });

  it('🔴 [Right] the press is stopped dead: nothing else in the page hears that key', () => {
    estado.setSwitchScanValue(true);
    const e = apertar(TECLA.down);
    expect(e.defaultPrevented, 'the key went on to mean something else as well').toBe(true);
  });

  /*
   * 🔴 FOUND IN THE BROWSER, NOT HERE: in the built quiz the notice «DIZER A RESPOSTA» fell ON TOP of the question. It is HUD, and
   * HUD that does not reserve its room is the engine writing over the game — the same rule ADR-0148 imposes the other way round,
   * and the same fix the icon-name line got (issue #160): the top band grows with what is in it.
   */
  it('🔴 [Right] o aviso RESERVA o espaço que ocupa, e devolve-o ao sair', async () => {
    const regiao = document.getElementById('game-region');
    const faixa = () => parseFloat(regiao.style.getPropertyValue('--barra-a11y-h')) || 0;
    estado.setSwitchScanValue(false);
    const sem = faixa();
    estado.setSwitchScanValue(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(faixa(), 'a faixa do topo não cresceu: o aviso é desenhado onde o jogo desenha').toBeGreaterThan(sem);
    expect(chip().getBoundingClientRect().bottom, 'o aviso termina fora da faixa que ele mesmo reservou')
      .toBeLessThanOrEqual(regiao.getBoundingClientRect().top + faixa() + 1);
    estado.setSwitchScanValue(false);
    expect(faixa(), 'o espaço do aviso não voltou para o jogo').toBe(sem);
  });

  it('🔴 [Many] MEDIR DUAS VEZES não move o aviso — é o laço que o `--scan-top` existe para quebrar', async () => {
    // 🔴 THIS is the case the `style.css` comment means by «apanhado por um caso». The defect is a LOOP — the notice pushes
    // the band, the band pushes the notice, and it walks down the screen at every measurement — and a loop is not seen in
    // one measurement (a probe on 22/09 found the suite green with the notice placed by the band). This case measures
    // twice and demands the same place.
    const regiao = document.getElementById('game-region');
    estado.setSwitchScanValue(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const topo = () => chip().getBoundingClientRect().top - regiao.getBoundingClientRect().top;
    const primeiro = topo();
    // ⚠️ THE SECOND MEASUREMENT MUST BE THE REAL ONE: the scan re-measures the band at every change of word, and that is
    // what makes the loop move. A synthetic `resize` does not serve — measured, it does not come through here, and with
    // it the case stayed GREEN over the mutation it exists to catch.
    for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, PASSO + 30));
    expect(topo(), 'o aviso andou entre duas medições: a faixa está a empurrá-lo').toBeCloseTo(primeiro, 0);
    // and what places it there is `--scan-top`, which does NOT depend on the notice — only the band does
    expect(parseFloat(regiao.style.getPropertyValue('--scan-top')), 'o aviso não tem onde se pousar').not.toBeNaN();
    estado.setSwitchScanValue(false);
  });

  it('🔴 [Zero] turning it off takes the chip away and gives the key back', async () => {
    estado.setSwitchScanValue(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    estado.setSwitchScanValue(false);
    expect(chip().hidden, 'the chip stayed on screen after the scan was turned off').toBe(true);
    apertar(TECLA.up);
    expect(comandos.map((c) => `${c.action}:${c.pressed}`), 'the key did not go back to meaning itself').toEqual(['up:true']);
  });
});

/*
 * ===================== INSIDE THE ENGINE'S MENUS (ADR-0218 erratum of 2026-09-26) =====================
 * 🔴 MEASURED before this: inside the quick pause, the card or a panel, a scan press did NOTHING. The switch's key is stopped dead
 * before any listener (above), and the press was handed to the virtual controller stamped `teclado`, which the menu-key
 * translator treats as a key already in the world and never re-sends. A child who opened the quick pause by scanning was
 * left in it. Now, with a menu in front, the pass is that menu's steps, and a press moves it through `ui/menu-nav`.
 *
 * 📌 The menus are opened here by the eyes (`motor.controller`), because this commit adds no door to the play list: the doors
 * are measured in their own cases below. The WAIT is real — the scan's clock is the page's — so each case waits for the word it
 * needs on the chip instead of counting steps.
 */
describe('inside the engine\'s menus, the scan steps the menu', () => {
  const LIMITE = 20_000;
  const pausadoAVista = () => { const w = document.querySelector('#game-region .pausa-rapida'); return !!w && w.hidden === false; };
  const cartaoAberto = () => document.getElementById('vp-pause-0')?.hidden === false;
  const icones = () => [...document.querySelectorAll('#title-icons .pi-btn')];
  const cursor = () => icones().findIndex((b) => b.classList.contains('pi-sel'));
  const tocar = (action) => { motor.controller.press(action, 'olhos', 0); motor.controller.release(action, 'olhos', 0); };
  const quadro = () => new Promise((r) => requestAnimationFrame(() => r(null)));
  /** Waits until the chip OFFERS `texto`, frame by frame, and fails naming the last word seen. */
  const quandoOferecer = async (texto) => {
    const fim = performance.now() + PASSO * 8;
    while (chip().textContent !== texto) {
      if (performance.now() > fim) throw new Error(`the chip never offered «${texto}» (last: «${chip().textContent}»)`);
      await quadro();
    }
  };
  const SWITCH = TECLA.up; // her one key: which one it is means nothing while scanning

  beforeEach(async () => {
    estado.setSwitchScanValue(true);
    motor.pause.hide(0);
    for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
    if (pausadoAVista()) tocar('start');
    await quadro();
    comandos.length = 0;
  });
  afterAll(() => {
    estado.setSwitchScanValue(false);
    motor.pause.hide(0);
    if (pausadoAVista()) tocar('start');
  });

  it('🔴 [Right] in the QUICK PAUSE the pass is the menu\'s steps, from «cancel», in the engine\'s words', async () => {
    tocar('start');
    expect(pausadoAVista(), 'the case would measure nothing: the quick pause did not open').toBe(true);
    await quadro();
    expect(chip().textContent, 'a menu just opened did not start at «cancel»').toBe(pt['scan.nothing']);
    const vistos = [];
    const fim = performance.now() + PASSO * 5 + 200;
    while (performance.now() < fim) {
      const agora = chip().textContent;
      if (vistos.at(-1) !== agora) vistos.push(agora);
      await quadro();
    }
    expect(vistos.slice(0, 5), 'the quick pause did not offer its own steps, in order')
      .toEqual([pt['scan.nothing'], pt['scan.menu.next'], pt['scan.menu.confirm'], pt['scan.menu.back'], pt['scan.menu.previous']]);
  }, LIMITE);

  it('🔴 [Right] «next» moves the bar\'s cursor one icon on, and «previous» moves it back', async () => {
    tocar('start');
    const antes = cursor();
    expect(antes, 'the quick pause put no cursor on the bar').toBeGreaterThanOrEqual(0);
    await quandoOferecer(pt['scan.menu.next']);
    apertar(SWITCH);
    expect(cursor(), '«next» did not move the bar').toBe((antes + 1) % icones().length);
    await quandoOferecer(pt['scan.menu.previous']);
    apertar(SWITCH);
    expect(cursor(), '«previous» did not move it back').toBe(antes);
    expect(comandos, 'the game heard the steps of a menu').toEqual([]);
  }, LIMITE);

  it('🔴 [Right] «back» LEAVES the quick pause — the trap measured before — and the pass is the game\'s again', async () => {
    tocar('start');
    await quandoOferecer(pt['scan.menu.back']);
    apertar(SWITCH);
    expect(pausadoAVista(), 'the child who opened the quick pause cannot leave it').toBe(false);
    await quadro();
    expect(chip().textContent, 'back in play, the pass did not start again at «cancel»').toBe(pt['scan.nothing']);
    await quandoOferecer('Cima'); // the game's own word: the play list is back
    expect(comandos).toEqual([]);
  }, LIMITE);

  it('🔴 [Right] «confirm» presses the icon under the cursor — ☰ opens the card — and on the card «back» closes it', async () => {
    tocar('start');
    expect(icones()[cursor()]?.dataset.pi, 'the cursor did not land on ☰, the bar\'s first icon: the case needs another route')
      .toBe('menu');
    await quandoOferecer(pt['scan.menu.confirm']);
    apertar(SWITCH);
    expect(cartaoAberto(), '«confirm» on ☰ did not open the menus').toBe(true);
    await quadro();
    await quandoOferecer(pt['scan.menu.next']);
    apertar(SWITCH);
    const sel = () => document.querySelector('#vp-pause-0 .pm-sel');
    expect(sel(), '«next» did not move the card\'s cursor').not.toBeNull();
    expect([...document.querySelectorAll('#vp-pause-0 .pause-menu:not([hidden]) .pm-btn:not([hidden])')].indexOf(sel()), 'the cursor is not on item 2')
      .toBe(1);
    await quandoOferecer(pt['scan.menu.back']);
    apertar(SWITCH);
    expect(cartaoAberto(), '«back» at the card\'s root did not close it').toBe(false);
  }, LIMITE);

  it('🔴 [Right] with a PANEL in front, «next» moves its focus and «back» closes it', async () => {
    const painel = document.querySelector('#game-region .overlay');
    expect(painel, 'the root mounted no panel: the case would measure nothing').not.toBeNull();
    painel.hidden = false;
    await quadro();
    await quandoOferecer(pt['scan.menu.next']);
    apertar(SWITCH);
    expect(painel.contains(document.activeElement), '«next» did not put the focus on the panel').toBe(true);
    await quandoOferecer(pt['scan.menu.back']);
    apertar(SWITCH);
    expect(painel.hidden, '«back» did not close the panel').toBe(true);
  }, LIMITE);
});

/*
 * ===================== THE ENGINE'S DOORS, IN PLAY (ADR-0218 §3) =====================
 * «then the positions the GAME declared in its preset, then the doors the engine itself opens (the menu and, where the game has
 * one, the pause)». 📏 Before this, the pass in play was «cancel» and the game's named positions only: a child with one switch
 * could not reach the pause or the menus at all. The whole story is measured with her one key and nothing else.
 */
describe('in play, the scan offers the engine\'s doors after the game\'s words', () => {
  const LIMITE = 30_000;
  const pausadoAVista = () => { const w = document.querySelector('#game-region .pausa-rapida'); return !!w && w.hidden === false; };
  const cartaoAberto = () => document.getElementById('vp-pause-0')?.hidden === false;
  const quadro = () => new Promise((r) => requestAnimationFrame(() => r(null)));
  const quandoOferecer = async (texto) => {
    const fim = performance.now() + PASSO * 10;
    while (chip().textContent !== texto) {
      if (performance.now() > fim) throw new Error(`the chip never offered «${texto}» (last: «${chip().textContent}»)`);
      await quadro();
    }
  };
  const SWITCH = TECLA.down;

  beforeEach(async () => {
    estado.setSwitchScanValue(true);
    motor.pause.hide(0);
    for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
    if (pausadoAVista()) { motor.controller.press('start', 'olhos', 0); motor.controller.release('start', 'olhos', 0); }
    await quadro();
    comandos.length = 0;
  });
  afterAll(() => { estado.setSwitchScanValue(false); motor.pause.hide(0); });

  it('🔴 [Right] the pass in play is «cancel», the game\'s named positions, then «menu», then «pause» — in that order', async () => {
    const vistos = [];
    await quadro();
    const fim = performance.now() + PASSO * 6 + 300;
    while (performance.now() < fim) {
      const agora = chip().textContent;
      if (vistos.at(-1) !== agora) vistos.push(agora);
      await quadro();
    }
    expect(vistos.slice(0, 6), 'the doors are missing, or out of the order ADR-0218 §3 names')
      .toEqual([pt['scan.nothing'], 'Cima', 'Baixo', 'Confirmar', pt['scan.door.menus'], pt['scan.door.pause']]);
  }, LIMITE);

  it('🔴 [Right] WITH ONE KEY: «pause» opens the quick pause, «next» walks the bar, «back» leaves it — and the game heard nothing', async () => {
    await quandoOferecer(pt['scan.door.pause']);
    apertar(SWITCH);
    expect(pausadoAVista(), 'taking «pause» did not open the quick pause').toBe(true);
    const icones = () => [...document.querySelectorAll('#title-icons .pi-btn')];
    const cursor = () => icones().findIndex((b) => b.classList.contains('pi-sel'));
    const antes = cursor();
    await quandoOferecer(pt['scan.menu.next']);
    apertar(SWITCH);
    expect(cursor(), 'inside the quick pause the key moved nothing along the bar').toBe((antes + 1) % icones().length);
    await quandoOferecer(pt['scan.menu.back']);
    apertar(SWITCH);
    expect(pausadoAVista(), 'the child who opened the quick pause by scanning cannot leave it').toBe(false);
    expect(comandos.filter((c) => c.action === 'start' || c.action === 'select'), 'the game heard a door').toEqual([]);
  }, LIMITE);

  it('🔴 [Right] WITH ONE KEY: «menu» opens the card, and «back» closes it', async () => {
    await quandoOferecer(pt['scan.door.menus']);
    apertar(SWITCH);
    expect(cartaoAberto(), 'taking «menu» did not open the card').toBe(true);
    await quadro();
    await quandoOferecer(pt['scan.menu.back']);
    apertar(SWITCH);
    expect(cartaoAberto(), '«back» at the card\'s root did not close it').toBe(false);
    expect(comandos.filter((c) => c.action === 'start' || c.action === 'select')).toEqual([]);
  }, LIMITE);
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-condutor-da-varredura.py` and `mutar-captura-da-varredura.py`, 8 of 8 red:
//   · the key no longer intercepted: the scan never sees it   · the key read but let through: one press doing two things
//   · every repeat of a held key takes an item                · the listener out of the CAPTURE phase
//   · what was taken is never let go: the key stays down      · the list offering a position the game never named
//   · turning the scan off leaves the chip on screen
// 🔴 TWO OF THEM TAUGHT SOMETHING. The capture one survived at first because the case dispatched the key ON the window, where
// capture and bubble are the same order — a real key is born on the focused element and rises, which is the only way the phase
// can be seen. And one mutation was EQUIVALENT: redrawing the chip inside the press saved the sixteen milliseconds to the next
// frame, and the frame loop draws anyway, so the line was deleted rather than kept with a case built around it.
// And (2026-09-26, INSIDE THE ENGINE'S MENUS) — `scratchpad/scan-doors/mutate.mjs`, CRLF normalised, one occurrence required,
// restored and checked by SHA-256:
//   S1 the list never changes when a menu opens or closes      🔴 5 of the menu cases
//   S2 a menu step taken and never handed to `ui/menu-nav`      🔴 4 (the steps, «back», «confirm», the panel)
//   S3 the menu list never chosen                              🔴 5
//   S4 the order of the steps changed                          🔴 «in the QUICK PAUSE the pass is the menu's steps» (and 2 in node)
//   S5 «next» and «previous» swapped                           🔴 «next moves the bar's cursor», «confirm … on the card» (and 2 in node)
//   S6 the menu steps read with no engine word                 🔴 5 (and 1 in node)
// And (2026-09-26, THE ENGINE'S DOORS), same discipline:
//   D1 the doors never added to the play list                 🔴 4 (the order, «pause», «menu», and «never NAMED»'s full pass)
//   D2 «pause» before «menu»                                   🔴 «the pass in play … in that order» (and 2 in node)
//   D5 the quick pause taken as having no bar                  🔴 3: no «pause», and the child never reaches the quick pause
//   D6 the card taken as not mounted                           🔴 3: no «menu»
