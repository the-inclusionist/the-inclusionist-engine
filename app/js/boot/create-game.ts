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
// que separa um achado de um verde falso. Aqui ela vira TIPO: um jogo que não tem uma peça declara-o num
// campo em vez de devolver `null` de um getter e torcer. O que se declina fica registrado no objeto devolvido,
// e um consumidor pode ser auditado pelo que recusou.
// ⚠️ E ESTE PARÁGRAFO NÃO NOMEIA NENHUM DOS CAMPOS, o que parece esquisito e é medido: o
// `tests/declinio-morto` conta MENÇÕES, incluindo as de comentário, e fá-lo de propósito — «falhar para o lado
// de vivo é a direcção certa deste erro», porque uma acusação falsa desliga um gate. A consequência é que usar
// um declínio como EXEMPLO em prosa o faz parecer lido, e um campo genuinamente morto deixa de ser acusado.
// 📌 O primeiro rascunho desta nota fez exactamente isso, e o crivo apanhou-o no mesmo minuto.
//
// ========================= O QUE ISTO AINDA NÃO FAZ, DITO AQUI E NÃO ESCONDIDO =========================
// Não liga render, física, tiles nem o sonar — nada disso é de todo jogo, e o achado 9 mostra que o sonar hoje
// exige seis coisas de plataforma. Não substitui o boot do `main.js`, que tem catorze anos de ordem própria.
// O que ele cobre é o que o quiz provou ser IDÊNTICO em qualquer jogo: idioma, leitor de tela, mixer, voz,
// pilha de diálogos, filtros de daltonismo, teclado remapeável e navegação de menu.
import i18nObject, { initI18n, dictionaryGaps, loadLocale, applyDom } from '../core/i18n.js';
import { localeHostHooks, exposeI18n } from '../platform/locale-host.js';
import { inputOf, keys, markKeyFrom, releaseKey, playerEdge } from '../input/state.js';
import { initTouch, mountTouchControls, touchGaps } from '../input/touch.js';
import { initTouchBindings } from '../input/touch-bindings.js';
import { createCrashNotice } from '../ui/loop-crash.js';
import { registerCrashNotice } from '../core/loop.js';
import { sampleFlashes, type FlashMeasurement } from '../platform/flash-sampler.js';
import { initFocusTrap, focusablesInDom } from '../ui/focus-trap.js';
import { showReachNotice, REACH_NOTICE_ID } from '../ui/reach-notice.js';
import { reach, defaultTransports, type Reach, type Availability } from '../input/transports.js';
import { accommodationAnswersProblems, subjectWord, type AccommodationAnswers } from '../core/accommodations.js';
import { genreProblems, genreWarning } from '../core/genres.js';
import { cartridgeProblems } from '../core/cartridge-problems.js';
import { contractSubjects } from '../core/accommodation-subjects.js';
import { presetActions, startClaimProblem, selectClaimProblem, labellerFrom, shortLabellerFrom, ACTIONS, type Action, type ActionPreset } from '../core/actions.js';
import type { KeyScheme } from '../core/entity.js';
import { t } from '../core/i18n.js';
import { srSay, srAlert } from '../core/a11y-sr.js';
import { createEyeControl, videoFeed } from '../ui/eye-control.js';
import { createFaceControl } from '../ui/face-control.js';
import { createHandControl } from '../ui/hand-control.js';
import { followCameraMode } from '../ui/camera-control.js';
import { initPauseIcons, wireBarCaption, showPauseOptions } from '../ui/pause-icons.js';
// 📌 The bar's markup is a pure string builder and lives with the rest of the pause markup (ADR-0221, issue #203); what this
// root asks `ui/pause-icons` for is the WIRING — the icons this game can actually act on, and the reflection of their state.
import { iconsMarkup } from '../ui/pause-markup.js';
import { accessibleLabel } from '../core/accessible-label.js';
import { helpRows, mountSlides, showSlide, animateFigure, howToPlayProblems, type HowToPlaySlide } from '../ui/help-panel.js';
import { initSettingsControls, type SettingsControlsApi } from '../ui/settings-controls.js';
import { keyName } from '../ui/control-choices.js';
import { reserveTopBand } from '../ui/top-band.js';
// O módulo INTEIRO: o on do barramento de eventos, para a barra montada continuar a dizer a verdade.
import * as state from '../core/state.js';
import type { CameraControl } from '../core/state.js';
import { vlibrasOpen, toggleLibras } from '../ui/vlibras.js';
import { conformanceProblems, type GameDeclaration } from '../core/contract.js';
import { createSceneStack, type SceneStack } from '../core/scenes.js';
import { createTts } from '../platform/tts.js';
import { createReading, type Reading, type ListenOptions } from '../platform/reading.js';
import { ensureAC, catNode, audioOut, soundOn, setSoundOn, volume, setVolume, audioCat, initAudioMixer, tonePan, audioCtx, setCatGain, setHearingLossGraph } from '../platform/audio.js';
import { createAudioSonar, type AudioSonar, type SonarPlayer } from '../platform/audio-sonar.js';
// A raiz é a camada que PODE conhecer os dois eixos: `render/` está abaixo dela, e é dela a tarefa de
// responder ao `platform/audio-sonar`, que não pode importar daqui sem inverter uma aresta (#104).
import { isBlind, isLowVision, DEFAULT_VISUAL, filterKey, simulationUnavailable, type VisualState, type Theme, type Correction } from '../render/viz-axes.js';
// 📌 A tabela modo → `url(#...)`, que `render/cvd-matrices` já instala e o `consumer-quiz` já consome.
import { VIZ_FILTER } from '../render/viz-modes.js';
import { createPadWizard } from '../input/pad-wizard.js';
import { typographyCycle, CYCLE_START, FONT_BY_KEY } from '../ui/fonts.js';
import { bcp47 } from '../core/i18n.js';
// 📏 ERAM OITO NOMES ATÉ 22/09. Os cinco que saíram — `barIntruders`, `belowFloor`, `minimumTarget`, `Box` e `NodeMeasure` —
// foram com os dois relatores de desenho para `ui/drawing-problems` (ADR-0221, issue #203), e a raiz deixou de os conhecer.
// Um import que se pode apagar é acoplamento que deixou de existir, e é assim que esta dívida se paga: por assunto.
import { stageScale, applyScale, type Scale } from '../ui/layout.js';
import { screenBaseSize } from '../core/screens.js';
import { OVERLAY_SCOPE_SELECTOR } from '../ui/settings-panel.js';
import { drawnBelowTheFloor, barIntruderProblems, type DrawingProblemsCtx } from '../ui/drawing-problems.js';
import { createListenerScope } from '../platform/listener-scope.js';
import type { FilterReach } from '../render/port.js';
import { LOGICAL_W } from '../core/constants.js';
import { captionDuration, CAPTION_RATES } from '../core/caption-duration.js';
import { initSettingsPanel, type SettingsPanelApi } from '../ui/settings-panel.js';
import { mountPanel } from '../ui/mount-panel.js';
// 📌 `latchRefusal` e `setMoveLatch` saíram destes imports com a linha do painel (2026-09-21): quem escreve
// a aderência agora é o ☝️ da barra, e é ele que já resolvia as duas coisas — a recusa do aparelho e as duas chaves guardadas.
import { stampSource, sourceOfEvent } from '../input/synthetic-source.js';
import type { TransportName } from '../input/transport-in-use.js';
import { createVirtualController, type VirtualCommand, type VirtualController } from '../input/virtual-controller.js';
import { createSwitchScan, SWITCH_SCAN_DEFAULTS, type SwitchScan, type ScanItem } from '../input/switch-scan.js';
import { mountScanOverlay, scanItemText } from '../ui/scan-overlay.js';
import { createVoiceControl, type VoiceControl } from '../ui/voice-control.js';
export type { VirtualCommand } from '../input/virtual-controller.js';
import { mountSteps, updateSteps, nextStep, controlRow, labelRow } from '../ui/panel-widgets.js';
import { PERSONAS_DO_PAD, closestPersona } from '../input/touch.js';
import { initSettingsTypo, type SettingsTypoApi } from '../ui/settings-typo.js';
import { initSettingsMotion, type SettingsMotionApi } from '../ui/settings-motion.js';
import { initSettingsVisual } from '../ui/settings-visual.js';
import { initSettingsEmpathy } from '../ui/settings-empathy.js';
import { HC_ROLE_DEF } from '../render/hc-role-data.js';
import { initLqFilter, setLq, getLqT, lqFilter } from '../render/lq-filter.js';
import { initCrt, applyCrt, crtScanVars } from '../render/crt.js';
import { initSettingsAudio, mountAudioInside, mountSoundInside, type SettingsAudioApi } from '../ui/settings-audio.js';
import { AUDIO_CATS } from '../platform/audio-mixer.js';
import { toggleBtn, toggleLabel } from '../ui/dom.js';
import { createEmpathyFilter } from '../input/empathy-filter.js';
import { createInputCooldown, COOLDOWN_MS } from '../input/input-cooldown.js';
import { markChanged } from '../ui/changed-mark.js';
import { mountHudBands, hudNumbersProblems, type HudNumber, type HudBandsMounted } from '../ui/hud-bands.js';
import { gameOptionsProblems, drawGameOptions, type GameOption } from '../ui/game-options.js';
import * as store from '../platform/storage.js';
import { initMenuNav, type MenuNavApi } from '../ui/menu-nav.js';
import type { NavKeys } from '../input/edges.js';
// 🔴 O COMANDO É MONTADO AQUI DESDE O ADR-0224 — era o único dos seis transportes montado pelo cartucho.
import { initGamepad, padGameAnswers, seatEveryPlayer, type GamepadGameHooks } from '../input/gamepad.js';
import { whereTheChildIs, type Place } from '../ui/where-the-child-is.js';
import { createSimulationOverTheWorld } from '../ui/simulation-over-the-world.js';
import { createSimulationList } from '../ui/simulation-list.js';
import { showOnlyRowsThatApply } from '../ui/audio-rows-that-apply.js';
export type { GamepadGameHooks } from '../input/gamepad.js';
import { initKeyboardRuntime, type KeyboardRuntime } from '../input/keyboard-runtime.js';
import { kb, initKB, registerKeyboardMapping, saveKB, setKB, factoryWithGame, type KBDefaults } from '../input/keyboard.js';
import { registerPadMapping } from '../input/pad-defaults.js';
import { downloadHeavy, heavyAtBoot, type HeavyReport } from '../platform/heavy.js';
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
   * no desenho de um jogo alheio. 📌 E desde o ADR-0120 ONDE já não é SE: a pausa deixou de ser declinável, e
   * o que sobra deste campo é o lugar. Um hospedeiro que não aceite filhos vira linha de `problems`, que é a
   * diferença entre a engine não saber e a engine calar-se.
   */
  readonly pauseHost?: Element | null;
  /**
   * ONDE O CONTROLE VIRTUAL É PENDURADO (ADR-0143). Ausente, a engine usa `#game-region`.
   *
   * ⚠️ Pela mesma razão do `pauseHost`: a engine desenha o pad a partir do `preset`, mas não sabe onde ele cabe
   * no desenho de um jogo alheio. E a folha põe `.touch` em `position:absolute` no fundo do hospedeiro — logo
   * o hospedeiro é o rectângulo do jogo, não a página.
   */
  readonly touchHost?: Element | null;
}

/**
 * O que este jogo NÃO tem. Declarado, e não deduzido de um getter que devolve null.
 *
 * O achado 10 do segundo consumidor é a razão de isto existir como tipo: o quiz precisava se declarar
 * "pausado" para navegar os próprios menus, porque a engine não tinha por onde ouvir "eu não tenho fases".
 */
export interface Declinios {
  /*
   * ⚠️ `semMenuDePausa` SAIU DAQUI, E SAIU DUAS VEZES — a nota fica porque a ausência dele é decisão, e
   * porque o caminho até ela é a coisa mais instrutiva deste ficheiro.
   *
   * 1. **Aposentado** (ADR-0120): ele existia porque a engine não tinha nada que servisse a um jogo sem pausa
   *    própria, e essa razão foi CONSTRUÍDA fora pelo próprio ADR-0106 — lista padrão de botões (`001b185`) e
   *    montagem do cartão (`092a670`). O Dev fechou a colisão numa palavra: «Aposentar.»
   * 2. 🔴 **Revertido** (ADR-0121, `7f256f0`): medido depois, QUATRO de cinco jogos usavam o campo, e o
   *    `pixi-15-puzzle` tinha o custo escrito ao lado da própria declaração — «every arrow, Enter and Space
   *    would start being eaten the moment anything created an element with a pause id».
   * 3. **Aposentado outra vez** (ADR-0122), porque o Dev respondeu a issue #132 com a razão que já tinha dado
   *    uma vez: o menu de pausa e os ícones de acessibilidade do HUD devem estar em TODO jogo, e é por isso
   *    que são responsabilidade da engine.
   *
   * 📏 E A CITAÇÃO DO PASSO 2 FOI MEDIDA NO PASSO 3, que é o que ela nunca tinha sido: os dois leitores do
   * cartão só consomem a tecla com `!menu.hidden` (`ui/menu-nav.ts:485`, `input/gamepad.ts:619`) e o
   * `buildScreenPause` entrega-o com `sp.hidden = true` (`ui/pause-icons.ts:1180`). Cartão MONTADO não come
   * tecla nenhuma; só o cartão ABERTO é dono do teclado, onde isso é o comportamento certo. A guarda entrou
   * em `1519682` (25/08) e está no `v7.0.1`, a versão que os quatro instalam.
   *
   * 📌 Um jogo que genuinamente não tenha pausa nenhuma NÃO recupera este campo — seria decisão nova, sobre o
   * que «pausa» quer dizer num jogo sem estado a correr. O que um jogo ainda declara é ONDE ela cabe:
   * `host.pauseHost`, com `#game-region` de recuo.
   */
  /** Sem assistente de mapeamento de controle. */
  readonly noPadAssistant?: boolean;
  /** Sem "ator da pausa" — quem apertou o botão que abriu o menu. */
  readonly noPauseActor?: boolean;
  /**
   * No neural voice — this game does not declare `uses: { neuralVoice: true }` (ADR-0216 §3).
   *
   * Exists because the absence is otherwise silent: a game that does not ask for one has only the browser's voice, which a school
   * Chromebook may not have for the child's language. Declining is a choice; not declaring is an omission, and `problems` says so.
   */
  readonly noNeuralVoice?: boolean;
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
  readonly withIndex?: () => boolean;
  readonly onBar?: (i: number) => boolean;
  readonly navBar?: (i: number, k: NavKeys) => void;
  /** Jogadores para o teclado remapeável. `Pick<ControlledPlayer,'ctrl'>` — esquema de teclas e nada mais.
   *  ⚠️ `KeyScheme` e não `Record<string, string[]>` desde a #118: era uma CÓPIA ESTRUTURAL do tipo, e uma
   *  cópia que ninguém obriga a concordar diverge — é a lição que o próprio `core/entity` abre a dizer, com
   *  o `DomQuery` (dezasseis cópias) e o `KeyScheme` (seis) como as contas já pagas. */
  /**
   * ⚠️ `audioSink` ENTROU EM 2026-09-12, e é ADITIVO E OPCIONAL: nenhum consumidor precisa de o escrever.
   *
   * 🎯 Ele entra porque o assento passou a ter um segundo leitor dentro da engine. O painel auditivo, que a
   * engine agora monta, escreve nele a saída de áudio que a criança escolheu — e `ui/pause-icons` lê-o para
   * responder a uma pergunta que muda o que a barra oferece: «esta criança tem uma saída SÓ dela?». Sem isso,
   * mexer em som, TTS ou modo cego num fone partilhado mudaria o áudio de toda a gente.
   *
   * 📌 E É SÓ ESTE CAMPO. Os campos MOTORES (`easy`, `toggleMove`, `toggleRun`) não entram: eles são
   * obrigatórios em `MobilityPlayer` — o painel LÊ-OS para desenhar o estado —, e torná-los exigíveis aqui
   * obrigaria todo jogo a carregá-los. Essa é uma decisão de contrato por tomar, e ela não se toma de
   * passagem por um cast que faria o compilador calar-se.
   */
  readonly players?: { ctrl: KeyScheme; audioSink?: string | null }[];
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
   * THE ON-SCREEN PAD, only when the cartridge asks for it (ADR-0166): «Controle de tela é só para jogo que não funciona tão
   * bem como via mouse e/ou touch (o cartucho decide), nunca para menu.» Absent = no pad — a game played by touching its
   * own elements, and every menu, need none on top of them. It leaves the pause card and the panels; it stays on the quick
   * pause.
   */
  readonly onScreenPad?: boolean;
  /**
   * THE NUMBERS THIS GAME SHOWS, each in the band of what it is about (ADR-0168, ADR-0175; issue #162). The engine mounts
   * the HUD and places them: `identity` top left and `mission` under it, `power` top right (under the clock), `learning` bars (one to three, as
   * `educational/segment-bar.barOf` returns them) centred in the footer, under the explanation; the room the game leaves free at the
   * top (`--barra-a11y-h`) grows by what they take. Absent = no HUD mounted, and the game keeps drawing its own.
   * 📏 Measured on 2026-09-13: six sibling games, six HUDs of their own, none in the bands.
   * A malformed list is refused at boot and at `mount`, like the declaration.
   */
  readonly hud?: readonly HudNumber[];
  /**
   * THE OPTIONS OF THIS GAME, as rows the engine draws (ADR-0182; issue #178): a label and hint in the game's words, a kind
   * (steps, list or switch), how to read the value and how to write it. «Opções do jogo» opens them in a panel of the
   * engine's own; absent or empty, the door stays on the card locked with its reason (ADR-0161). A cartridge draws its own
   * options only where rows cannot express what it needs. A malformed list is refused at boot and at `mount`.
   */
  readonly gameOptions?: readonly GameOption[];
  /**
   * HOW TO PLAY THIS GAME, as slides the help shows before the buttons (ADR-0195; issue #188): «O "Como jogar" é justamente algo a
   * ser feito pelo cartucho.» Each slide's text is read at every showing, in the page's language; its figure, when given, is drawn
   * by the cartridge on a surface the engine gives, with the time for an animation (still under reduced motion). Absent = the help
   * shows the buttons alone. A malformed list is refused at boot and at `mount`.
   */
  readonly howToPlay?: readonly HowToPlaySlide[];
  /**
   * THE VIRTUAL CONTROLLER'S COMMANDS, CARRIED TO THE GAME (ADR-0111 and its erratum; issue #197): «a engine lida com o hardware e passa
   * para o jogo o nome virtual do botão». Each press and release of a position the child's hardware reached — the keyboard by the
   * child's scheme, the eyes — with its source and seat. What it executes is the game's, named by its `preset`. Not called while a menu
   * has the directional. Absent = the game hears commands only through what it reads itself.
   */
  readonly onCommand?: (command: VirtualCommand) => void;
  /**
   * O QUE SÓ ESTE JOGO SABE SOBRE O COMANDO (ADR-0224). A engine monta o transporte; isto são as poucas respostas que
   * nada nela pode saber — a tela de título, a demonstração, o modal, entrar e recomeçar um assento, o selo de espera,
   * a arte do assistente e «o mundo está a andar?».
   *
   * 🎯 **Ausente por inteiro é uma resposta**, não um esquecimento: o controle funciona, e o que depende do mundo do
   * cartucho simplesmente não acontece. Cada ausência está escrita em `GamepadGameHooks`.
   */
  readonly gamepad?: GamepadGameHooks;
  /**
   * AS ACOMODAÇÕES QUE TÊM ASSUNTO NESTE JOGO — a resposta do cartucho, OBRIGATÓRIA (ADR-0153).
   *
   * 🔴 Para cada uma das dezasseis que só o jogo sabe responder (`GAME_KEYED` em `core/accommodations`): a PALAVRA
   * do jogo, se tem assunto aqui, ou `false`. Nas palavras do Dev: «Gênero não precisa responder todas as
   * acomodações, mas sim o cartucho, obrigatoriamente.»
   *
   * ⚠️ OBRIGATÓRIO, e pela rubrica do `holdsAtOnce`: não há padrão seguro — «sim» monta a cadeira de rodas no
   * xadrez, «não» esconde-a da plataforma — e o esquecimento falha INVISIVELMENTE a quem escreve o jogo. Uma resposta
   * ausente ou incompleta é declaração malformada, e o arranque RECUSA.
   *
   * 📌 As gerais montam sempre e as do contrato derivam-se; nenhuma delas se responde aqui.
   */
  readonly accommodations: AccommodationAnswers;
  /**
   * The game's genre, OPTIONAL (ADR-0153), from the engine's list (`core/genres`, ADR-0156): what the game plays like.
   * The cartridge chooses it and nobody assigns it. Casino game and a name outside the list refuse the boot; Horror game
   * boots and `problems` carries its «avoid» mark.
   */
  readonly genre?: string;
  /**
   * WHAT THIS GAME USES OF THE VOICE (ADR-0216 §3) — never how. Two answers, and each one is a sentence about the child, not
   * about a library:
   *
   * · `neuralVoice: true` — a child who cannot read is read TO by this game, so it wants a voice even where the device has
   *   none of its own. The engine loads Kokoro from the delivery at the first such utterance (ADR-0216 §1); the game names no
   *   phonemizer, runtime or model. Absent, no Kokoro voice is listed, the audio panel does not offer the neural engine, and
   *   the 372 MB of model, voices and runtime never enter the delivery.
   * · `reading: true` — a child reads aloud TO this game and it wants the text; the engine decides who hears her, and a
   *   delivery carries the reading model of her language because of this answer. Absent, `motor.reading.listen()` refuses and
   *   says which line is missing: a game that asks for a microphone it never declared would also be a delivery without the
   *   model, which is a silence in a school nobody can debug.
   */
  readonly uses?: { readonly reading?: boolean; readonly neuralVoice?: boolean };
  /**
   * FETCH THE HEAVY FILES ON THE FIRST LOAD? Default **yes** (ADR-0110 (b), ADR-0116, ADR-0119).
   *
   * The vision runtime and models, and Kokoro's model and voices when the game fills the Kokoro port (327 MB), come down in the
   * BACKGROUND, one at a time, without blocking the game: the child plays while they arrive, and what must not happen is a child
   * back on the second day, offline, finding they were never fetched. Pillar 8 is «first day ONLINE, then offline-first», and
   * ADR-0116 removed the contradiction that blocked this — installing is already a network act.
   *
   * ⚠️ `false` IS FOR WHOEVER HAS A REASON, and the reason that exists is a TEST: a case that mounts the start in a real browser
   * cannot fire hundreds of MB at the network. A game in production that turns it off decides its child has no neural voice offline.
   *
   * 📌 ADR-0117 says the one who should pay this once is the PLATFORM, not each cartridge — the Cache Storage is partitioned by
   * origin, and on one site the heavy files come down once for every game. Until the platform asks for them, the game does: better
   * twice than never.
   */
  readonly downloadHeavy?: boolean;
  /**
   * WHAT HAPPENED TO EACH HEAVY FILE, as it happens. Absent = nobody is watching.
   *
   * ⚠️ HERE AND NOT IN `problems`, because the download runs in the BACKGROUND: `createGame` returns `problems` synchronously, and a
   * line arriving later lands in an array its reader already read. ADR-0110 asks that a failed fetch be REPORTED — reporting is having
   * a channel that exists when the news arrives, not pushing into a list already delivered.
   *
   * 📌 The engine invents no surface for this: where «N MB left» fits on a game's screen is the game's to know.
   * `bytesLeftToDownload(relatorio)` gives the number for the sentence.
   */
  readonly onHeavyProgress?: (r: HeavyReport) => void;
  /**
   * Como se descobre que cada transporte está aqui. Ausente = a engine pergunta ao aparelho.
   *
   * Injetável porque «há um controle ligado?» e «isto é uma tela de toque?» são perguntas ao navegador, e um
   * teste que não as possa responder não consegue exercitar a tela que depende delas.
   */
  readonly availability?: Availability;
  /**
   * O QUE CADA ITEM DO CARTÃO DE PAUSA FAZ NESTE JOGO — «continuar», «sair», «ajuda», o que o jogo ligar.
   *
   * 🔴 ESTE CAMPO FALTAVA, E A FALTA ALCANÇAVA TODOS OS CONSUMIDORES DE UMA VEZ. O `initPauseIcons`
   * aceita `getPauseActs` desde que existe; esta raiz não o passava e não tinha campo para ele, logo
   * **nenhum jogo montado por `createGame`** conseguia ligar um item. O `refrescarItensDaPausa` esconde o
   * que não acciona — o §5 do ADR-0106, que proíbe botão morto — e o resultado era um cartão com os TRÊS
   * itens que a engine acciona sozinha (`ENGINE_ITEMS`) e nada mais, em todo o catálogo.
   *
   * ⚠️ E O CUSTO MAIOR NÃO ERA O CARTÃO, ERA A BARRA. O `entrarNaBarra` chama `acts.resume?.()` para sair
   * do cartão antes de entregar as direcções à barra de acessibilidade; com a tabela vazia esse `resume` era
   * `undefined`, o cartão ficava por cima do jogo, e o item 7 do ADR-0044 — o direccional a conduzir a barra
   * — era **inalcançável a partir de qualquer jogo**.
   *
   * 📌 FUNÇÃO e não valor, pela razão que o próprio `ui/pause-icons` regista: a tabela de um jogo muda
   * durante a partida (um «sair» que só liga depois da primeira fase), e congelá-la no arranque já partiu
   * um caso lá dentro. Ausente = tabela vazia, que é o comportamento de sempre.
   */
  readonly getPauseActs?: () => Record<string, (() => void) | undefined>;
  /**
   * QUEM ABRIU A PAUSA, quando há mais de um assento — o painel de controle edita o assento DESTE índice.
   *
   * ⚠️ A RAIZ JÁ SE DENUNCIAVA POR NÃO TER ISTO: o bloco 4d empurra uma linha de `problems` quando um jogo
   * declara mais de um jogador, porque sem ator da pausa a criança do SEGUNDO assento não tem como remapear.
   * O que faltava para a linha ser accionável era este campo — até agora ela dizia «conserte» sem haver por
   * onde, e a única saída era declarar `semAtorDePausa`, que é aceitar a perda em vez de a corrigir.
   */
  readonly setPauseActor?: (i: number, ...rest: unknown[]) => void;
  /**
   * COMO ESTE JOGO REPINTA PARA ALTO CONTRASTE, e como corrige daltonismo — os dois eixos do ADR-0104.
   *
   * 🔴 SEM ELES OS ÍCONES ⚫ E 🚥 NÃO SÃO MONTÁVEIS POR NENHUM JOGO. O `iconsThatAct` só os monta
   * para quem entrega quem os escreve, e essa regra está certa — um ícone que não acciona é pior que um
   * ícone a menos. O que estava errado era não haver PORTA: o consumidor externo que mediu isto leu a
   * ausência como «este jogo tem os seus próprios controles», o que é verdade sobre o resultado e falso
   * sobre a causa. Uma lacuna que o consumidor lê como escolha é a pior forma de lacuna.
   *
   * ⚠️ SÃO DOIS CAMPOS E NÃO UM, porque são duas perguntas: um jogo pode saber repintar texturas e não ter
   * como corrigir cor, ou o contrário. O `game-pinball` é o segundo caso — a imagem dele é um framebuffer
   * de 320x180 sem textura para repintar, e o filtro de cor ele aplica há semanas.
   */
  readonly setPlayerTheme?: (i: number, theme: Theme) => void;
  readonly setPlayerCorrection?: (i: number, correction: Correction) => void;
}

/*
 * ⚠️ O TIPO MUDOU DE CASA E O NOME FICOU. `FlashMeasurement` passou a ser declarado em `platform/flash-sampler`, junto de quem
 * o produz, e é REEXPORTADO daqui porque é superfície pública desta raiz desde a nota AR: um jogo que o importa de
 * `boot/create-game` continua a poder. Mover o nome sem isto seria uma quebra que ninguém declarou.
 */
