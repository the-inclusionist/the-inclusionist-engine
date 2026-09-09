// SPDX-License-Identifier: AGPL-3.0-or-later
// boot/create-game — O TESTE DE FRONTEIRA DO ADR-0027 (passo 4), escrito em vez de discutido.
//
// ========================= A PERGUNTA QUE ESTE ARQUIVO EXISTE PARA RESPONDER =========================
// O ADR-0027 pôs um veredito e não o deixou vago:
//
//     "se `createGame()` não puder ser escrito sem um parâmetro chamado `coinTarget`, a fronteira que este
//      registro propõe está errada e os passos 5 a 7 NÃO PODEM COMEÇAR."
//
// Pode. Não há `coinTarget` aqui, e não é por disciplina — é porque o ADR-0030 resolveu de onde o alvo vem:
// campo 5 do contrato (`objectiveOf`). O HUD que pedia um número de moedas passa a perguntar ao jogo quantas
// de quantas, e "moeda" deixa de ser palavra da engine. `tests/boot-create-game.node.test.js` prende isso.
//
// ========================= O QUE ISTO É: A ORDEM, E O QUE FALTA =========================
// Não é um framework. É a sequência de ligar a engine, que hoje cada consumidor reescreve à mão — e o segundo
// consumidor mediu o preço de reescrevê-la (`consumer-quiz`, achados 3, 6 e 12):
//
//  · ACHADO 3 — `initAudioMixer()` TEM de rodar antes de `createTts`, senão `audioCat` é null e o `narrate`
//    desiste CALADO. Uma dependência de ordem que nenhum tipo declara e que se descobre pelo silêncio. Aqui
//    ela é impossível de errar: quem chama não escolhe a ordem.
//  · ACHADO 6 — os painéis exigem ids fixos no documento (`#typo`, `#typo-list`…) e, quando faltam, ABREM
//    VAZIOS. Sem erro. Aqui a falta vira `problems`, que é uma lista que o consumidor pode ler e mostrar.
//  · ACHADO 12 — todo consumidor escreve o mesmo adaptador de uma linha para o `window`. Escrito uma vez.
//
// E um achado NOVO, que só apareceu quando esta função tentou bootar contra um documento injetado:
//
//  · ACHADO 15 — `initI18n()` chamava `applyDom(document)`, o GLOBAL, por baixo de quem a chamasse. Num
//    navegador dá no mesmo e por isso sobreviveu; num teste de lógica pura é a diferença entre bootar e não
//    bootar, e num futuro com dois documentos (uma engine em iframe, um editor ao lado do jogo) seria a
//    diferença entre traduzir o documento certo e o outro. Consertado no mesmo passo: `initI18n(root)`, com
//    o global como padrão, exatamente como `applyDom` já fazia.
//
// ========================= DECLINAR NÃO É MENTIR =========================
// O quiz recusou o sonar e o pad em vez de inventar tiles e uma caixa de colisão falsos, e essa distinção é o
// que separa um achado de um verde falso. Aqui ela vira TIPO: um jogo sem menu de pausa declara
// `semMenuDePausa: true` em vez de devolver `null` de um getter e torcer. O que se declina fica registrado no
// objeto devolvido, e um consumidor pode ser auditado pelo que recusou.
//
// ========================= O QUE ISTO AINDA NÃO FAZ, DITO AQUI E NÃO ESCONDIDO =========================
// Não liga render, física, tiles nem o sonar — nada disso é de todo jogo, e o achado 9 mostra que o sonar hoje
// exige seis coisas de plataforma. Não substitui o boot do `main.js`, que tem catorze anos de ordem própria.
// O que ele cobre é o que o quiz provou ser IDÊNTICO em qualquer jogo: idioma, leitor de tela, mixer, voz,
// pilha de diálogos, filtros de daltonismo, teclado remapeável e navegação de menu.
import { initI18n, idiomaPronto } from '../core/i18n.js';
import { entradaDe } from '../input/state.js';
import { criarAvisoDeQueda } from '../ui/loop-crash.js';
import { initFocusTrap, focaveisNoDom } from '../ui/focus-trap.js';
import { mostrarAvisoDeAlcance } from '../ui/reach-notice.js';
import { alcance, transportesPadrao, type Alcance, type Disponibilidade } from '../input/transports.js';
import { presetActions, ACTIONS, type ActionPreset } from '../core/actions.js';
import type { KeyScheme } from '../core/entity.js';
import { t } from '../core/i18n.js';
import { srSay, srAlert } from '../core/a11y-sr.js';
import { initPauseIcons, iconsMarkup } from '../ui/pause-icons.js';
// O módulo INTEIRO: o on do barramento de eventos, para a barra montada continuar a dizer a verdade.
import * as state from '../core/state.js';
import { vlibrasOpen, toggleLibras } from '../ui/vlibras.js';
import { conformanceProblems, type GameDeclaration } from '../core/contract.js';
import { criarPilha, type SceneStack } from '../core/scenes.js';
import { createTts, type CarregarVozNeural } from '../platform/tts.js';
import { ensureAC, catNode, audioOut, soundOn, volume, audioCat, initAudioMixer, tonePan, audioCtx, setCatGain } from '../platform/audio.js';
import { createAudioSonar, type AudioSonar, type SonarPlayer } from '../platform/audio-sonar.js';
// A raiz é a camada que PODE conhecer os dois eixos: `render/` está abaixo dela, e é dela a tarefa de
// responder ao `platform/audio-sonar`, que não pode importar daqui sem inverter uma aresta (#104).
import { ehCego, ehBaixaVisao, PADRAO, type VisualState } from '../render/viz-axes.js';
import { OVERLAY_SCOPE_SELECTOR } from '../ui/settings-panel.js';
import type { AlcanceDoFiltro } from '../render/port.js';
import { LOGICAL_W } from '../core/constants.js';
import { initSettingsPanel, type SettingsPanelApi } from '../ui/settings-panel.js';
import { initMenuNav, type MenuNavApi } from '../ui/menu-nav.js';
import type { NavKeys } from '../input/edges.js';
import { initKeyboardRuntime, type KeyboardRuntime } from '../input/keyboard-runtime.js';
import { kb, initKB } from '../input/keyboard.js';
import { installCvdFilters } from '../render/cvd-matrices.js';

