// SPDX-License-Identifier: AGPL-3.0-or-later
// O SEGUNDO CONSUMIDOR — um quiz que NÃO é plataforma (ADR-0027 passo 6, antecipado pelo Dev em 2026-08-25).
//
// NÃO é um jogo ainda. É um INSTRUMENTO DE MEDIDA, e a medida é: o que desta base é ENGINE e o que é o jogo de
// plataforma que ela hospeda? Nenhuma leitura de código responde isso — só um consumidor que não tenha física,
// nem tiles, nem mundo, e que por isso não consiga fingir precisar deles.
//
// A REGRA, e é o que produz a medida:
//
//     SÓ IMPORTA DE core/ input/ render/ platform/ ui/ audio/. NUNCA DE game/.
//
// Quando ele precisar de algo que só existe em `game/`, isso é um ACHADO: anotado no bloco ACHADOS abaixo,
// nunca contornado. Contornar destruiria o instrumento — ele mede exatamente o que seríamos tentados a
// esconder. `tests/engine-boundary.node.test.js` prende a regra para que ela não dependa de disciplina.
//
// ---------------------------------------------------------------------------------------------------------
// ACHADOS — o que a engine ainda não entrega a quem não é plataforma. Cada linha é trabalho do passo 5.
// ---------------------------------------------------------------------------------------------------------
//
//  1. `core/a11y-sr` FUNCIONA SOZINHO. Precisa de dois elementos no documento (`#sr-status`, `#sr-alert`) e de
//     mais nada. É o pedaço mais reutilizável da base — e é bom que seja, porque é o que sustenta o pilar 2.
//
//  2. `core/i18n` FUNCIONA SOZINHO, mas os DICIONÁRIOS são do jogo de plataforma: `sr.motor.*`, `sr.audio.*`,
//     `contrast.*`. Um segundo jogo herda 253 chaves das quais usa um punhado. Não é aresta de importação —
//     é peso morto no pacote, e vira problema no dia em que houver dez jogos.
//
//  3. TTS: LIGA SEM O JOGO, e melhor do que eu esperava. `platform/tts` pede oito coisas por injeção e as
//     oito saem de `platform/audio` — `ensureAC`, `catNode`, `audioOut`, `soundOn`, `volume`, `audioCat`. O
//     consumidor monta o ctx em seis linhas e não reimplementa grafo de áudio nenhum. A pilha sonora é
//     genuinamente da engine.
//     PORÉM: `initAudioMixer()` precisa ser chamado antes, senão `audioCat` é null e o `narrate` cala em
//     silêncio — sem erro, sem aviso. Uma dependência de ORDEM que nada no tipo declara, e que o segundo
//     consumidor descobriu do jeito mais caro: o áudio simplesmente não saía.
//
//  4. A NARRAÇÃO NASCE DESLIGADA (`defaultAudioCat` devolve `on: k !== 'tts'`), e isso é correto — mas revela
//     que os PAINÉIS não são acessório: sem o menu auditivo, a criança não tem como ligar a voz. Um consumidor
//     que quisesse só "a engine, sem os menus" entregaria um TTS que existe e nunca fala.
//
//  5. `ui/settings-typo` + `ui/settings-panel` SERVEM FORA DO GÊNERO, sem uma linha de mudança. As 18 fontes, o
//     rodapé de explicação, a aplicação no documento, o anúncio e o "restaurar padrões" funcionaram no quiz
//     como funcionam no jogo. É a evidência mais forte até agora de que a pilha de menus é da engine.
//
//  6. ✅ CONSERTADO. O CONTRATO DE MARKUP ERA INVISÍVEL. O ctx do painel pedia `$` e `store`; o que ele
//     REALMENTE exigia é que o documento do consumidor contivesse `#typo`, `#typo-list`, `#typo-preview`,
//     `#typo-close` e `#typo-reset`. Nada no tipo dizia isso — descobria-se por tentativa, e o modo de falhar
//     era o pior possível: o painel abre vazio, sem erro. Uma engine que exige ids fixos e não os declara
//     está exigindo que cada consumidor redescubra a mesma lista.
//     AGORA a engine CONSTRÓI a casca: `ui/panel-shell.mountShell` monta o véu, o cartão, o título, a lista
//     e os dois botões, e DEVOLVE os cinco ids. O bloco que estava escrito à mão no `quiz.html` saiu, e este
//     ficheiro passou a montá-lo — o contrato lê-se no tipo em vez de se descobrir por tentativa.
//     ⚠️ O `#typo-preview` fica DESTE lado, e a distinção é a que importa: a amostra «Juiz foge e bota fita
//     de cetim na xícara» só o painel de TIPOGRAFIA tem. Uma casca que soubesse dela saberia de um painel em
//     particular, que é o oposto do que ela é. É o mesmo desenho do achado 7 — a engine entrega o markup
//     genérico, o consumidor acrescenta o que é dele.
//
//  7. A CORREÇÃO DE DALTONISMO VIAJA. `installCvdFilters(host)` monta os seis filtros SVG em tempo de execução
//     dentro de um host que o consumidor fornece, e `VIZ_FILTER` diz qual `url(#...)` aplicar — em QUALQUER
//     elemento. O quiz ganhou correção protan/deutan/tritan sem PIXI e sem copiar uma linha de markup. É o
//     desenho certo, e vale registrar por contraste com o achado 6: aqui a engine ENTREGA o markup em vez de
//     exigir que o consumidor o adivinhe.
//
//  8. O ALTO CONTRASTE NÃO VIAJA, e a razão é estrutural, não um defeito. Os modos `hcnew` REPINTAM TEXTURAS
//     de tile na PIXI; um quiz não tem tiles, e não há o que repintar. Ou seja: o que o menu chama de
//     "acessibilidade visual" são DUAS pilhas com um nome só —
//        · uma de DOM/CSS (filtros de daltonismo, tipografia, caixa alta) que serve a qualquer jogo;
//        · uma de CANVAS (renderização direta, contornos, cores de papel) que só existe onde há mundo.
//     O painel as apresenta numa lista única de 7 modos, o que é certo para a plataforma e deixa um segundo
//     consumidor podendo oferecer só metade da lista. A divisão do passo 5 precisa cortar AQUI, e este é o
//     tipo de corte que só um consumidor sem tiles revela.
//
//  9. ✅ CONSERTADO. O SONAR NÃO PODIA SER USADO POR QUEM NÃO É PLATAFORMA, e o quiz não o ligou: ligá-lo
//     exigiria MENTIR para a engine. O ctx de `platform/audio-nav` pedia 19 coisas, e seis eram de plataforma
//     pura — `tileAt`, `solidAt`, `BOX`, `TILE`, `getCoins`, `getCenario`. Um quiz teria de inventar tiles
//     falsos, uma caixa de colisão falsa e um cenário falso para pedir "aponte a alternativa mais próxima".
//     E o módulo era DOIS módulos com um nome só: `caneProbe`/`caneTap`/`waterNav` são bengala e natação,
//     isto é, plataforma; `sonar`/`panFor`/`needsAudioCues` são navegação sonora, que serve a qualquer jogo.
//     Contornar com dublês teria produzido um "funciona" falso — o instrumento existe para não fazer isso.
//     AGORA são dois de verdade (item 19): `platform/audio-sonar` recebe TOPOLOGIA, ALVOS e NOME do contrato,
//     e as seis coisas de plataforma não atravessaram — sumiram. Este quiz liga o sonar com a tecla S, e o
//     que ele ouve é "Sonar: pergunta à direita, bem perto" — a MESMA função que na plataforma diz "moeda".
//     A prova não é o som: é que ligá-lo não exigiu mentira nenhuma. Nenhum tile falso foi inventado aqui.
//     ACHADO LATERAL, já consertado à parte (7e72da9): o anúncio do sonar não passava por `t()`. Sete cadeias
//     em pt-BR cruas no único módulo cuja saída É a interface da criança cega.
//
// 10. ✅ CONSERTADO. A NAVEGAÇÃO DE MENU FUNCIONAVA FORA DO GÊNERO — mas só depois de o quiz MENTIR SOBRE A
//     PRÓPRIA FASE. `menu-nav` abria com `if (phase !== 'paused') return`, e `phase` chegava por IMPORTAÇÃO
//     de core/state, não por injeção: o consumidor não tinha como trazer o próprio modelo de fases. Um quiz
//     cujos ajustes estão sempre disponíveis precisava se declarar "pausado" para navegar os próprios menus.
//     De dentro da plataforma isso é invisível — lá os menus só abrem em pausa mesmo. Foi a terceira vez que
//     este consumidor mostrou uma fronteira que nenhuma leitura de código mostraria.
//     AGORA o ctx pede `isNavigable()`, um BOOLEANO e não a fase: injetar `getPhase()` teria matado a
//     importação e mantido a mentira, porque o consumidor continuaria devolvendo a string `'paused'`. A
//     plataforma responde `phase === 'paused'`; este quiz responde `true`; ninguém mente. A linha
//     `setPhaseValue('paused')` que ficava aqui foi apagada, e `menu-nav` não importa mais de core/state.
//     Provado: com `setPhaseValue('paused')`, `S` desce atkinson→lexend→andika e `W` volta, pelo esquema de
//     teclas remapeável. Sem ela, tecla nenhuma chega.
//
// 11. O TECLADO REMAPEÁVEL É O MELHOR RECORTE DA BASE. `KeyboardRuntimePlayer` é `Pick<ControlledPlayer,'ctrl'>`
//     — um esquema de teclas e nada mais. O quiz fornece UM jogador de verdade, sem posição, sem física, sem
//     entidade de mundo, e recebe `whichPlayer`/`actionOf` prontos. É o contraste exato do sonar (achado 9):
//     mesmo subsistema de entrada, um pede o mundo inteiro, o outro pede o que realmente usa.
//
// 12. DETALHE QUE CUSTAVA UMA LINHA — E A ENGINE FOI CONSERTADA. O achado original: `menu-nav` tipava `win`
//     com `fn: (e: never) => void`, o `window` real não casava, e todo consumidor escreveria o mesmo
//     adaptador de uma linha. Este registro é o que o motivou: o segundo consumidor sentiu a mesma dor que o
//     primeiro, que é o sinal de que o problema era da engine e não do consumidor.
//
//     A porta agora é genérica sobre `WindowEventMap` (`EventTargetLike`, em input/touch-bindings), o
//     `window` entra direto, e os `as (e: never) => void` que a engine escrevia em cada registro sumiram
//     junto. Ficou registrado em vez de apagado porque a lição é a que vale: dor repetida em consumidor é
//     defeito de quem oferece.
//
// 13. O MODO PESSOA SURDA VIAJA, e isto valida o conserto de b0239e9 por um ângulo que eu não podia testar
//     ontem: a página do quiz NÃO CARREGA o widget do VLibras, e mesmo assim o modo liga, desliga, persiste e
//     anuncia. Enquanto o estado era deduzido da geometria do widget, ele pertencia à página que carregava a
//     biblioteca — não à engine. Agora é da engine.
//     O que NÃO viaja é o intérprete em si: sem o widget, o modo está ligado e nada traduz. É a #59, e é uma
//     lacuna honesta — o estado é nosso, o tradutor ainda é de terceiro.
//
// 14. O TOQUE SE PARTE COMO O VISUAL. `input/touch` tem duas metades:
//        · ERGONOMIA — `padPxPerMm`, a classificação de mão, o milímetro real ancorado no aparelho (WCAG
//          2.5.5). Funções PURAS, folha, que o quiz usou para dimensionar os próprios botões. Viaja inteira.
//        · O PAD — uma cruz direcional e quatro botões chamados `jump`, `run`, `especial`, `swap`, mais DOZE
//          ids fixos de markup que o consumidor teria de reproduzir. Um quiz quer dois alvos grandes
//          ("próxima" e "confirmar"), não um direcional de plataforma.
//     Não liguei o `initTouch`: reproduzir doze ids para um conjunto de controles que o quiz não quer seria o
//     mesmo tipo de mentira do sonar. Usei a metade pura, que é exatamente o que a divisão deveria separar.
//
// ---------------------------------------------------------------------------------------------------------
// THE TEST BENCH (the Dev: «O quiz está ineficiente para teste»). The quiz opens on a START SCREEN that lists its skills by BNCC
// code (`quiz-skills`), explained in the engine's footer (ADR-0244); a skill plays three questions of five options with the
// attempts of ADR-0049 §5–§6, and comes round again with the options rotated one place per pass, so the ten-question window of
// `educational/adaptive-engine` fills in a sitting. Its ten-segment bar is the HUD's learning band — in memory, for this page
// only (ADR-0103). Content in a language discipline carries `lang` and is spoken as a part of its own language (ADR-0243).
// ---------------------------------------------------------------------------------------------------------
import { escapeHtml } from '../core/escape-html.js'; // #106: enunciado e alternativas sao TEXTO
import type { Translate } from '../core/i18n.js';
import { captionDuration } from '../core/caption-duration.js';
import { DEFAULTS } from '../core/setting-defaults.js';
import { announceItem } from '../ui/item-announcement.js';
import { keyName } from '../ui/control-choices.js';
import type { KeyScheme } from '../core/entity.js';
import { createGame, type Engine, type EngineHost, type VirtualCommand } from '../boot/create-game.js';
import type { GameDeclaration, Objective, Speakable, Spot } from '../core/contract.js';
import type { Scene } from '../core/scenes.js';
import type { SpokenPart } from '../platform/tts.js';
import { resultadoDaQuestao, type ResultadoDaQuestao } from '../educational/adaptive-engine.js';
import type { Bar } from '../educational/segment-bar.js';
import { QUIZ_DICTIONARIES } from './quiz-words.js';
import {
  afterCopying, attempt, FIRST_ATTEMPT, gridRows, gridStep, OPTION_COLUMNS, rotated, SKILL_COLUMNS, skillRows, skillsInOrder, STAGES, withResult,
  type AttemptOutcome, type Attempts, type Move, type SkillReading,
} from './quiz-round.js';
import { QUIZ_SKILLS, type QuizOption, type QuizQuestion, type QuizSkill, type Words } from './quiz-skills.js';

