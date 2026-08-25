// SPDX-License-Identifier: GPL-3.0-or-later
// render/camera — a conta que estava enterrada no `placeCam` (project node: nada de PIXI, nada de aleatório).
//
// A câmera é o subsistema mais barato de quebrar em SILÊNCIO que existe num jogo: inverta um sinal e tudo
// continua rodando, os testes de física continuam verdes, e só quem OLHA percebe. Enquanto a conta morava
// dentro de uma função de desenho, olhar era a única forma de conferi-la. Estes casos são a outra forma.
//
// Nenhum deles afirma que a câmera está BONITA — não há aqui zona-morta, suavização nem antecipação, porque a
// extração é deliberadamente sem mudança nenhuma (é o prefixo comum de todas as opções de câmera na mesa).
// O que eles afirmam é que ela está no LUGAR CERTO, e o lugar certo é uma conta.
import { describe, it, expect } from 'vitest';
import { prender, enquadrar, tremer } from '../app/js/render/camera.js';

const TELA = { w: 320, h: 180 };
// O mapa de hoje, MEDIDO NO JOGO (`__incl.WORLD_W/H`) e não contado no arquivo: 56×62 tiles de 16px. A
// primeira versão deste fixture dizia 40×68 porque eu contei a PRIMEIRA LINHA do .map.txt — e `buildWorld`
// normaliza as linhas pela mais longa. Os limites abaixo (576 e 812) saem daqui; com o número errado eles
// eram plausíveis e falsos, que é o pior tipo de fixture.
const MUNDO = { w: 896, h: 992 };

describe('enquadrar — o alvo no centro da tela', () => {
  it('[Right] no miolo do mundo, o alvo fica exatamente no meio', () => {
    const c = enquadrar(400, 544, MUNDO, TELA);
    expect(c).toEqual({ camX: 400 - 160, camY: 544 - 90 });
  });

  it('[Interface] devolve a posição SEM ARREDONDAR', () => {
    // O arredondamento é do desenho (`-Math.round(camX)` no container), não da conta, e a diferença importa:
    // o parallax recebe o valor CRU e rola por `-cam * fator`. Arredondar aqui faria as camadas de fundo
    // andarem aos pulos de 1px em vez de deslizarem — que é o bug #21 outra vez, num lugar novo.
    // Alvo escolhido DENTRO da faixa livre de propósito: com x=100,5 o enquadramento daria -59,5, o clamp o
    // zeraria e o caso passaria a medir a prisão em vez do arredondamento. Foi o que aconteceu na 1ª versão.
    expect(enquadrar(300.5, 500.25, MUNDO, TELA).camX).toBe(300.5 - 160);
    expect(enquadrar(300.5, 500.25, MUNDO, TELA).camY).toBe(500.25 - 90);
  });
});

describe('prender — a câmera não sai do mundo', () => {
  it('[Boundary] encosta nas quatro bordas e não passa', () => {
    expect(prender({ camX: -999, camY: -999 }, MUNDO, TELA)).toEqual({ camX: 0, camY: 0 });
    expect(prender({ camX: 9999, camY: 9999 }, MUNDO, TELA)).toEqual({ camX: 576, camY: 812 });
  });

  it('[Boundary] o limite é `mundo - tela`, e não `mundo` — senão sobra vazio na direita', () => {
    // O erro clássico é prender em `mundo.w`: a câmera passa a poder ir até a borda direita do mundo e a
    // tela mostra meia fase e meio nada. Aqui o último x válido é 896-320.
    expect(prender({ camX: 896, camY: 0 }, MUNDO, TELA).camX).toBe(576);
  });

  it('[Zero] MUNDO MENOR QUE A TELA: encosta no canto e sobra vazio — comportamento preservado', () => {
    // `mundo.w - tela.w` fica negativo, o `min` devolve o negativo e o `max(0, …)` o zera. É o que o
    // `placeCam` já fazia; está aqui escrito para que a próxima pessoa ache o caso em vez de descobri-lo.
    // O mapa de hoje nunca chega lá; uma fase pequena chegaria.
    expect(prender({ camX: 50, camY: 50 }, { w: 100, h: 100 }, TELA)).toEqual({ camX: 0, camY: 0 });
  });

  it('[One] uma câmera já dentro do mundo passa intacta', () => {
    expect(prender({ camX: 10, camY: 20 }, MUNDO, TELA)).toEqual({ camX: 10, camY: 20 });
  });
});

