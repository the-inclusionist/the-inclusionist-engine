// SPDX-License-Identifier: AGPL-3.0-or-later
// EVERY `data-i18n` KEY OF THE DEMO PAGE EXISTS IN THE THREE LANGUAGES.
//
// `applyDom` rewrites whatever carries `data-i18n` — the page's `<title>` included —, and a key no dictionary has comes back
// as the key itself (`t` returns it). The page's own markup is read by no other gate: `no-key-reaches-the-child-unresolved`
// parses `t('…')` calls in app/js, not HTML attributes.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

const html = readFileSync(new URL('../app/quiz.html', import.meta.url), 'utf8');
const keys = [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((m) => m[1]);

describe('the demo page', () => {
  it('🔴 [Right] names its title by a key, not by a fixed sentence', () => {
    expect(html, 'the <title> is a fixed sentence again').toMatch(/<title data-i18n="[^"]+">/);
  });

  it('🔴 [Right] every key it uses exists in pt, en and es', () => {
    expect(keys.length, 'the page carries no key at all: this case would measure nothing').toBeGreaterThan(0);
    const missing = keys.flatMap((k) => [['pt', pt], ['en', en], ['es', es]].filter(([, d]) => !(k in d)).map(([l]) => `${l}:${k}`));
    expect(missing).toEqual([]);
  });
});

// ===== MUTATIONS CHECKED (2026-09-24) =====
// 1. `quiz.pageTitle` removed from en.ts            → [Right] every key red (en:quiz.pageTitle)
// 2. the <title> back to a fixed sentence           → [Right] names its title red
