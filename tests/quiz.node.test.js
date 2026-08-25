// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/quiz — a camada de GERAÇÃO e a de APRESENTAÇÃO (project node: nenhuma toca `document`).
// O foco é a PEDAGOGIA, não a mecânica: a resposta certa sempre está entre as alternativas, nunca há
// alternativa repetida, o NÍVEL escolhe o tipo de desafio, a tabuada só sorteia número que a pessoa ligou,
// a fração só usa notação ligada, e a palavra não se repete dentro da janela de 5 rounds.
// RNG semeado por `reseed` → cada caso é reprodutível (Right-BICEP: Repeatable).
// Padrões: ZOMBIES (Zero/One/Many/Boundary/Interface/Exercise/Simple) + Right-BICEP.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (B3).
import { describe, it, expect, beforeEach } from 'vitest';
import { reseed } from '../app/js/core/rng.js';
import { SILABAS_WORDS, SILABA_POOL } from '../app/js/game/activity-content.js';
import { BRAILLE } from '../app/js/game/braille.js';
import {
  mkChoices, generateMath, mathGeneratorFor,
  pickWord, resetRecentWords, recentWords,
  generateSilabasOptions, generatePreChoices, generateAlfOptions, generateBrailleCells,
  literacyKindFor, cKey, cDisp, quizWho, selRange, winsHtml, levelTag,
  somasubHtml, silabaHtml, preHtml, alfHtml, brailleHtml, quizHtml,
} from '../app/js/game/quiz.js';

// --- ferramentas de teste -----------------------------------------------------------------------
const MENU = { tabSel: [], fracNot: { v: 1, d: 1, dec: 1, pct: 1, mix: 1 } }; // menu "tudo ligado, nada escolhido"
const menu = (over = {}) => ({ ...MENU, ...over });
/** Roda `fn` para as sementes 1..n (Right-BICEP "Repeatable": cada iteração é reprodutível sozinha). */
const forSeeds = (n, fn) => { for (let s = 1; s <= n; s++) { reseed(s * 7919); fn(s); } };
const keys = (g) => g.choices.map(cKey);
/** "3 + 4 = ?" → [3, 4] (lê os números do enunciado, que é o que a criança vê). */
const nums = (prob) => (prob.match(/-?\d+/g) || []).map(Number);

const MAT_IDS = ['mat1', 'mat2', 'mat3', 'mat4', 'mat5', 'mat6'];
const FRAC_IDS = ['fr2', 'fr3', 'fr42', 'fr5', 'fr632', 'fr2a6'];
const TODAS = [...MAT_IDS, ...FRAC_IDS, 'ludico', 'atividade-que-nao-existe'];

// =================================================================================================
describe('game/quiz — alternativas (mkChoices)', () => {
  it('põe a resposta certa entre as alternativas', () => {
    forSeeds(50, () => { expect(mkChoices(7, 0, 20)).toContain('7'); });
  });

  it('não repete alternativa', () => {
    forSeeds(50, () => { const c = mkChoices(3, 0, 20); expect(new Set(c).size).toBe(c.length); });
  });

  it('devolve 9 alternativas quando o intervalo comporta', () => {
    forSeeds(20, () => { expect(mkChoices(5, 0, 20)).toHaveLength(9); });
  });

  // ZOMBIES/Boundary: intervalo estreito não pode travar no while — a guarda de 400 desiste e devolve menos.
  it('não trava quando o intervalo tem menos de 9 números (devolve o que couber)', () => {
    reseed(1);
    const c = mkChoices(2, 0, 3);
    expect(c).toHaveLength(4);
    expect(new Set(c)).toEqual(new Set(['0', '1', '2', '3']));
  });

  // ZOMBIES/Zero: intervalo de um único número.
  it('com intervalo de UM número devolve só a resposta', () => {
    reseed(1); expect(mkChoices(5, 5, 5)).toEqual(['5']);
  });
});

