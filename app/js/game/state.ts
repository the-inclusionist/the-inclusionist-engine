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
// O TIPO DA MOEDA, e por que ele só pôde chegar aqui agora. Enquanto `coins` morava em `core/state`, ele era
// obrigatoriamente `unknown[]` — a engine não pode conhecer uma moeda, e o comentário de lá dizia isso. O item
// 19 trouxe o binding para cá, que é do JOGO, e deixou o `unknown` para trás; este import é o resto daquela
// mudança. É `import type` porque `game/coins` importa o binding `coins` DAQUI: o tipo é apagado na compilação,
// então não há aresta em tempo de execução e o ciclo não existe.
import type { Coin } from './coins.js';

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
export let coins: Coin[] = [];
export function setCoins(arr: Coin[]): void { coins = arr; emit('coins', arr); }

/* ===================== cenario e activity (ADR-0038, Fase B) ===================== */
//
// Chegaram de `core/state` em 2026-08-26. São GAME pelo critério do ADR-0038 — persistidos em chave
// `kJogo()` —, e a forma veio inteira: binding vivo + setter que grava, persiste e emite.
//
// ⚠️ A ASSIMETRIA DE INICIALIZAÇÃO VEIO JUNTO, e é deliberado não consertá-la aqui. O `activity` lê o
// armazenamento no import; o `cenario` nasce em 'cidade' e quem o restaura é o composition root
// (`main.ts`, na linha do `setCenario(store.getComLegado(...))`). As duas formas funcionam e produzem o
// mesmo resultado; unificá-las no mesmo commit em que o endereço muda tornaria impossível saber qual
// metade quebrou, se quebrasse. Fica anotado como o próximo passo pequeno.

/**
 * O CENÁRIO ativo. `string` e não `string | null`: ninguém usa nulo como "ainda não escolhido", e o
 * `render/cenario-data` já cai em 'cidade' para tema desconhecido.
 *
 * LÊ O ARMAZENAMENTO NO IMPORT, como o `activity` logo abaixo — a assimetria que veio junto na mudança de
 * endereço foi desfeita em seguida, num passo próprio. Antes, o valor nascia em 'cidade' e quem o restaurava
 * era o composition root; agora o root só APLICA o que já foi lido, que é trabalho dele.
 *
 * A MIGRAÇÃO `'noite' → 'espaco'` veio junto porque ela é parte de LER a chave, não de aplicá-la: um valor
 * salvo por uma versão antiga precisa virar um valor válido antes de qualquer um o consultar.
 */
export let cenario: string = ((v: string) => (v === 'noite' ? 'espaco' : v))(
  store.getComLegado(store.KEYS.cenario, store.KEYS.cenarioLegado, 'cidade'),
);
export function setCenarioValue(theme: string): void {
  cenario = theme; store.set(store.KEYS.cenario, theme); emit('cenario', theme);
}

/** O ID DA ATIVIDADE escolhida. A validação contra o catálogo fica em `ui/activities-menu`; aqui é só o
 *  valor cru, a persistência e o evento. */
export let activity: string = store.getComLegado(store.KEYS.activity, store.KEYS.activityLegado, 'ludico');
export function setActivityValue(id: string): void {
  activity = id; store.set(store.KEYS.activity, id); emit('activity', id);
}
