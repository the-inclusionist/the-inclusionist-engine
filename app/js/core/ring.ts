// SPDX-License-Identifier: AGPL-3.0-or-later
// core/ring — A CONTA DO ANEL, e nada mais.
//
// Ela morava em `ui/menu-nav`, e saiu de lá quando o item 7 do ADR-0044 fez `ui/pause-icons` precisar dela
// também: `menu-nav` já importava `pause-icons` (por `showPauseOptions` e `PM_VISIBLE_ITEMS`), e a volta
// fecharia um CICLO de importação. Ciclo em ESM não estoura na hora — estoura no boot, em TDZ, quando um dos
// dois lê o outro durante a avaliação. É o tipo de defeito que aparece uma vez, em produção, e some ao ser
// investigado.
//
// Módulo-folha de propósito: zero dependências, uma função, nenhuma I/O. `ui/menu-nav` continua a
// reexportando, porque é de lá que os testes e os outros menus já a importavam — o nome público não muda.

/**
 * ANDA UM PASSO NUM ANEL — passar do último volta ao primeiro, e antes do primeiro está o último.
 *
 * Era `clampIndex`, que prendia nas pontas "porque o original nunca faz wrap em lista de itens". O ADR-0044
 * derrubou isso, e o motivo é de uso, não de gosto: com UM MENU POR TELA, toda lista pode ser um anel, e o
 * item mais indesejado (`quit`) fica a UMA tecla do mais urgente (`resume`) sem estar perto dele. Quem não
 * enxerga não varre a lista à procura do fim — ela pergunta "e antes do primeiro?" e recebe uma resposta.
 *
 * A XAG 106 permite o anel exatamente para menu LINEAR, e o proíbe para grade 2-D de blocos: ali "voltar ao
 * primeiro" não tem significado espacial.
 *
 * ⚠️ NAVEGAR LISTA É ANEL; AJUSTAR VALOR É LIMITE. `selectStep` e `rangeStep` (em ui/menu-nav) continuam
 * presos nas pontas, e a diferença é real: passar do volume máximo para o mínimo com uma tecla é um susto,
 * não uma conveniência — e num jogo com pistas de áudio para cegueira, um susto de volume é dano.
 */
export function stepInRing(len: number, idx: number, delta: number): number {
  if (len <= 0) return 0;
  return ((idx + delta) % len + len) % len; // o `+ len` extra: `%` de negativo em JS devolve negativo
}
