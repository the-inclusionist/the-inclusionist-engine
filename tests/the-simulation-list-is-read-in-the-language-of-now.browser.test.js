// SPDX-License-Identifier: AGPL-3.0-or-later
// THE EMPATHY PANEL'S SIMULATION LIST IS SOMETHING A CHILD READS (ADR-0159 rule 7; ADR-0074; ADR-0225).
//
// The list is a `<select>` the composition root builds by hand and KEEPS — «built once, so the focus stays on it while
// the child adjusts» — and everything a reader takes from it is therefore rewritten at each opening rather than at
// build time: the row's short label, the list's own accessible name, and the name of every option.
//
// ⚠️ WHY THIS FILE EXISTS, and it is not a style preference. 📏 Probed on 2026-09-23 by disabling each decision of
// `renderVizGroup` one at a time and asking the suite whether it noticed: FIVE of nine stayed green. Among them, all
// three that this file now holds — the list could lose its accessible name, pile a second set of options on every
// opening, and name each option by its KEY (`lv-tunnel`) instead of by what it does, with 276 cases still passing.
// `tests/field-of-vision-simulations.browser.test.js` reads the option VALUES, which is exactly why none of it was
// seen: a value is what the code stores, never what the child reads.
//
// 📌 The two probes that are NOT here, and why:
//   · the row rebuilt at every render, and the label not rewritten — already RED; cases elsewhere hold them.
//   · a key the ten-item list does not know becoming a blank option — UNREACHABLE from outside today. The list is a
//     private const inside `createGame` and every entry of it is a known mode, so the guard protects a future edit of
//     that const and nothing a caller can do. It gets a case when the list arrives as data (the cut, ADR-0221 step 7c).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { createTranslator } from '../app/js/core/i18n.ts';
/** The page's language is switched through the root's translator (`core/i18n` holds no state, ADR-0232 D3). */
const setLocale = (code) => motor.setLocale(code);
import { createSimulationList } from '../app/js/ui/simulation-list.ts';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)

let motor;
let idiomaGuardado;

const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#mundo' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});

/** The child's path to the list: pause → settings → empathy. */
function abrirEmpatia() {
  motor.pause.show(0);
  document.querySelector('#vp-pause-0 .pm-btn[data-act="options"]').click();
  document.querySelector('#vp-pause-0 .pm-btn[data-act="empatia"]').click();
  return document.querySelector('#empathy #opt-simulacao');
}
function fechar() {
  for (const ov of document.querySelectorAll('#game-region .overlay')) ov.hidden = true;
  motor.pause.hide(0);
}
const textos = (sel) => [...sel.options].map((o) => (o.textContent ?? '').trim());
const chaves = (sel) => [...sel.options].map((o) => o.value);

beforeAll(async () => {
  idiomaGuardado = localStorage.getItem('incl_lang');
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"><div id="mundo" style="position:relative;width:640px;height:360px"></div></div><div id="title-icons"></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({ accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, downloadHeavy: false, players: [{ ctrl: 0 }] });
});

// ⚠️ The stored language lives in this origin's storage, which every browser file of this suite SHARES. A file that
// leaves it on English writes into the next one — measured once already, on the persisted contrast setting.
afterAll(async () => {
  await setLocale('pt');
  if (idiomaGuardado === null) localStorage.removeItem('incl_lang');
  else localStorage.setItem('incl_lang', idiomaGuardado);
});

