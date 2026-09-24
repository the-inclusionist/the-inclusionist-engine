// SPDX-License-Identifier: AGPL-3.0-or-later
// OWNER COLOURS AND CONTRAST OUTLINES ARE GAME-KEYED SUBJECTS (ADR-0188; issue #183). The Dev: «Criar os dois assuntos.» A
// cartridge answers both; answered with its word, the rows enter the visual panel and write the stored settings the game reads;
// answered «not here», no row.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO, comAssunto } from './fixtures/accommodation-answers.js';
import { DEFAULTS } from '../app/js/core/setting-defaults.js';

let motor, state;
const CHAVES = ['incl_ownercolors', 'incl_outfg', 'incl_outbg'];
const antes = {};
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const COM_OS_DOIS = comAssunto({
  ownerColors: { label: 'Peças na cor de quem joga', hint: 'Cada jogador vê as próprias peças na cor dele.' },
  contrastOutlines: { label: 'Contornos das plataformas' },
});
function abrirVisual() {
  motor.pause.show(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="visual"]').click();
}
function fecharTudo() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
}
const linha = (id) => document.querySelector(`#visual #${id}`)?.closest('.ctrl-row') ?? null;
const oferecida = (id) => !!linha(id) && !linha(id).hidden;

beforeAll(async () => {
  for (const k of CHAVES) { antes[k] = localStorage.getItem(k); localStorage.removeItem(k); }
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  state = await import('../app/js/core/state.js');
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }] });
});
afterAll(() => {
  state.setOwnerColorsValue(DEFAULTS.ownerColors);
  state.setOutlineFgValue(DEFAULTS.hcOutlineFg);
  state.setOutlineBgValue(DEFAULTS.hcOutlineBg);
  for (const k of CHAVES) { if (antes[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, antes[k]); }
});

describe('owner colours and contrast outlines', () => {
  it('🔴 [Right] an answer without the two is refused, naming them', () => {
    const { ownerColors, contrastOutlines, ...velha } = SEM_ASSUNTO;
    expect(ownerColors === false && contrastOutlines === false, 'the fixture does not answer the two').toBe(true);
    expect(() => motor.mount(declaracao(), { accommodations: velha, players: [{ ctrl: 0 }] })).toThrow(/ownerColors/);
    expect(() => motor.mount(declaracao(), { accommodations: velha, players: [{ ctrl: 0 }] })).toThrow(/contrastOutlines/);
  });

  it('🎯 [Zero] answered «not here», the visual panel offers neither', () => {
    abrirVisual();
    for (const id of ['opt-dono', 'opt-contorno-fg', 'opt-contorno-bg']) expect(oferecida(id), id).toBe(false);
    fecharTudo();
  });

  it('🔴 [Right] answered with a word, owner colours is a row in the game\'s word, and it writes the stored setting', () => {
    motor.mount(declaracao(), { accommodations: COM_OS_DOIS, players: [{ ctrl: 0 }] });
    abrirVisual();
    expect(oferecida('opt-dono'), 'no owner colours row').toBe(true);
    expect(linha('opt-dono').querySelector('strong')?.textContent).toBe('Peças na cor de quem joga');
    const antesDono = state.ownerColors;
    // the row opens showing the stored state — a switch born «off» would match only one of the two positions
    expect(document.querySelector('#visual #opt-dono').getAttribute('aria-pressed'), 'the row does not show the stored state').toBe(String(antesDono));
    document.querySelector('#visual #opt-dono').click();
    expect(state.ownerColors, 'the row did not write the setting').toBe(!antesDono);
    expect(localStorage.getItem('incl_ownercolors')).toBe(antesDono ? '0' : '1');
    expect(document.querySelector('#visual #opt-dono').getAttribute('aria-pressed')).toBe(String(!antesDono));
    fecharTudo();
  });

  it('🔴 [Right] answered with a word, the two outline rows are steps that write their levels', () => {
    abrirVisual();
    expect(oferecida('opt-contorno-fg') && oferecida('opt-contorno-bg'), 'no outline rows').toBe(true);
    // the explanation lives in the footer, never inside the row (CLAUDE.md §4)
    // 📌 HIDDEN, not emptied: since 2026-09-23 `fillExplain` keeps the node so the producer has somewhere to write the new
    // language into (ADR-0225), and `hidden` is what takes it out of the accessibility tree — which is the rule this line
    // has always been about. Emptying it was the old mechanism, and it froze every explanation in the boot language.
    for (const id of ['opt-contorno-fg', 'opt-contorno-bg']) {
      const dica = linha(id).querySelector('.opt-hint');
      expect(dica === null || dica.hidden, id + ': the explanation is visible inside the row').toBe(true);
    }
    const fg = document.querySelector('#visual #opt-contorno-fg');
    state.setOutlineFgValue(0);
    fecharTudo();
    abrirVisual();
    fg.dispatchEvent(new CustomEvent('passo', { detail: 1, bubbles: true }));
    expect(state.hcOutlineFg, 'the foreground step did not write').toBe(1);
    const bg = document.querySelector('#visual #opt-contorno-bg');
    state.setOutlineBgValue(2);
    bg.dispatchEvent(new CustomEvent('passo', { detail: -1, bubbles: true }));
    expect(state.hcOutlineBg, 'the background step did not write').toBe(1);
    fecharTudo();
  });

  it('🎯 [Zero] a cartridge mounted after, answering «not here», takes the rows away', () => {
    motor.mount(declaracao(), { accommodations: SEM_ASSUNTO, players: [{ ctrl: 0 }] });
    abrirVisual();
    for (const id of ['opt-dono', 'opt-contorno-fg', 'opt-contorno-bg']) expect(oferecida(id), id).toBe(false);
    fecharTudo();
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   D1 not game-keyed · D2 owner row always offered · D3 outlines always offered · D4 owner row in the engine's words
//   D5 owner click does not write · D7 fg step does not write · D8 bg writes the fg · D9 not re-weighed at opening   🔴 each
//   D6 owner switch not reflected — FIRST SURVIVED: owner colours start on, and one click lands on the «off» a new switch is
//      born with; the case now checks the state the row opens with
