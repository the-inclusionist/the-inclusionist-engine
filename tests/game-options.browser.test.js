// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GAME OPTIONS, DRAWN BY THE ENGINE (ADR-0182; issue #178): a cartridge declares rows, and «Opções do jogo» opens a panel
// of the engine's own — its identity, «Voltar» first, the cartridge's words, the cartridge's writer and reader.
//
// 📌 `createGame` with a real page, and `mount()` to swap cartridges: the rows are the CURRENT cartridge's.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let motor;
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

/** The cartridge's own state: what its readers answer and its writers change. */
const jogo = { nivel: 'easy', dicas: false, ritmo: 'slow', tema: 'sol', escritas: [] };
const opcoes = () => [
  {
    id: 'difficulty', kind: 'steps', label: 'Dificuldade', hint: 'Quanto o jogo ajuda.',
    values: [{ value: 'easy', label: 'fácil' }, { value: 'medium', label: 'médio' }, { value: 'hard', label: 'difícil' }],
    read: () => jogo.nivel,
    // the cartridge may keep another value than the one written: what shows is what it READS
    write: (v) => { jogo.escritas.push(['difficulty', v]); jogo.nivel = v === 'hard' ? 'medium' : v; },
  },
  { id: 'hints', kind: 'switch', label: 'Dicas', read: () => jogo.dicas, write: (v) => { jogo.escritas.push(['hints', v]); jogo.dicas = v; } },
  {
    id: 'pace', kind: 'list', label: 'Ritmo',
    values: [{ value: 'slow', label: 'devagar' }, { value: 'fast', label: 'depressa' }],
    read: () => jogo.ritmo, write: (v) => { jogo.escritas.push(['pace', v]); jogo.ritmo = v; },
  },
  {
    // six positions: past the five a cycle holds, so a dropdown (ADR-0130 rule 3)
    id: 'theme', kind: 'list', label: 'Tema',
    values: ['sol', 'lua', 'mar', 'rio', 'mata', 'serra'].map((v) => ({ value: v, label: v })),
    read: () => jogo.tema, write: (v) => { jogo.escritas.push(['theme', v]); jogo.tema = v; },
  },
];
const porta = () => document.querySelector('#vp-pause-0 .pm-btn[data-act="opcoesdojogo"]');
function abrirOpcoesDoJogo() {
  motor.pause.show(0);
  porta().click();
}
function fecharTudo() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
}
const esperar = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const dito = () => document.getElementById('sr-status').textContent + document.getElementById('sr-alert').textContent;

beforeAll(async () => {
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }], gameOptions: opcoes() });
});

