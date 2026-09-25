// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TRANSLATOR A ROOT BUILDS (ADR-0232 D3, and its erratum of docs dac7a6d): the LANGUAGE is the page's, and a translator
// is a root's side of it — its `t`, its markup pass, and a subscription to a change that its root can release.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, afterEach } from 'vitest';
import { createTranslator, setLocale, registerDict } from '../app/js/core/i18n.js';

afterEach(async () => { await setLocale('pt'); });

describe('core/i18n — createTranslator', () => {
  it('🔴 [Right] its `t` translates in the page\'s language, and follows a switch', async () => {
    const tr = createTranslator();
    const pt = tr.t('state.on');
    await setLocale('en');
    expect(tr.locale()).toBe('en');
    expect(tr.t('state.on'), 'the translator did not follow the page\'s language').not.toBe(pt);
    expect(tr.bcp47()).toBe('en-US');
  });

  it('[Right] `t` interpolates its params', () => {
    const tr = createTranslator();
    expect(tr.t('sr.menu.index', { n: 2, m: 4 })).toBe('2 de 4');
  });

  it('🔴 [Right] `onChange` hears a switch with the new language, and its release silences it', async () => {
    const tr = createTranslator();
    const heard = [];
    const release = tr.onChange((code) => heard.push(code));
    await setLocale('es');
    release();
    await setLocale('en');
    expect(heard, 'the listener heard nothing, or heard past its release').toEqual(['es']);
  });

  it('🔴 [Right] `applyDom` writes the page\'s language into the declarative markup', () => {
    const tr = createTranslator();
    const els = [{ attr: 'state.on', text: '' }];
    const root = {
      querySelectorAll: (sel) => (sel === '[data-i18n]'
        ? els.map((e) => ({ getAttribute: () => e.attr, set textContent(v) { e.text = v; } }))
        : []),
    };
    tr.applyDom(root);
    expect(els[0].text).toBe(tr.t('state.on'));
  });
});

describe('core/i18n — a game\'s dictionary is its ROOT\'s (ADR-0232 D3 erratum)', () => {
  it('🔴 [Right] what one translator registers, another translator on the same page does not read', () => {
    const a = createTranslator(), b = createTranslator();
    a.registerDict('pt', { 'rootA.greeting': 'Olá do jogo A' });
    expect(a.t('rootA.greeting')).toBe('Olá do jogo A');
    expect(b.t('rootA.greeting'), 'a second root read the first root\'s dictionary').toBe('rootA.greeting');
  });

  it('🔴 [Right] its own word wins over the page-wide one, and the page-wide one is still read — transitional (issue #207)', () => {
    registerDict('pt', { 'shared.word': 'da página', 'pageOnly.word': 'só da página' });
    const tr = createTranslator();
    tr.registerDict('pt', { 'shared.word': 'da raiz' });
    expect(tr.t('shared.word'), 'the page-wide word won over the root\'s own').toBe('da raiz');
    expect(tr.t('pageOnly.word'), 'a game that registers page-wide lost its words').toBe('só da página');
  });

  it('🔴 [Right] the chain falls back to the root\'s own pt, after the engine\'s current language', async () => {
    const tr = createTranslator();
    tr.registerDict('pt', { 'rootC.only': 'só em português' });
    await setLocale('en');
    expect(tr.t('rootC.only'), 'with no English, the child should read the game\'s Portuguese').toBe('só em português');
    tr.registerDict('en', { 'rootC.only': 'in English' });
    expect(tr.t('rootC.only'), 'the current language did not win over pt').toBe('in English');
  });

  it('🔴 [Right] a string with markup is refused from the root\'s dictionary, and said', () => {
    const tr = createTranslator();
    const error = console.error;
    const said = [];
    console.error = (m) => { said.push(m); };
    try {
      expect(tr.registerDict('pt', { 'rootD.bad': '<b>x</b>', 'rootD.good': 'bom' })).toEqual(['rootD.bad']);
    } finally { console.error = error; }
    expect(tr.t('rootD.bad'), 'the markup went in').toBe('rootD.bad');
    expect(tr.t('rootD.good')).toBe('bom');
    expect(said.join(' ')).toContain('rootD.bad');
  });

  it('🔴 [Right] its gaps are its own game\'s: a key given in pt and not in en or es, and nothing for another root', () => {
    const a = createTranslator(), b = createTranslator();
    a.registerDict('pt', { 'rootE.half': 'metade' });
    a.registerDict('en', { 'rootE.half': 'half' });
    const gaps = a.dictionaryGaps().join(' | ');
    expect(gaps).toMatch(/lacks es for [^|]*rootE\.half/);
    expect(gaps, 'a language the key has was accused').not.toMatch(/lacks en for [^|]*rootE\.half/);
    expect(b.dictionaryGaps().join(' | '), 'another root was accused of this root\'s gap').not.toContain('rootE.half');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   T1 `onChange` never adds the listener                  🔴 onChange
//   T2 the release does not delete it                      🔴 onChange
//   T3 the page's switch does not notify the listeners     🔴 onChange