/* ===================================== WORDS AND PARTS ===================================== */

/** The words in the page's language (`pt`, `en`, `es`); another code reads the Portuguese, as the dictionaries do. */
export function inLanguage(words: Words, locale: string): string {
  const code = locale.slice(0, 2);
  return (code === 'en' || code === 'es' ? words[code] : '') || words.pt;
}

/** A piece of what the voice says (ADR-0243 §1): frame, with no language — the interface's voice —, or content, in its own. */
const part = (text: string, language?: string): SpokenPart => (language ? { text, language } : { text });

/** The parts as ONE text, in order: what is on screen and what a screen reader reads, where the voice reads the parts. */
export function joinParts(parts: readonly SpokenPart[]): string {
  return parts.map((p) => p.text).join('');
}

/** Parts as markup: frame as text, content inside an element that says its language (WCAG 3.1.2, ADR-0243 §6). */
function partsHtml(parts: readonly SpokenPart[]): string {
  return parts.map((p) => (p.language ? `<span lang="${escapeHtml(p.language)}">${escapeHtml(p.text)}</span>` : escapeHtml(p.text))).join('');
}

/**
 * THE STATEMENT AS PARTS: the frame in the page's language, and the `content` of a language discipline where the frame says
 * `{content}` — untranslated, in `contentLanguage` («A FRONTEIRA», CLAUDE.md). The data gate holds one `{content}` exactly when
 * there is content (`tests/quiz-skills-are-well-formed`).
 */
