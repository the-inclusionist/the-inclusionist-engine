// SPDX-License-Identifier: AGPL-3.0-or-later
// ONDE o lixo, as lixeiras e a placa nascem — a geografia da reciclagem, provada sem mapa de verdade.
//
// O mundo aqui é uma matriz de caracteres, que é a forma mais legível de escrever um mapa num teste e a única em
// que dá para VER o caso: `.` ar, `#` chão, `~` água, `^` trampolim. Um mapa desenhado errado aparece na hora.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import {
  colunaDaAgua, colunaDoTrampolim, posicaoDaPlaca, faixaDaPlaca, candidatosDeLixo, posicoesDasLixeiras,
  N_LIXEIRAS,
} from '../app/js/game/recycling-spawn.js';

const TILE = 16;

/** Os lugares de nascer, no espírito de `game/coins.findCoinCandidates`: ar com chão logo abaixo e ar em
 *  cima. É o que o produto passa para `candidatosDeLixo`, que só aplica o que é da RECICLAGEM. */
function candidatosDoMapa(linhas) {
  const solido = (ch) => ch === '#' || ch === '^';
  const fora = [];
  for (let l = 1; l < linhas.length - 1; l++) {
    for (let c = 0; c < (linhas[l] ?? '').length; c++) {
      const aqui = linhas[l][c] ?? '.', abaixo = linhas[l + 1]?.[c] ?? '.', acima = linhas[l - 1]?.[c] ?? '.';
      if (solido(aqui) || !solido(abaixo) || abaixo === '^' || solido(acima)) continue;
      fora.push({ x: c * TILE, y: (l + 1) * TILE });
    }
  }
  return fora;
}

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

  it('[Right] O VÃO DA BARREIRA vai do piso da placa até o sólido acima dela', () => {
    // "A barreira deve valer só do piso da placa até o próximo tile sólido acima da placa."
    //  linha 0: teto · linhas 1,2: vão · linha 3: piso onde a placa se planta
    const m = mundo(['####', '....', '....', '####']);
    const placa = posicaoDaPlaca(m, { col: 2, linha: 2 });
    expect(placa.y, 'o pé da placa é o topo do piso da linha 3').toBe(3 * TILE);
    expect(faixaDaPlaca(m, placa)).toEqual({ x: 2 * TILE, topo: 1 * TILE, piso: 3 * TILE });
  });

  it('[Boundary] céu aberto acima da placa: o vão vai até o topo do mapa', () => {
    const m = mundo(['....', '....', '....', '####']);
    const placa = posicaoDaPlaca(m, { col: 2, linha: 2 });
    expect(faixaDaPlaca(m, placa).topo, 'sem sólido acima, nada corta o vão').toBe(0);
  });

  it('[Zero] sem placa não há vão nenhum', () => {
    expect(faixaDaPlaca(mundo(['....', '####']), null)).toBe(null);
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
    const linhas = ['~~~~', '~~~~', '####'];
    expect(candidatosDeLixo(mundo(linhas), candidatosDoMapa(linhas), 0, { x: 0, y: 0 }),
      'sem trecho seco, nada nasce').toEqual([]);
  });

  it('[Right] NADA NASCE DEPOIS DA PLACA — o limite é ela, não a água', () => {
    // Medido no mapa real: placa na coluna 23, água só na 29. Cinco colunas de lixo nasciam entre as duas, e
    // um item pego ali NUNCA chegaria às lixeiras — quem está além da linha solta a carga a cada quadro.
    //   col: 0123456789
    //         ^ em 2 → placa em 3; água em 8
    const linhas = ['..........', '..^.....~.', '##########'];
    const m = mundo(linhas);
    const placa = posicaoDaPlaca(m, { col: 7, linha: 1 });
    const c = candidatosDeLixo(m, candidatosDoMapa(linhas), 0, placa);
    expect(c.every((p) => p.x < 7 * TILE), 'nada a partir da placa').toBe(true);
    expect(c).toHaveLength(6);   // colunas 0,1,3,4,5,6 — na 2 está o trampolim, e não se põe lixo nele
  });

  it('[Right] o lixo nasce SOBRE a superfície, e só no trecho seco', () => {
    const linhas = ['.....', '....~', '#####'];
    const m = mundo(linhas);
    const c = candidatosDeLixo(m, candidatosDoMapa(linhas));
    // Quatro colunas secas: sem placa declarada, quem limita é a água.
    expect(c).toHaveLength(4);
    expect(c[0]).toEqual({ x: 0, y: 2 * TILE });     // a LINHA DO PÉ: o topo do chão, igual à do jogador
    expect(c.every((p) => p.x < 4 * TILE), 'nada a partir da água').toBe(true);
  });

  it('[Boundary] devolve a LINHA DO PÉ, e é quem desenha que sobe a altura do objeto', () => {
    // A moeda flutua; o item não. Item flutuando some da varredura de chão de quem não enxerga — e "um tile
    // acima", que era a conta anterior, deixava a latinha de 9px boiando sete pixels no ar, porque o tile
    // tem 16. O `y` daqui é o mesmo `y` do jogador (o pé), e a altura de cada objeto é de quem o pinta.
    const linhas = ['..', '..', '##'];
    const [p] = candidatosDeLixo(mundo(linhas), candidatosDoMapa(linhas));
    expect(p.y, 'o topo do chão').toBe(2 * TILE);
  });

  it('[Zero] coluna sem chão nenhum não recebe item, e nem o vão de um tile entalado', () => {
    const vazio = ['..', '..', '..'];            // nada sólido em lugar nenhum
    expect(candidatosDeLixo(mundo(vazio), candidatosDoMapa(vazio))).toEqual([]);
    const entalado = ['##', '..', '##'];         // um vão de UM tile, com teto colado
    expect(candidatosDeLixo(mundo(entalado), candidatosDoMapa(entalado)),
      'lugar sem espaço por cima não serve').toEqual([]);
  });

  it('[Zero] NADA NASCE EM CIMA DAS LIXEIRAS — o canto delas é destino, não berço', () => {
    // Um item ali seria pego e depositado no MESMO quadro: ponto de graça, sem escolher cor nenhuma, e sem a
    // criança sequer ver que pegou alguma coisa.
    //
    // ⚠️ ESTE CASO SUMIU NUMA REESCRITA E SÓ A MUTAÇÃO O DENUNCIOU: tirar o filtro das lixeiras deixava a
    // suíte inteira verde. Fica anotado porque é a segunda vez que uma regra sobrevive sem quem a afirme.
    const linhas = ['..................', '..................', '##################'];
    const m = mundo(linhas);
    const todos = candidatosDoMapa(linhas);
    const semLixeiras = candidatosDeLixo(m, todos);
    const comLixeiras = candidatosDeLixo(m, todos, 12);
    expect(comLixeiras.length).toBeLessThan(semLixeiras.length);
    expect(comLixeiras[0].x, 'começa depois das quatro lixeiras (0..54) e de uma folga').toBeGreaterThan(54);
  });

  it('[Zero] NÃO NASCE NA REGIÃO SECRETA, porque quem lista os lugares é a regra das MOEDAS', () => {
    // O Dev viu na tela: "acabei de ver a caixa nascendo na região secreta, onde não nascem nem moedas."
    // A varredura antiga era desta função e perguntava só "é sólido?"; a das moedas exige o par
    // ar-iluminado/água justamente porque a área secreta é RECOMPENSA, e coisa nascendo lá a transforma em
    // rota obrigatória. O conserto foi parar de reescrever a pergunta e passar a receber a resposta.
    const linhas = ['....', '....', '####'];
    const m = mundo(linhas);
    // Um lugar que a regra das moedas NÃO devolveria simplesmente não chega aqui — e o que chega, passa.
    expect(candidatosDeLixo(m, [])).toEqual([]);
    expect(candidatosDeLixo(m, [{ x: 3 * TILE, y: 2 * TILE }])).toEqual([{ x: 3 * TILE, y: 2 * TILE }]);
  });

  it('[Right] MAIS DE UM ANDAR por coluna, como as moedas — um nível de plataforma tem vários chãos', () => {
    // A primeira versão dava um lugar por coluna: o primeiro sólido descendo do teto. No mapa real isso põe
    // o item na laje MAIS ALTA, que é onde a criança não está.
    const linhas = ['....', '....', '####', '....', '....', '####'];
    const c = candidatosDeLixo(mundo(linhas), candidatosDoMapa(linhas)).filter((p) => p.x === 0);
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
