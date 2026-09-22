// SPDX-License-Identifier: AGPL-3.0-or-later
// O MODO `accessibility` — item 7 do ADR-0044, e a ARMADILHA que o próprio registro anotou.
//
// ========================= POR QUE ESTE ARQUIVO COMEÇA PELA SAÍDA =========================
// O ADR-0044 listou este item entre as CONSEQUÊNCIAS NEGATIVAS da decisão, com estas palavras:
//
//   "O item `accessibility` introduz um segundo MODO DE ENTRADA (o direcional dirige a barra do HUD, e não o
//    jogador). Um modo em que se entra e não se sabe sair é a própria armadilha de que este registro trata —
//    então a saída dele (START ou VOLTAR) é parte da decisão, e não um detalhe de implementação."
//
// Uma criança que não enxerga entra no modo, aperta a direção, e o personagem não anda. Se ela não souber
// sair, o jogo acabou para ela — e nada na tela vai dizer o que aconteceu, porque a tela não é o canal dela.
// Por isso os casos de SAÍDA vêm primeiro aqui, e por isso são mais do que os de entrada.
//
// ========================= O QUE É PURO, E O QUE NÃO É =========================
// A parte testável sem tela é a que decide O QUE UMA INTENÇÃO SIGNIFICA dentro do modo. É pouca coisa, e é
// exatamente onde a armadilha mora: basta `sair` deixar de casar com uma das duas entradas para a saída
// desaparecer sem que nada mais quebre. O roteamento (quem chama isto, e quando) é do teste de navegador.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { barAction } from '../app/js/ui/pause-icons.js';

/** Uma intenção isolada, como os tradutores de teclado e de controle a montam. */
const so = (...ks) => Object.fromEntries(ks.map((k) => [k, true]));

describe('modo acessibilidade · o que cada intenção significa dentro da barra', () => {
  it('[Right] VOLTAR sai do modo', () => {
    // O `no` do projeto: Escape no teclado, e o botão de voltar no controle (X no PlayStation, B no Xbox,
    // A no Nintendo). É a saída que quem já conhece o jogo vai tentar primeiro, porque é a saída de tudo.
    expect(barAction(so('no'), false)).toBe('sair');
  });

  it('[Right] START também sai — DUAS saídas, e é de propósito', () => {
    // A segunda saída não é redundância: START é o botão que ABRE a pausa, e a pausa é de onde se entrou no
    // modo. Quem se perde tenta voltar por onde veio. Ter só uma das duas seria confiar que a criança
    // adivinhe QUAL das duas o jogo escolheu.
    expect(barAction({}, true)).toBe('sair');
    expect(barAction(so('up'), true), 'START vence a direção — sair nunca fica atrás de andar').toBe('sair');
  });

  it('[Right] as quatro direções ANDAM na barra', () => {
    for (const d of ['up', 'down', 'left', 'right']) expect(barAction(so(d), false), d).toBe('andar');
  });

  it('[Right] confirmar ATIVA o ícone sob o cursor', () => {
    expect(barAction(so('yes'), false)).toBe('ativar');
  });

  it('[Boundary] SAIR vence tudo, inclusive confirmar', () => {
    // A ordem de precedência é a decisão. Se `yes` viesse antes, um controle que registrasse os dois no mesmo
    // quadro (acontece: dedos apertam junto) alternaria um ajuste em vez de devolver o jogo.
    expect(barAction(so('no', 'yes'), false)).toBe('sair');
    expect(barAction(so('yes'), true)).toBe('sair');
  });

  it('[Zero] quadro sem intenção nenhuma não faz nada', () => {
    // O controle é lido A CADA QUADRO. Sem isto, um modo que "faz alguma coisa" por quadro parado viraria
    // sessenta ações por segundo.
    expect(barAction({}, false)).toBe('nada');
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando o ramo do START (`temStart`) → "[Right] START também sai" reprova, e o efeito real seria a
//     criança apertando o botão que a trouxe até ali e nada acontecendo.
//   · pondo `yes` antes de `no` na ordem → "[Boundary] SAIR vence tudo" reprova.
//   · fazendo a direção devolver 'andar' antes de checar START → "[Right] START também sai" reprova na
//     segunda asserção, que é a que encena o dedo apertando os dois juntos.