/** O que o jogo empresta do documento. Tudo opcional menos `doc`/`win`: o que faltar vira `problems`. */
export interface EngineHost {
  readonly doc: Document;
  readonly win: Window;
  /** Um `<svg>` vazio onde os seis filtros de daltonismo são montados em tempo de execução. */
  readonly cvdHost?: SVGElement | Element | null;
  /**
   * ONDE A BARRA DE ACESSIBILIDADE ENTRA, na PRIMEIRA tela do jogo.
   *
   * ⚠️ PEDIDO DO DEV, 2026-09-07: «o menu de pausa, o design do menu de pausa e os ícones de acessibilidade
   * que aparecem no jogo desde a primeira tela devem ser oferecidos pela ENGINE e não pela programação do
   * jogo. Todo jogo da engine inclusionist deve ter o mesmo menu de pausa e ícones de acessibilidade desde a
   * primeira.»
   *
   * ⚠️ E A MEDIÇÃO DE 2026-09-08 MOSTROU QUE É UM ACHADO, e não uma arrumação: dos seis jogos do catálogo
   * local, CINCO não têm barra de acessibilidade nenhuma — nem menu de pausa. `pixi-15-puzzle`, `game-chess`,
   * `game-soccer`, `2048` e `whackwhack` não chamam `initPauseIcons` nem montam HUD, e o `createGame` nunca
   * os montou por eles. O comentário do `ui/pause-icons` diz porquê sem o notar: «`initPauseIcons` é chamado
   * pela raiz de composição de CADA jogo» — ou seja, cada jogo tinha de se lembrar, e cinco não se lembraram.
   * A criança que depende do modo cego, do TTS ou do alto contraste abre esses cinco jogos e não tem por onde.
   *
   * Ausente, a engine procura `#title-icons` — o id que o jogo de plataforma usa desde sempre — e, não o
   * achando, diz-o em `problems`.
   *
   * ✅ E DESDE 2026-09-08 ELA TAMBÉM **MONTA** (etapa 2 do ADR-0106 §4). Este parágrafo dizia «dizer não é
   * montar, e a montagem é o passo seguinte»; o passo seguinte aconteceu. O que a destravou foram as etapas
   * 1 e 3: nenhuma delas era sobre montar, e sem as duas o `PauseIconsCtx` exigia sete coisas que esta raiz
   * não sabe responder por um jogo que não conhece.
   *
   * ⚠️ Achando o hospedeiro, a barra é escrita e fiada aqui. Não achando, continua a ser `problems` — porque
   * a engine pode oferecer os ícones, mas não pode adivinhar ONDE eles cabem no desenho de um jogo alheio.
   */
  readonly a11yBarHost?: Element | null;
  /**
   * ONDE O CARTÃO DE PAUSA da primeira tela é pendurado. Ausente, a engine usa `#game-region`.
   *
   * ⚠️ Existe pela mesma razão do `a11yBarHost`: a engine pode OFERECER a pausa, mas não sabe onde ela cabe
   * no desenho de um jogo alheio. Um jogo que não tem pausa nenhuma declara `declines.semMenuDePausa` —
   * declinar é escolha registada, não ter é omissão, e o ADR-0106 §2 é inteiro sobre a diferença.
   */
  readonly pauseHost?: Element | null;
}

/**
 * O que este jogo NÃO tem. Declarado, e não deduzido de um getter que devolve null.
 *
 * O achado 10 do segundo consumidor é a razão de isto existir como tipo: o quiz precisava se declarar
 * "pausado" para navegar os próprios menus, porque a engine não tinha por onde ouvir "eu não tenho fases".
 */
export interface Declinios {
  /**
   * Sem menu de pausa por tela.
   *
   * 🔴 O COMENTÁRIO DESTA LINHA DIZIA «(um quiz não tem)», E ESSA LEITURA CUSTOU UM REGISTO REVERTIDO. Em
   * 2026-09-09 este campo foi aposentado (ADR-0120) porque a razão dele parecia ter morrido: a engine passou a
   * montar o cartão de pausa, logo um jogo sem pausa própria já não precisava de declinar. Verdade — para o
   * consumidor que vive nesta árvore.
   *
   * 📏 MEDIDO NO CATÁLOGO, DEPOIS: `game-chess`, `pixi-15-puzzle`, `game-2048` e `game-whackwhack` usam este
   * campo — QUATRO de cinco jogos — e **nenhum deles por não ter pausa**. Eles têm a sua, ou não querem a
   * navegação de menu da engine por cima do teclado deles. O `pixi-15-puzzle` escreveu o custo ao lado da
   * própria declaração: «if `semMenuDePausa` were omitted, every arrow, Enter and Space would start being
   * eaten the moment anything created an element with a pause id». Removê-lo tira o teclado a quem joga com
   * setas. Revertido em `7f256f0`; ADR-0121.
   *
   * ⚠️ ENTÃO O CAMPO TEM DOIS SIGNIFICADOS E É ESSA A AMBIGUIDADE QUE PERMITIU O ERRO: «não tenho pausa
   * nenhuma» e «tenho a minha, não montes a tua». Quem o ler para decidir alguma coisa tem de saber qual dos
   * dois está a medir. A escolha entre separar os dois nomes e migrar os quatro jogos para a pausa da engine
   * é a issue #132, e é do Dev.
   */
  readonly semMenuDePausa?: boolean;
  /** Sem assistente de mapeamento de controle. */
  readonly semAssistenteDePad?: boolean;
  /** Sem "ator da pausa" — quem apertou o botão que abriu o menu. */
  readonly semAtorDePausa?: boolean;
  /**
   * Sem voz neural — este jogo não abre a porta do ADR-0094.
   *
   * ⚠️ EXISTE PORQUE A AUSÊNCIA ESTAVA A SER SILENCIOSA, e a medição de 2026-09-08 diz quanto: dos SEIS jogos
   * do catálogo local, TRÊS declaram `carregarVozNeural` (platformer, 15-puzzle, 2048) e TRÊS não
   * (`game-soccer`, `whackwhack`, `game-chess`). Nos três últimos não há voz neural nenhuma, e nada o dizia.
   *
   * ⚠️ E ISSO CONTRADIZ UMA PROMESSA ESCRITA. O ADR-0065 §3 diz que as vozes «fazem parte da engine, e não do
   * jogo em si» e que um cartucho «não tem de saber que existe»; o ADR-0094 — com razão, e por 135 MB de WASM
   * — passou a exigir UMA LINHA do jogo. As duas coisas podem ser verdade ao mesmo tempo (a engine é dona das
   * VOZES, o jogo nomeia o FORNECEDOR), mas só se quem esquece a linha for avisado. Declinar é escolha; não
   * declarar era omissão.
   */
  readonly semVozNeural?: boolean;
}

