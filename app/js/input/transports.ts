// SPDX-License-Identifier: AGPL-3.0-or-later
// input/transports — O REGISTRO DE TRANSPORTES (ADR-0079). Módulo-folha: só tipos e aritmética.
//
// ========================= O QUE UM TRANSPORTE É =========================
// Uma forma de alcançar as ações, e nada sobre significado. Ele declara o que OFERECE FISICAMENTE — quantos
// lugares atribuíveis tem — e o jogador atribui a eles as ações do jogo. `TOUCH_DEFAULT` já era uma instância
// disto antes de o modelo existir: uma atribuição padrão que a criança pode mudar.
//
// ========================= A GARANTIA MUDOU DE FORMA =========================
// ⚠️ NÃO é «todo transporte alcança toda ação». É: **para os transportes disponíveis a esta criança, PELO
// MENOS UM carrega o conjunto de ações deste jogo.** A diferença é o que permite um transporte estreito
// existir — um acionador de dois toques, um piscar — sem que ele reprove o produto inteiro.
//
// ========================= E UM TRANSPORTE NUNCA REMOVE OUTRO =========================
// Escolher o rato não desliga o teclado, o controle nem o toque. A engine OFERECE; quem escolhe é a criança
// (ou quem a acompanha). Um método que exige coordenação fina não é exclusão enquanto os outros existirem —
// a exclusão seria uma lista curta, não um item exigente numa lista longa.
//
// ========================= O QUE ESTE MÓDULO EXISTE PARA IMPEDIR =========================
// ⚠️ Um jogo que precisa de doze ações e um transporte de nove lugares é uma combinação REAL — o controle de
// tela tem nove slots desde sempre e o conjunto de ações passou a catorze em 2026-09-06. A resposta honesta é
// UMA FRASE ANTES DE COMEÇAR, e não meia tela jogável: a criança que descobre no meio que não consegue
// alcançar uma ação conclui que o jogo está partido, e ela não tem como saber que não está.

import { ACTIONS, type Action } from '../core/actions.js';

/**
 * QUANTOS LUGARES CADA TRANSPORTE REAL TEM, e de onde cada número vem. Estavam medidos e viviam só no teste;
 * um número que só existe num teste não chega a criança nenhuma.
 *
 *   · `gamepad: 17` — a Gamepad API «standard» declara dezassete botões. Não é escolha nossa.
 *   · `toque: 13` — `TOUCH_DEFAULT` (input/devices) nomeia treze slots: eram nove até os quatro ombros do ADR-0160.
 *   · `teclado: ACTIONS.length` — ⚠️ e este é o que precisou de decisão.
 *
 * ⚠️ O NÚMERO DO TECLADO NÃO É O NÚMERO DE TECLAS, e também não é o número de ligações do esquema atual. Não
 * é o de teclas porque cem teclas não são cem lugares que uma criança encontra e lembra; não é o do esquema
 * porque o esquema cresce, e o limite passaria a ser a configuração e não o aparelho.
 *
 * É `ACTIONS.length` porque o que limita um teclado, na prática deste produto, é O VOCABULÁRIO QUE A ENGINE
 * SABE NOMEAR: um transporte que cobre todas as posições que existem não tem como ser o curto. Derivado e não
 * escrito à mão de propósito — quando o vocabulário crescer (foi de nove para catorze em 2026-09-06), este
 * número cresce com ele e nunca passa a mentir.
 */
export const SLOTS = Object.freeze({ gamepad: 17, toque: 13, teclado: ACTIONS.length });