// =================================================================================================
describe('game/quiz — geração de matemática (o que vale é a pedagogia)', () => {
  // Right-BICEP / Cross-check: a invariante que nenhum desafio pode violar, em NENHUMA atividade.
  it('a resposta certa está SEMPRE entre as alternativas, em toda atividade', () => {
    for (const id of TODAS) {
      forSeeds(40, (s) => {
        const g = generateMath(id, menu({ tabSel: [3, 7] }));
        expect(keys(g), `${id} semente ${s}`).toContain(g.answer);
      });
    }
  });

  it('não existe alternativa repetida, em toda atividade', () => {
    for (const id of TODAS) {
      forSeeds(40, (s) => {
        const k = keys(generateMath(id, menu({ tabSel: [3, 7] })));
        expect(new Set(k).size, `${id} semente ${s}`).toBe(k.length);
      });
    }
  });

  it('a mesma semente dá sempre a mesma pergunta (reprodutível)', () => {
    for (const id of TODAS) {
      reseed(31337); const a = generateMath(id, menu({ tabSel: [4] }));
      reseed(31337); const b = generateMath(id, menu({ tabSel: [4] }));
      expect(a).toEqual(b);
    }
  });

  it('sementes diferentes dão perguntas diferentes (o gerador não está preso)', () => {
    const vistos = new Set();
    forSeeds(30, () => { vistos.add(generateMath('mat3', menu()).prob); });
    expect(vistos.size).toBeGreaterThan(5);
  });

  // Quantidade (mat1): a grade é FIXA 1..9 — a criança conta e acha o número, sem distratores sorteados.
  it('Quantidade: bolinhas de 1 a 9, grade fixa e resposta = nº de bolinhas', () => {
    forSeeds(40, () => {
      const g = generateMath('mat1', menu());
      expect(g.dots).toBeGreaterThanOrEqual(1);
      expect(g.dots).toBeLessThanOrEqual(9);
      expect(g.answer).toBe(String(g.dots));
      expect(g.choices).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
      expect(g.fala).toBe('Quantas bolinhas você vê?');
    });
  });

  it('Soma fácil: parcelas de 0 a 5 e resposta = soma', () => {
    forSeeds(60, () => {
      const g = generateMath('mat2', menu());
      const [a, b] = nums(g.prob);
      expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(5);
      expect(b).toBeGreaterThanOrEqual(0); expect(b).toBeLessThanOrEqual(5);
      expect(g.answer).toBe(String(a + b));
    });
  });

  // "Dá para fazer nos dedos": soma ≤10 e minuendo ≤10 — a regra pedagógica de mat3 e do PADRÃO.
  it('Soma e Subtração 1 (padrão): resultado até 10 e nunca negativo', () => {
    for (const id of ['mat3', 'ludico', 'atividade-que-nao-existe']) {
      forSeeds(60, (s) => {
        const g = generateMath(id, menu());
        const r = Number(g.answer);
        expect(r, `${id} semente ${s}`).toBeGreaterThanOrEqual(0);
        expect(r, `${id} semente ${s}`).toBeLessThanOrEqual(10);
        expect(nums(g.prob).every((n) => n <= 10)).toBe(true);
      });
    }
  });

  // Fixa a IDENTIDADE do padrão: é soma E subtração até 10 — não a "Soma fácil" (que só soma, até 5).
  it('Soma e Subtração 1 (padrão): treina as DUAS operações, com números acima de 5', () => {
    const ops = new Set(); let passouDe5 = false;
    forSeeds(60, () => {
      const g = generateMath('mat3', menu());
      ops.add(g.prob.includes('−') ? '−' : '+');
      if (nums(g.prob).some((n) => n > 5)) passouDe5 = true;
    });
    expect([...ops].sort()).toEqual(['+', '−']);
    expect(passouDe5).toBe(true);
  });

  it('Soma e Subtração 2: resultado até 20 e nunca negativo', () => {
    forSeeds(60, () => {
      const g = generateMath('mat4', menu());
      const r = Number(g.answer);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(20);
    });
  });

  // O pedido do menu da tabuada: "treinar O número que eu escolhi".
  it('Tabuada: um dos fatores é SEMPRE um número que a pessoa ligou', () => {
    for (const tabSel of [[7], [2, 5], [0], [0, 10]]) {
      forSeeds(40, (s) => {
        const g = generateMath('mat5', menu({ tabSel }));
        const [a, b] = nums(g.prob);
        expect(tabSel.includes(a) || tabSel.includes(b), `tabSel=${tabSel} semente ${s} → ${g.prob}`).toBe(true);
        expect(g.answer).toBe(String(a * b));
      });
    }
  });

  it('Tabuada: fatores de 0 a 10 (é tabuada, não multiplicação livre)', () => {
    forSeeds(40, () => {
      const [a, b] = nums(generateMath('mat5', menu({ tabSel: [6] })).prob);
      for (const n of [a, b]) { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(10); }
    });
  });

  // ZOMBIES/Zero: sem nenhum número ligado o gerador cai no 2 (e não em NaN/undefined).
  it('Tabuada sem nenhum número ligado cai no 2', () => {
    forSeeds(30, () => {
      const [a, b] = nums(generateMath('mat5', menu({ tabSel: [] })).prob);
      expect(a === 2 || b === 2).toBe(true);
    });
  });

  it('Divisão: divisor nunca é zero e a conta fecha exata', () => {
    for (const tabSel of [[], [7], [0], [1, 9]]) {
      forSeeds(40, (s) => {
        const g = generateMath('mat6', menu({ tabSel }));
        const [dividendo, divisor] = nums(g.prob);
        expect(divisor, `tabSel=${tabSel} semente ${s} → ${g.prob}`).toBeGreaterThanOrEqual(1);
        expect(Number(g.answer)).toBe(dividendo / divisor);
        expect(Number.isInteger(dividendo / divisor)).toBe(true);
      });
    }
  });

  it('Divisão: o número ligado aparece como divisor ou como quociente', () => {
    for (const tabSel of [[7], [3, 8]]) {
      forSeeds(40, (s) => {
        const g = generateMath('mat6', menu({ tabSel }));
        const [, divisor] = nums(g.prob);
        const quociente = Number(g.answer);
        expect(tabSel.includes(divisor) || tabSel.includes(quociente), `tabSel=${tabSel} semente ${s} → ${g.prob}`).toBe(true);
      });
    }
  });

  it('Divisão com o 0 ligado: o 0 só entra como QUOCIENTE (nunca ÷0)', () => {
    forSeeds(40, () => {
      const g = generateMath('mat6', menu({ tabSel: [0] }));
      const [dividendo, divisor] = nums(g.prob);
      expect(divisor).toBeGreaterThanOrEqual(1);
      expect(dividendo).toBe(0);
      expect(g.answer).toBe('0');
    });
  });
});

