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
    expect(posicaoDaPlaca(m)).toBe(null);
  });

  it('[Right] a placa fica DEPOIS do pula-pula e ANTES da água', () => {
    //  col:  0123456
    //         ^ em 2, água em 5  →  placa em 3
    const m = mundo(['..^..~.', '#######']);
    expect(colunaDoTrampolim(m, 5)).toBe(2);
    expect(posicaoDaPlaca(m)).toEqual({ x: 3 * TILE, y: 1 * TILE });
  });

  it('[Boundary] trampolim colado na água: a placa não invade a água', () => {
    const m = mundo(['...^~..', '#######']);
    expect(posicaoDaPlaca(m).x, 'fica na coluna antes da água, não depois').toBe(3 * TILE);
  });

  it('[Boundary] sem trampolim, a placa encosta na água — degradação deliberada', () => {
    // O pula-pula é a referência que o Dev deu porque é onde ela cabe NESTE mapa. O que a placa protege em
    // qualquer mapa é a água, então é a água que decide quando não há trampolim.
    const m = mundo(['.....~.', '#######']);
    expect(posicaoDaPlaca(m).x).toBe(4 * TILE);
  });

  it('[Zero] água na coluna 0: não há trecho seco, e não há placa', () => {
    const m = mundo(['~~~~', '####']);
    expect(posicaoDaPlaca(m)).toBe(null);
  });

  it('[Right] o lixo nasce SOBRE a superfície, e só no trecho seco', () => {
    const m = mundo(['....~', '#####']);
    const c = candidatosDeLixo(m);
    expect(c).toHaveLength(4);                       // quatro colunas secas
    expect(c[0]).toEqual({ x: 0, y: 0 });            // chão na linha 1 → item na linha 0
    expect(c.every((p) => p.x < 4 * TILE), 'nada a partir da água').toBe(true);
  });

  it('[Boundary] repousa SOBRE o chão, nunca flutuando — quem varre com a bengala precisa achar', () => {
    // A moeda flutua; o item não. Item flutuando some da varredura de chão de quem não enxerga.
    const m = mundo(['..', '..', '##']);
    const [p] = candidatosDeLixo(m);
    expect(p.y, 'um tile acima do topo do chão').toBe(1 * TILE);
  });

  it('[Zero] coluna sem chão não recebe item, e coluna com chão no topo também não', () => {
    const m = mundo(['#.', '#.']);   // col 0: chão no topo (y=0) · col 1: sem chão nenhum
    expect(candidatosDeLixo(m)).toEqual([]);
  });

  it('[Right] as quatro lixeiras ficam no canto inferior esquerdo, alinhadas', () => {
    const m = mundo(['....', '####']);
    const ls = posicoesDasLixeiras(m, 12, 15);
    expect(ls).toHaveLength(N_LIXEIRAS);
    expect(ls[0].x).toBe(0);
    expect(new Set(ls.map((l) => l.y)).size, 'todas na mesma altura — são um conjunto, não degraus').toBe(1);
    expect(ls[0].y).toBe(2 * TILE - 15);
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