/**
 * QUANTAS POSIÇÕES O CONTROLE DE TELA SEGURA AO MESMO TEMPO. Dois, e é uma DECLARAÇÃO (ADR-0104 §B).
 *
 * ⚠️ E A DECISÃO É NÃO PERGUNTAR AO APARELHO. O `navigator.maxTouchPoints` existe, responde depressa, e
 * MENTE — mente para cima: muitos aparelhos anunciam cinco e reconhecem dois. Um modelo assente nele falha
 * exactamente no telemóvel barato da escola pública, que é o pilar 1 deste projeto, e falha em silêncio: a
 * criança tenta correr e pular ao mesmo tempo, não acontece nada, e ela conclui que o jogo está partido.
 *
 * Um piso declarado não pode errar para cima. Ele erra para baixo — um aparelho que segurava três fica
 * servido por dois —, e esse erro tem conserto: a opção do terceiro botão, PROVADA POR TESTE, porque um
 * gesto real é a única evidência que um aparelho não consegue falsificar. Nada é recusado e nada é assumido.
 *
 * ⚠️ NÃO É UM REGISTO DE TETOS POR TRANSPORTE, e o ADR diz isso em `more-information`: só o toque tem número
 * declarado. O `holds` do `Transport` é opcional justamente por isso — ausente significa «não há tecto
 * conhecido», não «segura uma». Um registo de tetos para teclado e controle é uma mudança maior, e nada
 * precisa dela hoje.
 */
const HOLDS_TOUCH = 2;

/** Como se descobre que cada transporte está aqui AGORA. Injetado: nenhuma destas perguntas é pura. */
export interface Availability {
  gamepad: () => boolean;
  touch: () => boolean;
  keyboard: () => boolean;
  /**
   * Há um RATO aqui? (ADR-0112)
   *
   * ⚠️ ELE NÃO É UM TRANSPORTE À PARTE, e é por isso que entra como uma pergunta e não como uma quarta linha
   * do `defaultTransports`: um rato sozinho não carrega as catorze posições. Ele é o SINAL CONTÍNUO ao lado
   * do teclado — a frase do Dev, «no caso do teclado, o sinal contínuo passa a ser o mouse» —, e é o que dá
   * fundação aos transportes 8 e 9 do ADR-0074, que aquele registo declarava como não tendo nenhuma.
   */
  mouse: () => boolean;
}

/**
 * Os três transportes que esta engine sabe oferecer hoje.
 *
 * ⚠️ A DETECÇÃO DO TECLADO É IMPRECISA E ISSO É ACEITÁVEL — mas só porque a tela que consome isto INFORMA em
 * vez de RECUSAR. Não há API que diga «há um teclado físico ligado»; o que o projeto já usa para a mesma
 * pergunta é `pointer:coarse && hover:none` (o `isCoarsePointer` do `game/session`), e um tablet COM teclado
 * responde «toque» a isso. Se a tela barrasse, esse tablet levaria uma recusa falsa num jogo que ele joga.
 * Como ela apenas diz o que falta e deixa continuar, o erro custa uma frase a mais e nunca uma porta fechada.
 */
export function defaultTransports(d: Availability): Transport[] {
  return [
    // ⚠️ O GAMEPAD NÃO DECLARA PONTEIRO, e a ausência é medida e não esquecimento: o stick tem o sinal
    // contínuo e a engine deita-o fora na fonte (`PAD_DEAD = 0.5`, `PadState = Record<string, boolean>`).
    // Ligá-lo ao ponteiro é possível e traz de volta uma pergunta que o ADR-0112 já deixou nomeada — metade
    // do curso morta é ergonomia certa para um BOTÃO e errada para um CURSOR.
    { id: 'gamepad', slots: SLOTS.gamepad, available: d.gamepad },
    // O teclado aponta QUANDO HÁ RATO — a cláusula do Dev, e a fundação dos transportes 8 e 9 do ADR-0074.
    { id: 'teclado', slots: SLOTS.teclado, available: d.keyboard, points: d.mouse },
    // O toque aponta por natureza: a superfície É o ponteiro, e é o mesmo dedo que carrega nos botões.
    { id: 'toque', slots: SLOTS.toque, holds: HOLDS_TOUCH, available: d.touch, points: d.touch },
  ];
}

