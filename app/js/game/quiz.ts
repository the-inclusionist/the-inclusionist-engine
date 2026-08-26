// SPDX-License-Identifier: AGPL-3.0-or-later
// game/quiz.ts — O DESAFIO EDUCATIVO (Estágio 4, bloco B3): as 29 funções do quiz do game.js, verbatim.
//
// Três camadas, deliberadamente separadas (a Fase 6 reusa a primeira):
//   1. GERAÇÃO (pura, só RNG): que pergunta, que alternativas, qual a resposta certa. `generateMath` despacha
//      por uma TABELA de geradores (`MATH_GENERATORS`) em vez da cadeia if/else do monólito — mesma ordem de
//      chamada do RNG, portanto MESMA sequência de perguntas para a mesma semente. Do lado do letramento:
//      `pickWord` (janela de não-repetição de 5) + `generateSilabasOptions`/`generatePreChoices`/
//      `generateAlfOptions`/`generateBrailleCells`.
//   2. APRESENTAÇÃO (pura, string→string): os 6 construtores de markup (`somasubHtml`…`brailleHtml`), que
//      recebem `disp`/`QL_NAME` como PARÂMETRO — nenhum toca `document`.
//   3. EFEITO (`initQuiz(ctx)`): abrir/fechar, navegar, confirmar, som, narração, luzes de vitória e coleta
//      da moeda. Tudo o que é impuro entra por INJEÇÃO — o módulo nunca importa PIXI, nem `ui/dom`, nem lê
//      as `let` que ainda moram no main.js (`letterCase` via `disp`, `collected`; `modoCego` vem de core/state).
//
// CONTEÚDO PEDAGÓGICO: as strings pt-BR do currículo de alfabetização (sílaba, grafema↔fonema, psicogênese de
// Ferreiro) são específicas da língua e NÃO se traduzem — ficam em pt-BR de propósito (ver CLAUDE.md §i18n).
// Nenhuma regra pedagógica foi alterada: 2 tentativas antes de revelar, 3 vitórias = 1 moeda, o que o Braille
// anuncia, e o nível (1..5) que escolhe o tipo de desafio.
//
// Sem I/O no import: `document`/`setTimeout` só aparecem DENTRO das funções.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (B3).
import { COIN_TARGET } from '../core/constants.js';
import { t } from '../core/i18n.js';
import type { PlayerView } from '../core/entity.js';
import type { PlayerQuiz } from './entity.js'; // ADR-0039: o jogador carrega o SUPERTIPO, não a união
import { rnd, randInt, shuffle } from '../core/rng.js';
import { numPlayers, activity as ACTIVITY } from '../core/state.js';
import { coins, quizLevel } from './state.js'; // item 19: `coins`/`quizLevel` sao estado do JOGO
import { getActivity } from '../educational/activities-registry.js';
import { SILABAS_WORDS, SILABA_POOL, type SyllableWord } from './activity-content.js';
import { gcd, fmtFrac, fracGraphic, fracSpeak, speakChoice } from './fractions.js';
import { BRAILLE, brailleText } from './braille.js';
import { LETTER_NAME, soletra, ferreiroDistractors } from './literacy-distractors.js';
import { takeCoin } from './coins.js';
import { getCoinSprites } from './coin-spawning.js';
import { VIZ_BY_KEY } from '../render/viz-modes.js'; // dado puro, zero deps (só p/ detectar o modo 'blind' do jogador)

// =================================================================================================
// Tipos
// =================================================================================================

/** Alternativa: STRING (matemática simples) ou {key,disp} (frações — `key` compara, `disp` exibe). */
export type Choice = string | { key: string; disp: string };

/** Campos comuns a todo desafio navegável (o Braille é passivo e não tem `sel`/`tries`). */
interface QuizCommon { coinIndex: number; revealed: boolean; celebrating?: boolean; won?: boolean }

/** Matemática (soma/subtração, quantidade, tabuada, divisão, frações): grade de 9 alternativas. */
export interface MathQuiz extends QuizCommon {
  kind: 'somasub'; shape: string; sel: number; tries: number;
  prob: string; answer: string; choices: Choice[]; dots?: number; not?: string;
}
/** Níveis 2/3 — montar a palavra com 2 sílabas. `hearSyl` (nível 2) fala a sílaba inteira; o 3 soletra. */
export interface SilabasQuiz extends QuizCommon {
  kind: 'silabas'; hearSyl: boolean; letter: string; word: string; emoji: string;
  correct: string[]; options: string[]; boxes: (string | null)[]; sel: number; tries: number;
}
/** Nível 1 — pré-silábico: qual das 4 escritas é a certa (3 distratores de Ferreiro). */
export interface PreQuiz extends QuizCommon {
  kind: 'pre'; word: string; emoji: string; choices: string[]; sel: number; tries: number;
}
/** Níveis 4/5 — escritor: montar a palavra letra a letra numa grade de 12. `braille` = nível 5. */
export interface AlfQuiz extends QuizCommon {
  kind: 'alf'; braille: boolean; word: string; emoji: string;
  options: string[]; boxes: (string | null)[]; sel: number; tries: number;
}
/** Uma cela Braille: a letra, os pontos acesos e a fala dos pontos. */
export interface BrailleCell { l: string; dots: number[]; text: string }
/** Modo pessoa cega — ditado passivo: o jogo dita a cela de cada letra; pular coleta. */
export interface BrailleQuiz extends QuizCommon {
  kind: 'braille'; letter: string; word: string; emoji: string; cells: BrailleCell[];
}

export type Quiz = MathQuiz | SilabasQuiz | PreQuiz | AlfQuiz | BrailleQuiz;

/**
 * Só o que o quiz lê/escreve no jogador. Os campos comuns são DERIVADOS de core/entity; `quiz` não é.
 *
 * Este é o único módulo autorizado a saber o que há dentro de um quiz — a união `Quiz` é dele. core/entity
 * declara o campo como `PlayerQuiz`, o mínimo estrutural que as outras camadas precisam (`kind`/`coinIndex`/
 * `revealed`), porque `core/` não pode importar de `game/` sem inverter a dependência. Aqui o campo é
 * reintroduzido com a união inteira, que é o que permite estreitar por `kind === 'somasub'`. Não é uma exceção
 * à regra, é a regra: quem é DONO do tipo pode saber mais que os outros; quem não é, não pode.
 */
export type QuizPlayer = PlayerView<'i' | 'x' | 'y' | 'vx' | 'vy' | 'collected' | 'viz' | 'alfWins'>
  & { quiz: PlayerQuiz | null };

/** Os cinco discriminantes, como DADO — a mesma lista que `tests/quiz-supertype.node.test.ts` afirma. */
const QUIZ_KINDS: ReadonlySet<string> = new Set(['somasub', 'silabas', 'pre', 'alf', 'braille']);

