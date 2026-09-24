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
import pt from '../app/js/i18n/pt.js';
import * as estado from '../app/js/core/state.js';
import { SWITCH_SCAN_DEFAULTS } from '../app/js/input/switch-scan.js';
// ⚠️ A FOLHA DA ENGINE ENTRA, e sem ela este ficheiro mediria outra coisa: o aviso da varredura é posicionado POR CSS, logo sem
// a folha ele nasce no topo da região e o caso do espaço reservado não teria o que ver.
import css from '../app/css/style.css?raw';

let motor;
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
 * ⚠️ A TECLA É DESPACHADA NA REGIÃO DO JOGO, e não na janela, e isso é o caso e não um detalhe: um evento despachado NA janela
 * chega aos ouvintes dela «no alvo», onde captura e bolha correm pela mesma ordem de registo — então um ouvinte que saísse da
 * captura passava despercebido. Uma tecla de verdade nasce no elemento com foco e SOBE, e é aí que a captura da janela corre
 * primeiro. Uma mutação sobreviveu exactamente por isto.
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
    acomodacoes: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window },
    downloadHeavy: false, players: assentos, preset: PRESET,
    onCommand: (c) => comandos.push(c),
  });
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
    for (let i = 0; i <= 4; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 30 : PASSO));
      vistos.add(chip().textContent);
    }
    // 📌 The three named ones and «cancelar» — `action3` is declared in the preset and has no word, so it never shows.
    expect([...vistos].sort()).toEqual([pt['scan.nothing'], 'Baixo', 'Cima', 'Confirmar'].sort());
  });

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
   * 🔴 ACHADO NO NAVEGADOR, NÃO AQUI: no quiz construído o aviso «DIZER A RESPOSTA» caiu EM CIMA do enunciado. Ele é HUD, e HUD
   * que não reserva o seu espaço é a engine a escrever por cima do jogo — a mesma regra que o ADR-0148 impõe ao contrário, e o
   * mesmo conserto que a linha do nome do ícone já tinha levado (issue #160): a faixa do topo cresce com o que está lá.
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
    // 🔴 O COMENTÁRIO DO `style.css` DIZ QUE ISTO FOI «apanhado por um caso», E NÃO ERA VERDADE HOJE: medido por sonda em
    // 22/09, pôr o aviso pela faixa que ele próprio faz crescer deixava a suíte VERDE. O defeito que o comentário
    // descreve é um LAÇO — o aviso empurra a faixa, a faixa empurra o aviso, e ele desce a tela a cada medição —, e um
    // laço não se vê numa medição só. Este caso mede duas vezes e exige o mesmo lugar.
    const regiao = document.getElementById('game-region');
    estado.setSwitchScanValue(true);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const topo = () => chip().getBoundingClientRect().top - regiao.getBoundingClientRect().top;
    const primeiro = topo();
    // ⚠️ A SEGUNDA MEDIÇÃO TEM DE SER A DE VERDADE: a varredura remede a faixa a cada troca de palavra, e é isso
    // que faz o laço andar. Um `resize` sintético não serve — medido, ele não passa por aqui, e com ele o caso
    // ficava VERDE sobre a mutação que existe para apanhar.
    for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, PASSO + 30));
    expect(topo(), 'o aviso andou entre duas medições: a faixa está a empurrá-lo').toBeCloseTo(primeiro, 0);
    // e o que o põe ali é o `--scan-top`, que NÃO depende do aviso — só a faixa depende
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

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-condutor-da-varredura.py` and `mutar-captura-da-varredura.py`, 8 of 8 red:
//   · the key no longer intercepted: the scan never sees it   · the key read but let through: one press doing two things
//   · every repeat of a held key takes an item                · the listener out of the CAPTURE phase
//   · what was taken is never let go: the key stays down      · the list offering a position the game never named
//   · turning the scan off leaves the chip on screen
// 🔴 TWO OF THEM TAUGHT SOMETHING. The capture one survived at first because the case dispatched the key ON the window, where
// capture and bubble are the same order — a real key is born on the focused element and rises, which is the only way the phase
// can be seen. And one mutation was EQUIVALENT: redrawing the chip inside the press saved the sixteen milliseconds to the next
// frame, and the frame loop draws anyway, so the line was deleted rather than kept with a case built around it.
