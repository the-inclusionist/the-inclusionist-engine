// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TRANSLATOR A ROOT BUILDS (ADR-0232 D3, its erratum of docs dac7a6d and that of 2026-09-25): everything that changes
// lives in it — the language, the dictionaries loaded, the game's own dictionary, the listeners — and `core/i18n` holds no
// state, so two translators share nothing but what the page tells both.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
import { KEYS } from '../app/js/platform/storage-keys.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

/** A port over a storage of this case's own: nothing kept here reaches another case. */
const ownPort = (extra = {}) => ({ ...createStorage(memoryBackend()), KEYS, ...extra });

describe('core/i18n — createTranslator', () => {
  it('🔴 [Right] its `t` translates in its language, and follows its own switch', async () => {
    const tr = createTranslator(ownPort());
    const pt = tr.t('state.on');
    await tr.setLocale('en');
    expect(tr.locale()).toBe('en');
    expect(tr.t('state.on'), 'the translator did not follow its switch').not.toBe(pt);
    expect(tr.bcp47()).toBe('en-US');
  });

  it('[Right] `t` interpolates its params', () => {
    const tr = createTranslator();
    expect(tr.t('sr.menu.index', { n: 2, m: 4 })).toBe('2 de 4');
  });

  it('🔴 [Right] `onChange` hears a switch with the new language, and its release silences it', async () => {
    const tr = createTranslator(ownPort());
    const heard = [];
    const release = tr.onChange((code) => heard.push(code));
    await tr.setLocale('es');
    release();
    await tr.setLocale('en');
    expect(heard, 'the listener heard nothing, or heard past its release').toEqual(['es']);
  });

  it('🔴 [Right] `applyDom` writes its language into the declarative markup', () => {
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

  it('🔴 [Right] a switch is KEPT through the port and told to the page, with the region\'s tag', async () => {
    const told = [];
    const port = ownPort({ applied: (locale, tag) => told.push(`${locale}/${tag}`) });
    const tr = createTranslator(port);
    await tr.setLocale('es');
    expect(port.get(KEYS.lang, null)).toBe('es');
    expect(told).toEqual(['es/es-MX']);
  });

  it('🔴 [Right] `init` asks for the STORED language, and `ready` waits for it', async () => {
    const port = ownPort();
    port.set(KEYS.lang, 'en');
    const tr = createTranslator(port);
    expect(tr.init({ querySelectorAll: () => [] }), 'the boot is synchronous, in pt').toBe('pt');
    await tr.ready();
    expect(tr.locale()).toBe('en');
  });

  it('🔴 [Error] a switch with no port is refused, and nothing has moved (ADR-0178)', async () => {
    const tr = createTranslator();
    await expect(tr.setLocale('en')).rejects.toThrow(/without a port/);
    expect(tr.locale()).toBe('pt');
  });
});

describe('core/i18n — two translators share nothing but the page (ADR-0232 D3)', () => {
  it('🔴 [Right] one translator\'s switch does not move another built with no page between them', async () => {
    const a = createTranslator(ownPort()), b = createTranslator(ownPort());
    await a.setLocale('en');
    expect(b.locale(), 'module-level state: the language leaked between translators').toBe('pt');
  });

  it('🔴 [Right] and the PAGE carries it: a translator that follows the page switches when another tells it', async () => {
    const listeners = [];
    const page = { applied: (locale) => { for (const l of listeners) l(locale); }, follow: (react) => { listeners.push(react); } };
    const a = createTranslator(ownPort(page)), b = createTranslator(ownPort(page));
    const heard = [];
    b.onChange((code) => heard.push(code));
    await a.setLocale('es');
    await new Promise((r) => { setTimeout(r, 0); });
    expect(b.locale(), 'the other root on the page stayed in the old language').toBe('es');
    expect(heard).toEqual(['es']);
  });
});

describe('core/i18n — a game\'s dictionary is its ROOT\'s (ADR-0232 D3 erratum)', () => {
  it('🔴 [Right] what one translator registers, another translator on the same page does not read', () => {
    const a = createTranslator(), b = createTranslator();
    a.registerDict('pt', { 'rootA.greeting': 'Olá do jogo A' });
    expect(a.t('rootA.greeting')).toBe('Olá do jogo A');
    expect(b.t('rootA.greeting'), 'a second root read the first root\'s dictionary').toBe('rootA.greeting');
  });

  it('🔴 [Right] the chain falls back to the root\'s own pt, after the engine\'s current language', async () => {
    const tr = createTranslator(ownPort());
    tr.registerDict('pt', { 'rootC.only': 'só em português' });
    await tr.setLocale('en');
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

describe('core/i18n — a word the GAME declared, by its key (ADR-0232 D3, erratum of 2026-09-25)', () => {
  it('🔴 [Right] `word` resolves in the current language, from the game\'s dictionary, and follows a switch', async () => {
    const tr = createTranslator(ownPort());
    tr.registerDict('pt', { 'g.up': 'Acima' });
    tr.registerDict('en', { 'g.up': 'Up' });
    expect(tr.word('g.up')).toBe('Acima');
    await tr.setLocale('en');
    expect(tr.word('g.up'), '«Acima» stayed after the switch to English').toBe('Up');
  });

  it('🔴 [Right] `word` falls back to the game\'s pt, and is NULL — never the key — when the game has neither', async () => {
    const tr = createTranslator(ownPort());
    tr.registerDict('pt', { 'g.onlyPt': 'só pt' });
    await tr.setLocale('es');
    expect(tr.word('g.onlyPt')).toBe('só pt');
    expect(tr.word('g.nowhere'), 'a key the game lacks came back as a word').toBeNull();
  });

  it('🔴 [Right] `word` reads only the GAME\'s dictionary — an engine key is not a word this game declared', () => {
    const tr = createTranslator();
    expect(tr.t('state.on')).not.toBe('state.on');
    expect(tr.word('state.on'), 'an engine key passed for a declared word').toBeNull();
  });

  it('🔴 [Right] `declares` is true for a key in ANY of the game\'s languages, false for one in none', () => {
    const tr = createTranslator();
    tr.registerDict('es', { 'g.es': 'sólo es' });
    expect(tr.declares('g.es')).toBe(true);
    expect(tr.declares('g.none')).toBe(false);
    expect(tr.declares('state.on'), 'an engine key counted as the game\'s').toBe(false);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   T1 `onChange` never adds the listener                  🔴 onChange
//   T2 the release does not delete it                      🔴 onChange
//   T3 the switch does not notify the listeners            🔴 onChange
//   T4 `word` ignores the language (always the game's pt)   🔴 word follows a switch
//   T5 a followed switch is not applied                      🔴 the PAGE carries it
//   T6 `word` answers an engine key                          🔴 word reads only the game's
