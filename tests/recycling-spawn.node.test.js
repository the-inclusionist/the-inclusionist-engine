// SPDX-License-Identifier: AGPL-3.0-or-later
// ONDE o lixo, as lixeiras e a placa nascem — a geografia da reciclagem, provada sem mapa de verdade.
//
// O mundo aqui é uma matriz de caracteres, que é a forma mais legível de escrever um mapa num teste e a única em
// que dá para VER o caso: `.` ar, `#` chão, `~` água, `^` trampolim. Um mapa desenhado errado aparece na hora.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import {
  colunaDaAgua, colunaDoTrampolim, posicaoDaPlaca, candidatosDeLixo, posicoesDasLixeiras, N_LIXEIRAS,
} from '../app/js/game/recycling-spawn.js';

const TILE = 16;

/** Constrói o mundo a partir de linhas de texto. A linha 0 é o TOPO. */
function mundo(linhas) {
  const grid = linhas.map((l) => [...l]);
  return {
    tileEm: (c, l) => {
      const ch = grid[l]?.[c] ?? '.';
      return ch === '#' ? 6 : ch === '~' ? 3 : ch === '^' ? 5 : 1;
    },
    colunas: Math.max(...linhas.map((l) => l.length)),
    linhas: linhas.length,
    solido: (t) => t === 6 || t === 5,
    agua: (t) => t === 3,
    trampolim: (t) => t === 5,
  };
}