/** Um transporte, como ele se declara. Zero significado: quantos lugares, e se está aqui agora. */
export interface Transport {
  /** Identificador estável, para preferências salvas. Nunca chega a uma pessoa. */
  readonly id: string;
  /** Quantos lugares ATRIBUÍVEIS. É o número que a aritmética da garantia usa. */
  readonly slots: number;
  /**
   * Quantas posições ele SEGURA AO MESMO TEMPO, quando isso é conhecido. Eixo diferente dos `slots`: o
   * controle de tela tem nove lugares e segura dois.
   *
   * ⚠️ AUSENTE SIGNIFICA «NÃO HÁ TECTO CONHECIDO», e não «segura uma». Hoje só o toque declara um número
   * (`HOLDS_TOUCH`), porque só sobre ele há decisão — ver a nota lá. Ler a ausência como zero faria todo
   * transporte sem número reprovar de repente, que é o oposto do que um campo opcional deve fazer.
   */
  readonly holds?: number;
  /**
   * Está disponível NESTE aparelho, AGORA? Função e não valor: um controle é ligado no meio da partida, e
   * uma tela de toque aparece quando a criança gira o tablet.
   */
  readonly available: () => boolean;
  /**
   * Este transporte oferece um PONTEIRO — posição contínua (ADR-0112)?
   *
   * ⚠️ FUNÇÃO E NÃO BOOLEANO, pela mesma razão escrita no `available` acima: um rato é ligado no meio da
   * partida, tal como um controle. Um valor fixo aqui responderia com o estado do arranque.
   *
   * ⚠️ AUSENTE SIGNIFICA «NÃO OFERECE», e aqui — ao contrário do `holds` — ler a ausência assim é o correcto:
   * o ponteiro é uma capacidade que se DECLARA, e um transporte que não a declara não a tem. O `holds` é o
   * oposto porque lá a ausência é «não há tecto conhecido», e lê-la como zero reprovaria todo o mundo.
   */
  readonly points?: () => boolean;
}

/** Este transporte carrega este conjunto de ações? Aritmética, como o ADR-0079 §3 a descreve. */
export function carries(t: Transport, actions: readonly Action[]): boolean {
  return t.slots >= actions.length;
}

/**
 * Este transporte SEGURA quantas o jogo pede ao mesmo tempo? (ADR-0104 §A.)
 *
 * ⚠️ TRANSPORTE SEM TECTO DECLARADO RESPONDE SIM, e a escolha é deliberada: o `holds` ausente quer dizer «não
 * medimos isto», e recusar por falta de medida transformaria uma ignorância em acusação — o teclado e o
 * controle passariam a reprovar todos os jogos por não terem número nenhum. Onde não há decisão, o modelo
 * cala; é o toque que tem decisão, e é só ele que pode reprovar aqui.
 */
export function holds(t: Transport, asked: number): boolean {
  return t.holds === undefined || t.holds >= asked;
}

/**
 * Os transportes DISPONÍVEIS que carregam este conjunto.
 *
 * ⚠️ Disponibilidade e capacidade são conferidas nesta ordem de propósito: um transporte que caberia mas não
 * está ligado não é resposta para uma criança que está à frente do aparelho agora.
 */
export function carriedBy(list: readonly Transport[], actions: readonly Action[]): Transport[] {
  return list.filter((t) => t.available() && carries(t, actions));
}

/**
 * A garantia do ADR-0079 §3, como pergunta de sim ou não.
 *
 * ⚠️ CONJUNTO VAZIO DE AÇÕES DEVOLVE `false`, e não `true` por vacuidade. Um jogo que não declara ação
 * nenhuma não é um jogo que qualquer transporte serve — é um jogo que ninguém consegue jogar, e
 * `actionSetProblems` já o reprova. Devolver `true` aqui esconderia esse defeito atrás desta função.
 */
export function reachable(list: readonly Transport[], actions: readonly Action[]): boolean {
  return actions.length > 0 && carriedBy(list, actions).length > 0;
}

