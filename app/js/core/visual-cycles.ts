// SPDX-License-Identifier: AGPL-3.0-or-later
// core/visual-cycles — OS DOIS CICLOS DA ACESSIBILIDADE VISUAL, e a assimetria entre eles (ADR-0221; issue #203).
//
// O alto contraste e a correcção de cor são duas escolhas que a criança percorre pela barra rápida, e viviam em dois módulos
// diferentes: a lista dos níveis em `ui/settings-visual`, os passos e os nomes em `ui/pause-icons`. 🔴 Estão aqui juntos porque
// só juntos se lê a coisa que mais custa a quem os mantém — a ASSIMETRIA deles, que está escrita a seguir e é deliberada.
//
// ⚠️ MÓDULO-FOLHA: zero imports, zero DOM, zero armazenamento. São listas e duas contas.
//
// 📌 O que ele NÃO decide: qual ciclo a barra oferece, nem quando. Isso é do ícone (`ui/pause-icons`) e do painel
// (`ui/settings-visual`), que são as duas superfícies por onde a mesma escolha se pede.

/** Os níveis de alto contraste, em valores de `player.viz`. O primeiro é «desligado». */
export const CONTRAST_LEVELS: readonly string[] = ['normal', 'hc-direto', 'hc-direto-45', 'hc-direto-7'];

/** O ciclo da correcção de cor, em valores de `player.viz`. */
export const CVD_SEQ: readonly string[] = ['normal', 'fix-protan', 'fix-deuter', 'fix-tritan'];

/**
 * As chaves i18n dos nomes anunciados da correcção de cor, indexadas como o `CVD_SEQ`.
 *
 * ⚠️ A POSIÇÃO 0 É `cvd.tricro` E NÃO `cvd.off`, E AS DUAS CHAVES NÃO SE TROCAM. Esta lista nomeia as quatro ESCOLHAS do
 * ciclo, logo a posição 0 é um jeito de ver — a visão tricromática, a que não precisa de correcção — e diz-se como tal. O
 * `cvd.off` é o RECUO para valores de `viz` que não são correcção nenhuma, e 13 dos 16 modos são exactamente isso: as três
 * simulações, os três níveis de contraste, os cinco de baixa visão e o modo cego. Anunciar «visão tricromática» ali seria o
 * software afirmar o que a criança vê enquanto ela simula não ver. A escolha é nomeada; o recuo é desligado.
 */
export const CVD_NAMES: readonly string[] = ['cvd.tricro', 'cvd.protan', 'cvd.deuter', 'cvd.tritan'];

/*
 * 🔴 O `CVD_LABELS` NÃO VEIO, E FOI APAGADO. Ele estava na dívida declarada de `ui/pause-icons`
 * (`docs/6-DevOps-SRE/exports-without-consumer.json`) — publicado e sem consumidor nenhum, medido —, e o comentário dele dizia
 * «o rótulo que o `iconLabel` usa», o que deixou de ser verdade em algum momento sem ninguém reparar. Um livro-razão de dívida
 * existe para ENCOLHER: mudá-lo de casa era carregar com ele mais um ano. O que o `iconLabel` usa é o `CVD_NAMES`.
 */

/** O passo seguinte do contraste. Um `viz` que não está na lista — um filtro de correcção, por exemplo — conta como índice 0. */
export function nextContrast(cur: string | undefined): string {
  let idx = CONTRAST_LEVELS.indexOf(cur as string);
  idx = idx < 0 ? 0 : idx;
  return CONTRAST_LEVELS[(idx + 1) % CONTRAST_LEVELS.length]!;
}

/**
 * O passo seguinte da correcção de cor.
 *
 * 🔴 NOTE A ASSIMETRIA COM O `nextContrast`, e ela é o motivo de os dois viverem no mesmo ficheiro: um `viz` desconhecido cai
 * no índice **1** (`fix-protan`) e não no 0. É literal do `game.js` (`idx = idx<0 ? 1 : (idx+1)%seq.length`), e o efeito para
 * a criança é concreto: partindo de um modo que não é correcção, o contraste liga-se no primeiro nível e a correcção salta o
 * «normal» e entra logo na protanopia. Separados, um leitor corrige um pelo outro e apaga uma decisão sem saber que existia.
 */
export function nextCvd(cur: string | undefined): { idx: number; mode: string } {
  let idx = CVD_SEQ.indexOf(cur as string);
  idx = idx < 0 ? 1 : (idx + 1) % CVD_SEQ.length;
  return { idx, mode: CVD_SEQ[idx]! };
}
