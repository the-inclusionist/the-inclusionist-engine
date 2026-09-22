// SPDX-License-Identifier: AGPL-3.0-or-later
// input/state.ts — ESTADO de input em runtime + query genérica, compartilhado pelos handlers (que ficam no
// game.js e mutam estes objetos IN-PLACE): teclas seguradas (keys), estado de gamepad por controle
// (padCur/padPrevAct/padPrevStart) e a zona morta do analógico (PAD_DEAD). held(pl,act) = o jogador está
// segurando a ação, por teclado (pl.ctrl) OU pelo gamepad associado (pl.pad). Módulo-folha, ZERO deps. (Fase 2.22)

// Teclas físicas seguradas AGORA (KeyboardEvent.code). Mutada por keydown/keyup no game.js.
import type { ControlledPlayer } from '../core/entity.js';
import type { Action } from '../core/actions.js';
// ⚠️ O cabeçalho deste módulo dizia «ZERO deps», e ele já tinha DUAS de tipo (`ControlledPlayer`, `Action`) —
// a frase queria dizer «nada em tempo de execução», que continua verdade: os três imports são `type` e
// desaparecem no build. A terceira entra pela mesma razão que as outras duas: o vocabulário mora com quem
// tem as REGRAS sobre ele (`input/transport-in-use`), e repeti-lo aqui seria a segunda cópia de uma união.
import {
  PADRAO, afterEdge, enableAssisted, disableAssisted,
  type TransportName, type InputState,
} from './transport-in-use.js';

export const keys = new Set<string>();

/**
 * A ORIGEM DE CADA TECLA SEGURADA — código → aparelho que a produziu (ADR-0109).
 *
 * ⚠️ ESTE MAPA EXISTE PORQUE `keys` APAGA A ORIGEM À PORTA, e foi essa erasão que deixou o §C da issue #114
 * por construir durante dois meses: o toque escreve códigos aqui dentro (`press()` faz
 * `heldKeys.add(codeFor(act))`) e a webcam despacha `KeyboardEvent` sintético, então quando o `held()`
 * responde já não há como saber QUEM carregou. O único transporte que sobrevivia identificável era o
 * gamepad, e só porque passa por `padCur` em vez do conjunto.
 *
 * ⚠️ CAMPO NOVO AO LADO DO VELHO, sincronizado num ponto só (`markKey`/`releaseKey`), com os leitores a
 * migrar um a um — é a forma que este repositório já usou no `p.visual` ao lado do `p.viz` (#104), e a razão
 * é a mesma: uma troca de uma vez não tem estado verde onde parar, e isto é a espinha da entrada.
 *
 * 📌 Um código SEM entrada aqui não é um erro de dados — é uma tecla que entrou por um escritor que ainda não
 * migrou. `sourceOf` devolve `undefined` e quem pergunta decide; ver a nota lá.
 */
export const keySource = new Map<string, TransportName>();

/**
 * Uma tecla FOI SEGURADA, e sabe-se por quem. É o único sítio que escreve nos dois.
 *
 * ⚠️ OS DOIS JUNTOS OU NENHUM: enquanto forem duas estruturas, elas podem divergir, e uma divergência aqui é
 * silenciosa — o jogo continua a andar e só a alternância fica errada. Por isso não há `keys.add` público
 * neste módulo: quem escreve, escreve por aqui.
 */
export function markKey(code: string, origem: TransportName): void {
  keys.add(code);
  keySource.set(code, origem);
}

/**
 * A tecla foi segurada e NÃO SE SABE por quem. A porta estreita, e ela é estreita de propósito.
 *
 * ⚠️ POR QUE UMA FUNÇÃO COM OUTRO NOME E NÃO UM SEGUNDO PARÂMETRO OPCIONAL. `markKey(code)` com a origem
 * omitida é o que se escreve quando não se pensou; `markKeyWithoutSource(code)` é o que se escreve quando se
 * pensou e a resposta é «não sei». O tipo não distingue as duas, mas o nome distingue — e é o nome que
 * aparece na revisão. Um parâmetro esquecido não se lê; uma função assim chamada lê-se de longe.
 *
 * ⚠️ E O `delete` É A METADE QUE IMPORTA, não o `add`. Sem ele, uma tecla premida de novo por uma fonte
 * desconhecida HERDAVA a origem da vez anterior: a criança joga por olhar, larga a tecla, um script de fora
 * despacha o mesmo código, e a alternância continua a responder «olhos» a uma aresta que já não é dela. Um
 * mapa que guarda a resposta certa de ontem é pior do que um que não guarda nada.
 *
 * 📌 Hoje há UM chamador — o `input/keydown`, para o evento sintético que ninguém assinou. Depois desta
 * migração nada nesta engine produz um; quem produz é código de consumidor, e é para ele que esta porta fica
 * aberta. Fechá-la faria a tecla dele simplesmente não funcionar, o que é uma quebra pior do que não saber.
 */
export function markKeyWithoutSource(code: string): void {
  keys.add(code);
  keySource.delete(code);
}

/** A outra metade. Solta nos dois, pela mesma razão. */
export function releaseKey(code: string): void {
  keys.delete(code);
  keySource.delete(code);
}

/** Solta TUDO — o `blur` da janela. Os dois, ou o mapa fica a descrever teclas que já ninguém segura. */
export function releaseAllKeys(): void {
  keys.clear();
  keySource.clear();
}