/** O que a tela de seleção precisa dizer, e o que ela precisa saber para o dizer. */
export interface Reach {
  /**
   * Verdadeiro = pelo menos um transporte disponível carrega o conjunto **e segura quantas o jogo pede ao
   * mesmo tempo**.
   *
   * ⚠️ A SEGUNDA METADE DESTA FRASE É NOVA (ADR-0104), e é o conserto do ponto cego que ninguém tinha
   * nomeado: a plataforma declara nove ações, o toque tem nove lugares, o `ok` dizia sim — e correr, andar e
   * pular ao mesmo tempo são três dedos que um telemóvel de dois não tem. O `ok` afirmava «dá para jogar»
   * sobre um jogo que não dava, que é a pior coisa que este campo podia fazer.
   */
  readonly ok: boolean;
  /** Quantas ações o jogo pede. */
  readonly asked: number;
  /** Quantas ele pede SEGURAR ao mesmo tempo — o segundo eixo, e o que o `holdsAtOnce` declara. */
  readonly holdsAsked: number;
  /** Os que serviriam se estivessem ligados — a informação acionável: «ligue um controle». */
  readonly wouldServeIfOn: readonly string[];
  /** Os disponíveis que NÃO cabem, com quantos lugares têm. Para a frase dizer o número. */
  readonly short: readonly { readonly id: string; readonly slots: number }[];
  /**
   * Os disponíveis que CHEGAM às ações mas não seguram quantas o jogo pede de uma vez, com o tecto deles.
   *
   * É a terceira frase do cartão da #112, e ela precisa dos dois números: «o controle de tela segura dois
   * botões de cada vez e este jogo pede três». Sem o tecto, a frase diria que algo falta sem dizer o quê.
   */
  readonly cannotHold: readonly { readonly id: string; readonly holds: number }[];
  /** Este jogo declarou que precisa de PONTEIRO? (ADR-0112) */
  readonly needsPointer: boolean;
  /**
   * Os disponíveis que chegam às acções E seguram quantas o jogo pede, e falham SÓ por não apontarem.
   *
   * ⚠️ SÓ QUEM FALHA APENAS NISTO, pela mesma regra que o `naoSeguram` já segue: um transporte em duas listas
   * faria o cartão da #112 dizer dois problemas onde há um, e a criança leria dois motivos para a mesma
   * recusa. A lista é vazia quando o jogo não pede ponteiro — não «todos», porque nenhum falhou.
   */
  readonly cannotPoint: readonly string[];
}

/**
 * Mede o alcance ANTES de a criança começar.
 *
 * ⚠️ Devolve DADO e não texto. A frase é da interface e tem de passar por `t()`; devolver português daqui
 * repetiria o defeito que o `PADWIZ_STEPS` acabou de deixar de cometer.
 */
export function reach(
  list: readonly Transport[],
  actions: readonly Action[],
  askedHolds: number,
  wantsPointer = false,
): Reach {
  const availableNow = list.filter((t) => t.available());
  /**
   * ⚠️ PADRÃO `false` E NÃO PARÂMETRO OBRIGATÓRIO: os trezentos jogos que não desenham não podem sentir esta
   * mudança, e um quarto argumento exigido faria cada chamador existente decidir hoje uma coisa que não lhe
   * diz respeito.
   */
  const pointsIfNeeded = (t: Transport) => !wantsPointer || (!!t.points && t.points());
  // ⚠️ «Serve» passou a ser TRÊS coisas. Foi DUAS na #114 (o `ok` dizia sim a quem não segurava três dedos), e
  // é três desde o ADR-0112 — pela mesma razão das duas vezes: um `ok` verdadeiro sobre um jogo que a criança
  // não consegue jogar é a pior coisa que este campo pode fazer.
  const serve = (t: Transport) => carries(t, actions) && holds(t, askedHolds) && pointsIfNeeded(t);
  return {
    ok: actions.length > 0 && availableNow.some(serve),
    asked: actions.length,
    holdsAsked: askedHolds,
    needsPointer: wantsPointer,
    wouldServeIfOn: list.filter((t) => !t.available() && serve(t)).map((t) => t.id),
    short: availableNow.filter((t) => !carries(t, actions)).map((t) => ({ id: t.id, slots: t.slots })),
    cannotPoint: availableNow
      .filter((t) => carries(t, actions) && holds(t, askedHolds) && !pointsIfNeeded(t))
      .map((t) => t.id),
    // ⚠️ SÓ QUEM CHEGA, e não quem já reprovou por lugares. Um transporte que aparecesse nas duas listas
    // faria o cartão dizer duas coisas sobre o mesmo defeito, e a criança leria dois problemas onde há um.
    cannotHold: availableNow
      .filter((t) => carries(t, actions) && !holds(t, askedHolds))
      .map((t) => ({ id: t.id, holds: t.holds as number })),
  };
}
