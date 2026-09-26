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
//     Provado: com `setPhaseValue('paused')`, `S` desce atkinson→lexend→quattro e `W` volta, pelo esquema de
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
import { escapeHtml } from '../core/escape-html.js'; // #106: enunciado e alternativas sao TEXTO
import type { Translate } from '../core/i18n.js';
import { captionDuration } from '../core/caption-duration.js';
import { DEFAULTS } from '../core/setting-defaults.js';
import { announceItem } from '../ui/item-announcement.js';
import { createGame, type Engine, type EngineHost, type VirtualCommand } from '../boot/create-game.js';
import { createLibrasAvatarInterpreter } from '../ui/libras-avatar-player.js';
import { QUIZ_DICTIONARIES } from './quiz-words.js';
import type { GameDeclaration } from '../core/contract.js';

/** Uma pergunta. Dado puro, do JOGO — o consumidor traz o seu conteúdo, como qualquer jogo deve trazer. */
interface Question {
  readonly enunciado: string;
  readonly alternativas: readonly string[];
  readonly certa: number;
}

/*
 * 🔴 AS PERGUNTAS SÃO CHAVES, E NÃO FRASES — e antes de 23/09 eram frases cravadas em pt-BR. 📏 Medido no `dist`:
 * trocar a bandeira levava o `<html lang>`, o rodapé e a moldura inteira da engine para o idioma novo e deixava o
 * ENUNCIADO e as alternativas em português; a página chegava a abrir com `lang="en-US"` a mostrar uma pergunta em
 * português. É o ADR-0225 pela metade: a engine seguia, a ATIVIDADE não.
 *
 * 📌 E o quiz não é uma disciplina de idioma, logo não há sequer a excepção do `CLAUDE.md` §A FRONTEIRA: «o
 * ENUNCIADO SEMPRE TRADUZ». Guardar a frase aqui é guardar uma língua; guardar a chave deixa a frase onde as três
 * línguas vivem juntas e onde o crivo dos dicionários as confere.
 */
const QUESTIONS: readonly Question[] = [
  { enunciado: 'quiz.p1', alternativas: ['quiz.p1.a', 'quiz.p1.b', 'quiz.p1.c', 'quiz.p1.d'], certa: 1 },
  { enunciado: 'quiz.p2', alternativas: ['quiz.p2.a', 'quiz.p2.b', 'quiz.p2.c', 'quiz.p2.d'], certa: 0 },
  { enunciado: 'quiz.p3', alternativas: ['quiz.p3.a', 'quiz.p3.b', 'quiz.p3.c', 'quiz.p3.d'], certa: 2 },
];

/** Marcação de uma pergunta. Pura: recebe estado, devolve texto — testável sem DOM. */
export function questionHtml(t: Translate, p: Question, selecionada: number): string {
  // O enunciado e as alternativas são CHAVES: resolvem-se no instante de desenhar, e é isso que faz a troca de
  // idioma alcançar a atividade e não só a moldura (ADR-0225).
  const alts = p.alternativas.map((a, i) =>
    `<button class="mode-btn quiz-alt${i === selecionada ? ' is-on' : ''}" data-alt="${i}" type="button"` +
    ` role="radio" aria-checked="${i === selecionada}">${escapeHtml(t(a))}</button>`).join('');
  return (
    `<h2 class="quiz-pergunta">${escapeHtml(t(p.enunciado))}</h2>` +
    `<div class="quiz-alts" role="radiogroup" aria-label="${escapeHtml(t('quiz.alternativas'))}">${alts}</div>`
  );
}

/** O próximo índice do foco, com as pontas dando a volta. Puro — é a regra que o teclado e o pad compartilham. */
export function nextFocus(currentIdx: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return ((currentIdx + delta) % total + total) % total;
}

/**
 * WHAT THE VOICE SAYS WHEN A QUESTION OPENS: the statement, then every option (ADR-0158 rule 3), each with its PLACE
 * after its name (ADR-0167) — «Gato, 1 de 4. Galinha, 2 de 4. …».
 *
 * A question is not answerable by ear until its options are heard. The place is said the way every menu item says it:
 * the Dev asked for «uma única função que capture a posição de item e a totalidade de itens», and it is the engine's.
 * `indexOn` is the child's choice of saying it, which the quiz page asks its engine for (`Engine.menuIndexOn()`, ADR-0232).
 */