export interface CreateGameOptions {
  /** Os SETE CAMPOS (core/contract). É o que a pilha de acessibilidade lê, e a única coisa que ela lê. */
  readonly declaration: GameDeclaration;
  readonly host: EngineHost;
  readonly declines?: Declinios;
  /**
   * É AGORA hora de navegar menu? A plataforma responde `phase === 'paused'`; um quiz responde `true`.
   * Ausente = `true`, que é o caso do jogo sem fases — o mais simples, e o que não obriga a inventar uma.
   */
  readonly isNavigable?: () => boolean;
  /**
   * O MODO `accessibility` do ADR-0044 (item 7): o direcional dirige a barra rápida em vez do personagem.
   *
   * Opcionais porque um hospedeiro pode não ter barra nenhuma — sem eles a resposta é "ninguém está nela" e
   * nada é chamado. O jogo de plataforma os fornece; um quiz sem HUD de a11y, não.
   */
  /** O índice "N de M" está ligado? Ausente = sim. Ver `comIndice` em ui/menu-nav. */
  readonly comIndice?: () => boolean;
  readonly naBarraDe?: (i: number) => boolean;
  readonly navBar?: (i: number, k: NavKeys) => void;
  /** Jogadores para o teclado remapeável. `Pick<ControlledPlayer,'ctrl'>` — esquema de teclas e nada mais.
   *  ⚠️ `KeyScheme` e não `Record<string, string[]>` desde a #118: era uma CÓPIA ESTRUTURAL do tipo, e uma
   *  cópia que ninguém obriga a concordar diverge — é a lição que o próprio `core/entity` abre a dizer, com
   *  o `DomQuery` (dezasseis cópias) e o `KeyScheme` (seis) como as contas já pagas. */
  readonly players?: { ctrl: KeyScheme }[];
  /** Troca de fase, para quem tem fases. Ausente = não faz nada (o jogo sem fases não perde nada). */
  readonly setPhase?: (p: 'title' | 'playing' | 'paused') => void;
  /**
   * Os jogadores como a NAVEGAÇÃO SONORA os vê. Ausente, `createGame` DERIVA um do campo 4 do contrato: o
   * foco diz onde o jogador está, que é tudo o que o sonar precisa saber sobre posição.
   *
   * Um jogo com vários jogadores, ou com dispositivo de áudio por jogador, fornece a sua lista. Um jogo de
   * uma criança só não fornece nada — e ganha sonar assim mesmo, que é o ponto.
   */
  readonly sonarPlayers?: () => SonarPlayer[];
  /** Modo cego ligado? Ausente = não. Vale para todos os jogadores, como no jogo de plataforma. */
  readonly isBlindMode?: () => boolean;
  /**
   * AS PALAVRAS DESTE JOGO (`core/actions`). Sem elas a engine não sabe QUANTAS ações pedir a um transporte,
   * e a garantia do ADR-0079 §3 não tem como ser medida — foi a lacuna que a issue #112 encontrou: a
   * aritmética existia, testada, e o `createGame` tinha ZERO ocorrências de qualquer coisa sobre ações.
   *
   * Opcional porque um jogo pode não declarar preset ainda; sem ele o aviso de alcance simplesmente não
   * aparece, que é o comportamento de hoje e não uma regressão.
   */
  readonly preset?: ActionPreset;
  /**
   * COMO SE CARREGA A VOZ NEURAL — uma linha do lado do jogo (ADR-0094):
   *
   *     carregarVozNeural: () => import('@mintplex-labs/piper-tts-web')
   *
   * ⚠️ AUSENTE POR OMISSÃO, E ISSO É A DECISÃO E NÃO UM DESCUIDO. A engine não pode nomear o fornecedor:
   * ele traz `onnxruntime-web` como peer NÃO-opcional, que o npm instala sozinho — **135,4 MB** no
   * `node_modules` de todo consumidor, incluindo um jogo que nunca fale por voz neural. E declará-lo em
   * `devDependencies`, que era o estado até 06/09, publicou uma engine que NÃO COMPILAVA para ninguém
   * (ADR-0093). A porta é a única forma que resolve as duas coisas ao mesmo tempo.
   *
   * Sem ela a narração cai na voz do navegador (Web Speech), que fala o idioma certo e não pesa nada — e o
   * painel de áudio deixa de OFERECER o motor neural, em vez de o oferecer e nunca o carregar.
   */
  readonly carregarVozNeural?: CarregarVozNeural;
  /**
   * Como se descobre que cada transporte está aqui. Ausente = a engine pergunta ao aparelho.
   *
   * Injetável porque «há um controle ligado?» e «isto é uma tela de toque?» são perguntas ao navegador, e um
   * teste que não as possa responder não consegue exercitar a tela que depende delas.
   */
  readonly disponibilidade?: Disponibilidade;
}

export interface Engine {
  readonly declaration: GameDeclaration;
  /**
   * A PAUSA QUE ESTA RAIZ MONTOU — mostrar e esconder, sem o consumidor caçar id nenhum.
   *
   * ⚠️ EXISTE PORQUE MONTAR NÃO É MOSTRAR, e a etapa 2 do ADR-0106 tinha ficado a meio sem que nada o
   * dissesse. O cartão nasce `hidden` (é assim que o `buildScreenPause` o entrega, e tem de ser: a pausa
   * abre-se, não está aberta) e QUEM O REVELA é o `ui/shell`, por fase — que esta raiz **não monta**, de
   * propósito: «não substitui o boot do main.js, que tem catorze anos de ordem própria».
   *
   * ⚠️ Sem estas duas, um jogo montado por `createGame` ficava com um cartão de pausa que NADA mostrava. Não
   * é «o consumidor esqueceu-se»: não havia por onde, a não ser procurar `#vp-pause-0` no documento — que é
   * exactamente o tipo de conhecimento que este ficheiro existe para não exigir.
   *
   * 📌 A engine OFERECE o mecanismo e não toma a fase. Quando abrir a pausa continua a ser do jogo, porque só
   * ele sabe o que é estar a jogar; o que deixa de ser dele é saber COMO.
   */
  readonly pausa: {
    /** Revela o cartão da tela `i` e refaz os itens — o §5 avaliado no instante em que ela abre. */
    readonly mostrar: (i: number) => void;
    /** Esconde-o outra vez. */
    readonly esconder: (i: number) => void;
  };
  readonly tts: ReturnType<typeof createTts>;
  readonly overlays: SettingsPanelApi;
  readonly nav: MenuNavApi;
  readonly keyboard: KeyboardRuntime;
  /**
   * APLICA O FILTRO DE VISÃO NO MUNDO QUE ESTE JOGO DECLAROU (ADR-0087).
   *
   * ⚠️ Existe porque, sem ela, cada consumidor escrevia a sua — e o `game-15puzzle` escreveu, com o
   * raciocínio certo e sozinho. O que ela acrescenta é a regra dos MENUS, que um consumidor não tem como
   * saber: eles vivem por cima da simulação e são o instrumento de sair dela, então se herdaram o filtro por
   * estarem DENTRO do mundo, ele é desfeito neles. Uma cegueira que apagasse o menu de pausa trancaria a
   * criança dentro da simulação (#82).
   */
  readonly aplicarFiltroDeVisao: (css: string, alcance: AlcanceDoFiltro) => void;
  /**
   * A NAVEGAÇÃO SONORA, pronta e ligada à declaração deste jogo (item 19).
   *
   * Ela vem de graça porque o sonar deixou de precisar de tiles: pergunta topologia (campo 1), alvos (campo
   * 5) e nome (campo 3), e o jogo já declarou os três para existir. Era o achado 9 do segundo consumidor —
   * "ligá-lo exigiria MENTIR para a engine" —, e a mentira era exigida pela FORMA da pergunta, não pelo som.
   */
  readonly sonar: AudioSonar;
  /**
   * A PILHA DE CENAS (item 22, C3 do ADR-0030), vazia e pronta.
   *
   * Vem de `createGame` e não de cada jogo pelo mesmo motivo do sonar: é infraestrutura, e um jogo que a
   * montasse sozinho montaria a décima quinta versão de push/pop. O que ela substitui é o
   * `phase: 'title' | 'playing' | 'paused'` — um enum DESTE jogo que doze módulos leem, e que um jogo com
   * mapa de fases ou tela de resultados não teria como estender sem pedir constante nova à engine (o ADR-0030
   * registra alargar a união como NÃO-opção, e é essa a razão).
   *
   * Nasce VAZIA: quem empilha é o jogo, porque quais são as cenas é a única parte disto que é dele.
   */
  readonly cenas: SceneStack;
  /** Quantos filtros de daltonismo foram montados. `0` = não havia host, e o menu visual perde metade. */
  readonly cvdFilters: number;
  /** O que FALTOU no documento do consumidor. Vazia = o hospedeiro cumpriu o contrato de marcação. */
  readonly problems: readonly string[];
  /** O que este jogo declarou não ter. Devolvido para poder ser auditado — declinar fica no registro. */
  readonly declines: Declinios;
  /**
   * O ANÚNCIO DE QUE O LAÇO PAROU, pronto para entrar em `startLoop(ticker, quadro, maxDt, { aoFalhar })`.
   *
   * ⚠️ O ADR-0054 diz por escrito que fica *"só metade verdadeiro"* enquanto isto não existir, e a metade que
   * faltava é a que importa: **criança cega não vê tela congelada.** Sem anúncio, o modo cego não distingue
   * «travou» de «está pensando», e o silêncio é a mesma coisa nos dois casos.
   *
   * ⚠️ VEM DA ENGINE E NÃO DE CADA JOGO porque a mensagem é a mesma em todos e o canal (leitor de tela +
   * narração + o que se VÊ) é infraestrutura. Mas quem chama `startLoop` é o JOGO — ele é o dono do ticker —,
   * então isto é entregue e não instalado: um jogo que monte o laço sem passar isto continua a PARAR, porque
   * parar não é opcional; o que ele perde é dizer que parou.
   */
  readonly aoFalhar: (erro: unknown) => void;
  /**
   * O ALCANCE MEDIDO NO ARRANQUE — a garantia do ADR-0079 §3 como dado, para quem quiser lê-la.
   *
   * A engine já mostrou o aviso se havia o que dizer; isto fica devolvido porque um jogo pode querer decidir
   * mais (esconder uma fase que exige doze ações, por exemplo), e porque `ok: false` é o tipo de facto que
   * tem de poder ser auditado em vez de ficar só numa tela que já fechou.
   */
  readonly alcance: Alcance;
}