/**
 * O ÚNICO ponto que volta do supertipo para a união — e ele CONFERE, em tempo de execução.
 *
 * ADR-0039: o jogador carrega `PlayerQuiz`, o supertipo, porque nenhuma camada fora daqui tem o direito de
 * saber o que há dentro de um quiz. Este módulo é o dono e pode saber — mas o caminho de volta passa por um
 * lugar só, com o discriminante conferido, em vez dos SETE `as` espalhados que existiam antes. Um `as` diz
 * "eu sabia mais que o compilador"; isto pergunta.
 */
function quizDe(pl: QuizPlayer): Quiz | null {
  const q = pl.quiz;
  return q && QUIZ_KINDS.has(q.kind) ? (q as Quiz) : null;
}

/**
 * O caminho de IDA, par do `quizDe`. Existe por um motivo do compilador que vale escrever: atribuir um
 * literal direto a um campo do SUPERTIPO dispara a checagem de propriedade excedente — `hearSyl` "não
 * existe em PlayerQuiz" —, e o literal deixaria de ser conferido contra a variante que ele diz ser. Passando
 * por aqui, o literal é checado contra a UNIÃO (com discriminante, portanto contra a variante certa) e o
 * campo continua carregando só o supertipo.
 */
function abrirQuiz(pl: QuizPlayer, q: Quiz): void { pl.quiz = q; }

/** Selector DOM mínimo (mesma forma do `$` de ui/dom.ts) — injetado, nunca importado. */
export type DomQuery = <T extends Element = Element>(sel: string) => T | null;

// =================================================================================================
// 1. GERAÇÃO — matemática (PURA: só depende do RNG semeado e dos dados injetados)
// =================================================================================================

/** O que um gerador de matemática produz: a pergunta, a resposta canônica, as alternativas e a FALA. */
export interface MathChallenge {
  prob: string; answer: string; choices: Choice[];
  dots?: number; not?: string;
  fala: string;
}
/** Dados do MENU que a geração precisa: números da tabuada ligados + notações de fração ligadas. */
export interface MathDeps { tabSel: readonly number[]; fracNot: Record<string, number> }
/** Um gerador por atividade. */
export type MathGenerator = (deps: MathDeps) => MathChallenge;

/**
 * 9 alternativas DISTINTAS contendo a resposta, sorteadas em [lo,hi] e embaralhadas.
 * Verbatim de `_mkChoices` (guarda de 400 tentativas: se o intervalo for menor que 9, devolve menos que 9).
 */
export function mkChoices(answer: number | string, lo: number, hi: number): string[] {
  const set = [String(answer)]; let g = 0;
  while (set.length < 9 && g++ < 400) { const s = String(randInt(lo, hi)); if (!set.includes(s)) set.push(s); }
  return shuffle(set);
}

/**
 * O enunciado falado de uma conta: "Quanto é {a} {operador} {b}?".
 *
 * A MATEMÁTICA NÃO É DISCIPLINA DE IDIOMA — `2 + 3` independe de língua, então a frase inteira traduz, os
 * operadores por extenso inclusive. Isso a separa da alfabetização, onde a palavra a montar É a matéria e
 * atravessa sem tradução. (Decisão do Dev, 2026-08-24; ver o CLAUDE.md.)
 *
 * Existe como função porque a mesma frase era montada em CINCO geradores, cada um com o seu ternário de
 * 'mais'/'menos' — e dois deles com o ternário escrito de forma idêntica, o que é a divergência esperando
 * acontecer que este projeto já viu quatro vezes.
 */
const OP_KEY: Readonly<Record<string, string>> = { '+': 'math.op.plus', '−': 'math.op.minus', '-': 'math.op.minus', '×': 'math.op.times', '÷': 'math.op.dividedBy' };
function fala(a: number | string, op: string, b: number | string): string {
  return t('sr.math.howMuchIs', { a, op: t(OP_KEY[op] ?? op), b });
}

/** mat1 — QUANTIDADE: bolinhas → número (grade FIXA 1..9, sem sorteio de alternativas). */
const genQuantidade: MathGenerator = () => {
  const n = randInt(1, 9);
  return { dots: n, answer: String(n), prob: t('math.howManyDots'), choices: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], fala: t('sr.math.howManyDots') };
};

/** mat2 — SOMA FÁCIL: parcelas 0..5. */
const genSomaFacil: MathGenerator = () => {
  const a = randInt(0, 5), b = randInt(0, 5);
  return { prob: `${a} + ${b} = ?`, answer: String(a + b), choices: mkChoices(a + b, 0, 10), fala: fala(a, '+', b) };
};

/** mat4 — SOMA E SUBTRAÇÃO 2: guarda um na cabeça e opera o outro nos dedos (até 20; nunca negativo). */
const genSomaSub2: MathGenerator = () => {
  const op = rnd() < 0.5 ? '+' : '−'; let a: number, b: number, ans: number;
  if (op === '+') { a = randInt(0, 10); b = randInt(0, 10); ans = a + b; } else { a = randInt(0, 20); b = randInt(0, Math.min(10, a)); ans = a - b; }
  return { prob: `${a} ${op} ${b} = ?`, answer: String(ans), choices: mkChoices(ans, 0, 20), fala: fala(a, op, b) };
};

/** Número LIGADO no menu da tabuada/divisão (entra em qualquer posição). Sem seleção → 2. */
function pickTabNumber(tabSel: readonly number[]): number { return tabSel.length ? tabSel[randInt(0, tabSel.length - 1)] : 2; }

/** mat5 — TABUADA: multiplicando E multiplicador de 0..10; o nº ligado pode ser qualquer um dos dois. */
const genTabuada: MathGenerator = ({ tabSel }) => {
  const on = pickTabNumber(tabSel);
  const other = randInt(0, 10); let a: number, b: number; if (rnd() < 0.5) { a = on; b = other; } else { a = other; b = on; }
  return { prob: `${a} × ${b} = ?`, answer: String(a * b), choices: mkChoices(a * b, 0, 100), fala: fala(a, '×', b) };
};

/** mat6 — DIVISÃO inteira: divisor E quociente de 0..10 (divisor ≥1, sem ÷0); o nº ligado entra em qualquer posição. */
const genDivisao: MathGenerator = ({ tabSel }) => {
  const on = pickTabNumber(tabSel);
  const other = randInt(0, 10); let divisor: number, quo: number;
  if (on === 0) { quo = 0; divisor = randInt(1, 10); }                         // 0 só pode ser QUOCIENTE (0 ÷ divisor = 0)
  else if (rnd() < 0.5) { quo = on; divisor = Math.max(1, other); }            // ligado = quociente
  else { divisor = on; quo = other; }                                          // ligado = divisor
  const dividend = divisor * quo;
  return { prob: `${dividend} ÷ ${divisor} = ?`, answer: String(quo), choices: mkChoices(quo, 0, 10), fala: fala(dividend, '÷', divisor) };
};