export function questionNarration(t: Translate, p: Question, indexOn: boolean): string {
  const opcoes = p.alternativas.map((_, i) => spokenOption(t, p, i, indexOn)).join('. ');
  return opcoes ? `${t(p.enunciado)} ${opcoes}` : t(p.enunciado);
}

/** One option as it is said: its words, then its place — «Galinha, 2 de 4» (the index can be turned off, ADR-0044). */
function spokenOption(t: Translate, p: Question, i: number, indexOn: boolean): string {
  return announceItem(t, { label: t(p.alternativas[i] ?? ''), position: i + 1, total: p.alternativas.length }, indexOn);
}

/**
 * What to narrate on a draw, and which question has now been narrated.
 *
 * The whole question only when it OPENS; a draw on the same question is the cursor moving, and then only the option
 * under it is said. 🔴 Before this, every arrow press re-read the statement and never said which option was reached.
 */
export function narrationOnDraw(t: Translate, p: Question, question: number, focusIdx: number, alreadyNarrated: number, indexOn: boolean): { texto: string; narrada: number } {
  return question === alreadyNarrated
    ? { texto: spokenOption(t, p, focusIdx, indexOn), narrada: alreadyNarrated }
    : { texto: questionNarration(t, p, indexOn), narrada: question };
}

/**
 * THE WORDS OF A SENTENCE, as a comparison can use them: no case, no accents, no punctuation.
 *
 * A reading model writes what it hears the way a person writes — «Galinha.», «galinha», «GALINHA» — and a child who says
 * «é a galinha» said the answer. What is stripped here is everything that is not the word itself.
 */
function wordsOf(phrase: string): string[] {
  return phrase.normalize('NFD').replace(/[̀-ͯ]/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
}

/** Are these words, in this order, inside that sentence? Whole words — «dois» is not found inside «doisel». */
function containsTheWords(ditas: readonly string[], alvo: readonly string[]): boolean {
  if (!alvo.length || alvo.length > ditas.length) return false;
  for (let i = 0; i + alvo.length <= ditas.length; i++) {
    if (alvo.every((w, k) => ditas[i + k] === w)) return true;
  }
  return false;
}

/**
 * WHICH OPTION THE CHILD SAID, or nothing when the answer is not one of them.
 *
 * This is the whole of what the demo does with the reading (ADR-0216): it asks the engine to listen, receives TEXT, and the
 * rest is its own rule. Nothing here knows about a microphone, a model or a language.
 *
 * 🔴 TWO MATCHES IS NOT AN ANSWER, and that is why the count is kept instead of the first hit: a child who says «gato ou
 * galinha» is thinking out loud, and a quiz that picked one of them would answer FOR her — and mark it wrong.
 */
export function heardAlternative(heard: string, alternativas: readonly string[]): number | null {
  const ditas = wordsOf(heard);
  if (!ditas.length) return null;
  const found: number[] = [];
  alternativas.forEach((a, i) => { if (containsTheWords(ditas, wordsOf(a))) found.push(i); });
  return found.length === 1 ? found[0]! : null;
}

/**
 * O texto que o leitor de tela ouve ao responder. Separado do DOM porque é o que a criança cega RECEBE.
 * The frame is the dictionary's (study item E4): the right answer crosses as `{certa}`, the words around it translate.
 */
export function answerText(t: Translate, gotItRight: boolean, certa: string): string {
  return t(gotItRight ? 'quiz.resposta.certa' : 'quiz.resposta.errada', { certa });
}

/** The closing line — how many were right out of how many — in the child's language. */
export function endText(t: Translate, gotItRight: number, total: number): string {
  return t('quiz.fim', { n: gotItRight, m: total });
}

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
  /** Who signs in deaf mode, lent to the engine (`EngineHost.interpreter`); absent, the engine's own answer. A test's double. */
  readonly interpreter?: EngineHost['interpreter'];
  /**
   * Lend the engine the FREE Libras player (ADR-0234, route B, `ui/libras-avatar-player`) instead of leaving it the VLibras one
   * (route A, still the engine's default until phase B3). The page sets it from `?libras=avatar`, so the two can be compared in
   * one delivery built with `--libras --libras-avatar`. An `interpreter` given above wins.
   */
  readonly librasAvatar?: boolean;
}

