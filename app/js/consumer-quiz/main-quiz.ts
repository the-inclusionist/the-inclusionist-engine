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
//     AGORA a engine CONSTRÓI a casca: `ui/panel-shell.montarCasca` monta o véu, o cartão, o título, a lista
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
import { escaparHtml } from '../core/escape-html.js'; // #106: enunciado e alternativas sao TEXTO
import { t, idiomaPronto } from '../core/i18n.js';
import { srSay, srAlert } from '../core/a11y-sr.js';
import { menuIndexOn } from '../core/state.js';
import { anunciarItem } from '../ui/item-announcement.js';
import { createGame, type Engine } from '../boot/create-game.js';
import type { GameDeclaration } from '../core/contract.js';

/** Uma pergunta. Dado puro, do JOGO — o consumidor traz o seu conteúdo, como qualquer jogo deve trazer. */
interface Pergunta {
  readonly enunciado: string;
  readonly alternativas: readonly string[];
  readonly certa: number;
}

const PERGUNTAS: readonly Pergunta[] = [
  { enunciado: 'Qual animal põe ovos e tem bico?', alternativas: ['Gato', 'Galinha', 'Cavalo', 'Peixe'], certa: 1 },
  { enunciado: 'Quantos lados tem um triângulo?', alternativas: ['Três', 'Quatro', 'Cinco', 'Dois'], certa: 0 },
  { enunciado: 'Qual destas é uma fruta?', alternativas: ['Alface', 'Cenoura', 'Banana', 'Batata'], certa: 2 },
];

let atual = 0;
let foco = 0;
let acertos = 0;
/** The question whose statement and options were last narrated — see `narracaoAoDesenhar`. */
let perguntaNarrada = -1;
let motor: Engine | null = null;

const $ = <T extends Element = Element>(sel: string): T | null => document.querySelector<T>(sel);

/** Marcação de uma pergunta. Pura: recebe estado, devolve texto — testável sem DOM. */
export function perguntaHtml(p: Pergunta, selecionada: number): string {
  const alts = p.alternativas.map((a, i) =>
    `<button class="mode-btn quiz-alt${i === selecionada ? ' is-on' : ''}" data-alt="${i}" type="button"` +
    ` role="radio" aria-checked="${i === selecionada}">${escaparHtml(a)}</button>`).join('');
  return (
    `<h2 class="quiz-pergunta">${escaparHtml(p.enunciado)}</h2>` +
    `<div class="quiz-alts" role="radiogroup" aria-label="${escaparHtml(t('quiz.alternativas'))}">${alts}</div>`
  );
}

/** O próximo índice do foco, com as pontas dando a volta. Puro — é a regra que o teclado e o pad compartilham. */
export function proximoFoco(atualIdx: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return ((atualIdx + delta) % total + total) % total;
}

/**
 * WHAT THE VOICE SAYS WHEN A QUESTION OPENS: the statement, then every option (ADR-0158 rule 3), each with its PLACE
 * after its name (ADR-0167) — «Gato, 1 de 4. Galinha, 2 de 4. …».
 *
 * A question is not answerable by ear until its options are heard. The place is said the way every menu item says it:
 * the Dev asked for «uma única função que capture a posição de item e a totalidade de itens», and it is the engine's.
 */
export function narracaoDaPergunta(p: Pergunta): string {
  const opcoes = p.alternativas.map((_, i) => opcaoFalada(p, i)).join('. ');
  return opcoes ? `${p.enunciado} ${opcoes}` : p.enunciado;
}

/** One option as it is said: its words, then its place — «Galinha, 2 de 4» (the index can be turned off, ADR-0044). */
export function opcaoFalada(p: Pergunta, i: number): string {
  return anunciarItem({ rotulo: p.alternativas[i] ?? '', posicao: i + 1, total: p.alternativas.length }, menuIndexOn);
}

/**
 * What to narrate on a draw, and which question has now been narrated.
 *
 * The whole question only when it OPENS; a draw on the same question is the cursor moving, and then only the option
 * under it is said. 🔴 Before this, every arrow press re-read the statement and never said which option was reached.
 */
