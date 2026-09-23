// SPDX-License-Identifier: AGPL-3.0-or-later
// input/gamepad.ts — gamepad READING (stdDirs/padActions/bindActive/padMapFor) + the poll dispatcher
// (pollPads) + the accessibility MAPPING WIZARD (openPadWiz/openPadWizFor/closePadWiz/padWizTick). Pure
// button->action logic is separated from the DI runtime (initGamepad(ctx)): the Gamepad API is injected
// (ctx.getGamepads, so tests feed a fake pad with no browser) and every cross-subsystem call (menu nav, quiz,
// join/respawn, phase, overlays) is injected too — never reaches `document`/`navigator` or imports game.js.
// Boundary: this module only READS buttons/axes and maps them to actions; the physical button ARTWORK/labels
// (PAD_DESIGNS) and the on-screen touch pad are input/devices.ts + input/touch (a parallel extraction) — not here.

import { t } from '../core/i18n.js';
import type { PlayerView } from '../core/entity.js';
import { EDGE_BY_ACTION, edgeAllowed } from './edges.js';
import { createPadWizard, padMap, PADWIZ_ORDER as ORDEM_DO_ASSISTENTE } from './pad-wizard.js';
import { padTable, type PadTable } from './pad-defaults.js';
import { padCur, padPrevAct, padPrevStart } from './state.js';
// ⚠️ O `oneButton` ENTRA POR IMPORT, e não pelo `ctx` — ao contrário de `input/keydown`, que o recebe por
// getter. A diferença não é de gosto: o `keydown` foi extraído quando o `oneButton` era um `let` do
// `game.js`, e a regra da casa manda o que o JOGO reatribui entrar por getter. Hoje ele é `core/state`,
// ou seja da ENGINE — e um getter obrigaria cada consumidor a lembrar-se de o passar.
//
// ⚠️ E ESQUECER É EXATAMENTE O DEFEITO QUE ISTO CONSERTA (issue #120). Um campo opcional no ctx faria a
// acomodação existir só nos jogos onde alguém se lembrou dela, que é o argumento M3 do ADR-0077 com outro
// substantivo. Binding vivo de `core/state`: não há por onde falhar.
import * as estadoDoJogo from '../core/state.js';

// ---------------------------------------------------------------------------------------------
// Gamepad API surface (minimal, adapter-friendly — mirrors the real Gamepad/GamepadButton shape)
// ---------------------------------------------------------------------------------------------

// 🔴 O QUE UM CONTROLE ESTÁ A FAZER mudou-se para `input/pad-reading` em 2026-09-23: era a metade PURA deste
// ficheiro — botões e eixos entram, posições saem —, e ficava ao lado do condutor que sonda os pads a cada quadro
// e decide para onde a leitura vai. Aqui ficou a fiação, que só se lê com um ctx na mão.
// ⚠️ SEM APELIDO, como nos cinco cortes de metade pura antes deste: um re-export manteria vivo um caminho que o
// retrato da superfície não vê, e a nota de migração é o que diz onde cada nome passou a morar.
import {
  type PadLike, type GetGamepads, type PadMap, type PadActions, type ActionKey,
  padActions, oneButtonAtOnce,
} from './pad-reading.js';

// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

// ---------------------------------------------------------------------------------------------
// Wizard data (a ORDEM dos passos + a animação de demonstração; as PALAVRAS vêm do jogo)
// ---------------------------------------------------------------------------------------------

/**
 * A ORDEM em que o assistente pergunta. SÓ a ordem — a mesma lista que o `input/pad-wizard` percorre, onde ela
 * vive à parte de qualquer jogo (issue #182).
 *
 * ⚠️ ELA CARREGAVA AS PALAVRAS, EM PORTUGUÊS CRU, DENTRO DA ENGINE: `['action2', 'PULAR']`,
 * `['action1', 'CORRER / INTERAGIR']`. Era o defeito do ADR-0074 na sua forma mais visível — não só
 * vocabulário de plataforma dentro do motor, mas vocabulário de plataforma NUM IDIOMA SÓ, à frente de uma
 * criança, num ficheiro que o pilar 3 obriga a ser localizável.
 *
 * A palavra vem agora de `ctx.rotuloDaAcao`, que o jogo fornece pelo seu preset. Aqui fica o que é mesmo da
 * engine: a sequência em que se pergunta — direções primeiro, ação depois, sistema no fim —, que é uma
 * decisão de ergonomia do assistente e não do jogo.
 *
 * ⚠️ E UMA AÇÃO QUE O JOGO NÃO NOMEIA NÃO É PERGUNTADA. `wizPrompt` salta-a, porque um jogo que não usa a
 * posição não tem o que mapear nela — e perguntar produziria um passo mudo, ou pior, um passo a dizer
 * `action7` em voz alta.
 */
export const PADWIZ_ORDER: readonly string[] = ORDEM_DO_ASSISTENTE;