/** Os ids que os painéis emprestados exigem do documento. Achado 6: sem eles o painel abre VAZIO, sem erro. */
const MARCACAO_EXIGIDA: readonly string[] = ['#game-region', '#sr-status', '#sr-alert'];

/**
 * Onde a engine procura a barra de acessibilidade quando o jogo não declara `host.a11yBarHost`.
 *
 * ⚠️ NÃO ENTROU NA `MARCACAO_EXIGIDA` de propósito, e a diferença é de mensagem e não de rigor. Aquela lista
 * produz «marcação ausente: #x», que é o que se diz de um id que o jogo esqueceu. Aqui o que falta não é um
 * id — é a barra inteira, e cinco jogos do catálogo não a têm porque ninguém lhes disse que a deviam ter. A
 * frase própria pode explicar O QUE se perde, e é isso que a torna útil a quem a lê pela primeira vez.
 */
const SELETOR_BARRA_A11Y = '#title-icons';

/**
 * Liga a engine para um jogo declarado.
 *
 * ⚠️ LANÇA se a declaração for malformada, e NÃO lança se faltar marcação. A diferença não é gosto: uma
 * declaração errada é defeito de PROGRAMA, e um jogo que roda meio declarado é pior do que um que não abre;
 * um id ausente é lacuna do HOSPEDEIRO, e o quiz provou que ligar só a parte que serve é legítimo — foi
 * assim que ele recusou o pad e o sonar sem mentir. Por isso um vira exceção e o outro vira `problems`.
 */
