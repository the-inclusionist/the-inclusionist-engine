// SPDX-License-Identifier: AGPL-3.0-or-later
// EVERY WORD A GAME DECLARES FOLLOWS THE LANGUAGE (ADR-0232 D3, erratum of 2026-09-25; ADR-0225, ADR-0216).
//
// 📏 THE DEFECT, MEASURED BEFORE THE DECISION: a preset built with `t` in Portuguese still read «Acima» after
// `setLocale('en')` — a word handed over at boot stays in the boot language. The decision: a game declares the KEYS of its
// words, registered through `CreateGameOptions.dictionaries`, and the root's translator resolves them every time the engine
// draws or speaks them. This file boots one cartridge declaring every kind of word as keys in pt, en and es, switches to
// English, and reads each surface a child reaches from the pause card — the help and its «how to play», the game's option
// rows, the keyboard map, the accommodation rows, the HUD.
//
// And a key the game declares but its dictionaries lack is never shown: it goes to `problems`, with the subject by name, the
// cost to the child and the fix (ADR-0169).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO, comAssunto } from './fixtures/accommodation-answers.js';

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});

/** The game's words in its three languages: each key's pt, en and es. */
const WORDS = {
  'g.jump': ['Pular', 'Jump', 'Saltar'],
  'g.jump.hint': ['Sai do chão.', 'Leave the ground.', 'Sale del suelo.'],
  'g.back': ['Recuar', 'Step back', 'Retroceder'],
  'g.read': ['Leia a pergunta.', 'Read the question.', 'Lee la pregunta.'],
  'g.level': ['Nível', 'Level', 'Nivel'],
  'g.level.hint': ['Quanto o jogo ajuda.', 'How much the game helps.', 'Cuánto ayuda el juego.'],
  'g.easy': ['fácil', 'easy', 'fácil'],
  'g.hard': ['difícil', 'hard', 'difícil'],
  'g.character': ['Movimento do herói', 'Hero motion', 'Movimiento del héroe'],
  'g.owner': ['Cores de quem joga', 'Players\' colours', 'Colores de quien juega'],
  'g.cane': ['Batidas da bengala', 'Cane taps', 'Golpes del bastón'],
  'g.cane.hint': ['Cada batida é um passo.', 'Every tap is one step.', 'Cada golpe es un paso.'],
  'g.points': ['Pontos', 'Points', 'Puntos'],
};
const dictionary = (i) => Object.fromEntries(Object.entries(WORDS).map(([k, v]) => [k, v[i]]));
const EN = (key) => WORDS[key][1];
const PT = (key) => WORDS[key][0];

let motor;
const nivel = { value: 'easy' };
const esperar = (ms = 60) => new Promise((r) => { setTimeout(r, ms); });
const card = (act) => document.querySelector(`#vp-pause-0 .pm-btn[data-act="${act}"]`);
function fecharTudo() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
}
/** Opens a panel from the pause card, the way a child does; `via` is the submenu item when the panel lives under «options». */
function abrir(act, via = 'options') {
  motor.pause.show(0);
  if (via) card(via).click();
  card(act).click();
}

/** Every word a surface shows or says: text, and the names riding on attributes. */
const wordsOf = (el) => [el?.textContent ?? '', ...[...(el?.querySelectorAll('[aria-label], [data-explain], [aria-valuetext]') ?? [])]
  .flatMap((n) => [n.getAttribute('aria-label'), n.getAttribute('data-explain'), n.getAttribute('aria-valuetext')])]
  .filter(Boolean).join(' | ');

