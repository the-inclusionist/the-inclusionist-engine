// SPDX-License-Identifier: AGPL-3.0-or-later
// THE QUIZ'S WELCOME NAMES THE KEYS THIS CHILD HAS — the pure sentence builder (`welcomeText`), node project.
//
// 🔴 Measured on the served `dist` (2026-09-26): the welcome said «Use as setas para escolher e Enter para responder», and in
// the solo scheme Enter is `start` — it opened the pause. Answering is `action2` (J or Space), moving is `up`/`down`. And
// the child can remap, so any fixed sentence can lie again: the keys come from the scheme and cross as `{params}`.
//
// 📌 NOTHING OF THE ENGINE IS IMPORTED, on purpose: the dictionaries are READ AS FILES (as `consumer-quiz.node.test.js` reads
// pt), and the scheme and the key names are fixtures. Importing an engine module would make this an ENGINE test, and the
// boundary gate would count the quiz's own words as a debt. The engine's real scheme and `keyName` are exercised by
// `quiz-answers-by-real-key.browser.test.js`, which presses the key the page actually names.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { welcomeText } from '../app/js/consumer-quiz/main-quiz.js';

/** A translator over one dictionary file; a key it does not find is itself, as the engine's is. */
function translatorOf(lang) {
  const src = readFileSync(join(process.cwd(), 'app', 'js', 'i18n', `${lang}.ts`), 'utf8');
  return (key, params = {}) => {
    const found = src.match(new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'((?:[^'\\\\]|\\\\.)*)'`));
    let text = found ? found[1].replace(/\\'/g, "'") : key;
    for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
    return text;
  };
}
const [pt, en, es] = ['pt', 'en', 'es'].map(translatorOf);

/** The default solo scheme's three positions the welcome reads (`input/default-bindings` KEYBOARD_SOLO). */
const SOLO = { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], action2: ['KeyJ', 'Space'] };
/** Key names as the engine writes them: the arrows are glyphs, Space is a word, a letter is itself. */
const GLYPH = { ArrowUp: '↑', ArrowDown: '↓' };
const welcome = (t, scheme) => welcomeText(t, scheme, (code) => GLYPH[code] ?? (code === 'Space' ? t('key.space') : code.replace(/^Key/, '')));

describe('the quiz welcome, in the default solo scheme', () => {
  it('🔴 [Right] names the arrows to choose and Space to answer — never Enter, which opens the pause', () => {
    const texto = welcome(pt, SOLO);
    expect(texto).toBe('Quiz. Use ↑ e ↓ para escolher e Espaço para responder.');
    expect(texto).not.toMatch(/Enter/);
  });

  it('🔴 [Right] in en and es too — the frame translates, the key names are parameters', () => {
    expect(welcome(en, SOLO)).toBe('Quiz. Use ↑ and ↓ to choose and Space to answer.');
    expect(welcome(es, SOLO)).toBe('Cuestionario. Use ↑ y ↓ para elegir y Espacio para responder.');
  });
});

describe('the quiz welcome, for the child who remapped', () => {
  it('🔴 [Right] names HER keys, not the factory ones', () => {
    expect(welcome(pt, { up: ['KeyQ'], down: ['KeyZ'], action2: ['KeyM'] })).toBe('Quiz. Use Q e Z para escolher e M para responder.');
  });
});

describe('the quiz welcome, when a position has no key', () => {
  it('🔴 [Boundary] no key to answer: the line does not name one', () => {
    const texto = welcome(pt, { ...SOLO, action2: null });
    expect(texto).toBe('Quiz. Use ↑ e ↓ para escolher.');
    expect(texto).not.toMatch(/responder|Espaço|\bJ\b|Enter|null|undefined|\{/);
  });

  it('🔴 [Boundary] only one of up and down: that one is enough, the cursor wraps around', () => {
    expect(welcome(pt, { ...SOLO, up: null })).toBe('Quiz. Use ↓ para escolher e Espaço para responder.');
    expect(welcome(pt, { ...SOLO, down: [] })).toBe('Quiz. Use ↑ para escolher e Espaço para responder.');
  });

  it('🔴 [Boundary] no key to choose, or none at all: nothing is named that is not there', () => {
    expect(welcome(pt, { ...SOLO, up: null, down: null })).toBe('Quiz. Use Espaço para responder.');
    expect(welcome(pt, { up: null, down: null, action2: null })).toBe('Quiz. Toque numa resposta para responder.');
  });
});

// ============================== MUTATIONS CHECKED ==============================
