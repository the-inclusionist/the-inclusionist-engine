// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TRANSLATOR A ROOT BUILDS (ADR-0232 D3, and its erratum of docs dac7a6d): the LANGUAGE is the page's, and a translator
// is a root's side of it — its `t`, its markup pass, and a subscription to a change that its root can release.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, afterEach } from 'vitest';
import { createTranslator, setLocale } from '../app/js/core/i18n.js';

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

// ============================== MUTATIONS CHECKED ==============================
//   T1 `onChange` never adds the listener                  🔴 onChange
//   T2 the release does not delete it                      🔴 onChange
//   T3 the page's switch does not notify the listeners     🔴 onChange