export function statementParts(q: QuizQuestion, locale: string, contentLanguage?: string): SpokenPart[] {
  const frame = inLanguage(q.statement, locale);
  if (q.content === undefined) return [part(frame)];
  const [before = '', after = ''] = frame.split('{content}');
  return [part(before), part(q.content, contentLanguage), part(after)].filter((p) => p.text !== '');
}

/** An option as it is shown and said: words in the page's language, or content in the skill's language. */
export function optionFace(option: QuizOption, locale: string, contentLanguage?: string): SpokenPart {
  return typeof option === 'string' ? part(option, contentLanguage) : part(inLanguage(option, locale));
}

/* ===================================== THE START SCREEN ===================================== */

/** What a skill is called on its button: its BNCC code, or its component's name where the BNCC gives it none. */
export function skillLabel(s: QuizSkill, locale: string): string {
  return s.code ?? inLanguage(s.component, locale);
}

/** The footer's explanation of a skill (ADR-0244): component · grade — the skill's text, in the page's language. */
export function skillExplanation(t: Translate, s: QuizSkill, locale: string): string {
  return t('quiz.skill.explain', {
    component: inLanguage(s.component, locale), grade: inLanguage(s.grade, locale), skill: inLanguage(s.skillText, locale),
  });
}

/** One skill as the voice says it: code and component, then its place — «EF05MA08, Matemática, 1 de 2» (ADR-0167). */
export function skillNarration(t: Translate, ordered: readonly QuizSkill[], i: number, locale: string, indexOn: boolean): SpokenPart[] {
  const s = ordered[i];
  if (!s) return [];
  const component = inLanguage(s.component, locale);
  return [part(announceItem(t, { label: skillLabel(s, locale), state: s.code ? component : '', position: i + 1, total: ordered.length }, indexOn))];
}

/** The start screen's markup: a title, then each group under its name, one button per skill. Pure. */
export function startHtml(t: Translate, ordered: readonly QuizSkill[], locale: string, cursor: number): string {
  let i = 0;
  const groups = STAGES.map((stage) => {
    const of = ordered.filter((s) => s.stage === stage);
    if (!of.length) return '';
    const buttons = of.map((s) => {
      const k = i++;
      const label = skillLabel(s, locale);
      // the button's name starts with what is written on it (WCAG 2.5.3) and adds the component its code stands for
      const name = s.code ? `${label}, ${inLanguage(s.component, locale)}` : label;
      return `<button class="mode-btn quiz-skill${k === cursor ? ' is-on' : ''}" data-skill="${k}" type="button"`
        + ` aria-label="${escapeHtml(name)}"${k === cursor ? ' aria-current="true"' : ''}>${escapeHtml(label)}</button>`;
    }).join('');
    return `<section class="quiz-stage" aria-labelledby="quiz-stage-${stage}">`
      + `<h3 class="quiz-stage-name" id="quiz-stage-${stage}">${escapeHtml(t(`quiz.stage.${stage}`))}</h3>`
      + `<div class="quiz-skills" style="--quiz-cols:${SKILL_COLUMNS}">${buttons}</div></section>`;
  }).join('');
  // the title is a HEADING for a screen reader and the first thing the voice says, not a line on screen: 📏 drawn, it pushed
  // fifteen skills under the footer's two lines with the larger face (quiz-bench-layout)
  return `<h2 class="sr-only">${escapeHtml(t('quiz.start.title'))}</h2>${groups}`;
}

/* ===================================== A QUESTION ===================================== */

/** An option as the question screen draws it. */
export interface OptionView extends SpokenPart {
  /** Tried and wrong in this phase: `aria-disabled`, and picking it again is refused with a word. */
  readonly off: boolean;
  /** The answer marked for her to copy (ADR-0049 §6). */
  readonly marked: boolean;
}
export interface QuestionView {
  readonly statement: readonly SpokenPart[];
  readonly options: readonly OptionView[];
  /** The line under the statement: the explanation after the third wrong attempt, the copy line after the sixth. */
  readonly note: string | null;
}

/** What the question screen shows now. Pure: the skill, the question, the pass, the attempts and the language. */
export function questionView(t: Translate, s: QuizSkill, q: QuizQuestion, pass: number, at: Attempts, locale: string): QuestionView {
  const r = rotated(q.options, q.correct, pass);
  return {
    statement: statementParts(q, locale, s.contentLanguage),
    options: r.options.map((o, i) => ({
      ...optionFace(o, locale, s.contentLanguage), off: at.off.includes(i), marked: at.phase === 'copying' && i === r.correct,
    })),
    note: at.phase === 'explained' ? inLanguage(q.explanation, locale) : at.phase === 'copying' ? t('quiz.copy.note') : null,
  };
}

/** Marcação de uma pergunta. Pura: recebe o que mostrar, devolve texto — testável sem DOM. */
export function questionHtml(t: Translate, view: QuestionView, cursor: number): string {
  const alts = view.options.map((o, i) =>
    `<button class="mode-btn quiz-alt${i === cursor ? ' is-on' : ''}${o.off ? ' is-off' : ''}${o.marked ? ' is-answer' : ''}"`
    + ` data-alt="${i}" type="button" role="radio" aria-checked="${i === cursor}"${o.off ? ' aria-disabled="true"' : ''}`
    + `${o.language ? ` lang="${escapeHtml(o.language)}"` : ''}>${escapeHtml(o.text)}</button>`).join('');
  const note = view.note ? `<p class="quiz-note">${escapeHtml(view.note)}</p>` : '';
  return `<h2 class="quiz-pergunta">${partsHtml(view.statement)}</h2>${note}`
    + `<div class="quiz-alts" role="radiogroup" aria-label="${escapeHtml(t('quiz.alternativas'))}" style="--quiz-cols:${OPTION_COLUMNS}">${alts}</div>`;
}

/** One option as it is said: its words (in their own language), then its state and place — «sister, 2 de 5» (ADR-0167). */
export function optionNarration(t: Translate, view: QuestionView, i: number, indexOn: boolean): SpokenPart[] {
  const o = view.options[i];
  if (!o) return [];
  const rest = announceItem(t, { label: '', state: o.off ? t('quiz.option.off') : '', position: i + 1, total: view.options.length }, indexOn);
  return rest ? [part(o.text, o.language), part(`, ${rest}`)] : [part(o.text, o.language)];
}

