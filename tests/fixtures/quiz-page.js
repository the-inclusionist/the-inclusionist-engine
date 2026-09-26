// SPDX-License-Identifier: AGPL-3.0-or-later
// THE DEMO QUIZ'S PAGE, as the browser gates mount it: the real `quiz.html` body (its inline script left out — the case boots),
// and the way into a skill from the start screen the quiz opens on (the test bench).
import pagina from '../../app/quiz.html?raw';

/** The page's body without its script, the same markup the real page serves. */
export const QUIZ_BODY = pagina.slice(pagina.indexOf('<body>') + '<body>'.length, pagina.indexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Opens skill `index` of the start screen — by a click on its button, the way a pointer does — and waits for its question.
 * 📌 The quiz opens on the start screen since it became a test bench; a gate about the question screen passes through here.
 */
export async function openSkill(doc = document, index = 0) {
  for (let i = 0; i < 40 && !doc.querySelector('#quiz-app .quiz-skill'); i++) await wait(25);
  const button = doc.querySelector(`#quiz-app .quiz-skill[data-skill="${index}"]`);
  if (!button) throw new Error(`the start screen has no skill ${index} — the case would measure nothing`);
  button.click();
  for (let i = 0; i < 40 && !doc.querySelector('#quiz-app .quiz-alts'); i++) await wait(25);
  if (!doc.querySelector('#quiz-app .quiz-alts')) throw new Error('the skill opened no question');
}