export interface WizAnimDef { seq?: string[]; hold?: number; cls: string; fx?: string; noimg?: number; flip?: number; }
/** Demonstração animada de cada ação (frames reais do jogo) mostrada durante o passo correspondente do wizard. */
const PADWIZ_ANIM: Record<string, WizAnimDef> = {
  up: { seq: ['escada/0', 'escada/1'], hold: 9, cls: 'pw-up' },
  down: { seq: ['escada/1', 'escada/0'], hold: 9, cls: 'pw-down' },
  left: { seq: ['andar/0', 'andar/1', 'andar/2', 'andar/3', 'andar/4', 'andar/5', 'andar/6', 'andar/7'], hold: 4, cls: 'pw-left', flip: 1 },
  right: { seq: ['andar/0', 'andar/1', 'andar/2', 'andar/3', 'andar/4', 'andar/5', 'andar/6', 'andar/7'], hold: 4, cls: 'pw-right' },
  action2: { seq: ['pulo/0', 'pulo/0', 'pulo/1', 'pulo/1'], hold: 7, cls: 'pw-jump' },
  action1: { seq: ['correr/0', 'correr/1', 'correr/2', 'correr/3'], hold: 3, cls: 'pw-run' },
  action4: { fx: '👟 🕷️ 🎈 🐇 🦘', cls: 'pw-swap', noimg: 1 },
  action3: { seq: ['idle/0', 'idle/1', 'idle/2', 'idle/3'], hold: 8, fx: '✨', cls: 'pw-especial' },
  start: { fx: 'PAUSA', cls: 'pw-start', noimg: 1 },
};

interface WizBase { b: boolean[]; a: number[]; }
interface WizAxTrack { i: number; v: number; last: number; changes: number; ticks: number; }
/** Estado do wizard em andamento; `null` = fechado. Espelha o `padWiz` do game.js. */
export interface WizState {
  gi: number; // índice do gamepad sendo mapeado (-1 = ainda não identificado)
  id: string;
  step: number; // índice em PADWIZ_ORDER (-1 = ainda esperando baseWait terminar)
  base: WizBase | null; // snapshot de repouso (tudo solto) capturado após baseWait
  map: PadMap;
  release: boolean; // esperando o botão do passo anterior ser SOLTO antes de perguntar o próximo
  baseWait: boolean; // esperando TUDO ser solto para capturar o snapshot de repouso
  axTrack: WizAxTrack | null; // eixo em classificação (~240ms): analógico (varia) vs D-pad/hat (salta e trava)
  timer: ReturnType<typeof setInterval> | null;
}

// ---------------------------------------------------------------------------------------------
// DI runtime — pollPads (dispatcher) + o wizard. Nada aqui toca `document`/`navigator` diretamente.
// ---------------------------------------------------------------------------------------------

import type { NavKeys } from './edges.js';
import type { ModalIntent } from './keydown.js';
import type { DomQuery } from '../core/dom-query.js';
export type { NavKeys } from './edges.js'; // reexportado sob o nome que os consumidores já usam

/** Forma mínima de jogador que este módulo lê/escreve — DERIVADA de core/entity, não redigitada.
 *  (`quiz` SAIU em 2026-08-25 — ADR-0033. Era `{ kind: string } | null` aqui e `{ kind?: string } | null` no
 *  keydown, o mesmo objeto do JOGO com o discriminante obrigatório num módulo e opcional no outro. Hoje
 *  nenhum dos dois o lê: a pergunta é `ctx.hasModal(i)` e a resposta é uma INTENÇÃO.) */
export type GamepadPlayer = PlayerView<
  'pad' | 'quit' | 'waiting' | 'easy' |
  'jumpEdge' | 'runEdge' | 'leftEdge' | 'rightEdge' | 'swapEdge' | 'specialEdge'
>;

/**
 * O QUE SÓ O CARTUCHO SABE SOBRE O MUNDO DELE (ADR-0224). A engine monta este transporte — como já monta o toque, os
 * olhos, o rosto, as mãos, a voz e a varredura —, e 📏 das 25 portas do `GamepadCtx` a raiz responde a 23 com o que já
 * tem. Estas são as que sobram, e são as que nada na engine pode saber.
 *
 * 🎯 **TODAS OPCIONAIS, E CADA AUSÊNCIA TEM UM SIGNIFICADO ESCRITO** — nunca adivinhado (ADR-0113 cláusula 3, ADR-0169).
 * Um cartucho que não declara nada tem um controle a funcionar; o que depende do mundo dele simplesmente não acontece.
 * Recusar o arranque por falta destas partiria todo jogo com controle e sem tela de título, por uma declaração que tem
 * um significado seguro — que é recusar onde se devia relatar.
 *
 * 📌 UM CAMPO SÓ no `CreateGameOptions`, e não nove soltos: nove campos são nove coisas que todo jogo tem de aprender
 * num contrato cujo custo é uma porta de mão única (ADR-0172), e o transporte seguinte que precisasse do mesmo trato
 * traria mais nove. Agrupá-los também diz algo verdadeiro — pertencem juntos porque são «o que o pad precisa do jogo».
 */
export interface GamepadGameHooks {
  /** O mundo está a andar? **Ausente: está**, sempre que o cartão de pausa não estiver aberto. */
  readonly worldRunning?: () => boolean;
  /** A tela de título deste jogo. **Ausente: não há título a navegar** — o pad não faz nada fora do jogo e da pausa. */
  readonly navTitle?: (k: NavKeys) => void;
  /** A demonstração que roda sozinha. **Ausentes: não há demo**, logo nada a encerrar. */
  readonly attractActive?: () => boolean;
  readonly stopAttract?: () => void;
  /** O desafio aberto deste jogador. **Ausentes: não há modal**, e o direcional é do jogo. */
  readonly hasModal?: (playerIndex: number) => boolean;
  readonly modalInput?: (playerIndex: number, intent: ModalIntent) => void;
  /** Entrar num jogo a andar com uma tela nova. **Ausente: ninguém entra a meio** (devolve `false`). */
  readonly joinPlayer?: (padIndex: number) => boolean;
  /** Recomeçar só a tela deste jogador. **Ausente: nada acontece** — uma tela abandonada fica abandonada. */
  readonly respawnPlayer?: (playerIndex: number) => void;
  /** O selo «aguardando» do HUD do jogo. **Ausente: não há selo** a tirar. */
  readonly clearWaitingBadge?: (playerIndex: number) => void;
  /** A arte da demonstração animada do assistente de mapeamento. **Ausente: o assistente fala, sem desenho.** */
  readonly spriteBase?: string;
}