/** What each surface reads NOW, one entry per declared word, from the pause card. */
function readEverySurface() {
  const read = {};
  // the help: the cartridge's «how to play» slide first, then the button slides — every one of them, turned page by page
  abrir('ajuda', null);
  const slides = document.querySelector('#help .slides');
  read.howToPlay = slides.querySelector('.slide-texto').textContent;
  const pages = [];
  for (let i = 1; i < slides.querySelectorAll('.slide-ponto').length; i++) {
    slides.dispatchEvent(new CustomEvent('passo', { detail: 1, bubbles: true }));
    pages.push(wordsOf(slides));
  }
  read.helpWords = pages.join(' | ');
  fecharTudo();
  // the game's option rows
  abrir('opcoesdojogo', null);
  read.options = wordsOf(document.querySelector('#game-options'));
  fecharTudo();
  // the keyboard map, which names each of the game's positions
  abrir('motora');
  document.querySelector('#opt-teclado-1').click();
  read.keyboard = wordsOf(document.querySelector('#ctrl'));
  fecharTudo();
  // the accommodation rows: the character section, owner colours, the cane (its name and the explanation in the footer)
  abrir('anim');
  read.character = wordsOf(document.querySelector('#motion-list'));
  fecharTudo();
  abrir('visual');
  read.owner = document.querySelector('#visual #opt-dono')?.closest('.ctrl-row')?.querySelector('strong')?.textContent ?? '';
  fecharTudo();
  abrir('audio');
  const cane = document.querySelector('#cane-div')?.closest('.ctrl-row');
  read.cane = [cane?.querySelector('strong')?.textContent ?? '', cane?.dataset.explain ?? ''].join(' | ');
  fecharTudo();
  // the score: five digits for the eye, named for a listener with the game's word (ADR-0238)
  read.hud = document.querySelector('.hud-points .hud-numero')?.getAttribute('aria-label') ?? '';
  return read;
}

beforeAll(async () => {
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"></div><div id="title-icons"></div>';
  localStorage.removeItem('incl_lang');
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }],
    preset: { action2: { labelKey: 'g.jump', hintKey: 'g.jump.hint' }, left: { labelKey: 'g.back' } },
    howToPlay: [{ textKey: 'g.read' }],
    gameOptions: [{
      id: 'level', kind: 'steps', labelKey: 'g.level', hintKey: 'g.level.hint',
      values: [{ value: 'easy', labelKey: 'g.easy' }, { value: 'hard', labelKey: 'g.hard' }],
      read: () => nivel.value, write: (v) => { nivel.value = v; },
    }],
    accommodations: comAssunto({
      reducedCharacterMotion: { labelKey: 'g.character' },
      ownerColors: { labelKey: 'g.owner' },
      caneSpacing: { labelKey: 'g.cane', hintKey: 'g.cane.hint' },
    }),
    hud: [{ band: 'identity', nameKey: 'g.points', value: () => 7 }],
    dictionaries: { pt: dictionary(0), en: dictionary(1), es: dictionary(2) },
  });
  await motor.localeReady();
});

afterAll(async () => {
  await motor.setLocale('pt');
  localStorage.removeItem('incl_lang');
  motor.dispose();
});