/** Boot. The page calls it; a test calls it over the page it built. Returns the engine it mounted. */
export function bootQuiz({ doc, win, interpreter, librasAvatar = false }: QuizHost): Engine {
  let atual = 0;
  let foco = 0;
  let correctCount = 0;
  /** The question whose statement and options were last narrated — see `narrationOnDraw`. */
  let narratedQuestion = -1;
  let motor: Engine | null = null;
  /**
   * ANSWERING BY SPEAKING (ADR-0216, issue #200) — the child says an option out loud and this quiz receives the TEXT.
   *
   * 📌 It is the whole cartridge side of the reading port, and it is meant to be read as such: `uses: { reading: true }` below,
   * `listen()` here, a rule of its own on the words. No microphone, no model, no language, no path — the engine's business.
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
   * `localeReady`). The words the quiz DECLARES to `createGame` are not read through here: they are KEYS of its own
   * dictionary (`quiz-words`), and the engine resolves them each time it draws them (ADR-0232 D3, erratum of 2026-09-25).
   */
  const translate: Translate = (key, params) => (motor ? motor.t(key, params) : key);
  /**
   * The quiz's announcements go through ITS ENGINE's announcer (ADR-0232 D4) — the same regions, and the same Libras mirror
   * if the page connects one. Nothing is announced before the engine exists.
   */
  const alert = (text: string): void => { motor?.alert(text); };
  const say = (text: string): void => { motor?.say(text); };

  const $ = <T extends Element = Element>(sel: string): T | null => doc.querySelector<T>(sel);

  function render(): void {
    const app = $<HTMLElement>('#quiz-app');
    if (!app) return;
    const p = QUESTIONS[atual];
    if (!p) { app.innerHTML = `<h2 class="quiz-pergunta">${escapeHtml(endText(translate, correctCount, QUESTIONS.length))}</h2>`; return; }
    app.innerHTML = questionHtml(translate, p, foco);
    // a narração é do consumidor: a engine só empresta a voz
    // the «N de M» follows the child's choice, which the page asks its engine for — it reads no settings store (ADR-0232)
    const fala = narrationOnDraw(translate, p, atual, foco, narratedQuestion, motor ? motor.menuIndexOn() : DEFAULTS.menuIndexOn);
    narratedQuestion = fala.narrada;
    motor?.tts.narrate(fala.texto);
    app.querySelectorAll<HTMLButtonElement>('button[data-alt]').forEach((b) => {
      b.addEventListener('click', () => answer(Number(b.dataset.alt)));
    });
    /*
     * ⚠️ O FOCO SÓ VOLTA PARA A PERGUNTA SE A CRIANÇA JÁ ESTAVA NELA. Este `focus()` existe para o teclado seguir a
     * opção escolhida; mas um desenho pode acontecer por um motivo que não é dela — e desde 23/09 acontece: trocar o
     * idioma redesenha a atividade (ADR-0225). 📏 Medido: com um painel de ajustes aberto, o redesenho arrancava o
     * foco do painel e punha-o numa alternativa por trás do véu.
     *
     * 📌 É a mesma regra que a conversão dos painéis para nós ensinou, deste lado da fronteira: um redesenho não move
     * o cursor de quem está noutro sítio. `body` e ninguém contam como «não está noutro sítio».
     */
    const outsideQuiz = doc.activeElement
      && doc.activeElement !== doc.body
      && !app.contains(doc.activeElement);
    const alvo = app.querySelector<HTMLElement>(`button[data-alt="${foco}"]`);
    if (alvo && !outsideQuiz) alvo.focus();
  }

  /** Puts a line where the statement is — the same box, so nothing below it moves — and gives the statement back after it is read. */
  function sayInStatement(texto: string, backToStatement = true): void {
    const h2 = $<HTMLElement>('#quiz-app .quiz-pergunta');
    if (h2) h2.textContent = texto;
    alert(texto);
    const p = QUESTIONS[atual];
    // The engine already knows how long a line stays on screen: 500 ms a word, never under 2600 ms (`core/caption-duration`).
    if (backToStatement && p) win.setTimeout(() => {
      const alvo = $<HTMLElement>('#quiz-app .quiz-pergunta');
      if (alvo && !listening) alvo.textContent = translate(p.enunciado);
    }, captionDuration(texto, 125));
  }

  async function listenForAnswer(): Promise<void> {
    const p = QUESTIONS[atual];
    if (!motor || !p || listening) return;
    const pode = await motor.reading.ready();
    if (!pode.can) { sayInStatement(translate('quiz.semLeitura')); return; }
    listening = true;
    sayInStatement(translate('quiz.ouvindo'), false);
    try {
      const heard = await motor.reading.listen();
      listening = false;
      // the options' WORDS in the child's language, never their keys: she says «galinha», not «quiz.p1.b»
      const chosen = heardAlternative(heard.text, p.alternativas.map((a) => translate(a)));
      if (chosen !== null) { answer(chosen); return; }
      const texto = heard.text.trim();
      sayInStatement(texto ? translate('quiz.naoEntendi', { texto }) : translate('quiz.ouviNada'));
    } catch {
      // A reading that refuses says why in `problems`; what the child needs here is a way to go on, which is the arrows.
      listening = false;
      sayInStatement(translate('quiz.semLeitura'));
    }
  }

  function answer(i: number): void {
    const p = QUESTIONS[atual];
    if (!p) return;
    const gotItRight = i === p.certa;
    if (gotItRight) correctCount++;
    alert(answerText(translate, gotItRight, translate(p.alternativas[p.certa] ?? '')));
    atual++;
    foco = 0;
    win.setTimeout(render, 900); // deixa o anúncio ser lido antes de a tela mudar
  }

  /**
   * WHAT THE QUIZ EXECUTES FOR EACH VIRTUAL BUTTON (ADR-0111 and its erratum; issue #197): the engine takes the hardware — the keyboard by
   * the child's scheme, the eyes, any transport — and carries the button's virtual name here; this is the quiz's map, the same one its
   * `preset` names. ⚠️ It used to read raw key codes: its own arrows worked, the scheme's W and S did not, S rang the sonar, and a transport
   * could only reach it by disguising itself as a keyboard.
   */
  const ON_BUTTON: Partial<Record<VirtualCommand['action'], (total: number) => void>> = {
    down: (total) => { foco = nextFocus(foco, 1, total); render(); },
    up: (total) => { foco = nextFocus(foco, -1, total); render(); },
    // CONFIRMAR passa pela PILHA (item 22, C3): a cena do topo decide o que a intenção significa e devolve se consumiu.
    action2: () => { motor?.scenes.input('confirm'); },
    // SPEAKING THE ANSWER, and giving the microphone back. ⚠️ The same button that goes back is what stops a reading: a child who
    // changed her mind should not have to wait out the ceiling with the microphone open.
    action1: () => { void listenForAnswer(); },
    action3: () => { if (listening) motor?.reading.stop(); },
    // THE SONAR on R1 (the Dev, 2026-09-16: «Tecla padrão para o sonar deve ser R1»). Its words are what is on screen now — the
    // statement and the options — read by the engine (ADR-0234); its tone points from `atual`, the QUESTION, not the option under
    // the cursor: pointing at the right option would be cheating.
    rightShoulder: () => { motor?.sonar.sonar({ i: 0, x: atual, y: 0 }); },
  };

  /** A button with no row does nothing in this quiz; only a PRESS counts — a release is not a second press. */
  function handleCommand(cmd: VirtualCommand): void {
    const p = QUESTIONS[atual];
    if (!p || !cmd.pressed) return;
    ON_BUTTON[cmd.action]?.(p.alternativas.length);
  }

  // A ENGINE INTEIRA, numa chamada. Antes eram nove inicializações à mão nesta função, em ordem que só o
  // achado 3 revelava — e o consumidor tinha de acertá-la sozinho. O que sobrou aqui embaixo é o que é
  // realmente DESTE jogo: a ergonomia do toque e o desenho das perguntas.
  const engine = createGame({
    declaration: declareQuiz(QUESTIONS, { current: () => atual, focus: () => foco, correct: () => correctCount }),
    host: {
      doc, win, cvdHost: $<SVGElement>('#q-cvd'),
      interpreter: interpreter ?? (librasAvatar ? createLibrasAvatarInterpreter({
        doc, win, fetch: win.fetch, base: doc.baseURI, title: () => translate('sr.deaf.interpreter'),
      }) : undefined),
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
    // AND THE CHILD READS TO IT (ADR-0216 §3): one more line, and `motor.reading.listen()` answers with what she said. This
    // answer is also what puts the reading model of her language into a delivery — `npx inclusionist-heavy dist --reading pt`.
    uses: { neuralVoice: true, reading: true },
    // Os ajustes deste jogo estão SEMPRE disponíveis; ele não precisa se declarar "pausado" para navegá-los.
    isNavigable: () => true,
    /*
     * THE WORDS THIS QUIZ DECLARES live in its own dictionary, one per language (ADR-0232 D3): every `…Key` below is a key of
     * these, and a key they lack would be a line of `problems`, never a key on screen.
     */
    dictionaries: QUIZ_DICTIONARIES,
    /*
     * HOW TO PLAY THIS QUIZ (ADR-0195): the cartridge tells it, the engine's help shows it before the buttons. The figures are drawn
     * here from shapes — a question bar and four options — and the second one moves the marked option down, which is the game.
     */
    onCommand: handleCommand,
    howToPlay: [
      {
        textKey: 'quiz.comoJogar.ler',
        figure: ({ ctx, width, height }) => drawQuizFigure(ctx, width, height, -1),
      },
      {
        textKey: 'quiz.comoJogar.escolher',
        figure: ({ ctx, width, height, time }) => drawQuizFigure(ctx, width, height, Math.floor(time / 0.9) % 4),
      },
    ],
    /*
     * AS POSIÇÕES QUE ESTE JOGO USA (ADR-0162): cima e baixo escolhem, a acção 2 confirma e a 3 volta — on the keyboard and a
     * gamepad, and in the help screen. ⚠️ Since ADR-0166 they draw no on-screen pad: this quiz does not ask for one
     * (`controleNaTela` absent), because its options are touched directly and its menu button opens the menus.
     * 📌 KEYS, not words: the engine resolves them at every drawing, so a language change reaches them (ADR-0232 D3).
     */
    preset: {
      up: { labelKey: 'quiz.pos.up' },
      down: { labelKey: 'quiz.pos.down' },
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

  // 🔴 O PAINEL DE TIPOGRAFIA E O SELETOR DE VISÃO DESTE JOGO SAÍRAM (2026-09-12). Desenhavam um botão e uma lista na
  // zona do rodapé, que é da explicação (`CLAUDE.md` §4), e repetiam a barra rápida: a letra muda pelo ciclo de
  // comunicação e a correcção de cor pelo 🚥 (ADR-0151). Os achados 5 e 7 que eles provavam ficam no git: a engine
  // passou a montar e a ligar as duas coisas sozinha, que era o que eles pediam.

  // ⚠️ O `motor.nav.attach()` SAIU DAQUI (issue #109). Era um remendo do consumidor: a engine montava a
  // navegação de menu e não a ligava, então este quiz tinha de a ligar à mão logo depois do `createGame` — e
  // um jogo que não soubesse disso ganhava diálogos que só respondem ao rato. `createGame` liga agora, e o
  // segundo consumidor deixa de carregar a correção do primeiro.

  // A PILHA DE CENAS (item 22, C3). Este quiz tem UMA cena, e ela não é inventada para o teste: `render()` já
  // era o `draw` e o ouvinte de teclas já era o `input` — o que faltava era o lugar onde os dois se declaram juntos.
  //
  // Uma cena só não prova pilha nenhuma, e não é o que ela está fazendo aqui. O que ela mostra é mais modesto
  // e é o que o item 22 precisa: que a forma (`nome`/`draw`/`input`) cabe num jogo que NÃO tem fases — sem
  // `title`, sem `paused`, sem nada do enum da plataforma. Um segundo consumidor que precisasse inventar uma
  // fase para usar a pilha seria o achado 10 outra vez.
  engine.scenes.push({
    name: 'perguntas',
    draw: () => render(),
    input: (intent) => {
      if (intent !== 'confirm') return false;
      answer(foco);
      return true;
    },
  });

  // MODO PESSOA SURDA — ⚠️ ESTE BLOCO SAIU, e a ausência é o conserto (ADR-0106).
  //
  // Ele lia `#q-libras`, ligava o clique a `toggleLibras`, anunciava `sr.icon.librasOn/Off` e mantinha o
  // `aria-pressed` por `setOnLibrasChange`. Todas as quatro coisas são agora feitas pelo ícone 🦻 da barra
  // que o `createGame` monta — o mesmo `iconAct`, e um `aria-label` que diz o estado (o ida-e-volta que o
  // cabeçalho do `ui/pause-icons` descreve).
  //
  // ⚠️ MANTÊ-LO SERIA O DEFEITO DO ANÚNCIO DUPLO, que este repositório já pagou no `setModoCego`
  // (`ba355f3`): duas superfícies a dizer a mesma mudança, e a criança que navega por ouvido a ouvi-la
  // duas vezes. Nenhum script do VLibras nesta página continua a ser de propósito.

  // TOUCH TARGETS are the engine's since ADR-0163: the options read `--alvo-min`, which `createGame` writes from the
  // resolution it forces. The quiz used to compute its own 9 mm, and the last option fell out of the region.

  // THE TOUCH DOOR TO THE MENUS is the quick bar's ☰ (interface log 2026-09-16): the engine's, first on the bar, so the quiz
  // no longer draws a Menu button of its own (ADR-0166 erratum: «não faz sentido pausar um quiz»).

  // The first draw and the welcome wait for the boot language (study item E4): drawn in the gap, the first question was
  // grouped as «Alternativas» and read «Gato, 1 de 4» on an English page (measured). For pt it resolves at once.
  void engine.localeReady().then(() => {
    engine.scenes.draw(); // era `render()` direto — agora quem desenha é a pilha, que é quem sabe o que está no topo
    say(translate('sr.quiz.bemVindo'));
  });

  /*
   * 🔴 A ATIVIDADE REDESENHA-SE AO TROCAR DE IDIOMA, e sem esta linha ela não o fazia (ADR-0225).
   *
   * 📏 Medido no `dist` em 23/09: clicar na bandeira levava o `<html lang>`, o rodapé, a barra e os painéis para o
   * idioma novo e deixava o ENUNCIADO e as alternativas onde estavam. A engine tem por onde avisar desde o estudo
   * C6 — `i18n:change` na janela, que a raiz, o kit de painéis e o cartão já assinam —, e o cartucho não assinava.
   *
   * 📌 Quem redesenha é a PILHA e não o `render()` directo, pela mesma razão do primeiro desenho: ela sabe o que
   * está no topo, e um dia isto pode não ser a tela das perguntas.
   *
   * ⚠️ E quem avisa é a ENGINE, não a janela: este cartucho não sabe — nem deve — que o evento se chama
   * `i18n:change` nem onde ele é disparado (ADR-0216).
   */
  engine.onLocaleChange(() => { engine.scenes.draw(); });
  return engine;
}

/** What the declaration reads of the round: the question, the option under the cursor, and how many were right. */
interface QuizRound {
  readonly current: () => number;
  readonly focus: () => number;
  readonly correct: () => number;
}

/**
 * A DECLARAÇÃO DESTE JOGO — os sete campos do `core/contract` (ADR-0030).
 *
 * Um quiz é o caso extremo de propósito: SEM ESPAÇO NENHUM, só ordem. A topologia é `hotspots`, a distância é
 * diferença de índice, e o turno é do JOGADOR — o tempo não pressiona, que é o que a WCAG 2.2.1 pede e o que
 * separa este gênero da plataforma sem uma linha de condicional na engine.
 *
 * Não é o `genre-quiz` do ADR-0030: um preset é um pacote que outros quizzes reusam, e isto é a declaração de
 * UM jogo. Mas é a primeira declaração escrita por um consumidor de verdade, que boota e roda — e é o que
 * mostra que os sete campos cabem num jogo que não tem mundo.
 *
 * 📌 The round arrives as three readers (ADR-0232 D4): it lives in `bootQuiz`'s call, not in this module.
 */
function declareQuiz(questions: readonly Question[], round: QuizRound): GameDeclaration {
  const sequence = questions.map((_, i) => `q${i + 1}`);
  return {
    topology: () => ({ kind: 'hotspots', order: sequence }),
    // ⚠️ O MUNDO DESTE JOGO É DOM, e é exatamente o caso que o campo existe para consertar. A engine
    // implementava «mundo» como a canvas do PixiJS; aqui não há canvas nenhuma a olhar, e uma
    // simulação de cegueira apagaria o que ninguém vê deixando as alternativas legíveis — a
    // simulação ao contrário. Ver o bloco 8 de `core/contract`.
    world: () => ({ kind: 'element', selector: '#game-region' }),
    // ⚠️ UM. Um quiz nunca pede dois dedos ao mesmo tempo: escolher uma alternativa é um comando de cada vez,
    // e navegar entre elas também. É a resposta mais fácil do contrato inteiro, e é justamente por isso que
    // ela vale escrita — o jogo que declara 1 fica jogável em QUALQUER transporte, incluindo os de olhar, de
    // sopro e de um acionador só, e é isso que o campo obrigatório torna visível em vez de acidental.
    holdsAtOnce: () => 1,
    // 🔴 FALSO, E ESTE JOGO É A PROVA DE QUE OS DOIS CAMPOS SÃO PERGUNTAS DIFERENTES. Ele declara `1` acima e
    // não segura tecla NENHUMA: escolher uma alternativa é tocar e largar. O `1` está lá porque o contrato
    // recusa zero — e foi essa colisão que fez o Dev revogar uma cláusula sua do mesmo dia: «Nem todo jogo
    // precisa de alternância, somente os que precisam de tecla segurando» (ADR-0115).
    // 📌 A consequência aqui é visível: a criança que abre a acessibilidade deste quiz **não vê** o controle
    // de alternância. Não desabilitado com um motivo — AUSENTE, porque não há nada que ele pudesse fazer.
    holdsKeys: () => false,
    tick: 'player',
    // Papel: a pergunta corrente é o OBJETIVO; as já respondidas são passagem livre. Sem tile, sem lava.
    roleAt: (at) => (at.x === round.current() ? 'goal' : 'free'),
    // The target's name, for the navigation sentence. ⚠️ This DOM quiz never says it: with text on screen the sonar reads
    // the screen — statement and options — at every press (ADR-0234, «sonar do que está na tela»); the name is heard only
    // where the engine cannot read the screen.
    nameAt: (at) => (questions[at.x] ? { text: `pergunta ${at.x + 1}`, gender: 'f', plural: false } : null),
    // O foco é o do teclado: qual alternativa está sob o cursor. Sem corpo, sem `facing` — daí `heading:'none'`.
    focusOf: () => ({ id: 'p0', at: { x: round.current(), y: round.focus() }, heading: 'none' }),
    // ESTE É O CAMPO QUE APOSENTA O `coinTarget`: o alvo é "acertos de perguntas", e a engine não sabe
    // (nem precisa saber) o que é uma moeda para montar a mesma frase de progresso.
    objectiveOf: () => ({
      name: { text: 'perguntas', gender: 'f', plural: true },
      have: round.correct(), need: questions.length,
    }),
    // A segunda metade do campo 5: ONDE está o que ainda conta. Num quiz é uma posição só — a pergunta
    // corrente —, e é justamente por ser tão pobre que ela mostra a forma certa da pergunta: a engine não
    // varre nada, ela recebe a lista e compara distâncias na métrica declarada.
    targetsOf: () => (round.current() < questions.length ? [{ x: round.current(), y: 0 }] : []),
  };
}

/** The quiz drawn small, for its «how to play» slides: the question bar and four options, `marcada` outlined (−1: none). */
function drawQuizFigure(ctx: CanvasRenderingContext2D, w: number, h: number, marcada: number): void {
  const m = Math.round(h * 0.06);
  const barHeight = Math.round(h * 0.16);
  ctx.fillStyle = '#eaf2f8';
  ctx.fillRect(m, m, w - 2 * m, barHeight);
  const altura = Math.floor((h - 3 * m - barHeight - 3 * m) / 4);
  for (let i = 0; i < 4; i++) {
    const y = 2 * m + barHeight + i * (altura + m);
    ctx.fillStyle = '#3a4a6a'; // lighter than the slide's own #1a2740, or the options vanish into it
    ctx.fillRect(m * 3, y, w - 6 * m, altura);
    if (i === marcada) {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = Math.max(2, Math.round(m / 2));
      ctx.strokeRect(m * 3, y, w - 6 * m, altura);
    }
  }
}