/**
 * WHAT THE VOICE SAYS WHEN A QUESTION OPENS: the statement, then every option (ADR-0158 rule 3), each with its PLACE after its
 * name (ADR-0167) — «… Gato, 1 de 5. Galinha, 2 de 5. …». A question is not answerable by ear until its options are heard.
 */
export function questionNarration(t: Translate, view: QuestionView, indexOn: boolean): SpokenPart[] {
  const options = view.options.flatMap((_, i) => [...(i ? [part('. ')] : [part(' ')]), ...optionNarration(t, view, i, indexOn)]);
  return [...view.statement, ...options];
}

/**
 * What to narrate on a draw, and which question has now been narrated. The whole question only when it OPENS (a new `key`);
 * a draw on the same one is the cursor moving, and then only the option under it is said.
 */
export function narrationOnDraw(t: Translate, view: QuestionView, key: string, cursor: number, alreadyNarrated: string, indexOn: boolean): { parts: SpokenPart[]; narrated: string } {
  return key === alreadyNarrated
    ? { parts: optionNarration(t, view, cursor, indexOn), narrated: key }
    : { parts: questionNarration(t, view, indexOn), narrated: key };
}

/* ===================================== THE BAR ===================================== */

/** The bar of a skill not answered yet in this sitting: empty, it fills as she answers. */
const NO_BAR: Pick<Bar, 'segmentos' | 'cor'> = { segmentos: [], cor: 'nenhuma' };