/** As mesmas respostas, todas presentes: é isto que o `GamepadCtx` consome, e o que a tabela abaixo garante. */
export type PadGameAnswers = Required<Omit<GamepadGameHooks, 'worldRunning'>> & { readonly worldRunning: () => boolean };

/**
 * O QUE CADA AUSÊNCIA SIGNIFICA, COMO DADO (ADR-0224). Uma tabela e não dez `??` espalhados por quem monta: o
 * significado de uma ausência é uma DECISÃO, e uma raiz de composição só deve conter fiação — dez decisões dentro
 * dela são dez ramos numa função que a catraca já acompanha (ADR-0221, errata).
 *
 * ⚠️ `worldRunning` não está aqui porque a sua ausência não tem resposta universal: depende de quem monta saber que
 * menus tem abertos. Ele entra por parâmetro, o que também o torna a única ausência que um hospedeiro pode responder.
 */
const SILENT_PAD_ANSWERS: Omit<PadGameAnswers, 'worldRunning'> = Object.freeze({
  navTitle: () => {},             // não há tela de título a navegar
  attractActive: () => false,     // não há demonstração a correr
  stopAttract: () => {},          // logo não há nada a encerrar
  hasModal: () => false,          // não há desafio aberto: o direcional é do jogo
  modalInput: () => {},           // e portanto nada a alimentar
  joinPlayer: () => false,        // ninguém entra a meio de um jogo a andar
  respawnPlayer: () => {},        // uma tela abandonada fica abandonada
  clearWaitingBadge: () => {},    // o selo de espera é HUD do jogo; sem jogo a declará-lo, não existe
  spriteBase: '',                 // o assistente de mapeamento fala, sem desenho
});

/**
 * As respostas do cartucho com toda ausência já resolvida. 📌 Um campo DECLARADO como `undefined` é uma ausência como
 * outra qualquer — espalhar o objecto cru por cima da tabela apagaria a resposta com um `undefined`, que é o defeito
 * silencioso que esta função existe para não ter.
 */
export function padGameAnswers(hooks: GamepadGameHooks | undefined, worldRunningWhenSilent: () => boolean): PadGameAnswers {
  const declared: Record<string, unknown> = {};
  for (const [name, answer] of Object.entries(hooks ?? {})) if (answer !== undefined) declared[name] = answer;
  return { worldRunning: worldRunningWhenSilent, ...SILENT_PAD_ANSWERS, ...declared } as PadGameAnswers;
}

/**
 * OS CAMPOS DE ASSENTO, SEMEADOS PELA ENGINE (ADR-0224; a mesma saída que a fase 4 do plano já tinha escrito para o
 * toque). 📏 Medido: os jogadores que um cartucho declara são `{ ctrl, audioSink? }`, e este transporte precisa de
 * saber de quem é cada controle (`pad`), quem ainda espera (`waiting`) e quem largou a tela (`quit`).
 *
 * 🔴 SEMEIA NO PRÓPRIO OBJECTO e devolve a MESMA lista — copiar perderia o assento no quadro seguinte, porque é neste
 * objecto que `takeSeat` escreve. É também por isso que não se faz `.map`: a identidade é o que carrega o estado.
 * 📌 Só toca em quem ainda não tem os campos, logo um cartucho que os declare fica com os dele.
 */
export function seatEveryPlayer(list: readonly object[]): GamepadPlayer[] {
  for (const p of list) {
    const seat = p as { pad?: number; waiting?: boolean; quit?: boolean };
    seat.pad ??= -1;
    seat.waiting ??= false;
    seat.quit ??= false;
  }
  return list as GamepadPlayer[];
}