// =================================================================================================
describe('game/quiz — geração de frações', () => {
  it('só usa notação LIGADA no menu', () => {
    // 'dec' sozinha → toda alternativa exibida é decimal com vírgula ("1,5"), nunca "3/2" nem SVG.
    forSeeds(40, (s) => {
      const g = generateMath('fr42', menu({ fracNot: { v: 0, d: 0, dec: 1, pct: 0, mix: 0 } }));
      expect(g.not, `semente ${s}`).toBe('dec');
      for (const c of g.choices) {
        const d = cDisp(c);
        if (!/frac-fig/.test(d)) expect(d, `semente ${s}`).toMatch(/^\d+,\d$/);
      }
    });
  });

  it('com NENHUMA notação ligada cai na vertical (nunca undefined)', () => {
    forSeeds(20, () => {
      expect(generateMath('fr3', menu({ fracNot: { v: 0, d: 0, dec: 0, pct: 0, mix: 0 } })).not).toBe('v');
    });
  });

  it('nunca produz resultado negativo (a subtração troca os operandos)', () => {
    for (const id of FRAC_IDS) {
      forSeeds(40, (s) => {
        const g = generateMath(id, menu());
        expect(g.answer, `${id} semente ${s}`).not.toMatch(/^-/);
      });
    }
  });

  it('compara pela CHAVE canônica reduzida, não pela exibição', () => {
    forSeeds(30, () => {
      const g = generateMath('fr42', menu());
      // a chave nunca traz markup; a exibição pode ser gráfico OU número
      for (const c of g.choices) expect(cKey(c)).not.toMatch(/[<>]/);
      expect(keys(g)).toContain(g.answer);
    });
  });

  it('usa só os denominadores da atividade escolhida', () => {
    forSeeds(30, () => {
      const g = generateMath('fr2', menu({ fracNot: { v: 0, d: 1, dec: 0, pct: 0, mix: 0 } }));
      // fr2 = meios: toda fração cabe em /2 (ou é inteira depois de reduzir)
      for (const k of keys(g)) expect(k).toMatch(/^\d+(\/2)?$/);
    });
  });

  it('a fábrica devolve o gerador de fração para toda atividade com denominadores', () => {
    for (const id of FRAC_IDS) {
      reseed(5); const a = mathGeneratorFor(id)(menu());
      reseed(5); const b = generateMath(id, menu());
      expect(a).toEqual(b);
      expect(a.not).toBeDefined(); // só o ramo de frações carrega notação
    }
  });

  it('atividade desconhecida cai no gerador padrão, não estoura', () => {
    reseed(5); const a = generateMath('nao-existe', menu());
    reseed(5); const b = generateMath('mat3', menu());
    expect(a).toEqual(b);
  });
});

