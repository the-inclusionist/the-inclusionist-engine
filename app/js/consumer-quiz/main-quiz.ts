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
//  6. MAS O CONTRATO DE MARKUP É INVISÍVEL. O ctx do painel pede `$` e `store`; o que ele REALMENTE exige é que
//     o documento do consumidor contenha `#typo`, `#typo-list`, `#typo-preview`, `#typo-close` e `#typo-reset`.
//     Nada no tipo diz isso — descobre-se por tentativa, e o modo de falhar é o pior possível: o painel abre
//     vazio, sem erro. Uma engine que exige ids fixos e não os declara está exigindo que cada consumidor
//     redescubra a mesma lista.
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
import { t } from '../core/i18n.js';
import { srSay, srAlert } from '../core/a11y-sr.js';
import { createGame, type Engine } from '../boot/create-game.js';
import type { GameDeclaration } from '../core/contract.js';
import { initSettingsTypo } from '../ui/settings-typo.js';
import * as store from '../platform/storage.js';
import { VIZ_DOM_ONLY, VIZ_FILTER, simulatesDisability } from '../render/viz-modes.js';
import { toggleLibras, vlibrasOpen, setOnLibrasChange } from '../ui/vlibras.js';
import { padPxPerMm } from '../input/touch.js';

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
let motor: Engine | null = null;

const $ = <T extends Element = Element>(sel: string): T | null => document.querySelector<T>(sel);

/** Marcação de uma pergunta. Pura: recebe estado, devolve texto — testável sem DOM. */
export function perguntaHtml(p: Pergunta, selecionada: number): string {
  const alts = p.alternativas.map((a, i) =>
    `<button class="mode-btn quiz-alt${i === selecionada ? ' is-on' : ''}" data-alt="${i}" type="button"` +
    ` role="radio" aria-checked="${i === selecionada}">${a}</button>`).join('');
  return (
    `<h2 class="quiz-pergunta">${p.enunciado}</h2>` +
    `<div class="quiz-alts" role="radiogroup" aria-label="Alternativas">${alts}</div>`
  );
}

/** O próximo índice do foco, com as pontas dando a volta. Puro — é a regra que o teclado e o pad compartilham. */
export function proximoFoco(atualIdx: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return ((atualIdx + delta) % total + total) % total;
}

/** O texto que o leitor de tela ouve ao responder. Separado do DOM porque é o que a criança cega RECEBE. */
export function respostaTexto(acertou: boolean, certa: string): string {
  return acertou ? `Certo! ${certa}.` : `Ainda não. A resposta certa é ${certa}.`;
}

