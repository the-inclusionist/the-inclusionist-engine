// SPDX-License-Identifier: AGPL-3.0-or-later
// UMA RESPOSTA SÓ PARA "COMO SE CHAMA ESTE CONTROLE" — o resto do item 3 do ADR-0044.
//
// ========================= O DEFEITO, MEDIDO =========================
// No jogo construído, pousando o cursor no botão de número de jogadores do menu inicial:
//
//     o jogo narrou:         "◀ Number of players: 1 ▶, 1 of 4"
//     o leitor de tela diz:  "Number of players: 1. Click on the left for fewer, on the right for more."
//
// Duas frases para o MESMO item, no mesmo instante. Quem usa leitor de tela E a narração do jogo ouve o item
// duas vezes, de dois jeitos — e a versão do jogo lê os glifos `◀` e `▶`, o mesmo ruído que o item 4 tirou da
// legenda da pausa. O índice "1 of 4" é do item 3 e está certo; o rótulo é que vinha da fonte errada.
//
// A regra já existia escrita UMA vez, em `legendaDoIcone`: ler o `aria-label` para que "passar o mouse ou
// focar diga a MESMA verdade que um leitor de tela anunciaria". Valia para os dez ícones e não para o resto.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { accessibleLabel } from '../app/js/core/rotulo-acessivel.js';

/** Um elemento falso com a fatia que o módulo lê — sem DOM, para rodar no project `node`. */
const el = (aria, texto) => ({ getAttribute: (n) => (n === 'aria-label' ? aria : null), textContent: texto });

describe('rótulo acessível · o que o jogo narra é o que o leitor de tela diz', () => {
  it('[Right] `aria-label` VENCE o texto visível', () => {
    // A ordem é a decisão: `aria-label` é o que a plataforma de acessibilidade JÁ vai anunciar. Narrar outra
    // coisa não acrescenta informação — cria uma segunda versão do mesmo item.
    expect(accessibleLabel(el('Number of players: 1', '◀ Number of players: 1 ▶'))).toBe('Number of players: 1');
  });

  it('[Right] sem `aria-label`, o texto visível é a resposta', () => {
    // O caso da maioria dos botões: as duas fontes já coincidem por construção, e forçar um rótulo declarado
    // em todos eles seria trabalho sem ganho.
    expect(accessibleLabel(el(null, 'Continuar'))).toBe('Continuar');
  });

  it('[Zero] `aria-label` VAZIO não engole o texto visível', () => {
    // Um `aria-label=""` num markup gerado é acidente, não decisão. Se ele vencesse, o item ficaria SEM nome
    // — e um item sem nome é pior que um item com dois nomes.
    expect(accessibleLabel(el('', 'Continuar'))).toBe('Continuar');
    expect(accessibleLabel(el('   ', 'Continuar'))).toBe('Continuar');
  });

  it('[Interface] espaço em branco de markup não vaza', () => {
    // `textContent` traz quebra de linha e indentação do HTML. Sem isto o TTS lê pausas onde não há nada.
    expect(accessibleLabel(el(null, '\n   Sair do jogo  \n'))).toBe('Sair do jogo');
  });

  it('[Zero] elemento ausente devolve string vazia, não estoura', () => {
    expect(accessibleLabel(null)).toBe('');
    expect(accessibleLabel(undefined)).toBe('');
    expect(accessibleLabel(el(null, null))).toBe('');
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · invertendo a ordem (texto visível antes do `aria-label`) → "[Right] `aria-label` VENCE" reprova, e o
//     efeito real é o defeito medido voltando: o jogo lendo "◀ … ▶" por cima do leitor de tela.
//   · trocando `enxuto(aria) || enxuto(texto)` por `aria ?? texto` → "[Zero] `aria-label` VAZIO" reprova com
//     string vazia, que é o item ficando sem nome nenhum.
