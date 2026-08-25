// SPDX-License-Identifier: AGPL-3.0-or-later
// game/state — o estado que é DESTE JOGO, e não da engine (item 19, regra do ADR-0033).
//
// ========================= A MESMA REGRA, APLICADA AO ESTADO =========================
// O ADR-0033 fixou a regra para a entidade:
//
//     A entidade da engine pode declarar o que a ENGINE possui. Não pode declarar o que o JOGO possui.
//
// Estado obedece à mesma frase, e `core/state` tinha duas exceções. Nenhuma delas é ajuste de acessibilidade,
// de idioma ou de dispositivo — que é o que o estado COMPARTILHADO existe para guardar:
//
//   · `coins`     — os coletáveis. Já estava tipado como `unknown[]`, e o comentário de lá explicava por quê:
//                   `core/` não pode conhecer o tipo. Um estado que não pode declarar o próprio tipo é um
//                   estado que está na camada errada; o `unknown` era o sintoma, não a solução.
//   · `quizLevel` — o nível da atividade de alfabetização, de 1 a 5. É conteúdo pedagógico, e nem sequer é
//                   da engine no sentido de "mecânica": é do currículo que este jogo hospeda.
//
// ========================= O QUE NÃO MUDOU, E POR QUÊ =========================
// A FORMA é a mesma de `core/state`: binding vivo exportado + setter que persiste e emite. Quem lê continua
// lendo por importação, e o único ponto que muda é o CAMINHO do import. Não é preguiça — é o que torna esta
// mudança conferível: se o comportamento mudasse junto, não daria para saber qual metade quebrou.
//
// A CHAVE DE PERSISTÊNCIA continua vindo de `platform/storage.KEYS`, e isso é de propósito. O registro de
// chaves é a documentação do que se grava, e `kJogo()` existe exatamente para dar escopo de JOGO a uma chave.
// `activity`, `cenario`, `tabsel` e `fracnot` moram lá pelo mesmo motivo; só `quizlevel` chama a atenção do
// gate de vocabulário, e chama porque o casador contém a palavra "quiz" — não porque a fronteira vazou ali.
import * as store from '../platform/storage.js';
import { emit } from '../core/state.js';

/* ===================== quizLevel: 1..5 (nível da atividade de alfabetização) ===================== */
//
// Escrevia `'incl_quizlevel'` à mão, contornando o registro que se diz a documentação das chaves. Lê pelo
// registro, com herança da chave antiga (`getComLegado`), e escreve só na nova.
export let quizLevel: number = (() => {
  const bruto = store.getComLegado(store.KEYS.quizlevel, store.KEYS.quizlevelLegado, null);
  const v = bruto == null ? 2 : parseFloat(bruto);       // o padrão é 2, e é VERBATIM: mudar de camada não é
  return isFinite(v) && v >= 1 && v <= 5 ? v : 2;        // hora de mudar o nível em que a criança começa
})();

export function setQuizLevelValue(n: number): void {
  quizLevel = Math.max(1, Math.min(5, n | 0));
  store.set(store.KEYS.quizlevel, String(quizLevel));
  emit('quizLevel', quizLevel);
}

/* ===================== coins[]: os coletáveis ===================== */
//
// Mutado IN-PLACE (push/forEach — usa a referência importada) mas TAMBÉM reatribuído, por `setCoins`. As duas
// coisas ao mesmo tempo são o motivo de o setter existir: quem só muta veria a troca de array como um sumiço.
export let coins: unknown[] = [];
export function setCoins(arr: unknown[]): void { coins = arr; emit('coins', arr); }