/**
 * fr* — FRAÇÕES (soma/subtração; a NOTAÇÃO é sorteada entre as LIGADAS no menu).
 * "Gráficos SUBSTITUEM números" (José): cada operando/alternativa exibe GRÁFICO ou número, por sorteio — e o
 * sorteio só acontece quando existe gráfico para aquela fração (`g && rnd()<0.5` faz curto-circuito).
 * A comparação é sempre pela CHAVE canônica REDUZIDA, independente da notação exibida.
 */
function genFracoes(dens: readonly number[], { fracNot }: MathDeps): MathChallenge {
  const D = dens.reduce((l, d) => l * d / gcd(l, d), 1);
  let d1 = dens[randInt(0, dens.length - 1)], d2 = dens[randInt(0, dens.length - 1)]; const op = rnd() < 0.5 ? '+' : '−';
  let n1 = randInt(1, d1), n2 = randInt(1, d2);
  if (op === '−' && n1 * (D / d1) < n2 * (D / d2)) { const t1 = n1, td = d1; n1 = n2; d1 = d2; n2 = t1; d2 = td; } // sem resultado negativo
  const N = op === '+' ? n1 * (D / d1) + n2 * (D / d2) : n1 * (D / d1) - n2 * (D / d2);
  const ligadas = Object.keys(fracNot).filter((k) => fracNot[k]); const not = ligadas[randInt(0, ligadas.length - 1)] || 'v';
  const keyOf = (v: number): string => fmtFrac(v, D, 'd');   // chave canônica REDUZIDA (compara a resposta), independe da notação
  const dispChoice = (v: number): string => { const g = fracGraphic(v, D); return (g && rnd() < 0.5) ? g : fmtFrac(v, D, not); };
  const dispOp = (nn: number, dd: number): string => { const g = fracGraphic(nn, dd); return (g && rnd() < 0.5) ? g : fmtFrac(nn, dd, not); };
  const ansKey = keyOf(N), seen = new Set([ansKey]), vals = [N]; let gd = 0; // 9 respostas DISTINTAS (por chave) → matriz 3×3
  while (vals.length < 9 && gd++ < 400) { const v = randInt(0, 4 * D), kk = keyOf(v); if (!seen.has(kk)) { seen.add(kk); vals.push(v); } }
  const choices: Choice[] = shuffle(vals).map((v) => ({ key: keyOf(v), disp: dispChoice(v) }));
  // ORDEM DO RNG preservada: `prob` (dois dispOp) é montado DEPOIS das alternativas, como no monólito.
  const prob = `<span class="frac-op">${dispOp(n1, d1)}</span> ${op} <span class="frac-op">${dispOp(n2, d2)}</span> = ?`;
  return { not, prob, answer: ansKey, choices, fala: fala(fracSpeak(n1 + '/' + d1), op, fracSpeak(n2 + '/' + d2)) };
}

/** mat3 e o PADRÃO — SOMA E SUBTRAÇÃO 1: dá para fazer nos dedos (soma ≤10, minuendo ≤10). */
const genSomaSub1: MathGenerator = () => {
  const op = rnd() < 0.5 ? '+' : '−'; let a: number, b: number, ans: number;
  if (op === '+') { a = randInt(0, 9); b = randInt(0, 10 - a); ans = a + b; } else { a = randInt(0, 10); b = randInt(0, a); ans = a - b; }
  return { prob: `${a} ${op} ${b} = ?`, answer: String(ans), choices: mkChoices(ans, 0, 10), fala: fala(a, op, b) }; // sem o nome da forma
};

/** Tabela de geradores por id de atividade (substitui a cadeia if/else — MESMO despacho, MESMO RNG). */
const MATH_GENERATORS: Readonly<Record<string, MathGenerator>> = {
  mat1: genQuantidade, mat2: genSomaFacil, mat4: genSomaSub2, mat5: genTabuada, mat6: genDivisao,
};

/**
 * Fábrica: escolhe o gerador da atividade. Ordem idêntica à do monólito — id conhecido primeiro, depois
 * "a atividade tem denominadores?" (frações), e por último o padrão (Soma e Subtração 1).
 * Nenhuma atividade `mat*` declara `dens`, então as duas primeiras regras nunca colidem.
 */
export function mathGeneratorFor(activityId: string): MathGenerator {
  const g = MATH_GENERATORS[activityId];
  if (g) return g;
  const act = getActivity(activityId);
  if (act && act.dens) { const dens = act.dens; return (deps) => genFracoes(dens, deps); }
  return genSomaSub1;
}

/** Gera UM desafio de matemática para a atividade dada. Puro (RNG semeado) — o que a Fase 6 reusa. */
export function generateMath(activityId: string, deps: MathDeps): MathChallenge {
  return mathGeneratorFor(activityId)(deps);
}

// =================================================================================================
// 1b. GERAÇÃO — letramento (PURA)
// =================================================================================================

let _recentWords: string[] = []; // NÃO REPETIR a mesma palavra por 5 rounds (José): distância mínima de repetição = 5

/** Zera a janela de não-repetição (usado pelos testes; o jogo nunca chama). */
export function resetRecentWords(): void { _recentWords = []; }
/** Espia a janela dos últimos 5 (leitura, cópia). */
export function recentWords(): string[] { return _recentWords.slice(); }

/**
 * Sorteia a palavra do round: prefere a letra da moeda, mas a NÃO-REPETIÇÃO nos últimos 5 rounds vem antes
 * (15 palavras > 5 → sempre há candidata). Verbatim de `pickWord`.
 */
export function pickWord(letter: string): SyllableWord {
  const byL = SILABAS_WORDS.filter((w) => w.w[0] === letter);
  let cands = byL.filter((w) => !_recentWords.includes(w.w));                          // prefere a letra da moeda, sem repetir
  if (!cands.length) cands = SILABAS_WORDS.filter((w) => !_recentWords.includes(w.w)); // sem a letra, mas GARANTE não-repetição
  if (!cands.length) cands = byL.length ? byL : [...SILABAS_WORDS];                    // salvaguarda
  const item = cands[randInt(0, cands.length - 1)];
  _recentWords.push(item.w); if (_recentWords.length > 5) _recentWords.shift();        // janela dos últimos 5
  return item;
}

/** Níveis 2/3 — as 2 sílabas certas + até 7 distratoras do pool, tudo embaralhado. */
export function generateSilabasOptions(item: SyllableWord): { correct: string[]; options: string[] } {
  const correct = item.s.slice(), distract: string[] = [];
  for (const sy of shuffle(SILABA_POOL)) { if (distract.length >= 7) break; if (!correct.includes(sy) && !distract.includes(sy)) distract.push(sy); }
  return { correct, options: shuffle(correct.concat(distract)) };
}