describe('the game options panel', () => {
  it('🔴 [Right] the door is live, and opens a panel with «Voltar» first and the rows in the game\'s words', () => {
    motor.pause.show(0);
    expect(porta().getAttribute('aria-disabled'), 'the door stayed locked with rows declared').toBeNull();
    porta().click();
    const painel = document.querySelector('#game-options');
    expect(painel, 'no game options panel').not.toBeNull();
    expect(painel.hidden, 'the door did not open the panel').toBe(false);
    const card = painel.querySelector('.overlay__card');
    const primeiro = card.querySelector('button, [tabindex="0"], select, input');
    expect(primeiro?.textContent ?? '', '«Voltar» is not the first item').toMatch(/Voltar/);
    expect(document.querySelector('#game-option-difficulty .passo-valor')?.textContent).toBe('Dificuldade: fácil');
    expect(document.querySelector('#game-option-hints')?.closest('.ctrl-row')?.querySelector('strong')?.textContent).toBe('Dicas');
    // a list is drawn by its SIZE (ADR-0130 rule 3): two positions cycle, six drop down
    expect(document.querySelector('#game-option-pace .passo-valor')?.textContent, 'a two-position list is not a cycle row').toBe('Ritmo: devagar');
    expect([...document.querySelectorAll('#game-option-theme option')].map((o) => o.textContent)).toEqual(['sol', 'lua', 'mar', 'rio', 'mata', 'serra']);
    // a cartridge declares no defaults: a «restore» that does nothing would be a dead control (ADR-0106 §5)
    expect(document.querySelector('#game-options-reset')?.hidden, 'a restore button with nothing to restore').toBe(true);
    fecharTudo();
  });

  it('🔴 [Right] a step calls the cartridge\'s writer, and the row shows what the cartridge reads back', async () => {
    abrirOpcoesDoJogo();
    await esperar(150); // the panel's own «you are in» announcement first, as a child hears it before touching a row
    const passos = document.querySelector('#game-option-difficulty');
    passos.dispatchEvent(new CustomEvent('passo', { detail: 1, bubbles: true }));
    expect(jogo.escritas.at(-1)).toEqual(['difficulty', 'medium']);
    passos.dispatchEvent(new CustomEvent('passo', { detail: 1, bubbles: true }));
    expect(jogo.escritas.at(-1)).toEqual(['difficulty', 'hard']);
    // the cartridge kept «medium»: the row says so, not what was written
    expect(passos.querySelector('.passo-valor').textContent, 'the row shows the written value, not the read one').toBe('Dificuldade: médio');
    for (let i = 0; i < 40 && !/Dificuldade: médio/.test(dito()); i++) await esperar(25);
    expect(dito(), 'the change was silent').toMatch(/Dificuldade: médio/);
    fecharTudo();
  });

  it('🔴 [Right] the switch and the list write through the cartridge', () => {
    abrirOpcoesDoJogo();
    const interruptor = document.querySelector('#game-option-hints');
    interruptor.click();
    expect(jogo.dicas).toBe(true);
    expect(interruptor.getAttribute('aria-pressed')).toBe('true');
    // the switch says its state in the root's language: the panel draws it with the `t` the root hands down (ADR-0232 D3)
    expect(interruptor.textContent, 'the switch shows a raw key').not.toMatch(/ui\.toggle/);
    expect(interruptor.textContent.trim().length, 'the switch says nothing').toBeGreaterThan(0);
    // the two-position list cycles, and a step writes through the cartridge
    document.querySelector('#game-option-pace').dispatchEvent(new CustomEvent('passo', { detail: 1, bubbles: true }));
    expect(jogo.ritmo).toBe('fast');
    const lista = document.querySelector('#game-option-theme');
    lista.value = 'mar';
    lista.dispatchEvent(new Event('change', { bubbles: true }));
    expect(jogo.tema).toBe('mar');
    fecharTudo();
  });

  it('🔴 [Right] reopening reads the cartridge again: a value changed elsewhere shows', () => {
    jogo.nivel = 'easy';
    abrirOpcoesDoJogo();
    expect(document.querySelector('#game-option-difficulty .passo-valor').textContent).toBe('Dificuldade: fácil');
    fecharTudo();
  });

  it('🔴 [Right] a cartridge with no options gets the door LOCKED with its reason, and no rows of the one before', async () => {
    motor.mount(declaracao(), { accommodations: SEM_ASSUNTO, players: [{ ctrl: 0 }] });
    motor.pause.show(0);
    expect(porta(), 'the door is gone: the card always shows its six items (ADR-0161)').not.toBeNull();
    expect(porta().getAttribute('aria-disabled'), 'the door is live with no options').toBe('true');
    porta().click();
    await esperar();
    expect(document.querySelector('#game-options')?.hidden ?? true, 'the locked door opened a panel').toBe(true);
    expect(document.querySelectorAll('#game-options-list .ctrl-row').length, 'the previous cartridge\'s rows are still drawn').toBe(0);
    fecharTudo();
  });

  it('🔴 [Right] a mounted cartridge with other options gets ITS rows', () => {
    motor.mount(declaracao(), { accommodations: SEM_ASSUNTO, players: [{ ctrl: 0 }], gameOptions: [{ id: 'board', kind: 'switch', label: 'Tabuleiro grande', read: () => false, write: () => {} }] });
    abrirOpcoesDoJogo();
    const rotulos = [...document.querySelectorAll('#game-options-list .ctrl-row strong')].map((s) => s.textContent);
    expect(rotulos).toEqual(['Tabuleiro grande']);
    fecharTudo();
  });

  it('🔴 [Right] malformed options refuse the boot and the mount, naming the part', async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    expect(() => motor.mount(declaracao(), { accommodations: SEM_ASSUNTO, players: [{ ctrl: 0 }], gameOptions: [{ id: 'x', kind: 'switch', label: 'X', read: () => true }] }))
      .toThrow(/gameOptions\[0\]\.write/);
    expect(() => createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }], gameOptions: 'difficulty' }))
      .toThrow(/gameOptions must be a list/);
  });
});

// ============================== MUTATIONS CHECKED (with `game-options.node`) ==============================
//   G1 steps past five · G2 repeated id · G3 writer unchecked · G4 one position · G5 repeated value   🔴 each (node; G3 also here)
//   R1 mount not refused · R2 boot not refused                                                         🔴 malformed
//   P1 door not live by its action (node) · P2 the door switches to the host's list                      🔴 each
//   C1 door not offered · C2 offered with no rows · C3 mount does not redraw · C4 restore shown           🔴 each
//   D1 steps show the written value · D2 switch not reflected · D3 list not written · D4 step silent
//   D5 rows not cleared · D6 the read value ignored                                                      🔴 each