export interface GamepadCtx {
  /** Adaptador da Gamepad API (substitui `navigator.getGamepads()`) — o ponto de DI para testar sem browser. */
  getGamepads: GetGamepads;
  /** Seletor DOM (querySelector), injetado — nunca alcança `document` global. */
  $: DomQuery;
  /**
   * COMO SE CHAMA esta posição, na palavra do JOGO e no idioma vigente. `null` = o jogo não a usa.
   *
   * ⚠️ É a fronteira do corte de 2026-09-06 em forma de campo: a engine sabe que existe uma posição,
   * só o jogo sabe a palavra. Antes desta linha o assistente dizia «PULAR» a partir de uma constante
   * deste ficheiro — em português, sem passar por `t()`, dentro do motor.
   */
  rotuloDaAcao: (acao: string) => string | null;
  /** Anúncios de leitor de tela (core/a11y-sr), injetados. */
  srSay: (msg: string) => void;
  srAlert: (msg: string) => void;
  /** Traz um overlay para frente + preenche o texto de ajuda (game.js's frontOverlay, compartilhado por todo overlay). */
  frontOverlay: (el: HTMLElement | null) => void;
  /* --- A CENA, em booleanos e verbos (ADR-0030 C3, 2026-08-26) ---
     Era `getPhase(): Phase` + `setPhase(p: Phase)`. O módulo é ENGINE e passava a conhecer o vocabulário de
     fases DESTE jogo; o `consumer-quiz` já mostrou, no `menu-nav`, o que isso custa — um quiz cujos ajustes
     estão sempre disponíveis tinha de se declarar "pausado" para navegar os próprios menus. O que este
     módulo de fato precisa são duas perguntas e dois verbos. */
  /** O mundo está rodando? (START aqui PAUSA.) */
  mundoRodando: () => boolean;
  /** O menu de pausa está aberto? (START aqui RETOMA.) */
  menuDePausa: () => boolean;
  /** Pausar e retomar. Quem empilha a cena é a raiz; daqui sai só a intenção. */
  pausar: () => void;
  retomar: () => void;
  /** Modo demonstração (attract) — game.js's attractCtl. */
  isAttractActive: () => boolean;
  stopAttract: () => void;
  /** Controles virtuais de toque — somem no primeiro input físico. */
  isTouchMode: () => boolean;
  hideTouchControls: () => void;
  /** Estado vivo de jogadores/telas (core/state.ts, injetado como getter — nunca cacheado por este módulo). */
  getPlayers: () => GamepadPlayer[];
  getNumPlayers: () => number;
  /** Navegação de menus (game.js): título, diálogo compartilhado (o de cima), e a pausa por tela. */
  navTitle: (k: NavKeys) => void;
  /** A tela `i` está no modo `accessibility`? (ADR-0044, item 7 — o direcional dirige a barra do HUD.) */
  naBarraDe: (i: number) => boolean;
  /** Um passo dentro da barra. `temStart` é a borda do botão de pausa, que é a SEGUNDA saída do modo. */
  navBar: (i: number, k: NavKeys, hasStart: boolean) => void;
  sharedDialogOpen: () => HTMLElement | null;
  navDialog: (dlg: HTMLElement, k: NavKeys) => void;
  /** A tela de pausa do jogador. `HTMLElement` e não `{ hidden: boolean }`: o mínimo estrutural funciona
   *  para LER, mas este módulo REPASSA o menu para `navPause`, que precisa do elemento inteiro — e em
   *  posição de parâmetro a fatia mínima se inverte (ADR-0039). Mesma lição do `held` em audio-nav. */
  getPauseMenu: (playerIndex: number) => HTMLElement | null | undefined;
  navPause: (menu: HTMLElement, playerIndex: number, k: NavKeys) => void;
  /** Qual jogador abre o submenu de a11y em seguida (game.js's `pauseActor`). */
  setPauseActor: (playerIndex: number) => void;
  /**
   * ESTA ARESTA É DESTE JOGADOR, E VEIO DO CONTROLE (ADR-0113 cláusula 4, issue #127).
   *
   * 🔴 OBRIGATÓRIO, e a razão foi medida em 2026-09-09: `input/state.playerEdge` tinha ZERO chamadores
   * em produção, logo `inputOf(i).emUso` respondia `teclado` a toda a gente — e a alternância lida era a do
   * teclado mesmo com o controle na mão. 📌 Passe `createLatchedEdge(() => players)` de
   * `input/latch-edge`, e não o cru: é ela que também resolve a alternância deste aparelho no jogador.
   *
   * ⚠️ O gamepad era o ÚNICO transporte que sobrevivia identificável sem isto — ele nunca passou pelo
   * conjunto de teclas, passa por `padCur` —, e é exactamente por isso que a falta aqui era invisível: o
   * módulo sabe de que controle veio a aresta, e o autómato não.
   */
  playerEdge: (jogador: number, origem: 'gamepad') => void;
  /**
   * A PORTA ÚNICA PARA O CARTUCHO (ADR-0223): apertar uma POSIÇÃO no assento deste controle. Responde se a
   * pressão chegou ao JOGO — `false` quer dizer que um menu a levou.
   *
   * 🔴 O PAD NÃO PASSAVA POR PORTA NENHUMA, e isso estava medido: ele levantava arestas no jogador e mais nada,
   * logo um cartucho que ouve só `onCommand` — o que a errata do ADR-0111 pediu a todos — não respondia a um
   * controle. As arestas ficam (a física de um cartucho aprende por elas que houve um toque), mas deixam de ser
   * a única saída: passam a ser CONSEQUÊNCIA de uma pressão que chegou ao jogo.
   *
   * 📌 OBRIGATÓRIO, e a errata do ADR-0223 diz porquê: quem monta este transporte é o CARTUCHO, não a raiz, logo
   * a porta chega por aqui — e uma porta opcional é mais um campo que um jogo pode esquecer, e esquecê-lo devolve
   * o silêncio que este trabalho existe para acabar. Passe `motor.controller.press`.
   */
  press: (action: ActionKey, source: 'gamepad', player: number) => boolean;
  /** Soltar a POSIÇÃO. O controle solta a tecla que segurou e entrega a soltura — e só para uma pressão que o jogo ouviu. */
  release: (action: ActionKey, source: 'gamepad', player: number) => void;
  /**
   * MODAL do PRÓPRIO jogador: a engine entrega a INTENÇÃO, o jogo decide (ADR-0033).
   *
   * Eram quatro — `quizMove(p, delta)`, `quizConfirm`, `quizErase`, `announceBraille` — e as quatro existiam
   * porque a decisão de qual chamar morava aqui, com a grade de três colunas e o desvio de Braille. O pad e
   * o teclado tinham CÓPIAS dessa mesma decisão, o que é a pior forma de tê-la: duas para divergir.
   */
  /** O ÍNDICE do jogador, não o jogador (ADR-0033/0039): a engine entrega intenção e não precisa saber o
   *  que é um jogador com desafio aberto. Quem resolve o índice é o dono do desafio. */
  modalInput: (playerIndex: number, intent: ModalIntent) => void;
  /** Este jogador tem um modal aberto? Uma pergunta, e não o objeto do jogo. */
  hasModal: (playerIndex: number) => boolean;
  /** Entra num jogo em andamento com uma tela nova (game.js's joinPlayer). */
  joinPlayer: (padIndex: number) => boolean;
  /** Recomeça só a tela deste jogador (game.js's respawnPlayer). */
  respawnPlayer: (playerIndex: number) => void;
  /** Remove o selo "aguardando" da tela quando ela ganha um controle (parte do HUD, game.js). */
  clearWaitingBadge: (playerIndex: number) => void;
  /**
   * Caminho-base dos sprites usado pela demo animada do wizard. NOTA — bug encontrado, não corrigido: o
   * game.js original referencia um identificador `SPR` que NUNCA é declarado/importado ali (só existe, sem
   * export, em render/sprites.ts) — `padWizDemo`/`padWizDemoTick` lançam ReferenceError em runtime assim que
   * o wizard mostra qualquer demonstração animada (inclusive ao abrir: `padWizDemo(null)` já cai no ramo que lê
   * `SPR`). Fica como dependência EXPLÍCITA aqui em vez de reproduzir o global inexistente — ver retorno da tarefa.
   */
  spriteBase: string;
}

