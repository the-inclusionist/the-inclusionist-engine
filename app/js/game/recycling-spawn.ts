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
  // O PISO, e não o primeiro sólido descendo do teto: a placa protege a água, e a água está no andar de
  // baixo. Ancorada pelo topo, ela ia parar numa laje alta, longe do que existe para proteger.
  const piso = pisoDaColuna(m, col);
  return piso === null ? null : { x: col * TILE, y: piso };
}

// ⚠️ `topoDaColuna` (o primeiro sólido descendo do teto) FOI EMBORA, e vale dizer por quê: as três coisas
// que este módulo posiciona — lixo, lixeira e placa — apoiam em CHÃO EM QUE SE ANDA, e num nível de
// plataforma o primeiro sólido do teto quase nunca é esse chão. Ele punha as lixeiras dentro do muro da
// borda, a placa numa laje alta longe da água, e o lixo no andar mais alto de cada coluna. Um nome que
// parecia certo e respondia outra pergunta.

/**
 * O y do PISO EM QUE SE ANDA naquela coluna: o sólido mais baixo que tem ar por cima. `null` numa coluna que
 * é parede inteira, ou que não tem chão nenhum.
 *
 * ⚠️ NÃO É `topoDaColuna`, e a diferença derrubou a primeira versão das lixeiras. No mapa real a coluna 0 é
 * MURO do teto ao chão: o primeiro sólido dela está na linha 0, então ancorar pelo topo punha as quatro
 * lixeiras acima da borda de cima da tela. O que a criança pisa é o piso, e é ele que sustenta mobiliário.
 */
function pisoDaColuna(m: MundoDeLixo, col: number): number | null {
  for (let l = m.linhas - 1; l >= 0; l--) {
    if (!m.solido(m.tileEm(col, l))) continue;
    // Exige AR POR CIMA de verdade: uma coluna que é parede inteira devolve `null` e o grupo anda para a
    // direita. Aceitar a linha 0 como piso faria o topo do muro da borda valer como chão, e as quatro
    // lixeiras subiriam para fora da tela — que foi exatamente o que o mapa real fez com a primeira versão.
    if (l > 0 && !m.solido(m.tileEm(col, l - 1))) return l * TILE;
  }
  return null;
}

/**
 * As posições candidatas para o lixo: TODA superfície em que se ANDA, no trecho antes da placa.
 *
 * ⚠️ MESMA REGRA DAS MOEDAS (`game/coins.findCoinCandidates`), e ela é a segunda versão desta função. A
 * primeira usava "o primeiro sólido descendo do teto", uma coluna = um lugar — e no mapa real isso põe o item
 * na laje MAIS ALTA de cada coluna, que é onde a criança não está. Um nível de plataforma tem vários andares;
 * o chão de uma coluna não é um só.
 *
 * O `y` devolvido é a LINHA DO PÉ (o topo do sólido), igual ao `y` do jogador. Quem desenha subtrai a altura
 * do próprio objeto — foi assim que o item deixou de flutuar meio tile acima do chão, que era o que acontecia
 * quando a conta usava o TILE inteiro em vez da altura da latinha.
 */
export function candidatosDeLixo(m: MundoDeLixo, larguraDaLixeira = 0): Ponto[] {
  const agua = colunaDaAgua(m);
  // ⚠️ O LIMITE É A PLACA, e não a água, quando existe placa. Medido no mapa real: a placa cai na coluna 23
  // e a água só na 29, então cinco colunas de lixo nasciam DEPOIS da placa — e um item pego ali nunca
  // chegaria às lixeiras, porque `efeitoAoPassar` faz quem está além da linha soltar a carga a cada quadro.
  const placa = posicaoDaPlaca(m);
  const limiteDaPlaca = placa === null ? Infinity : Math.floor(placa.x / TILE);
  const limite = Math.min(agua === null ? m.colunas : agua, limiteDaPlaca);
  // ⚠️ E NADA NASCE EM CIMA DAS LIXEIRAS. Elas ficam no chão do mesmo canto por onde a criança passa, então um
  // item ali seria pego e depositado NO MESMO QUADRO — ponto sem escolher cor nenhuma, e sem ela ver que
  // pegou alguma coisa. O canto das lixeiras é destino, não berço.
  const ls = larguraDaLixeira <= 0 ? [] : posicoesDasLixeiras(m, larguraDaLixeira, 0);
  const primeira = ls.length === 0 ? 0
    : Math.ceil((ls[ls.length - 1]!.x + larguraDaLixeira) / TILE) + 1;
  const fora: Ponto[] = [];
  for (let c = primeira; c < limite; c++) {
    for (let l = 1; l < m.linhas - 1; l++) {
      const aqui = m.tileEm(c, l), abaixo = m.tileEm(c, l + 1), acima = m.tileEm(c, l - 1);
      if (m.solido(aqui) || !m.solido(abaixo) || m.trampolim(abaixo)) continue;  // precisa de piso, e não em cima do pula-pula
      if (m.solido(acima)) continue;                                             // e de espaço por cima, senão fica entalado
      fora.push({ x: c * TILE, y: (l + 1) * TILE });                             // a LINHA DO PÉ, como a do jogador
    }
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
  // Começam na primeira coluna EM QUE SE ANDA, e não na coluna 0: no mapa real a 0 é a parede da borda, e
  // uma lixeira dentro dela é meia lixeira desenhada dentro de pedra.
  let col = 0;
  let piso: number | null = null;
  for (; col < m.colunas; col++) { piso = pisoDaColuna(m, col); if (piso !== null) break; }
  const y = (piso ?? m.linhas * TILE) - altura;
  const x0 = col >= m.colunas ? 0 : col * TILE;
  // Todas na MESMA altura, de propósito: são um conjunto, e quatro alturas diferentes seriam lidas como
  // quatro coisas diferentes em vez de quatro cores da mesma coisa.
  return Array.from({ length: N_LIXEIRAS }, (_, i) => ({ x: x0 + i * (largura + 2), y }));
}

