// SPDX-License-Identifier: AGPL-3.0-or-later
// core/accessible-label — COMO SE CHAMA UM CONTROLE, e uma resposta só para quem vê e para quem escuta.
//
// ========================= O DEFEITO QUE ISTO FECHA =========================
// MEDIDO no jogo construído, pousando o cursor no botão de número de jogadores do menu inicial:
//
//     o jogo narrou:         "◀ Number of players: 1 ▶, 1 of 4"
//     o leitor de tela diz:  "Number of players: 1. Click on the left for fewer, on the right for more."
//
// Duas frases diferentes para o MESMO item, no mesmo instante. Uma criança que usa leitor de tela E a
// narração do jogo ouve o item duas vezes, de dois jeitos — e a versão do jogo lê os glifos `◀` e `▶`, que é
// exatamente o ruído que o item 4 do ADR-0044 tirou da legenda da pausa.
//
// A REGRA JÁ EXISTIA, escrita uma vez: `iconCaption` (ui/pause-icons) lê o `aria-label` do ícone justamente
// para que "passar o mouse ou focar diga a MESMA verdade que um leitor de tela anunciaria". Ela valia para os
// dez ícones e não para o resto dos menus. Aqui ela vira uma função, e as três chamadas passam a ser a mesma.
//
// ========================= POR QUE UM MÓDULO-FOLHA =========================
// Três consumidores em camadas diferentes (`ui/activities-menu`, `ui/menu-nav`, `ui/pause-icons`), e
// `ui/menu-nav` já importa `ui/pause-icons` — pôr a regra num deles fecharia ciclo ou obrigaria alguém a
// importar de quem não devia. Mesma lição de `core/ring`, e ela é recente: ciclo em ESM não estoura na hora,
// estoura no boot em TDZ, uma vez, em produção.
//
// Zero dependências, zero I/O, nenhum `document` global: recebe o elemento e devolve texto.

/** A fatia mínima de `Element` que este módulo lê. Estrutural para o teste de node não precisar de DOM real. */
export interface LabelledElement {
  getAttribute(name: string): string | null;
  textContent: string | null;
}

/** Espaço em branco de markup vira UM espaço; pontas somem. */
const tidy = (s: string | null | undefined): string => (s || '').replace(/\s+/g, ' ').trim();

/**
 * O nome do controle: `aria-label` quando existe, o texto visível quando não.
 *
 * A ORDEM É A DECISÃO, e ela não é arbitrária: `aria-label` é o que a plataforma de acessibilidade JÁ vai
 * anunciar. Narrar outra coisa não acrescenta informação — cria uma segunda versão do mesmo item, e quem
 * escuta as duas não tem como saber qual é a verdadeira.
 *
 * O texto visível entra quando não há rótulo declarado, que é o caso da maioria dos botões: ali as duas
 * fontes já coincidem por construção.
 */
export function accessibleLabel(el: LabelledElement | null | undefined): string {
  if (!el) return '';
  return tidy(el.getAttribute('aria-label')) || tidy(el.textContent);
}
