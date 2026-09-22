// SPDX-License-Identifier: AGPL-3.0-or-later
// input/latch-store.ts — A ALTERNÂNCIA, LIDA E ESCRITA NO ARMAZENAMENTO (ADR-0113).
//
// ========================= O QUE ESTE MÓDULO É, E POR QUE É SEPARADO =========================
// O `input/latch-scope` é a REGRA e não toca em nada: recebe uma `LatchReading` já feita e responde.
// Este módulo é a única coisa que faltava entre ela e o mundo — quem vai ao armazenamento buscar os três
// valores que a regra pede, e quem grava o que a criança escolhe.
//
// 📌 SEPARADO DE PROPÓSITO, e não por arrumação: a regra é pura e tem gate próprio; misturar armazenamento
// dentro dela obrigaria todo caso da regra a montar um `localStorage` de mentira para afirmar uma coisa que
// não depende dele. É a mesma divisão que o `render/viz-axes` (modelo) e o `render/viz-setters` (escrita)
// já fazem neste repositório.
//
// ⚠️ E O QUE ELE NÃO FAZ: não sabe QUAL transporte está em uso. Isso é do `input/transporte-em-uso`, e chega
// aqui como argumento. Um módulo de armazenamento que adivinhasse o transporte escreveria a escolha de uma
// criança na chave de outro aparelho — em silêncio, que é o defeito que o ADR-0113 existe para evitar.
import {
  latchKey, legacyLatchKey, latchOf, latchIsOptional,
  type LatchReading,
} from './latch-scope.js';

/** O mínimo do `platform/storage` que isto precisa. Injectado, para o gate não precisar de um navegador. */
export interface LatchStore {
  /** ⚠️ O CRU, e não `getBool`. Ver `readTriState`. */
  get(chave: string, padrao?: null): string | null;
  set(chave: string, valor: string): void;
}

/**
 * TRÊS ESTADOS E NÃO DOIS: `true`, `false`, e NUNCA ESCRITO.
 *
 * 🔴 ESTA FUNÇÃO EXISTE PARA NÃO SE USAR `getBool`, e a diferença custa o ajuste de uma criança. O `getBool`
 * colapsa «nunca escrito» em `false`. Com ele, o `doTransporte` de uma criança que nunca mexeu neste aparelho
 * chegaria à regra como `false` — e a regra responde na PRIMEIRA linha que encontra um valor, logo devolveria
 * `false` e **nunca consultaria a chave legada**, que é onde vive o ajuste que ela já tinha.
 *
 * ⚠️ É por isso que o `latch-scope` tipa os dois campos como `boolean | null` e tem um caso próprio a dizer
 * que «`false` guardado é um VALOR, e não uma ausência». Este é o lado do armazenamento da mesma frase.
 */
export function readTriState(armazem: LatchStore, chave: string): boolean | null {
  const v = armazem.get(chave, null);
  return v == null ? null : v === '1';
}

/**
 * A LEITURA COMPLETA que a regra pede, montada a partir do armazenamento.
 *
 * `base` é `togglemove` ou `togglerun` — os dois nomes que já existem no armazenamento da criança.
 */
export function readLatch(
  armazem: LatchStore,
  base: string,
  jogador: number,
  transporte: string,
  padrao: boolean,
): LatchReading {
  return {
    doTransporte: readTriState(armazem, latchKey(base, jogador, transporte)),
    doLegado: readTriState(armazem, legacyLatchKey(base, jogador)),
    padrao,
  };
}

/**
 * A ALTERNÂNCIA DESTE JOGADOR NESTE TRANSPORTE — a pergunta inteira, numa chamada.
 *
 * 📌 TROCAR DE TRANSPORTE TROCA A RESPOSTA SEM ESCREVER NADA, que é a cláusula 1 do ADR-0113 em código: o
 * valor pertence ao mapeamento do controle, como um caps-lock, e mudar de controle é mudar de mapeamento.
 */
export function storedLatch(
  armazem: LatchStore,
  base: string,
  jogador: number,
  transporte: string,
  padrao: boolean,
): boolean {
  return latchOf(transporte, readLatch(armazem, base, jogador, transporte, padrao));
}

/**
 * GRAVA A ESCOLHA DA CRIANÇA para o transporte em uso. Devolve se gravou.
 *
 * ⚠️ RECUSA NOS TRANSPORTES DE UM COMANDO, e a recusa é um `false` devolvido e não um lançamento: em olhos,
 * rosto, gestos e fala a alternância é o que faz a entrada funcionar (ADR-0113 cláusula 3), então não há
 * escolha a gravar. Quem chama usa a resposta para DESABILITAR o controle COM MOTIVO — que é a metade que
 * falta e que vive na interface, não aqui.
 *
 * 📌 Gravar mesmo assim seria pior do que inútil: a criança mexeria no ícone, o valor iria para o disco, e o
 * jogo continuaria a ignorá-lo — um controle que mente sobre ter funcionado.
 */
// ⚠️ RECEBE O ESCRITOR E NÃO UM ARMAZÉM, e a mudança é de 2026-09-08, quando o painel foi ligar-se a isto.
// O `ui/settings-motor` já tem um `store: { setBool }` injectado — exigir-lhe um objecto com `get`/`set`
// crus obrigaria a inventar um adaptador no ponto de uso, e um adaptador ali é onde uma segunda forma de
// escrever a mesma chave nasce. Uma função é o mínimo que a escrita precisa.
export function writeLatch(
  escrever: (chave: string, ligada: boolean) => void,
  base: string,
  jogador: number,
  transporte: string,
  ligada: boolean,
): boolean {
  if (!latchIsOptional(transporte)) return false;
  escrever(latchKey(base, jogador, transporte), ligada);
  return true;
}
