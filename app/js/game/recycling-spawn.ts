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
import type { BarreiraDaPlaca } from './recycling.js';

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

/** Onde a placa da fase fica, em TILES: a coluna, e a linha que o corpo dela ocupa. */
export interface PlacaDeclarada { col: number; linha: number }

/**
 * Onde a placa fica — DECLARADO PELA FASE, nunca deduzido do mapa.
 *
 * ⚠️ TERCEIRA VERSÃO, e as duas primeiras erraram o lugar porque tentaram DERIVAR o que é design de fase.
 * A primeira punha a placa "logo depois do pula-pula" e deu a coluna 23, no porão. A segunda punha em
 * `agua - 1` e deu a coluna 28, na plataforma do alto — e a água que decidia isso estava nas linhas 54 a 60,
 * ou seja, um dado do porão escolhendo o lugar de uma placa que mora lá em cima. Deu certo por coincidência
 * de mapa, e o Dev viu na tela que estava errado nas duas vezes.
 *
 * A posição certa é a que ele indicou: "eu posicionei duas plataformas abaixo da lava. Pedi pra colocar a 15
 * blocos de altura do chão, 27ª coluna contando da esquerda para a direita." Isso é uma escolha de onde o
 * caminho se estreita e o precipício começa — uma leitura do desenho da fase, e nenhuma fórmula sobre tiles
 * chega nela.
 *
 * ⚠️ E SEM DECLARAÇÃO NÃO HÁ PLACA, de propósito. Inventar uma posição foi exatamente o que produziu duas
 * placas erradas em silêncio: nada quebrou, nenhum teste ficou vermelho, e a coisa apareceu no lugar errado
 * na tela de alguém. Uma fase sem placa declarada simplesmente não tem placa — e aí o lixo dela não é barrado
 * em lugar nenhum, que é honesto e visível.
 *
 * O `y` devolvido é a LINHA DO PÉ (a base do corpo da placa), no mesmo sistema do jogador e do lixo.
 */
export function posicaoDaPlaca(m: MundoDeLixo, declarada: PlacaDeclarada | null): Ponto | null {
  if (!declarada) return null;
  if (declarada.col < 0 || declarada.col >= m.colunas) return null;
  if (declarada.linha < 0 || declarada.linha >= m.linhas) return null;
  return { x: declarada.col * TILE, y: (declarada.linha + 1) * TILE };
}

/**
 * O VÃO em que a barreira da placa vale: do piso em que ela está plantada até o primeiro sólido acima dela.
 *
 * ⚠️ SEM ESTE RECORTE a barreira era uma linha do teto ao chão, e barrava a criança em andares onde a placa
 * nem aparece — parede invisível, que a criança lê como defeito do jogo. Aqui a barreira e o aviso passam a
 * ocupar o mesmo vão: onde ela não passa, ela vê o porquê.
 *
 * Sem sólido nenhum acima, o vão vai até o topo do mapa — céu aberto também é vão.
 */
export function faixaDaPlaca(m: MundoDeLixo, placa: Ponto | null): BarreiraDaPlaca | null {
  if (placa === null) return null;
  const col = Math.floor(placa.x / TILE);
  const linhaDoCorpo = placa.y / TILE - 1;      // a placa apoia NO piso; o corpo dela fica na linha de cima
  let topo = 0;
  for (let l = linhaDoCorpo; l >= 0; l--) {
    if (m.solido(m.tileEm(col, l))) { topo = (l + 1) * TILE; break; }
  }
  return { x: placa.x, topo, piso: placa.y };
}

/**
 * O y do PISO EM QUE SE ANDA naquela coluna: o sólido mais baixo que tem ar por cima. `null` numa coluna que
 * é parede inteira, ou que não tem chão nenhum.
 *
 * ⚠️ NÃO É "o primeiro sólido descendo do teto", e a diferença derrubou a primeira versão das lixeiras. No
 * mapa real a coluna 0 é MURO do teto ao chão: o primeiro sólido dela está na linha 0, então ancorar pelo
 * topo punha as quatro lixeiras acima da borda de cima da tela. O que a criança pisa é o piso, e é ele que
 * sustenta mobiliário.
 */
function pisoDaColuna(m: MundoDeLixo, col: number): number | null {
  for (let l = m.linhas - 1; l >= 0; l--) {
    if (!m.solido(m.tileEm(col, l))) continue;
    // Exige AR POR CIMA de verdade: uma coluna que é parede inteira devolve `null` e o grupo anda para a
    // direita. Aceitar a linha 0 como piso faria o topo do muro da borda valer como chão, e as quatro
    // lixeiras subiriam para fora da tela — que foi o que o mapa real fez com a primeira versão.
    if (l > 0 && !m.solido(m.tileEm(col, l - 1))) return l * TILE;
  }
  return null;
}

/**
 * Filtra as posições em que o lixo PODE nascer, entre as que o jogo já sabe serem lugar de nascer coisa.
 *
 * ⚠️ SEGUNDA VERSÃO, E A PRIMEIRA VARRIA O MAPA SOZINHA — refazendo, pior, uma pergunta que `game/coins` já
 * responde há muito tempo. O Dev viu o resultado na tela: "acabei de ver a caixa nascendo na região secreta,
 * onde não nascem nem moedas."
 *
 * A varredura das moedas não pergunta "o tile é sólido?": ela exige o PAR ESPECÍFICO ar-iluminado(1) ou
 * água(3), e o comentário de lá diz por quê — "não sólido" incluiria a ESCADA e o AR SECRETO, e a região
 * secreta deixaria de ser recompensa para virar rota obrigatória. Vale igual para o lixo, e eu reescrevi a
 * pergunta em vez de reusar a resposta. Agora os candidatos ENTRAM por parâmetro, vindos de
 * `findCoinCandidates`, e este módulo só aplica o que é da reciclagem.
 *
 * "Feito moedas, mas na altura do chão" — as palavras dele desde o primeiro dia, e agora literais no código:
 * a parte "feito moedas" é de quem produz a lista; "na altura do chão" também, filtrando quem tem sólido
 * logo abaixo. Aqui ficam as duas regras que são só da reciclagem: nada depois da placa, nada nas lixeiras.
 */
export function candidatosDeLixo(
  m: MundoDeLixo, candidatos: readonly Ponto[], larguraDaLixeira = 0, placa: Ponto | null = null,
): Ponto[] {
  // ⚠️ O LIMITE É A PLACA quando existe placa, e a água quando não existe. Medido no mapa real: um item pego
  // depois da placa nunca chegaria às lixeiras, porque a criança não passa dela carregando lixo.
  const agua = colunaDaAgua(m);
  const limite = Math.min(
    agua === null ? Infinity : agua * TILE,
    placa === null ? Infinity : placa.x,
  );
  // ⚠️ E NADA NASCE EM CIMA DAS LIXEIRAS. Elas ficam no chão do mesmo canto por onde a criança passa, então um
  // item ali seria pego e depositado NO MESMO QUADRO — ponto sem escolher cor nenhuma, e sem ela ver que
  // pegou alguma coisa. O canto das lixeiras é destino, não berço.
  const ls = larguraDaLixeira <= 0 ? [] : posicoesDasLixeiras(m, larguraDaLixeira, 0);
  const depoisDasLixeiras = ls.length === 0 ? 0 : ls[ls.length - 1]!.x + larguraDaLixeira + TILE;
  return candidatos.filter((p) => p.x < limite && p.x >= depoisDasLixeiras);
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

