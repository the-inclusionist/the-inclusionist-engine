// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SECOND CONSUMER — pure logic (node project). ADR-0027 step 6, brought forward by the Dev on 2026-08-25.
//
// This file has a function the other tests do not: it is part of the INSTRUMENT. The consumer exists to measure the
// engine↔game boundary, and a consumer that is neither tested nor built measures nothing — it becomes a folder of good
// intentions, which is exactly what the ADR says "engine" becomes without it.
//
// The most important case here is not about any quiz: it is the one that checks this module does NOT IMPORT FROM
// `game/`. It is the experiment's whole rule, and without it the first hurry undoes it without anyone noticing.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { specifiersOf } from '../scripts/lib/module-specifiers.mjs';
import { questionHtml, nextFocus, answerText, endText, questionNarration, narrationOnDraw, heardAlternative } from '../app/js/consumer-quiz/main-quiz.js';

const FONTE = readFileSync(join(process.cwd(), 'app', 'js', 'consumer-quiz', 'main-quiz.ts'), 'utf8');
/**
 * The root's `t` (ADR-0232 D3), played by the test from the pt dictionary READ AS A FILE, as the case on the frames below
 * reads it: importing `core/i18n` or a dictionary would make this the test of an ENGINE module, and the boundary gate would
 * then count the consumer's own key names as a debt (measured). A key it does not find is itself, as the engine's is.
 */
const PT = readFileSync(join(process.cwd(), 'app', 'js', 'i18n', 'pt.ts'), 'utf8');
const translate = (key, params = {}) => {
  const found = PT.match(new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}':\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  let text = found ? found[1].replace(/\\'/g, "'") : key;
  for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
};
/** Every specifier the consumer names, read by the parser in every form — a literal `import()` and a side-effect
 *  `import 'pixi.js'` load code as surely as `from`, and a pattern over `from '…'` let both through. Type-only imports
 *  count: the case is about what the consumer is TIED to, not only about bytes. */
const SPECS = specifiersOf(FONTE, 'main-quiz.ts').map((s) => s.spec).filter(Boolean);
const ALVOS = SPECS.filter((s) => s.startsWith('.')).map((s) => posix.normalize(posix.join('consumer-quiz', s)));

describe('o consumidor obedece à própria regra', () => {
  it('[Right] NÃO importa de game/ — é a regra que faz dele um instrumento e não um jogo a mais', () => {
    expect(ALVOS.filter((a) => a.startsWith('game/'))).toEqual([]);
  });

  it('[Interface] e também não importa PIXI: quem não desenha mundo não paga 467 kB por isso', () => {
    // It is not economy, it is the measure. If the quiz needed PIXI to use the accessibility stack, that stack would be
    // tied to the platformer's renderer — and pillar 2 would hold only inside the genre.
    expect(SPECS.filter((s) => s === 'pixi.js' || s.startsWith('pixi.js/') || s.startsWith('@pixi/'))).toEqual([]);
  });

  it('[Interface] importa de core/ — a camada de a11y é alcançável sem trazer o jogo junto', () => {
    expect(FONTE).toMatch(/from '\.\.\/core\/a11y-sr\.js'/);
    expect(FONTE).toMatch(/from '\.\.\/core\/i18n\.js'/);
  });
});

describe('proximoFoco — a regra que o teclado e o pad compartilham', () => {
  it('[Right] anda para frente e para trás', () => {
    expect(nextFocus(0, 1, 4)).toBe(1);
    expect(nextFocus(2, -1, 4)).toBe(1);
  });

  it('[Boundary] dá a volta nas duas pontas', () => {
    // Wrapping is not a convenience: whoever navigates only by keyboard or by ONE button has no other way to go back, and
    // a list that stops at the end leaves the last option unreachable for that child.
    expect(nextFocus(3, 1, 4)).toBe(0);
    expect(nextFocus(0, -1, 4)).toBe(3);
  });

  it('[Zero] lista vazia devolve 0 em vez de NaN', () => {
    expect(nextFocus(0, 1, 0)).toBe(0);
    expect(nextFocus(2, -1, 0)).toBe(0);
  });
});

describe('respostaTexto — o que a criança cega RECEBE', () => {
  it('[Right] o acerto e o erro dizem coisas diferentes, e o erro DIZ A RESPOSTA', () => {
    // A not-yet without the right answer leaves the child nothing to learn from the mistake — and whoever depends on the
    // screen reader cannot simply look at the screen to find out.
    expect(answerText(translate, true, 'Galinha')).toContain('Certo');
    expect(answerText(translate, false, 'Galinha')).toContain('Galinha');
  });
});