/** Nível 1 — a escrita certa + 3 distratores de FERREIRO (símbolo · repetidas · emoji-no-meio · tamanho). */
export function generatePreChoices(item: SyllableWord): string[] {
  const opts = [item.w];
  for (const d of shuffle(ferreiroDistractors(item))) { if (opts.length >= 4) break; if (!opts.includes(d)) opts.push(d); }
  let guard = 0; while (opts.length < 4 && guard++ < 20) { const d = ferreiroDistractors(item)[randInt(0, 3)]; if (!opts.includes(d)) opts.push(d); }
  return shuffle(opts);
}

/** Níveis 4/5 — grade de 12 letras: as letras DISTINTAS da palavra + extras do alfabeto pt-BR usado. */
export function generateAlfOptions(word: string): string[] {
  const need = [...new Set(word.split(''))], extra: string[] = [];
  for (const ch of shuffle('abcdefghijlmnoprstuvz'.split(''))) { if (need.length + extra.length >= 12) break; if (!need.includes(ch) && !extra.includes(ch)) extra.push(ch); }
  return shuffle(need.concat(extra));
}

/** Modo cego — a cela Braille de cada letra da palavra (letra · pontos · fala dos pontos). Puro. */
export function generateBrailleCells(word: string): BrailleCell[] {
  return word.split('').map((ch) => ({ l: ch, dots: BRAILLE[ch] || [], text: brailleText(ch) }));
}

/**
 * Qual desafio o NÍVEL escolhe (regra pedagógica; verbatim do despacho de `openSilabas`).
 * Cego vem antes de tudo (a11y): o ditado passivo de Braille substitui qualquer nível.
 */
export function literacyKindFor(level: number, blind: boolean): 'braille' | 'pre' | 'alf' | 'silabas' {
  if (blind) return 'braille';
  if (level === 1) return 'pre';
  if (level >= 4) return 'alf';
  return 'silabas';
}

// =================================================================================================
// 2. APRESENTAÇÃO — markup (PURA: string → string; nenhuma toca `document`)
// =================================================================================================

/** Chave de comparação da alternativa (número/fração canônica), mesmo quando exibida como gráfico. */
export function cKey(c: Choice): string { return (c && typeof c === 'object') ? c.key : String(c); }
/** O que a alternativa EXIBE (número ou gráfico de fração). */
export function cDisp(c: Choice): string { return (c && typeof c === 'object') ? c.disp : String(c); }

/** Prefixo das falas do quiz em multiplayer ("Jogador 2: "); vazio no solo. */
export function quizWho(pl: QuizPlayer): string { return numPlayers > 1 ? t('sr.quiz.who', { n: pl.i + 1 }) : ''; }

/** Matemática: a conta no topo + matriz 3×3 de 9 respostas (números ou gráficos). */
export function somasubHtml(q: MathQuiz): string {
  const choices = q.choices.map((c, i) => `<button class="quiz-choice${i === q.sel ? ' sel' : ''}${q.revealed && cKey(c) === q.answer ? ' reveal' : ''}" data-i="${i}" type="button">${cDisp(c)}</button>`).join('');
  const dots = q.dots ? `<div class="quiz-dots" aria-label="${q.dots} bolinhas">${'●'.repeat(q.dots)}</div>` : '';
  const hint = q.revealed ? 'Resposta certa em destaque. Pule (L) para seguir.' : (q.tries > 0 ? 'Quase! Tente de novo.' : 'Escolha e pule (L) para confirmar.');
  return `<div class="quiz-box quiz-box--math" role="dialog" aria-modal="true" aria-label="Desafio de matemática"><div class="quiz-prob">${q.prob || ''}</div>${dots}<div class="quiz-grid">${choices}</div><div class="quiz-hint">${hint}</div></div>`;
}

/** Níveis 2/3: caixas de 2 sílabas + grade de sílabas + Apagar/OK. */
export function silabaHtml(q: SilabasQuiz, disp: (s: string) => string): string {
  const N = q.options.length;
  const boxes = `<div class="silaba-boxes">` + q.boxes.map((b) => `<span class="silaba-box${b !== null ? ' filled' : ''}">${b !== null ? disp(b) : ''}</span>`).join('') + `</div>`;
  const opts = q.options.map((sy, i) => `<button class="quiz-choice${i === q.sel ? ' sel' : ''}" data-i="${i}" type="button">${disp(sy)}</button>`).join('');
  const acts = `<button class="quiz-choice${q.sel === N ? ' sel' : ''}" data-i="${N}" type="button">Apagar</button><button class="quiz-choice${q.sel === N + 1 ? ' sel' : ''}" data-i="${N + 1}" type="button">OK</button>`;
  const hint = q.revealed ? `A palavra é "${disp(q.word)}". Pule (L) para seguir.` : 'Monte a palavra. Pule (L) coloca/confirma.';
  return `<div class="quiz-box" role="dialog" aria-modal="true" aria-label="Monte a palavra"><button class="quiz-word${q.sel === -1 ? ' sel' : ''}" data-i="-1" type="button" aria-label="Ouvir a palavra ${q.word} de novo">${q.emoji}</button><div class="quiz-letter">letra: ${disp(q.letter)}</div>${boxes}<div class="quiz-grid">${opts}</div><div class="silaba-actions">${acts}</div><div class="quiz-hint">${hint}</div></div>`;
}

/**
 * Rótulo do nível no cabeçalho do desafio ("nível 4 · Escrevendo palavras"). Estava escrito 2× à mão (preHtml
 * e alfHtml, este com dois ramos) — mesma string, um lugar só. O game.js ainda tem uma TERCEIRA variante para os
 * menus ("📚 Nível N · …", com maiúscula e emoji), que NÃO é a mesma string e por isso não entrou aqui.
 */
export function levelTag(n: number, qlName: Readonly<Record<number, string>>): string { return 'nível ' + n + ' · ' + qlName[n]; }

/** Nível 1: 3 escritas (na prática 4 opções), só UMA certa. */
export function preHtml(q: PreQuiz, disp: (s: string) => string, qlName: Readonly<Record<number, string>>): string {
  const opts = q.choices.map((w, i) => `<button class="quiz-choice${i === q.sel ? ' sel' : ''}${q.revealed && w === q.word ? ' reveal' : ''}" data-i="${i}" type="button">${disp(w)}</button>`).join('');
  const hint = q.revealed ? `A certa é "${disp(q.word)}". Pule (L) para seguir.` : (q.tries > 0 ? 'Quase! Tente de novo.' : 'Qual é a escrita certa? Pule (L) confirma.');
  return `<div class="quiz-box" role="dialog" aria-modal="true" aria-label="Escolha a palavra certa"><button class="quiz-word${q.sel === -1 ? ' sel' : ''}" data-i="-1" type="button" aria-label="Ouvir a palavra ${q.word} de novo">${q.emoji}</button><div class="quiz-letter">${levelTag(1, qlName)}</div><div class="quiz-grid">${opts}</div><div class="quiz-hint">${hint}</div></div>`;
}