describe('the simulation list, as a child reads it', () => {
  it('🔴 [Right] the list has an accessible name of its own, and it is what the row says', () => {
    const sel = abrirEmpatia();
    expect(sel, 'no simulation list in the empathy panel').toBeTruthy();
    const rotulo = sel.closest('.ctrl-row').querySelector('strong').textContent.trim();
    expect(rotulo, 'the row lost its short label').toBeTruthy();
    // a `<select>` inside a row whose label is a sibling is announced as «combo box» and nothing else without this
    expect(sel.getAttribute('aria-label')).toBe(rotulo);
    fechar();
  });

  it('🔴 [Right] every option is named by what it DOES, never by the key that stores it (ADR-0074)', () => {
    const sel = abrirEmpatia();
    const nomes = textos(sel);
    expect(nomes.length).toBeGreaterThan(1);
    // the literal, so the case cannot pass by reading the same table the code reads
    expect(nomes[chaves(sel).indexOf('lv-tunnel')]).toBe('Baixa visão: visão de túnel');
    expect(nomes[chaves(sel).indexOf('blind')]).toBe('Simular cegueira total');
    // and the general rule, which is what a new mode has to obey too
    for (const [i, chave] of chaves(sel).entries()) {
      expect(nomes[i], `option «${chave}» shows an identifier`).not.toBe(chave);
      expect(nomes[i], `option «${chave}» has no name at all`).toBeTruthy();
    }
    fechar();
  });

  it('🔴 [Boundary] reopening does not pile a second set of options on the first', () => {
    const sel = abrirEmpatia();
    const quantas = sel.options.length;
    fechar();
    const outra = abrirEmpatia();
    expect(outra, 'the list did not survive the reopening').toBe(sel); // kept, so the focus survives the redraw
    expect(outra.options.length, 'the options were appended instead of rewritten').toBe(quantas);
    expect(new Set(chaves(outra)).size).toBe(quantas);
    fechar();
  });

  it('🔴 [Right] a language changed in play rewrites the name of the list AND of every option', async () => {
    const sel = abrirEmpatia();
    const pt = textos(sel);
    const rotuloPt = sel.getAttribute('aria-label');
    fechar();

    await setLocale('en');
    await new Promise((r) => setTimeout(r, 120));
    const depois = abrirEmpatia();
    expect(depois.getAttribute('aria-label'), 'the list keeps its old name').not.toBe(rotuloPt);
    expect(depois.getAttribute('aria-label')).toBe('Simulations');
    const en = textos(depois);
    expect(en.length, 'the options were appended in the new language on top of the old ones').toBe(pt.length);
    expect(en[chaves(depois).indexOf('lv-tunnel')]).toBe('Low vision: tunnel vision');
    for (const [i, chave] of chaves(depois).entries()) {
      expect(en[i], `option «${chave}» is still in the language it was built in`).not.toBe(pt[i]);
    }
    fechar();
  });
});

// ==========================================================================================================
// THE LIST DRIVEN DIRECTLY, WITHOUT A ROOT — which is what the cut bought.
//
// 📌 The guard «a key no mode answers for is skipped» was UNREACHABLE while the ten keys were a private const inside
// `createGame`: every entry of that const is a known mode, so nothing a caller could do would exercise it. With the keys
// arriving as data it is a caller's decision, and this is the case the probe could not write.
// ==========================================================================================================
describe('the list, given the keys as data', () => {
  const montar = (keys, running = () => null) => {
    const hospedeiro = document.createElement('div');
    hospedeiro.id = 'solta';
    document.body.appendChild(hospedeiro);
    const lista = createSimulationList({
      t: translate,
      find: (sel) => document.querySelector(sel),
      make: (tag) => document.createElement(tag),
      keys,
      running,
      picked: () => {},
    });
    lista.render('#solta');
    return { sel: hospedeiro.querySelector('#opt-simulacao'), hospedeiro };
  };

  it('🔴 [Boundary] a key no mode answers for is skipped, not shown as a blank option', () => {
    const { sel, hospedeiro } = montar(['normal', 'nao-existe', 'blind']);
    expect(chaves(sel), 'the unknown key became an option the child can pick').toEqual(['normal', 'blind']);
    hospedeiro.remove();
  });

  it('🔴 [Right] the explanation is put in the row\'s `.opt-hint`, which is how it reaches the footer (CLAUDE.md §4)', () => {
    // Driven here and not through a panel because `fillExplain` MOVES the hint out on the way to the footer: the only place
    // the producer's half can be seen is before that happens. Without it the row keeps its prose beside the label, and the
    // menu becomes the manual the decision of 2026-08-25 forbade.
    const { sel, hospedeiro } = montar(['normal']);
    const dica = sel.closest('.ctrl-row').querySelector('.opt-hint');
    expect(dica, 'the row has no `.opt-hint` for the footer to take').not.toBeNull();
    expect(dica.textContent.trim().length, 'the hint is there and empty').toBeGreaterThan(10);
    hospedeiro.remove();
  });

  it('🔴 [Right] the list shows what is RUNNING, so a refused choice comes back by itself (ADR-0076)', () => {
    const { sel, hospedeiro } = montar(['normal', 'blind'], () => 'blind');
    expect(sel.value).toBe('blind');
    hospedeiro.remove();
  });

  it('🎯 [Zero] with nothing running the list sits on «normal», and a selector that matches nothing does not throw', () => {
    const { sel, hospedeiro } = montar(['normal', 'blind']);
    expect(sel.value).toBe('normal');
    hospedeiro.remove();
    const solto = createSimulationList({
      t: translate, find: () => null, make: (tag) => document.createElement(tag), keys: ['normal'], running: () => null, picked: () => {},
    });
    expect(() => solto.render('#nada')).not.toThrow();
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   V1 `escolha.setAttribute('aria-label', rotulo)` removed        🔴 accessible name
//   V2 `opcao.textContent = t(modo.nome)` → the key                🔴 named by what it does · language in play
//   V3 `escolha.textContent = ''` removed (options pile up)        🔴 reopening · language in play
//   V4 the whole option loop moved into the `if (!escolha)` block  🔴 language in play (the options freeze)