/**
 * Quem produziu esta tecla? `undefined` quando não se sabe.
 *
 * ⚠️ `undefined` E NÃO UM PADRÃO. Um padrão `'teclado'` faria a erasão voltar por outra porta: uma tecla do
 * toque que entrasse por um escritor não migrado seria lida como teclado, a alternância desligava-se, e nada
 * o diria. Não saber é uma resposta; fingir que se sabe não é.
 */
export function sourceOf(code: string): TransportName | undefined {
  return keySource.get(code);
}

// ===================== O TRANSPORTE EM USO, POR JOGADOR (ADR-0109 · ADR-0113) =====================
//
// ⚠️ AQUI E NÃO NO `PlayerBase`, e a escolha é medida. O autómato responde «que aparelho está a produzir as
// arestas deste jogador» — isso é estado de ENTRADA, e a entrada já guarda estado por jogador neste módulo
// exactamente com esta forma: o `padCur` logo abaixo é um `Record<number, …>`. Pô-lo no `PlayerBase` faria
// dele parte do CONTRATO, e trezentos cartuchos passariam a declarar um campo sobre o qual não decidem nada.
//
// 📌 O que o jogador CARREGA é a alternância resolvida (`toggleMove`), que é o que a física lê. Este mapa é
// o que está a montante dela: com ele e com o `input/latch-store`, a resposta do ADR-0113 fica completa.
const entradaPorJogador: Record<number, InputState> = {};

/**
 * O ESTADO DA ENTRADA DESTE JOGADOR. Nunca `undefined`: quem nunca produziu uma aresta está no PADRÃO.
 *
 * ⚠️ `PADRAO` E NÃO `undefined`, pela mesma razão que o `sourceOf` faz o contrário: ali «não sei» é uma
 * resposta honesta sobre uma tecla que já existe; aqui a pergunta é sobre um JOGADOR, e um jogador que
 * ainda não tocou em nada está mesmo no teclado sem assistida — que é o que `PADRAO` diz.
 */
export function inputOf(jogador: number): InputState {
  return entradaPorJogador[jogador] ?? PADRAO;
}

/**
 * UMA ARESTA DESTE JOGADOR CHEGOU, com a sua origem.
 *
 * 📌 O `afterEdge` devolve o MESMO objecto quando nada muda, então guardar de volta não aloca por quadro.
 * ⚠️ E uma aresta de um transporte assistido NÃO o habilita — essa regra vive no `afterEdge` e a razão
 * está lá: um falso positivo da webcam trancaria a alternância de toda a gente sem ninguém ter pedido.
 */
export function playerEdge(jogador: number, origem: TransportName): void {
  entradaPorJogador[jogador] = afterEdge(inputOf(jogador), origem);
}

/** Habilitar a assistida é um ACTO EXPLÍCITO (ADR-0109 regra 4), e por isso tem porta própria. */
export function enableAssistedFor(jogador: number): void {
  entradaPorJogador[jogador] = enableAssisted(inputOf(jogador));
}

export function disableAssistedFor(jogador: number): void {
  entradaPorJogador[jogador] = disableAssisted(inputOf(jogador));
}

/**
 * ⚠️ ESQUECER É UMA PORTA SEPARADA, E O `releaseAllKeys` NÃO A CHAMA — de propósito.
 *
 * O `blur` da janela solta as teclas porque elas deixaram mesmo de estar premidas. Mas a criança não trocou
 * de aparelho por mudar de separador: zerar o transporte em uso ali devolveria toda a gente ao teclado, e
 * quem joga por olhar perderia a alternância no meio da partida sem nada o dizer. Existe para o fim de uma
 * PARTIDA, onde a pergunta se põe de novo.
 */
export function forgetInputs(): void {
  for (const k of Object.keys(entradaPorJogador)) delete entradaPorJogador[Number(k)];
}

// Gamepad (B3/L1): padCur[gi] = ações seguradas neste frame; padPrevAct/padPrevStart = borda do frame anterior.
// Associação pad↔jogador vive em p.pad. Mutados IN-PLACE por pollPads no game.js.
type PadState = Record<string, boolean>;
export const padCur: Record<number, PadState> = {};
export const padPrevAct: Record<number, PadState> = {};
export const padPrevStart: Record<number, boolean> = {};
export const PAD_DEAD = 0.5; // zona morta = primeira METADE do curso do analógico (ergonomia — José 2026-07-02)

// Contrato mínimo do jogador que o `held` precisa — DERIVADO de core/entity. `ControlledPlayer` porque o
// `held` só é chamado durante a partida, quando o assignControls já rodou e `ctrl` não é mais `null`.
type HeldPlayer = Pick<ControlledPlayer, 'ctrl' | 'pad'>;

// Jogador está segurando a ação? teclado (algum code do esquema pl.ctrl) OU o gamepad associado (pl.pad).
// ⚠️ `?? []` e não `pl.ctrl[act]` cru: desde a issue #118 uma posição que o teclado NÃO ALCANÇA é um `null`
// declarado — num teclado partido por quatro não há lugar físico para ombros e gatilhos. Segurar uma ação
// que o teclado não alcança é `false`, e o gamepad continua a ser perguntado logo a seguir: quem tem pad
// alcança o que o teclado dele não alcança, que é o ponto de haver dois transportes.
export const held = (pl: HeldPlayer, act: Action): boolean =>
  (pl.ctrl[act] ?? []).some((k) => keys.has(k)) || (pl.pad >= 0 && !!padCur[pl.pad]?.[act]);
