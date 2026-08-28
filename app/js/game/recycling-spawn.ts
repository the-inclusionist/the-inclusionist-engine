// SPDX-License-Identifier: AGPL-3.0-or-later
// game/recycling-spawn — ONDE o lixo, as lixeiras e a placa nascem no mapa.
//
// Lógica PURA sobre uma consulta de tile, para poder ser provada em node: entra `tileEm(col, linha)` e as
// dimensões do mundo em tiles, saem posições em pixels. Nada de PIXI, nada de DOM, nada de estado de módulo.
// A regra de acerto mora em `game/recycling`; a arte, em `render/recycling-tex`; aqui mora só a geografia.
//
// ========================= AS TRÊS REGRAS DO DEV, E O QUE CADA UMA PROTEGE =========================
//   · O LIXO se espalha "feito moedas, mas na altura do chão", e nada depois da água.
//   · AS LIXEIRAS ficam no canto inferior esquerdo do mapa — perto de onde se começa, porque o objetivo é
//     descartar, e um destino longe demais transforma boa ação em missão.
//   · A PLACA fica no alto da plataforma depois do pula-pula, antes da água. Ela não pune (ver `game/recycling`):
//     é o rosto visível de uma barreira que simplesmente não deixa o lixo passar.
//
// ⚠️ E TUDO AQUI DEGRADA PARA `null` OU LISTA VAZIA quando o cenário não tem o que a regra pede. Um tema sem água
// não tem placa; um mapa sem chão livre não recebe lixo. A alternativa — inventar uma posição — poria a placa no
// meio do nada e o lixo dentro de uma parede, que é pior do que não ter.

import { TILE } from '../core/constants.js';

/** A consulta mínima de mundo que este módulo faz. `tileEm` devolve o número do tile na coluna/linha. */
export interface MundoDeLixo {
  tileEm: (col: number, linha: number) => number;
  colunas: number;
  linhas: number;
  /** O tile é sólido? (piso, plataforma) */
  solido: (t: number) => boolean;
  /** O tile é água? */
  agua: (t: number) => boolean;
  /** O tile é trampolim (o pula-pula)? */
  trampolim: (t: number) => boolean;
}

export interface Ponto { x: number; y: number }

/**
 * A COLUNA em que a água começa, ou `null` se o cenário não tem água.
 *
 * A primeira, varrendo da esquerda: é ela que fecha o trecho seco, e é dela que a placa toma o lugar.
 */
export function colunaDaAgua(m: MundoDeLixo): number | null {
  for (let c = 0; c < m.colunas; c++) {
    for (let l = 0; l < m.linhas; l++) if (m.agua(m.tileEm(c, l))) return c;
  }
  return null;
}

/** A COLUNA do último trampolim antes da água, ou `null` se não houver. */
export function colunaDoTrampolim(m: MundoDeLixo, ateColuna: number): number | null {
  let achou: number | null = null;
  for (let c = 0; c < Math.min(ateColuna, m.colunas); c++) {
    for (let l = 0; l < m.linhas; l++) if (m.trampolim(m.tileEm(c, l))) { achou = c; break; }
  }
  return achou;
}

/**
 * Onde a placa fica: no alto da plataforma DEPOIS do pula-pula e ANTES da água.
 *
 * ⚠️ SE NÃO HOUVER TRAMPOLIM, a placa vai para a coluna imediatamente anterior à água — e isso é degradação
 * deliberada e não descuido: o que a placa tem de garantir é que ninguém joga lixo NA ÁGUA. O pula-pula é a
 * referência que o Dev deu porque é onde ela cabe neste mapa; a água é o que ela protege em qualquer mapa.
 */
export function posicaoDaPlaca(m: MundoDeLixo): Ponto | null {
  const agua = colunaDaAgua(m);
  if (agua === null || agua === 0) return null;
  const tramp = colunaDoTrampolim(m, agua);
  // Depois do trampolim e antes da água; sem trampolim, encostada na água.
  const alvo = tramp === null ? agua - 1 : Math.min(agua - 1, tramp + 1);
  const col = Math.max(0, alvo);
  const topo = topoDaColuna(m, col);
  return topo === null ? null : { x: col * TILE, y: topo };
}

/** O y (em pixels) do topo do primeiro sólido da coluna, ou `null` se a coluna não tem chão. */
function topoDaColuna(m: MundoDeLixo, col: number): number | null {
  for (let l = 0; l < m.linhas; l++) if (m.solido(m.tileEm(col, l))) return l * TILE;
  return null;
}

/**
 * As posições candidatas para o lixo: em cima do chão, no trecho seco, uma por coluna.
 *
 * "Na altura do chão" é literal — o item repousa sobre a superfície, ao contrário da moeda, que flutua. Uma
 * criança que não enxerga varre o chão com a bengala; item flutuando some dessa varredura.
 */
export function candidatosDeLixo(m: MundoDeLixo): Ponto[] {
  const agua = colunaDaAgua(m);
  const limite = agua === null ? m.colunas : agua;
  const fora: Ponto[] = [];
  for (let c = 0; c < limite; c++) {
    const topo = topoDaColuna(m, c);
    if (topo === null) continue;
    if (topo <= 0) continue;                    // chão colado no teto não recebe item
    fora.push({ x: c * TILE, y: topo - TILE }); // repousando SOBRE a superfície
  }
  return fora;
}

/** Quantas lixeiras existem — quatro, e o módulo não inventa uma quinta. */
export const N_LIXEIRAS = 4;

/**
 * As quatro lixeiras, lado a lado no canto INFERIOR ESQUERDO.
 *
 * Ancoradas na altura do mundo e não no chão de cada coluna: elas são mobiliário, não terreno. Buscar o topo de
 * quatro colunas diferentes as deixaria em degraus, o que a criança leria como quatro coisas diferentes em vez
 * de um conjunto.
 */
export function posicoesDasLixeiras(m: MundoDeLixo, largura: number, altura: number): Ponto[] {
  const y = m.linhas * TILE - altura;
  return Array.from({ length: N_LIXEIRAS }, (_, i) => ({ x: i * (largura + 2), y }));
}