export interface GamepadApi {
  pollPads(): void;
  openPadWiz(): void;
  openPadWizFor(gp: PadLike): void;
  closePadWiz(save: boolean): void;
  padWizTick(): void;
  padMapFor(id: string): PadMap | null;
  /** Estado vivo do wizard (para expor via `get padWiz(){}` no window.__incl, como o game.js original). */
  getPadWiz(): WizState | null;
}

/**
 * O QUE UM QUADRO SABE SOBRE UM CONTROLE: as acções agora, as arestas contra o quadro anterior, e de quem é o assento.
 *
 * 🔴 EXISTE PORQUE O `pollPads` TINHA PROFUNDIDADE 11 (ADR-0221, passo 7c). A leitura de um pad e os cinco destinos
 * possíveis dela viviam aninhados uns dentro dos outros, e o ramo mais fundo — o jogo a sério — estava a nove níveis da
 * primeira chaveta. Com a leitura num VALOR, cada destino é uma função ao lado das outras e nenhuma passa de quatro.
 *
 * 📌 E não é só a medida: o nome de cada destino passou a existir. «O que acontece quando a criança está na barra rápida»
 * era um `if` no meio de duzentas linhas e agora é `steerGame` a chamar uma coisa chamada assim.
 */
interface PadFrame {
  readonly gp: PadLike;
  readonly gi: number;
  /** O assento deste controle, ou −1 enquanto ninguém o tomou. */
  readonly owner: number;
  /** A lista VIVA dos jogadores: o ramo do assento escreve nela. */
  readonly players: GamepadPlayer[];
  readonly cur: PadActions;
  /** O START (ou o pulo) que SUBIU neste quadro — fecha diálogos e telas de vitória. */
  readonly startEdge: boolean;
  /** Só o START que subiu — pausa e retoma. */
  readonly pauseEdge: boolean;
  readonly edge: (k: ActionKey) => boolean;
  /**
   * A BORDA DE DESCIDA: o botão que estava em baixo no quadro anterior e não está agora.
   *
   * 🔴 Nasceu com o ADR-0223 e é o que torna a porta única HONESTA neste transporte: o controle virtual guarda
   * um mapa de `held` para nunca deixar um jogo a acreditar que um botão continua premido, e sem esta metade o
   * pad apertava e nunca soltava. O pad é o único transporte que lê ESTADO por quadro em vez de receber eventos,
   * logo a soltura não lhe chega — calcula-se.
   */
  readonly released: (k: ActionKey) => boolean;
  /** As seis intenções de menu. `comStart` só no título, onde o START é «começar» e não «sair». */
  readonly navKeys: (withStart?: boolean) => NavKeys;
}

/** As oito posições que ESTE transporte lê: o direcional e as quatro acções. Os ombros e os gatilhos que um
 *  cartucho pode declarar não têm leitura no pad (medido em 2026-09-22) — a lista diz o que é verdade hoje. */
const PAD_POSITIONS: readonly ActionKey[] = Object.freeze(
  ['left', 'right', 'up', 'down', 'action1', 'action2', 'action3', 'action4'] as const,
);