describe('the words a game declares, switched to English', () => {
  it('🎯 [Right] at boot, in Portuguese, every surface reads the game\'s Portuguese words — the case has something to switch', () => {
    const pt = readEverySurface();
    expect(pt.howToPlay).toBe(PT('g.read'));
    expect(pt.helpWords).toContain(PT('g.jump'));
    expect(pt.options).toContain(PT('g.level'));
    expect(pt.keyboard).toContain(PT('g.jump'));
    expect(pt.character).toContain(PT('g.character'));
    expect(pt.owner).toBe(PT('g.owner'));
    expect(pt.cane).toContain(PT('g.cane'));
    expect(pt.hud).toContain(PT('g.points'));
  });

  it('🔴 [Right] after `setLocale(\'en\')` EVERY declared word is in English — none stays in the boot language («Acima»)', async () => {
    await motor.setLocale('en');
    await esperar();
    const en = readEverySurface();
    // the help: «how to play», the button's word and its sentence
    expect(en.howToPlay, 'the «how to play» slide stayed in the boot language').toBe(EN('g.read'));
    expect(en.helpWords, 'the help\'s button word stayed in the boot language').toContain(EN('g.jump'));
    expect(en.helpWords, 'the help\'s button sentence stayed in the boot language').toContain(EN('g.jump.hint'));
    // the option rows: the name, the explanation and the position
    expect(en.options, 'the option row\'s name stayed in the boot language').toContain(EN('g.level'));
    expect(en.options, 'the option row\'s explanation stayed in the boot language').toContain(EN('g.level.hint'));
    expect(en.options, 'the option row\'s position stayed in the boot language').toContain(EN('g.easy'));
    // the keyboard map
    expect(en.keyboard, 'the keyboard map\'s action words stayed in the boot language').toContain(EN('g.jump'));
    expect(en.keyboard).toContain(EN('g.back'));
    // the accommodation rows
    expect(en.character, 'the character section stayed in the boot language').toContain(EN('g.character'));
    expect(en.owner, 'the owner-colours row stayed in the boot language').toBe(EN('g.owner'));
    expect(en.cane, 'the cane row stayed in the boot language').toBe(`${EN('g.cane')} | ${EN('g.cane.hint')}`);
    // the HUD
    expect(en.hud, 'the HUD number\'s name stayed in the boot language').toContain(EN('g.points'));
    // and NOTHING of the boot language is left on any of them
    const everything = Object.values(en).join(' | ');
    for (const key of Object.keys(WORDS)) {
      if (PT(key) === EN(key)) continue;
      expect(everything, `«${PT(key)}» (${key}) stayed after the switch to English`).not.toContain(PT(key));
    }
    // and no KEY reached a child
    expect(everything, 'a declared key reached the screen').not.toMatch(/\bg\.[a-z]/);
  });

  it('[Right] and the game\'s dictionaries answer for every key it declared — nothing of it in `problems`', () => {
    expect(motor.problems.filter((l) => /in none of this game's dictionaries|is not a key/.test(l))).toEqual([]);
  });
});

describe('a key the game declares and its dictionaries lack (ADR-0169)', () => {
  it('🔴 [Right] goes to `problems` in English — the subject by name, the cost to the child and the fix — and never to the screen', () => {
    motor.mount(declaracao(), {
      accommodations: SEM_ASSUNTO, players: [{ ctrl: 0 }],
      preset: { action2: { labelKey: 'g.jump' }, action3: { labelKey: 'g.forgotten' } },
      howToPlay: [{ textKey: 'g.read' }, { textKey: 'g.lostSlide' }],
    });
    const lines = motor.problems.filter((l) => /in none of this game's dictionaries/.test(l));
    const named = (subject) => lines.find((l) => l.startsWith(subject));
    const action = named('preset.action3.labelKey «g.forgotten»');
    expect(action, 'the missing action word was not said in `problems`').toBeTruthy();
    expect(action, 'the line does not say what the child loses').toMatch(/the child sees this button unnamed/);
    expect(action, 'the line does not say the fix').toMatch(/add it to CreateGameOptions\.dictionaries, in pt, en and es/);
    expect(named('howToPlay[1].textKey «g.lostSlide»'), 'the missing slide text was not said').toMatch(/this slide is left out of the help/);
    expect(lines, 'a key the dictionaries HAVE was accused').toHaveLength(2);

    // never the raw key on screen: the help shows the slide it can read and the button it can name, and neither key
    abrir('ajuda', null);
    const slides = document.querySelector('#help .slides');
    const dots = slides.querySelectorAll('.slide-ponto').length;
    const seen = [];
    for (let i = 0; i < dots; i++) {
      seen.push(wordsOf(slides));
      slides.dispatchEvent(new CustomEvent('passo', { detail: 1, bubbles: true }));
    }
    fecharTudo();
    expect(dots, 'the lost slide or the unnamed button got a slide').toBe(2);
    expect(seen.join(' | '), 'a missing key reached the help').not.toMatch(/g\.forgotten|g\.lostSlide/);
  });

  it('🔴 [Right] a word handed over in the OLD shape (a word, not a key) is said too — it is not a key of the dictionary', () => {
    motor.mount(declaracao(), { accommodations: SEM_ASSUNTO, players: [{ ctrl: 0 }], preset: { action2: { label: 'Pular' } } });
    expect(motor.problems.find((l) => l.startsWith('preset.action2.labelKey is not a key')), 'the old shape passed in silence')
      .toMatch(/since ADR-0232 D3 a game declares the KEY of each word/);
  });
});

// ============================== MUTATIONS CHECKED (2026-09-25, each applied alone, RED) ==============================
//   W1 the root resolves the preset ONCE at boot (the measured «Acima» defect)   🔴 English · problems
//   W2 `Translator.word` ignores the language (always the game's pt)               🔴 English
//   W3 the option rows' name frozen in pt                                          🔴 English
//   W4 the missing-key lines taken out of `problems`                               🔴 problems · old shape
//   W5 `declares` always true                                                      🔴 problems
//   W6 a name the dictionary lacks shown as its key (`wordsOf`)                    🔴 problems (never the key on screen)
//   W7 the HUD name frozen in pt                                                   🔴 English (and `hud-mounted-by-the-engine`)