export function narracaoAoDesenhar(p: Pergunta, pergunta: number, focoIdx: number, jaNarrada: number): { texto: string; narrada: number } {
  return pergunta === jaNarrada
    ? { texto: opcaoFalada(p, focoIdx), narrada: jaNarrada }
    : { texto: narracaoDaPergunta(p), narrada: pergunta };
}

/**
 * O texto que o leitor de tela ouve ao responder. Separado do DOM porque é o que a criança cega RECEBE.
 * The frame is the dictionary's (study item E4): the right answer crosses as `{certa}`, the words around it translate.
 */
export function respostaTexto(acertou: boolean, certa: string): string {
  return t(acertou ? 'quiz.resposta.certa' : 'quiz.resposta.errada', { certa });
}

/** The closing line — how many were right out of how many — in the child's language. */
export function fimTexto(acertou: number, total: number): string {
  return t('quiz.fim', { n: acertou, m: total });
}

function render(): void {
  const app = $<HTMLElement>('#quiz-app');
  if (!app) return;
  // the menu button's word, resolved at each draw — the preferred language arrives after this boot
  const botaoMenu = $<HTMLElement>('#quiz-menu');
  if (botaoMenu) botaoMenu.textContent = t('quiz.menu');
  const p = PERGUNTAS[atual];
  if (!p) { app.innerHTML = `<h2 class="quiz-pergunta">${escaparHtml(fimTexto(acertos, PERGUNTAS.length))}</h2>`; return; }
  app.innerHTML = perguntaHtml(p, foco);
  // a narração é do consumidor: a engine só empresta a voz
  const fala = narracaoAoDesenhar(p, atual, foco, perguntaNarrada);
  perguntaNarrada = fala.narrada;
  motor?.tts.narrate(fala.texto);
  app.querySelectorAll<HTMLButtonElement>('button[data-alt]').forEach((b) => {
    b.addEventListener('click', () => responder(Number(b.dataset.alt)));
  });
  const alvo = app.querySelector<HTMLElement>(`button[data-alt="${foco}"]`);
  if (alvo) alvo.focus();
}

function responder(i: number): void {
  const p = PERGUNTAS[atual];
  if (!p) return;
  const acertou = i === p.certa;
  if (acertou) acertos++;
  srAlert(respostaTexto(acertou, p.alternativas[p.certa] ?? ''));
  atual++;
  foco = 0;
  setTimeout(render, 900); // deixa o anúncio ser lido antes de a tela mudar
}

