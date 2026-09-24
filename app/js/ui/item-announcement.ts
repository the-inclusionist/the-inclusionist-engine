// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/item-announcement — COMO UM ITEM DE MENU SE ANUNCIA (ADR-0044, item 3).
//
// A XAG 106 descreve a frase inteira — "Gamma, slider, 38%, 6 of 9" — e este módulo monta a parte que o jogo
// controla: RÓTULO, ESTADO e ÍNDICE, nessa ordem, com o índice no FIM.
//
// POR QUE O ÍNDICE VAI NO FIM. Quem varre um menu por escuta interrompe assim que reconhece o item — é o que
// a narração interrompível do item 2 passou a permitir. Com o número na frente, a contagem seria a única
// parte que SEMPRE daria tempo de ouvir, e o rótulo, a única que interessa, a que nunca chegaria.
//
// POR QUE ELE PODE SER DESLIGADO. Para quem já sabe o menu de cor, o número vira ruído em toda passagem. A
// XAG pede a opção explicitamente, e o princípio é o mesmo do resto do projeto: acessibilidade que não se
// pode desligar é imposição, não ajuste.
//
// ESTE MÓDULO NÃO TOCA O DOM. Quem chama separa as partes (o rótulo do botão, o sub-rótulo, o estado do
// alternador) e recebe uma frase. É o que permite que a regra seja a MESMA na abertura, na pausa e nas
// atividades sem que cada tela reinvente a pontuação.

import { t } from '../core/i18n.js';

export interface ItemDeMenu {
  /** O que o item é. Espaço em branco de markup é normalizado aqui. */
  label: string;
  /** O valor ou estado: "ativado", "38%", a palavra de exemplo do minijogo. Opcional. */
  state?: string;
  /** Posição na lista, contada a partir de 1 — é o número que a criança ouve, não o índice do array. */
  position: number;
  /** Quantos itens a lista tem. */
  total: number;
}

/** Espaço em branco de markup (quebras de linha, indentação) vira UM espaço; pontas somem. */
const tidy = (s: string | undefined): string => (s || '').replace(/\s+/g, ' ').trim();

/**
 * A frase que o item narra.
 *
 * A posição fora de faixa NÃO é anunciada, e é decisão, não guarda defensivo: um item filtrado por
 * visibilidade sai da lista e deixa o índice de quem sobrou fora dela. "0 de 7" ensina uma geografia falsa
 * do menu, e a criança confia nela — número errado é pior que número nenhum.
 */
export function announceItem(item: ItemDeMenu, comIndice: boolean): string {
  const indexApplies = comIndice && item.total >= 1 && item.position >= 1 && item.position <= item.total;
  const parts = [
    tidy(item.label),
    tidy(item.state),
    indexApplies ? t('sr.menu.index', { n: item.position, m: item.total }) : '',
  ];
  return parts.filter(Boolean).join(', ');
}