// =================================================================================================
describe('game/quiz — o NÍVEL escolhe o desafio (psicogênese)', () => {
  it('nível 1 = pré-silábico, 2 e 3 = sílabas, 4 e 5 = escrita por letra', () => {
    expect(literacyKindFor(1, false)).toBe('pre');
    expect(literacyKindFor(2, false)).toBe('silabas');
    expect(literacyKindFor(3, false)).toBe('silabas');
    expect(literacyKindFor(4, false)).toBe('alf');
    expect(literacyKindFor(5, false)).toBe('alf');
  });

  it('modo cego vira ditado de Braille em QUALQUER nível (a11y vence o nível)', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(literacyKindFor(n, true)).toBe('braille');
  });
});

// =================================================================================================
describe('game/quiz — sorteio da palavra (janela de não-repetição)', () => {
  beforeEach(() => { resetRecentWords(); reseed(20260601); });

  it('sempre devolve uma palavra do catálogo', () => {
    forSeeds(30, () => { expect(SILABAS_WORDS).toContainEqual(pickWord('g')); });
  });

  it('prefere a letra da moeda quando ainda há palavra com ela', () => {
    resetRecentWords(); reseed(11);
    expect(pickWord('g').w[0]).toBe('g'); // 'gato' e 'gelo' estão livres
  });

  it('NÃO repete palavra dentro dos últimos 5 rounds', () => {
    const saidas = [];
    for (let i = 0; i < 30; i++) saidas.push(pickWord('b').w); // 'b' só tem 3 palavras → força sair da letra
    for (let i = 5; i < saidas.length; i++) {
      expect(saidas.slice(i - 5, i), `round ${i}`).not.toContain(saidas[i]);
    }
  });

  it('a não-repetição vence a letra da moeda (é a regra mais forte)', () => {
    const saidas = [];
    for (let i = 0; i < 8; i++) saidas.push(pickWord('b').w);
    expect(saidas.some((w) => w[0] !== 'b')).toBe(true); // teve de sair da letra 'b'
  });

  it('a janela guarda no máximo 5 palavras', () => {
    for (let i = 0; i < 12; i++) pickWord('g');
    expect(recentWords()).toHaveLength(5);
  });
});

// =================================================================================================
describe('game/quiz — geração do letramento', () => {
  beforeEach(() => { resetRecentWords(); reseed(20260601); });

  it('Sílabas: as duas sílabas certas estão entre as opções', () => {
    forSeeds(40, (s) => {
      const item = pickWord('g');
      const { correct, options } = generateSilabasOptions(item);
      expect(correct).toEqual(item.s);
      for (const sy of correct) expect(options, `semente ${s}`).toContain(sy);
    });
  });

  it('Sílabas: 9 opções, sem repetidas, e as distratoras vêm do pool', () => {
    forSeeds(40, () => {
      const item = pickWord('g');
      const { correct, options } = generateSilabasOptions(item);
      expect(options).toHaveLength(9);
      expect(new Set(options).size).toBe(9);
      for (const sy of options) {
        if (!correct.includes(sy)) expect(SILABA_POOL).toContain(sy);
      }
    });
  });

  it('Descobrindo palavras (nível 1): 4 escritas, uma só certa, sem repetidas', () => {
    forSeeds(40, (s) => {
      const item = pickWord('g');
      const opts = generatePreChoices(item);
      expect(opts, `semente ${s}`).toHaveLength(4);
      expect(new Set(opts).size).toBe(4);
      expect(opts).toContain(item.w);
      expect(opts.filter((o) => o === item.w)).toHaveLength(1); // a certa aparece UMA vez
    });
  });

  it('Escrevendo palavras (4/5): grade de 12 letras com TODAS as letras da palavra', () => {
    forSeeds(40, (s) => {
      const item = pickWord('g');
      const opts = generateAlfOptions(item.w);
      expect(opts, `semente ${s}`).toHaveLength(12);
      expect(new Set(opts).size).toBe(12);
      for (const ch of new Set(item.w.split(''))) expect(opts, `${item.w} semente ${s}`).toContain(ch);
    });
  });

  it('Braille: uma cela por letra, com os pontos da tabela', () => {
    const cells = generateBrailleCells('bola');
    expect(cells.map((c) => c.l)).toEqual(['b', 'o', 'l', 'a']);
    expect(cells[3].dots).toEqual(BRAILLE.a);
    for (const c of cells) expect(c.text.length).toBeGreaterThan(0);
  });

  // ZOMBIES/Zero: palavra vazia não deve estourar.
  it('Braille de palavra vazia é uma lista vazia', () => {
    expect(generateBrailleCells('')).toEqual([]);
  });
});