/** Níveis 4/5: caixas do tamanho da palavra + grade de letras. */
export function alfHtml(q: AlfQuiz, disp: (s: string) => string, qlName: Readonly<Record<number, string>>): string {
  const N = q.options.length;
  const boxes = `<div class="silaba-boxes">` + q.boxes.map((b) => `<span class="silaba-box${b !== null ? ' filled' : ''}">${b !== null ? disp(b) : ''}</span>`).join('') + `</div>`;
  const opts = q.options.map((ch, i) => `<button class="quiz-choice${i === q.sel ? ' sel' : ''}" data-i="${i}" type="button">${disp(ch)}</button>`).join('');
  const acts = `<button class="quiz-choice${q.sel === N ? ' sel' : ''}" data-i="${N}" type="button">Apagar</button><button class="quiz-choice${q.sel === N + 1 ? ' sel' : ''}" data-i="${N + 1}" type="button">OK</button>`;
  const hint = q.revealed ? `A palavra é "${disp(q.word)}". Pule (L) para seguir.` : (q.braille ? 'Ouça a cela Braille de cada letra. Pule (L) coloca/confirma.' : 'Monte a palavra letra a letra. Pule (L) coloca/confirma.');
  return `<div class="quiz-box" role="dialog" aria-modal="true" aria-label="Escreva a palavra"><div class="quiz-emoji" aria-label="${q.word}">${q.emoji}</div><div class="quiz-letter">${q.braille ? levelTag(5, qlName) : levelTag(4, qlName)}</div>${boxes}<div class="quiz-grid">${opts}</div><div class="silaba-actions">${acts}</div><div class="quiz-hint">${hint}</div></div>`;
}

/** Modo cego: as celas Braille da palavra (pontos 1,4,2,5,3,6 na ordem visual de 2 colunas). */
export function brailleHtml(q: BrailleQuiz, disp: (s: string) => string): string {
  const cells = q.cells.map((c) => {
    const dots = [1, 4, 2, 5, 3, 6].map((n) => `<span class="bdot${c.dots.includes(n) ? ' on' : ''}"></span>`).join('');
    return `<div class="bcell"><div class="bcell-grid">${dots}</div><div class="bcell-l">${disp(c.l)}</div></div>`;
  }).join('');
  return `<div class="quiz-box" role="dialog" aria-modal="true" aria-label="Braille da palavra ${q.word}"><div class="quiz-emoji" aria-hidden="true">${q.emoji}</div><div class="quiz-letter">palavra: ${disp(q.word)}</div><div class="bcells">${cells}</div><div class="quiz-hint">Ouça os pontos. Pule (L) para coletar. (Cima repete)</div></div>`;
}

/** Markup do desafio, qualquer que seja o tipo (o despacho verbatim do `renderQuiz`). */
export function quizHtml(q: Quiz, disp: (s: string) => string, qlName: Readonly<Record<number, string>>): string {
  return q.kind === 'braille' ? brailleHtml(q, disp)
    : q.kind === 'silabas' ? silabaHtml(q, disp)
      : q.kind === 'pre' ? preHtml(q, disp, qlName)
        : q.kind === 'alf' ? alfHtml(q, disp, qlName)
          : somasubHtml(q);
}

/** As 3 luzes de progresso (canto sup. dir.): acesa = uma vitória rumo à moeda. */
export function winsHtml(n: number): string {
  return '<div class="quiz-wins" aria-label="' + n + ' de 3 acertos para a moeda">' + [0, 1, 2].map((i) => '<span class="qw-dot' + (i < n ? ' on' : '') + '"></span>').join('') + '</div>';
}

/** Cursor mínimo/máximo do desafio (regra de navegação; -1 = a PALAVRA do topo, selecionável p/ repetir a fala). */
export function selRange(q: Quiz): { min: number; max: number } {
  const max = (q.kind === 'silabas' || q.kind === 'alf') ? (q as SilabasQuiz | AlfQuiz).options.length + 1 : (q as MathQuiz | PreQuiz).choices.length - 1;
  const min = (q.kind === 'pre' || q.kind === 'silabas') ? -1 : 0;
  return { min, max };
}

// =================================================================================================
// 3. EFEITO — o slice ligado ao jogo (DOM, som, narração, moeda)
// =================================================================================================

/**
 * Tudo o que o quiz precisa do resto do jogo. Nada aqui é importável sem quebrar a fronteira: ou mora numa
 * `let` do game.js (que um import NÃO pode reatribuir), ou é uma INSTÂNCIA criada no boot (earcons/jingles/
 * tts/hud/menu de atividades), ou é um efeito que pertence a outro slice (moeda, HUD, vitória, toque).
 */
export interface QuizCtx {
  /** Seletor DOM (`$` de ui/dom.ts). Injetado p/ o módulo nunca tocar `document` direto (project node). */
  $: DomQuery;
  /** `hud.getScreen(i)` — contêiner da tela do jogador; é onde o overlay de quiz do MP é criado. */
  getScreen: (i: number) => Element | null;
  /** `disp` do game.js: aplica `letterCase` ('lower'/'upper'), que é uma `let` reatribuída por applyLetra. */
  disp: (s: string) => string;

  /** `modoCego` (empatia auditiva) — `let` do game.js. */
  isModoCego: () => boolean;
  /** `actCat()` da instância de ui/activities-menu: 'alf' muda a regra de penalidade e refala a palavra. */
  actCat: () => string;
  /** `tabSel` da instância do menu — array MUTADO in-place pelo menu; guardado por referência, como no monólito. */
  tabSel: readonly number[];
  /** `fracNot` da instância do menu — objeto MUTADO in-place; idem. */
  fracNot: Record<string, number>;
  /** `QL_NAME` de ui/activities-menu: os nomes dos 5 níveis, impressos no cabeçalho dos desafios 1/4/5. */
  QL_NAME: Readonly<Record<number, string>>;
  /** Anúncio "polite" p/ leitor de tela (core/a11y-sr) — injetado p/ o teste poder capturar a fala. */
  srSay: (t: string) => void;
  /** Anúncio "assertive" (revelações e o ditado Braille). */
  srAlert: (t: string) => void;
  /** `gameSay` (platform/speech): voz pt-BR SEMPRE ativa do letramento, independente do toggle de TTS. */
  gameSay: (t: string) => void;
  /** `tts.narrate` da instância de platform/tts: fala gated pelo mixer (o "Montando" soletra por aqui). */
  narrate: (t: string) => void;
  /** `earcons.sfx` da instância de platform/audio-earcons ('place'|'correct'|'wrong'|'coin'). */
  sfx: (name: string) => void;
  /** `jingles.playPuzzleSolved` — a comemoração suave da 3ª vitória. */
  playPuzzleSolved: () => void;
  /** `burstSparkle` (render/fx): faíscas gentis na 3ª vitória. */
  burstSparkle: (x: number, y: number, color: number, n: number) => void;
  /** `hideTouchControls` da instância de input/touch: quiz aberto = menu na tela → sem controle virtual. */
  hideTouchControls: () => void;
  /** `updateHud()` do game.js: reescreve o contador de moedas do HUD de texto. */
  updateHud: () => void;
  /** `win(pl)` do game.js: fim de partida ao bater COIN_TARGET. */
  win: (pl: QuizPlayer) => void;
  /** `respawnFigure(i)` do game.js: re-sorteia a figura da moeda (penalidade FORA do letramento). */
  respawnFigure: (coinIndex: number) => void;
}