function render(): void {
  const app = $<HTMLElement>('#quiz-app');
  if (!app) return;
  const p = PERGUNTAS[atual];
  if (!p) { app.innerHTML = `<h2 class="quiz-pergunta">Fim! ${acertos} de ${PERGUNTAS.length}.</h2>`; return; }
  app.innerHTML = perguntaHtml(p, foco);
  motor?.tts.narrate(p.enunciado); // a narração do enunciado é do consumidor: a engine só empresta a voz
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
  if (e.code === 'KeyS') { motor?.sonar.sonar({ i: 0, x: atual, y: 0, viz: 'cego' }); e.preventDefault(); return; }
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
  // realmente DESTE jogo: o painel de tipografia, o seletor de visão, o botão de Libras, a ergonomia do
  // toque e o desenho das perguntas.
  motor = createGame({
    declaration: declararQuiz(PERGUNTAS),
    host: { doc: document, win: window, cvdHost: $<SVGElement>('#q-cvd') },
    // Um quiz não tem pausa, nem assistente de pad, nem ator de pausa. Declarado, e não deduzido de getters
    // que devolvem null — ver o achado 10 e o cabeçalho do `boot/create-game`.
    declines: { semMenuDePausa: true, semAssistenteDePad: true, semAtorDePausa: true },
    // Os ajustes deste jogo estão SEMPRE disponíveis; ele não precisa se declarar "pausado" para navegá-los.
    isNavigable: () => true,
  });
  const { overlays } = motor;
  // O que o hospedeiro não entregou vira lista legível em vez de painel vazio (achado 6). Num jogo de
  // verdade isto iria para a tela; aqui basta o console, porque o instrumento é lido por quem desenvolve.
  if (motor.problems.length) console.warn('[quiz] lacunas do hospedeiro:', motor.problems);

  // PAINEL DE TIPOGRAFIA — emprestado da engine, ligado por este jogo. Ver o achado 5.
  const typo = initSettingsTypo({ $, srSay, store, root: document.documentElement });
  const abrir = $<HTMLElement>('#q-abrir-typo');
  if (abrir) abrir.addEventListener('click', () => {
    const ov = $<HTMLElement>('#typo');
    if (!ov) return;
    typo.render(); ov.hidden = false; overlays.frontOverlay(ov);
    ov.querySelector<HTMLElement>('button[data-font]:not([disabled])')?.focus();
  });
  const fechar = $<HTMLElement>('#typo-close');
  if (fechar) fechar.addEventListener('click', () => { const ov = $<HTMLElement>('#typo'); if (ov) ov.hidden = true; });
  overlays.register('typo', { close: () => { const ov = $<HTMLElement>('#typo'); if (ov) ov.hidden = true; }, inEscapeChain: true });

  // VISÃO: o SELETOR é deste jogo; os filtros já foram montados pelo `createGame` (achado 7).
  const seletor = $<HTMLSelectElement>('#q-viz');
  const alvoViz = $<HTMLElement>('#game-region');
  if (seletor && alvoViz && motor.cvdFilters > 0) {
    // PERGUNTA em vez de reconstruir. Este trecho era
    //     `VIZ_MODES.filter((m) => m.kind === 'normal' || (m.kind === 'filter' && !simulatesDisability(m.key)))`
    // — uma expressão que misturava DUAS perguntas: "precisa de canvas?" e "isto simula deficiência?". A
    // primeira é da ENGINE e agora tem resposta declarada (`VIZ_DOM_ONLY`, achado 8); a segunda é DESTE
    // consumidor, que escolheu não oferecer simulações. Separá-las é o conserto: cada consumidor futuro
    // herda a primeira em vez de a redescobrir, e continua livre na segunda.
    const opcoes = VIZ_DOM_ONLY.filter((m) => !simulatesDisability(m.key));
    seletor.innerHTML = opcoes.map((m) => `<option value="${m.key}">${t(m.nome)}</option>`).join('');
    seletor.addEventListener('change', () => {
      alvoViz.style.filter = VIZ_FILTER[seletor.value] || '';
      srSay(seletor.options[seletor.selectedIndex]?.text ?? '');
    });
  }

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

  // MODO PESSOA SURDA. Nenhum script do VLibras nesta página — de propósito.
  const libras = $<HTMLButtonElement>('#q-libras');
  if (libras) {
    setOnLibrasChange(() => { libras.setAttribute('aria-pressed', String(vlibrasOpen())); });
    libras.setAttribute('aria-pressed', String(vlibrasOpen()));
    libras.addEventListener('click', () => { toggleLibras(); srSay(t(vlibrasOpen() ? 'sr.icon.librasOn' : 'sr.icon.librasOff')); });
  }

  // TOQUE: o quiz usa a ERGONOMIA e recusa o PAD. `padPxPerMm` é puro e ancora o milímetro real no aparelho
  // (WCAG 2.5.5 / GAG); as alternativas do quiz passam a ter alvo de 9 mm de altura MEDIDOS, em vez de um
  // palpite em pixels. O `initTouch` inteiro não foi ligado de propósito — ver o achado 14.
  const pxmm = padPxPerMm(matchMedia('(pointer: coarse)').matches, window.innerWidth, window.innerHeight);
  document.documentElement.style.setProperty('--quiz-alt-min', (9 * pxmm).toFixed(1) + 'px');

  const região = $<HTMLElement>('#game-region');
  if (região) região.addEventListener('keydown', aoTeclado);
  motor.cenas.draw(); // era `render()` direto — agora quem desenha é a pilha, que é quem sabe o que está no topo
  srSay(t('sr.quiz.bemVindo'));
}

if (typeof document !== 'undefined' && document.getElementById('quiz-app')) bootQuiz();
