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
 *   · `toque: 9` — `TOUCH_DEFAULT` (input/devices) nomeia nove slots, e são nove desde sempre.
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
export const LUGARES = Object.freeze({ gamepad: 17, toque: 9, teclado: ACTIONS.length });

/** Como se descobre que cada transporte está aqui AGORA. Injetado: nenhuma destas perguntas é pura. */
export interface Disponibilidade {
  gamepad: () => boolean;
  toque: () => boolean;
  teclado: () => boolean;
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
export function transportesPadrao(d: Disponibilidade): Transport[] {
  return [
    { id: 'gamepad', slots: LUGARES.gamepad, available: d.gamepad },
    { id: 'teclado', slots: LUGARES.teclado, available: d.teclado },
    { id: 'toque', slots: LUGARES.toque, available: d.toque },
  ];
}

/** Um transporte, como ele se declara. Zero significado: quantos lugares, e se está aqui agora. */
export interface Transport {
  /** Identificador estável, para preferências salvas. Nunca chega a uma pessoa. */
  readonly id: string;
  /** Quantos lugares ATRIBUÍVEIS. É o número que a aritmética da garantia usa. */
  readonly slots: number;
  /**
   * Está disponível NESTE aparelho, AGORA? Função e não valor: um controle é ligado no meio da partida, e
   * uma tela de toque aparece quando a criança gira o tablet.
   */
  readonly available: () => boolean;
}

/** Este transporte carrega este conjunto de ações? Aritmética, como o ADR-0079 §3 a descreve. */
export function carries(t: Transport, acoes: readonly Action[]): boolean {
  return t.slots >= acoes.length;
}

/**
 * Os transportes DISPONÍVEIS que carregam este conjunto.
 *
 * ⚠️ Disponibilidade e capacidade são conferidas nesta ordem de propósito: um transporte que caberia mas não
 * está ligado não é resposta para uma criança que está à frente do aparelho agora.
 */
export function carriedBy(lista: readonly Transport[], acoes: readonly Action[]): Transport[] {
  return lista.filter((t) => t.available() && carries(t, acoes));
}

/**
 * A garantia do ADR-0079 §3, como pergunta de sim ou não.
 *
 * ⚠️ CONJUNTO VAZIO DE AÇÕES DEVOLVE `false`, e não `true` por vacuidade. Um jogo que não declara ação
 * nenhuma não é um jogo que qualquer transporte serve — é um jogo que ninguém consegue jogar, e
 * `actionSetProblems` já o reprova. Devolver `true` aqui esconderia esse defeito atrás desta função.
 */
export function reachable(lista: readonly Transport[], acoes: readonly Action[]): boolean {
  return acoes.length > 0 && carriedBy(lista, acoes).length > 0;
}

/** O que a tela de seleção precisa dizer, e o que ela precisa saber para o dizer. */
export interface Alcance {
  /** Verdadeiro = pelo menos um transporte disponível carrega o conjunto. */
  readonly ok: boolean;
  /** Quantas ações o jogo pede. */
  readonly pedidas: number;
  /** Os que serviriam se estivessem ligados — a informação acionável: «ligue um controle». */
  readonly serviriamSeLigados: readonly string[];
  /** Os disponíveis que NÃO cabem, com quantos lugares têm. Para a frase dizer o número. */
  readonly curtos: readonly { readonly id: string; readonly slots: number }[];
}

/**
 * Mede o alcance ANTES de a criança começar.
 *
 * ⚠️ Devolve DADO e não texto. A frase é da interface e tem de passar por `t()`; devolver português daqui
 * repetiria o defeito que o `PADWIZ_STEPS` acabou de deixar de cometer.
 */
export function alcance(lista: readonly Transport[], acoes: readonly Action[]): Alcance {
  const disponiveis = lista.filter((t) => t.available());
  return {
    ok: reachable(lista, acoes),
    pedidas: acoes.length,
    serviriamSeLigados: lista.filter((t) => !t.available() && carries(t, acoes)).map((t) => t.id),
    curtos: disponiveis.filter((t) => !carries(t, acoes)).map((t) => ({ id: t.id, slots: t.slots })),
  };
}