/** A superfície que o game.js religa. */
export interface QuizApi {
  openQuiz: (pl: QuizPlayer, coinIndex: number, shapeId: string) => void;
  openSilabas: (pl: QuizPlayer, coinIndex: number, letter: string) => void;
  renderQuiz: (pl: QuizPlayer) => void;
  closeQuiz: (pl: QuizPlayer) => void;
  quizMove: (pl: QuizPlayer, d: number) => void;
  quizConfirm: (pl: QuizPlayer) => void;
  quizErase: (pl: QuizPlayer) => void;
  announceBraille: (pl: QuizPlayer) => void;
}

/** Liga o slice do quiz ao jogo. Sem I/O: só guarda o ctx e devolve a API. */
export function initQuiz(ctx: QuizCtx): QuizApi {
  const c = ctx;

  // ---------------------------------------------------------------------------------------------
  // Abertura dos desafios
  // ---------------------------------------------------------------------------------------------

  /** MATEMÁTICA: gerador POR ATIVIDADE (menu inicial); grade de 9. */
  function openQuiz(pl: QuizPlayer, coinIndex: number, shapeId: string): void {
    const gen = generateMath(ACTIVITY || '', { tabSel: c.tabSel, fracNot: c.fracNot });
    const q: MathQuiz = { kind: 'somasub', coinIndex, shape: shapeId, sel: 0, tries: 0, revealed: false, prob: gen.prob, answer: gen.answer, choices: gen.choices };
    if (gen.dots !== undefined) q.dots = gen.dots;
    if (gen.not !== undefined) q.not = gen.not;
    pl.quiz = q; pl.vx = 0; pl.vy = 0;
    c.srSay(quizWho(pl) + gen.fala);
    renderQuiz(pl);
  }

  /** LETRAMENTO: despacha pelo NÍVEL (1..5); modo cego mantém o ditado passivo (a11y). */
  function openSilabas(pl: QuizPlayer, coinIndex: number, letter: string): void {
    // DUAS fontes para uma pergunta ("esta pessoa está jogando sem enxergar?"), e eram três: `isBlindMode`
    // saiu porque nada em produção conseguia torná-lo verdadeiro. As duas que ficam são reais e diferentes —
    // o Modo cego é escolha da pessoa, e `viz.kind === 'blind'` é a simulação de empatia. Vale a nota: se um
    // dia aparecer uma terceira, o certo é um predicado só, e não mais um `||`.
    const cego = c.isModoCego() || (VIZ_BY_KEY[(pl && pl.viz) || ''] || {}).kind === 'blind';
    const kind = literacyKindFor(quizLevel, cego);
    if (kind === 'braille') { openBraille(pl, coinIndex, letter); return; } // E8: ditado de Braille
    if (kind === 'pre') { openPre(pl, coinIndex, letter); return; }
    if (kind === 'alf') { openAlf(pl, coinIndex, letter); return; }
    const item = pickWord(letter);
    const { correct, options } = generateSilabasOptions(item);
    // hearSyl: Descobrindo sílabas (nível 2) fala a sílaba no hover/seleção; Montando (3) não
    abrirQuiz(pl, { kind: 'silabas', hearSyl: (quizLevel === 2), coinIndex, letter, word: item.w, emoji: item.e, correct, options, boxes: [null, null], sel: 0, tries: 0, revealed: false });
    pl.vx = 0; pl.vy = 0;
    // A letra e a palavra ATRAVESSAM em pt-BR: são a matéria de uma disciplina de idioma. A moldura traduz.
    c.srSay(quizWho(pl) + t('sr.quiz.buildWord', { letra: c.disp(item.w[0]), palavra: item.w })); // letra da PRÓPRIA palavra (o não-repetir pode trocar a letra da moeda)
    c.gameSay(item.w); // ao abrir, fala a palavra SEMPRE (independente do toggle TTS) — José
    renderQuiz(pl);
  }

  /** Nível 1 — pré-silábico: qual das 3 escritas é a certa? O jogo SOLETRA a opção sob o cursor. */
  function openPre(pl: QuizPlayer, coinIndex: number, letter: string): void {
    const item = pickWord(letter);
    abrirQuiz(pl, { kind: 'pre', coinIndex, word: item.w, emoji: item.e, choices: generatePreChoices(item), sel: 0, tries: 0, revealed: false });
    pl.vx = 0; pl.vy = 0;
    c.srSay(quizWho(pl) + t('sr.quiz.whichSpelling', { palavra: item.w }));
    c.gameSay(item.w); // fala o nome da imagem SEMPRE (independente do toggle TTS) — José
    renderQuiz(pl); quizSpeakSel(pl);
  }

  /** Níveis 4/5 — escritor: montar a palavra LETRA a letra numa grade; 5 dita a cela Braille de cada letra. */
  function openAlf(pl: QuizPlayer, coinIndex: number, letter: string): void {
    const item = pickWord(letter);
    abrirQuiz(pl, { kind: 'alf', braille: quizLevel === 5, coinIndex, word: item.w, emoji: item.e, options: generateAlfOptions(item.w), boxes: Array(item.w.length).fill(null), sel: 0, tries: 0, revealed: false });
    pl.vx = 0; pl.vy = 0;
    c.srSay(quizWho(pl) + t('sr.quiz.writeWord', { palavra: item.w, n: item.w.length }));
    renderQuiz(pl); quizSpeakSel(pl);
  }

  /** E8: ditado de Braille (modo pessoa cega) — dita os pontos da cela por letra. */
  function openBraille(pl: QuizPlayer, coinIndex: number, letter: string): void {
    const item = pickWord(letter);
    abrirQuiz(pl, { kind: 'braille', coinIndex, letter, word: item.w, emoji: item.e, cells: generateBrailleCells(item.w), revealed: false });
    pl.vx = 0; pl.vy = 0; renderQuiz(pl); announceBraille(pl);
  }

  function announceBraille(pl: QuizPlayer): void {
    const q = quizDe(pl); if (!q || q.kind !== 'braille') return;
    // As celas Braille (`cell.l`/`cell.text`) são conteúdo de disciplina de idioma e atravessam inteiras.
    c.srAlert(quizWho(pl) + t('sr.quiz.brailleDictation', { palavra: q.word, celas: q.cells.map((cell) => `${cell.l}: ${cell.text}.`).join(' ') }));
  }

  // ---------------------------------------------------------------------------------------------
  // Fala do item sob o cursor + montagem da palavra
  // ---------------------------------------------------------------------------------------------

  /** Fala o item sob o cursor CONFORME O NÍVEL (regra pedagógica: 2 fala a sílaba, 3 soletra, 5 dita pontos). */
  function quizSpeakSel(pl: QuizPlayer): void {
    const q = quizDe(pl); if (!q || q.kind === 'braille' || q.kind === 'somasub') return; // as duas sem palavra a soletrar
    if (q.sel < 0) { c.srSay(c.disp(q.word)); c.gameSay(q.word); return; } // cursor na PALAVRA do topo → fala a palavra
    if (q.kind === 'pre') { c.srSay(soletra(q.choices[q.sel])); return; }
    const opts = q.options; // estreitado pelo `kind === 'pre'` acima — sem `as`
    const N = opts ? opts.length : 0;
    if (q.sel >= N) { c.srSay(t(q.sel === N ? 'sr.quiz.erase' : 'sr.quiz.ok')); return; }
    const it = opts[q.sel];
    if (q.kind === 'silabas') {
      if (q.hearSyl) { c.srSay(c.disp(it)); c.gameSay(it); }                  // Descobrindo sílabas (2): sílaba INTEIRA, áudio SEMPRE (gameSay)
      else { c.srSay(soletra(it)); c.narrate(soletra(it)); }                  // Montando (3): SOLETRA as letras, áudio só com TTS ligado (narrate)
    } else if (q.kind === 'alf') c.srSay(q.braille ? brailleText(it) : (LETTER_NAME[it] || it)); // 4 nome da letra · 5 SÓ os pontos da cela ("a"→"um")
  }

  function placeLetter(pl: QuizPlayer, ch: string): void {
    const q = quizDe(pl); if (!q || q.kind !== 'alf') return; const idx = q.boxes.indexOf(null); if (idx < 0) return;
    q.boxes[idx] = ch; c.sfx('place'); c.srSay(q.braille ? brailleText(ch) : (LETTER_NAME[ch] || ch)); renderQuiz(pl); // braille: só os PONTOS
  }
  function eraseLastLetter(pl: QuizPlayer): void {
    const q = quizDe(pl); if (!q || q.kind !== 'alf') return;
    for (let i = q.boxes.length - 1; i >= 0; i--) { if (q.boxes[i] !== null) { q.boxes[i] = null; break; } }
    renderQuiz(pl);
  }
  function placeSilaba(pl: QuizPlayer, sy: string): void {
    const q = quizDe(pl); if (!q || q.kind !== 'silabas') return;
    const idx = q.boxes[0] === null ? 0 : (q.boxes[1] === null ? 1 : -1); if (idx < 0) return;
    q.boxes[idx] = sy; c.sfx('place');
    // Descobrindo: confirmação + refala a sílaba (sempre); Montando: SOLETRA as letras (só c/ TTS)
    if (q.hearSyl) { c.srSay(c.disp(sy)); c.gameSay(sy); } else { c.srSay(soletra(sy)); c.narrate(soletra(sy)); }
    renderQuiz(pl);
  }
  function eraseLastSilaba(pl: QuizPlayer): void {
    const q = quizDe(pl); if (!q || q.kind !== 'silabas') return;
    if (q.boxes[1] !== null) q.boxes[1] = null; else if (q.boxes[0] !== null) q.boxes[0] = null;
    renderQuiz(pl);
  }

  // ---------------------------------------------------------------------------------------------
  // Overlay: onde o quiz mora e como ele é desenhado
  // ---------------------------------------------------------------------------------------------

  /** L3: overlay POR JOGADOR — solo usa o #quiz global; MP cria um .quiz dentro da tela do jogador. */
  function quizEl(pl: QuizPlayer): HTMLElement | null {
    if (numPlayers <= 1) return c.$<HTMLElement>('#quiz');
    const scr = c.getScreen(pl.i); if (!scr) return c.$<HTMLElement>('#quiz');
    let q = scr.querySelector<HTMLElement>(':scope > .quiz');
    if (!q) { q = document.createElement('div'); q.className = 'quiz'; q.hidden = true; scr.appendChild(q); }
    return q;
  }

  function renderQuiz(pl: QuizPlayer): void {
    const q = quizDe(pl), ov = quizEl(pl); if (!ov) return; if (!q) { ov.hidden = true; return; }
    ov.innerHTML = quizHtml(q, c.disp, c.QL_NAME);
    const box = ov.querySelector('.quiz-box');
    if (box) box.insertAdjacentHTML('afterbegin', winsHtml(Math.min(3, pl.alfWins || 0))); // 3 luzes de progresso: acesa = amarela com brilho
    // .quiz-word (palavra do topo, data-i=-1) → repete a fala
    ov.querySelectorAll<HTMLElement>('.quiz-choice,.quiz-word').forEach((b) => b.addEventListener('click', () => { if (pl.quiz) { (pl.quiz as MathQuiz).sel = +(b.dataset.i as string); quizConfirm(pl); } }));
    ov.hidden = false; c.hideTouchControls(); // quiz aberto = menu na tela → sem controle virtual
  }

  function closeQuiz(pl: QuizPlayer): void { pl.quiz = null; const ov = quizEl(pl); if (ov) ov.hidden = true; }

  // ---------------------------------------------------------------------------------------------
  // Navegação e confirmação
  // ---------------------------------------------------------------------------------------------

  /** ESPECIAL: apaga a última sílaba/letra (jogos que MONTAM a palavra; NÃO no Descobrindo palavras/pre). */
  function quizErase(pl: QuizPlayer): void {
    const q = quizDe(pl); if (!q) return;
    if (q.kind === 'silabas') { eraseLastSilaba(pl); c.sfx('place'); }
    else if (q.kind === 'alf') { eraseLastLetter(pl); c.sfx('place'); }
  }

  function quizMove(pl: QuizPlayer, d: number): void {
    const q = quizDe(pl); if (!q || q.kind === 'braille') return; // idem: o Braille não tem seleção
    const { min, max } = selRange(q);
    q.sel = Math.max(min, Math.min(max, q.sel + d)); renderQuiz(pl);
    if (q.kind === 'silabas' || q.kind === 'alf' || q.kind === 'pre') quizSpeakSel(pl); // L3: leitura conforme o nível
    else c.srSay(speakChoice(cKey(q.choices[q.sel]))); // matemática: fala pela CHAVE (número/fração), mesmo quando exibido como gráfico
  }

  /** Coleta a figura do quiz (por jogador) e checa vitória. */
  function quizTake(pl: QuizPlayer, q: Quiz): void {
    takeCoin(coins[q.coinIndex] as { taken: boolean });
    const sprites = getCoinSprites(); if (sprites[q.coinIndex]) sprites[q.coinIndex].visible = false;
    pl.collected++; c.updateHud();
    closeQuiz(pl); if (pl.collected >= COIN_TARGET) c.win(pl);
  }

  /** 3 VITÓRIAS = 1 MOEDA em TODOS os minigames, sem exceção (regra do José 2026-07-04). */
  function quizWin(pl: QuizPlayer, q: Quiz): void {
    pl.alfWins = (pl.alfWins || 0) + 1;
    const word = (q as SilabasQuiz).word;
    if (pl.alfWins < 3) {
      if (c.actCat() === 'alf' && word) { // LETRAMENTO: som suave (o sfx de acerto já tocou) + REFALA a palavra + PAUSA → próxima palavra
        q.won = true; c.gameSay(word); c.srSay(quizWho(pl) + t('sr.quiz.wellDone', { palavra: c.disp(word), n: pl.alfWins }));
        setTimeout(() => { if (pl.quiz === q) closeQuiz(pl); }, 1200); return; // a próxima abre ao encostar na moeda e é falada (openSilabas/openPre → gameSay)
      }
      c.srSay(quizWho(pl) + t('sr.quiz.correctSoFar', { n: pl.alfWins })); closeQuiz(pl); return; // moeda FICA; encostado nela, a próxima pergunta abre sozinha
    }
    // 3ª VITÓRIA: acende a 3ª luz + comemoração SUAVE (som tipo enigma-resolvido do Zelda), depois pega a moeda
    q.celebrating = true;
    const ov = quizEl(pl), dots = ov && ov.querySelector('.quiz-wins');
    if (dots) { dots.querySelectorAll('.qw-dot').forEach((d) => d.classList.add('on')); dots.classList.add('celebrate'); }
    c.playPuzzleSolved(); if (typeof c.burstSparkle === 'function') c.burstSparkle(pl.x, pl.y - 16, 0xffe08a, 10); // faíscas gentis
    if (c.actCat() === 'alf' && word) c.gameSay(word); // letramento: refala a palavra na 3ª vitória também
    c.srSay(quizWho(pl) + 'Muito bem! Você ganhou a moeda!');
    setTimeout(() => { pl.alfWins = 0; quizTake(pl, q); }, 900); // deixa a 3ª luz + animação aparecerem antes de fechar
  }

  function quizConfirm(pl: QuizPlayer): void {
    const q = quizDe(pl); if (!q || q.celebrating || q.won) return; // durante a comemoração/pausa pós-acerto, ignora entrada
    const anyQ = q as { sel?: number; word?: string };
    if (anyQ.sel === -1 && anyQ.word) { c.gameSay(anyQ.word); return; } // PALAVRA do topo selecionada → repete a fala (VLibras gesticula, na etapa do modo surdo)
    if (q.revealed) { // SEM PENALIDADE na alfabetização: a moeda fica no lugar (nova pergunta ao tocar); matemática re-sorteia a figura
      if (c.actCat() === 'alf') { closeQuiz(pl); } else { c.respawnFigure(q.coinIndex); closeQuiz(pl); } return;
    }
    if (q.kind === 'braille') { c.sfx('coin'); c.srSay(quizWho(pl) + 'Coletado!'); quizWin(pl, q); return; }
    if (q.kind === 'pre') { // nível 1: acertou a escrita?
      if (q.choices[q.sel] === q.word) {
        c.sfx('correct'); c.srSay(`${quizWho(pl)}Acertou! ${c.disp(q.word)}: ${soletra(q.word)}.`); quizWin(pl, q);
      } else {
        q.tries++;
        if (q.tries >= 2) { q.revealed = true; c.srAlert(`${quizWho(pl)}A certa é ${c.disp(q.word)}: ${soletra(q.word)}. Pule para seguir.`); }
        else { c.sfx('wrong'); c.srSay(t('sr.quiz.tryAgain')); }
        renderQuiz(pl);
      }
      return;
    }
    if (q.kind === 'alf') { // níveis 4/5: montou a palavra inteira?
      const N = q.options.length;
      if (q.sel < N) { placeLetter(pl, q.options[q.sel]); return; }
      if (q.sel === N) { eraseLastLetter(pl); return; }
      if (q.boxes.join('') === q.word) { c.sfx('correct'); c.srSay(quizWho(pl) + 'Acertou!'); quizWin(pl, q); }
      else {
        q.tries++;
        if (q.tries >= 2) { q.revealed = true; q.boxes = q.word.split(''); c.srAlert(`${quizWho(pl)}A palavra é ${c.disp(q.word)}: ${soletra(q.word)}. Pule para seguir.`); }
        else { q.boxes = q.boxes.map(() => null); c.sfx('wrong'); c.srSay(t('sr.quiz.tryAgain')); }
        renderQuiz(pl);
      }
      return;
    }
    if (q.kind === 'silabas') {
      const N = q.options.length;
      if (q.sel < N) { placeSilaba(pl, q.options[q.sel]); return; }
      if (q.sel === N) { eraseLastSilaba(pl); return; }
      if (q.boxes[0] === q.correct[0] && q.boxes[1] === q.correct[1]) { c.sfx('correct'); c.srSay(quizWho(pl) + 'Acertou!'); quizWin(pl, q); }
      else {
        q.tries++;
        if (q.tries >= 2) { q.revealed = true; q.boxes = q.correct.slice(); c.srAlert(`${quizWho(pl)}A palavra é ${c.disp(q.word)}. Pule para seguir.`); }
        else { q.boxes = [null, null]; c.sfx('wrong'); c.srSay(t('sr.quiz.tryAgain')); }
        renderQuiz(pl);
      }
      return;
    }
    // matemática também: 3 vitórias = 1 moeda (compara pela CHAVE, não pela exibição)
    if (cKey(q.choices[q.sel]) === q.answer) { c.sfx('correct'); c.srSay(quizWho(pl) + 'Acertou!'); quizWin(pl, q); }
    else {
      q.tries++;
      // As chaves do `else` importam: sem elas o `srSay(sr.quiz.tryAgain)` ficava FORA do ramo e era dito
      // tambem depois de revelar a resposta — a crianca ouvia "A resposta e X. Pule para seguir." e logo
      // "Tente de novo.", duas instrucoes que se contradizem. Os outros tres ramos deste arquivo sempre
      // tiveram as chaves; era so este.
      if (q.tries >= 2) { q.revealed = true; c.srAlert(`${quizWho(pl)}A resposta é ${speakChoice(q.answer)}. Pule para seguir.`); }
      else { c.sfx('wrong'); c.srSay(t('sr.quiz.tryAgain')); }
      renderQuiz(pl);
    }
  }

  return { openQuiz, openSilabas, renderQuiz, closeQuiz, quizMove, quizConfirm, quizErase, announceBraille };
}
