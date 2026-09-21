// SPDX-License-Identifier: AGPL-3.0-or-later
// core/escape-html.ts — ESCAPAR TEXTO QUE VAI PARAR EM MARCAÇÃO. Módulo-folha: uma função, zero dependências.
//
// ⚠️ NASCEU DENTRO DE `game/quiz.ts` E TEVE DE SAIR NO DIA SEGUINTE, o que vale registrar porque a razão não
// é arrumação: `game/` é o CARTUCHO, e a issue #111 leva-o para um repositório próprio. O ajudante sairia com
// ele, e o `consumer-quiz` — que é prova da ENGINE — nem sequer pode importar de `game/`, porque o
// `engine-boundary` o proíbe. Um utilitário de segurança que vive do lado errado da fronteira é um utilitário
// que o próximo consumidor reescreve, e duas versões de um escape divergem em silêncio.
//
// ⚠️ E O ESCAPE É O SEGUNDO RECURSO, NÃO O PRIMEIRO. Onde o valor cabe num nó — `textContent`, `setAttribute`
// —, é assim que ele entra, porque aí não há o que esquecer. Isto existe para o caso em que o texto está
// dentro de um construtor denso de marcação, e nesse caso vem sempre acompanhado de um gate com conteúdo
// hostil: um escape sem rasto é pior do que construir nós.

/**
 * Os CINCO caracteres, e cobre os dois contextos: elemento (`<` `>`) e ATRIBUTO (`"` `'`).
 *
 * O atributo é o que costuma faltar, e é o pior: dentro de um elemento uma aspa é inofensiva; dentro de
 * `aria-label="…"` ela FECHA o atributo e o que vem a seguir vira atributo — um `onmouseover` sem precisar de
 * uma única tag.
 *
 * ⚠️ O `&` É O PRIMEIRO, E A ORDEM É O DEFEITO CLÁSSICO DESTE AJUDANTE. Escapando-o por último, o `&` do
 * `&lt;` que acabou de ser produzido é escapado outra vez e a tela mostra `&lt;` literal. É silencioso porque
 * quem testa só com `<b>` nunca o vê: a saída ainda «parece» escapada.
 *
 * E ele escapa, não apaga. Apagar mudaria a palavra que a criança digitou, e uma atividade cujo texto muda
 * sozinho é um defeito diferente e igualmente sério.
 */
export function escapeHtml(s: string): string {
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