export type { FlashMeasurement };

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
  readonly pause: {
    /** Revela o cartão da tela `i` e refaz os itens — o §5 avaliado no instante em que ela abre. */
    readonly show: (i: number) => void;
    /** Esconde-o outra vez. */
    readonly hide: (i: number) => void;
  };
  readonly tts: ReturnType<typeof createTts>;
  /**
   * THE CHILD READS ALOUD AND THIS ANSWERS WITH TEXT (ADR-0216, issue #200; the Dev, 2026-09-21: «o jogo… apenas deve pedir
   * para ouvir e receber o texto»). `listen()` ends when she goes quiet or the ceiling falls; `stop()` gives the microphone
   * back; `ready()` says whether this device can hear her language at all. Which recogniser hears her is the engine's
   * business — and never one that would send her voice to a server. A game that wants it declares `uses: { reading: true }`.
   */
  readonly reading: Reading;
  /**
   * THE SOUND CAPTION, hosted by the engine (study item D3; ADR-0014; ADR-0164 rules 4–5): a line for eyes that cannot
   * hear, in the screen footer above the explanation, at most two lines, gone after a moment. Written only while the
   * child has captions on. Pass it as `createAudioEarcons`'s `showCaption`.
   * 📏 Before it, each game wrote its own `#caption` with its own timer (platformer 1300 ms, soccer 2600 ms).
   */
  readonly captionSound: (text: string) => void;
  /**
   * The game speed the child chose on the quick bar (ADR-0180): 1 is 100%, down to 0.5. `startLoop` already multiplies the
   * frame time by it; a game that runs its own frames multiplies by this.
   */
  readonly gameSpeed: () => number;
  /**
   * MEASURES WHAT THE WORLD'S CANVAS FLASHES for `ms`, against the WCAG 2.3.1 general flash threshold (study item B2;
   * `core/flash-threshold`). Only when called — reading pixels every frame costs a school machine (pillar 1), so play never
   * pays for it. A failure is also a line of `problems`. `lido: false` says why nothing was measured (no canvas, a canvas
   * the page may not read, or one that reads transparent, as a WebGL canvas without `preserveDrawingBuffer` does) — never a
   * pass by silence. The red flash is not measured.
   */
  readonly measureFlashes: (ms: number) => Promise<FlashMeasurement>;
  readonly overlays: SettingsPanelApi;
  readonly nav: MenuNavApi;
  readonly keyboard: KeyboardRuntime;
  /**
   * O OBJETO DE CONTROLE, oferecido ao cartucho (ADR-0216, nas palavras do Dev: «Assim como a engine oferece o objeto de
   * controle, ela deve oferecer objetos de leitura e TTS»).
   *
   * 🔴 Existe porque há um transporte que a RAIZ não monta: `initGamepad` é chamado pelo CARTUCHO, e a porta única do
   * ADR-0223 tem de lhe chegar às mãos para ele a passar adiante — `press: motor.controller.press`. Todos os outros
   * transportes (toque, olhos, rosto, mãos, voz, varredura) são montados aqui e ligam-se sozinhos.
   *
   * ⚠️ O que ele NÃO é: uma segunda forma de o jogo receber entrada. O jogo recebe por `onCommand`. Isto é o que um
   * jogo usa para LIGAR um transporte que ele próprio monta, e apertar uma posição à mão é dizer à engine que o
   * aparelho da criança produziu aquela posição — com a origem, que o ADR-0109 exige.
   */
  readonly controller: VirtualController;
  /**
   * APLICA O FILTRO DE VISÃO NO MUNDO QUE ESTE JOGO DECLAROU (ADR-0087).
   *
   * ⚠️ Existe porque, sem ela, cada consumidor escrevia a sua — e o `game-15puzzle` escreveu, com o
   * raciocínio certo e sozinho. O que ela acrescenta é a regra dos MENUS, que um consumidor não tem como
   * saber: eles vivem por cima da simulação e são o instrumento de sair dela, então se herdaram o filtro por
   * estarem DENTRO do mundo, ele é desfeito neles. Uma cegueira que apagasse o menu de pausa trancaria a
   * criança dentro da simulação (#82).
   */
  readonly applyVisionFilter: (css: string, reach: FilterReach) => void;
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
  readonly scenes: SceneStack;
  /**
   * AVISA O CARTUCHO QUE O IDIOMA MUDOU — e é a única coisa que ele precisa de saber sobre o assunto (ADR-0225).
   *
   * 📌 A engine já redesenha tudo o que É dela: a barra, a legenda, o cartão, o pad, um painel aberto, a voz que fala e o
   * modelo que ouve. O que ela não pode redesenhar é a ATIVIDADE — e sem esta porta o cartucho teria de assinar
   * `i18n:change` na janela, conhecendo o nome do evento e alcançando um global para isso. É a regra que o Dev escreveu
   * para a leitura e a fala: «o jogo não deve precisar saber como isso funciona» (ADR-0216).
   *
   * ⚠️ Chamado DEPOIS de a engine se ter redesenhado, para o cartucho nunca ver uma tela meio traduzida.
   */
  readonly onLocaleChange: (fn: () => void) => void;
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
  readonly onFailure: (failure: unknown) => void;
  /**
   * O ALCANCE MEDIDO NO ARRANQUE — a garantia do ADR-0079 §3 como dado, para quem quiser lê-la.
   *
   * A engine já mostrou o aviso se havia o que dizer; isto fica devolvido porque um jogo pode querer decidir
   * mais (esconder uma fase que exige doze ações, por exemplo), e porque `ok: false` é o tipo de facto que
   * tem de poder ser auditado em vez de ficar só numa tela que já fechou.
   */
  readonly reach: Reach;
  /**
   * TORNA ESTE CARTUCHO O CORRENTE (ADR-0142). Uma raiz de composição, vários jogos.
   *
   * ⚠️ **LANÇA** numa declaração malformada, e não a põe em `problems`: o contrato é PRÉ-CONDIÇÃO e não
   * diagnóstico, tal como no arranque. Um cartucho mau não chega a ser montado.
   *
   * 📌 O que ele refaz é só o que não se conserta lendo de novo: os dois registos de mapeamento, que são
   * efeito global, e o alcance com o seu aviso, que escreve DOM. `problems` e `reach` passam a descrever
   * o cartucho montado porque são derivados, não porque `mount` os copie.
   */
  mount(declaration: GameDeclaration, hooks?: CartridgeHooks): void;
  /**
   * SOLTA O CORRENTE: mapeamentos a `null`, aviso de alcance retirado, pilha de cenas esvaziada.
   *
   * ⚠️ A pilha esvazia-se com `pop()` e não com um `clear()`, e a diferença é a decisão: 📏 medido nos seis
   * jogos, os quatro `exit()` que existem são LIMPEZA DE DOM, logo dispará-los é o teardown que se quer.
   * Um `clear()` que os saltasse seria o conserto errado.
   */
  unmount(): void;
  /**
   * ENDS THIS ROOT: it releases the current cartridge, like `unmount()`, AND STOPS LISTENING TO THE WINDOW.
   *
   * 🔴 The two are separate on purpose, and the separation is the whole point. `unmount()` releases the CARTRIDGE (ADR-0142) and
   * a `mount()` after it must find a root that still hears the keyboard — so `unmount()` may not take the listeners off. But a
   * page that is finished with a root had, until this method existed, no way to say so: the root kept its ~30 window listeners
   * for the lifetime of the document, and since every query it makes is document-wide, it went on driving the pause card of
   * whatever root came after it. 📏 Measured: one ArrowDown moved the cursor one item with one root, two with a second root
   * alive, three with a third.
   *
   * ⚠️ A disposed root is not to be used again: it no longer hears anything. Call it when the page drops the root, not between
   * cartridges — that is what `unmount()` is for.
   */
  dispose(): void;
}

/** A metade do jogo SEM a declaração — o que `mount` recebe ao lado dela. */
export type CartridgeHooks = Omit<GameHalf, 'declaration'>;

/*
 * UMA FRASE SÓ PARA AS DUAS RECUSAS, e o gate do pilar 3 é que a pediu.
 *
 * ⚠️ O arranque e o `mount()` recusam uma declaração malformada pela MESMA razão e com a mesma frase, e
 * escrevê-la duas vezes fez o teto de texto cru deste módulo subir de 15 para 16 — o crivo de i18n reprovou,
 * e reprovou com razão. Duas cópias de uma frase são dois sítios para ela divergir, e é também a segunda
 * tradução a fazer quando o pilar 3 chegar aqui.
 */
function refuseDeclaration(who: string, problemas: readonly string[]): never {
  throw new Error(`${who}: declaração malformada — ${problemas.join('; ')}`);
}

/*
 * «start» É DA PAUSA, E UM CARTUCHO NÃO A TOMA (ADR-0144 §4).
 *
 * ⚠️ A FRASE MORA EM `core/actions`, e não aqui, por duas razões que apontam para o mesmo sítio: é lá que a
 * validade de um `ActionPreset` vive, e é lá que o livro-razão de prosa crua já responde por mensagens que
 * quem ESCREVE um preset lê. Uma frase nova neste módulo subia o teto dele para pagar por texto que é do
 * vocabulário de entrada, não do arranque.
 *
 * ⚠️ LANÇA, e a rubrica é a das duas linhas acima: isto é defeito de PROGRAMA — o jogo declarou uma palavra
 * para uma posição que não lhe pertence —, e não lacuna do hospedeiro. `problems` é para o que deixa jogar.
 */
function refuseIfItClaimsStart(who: string, preset: ActionPreset | undefined): void {
  // 📌 E O SELECT TAMBÉM, desde o ADR-0155: as duas posições de sistema são as duas portas da pausa.
  const problemas = [startClaimProblem(preset), selectClaimProblem(preset)].filter((x): x is string => x !== null);
  if (problemas.length) refuseDeclaration(who, problemas);
}

/**
 * O cartucho RESPONDEU às suas acomodações? (ADR-0153.) Mesma rubrica do contrato: resposta ausente ou incompleta é
 * pré-condição, não lacuna — `problems` é para o que deixa jogar, e aqui a engine não saberia que linhas montar.
 */
function refuseIfNoAnswer(who: string, answers: unknown): void {
  const problemas = accommodationAnswersProblems(answers);
  if (problemas.length) refuseDeclaration(who, problemas);
}

/** A genre outside the engine's list, or Casino game, refuses the boot (ADR-0156 §2, §4); an absent genre is conformant. */
function refuseIfGenreRefused(who: string, genre: unknown): void {
  const problemas = genreProblems(genre);
  if (problemas.length) refuseDeclaration(who, problemas);
}

/** A malformed `hud` is a program defect, refused like the declaration (ADR-0169): the engine would not know what to place. */
function refuseIfHudMalformed(who: string, hud: unknown): void {
  const problemas = hudNumbersProblems(hud);
  if (problemas.length) refuseDeclaration(who, problemas);
}

/** Malformed game options are a program defect, refused like the declaration (ADR-0169): the engine would not know what to draw. */
function refuseIfOptionsMalformed(who: string, options: unknown): void {
  const problemas = gameOptionsProblems(options);
  if (problemas.length) refuseDeclaration(who, problemas);
}

/** A malformed `howToPlay` is a program defect, refused like the declaration (ADR-0169): the help would not know what to show. */
function refuseIfHowToPlayMalformed(who: string, slides: unknown): void {
  const problemas = howToPlayProblems(slides);
  if (problemas.length) refuseDeclaration(who, problemas);
}

/** Os ids que os painéis emprestados exigem do documento. Achado 6: sem eles o painel abre VAZIO, sem erro. */
const REQUIRED_MARKUP: readonly string[] = ['#game-region', '#sr-status', '#sr-alert'];

/**
 * Onde a engine procura a barra de acessibilidade quando o jogo não declara `host.a11yBarHost`.
 *
 * ⚠️ NÃO ENTROU NA `MARCACAO_EXIGIDA` de propósito, e a diferença é de mensagem e não de rigor. Aquela lista
 * produz «marcação ausente: #x», que é o que se diz de um id que o jogo esqueceu. Aqui o que falta não é um
 * id — é a barra inteira, e cinco jogos do catálogo não a têm porque ninguém lhes disse que a deviam ter. A
 * frase própria pode explicar O QUE se perde, e é isso que a torna útil a quem a lê pela primeira vez.
 */
const A11Y_BAR_SELECTOR = '#title-icons';

/**
 * Liga a engine para um jogo declarado.
 *
 * ⚠️ LANÇA se a declaração for malformada, e NÃO lança se faltar marcação. A diferença não é gosto: uma
 * declaração errada é defeito de PROGRAMA, e um jogo que roda meio declarado é pior do que um que não abre;
 * um id ausente é lacuna do HOSPEDEIRO, e o quiz provou que ligar só a parte que serve é legítimo — foi
 * assim que ele recusou o pad e o sonar sem mentir. Por isso um vira exceção e o outro vira `problems`.
 */
/**
 * A METADE DO JOGO de `CreateGameOptions` — os quinze campos que o ADR-0139 §1 diz que um cartucho
 * FORNECE, separados dos cinco que descrevem a página e o aparelho.
 *
 * ⚠️ São quinze e não dez: a primeira versão daquele registo contou quinze campos num total de vinte e
 * deixou `declines`, `getPauseActs`, `setPauseActor`, `setTemaDoJogador` e `setCorrecaoDoJogador` de fora.
 * O teste que ele próprio dá — «uma PÁGINA conseguiria responder isto sem saber que jogo corre?» — põe os
 * cinco deste lado, e a errata de 2026-09-11 corrigiu a lista.
 */
type GameHalf = Pick<CreateGameOptions,
  'declaration' | 'isNavigable' | 'withIndex' | 'onBar' | 'navBar' | 'players' | 'setPhase'
  | 'sonarPlayers' | 'isBlindMode' | 'preset' | 'declines' | 'getPauseActs' | 'setPauseActor'
  | 'setPlayerTheme' | 'setPlayerCorrection' | 'accommodations' | 'genre' | 'onScreenPad' | 'hud' | 'gameOptions' | 'howToPlay' | 'onCommand' | 'gamepad'>;