export function createGame(o: CreateGameOptions): Engine {
  const problemasDoContrato = conformanceProblems(o.declaration);
  if (problemasDoContrato.length) {
    throw new Error('createGame: declaração malformada — ' + problemasDoContrato.join('; '));
  }

  const { doc, win } = o.host;
  const declines = o.declines ?? {};
  const problems: string[] = [];

  const $ = <T extends Element = Element>(sel: string): T | null => doc.querySelector<T>(sel);
  const $$ = <T extends Element = Element>(sel: string): T[] => [...doc.querySelectorAll<T>(sel)];

  for (const sel of MARCACAO_EXIGIDA) {
    if (!$(sel)) problems.push(`marcação ausente: ${sel}`);
  }

  // ⚠️ O MUNDO DECLARADO TEM DE EXISTIR NO DOCUMENTO, e esta é a falha que o ADR-0087 deixaria aberta se
  // parasse na conformidade. `conformanceProblems` confere a FORMA — que há um seletor e que ele não está
  // vazio — e não tem como conferir se ele CASA alguma coisa, porque `core/contract` é puro e não vê DOM.
  //
  // Um seletor com erro de digitação (`#gaem-region`) passa na conformidade e produz exatamente o defeito
  // que o registro existe para eliminar: a simulação de empatia aplicada a NADA, e um adulto informado de
  // que sentiu algo que não sentiu. É um problema do HOSPEDEIRO e não do programa, então entra em
  // `problems` como as marcações — o jogo abre, e quem o integrou lê que o mundo dele não está lá.
  const mundo = o.declaration.world();
  if (mundo.kind === 'element' && !$(mundo.selector)) {
    problems.push(`mundo declarado não encontrado: ${mundo.selector}`);
  }

  // 1. IDIOMA ANTES DE TUDO. A interface não pode ser construída antes de a língua ser conhecida — foi o que
  //    o item 14 consertou movendo `initI18n()` para o topo do boot. O documento entra: ver o achado 15.
  initI18n(doc);

  // 2. MIXER ANTES DA VOZ. O achado 3, virado sequência: quem chama não tem como inverter estas duas linhas.
  initAudioMixer();
  const tts = createTts({
    srSay, srAlert, ensureAC, catNode, audioOut,
    getSoundOn: () => soundOn, getVolume: () => volume, getAudioCat: () => audioCat,
    carregarVozNeural: o.carregarVozNeural,
  });
  if (!o.carregarVozNeural && !declines.semVozNeural) {
    problems.push(
      'sem voz neural: declare `carregarVozNeural` (uma linha — ver ADR-0094) ou `declines.semVozNeural`. '
      + 'Sem ela a criança que não lê fica com a voz do sistema, que em Chromebook de escola pode não existir '
      + 'em português',
    );
  }

  /**
   * O FILTRO DE VISÃO, aplicado ao MUNDO QUE O JOGO DECLAROU (ADR-0087).
   *
   * ⚠️ E A REGRA DOS MENUS É UMA GENERALIZAÇÃO, não uma segunda regra. O jogo próprio da engine limpava o
   * filtro em `#dom-layer` porque ele está DENTRO de `#game-region` e um filtro CSS herda — sem isso, uma
   * simulação de cegueira apagaria o menu de pausa e trancaria a criança dentro dela (#82). O 15-puzzle não
   * tem nada dentro, e a mesma linha não faz nada. Um só código serve às duas formas porque ele pergunta ao
   * DOM em vez de assumir a forma: limpa o filtro nos overlays que ESTEJAM dentro do mundo.
   *
   * ⚠️ `{kind:'none'}` NÃO APLICA NADA. Uma atividade sem espaço não tem mundo para simular, e pintar um
   * filtro sobre ela seria a mentira que o ADR-0087 existe para impedir, só que ao contrário.
   */
  function aplicarFiltroDeVisao(css: string, alcance: AlcanceDoFiltro): void {
    const mundo = o.declaration.world();
    if (mundo.kind !== 'element') return;
    const el = $<HTMLElement>(mundo.selector);
    if (!el) return; // já reportado em `problems`; não se inventa superfície
    el.style.filter = css;
    if (alcance === 'mundo') {
      // Os menus vivem POR CIMA da simulação e são o instrumento de sair dela: se herdaram o filtro por
      // estarem dentro do mundo, desfaz-se neles.
      for (const ov of $$<HTMLElement>(OVERLAY_SCOPE_SELECTOR)) {
        if (el.contains(ov)) ov.style.filter = '';
      }
    }
  }

  // 3. A pilha de diálogos. O ctx é o mesmo em qualquer jogo — é boilerplate, e boilerplate repetido é onde
  //    consumidores divergem sem querer.
  const overlays = initSettingsPanel({
    $, $$, doc,
    computedZ: (el) => +win.getComputedStyle(el).zIndex || 0,
  });

  // 4. Daltonismo: a engine ENTREGA o markup em vez de exigir que o consumidor o adivinhe (achado 7).
  const cvdFilters = installCvdFilters(o.host.cvdHost ?? null);
  if (!cvdFilters) problems.push('sem host de filtros (<svg>): a correção de daltonismo não foi montada');

  // 4c. A BARRA DE ACESSIBILIDADE DA PRIMEIRA TELA. Ver a nota em `EngineHost.a11yBarHost`: cinco dos seis
  //     jogos do catálogo não têm nenhuma, e nada o dizia. Isto não a monta — diz que ela falta, que é o
  //     passo que tira o silêncio. A frase nomeia a saída, como as outras deste bloco fazem.
  const a11yBar = o.host.a11yBarHost ?? $(SELETOR_BARRA_A11Y);
  if (!a11yBar) {
    problems.push(
      `sem barra de acessibilidade na primeira tela: declare \`host.a11yBarHost\` ou ponha um ${SELETOR_BARRA_A11Y} no documento. Sem ela a criança não alcança modo cego, TTS, alto contraste nem Libras antes de começar`,
    );
  }

  /*
   * ⚠️ E AGORA A ENGINE MONTA-A (ADR-0106 §4, etapa 2). Até 2026-09-08 esta raiz só REPORTAVA a ausência, e o
   * registo dizia porquê: «reportar não é oferecer — cinco jogos continuam sem barra até alguém agir na
   * linha». A etapa 1 tirou dos sete campos acidentais a obrigação de virem do jogo, e a 3 deu lista padrão
   * ao menu; com isso o `PauseIconsCtx` deixou de exigir seja o que for que esta raiz não saiba responder.
   *
   * ⚠️ NÃO É `buildQuickBar`, e a diferença tem dono: aquele põe `tabIndex = -1` nos botões porque durante a
   * partida dez paradas de tabulação separam a criança do jogo (ADR-0044 item 7). Na primeira tela não se
   * está a jogar, e tirar os ícones da ordem de tabulação ali seria escondê-los de quem navega por teclado —
   * exactamente a pessoa para quem eles existem.
   */
  /**
   * O LEITOR DO MODO CEGO — e ele tem de ler ONDE O ESCRITOR PADRÃO ESCREVE.
   *
   * 🔴 ESTAS DUAS METADES GANHARAM PADRÃO EM DIAS DIFERENTES E NÃO SE FALAVAM, o que produziu um defeito que
   * nenhum teste podia ver. O escritor recebeu o padrão da engine na etapa 1b do ADR-0106
   * (`ui/pause-icons` → `ctx.setModoCego ?? setModoCegoValue`), que grava no `core/state`. O leitor ficou com
   * o `() => false` que já cá estava — uma CONSTANTE. Num jogo que não injecta `isBlindMode`:
   *
   *   1. a criança carrega no ícone → `setModoCego(!false)` → o modo LIGA de verdade;
   *   2. o reflexo lê `false` → o ícone diz «desligado» e o anúncio diz o mesmo;
   *   3. ela carrega outra vez → `setModoCegoValue(!false)` = `true` OUTRA VEZ → a guarda de igualdade do
   *      `core/state` devolve cedo → nada acontece.
   *
   * ⚠️ O modo cego ligava uma vez e NÃO HAVIA COMO DESLIGAR — um jogo que começa a descrever tudo em voz alta
   * e não se cala, sem erro em lado nenhum. Para quem não depende dele, é o jogo a ficar inutilizável.
   *
   * 📌 UMA CONSTANTE E NÃO A EXPRESSÃO REPETIDA NOS DOIS SÍTIOS, porque a repetição É o defeito: duas
   * respostas à mesma pergunta divergem, e foi assim que esta divergiu. `import * as state` dá ligação VIVA,
   * então isto lê o valor de agora e não o do arranque.
   */
  const lerModoCego = o.isBlindMode ?? (() => state.modoCego);

  const pauseIcons = initPauseIcons({
    doc,
    /*
     * A RESPOSTA DO JOGO, lida da declaração (ADR-0115). Sem ela o ícone `altmove` não é montado.
     *
     * ⚠️ LIDA UMA VEZ, NO ARRANQUE, e a razão não é economia — é a criança. O campo é uma FUNÇÃO porque o
     * ADR-0084 diz que um jogo muda de exigência entre fases, mas a COMPOSIÇÃO DA BARRA não pode mudar
     * debaixo da mão de quem está a usá-la: um ícone que aparece e some entre fases é pior do que um que
     * nunca esteve lá, e para quem navega por teclado desloca a ordem de tabulação a meio.
     * 📌 Logo a leitura correcta do contrato é «este jogo segura teclas em ALGUMA fase» — um jogo que segura
     * a pé e nada dentro de um veículo declara `true`, e o registo não disse isto porque a pergunta só
     * aparece quando se monta a barra.
     */
    seguraTeclas: o.declaration.seguraTeclas(),
    getPlayers: () => o.players ?? [],
    getNumPlayers: () => (o.players ?? [null]).length,
    srSay, srAlert,
    // ⚠️ NÃO `instanceof HTMLElement`: esse é um GLOBAL DO NAVEGADOR, e lê-lo onde ele não existe LANÇA —
    // não devolve falso. Escrito assim na etapa 2, fazia o `reflectPauseIcons` rebentar em qualquer ambiente
    // sem DOM. É o mesmo erro de forma do ACHADO 15 no cabeçalho deste ficheiro: alcançar o global por baixo
    // de quem injectou o documento. A pergunta certa é a mesma que o `barraUsavel` faz — sabe ser uma barra?
    getA11yBars: () => (barraUsavel && a11yBar ? [a11yBar as HTMLElement] : []),
    getModoCego: lerModoCego,
    getAudioCat: () => audioCat,
    setCatGain,
    /*
     * ⚠️ QUEM RESPONDE PELO APARELHO EM USO É A RAIZ, e é aqui que o autómato do ADR-0109 ganha o primeiro
     * leitor. `input/state.entradaDe(i)` devolve `PADRAO` para quem nunca produziu uma aresta, logo isto
     * nunca é `undefined` e o ícone nunca escreve numa chave torta.
     *
     * 📌 E é a RAIZ que o passa, não o ícone que o importa: `ui/` a ler estado de módulo de `input/` seria
     * uma aresta nova entre camadas para poupar um argumento. A composição é o trabalho deste ficheiro.
     */
    transporteEmUso: (i: number) => entradaDe(i).emUso,
    reflectTtsPanel: () => {},
    reflectTtsPanelEnabled: false,
    isLibrasOn: vlibrasOpen,
    toggleLibras,
  });

  /*
   * ⚠️ O HOSPEDEIRO TEM DE SABER SER UMA BARRA, e perguntar isso não é zelo: `a11yBarHost` é `Element` no
   * tipo, e um consumidor pode passar um duplo, um nó de outro documento, ou um elemento de um `<svg>`. Sem
   * esta guarda, um objecto sem `addEventListener` derruba o BOOT INTEIRO — e derrubá-lo por causa da barra
   * de acessibilidade seria tirar o jogo a toda a gente para não o dar a ninguém.
   *
   * Não sabendo, é `problems` como qualquer outra lacuna do hospedeiro: o consumidor lê e conserta.
   */
  const barraUsavel = !!a11yBar
    && typeof (a11yBar as HTMLElement).addEventListener === 'function'
    && 'innerHTML' in a11yBar;
  if (a11yBar && !barraUsavel) {
    problems.push(
      'o elemento da barra de acessibilidade não aceita conteúdo nem clique: os ícones não foram montados',
    );
  }

  if (a11yBar && barraUsavel) {
    a11yBar.innerHTML = iconsMarkup(pauseIcons.iconesMontados);
    a11yBar.addEventListener('click', (e) => {
      const botao = (e.target as Element | null)?.closest<HTMLElement>('.pi-btn');
      if (!botao) return;
      pauseIcons.iconAct(botao.dataset.pi ?? '', 0);
      pauseIcons.reflectIconsIn(a11yBar, 0);
      // O anúncio lê o `aria-label` DEPOIS do reflexo, porque é ele que carrega o estado NOVO — anunciar
      // antes diria o estado que a criança acabou de deixar.
      srSay(botao.getAttribute('aria-label') ?? '');
    });
    pauseIcons.reflectIconsIn(a11yBar, 0);

    /*
     * ⚠️ E OUTRA VEZ QUANDO O IDIOMA DO ARRANQUE CHEGAR — sem isto a barra fica no idioma de RECUO.
     *
     * O `initI18n` aplica pt de forma síncrona (para a página nunca ficar em branco) e, se o idioma
     * preferido for outro, PEDE a troca — que é assíncrona, porque en/es são chunks sob demanda. Esta
     * marcação nasce nesse intervalo. 📏 Medido num navegador em 2026-09-08, com `lang="en"`: a barra
     * servia cinco rótulos em inglês e três ainda em português, na mesma linha de ícones.
     *
     * 📌 O `idiomaPronto()` existe exactamente para isto, e o cabeçalho dele já descreve o defeito noutro
     * lugar: «o `applyDom` conserta o markup ESTÁTICO, mas o que o JavaScript monta tinha capturado o
     * texto de pt e ninguém reconstruía». A barra é a instância nova, criada quando a ENGINE passou a
     * montá-la (ADR-0106 etapa 2).
     *
     * ⚠️ É O `idiomaPronto()` E NÃO O EVENTO `i18n:change`, de propósito: o evento é a troca de idioma EM
     * EXECUÇÃO, e o próprio `core/i18n` declara essa pergunta como sendo do Dev («QUANDO a interface se
     * reconstrói ao trocar de idioma em execução»). Isto responde só a pergunta do ARRANQUE, que aquele
     * mesmo comentário diz não ter duas respostas.
     */
    void idiomaPronto().then(() => { pauseIcons.reflectIconsIn(a11yBar, 0); });

    /*
     * ⚠️ E ELA TEM DE CONTINUAR A DIZER A VERDADE quando o estado muda NOUTRO SÍTIO. O modo cego liga-se
     * também pelo painel de áudio e pela simulação de empatia; sem esta assinatura, o ícone da barra ficaria
     * a dizer «desligado» com `aria-pressed=false` depois de a criança o ter ligado — o controlo a mentir o
     * estado, que é a família de defeito que o `reflectTTS` e o `#opt-modocego` já custaram a este projeto.
     *
     * 📌 SÓ O MODO CEGO, e a limitação é medida e não preguiça: dos ícones que esta raiz monta, ele é o ÚNICO
     * cujo estado tem evento (`EventoDoJogo` tem `modoCego`; TTS, Libras, TEA e alternância não emitem nada).
     * Os outros continuam a refletir-se ao clique, que é o caminho por onde hoje eles mudam.
     */
    state.on('modoCego', () => { pauseIcons.reflectIconsIn(a11yBar, 0); });
  }

  // 4d. QUEM ABRIU A PAUSA, quando há mais de um assento — o achado 3 da auditoria do `game-soccer`.
  //
  // ⚠️ O PAINEL DE CONTROLE É PARAMETRIZADO PELO ASSENTO: `render(selPlayer)` desenha as posições DAQUELE
  // esquema, e não há selector de assento — o `#ctrl-players` é uma FRASE, não abas. Quem decide o assento é
  // o consumidor, passando o ator da pausa: «edita o controle de quem abriu o menu».
  //
  // ⚠️ E É AQUI QUE ISTO FICA MUDO. O `setPauseActor` desta raiz é `() => {}` — literal, logo abaixo. Um jogo
  // montado por `createGame` com dois assentos deixa a criança do SEGUNDO sem como remapear, e nada o diz.
  // Não é a mesma coisa que declarar `semAtorDePausa`: essa é uma ausência declarada, e uma ausência
  // declarada é uma escolha. Esta era uma ausência por omissão, que é a forma de defeito do ADR-0106 §2.
  const assentos = (o.players ?? []).length;
  if (assentos > 1 && !declines.semAtorDePausa) {
    problems.push(
      `declarou ${assentos} jogadores e não registra o ator da pausa: o painel de controle edita sempre o `
      + 'assento 0, então ninguém além do primeiro consegue remapear. Declare `declines.semAtorDePausa` se '
      + 'for de propósito',
    );
  }

  /*
   * 4e. O CARTÃO DE PAUSA DA PRIMEIRA TELA — e isto fecha um LAÇO QUE ESTAVA ABERTO.
   *
   * 📏 MEDIDO EM 2026-09-08, nos seis jogos do catálogo local: `#vp-pause-0` é procurado por esta raiz (o
   * `getPauseMenu` do `initMenuNav`, mais abaixo) e **NENHUM jogo o cria**. `git grep vp-pause` devolve zero
   * em `game-platformer`, `game-soccer`, `pixi-15-puzzle`, `2048`, `whackwhack` e `game-chess`. Ou seja: a
   * engine inventou uma convenção, procurou-a, não a achou, e concluiu em silêncio que nenhum jogo tem menu
   * de pausa — que é a MESMA forma de defeito do ADR-0106 §2, desta vez cometida pela engine contra si mesma.
   *
   * Agora ela cria o que procura. Quem declina (`semMenuDePausa`) continua sem nada e sem acusação — declinar
   * é escolha; não ter é omissão.
   */
  const hospedeiroDaPausa = declines.semMenuDePausa ? null : (o.host.pauseHost ?? $('#game-region'));
  const pausaUsavel = !!hospedeiroDaPausa && typeof (hospedeiroDaPausa as HTMLElement).appendChild === 'function';
  if (!declines.semMenuDePausa && !pausaUsavel) {
    problems.push(
      'sem sítio para o menu de pausa: declare `host.pauseHost` ou tenha um #game-region que aceite filhos. '
      + 'Sem ele a criança não alcança os ajustes durante a partida, e `declines.semMenuDePausa` é como se diz '
      + 'que isso é de propósito',
    );
  }
  if (hospedeiroDaPausa && pausaUsavel) {
    const cartao = pauseIcons.buildScreenPause(0);
    // ⚠️ O ID É O QUE A PRÓPRIA ENGINE PROCURA, logo abaixo, no `getPauseMenu`. Montar sem o pôr deixaria o
    // laço tão aberto como estava — o cartão existiria e a navegação de menu continuaria a não o achar.
    cartao.id = 'vp-pause-0';
    hospedeiroDaPausa.appendChild(cartao);
  }

  // 4b. NAVEGAÇÃO SONORA. Só o contrato entra: nada de tile, caixa de colisão ou array de moedas.
  const sonar = createAudioSonar({
    topology: () => o.declaration.topology(),
    targetsOf: (i) => o.declaration.targetsOf(i),
    nameAt: (at) => o.declaration.nameAt(at),
    // Campo 2 + o barramento do mixer: o que o GUIA CONTÍNUO precisa e o bipe não precisava (#84 item 2). O
    // `roleAt` é o que deixa a rota contornar parede; o `catNode`/`audioOut`/`getVolume` são o que põem um
    // grafo PERMANENTE no mesmo cursor de volume que todo o resto do áudio usa.
    roleAt: (at) => o.declaration.roleAt(at),
    tonePan, srSay, narrate: (texto) => tts.narrate(texto),
    catNode, audioOut, getVolume: () => volume,
    // ⚠️ A RESPOSTA, E NÃO A TABELA (#104). O `platform/audio-sonar` recebia o `VIZ_BY_KEY` e atravessava-o
    // com `pl.viz`; ele deixou de saber o que é um modo visual, e quem responde é aqui — a raiz é a única
    // camada que conhece os dois eixos E pode importar de `render/`.
    visaoComprometida: (pl) => {
      const v = (pl as { visual?: VisualState }).visual;
      return !!v && (ehCego(v) || ehBaixaVisao(v));
    },
    getModoCego: lerModoCego, LOGICAL_W,
    // O jogador DERIVADO do foco: campo 4 respondendo "onde a criança está". Um jogo que não fornece lista
    // ainda tem sonar, e é isso que faz a pilha de acessibilidade não ser acessório.
    getPlayers: o.sonarPlayers ?? (() => {
      const f = o.declaration.focusOf(0);
      return f ? [{ i: 0, x: f.at.x, y: f.at.y, visual: PADRAO }] : [];
    }),
    getNumPlayers: () => (o.players ?? [null]).length,
    getAudioCtx: () => audioCtx, getSoundOn: () => soundOn, getAudioCat: () => audioCat,
  });

  // 5. Teclado remapeável — o melhor recorte da base (achado 11): esquema de teclas, sem mundo.
  initKB();
  // ⚠️ O ESQUEMA DE ARRANQUE ALCANÇA NADA, e diz isso com `null` em vez de com um objeto vazio (issue #118).
  // Ele vive um instante — `assignControls()` logo abaixo substitui-o pelo esquema real —, mas enquanto vive
  // é um `KeyScheme` como qualquer outro, e a única forma honesta de um esquema que não alcança nada é
  // catorze ausências declaradas. Um `{}` fazia o tipo mentir sobre estar completo.
  const semAlcance = Object.fromEntries(ACTIONS.map((a) => [a, null])) as KeyScheme;
  const players = o.players ?? [{ ctrl: semAlcance }];
  const keyboard = initKeyboardRuntime({
    getKB: () => kb, getNumPlayers: () => players.length, getPlayers: () => players,
  });
  keyboard.assignControls();

  // 6. Navegação de menu. Os três declínios entram como AUSÊNCIA DECLARADA, não como getter que devolve null.
  const nav = initMenuNav({
    $, getActiveElement: () => doc.activeElement,
    topVisibleOverlay: overlays.topVisibleOverlay, closeById: overlays.closeById,
    getPauseMenu: declines.semMenuDePausa ? () => null : (i) => $<HTMLElement>(`#vp-pause-${i}`),
    setPhase: o.setPhase ?? (() => {}),
    setPauseActor: () => {},
    srSay,
    // Sem opinião declarada, o índice fica LIGADO: quem precisa dele para se orientar não tem como saber
    // que ele existe se vier desligado (a mesma razão de o modo cego nascer com TTS e sonar).
    comIndice: o.comIndice ?? (() => true),
    isNavigable: o.isNavigable ?? (() => true),
    /*
     * ⚠️ ESTE PADRÃO ERA `() => false` / `() => {}`, E DESDE HOJE ISSO SERIA UM BURACO QUE EU ABRI. O
     * comentário que estava aqui dizia «um hospedeiro que não tenha barra de acessibilidade responde nunca e
     * nunca chama nada» — verdade até a etapa 2 do ADR-0106, quando esta raiz passou a MONTAR a barra.
     *
     * Com a barra montada e estes dois em no-op, ela existiria e **não se conseguiria navegar por teclado nem
     * por controle**: alcançável só por ponteiro. Para uma criança cega, que navega por teclado, uma barra
     * que ela não alcança é o mesmo que barra nenhuma — e é exactamente o «oferece o caminho e depois
     * recusa-o» que o §5 do ADR-0106 proíbe.
     *
     * A engine responde com a SUA instância, que é a mesma que montou a barra. Quem injecta continua a mandar.
     *
     * ⚠️ E FICA UMA METADE POR LIGAR, dita aqui em vez de descoberta: o `navBar` do `ui/menu-nav` recebe
     * `(i, k)` e não o terceiro argumento `temStart`, que é a borda do botão de pausa — a SEGUNDA saída do
     * modo (ADR-0044 item 7). No cartucho ela chega por outra rota (o encaminhador do gamepad, `main.ts:1470`)
     * que esta raiz ainda não monta. Logo: o direcional navega a barra; sair por START, por enquanto, não.
     */
    naBarraDe: o.naBarraDe ?? ((i) => pauseIcons.naBarraDe(i)),
    navBar: o.navBar ?? ((i, k) => pauseIcons.navBar(i, k)),
    isCapturing: () => false,
    closePadWiz: () => {},
    whichPlayer: (code) => keyboard.whichPlayer(code),
    actionOf: (code, i) => keyboard.actionOf(code, i),
    // Achado 12, RESOLVIDO NA ENGINE: o ctx tipava `win` com `fn: (e: never) => void`, o `window` real não
    // casava, e cada consumidor escrevia o mesmo adaptador de uma linha. A porta agora é genérica sobre
    // `WindowEventMap` (ver `EventTargetLike` em input/touch-bindings), então o `window` entra direto.
    win,
  });

  // ⚠️ E AGORA LIGA. A `nav` era montada aqui e ficava desligada — `MenuNavApi.attach()` existia, `menu-nav.ts`
  // descrevia-a como estando ali "para o game.js instalar exatamente como antes", e `createGame` nunca a
  // chamava. O efeito num jogo que arranque pela engine: os diálogos de acessibilidade e o menu de pausa
  // respondem só ao RATO, o que é o pilar 2 a falhar por inteiro — e o `consumer-quiz` teve de a chamar à mão
  // depois do `createGame`, que é o sintoma da fronteira estar no lugar errado.
  //
  // Um fio que a engine MONTA e não liga é pior do que um que ela não monta: a ausência seria visível — o
  // objeto tem uma `nav`, e ela parece pronta.
  //
  // Instalar aqui é seguro antes de o jogo acabar de arrancar: sem diálogo aberto e sem menu de pausa,
  // `menuNavKey` não consome tecla nenhuma e a deixa seguir para quem for o dono.
  nav.attach();

  // ⚠️ E A ARMADILHA DE FOCO, que não existia em lado nenhum — os outros dois fios eram montados e deixados
  // desligados; este nunca tinha sido escrito. Com um overlay aberto, o Tab entrava no tabuleiro por baixo,
  // enquanto todo `.overlay__card` do documento diz `aria-modal="true"`. Uma promessa que o teclado desmente
  // é pior do que promessa nenhuma: quem usa leitor de tela sai para um jogo cujo estado não percebe.
  initFocusTrap({
    overlayDeCima: overlays.topVisibleOverlay,
    focoAtual: () => doc.activeElement,
    focaveisDe: focaveisNoDom,
    win,
  }).attach();

  /**
   * O ALCANCE: entre os transportes DISPONÍVEIS a esta criança, algum carrega as ações deste jogo?
   *
   * ⚠️ A detecção segue o que o projeto JÁ usa para a mesma pergunta (`isCoarsePointer` em `game/session`):
   * `pointer:coarse && hover:none` é toque, e o contrário é teclado. Ela erra num tablet COM teclado — e o
   * erro só é tolerável porque a tela INFORMA em vez de recusar. Ver o cabeçalho de `ui/reach-notice`.
   */
  const disponibilidade: Disponibilidade = o.disponibilidade ?? {
    gamepad: () => { try { return [...(win.navigator?.getGamepads?.() ?? [])].some(Boolean); } catch { return false; } },
    toque: () => { try { return win.matchMedia('(pointer:coarse)').matches && win.matchMedia('(hover:none)').matches; } catch { return false; } },
    teclado: () => { try { return !(win.matchMedia('(pointer:coarse)').matches && win.matchMedia('(hover:none)').matches); } catch { return true; } },
    /**
     * O RATO (ADR-0112) — e a sonda é `any-pointer` de propósito, não `pointer`.
     *
     * ⚠️ `(pointer:fine)` descreve o ponteiro PRIMÁRIO, então um tablet com rato ligado responde «coarse» e
     * o rato desaparecia — exactamente o aparelho que esta pergunta existe para achar. `any-pointer:fine` diz
     * «ALGUM dos dispositivos apontadores é fino», que é a pergunta certa: para desenhar basta um.
     *
     * ⚠️ ELA ERRA, e a direcção do erro é a que se aceita: um stylus também responde `fine`, e é um ponteiro
     * a sério — logo isso não é erro. O que pode faltar é um rato ligado depois do arranque, e por isso a
     * sonda é uma FUNÇÃO, avaliada a cada pergunta, como as três acima.
     */
    rato: () => { try { return win.matchMedia('(any-pointer:fine)').matches; } catch { return false; } },
  };
  const acoesDoJogo = o.preset ? presetActions(o.preset) : [];
  // O segundo eixo entra aqui, e vem do jogo (ADR-0104 §A): quantas posições ele segura ao mesmo tempo.
  // ⚠️ O TERCEIRO EIXO ENTRA AQUI (ADR-0112), e vem do jogo tal como os outros dois. `?? false` e não um
  // padrão inventado: o campo é opcional de propósito — ver a nota nele —, e a ausência significa «este jogo
  // não desenha», que é a resposta certa para a esmagadora maioria dos trezentos.
  const alcanceAqui = alcance(
    transportesPadrao(disponibilidade),
    acoesDoJogo,
    o.declaration.holdsAtOnce(),
    o.declaration.needsPointer?.() ?? false,
  );

  // ⚠️ SÓ APARECE QUANDO HÁ O QUE DIZER. Um aviso que aparece sempre deixa de ser lido, e um jogo cujas ações
  // cabem no toque não tem nada a avisar — que é o caso comum e tem de continuar silencioso.
  if (acoesDoJogo.length) {
    mostrarAvisoDeAlcance({
      procurar: (sel) => $<HTMLElement>(sel),
      criar: (tag) => doc.createElement(tag),
      t,
      srAlert,
    }, alcanceAqui);
  }

  // O ANÚNCIO DE QUE O LAÇO PAROU (ADR-0054). Entregue e não instalado: quem chama `startLoop` é o JOGO, que
  // é o dono do ticker. Um jogo que monte o laço sem passar isto continua a PARAR — parar não é opcional; o
  // que ele perde é dizer que parou.
  const aoFalhar = criarAvisoDeQueda({
    procurar: (sel) => $<HTMLElement>(sel),
    criar: (tag) => doc.createElement(tag),
    narrar: (texto) => tts.narrate(texto),
  });

  /*
   * ⚠️ MOSTRAR REFAZ OS ITENS ANTES DE REVELAR, e a ordem é a regra: o §5 do ADR-0106 diz que a criança nunca
   * vê um item que não acciona, e a tabela de acções deste jogo pode ter mudado desde a montagem. Revelar
   * primeiro e refazer depois deixaria um piscar em que ela vê o que não pode usar.
   */
  const pausa = {
    mostrar: (i: number) => {
      pauseIcons.reflectPauseIcons();
      const cartao = $<HTMLElement>(`#vp-pause-${i}`);
      if (cartao) cartao.hidden = false;
    },
    esconder: (i: number) => {
      const cartao = $<HTMLElement>(`#vp-pause-${i}`);
      if (cartao) cartao.hidden = true;
    },
  };

  return { declaration: o.declaration, pausa, tts, overlays, nav, keyboard, sonar, aplicarFiltroDeVisao, cenas: criarPilha(), cvdFilters, problems, declines, aoFalhar, alcance: alcanceAqui };
}