export function initGamepad(ctx: GamepadCtx): GamepadApi {
  let padWizAutoResume = false; // wizard aberto automaticamente no meio do jogo -> retoma a fase ao fechar
  let padWizAnim: { seq: string[]; hold: number; t: number } | null = null;

  // the page's one cache of stored maps (input/pad-wizard): a map saved by the engine's own wizard is read here next frame
  const padMapFor = (id: string): PadMap | null => padMap(id);
  function actionsFor(gp: PadLike, table?: PadTable): PadActions { return padActions(gp, padMapFor(gp.id), table); }

  // ----- wizard: the demonstration is THIS module's host's (the platformer's sprites), not the wizard's -----
  function wizDemo(k: string | null): void {
    const d = ctx.$<HTMLElement>('#padwiz-demo');
    const img = ctx.$<HTMLImageElement>('#padwiz-demo-img');
    const fx = ctx.$<HTMLElement>('#padwiz-demo-fx');
    if (!d) return;
    const a = k ? PADWIZ_ANIM[k] : null;
    d.className = a ? a.cls : '';
    padWizAnim = null;
    if (fx) fx.textContent = (a && a.fx) || '';
    if (img) {
      img.style.display = a && a.noimg ? 'none' : '';
      img.style.transform = a && a.flip ? 'scaleX(-1)' : '';
      if (a && a.seq) { img.src = ctx.spriteBase + a.seq[0] + '.png'; padWizAnim = { seq: a.seq, hold: a.hold || 6, t: 0 }; }
      else if (!a) img.src = ctx.spriteBase + 'idle/0.png';
    }
  }
  function wizDemoTick(): void {
    if (!padWizAnim) return;
    const a = padWizAnim; a.t++;
    const img = ctx.$<HTMLImageElement>('#padwiz-demo-img');
    if (img) img.src = ctx.spriteBase + a.seq[Math.floor(a.t / a.hold) % a.seq.length] + '.png';
  }

  const wizard = createPadWizard({
    getGamepads: () => ctx.getGamepads(),
    rotuloDaAcao: (acao) => ctx.rotuloDaAcao(acao),
    dizer: (phrase) => { const el = ctx.$<HTMLElement>('#padwiz-prompt'); if (el) el.textContent = phrase; ctx.srSay(phrase); },
    progresso: (texto) => { const pr = ctx.$<HTMLElement>('#padwiz-progress'); if (pr) pr.textContent = texto; },
    srAlert: (phrase) => ctx.srAlert(phrase),
    aoPasso: wizDemo,
    aoTique: wizDemoTick,
    aoFechar: (gi) => {
      const ov = ctx.$<HTMLElement>('#padwiz'); if (ov) ov.hidden = true;
      // sem edges fantasmas: o botão ainda SEGURADO do último passo (START) não pode pausar/agir ao retomar
      try {
        const pads = ctx.getGamepads() ?? [];
        const gp = pads[gi];
        if (gp) { const c = actionsFor(gp); padCur[gi] = c; padPrevAct[gi] = c; padPrevStart[gi] = c._start; }
      } catch { /* espelha o try/catch silencioso do original */ }
      if (padWizAutoResume) { padWizAutoResume = false; if (ctx.menuDePausa()) ctx.retomar(); }
    },
  });
  function openPadWiz(): void {
    const ov = ctx.$<HTMLElement>('#padwiz'); if (!ov) return;
    ov.hidden = false; ctx.frontOverlay(ov);
    wizard.abrir();
  }
  // Wizard aberto AUTOMATICAMENTE (controle DirectInput sem mapa apertou algo): já sabemos qual controle é.
  function openPadWizFor(gp: PadLike): void {
    const ov = ctx.$<HTMLElement>('#padwiz'); if (!ov) return;
    ov.hidden = false; ctx.frontOverlay(ov);
    wizard.abrirPara(gp);
  }
  const closePadWiz = (save: boolean): void => wizard.fechar(save);
  const padWizTick = (): void => wizard.tique();

  const cancelBtn = ctx.$<HTMLButtonElement>('#padwiz-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => closePadWiz(false));

  // ----- poll (chamado a cada frame do loop) -----

  /** A leitura deste quadro para UM controle: as acções agora, as arestas contra o quadro anterior e o assento. */
  function readPad(gp: PadLike, players: GamepadPlayer[]): PadFrame {
    const gi = gp.index;
    const prev = padPrevAct[gi] || {};
    // ⚠️ O ASSENTO É LIDO ANTES DAS ACÇÕES, e a razão é o ADR-0115: a tabela de botões deste jogo é declarada POR
    // ASSENTO, e ela é lida dentro do `actionsFor`. Enquanto o `owner` só se resolvia lá em baixo, por ramo, a
    // leitura acontecia antes de se saber de quem era o controle — e um padrão por assento chegava tarde.
    const owner = players.findIndex((p) => p.pad === gi);
    // ⚠️ E O CONTROLE AINDA NÃO ATRIBUÍDO (`owner < 0`) LÊ O ASSENTO 0, e não «nenhum»: ele está a produzir
    // arestas na tela do título, e um mapa vazio ali deixaria a criança sem como escolher o próprio jogo.
    // A EMPATIA MOTORA APLICADA AO CONTROLE (issue #120). Sem esta linha, uma criança com o modo de
    // um botão ligado e um pad na mão NÃO ESTAVA no modo — e nada em lado nenhum o dizia.
    const cur = oneButtonAtOnce(
      prev,
      actionsFor(gp, padTable(ctx.getNumPlayers(), owner < 0 ? 0 : owner)),
      estadoDoJogo.oneButton,
    );
    const startEdge = cur._start && !padPrevStart[gi]; padPrevStart[gi] = cur._start;
    const pauseEdge = cur._pause && !prev._pause;
    const edge = (k: ActionKey): boolean => cur[k] && !prev[k];
    const released = (k: ActionKey): boolean => !!prev[k] && !cur[k];
    padCur[gi] = cur; padPrevAct[gi] = cur;
    // 📌 O START conta como «sim» APENAS no título: lá ele é o botão que começa o jogo, e no cartão de pausa ou na barra
    // ele é a SAÍDA (ADR-0044 item 7). Um parâmetro em vez de três listas iguais a menos de um termo.
    const navKeys = (withStart = false): NavKeys => ({
      yes: edge('action2') || (withStart && startEdge), no: edge('action3'),
      up: edge('up'), down: edge('down'), left: edge('left'), right: edge('right'),
    });
    return { gp, gi, owner, players, cur, startEdge, pauseEdge, edge, released, navKeys };
  }

  /** Aconteceu alguma das seis intenções de menu neste quadro? */
  // 📌 O `!!` é o que o `NavKeys` pede: os seis campos são OPCIONAIS lá, porque nem todo transporte os produz todos.
  const anyIntent = (k: NavKeys): boolean => !!(k.yes || k.no || k.up || k.down || k.left || k.right);

  /** Controle fora do padrão (DirectInput) SEM mapa guardado que apertou algo: pausa geral e o assistente abre nele. */
  function wizardTookOver(gp: PadLike): boolean {
    if (gp.mapping === 'standard' || padMapFor(gp.id) || !gp.buttons.some((b) => b && b.pressed)) return false;
    padWizAutoResume = ctx.mundoRodando();
    if (ctx.mundoRodando()) ctx.pausar();
    openPadWizFor(gp);
    return true;
  }

  /** Vitória: START/pulo fecham o modal (Jogar de novo), e nada deste controle chega ao jogo por baixo dele. */
  function winOverlayTook(f: PadFrame): boolean {
    const winOv = ctx.$<HTMLElement & { hidden: boolean }>('#win-overlay');
    if (!winOv || winOv.hidden) return false;
    if (f.startEdge) { const b = ctx.$<HTMLElement>('#btn-again'); if (b) b.click(); }
    return true;
  }

  /** Menu inicial: o pad navega, e num jogo de vários só o J1 escolhe. */
  function steerTitle(f: PadFrame): void {
    const k = f.navKeys(true);
    if (!anyIntent(k)) return;
    if (ctx.getNumPlayers() > 1 && f.owner > 0) { ctx.srSay(t('sr.title.waitP1')); return; } // só o J1 escolhe
    ctx.navTitle(k); // menu inicial navegável pelo pad
  }

  /** Cartão de pausa: o START retoma, e o direcional navega o diálogo partilhado ou o menu do próprio assento. */
  function steerPause(f: PadFrame): void {
    if (f.pauseEdge) { ctx.retomar(); return; } // START retoma
    const k = f.navKeys();
    if (!anyIntent(k)) return;
    const dlg = ctx.sharedDialogOpen();
    if (dlg) { ctx.navDialog(dlg, k); return; }
    const pi = f.owner < 0 ? 0 : f.owner;
    const menu = ctx.getPauseMenu(pi);
    if (menu && !menu.hidden) ctx.navPause(menu, pi, k);
  }

  /** Atribuição POR ORDEM DE AÇÃO: qualquer botão associa -> 1º controle a agir -> 1º jogador sem pad. */
  function takeSeat(f: PadFrame): void {
    const anyEdge = f.edge('action2') || f.edge('action1') || f.edge('action4') || f.edge('action3') || f.startEdge
      || f.edge('left') || f.edge('right') || f.edge('up') || f.edge('down');
    if (!anyEdge) return;
    const waitI = f.players.findIndex((p) => p && p.waiting);
    const free = waitI >= 0 ? waitI : f.players.findIndex((p) => p && p.pad < 0 && !p.quit);
    if (free < 0) { ctx.joinPlayer(f.gi); return; }
    const seated = f.players[free]!;
    seated.pad = f.gi;
    if (seated.waiting) { seated.waiting = false; ctx.clearWaitingBadge(free); }
    ctx.srSay(t('sr.pad.assigned', { n: free + 1 }));
  }

  /**
   * A METADE QUE APERTA da porta única (ADR-0223): toda posição que DESCEU neste quadro vai ao controle virtual,
   * com o carimbo `gamepad` e o assento deste controle. Devolve as que chegaram ao JOGO — a resposta do controle,
   * que é o que separa uma pressão de jogo de uma que um menu levou.
   *
   * ⚠️ As OITO posições e não as seis com aresta: quem tem aresta é um subconjunto (`EDGE_BY_ACTION`), e cima e
   * baixo sempre andaram por tecla segurada. Ao cartucho chegam as oito.
   */
  function pressWhatWentDown(f: PadFrame): ReadonlySet<ActionKey> {
    const reached = new Set<ActionKey>();
    for (const act of PAD_POSITIONS) if (f.edge(act) && ctx.press(act, 'gamepad', f.owner)) reached.add(act);
    return reached;
  }

  /**
   * A METADE QUE SOLTA, e ela é INCONDICIONAL de propósito (ADR-0223). A pressão só nasce no ramo de JOGO, mas o
   * dedo sai do botão onde quiser — uma criança que abre a pausa com o pulo premido deixaria a tecla segurada para
   * sempre se a soltura dependesse do ramo. O controle ignora a soltura de uma pressão que o jogo nunca ouviu, que
   * é exactamente a memória que ele existe para ter.
   *
   * 📌 O pad é o único transporte que lê ESTADO por quadro em vez de receber eventos, logo a soltura não lhe chega:
   * calcula-se contra o quadro anterior.
   */
  function releaseWhatCameUp(f: PadFrame): void {
    if (f.owner < 0) return; // controle sem assento nunca apertou nada
    for (const act of PAD_POSITIONS) if (f.released(act)) ctx.release(act, 'gamepad', f.owner);
  }

  /** O jogo a sério: o START pausa, o modal come o direcional, e o resto vira bandeira de acção. */
  function playRound(f: PadFrame, p: GamepadPlayer): void {
    if (f.pauseEdge) { ctx.pausar(); ctx.setPauseActor(f.owner); return; } // START pausa (todos pausam; cada tela navega a sua)
    if (ctx.hasModal(f.owner)) { // o pad navega o modal do PRÓPRIO jogador (o jogo dos outros segue)
      // A ORDEM é a do original: esquerda, direita, cima, baixo, confirmar, apagar. O que saiu foi o
      // SIGNIFICADO — o ±1/±3 da grade e o desvio de Braille, que agora são decisão do jogo.
      const intent: ModalIntent | null =
        f.edge('left') ? 'left' : f.edge('right') ? 'right'
        : f.edge('up') ? 'up' : f.edge('down') ? 'down'
        : f.edge('action2') ? 'confirm' : f.edge('action3') ? 'erase' : null;
      if (intent) ctx.modalInput(f.owner, intent);
      return;
    }
    // A tabela e a guarda do Fácil vêm de input/edges.ts, as MESMAS que keydown e touch usam. Antes eram
    // seis `if` à mão aqui, seis lá e seis no toque — e o do toque tinha esquecido o `!p.easy`.
    // 🔴 A PORTA ÚNICA PRIMEIRO (ADR-0223): a posição vai ao controle virtual, que segura a tecla da criança com o
    // carimbo `gamepad` e entrega o comando ao cartucho. Só depois disto é que se levanta aresta — e só para uma
    // pressão que CHEGOU ao jogo, que é a resposta do controle. Antes, o pad não passava por porta nenhuma.
    // ⚠️ As oito posições, e não as seis com aresta: quem tem aresta é um subconjunto (`EDGE_BY_ACTION`), e as
    // outras duas — cima e baixo — sempre andaram por tecla segurada. Ao cartucho chegam as oito.
    const reachedPlay = pressWhatWentDown(f);
    let hasAnyEdge = false;
    for (const [act, flag] of EDGE_BY_ACTION) {
      if (!reachedPlay.has(act)) continue;
      hasAnyEdge = true;
      if (edgeAllowed(act, p.easy)) p[flag] = true;
    }
    // 📌 A ARESTA DO CONTROLE, e ela conta MESMO QUANDO O FÁCIL A FILTRA (ADR-0113 cláusula 4): a
    // criança carregou no botão — que a regra do Modo Fácil não levante a bandeira do jogo não muda
    // o facto de o aparelho em uso ser este. Ler a mesma condição do `p[flag]` faria uma criança em
    // Modo Fácil ficar com a alternância do teclado enquanto joga no controle.
    // ⚠️ E É AQUI, no ramo de JOGO, e não nos de menu: `naBarraDe`, o título e a pausa são navegação, e
    // a pergunta que isto alimenta — que alternância vale AGORA — é sobre jogar.
    if (hasAnyEdge) ctx.playerEdge(f.owner, 'gamepad');
  }

  /** Com o mundo a andar: a barra rápida primeiro, depois o assento, a tela abandonada, e por fim o jogo. */
  function steerGame(f: PadFrame): void {
    // ===================== O MODO `accessibility` (ADR-0044, item 7) =====================
    // Com o jogo ANDANDO, o direcional deste jogador dirige a BARRA RÁPIDA e não o personagem. Vem antes
    // de tudo o que é de jogo, porque enquanto o modo está ligado nada mais deste controle é de jogo.
    //
    // Both exits arrive together: `especial` (action 3) is the project's BACK — the east button: B on Xbox, ◯ on
    // PlayStation, A on Nintendo — and `startEdge` is the button that opens the pause, where this was entered. A child
    // who is lost goes back the way they came, one who knows the game tries the usual back; both work.
    if (f.owner >= 0 && ctx.naBarraDe(f.owner)) {
      const k = f.navKeys();
      if (f.startEdge || anyIntent(k)) ctx.navBar(f.owner, k, !!f.startEdge);
      return;
    }
    if (f.owner < 0) { takeSeat(f); return; }
    const p = f.players[f.owner]!;
    if (p.quit) { if (f.startEdge) ctx.respawnPlayer(f.owner); return; } // tela abandonada -> recomeça SÓ ela
    playRound(f, p);
  }

  function pollPads(): void {
    if (wizard.estado()) return; // durante o wizard, os pads falam só com ele
    const pads = ctx.getGamepads();
    if (!pads) return;
    if (ctx.isAttractActive()) {
      for (const gp of pads) { if (gp && gp.buttons.some((b) => b && b.pressed)) { ctx.stopAttract(); return; } } // botão de pad encerra a demo
      return;
    }
    for (const gp of pads) {
      if (!gp) continue;
      // controle fora do padrão (DirectInput) SEM mapa salvo apertou algo -> pausa geral + wizard direto
      if (wizardTookOver(gp)) return;
      // ⚠️ `getPlayers()` É LIDO AQUI, um por controle, e não uma vez antes do laço: o ramo do assento ESCREVE na lista
      // (`players[free].pad = gi`), e lê-la uma vez só mudaria o que o controle seguinte vê.
      const f = readPad(gp, ctx.getPlayers());
      releaseWhatCameUp(f); // antes de todo ramo: o dedo sai do botão onde quiser (ADR-0223)
      if (ctx.isTouchMode() && (f.cur.left || f.cur.right || f.cur.up || f.cur.down
        || f.cur.action2 || f.cur.action1 || f.cur.action4 || f.cur.action3 || f.cur._start)) {
        ctx.hideTouchControls(); // botão físico usado -> some o gamepad virtual (mesma regra do teclado)
      }
      if (winOverlayTook(f)) continue;
      // Os três destinos abaixo pediam a FASE; hoje pedem os fatos. O título é derivado por exclusão de propósito:
      // numa cena que este módulo não conheça (um mapa, uma tela de resultados), o controle deve navegar como no
      // título — que é o comportamento seguro — em vez de não fazer nada.
      const running = ctx.mundoRodando(), paused = ctx.menuDePausa();
      if (!running && !paused) { steerTitle(f); continue; }
      if (paused) { steerPause(f); continue; }
      if (running) steerGame(f);
    }
  }

  return { pollPads, openPadWiz, openPadWizFor, closePadWiz, padWizTick, padMapFor, getPadWiz: () => wizard.estado() };
}