describe('the quiz\'s own sentences come from the dictionary (study item E4, local part; ADR-0010 pillar 3)', () => {
  // 📏 Measured on 2026-09-13: «Certo!», «Ainda não. A resposta certa é …», «Fim! N de M.» and the options' group name
  // «Alternativas» were Portuguese literals in the consumer — an English page said them in Portuguese.
  const CHAVES = ['quiz.resposta.certa', 'quiz.resposta.errada', 'quiz.fim', 'quiz.alternativas'];

  it('🔴 [Right] no frame is a Portuguese literal in the source', () => {
    expect(FONTE).not.toMatch(/Certo!|Ainda não|Fim!|aria-label="Alternativas"/);
  });

  it('🔴 [Right] each frame exists in pt, en and es — and English is not Portuguese', () => {
    // The dictionaries are READ as files, like the source above: importing them would make this the test of an ENGINE
    // module, and the boundary gate would then count the consumer's own key names as a debt (measured).
    const dicionario = (l) => {
      const txt = readFileSync(join(process.cwd(), 'app', 'js', 'i18n', `${l}.ts`), 'utf8');
      return Object.fromEntries(CHAVES.map((k) => [k, txt.match(new RegExp(`'${k.replace(/\./g, '\\.')}':\\s*'([^']*)'`))?.[1]]));
    };
    const [pt, en, es] = ['pt', 'en', 'es'].map(dicionario);
    for (const k of CHAVES) {
      for (const [nome, d] of [['pt', pt], ['en', en], ['es', es]]) expect(d[k], `${k} missing in ${nome}`).toBeTruthy();
      expect(en[k], `${k}: the English is the Portuguese`).not.toBe(pt[k]);
    }
  });

  it('🎯 [Right] in Portuguese the child hears the same words as before — literals, not the dictionary read back', () => {
    expect(answerText(translate, true, 'Galinha')).toBe('Certo! Galinha.');
    expect(answerText(translate, false, 'Galinha')).toBe('Ainda não. A resposta certa é Galinha.');
    expect(endText(translate, 3, 4)).toBe('Fim! 3 de 4.');
    expect(questionHtml(translate, { enunciado: 'Quantos?', alternativas: ['Um'], certa: 0 }, 0)).toContain('aria-label="Alternativas"');
  });
  // MUTATIONS CHECKED (2026-09-13), 6 of 6 red: the answer frames back to literals · `quiz.fim` missing in es · en equal to
  // pt · the group name a literal again · one key for both answers · right and total swapped in the closing line.
});

describe('perguntaHtml — a marcação', () => {
  const p = { enunciado: 'Quantos?', alternativas: ['Um', 'Dois'], certa: 1 };

  it('[Right] cada alternativa é um rádio com estado, não um botão mudo', () => {
    const html = questionHtml(translate, p, 1);
    expect(html).toMatch(/role="radiogroup"/);
    expect(html).toMatch(/data-alt="1"[^>]*aria-checked="true"/);
    expect(html).toMatch(/data-alt="0"[^>]*aria-checked="false"/);
  });

  it('[Zero] sem alternativas, ainda monta o enunciado sem quebrar', () => {
    expect(questionHtml(translate, { enunciado: 'Vazio?', alternativas: [], certa: 0 }, 0)).toContain('Vazio?');
  });

  it('[Right] ⚠️ o CONTEÚDO DA PERGUNTA não vira marcação (issue #106)', () => {
    // The statement and the options are activity content — text, never markup. Today they come from a catalogue in code;
    // ADR-0052 makes them AUTHORED, and issue #106 demands this be fixed BEFORE that: «assim que um profissional puder
    // digitar numa atividade, deixa de ser censo e vira incidente».
    const FUGA = '"><i id="fugiu"></i><b>x';
    const html = questionHtml(translate, { enunciado: FUGA, alternativas: [FUGA], certa: 0 }, 0);
    expect(html, 'o conteúdo fechou um atributo e injetou um elemento').not.toContain('<i id=');
    expect(html).toContain('&lt;'); // escaped, not deleted
  });

  it('[Zero] e texto normal atravessa INTACTO — um escape que estraga a pergunta não serve a ninguém', () => {
    const html = questionHtml(translate, { enunciado: 'Quanto é 2 + 3?', alternativas: ['5', 'não sei'], certa: 0 }, 0);
    expect(html).toContain('Quanto é 2 + 3?');
    expect(html).toContain('não sei');
  });
});