describe('reciclagem · a geografia', () => {
  it('[Right] a água começa na primeira coluna que tem água, varrendo da esquerda', () => {
    const m = mundo(['......~~', '########']);
    expect(colunaDaAgua(m)).toBe(6);
  });

  it('[Zero] cenário sem água: não há coluna de água nem placa', () => {
    const m = mundo(['........', '########']);
    expect(colunaDaAgua(m)).toBe(null);
  });

  it('[Right] A PLACA VEM DECLARADA PELA FASE, e o `y` é a linha do pé', () => {
    // Duas versões anteriores DEDUZIAM a posição (do pula-pula, depois da água) e erraram nas duas, em
    // silêncio: nada quebrou, nenhum teste ficou vermelho, e a placa apareceu no lugar errado na tela. Onde
    // o caminho se estreita é leitura do desenho da fase, e nenhuma fórmula sobre tiles chega nisso.
    const m = mundo(['....', '....', '####']);
    expect(posicaoDaPlaca(m, { col: 2, linha: 1 })).toEqual({ x: 2 * TILE, y: 2 * TILE });
  });

  it('[Zero] SEM DECLARAÇÃO NÃO HÁ PLACA — inventar posição foi o defeito', () => {
    const m = mundo(['....~', '#####']);
    expect(posicaoDaPlaca(m, null), 'e a fase simplesmente não tem placa').toBe(null);
  });

  it('[Boundary] declaração fora do mapa não vira placa fantasma', () => {
    const m = mundo(['....', '####']);
    expect(posicaoDaPlaca(m, { col: 99, linha: 0 })).toBe(null);
    expect(posicaoDaPlaca(m, { col: 1, linha: 99 })).toBe(null);
    expect(posicaoDaPlaca(m, { col: -1, linha: 0 })).toBe(null);
  });

  it('[Zero] água na coluna 0: não há trecho seco, e não há placa', () => {
    const m = mundo(['~~~~', '####']);
    expect(candidatosDeLixo(m), 'sem trecho seco, nada nasce').toEqual([]);
  });

  it('[Right] NADA NASCE DEPOIS DA PLACA — o limite é ela, não a água', () => {
    // Medido no mapa real: placa na coluna 23, água só na 29. Cinco colunas de lixo nasciam entre as duas, e
    // um item pego ali NUNCA chegaria às lixeiras — quem está além da linha solta a carga a cada quadro.
    //   col: 0123456789
    //         ^ em 2 → placa em 3; água em 8
    const m = mundo(['..........', '..^.....~.', '##########']);
    const placa = posicaoDaPlaca(m, { col: 7, linha: 1 });
    const c = candidatosDeLixo(m, 0, placa);
    expect(c.every((p) => p.x < 7 * TILE), 'nada a partir da placa').toBe(true);
    expect(c).toHaveLength(6);   // colunas 0,1,3,4,5,6 — na 2 está o trampolim, e não se põe lixo nele
  });

  it('[Right] o lixo nasce SOBRE a superfície, e só no trecho seco', () => {
    const m = mundo(['.....', '....~', '#####']);
    const c = candidatosDeLixo(m);
    // Quatro colunas secas: sem placa declarada, quem limita é a água.
    expect(c).toHaveLength(4);
    expect(c[0]).toEqual({ x: 0, y: 2 * TILE });     // a LINHA DO PÉ: o topo do chão, igual à do jogador
    expect(c.every((p) => p.x < 4 * TILE), 'nada a partir da água').toBe(true);
  });

  it('[Boundary] devolve a LINHA DO PÉ, e é quem desenha que sobe a altura do objeto', () => {
    // A moeda flutua; o item não. Item flutuando some da varredura de chão de quem não enxerga — e "um tile
    // acima", que era a conta anterior, deixava a latinha de 9px boiando sete pixels no ar, porque o tile
    // tem 16. O `y` daqui é o mesmo `y` do jogador (o pé), e a altura de cada objeto é de quem o pinta.
    const m = mundo(['..', '..', '##']);
    const [p] = candidatosDeLixo(m);
    expect(p.y, 'o topo do chão').toBe(2 * TILE);
  });

  it('[Zero] coluna sem chão nenhum não recebe item, e nem o vão de um tile entalado', () => {
    const m = mundo(['..', '..', '..']);     // nada sólido em lugar nenhum
    expect(candidatosDeLixo(m)).toEqual([]);
    const entalado = mundo(['##', '..', '##']);  // um vão de UM tile, com teto colado
    expect(candidatosDeLixo(entalado), 'lugar sem espaço por cima não serve').toEqual([]);
  });

  it('[Right] MAIS DE UM ANDAR por coluna, como as moedas — um nível de plataforma tem vários chãos', () => {
    // A primeira versão dava um lugar por coluna: o primeiro sólido descendo do teto. No mapa real isso põe
    // o item na laje MAIS ALTA, que é onde a criança não está.
    const m = mundo(['....', '....', '####', '....', '....', '####']);
    const c = candidatosDeLixo(m).filter((p) => p.x === 0);
    expect(c.map((p) => p.y), 'os dois chãos da coluna 0').toEqual([2 * TILE, 5 * TILE]);
  });

  it('[Right] AS LIXEIRAS APOIAM NO CHÃO, nunca enterradas na última linha do mapa', () => {
    // A primeira versão ancorava na altura do MUNDO. No mapa real a última linha É o piso, e as quatro
    // nasciam dentro dele — invisíveis e inalcançáveis. Num mapa de teste de duas linhas as duas contas dão
    // o mesmo número, e foi só o navegador que mostrou.
    const m = mundo(['....', '....', '....', '####']);   // chão na linha 3
    const ls = posicoesDasLixeiras(m, 12, 15);
    expect(ls[0].y, 'em cima do piso (y=48), e não no fundo do mundo (y=64)').toBe(3 * TILE - 15);
  });

  it('[Boundary] COLUNA QUE É PAREDE INTEIRA não recebe lixeira — o grupo anda para a direita', () => {
    // No mapa real a coluna 0 é muro do teto ao chão. Ancorar pelo primeiro sólido punha as quatro acima da
    // borda de cima da tela; aceitar o topo do muro como piso fazia o mesmo. O que sustenta mobiliário é o
    // chão em que se ANDA: sólido com ar por cima.
    const m = mundo(['#...', '#...', '#...', '####']);
    const ls = posicoesDasLixeiras(m, 12, 15);
    expect(ls[0].x, 'começam na coluna 1, que é onde há piso').toBe(1 * TILE);
    expect(ls[0].y, 'apoiadas no piso da linha 3, não no topo do muro').toBe(3 * TILE - 15);
    expect(new Set(ls.map((l) => l.y)).size, 'e continuam sendo um conjunto').toBe(1);
  });

  it('[Right] as quatro lixeiras ficam no canto inferior esquerdo, alinhadas', () => {
    const m = mundo(['....', '####']);
    const ls = posicoesDasLixeiras(m, 12, 15);
    expect(ls).toHaveLength(N_LIXEIRAS);
    expect(ls[0].x).toBe(0);
    expect(new Set(ls.map((l) => l.y)).size, 'todas na mesma altura — são um conjunto, não degraus').toBe(1);
    expect(ls[0].y, 'apoiada no piso da linha 1').toBe(1 * TILE - 15);
    expect(ls.map((l) => l.x)).toEqual([0, 14, 28, 42]);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · fazendo `candidatosDeLixo` devolver `y: topo` em vez de `topo - TILE` → "[Boundary] repousa SOBRE o chão"
//     reprova, e o efeito real é o item dentro do piso.
//   · tirando o `limite` da água em `candidatosDeLixo` → "[Right] o lixo nasce... só no trecho seco" reprova, e o
//     efeito real é lixo do outro lado da água, que a placa existe para impedir de chegar lá.
//   · alinhando as lixeiras pelo topo de cada coluna em vez da altura do mundo → "[Right] as quatro lixeiras...
//     alinhadas" reprova, e o efeito real são quatro lixeiras em degraus, lidas como quatro coisas diferentes.
//   · tirando o `Math.min(agua - 1, ...)` da placa → "[Boundary] trampolim colado na água" reprova, e o efeito
//     real é a placa dentro da água.
//   · trocando o limite do lixo de volta para a ÁGUA em vez da placa → "[Right] NADA NASCE DEPOIS DA PLACA"
//     reprova, e o efeito real (medido no mapa de verdade) é cinco colunas de lixo que a criança pega e não
//     consegue carregar, porque além da linha da placa a carga cai a cada quadro.
//   · deixando o lixo nascer da coluna 0 → "[Zero] NADA NASCE EM CIMA DAS LIXEIRAS" reprova, e o efeito real
//     é ponto de graça: pegar e depositar no mesmo quadro, sem escolher cor nenhuma.
//   · ancorando as lixeiras em `m.linhas * TILE` (a altura do MUNDO) → "[Right] AS LIXEIRAS APOIAM NO CHÃO"
//     reprova, e o efeito real é as quatro enterradas dentro do piso, invisíveis e inalcançáveis. Este é o
//     defeito que passou por um mapa de teste de duas linhas, onde as duas contas dão o mesmo número.
//   · aceitando a linha 0 como piso (o topo do muro da borda) → "[Boundary] COLUNA QUE É PAREDE INTEIRA"
//     reprova, e o efeito real são as quatro lixeiras desenhadas acima da borda de cima da tela.
