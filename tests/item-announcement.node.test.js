// SPDX-License-Identifier: AGPL-3.0-or-later
// O ÍNDICE "6 de 10" — item 3 do ADR-0044, e o motivo de ele estar no FIM.
//
// ========================= O QUE A XAG 106 PEDE, E POR QUE =========================
// "Position and total help non-sighted players remain oriented and confident that they have found all of the
// controls." Sem o índice, a criança que varre um menu por escuta não tem como saber se chegou ao fim ou se
// perdeu alguma coisa no caminho — e essa dúvida custa mais que o tempo de ouvir o número.
//
// O número vai no FIM da frase, e isso é decisão da própria XAG ("Gamma, slider, 38%, 6 of 9"). A razão é de
// uso: quem varre depressa quer o RÓTULO primeiro e interrompe assim que reconhece o item. Índice na frente
// obrigaria a ouvir a contagem inteira antes de saber do que se trata — e, com a narração interrompível do
// item 2, seria a única parte que sempre daria tempo de ouvir.
//
// E existe a opção de DESLIGAR, também da XAG: para quem já conhece o menu de cor, o número vira ruído em
// toda passagem. Acessibilidade que não se pode desligar é imposição.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { announceItem } from '../app/js/ui/item-announcement.js';
import { t } from '../app/js/core/i18n.js';

describe('anúncio de item de menu · rótulo, estado e o índice no fim', () => {
  it('[Right] rótulo + estado + índice, nessa ordem', () => {
    expect(announceItem({ rotulo: 'Alto contraste', estado: 'ativado', posicao: 6, total: 10 }, true))
      .toBe('Alto contraste, ativado, 6 de 10');
  });

  it('[Right] desligar o índice tira SÓ o índice', () => {
    // O que o desligamento não pode fazer é levar o estado junto: quem desliga a contagem continua precisando
    // saber se o item está ativado.
    expect(announceItem({ rotulo: 'Alto contraste', estado: 'ativado', posicao: 6, total: 10 }, false))
      .toBe('Alto contraste, ativado');
  });

  it('[Zero] item sem estado não ganha vírgula sobrando', () => {
    expect(announceItem({ rotulo: 'Continuar', posicao: 1, total: 7 }, true)).toBe('Continuar, 1 de 7');
    expect(announceItem({ rotulo: 'Continuar', estado: '', posicao: 1, total: 7 }, true)).toBe('Continuar, 1 de 7');
  });

  it('[Boundary] as pontas do anel contam certo — 1 de 7 e 7 de 7', () => {
    // O anel do item 1 faz `quit` ficar a UMA tecla de `resume`, e é o índice que conta essa história: quem
    // aperta para cima no primeiro item precisa ouvir "7 de 7" para entender que deu a volta, e não que andou.
    expect(announceItem({ rotulo: 'Continuar', posicao: 1, total: 7 }, true)).toContain('1 de 7');
    expect(announceItem({ rotulo: 'Sair', posicao: 7, total: 7 }, true)).toContain('7 de 7');
  });

  it('[Error] posição impossível NÃO é anunciada — número errado é pior que número nenhum', () => {
    // Acontece de verdade: um item filtrado por visibilidade sai da lista e o índice de quem sobrou fica fora
    // de faixa. Anunciar "0 de 7" ou "9 de 7" ensina uma geografia falsa do menu, e a criança confia nela.
    expect(announceItem({ rotulo: 'Continuar', posicao: 0, total: 7 }, true)).toBe('Continuar');
    expect(announceItem({ rotulo: 'Continuar', posicao: 9, total: 7 }, true)).toBe('Continuar');
    expect(announceItem({ rotulo: 'Continuar', posicao: 1, total: 0 }, true)).toBe('Continuar');
  });

  it('[Interface] rótulo colado do DOM vira frase legível', () => {
    // `button.textContent` traz quebra de linha e indentação do markup, e um sub-rótulo em `<span>` gruda no
    // rótulo sem espaço nenhum: o menu de alfabetização narrava "Descobrindo palavrasBABA". Quem monta o
    // pedido separa as partes; aqui a normalização garante que o espaço em branco do markup não vaze.
    expect(announceItem({ rotulo: '\n  Descobrindo palavras  \n', estado: ' BABA ', posicao: 3, total: 6 }, true))
      .toBe('Descobrindo palavras, BABA, 3 de 6');
  });

  it('[Zero] item sem rótulo nenhum não vira frase começada por vírgula', () => {
    expect(announceItem({ rotulo: '', posicao: 2, total: 5 }, true)).toBe('2 de 5');
  });

  it('[Interface] o molde do índice vem do DICIONÁRIO, não daqui', () => {
    // Sem isto, alguém poderia montar "6 de 10" com concatenação e os casos acima continuariam verdes em
    // português — enquanto o inglês narraria "6 de 10". A paridade entre os três idiomas é do
    // `i18n-dicts.node.test.js`; o que ESTE caso garante é que o módulo passa pela chave.
    expect(t('sr.menu.index', { n: 6, m: 10 })).toBe('6 de 10');
    expect(announceItem({ rotulo: 'x', posicao: 6, total: 10 }, true).endsWith(t('sr.menu.index', { n: 6, m: 10 }))).toBe(true);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · pondo o índice na FRENTE (`[indice, rotulo, estado]`) → "[Right] rótulo + estado + índice" reprova com
//     "6 de 10, Alto contraste, ativado".
//   · trocando a guarda `posicao >= 1 && posicao <= total` por `posicao >= 0` → "[Error] posição impossível"
//     reprova anunciando "Continuar, 0 de 7".
//   · tirando o `.filter(Boolean)` das partes → "[Zero] item sem estado" reprova com "Continuar, , 1 de 7".