describe('the voice of a question — the statement, then each option with its place after its name (ADR-0167)', () => {
  const galinha = { enunciado: 'Qual animal põe ovos e tem bico?', alternativas: ['Gato', 'Galinha', 'Cavalo', 'Peixe'], certa: 1 };
  const ABERTA = 'Qual animal põe ovos e tem bico? Gato, 1 de 4. Galinha, 2 de 4. Cavalo, 3 de 4. Peixe, 4 de 4';

  it('🔴 [Right] opening a question says the statement and then «Gato, 1 de 4. Galinha, 2 de 4. …»', () => {
    // A literal: a format computed in the test would move with the code. The place comes AFTER the name (ADR-0167).
    expect(questionNarration(translate, galinha, true)).toBe(ABERTA);
  });

  it('[Zero] a question with no options says only its statement — no dangling space', () => {
    expect(questionNarration(translate, { enunciado: 'Vazio?', alternativas: [], certa: 0 }, true)).toBe('Vazio?');
  });

  it('🔴 [Right] the WHOLE question only when it opens; a move on the same question says only the option reached', () => {
    const abre = narrationOnDraw(translate, galinha, 0, 0, -1, true);
    expect(abre).toEqual({ texto: ABERTA, narrada: 0 });
    // before, every arrow press re-read the statement and never said where the cursor was
    expect(narrationOnDraw(translate, galinha, 0, 1, abre.narrada, true)).toEqual({ texto: 'Galinha, 2 de 4', narrada: 0 });
    // and the next question opens whole again
    expect(narrationOnDraw(translate, galinha, 1, 0, 0, true).narrada).toBe(1);
  });

  it('🔴 [Right] the place is said only while the child keeps the index on — the quiz asks the engine, not the store (ADR-0232)', () => {
    // `indexOn` is what the quiz page reads from its engine handle (`Engine.menuIndexOn()`); with it off, the names alone.
    expect(questionNarration(translate, galinha, false)).toBe('Qual animal põe ovos e tem bico? Gato. Galinha. Cavalo. Peixe');
    expect(narrationOnDraw(translate, galinha, 0, 1, 0, false)).toEqual({ texto: 'Galinha', narrada: 0 });
  });
});

describe('alternativaOuvida — what the child SAID, when she answers out loud (ADR-0216, issue #200)', () => {
  const ANIMAIS = ['Gato', 'Galinha', 'Cavalo', 'Peixe'];
  const NUMEROS = ['Três', 'Quatro', 'Cinco', 'Dois'];

  it('[Right] the option said by itself is the answer', () => {
    expect(heardAlternative('galinha', ANIMAIS)).toBe(1);
  });

  it('🔴 [Right] a model writes like a person — case, accent and full stop are not part of the answer', () => {
    // Whisper gives back «Três.» and «GALINHA», and a child who is right must not be marked wrong by a comma.
    expect(heardAlternative('Três.', NUMEROS)).toBe(0);
    expect(heardAlternative('GALINHA!', ANIMAIS)).toBe(1);
    // 🔴 AND THE ACCENT ITSELF, which is the case the other two do not reach: a model that writes «tres» is not a child who
    // answered wrong. Both sides pass through the same rule, so a case with the accent on BOTH sides proves nothing — it took a
    // surviving mutation to show that the accent was never once exercised.
    expect(heardAlternative('tres', NUMEROS)).toBe(0);
  });

  it('🔴 [Right] and she is allowed to answer in a sentence — «eu acho que é a galinha»', () => {
    expect(heardAlternative('eu acho que é a galinha', ANIMAIS)).toBe(1);
  });

  it('🔴 [Right] TWO options heard is not an answer: a child thinking out loud is not choosing', () => {
    // Answering for her would also MARK IT WRONG, which is the cost this case exists to refuse.
    expect(heardAlternative('gato ou galinha', ANIMAIS)).toBeNull();
  });

  it('[Zero] nothing heard, and something that is none of them, answer nothing', () => {
    expect(heardAlternative('', ANIMAIS)).toBeNull();
    expect(heardAlternative('   ...  ', ANIMAIS)).toBeNull();
    expect(heardAlternative('elefante', ANIMAIS)).toBeNull();
    expect(heardAlternative('gato', [])).toBeNull();
  });

  it('🔴 [Boundary] WHOLE words: «doisel» is not «Dois», and an empty option answers nothing', () => {
    expect(heardAlternative('doisel', NUMEROS)).toBeNull();
    // An option with no words would otherwise be found inside every sentence, and then NOTHING could ever be answered.
    expect(heardAlternative('gato', ['', 'Gato'])).toBe(1);
  });

  it('🔴 [Boundary] an option of two words is found in ORDER, and only in order', () => {
    expect(heardAlternative('é um cavalo marinho', ['Cavalo marinho', 'Gato'])).toBe(0);
    expect(heardAlternative('marinho cavalo', ['Cavalo marinho', 'Gato'])).toBeNull();
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-ouvir-resposta.py`, 10 of 10 red, each mutant compiled first:
//   · the accents stop being decomposed (NFD → NFC)   · the case stops being lowered   · punctuation stays inside the word
//   · the FIRST option heard wins instead of needing exactly one   · part of a word counts   · the word order stops counting
//   · an empty option is found in every sentence   · the demo stops declaring the reading   · nobody asks to listen
//   · the demo names the microphone again
// 🔴 THREE OF THEM SURVIVED FIRST. Two were holes in the GATE — the demo's declaration and its `listen()` could both be deleted
// with the case still green, because the comment beside each one quotes it, so the gate now strips comments before reading. The
// third was a hole in the CASES: every accent case had the accent on BOTH sides, where the rule is symmetric and proves nothing.
