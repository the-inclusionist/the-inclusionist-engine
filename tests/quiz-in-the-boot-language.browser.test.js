// SPDX-License-Identifier: AGPL-3.0-or-later
// THE QUIZ DRAWS ITS FIRST QUESTION IN THE BOOT LANGUAGE, NOT THE FALLBACK (study item E4, local part).
//
// 📏 Measured in dist/quiz.html on 2026-09-13 with `en` stored: the first question's options were grouped as
// «Alternativas» and read «Gato, 1 de 4» on an English page; after one answer the next question said «Options». Same
// cause as `barra-no-idioma-do-arranque`: `initI18n` applies pt synchronously and fetches en asynchronously, and the
// quiz drew in that gap.
//
// 📌 OWN FILE: a clean module registry is what makes the gap exist (see `pad-no-idioma-do-arranque`).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pagina from '../app/quiz.html?raw';

const falas = [];
let antes = { lang: null, tts: null };

beforeAll(async () => {
  antes = { lang: localStorage.getItem('incl_lang'), tts: localStorage.getItem('incl_audiocat_tts') };
  localStorage.setItem('incl_lang', 'en');
  localStorage.setItem('incl_audiocat_tts', JSON.stringify({ on: true, vol: 0.8 }));
  window.speechSynthesis.speak = (u) => { falas.push(u.text); };
  document.body.innerHTML = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
    .replace(/<script[\s\S]*?<\/script>/g, '');
  (await import('../app/js/consumer-quiz/main-quiz.ts')).bootQuiz({ doc: document, win: window });
  // ⚠️ No `core/i18n` import: it would make this the test of an engine module, and the boundary gate would count the
  // quiz's own class names as a debt (measured). And `<html lang>` is no signal either — the runner's page is born «en».
  // The wait is for the first DRAW, whenever it comes: drawn in the gap, it comes at once and in Portuguese.
  for (let i = 0; i < 40 && !document.querySelector('.quiz-alts'); i++) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 150));
  expect(document.querySelector('.quiz-alts'), 'the quiz never drew — the case would measure nothing').not.toBeNull();
});
afterAll(() => {
  for (const [chave, v] of [['incl_lang', antes.lang], ['incl_audiocat_tts', antes.tts]]) {
    if (v === null) localStorage.removeItem(chave); else localStorage.setItem(chave, v);
  }
});

describe('the quiz on an English page', () => {
  it('🔴 [Right] the first question\'s options are grouped in English', () => {
    expect(document.querySelector('.quiz-alts')?.getAttribute('aria-label')).toBe('Options');
  });

  it('🔴 [Right] the first narration says each place in English, and nothing was said in the fallback first', () => {
    // ⚠️ THIS CASE USED TO LOOK FOR «Gato» ON AN ENGLISH PAGE, and finding it was the point — because the quiz's
    // options were hardcoded pt-BR literals and only the FRAME around them translated. 📏 Measured in the `dist`
    // on 2026-09-23: the flag changed `<html lang>`, the footer, the bar and the panels and left the statement and
    // the options in Portuguese. They are dictionary keys now (ADR-0225, and the quiz is no language subject), so
    // what this case asks is unchanged — the place is said in English — and the words around it finally agree.
    const pergunta = falas.find((f) => /Cat/.test(f));
    expect(pergunta, 'the question was never narrated').toBeTruthy();
    expect(pergunta).toContain('Cat, 1 of 4');
    expect(falas.join(' | '), 'something was narrated in Portuguese frames first').not.toMatch(/\d de \d/);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   B1 the first draw and the welcome run at once, in the gap (the code before this file)   🔴 both cases
