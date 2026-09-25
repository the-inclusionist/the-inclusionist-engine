// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ROWS FOLLOW THE CARTRIDGE'S ANSWER (ADR-0153) — the first two readers of `acomodacoes`.
//
// 🔴 Before this, the cane row in the hearing panel and the «Character» section of the visual sensitivity panel
// mounted in EVERY game: a board game offered a cane spacing and three switches for a character it does not have.
// The switch worked and meant nothing — the second dead button ADR-0145 names.
//
// 📌 ONE root, and the cartridge is swapped with `mount()` — which is also what proves the rows are re-read per
// cartridge and not frozen at boot (ADR-0142).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import { SEM_ASSUNTO, comAssunto } from './fixtures/accommodation-answers.js';
import { keyed } from './fixtures/declared-words.js'; // a game declares KEYS of its dictionary (ADR-0232 D3)

let motor;
const declaracao = () => ({
  topology: () => ({ kind: 'grid', size: [3, 3], move: 'orthogonal', frame: 'compass' }), holdsAtOnce: () => 1,
  holdsKeys: () => false, tick: 'player', world: () => ({ kind: 'element', selector: '#game-region' }),
  roleAt: () => 'goal', nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const COM_PERSONAGEM_E_BENGALA = comAssunto({
  reducedCharacterMotion: { label: 'Character motion' }, caneSpacing: { label: 'Cane taps' },
});

const linhaDaBengala = () => document.querySelector('#cane-div')?.closest('.ctrl-row');
function abrirSensibilidade() {
  motor.pause.show(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="anim"]').click();
}
function fecharTudo() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
}

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  const raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false });
});

describe('the rows follow the cartridge\'s answer', () => {
  it('🔴 [Zero] a game that says «no cane» does not offer the cane row', () => {
    expect(linhaDaBengala(), 'the hearing panel did not build its interior — the case would measure nothing').toBeTruthy();
    expect(linhaDaBengala().hidden, 'a cane spacing offered to a game with nobody walking').toBe(true);
  });

  it('🔴 [Zero] and it does not offer the «Character» section', () => {
    abrirSensibilidade();
    const lista = document.querySelector('#motion-list');
    expect(lista.querySelectorAll('button').length, 'the panel opened empty — the case would measure nothing').toBeGreaterThan(0);
    expect(lista.querySelector('[data-rmc]'), 'character switches for a game with no character').toBeNull();
    fecharTudo();
  });

  it('🎯 [Right] a cartridge mounted AFTER, that says «yes», gets both — read per cartridge, not frozen at boot', () => {
    motor.mount(declaracao(), { ...keyed({ accommodations: COM_PERSONAGEM_E_BENGALA }) });
    abrirSensibilidade();
    expect(document.querySelectorAll('#motion-list [data-rmc]').length, 'the character section did not come back').toBe(3);
    fecharTudo();
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    expect(linhaDaBengala().hidden, 'the cane row stayed hidden for a game that has a walker').toBe(false);
    fecharTudo();
  });

  it('🔴 [Right] and what applies carries the GAME\'s word, never the engine\'s (ADR-0153 confirmation)', () => {
    motor.mount(declaracao(), { ...keyed({ accommodations: COM_PERSONAGEM_E_BENGALA }) });
    abrirSensibilidade();
    const titulo = [...document.querySelectorAll('#motion-list h3.panel-sub')].find((h) => h.nextElementSibling?.querySelector?.('[data-rmc]') || h.parentElement.querySelector('[data-rmc]'));
    expect(document.querySelector('#motion-list').textContent, 'the character section is not named with the game\'s word').toContain('Character motion');
    expect(titulo?.textContent ?? '', 'the character section still carries the engine\'s own title').not.toMatch(/Personagem/);
    fecharTudo();
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    expect(linhaDaBengala().querySelector('strong')?.textContent, 'the cane row is not named with the game\'s word').toBe('Cane taps');
    fecharTudo();
  });

  it('🔴 [Right] and the game\'s HINT reaches the footer, which is where an explanation lives (ADR-0153; CLAUDE.md §4)', () => {
    // 📏 Probed on 2026-09-23: this was the one blind branch of the rule that hides the rows with no subject. A cartridge
    // could give its own explanation for the cane — «cada batida é um passo do bastão» — and the line that carries it to
    // the child could be DELETED with the whole suite green. The label had a case; the sentence beside it had none.
    //
    // ⚠️ Read from `data-explain` and not from the row, because that is where the explanation ends up: `fillExplain` hides
    // the `.opt-hint` and the footer reads this attribute when the child points at the row.
    motor.mount(declaracao(), { ...keyed({ accommodations: comAssunto({
      caneSpacing: { label: 'Cane taps', hint: 'Every tap is one step of the stick.' },
    }) }) });
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    const linha = linhaDaBengala();
    expect(linha.hidden, 'the cane row is hidden — the case would measure nothing').toBe(false);
    expect(linha.dataset.explain, 'the game\'s own explanation never reached the footer')
      .toBe('Every tap is one step of the stick.');
    fecharTudo();
  });

  it('🎯 [Zero] a game that gives a word but NO hint keeps the engine\'s explanation, never an empty footer', () => {
    // The pair of the case above: an absent hint is a legitimate answer, and it must not erase what the engine says.
    motor.mount(declaracao(), { ...keyed({ accommodations: COM_PERSONAGEM_E_BENGALA }) });
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    const linha = linhaDaBengala();
    expect(linha.dataset.explain, 'the row lost its explanation because the game gave none').toBeTruthy();
    expect(linha.dataset.explain, 'the engine\'s explanation was replaced by nothing')
      .not.toBe('Every tap is one step of the stick.');
    fecharTudo();
  });

  it('🔴 [Right] and swapping back to «no» hides them again — no leak from the previous cartridge (ADR-0142)', () => {
    motor.mount(declaracao(), { accommodations: SEM_ASSUNTO });
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
    expect(linhaDaBengala().hidden, 'the previous cartridge\'s cane leaked into this one').toBe(true);
    fecharTudo();
  });
});

