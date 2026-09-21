// SPDX-License-Identifier: AGPL-3.0-or-later
// O SEGUNDO CONSUMIDOR — lógica pura (project node). ADR-0027 passo 6, antecipado pelo Dev em 2026-08-25.
//
// Este arquivo tem uma função que os outros testes não têm: ele é parte do INSTRUMENTO. O consumidor existe
// para medir a fronteira engine↔jogo, e um consumidor que não é testado nem construído não mede nada — vira
// uma pasta com boas intenções, que é exatamente o que o ADR diz que "engine" vira sem ele.
//
// O caso mais importante daqui não é sobre quiz nenhum: é o que afere que este módulo NÃO IMPORTA DE `game/`.
// É a regra inteira do experimento, e sem ela a primeira pressa a desfaz sem que ninguém perceba.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { perguntaHtml, proximoFoco, respostaTexto, fimTexto, narracaoDaPergunta, narracaoAoDesenhar, alternativaOuvida } from '../app/js/consumer-quiz/main-quiz.js';

const FONTE = readFileSync(join(process.cwd(), 'app', 'js', 'consumer-quiz', 'main-quiz.ts'), 'utf8');

describe('o consumidor obedece à própria regra', () => {
  it('[Right] NÃO importa de game/ — é a regra que faz dele um instrumento e não um jogo a mais', () => {
    expect(FONTE).not.toMatch(/from '\.\.\/game\//);
  });

  it('[Interface] e também não importa PIXI: quem não desenha mundo não paga 467 kB por isso', () => {
    // Não é economia, é a medida. Se o quiz precisasse da PIXI para usar a pilha de acessibilidade, essa
    // pilha estaria amarrada ao renderizador do jogo de plataforma — e o pilar 2 valeria só dentro do gênero.
    expect(FONTE).not.toMatch(/from 'pixi\.js'|@pixi/);
  });

  it('[Interface] importa de core/ — a camada de a11y é alcançável sem trazer o jogo junto', () => {
    expect(FONTE).toMatch(/from '\.\.\/core\/a11y-sr\.js'/);
    expect(FONTE).toMatch(/from '\.\.\/core\/i18n\.js'/);
  });
});

describe('proximoFoco — a regra que o teclado e o pad compartilham', () => {
  it('[Right] anda para frente e para trás', () => {
    expect(proximoFoco(0, 1, 4)).toBe(1);
    expect(proximoFoco(2, -1, 4)).toBe(1);
  });

  it('[Boundary] dá a volta nas duas pontas', () => {
    // Dar a volta não é conveniência: quem navega só por teclado ou por UM botão não tem como "voltar" de
    // outro jeito, e uma lista que trava na ponta deixa a última alternativa inalcançável para essa criança.
    expect(proximoFoco(3, 1, 4)).toBe(0);
    expect(proximoFoco(0, -1, 4)).toBe(3);
  });

  it('[Zero] lista vazia devolve 0 em vez de NaN', () => {
    expect(proximoFoco(0, 1, 0)).toBe(0);
    expect(proximoFoco(2, -1, 0)).toBe(0);
  });
});

describe('respostaTexto — o que a criança cega RECEBE', () => {
  it('[Right] o acerto e o erro dizem coisas diferentes, e o erro DIZ A RESPOSTA', () => {
    // Um "ainda não" sem a resposta certa deixa a criança sem o que aprender com o erro — e quem depende do
    // leitor de tela não pode simplesmente olhar a tela para descobrir.
    expect(respostaTexto(true, 'Galinha')).toContain('Certo');
    expect(respostaTexto(false, 'Galinha')).toContain('Galinha');
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
    expect(respostaTexto(true, 'Galinha')).toBe('Certo! Galinha.');
    expect(respostaTexto(false, 'Galinha')).toBe('Ainda não. A resposta certa é Galinha.');
    expect(fimTexto(3, 4)).toBe('Fim! 3 de 4.');
    expect(perguntaHtml({ enunciado: 'Quantos?', alternativas: ['Um'], certa: 0 }, 0)).toContain('aria-label="Alternativas"');
  });
  // MUTATIONS CHECKED (2026-09-13), 6 of 6 red: the answer frames back to literals · `quiz.fim` missing in es · en equal to
  // pt · the group name a literal again · one key for both answers · right and total swapped in the closing line.
});

describe('perguntaHtml — a marcação', () => {
  const p = { enunciado: 'Quantos?', alternativas: ['Um', 'Dois'], certa: 1 };

  it('[Right] cada alternativa é um rádio com estado, não um botão mudo', () => {
    const html = perguntaHtml(p, 1);
    expect(html).toMatch(/role="radiogroup"/);
    expect(html).toMatch(/data-alt="1"[^>]*aria-checked="true"/);
    expect(html).toMatch(/data-alt="0"[^>]*aria-checked="false"/);
  });

  it('[Zero] sem alternativas, ainda monta o enunciado sem quebrar', () => {
    expect(perguntaHtml({ enunciado: 'Vazio?', alternativas: [], certa: 0 }, 0)).toContain('Vazio?');
  });

  it('[Right] ⚠️ o CONTEÚDO DA PERGUNTA não vira marcação (issue #106)', () => {
    // Enunciado e alternativas são conteúdo de atividade — texto, nunca marcação. Hoje vêm de um catálogo em
    // código; o ADR-0052 torna-os AUTORADOS, e a issue #106 exige que isto esteja consertado ANTES disso:
    // «assim que um profissional puder digitar numa atividade, deixa de ser censo e vira incidente».
    const FUGA = '"><i id="fugiu"></i><b>x';
    const html = perguntaHtml({ enunciado: FUGA, alternativas: [FUGA], certa: 0 }, 0);
    expect(html, 'o conteúdo fechou um atributo e injetou um elemento').not.toContain('<i id=');
    expect(html).toContain('&lt;'); // escapado, e não apagado
  });

  it('[Zero] e texto normal atravessa INTACTO — um escape que estraga a pergunta não serve a ninguém', () => {
    const html = perguntaHtml({ enunciado: 'Quanto é 2 + 3?', alternativas: ['5', 'não sei'], certa: 0 }, 0);
    expect(html).toContain('Quanto é 2 + 3?');
    expect(html).toContain('não sei');
  });
});

describe('the voice of a question — the statement, then each option with its place after its name (ADR-0167)', () => {
  const galinha = { enunciado: 'Qual animal põe ovos e tem bico?', alternativas: ['Gato', 'Galinha', 'Cavalo', 'Peixe'], certa: 1 };
  const ABERTA = 'Qual animal põe ovos e tem bico? Gato, 1 de 4. Galinha, 2 de 4. Cavalo, 3 de 4. Peixe, 4 de 4';

  it('🔴 [Right] opening a question says the statement and then «Gato, 1 de 4. Galinha, 2 de 4. …»', () => {
    // A literal: a format computed in the test would move with the code. The place comes AFTER the name (ADR-0167).
    expect(narracaoDaPergunta(galinha)).toBe(ABERTA);
  });

  it('[Zero] a question with no options says only its statement — no dangling space', () => {
    expect(narracaoDaPergunta({ enunciado: 'Vazio?', alternativas: [], certa: 0 })).toBe('Vazio?');
  });

  it('🔴 [Right] the WHOLE question only when it opens; a move on the same question says only the option reached', () => {
    const abre = narracaoAoDesenhar(galinha, 0, 0, -1);
    expect(abre).toEqual({ texto: ABERTA, narrada: 0 });
    // before, every arrow press re-read the statement and never said where the cursor was
    expect(narracaoAoDesenhar(galinha, 0, 1, abre.narrada)).toEqual({ texto: 'Galinha, 2 de 4', narrada: 0 });
    // and the next question opens whole again
    expect(narracaoAoDesenhar(galinha, 1, 0, 0).narrada).toBe(1);
  });
});

describe('alternativaOuvida — what the child SAID, when she answers out loud (ADR-0216, issue #200)', () => {
  const ANIMAIS = ['Gato', 'Galinha', 'Cavalo', 'Peixe'];
  const NUMEROS = ['Três', 'Quatro', 'Cinco', 'Dois'];

  it('[Right] the option said by itself is the answer', () => {
    expect(alternativaOuvida('galinha', ANIMAIS)).toBe(1);
  });

  it('🔴 [Right] a model writes like a person — case, accent and full stop are not part of the answer', () => {
    // Whisper gives back «Três.» and «GALINHA», and a child who is right must not be marked wrong by a comma.
    expect(alternativaOuvida('Três.', NUMEROS)).toBe(0);
    expect(alternativaOuvida('GALINHA!', ANIMAIS)).toBe(1);
    // 🔴 AND THE ACCENT ITSELF, which is the case the other two do not reach: a model that writes «tres» is not a child who
    // answered wrong. Both sides pass through the same rule, so a case with the accent on BOTH sides proves nothing — it took a
    // surviving mutation to show that the accent was never once exercised.
    expect(alternativaOuvida('tres', NUMEROS)).toBe(0);
  });

  it('🔴 [Right] and she is allowed to answer in a sentence — «eu acho que é a galinha»', () => {
    expect(alternativaOuvida('eu acho que é a galinha', ANIMAIS)).toBe(1);
  });

  it('🔴 [Right] TWO options heard is not an answer: a child thinking out loud is not choosing', () => {
    // Answering for her would also MARK IT WRONG, which is the cost this case exists to refuse.
    expect(alternativaOuvida('gato ou galinha', ANIMAIS)).toBeNull();
  });

  it('[Zero] nothing heard, and something that is none of them, answer nothing', () => {
    expect(alternativaOuvida('', ANIMAIS)).toBeNull();
    expect(alternativaOuvida('   ...  ', ANIMAIS)).toBeNull();
    expect(alternativaOuvida('elefante', ANIMAIS)).toBeNull();
    expect(alternativaOuvida('gato', [])).toBeNull();
  });

  it('🔴 [Boundary] WHOLE words: «doisel» is not «Dois», and an empty option answers nothing', () => {
    expect(alternativaOuvida('doisel', NUMEROS)).toBeNull();
    // An option with no words would otherwise be found inside every sentence, and then NOTHING could ever be answered.
    expect(alternativaOuvida('gato', ['', 'Gato'])).toBe(1);
  });

  it('🔴 [Boundary] an option of two words is found in ORDER, and only in order', () => {
    expect(alternativaOuvida('é um cavalo marinho', ['Cavalo marinho', 'Gato'])).toBe(0);
    expect(alternativaOuvida('marinho cavalo', ['Cavalo marinho', 'Gato'])).toBeNull();
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
