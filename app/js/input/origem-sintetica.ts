// SPDX-License-Identifier: AGPL-3.0-or-later
// input/origem-sintetica.ts — QUEM DESPACHOU ESTA TECLA, quando não foi um dedo num teclado (ADR-0109).
//
// ========================= O PONTO DIFÍCIL DA ARESTA, E ELE ESTAVA NOMEADO =========================
// O crivo `tests/origem-da-tecla` carrega esta frase na entrada do `input/keydown` desde que o
// estrangulamento começou: «a webcam despacha `KeyboardEvent` SINTÉTICO, entra pelo `keydown` e seria
// carimbada `teclado` — a erasão a voltar pela porta da frente». O `ui/webcam` constrói um `KeyboardEvent` e
// despacha-o na janela (`ui/webcam.ts`, `eyeSet`), e do lado de lá ele é indistinguível de uma tecla premida.
//
// `isTrusted` distingue PREMIDA de DESPACHADA — é a única propriedade que um script não consegue forjar — mas
// não diz QUAL transporte assistido despachou. Isso tem de chegar DECLARADO, e é o que este módulo é.
//
// ⚠️ POR QUE O CARIMBO VIAJA NO EVENTO, e não num «qual é a fonte sintética agora?» injectado. A resposta
// injectada é um estado GLOBAL, e a entrada não é global: uma criança que joga por olhar e tem um adulto a
// carregar numa tecla ao lado produz as duas arestas no mesmo instante, e o estado global carimbaria as duas
// como olhar. O evento não se confunde consigo próprio — a origem anda com a aresta a que pertence, que é a
// mesma razão por que o `origemDaTecla` é um mapa por CÓDIGO e não um campo só.
//
// 📌 E é aditivo por construção: um evento sem carimbo continua a funcionar. Foi isso que permitiu migrar os
// escritores um a um sem nenhum commit vermelho pelo meio.

import type { Transporte } from './transporte-em-uso.js';
import { ehTransporte } from './transporte-em-uso.js';

/**
 * A propriedade pendurada no evento.
 *
 * 📌 Prefixada e feia de propósito: é um expando num objecto que não é nosso, e um nome curto («origem»)
 * podia colidir com o de outra biblioteca sem que nada o dissesse.
 */
export const CHAVE_DE_ORIGEM = '__vpOrigem';

/**
 * O mínimo que este módulo lê de um evento de tecla — ESTRUTURAL, para um `KeyboardEvent` real e um duplo de
 * teste servirem os dois.
 *
 * ⚠️ `isTrusted` é OPCIONAL, e a ausência dele não é o mesmo que `false` por acaso: um duplo que não o declara
 * está a dizer «não afirmei nada sobre isto», e a resposta certa a isso é `undefined` e não `'teclado'`. É a
 * mesma regra do `origemDe` do `input/state`, aplicada uma camada acima.
 */
export interface EventoDeTeclaLike {
  readonly isTrusted?: boolean;
}

/**
 * DECLARA que este evento veio daquele aparelho. Devolve o próprio evento, para o despacho ficar numa linha.
 *
 * ⚠️ Carimba-se ANTES de despachar. Depois de `dispatchEvent` os ouvintes já correram, e o carimbo chegaria
 * a um evento que ninguém mais vai ler.
 */
export function carimbarOrigem<T extends object>(ev: T, origem: Transporte): T {
  (ev as unknown as Record<string, unknown>)[CHAVE_DE_ORIGEM] = origem;
  return ev;
}

/**
 * QUEM PRODUZIU ESTE EVENTO? `undefined` quando não se sabe.
 *
 * A regra inteira, em três linhas e por esta ordem:
 *
 *   1. **Carimbo válido ganha.** Uma declaração explícita vence sempre uma inferência — inverter isto faria
 *      um evento REAL que alguém reatribuiu (um pedal, um interruptor de sopro que emite teclas de verdade)
 *      ser lido como teclado, apagando exactamente a informação que quem carimbou se deu ao trabalho de pôr.
 *   2. **Sem carimbo mas de confiança → `'teclado'`.** É o que `isTrusted` significa: o navegador viu a
 *      pessoa carregar. É a única inferência que este módulo faz, e fá-la sobre a propriedade que não se forja.
 *   3. **Sem carimbo e sem confiança → `undefined`.** Um evento sintético que ninguém assinou. Depois desta
 *      migração nada nesta engine produz um; quem o produz é código de fora, e código de fora não declarou.
 *      ⚠️ Devolver `'teclado'` aqui seria a erasão a voltar por outra porta, que é o defeito que o ADR-0109
 *      inteiro existe para fechar — e seria pior do que a erasão original, porque teria a forma de uma
 *      resposta.
 */
export function origemDoEvento(ev: EventoDeTeclaLike): Transporte | undefined {
  const declarada = (ev as unknown as Record<string, unknown>)[CHAVE_DE_ORIGEM];
  if (ehTransporte(declarada)) return declarada;
  return ev.isTrusted ? 'teclado' : undefined;
}