describe('and the rows the CONTRACT answers are derived, not asked (ADR-0153)', () => {
  // 📌 There is no navigation master volume (ADR-0151): what is hidden is the LIST of sonar, guard and guide.
  const linhaDoSonar = () => document.querySelector('#navsound-list');
  const abrirAuditiva = () => {
    motor.pause.show(0);
    document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
    document.querySelector('#vp-pause-0 .pm-btn[data-act="audio"]').click();
  };

  it('🎯 [Right] a game with a grid world offers navigation sound', () => {
    motor.mount(declaracao(), { accommodations: SEM_ASSUNTO });
    abrirAuditiva();
    expect(linhaDoSonar()?.querySelector('[data-acat="sonar"]'), 'the hearing panel has no sonar row — the case would measure nothing').toBeTruthy();
    expect(linhaDoSonar().hidden).toBe(false);
    fecharTudo();
  });

  it('🔴 [Zero] a game of HOTSPOTS does not — the sonar has no direction there, the contract says so', () => {
    motor.mount({ ...declaracao(), topology: () => ({ kind: 'hotspots', order: ['q1', 'q2'] }) }, { accommodations: SEM_ASSUNTO });
    abrirAuditiva();
    expect(linhaDoSonar().hidden, 'sonar, guard and guide volumes offered to a list of points').toBe(true);
    fecharTudo();
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   C1 the cane row is never hidden                              🔴 «no cane» still offers it
//   C2 comPersonagem always true                                 🔴 character switches in a game with none
//   C3 the cane decision is read once at boot, not per render    🔴 the mounted «yes» cartridge stays without it
//   D1 the navigation-sound rows are never hidden                🔴 sonar volumes on hotspots
//   W1 the character section's title ignores the game's word     🔴 the game's word
//   W2 the cane row keeps the engine's label                     🔴 the game's word
//   W3 createGame passes no word to the motion panel             🔴 the game's word