function aoTeclado(e: KeyboardEvent): void {
  const p = PERGUNTAS[atual];
  if (!p) return;
  // SONAR (achado 9). A posição do jogador é `atual` — a PERGUNTA em que ele está —, e não `foco`, que é a
  // alternativa sob o cursor: a topologia declarada é a lista de PERGUNTAS, e misturar os dois índices faria
  // a distância medir uma coisa na régua de outra.
  //
  // ⚠️ E AQUI O SONAR É CORRETO E INÚTIL, o que também é um achado. Num quiz linear de três perguntas não há
  // para onde apontar: o alvo é sempre a pergunta em que a criança já está, e a resposta é sempre "bem
  // perto". Apontar a ALTERNATIVA certa seria colar. O sonar serve a quem tem ESPAÇO — plataforma, top-down,
  // Sokoban, um mapa de fases —, e o que este consumidor prova não é que ele ajuda todo gênero: é que ligá-lo
  // não exige mais mentir para a engine. As duas coisas costumam ser confundidas.
  // ⚠️ O `viz: 'cego'` SAIU daqui em 2026-09-08 (#104), e não foi substituído: era uma chave que nem sequer
  // existe no catálogo (o modo chama-se `blind`) e nunca fez diferença nenhuma, porque `sonar()` não lê a
  // visão de ninguém — quem a lia era o `needsAudioCues`, e este atalho de teclado não passa por ele. Uma
  // propriedade inventada que ninguém consulta é a forma mais silenciosa de dívida: o `SonarPlayer` a
  // recusar agora é o que a torna visível.
  if (e.code === 'KeyS') { motor?.sonar.sonar({ i: 0, x: atual, y: 0 }); e.preventDefault(); return; }
  const total = p.alternativas.length;
  if (e.code === 'ArrowDown' || e.code === 'ArrowRight') { foco = proximoFoco(foco, 1, total); render(); e.preventDefault(); }
  else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') { foco = proximoFoco(foco, -1, total); render(); e.preventDefault(); }
  // CONFIRMAR passa pela PILHA (item 22, C3): a cena do topo decide o que a intenção significa e devolve se
  // consumiu. Aqui só há uma cena, então o efeito é o mesmo — e é por ser o mesmo que a troca é conferível:
  // se o comportamento mudasse junto, não daria para saber qual metade quebrou.
  else if (e.code === 'Enter' || e.code === 'Space') { motor?.cenas.input('confirm'); e.preventDefault(); }
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
 */
export function declararQuiz(perguntas: readonly Pergunta[]): GameDeclaration {
  const ordem = perguntas.map((_, i) => `q${i + 1}`);
  return {
    topology: () => ({ kind: 'hotspots', order: ordem }),
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
    seguraTeclas: () => false,
    tick: 'player',
    // Papel: a pergunta corrente é o OBJETIVO; as já respondidas são passagem livre. Sem tile, sem lava.
    roleAt: (at) => (at.x === atual ? 'goal' : 'free'),
    // O nome é curto DE PROPÓSITO: quem ouve o sonar quer saber PARA ONDE ir, não o enunciado inteiro. O
    // enunciado a criança já recebe pela narração, ao entrar na pergunta. Confundir os dois faz o sonar ler
    // um parágrafo a cada toque — e o sonar existe para ser tocado muitas vezes.
    nameAt: (at) => (perguntas[at.x] ? { text: `pergunta ${at.x + 1}`, gender: 'f', plural: false } : null),
    // O foco é o do teclado: qual alternativa está sob o cursor. Sem corpo, sem `facing` — daí `heading:'none'`.
    focusOf: () => ({ id: 'p0', at: { x: atual, y: foco }, heading: 'none' }),
    // ESTE É O CAMPO QUE APOSENTA O `coinTarget`: o alvo é "acertos de perguntas", e a engine não sabe
    // (nem precisa saber) o que é uma moeda para montar a mesma frase de progresso.
    objectiveOf: () => ({
      name: { text: 'perguntas', gender: 'f', plural: true },
      have: acertos, need: perguntas.length,
    }),
    // A segunda metade do campo 5: ONDE está o que ainda conta. Num quiz é uma posição só — a pergunta
    // corrente —, e é justamente por ser tão pobre que ela mostra a forma certa da pergunta: a engine não
    // varre nada, ela recebe a lista e compara distâncias na métrica declarada.
    targetsOf: () => (atual < perguntas.length ? [{ x: atual, y: 0 }] : []),
  };
}

/** Boot. Exportado para o teste poder montá-lo num DOM de mentira sem depender do carregamento do módulo. */
export function bootQuiz(): void {
  // A ENGINE INTEIRA, numa chamada. Antes eram nove inicializações à mão nesta função, em ordem que só o
  // achado 3 revelava — e o consumidor tinha de acertá-la sozinho. O que sobrou aqui embaixo é o que é
  // realmente DESTE jogo: a ergonomia do toque e o desenho das perguntas.
  motor = createGame({
    declaration: declararQuiz(PERGUNTAS),
    host: { doc: document, win: window, cvdHost: $<SVGElement>('#q-cvd') },
    // Um quiz não tem pausa, nem assistente de pad, nem ator de pausa. Declarado, e não deduzido de getters
    // que devolvem null — ver o achado 10 e o cabeçalho do `boot/create-game`.
    // ⚠️ O `semMenuDePausa` SAIU daqui em 2026-09-09 (ADR-0120), e este jogo é o motivo de ele ter existido:
    // era o quiz que «não tinha pausa». Passou a ter — a engine monta o cartão e ele só oferece o que este
    // jogo acciona. Um botão a menos para uma criança encontrar é um ajuste a menos que ela alcança.
    declines: { semAssistenteDePad: true, semAtorDePausa: true },
    // KOKORO IS TRIED HERE (ADR-0198 erratum: «Apenas teste neste quiz demo»): the phonemizer and the runtime load only when a child
    // picks a Kokoro voice, and the start fetches the model and voices because this game fills the port.
    carregarKokoro: async () => {
      const { moduloKokoro } = await import('./kokoro-carregar.js');
      return moduloKokoro;
    },
    // Os ajustes deste jogo estão SEMPRE disponíveis; ele não precisa se declarar "pausado" para navegá-los.
    isNavigable: () => true,
    /*
     * AS POSIÇÕES QUE ESTE JOGO USA (ADR-0162): cima e baixo escolhem, a acção 2 confirma e a 3 volta — on the keyboard and a
     * gamepad, and in the help screen. ⚠️ Since ADR-0166 they draw no on-screen pad: this quiz does not ask for one
     * (`controleNaTela` absent), because its options are touched directly and its menu button opens the menus.
     * 📌 GETTERS e não cadeias: o `preset` é lido a cada desenho, e uma palavra resolvida aqui ficaria no idioma de
     * recuo — este boot corre antes de o idioma preferido chegar.
     */
    /*
     * HOW TO PLAY THIS QUIZ (ADR-0195): the cartridge tells it, the engine's help shows it before the buttons. The figures are drawn
     * here from shapes — a question bar and four options — and the second one moves the marked option down, which is the game.
     */
    howToPlay: [
      {
        text: () => t('quiz.comoJogar.ler'),
        figure: ({ ctx, width, height }) => desenharQuizFigura(ctx, width, height, -1),
      },
      {
        text: () => t('quiz.comoJogar.escolher'),
        figure: ({ ctx, width, height, time }) => desenharQuizFigura(ctx, width, height, Math.floor(time / 0.9) % 4),
      },
    ],
    preset: {
      up: { get label() { return t('quiz.pos.up'); } },
      down: { get label() { return t('quiz.pos.down'); } },
      action2: { get label() { return t('quiz.pos.confirm'); } },
      action3: { get label() { return t('quiz.pos.back'); } },
    },
    /*
     * AS ACOMODAÇÕES QUE TÊM ASSUNTO NESTE JOGO (ADR-0153) — a resposta é obrigatória, e o arranque recusa sem ela.
     *
     * 📌 Pelo estudo das acomodações: um jogo de perguntas é género «trivia» (Wikipédia 10.11) e o TEXTO É A
     * MATÉRIA — logo dicas, ritmo do texto, dificuldade das palavras e realce de palavras têm assunto aqui. Não há
     * personagem, câmara, peças, bengala, detecção, sustos nem janela de acerto: as outras doze são «não», escritas.
     *
     * ⚠️ As palavras são resolvidas no arranque, como as outras deste boot; nenhuma linha as mostra ainda.
     */
    acomodacoes: {
      cameraSway: false, easyMode: false, wheelchairMode: false, detectionLeniency: false, intensity: false,
      hints: { label: t('quiz.acom.hints') },
      reducedCharacterMotion: false, caneSpacing: false,
      textPace: { label: t('quiz.acom.textPace') },
      lexicalDifficulty: { label: t('quiz.acom.lexicalDifficulty') },
      wordHighlight: { label: t('quiz.acom.wordHighlight') },
      pieceSets: false, distinguishableSuits: false, timingWindow: false, aimAssist: false, repeatedInput: false,
      ownerColors: false, contrastOutlines: false,
    },
  });
  // O que o hospedeiro não entregou vira lista legível em vez de painel vazio (achado 6). Num jogo de
  // verdade isto iria para a tela; aqui basta o console, porque o instrumento é lido por quem desenvolve.
  if (motor.problems.length) console.warn('[quiz] lacunas do hospedeiro:', motor.problems);

  // 🔴 O PAINEL DE TIPOGRAFIA E O SELETOR DE VISÃO DESTE JOGO SAÍRAM (2026-09-12). Desenhavam um botão e uma lista na
  // zona do rodapé, que é da explicação (`CLAUDE.md` §4), e repetiam a barra rápida: a letra muda pelo ciclo de
  // comunicação e a correcção de cor pelo 🚥 (ADR-0151). Os achados 5 e 7 que eles provavam ficam no git: a engine
  // passou a montar e a ligar as duas coisas sozinha, que era o que eles pediam.

  // ⚠️ O `motor.nav.attach()` SAIU DAQUI (issue #109). Era um remendo do consumidor: a engine montava a
  // navegação de menu e não a ligava, então este quiz tinha de a ligar à mão logo depois do `createGame` — e
  // um jogo que não soubesse disso ganhava diálogos que só respondem ao rato. `createGame` liga agora, e o
  // segundo consumidor deixa de carregar a correção do primeiro.

  // A PILHA DE CENAS (item 22, C3). Este quiz tem UMA cena, e ela não é inventada para o teste: `render()` já
  // era o `draw` e `aoTeclado` já era o `input` — o que faltava era o lugar onde os dois se declaram juntos.
  //
  // Uma cena só não prova pilha nenhuma, e não é o que ela está fazendo aqui. O que ela mostra é mais modesto
  // e é o que o item 22 precisa: que a forma (`nome`/`draw`/`input`) cabe num jogo que NÃO tem fases — sem
  // `title`, sem `paused`, sem nada do enum da plataforma. Um segundo consumidor que precisasse inventar uma
  // fase para usar a pilha seria o achado 10 outra vez.
  motor.cenas.push({
    nome: 'perguntas',
    draw: () => render(),
    input: (intent) => {
      if (intent !== 'confirm') return false;
      responder(foco);
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

  // THE MENU BUTTON (ADR-0166 erratum): this quiz asks for no on-screen pad — its options are touched directly — and
  // «não faz sentido pausar um quiz», so the touch door to the menus is a button that opens them.
  const botaoMenu = $<HTMLButtonElement>('#quiz-menu');
  if (botaoMenu) botaoMenu.addEventListener('click', () => motor?.pausa.mostrar(0));

  const região = $<HTMLElement>('#game-region');
  if (região) região.addEventListener('keydown', aoTeclado);
  // The first draw and the welcome wait for the boot language (study item E4): drawn in the gap, the first question was
  // grouped as «Alternativas» and read «Gato, 1 de 4» on an English page (measured). For pt it resolves at once.
  void idiomaPronto().then(() => {
    motor?.cenas.draw(); // era `render()` direto — agora quem desenha é a pilha, que é quem sabe o que está no topo
    srSay(t('sr.quiz.bemVindo'));
  });
}

if (typeof document !== 'undefined' && document.getElementById('quiz-app')) bootQuiz();

/** The quiz drawn small, for its «how to play» slides: the question bar and four options, `marcada` outlined (−1: none). */
function desenharQuizFigura(ctx: CanvasRenderingContext2D, w: number, h: number, marcada: number): void {
  const m = Math.round(h * 0.06);
  const barra = Math.round(h * 0.16);
  ctx.fillStyle = '#eaf2f8';
  ctx.fillRect(m, m, w - 2 * m, barra);
  const altura = Math.floor((h - 3 * m - barra - 3 * m) / 4);
  for (let i = 0; i < 4; i++) {
    const y = 2 * m + barra + i * (altura + m);
    ctx.fillStyle = '#3a4a6a'; // lighter than the slide's own #1a2740, or the options vanish into it
    ctx.fillRect(m * 3, y, w - 6 * m, altura);
    if (i === marcada) {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = Math.max(2, Math.round(m / 2));
      ctx.strokeRect(m * 3, y, w - 6 * m, altura);
    }
  }
}