/** Named first when a position has more than one key: an arrow, then Space — keys a child finds by their name. */
const KEYS_NAMED_FIRST: readonly string[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

/** The one key said for a position, or `null` when the scheme gives it none: a sentence never names a key she lacks. */
function keyToSay(codes: readonly string[] | null | undefined): string | null {
  if (!codes?.length) return null;
  return codes.find((c) => KEYS_NAMED_FIRST.includes(c)) ?? codes[0]!;
}

/**
 * THE WELCOME LINE, WITH THE KEYS THIS CHILD HAS: the ones on `up` and `down` to choose, the one on `action2` to answer.
 *
 * 🔴 A fixed sentence here named Enter, which is `start` and opens the pause; and any fixed sentence is wrong for the child
 * who remapped. So the keys come from her scheme (`engine.keyboard.kbFor(0)`) and cross as `{params}` — the frame is the
 * dictionary's, the key names are `ui/control-choices.keyName`'s. One key per position keeps the line short.
 */
export function welcomeText(t: Translate, scheme: Pick<KeyScheme, 'up' | 'down' | 'action2'>, name: (code: string) => string): string {
  const [up, down, responder] = [scheme.up, scheme.down, scheme.action2].map((codes) => {
    const code = keyToSay(codes);
    return code ? name(code) : null;
  });
  // One of the two is enough to reach every item: up and down walk every column, and wrap (`gridStep`).
  const mover = up && down ? t('sr.quiz.teclas.duas', { a: up, b: down }) : (up ?? down);
  if (mover && responder) return t('sr.quiz.bemVindo', { mover, responder });
  if (mover) return t('sr.quiz.bemVindo.soEscolher', { mover });
  if (responder) return t('sr.quiz.bemVindo.soResponder', { responder });
  return t('sr.quiz.bemVindo.semTeclas');
}

/* ===================================== THE ROUND ===================================== */

/**
 * THE PAGE THE QUIZ BOOTS IN — its document and window, handed over by the page (`app/quiz.html`, an inline module script).
 *
 * 🔴 ADR-0232 D4: the quiz booted itself at import, reading the global `document`, and kept the round (question, cursor,
 * score, engine) in module-level bindings — so a second quiz on the page, or a second test file, shared one round. The page
 * is the host: it calls `bootQuiz({ doc: document, win: window })`, and everything the round holds lives in that call.
 */
export interface QuizHost {
  readonly doc: Document;
  readonly win: Window;
  /**
   * Who signs in deaf mode, lent to the engine (`EngineHost.interpreter`); absent, the engine's own — the free Libras player the
   * delivery carries (ADR-0234). A test's double.
   */
  readonly interpreter?: EngineHost['interpreter'];
  /** The skills to offer; absent, `QUIZ_SKILLS`. A test lends its own fixtures, so no gate depends on the data. */
  readonly skills?: readonly QuizSkill[];
}

/** Boot. The page calls it; a test calls it over the page it built. Returns the engine it mounted. */
export function bootQuiz({ doc, win, interpreter, skills = QUIZ_SKILLS }: QuizHost): Engine {
  const ordered = skillsInOrder(skills);
  const rows = skillRows(ordered);
  let screen: 'start' | 'question' = 'start';
  /** The skill under the start screen's cursor — and, once confirmed, the skill being played. */
  let chosen = 0;
  /** The option under the question screen's cursor. */
  let cursor = 0;
  let attempts: Attempts = FIRST_ATTEMPT;
  /** Between a right answer and the next question: a second confirm does not answer a question she has not seen. */
  let settling = false;
  /** Where each skill's round stands — the question and the pass — so going back and in again goes on from there. */
  const places = new Map<number, { readonly question: number; readonly pass: number }>();
  /** Each skill's results and bar, THIS PAGE ONLY: nothing is stored anywhere (ADR-0103). */
  const readings = new Map<number, SkillReading>();
  /** What was last narrated whole — the start screen, or a question — see `narrationOnDraw`. */
  let narrated = '';
  let motor: Engine | null = null;
  /**
   * ANSWERING BY SPEAKING (ADR-0256) — on action 1 the child says one of the options shown, and this quiz receives WHICH ONE.
   *
   * 📌 It is the whole cartridge side of it, and it is meant to be read as such: `choose()` with the options as shown, the index
   * back. No microphone, no model, no language, no path — the engine's business.
   *
   * ⚠️ NOTHING IS SPOKEN WHILE THE MICROPHONE IS OPEN. The statement is REPLACED by the line on screen instead of narrated,
   * because the engine's own voice would be recorded as if the child had said it.
   * ⚠️ And no reading is asked for with a ceiling of its own: how long a child takes to BEGIN is not something a quiz knows,
   * and a game that shortened it would cut the children this exists for.
   */
  let listening = false;
  /**
   * THE QUIZ'S OWN SENTENCES, in its engine's language: the handle's `t` (ADR-0232 D3), and not `core/i18n` by import.
   *
   * 📌 LATE-BOUND because the handle exists only after `createGame` returns; nothing reads it before (the first draw waits on
   * `localeReady`). The quiz's sentences are KEYS of its own dictionary (`quiz-words`), resolved at each use (ADR-0232 D3).
   */
  const translate: Translate = (key, params) => (motor ? motor.t(key, params) : key);
  const locale = (): string => (motor ? motor.locale() : 'pt');
  const indexOn = (): boolean => (motor ? motor.menuIndexOn() : DEFAULTS.menuIndexOn);
  /**
   * The quiz's announcements go through ITS ENGINE's announcer (ADR-0232 D4) — the same regions, and the same Libras mirror
   * if the page connects one. Nothing is announced before the engine exists.
   */
  const alert = (text: string): void => { motor?.alert(text); };
  const say = (text: string): void => { motor?.say(text); };
  /**
   * 🔴 THE ONE PLACE NARRATION LEAVES THE QUIZ (ADR-0243). Every narration is built as parts — frame without a language,
   * content with its own — and handed to the engine AS PARTS: an English word in a Portuguese question is read by an English
   * voice, and a language the device has no voice for is said to be missing instead of read in the wrong accent.
   */
  const speak = (parts: readonly SpokenPart[]): void => {
    if (joinParts(parts).trim()) motor?.tts.narrate(parts);
  };

  const $ = <T extends Element = Element>(sel: string): T | null => doc.querySelector<T>(sel);
  const place = (): { readonly question: number; readonly pass: number } => places.get(chosen) ?? { question: 0, pass: 0 };
  const skillNow = (): QuizSkill | undefined => ordered[chosen];
  const questionNow = (): QuizQuestion | undefined => skillNow()?.questions[place().question];
  const skillKey = (i: number): string => ordered[i]?.code ?? `skill-${i + 1}`;
  const viewNow = (): QuestionView | null => {
    const s = skillNow();
    const q = questionNow();
    return s && q ? questionView(translate, s, q, place().pass, attempts, locale()) : null;
  };

  /**
   * ⚠️ O FOCO SÓ VOLTA PARA A TELA SE A CRIANÇA JÁ ESTAVA NELA. O `focus()` existe para o teclado seguir o cursor; mas um
   * desenho pode acontecer por um motivo que não é dela — trocar o idioma redesenha a atividade (ADR-0225). 📏 Medido: com um
   * painel de ajustes aberto, o redesenho arrancava o foco do painel e punha-o numa alternativa por trás do véu.
   * 📌 Um redesenho não move o cursor de quem está noutro sítio. `body` e ninguém contam como «não está noutro sítio».
   */
  function focusCursor(app: HTMLElement, selector: string): void {
    const outsideQuiz = doc.activeElement && doc.activeElement !== doc.body && !app.contains(doc.activeElement);
    const alvo = app.querySelector<HTMLElement>(selector);
    if (alvo && !outsideQuiz) alvo.focus();
  }

  /** The start screen: the skills by code, the one under the cursor explained in the footer and said with its place. */
  function drawStart(app: HTMLElement, voice: boolean): void {
    app.innerHTML = startHtml(translate, ordered, locale(), chosen);
    const s = ordered[chosen];
    // the explanation follows the cursor AND the language: this draw runs on both (ADR-0244 §1)
    motor?.explain(s ? skillExplanation(translate, s, locale()) : null);
    if (voice) {
      const item = skillNarration(translate, ordered, chosen, locale(), indexOn());
      speak(narrated === 'start' ? item : [part(`${translate('quiz.start.title')}. `), ...item]);
      narrated = 'start';
    }
    app.querySelectorAll<HTMLButtonElement>('button[data-skill]').forEach((b) => {
      b.addEventListener('click', () => { chosen = Number(b.dataset.skill); openSkill(); });
    });
    focusCursor(app, `button[data-skill="${chosen}"]`);
  }

  /** The question screen: the statement, the explanation or the copy line when there is one, and the five options. */
  function drawQuestion(app: HTMLElement, voice: boolean): void {
    const view = viewNow();
    if (!view) return;
    app.innerHTML = questionHtml(translate, view, cursor);
    if (voice) {
      // a narração é do consumidor: a engine só empresta a voz
      const said = narrationOnDraw(translate, view, `${chosen}:${place().question}:${place().pass}`, cursor, narrated, indexOn());
      narrated = said.narrated;
      speak(said.parts);
    }
    app.querySelectorAll<HTMLButtonElement>('button[data-alt]').forEach((b) => {
      b.addEventListener('click', () => answer(Number(b.dataset.alt)));
    });
    focusCursor(app, `button[data-alt="${cursor}"]`);
  }

  /** Draws the screen that is open. `voice` false: a redraw after an answer, whose words the answer already said. */
  function render(voice = true): void {
    const app = $<HTMLElement>('#quiz-app');
    if (!app) return;
    if (screen === 'start') drawStart(app, voice);
    else drawQuestion(app, voice);
  }

  /**
   * 🔴 WHAT HAS THE FOCUS IS WHAT SPACE ANSWERS (ADR-0111 erratum of 2026-09-26). Tab, or a screen reader moving the focus with
   * its own cursor, put the focus on an item and left the quiz's cursor behind. So the cursor follows the focus, and
   * `aria-checked` moves with it; on the start screen the footer's explanation follows it too (ADR-0244).
   * 📌 No redraw: the focus is already where it should be, and a redraw would re-focus it and narrate the item again over
   * the screen reader, which has just announced it.
   */
  function cursorFollowsFocus(e: FocusEvent): void {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('#quiz-app button[data-alt], #quiz-app button[data-skill]');
    if (el?.dataset.skill !== undefined) skillFollowsFocus(el, Number(el.dataset.skill));
    else if (el) optionFollowsFocus(el, Number(el.dataset.alt));
  }
  function optionFollowsFocus(el: HTMLElement, i: number): void {
    if (i === cursor) return;
    cursor = i;
    el.parentElement?.querySelectorAll<HTMLElement>('button[data-alt]').forEach((b) => {
      const on = b === el;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
  }
  function skillFollowsFocus(el: HTMLElement, i: number): void {
    if (i === chosen) return;
    chosen = i;
    // every group's buttons: the start screen has one cursor over both
    $<HTMLElement>('#quiz-app')?.querySelectorAll<HTMLElement>('button[data-skill]').forEach((b) => {
      const on = b === el;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    const s = ordered[chosen];
    if (s) motor?.explain(skillExplanation(translate, s, locale()));
  }
  $<HTMLElement>('#quiz-app')?.addEventListener('focusin', cursorFollowsFocus);

  /** Puts a line where the statement is — the same box, so nothing below it moves — and gives the question back after it is read. */
  function sayInStatement(line: string, backToStatement = true): void {
    const h2 = $<HTMLElement>('#quiz-app .quiz-pergunta');
    if (h2) h2.textContent = line;
    alert(line);
    // The engine already knows how long a line stays on screen: 500 ms a word, never under 2600 ms (`core/caption-duration`).
    if (backToStatement) win.setTimeout(() => { if (!listening && screen === 'question') render(false); }, captionDuration(line, 125));
  }

  async function listenForAnswer(): Promise<void> {
    const view = viewNow();
    if (!motor || !view || listening) return; // asked for on the question screen only (`ON_BUTTON.action1`)
    listening = true;
    sayInStatement(translate('quiz.ouvindo'), false);
    try {
      // 📌 THE OPTIONS AS SHOWN, and the engine hears only those (ADR-0256): an option is one or two words, which a closed grammar
      // hears and a free transcription invents. The answer is which one — never text to compare.
      const heard = await motor.reading.choose(view.options.map((o) => o.text));
      listening = false;
      answerByChoice(heard.chosen, heard.heard);
    } catch {
      // A reading that refuses says why in `problems`; what the child needs here is a way to go on, which is the arrows —
      // unless she has already left the question («Sair do jogo» stops the microphone, `onPhase`).
      listening = false;
      if (screen === 'question') sayInStatement(translate('quiz.semLeitura'));
    }
  }

  /** The option she said, as an answer — or nothing at all when she left the question while it listened («Sair do jogo», `onPhase`). */
  function answerByChoice(chosenOption: number | null, text: string): void {
    if (screen !== 'question') return;
    if (chosenOption !== null) { render(false); answer(chosenOption); return; }
    const said = text.trim();
    sayInStatement(said ? translate('quiz.notAnOption', { heard: said }) : translate('quiz.ouviNada'));
  }

  /** A result lands on the open skill's bar. */
  function record(result: ResultadoDaQuestao): void {
    readings.set(chosen, withResult(skillKey(chosen), readings.get(chosen), result));
  }

  /** On to the next question of the skill; after the third, the first again with the options one place round. */
  function nextQuestion(): void {
    const s = skillNow();
    if (!s) return;
    const at = place();
    const question = at.question + 1;
    places.set(chosen, question < s.questions.length ? { question, pass: at.pass } : { question: 0, pass: at.pass + 1 });
    attempts = FIRST_ATTEMPT;
    cursor = 0;
    if (screen === 'question') render();
  }

  function answer(i: number): void {
    const view = viewNow();
    const q = questionNow();
    if (screen !== 'question' || settling || !view || !q) return;
    const correct = rotated(q.options, q.correct, place().pass).correct;
    const option = (k: number): string => view.options[k]?.text ?? '';
    const outcome = attempt(attempts, i, correct, view.options.length);
    if (outcome.kind === 'refused') alert(translate('quiz.tried', { option: option(i) }));
    else if (outcome.kind === 'right') answeredRight(outcome, option(correct));
    else {
      attempts = outcome.next;
      answeredWrong(outcome.kind, q, option(i), correct, option(correct));
      render(false);
    }
  }

  /** Right: the result lands on the bar — the copy turns it orange at once — and the next question comes after the answer is read. */
  function answeredRight(outcome: Extract<AttemptOutcome, { kind: 'right' }>, right: string): void {
    if (outcome.result) record(outcome.result);
    const reading = readings.get(chosen);
    if (outcome.copied && reading) readings.set(chosen, afterCopying(skillKey(chosen), reading));
    alert(translate(outcome.copied ? 'quiz.copied' : 'quiz.right', { answer: right }));
    settling = true;
    win.setTimeout(() => { settling = false; nextQuestion(); }, 900); // deixa o anúncio ser lido antes de a tela mudar
  }

  /** Wrong: the option goes off; the third fails the question and explains it; the sixth marks the answer to copy. */
  function answeredWrong(kind: 'wrong' | 'failed' | 'copy', q: QuizQuestion, tried: string, correct: number, right: string): void {
    if (kind === 'wrong') { alert(translate('quiz.wrong', { option: tried })); return; }
    if (kind === 'copy') {
      cursor = correct;
      alert(translate('quiz.copy', { answer: right }));
      return;
    }
    // the third wrong attempt: the question counts as failed (red), and the explanation is shown and read (ADR-0049 §6)
    record(resultadoDaQuestao(null));
    const explanation = inLanguage(q.explanation, locale());
    alert(translate('quiz.explained', { explanation }));
    speak([part(explanation)]);
  }
  function openSkill(): void {
    if (!ordered[chosen] || !motor) return;
    screen = 'question';
    attempts = FIRST_ATTEMPT;
    cursor = 0;
    narrated = '';
    motor.scenes.replace(questionScene);
    motor.scenes.draw();
  }

  function backToStart(): void {
    if (!motor) return;
    screen = 'start';
    narrated = '';
    motor.scenes.replace(startScene);
    motor.scenes.draw();
  }

  /**
   * «SAIR DO JOGO» IS THIS QUIZ'S START SCREEN (interface log 2026-09-26; the Dev: «eu deveria ir para a tela de seleção de
   * habilidades, a primeira do jogo»). The engine hides its card and asks for `'title'` (ADR-0144 §5 erratum); `'playing'` and
   * `'paused'` change nothing here — the quiz has no world to freeze or unfreeze. An open microphone is given back first: she
   * left, and nothing she says on the start screen is an answer.
   */
  function onPhase(phase: 'title' | 'playing' | 'paused'): void {
    if (phase !== 'title') return;
    if (listening) motor?.reading.stop();
    backToStart();
  }

  /** Moves the cursor of the screen that is open, over its grid. */
  const move = (m: Move) => (): void => {
    if (screen === 'start') chosen = gridStep(rows, chosen, m);
    else cursor = gridStep(gridRows(viewNow()?.options.length ?? 0, OPTION_COLUMNS), cursor, m);
    render();
  };

  /**
   * WHAT THE QUIZ EXECUTES FOR EACH VIRTUAL BUTTON (ADR-0111 and its erratum; issue #197): the engine takes the hardware — the keyboard by
   * the child's scheme, the eyes, any transport — and carries the button's virtual name here; this is the quiz's map, the same one its
   * `preset` names. ⚠️ It used to read raw key codes: its own arrows worked, the scheme's W and S did not, S rang the sonar, and a transport
   * could only reach it by disguising itself as a keyboard.
   */
  const ON_BUTTON: Partial<Record<VirtualCommand['action'], () => void>> = {
    up: move('up'),
    down: move('down'),
    left: move('left'),
    right: move('right'),
    // CONFIRMAR passa pela PILHA (item 22, C3): a cena do topo decide o que a intenção significa e devolve se consumiu.
    action2: () => { motor?.scenes.input('confirm'); },
    // SPEAKING THE ANSWER, on the question screen.
    action1: () => { if (screen === 'question') void listenForAnswer(); },
    // BACK: the microphone first — a child who changed her mind should not wait out the ceiling with it open —, then the start screen.
    action3: () => {
      if (listening) { motor?.reading.stop(); return; }
      if (screen === 'question') backToStart();
    },
    // THE SONAR on R1 (the Dev, 2026-09-16: «Tecla padrão para o sonar deve ser R1»). Its words are what is on screen now, read by
    // the engine (ADR-0234); its tone points from the QUESTION (or the skill), never the option under the cursor: pointing at the
    // right option would be cheating.
    rightShoulder: () => { motor?.sonar.sonar({ i: 0, x: screen === 'start' ? chosen : place().question, y: 0 }); },
  };

  /** A button with no row does nothing in this quiz; only a PRESS counts — a release is not a second press. */
  function handleCommand(cmd: VirtualCommand): void {
    if (!cmd.pressed) return;
    ON_BUTTON[cmd.action]?.();
  }

  // A PILHA DE CENAS (item 22, C3): uma cena por tela, trocadas com `replace` — a de baixo não se desenha por baixo da de cima.
  const startScene: Scene = {
    name: 'skills',
    draw: () => render(),
    input: (intent) => {
      if (intent !== 'confirm') return false;
      openSkill();
      return true;
    },
    // leaving the start screen takes its explanation out of the footer (ADR-0244: a text left there would explain nothing)
    exit: () => { motor?.explain(null); },
  };
  const questionScene: Scene = {
    name: 'perguntas',
    draw: () => render(),
    input: (intent) => {
      if (intent !== 'confirm') return false;
      answer(cursor);
      return true;
    },
  };

  // A ENGINE INTEIRA, numa chamada. Antes eram nove inicializações à mão nesta função, em ordem que só o
  // achado 3 revelava — e o consumidor tinha de acertá-la sozinho. O que sobrou aqui embaixo é o que é
  // realmente DESTE jogo: as telas, as tentativas e a barra.
  const engine = createGame({
    declaration: declareQuiz({
      order: () => (screen === 'start' ? ordered.map((_, i) => skillKey(i)) : (skillNow()?.questions ?? []).map((_, i) => `q${i + 1}`)),
      current: () => (screen === 'start' ? chosen : place().question),
      cursor: () => (screen === 'start' ? 0 : cursor),
      nameAt: (x) => {
        if (screen === 'start') { const s = ordered[x]; return s ? { text: skillLabel(s, locale()), gender: 'f', plural: false } : null; }
        return skillNow()?.questions[x] ? { text: translate('quiz.name.question', { n: x + 1 }), gender: 'f', plural: false } : null;
      },
      objective: () => (screen === 'start'
        ? { name: { text: translate('quiz.name.skill'), gender: 'f', plural: false }, have: 0, need: 1 }
        : { name: { text: translate('quiz.name.questions'), gender: 'f', plural: true }, have: place().question, need: skillNow()?.questions.length ?? 0 }),
      targets: () => (screen === 'question' ? [{ x: place().question, y: 0 }] : []),
    }),
    host: {
      doc, win, cvdHost: $<SVGElement>('#q-cvd'),
      interpreter,
    },
    // Um quiz não tem ator de pausa. Declarado, e não deduzido de getters que devolvem null — ver o achado 10 e o
    // cabeçalho do `boot/create-game`. (O assistente de mapear controle não se declina: ADR-0231.)
    // ⚠️ O `semMenuDePausa` SAIU daqui em 2026-09-09 (ADR-0120), e este jogo é o motivo de ele ter existido:
    // era o quiz que «não tinha pausa». Passou a ter — a engine monta o cartão e ele só oferece o que este
    // jogo acciona. Um botão a menos para uma criança encontrar é um ajuste a menos que ela alcança.
    declines: { noPauseActor: true },
    // THIS GAME READS TO THE CHILD (ADR-0216 §3): one line, and the engine loads the voice from the delivery when she picks it.
    // 📌 It used to be the ~200 lines of `kokoro-porta`/`kokoro-carregar` — the phonemizer, the runtime and the paths — which every
    // game that wanted a voice would have copied. They moved into the engine and were deleted here.
    // 📌 NO READING IS DECLARED, and that is the answer, not an omission (ADR-0256): this quiz hears the child CHOOSE an option,
    // which `motor.reading.choose()` hears with the command models every delivery carries. Declaring the reading would put 850 MiB
    // of reading models into every delivery and every device for a transcription this game never asks for.
    uses: { neuralVoice: true },
    // Os ajustes deste jogo estão SEMPRE disponíveis; ele não precisa se declarar "pausado" para navegá-los.
    isNavigable: () => true,
    // the pause card's «Sair do jogo» asks for `'title'`: this quiz's start screen (`onPhase`)
    setPhase: onPhase,
    /*
     * THE WORDS THIS QUIZ DECLARES live in its own dictionary, one per language (ADR-0232 D3): every `…Key` below is a key of
     * these, and a key they lack would be a line of `problems`, never a key on screen.
     */
    dictionaries: QUIZ_DICTIONARIES,
    /*
     * THE ZPD BAR (ADR-0049 §5, ADR-0239: bottom left): ONE learning band, the bar of the skill open — or under the start
     * screen's cursor, where the footer's explanation covers the row anyway. Read on every frame, from memory (ADR-0103).
     */
    hud: [{ band: 'learning', nameKey: 'quiz.hud.skill', value: () => readings.get(chosen)?.bar ?? NO_BAR }],
    /*
     * HOW TO PLAY THIS QUIZ (ADR-0195): the cartridge tells it, the engine's help shows it before the buttons. The figures are drawn
     * here from shapes — a question bar and five options — and the second one moves the marked option, which is the game.
     */
    onCommand: handleCommand,
    howToPlay: [
      {
        textKey: 'quiz.comoJogar.ler',
        figure: ({ ctx, width, height }) => drawQuizFigure(ctx, width, height, -1),
      },
      {
        textKey: 'quiz.comoJogar.escolher',
        figure: ({ ctx, width, height, time }) => drawQuizFigure(ctx, width, height, Math.floor(time / 0.9) % 5),
      },
    ],
    /*
     * AS POSIÇÕES QUE ESTE JOGO USA (ADR-0162): as quatro setas andam na grade (a das habilidades, a das alternativas), a acção 2
     * confirma e a 3 volta à tela das habilidades — on the keyboard and a gamepad, and in the help screen. ⚠️ Since ADR-0166 they
     * draw no on-screen pad: this quiz does not ask for one (`controleNaTela` absent), because its options are touched directly.
     * 📌 KEYS, not words: the engine resolves them at every drawing, so a language change reaches them (ADR-0232 D3).
     */
    preset: {
      up: { labelKey: 'quiz.pos.up' },
      down: { labelKey: 'quiz.pos.down' },
      left: { labelKey: 'quiz.pos.left' },
      right: { labelKey: 'quiz.pos.right' },
      action2: { labelKey: 'quiz.pos.confirm' },
      action1: { labelKey: 'quiz.pos.falar' },
      action3: { labelKey: 'quiz.pos.back' },
      rightShoulder: { labelKey: 'quiz.pos.sonar' },
    },
    /*
     * AS ACOMODAÇÕES QUE TÊM ASSUNTO NESTE JOGO (ADR-0153) — a resposta é obrigatória, e o arranque recusa sem ela.
     *
     * 📌 Pelo estudo das acomodações: um jogo de perguntas é género «trivia» (Wikipédia 10.11) e o TEXTO É A
     * MATÉRIA — logo dicas, ritmo do texto, dificuldade das palavras e realce de palavras têm assunto aqui. Não há
     * personagem, câmara, peças, bengala, detecção, sustos nem janela de acerto: as outras doze são «não», escritas.
     *
     * 📌 KEYS, like the preset's: the engine resolves them when a row shows them. No row shows these yet.
     */
    accommodations: {
      cameraSway: false, easyMode: false, wheelchairMode: false, detectionLeniency: false, intensity: false,
      hints: { labelKey: 'quiz.acom.hints' },
      reducedCharacterMotion: false, caneSpacing: false,
      textPace: { labelKey: 'quiz.acom.textPace' },
      lexicalDifficulty: { labelKey: 'quiz.acom.lexicalDifficulty' },
      wordHighlight: { labelKey: 'quiz.acom.wordHighlight' },
      pieceSets: false, distinguishableSuits: false, timingWindow: false, aimAssist: false, repeatedInput: false,
      ownerColors: false, contrastOutlines: false,
    },
  });
  motor = engine;
  // O que o hospedeiro não entregou vira lista legível em vez de painel vazio (achado 6). Num jogo de
  // verdade isto iria para a tela; aqui basta o console, porque o instrumento é lido por quem desenvolve.
  if (engine.problems.length) console.warn('[quiz] what the host lacks:', engine.problems);

  // 📌 A key the engine carries to this quiz does not also press the focused option: the ENGINE cancels the default of a key it
  // delivered (ADR-0111 erratum of 2026-09-26). The quiz's own guard for that left with it — two cancellers are two answers.

  // 🔴 O PAINEL DE TIPOGRAFIA E O SELETOR DE VISÃO DESTE JOGO SAÍRAM (2026-09-12). Desenhavam um botão e uma lista na
  // zona do rodapé, que é da explicação (`CLAUDE.md` §4), e repetiam a barra rápida: a letra muda pelo ciclo de
  // comunicação e a correcção de cor pelo 🚥 (ADR-0151). Os achados 5 e 7 que eles provavam ficam no git: a engine
  // passou a montar e a ligar as duas coisas sozinha, que era o que eles pediam.

  // ⚠️ O `motor.nav.attach()` SAIU DAQUI (issue #109). Era um remendo do consumidor: a engine montava a
  // navegação de menu e não a ligava, então este quiz tinha de a ligar à mão logo depois do `createGame` — e
  // um jogo que não soubesse disso ganhava diálogos que só respondem ao rato. `createGame` liga agora, e o
  // segundo consumidor deixa de carregar a correção do primeiro.

  // A PILHA DE CENAS (item 22, C3): a tela das habilidades e a das perguntas são duas cenas que se trocam no topo. A forma
  // (`name`/`draw`/`input`/`exit`) cabe num jogo que NÃO tem fases — sem `title`, sem `paused`, sem nada do enum da plataforma.
  engine.scenes.push(startScene);

  // MODO PESSOA SURDA — ⚠️ ESTE BLOCO SAIU, e a ausência é o conserto (ADR-0106): o ícone 🦻 da barra que o `createGame`
  // monta faz as quatro coisas que ele fazia, e mantê-lo seria o anúncio duplo que este repositório já pagou (`ba355f3`).

  // TOUCH TARGETS are the engine's since ADR-0163: the options read `--alvo-min`, which `createGame` writes from the
  // resolution it forces. THE TOUCH DOOR TO THE MENUS is the quick bar's ☰ (interface log 2026-09-16).

  // The first draw and the welcome wait for the boot language (study item E4): drawn in the gap, the first screen was
  // read in Portuguese on an English page (measured). For pt it resolves at once.
  void engine.localeReady().then(() => {
    engine.scenes.draw(); // quem desenha é a pilha, que é quem sabe o que está no topo
    say(welcomeText(translate, engine.keyboard.kbFor(0), (code) => keyName(translate, code)));
  });

  /*
   * 🔴 A ATIVIDADE REDESENHA-SE AO TROCAR DE IDIOMA (ADR-0225), e a explicação do rodapé com ela: o desenho da tela inicial
   * volta a chamar `explain` no idioma novo. Quem avisa é a ENGINE, não a janela (ADR-0216).
   */
  engine.onLocaleChange(() => { engine.scenes.draw(); });
  return engine;
}

/** What the declaration reads of the round, screen by screen. */
interface QuizRound {
  /** The hotspots of the screen now: the skills on the start screen, the skill's questions on the question screen. */
  readonly order: () => readonly string[];
  /** The hotspot now: the skill under the cursor, or the question being answered. */
  readonly current: () => number;
  /** The option under the cursor (0 on the start screen, where the hotspot IS the cursor). */
  readonly cursor: () => number;
  readonly nameAt: (x: number) => Speakable | null;
  readonly objective: () => Objective;
  readonly targets: () => readonly Spot[];
}

/**
 * A DECLARAÇÃO DESTE JOGO — os sete campos do `core/contract` (ADR-0030).
 *
 * Um quiz é o caso extremo de propósito: SEM ESPAÇO NENHUM, só ordem. A topologia é `hotspots`, a distância é
 * diferença de índice, e o turno é do JOGADOR — o tempo não pressiona, que é o que a WCAG 2.2.1 pede e o que
 * separa este gênero da plataforma sem uma linha de condicional na engine.
 *
 * 📌 TWO SCREENS, ONE DECLARATION: every field is a function, so it answers for the screen that is open — on the start screen
 * the hotspots are the skills and nothing counts yet (choosing one is the objective); on the question screen they are the
 * skill's three questions and the one being answered is the target.
 */
function declareQuiz(round: QuizRound): GameDeclaration {
  return {
    topology: () => ({ kind: 'hotspots', order: round.order() }),
    // ⚠️ O MUNDO DESTE JOGO É DOM, e é exatamente o caso que o campo existe para consertar: uma simulação de cegueira sobre
    // uma canvas que ninguém vê deixaria as alternativas legíveis — a simulação ao contrário. Ver o bloco 8 de `core/contract`.
    world: () => ({ kind: 'element', selector: '#game-region' }),
    // ⚠️ UM. Um quiz nunca pede dois dedos ao mesmo tempo: o jogo que declara 1 fica jogável em QUALQUER transporte, incluindo
    // os de olhar, de sopro e de um acionador só.
    holdsAtOnce: () => 1,
    // 🔴 FALSO: escolher uma alternativa é tocar e largar. O `1` acima está lá porque o contrato recusa zero (ADR-0115).
    holdsKeys: () => false,
    tick: 'player',
    // Papel: o ponto corrente é o OBJETIVO; os outros são passagem livre. Sem tile, sem lava.
    roleAt: (at) => (at.x === round.current() ? 'goal' : 'free'),
    // The target's name, for the navigation sentence. ⚠️ This DOM quiz never says it: with text on screen the sonar reads
    // the screen at every press (ADR-0234); the name is heard only where the engine cannot read the screen.
    nameAt: (at) => round.nameAt(at.x),
    // O foco é o do teclado: qual item está sob o cursor. Sem corpo, sem `facing` — daí `heading:'none'`.
    focusOf: () => ({ id: 'p0', at: { x: round.current(), y: round.cursor() }, heading: 'none' }),
    // ESTE É O CAMPO QUE APOSENTA O `coinTarget`: o alvo é «perguntas desta volta» (ou «uma habilidade», na tela inicial), e a
    // engine não sabe (nem precisa saber) o que é uma moeda para montar a mesma frase de progresso.
    objectiveOf: () => round.objective(),
    // A segunda metade do campo 5: ONDE está o que ainda conta — a pergunta corrente; na tela inicial, nada ainda.
    targetsOf: () => round.targets(),
  };
}

/** The quiz drawn small, for its «how to play» slides: the question bar and five options in three columns, `marked` outlined (−1: none). */
function drawQuizFigure(ctx: CanvasRenderingContext2D, w: number, h: number, marked: number): void {
  const m = Math.round(h * 0.06);
  const barHeight = Math.round(h * 0.16);
  ctx.fillStyle = '#eaf2f8';
  ctx.fillRect(m, m, w - 2 * m, barHeight);
  const height = Math.floor((h - 3 * m - barHeight - 3 * m) / 2);
  const width = Math.floor((w - 8 * m) / OPTION_COLUMNS);
  for (let i = 0; i < 5; i++) {
    // the same order as the screen: «1 2 3» over «4 5» (`gridRows`)
    const x = m * 3 + (i % OPTION_COLUMNS) * (width + m);
    const y = 2 * m + barHeight + Math.floor(i / OPTION_COLUMNS) * (height + m);
    ctx.fillStyle = '#3a4a6a'; // lighter than the slide's own #1a2740, or the options vanish into it
    ctx.fillRect(x, y, width, height);
    if (i === marked) {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = Math.max(2, Math.round(m / 2));
      ctx.strokeRect(x, y, width, height);
    }
  }
}