// =================================================================================================
describe('game/quiz — apresentação (markup puro)', () => {
  const DISP = (s) => String(s).toUpperCase(); // o `disp` do game.js em modo ABC (maiúsculas)
  const QL = { 1: 'Descobrindo palavras', 2: 'Descobrindo sílabas', 3: 'Montando palavras', 4: 'Escrevendo palavras', 5: 'Escrevendo em Braille' };

  const mathQ = (over = {}) => ({ kind: 'somasub', coinIndex: 0, shape: 'circulo', sel: 0, tries: 0, revealed: false, prob: '2 + 3 = ?', answer: '5', choices: ['4', '5', '6'], ...over });
  const silQ = (over = {}) => ({ kind: 'silabas', coinIndex: 0, hearSyl: true, letter: 'g', word: 'gato', emoji: '🐱', correct: ['ga', 'to'], options: ['ga', 'to', 'be'], boxes: [null, null], sel: 0, tries: 0, revealed: false, ...over });
  const preQ = (over = {}) => ({ kind: 'pre', coinIndex: 0, word: 'gato', emoji: '🐱', choices: ['gato', 'ggg', '★gato'], sel: 0, tries: 0, revealed: false, ...over });
  const alfQ = (over = {}) => ({ kind: 'alf', coinIndex: 0, braille: false, word: 'gato', emoji: '🐱', options: ['g', 'a', 't', 'o'], boxes: [null, null, null, null], sel: 0, tries: 0, revealed: false, ...over });
  const brQ = () => ({ kind: 'braille', coinIndex: 0, letter: 'b', word: 'bo', emoji: '⚽', revealed: false, cells: generateBrailleCells('bo') });

  it('cada tipo de desafio gera o SEU markup', () => {
    expect(quizHtml(mathQ(), DISP, QL)).toBe(somasubHtml(mathQ()));
    expect(quizHtml(silQ(), DISP, QL)).toBe(silabaHtml(silQ(), DISP));
    expect(quizHtml(preQ(), DISP, QL)).toBe(preHtml(preQ(), DISP, QL));
    expect(quizHtml(alfQ(), DISP, QL)).toBe(alfHtml(alfQ(), DISP, QL));
    expect(quizHtml(brQ(), DISP, QL)).toBe(brailleHtml(brQ(), DISP));
  });

  it('a matemática só mostra bolinhas quando a atividade é Quantidade', () => {
    expect(somasubHtml(mathQ())).not.toContain('quiz-dots');
    const comDots = somasubHtml(mathQ({ dots: 3 }));
    expect(comDots).toContain('aria-label="3 bolinhas"');
    expect(comDots).toContain('●●●');
  });

  it('a resposta certa só ganha destaque DEPOIS de revelada', () => {
    expect(somasubHtml(mathQ())).not.toContain('reveal');
    expect(somasubHtml(mathQ({ revealed: true }))).toContain('quiz-choice reveal');
  });

  it('a dica muda com a tentativa e com a revelação', () => {
    expect(somasubHtml(mathQ())).toContain('Escolha e pule (L) para confirmar.');
    expect(somasubHtml(mathQ({ tries: 1 }))).toContain('Quase! Tente de novo.');
    expect(somasubHtml(mathQ({ revealed: true }))).toContain('Resposta certa em destaque.');
  });

  it('o cursor marca UMA alternativa por vez', () => {
    const html = somasubHtml(mathQ({ sel: 2 }));
    expect(html.match(/quiz-choice sel/g)).toHaveLength(1);
    expect(html).toContain('data-i="2" type="button">6<');
  });

  it('o cursor -1 seleciona a palavra do topo (para repetir a fala)', () => {
    expect(silabaHtml(silQ({ sel: -1 }), DISP)).toContain('quiz-word sel');
    expect(silabaHtml(silQ({ sel: 0 }), DISP)).toContain('class="quiz-word"');
  });

  it('a caixa preenchida aparece com a letra/sílaba escrita', () => {
    const html = silabaHtml(silQ({ boxes: ['ga', null] }), DISP);
    expect(html).toContain('silaba-box filled">GA<');
    expect(html).toContain('<span class="silaba-box"></span>');
  });

  it('o `disp` injetado manda no maiúsculo/minúsculo do que é ESCRITO', () => {
    const up = alfHtml(alfQ({ boxes: ['g', 'a', 't', 'o'] }), (s) => String(s).toUpperCase(), QL);
    const low = alfHtml(alfQ({ boxes: ['g', 'a', 't', 'o'] }), (s) => String(s).toLowerCase(), QL);
    expect(up).toContain('>G<'); expect(low).toContain('>g<');
  });

  it('o rótulo do nível vem do QL_NAME (níveis 1, 4 e 5)', () => {
    expect(preHtml(preQ(), DISP, QL)).toContain('nível 1 · Descobrindo palavras');
    expect(alfHtml(alfQ(), DISP, QL)).toContain('nível 4 · Escrevendo palavras');
    expect(alfHtml(alfQ({ braille: true }), DISP, QL)).toContain('nível 5 · Escrevendo em Braille');
    expect(levelTag(3, QL)).toBe('nível 3 · Montando palavras');
  });

  it('o nível 5 pede para OUVIR a cela, o 4 não', () => {
    expect(alfHtml(alfQ({ braille: true }), DISP, QL)).toContain('Ouça a cela Braille de cada letra.');
    expect(alfHtml(alfQ(), DISP, QL)).toContain('Monte a palavra letra a letra.');
  });

  it('o Braille desenha 6 pontos por cela e acende só os da letra', () => {
    const html = brailleHtml(brQ(), DISP);
    expect(html.match(/class="bdot/g)).toHaveLength(12); // 2 letras × 6 pontos
    expect(html.match(/bdot on/g)).toHaveLength(BRAILLE.b.length + BRAILLE.o.length);
  });

  it('todo desafio é um diálogo modal rotulado (a11y)', () => {
    for (const q of [mathQ(), silQ(), preQ(), alfQ(), brQ()]) {
      const html = quizHtml(q, DISP, QL);
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toMatch(/aria-label="[^"]+"/);
    }
  });

  it('as 3 luzes contam as vitórias rumo à moeda', () => {
    expect(winsHtml(0).match(/qw-dot on/g)).toBeNull();
    expect(winsHtml(2).match(/qw-dot on/g)).toHaveLength(2);
    expect(winsHtml(3).match(/qw-dot on/g)).toHaveLength(3);
    expect(winsHtml(2)).toContain('aria-label="2 de 3 acertos para a moeda"');
  });
});

// =================================================================================================
describe('game/quiz — navegação e leitura das alternativas', () => {
  it('a chave compara e a exibição mostra (fração exibida como gráfico)', () => {
    expect(cKey('7')).toBe('7');
    expect(cDisp('7')).toBe('7');
    expect(cKey({ key: '1/2', disp: '<svg/>' })).toBe('1/2');
    expect(cDisp({ key: '1/2', disp: '<svg/>' })).toBe('<svg/>');
  });

  it('a matemática navega de 0 até a última alternativa (sem palavra no topo)', () => {
    expect(selRange({ kind: 'somasub', choices: ['a', 'b', 'c'] })).toEqual({ min: 0, max: 2 });
  });

  it('sílabas e escrita têm Apagar e OK depois das opções', () => {
    expect(selRange({ kind: 'silabas', options: ['a', 'b'] })).toEqual({ min: -1, max: 3 });
    expect(selRange({ kind: 'alf', options: ['a', 'b'] })).toEqual({ min: 0, max: 3 });
  });

  it('só os jogos com imagem no topo deixam o cursor chegar a -1', () => {
    expect(selRange({ kind: 'pre', choices: ['a'] }).min).toBe(-1);
    expect(selRange({ kind: 'silabas', options: ['a'] }).min).toBe(-1);
    expect(selRange({ kind: 'alf', options: ['a'] }).min).toBe(0);
    expect(selRange({ kind: 'somasub', choices: ['a'] }).min).toBe(0);
  });

  it('no solo a fala do quiz não tem prefixo de jogador', () => {
    expect(quizWho({ i: 0 })).toBe(''); // numPlayers é 1 no core/state recém-carregado
  });
});