describe('tremer — o JUICE que não pode mostrar o vazio', () => {
  it('[Zero] amplitude 0 devolve a MESMA câmera', () => {
    const c = { camX: 100, camY: 200 };
    expect(tremer(c, MUNDO, TELA, 0, 1, -1)).toBe(c);
  });

  it('[Right] desloca por `r · amp` nos dois eixos', () => {
    expect(tremer({ camX: 100, camY: 200 }, MUNDO, TELA, 4, 1, -0.5)).toEqual({ camX: 104, camY: 198 });
  });

  it('[Boundary] PRENDE DE NOVO depois de tremer — é a razão de a função existir', () => {
    // Sem a segunda prisão, o tremor empurra a câmera para fora na beirada da fase e a criança vê o vazio
    // atrás do cenário — exatamente no quadro em que alguma coisa explodiu e ela está olhando para lá.
    expect(tremer({ camX: 0, camY: 0 }, MUNDO, TELA, 8, -1, -1)).toEqual({ camX: 0, camY: 0 });
    expect(tremer({ camX: 576, camY: 812 }, MUNDO, TELA, 8, 1, 1)).toEqual({ camX: 576, camY: 812 });
  });

  it('[Boundary] amplitude negativa é tratada como sem tremor, e não como tremor invertido', () => {
    const c = { camX: 100, camY: 200 };
    expect(tremer(c, MUNDO, TELA, -3, 1, 1)).toBe(c);
  });
});

describe('a extração é FIEL — as fórmulas do placeCam, na mesma ordem', () => {
  /** Réplica do `placeCam` de antes da extração, para comparar valor a valor. */
  function original(plX, plY, boxH, wpw, wph, k, r1, r2) {
    const LW = 320, LH = 180;
    let camX = plX - LW / 2, camY = (plY - boxH / 2) - LH / 2;
    camX = Math.max(0, Math.min(camX, wpw - LW)); camY = Math.max(0, Math.min(camY, wph - LH));
    if (k > 0) {
      camX = Math.max(0, Math.min(camX + r1 * k, wpw - LW));
      camY = Math.max(0, Math.min(camY + r2 * k, wph - LH));
    }
    return { camX, camY };
  }

  it('[Right] bate com o original em posições espalhadas pelo mapa, com e sem tremor', () => {
    // É o caso que autoriza chamar isto de EXTRAÇÃO e não de reescrita. Se ele reprovar, a câmera mudou de
    // comportamento — e mudar o comportamento era justamente o que esta rodada não devia fazer.
    const BOX_H = 30; // BOX.h real do jogador de plataforma, conferido no preview (`__incl.BOX`)
    for (const plX of [0, 37, 160, 321, 895]) {
      for (const plY of [0, 100, 544, 991]) {
        for (const [k, r1, r2] of [[0, 0, 0], [3, 1, -1], [8, -0.3, 0.7], [12, 1, 1]]) {
          const esperado = original(plX, plY, BOX_H, MUNDO.w, MUNDO.h, k, r1, r2);
          let c = enquadrar(plX, plY - BOX_H / 2, MUNDO, TELA);
          if (k > 0) c = tremer(c, MUNDO, TELA, k, r1, r2);
          expect(c, `pl=(${plX},${plY}) k=${k}`).toEqual(esperado);
        }
      }
    }
  });
});