export function createGame(o: CreateGameOptions): Engine {
  /*
   * O CARTUCHO CORRENTE, e por enquanto ele É as opções que chegaram.
   *
   * ⚠️ Este passo não muda comportamento nenhum: `cartucho` começa como o próprio `o`, então toda leitura
   * abaixo devolve exatamente o que devolvia. O que ele compra é o LUGAR onde `mount()` vai escrever
   * (ADR-0142) — sem ele, as trinta e seis leituras da metade do jogo estão presas ao argumento, e uma raiz
   * de composição a servir vários cartuchos ficaria com o primeiro deles para sempre.
   */
  let cartridge: GameHalf = o;

  const contractProblems = conformanceProblems(cartridge.declaration);
  if (contractProblems.length) {
    refuseDeclaration('createGame', contractProblems);
  }
  refuseIfItClaimsStart('createGame', cartridge.preset);
  refuseIfNoAnswer('createGame', cartridge.accommodations);
  refuseIfGenreRefused('createGame', cartridge.genre);
  refuseIfHudMalformed('createGame', cartridge.hud);
  refuseIfOptionsMalformed('createGame', cartridge.gameOptions);
  refuseIfHowToPlayMalformed('createGame', cartridge.howToPlay);

  const { doc } = o.host;
  /*
   * 🔴 THE WINDOW THIS ROOT LISTENS ON IS A SCOPED ONE, and it is not plumbing: a root installs about thirty listeners on the
   * window and, until this line existed, NOTHING COULD TAKE THEM OFF. A root whose host was removed from the document kept
   * listening, and because every query it makes is document-wide (`getPauseMenu` below is `doc.querySelector('#vp-pause-0')`) it
   * drove the NEXT root's pause card: measured in the browser, one ArrowDown moved the cursor one item with one root, two with a
   * second, three with a third. `dispose()` is the end of life this had never had. See `platform/listener-scope`.
   */
  const listeners = createListenerScope(o.host.win);
  const win = listeners.win;
  // THE CHILD'S STORED SETTINGS, FIRST (ADR-0178): nothing below reads or writes one before this.
  state.loadState(store);
  /*
   * 🔴 O IDIOMA GUARDADO **E** O NAVEGADOR (ADR-0221 passo 7g). O `core/i18n` escrevia o `<html lang>`, despachava no
   * `window` e lia o `navigator.language` por baixo de quem o chamasse — três alcances a globais a partir de `core`, que é
   * «o que a engine É, SEM navegador». Agora as decisões ficam lá e os efeitos de página entram por estas duas funções, que
   * é o hospedeiro DESTA raiz a falar: o documento e a janela que ela recebeu, nunca os globais.
   */
  loadLocale({ ...store, ...localeHostHooks(doc as Document, win, applyDom) });
  // 📌 E a exposição de depuração, que era a última linha do core/i18n: quem TEM uma janela é esta raiz.
  exposeI18n(win, i18nObject);
  /*
   * ⚠️ LEITOR E NÃO INSTANTÂNEO — terceira vez que este ficheiro comete e conserta o mesmo padrão, depois do
   * `seguraTeclas` e do `players`. `declines` é da metade do JOGO (ADR-0139, errata de 2026-09-11: é o
   * cartucho que declara o que NÃO tem), então um `const` tirado no arranque devolve, depois de um `mount()`,
   * os declínios do cartucho anterior — e um declínio lido errado esconde uma linha de `problems` ou
   * inventa outra.
   *
   * 📌 O vazio é uma constante e não um literal por chamada: `declines()` é lido em sítios que comparam.
   */
  const NO_DECLINES: Declinios = {};
  const declines = () => cartridge.declines ?? NO_DECLINES;
  const hostProblems: string[] = [];

  const $ = <T extends Element = Element>(sel: string): T | null => doc.querySelector<T>(sel);
  const $$ = <T extends Element = Element>(sel: string): T[] => [...doc.querySelectorAll<T>(sel)];

  for (const sel of REQUIRED_MARKUP) {
    if (!$(sel)) hostProblems.push(`the page lacks ${sel}: the engine announces and draws into it, and without it a child who listens hears nothing — add it to the page`);
  }

  // ⚠️ O MUNDO DECLARADO TEM DE EXISTIR NO DOCUMENTO, e esta é a falha que o ADR-0087 deixaria aberta se
  // parasse na conformidade. `conformanceProblems` confere a FORMA — que há um seletor e que ele não está
  // vazio — e não tem como conferir se ele CASA alguma coisa, porque `core/contract` é puro e não vê DOM.
  //
  // Um seletor com erro de digitação (`#gaem-region`) passa na conformidade e produz exatamente o defeito
  // que o registro existe para eliminar: a simulação de empatia aplicada a NADA, e um adulto informado de
  // que sentiu algo que não sentiu. É um problema do HOSPEDEIRO e não do programa, então entra em
  // `problems` como as marcações — o jogo abre, e quem o integrou lê que o mundo dele não está lá.
  /*
   * AS TRÊS LINHAS DE `problems` QUE DEPENDEM DO CARTUCHO, juntas e recalculáveis.
   *
   * 📏 Medido: das oito que esta raiz produz, CINCO são sobre a PÁGINA — marcação ausente, sem host de
   * filtros, sem barra de acessibilidade, uma barra que não aceita conteúdo, sem sítio para a pausa — e
   * essas não mexem quando se troca de jogo, porque não é o jogo que as causa. Só estas três mexem.
   *
   * ⚠️ E é por isso que `problems` não podia continuar a ser UM array construído no arranque: metade dele
   * descreve o hospedeiro e vale para sempre, a outra metade descreve um cartucho e caduca no `mount()`.
   * Recalcular tudo apagaria diagnósticos do hospedeiro que ninguém consertou; não recalcular nada deixaria
   * o diagnóstico a falar do jogo errado.
   */
  /**
   * As lacunas do CONTROLE VIRTUAL deste cartucho. Começa vazia e é trocada quando o pad é montado, mais abaixo:
   * `problemasDoCartucho` é chamada só no `problems`, depois do arranque, mas ler o pad daqui antes de ele
   * existir cairia na zona morta temporal — o mesmo tropeço que o `getPlayers` já deu neste ficheiro.
   */
  let padGapProblems: () => string[] = () => [];

  /*
   * 🔴 AS REGRAS SAÍRAM PARA `core/cartridge-problems` (ADR-0221 passo 7c). O que fica aqui é MEDIR a página e
   * responder ao módulo; o que era decisão — as três regras, a ordem das linhas, quando calar — mora onde uma frase
   * pode ser lida inteira. Uma raiz de composição é grande de propósito e carrega FIAÇÃO; os nove ramos que estavam
   * nesta função eram lógica, e é isso que a errata do ADR-0221 mede quando diz que a dívida da raiz são os RAMOS.
   * 📏 Sondado antes de mexer, que é a ordem: as sete linhas desta função foram desligadas uma a uma e a suíte
   * reprovou nas sete — logo o corte é de FORMA e não muda comportamento nenhum, e há como o provar.
   */
  function measureCartridgeProblems(): string[] {
    const declaredWorld = cartridge.declaration.world();
    const worldCssSelector = declaredWorld.kind === 'element' ? declaredWorld.selector : null;
    return cartridgeProblems(
      {
        padGaps: padGapProblems(),
        resizedRegion: regionResizedByCartridge(),
        drawnBelowFloor: drawnBelowTheFloor(drawingContext),
        genreWarning: genreWarning(cartridge.genre),
      },
      {
        worldSelector: worldCssSelector,
        worldIsInPage: !!worldCssSelector && !!$(worldCssSelector),
        wantsNeuralVoice: !!o.uses?.neuralVoice,
        declinesNeuralVoice: !!declines().noNeuralVoice,
        seats: (cartridge.players ?? []).length,
        setsPauseActor: !!cartridge.setPauseActor,
        declinesPauseActor: !!declines().noPauseActor,
      },
    );
  }

  // 1. IDIOMA ANTES DE TUDO. A interface não pode ser construída antes de a língua ser conhecida — foi o que
  //    o item 14 consertou movendo `initI18n()` para o topo do boot. O documento entra: ver o achado 15.
  initI18n(doc);

  // 2. MIXER ANTES DA VOZ. O achado 3, virado sequência: quem chama não tem como inverter estas duas linhas.
  initAudioMixer();
  const tts = createTts({
    srSay, srAlert, ensureAC, catNode, audioOut,
    getSoundOn: () => soundOn, getVolume: () => volume, getAudioCat: () => audioCat,
    neuralVoice: !!o.uses?.neuralVoice, // ADR-0216 §3: the game says it wants one; the engine loads it
    getSpeechPpm: () => state.speechPpm, // ADR-0183 §1: the child's speech rate
  });
  // 📌 A linha da voz neural mudou-se para `problemasDoCartucho()`: o declínio que a cala é do jogo.

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
  function setVisionFilter(css: string, reach: FilterReach): void {
    const declaredWorld = cartridge.declaration.world();
    if (declaredWorld.kind !== 'element') return;
    const el = $<HTMLElement>(declaredWorld.selector);
    if (!el) return; // já reportado em `problems`; não se inventa superfície
    el.style.filter = css;
    if (reach === 'mundo') {
      // Os menus vivem POR CIMA da simulação e são o instrumento de sair dela: se herdaram o filtro por
      // estarem dentro do mundo, desfaz-se neles.
      for (const ov of $$<HTMLElement>(OVERLAY_SCOPE_SELECTOR)) {
        if (el.contains(ov)) ov.style.filter = '';
      }
    }
  }

  /*
   * O FILTRO DO MUNDO É UMA COMPOSIÇÃO: a correcção de cor do 🚥 e o realce de contraste L→Q (ADR-0151). Escritos à
   * parte, o segundo a escrever apagava o primeiro — ligar o realce desligava a correcção que a criança daltónica
   * tinha posto. Cada escritor guarda a sua parte e pede a composição.
   */
  // O estado visual que o MUNDO mostra: a correcção (🚥) e a simulação (modo empatia) são dois campos dele, e
  // `filterKey` já sabe que a simulação só corre com a correcção no padrão (ADR-0076).
  let worldState: VisualState = DEFAULT_VISUAL;
  /*
   * A DISABILITY SIMULATION RUNS IN THE GAME, NEVER IN A MENU (issue #182). The Dev: «Simulação de deficiência não pode
   * funcionar no menu! Só no jogo! Senão fica impossível desabilitar em certos casos.» Two rules make it so:
   *   · SUSPENDED while a menu is open — the pause card, a panel, the quick pause — and back when the child returns to play;
   *   · NEVER ON AN ANCESTOR OF A MENU: a CSS filter reaches every descendant, and clearing it on the child does not undo it.
   *     📏 In the quiz the world is the whole region, menus inside it: a simulated blindness blacked out the empathy panel
   *     where it is turned off. So the filter goes on the world's parts that hold no menu, down to the world itself when
   *     it holds none (a canvas world).
   */
  /** Assigned once the menus exist (below): until then no menu can be open. */
  let simulationSuspended = (): boolean => false;
  /*
   * 🔴 ONDE A SIMULAÇÃO VAI PARAR MUDOU-SE PARA `ui/simulation-over-the-world` (ADR-0221 passo 7c). Eram ~30 ramos
   * desta raiz e nenhum deles fiação: «descer para dentro de uma caixa que contém uma porta», «um canvas não tem filhos,
   * logo a camada vai para o pai dele», «o que AJUDA fica por baixo do que SIMULA» são regras com razão.
   * 🎯 Sondada ANTES de sair, e CINCO de onze decisões estavam cegas — três delas o caminho inteiro do mundo CANVAS,
   * que nenhum caso da árvore conduzia. Ganharam casos em `engine:9ee07d3c`, antes de uma linha se mexer.
   */
  const simulationOverWorld = createSimulationOverTheWorld({
    world: () => cartridge.declaration.world(),
    find: <T extends Element>(sel: string) => $<T>(sel),
    createCanvas: () => doc.createElement('canvas'),
  });
  function recomposeWorldFilter(): void {
    // what HELPS (the colour correction, the contrast enhancement) stays on the world as before; the SIMULATION is laid apart
    const enhancementKey = filterKey({ ...worldState, simulacao: null });
    const enhancement = [enhancementKey ? (VIZ_FILTER[enhancementKey] ?? '') : '', lqFilter()].filter(Boolean).join(' ');
    setVisionFilter(enhancement, 'mundo');
    const simulation = simulationSuspended() ? null : worldState.simulacao;
    simulationOverWorld.onlyInPlay(simulation ? (VIZ_FILTER[simulation] ?? '') : '', enhancement);
    simulationOverWorld.drawLayer(simulation);
    applyCrt(); // the decorative CRT yields to every visual mode, and comes back when none is on (ADR-0047)
  }
  /*
   * THE CRT, applied by the engine (study items A5, B1). 📏 Measured: the panel said «Scanlines: on» and the region had no
   * CRT class until a toggle was pressed — `render/crt` was never started under `createGame`. It yields to a colour
   * correction, a simulation and the contrast enhancement; its scanlines are re-anchored to real pixels at every scale.
   */
  initCrt({
    // `cartucho` and not `players()`: this runs at boot, above the `players` declaration (temporal dead zone)
    numPlayers: () => Math.max(1, (cartridge.players ?? []).length),
    a11yVisualOn: () => filterKey(worldState) !== null || getLqT() > 0,
  });
  initLqFilter({ onChange: recomposeWorldFilter });
  if (getLqT() > 0) recomposeWorldFilter(); // o realce guardado vale desde o arranque
  else applyCrt(); // and the stored CRT too (the recompose above applies it when it runs)

  // 3. A pilha de diálogos. O ctx é o mesmo em qualquer jogo — é boilerplate, e boilerplate repetido é onde
  //    consumidores divergem sem querer.
  const overlays = initSettingsPanel({
    $, $$, doc,
    computedZ: (el) => +win.getComputedStyle(el).zIndex || 0,
  });

  // 4. Daltonismo: a engine ENTREGA o markup em vez de exigir que o consumidor o adivinhe (achado 7).
  const cvdFilters = installCvdFilters(o.host.cvdHost ?? null);
  if (!cvdFilters) hostProblems.push('there is no filter host (<svg>): colour-vision correction was not mounted, so a colour-blind child cannot turn it on — set `host.cvdHost`');

  // 4c. A BARRA DE ACESSIBILIDADE DA PRIMEIRA TELA. Ver a nota em `EngineHost.a11yBarHost`: cinco dos seis
  //     jogos do catálogo não têm nenhuma, e nada o dizia. Isto não a monta — diz que ela falta, que é o
  //     passo que tira o silêncio. A frase nomeia a saída, como as outras deste bloco fazem.
  const a11yBar = o.host.a11yBarHost ?? $(A11Y_BAR_SELECTOR);
  if (!a11yBar) {
    hostProblems.push(
      `there is no accessibility bar on the first screen: a child cannot reach blind mode, narration or Libras before starting — set \`host.a11yBarHost\` or put a ${A11Y_BAR_SELECTOR} in the page`,
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
   * (`ui/pause-icons` → `ctx.setModoCego ?? setBlindModeValue`), que grava no `core/state`. O leitor ficou com
   * o `() => false` que já cá estava — uma CONSTANTE. Num jogo que não injecta `isBlindMode`:
   *
   *   1. a criança carrega no ícone → `setModoCego(!false)` → o modo LIGA de verdade;
   *   2. o reflexo lê `false` → o ícone diz «desligado» e o anúncio diz o mesmo;
   *   3. ela carrega outra vez → `setBlindModeValue(!false)` = `true` OUTRA VEZ → a guarda de igualdade do
   *      `core/state` devolve cedo → nada acontece.
   *
   * ⚠️ O modo cego ligava uma vez e NÃO HAVIA COMO DESLIGAR — um jogo que começa a descrever tudo em voz alta
   * e não se cala, sem erro em lado nenhum. Para quem não depende dele, é o jogo a ficar inutilizável.
   *
   * 📌 UMA CONSTANTE E NÃO A EXPRESSÃO REPETIDA NOS DOIS SÍTIOS, porque a repetição É o defeito: duas
   * respostas à mesma pergunta divergem, e foi assim que esta divergiu. `import * as state` dá ligação VIVA,
   * então isto lê o valor de agora e não o do arranque.
   */
  const readBlindMode = cartridge.isBlindMode ?? (() => state.blindMode);

  /**
   * O QUE A ENGINE SABE ACCIONAR SOZINHA NO MENU DE PAUSA — preenchido pelo bloco 4f, lido quando a pausa abre.
   *
   * 🔴 O CARTÃO DE PAUSA TINHA UM BOTÃO. 📏 Medido em 2026-09-11 contra um jogo que chama só `createGame`:
   * sem `getPauseActs` a tabela é vazia (`ui/pause-icons:879`), `itemsThatAct` guarda só os três de
   * `ENGINE_ITEMS`, e `rootThatActs` tira também o `options` — «uma porta para uma sala vazia». O que
   * sobrevive é `acessibilidade`. Um menu de pausa com um item não é um menu de pausa.
   *
   * ⚠️ MUTÁVEL E LIDO TARDE, de propósito, e é para isto que a preguiça do campo existe: `initPauseIcons`
   * corre aqui e os painéis montam-se ~150 linhas abaixo. O próprio campo documenta o padrão — «`pauseActs` is
   * a `const` declared far below the init site» —, e `refrescarItensDaPausa` reavalia quando a pausa ABRE, não
   * na montagem. Ler a tabela agora congelaria um objecto vazio.
   *
   * 📌 E O CARTUCHO SOBREPÕE-SE, não o contrário: um jogo que traga o seu `tipo` ganha ao da engine. O que
   * ADR-0122 torna não-declinável é a pausa EXISTIR, não a engine ser dona de cada item dentro dela.
   */
  const engineActions: Record<string, () => void> = {};
  /** Opens the game options panel, once mounted (ADR-0182). Offered as the door's action only while the cartridge declares rows. */
  let openGameOptions: (() => void) | null = null;
  let redrawGameOptions = (): void => {};

  /*
   * ===================== A SAÍDA, QUE TINHA DE NASCER COM A ENTRADA (ADR-0144, errata) =====================
   *
   * 🔴 MEDIDO ao construir o ADR-0144, e é a metade que aquele registo não viu: `ENGINE_ITEMS` é
   * `{options, pmback, acessibilidade}` — **`resume` não está lá** —, e esta tabela não o definia. Logo
   * `itemsThatAct` cortava o «continuar» do cartão de TODO jogo que só chame `createGame`. E o Escape
   * também não fechava: `ui/menu-nav:403` faz `ctx.setPhase('playing')`, que aqui era
   * `cartucho.setPhase ?? (() => {})` — um no-op. Antes disto ninguém reparava, porque nada ABRIA o cartão.
   *
   * ⚠️ ABRIR UMA PORTA SEM SAÍDA É PIOR DO QUE NÃO A ABRIR. É o §5 do ADR-0106 em tantas palavras — «uma
   * barra que oferece um caminho e depois o refusal ensina-lhe que o caminho não é para ela» —, e a criança
   * que ficasse presa no cartão seria precisamente a que navega sem ver, que não tem o rato por alternativa.
   *
   * 📌 E ISTO DESTRANCA UMA TERCEIRA COISA, que o campo `getPauseActs` já anotava como perda: `entrarNaBarra`
   * chama `acts.resume?.()` antes de entregar o direccional à barra. Com a tabela vazia esse `resume` era
   * `undefined` e o item 7 do ADR-0044 ficava «inalcançável a partir de qualquer jogo». Deixa de ficar.
   *
   * 📌 O CARTUCHO CONTINUA A SOBREPOR-SE (a ordem do espalhamento em `getPauseActs` não muda): um jogo que
   * tenha o seu próprio «continuar» — porque retomar ali é descongelar física, retomar áudio e mais — ganha
   * a este. O que a engine garante é que NUNCA falta um.
   */
  // O rodapé da tela (ver `rodapeDaTela`): declarados AQUI, antes do primeiro `mudarDeFase`, que já o limpa.
  let footer: HTMLElement | null = null;
  let barExplanation: HTMLElement | null = null;
  // The quick-pause state and the button legend, declared before the first `mudarDeFase` too: its `pausa.esconder`
  // refreshes the legend (ADR-0164 rule 3), and reading them earlier would be a temporal-dead-zone error at boot.
  const inQuickPause = new Set<number>();
  // the menus and the quick pause exist from here on: a simulation is suspended while one is open (issue #182)
  simulationSuspended = () => isMenuOpen() || inQuickPause.size > 0;
  let pauseCaption: HTMLElement | null = null;
  function changePhase(p: 'title' | 'playing' | 'paused'): void {
    // ⚠️ A ENGINE FECHA O SEU CARTÃO; O JOGO CONTINUA A DECIDIR O MUNDO. É a simetria exacta do ADR-0144 §2
    // do outro lado: lá a engine revela e PEDE a pausa, aqui esconde e PEDE a retoma.
    if (p !== 'paused') { pauseControls.hide(0); writeInFooter(null); } // o motivo de um item não fica sobre o jogo
    cartridge.setPhase?.(p);
  }
  engineActions.resume = () => changePhase('playing');

  /*
   * SAIR — «voltar à tela de press start» (decisão do Dev, 2026-09-12; errata do ADR-0144 §5).
   *
   * 🔴 O §5 daquele registo tinha deixado isto EM ABERTO de propósito, porque a resposta errada perde o jogo
   * de uma criança: recarregar? `history.back()`? um menu de actividades que pode não existir? A resposta
   * dele não é nenhuma das três — é uma FASE que o projeto já tem nome e contrato para.
   *
   * ⚠️ E A ARESTA FICA DITA: o `ui/shell`, que DESENHAVA essa tela, é deliberadamente não montado por esta
   * raiz (`:325-336`). A engine esconde o cartão dela e PEDE a fase; um jogo sem o gancho fica onde está. É a
   * mesma assimetria do `setPhase('paused')` no ADR-0144 §2, e é por isso que o crivo afirma a CHAMADA.
   *
   * 📌 SEM CONFIRMAÇÃO, e isso é escolha e não esquecimento. O anel põe `quit` a um passo de `resume`
   * (ADR-0044 item 1), o que o torna fácil de alcançar por engano — mas o ADR-0037 é o que decide: não há
   * salvamento nenhum neste projeto, logo o que se perde é a rodada corrente e não progresso. Um diálogo de
   * confirmação custaria uma parada a mais na varredura de TODA saída para proteger o que não existe.
   */
  engineActions.quit = () => changePhase('title');

  /*
   * PRINT — «ver a tela sem menus», e qualquer botão volta.
   *
   * 📌 O `ui/shell.printMode` já fazia isto no monólito e não vem com o `ui/shell`, que esta raiz refusal
   * montar. Mas ele não precisa da máquina de fases: precisa dos cartões, da janela e do anúncio — os três
   * que a engine tem. Reescrito aqui com o MESMO comportamento, incluindo o adiamento.
   *
   * ⚠️ OS 80 ms NÃO SÃO SUPERSTIÇÃO, e a linha original já os explicava: sem eles, o próprio evento que
   * ACCIONOU o print é o que o desfaz — a criança carrega uma vez e vê a tela limpa piscar.
   *
   * 📌 EM CAPTURA, e não em bolha, porque o ponto é interceptar ANTES de quem quer que seja: em modo print a
   * tecla não é do jogo nem da pausa, é a saída. 🎯 E ela não colide com o gancho do `start` (ADR-0144), que
   * é de bolha: o `voltar` revela o cartão na captura, e quando o de bolha chega o guarda do «cartão já
   * aberto» manda-o embora. Medido a ler os dois lado a lado, não assumido.
   */
  engineActions.print = () => {
    const findPauseCard = (): HTMLElement | null => $<HTMLElement>('#vp-pause-0');
    const eventTarget = findPauseCard();
    if (!eventTarget) return;
    eventTarget.hidden = true;
    const goBack = (e?: Event): void => {
      if (e && typeof e.preventDefault === 'function') { try { e.preventDefault(); } catch { /* noop */ } }
      win.removeEventListener('keydown', goBack, true);
      win.removeEventListener('pointerdown', goBack, true);
      const c = findPauseCard();
      if (c) c.hidden = false;
    };
    win.setTimeout(() => {
      win.addEventListener('keydown', goBack, true);
      win.addEventListener('pointerdown', goBack, true);
    }, 80);
    srSay(t('sr.print.on'));
  };

  /**
   * O PAINEL AUDITIVO, resolvido tarde e lido cedo — a mesma preguiça do `acoesDaEngine` acima, e pela mesma
   * razão: `initPauseIcons` corre aqui e os painéis montam-se ~150 linhas abaixo.
   *
   * 🔴 ELE EXISTE COMO `let` POR CAUSA DE UM DEFEITO PRESERVADO VERBATIM. O `ui/pause-icons` documenta-o: no
   * monólito a chamada que refresca a linha do TTS estava atrás de `typeof reflectTTS === 'function'`, um
   * símbolo que já não existia, «so it never fires». O guarda veio portado como `reflectTtsPanelEnabled`, com
   * o padrão `false`, para não consertar em silêncio — e com um campo por onde o ligar de volta.
   *
   * 🎯 AGORA HÁ POR ONDE: a engine monta o painel, logo ela tem o `reflectTts` para lhe dar. Sem isto, a
   * criança liga a narração pelo ícone 🗣 da barra e o painel continua a dizer que ela está desligada — a
   * família de defeito do controlo a mentir o estado, que este repositório já pagou com o `#opt-modocego`.
   */
  let audio: SettingsAudioApi | null = null;

  /*
   * ⚠️ IÇADOS PARA CIMA DO `initPauseIcons` em 2026-09-12, e o motivo é de ORDEM e não de arrumação: a barra
   * decide QUE ÍCONES monta no arranque (`iconsThatAct`, resolvido uma vez), e o 11.º — o ciclo de
   * tipografia — só existe se o painel de tipografia existir. O painel nasce dentro de
   * `if (hospedeiroDaPausa && pausaUsavel)`, ~250 linhas abaixo; lidos lá, a barra já tinha decidido.
   *
   * 📌 Içar em vez de duplicar a pergunta: `o.host.pauseHost ?? $('#game-region')` escrito em dois sítios
   * seria a mesma resposta com duas fontes — o defeito que este ficheiro já apanhou no `getPlayers`.
   */
  const pauseMountPoint = o.host.pauseHost ?? $('#game-region');
  const pauseUsable = !!pauseMountPoint && typeof (pauseMountPoint as HTMLElement).appendChild === 'function';
  /*
   * ⚠️ O `typo` TAMBÉM SUBIU, e pelo mesmo motivo: ele era `let` DENTRO do bloco que monta os painéis, e
   * o ciclo de tipografia da barra — que é decidido antes — precisa de o alcançar. Continua a ser atribuído
   * lá em baixo; o que mudou é o ESCOPO, não o instante.
   */
  let typo: SettingsTypoApi | null = null;
  /** A posição corrente do ciclo de tipografia. Ver a nota em `ciclarTipografia`, logo abaixo. */
  let typographyStep = CYCLE_START;

  /*
   * 🔴 OS JOGADORES SOBEM PARA AQUI (issue #147), e a razão é uma medição de ordem de arranque: `initPauseIcons`
   * consome `getPlayers()` AVIDAMENTE (`ui/pause-icons`, ao montar o sub-ctx do áudio), então um `players`
   * declarado mais abaixo caía na zona morta temporal e derrubava o boot — 39 casos de uma vez, na primeira
   * tentativa. Com a barra a ler `cartucho.players ?? []` em vez disto, um jogo que não declara jogadores tinha
   * ZERO assentos para a barra e UM para o teclado, e os ciclos da barra (🚥 correcção, ☝️, TEA) ficavam presos
   * na primeira posição: o estado não tinha onde ser guardado e cada pressão relia o padrão.
   */
  // ⚠️ O ESQUEMA DE ARRANQUE ALCANÇA NADA, e diz isso com `null` em vez de com um objeto vazio (issue #118).
  // Ele vive um instante — `assignControls()` logo abaixo substitui-o pelo esquema real —, mas enquanto vive
  // é um `KeyScheme` como qualquer outro, e a única forma honesta de um esquema que não alcança nada é
  // catorze ausências declaradas. Um `{}` fazia o tipo mentir sobre estar completo.
  const withoutReach = Object.fromEntries(ACTIONS.map((a) => [a, null])) as KeyScheme;
  // ⚠️ O FALLBACK É UMA CONSTANTE e não um literal novo a cada chamada: `getPlayers` é lido pelo runtime de
  // teclado a cada leitura de controlo, e devolver um array novo de cada vez faria qualquer comparação de
  // identidade mentir — um defeito que só aparece em quem compara, e tarde.
  const withoutPlayers = [{ ctrl: withoutReach }];
  // ⚠️ LÊ `cartucho.players`, E NÃO UM INSTANTÂNEO. Os getters já existiam; o que eles fechavam é que era um `const`
  // tirado no arranque. As linhas de `initPauseIcons` e do sonar, neste mesmo ficheiro, já liam a fonte viva —
  // esta era a que faltava. Com vários cartuchos numa raiz de composição (ADR-0142), o teclado ficava com os
  // jogadores do cartucho que arrancou primeiro.
  const players = () => cartridge.players ?? withoutPlayers;

  /*
   * A PALETA SEGURA PARA DALTONISMO NOS MENUS E NO HUD (ADR-0151) — Okabe-Ito, por `:root[data-paleta]`.
   *
   * 📏 ANTES DISTO O `core/state.cbSafe` ERA UMA BANDEIRA SEM LEITOR: gravava, persistia e avisava, e nada na
   * engine pintava menu ou HUD de outra cor. Ligá-la à correcção sem este escritor seria virar uma chave que
   * ninguém lê. As cores e a medida que as escolheu estão na folha (`style.css`, junto do `data-cursiva`).
   *
   * 🎯 A REGRA É DO DEV, nas palavras dele: «ativada automaticamente quando se liga correção para protano,
   * deutero e tritanopia e desativada automaticamente quando muda para visão padrão (tricromática). Aqui se
   * permite ativá-la sem usar o filtro.» Logo o estado é UM (`cbSafe`), e a correcção só o empurra.
   */
  const applySafePalette = (on: boolean): void => {
    if (on) doc.documentElement.dataset.paleta = 'okabe-ito';
    else delete doc.documentElement.dataset.paleta;
  };
  applySafePalette(state.cbSafe);
  state.on('cbSafe', (v) => applySafePalette(Boolean(v)));
  /**
   * Envolve QUALQUER escritor de correcção — o do cartucho ou o da engine: a paleta segue a correcção seja quem
   * for que a aplica. ⚠️ Envolver só o da engine deixaria um jogo que corrige no próprio render (o `game-pinball`)
   * sem a paleta que a criança pediu ao carregar no mesmo ícone.
   */
  function withSafePalette(write: (i: number, correction: Correction) => void): (i: number, correction: Correction) => void {
    return (i, correction) => {
      write(i, correction);
      state.setCbSafeValue(correction !== 'tricro');
    };
  }

  // 📌 ONE DOOR FOR BOTH, and the name says so since 2026-09-21: getUserMedia is what a page has to ask the camera AND the
  // microphone for. It used to be called «temCamera» and the 👄 read it anyway — a name that describes half of what it answers is
  // how a device with a headset and no webcam would have lost the voice for a reason nobody could see in the code.
  const canCaptureMedia = typeof win.navigator?.mediaDevices?.getUserMedia === 'function';
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
    // ⚠️ A REFERÊNCIA, e não o resultado. Chamar aqui congelava a resposta no arranque, e o
    // `reflectPauseIcons` — que existe porque a tabela de acções muda (ADR-0106 §5) — refrescava a partir
    // dela. Com vários cartuchos numa raiz de composição (ADR-0142) o ícone descrevia o primeiro deles.
    holdsKeys: () => cartridge.declaration.holdsKeys(),
    // how many positions this cartridge declared — what «one button only» would have to offer (ADR-0218, issue #201)
    declaredPositions: () => (cartridge.preset ? presetActions(cartridge.preset).length : 0),
    // the hourglass is offered where time runs by itself (ADR-0180), read per cartridge
    clock: () => cartridge.declaration.tick === 'clock',
    // the 📷 is offered where there is a camera to ask for (ADR-0215); the three camera controls below follow its position
    camera: canCaptureMedia,
    // and the 👄 where there is a MICROPHONE (issue #184) — the same door as the camera's, so the same answer
    microphone: canCaptureMedia,
    // the ☰, the bar's first icon (interface log 2026-09-16): the SELECT door, where there is a card to open. Hoisted, read at the press.
    ...(pauseUsable ? { openMenus: (i: number) => { openSeatMenus(i); } } : {}),
    // no voice speaks the current language: the narration icon locks like the panel's rows (ADR-0185)
    noVoice: () => tts.voices().length === 0,
    /*
     * ✅ A MESMA LISTA DO TECLADO (issue #147, consertada em 2026-09-12).
     *
     * 📏 ERA `cartucho.players ?? []`, e com a lista VAZIA `iconAct('cvd', i)` relia `(P()[i] || {}).visual` como
     * `undefined` a cada pressão: o ciclo ficava PRESO na primeira posição enquanto o ícone anunciava correcções
     * diferentes. Valia igual para o ☝️ e o TEA. E desde o ADR-0151 o defeito tinha ficado pior, porque a
     * correcção passou a ligar a paleta segura — que é PERSISTIDA —, e quem carregasse uma vez ficava com ela.
     *
     * ⚠️ `() => players()` já tinha sido tentado e derrubara o boot (TDZ, 39 casos): `initPauseIcons` consome
     * isto AVIDAMENTE. O conserto foi içar `players`/`semJogadores` para cima desta chamada. Um jogo que não
     * declara jogadores tem UMA criança a jogar, não nenhuma.
     */
    getPlayers: () => players(),
    getNumPlayers: () => players().length,
    srSay, srAlert,
    // A saída da barra é a saída da pausa rápida, por qualquer porta (ADR-0155). Função içada: lida ao chamar.
    onLeaveBar: (i, silent) => endQuickPause(i, silent),
    // O que o ícone apontado FAZ vai ao rodapé (função içada, lida ao chamar).
    explainIcon: (_i, k) => explainIconInFooter(k),
    explainItem: (text) => writeInFooter(text),
    // ⚠️ NÃO `instanceof HTMLElement`: esse é um GLOBAL DO NAVEGADOR, e lê-lo onde ele não existe LANÇA —
    // não devolve falso. Escrito assim na etapa 2, fazia o `reflectPauseIcons` rebentar em qualquer ambiente
    // sem DOM. É o mesmo erro de forma do ACHADO 15 no cabeçalho deste ficheiro: alcançar o global por baixo
    // de quem injectou o documento. A pergunta certa é a mesma que o `barraUsavel` faz — sabe ser uma barra?
    getA11yBars: () => (barUsable && a11yBar ? [a11yBar as HTMLElement] : []),
    getBlindMode: readBlindMode,
    getAudioCat: () => audioCat,
    setCatGain,
    /*
     * ⚠️ QUEM RESPONDE PELO APARELHO EM USO É A RAIZ, e é aqui que o autómato do ADR-0109 ganha o primeiro
     * leitor. `input/state.inputOf(i)` devolve `DEFAULT_INPUT_STATE` para quem nunca produziu uma aresta, logo isto
     * nunca é `undefined` e o ícone nunca escreve numa chave torta.
     *
     * 📌 E é a RAIZ que o passa, não o ícone que o importa: `ui/` a ler estado de módulo de `input/` seria
     * uma aresta nova entre camadas para poupar um argumento. A composição é o trabalho deste ficheiro.
     */
    transportInUse: (i: number) => inputOf(i).inUse,
    // ✅ O guarda morto do monólito volta a valer — ver a nota em `audio`, acima.
    reflectTtsPanel: () => { audio?.reflectTts(); },
    reflectTtsPanelEnabled: true,
    isLibrasOn: vlibrasOpen,
    toggleLibras,
    /*
     * ⚠️ O QUE O JOGO ENTREGA, E QUE ATÉ HOJE NÃO TINHA POR ONDE. Os três campos são opcionais dos dois
     * lados: ausentes, tudo se comporta como antes — tabela de acções vazia e os dois ícones visuais
     * não montados. Ver as notas em `CreateGameOptions` para o que a ausência custava.
     */
    // ⚠️ SEMPRE PASSADO AGORA, e já não só quando o jogo traz o seu. A ausência do cartucho deixou de
    // significar «tabela vazia»: significa «só o que a engine acciona», que é o que ADR-0106 §1 manda.
    getPauseActs: () => ({
      ...engineActions,
      ...(openGameOptions && cartridge.gameOptions?.length ? { opcoesdojogo: openGameOptions } : {}),
      ...(cartridge.getPauseActs ? cartridge.getPauseActs() : {}),
    }),
    /*
     * O CICLO DE TIPOGRAFIA DO 11.º ÍCONE (ADR-0149 §1, ADR-0150 §2).
     *
     * 🎯 UMA PRESSÃO MUDA A CAIXA **E** A FACE, e é essa a decisão: `letterCase` (ADR-0028) e a face são hoje
     * dois controles em dois sítios, e «Andika em caixa alta» é UMA escolha pedagógica de quem alfabetiza.
     * Uma criança não devia ter de saber o modelo para a fazer.
     *
     * 📌 A POSIÇÃO VIVE AQUI, num `let` da raiz, e não em `core/state`: ela é derivada — a caixa e a face já
     * são persistidas cada uma por si —, e guardar um índice ao lado do que ele deriva é o terceiro sítio
     * para os três divergirem. Ao reabrir, o ciclo recomeça na posição padrão com a face que ficou.
     *
     * ⚠️ A MÃO DO PAÍS SAI DA ETIQUETA BCP-47 do idioma corrente, e o recuo é o do COLONIZADOR (ADR-0150):
     * espanhol → Espanha, português → Portugal, inglês → Inglaterra. Uma língua fora do repertório devolve
     * lista vazia e o ciclo fica com quatro posições — melhor uma a menos do que a mão de um país que não é
     * o daquela criança.
     */
    cycleTypography: pauseUsable ? (): string | null => {
      // ⚠️ `typo` é lido AQUI e não na condição: ele nasce ~250 linhas abaixo, e a condição corre agora.
      // Quem decide se o ícone existe é `pausaUsavel`, que é a MESMA pergunta que decide se o painel nasce.
      if (!typo) return null;
      const cycle = typographyCycle(bcp47());
      typographyStep = (typographyStep + 1) % cycle.length;
      const position = cycle[typographyStep]!;
      state.setLetterCaseValue(position.letterCase);
      typo.setFont(position.font, false);
      /*
       * ⚠️ A ESCALA É ESCRITA SEMPRE, e não só quando é maior que 1. Escrever só na subida deixaria a mão do
       * país a valer depois de a criança voltar para a Atkinson — o texto inteiro 25% maior sem nada o
       * explicar, e ela a carregar no botão outra vez para tentar desfazer.
       * 📌 Na raiz do documento e não no `#game-region`: o `font-size` de base é de `html,body`, e é ele que
       * esta razão multiplica.
       */
      doc.documentElement.style.setProperty('--fonte-escala', String(position.scale));
      reserveBarBand(); // the name line under the bar grows with the text (issue #160)
      return FONT_BY_KEY[position.font]?.fam ?? null;
    } : undefined,
    ...(cartridge.setPlayerTheme ? { setPlayerTheme: cartridge.setPlayerTheme } : {}),
    /*
     * 🚥 A CORREÇÃO DE DALTONISMO PASSA A TER PADRÃO DA ENGINE (ADR-0148 §1), e o ícone deixa de faltar.
     *
     * 📏 MEDIDO no `dist/quiz.html`: a barra servia sete ícones — três deles a dizer «em construção» — e o
     * 🚥 ficava de fora, porque `iconsThatAct` pergunta «este ícone tem quem o accione» e esta raiz não
     * passava escritor nenhum. E não passava tendo tudo à mão: `installCvdFilters` já montou os seis
     * `<filter>` e `setVisionFilter` já sabe pô-los no elemento do mundo.
     *
     * 🎯 UM FILTRO NÃO PRECISA DE CONHECER O JOGO — é o argumento que torna isto legítimo. Ele passa por cima
     * do que quer que o jogo tenha desenhado, que é o mesmo caminho que o `consumer-quiz` já usa à mão
     * (`main-quiz.ts:359`). O que a engine NÃO pode é repintar texturas, e por isso o 🌗 continua a ser do
     * jogo (ver a errata do ADR-0148).
     *
     * ⚠️ E SÓ SE OS FILTROS EXISTIREM. Sem `host.cvdHost` o `installCvdFilters` devolve zero, o
     * `url(#cvd-fix-protan)` aponta para coisa nenhuma e o ícone anunciaria uma correcção que não acontece —
     * um controle que mente o estado, que é pior do que o ícone a menos (ADR-0106 §5). A linha de `problems`
     * para essa lacuna já existe, logo quem a tem sabe o que fazer.
     *
     * 📌 O CARTUCHO CONTINUA A GANHAR: um jogo que saiba corrigir a cor no seu próprio render — o
     * `game-pinball` corrige num framebuffer há semanas — entrega o seu e a engine sai da frente.
     */
    ...(cartridge.setPlayerCorrection
      ? { setPlayerCorrection: withSafePalette(cartridge.setPlayerCorrection) }
      : cvdFilters
        /*
         * ⚠️ `filterKey` E NÃO `VIZ_FILTER[correcao]`, e a primeira versão desta linha errou aqui: os dois
         * vocabulários são DIFERENTES. O eixo diz `protan`; o `VIZ_FILTER` conhece `fix-protan`. Escrita à
         * mão, a tradução dava `undefined`, o filtro saía vazio e o ícone ANUNCIAVA uma correcção que não
         * acontecia — que é exactamente o controle a mentir o estado.
         * 📌 E `filterKey` faz mais do que colar um prefixo: ela põe a SIMULAÇÃO à frente da correcção
         * quando há uma, que é a regra que este módulo não teria de reinventar.
         */
        ? { setPlayerCorrection: withSafePalette((i: number, correction: Correction) => {
          /*
           * 🔴 GUARDA ANTES DE APLICAR, e a primeira versão desta linha só aplicava — o que fazia o ciclo
           * ficar PRESO na primeira posição. Quem calcula o passo seguinte é `nextCorrection(p.visual)`, em
           * `ui/pause-icons`; sem escrever de volta, toda pressão relia o padrão e devolvia `protan`.
           * ⚠️ Não dava erro nenhum: o ícone anunciava a correcção certa, o filtro mudava na primeira vez, e
           * a criança carregava mais duas vezes a ver a mesma tela. Apanhado por uma MUTAÇÃO sobrevivente —
           * «aplica sempre, nunca limpa» ficava verde porque o caso só carregava uma vez.
           */
          // ⚠️ `cartucho.players` E NÃO `players()`, para escrever no MESMO array que o `ui/pause-icons` lê
          // ao calcular o passo seguinte. Com o recuo `semJogadores` os dois discordavam, e o estado ia parar
          // a um sítio que ninguém relê. 🔴 Num jogo que não declara jogadores não há onde guardar, e o ciclo
          // fica preso na primeira posição — o defeito do `getPlayers` nomeado mais acima, e não deste ramo.
          const player = players()[i] as { visual?: VisualState } | undefined;
          // Uma correcção LIGADA pára a demonstração (ADR-0076): a simulação por cima de uma adaptação ensina uma coisa falsa.
          const before = player?.visual ?? worldState;
          const nextVisual: VisualState = { ...before, correcao: correction, simulacao: correction === 'tricro' ? before.simulacao : null };
          if (player) player.visual = nextVisual;
          worldState = nextVisual;
          recomposeWorldFilter();
        }) }
        : {}),
  });

  /*
   * ⚠️ O HOSPEDEIRO TEM DE SABER SER UMA BARRA, e perguntar isso não é zelo: `a11yBarHost` é `Element` no
   * tipo, e um consumidor pode passar um duplo, um nó de outro documento, ou um elemento de um `<svg>`. Sem
   * esta guarda, um objecto sem `addEventListener` derruba o BOOT INTEIRO — e derrubá-lo por causa da barra
   * de acessibilidade seria tirar o jogo a toda a gente para não o dar a ninguém.
   *
   * Não sabendo, é `problems` como qualquer outra lacuna do hospedeiro: o consumidor lê e conserta.
   */
  const barUsable = !!a11yBar
    && typeof (a11yBar as HTMLElement).addEventListener === 'function'
    && 'innerHTML' in a11yBar;
  if (a11yBar && !barUsable) {
    hostProblems.push(
      'the accessibility bar element takes neither content nor clicks: its icons were not mounted, so a child cannot reach them — give `host.a11yBarHost` a real element',
    );
  }

  if (a11yBar && barUsable) {
    // 🔴 COM A LEGENDA DO NOME, debaixo da fileira: a barra montada pela engine não a tinha, e o Dev viu-a muda ao
    // navegar e ao passar o rato. `aria-hidden` porque o nome já é DITO (`srSay` no cursor, o `aria-label` no foco).
    a11yBar.innerHTML = iconsMarkup(pauseIcons.mountedIcons) + '<p class="pause-icons-cap" aria-hidden="true"></p>';
    wireBarCaption(a11yBar as HTMLElement, explainIconInFooter);
    a11yBar.addEventListener('click', (e) => {
      const rowButton = (e.target as Element | null)?.closest<HTMLElement>('.pi-btn');
      if (!rowButton) return;
      pauseIcons.iconAct(rowButton.dataset.pi ?? '', 0);
      pauseIcons.reflectIconsIn(a11yBar, 0);
      const caption = a11yBar.querySelector('.pause-icons-cap');
      if (caption) caption.textContent = accessibleLabel(rowButton); // the NEW state, after the reflection; «N de M» is spoken, never written (ADR-0167)
      // O anúncio lê o `aria-label` DEPOIS do reflexo, porque é ele que carrega o estado NOVO — anunciar
      // antes diria o estado que a criança acabou de deixar.
      srSay(rowButton.getAttribute('aria-label') ?? '');
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
     * 📌 SINCE STUDY ITEM C6 (ADR-0031) IT IS THE `i18n:change` LISTENER near the pad that repaints it: the boot's
     * preferred language arrives through `setLocale`, which dispatches that same event, so one path serves the boot
     * and a change made mid-game. The `localeReady()` repaint that stood here was the same work twice.
     */

    /*
     * ⚠️ E ELA TEM DE CONTINUAR A DIZER A VERDADE quando o estado muda NOUTRO SÍTIO. O modo cego liga-se
     * também pelo painel de áudio e pela simulação de empatia; sem esta assinatura, o ícone da barra ficaria
     * a dizer «desligado» com `aria-pressed=false` depois de a criança o ter ligado — o controlo a mentir o
     * estado, que é a família de defeito que o `reflectTTS` e o `#opt-modocego` já custaram a este projeto.
     *
     * 📌 SÓ O MODO CEGO, e a limitação é medida e não preguiça: dos ícones que esta raiz monta, ele é o ÚNICO
     * cujo estado tem evento (`GameEvent` tem `blindMode`; TTS, Libras, TEA e alternância não emitem nada).
     * Os outros continuam a refletir-se ao clique, que é o caminho por onde hoje eles mudam.
     */
    state.on('blindMode', () => { pauseIcons.reflectIconsIn(a11yBar, 0); });
    // the 👀 changes elsewhere too: the eye control puts it back to off when the camera or the files are missing (ADR-0213)
    state.on('cameraControl', () => { pauseIcons.reflectIconsIn(a11yBar, 0); }); // a mode that cannot start puts the 📷 back to off
    // 🔴 AND THE 👄 FOR THE SAME REASON, measured in a browser on 2026-09-21: with the microphone refused, the child heard «it did
    // not open», the stored answer went back to off — and the button went on saying «ligado». A control that lies about its state
    // is worse than a missing one (ADR-0106 §5), and the click path does not cover it, because this change comes from elsewhere.
    state.on('voiceControl', () => { pauseIcons.reflectIconsIn(a11yBar, 0); });
  }

  // 4d. QUEM ABRIU A PAUSA, quando há mais de um assento — o achado 3 da auditoria do `game-soccer`.
  //
  // ⚠️ O PAINEL DE CONTROLE É PARAMETRIZADO PELO ASSENTO: `render(selPlayer)` desenha as posições DAQUELE
  // esquema, e não há selector de assento — o `#ctrl-players` é uma FRASE, não abas. Quem decide o assento é
  // o consumidor, passando o ator da pausa: «edita o controle de quem abriu o menu».
  //
  // ✅ E ISTO DEIXOU DE SER MUDO. O `setPauseActor` desta raiz era `() => {}` LITERAL, sem campo por onde um
  // jogo o entregar: a linha abaixo dizia «conserte» sem haver por onde, e a única saída era declarar
  // `semAtorDePausa`, que é aceitar a perda em vez de a corrigir. Agora ela só acusa quem NÃO respondeu —
  // que é o que uma linha de `problems` deve fazer, pelo §2 do ADR-0106.
  // 📌 A linha do ator da pausa mudou-se para `problemasDoCartucho()`: quem declara assentos é o jogo.

  /*
   * 4e. O CARTÃO DE PAUSA DA PRIMEIRA TELA — e isto fecha um LAÇO QUE ESTAVA ABERTO.
   *
   * 📏 MEDIDO EM 2026-09-08, nos seis jogos do catálogo local: `#vp-pause-0` é procurado por esta raiz (o
   * `getPauseMenu` do `initMenuNav`, mais abaixo) e **NENHUM jogo o cria**. `git grep vp-pause` devolve zero
   * em `game-platformer`, `game-soccer`, `pixi-15-puzzle`, `2048`, `whackwhack` e `game-chess`. Ou seja: a
   * engine inventou uma convenção, procurou-a, não a achou, e concluiu em silêncio que nenhum jogo tem menu
   * de pausa — que é a MESMA forma de defeito do ADR-0106 §2, desta vez cometida pela engine contra si mesma.
   *
   * Agora ela cria o que procura — e para TODO jogo, desde o ADR-0120 e outra vez desde o ADR-0122: o
   * declínio saiu, porque a razão de ele existir foi construída fora por este mesmo ADR-0106, e porque a
   * regra é do Dev — a pausa e os ícones de acessibilidade estão em todo jogo, logo são da engine.
   */
  // (`hospedeiroDaPausa` e `pausaUsavel` foram IÇADOS para cima do `initPauseIcons` em 2026-09-12 — ver a
  //  nota lá. Dependem só de `o.host` e do `$`, que existem desde o início, e a barra precisa da resposta
  //  ANTES de decidir que ícones monta.)
  if (!pauseUsable) {
    hostProblems.push(
      'the pause menu has nowhere to mount: a child cannot reach the settings during play — set `host.pauseHost` or give '
      + '#game-region room for children (the pause is the engine\'s in every game, ADR-0122; the game only says where it fits)',
    );
  }
  if (pauseMountPoint && pauseUsable) {
    const findPauseCard = pauseIcons.buildScreenPause(0);
    // ⚠️ O ID É O QUE A PRÓPRIA ENGINE PROCURA, logo abaixo, no `getPauseMenu`. Montar sem o pôr deixaria o
    // laço tão aberto como estava — o cartão existiria e a navegação de menu continuaria a não o achar.
    findPauseCard.id = 'vp-pause-0';
    pauseMountPoint.appendChild(findPauseCard);
  }

  /*
   * 4f. OS PAINÉIS DE AJUSTES — e este é o buraco que o ADR-0106 §1 deixou aberto por mais tempo.
   *
   * 🔴 `ui/panel-shell.mountShell` CONSTRÓI a casca de um painel e NENHUM módulo da engine a chamava: o único
   * chamador da árvore era o `consumer-quiz/main-quiz.ts:320`. Cada `ui/settings-*` preenche o INTERIOR de ids
   * que ninguém cria, então a falha tomava a pior forma disponível — o quiz registou-a como achado 6, «o painel
   * abre VAZIO, sem erro». Um jogo que chama só `createGame` tinha ZERO painéis.
   *
   * ⚠️ E OS PAINÉIS MORAM ONDE O CARTÃO MORA, o que não é arrumação: `ui/settings-panel.topVisibleOverlay`
   * varre `'#game-region .overlay'` (o `OVERLAY_SCOPE_SELECTOR`), e é por ele que o `ui/menu-nav` chega ao
   * diálogo de cima para andar com as setas. Um painel pendurado fora desse escopo ABRE, fecha com Escape — e
   * **as setas não andam dentro dele**, sem erro nenhum. Daí a linha de `problems` abaixo em vez do silêncio.
   */
  if (pauseMountPoint && pauseUsable) {
    const regionEl = $<HTMLElement>('#game-region');
    const insideScope = !!regionEl && typeof regionEl.contains === 'function'
      && regionEl.contains(pauseMountPoint);
    if (!insideScope) {
      hostProblems.push(
        'the pause host is outside #game-region: settings panels open, but arrows do not move inside them, so a child '
        + 'who plays by keyboard cannot reach the settings — put `host.pauseHost` inside #game-region',
      );
    }

    const panelCtx = {
      find: (sel: string) => $<HTMLElement>(sel),
      create: (tag: string) => doc.createElement(tag),
      host: pauseMountPoint as HTMLElement,
      overlays,
    };

    /*
     * TIPOGRAFIA — o primeiro, e a ordem tem medida: dos oito, é o que precisa de menos contexto (quatro
     * campos), e o segundo consumidor já o provou fora do género do jogo dele — «serve fora do género, sem
     * uma linha de mudança» (achado 5). Os que dependem de escritores que esta raiz não tem ficam por montar,
     * e ficar por montar é a resposta certa: ADR-0106 §5, «um ícone é montado quando a acção dele funciona».
     *
     * ⚠️ A ORDEM DESTAS DUAS CHAMADAS É A DECISÃO. A casca entra no documento PRIMEIRO, porque
     * `initSettingsTypo` liga o `#typo-reset` UMA VEZ, no arranque (`ui/settings-typo:279`): com o `init`
     * antes, o botão de repor existiria e não faria nada — um botão morto, que é o que o §5 proíbe.
     */
    // (`let typo` subiu para cima do `initPauseIcons` em 2026-09-12 — ver a nota lá. A ATRIBUIÇÃO fica aqui.)
    /*
     * 🔴 SEM PAINEL desde o ADR-0151: «quem escolhe a tipografia é o jogo, o jogador escolhe suas fontes via o
     * menu de acessibilidade rápida». A porta saiu das configurações de inclusão e a casca deixou de ser montada
     * — um diálogo no documento que ninguém alcança é o defeito que o ADR-0144 mediu.
     *
     * 📌 MAS O ESCRITOR FICA, e é por isso que o `init` continua aqui: o ciclo do 11.º botão escreve a face por
     * esta API (`typo.setFont`), e o `init` aplica no arranque a fonte que a criança deixou guardada.
     * `initSettingsTypo` guarda cada acesso ao documento, logo corre sem a casca — medido, não suposto.
     */
    typo = initSettingsTypo({
      $, srSay, store, root: doc.documentElement,
      // A prosa das linhas vai para o rodapé a CADA render, ou ela aparece duas vezes no primeiro clique.
      fillExplain: overlays.fillExplain,
      // ⚠️ `doc.fonts` É UM GLOBAL DO NAVEGADOR ALCANÇADO POR BAIXO DE QUEM INJECTOU O DOCUMENTO — o ACHADO 15
      // deste ficheiro. Aqui ele vem do `doc` do hospedeiro e ainda assim se pergunta se existe: um documento
      // falso não tem `fonts`, e a ausência tem resposta declarada (a linha fica desabilitada COM a mensagem
      // que diz ao adulto quais fontes a resolvem).
      ...(typeof doc.fonts?.check === 'function'
        ? { fontInstalled: (family: string) => doc.fonts.check(`16px "${family}"`) }
        : {}),
    });

    /*
     * CAA — COMUNICAÇÃO: O PAINEL DEIXOU DE SER MONTADO (ADR-0151).
     *
     * 🔴 A porta «Comunicação» saiu das configurações de inclusão: a caixa da letra anda no ciclo do 11.º botão
     * da barra, que passa a ser o ciclo de COMUNICAÇÃO (com ARASAAC e PCS desabilitados). Montar um painel sem
     * porta nenhuma deixaria no documento um diálogo que ninguém alcança — o defeito que o ADR-0144 mediu nos
     * quatro painéis de antes. O módulo `ui/settings-caa` continua na engine para quem o quiser montar.
     */

    /*
     * AJUDA — qual botão faz o quê, NESTE jogo, no teclado DESTA criança (ADR-0147 §4).
     *
     * 🔴 O item `ajuda` está na lista de pausa desde o ADR-0044 e a engine nunca o soube accionar, logo
     * `itemsThatAct` escondia-o em todo jogo. A tela que o preenchia saiu com o cartucho (#111) e vive
     * hoje no `game-platformer`; deixá-la lá era pedir a trezentos jogos que a escrevessem cada um.
     *
     * ⚠️ NÃO SE MONTA SEM `preset`, e a ausência é a resposta certa: sem as palavras do jogo, a tabela só
     * poderia mostrar `action2` — um identificador à frente de uma criança, que é o defeito que o ADR-0074
     * proíbe em tantas palavras. Melhor não haver ajuda do que haver uma que não se lê.
     *
     * 📌 A TECLA VEM DE `kbFor(0)`, e não do mapa de fábrica: quem remapeou vê a tecla DELA. É a mesma razão
     * pela qual o ADR-0144 escuta a acção e não a tecla.
     */
    // The cartridge's «how to play» slides come first (ADR-0195; issue #188); the help stands with them, with the buttons, or both.
    if (cartridge.preset || cartridge.howToPlay?.length) {
      let stopFigure = (): void => {};
      const helpPanel = mountPanel(panelCtx, {
        id: 'help',
        labels: () => ({
          title: t('menu.help'),
          listLabel: t('help.grupo.rotulo'),
          resetLabel: t('menu.restoreDefaults'),
          closeLabel: t('pause.pmback'),
        }),
        // ⚠️ `render` E NÃO UMA MONTAGEM ÚNICA: o preset pode mudar com o `mount()` de outro cartucho
        // (ADR-0142) e a criança pode ter remapeado entre duas aberturas. Uma tabela construída no arranque
        // mostraria a tecla de ontem — que é a forma exacta do controle a mentir o estado.
        // The slide show opens on its first slide (interface log, 2026-09-13; `ui/help-panel`).
        render: () => {
          const list = $<HTMLElement>('#help-list');
          if (!list) return;
          while (list.firstChild) list.removeChild(list.firstChild);
          const slideContents = [...(cartridge.howToPlay ?? []), ...helpRows(cartridge.preset, (a) => keyboard.kbFor(0)[a], keyName)];
          const ctxDoSlide = { create: (tag: string) => doc.createElement(tag), t, title: t('menu.help') };
          const slides = mountSlides(ctxDoSlide);
          list.appendChild(slides);
          const slideTimer = {
            requestFrame: (cb: (ms: number) => void) => win.requestAnimationFrame(cb),
            cancelFrame: (id: number) => win.cancelAnimationFrame(id),
            reduced: state.defaultReducedMotion(),
          };
          const showSlideAt = (i: number): { index: number; spoken: string } => {
            stopFigure();
            const shown = showSlide(slides, slideContents, i, ctxDoSlide);
            const slide = slideContents[shown.index];
            if (slide && 'text' in slide) stopFigure = animateFigure(slides, slide, slideTimer);
            return shown;
          };
          let currentSlide = showSlideAt(0).index;
          slides.addEventListener('passo', (ev) => {
            const fresh = nextStep(currentSlide, slideContents.length, (ev as CustomEvent<number>).detail);
            if (fresh === currentSlide) return;
            const shown = showSlideAt(fresh);
            currentSlide = shown.index;
            srSay(shown.spoken);
          });
        },
      });
      // A slide show restores nothing: the reset row the panel shell builds does not show here.
      const helpActions = helpPanel.shell.reset.parentElement;
      if (helpActions) helpActions.hidden = true;
      engineActions.ajuda = helpPanel.open;
    } else {
      hostProblems.push(
        'the help screen was not mounted: it shows how to play and each position, its key and the game\'s word, and without '
        + '`howToPlay` or `preset` it could only show a child `action2` — declare `howToPlay` (ADR-0195) or `preset` (ADR-0085)',
      );
    }

    /*
     * OPÇÕES DO JOGO — the cartridge's rows, drawn by the engine (ADR-0182; issue #178).
     * 📌 Drawn at every opening and at every `mount()`: the rows are the CURRENT cartridge's, and each value is read from it.
     * The shell's «restore defaults» is hidden: a cartridge declares no defaults, and a button that does nothing is the
     * dead control ADR-0106 §5 forbids.
     */
    const gamePanel = mountPanel(panelCtx, {
      id: 'game-options',
      labels: () => ({
        title: t('pause.opcoesdojogo'),
        listLabel: t('pause.opcoesdojogo'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => redrawGameOptions(),
    });
    gamePanel.shell.reset.hidden = true;
    redrawGameOptions = () => {
      drawGameOptions({ ...panelCtx, say: srSay }, gamePanel.shell.list, cartridge.gameOptions ?? []);
      if (!gamePanel.shell.overlay.hidden) overlays.fillExplain(gamePanel.shell.card);
    };
    openGameOptions = gamePanel.open;

    /*
     * ANIMAÇÃO — sensibilidade a movimento, e os quatro campos que a engine ganhou na etapa 1 do ADR-0106.
     *
     * 📌 `rm`, `saveRM`, `rmKeys` e `rmChar` são OPCIONAIS desde então, e a ausência é a notícia: nenhum deles
     * continha escolha do jogo — `rmKeys` era a união `MotionSceneKey` escrita à mão e `rm`/`saveRM` liam uma
     * chave de armazenamento da engine com um padrão da engine. `ui/motion-scene` responde pelos quatro, então
     * este painel não precisa de nada que só o cartucho saiba.
     *
     * ⚠️ E A LISTA DELE É `#motion-list`, NÃO `#animation-list` — a única divergência dos oito, herdada do
     * monólito onde o painel se chamava «motion» e o overlay «animation». Ver `PanelShellSpec.idDaLista`:
     * renomear seria mexer no contrato com markup de consumidores que este repositório não pode medir.
     */
    let motion: SettingsMotionApi | null = null;
    const animPanel = mountPanel(panelCtx, {
      id: 'animation',
      listId: 'motion-list',
      labels: () => ({
        title: t('menu.animation'),
        listLabel: t('animation.grupo.rotulo'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => motion?.render(),
    });
    /*
     * O BOTÃO-MESTRE — «parar todas as animações» de uma vez.
     *
     * ⚠️ CRIADO AQUI E ANTES DO `init`, pela mesma regra de ordem do `#typo-reset`: `initSettingsMotion` liga
     * o clique dele UMA VEZ, no arranque. E ele não é decoração — é a saída de quem sentiu enjoo com a tela a
     * mexer e precisa de parar TUDO num gesto, em vez de percorrer sete linhas uma a uma.
     * 📌 O rótulo entra pelo próprio painel (`motionMasterLabel`), que o troca conforme o estado; pô-lo aqui
     * daria duas mãos a escrever o mesmo texto, e a que ficasse para trás mentiria sobre o estado.
     */
    const animMaster = doc.createElement('button');
    animMaster.id = 'motion-master';
    animMaster.className = 'mode-btn switch';
    animMaster.setAttribute('type', 'button');
    animPanel.shell.card.insertBefore(animMaster, animPanel.shell.list);

    motion = initSettingsMotion({
      $, srSay, store,
      getNumPlayers: () => (cartridge.players ?? [null]).length,
      getPlayers: () => cartridge.players ?? [],
      frontOverlay: overlays.frontOverlay,
      restoreFocus: overlays.restoreFocus,
      fillExplain: overlays.fillExplain,
      toggleBtn,
      // A secção «Personagem» só existe se o JOGO disse que tem um (ADR-0153). Lido a cada render: muda no `mount()`.
      hasCharacter: () => subjectWord(cartridge.accommodations, 'reducedCharacterMotion') !== null,
      // and its title is the game's word for it (ADR-0153 confirmation)
      characterLabel: () => subjectWord(cartridge.accommodations, 'reducedCharacterMotion')?.label ?? null,
    });
    engineActions.anim = animPanel.open;

    /*
     * ACESSIBILIDADE VISUAL (ADR-0151) — e o item deixa de estar travado (ADR-0161).
     *
     * 📌 O MÓDULO É O QUE O JOGO DE PLATAFORMA JÁ USA (`ui/settings-visual`), com as duas linhas que a engine SABE
     * accionar: o realce de contraste (o filtro L→Q, composto no mundo com a correcção de cor) e a paleta segura
     * (`core/state.cbSafe`, que pinta menus e HUD). ⚠️ «Itens na cor do dono» e as cores de papel («lava, escada, água,
     * portão») ficam FORA: são de um jogo com donos de itens e com esses papéis, e a engine não descreve um jogo que não
     * conhece. O alto contraste e a correcção de cor saíram deste painel para a barra rápida (ADR-0151).
     * ⚠️ Os escritores das linhas não oferecidas são inertes DE PROPÓSITO: o `reset` só os chama quando o valor lido
     * difere do padrão, e o valor devolvido aqui É o padrão.
     */
    const visualPanel = mountPanel(panelCtx, {
      id: 'visual',
      labels: () => ({
        title: t('menu.visual'),
        listLabel: t('visual.grupo.rotulo'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => {
        rateHint.textContent = t('visual.legenda.ritmo.dica'); // before `visual.render()` runs `fillExplain`
        fgOutline.escreverDica();
        bgOutline.escreverDica();
        visual.render();
        offerOwnerAndOutlines();
        labelRow(captionsRow, captionsSpec()); // in the language of the opening
        reflectCaptions();
        reflectCaptionRate();
      },
    });
    /*
     * CAPTIONS (ADR-0151 §2; issue #182): the Dev listed them in the visual panel. `state.captionsOn` was stored and read by
     * the sound captions (`captionSound`) with no row to change it. Placed after the panel's list, which `visual.render()`
     * rewrites by markup; built once, so its listener is not lost.
     */
    const captionsSpec = () => ({ id: 'opt-captions', label: t('visual.captions'), hint: t('visual.captions.dica') });
    const { row: captionsRow, controle: captionsButton } = controlRow(panelCtx, captionsSpec());
    visualPanel.shell.card.insertBefore(captionsRow, visualPanel.shell.list.nextSibling);
    const reflectCaptions = (): void => {
      toggleBtn(captionsButton, state.captionsOn);
      captionsButton.textContent = toggleLabel(state.captionsOn);
      markChanged(captionsRow, state.captionsOn !== state.DEFAULTS.captionsOn);
    };
    /* THE CAPTION RATE (ADR-0183 §4; issue #179): 125, 145 or 175 words a minute, by steps, right after the captions switch. */
    const rateSpec = () => ({
      label: t('visual.legenda.ritmo'),
      values: CAPTION_RATES.map((n) => t('visual.legenda.ppm', { n })),
      current: Math.max(0, (CAPTION_RATES as readonly number[]).indexOf(state.captionPpm)),
    });
    const speechRateRow = doc.createElement('div');
    speechRateRow.className = 'ctrl-row ctrl-row--passos';
    const rateEnvelope = doc.createElement('span');
    const rateHint = doc.createElement('span');
    rateHint.className = 'opt-hint';
    // ⚠️ WRITTEN NOW, and again before the panel's render: `visual.render()` runs `fillExplain` on the whole card, and a row it
    // meets with an empty hint is marked done and keeps its hint INSIDE — the Dev saw the explanation in the row.
    rateHint.textContent = t('visual.legenda.ritmo.dica');
    rateEnvelope.appendChild(rateHint);
    speechRateRow.appendChild(rateEnvelope);
    const rateSteps = mountSteps(panelCtx, rateSpec());
    rateSteps.id = 'opt-legenda-ppm';
    speechRateRow.appendChild(rateSteps);
    visualPanel.shell.card.insertBefore(speechRateRow, captionsRow.nextSibling);
    rateSteps.addEventListener('passo', (ev) => {
      const currentSlide = rateSpec().current;
      const fresh = nextStep(currentSlide, CAPTION_RATES.length, (ev as CustomEvent<number>).detail);
      if (fresh === currentSlide) return;
      state.setCaptionPpmValue(CAPTION_RATES[fresh]!);
      updateSteps(rateSteps, rateSpec());
      markChanged(speechRateRow, state.captionPpm !== state.DEFAULTS.captionPpm);
      srSay(`${t('visual.legenda.ritmo')}: ${t('visual.legenda.ppm', { n: state.captionPpm })}`);
    });
    const reflectCaptionRate = (): void => {
      updateSteps(rateSteps, rateSpec());
      rateHint.textContent = t('visual.legenda.ritmo.dica');
      markChanged(speechRateRow, state.captionPpm !== state.DEFAULTS.captionPpm);
    };
    captionsButton.addEventListener('click', () => {
      state.setCaptionsOnValue(!state.captionsOn);
      reflectCaptions();
      srSay(t(state.captionsOn ? 'sr.visual.captionsOn' : 'sr.visual.captionsOff'));
    });
    /*
     * OWNER COLOURS AND CONTRAST OUTLINES (ADR-0188; issue #183): rows only where the cartridge answers the subject. Built once
     * beside the panel's list (`visual.render()` rewrites that by markup), with their own ids — `ui/settings-visual` wires
     * `#opt-ownercolors` at every render — and shown or hidden at each opening: `mount()` may have swapped the answer.
     * Owner colours carries the game's word; the outlines are two positions of one subject, named by the engine.
     */
    const ownerSpec = () => {
      const word = subjectWord(cartridge.accommodations, 'ownerColors');
      return { id: 'opt-dono', label: word?.label ?? '', hint: word?.hint };
    };
    const { row: ownerRow, controle: ownerButton } = controlRow(panelCtx, ownerSpec());
    const reflectOwner = (): void => {
      toggleBtn(ownerButton, state.ownerColors);
      ownerButton.textContent = toggleLabel(state.ownerColors);
      markChanged(ownerRow, state.ownerColors !== state.DEFAULTS.ownerColors);
    };
    ownerButton.addEventListener('click', () => {
      state.setOwnerColorsValue(!state.ownerColors);
      reflectOwner();
      srSay(`${ownerSpec().label}: ${toggleLabel(state.ownerColors)}`);
    });
    const OUTLINE_LEVELS = ['visual.contorno.0', 'visual.contorno.1', 'visual.contorno.2'] as const;
    const outline = (plane: 'fg' | 'bg') => {
      const readOutline = (): number => (plane === 'fg' ? state.hcOutlineFg : state.hcOutlineBg);
      const write = plane === 'fg' ? state.setOutlineFgValue : state.setOutlineBgValue;
      const spec = () => ({ label: t(`visual.contorno.${plane}`), values: OUTLINE_LEVELS.map((k) => t(k)), current: readOutline() });
      const rowC = doc.createElement('div');
      rowC.className = 'ctrl-row ctrl-row--passos';
      const envelope = doc.createElement('span');
      const explanation = doc.createElement('span');
      explanation.className = 'opt-hint';
      envelope.appendChild(explanation);
      rowC.appendChild(envelope);
      const stepper = mountSteps(panelCtx, spec());
      stepper.id = `opt-contorno-${plane}`;
      rowC.appendChild(stepper);
      stepper.addEventListener('passo', (ev) => {
        const fresh = nextStep(readOutline(), OUTLINE_LEVELS.length, (ev as CustomEvent<number>).detail);
        if (fresh === readOutline()) return;
        write(fresh);
        updateSteps(stepper, spec());
        srSay(`${t(`visual.contorno.${plane}`)}: ${t(OUTLINE_LEVELS[fresh]!)}`);
      });
      // the hint is written BEFORE the panel's render, which runs `fillExplain`: written after, it stays inside the row
      const writeHint = (): void => {
        explanation.textContent = subjectWord(cartridge.accommodations, 'contrastOutlines')?.hint ?? t(`visual.contorno.${plane}.dica`);
      };
      writeHint();
      const reflect = (): void => { updateSteps(stepper, spec()); };
      return { row: rowC, refletir: reflect, escreverDica: writeHint };
    };
    const fgOutline = outline('fg');
    const bgOutline = outline('bg');
    const offerOwnerAndOutlines = (): void => {
      ownerRow.hidden = subjectWord(cartridge.accommodations, 'ownerColors') === null;
      if (!ownerRow.hidden) { labelRow(ownerRow, ownerSpec()); reflectOwner(); }
      const withoutOutlines = subjectWord(cartridge.accommodations, 'contrastOutlines') === null;
      for (const c of [fgOutline, bgOutline]) { c.row.hidden = withoutOutlines; if (!withoutOutlines) c.refletir(); }
    };
    // after the list, owner colours first, then the two outlines (the captions row, built above, follows them)
    for (const l of [bgOutline.row, fgOutline.row, ownerRow]) visualPanel.shell.card.insertBefore(l, visualPanel.shell.list.nextSibling);
    offerOwnerAndOutlines();
    const noEffect = (): void => {};
    const visual = initSettingsVisual({
      $, srSay,
      getNumPlayers: () => players().length,
      getPlayers: () => cartridge.players ?? [],
      getVisualSettings: () => ({
        lq: getLqT(), cbSafe: state.cbSafe,
        ownerColors: state.ownerColors, outlineFg: state.hcOutlineFg, outlineBg: state.hcOutlineBg,
        roleColors: { ...HC_ROLE_DEF },
      }),
      getSelectedPlayer: () => 0,
      setSelectedPlayer: noEffect,
      setPlayerViz: noEffect,
      renderVisualAxes: noEffect,
      setLq,
      setCbSafe: state.setCbSafeValue,
      // the panel's «restore» puts these back too (ADR-0188): their rows now exist where the game answered them
      setOwnerColors: state.setOwnerColorsValue, setOutlineFg: state.setOutlineFgValue, setOutlineBg: state.setOutlineBgValue,
      setRoleColor: noEffect, resetRoleColors: noEffect,
      fillExplain: overlays.fillExplain,
      offer: { owner: false, roles: false },
    });
    engineActions.visual = visualPanel.open;

    /*
     * MODO EMPATIA (ADR-0151) — e o último item travado do submenu destrava (ADR-0161).
     *
     * 📌 O MÓDULO É O DO JOGO DE PLATAFORMA (`ui/settings-empathy`), com o que a engine SABE fazer:
     *   · as SIMULAÇÕES que são um filtro no mundo — as três de daltonismo (as matrizes do `installCvdFilters`), o
     *     desfoque, a névoa e a cegueira; and the three DRAWN ones — tunnel vision, a central scotoma, scattered scotomas —
     *     whose filter is only a blur: `ui/simulation-over-the-world` lays their drawing over the world (issue #182);
     *   · a PERDA AUDITIVA (`platform/audio.setHearingLossGraph`, que já é da engine).
     *   · the two MOTOR simulations (ADR-0181): «um botão por vez» and «sem força para segurar», applied to game keys by
     *     the filter at the end of the boot, before any cartridge hears them.
     * ⚠️ Sem cadeira de rodas (cortada pelo ADR-0151).
     * ⚠️ E a simulação respeita o ADR-0076: com uma correcção de cor ligada ela não corre, e DIZ porquê.
     */
    const WORLD_SIMULATIONS = ['normal', 'sim-protan', 'sim-deuter', 'sim-tritan', 'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind'];
    const empathyPanel = mountPanel(panelCtx, {
      id: 'empathy',
      labels: () => ({
        title: t('menu.empathy'),
        listLabel: t('empathy.grupo.rotulo'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      // a linha da perda auditiva nasceu no idioma de recuo: reetiquetada a cada abertura, como o interior auditivo
      render: () => {
        labelRow(hearingRow, hearingSpec());
        labelRow(oneAtOnceRow, oneAtOnceSpec());
        labelRow(noStrengthRow, noStrengthSpec());
        empathy.render();
      },
    });
    // A linha da perda auditiva nasce ANTES do `init`, que liga o clique dela uma vez (a regra de ordem do `#typo-reset`).
    const hearingSpec = () => ({ id: 'opt-hearing', label: t('empathy.hearing'), hint: t('empathy.hearing.dica') });
    const hearingRow = controlRow(panelCtx, hearingSpec()).row;
    empathyPanel.shell.card.insertBefore(hearingRow, empathyPanel.shell.list);
    // THE TWO MOTOR SIMULATIONS (ADR-0181), before the `init`, which wires `#opt-onebtn` once (the same order rule).
    const oneAtOnceSpec = () => ({ id: 'opt-onebtn', label: t('empathy.onebtn'), hint: t('empathy.onebtn.dica') });
    const noStrengthSpec = () => ({ id: 'opt-semforca', label: t('empathy.semforca'), hint: t('empathy.semforca.dica') });
    const oneAtOnceRow = controlRow(panelCtx, oneAtOnceSpec()).row;
    const noStrengthRow = controlRow(panelCtx, noStrengthSpec()).row;
    empathyPanel.shell.card.insertBefore(oneAtOnceRow, empathyPanel.shell.list);
    empathyPanel.shell.card.insertBefore(noStrengthRow, empathyPanel.shell.list);
    const reflectMobilitySimulations = (): void => {
      for (const [id, on] of [['#opt-onebtn', state.oneButton], ['#opt-semforca', state.noGripStrength]] as const) {
        const b = $<HTMLElement>(id);
        if (!b) continue;
        toggleBtn(b, on);
        b.textContent = toggleLabel(on);
      }
      markChanged(noStrengthRow, state.noGripStrength !== state.DEFAULTS.noGripStrength);
    };
    const simulate = (i: number, key: string): boolean => {
      const simulation = (key === 'normal' ? null : key) as VisualState['simulacao'];
      const player = players()[i] as { visual?: VisualState; viz?: string } | undefined;
      const base = player?.visual ?? worldState;
      const reason = simulation ? simulationUnavailable(base) : null;
      if (reason) { srSay(t(`sim.indisponivel.${reason}`)); return false; } // refusal VISÍVEL e explicada (ADR-0076)
      const nextVisual: VisualState = { ...base, simulacao: simulation };
      if (player) { player.visual = nextVisual; player.viz = key; }
      worldState = nextVisual;
      recomposeWorldFilter();
      return true;
    };
    // ONE LIST, NOT SEVEN BUTTONS (ADR-0159 rule 7) — `ui/simulation-list` says why, and it is not wiring.
    const simulationPicker = createSimulationList({
      find: $,
      make: (tag) => doc.createElement(tag),
      keys: WORLD_SIMULATIONS,
      running: () => worldState.simulacao ?? null,
      // a refused simulation (ADR-0076) is announced by `simular` and the re-render puts the list back on what runs
      picked: (key) => { simulate(0, key); empathy.render(); },
    });
    const empathy = initSettingsEmpathy({
      $, srSay, store,
      renderVizGroup: (listSelector) => { simulationPicker.render(listSelector); },
      reflectMobilityEmpathy: reflectMobilitySimulations,
      reflectVizButtons: noEffect,
      frontOverlay: overlays.frontOverlay,
      fillExplain: overlays.fillExplain,
      restoreFocus: overlays.restoreFocus,
      setHearingLoss: (on) => {
        setHearingLossGraph(on);
        store.set(store.KEYS.hearingloss, on);
        srSay(t(on ? 'sr.empathy.hearingOn' : 'sr.empathy.hearingOff'));
      },
      setOneButton: (on) => {
        state.setOneButtonValue(on);
        srSay(t(on ? 'sr.empathy.onebtnOn' : 'sr.empathy.onebtnOff'));
        reflectMobilitySimulations();
      },
      setWheelchair: noEffect,
      getOneButton: () => state.oneButton,
      getWheelchair: () => state.DEFAULTS.wheelchair,
      getPlayers: () => [{ viz: worldState.simulacao ?? 'normal' }],
      setPlayerViz: (i, rowMode) => { simulate(i, rowMode); },
    });
    // «sem força para segurar» is wired here: the empathy module predates it. Refused over toggle keys (ADR-0076): a latch
    // would hold what the simulation lets go, and the demonstration would show the accommodation instead of the difficulty.
    $<HTMLElement>('#opt-semforca')?.addEventListener('click', () => {
      const wire = !state.noGripStrength;
      if (wire && players().some((p) => (p as { toggleMove?: boolean }).toggleMove)) { srAlert(t('sim.indisponivel.alternancia')); return; }
      state.setNoGripStrengthValue(wire);
      srSay(t(wire ? 'sr.empathy.semforcaOn' : 'sr.empathy.semforcaOff'));
      empathy.render();
    });
    // and the panel's «restore defaults» turns it off too, after the module's own reset
    $<HTMLElement>('#empathy-reset')?.addEventListener('click', () => { state.setNoGripStrengthValue(false); empathy.render(); });
    engineActions.empatia = empathyPanel.open;

    /*
     * ACESSIBILIDADE AUDITIVA — o maior dos oito, e o que mais tinha a perder por não existir.
     *
     * 📏 Quinze nós que o painel alcançava e nunca criava; quem os constrói é `mountAudioInside`, ao lado
     * dele. ⚠️ E o interior entra ANTES do `init`, pela regra de ordem que os três painéis anteriores já
     * pagaram: `initSettingsAudio` liga TREZE cliques uma vez, no arranque.
     *
     * 📌 Nenhum dos dezanove campos do `ctx` é do jogo: o mixer, o volume, o modo cego, a bengala e a voz são
     * todos da engine, e `SinkPlayer` tem os campos todos opcionais — logo os jogadores do cartucho servem
     * como estão. Era o painel mais caro de montar e o menos dependente de quem o monta.
     */
    const audioPanel = mountPanel(panelCtx, {
      id: 'audio',
      // 📌 A LISTA DA CASCA É A DA NAVEGAÇÃO SONORA desde o ADR-0151: as categorias de gosto foram para o «Áudio».
      // O id `navsound-list` é o que `initSettingsAudio` já preenche com sonar, guarda e guia.
      listId: 'navsound-list',
      labels: () => ({
        title: t('menu.audio'),
        listLabel: t('audio.navsound.grupo'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      /*
       * ⚠️ O INTERIOR ENTRA NO RENDER, E NÃO SÓ NA MONTAGEM — e isto foi MEDIDO NUM NAVEGADOR a sério, com
       * `lang="en"`, em 2026-09-12: o painel servia o TÍTULO em inglês e as LINHAS em português, na mesma
       * tela. A moldura já se retraduzia (`MountPanelSpec.rotulos`); o interior corria uma vez e capturava o
       * texto do intervalo de arranque, onde o idioma ainda é o de recuo.
       *
       * 📌 `mountAudioInside` REETIQUETA o que já existe em vez de o refazer — refazer deixaria treze
       * controles no documento e sem escuta. E nenhum teste unitário apanhava isto: todos correm num idioma
       * só. Foi preciso o passo do plano que eu ainda não tinha dado.
       */
      render: () => {
        mountAudioInside(panelCtx, audioPanel.shell.card, audioPanel.shell.list);
        hideRowsWithoutSubject();
        audio?.renderAudio();
      },
    });
    mountAudioInside(panelCtx, audioPanel.shell.card, audioPanel.shell.list);
    /*
     * ÁUDIO — o som geral e as quatro categorias de gosto (ADR-0151 §2 item 4), separado da acessibilidade auditiva.
     * ⚠️ MONTADO ANTES do `initSettingsAudio`, pela regra de ordem dos irmãos: o interruptor geral, o volume e o
     * «repor» deste painel são ligados UMA vez, no arranque.
     */
    const soundPanel = mountPanel(panelCtx, {
      id: 'som',
      listId: 'audio-list',
      labels: () => ({
        title: t('menu.som'),
        listLabel: t('audio.grupo.rotulo'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => {
        mountSoundInside(panelCtx, soundPanel.shell.card, soundPanel.shell.list);
        audio?.renderAudio();
      },
    });
    mountSoundInside(panelCtx, soundPanel.shell.card, soundPanel.shell.list);
    // As duas linhas do painel auditivo que só existem onde há assunto — `ui/audio-rows-that-apply` diz porquê, e
    // não é fiação. ⚠️ Lido a cada abertura: a topologia é função, e um jogo muda de exigências entre fases (ADR-0084).
    const hideRowsWithoutSubject = (): void => showOnlyRowsThatApply({
      find: $,
      caneWord: () => subjectWord(cartridge.accommodations, 'caneSpacing'),
      hasNavigationSound: () => contractSubjects({
        declaration: cartridge.declaration,
        actions: cartridge.preset ? presetActions(cartridge.preset) : [],
        players: players().length,
      }).has('navigationSound'),
    });
    hideRowsWithoutSubject();
    audio = initSettingsAudio({
      $, srSay, store,
      /*
       * 🔴 O NAVEGADOR DO PAINEL DE ÁUDIO VEM DAQUI (ADR-0227). Ele era o último módulo com `globalReach`
       * acima de zero, e o que o passo 7d pede não é que ninguém toque no navegador — é que quem toca seja
       * quem o RECEBEU. Esta raiz recebe `doc` e `win` do hospedeiro (`EngineHost`), logo o alcance muda de
       * sítio e não de dono: sai de um painel que não sabe em que página está para o único módulo da árvore
       * que legitimamente sabe.
       */
      newElement: (tag) => doc.createElement(tag),
      speech: {
        voices: () => { try { return win.speechSynthesis?.getVoices() ?? []; } catch (e) { return []; } },
        speakSample: (sample, chosen) => {
          try {
            const ss = win.speechSynthesis;
            if (!ss) return;
            ss.cancel();
            const u = new SpeechSynthesisUtterance(sample);
            u.lang = 'pt-BR';
            if (chosen) u.voice = chosen;
            u.rate = 1; u.volume = 1;
            ss.speak(u);
          } catch (e) { /* o aparelho recusou falar; o painel já diz o que consegue */ }
        },
        whenVoicesChange: (again) => {
          try { if (win.speechSynthesis) win.speechSynthesis.onvoiceschanged = again; } catch (e) { /* noop */ }
        },
      },
      audioOutputs: {
        canList: () => !!(win.navigator?.mediaDevices && win.navigator.mediaDevices.enumerateDevices),
        canRoute: () => {
          const w = win as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
          return typeof (w.AudioContext ?? w.webkitAudioContext) !== 'undefined';
        },
        list: async () => {
          const md = win.navigator?.mediaDevices;
          if (!md?.enumerateDevices) return [];
          return (await md.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
        },
        detect: async () => {
          const md = win.navigator?.mediaDevices;
          if (!md?.enumerateDevices) return [];
          // 📌 A permissão é o que dá NOME às saídas: sem ela o navegador lista aparelhos anónimos, e uma
          // escolha entre «Saída 1» e «Saída 2» não é uma escolha. A faixa é solta no mesmo instante.
          await md.getUserMedia?.({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {});
          return (await md.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
        },
      },
      audioCats: AUDIO_CATS,
      toggleBtn,
      getNumPlayers: () => players().length,
      getPlayers: () => cartridge.players ?? [],
      getSoundOn: () => soundOn,
      setSoundOn,
      getVolume: () => volume,
      setVolume,
      getAudioCat: () => audioCat,
      setCatGain,
      tts,
      getBlindMode: readBlindMode,
      // 📌 O padrão do `core/state`: grava, persiste, avisa. Os efeitos de jogo são REACÇÃO, e quem reage
      // assina `on('blindMode', …)` — é a mesma decisão que o `ui/pause-icons` já tomou para o ícone.
      setBlindMode: state.setBlindModeValue,
      getCaneBlockDiv: () => state.caneBlockDiv,
      setCaneBlockDiv: state.setCaneBlockDivValue,
      fillExplain: overlays.fillExplain,
    });
    engineActions.audio = audioPanel.open;
    engineActions.som = soundPanel.open;
  }

  // 4b. NAVEGAÇÃO SONORA. Só o contrato entra: nada de tile, caixa de colisão ou array de moedas.
  const sonar = createAudioSonar({
    topology: () => cartridge.declaration.topology(),
    targetsOf: (i) => cartridge.declaration.targetsOf(i),
    nameAt: (at) => cartridge.declaration.nameAt(at),
    // Campo 2 + o barramento do mixer: o que o GUIA CONTÍNUO precisa e o bipe não precisava (#84 item 2). O
    // `roleAt` é o que deixa a rota contornar parede; o `catNode`/`audioOut`/`getVolume` são o que põem um
    // grafo PERMANENTE no mesmo cursor de volume que todo o resto do áudio usa.
    roleAt: (at) => cartridge.declaration.roleAt(at),
    tonePan, srSay, narrate: (text) => tts.narrate(text),
    catNode, audioOut, getVolume: () => volume,
    // ⚠️ A RESPOSTA, E NÃO A TABELA (#104). O `platform/audio-sonar` recebia o `VIZ_BY_KEY` e atravessava-o
    // com `pl.viz`; ele deixou de saber o que é um modo visual, e quem responde é aqui — a raiz é a única
    // camada que conhece os dois eixos E pode importar de `render/`.
    visionImpaired: (pl) => {
      const v = (pl as { visual?: VisualState }).visual;
      return !!v && (isBlind(v) || isLowVision(v));
    },
    getBlindMode: readBlindMode, LOGICAL_W,
    // O jogador DERIVADO do foco: campo 4 respondendo "onde a criança está". Um jogo que não fornece lista
    // ainda tem sonar, e é isso que faz a pilha de acessibilidade não ser acessório.
    getPlayers: cartridge.sonarPlayers ?? (() => {
      const f = cartridge.declaration.focusOf(0);
      return f ? [{ i: 0, x: f.at.x, y: f.at.y, visual: DEFAULT_VISUAL }] : [];
    }),
    getNumPlayers: () => (cartridge.players ?? [null]).length,
    getAudioCtx: () => audioCtx, getSoundOn: () => soundOn, getAudioCat: () => audioCat,
  });

  // 5. Teclado remapeável — o melhor recorte da base (achado 11): esquema de teclas, sem mundo.
  //
  // ⚠️ O PADRÃO DO JOGO REGISTA-SE ANTES DO `initKB()`, e a ordem é a regra: quem lê o disco já tem de saber
  // qual é a fábrica sobre a qual o dado da criança se sobrepõe (ADR-0115). Registar depois deixaria o
  // primeiro arranque com a fábrica da ENGINE e o segundo com a do jogo — a pior espécie de defeito, porque
  // desaparece quando alguém vai ver.
  // 📌 E o registo aceita `null`, que é o que um jogo sem opinião produz: fica a fábrica da engine.
  /*
   * OS DOIS REGISTOS NUMA FUNÇÃO, porque são EFEITO GLOBAL e não valor: quem os chama por último ganha.
   *
   * ⚠️ É o que os torna diferentes de tudo o mais nesta raiz. Repontar uma leitura para o `cartucho` chega
   * para os campos que são lidos quando alguém pergunta; estes dois já foram escritos noutro sítio no
   * momento do arranque, então trocar de cartucho sem os reescrever deixa o mapa do anterior a valer —
   * calado, e exactamente no lugar onde uma criança que remapeou teclas iria notar primeiro.
   *
   * 📌 `null` é o valor honesto de «este jogo não tem opinião», e é também o que o `desmontar()` escreve.
   */
  function registerCartridgeMappings(): void {
    registerKeyboardMapping(
      cartridge.declaration.keyboardMapping
        ? (players, seat) => cartridge.declaration.keyboardMapping!(players, seat)
        : null,
    );
    // ⚠️ E O DO CONTROLE REGISTA-SE AQUI AINDA QUE ESTA RAIZ NÃO MONTE GAMEPAD NENHUM. Não é descuido: quem
    // chama `initGamepad` é o cartucho, e é exactamente por isso que o registo não pode viver lá — seria mais
    // um campo que um jogo pode esquecer, e esquecê-lo devolve o mapa da ENGINE a quem declarou outro, calado.
    registerPadMapping(
      cartridge.declaration.padMapping
        ? (players, seat) => cartridge.declaration.padMapping!(players, seat)
        : null,
    );
  }
  registerCartridgeMappings();
  initKB();
  // (`semAlcance`, `semJogadores` e `players` SUBIRAM para cima do `initPauseIcons` em 2026-09-12 — issue #147.)
  const keyboard = initKeyboardRuntime({
    getKB: () => kb, getNumPlayers: () => players().length, getPlayers: () => players(),
  });
  /** O painel «Mapear teclado», quando montado. Declarado aqui porque a navegação de menu, logo abaixo, pergunta-lhe se
   *  está a capturar uma tecla — e ele só nasce com o painel motora, mais adiante. */
  let keyboardControls: SettingsControlsApi | null = null;
  keyboard.assignControls();

  /*
   * AS TRÊS RESPOSTAS QUE O CARTUCHO PODE SUBSTITUIR, resolvidas UMA vez. Elas alimentam a navegação de menu e, desde
   * o ADR-0224, também o comando — e escrever o mesmo `??` em dois sítios é escrever a mesma decisão duas vezes, que é
   * a forma de defeito que este ficheiro já pagou noutras três.
   */
  const isOnBar = cartridge.onBar ?? ((i: number) => pauseIcons.onBar(i));
  const navBar = cartridge.navBar ?? ((i: number, k: NavKeys, withStart?: boolean) => pauseIcons.navBar(i, k, withStart));
  const setPauseActor = cartridge.setPauseActor ?? ((): void => {});

  // 6. Navegação de menu. Os três declínios entram como AUSÊNCIA DECLARADA, não como getter que devolve null.
  const nav = initMenuNav({
    $, getActiveElement: () => doc.activeElement,
    topVisibleOverlay: overlays.topVisibleOverlay, closeById: overlays.closeById,
    getPauseMenu: (i) => $<HTMLElement>(`#vp-pause-${i}`),
    // ⚠️ ERA `cartucho.setPhase ?? (() => {})`, E ESSE PADRÃO VAZIO ERA A SAÍDA DA PAUSA A CAIR NO CHÃO. O
    // «não» na raiz do cartão faz `setPhase('playing')` (`ui/menu-nav:403`) e mais nada — não esconde nada —,
    // então num jogo sem o gancho o Escape não fechava a pausa que o ADR-0144 agora abre. Passa pelo mesmo
    // `mudarDeFase` que o item «continuar»: uma saída só, seja qual for a porta por que a criança sai.
    setPhase: changePhase,
    setPauseActor,
    srSay,
    // Sem opinião declarada, o índice fica LIGADO: quem precisa dele para se orientar não tem como saber
    // que ele existe se vier desligado (a mesma razão de o modo cego nascer com TTS e sonar).
    withIndex: cartridge.withIndex ?? (() => true),
    explainItem: (text) => writeInFooter(text),
    isNavigable: cartridge.isNavigable ?? (() => true),
    /*
     * ⚠️ ESTE PADRÃO ERA `() => false` / `() => {}`, E DESDE HOJE ISSO SERIA UM BURACO QUE EU ABRI. O
     * comentário que estava aqui dizia «um hospedeiro que não tenha barra de acessibilidade responde nunca e
     * nunca chama nada» — verdade até a etapa 2 do ADR-0106, quando esta raiz passou a MONTAR a barra.
     *
     * Com a barra montada e estes dois em no-op, ela existiria e **não se conseguiria navegar por teclado nem
     * por controle**: alcançável só por ponteiro. Para uma criança cega, que navega por teclado, uma barra
     * que ela não alcança é o mesmo que barra nenhuma — e é exactamente o «oferece o caminho e depois
     * refusal-o» que o §5 do ADR-0106 proíbe.
     *
     * A engine responde com a SUA instância, que é a mesma que montou a barra. Quem injecta continua a mandar.
     *
     * ⚠️ E FICA UMA METADE POR LIGAR, dita aqui em vez de descoberta: o `navBar` do `ui/menu-nav` recebe
     * `(i, k)` e não o terceiro argumento `temStart`, que é a borda do botão de pausa — a SEGUNDA saída do
     * modo (ADR-0044 item 7). No cartucho ela chega por outra rota (o encaminhador do gamepad, `main.ts:1470`)
     * que esta raiz ainda não monta. Logo: o direcional navega a barra; sair por START, por enquanto, não.
     */
    onBar: isOnBar,
    navBar,
    // ⚠️ ERA `() => false`: sem painel de remapeamento não havia captura. Agora há (ADR-0151), e com isto a falso a
    // seta que a criança quer gravar navegava o menu em vez de ficar na tecla.
    isCapturing: () => keyboardControls?.isCapturing() ?? false,
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
  /*
   * 🔴 ONE BUTTON ONLY TAKES THE KEY BEFORE EVERYONE ELSE (ADR-0218, issue #201), and that is why this listener is registered
   * HERE, above `nav.attach()`, instead of beside the cool-down and the simulations further down.
   *
   * With the scan on, the child has ONE input in the world, and every press of it means the same thing: take what is showing.
   * It must not also move a menu, reach the game or feed the motor filters — so the press is stopped dead (`barrar`) and the
   * scan decides what happens. Listeners on one node run in the order they were registered, and `stopImmediatePropagation`
   * only reaches the ones after it: registered below the menu navigation, this would have let the menu move AND the scan take,
   * which is one press doing two things.
   *
   * ⚠️ `scanPress` is filled in much later, where the virtual controller exists. Until then, and whenever the scan is off,
   * this listener answers nothing — the same hoisting the pause card's host uses, and for the same reason: what has to run
   * first is not what can be built first.
   */
  const blockKey = (e: Event): void => { e.preventDefault(); e.stopImmediatePropagation(); };
  let scanPress: ((source: TransportName) => void) | null = null;
  win.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!state.switchScan || !scanPress || keyboard.whichPlayer(e.code) < 0) return;
    // A HELD KEY IS ONE PRESS, not one a frame: a child who cannot let go would otherwise take an item every repeat.
    if (!e.repeat) scanPress(sourceOfEvent(e) ?? 'teclado');
    blockKey(e);
  }, true);
  win.addEventListener('keyup', (e: KeyboardEvent) => {
    if (state.switchScan && scanPress && keyboard.whichPlayer(e.code) >= 0) blockKey(e);
  }, true);

  // ⚠️ E AGORA A NAVEGAÇÃO DE MENUS LIGA — depois do bloco acima, e a ORDEM É O COMPORTAMENTO: ouvintes de um mesmo nó correm
  // pela ordem de registo, logo a varredura vê a tecla primeiro e pode pará-la. Ao contrário, uma pressão moveria o menu E
  // levaria um item (ADR-0218). 🔴 Esta chamada desapareceu por um instante ao escrever o bloco acima e nenhum tipo o viu: uma
  // chamada perdida não é um nome por resolver. Seis casos de navegador a apanharam — os menus respondiam só ao rato.
  nav.attach();

  // ⚠️ E A ARMADILHA DE FOCO, que não existia em lado nenhum — os outros dois fios eram montados e deixados
  // desligados; este nunca tinha sido escrito. Com um overlay aberto, o Tab entrava no tabuleiro por baixo,
  // enquanto todo `.overlay__card` do documento diz `aria-modal="true"`. Uma promessa que o teclado desmente
  // é pior do que promessa nenhuma: quem usa leitor de tela sai para um jogo cujo estado não percebe.
  initFocusTrap({
    topOverlay: overlays.topVisibleOverlay,
    currentFocus: () => doc.activeElement,
    focusablesIn: focusablesInDom,
    win,
  }).attach();

  /**
   * O ALCANCE: entre os transportes DISPONÍVEIS a esta criança, algum carrega as ações deste jogo?
   *
   * ⚠️ A detecção segue o que o projeto JÁ usa para a mesma pergunta (`isCoarsePointer` em `game/session`):
   * `pointer:coarse && hover:none` é toque, e o contrário é teclado. Ela erra num tablet COM teclado — e o
   * erro só é tolerável porque a tela INFORMA em vez de recusar. Ver o cabeçalho de `ui/reach-notice`.
   */
  const deviceAvailability: Availability = o.availability ?? {
    gamepad: () => { try { return [...(win.navigator?.getGamepads?.() ?? [])].some(Boolean); } catch { return false; } },
    touch: () => { try { return win.matchMedia('(pointer:coarse)').matches && win.matchMedia('(hover:none)').matches; } catch { return false; } },
    keyboard: () => { try { return !(win.matchMedia('(pointer:coarse)').matches && win.matchMedia('(hover:none)').matches); } catch { return true; } },
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
    mouse: () => { try { return win.matchMedia('(any-pointer:fine)').matches; } catch { return false; } },
  };
  // O segundo eixo entra aqui, e vem do jogo (ADR-0104 §A): quantas posições ele segura ao mesmo tempo.
  // ⚠️ O TERCEIRO EIXO ENTRA AQUI (ADR-0112), e vem do jogo tal como os outros dois. `?? false` e não um
  // padrão inventado: o campo é opcional de propósito — ver a nota nele —, e a ausência significa «este jogo
  // não desenha», que é a resposta certa para a esmagadora maioria dos trezentos.
  /*
   * O ALCANCE E O SEU AVISO, numa função, porque os dois dependem do cartucho e o segundo CRIA DOM.
   *
   * ⚠️ O aviso é o único sítio desta raiz que escreve um elemento a partir de uma resposta do jogo, e por
   * isso é o único que precisa de ser RETIRADO antes de ser reescrito: `showReachNotice` cria um `div`
   * com `id` fixo, então chamá-lo duas vezes deixaria dois — e o segundo cartucho ficaria com o aviso do
   * primeiro por baixo do seu.
   *
   * 📌 `retirarAvisoDeAlcance()` corre SEMPRE antes, e não só quando há o que mostrar: um cartucho que não
   * tem nada a avisar tem de apagar o aviso do anterior, e é esse o caso que se esquece.
   */
  function removeReachNotice(): void {
    const notice = $<HTMLElement>(`#${REACH_NOTICE_ID}`);
    if (!notice) return;
    // ⚠️ CAPACIDADE E NÃO TIPO, pela mesma razão que este ficheiro já escreve mais acima sobre o
    // `instanceof HTMLElement`: o hospedeiro pode ser um documento falso, e os que estes testes usam têm
    // `parentNode` mas não `remove`. Perguntar pelo método é o que funciona nos dois.
    if (typeof notice.remove === 'function') notice.remove();
    else notice.parentNode?.removeChild(notice);
  }
  function deriveReach(): Reach {
    const declaredActions = cartridge.preset ? presetActions(cartridge.preset) : [];
    const a = reach(
      defaultTransports(deviceAvailability),
      declaredActions,
      cartridge.declaration.holdsAtOnce(),
      cartridge.declaration.needsPointer?.() ?? false,
    );
    removeReachNotice();
    // ⚠️ SÓ APARECE QUANDO HÁ O QUE DIZER. Um aviso que aparece sempre deixa de ser lido, e um jogo cujas
    // ações cabem no toque não tem nada a avisar — que é o caso comum e tem de continuar silencioso.
    if (declaredActions.length) {
      showReachNotice({
        find: (sel) => $<HTMLElement>(sel),
        create: (tag) => doc.createElement(tag),
        t,
        srAlert,
      }, a);
    }
    return a;
  }
  let currentReach = deriveReach();

  // O ANÚNCIO DE QUE O LAÇO PAROU (ADR-0054). Entregue e não instalado: quem chama `startLoop` é o JOGO, que
  // é o dono do ticker. Um jogo que monte o laço sem passar isto continua a PARAR — parar não é opcional; o
  // que ele perde é dizer que parou.
  /*
   * A BARRA É HUD, E O JOGO NÃO ESCREVE POR CIMA DELA (ADR-0148 §3).
   *
   * 🔴 MEDIDO no `dist/quiz.html` em 2026-09-12: `#title-icons` é `position:absolute` DENTRO do
   * `#game-region`, em (123,15) 337×44 — e o `H2.quiz-pergunta` ocupa os mesmos pixels. A criança que
   * procura o modo cego encontra o título da pergunta por cima dos botões. ⚠️ E nada falhava: sem erro, sem
   * tipo, sem consola. Só uma fila de botões tapada, e quem mais depende dela é quem não vê que está tapada.
   *
   * 📌 A ENGINE DIZ, e não conserta — porque não pode. Empurrar o conteúdo do jogo significaria mexer na
   * largura e altura que o `ui/layout` trava em múltiplo inteiro de pixels reais, e isso é a escala do
   * ADR-001. O que ela tem é o rectângulo; quem desenha é o jogo, e agora sabe onde não desenhar.
   *
   * ⚠️ POR CAPACIDADE E NÃO POR TIPO, como o resto deste ficheiro já faz: um documento falso não tem
   * `getBoundingClientRect`, e lê-lo às cegas derrubaria o boot num ambiente sem DOM — que é metade dos
   * testes desta árvore. Sem a medida, não se acusa: silêncio é melhor do que uma acusação inventada.
   */
  /*
   * A RESOLUÇÃO É DA ENGINE (ADR-0163), e o cartucho não tem outra.
   *
   * 🔴 O `createGame` nunca corria o ADR-0001: medido, o quiz saía a 569×395 — nem múltiplo de 320×180 nem 640 de
   * largura —, e o piso de alvo por altura nunca era escrito. O Dev: «A Engine deve forçar isso e guiar esta construção,
   * de modo que o cartucho não tenha alternativa». A região passa a ter o maior múltiplo inteiro de 320×180 em pixels
   * REAIS que cabe no palco, nunca menos de 640×360, com a tolerância de ≤5 px lógicos de corte por lado — e de novo a
   * cada mudança de tamanho da janela.
   * ⚠️ O PALCO é a casca `#stage-wrap`/`.stage-wrap` quando existe; sem ela, o pai da região — o espaço que ela tem.
   * ⚠️ POR CAPACIDADE, como o resto: um duplo sem `style.setProperty` não é redimensionado, e o boot não cai por isso.
   */
  let appliedScale: Scale | null = null;
  /**
   * What departs is SAID (ADR-0163 rule 4): the region's measured size against the one the engine gave it, read when
   * `problems` is read — a cartridge that resizes the region after boot is seen then, and the line goes when it stops.
   */
  function regionResizedByCartridge(): string | null {
    const regionEl = $<HTMLElement>('#game-region');
    if (!appliedScale || !regionEl || typeof regionEl.getBoundingClientRect !== 'function') return null;
    const r = regionEl.getBoundingClientRect();
    if (!r.width || !r.height) return null; // not laid out: nothing measured, nothing to accuse
    const { width: scaledWidth, height: scaledHeight } = appliedScale;
    if (Math.abs(r.width - scaledWidth) < 1 && Math.abs(r.height - scaledHeight) < 1) return null;
    return `the cartridge sized #game-region to ${Math.round(r.width)}×${Math.round(r.height)} over the engine's `
      + `${Math.round(scaledWidth)}×${Math.round(scaledHeight)}: text and targets stop following the screen, so a child with low vision `
      + 'gets them small — the resolution is the engine\'s (ADR-0163): lay the game out inside the region and read `--ui-fs` and `--alvo-min`';
  }
  /*
   * O CONTEXTO DOS DOIS RELATORES DE DESENHO (`ui/drawing-problems`), e os três leitores são FUNÇÕES de propósito: a região, a
   * barra e a escala são coisas que esta raiz TROCA — um `mount()` troca o cartucho, a barra nasce depois da raiz, e a escala
   * muda a cada `resize`. Passá-las por valor congelaria a primeira resposta, e um elemento fora da página continua a
   * responder `getBoundingClientRect()` sem se queixar.
   */
  const drawingContext: DrawingProblemsCtx = {
    region: () => $<HTMLElement>('#game-region'),
    bar: () => a11yBar,
    scale: () => appliedScale,
    computedStyle: typeof win.getComputedStyle === 'function' ? (el) => win.getComputedStyle(el) : undefined,
  };
  function applyResolution(): void {
    const regionEl = $<HTMLElement>('#game-region');
    const stage = $<HTMLElement>('#stage-wrap') ?? $<HTMLElement>('.stage-wrap') ?? (regionEl?.parentElement ?? null);
    if (!regionEl || !stage || typeof regionEl.style?.setProperty !== 'function') return;
    const { w, h } = screenBaseSize(Math.max(1, players().length));
    appliedScale = stageScale(stage.clientWidth || w, stage.clientHeight || h, win.devicePixelRatio || 1, w, h);
    applyScale(regionEl, appliedScale);
    crtScanVars(); // the scanline period is one art pixel in REAL pixels, so it follows the scale (study item A5)
    reserveBarBand();
  }
  /**
   * THE ROOM THE GAME LEAVES FREE UNDER THE TOP EDGE (ADR-0148 §3, erratum of 2026-09-13; issue #160), written as
   * `--barra-a11y-h` on the region: the bar's own offset, the bar, the line of the pointed icon's NAME under it, and a
   * light gap of a quarter of that line's font (4 px at 640×360). 📏 Measured at 640×360: the variable said 44 px (the bar alone) and the name, at
   * 57–87 px, covered the quiz statement. The Dev: «é necessário que exista um leve espaçamento abaixo da barra».
   * 📌 The name line is counted whether or not a name is showing — reserving only while pointing would move the game
   * under the child's finger. Measured again at every scale and every typography step: both change the text's size.
   * ⚠️ Zero without a bar: nothing to reserve.
   * 📌 With a HUD (ADR-0175) the room also holds the two top columns — points and mission on the left, power on the right —
   * when either reaches lower than the bar's room; each is narrowed so it never reaches the bar.
   */
  function reserveBarBand(): void {
    reserveTopBand({
      region: $<HTMLElement>('#game-region'),
      bar: a11yBar as HTMLElement | null,
      hud: hudMounted,
      ...(typeof win.getComputedStyle === 'function' ? { computedStyle: (el: HTMLElement) => win.getComputedStyle(el) } : {}),
    });
  }
  /*
   * THE HUD the engine mounts from the cartridge's `hud` (ADR-0168; issue #162). Read on every animation frame while mounted —
   * the numbers are functions, so a game never has to say «refresh»; only a changed text is written, and a changed text
   * measures the room again, because a longer number can wrap.
   */
  let hudMounted: HudBandsMounted | null = null;
  let hudFrame = false;
  function mountHud(): void {
    hudMounted?.remove();
    hudMounted = null;
    const regionEl = $<HTMLElement>('#game-region');
    const numbers = cartridge.hud ?? [];
    if (numbers.length && regionEl && typeof regionEl.appendChild === 'function') hudMounted = mountHudBands(doc, regionEl, numbers);
    reserveBarBand();
    if (hudMounted && !hudFrame && typeof win.requestAnimationFrame === 'function') {
      hudFrame = true;
      const position = (): void => {
        if (!hudMounted) { hudFrame = false; return; }
        if (hudMounted.refresh()) reserveBarBand();
        win.requestAnimationFrame(position);
      };
      win.requestAnimationFrame(position);
    }
  }
  mountHud();
  applyResolution();
  if (typeof win.addEventListener === 'function') win.addEventListener('resize', applyResolution);

  /*
   * THE SKIP LINK, when the page has none (study item C5; WCAG 2.4.1). The stylesheet rule, the dictionary sentence and its
   * layer (ADR-0102) already existed, and the element depended on each page remembering it: the quiz writes its own, and a
   * cartridge page that did not copy it left a keyboard no way over what precedes the game. First in the body, so it is the
   * first thing a keyboard reaches; a page's own link is kept. By capability: a host double without a body mounts nothing.
   */
  if (doc.body && typeof doc.body.insertBefore === 'function' && !$('.skip-link')) {
    const skipLink = doc.createElement('a');
    skipLink.className = 'skip-link';
    skipLink.setAttribute('href', '#game-region');
    skipLink.setAttribute('data-i18n', 'skip.toGame');
    skipLink.textContent = t('skip.toGame');
    doc.body.insertBefore(skipLink, doc.body.firstChild); // `data-i18n`: every `setLocale` rewrites it, the boot's included
  }

  /*
   * THE LETTER CASE REACHES THE PAGE (ADR-0028; ADR-0149 §1). The stylesheet capitalises under `:root[data-letras="upper"]`,
   * and nothing wrote that attribute: the communication button's first position kept «capitals» in the state and showed
   * natural case (reported by the Dev). Written at every change, and at boot only when the child CHOSE a case — the state's
   * default is `upper` (ADR-0028) while the cycle's default is position (c), natural case (ADR-0149), and writing the default
   * would put every new child's game in capitals.
   */
  const writeBox = (c: state.LetterCase): void => {
    if (doc.documentElement?.dataset) doc.documentElement.dataset.letras = c;
  };
  if (store.get(store.KEYS.letterCase, null) !== null) writeBox(state.letterCase);
  state.on('letterCase', writeBox);

  {
    // the reserved room itself (`--barra-a11y-h`, next to `--tap` and `--alvo-min`) is written by `reservarFaixaDaBarra`,
    // inside `aplicarResolucao`; here the engine says who draws over the bar anyway
    const intruders = barIntruderProblems(drawingContext);
    if (intruders.length) {
      hostProblems.push(
        `the game draws over the accessibility bar (${intruders.slice(0, 4).join(', ')}): a child who needs its buttons `
        + 'to start cannot reach them — read `--barra-a11y-h` on #game-region and leave that room free (ADR-0148)',
      );
    }
  }

  const announceFailure = createCrashNotice({
    find: (sel) => $<HTMLElement>(sel),
    create: (tag) => doc.createElement(tag),
    narrate: (text) => tts.narrate(text),
  });
  // study item D1: every `startLoop` that passes no `onFailure` announces through this one (measured: game-soccer passes none)
  registerCrashNotice(announceFailure);

  /*
   * ⚠️ MOSTRAR REFAZ OS ITENS ANTES DE REVELAR, e a ordem é a regra: o §5 do ADR-0106 diz que a criança nunca
   * vê um item que não acciona, e a tabela de acções deste jogo pode ter mudado desde a montagem. Revelar
   * primeiro e refazer depois deixaria um piscar em que ela vê o que não pode usar.
   */
  const pauseControls = {
    show: (i: number) => {
      pauseIcons.reflectPauseIcons();
      const findPauseCard = $<HTMLElement>(`#vp-pause-${i}`);
      if (!findPauseCard) return;
      findPauseCard.hidden = false;
      updateCaption();
      // 🔴 O CURSOR POUSA NO ITEM 1, na raiz (ADR-0158: «a saída é onde o cursor cai ao abrir»). Medido no `dist`: aberto
      // pelo SELECT nenhum item ficava marcado, e a primeira seta saltava para o item 2.
      showPauseOptions(findPauseCard, 'raiz');
    },
    hide: (i: number) => {
      const findPauseCard = $<HTMLElement>(`#vp-pause-${i}`);
      if (findPauseCard) findPauseCard.hidden = true;
      updateCaption();
    },
  };

  /*
   * ===================== E AGORA ALGUMA COISA ABRE A PAUSA (ADR-0144) =====================
   *
   * 🔴 MEDIDO em 2026-09-12, e é o buraco por baixo de tudo o que esta semana construiu: `git grep` por
   * `vp-pause-` devolvia a montagem, o `getPauseMenu` da navegação e o par `show`/`hide` daqui —
   * NADA revelava o cartão sem o jogo pedir. Os quatro painéis estavam no documento e inalcançáveis, que é
   * o mesmo que não existirem e custou mais a construir.
   *
   * ⚠️ BOLHA, E NÃO CAPTURA, e esta foi a decisão medida antes de escrever uma linha. `menuNavKey` corre em
   * CAPTURA com `stopPropagation()`, e o cabeçalho de `ui/menu-nav` guarda DOIS defeitos preservados sobre
   * isso — o comportamento correcto de hoje depende daquele `stopPropagation()` e não da cadeia registada.
   * Pôr um segundo significado na mesma fase seria mexer nessa rede de segurança acidental de lado. Em
   * bolha, `menuNavKey` tem sempre a primeira refusal, e o ouvinte do PRÓPRIO jogo — que vive em
   * `#game-region`, por baixo da janela — corre antes deste. Quem é dono da tecla continua dono dela.
   *
   * 📏 E `menuNavKey` NÃO come esta tecla: `menuKeyIntent` não tem ramo para «start» (só `action2`,
   * `action3` e as quatro direcções), logo `hasIntent` é falso e ele sai sem consumir. É precisamente por
   * isso que os TRÊS GUARDAS abaixo tiveram de ser escritos — em três situações reais a tecla chega aqui e
   * não é nossa. Cada um deles foi lido no código que o produz, não imaginado.
   *
   * ⚠️ A ENGINE ABRE O CARTÃO; QUEM PÁRA O MUNDO É O JOGO (ADR-0144 §2). `pausa.mostrar` faz duas coisas e
   * só duas. Congelar a física e calar o ambiente eram do `ui/shell`, que esta raiz refusal montar de
   * propósito — e por isso a segunda metade é um pedido, `setPhase('paused')`, e não uma ordem.
   */
  /** O assento dono de uma tecla, se ela for a posição `presetAction` DELE; senão `null`. */
  function seatOfPosition(code: string, presetAction: 'start' | 'select' | 'action4'): number | null {
    // ⚠️ O DONO DA TECLA DECIDE O ASSENTO, como em `menuNavKey`: quem carregou é quem abre a SUA pausa. Uma
    // tecla que não é de ninguém (`-1`) não pode ser «start» de assento nenhum — perguntar por ela ao
    // assento 0 devolveria a pausa do Jogador 1 a quem carregou numa tecla solta.
    const keyOwner = keyboard.whichPlayer(code);
    if (keyOwner < 0) return null;
    return keyboard.actionOf(code, keyOwner) === presetAction ? keyOwner : null;
  }

  /*
   * ===================== A PAUSA RÁPIDA — o START (ADR-0155) =====================
   *
   * O jogo CONGELA (pede-se `setPhase('paused')`, como o ADR-0144 §2 pedia para o cartão), o direcional vai para
   * a BARRA, e a palavra PAUSADO aparece ao centro. Nenhum cartão é desenhado: é a vista do print.
   *
   * 📌 UMA SAÍDA SÓ, por qualquer porta. O Voltar dentro da barra, o START outra vez e o SELECT todos acabam em
   * `pauseIcons.sairDaBarra`, e é o gancho `aoSairDaBarra` que descongela. Duas saídas escritas à parte seriam
   * duas oportunidades de uma delas deixar o mundo parado com a criança de volta ao personagem.
   *
   * ⚠️ E O ESTADO É «EM PAUSA RÁPIDA», não «na barra»: um hospedeiro sem `#title-icons` não tem barra onde
   * entrar, e a pausa rápida continua a congelar e a dizer PAUSADO — com o START a sair dela. Perguntar à barra
   * seria prender essa criança num jogo parado.
   */
  let pausedWord: HTMLElement | null = null;
  /*
   * A LEGENDA DO RODAPÉ da tela congelada (errata do ADR-0155, «Ambos»): «Ação 2: confirmar · Ação 3: voltar ·
   * Ação 4: menu · START: voltar ao jogo». É a segunda porta dos menus — o `action4` — e é também o que diz à
   * criança que o SELECT não é a única: a tela parada passa a ensinar como se sai dela e para onde.
   * (`legendaDaPausa` is declared before `mudarDeFase`; see there.)
   */

  function showPaused(): void {
    const regionEl = $<HTMLElement>('#game-region');
    if (!pausedWord && regionEl && typeof regionEl.appendChild === 'function') {
      pausedWord = doc.createElement('div');
      pausedWord.className = 'pausa-rapida';
      // O leitor de tela já ouve a entrada na barra, que diz que o jogo parou e como voltar; a palavra é para
      // os olhos, e dita duas vezes atropelava o anúncio que ensina a sair.
      pausedWord.setAttribute('aria-hidden', 'true');
      regionEl.appendChild(pausedWord);
    }
    if (!pausedWord) return;
    // resolvidas AO MOSTRAR: o idioma pode ter mudado desde o arranque
    pausedWord.textContent = t('pause.quick');
    pausedWord.hidden = false;
    updateCaption();
  }

  /**
   * THE BUTTON LEGEND FOLLOWS THE SCREEN (ADR-0164 rule 3): on the quick pause it says the quick pause's buttons, on the
   * pause card (SELECT) the menu's — «2: confirmar · 3: voltar» —, and nothing in play. Asked again whenever one of them
   * opens or closes; a card hidden by a path that calls nothing here (the print mode) is seen by the observer below.
   */
  function updateCaption(): void {
    const cardOpen = !!$<HTMLElement>('.screen-pause:not([hidden])');
    const text = inQuickPause.size ? t('pause.quick.legenda') : cardOpen ? t('pause.card.legenda') : null;
    if (!text) { if (pauseCaption) pauseCaption.hidden = true; return; }
    if (!pauseCaption) {
      const home = screenFooter($<HTMLElement>('#game-region'));
      if (!home) return;
      pauseCaption = doc.createElement('div');
      pauseCaption.className = 'pausa-legenda';
      pauseCaption.setAttribute('aria-hidden', 'true');
      home.appendChild(pauseCaption);
    }
    writeCaption(pauseCaption, text); // resolved when shown: the language may have changed since boot
    pauseCaption.hidden = false;
  }
  /*
   * EVERY CHANGE OF CONTEXT IS ANNOUNCED (ADR-0159 rule 3): «Opening a menu or panel speaks its title; closing it speaks
   * where the child is back to; entering play is announced.» 📏 Measured in the dist: SELECT opened the card in silence,
   * and a panel opened, closed and went back to the root without a word.
   * 📌 ONE PLACE, by comparison: the observer below asks where the child is now — a panel, a list of the card, or the
   * game — and speaks only when that changed. An arrow changes no `hidden`, so it still says only the item.
   */
  let screenAnnounced = 'jogo';
  const rootWithIndex = (): boolean => (cartridge.withIndex ?? (() => true))();
  /*
   * 🔴 A PERGUNTA MUDOU-SE PARA `ui/where-the-child-is` (ADR-0221 passo 7c), e o que fica aqui é responder de onde ela
   * lê o documento. 📏 Era a função mais densa deste ficheiro depois do corpo da própria raiz — 19 ramos em 24 linhas
   * — e nenhum deles era fiação: «isto é um painel, uma lista do cartão ou o jogo, e como se chama» é uma regra com
   * razão, e a errata do ADR-0221 mede a dívida de uma raiz em RAMOS.
   * 🎯 Sondada ANTES de sair, que é a ordem, e a sonda achou QUATRO ramos cegos de nove — dois presos em
   * `engine:e75a54ea`, um medido como equivalente hoje e um nomeado como trabalho (o `comIndice` do ADR-0167).
   */
  const whereIsTheChild = (): Place => whereTheChildIs({
    topVisibleOverlay: overlays.topVisibleOverlay,
    pauseCard: () => $<HTMLElement>('.screen-pause:not([hidden])'),
    focused: () => doc.activeElement,
    withIndex: rootWithIndex,
  });
  function announceContext(): void {
    const nowMs = whereIsTheChild();
    if (nowMs.key === screenAnnounced) return;
    const cameFromMenu = screenAnnounced !== 'jogo';
    screenAnnounced = nowMs.key;
    if (nowMs.sentence) srSay(nowMs.sentence);
    // back in play from a menu — the quick pause says its own exit
    else if (cameFromMenu && !inQuickPause.size) srSay(t('sr.a11y.barExit'));
  }
  {
    const regionEl = $<HTMLElement>('#game-region');
    const Observer = (win as unknown as { MutationObserver?: typeof MutationObserver }).MutationObserver;
    if (regionEl && Observer && typeof regionEl.appendChild === 'function') {
      new Observer((records) => {
        const classes = records.map((r) => (r.target as Element).classList);
        if (classes.some((c) => c?.contains('screen-pause'))) updateCaption();
        if (classes.some((c) => c?.contains('screen-pause') || c?.contains('overlay') || c?.contains('pause-menu'))) announceContext();
        // ADR-0166: the pad leaves when the card or a panel opens, and comes back when the last of them closes
        if (classes.some((c) => c?.contains('screen-pause') || c?.contains('overlay'))) reflectPadInMenus();
        // a simulation stops while a menu is open and comes back with the game (issue #182)
        if (classes.some((c) => c?.contains('screen-pause') || c?.contains('overlay'))) recomposeWorldFilter();
      }).observe(regionEl, { attributes: true, attributeFilter: ['hidden'], subtree: true });
    }
  }

  /*
   * O RODAPÉ DA TELA: uma coluna só, no fundo da região, com a EXPLICAÇÃO do ícone apontado por cima da LEGENDA da
   * pausa rápida. Pedido do Dev — o nome debaixo da fileira, o que ele faz no rodapé (`CLAUDE.md` §4, as três zonas).
   * ⚠️ UMA COLUNA e não duas faixas posicionadas à parte: a pausa rápida já pousa o cursor no primeiro ícone ao entrar,
   * logo as duas aparecem juntas desde o primeiro instante, e duas caixas absolutas tapavam-se quando uma quebrava linha.
   */
  function screenFooter(regionEl: HTMLElement | null): HTMLElement | null {
    if (footer || !regionEl || typeof regionEl.appendChild !== 'function') return footer;
    footer = doc.createElement('div');
    footer.className = 'rodape-da-tela';
    regionEl.appendChild(footer);
    return footer;
  }
  /**
   * The button legend as one dark chip per «name: function» (ADR-0164 rule 3) — the dictionary writes the items joined
   * by « · », and each becomes its own element so the background sits behind the words and not across the screen.
   */
  function writeCaption(home: HTMLElement, text: string): void {
    home.textContent = '';
    text.split('·').map((s) => s.trim()).filter(Boolean).forEach((item, i) => {
      // a space between chips, by capability: a host document without createTextNode still gets the chips
      if (i > 0 && typeof doc.createTextNode === 'function') home.appendChild(doc.createTextNode(' '));
      const name = doc.createElement('span');
      name.className = 'lg-nome';
      name.textContent = item;
      home.appendChild(name);
    });
  }
  function explainIconInFooter(k: string | null): void {
    writeInFooter(k ? t(`icon.${k}.dica`) : null);
  }
  /*
   * THE SOUND CAPTION (study item D3). In the footer column, above the button legend and the explanation (ADR-0164 rule 4:
   * «the sound caption above, the explanation below it»); `aria-hidden`, because whoever listens heard the sound itself.
   * 📌 Its time on screen is a child's reading time for its words, never under the 2600 ms the games had measured in play
   * (`core/caption-duration`, plan phase 5c); a new caption restarts it.
   */
  let soundCaption: HTMLElement | null = null;
  let clearSoundCaption: ReturnType<typeof setTimeout> | null = null;
  function writeSoundCaption(text: string): void {
    if (!state.captionsOn || !text) return;
    if (!soundCaption) {
      const home = screenFooter($<HTMLElement>('#game-region'));
      if (!home) return;
      soundCaption = doc.createElement('div');
      soundCaption.className = 'legenda-de-som';
      soundCaption.setAttribute('aria-hidden', 'true');
      home.appendChild(soundCaption);
    }
    const captionHome = soundCaption;
    captionHome.textContent = text;
    captionHome.hidden = false;
    if (clearSoundCaption !== null) clearTimeout(clearSoundCaption);
    clearSoundCaption = setTimeout(() => { captionHome.hidden = true; captionHome.textContent = ''; }, captionDuration(text, state.captionPpm));
  }
  /** O rodapé diz UMA explicação de cada vez: a do ícone apontado, ou o motivo de um item travado (ADR-0161). */
  function writeInFooter(text: string | null): void {
    if (!barExplanation && text) {
      const home = screenFooter($<HTMLElement>('#game-region'));
      if (home) {
        barExplanation = doc.createElement('div');
        barExplanation.className = 'barra-explicacao';
        barExplanation.setAttribute('aria-live', 'polite');
        home.insertBefore(barExplanation, home.firstChild);
      }
    }
    if (!barExplanation) return;
    barExplanation.textContent = text ?? '';
    barExplanation.hidden = !text;
  }

  function enterQuickPause(seat: number): void {
    inQuickPause.add(seat);
    recomposeWorldFilter(); // the quick pause is a menu: the simulation stops (issue #182)
    pauseIcons.enterBar(seat);
    if (!pauseIcons.onBar(seat)) srSay(t('sr.a11y.quickPause'));
    showPaused();
    changePhase('paused');
  }

  /** Sai por qualquer porta. `para` diz para onde: o jogo (descongela) ou o cartão (fica parado). */
  function leaveQuickPause(seat: number, to: 'jogo' | 'cartao'): void {
    if (pauseIcons.onBar(seat)) { pauseIcons.leaveBar(seat, to === 'cartao'); return; } // o gancho termina
    if (to === 'jogo') srSay(t('sr.a11y.barExit'));
    endQuickPause(seat, to === 'cartao');
  }

  function endQuickPause(seat: number, toOtherScreen: boolean): void {
    if (!inQuickPause.delete(seat)) return; // the simulation returns through the observer: leaving writes the card's `hidden`
    if (pausedWord && inQuickPause.size === 0) pausedWord.hidden = true;
    if (!toOtherScreen) changePhase('playing');
  }

  function toggleQuickPauseByStart(e: KeyboardEvent): void {
    const seat = seatOfPosition(e.code, 'start');
    if (seat === null) return;

    // GUARDA 1 — HÁ UM PAINEL ABERTO. Medido: com um overlay visível, `menuNavKey` recebe a tecla, não lhe
    // acha intenção e sai sem consumir. Sem este guarda a pausa rápida entrava POR BAIXO do painel em que a
    // criança está. Quem fecha um painel é o Escape, não o START.
    if (overlays.topVisibleOverlay()) return;

    // O START OUTRA VEZ SAI — a segunda saída do modo que o item 7 do ADR-0044 já dava ao START.
    if (inQuickPause.has(seat)) { leaveQuickPause(seat, 'jogo'); e.preventDefault(); return; }

    // GUARDA 2 — O CARTÃO ESTÁ ABERTO. Com ele aberto e uma tecla de «start» que não seja `Enter`,
    // `menuNavKey` não acha intenção e deixa passar. Fechar o cartão é do «Voltar ao jogo» e do Escape.
    const findPauseCard = $<HTMLElement>(`#vp-pause-${seat}`);
    if (findPauseCard && findPauseCard.hidden === false) return;

    enterQuickPause(seat);
    // 📌 E SÓ AQUI, depois de a tecla ter sido NOSSA de facto. `Enter` é «start» por omissão
    // (`input/default-bindings`), e sem isto o mesmo carregar pausaria E accionaria o que estivesse focado.
    e.preventDefault();
  }

  win.addEventListener('keydown', toggleQuickPauseByStart);

  /*
   * ===================== O SELECT ABRE OS MENUS (ADR-0155) =====================
   *
   * O cartão de seis itens do ADR-0151. 📏 `select` estava mapeado (`KeyF`, `input/default-bindings`) e até ao
   * ADR-0151 nenhum módulo o lia; o ADR-0086 guardou-o para «o que é da sessão», e os menus da pausa são isso.
   *
   * ⚠️ DA PAUSA RÁPIDA PARA O CARTÃO o jogo NÃO descongela: a barra sai em silêncio (dizer «de volta ao jogo»
   * com o cartão a abrir seria mentira) e a fase já é `paused` — pedi-la outra vez seria um segundo `paused`
   * num jogo parado.
   */
  /** Abre o cartão do assento, venha a porta de onde vier — a tecla SELECT ou a pílula do toque. Devolve se abriu. */
  function openSeatMenus(seat: number): boolean {
    if (overlays.topVisibleOverlay()) return false;
    const findPauseCard = $<HTMLElement>(`#vp-pause-${seat}`);
    if (!findPauseCard || findPauseCard.hidden === false) return false;
    const alreadyStopped = inQuickPause.has(seat);
    if (alreadyStopped) leaveQuickPause(seat, 'cartao');
    // ⚠️ MOSTRAR VEM PRIMEIRO, e a ordem é a defesa: um jogo sem `setPhase` tem de receber o cartão na mesma.
    pauseControls.show(seat);
    if (!alreadyStopped) changePhase('paused');
    return true;
  }
  function openMenusBySelect(e: KeyboardEvent): void {
    const seat = seatOfPosition(e.code, 'select');
    if (seat === null) return;
    if (openSeatMenus(seat)) e.preventDefault();
  }
  win.addEventListener('keydown', openMenusBySelect);

  /*
   * A SEGUNDA PORTA DOS MENUS: o `action4`, só DENTRO da pausa rápida (errata do ADR-0155). Fora dela o `action4` é
   * do jogo, e a engine não lhe toca — é o par que impede a porta de roubar um verbo a meio da partida.
   * 📏 `menuNavKey` não tem intenção para `action4` e, na barra, deixa-o subir sem o consumir: chega aqui.
   */
  function openMenusByAction4(e: KeyboardEvent): void {
    const seat = seatOfPosition(e.code, 'action4');
    if (seat === null || !inQuickPause.has(seat)) return;
    if (overlays.topVisibleOverlay()) return;
    leaveQuickPause(seat, 'cartao');
    pauseControls.show(seat);
    e.preventDefault();
  }
  win.addEventListener('keydown', openMenusByAction4);

  /*
   * ===================== O CONTROLE VIRTUAL (ADR-0143, fase 4 do plano) =====================
   *
   * 🔴 MEDIDO em 2026-09-12: `mountTouchControls`, `initTouch` e `initTouchBindings` tinham testes e ZERO
   * chamadores em produção — `git grep` achava-os só nos próprios módulos. Numa escola onde o aparelho é um
   * tablet sem teclado, um jogo arrancado por esta raiz não tinha por onde ser jogado, e nada o dizia.
   *
   * ⚠️ E LIGÁ-LOS ACHOU DOIS DEFEITOS NA JUNÇÃO, que nenhum dos testes separados via: a cruz desenhada tinha
   * braços `.touch-arm` que a folha não estiliza e que o `touch-bindings` não acende (ele procura `.dpad-up`),
   * e a pílula START tinha nome falado e nenhum texto. Os dois estão consertados em `input/touch`.
   *
   * 📌 O PAD MONTA SEMPRE, com ou sem `preset`: sem acções ele fica só com o START, porque a pausa não é
   * declinável (ADR-0122) e num tablet sem teclado o START é a única porta para ela. O que falta diz-se em
   * `problems` (`touchGaps`).
   */
  const touchHostEl = o.host.touchHost ?? $('#game-region');
  const touchUsable = !!touchHostEl && typeof (touchHostEl as HTMLElement).appendChild === 'function';
  const seat0CardOpen = (): boolean => {
    const c = $<HTMLElement>('#vp-pause-0');
    return !!c && c.hidden === false;
  };
  /** A menu the directional moves is open: an overlay, the seat-0 card, or the quick pause (ADR-0157). */
  const menuWithDpad = (): boolean => !!overlays.topVisibleOverlay() || seat0CardOpen() || inQuickPause.has(0);
  /** A position's key handed to the menus, which read keys — stamped with who produced it (ADR-0109). */
  const keyToMenu = (code: string, origin: TransportName | undefined): void => {
    // 🔴 A TECLA DO TECLADO JÁ ESTÁ NO MUNDO (ADR-0223). Esta função é o tradutor POSIÇÃO → tecla, e existe para os
    // transportes que não produzem teclas: o dedo, os olhos, o rosto, as mãos, a voz, a varredura. O teclado produz —
    // o evento que chegou aqui É a tecla —, logo redespachá-la navegaria o menu DUAS vezes.
    // 📌 É por estar escrito aqui que o condutor do teclado não precisa de perguntar «há um menu aberto?»: essa
    // pergunta tem UMA resposta, a do controle, e esta linha é o que a torna verdadeira também para ele.
    if (!origin || origin === 'teclado') return;
    const eventTarget = $<HTMLElement>('#game-region') ?? doc.body;
    eventTarget.dispatchEvent(stampSource(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }), origin));
  };
  const labelledActions = (): readonly { action: string; label: string }[] => {
    const preset = cartridge.preset;
    if (!preset) return [];
    const labelOf = labellerFrom(preset);
    return presetActions(preset).flatMap((a) => {
      const label = labelOf(a);
      return label ? [{ action: a, label }] : [];
    });
  };
  const touchPad = initTouch({
    $, srSay, store, win,
    gameActions: labelledActions,
    root: doc.documentElement,
    isMobile: deviceAvailability.touch,
    viewport: () => ({ w: win.innerWidth, h: win.innerHeight }),
    frontOverlay: overlays.frontOverlay,
    // O toque é sempre do Jogador 1 (`touch-bindings`), e com o cartão ou um painel aberto a criança toca
    // DIRECTO nos botões do menu (ADR-0166, which undid ADR-0157's «the pad stays over the menus»). The only two callers
    // that show the pad — the touch listener below and `refletirPadNosMenus` — already ask `menuAberto()` first.
    padAllowed: () => players().length <= 1,
  });

  /** A menu the child touches directly is open: the pause card or a settings panel (ADR-0166 rule 2). */
  function isMenuOpen(): boolean {
    return !!overlays.topVisibleOverlay() || !!$<HTMLElement>('.screen-pause:not([hidden])');
  }
  /** The pad was in view (or asked for by a touch) when a menu took the screen — it comes back when the menu goes. */
  let padBeforeMenu = false;
  function reflectPadInMenus(): void {
    const pad = $<HTMLElement>('#touch-controls');
    if (!pad) return;
    if (isMenuOpen()) {
      if (!pad.hidden) { padBeforeMenu = true; touchPad.hideTouchControls('menu'); }
    } else if (padBeforeMenu) {
      padBeforeMenu = false;
      touchPad.showTouchControls();
    }
  }

  const cartridgeActions = (): Set<string> => new Set(cartridge.preset ? presetActions(cartridge.preset) : []);


  function drawPad(): void {
    if (!touchUsable || !touchHostEl) return;
    // ADR-0166: a cartridge that does not ask for the pad gets none — and one swapped in by `mount()` takes the last one away
    if (!cartridge.onScreenPad) {
      const old = $<HTMLElement>('#touch-controls');
      old?.parentNode?.removeChild(old);
      return;
    }
    const padMap = touchPad.getTouchMap();
    const short = cartridge.preset ? shortLabellerFrom(cartridge.preset) : (): null => null;
    const pad = mountTouchControls(
      { find: (sel) => $<HTMLElement>(sel), create: (tag) => doc.createElement(tag) },
      {
        map: padMap,
        gameActions: cartridgeActions(),
        // The FUNCTION of each slot (ADR-0165): the game's SHORT word, said after the button's name in its accessible
        // name; the face shows the name. `start`/`select` are system positions the engine names itself.
        slotLabel: (slot) => (slot === 'start' ? t('touch.start') : slot === 'select' ? t('touch.select')
            // só se desenha o que o jogo nomeia (ADR-0162), logo a palavra dele existe sempre
            : (short(padMap[slot] as Action) ?? '')),
        dpad: store.get(store.KEYS.padDir, 'stick') === 'cross' ? 'cruz' : 'analogico',
      },
    );
    if (!pad.parentNode) touchHostEl.appendChild(pad);
  }

  padGapProblems = () => (!cartridge.onScreenPad ? [] : touchUsable
    ? touchGaps({ map: touchPad.getTouchMap(), gameActions: cartridgeActions() })
    : ['the virtual pad has nowhere to mount: set `host.touchHost`, or give #game-region room for children. '
      + 'Without it, a child on a keyboardless tablet cannot play, nor reach the pause']);

  /**
   * O START da tela: a PAUSA RÁPIDA do assento 0, como a tecla (ADR-0155) — e sai dela ao segundo toque.
   *
   * ⚠️ O PAD FICA À VISTA, ao contrário do cartão, que o escondia: a pílula START É a saída de quem só tem dedo.
   * Escondê-la deixava a criança num jogo parado sem porta. Com o cartão aberto, o START fecha-o, como fechava.
   */
  function togglePauseByTouch(): void {
    if (overlays.topVisibleOverlay()) return;
    if (inQuickPause.has(0)) { leaveQuickPause(0, 'jogo'); return; }
    if (seat0CardOpen()) { changePhase('playing'); return; }
    enterQuickPause(0);
  }

  const touchBindings = initTouchBindings({
    $, win,
    getSearch: () => win.location?.search ?? '',
    getControls: () => keyboard.controlsState().controls,
    getPlayers: () => players(),
    /*
     * 🔴 O TOQUE APERTA O CONTROLE VIRTUAL (ADR-0223), e por isso já não recebe `markKey`, `releaseKey`, `emMenu` nem
     * `teclaDeMenu`: os quatro eram esta mesma decisão escrita uma segunda vez dentro do pad. 📏 O preço de a ter
     * escrita duas vezes estava medido — esta raiz exclui a origem `toque` da escuta de janela, logo um cartucho que
     * ouve `onCommand` não respondia ao dedo.
     * 📌 Setas e não referências directas: o `controleVirtual` nasce mais abaixo, e é a mesma zona morta temporal que o
     * `getPlayers` já ensinou a este ficheiro.
     */
    press: (action, source) => controleVirtual.press(action, source),
    release: (action, source) => controleVirtual.release(action, source),
    playerEdge,
    heldKeys: keys,
    attractOnInput: () => false,
    // a touch inside a menu does not bring the pad over it; it only remembers that the child is on touch (ADR-0166)
    showTouchControls: () => { if (isMenuOpen()) { padBeforeMenu = true; return; } touchPad.showTouchControls(); },
    hideTips: () => {},
    togglePause: togglePauseByTouch,
    /*
     * A PÍLULA SELECT (ADR-0155): os menus pelo toque. Sem ela, quem só tem dedo não chegava a «Sair», ao número de
     * jogadores nem às configurações — o SELECT era tecla. ⚠️ O PAD ESCONDE-SE ao abrir o cartão, como o START
     * fazia: por cima do cartão ele taparia os botões que agora são a saída dela («Voltar ao jogo»).
     */
    // O pad FICA à vista com o cartão aberto (ADR-0157): é o direccional dele que anda no cartão, e quem o leva lá é
    // agora o controle virtual — ele já carimba a origem (ADR-0109), que é o que o «teclado esconde o pad» pergunta;
    // sem o carimbo o pad sumiria a cada seta que ele próprio entregou.
    openMenus: () => { openSeatMenus(0); },
    getTouchMap: () => touchPad.getTouchMap(),
    // ✅ O DEFEITO QUE O `TouchBindingsCtx` GUARDAVA MORRE AQUI: no cartucho a linha era `touchMap.start` num
    // escopo onde `touchMap` não existia, e o START da tela estava quebrado. Esta raiz TEM o mapa.
    getStartAction: () => touchPad.getTouchMap().start,
    getStickTravelPx: () => touchPad.getStickTravelPx(),
    getStickDeadPx: () => touchPad.getStickDeadPx(),
  });
  drawPad();
  touchBindings.attach();
  /*
   * A LANGUAGE CHANGED MID-GAME REACHES WHAT THE ENGINE DREW (study item C6; ADR-0031). 📏 Measured in the quiz: after
   * `setLocale('en')` the icon bar's names, the card's name, the button legend and the PAUSED word stayed in the old
   * language — `applyDom` reaches only `[data-i18n]`, and these are written by code. An open panel redraws itself
   * (`ui/mount-panel`), keeping focus where it was; nothing here moves focus.
   * 🔴 THE BOOT IS THE SAME EVENT: the pad and the bar are drawn in the fallback language, and the preferred one arrives
   * through `setLocale` (measured in the `dist`: «Cima/Baixo» on an English page). This listener replaced the
   * `localeReady()` repaints that did it for the boot alone.
   */
  /**
   * O 👄, quando existe. Declarado AQUI porque a troca de idioma — logo abaixo — tem de o alcançar, e ele nasce lá em baixo:
   * é a mesma zona morta temporal que o `getPlayers` e o `lacunasDoPad` já ensinaram a este ficheiro.
   */
  let voiceControl: VoiceControl | null = null;
  /*
   * 🔴 E O CARTUCHO TAMBÉM PRECISA DE SABER, e antes de 23/09 não tinha por onde (ADR-0225). 📏 Medido no `dist`: trocar a
   * bandeira levava o `<html lang>`, o rodapé, a barra e os painéis para o idioma novo e deixava o ENUNCIADO do quiz em
   * português — a moldura seguia, a ATIVIDADE não.
   *
   * 📌 A porta é da engine e não do evento, pela regra que o Dev já escreveu para a leitura e a fala (ADR-0216): «o jogo não
   * deve precisar saber como isso funciona». Um cartucho que tivesse de assinar `i18n:change` na JANELA teria de conhecer o
   * nome do evento, o objecto onde ele é disparado e a ordem em que a engine o trata — e alcançaria um global para o fazer,
   * que é o que o passo 7d do ADR-0221 recusa a um módulo novo.
   */
  const localeListeners: (() => void)[] = [];
  if (typeof win.addEventListener === 'function') {
    win.addEventListener('i18n:change', () => {
      pauseIcons.reflectPauseIcons();
      updateCaption();
      if (pausedWord && !pausedWord.hidden) pausedWord.textContent = t('pause.quick');
      drawPad();
      touchBindings.rewire();
      /*
       * 🔴 E O QUE A ENGINE OUVE TAMBÉM MUDA (ADR-0225). O que ela DESENHA já seguia desde o item C6; o que ela FALA segue
       * sozinho (o `tts` lê `bcp47()` a cada fala) e o que ela LÊ também (a cada `listen()`). O reconhecimento de comandos era
       * o único que escolhia a língua UMA vez — e ficar a ouvir na língua velha é pior do que parar, porque a gramática segue o
       * menu e as palavras novas iam alimentar o modelo antigo.
       */
      void voiceControl?.languageChanged();
      // ⚠️ O CARTUCHO POR ÚLTIMO, e de propósito: quando ele redesenha, a barra, a legenda e o pad já estão na língua nova,
      // logo ele nunca mede uma tela meio traduzida. E um cartucho que rebente não leva a moldura da engine com ele.
      for (const listener of localeListeners) { try { listener(); } catch (e) { /* o cartucho falhou, a engine segue */ } }
    });
  }

  /*
   * ===================== ACESSIBILIDADE MOTORA — o painel da engine (ADR-0151 §2 item 5) =====================
   *
   * 🔴 O PAINEL ANTIGO NÃO SERVE, e não é por gosto: o `ui/settings-mobility` monta Modo Fácil e as duas alternâncias, e o
   * ADR-0151 tirou os três deste painel («dificuldade é opção do jogo»; as alternâncias ficam no ☝️). Por isso este é
   * um painel NOVO (`#motora`), e o antigo continua a servir quem o monta com markup próprio.
   *
   * 📌 NASCE COM UMA LINHA, a primeira da lista do Dev: o TAMANHO DO CONTROLE em quatro passos, um por persona. As
   * outras linhas da lista (mapear toque, controle e teclado; microphone; webcam) são portas para painéis que a engine
   * ainda não monta, e uma porta para uma sala que não existe é o botão morto do ADR-0106 §5 — entram com as salas.
   *
   * ⚠️ SÓ EXISTE ONDE HÁ PAD: sem hospedeiro de toque não há tamanho para escolher, e a porta do submenu cai sozinha
   * (`acoesDaEngine.motora` não é definida).
   */
  if (pauseMountPoint && pauseUsable && touchUsable) {
    const mobilityCtx = {
      find: (sel: string) => $<HTMLElement>(sel),
      create: (tag: string) => doc.createElement(tag),
      host: pauseMountPoint as HTMLElement,
      overlays,
    };
    let padSteps: HTMLElement | null = null;
    let padHint: HTMLElement | null = null;
    let padSizeRow: HTMLElement | null = null;
    /** Reflecte as linhas do mapeamento de teclado (definido mais abaixo, com o painel `#ctrl`). */
    let reflectKeyboard = (): void => {};
    let currentPersona = closestPersona(store.getNum(store.KEYS.padBtnMm, 12.5));
    const specDoPad = () => ({
      label: t('motora.pad'),
      values: PERSONAS_DO_PAD.map((p) => t(p.label)),
      current: currentPersona,
    });
    const mobilityPanel = mountPanel(mobilityCtx, {
      id: 'motora',
      labels: () => ({
        title: t('menu.motora'),
        listLabel: t('menu.motora'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      // Relido a cada abertura: o tamanho pode ter mudado noutro sítio, e os rótulos seguem o idioma de agora.
      render: () => {
        currentPersona = closestPersona(store.getNum(store.KEYS.padBtnMm, 12.5));
        // ADR-0166 + ADR-0106 §5: the pad's size is offered only to a cartridge that has a pad — hidden, not locked, because
        // there is nothing to unlock. Read at each opening: `mount()` may have swapped the cartridge.
        if (padSizeRow) padSizeRow.hidden = !cartridge.onScreenPad;
        if (padSteps) updateSteps(padSteps, specDoPad());
        // ⚠️ A DICA NO IDIOMA DE AGORA, antes de o rodapé a recolher: escrita no arranque, saía no idioma de recuo
        // (medido no `dist` com a página em inglês — o rodapé em português).
        if (padHint) padHint.textContent = t('motora.pad.dica');
        reflectKeyboard();
      },
    });
    const rowNode = doc.createElement('div');
    rowNode.className = 'ctrl-row ctrl-row--passos';
    padSizeRow = rowNode; // offered or not is decided at each opening (`render` above)
    const explanation = doc.createElement('span');
    explanation.className = 'opt-hint';
    padHint = explanation;
    const envelope = doc.createElement('span');
    envelope.appendChild(explanation);
    rowNode.appendChild(envelope);
    padSteps = mountSteps(mobilityCtx, specDoPad());
    padSteps.id = 'opt-pad-persona';
    rowNode.appendChild(padSteps);
    mobilityPanel.shell.list.appendChild(rowNode);
    padSteps.addEventListener('passo', (ev) => {
      const fresh = nextStep(currentPersona, PERSONAS_DO_PAD.length, (ev as CustomEvent<number>).detail);
      if (fresh === currentPersona) return; // na ponta não se anuncia um passo que não aconteceu
      currentPersona = fresh;
      touchPad.setPadMm(PERSONAS_DO_PAD[fresh]!.mm);
      updateSteps(padSteps!, specDoPad());
      srSay(`${t('motora.pad')}: ${t(PERSONAS_DO_PAD[fresh]!.label)}`);
    });
    engineActions.motora = mobilityPanel.open;

    /*
     * ===================== MAPEAR TECLADO — para 1, para 2 e para 3–4 jogadores (ADR-0151 §2 item 5) =====================
     *
     * 🎯 TRÊS LINHAS, UM PAINEL: cada linha abre o `#ctrl` no MODO dela, e o `ui/settings-controls` vê só os esquemas
     * desse modo (`kbFor` e `getNumPlayers` respondem pelo modo, não pela partida). Uma criança sozinha pode assim
     * preparar o teclado para quando o irmão se sentar ao lado, sem ter de entrar numa partida de dois.
     *
     * ⚠️ «3–4» É UM TECLADO SÓ, como o Dev o nomeou: edita-se o esquema de quatro, e os três primeiros assentos do
     * modo de três acompanham (`kb.p3` é guardado à parte desde a migração do `p34`). Sem isto, a criança remapeava
     * para «3–4» e, numa partida de três, as teclas antigas voltavam.
     *
     * ⚠️ E A LINHA «3–4» SÓ EXISTE SEM OMBROS NEM GATILHOS no preset: quatro esquemas num teclado já não têm teclas para
     * as quatro posições laterais (errata do ADR-0151). A razão do Dev: no xadrez, quatro crianças contra quatro
     * computadores diferentes — «o modo competitivo deve ser desencorajado».
     */
    type KeyboardMode = 1 | 2 | 4;
    let keyboardMode: KeyboardMode = 1;
    let seatInMap = 0;
    const modeScheme = (conf: KBDefaults, i: number) => (keyboardMode === 1 ? conf.solo
      : keyboardMode === 2 ? (conf.p2[i] ?? conf.p2[0]!) : (conf.p4[i] ?? conf.p4[0]!));
    const modeLabel = (m: KeyboardMode): string => t(m === 1 ? 'motora.teclado.1' : m === 2 ? 'motora.teclado.2' : 'motora.teclado.34');
    const SIDES = ['leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger'] as const;
    const actionsToMap = () => {
      if (!cartridge.preset) return [];
      const word = labellerFrom(cartridge.preset);
      return presetActions(cartridge.preset).flatMap((presetAction) => {
        const actionWord = word(presetAction);
        return actionWord ? [{ action: presetAction, label: actionWord }] : [];
      });
    };
    let seatSteps: HTMLElement | null = null;
    const seatSpec = () => ({
      label: t('ctrl.assento'),
      values: Array.from({ length: keyboardMode }, (_, i) => t('ctrl.jogador', { n: i + 1 })),
      current: seatInMap,
    });
    const keyboardPanel = mountPanel(mobilityCtx, {
      id: 'ctrl',
      labels: () => ({
        title: modeLabel(keyboardMode),
        listLabel: modeLabel(keyboardMode),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => {
        if (seatSteps) {
          seatInMap = Math.min(seatInMap, keyboardMode - 1);
          updateSteps(seatSteps, seatSpec());
          (seatSteps.closest('.ctrl-row') as HTMLElement).hidden = keyboardMode === 1;
        }
        keyboardControls?.render(seatInMap);
      },
    });
    {
      // O ASSENTO, por passos — só nos modos de mais de um: «◀ Teclado de: Jogador 2 ▶».
      const seatRow = doc.createElement('div');
      seatRow.className = 'ctrl-row ctrl-row--passos';
      seatSteps = mountSteps(mobilityCtx, seatSpec());
      seatSteps.id = 'ctrl-assento';
      seatRow.appendChild(seatSteps);
      keyboardPanel.shell.card.insertBefore(seatRow, keyboardPanel.shell.list);
      seatSteps.addEventListener('passo', (ev) => {
        const nextValue = nextStep(seatInMap, keyboardMode, (ev as CustomEvent<number>).detail);
        if (nextValue === seatInMap) return;
        seatInMap = nextValue;
        updateSteps(seatSteps!, seatSpec());
        keyboardControls?.render(seatInMap);
        srSay(`${t('ctrl.assento')}: ${t('ctrl.jogador', { n: nextValue + 1 })}`);
      });
    }
    /** O modo de quatro arrasta os três primeiros assentos do modo de três — ver o cabeçalho acima. */
    const syncThree = (conf: KBDefaults): void => {
      conf.p3.forEach((left, i) => {
        const de = conf.p4[i];
        if (de) for (const a of ACTIONS) left[a] = de[a] ? [...de[a]!] : de[a];
      });
    };
    keyboardControls = initSettingsControls({
      $, srSay, srAlert,
      gameActions: actionsToMap,
      store: {
        saveKB: (conf) => { if (keyboardMode === 4) syncThree(conf); saveKB(conf); },
        // ⚠️ «RESTAURAR» DESTE MODO, e não do teclado inteiro: quem repõe o teclado de dois não apaga o de um.
        resetKB: () => {
          const factory = factoryWithGame();
          if (keyboardMode === 1) kb.solo = factory.solo;
          else if (keyboardMode === 2) kb.p2 = factory.p2;
          else { kb.p4 = factory.p4; kb.p3 = factory.p3; }
          saveKB(kb);
          return kb;
        },
      },
      kb,
      setKB,
      kbFor: (i) => modeScheme(kb, i),
      defaultSchemeFor: (i) => modeScheme(factoryWithGame(), i),
      getNumPlayers: () => keyboardMode,
      applyControls: () => { keyboard.refreshControls(); },
      assignControls: () => { keyboard.assignControls(); },
      fillExplain: overlays.fillExplain,
    });
    // A CAPTURA RECEBE A TECLA ANTES DE TUDO O RESTO: em captura a navegação de menu já se afasta, e isto impede que a
    // tecla gravada suba ainda até ao START, ao SELECT ou ao jogo.
    win.addEventListener('keydown', (e: KeyboardEvent) => {
      if (keyboardControls?.isCapturing() && keyboardControls.handleCaptureKeydown(e)) e.stopPropagation();
    }, true);

    // AS TRÊS LINHAS no painel motora, cada uma uma PORTA para o `#ctrl` no seu modo.
    const keyboardRows: { mode: KeyboardMode; row: HTMLElement; strong: HTMLElement; button: HTMLElement }[] = [];
    for (const rowMode of [1, 2, 4] as const) {
      const rowT = doc.createElement('div');
      rowT.className = 'ctrl-row';
      const envelope = doc.createElement('span');
      const strongLabel = doc.createElement('strong');
      envelope.appendChild(strongLabel);
      rowT.appendChild(envelope);
      const rowButton = doc.createElement('button');
      rowButton.className = 'mode-btn';
      rowButton.setAttribute('type', 'button');
      rowButton.id = `opt-teclado-${rowMode}`;
      rowButton.addEventListener('click', () => {
        keyboardMode = rowMode;
        seatInMap = 0;
        keyboardPanel.open();
      });
      rowT.appendChild(rowButton);
      mobilityPanel.shell.list.appendChild(rowT);
      keyboardRows.push({ mode: rowMode, row: rowT, strong: strongLabel, button: rowButton });
    }
    /** Rótulos no idioma de agora, e quem aparece: sem posições nomeadas não há o que mapear; «3–4» sem laterais. */
    const reflectKeyboardRows = (): void => {
      const declaredActions = cartridge.preset ? presetActions(cartridge.preset) : [];
      const hasSides = declaredActions.some((a) => (SIDES as readonly string[]).includes(a));
      for (const { mode: rowMode, row: l, strong: strongLabel, button: rowButton } of keyboardRows) {
        strongLabel.textContent = modeLabel(rowMode);
        rowButton.textContent = t('motora.abrir');
        rowButton.setAttribute('aria-label', modeLabel(rowMode));
        l.hidden = actionsToMap().length === 0 || (rowMode === 4 && hasSides);
      }
    };
    reflectKeyboardRows();

    /*
     * MAPEAR CONTROLE (ADR-0151 §2; issue #182): the engine's own wizard (`input/pad-wizard`), asking only the positions this
     * game names, in its words, and storing the map `initGamepad` reads — one cache for the page. It reads the pads only
     * while it is open. «Voltar» cancels; the last named position saves and closes. The shell's «restore» is hidden: a pad's
     * map is replaced by mapping again.
     */
    let padWizard: ReturnType<typeof createPadWizard> | null = null;
    /** One closer for «Voltar» and Escape: a running wizard is cancelled (and its close hides the panel); an idle one just hides. */
    const closeControl = (): void => {
      if (padWizard?.state()) { padWizard.close(false); return; }
      controlPanel.shell.overlay.hidden = true;
      overlays.restoreFocus?.('padwiz');
    };
    const controlPanel = mountPanel(mobilityCtx, {
      id: 'padwiz',
      labels: () => ({
        title: t('motora.controle'),
        listLabel: t('motora.controle'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => {},
      closeOwn: () => closeControl(),
    });
    controlPanel.shell.reset.hidden = true;
    controlPanel.shell.close.addEventListener('click', closeControl); // `fecharProprio` means this panel wires its own button
    const controlSentence = doc.createElement('p');
    controlSentence.id = 'padwiz-prompt';
    controlSentence.setAttribute('aria-live', 'assertive');
    const controlProgress = doc.createElement('p');
    controlProgress.id = 'padwiz-progress';
    controlProgress.className = 'opt-hint';
    controlPanel.shell.card.insertBefore(controlSentence, controlPanel.shell.list);
    controlPanel.shell.card.insertBefore(controlProgress, controlPanel.shell.list);
    padWizard = createPadWizard({
      getGamepads: () => {
        const nav = win.navigator as Navigator | undefined;
        return typeof nav?.getGamepads === 'function' ? nav.getGamepads() : null;
      },
      actionLabel: (presetAction) => actionsToMap().find((x) => x.action === presetAction)?.label ?? null,
      say: (phrase) => { controlSentence.textContent = phrase; srSay(phrase); },
      progress: (text) => { controlProgress.textContent = text; },
      srAlert,
      onClose: () => {
        controlPanel.shell.overlay.hidden = true;
        overlays.restoreFocus?.('padwiz');
      },
    });
    const controlMappingRow = doc.createElement('div');
    controlMappingRow.className = 'ctrl-row';
    const envelopeDoControle = doc.createElement('span');
    const controlStrong = doc.createElement('strong');
    envelopeDoControle.appendChild(controlStrong);
    controlMappingRow.appendChild(envelopeDoControle);
    const controlButton = doc.createElement('button');
    controlButton.className = 'mode-btn';
    controlButton.setAttribute('type', 'button');
    controlButton.id = 'opt-controle';
    controlButton.addEventListener('click', () => {
      controlPanel.open();
      padWizard?.open();
    });
    controlMappingRow.appendChild(controlButton);
    mobilityPanel.shell.list.appendChild(controlMappingRow);
    const reflectControlRow = (): void => {
      controlStrong.textContent = t('motora.controle');
      controlButton.textContent = t('motora.abrir');
      controlButton.setAttribute('aria-label', t('motora.controle'));
      controlMappingRow.hidden = actionsToMap().length === 0; // nothing named, nothing to map
    };
    reflectControlRow();

    /*
     * MAPEAR TOQUE (ADR-0151 §2; issue #182): which function each on-screen pad button carries, with `input/touch`'s own
     * editor (`renderTouchMap`, slot → one of the functions the game names). Offered only to a cartridge with a pad (ADR-0166),
     * and only for the buttons the pad DRAWS — a slot whose function the game does not name is not drawn (ADR-0162), so its
     * row would change nothing on screen. The pad is redrawn with every choice.
     */
    const touchPanel = mountPanel(mobilityCtx, {
      id: 'touchcfg',
      listId: 'touchmap-list',
      labels: () => ({
        title: t('motora.toque'),
        listLabel: t('motora.toque'),
        resetLabel: t('menu.restoreDefaults'),
        closeLabel: t('pause.pmback'),
      }),
      render: () => { touchPad.renderTouchMap(); hideSlotsWithoutAction(); },
    });
    touchPanel.shell.reset.hidden = true;
    const hideSlotsWithoutAction = (): void => {
      const named = cartridgeActions();
      const padMap = touchPad.getTouchMap();
      for (const sel of Array.from(touchPanel.shell.list.querySelectorAll<HTMLSelectElement>('select[data-slot]'))) {
        const rowNode = sel.closest<HTMLElement>('.ctrl-row');
        if (rowNode) rowNode.hidden = !named.has(padMap[sel.dataset.slot ?? ''] ?? '');
      }
    };
    // after the select's own listener (it writes the map), the pad is drawn again with the new function
    touchPanel.shell.list.addEventListener('change', () => { drawPad(); hideSlotsWithoutAction(); });
    const touchMappingRow = doc.createElement('div');
    touchMappingRow.className = 'ctrl-row';
    const touchEnvelope = doc.createElement('span');
    const touchStrong = doc.createElement('strong');
    touchEnvelope.appendChild(touchStrong);
    touchMappingRow.appendChild(touchEnvelope);
    const touchButton = doc.createElement('button');
    touchButton.className = 'mode-btn';
    touchButton.setAttribute('type', 'button');
    touchButton.id = 'opt-toque';
    touchButton.addEventListener('click', () => touchPanel.open());
    touchMappingRow.appendChild(touchButton);
    mobilityPanel.shell.list.appendChild(touchMappingRow);
    const reflectTouchRow = (): void => {
      touchStrong.textContent = t('motora.toque');
      touchButton.textContent = t('motora.abrir');
      touchButton.setAttribute('aria-label', t('motora.toque'));
      touchMappingRow.hidden = !cartridge.onScreenPad || actionsToMap().length === 0; // no pad, or nothing named
    };
    reflectTouchRow();

    /*
     * 🔴 A LINHA «JEITO DE APERTAR» SAIU DESTE PAINEL (the Dev, 2026-09-21: «Tire a linha de acessibilidade motora»), no mesmo dia em
     * que entrou. Ela nasceu como «Não precisa segurar» a pedido dele — «falta oferecê-la como opção para teclado e toque» — e, quando
     * o ☝️ ganhou a terceira posição (ADR-0218), passou a ser o MESMO ciclo em duas superfícies. Ele decidiu que o ícone basta.
     *
     * ⚠️ E COM ELA SAIU O ÚNICO SÍTIO QUE DIZIA O MOTIVO da trava num aparelho que manda um comando de cada vez (ADR-0113 cláusula 3).
     * Fica honesto porque o ciclo deixou de OFERECER o que estava trancado: onde a aderência é obrigatória, «padrão» não aparece, e não
     * há o que explicar. A linha «Esperar entre toques» (ADR-0217) fica: é outro ajuste, e ninguém a tirou.
     */
    /*
     * «ESPERAR ENTRE TOQUES» (ADR-0217; GAG Advanced/Motor, issue #182). The row beside the sticky keys, and the other half of
     * the same problem: that one is for a hand that cannot HOLD, this one for a hand that cannot press ONCE.
     *
     * ⚠️ OFF BY DEFAULT and offered as a choice, because for a child with no tremor it is half a second lost between every two
     * presses — in a game of reaction, the game. Hidden where the game holds no key, like its neighbour: what it refuses is a
     * second press, and a game nobody presses twice has none to refuse.
     */
    const cooldownRowSpec = () => ({ id: 'opt-cooldown', label: t('motor.espera'), hint: t('motor.espera.dica') });
    const { row: cooldownRow, controle: cooldownButton } = controlRow(mobilityCtx, cooldownRowSpec());
    mobilityPanel.shell.list.appendChild(cooldownRow);
    const reflectCooldown = (): void => {
      labelRow(cooldownRow, cooldownRowSpec());
      const on = state.inputCooldown > 0;
      toggleBtn(cooldownButton, on);
      cooldownButton.textContent = toggleLabel(on);
      markChanged(cooldownRow, on !== (state.DEFAULTS.inputCooldown > 0));
      cooldownRow.hidden = !cartridge.declaration.holdsKeys();
    };
    cooldownButton.addEventListener('click', () => {
      state.setInputCooldownValue(state.inputCooldown > 0 ? 0 : COOLDOWN_MS);
      reflectCooldown();
      srSay(`${t('motor.espera')}: ${t(state.inputCooldown > 0 ? 'state.on' : 'state.off')}`);
    });
    reflectCooldown();

    /*
     * PLAYING WITH THE CAMERA, IN THE PANEL (issue #182; ADR-0215): «webcam (gestos/rosto/olhos)» was one of the motor rows the
     * Dev listed as missing, and until the 📷 existed there was nothing to put in it. Now there is, and this row is the same
     * setting the bar's 📷 cycles — one stored value (`incl_camera_control`), two surfaces, the panel's being the one that says
     * what each position does.
     *
     * ⚠️ HIDDEN WHERE THERE IS NO CAMERA TO ASK FOR, the same rule the icon uses: a row that offers a device the browser does
     * not have is the dead button of ADR-0106 §5, and a child who picks it waits for a permission dialog that never comes.
     *
     * 📌 AND THE MICROPHONE ROW IS RIGHT BELOW, since 2026-09-21: it used to be missing on purpose, because with no voice-command
     * transport a «microfone» row would switch nothing. The transport landed (issue #184), so the row has a subject.
     */
    const CAMERA_MODES: readonly CameraControl[] = ['off', 'hands', 'face', 'eyes'];
    const CAMERA_MODE_WORD: { readonly [M in CameraControl]: string } = {
      off: 'state.off', hands: 'camera.hands', face: 'camera.face', eyes: 'camera.eyes',
    };
    const cameraRowSpec = () => ({
      label: t('motora.camera'),
      values: CAMERA_MODES.map((m) => t(CAMERA_MODE_WORD[m])),
      current: Math.max(0, CAMERA_MODES.indexOf(state.cameraControl)),
    });
    const cameraRow = doc.createElement('div');
    cameraRow.className = 'ctrl-row ctrl-row--passos';
    const cameraHint = doc.createElement('span');
    cameraHint.className = 'opt-hint';
    const cameraWrap = doc.createElement('span');
    cameraWrap.appendChild(cameraHint);
    cameraRow.appendChild(cameraWrap);
    const cameraSteps = mountSteps(mobilityCtx, cameraRowSpec());
    cameraSteps.id = 'opt-camera';
    cameraRow.appendChild(cameraSteps);
    mobilityPanel.shell.list.appendChild(cameraRow);
    const reflectCamera = (): void => {
      updateSteps(cameraSteps, cameraRowSpec());
      cameraHint.textContent = t('motora.camera.dica');
      cameraRow.hidden = !canCaptureMedia;
    };
    cameraSteps.addEventListener('passo', (ev) => {
      const next = nextStep(
        Math.max(0, CAMERA_MODES.indexOf(state.cameraControl)), CAMERA_MODES.length, (ev as CustomEvent<number>).detail,
      );
      const mode = CAMERA_MODES[next]!;
      if (mode === state.cameraControl) return; // at the end of the line nothing moved, and nothing is announced
      state.setCameraControlValue(mode);
      reflectCamera();
      srSay(`${t('motora.camera')}: ${t(CAMERA_MODE_WORD[mode])}`);
    });
    // the 📷 and this row are one setting: whoever changes it, both show it
    state.on('cameraControl', () => { reflectCamera(); });
    reflectCamera();

    /*
     * PLAYING BY SPEAKING, IN THE PANEL (issue #182's «microfone» row; ADR-0189): the same stored answer the bar's 👄 writes
     * (`incl_voice_control`), on the surface that has room to say what it does. Two surfaces of one setting, and neither may
     * name it differently — which is the correction ADR-0218 had just made to the ☝️.
     *
     * ⚠️ HIDDEN WHERE THERE IS NO MICROPHONE TO ASK FOR, the rule the 📷 above follows and the one ADR-0106 §5 states: a row
     * that offers a device this browser cannot even ask for is a dead control, and a child who picks it waits for a permission
     * dialog that never comes. What happens when the microphone EXISTS and is refused is another matter and is already
     * answered: `ui/voice-control` says why and puts the answer back to off, and this row follows it like the icon does.
     */
    const voiceRowSpec = () => ({ id: 'opt-voice', label: t('motora.voz'), hint: t('motora.voz.dica') });
    const { row: voiceRow, controle: voiceButton } = controlRow(mobilityCtx, voiceRowSpec());
    mobilityPanel.shell.list.appendChild(voiceRow);
    const reflectVoice = (): void => {
      labelRow(voiceRow, voiceRowSpec());
      toggleBtn(voiceButton, state.voiceControl);
      voiceButton.textContent = toggleLabel(state.voiceControl);
      markChanged(voiceRow, state.voiceControl !== state.DEFAULTS.voiceControl);
      voiceRow.hidden = !canCaptureMedia;
    };
    voiceButton.addEventListener('click', () => {
      state.setVoiceControlValue(!state.voiceControl);
      // ⚠️ THE ANNOUNCEMENT READS THE STATE AFTER THE WRITE, and not the value it meant to write: what cannot start puts the
      // answer back to off inside the same click, and announcing the intention would tell the child the opposite of what is true.
      reflectVoice();
      srSay(`${t('motora.voz')}: ${t(state.voiceControl ? 'state.on' : 'state.off')}`);
    });
    state.on('voiceControl', () => { reflectVoice(); });
    reflectVoice();

    reflectKeyboard = () => {
      reflectKeyboardRows(); reflectControlRow(); reflectTouchRow(); reflectCooldown();
      reflectCamera(); reflectVoice();
    };
  }
  /*
   * THE MOTOR EMPATHY SIMULATIONS REACH THE GAME HERE (ADR-0181): in the window's capture, after the menu navigation registered
   * its own, and before any cartridge hears a game key. A refused key and its release stop here; a tapped key passes and is
   * released at once by a synthetic keyup, which this filter lets through.
   */
  const empathyFilter = createEmpathyFilter();
  /*
   * AND THE COOL-DOWN, WHICH IS THE OPPOSITE OF THEM (ADR-0217): the simulations above make play harder so an adult can feel
   * what a motor disability costs; this refuses the SECOND press of a hand that shakes, which is a child losing a turn she did
   * not play. It sits in the same pass because the question is the same one — does this key reach the game — and it comes
   * FIRST: a press the cool-down refuses never happened, so it must not teach the simulations that a key is held.
   */
  const cooldown = createInputCooldown();
  state.on('inputCooldown', () => { cooldown.reset(); }); // turning it off must not leave a press refused by an old wait
  const releasedByFilter = new WeakSet<Event>();
  const block = (e: Event): void => { e.preventDefault(); e.stopImmediatePropagation(); };
  win.addEventListener('keydown', (e: KeyboardEvent) => {
    if (keyboard.whichPlayer(e.code) < 0) return;
    if (cooldown.keydown(e.code, win.performance.now(), state.inputCooldown, e.repeat || keys.has(e.code)) === 'refuse') {
      block(e);
      return;
    }
    const decision = empathyFilter.keydown(e.code, e.repeat, { noChords: state.oneButton, noGripStrength: state.noGripStrength });
    if (decision === 'barrar') { block(e); return; }
    if (decision === 'tocar') {
      const eventTarget = e.target ?? win;
      setTimeout(() => {
        // a release the keyboard's own press produced
        const released = stampSource(new KeyboardEvent('keyup', { code: e.code, key: e.key, bubbles: true, cancelable: true }), 'teclado');
        releasedByFilter.add(released);
        eventTarget.dispatchEvent(released);
      }, 0);
    }
  }, true);
  win.addEventListener('keyup', (e: KeyboardEvent) => {
    if (releasedByFilter.has(e) || keyboard.whichPlayer(e.code) < 0) return;
    if (empathyFilter.keyup(e.code) === 'barrar') block(e);
  }, true);

  // Jogar no teclado ESCONDE o pad — a mesma alternância por modalidade do `input/keydown` do cartucho. Só as
  // teclas de algum jogador: um atalho do navegador não é a criança a trocar de aparelho.
  // 🔴 EM CAPTURA (`true`): o `ui/menu-nav` consome a tecla de um menu na captura da janela com `stopPropagation()`, e um
  // ouvinte de bolha nunca a ouvia — num menu, a criança passava ao teclado e o pad ficava por cima do cartão (medido
  // pelo Dev). `stopPropagation` não cala outro ouvinte do MESMO nó, logo a ordem de registo não importa.
  win.addEventListener('keydown', (e: KeyboardEvent) => {
    if (sourceOfEvent(e) === 'toque') return; // a tecla que o próprio pad entregou a um menu
    if (keyboard.whichPlayer(e.code) >= 0) { touchPad.hideTouchControls(); padBeforeMenu = false; } // on the keyboard now
  }, true);

  /*
   * AS COISAS PESADAS COMEÇAM A DESCER AQUI, e a linha é deliberadamente a ÚLTIMA coisa do arranque.
   *
   * ⚠️ NO `await`. The start does not wait for the heavy files — if it did, a 3G school's first screen would stay blank for minutes
   * and the child would conclude the game does not open. The empty `catch` is the same rule written twice: a network failure here
   * cannot bring down a game that may not even use the voice.
   *
   * 🔴 E O RELATÓRIO NÃO VAI PARA `problems`, embora a primeira versão o fizesse. Duas razões medidas, e a
   * primeira é a que importa:
   *
   *  1. **CHEGA DEPOIS DE O LEITOR SE IR EMBORA.** `problems` é devolvido na linha abaixo, sincronamente; a
   *     descarga é de fundo, logo TODA linha dela entraria num vector que o consumidor já leu. Quem faz
   *     `if (motor.problems.length) …` não veria nada, e quem o lesse mais tarde veria uma lista que cresceu
   *     depois do arranque. Um relatório que chega depois do leitor não é um relatório — é a forma exacta do
   *     `srSay` a escrever onde não havia `#sr-status`.
   *  2. **AFOGAVA O QUE SE PODE RESOLVER.** Sem rede — uma escola sem rede, que é o alvo e não a excepção —
   *     são OITO falhas a empurrar para uma lista que o ADR-0106 §2 construiu para dizer o que FALTA NO
   *     HOSPEDEIRO. A criança perde a barra de acessibilidade e a linha que o diz fica em nono lugar.
   *
   * 📌 O canal certo é o que a própria função já tem: `aoProgredir`, entregue a quem chama. Um consumidor que
   * queira mostrar «faltam N MB» ou «a voz não desceu» tem por onde; a engine não inventa uma superfície.
   */
  if (o.downloadHeavy !== false) {
    // ⚠️ THE READING MODEL IS ASKED FOR BY LANGUAGE and not by a yes: the three together are 850 MiB, and the child is reading in
    // one of them. `bcp47()` is already the language the interface booted in (ADR-0031), so nothing new has to be decided here.
    void downloadHeavy({
      // 📌 AND THE COMMAND MODEL IS ASKED FOR WITHOUT ASKING THE GAME (issue #184): a child who says «menu» instead of pressing
      // it is reaching the controller, and no cartridge declares — or denies — a way in (ADR-0111). A delivery built without
      // `--commands` simply has none, this background fetch fails quietly, and the transport says so when she turns it on.
      only: heavyAtBoot({ kokoro: !!o.uses?.neuralVoice, reading: o.uses?.reading ? bcp47() : null, commands: bcp47() }),
      onProgress: o.onHeavyProgress,
    })
      .catch(() => { /* uma descarga de fundo não derruba arranque nenhum */ });
  }

  /*
   * ⚠️ `declaration` E `declines` SÃO GETTERS; o resto não é, e a assimetria é a decisão.
   *
   * Os dois pertencem à metade do JOGO (ADR-0139 §1), logo têm de seguir o cartucho que estiver montado —
   * um campo fixo aqui devolveria, depois de um `mount()`, a declaração do cartucho que arrancou primeiro.
   * `pause`, `tts`, `overlays`, `nav`, `keyboard` e o sonar são da PÁGINA e existem uma vez só, que é a
   * decisão inteira do ADR-0117 §2 — e é por isso que eles ficam como estão.
   *
   * 📌 `problems` e `reach` ainda são fixos, e ainda descrevem o arranque. É a dívida que o ADR-0142
   * nomeia e que o `mount()` fecha.
   */
  /*
   * A PILHA DE CENAS É DA RAIZ, e não do retorno, porque o `desmontar()` tem de a alcançar. Nasce uma vez
   * (ADR-0117 §2: a página tem uma) e é esvaziada entre cartuchos, nunca substituída.
   */
  const rootScenes = createSceneStack();

  // ⚠️ SEM PADRÃO `{}` desde o ADR-0153: os ganchos carregam a resposta obrigatória às acomodações, e um padrão vazio
  // seria o cartucho que não respondeu — o arranque recusá-lo-ia de qualquer forma, com uma mensagem pior.
  function mountAll(declaration: GameDeclaration, hooks: CartridgeHooks): void {
    // ⚠️ LANÇA, NÃO DIAGNOSTICA — a mesma regra do arranque, e por isso a mesma frase. Uma declaração
    // malformada é pré-condição: `problems` é para lacunas com que se consegue jogar, e isto não é uma.
    const malformed = conformanceProblems(declaration);
    if (malformed.length) {
      refuseDeclaration('mount', malformed);
    }
    // ⚠️ E O `mount()` RECUSA PELA MESMA REGRA, antes de escrever em `cartucho`. `CartridgeHooks` é
    // `Omit<MetadeDoJogo, 'declaration'>`, logo carrega `preset` — um segundo cartucho podia tomar o «start»
    // que o primeiro respeitou, e a raiz ficava com a pausa inalcançável a meio da sessão.
    refuseIfItClaimsStart('mount', hooks.preset);
    refuseIfNoAnswer('mount', hooks.accommodations);
    refuseIfGenreRefused('mount', hooks.genre);
    refuseIfHudMalformed('mount', hooks.hud);
    refuseIfOptionsMalformed('mount', hooks.gameOptions);
    refuseIfHowToPlayMalformed('mount', hooks.howToPlay);
    cartridge = { ...hooks, declaration };
    mountHud(); // the numbers are the cartridge's: the new one's replace the old one's, and the room is measured again
    registerCartridgeMappings();
    redrawGameOptions(); // the rows are the new cartridge's, drawn or cleared before its door is weighed
    pauseIcons.reflectPauseIcons(); // the bar follows the new cartridge: the hourglass exists only where time runs by itself
    currentReach = deriveReach();
    // O pad é da FORMA do preset, logo muda com o cartucho; os ouvintes da janela ficam (`rewire`, e não `attach`).
    drawPad();
    touchBindings.rewire();
  }

  /**
   * THE PAGE LINKS THE ENGINE STYLESHEET, or it is told (study item B4). `createGame` injects no CSS; without
   * `style.css` the panels, the footer band, the target floor and the focus rings are all missing, and nothing said so.
   * Read when `problems` is read, by the sentinel only that stylesheet declares — a stylesheet loading late is not
   * accused; a host without `getComputedStyle` measures nothing and accuses nothing.
   */
  function stylesheetMissing(): string[] {
    if (typeof win.getComputedStyle !== 'function' || !doc.documentElement) return [];
    const rootStyles = win.getComputedStyle(doc.documentElement);
    if (!rootStyles || typeof rootStyles.getPropertyValue !== 'function') return [];
    return rootStyles.getPropertyValue('--incl-engine-stylesheet').trim() ? [] : [`the page does not link the engine stylesheet \
(package export \`the-inclusionist-engine/style.css\`): panels, the footer band, the target floor and the focus rings are \
unstyled, so a child who plays by keyboard cannot see where focus is — link that stylesheet`];
  }

  /*
   * THE FLASH SAMPLER (study item B2, cut 2). Each animation frame the world's canvas is drawn into 160×120, the relative
   * luminance is computed per pixel (WCAG's sRGB formula) and averaged into the 16×12 grid of `core/flash-threshold` — per
   * pixel and then averaged, so a small bright area weighs by its area; a direct 16×12 downscale samples a few pixels and a
   * flash between them goes unseen. Registered from the frame after the call, gone when the time is up.
   */
  /*
   * STORAGE OUTSIDE THE ENGINE'S SCOPES (study item E2). The keys of both storages are photographed at boot; `problems`
   * names the ones that appeared since and sit outside every scope. Only what appeared: on a shared origin (localhost)
   * the keys already there are other pages'. By capability: a host without storage, or one that throws, measures nothing.
   */
  function storageKeys(): Set<string> {
    const keysFound = new Set<string>();
    for (const name of ['localStorage', 'sessionStorage'] as const) {
      try {
        const area = (win as unknown as Record<string, Storage | undefined>)[name];
        if (!area || typeof area.key !== 'function') continue;
        for (let i = 0; i < area.length; i++) { const k = area.key(i); if (k !== null) keysFound.add(k); }
      } catch { /* private mode or a host double: nothing to read */ }
    }
    return keysFound;
  }
  const keysAtBoot = storageKeys();
  function storageOutsideScope(): string[] {
    const keysSinceBoot = [...storageKeys()].filter((k) => !keysAtBoot.has(k));
    const outsideScopes = store.keysOutsideScopes(keysSinceBoot);
    if (!outsideScopes.length) return [];
    return [`the cartridge stored keys outside the engine's scopes (${outsideScopes.slice(0, 5).join(', ')}): a child's settings `
      + 'kept there do not follow them to the next game, and a game\'s own collide with other games\' — what belongs to '
      + 'the child goes under incl_* through the engine\'s settings, what belongs to the game under incl.<game>.* (storage.gameKey)'];
  }

  const measuredProblems: string[] = [];
  /*
   * THE CHILD READS ALOUD, AND THE GAME RECEIVES TEXT (ADR-0216, issue #200). The engine owns the microphone, the route and
   * the promise of privacy; the cartridge calls `listen()`. ⚠️ Recognition on the device or nothing: `platform/reading` only
   * uses the browser's recogniser where it says it recognises locally, and refuses otherwise instead of quietly sending a
   * child's voice to a server.
   */
  /*
   * 📌 THE READING THREAD GOES WITH THE CARTRIDGE (issue #185), and the closer lives OUT HERE rather than on the `Reading`
   * object: a root that mounts another game keeps the same reading object, and a worker holding a compiled model of up to
   * 378 MiB for a cartridge that never listens is a school machine's memory spent on nothing. It is opened again at the next
   * `listen()`, which is also the moment the child is willing to wait. ⚠️ Out here because `Reading` is the CARTRIDGE's
   * vocabulary (ADR-0216): a method only this file calls has no business in a contract seven repositories read.
   */
  let closeReadingThread = (): void => {};
  const reading: Reading = (() => {
    const browserApis = win as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    let microphone: { record(o: ListenOptions): Promise<Float32Array>; stop(): void } | null = null;
    /** The reading thread, kept between readings (opening it compiles the model again) and let go with the game. */
    let readingThread: { transcribe(samples: Float32Array): Promise<string>; close(): void } | null = null;
    const listener = createReading({
      language: () => bcp47(),
      api: (browserApis.SpeechRecognition ?? browserApis.webkitSpeechRecognition ?? null) as never,
      now: () => win.performance.now(),
      every: (fn, ms) => win.setInterval(fn, ms),
      stopEvery: (h) => win.clearInterval(h as number),
      report: (rowNode) => { if (!measuredProblems.includes(rowNode)) measuredProblems.push(rowNode); },
      /**
       * THE ENGINE'S OWN RECOGNISER, and it arrives late on purpose (ADR-0216 §5): `platform/reading-runtime` is what names the
       * model files, so a game that never listens — and a child of a game that does, until the first `listen()` — loads none of
       * it. Only reached where the device's own recogniser cannot serve the language (ADR-0200 erratum).
       */
      /*
       * 🔴 AND IT RUNS IN A THREAD OF ITS OWN (issue #185). 📏 Measured in the lab: transcribing on the main thread cut the
       * recording in gaps of 4 s — the child goes on reading and the words she says while the page is busy are not in the
       * sound at all. In a worker the biggest gap was 264 ms.
       * ⚠️ WHERE THERE IS NO `Worker` the reading still works, on this thread, and the LINE SAYS SO: an engine that quietly
       * fell back would put the defect back exactly where nobody looks for it.
       */
      model: o.uses?.reading
        ? async (language) => {
          if (typeof (win as unknown as { Worker?: unknown }).Worker === 'function') {
            const { createReadingInWorker } = await import('../platform/reading-in-worker.js');
            readingThread?.close();
            readingThread = createReadingInWorker({
              base: doc.baseURI,
              language,
              // 📌 A FRASE É ESCRITA AQUI e o módulo só entrega o MOTIVO: uma thread que não abre quando ninguém está à
              // espera da resposta não tinha como ser dita a lado nenhum (ADR-0169), e quem sabe o que a criança perde
              // é o canal de diagnóstico, não o protocolo de uma thread.
              report: (reason) => {
                const line = `reading: the transcription thread could not open — ${reason}; a child who reads aloud `
                  + 'gets no answer, and nothing else in the page will say so — check that the reading model for this '
                  + 'language reached `heavy/` (npx inclusionist-heavy --reading <language>)';
                if (!measuredProblems.includes(line)) measuredProblems.push(line);
              },
            });
            closeReadingThread = () => { readingThread?.close(); readingThread = null; };
            return readingThread;
          }
          measuredProblems.push('reading: this browser has no `Worker`, so the transcription runs on the same thread that '
            + 'draws the game and feeds the microphone — measured, that cuts the recording in gaps of seconds and the child '
            + 'loses the words she said meanwhile; serve the game where workers are available');
          const { loadReadingRuntime } = await import('../platform/reading-runtime.js');
          return loadReadingRuntime({ base: doc.baseURI, language });
        }
        : undefined,
      /**
       * AND THE MICROPHONE, for the model route only: the browser's own recogniser opens one itself. It is built at the first
       * reading and let go at the end of each — a track left running is a browser still saying «this page is listening».
       */
      record: o.uses?.reading
        ? async (options) => {
          const { createMicrophone } = await import('../platform/microphone.js');
          microphone ??= createMicrophone({});
          return microphone.record(options);
        }
        : undefined,
    });
    const notDeclared = 'reading: this game called `reading.listen()` without declaring `uses: { reading: true }` — the child '
      + 'speaks and nothing answers, because a delivery built from this declaration carries no reading model; declare it';
    return {
      ready: () => (o.uses?.reading ? listener.ready() : Promise.resolve({ can: false as const, why: 'no-model' as const })),
      stop: () => listener.stop(),
      listen: (options) => {
        if (!o.uses?.reading) {
          if (!measuredProblems.includes(notDeclared)) measuredProblems.push(notDeclared);
          return Promise.reject(new Error('reading was not declared by this game: `uses: { reading: true }`'));
        }
        return listener.listen(options);
      },
    };
  })();

  /*
   * PLAYING WITH THE EYES (ADR-0213; issues #194, #196): the stored 👀 position drives `ui/eye-control` — the camera, the reading, the
   * keys stamped `olhos` on `#game-region` for seat 0, and the regions drawn over the game. What cannot start is said, lands here in
   * `problems`, and puts the 👀 back to off. A stored position opens the camera at start, which asks the child's permission.
   */
  /*
   * THE VIRTUAL CONTROLLER CARRIES COMMANDS TO THE GAME (ADR-0111 erratum; issue #197). The keyboard reaches it by the child's scheme,
   * in the window's capture after the menu navigation and the motor simulations (a key they refused stopped there); a transport that
   * reads positions presses the controller directly.
   */
  const deliverCommand = (cmd: VirtualCommand): void => { cartridge.onCommand?.(cmd); };
  /*
   * THE SCAN ITSELF (ADR-0218): the list is the positions this cartridge declared AND NAMED, because the chip says the game's
   * own words and a position nobody named would cost the child a pass of silence (ADR-0074). It is rebuilt every time the scan
   * starts, so a `mount()` of another cartridge scans ITS positions and not the ones that booted first (ADR-0142).
   */
  const gameRegion = $<HTMLElement>('#game-region');
  const scanChip = gameRegion ? mountScanOverlay(doc, gameRegion) : null;
  let scanner: SwitchScan | null = null;
  let scanFrame = 0;
  const scanWord = (item: ScanItem): string =>
    scanItemText(item, (a) => (cartridge.preset ? labellerFrom(cartridge.preset)(a) : null), t('scan.nothing'));
  // A word of a different length is a different amount of room to keep free, so the band is measured again — and only then.
  const scanShow = (item: ScanItem): void => { if (scanChip?.showing(scanWord(item))) reserveBarBand(); };
  const scanTick = (): void => {
    if (!scanner) return;
    scanShow(scanner(win.performance.now()).showing.item);
    scanFrame = win.requestAnimationFrame(scanTick);
  };
  const stopScan = (): void => {
    if (scanFrame) win.cancelAnimationFrame(scanFrame);
    scanFrame = 0; scanner = null; scanChip?.hide();
    reserveBarBand(); // the room the chip was keeping goes back to the game
  };
  const startScan = (): void => {
    if (scanner) return;
    const names = cartridge.preset ? labellerFrom(cartridge.preset) : null;
    const offered = (cartridge.preset ? presetActions(cartridge.preset) : []).filter((a) => !!names?.(a));
    scanner = createSwitchScan(offered);
    scanTick();
  };
  scanPress = (source) => {
    if (!scanner) return;
    // 📌 THE CHIP IS NOT REDRAWN HERE, and a surviving mutation is why: the frame loop above draws every frame, so a second
    // drawing path only saved the sixteen milliseconds until the next one — a line that could disagree with the loop and could
    // never be seen doing it.
    const out = scanner(win.performance.now(), { press: true });
    const action = out.commanded;
    if (!action) return;
    // 📌 THROUGH THE VIRTUAL CONTROLLER, like every other transport (ADR-0111): in a menu it becomes that menu's key, in play it
    // holds the child's key and reaches the cartridge. The scan decides WHICH position; it does not decide what a position does.
    controleVirtual.press(action, source, 0);
    win.setTimeout(() => controleVirtual.release(action, source, 0), SWITCH_SCAN_DEFAULTS.pulseMs);
  };
  state.on('switchScan', (on) => { if (on) startScan(); else stopScan(); });
  if (state.switchScan) startScan();
  const controleVirtual = createVirtualController({
    scheme: (i) => keyboard.kbFor(i), menuOpen: menuWithDpad,
    // ⚠️ `markKeyFrom` E NÃO `markKey` CRU: uma tecla que chega SEM origem — que é todo evento de teclado de verdade —
    // tem de APAGAR quem a segurou da última vez em vez de a herdar (ADR-0109). A escolha entre as duas portas vive
    // em `input/state`, onde o `input/keydown` já fazia a mesma.
    holdKey: markKeyFrom,
    releaseKey: releaseKey, menuKey: keyToMenu, deliver: deliverCommand,
  });
  /*
   * 🔴 O CONDUTOR DO TECLADO, E SÓ ISSO (ADR-0223). Esta escuta ERA a segunda porta ao cartucho: resolvia a acção e
   * entregava o comando ela própria. Agora resolve a acção e APERTA o controle virtual, como os outros cinco
   * transportes — e depois disto há UM `deliver`, chamado de um sítio.
   *
   * 📏 O que a mudança conserta, e estava medido antes de ser escrita (ADR-0223, contexto):
   *   · com um menu aberto esta porta entregava o `keyup` e a outra não entregava nada — agora a soltura só é
   *     entregue para uma pressão que o jogo OUVIU, que é a memória de `held`;
   *   · uma pressão engolida por um menu seguida de soltura entregava uma soltura sem pressão — já não;
   *   · e a lista de exclusão enumerava quatro transportes, o que a deixava a envelhecer com a lista: a voz e a
   *     varredura entraram depois e nunca lá foram postas. Agora a pergunta é a INVERSA e não envelhece — o que não
   *     é teclado não é deste condutor.
   *
   * 📌 E ele já não pergunta «há um menu aberto?». Essa pergunta tem UMA resposta, a do controle; o que a torna
   * verdadeira para o teclado é o `teclaAoMenu` acima, que não redespacha uma tecla que já está no mundo.
   */
  for (const kind of ['keydown', 'keyup'] as const) {
    win.addEventListener(kind, (e: KeyboardEvent) => {
      if (e.repeat || !cartridge.onCommand) return;
      const source = sourceOfEvent(e);
      // ⚠️ SEM CARIMBO É O TECLADO DE VERDADE: um evento que a criança produziu não traz expando nenhum. O único
      // carimbo que pertence a este condutor é `teclado`, e ele existe para a soltura que o filtro motor sintetiza.
      if (source && source !== 'teclado') return;
      const seat = keyboard.whichPlayer(e.code);
      if (seat < 0) return;
      const action = keyboard.actionOf(e.code, seat) as Action | null;
      if (!action) return;
      if (kind === 'keydown') controleVirtual.press(action, source, seat);
      else controleVirtual.release(action, source, seat);
    }, true);
  }

  /*
   * 🔴 O CONTROLE, MONTADO PELA ENGINE (ADR-0224). Era o único dos seis transportes montado de FORA — quem chamava
   * `initGamepad` era o cartucho —, e foi isso que quase deixou a porta única (ADR-0223) sem lhe chegar: o controle
   * virtual é um local desta função. Um comando físico funciona porque a criança ligou um, não porque um jogo se
   * lembrou de pedir.
   *
   * 📏 Das 25 portas do `GamepadCtx`, VINTE E TRÊS são respondidas aqui com o que esta raiz já tem. As que sobram são
   * o mundo do cartucho e chegam num campo só (`GamepadGameHooks`), com **cada ausência a ter um significado escrito**
   * — nunca adivinhado. Um cartucho que não declara nada tem um controle a funcionar.
   */
  // 📌 As ausências resolvem-se em `input/gamepad`, numa tabela: o que uma ausência SIGNIFICA é decisão, e uma raiz
  // de composição carrega fiação (ADR-0221, errata). Só a de `worldRunning` é daqui, porque só quem monta sabe que
  // menus tem abertos.
  const gameHooks = padGameAnswers(cartridge.gamepad, () => !menuWithDpad());
  const gamepad = initGamepad({
    $,
    getGamepads: () => win.navigator?.getGamepads?.() ?? [],
    // A PALAVRA DO JOGO para uma posição (a fronteira do corte de 2026-09-06): a engine sabe que a posição existe, só
    // o cartucho sabe como ela se chama — e ele já a declarou no `preset` para existir.
    actionLabel: (action) => (cartridge.preset ? labellerFrom(cartridge.preset)(action as Action) : null),
    srSay, srAlert,
    frontOverlay: overlays.frontOverlay,
    // ⚠️ «MENU DE PAUSA» AQUI É TODO MENU COM DIRECIONAL, e não só o cartão: o `steerPause` do transporte já trata o
    // diálogo partilhado antes do cartão, que é o painel aberto por cima. A mesma pergunta que o controle virtual faz.
    pauseMenu: menuWithDpad,
    worldRunning: gameHooks.worldRunning,
    // O START do comando é a PAUSA RÁPIDA (ADR-0155), como o da tela; e a saída reusa a decisão já escrita para o dedo,
    // que sabe distinguir sair da pausa rápida de fechar o cartão.
    pause: () => { enterQuickPause(0); },
    resume: togglePauseByTouch,
    isAttractActive: gameHooks.attractActive,
    stopAttract: gameHooks.stopAttract,
    // Um botão FÍSICO faz sumir o pad da tela — a mesma alternância por modalidade do teclado.
    isTouchMode: () => { const p = $<HTMLElement>('#touch-controls'); return !!p && !p.hidden; },
    hideTouchControls: () => { touchPad.hideTouchControls(); padBeforeMenu = false; },
    // ⚠️ SEMEADO A CADA LEITURA e não uma vez: o cartucho repovoa a lista a cada recomeço, e um assento semeado só no
    // arranque deixaria os jogadores novos sem `pad` — invisíveis para o transporte, sem erro em lado nenhum.
    getPlayers: () => seatEveryPlayer(players()),
    getNumPlayers: () => players().length,
    navTitle: gameHooks.navTitle,
    onBar: isOnBar,
    // ✅ E A METADE QUE FICAVA POR LIGAR NA BARRA LIGA-SE AQUI: o `navBar` do `ui/menu-nav` recebe `(i, k)` e nunca o
    // terceiro argumento, que é a borda do START — a SEGUNDA saída do modo (ADR-0044 item 7). Ela chegava por uma rota
    // do cartucho que esta raiz não montava; agora a raiz monta o comando, e ela chega por aqui.
    navBar,
    sharedDialogOpen: nav.sharedDialogOpen,
    navDialog: nav.navDialog,
    getPauseMenu: (i) => $<HTMLElement>(`#vp-pause-${i}`),
    navPause: nav.navPause,
    setPauseActor,
    playerEdge,
    press: (action, source, player) => controleVirtual.press(action, source, player),
    release: (action, source, player) => controleVirtual.release(action, source, player),
    modalInput: gameHooks.modalInput,
    hasModal: gameHooks.hasModal,
    joinPlayer: gameHooks.joinPlayer,
    respawnPlayer: gameHooks.respawnPlayer,
    clearWaitingBadge: gameHooks.clearWaitingBadge,
    wizardStep: gameHooks.wizardStep,
    wizardTick: gameHooks.wizardTick,
  });
  /*
   * E A ENGINE PASSA A SONDAR, porque quem monta sonda. ⚠️ O laço do jogo é do CARTUCHO (`core/loop.startLoop` é
   * chamado por ele), logo a raiz não tem onde pendurar um quadro — abre o próprio, como já faz para a varredura e
   * para a câmera. Um comando lido a cada quadro é o preço escrito na consequência negativa do ADR-0224.
   */
  let padFrameHandle = 0;
  const anyPadConnected = (): boolean => (win.navigator?.getGamepads?.() ?? []).some(Boolean);
  const pollPad = (): void => { gamepad.pollPads(); padFrameHandle = win.requestAnimationFrame(pollPad); };
  const stopPollingPad = (): void => { if (padFrameHandle) win.cancelAnimationFrame(padFrameHandle); padFrameHandle = 0; };
  /*
   * ⚠️ O LAÇO SÓ EXISTE ENQUANTO HÁ UM COMANDO LIGADO, e isto é o pilar 1 a decidir: um `requestAnimationFrame` que
   * nunca dorme custa bateria no Chromebook de escola, e a esmagadora maioria das máquinas nunca verá um controle.
   * 📌 `gamepadconnected` é o evento que a própria especificação exige que chegue antes de o pad aparecer na lista, e
   * a consulta ao arranque cobre a raiz que nasce com um já ligado (um `mount()` de outro cartucho, por exemplo).
   * 📌 Um hospedeiro SEM quadros — o projecto node é um — é capacidade do ambiente e cala-se (ADR-0169): sem quadros
   * não há jogo a andar para o comando conduzir.
   */
  const startPollingPad = (): void => { if (padFrameHandle || typeof win.requestAnimationFrame !== 'function') return; padFrameHandle = win.requestAnimationFrame(pollPad); };
  win.addEventListener('gamepadconnected', startPollingPad);
  win.addEventListener('gamepaddisconnected', () => { if (!anyPadConnected()) stopPollingPad(); });
  if (anyPadConnected()) startPollingPad();

  const gazeRegion = $<HTMLElement>('#game-region');
  if (canCaptureMedia && gazeRegion) {
    // PLAYING THROUGH THE WEBCAM (ADR-0215): one stored position, off · hands · face · eyes; `ui/camera-control` starts only the control at
    // that position. Each control opens the camera itself and lets it go when the position moves on.
    const visionLoop = {
      requestFrame: (cb: FrameRequestCallback) => win.requestAnimationFrame(cb), cancelFrame: (h: number) => win.cancelAnimationFrame(h),
      now: () => win.performance.now(), every: (cb: () => void, ms: number) => win.setInterval(cb, ms), stopEvery: (h: number) => win.clearInterval(h),
    };
    const cameraDeps = {
      doc, region: gazeRegion, base: doc.baseURI, loop: visionLoop, controller: controleVirtual, say: srSay, alert: srAlert,
      report: (rowNode: string) => { if (!measuredProblems.includes(rowNode)) measuredProblems.push(rowNode); },
      turnOff: () => state.setCameraControlValue('off'),
    };
    // the eyes: the relative reading and the four-zone cycle (ADR-0213), presses from `olhos`, the eye lines and the regions' outlines
    const eyes = createEyeControl(cameraDeps);
    // the face: the Dev's face map (ADR-0210), presses from `rosto`, the eyes, brows and lips lines
    const face = createFaceControl({ ...cameraDeps, openFeed: videoFeed(doc, win.navigator.mediaDevices) });
    // the hands: the Gesture Recognizer and the Dev's hands map (ADR-0210), presses from `gestos`, the hands' lines (issue #191)
    const hands = createHandControl({ ...cameraDeps, openFeed: videoFeed(doc, win.navigator.mediaDevices) });
    const cameraControls = { eyes, face, hands };
    state.on('cameraControl', (mode) => { followCameraMode(mode, cameraControls); });
    followCameraMode(state.cameraControl, cameraControls);
  }

  /*
   * PLAYING BY SPEAKING (ADR-0189, ADR-0193, ADR-0194; issue #184): the stored 👄 drives `ui/voice-control` — the recogniser
   * from the delivery, the microphone that stays open, and presses stamped `fala` on the virtual controller.
   *
   * 📌 THE GRAMMAR FOLLOWS THE OPEN MENU: the names the child can see are the names she can say. They are read from the overlay
   * on top, which is the same one the focus trap and the menu navigation already treat as «the menu that is open».
   */
  if (canCaptureMedia) {
    const menuWords = (): readonly string[] => {
      const card = overlays.topVisibleOverlay();
      if (!card) return [];
      return [...card.querySelectorAll<HTMLElement>('button, [data-passos]')]
        .filter((el) => !el.hidden && el.getAttribute('aria-disabled') !== 'true')
        .map((el) => accessibleLabel(el))
        .filter((s) => s.length > 1);
    };
    voiceControl = createVoiceControl({
      base: doc.baseURI, language: () => bcp47(), controller: controleVirtual, menuWords,
      say: srSay, alert: srAlert,
      report: (line) => { if (!measuredProblems.includes(line)) measuredProblems.push(line); },
      turnOff: () => { state.setVoiceControlValue(false); },
      after: (fn, ms) => { win.setTimeout(fn, ms); },
    });
    state.on('voiceControl', (on) => { void voiceControl?.apply(on); });
    // the words change with the menu that is open, and a menu opens on a key or a touch — so they are re-read on every draw of
    // the bar, which is what already happens whenever a card or a panel appears (ADR-0106 §5)
    state.on('menuIndexOn', () => { voiceControl?.refreshGrammar(); });
    void voiceControl.apply(state.voiceControl);
  }
  /*
   * O AMOSTRADOR DE FLASHES MORA EM `platform/flash-sampler` (ADR-0221, issue #203), e o que fica aqui é o que só a raiz sabe:
   * qual é o canvas do mundo DESTE cartucho, e para onde vai uma falha. 📏 Eram 53 linhas e 12 ramos nesta função.
   */
  const sampleWorldFlashes = (ms: number): Promise<FlashMeasurement> => sampleFlashes({
    canvas: () => {
      const declaredWorld = cartridge.declaration.world();
      const eventTarget = declaredWorld.kind === 'element' ? $<HTMLElement>(declaredWorld.selector) : null;
      return eventTarget?.tagName === 'CANVAS' ? eventTarget as HTMLCanvasElement : eventTarget?.querySelector('canvas') ?? null;
    },
    scratch: () => doc.createElement('canvas'),
    frame: typeof win.requestAnimationFrame === 'function' ? (cb) => { win.requestAnimationFrame(cb); } : undefined,
    report: (rowNode) => { measuredProblems.push(rowNode); },
  }, ms);

  function unmountAll(): void {
    closeReadingThread();
    registerKeyboardMapping(null);
    registerPadMapping(null);
    registerCrashNotice(null);
    removeReachNotice();
    hudMounted?.remove();
    hudMounted = null;
    reserveBarBand();
    // ⚠️ `pop()` E NÃO UM `clear()`: cada `exit()` é a limpeza de DOM daquela cena, e saltá-la deixaria na
    // página o que o cartucho anterior desenhou. O laço tem fim porque `pop()` devolve `null` na pilha vazia.
    while (rootScenes.pop()) { /* o `exit()` de cada cena É o teardown dela */ }
  }

  function dispose(): void {
    unmountAll();
    // 📌 O laço de sondagem do comando é da RAIZ desde o ADR-0224, logo morre com ela: um `requestAnimationFrame` que
    // sobrevive a `dispose()` lê a Gamepad API para sempre, numa raiz que já não tem jogadores (ADR-0220).
    stopPollingPad();
    listeners.releaseAll();
  }

  return {
    get declaration() { return cartridge.declaration; },
    get declines() { return declines(); },
    mount: mountAll,
    unmount: unmountAll,
    dispose,
    pause: pauseControls,
    tts,
    reading,
    captionSound: writeSoundCaption,
    gameSpeed: () => state.gameSpeed,
    measureFlashes: sampleWorldFlashes,
    overlays,
    nav,
    keyboard,
    controller: controleVirtual,
    sonar,
    applyVisionFilter: setVisionFilter,
    scenes: rootScenes,
    onLocaleChange: (fn) => { localeListeners.push(fn); },
    cvdFilters,
    get problems() { return [...hostProblems, ...stylesheetMissing(), ...measureCartridgeProblems(), ...dictionaryGaps(), ...measuredProblems, ...storageOutsideScope()]; },
    onFailure: announceFailure,
    get reach() { return currentReach; },
  };
}
