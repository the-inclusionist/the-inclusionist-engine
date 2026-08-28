// SPDX-License-Identifier: AGPL-3.0-or-later
// A RECICLAGEM LIGADA AO MUNDO — os sprites, o ponto que sai, e as duas rajadas que não podem acontecer.
//
// Este é o arquivo que exercita a cena INTEIRA sem PIXI e sem mapa de verdade: o mundo é uma matriz de texto
// (mesma técnica de `recycling-spawn.node.test.js`) e os sprites são objetos de mentira que só guardam x, y e
// visible. O que se prova aqui não é desenho — é ORDEM: pegou antes de depositar, o item segue o dono, o
// ponto sai UMA vez, e a recusa não vira rajada.
//
// ⚠️ E O CASO QUE MAIS IMPORTA É O DO PONTO: `aoPontuar` é a única porta por onde o ponto de comportamento
// sai deste módulo, e ele tem de sair uma vez por acerto. Duas chamadas seriam dois pontos pela mesma lata —
// que é o defeito que um jogo de plataforma produz sozinho, porque o jogador fica parado em cima da lixeira.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { createRecycling } from '../app/js/game/recycling-scene.js';
import { LIXEIRA_DE, LIXEIRAS, MATERIAIS } from '../app/js/game/recycling.js';

const TILE = 16;

/** Mundo a partir de linhas de texto: `.` ar, `#` chão, `~` água, `^` trampolim. Linha 0 é o TOPO. */
function mundo(linhas) {
  const grid = linhas.map((l) => [...l]);
  return {
    tileEm: (c, l) => { const ch = grid[l]?.[c] ?? '.'; return ch === '#' ? 6 : ch === '~' ? 3 : ch === '^' ? 5 : 1; },
    colunas: Math.max(...linhas.map((l) => l.length)),
    linhas: linhas.length,
    solido: (t) => t === 6 || t === 5,
    agua: (t) => t === 3,
    trampolim: (t) => t === 5,
  };
}

/** Os lugares de nascer, no mesmo espírito de `game/coins.findCoinCandidates`: ar com chão logo abaixo e ar
 *  por cima. Devolve a LINHA DO PÉ, que é o contrato de `candidatos`. */
function candidatosDoMapa(linhas) {
  const solido = (ch) => ch === '#' || ch === '^';
  const fora = [];
  for (let l = 1; l < linhas.length - 1; l++) {
    for (let c = 0; c < linhas[l].length; c++) {
      const aqui = linhas[l][c] ?? '.', abaixo = linhas[l + 1]?.[c] ?? '.', acima = linhas[l - 1]?.[c] ?? '.';
      if (solido(aqui) || !solido(abaixo) || abaixo === '^' || solido(acima)) continue;
      fora.push({ x: c * TILE, y: (l + 1) * TILE });
    }
  }
  return fora;
}

/** Uma cena montada, com tudo de mentira e os registros do que ela anunciou e pontuou. */
// O mapa padrão dos casos é ESTREITO mas completo, e cada pedaço dele existe por um motivo: as quatro
// lixeiras ocupam as colunas 0 a 3 (e o lixo não nasce nelas), o trampolim fica na 16, a placa cai na 17 e a
// água começa na 20 — sobram onze colunas de chão seco para o lixo, que é folga suficiente para os casos.
// São TRÊS linhas e não duas porque um lugar de lixo precisa de piso embaixo E de ar em cima: num mapa de
// duas linhas não existe lugar nenhum, e essa é a mesma regra que as moedas seguem.
function cena(linhas = ['........................', '....................~~~~', '################^###~~~~'], extra = {}) {
  const filhos = [];
  const pontos = [];
  const falas = [];
  const api = createRecycling({
    camada: {
      addChild: (c) => { filhos.push(c); return c; },
      removeChild: (c) => c,
      removeChildren: () => filhos.splice(0, filhos.length),
    },
    criarSprite: (tex) => ({ tex, x: 0, y: 0, visible: false, destroy() { this.destruido = true; } }),
    texturaDoLixo: (m) => 'tex:' + m,
    texturaDaLixeira: (c) => 'tex:' + c,
    texturaDaPlaca: 'tex:placa',
    mundo: mundo(linhas), placaEm: { col: 17, linha: 1 },
    // Os lugares vêm de FORA, como no produto (lá são os candidatos das moedas, filtrados por "tem chão logo
    // abaixo"). Aqui a mesma pergunta sobre o mapinha de texto: ar com sólido embaixo e ar em cima.
    candidatos: () => candidatosDoMapa(linhas),
    quantosItens: 4,
    escolherLugares: (total, n) => Array.from({ length: Math.min(n, total) }, (_, i) => i),
    lixeiraW: 12, lixeiraH: 15, placaH: 16, alturaDoLixo: () => 9, larguraDoLixo: () => 6,
    alturaDoJogador: 30,
    alcance: 12,
    aoPontuar: (j, m) => pontos.push([j, m]),
    anunciar: (chave, j, sobre) => falas.push([chave, j, sobre]),
    ...extra,
  });
  return { api, filhos, pontos, falas };
}

/** Um jogador num quadro. `acao` é o que `game/carry` já decidiu — a cena não roteia botão. */
const quem = (i, x, y, acao = 'nada', direcao = 0, olhandoPara = 1) => ({ i, x, y, acao, direcao, olhandoPara });

/** Leva o jogador `j` ao CENTRO da lixeira `cor` — o centro, e não a borda, porque as quatro ficam a 2px
 *  uma da outra e uma borda pertence às duas (ver `lixeiraSob`). */
function levarAteALixeira(c, cor, j = 0) {
  const idx = LIXEIRAS.indexOf(cor);
  const x = idx * (12 + 2) + 6;          // centro da caixa daquela lixeira (ver posicoesDasLixeiras)
  const y = 2 * TILE;                    // a linha do pé: o piso deste mapinha é a linha 2
  c.api.atualizar([quem(j, x, y)]);
  return { x, y };
}

describe('reciclagem · a cena', () => {
  it('[Right] montar põe quatro lixeiras, a placa e os itens na camada', () => {
    const c = cena();
    c.api.montar();
    expect(c.filhos.filter((s) => String(s.tex).startsWith('tex:') && LIXEIRAS.includes(String(s.tex).slice(4)))).toHaveLength(4);
    expect(c.filhos.some((s) => s.tex === 'tex:placa'), 'o cenário tem água, então tem placa').toBe(true);
    expect(c.api.itens()).toHaveLength(4);
    expect(c.api.placaX()).not.toBe(null);
  });

  it('[Zero] FASE SEM PLACA DECLARADA monta assim mesmo, e o lixo continua nascendo', () => {
    // Uma fase pode não ter placa — e aí o lixo dela não é barrado em lugar nenhum, que é honesto e visível.
    // Inventar uma posição foi exatamente o que produziu duas placas erradas em silêncio.
    const c = cena(['........................', '........................', '########################'],
      { placaEm: null });
    c.api.montar();
    expect(c.api.placaX()).toBe(null);
    expect(c.filhos.some((s) => s.tex === 'tex:placa')).toBe(false);
    expect(c.api.itens().length, 'e o lixo continua nascendo').toBeGreaterThan(0);
  });

  it('[Right] UMA UNIDADE DE CADA por volta — é o que "um por volta" queria dizer', () => {
    // Eu tinha lido "um só por volta está de bom tamanho" como UM ITEM, e nasceu sempre a caixa de papelão.
    // Ele corrigiu: "eu quis dizer uma unidade de cada". Toda volta traz os quatro materiais, que é o que faz
    // a criança encontrar vidro sem depender de sorte.
    const c = cena(undefined, { quantosItens: 4 });
    c.api.montar();
    expect([...c.api.itens()].map((i) => i.material).sort()).toEqual([...MATERIAIS].sort());
  });

  it('[Boundary] e com uma quantidade que NÃO é múltipla de quatro, o rodízio atravessa as voltas', () => {
    // A garantia "todos os materiais aparecem" não pode depender de a quantidade ser múltipla de quatro. Com
    // um item por volta, começar sempre do primeiro daria cem voltas de caixa de papelão e nenhuma lata.
    const c = cena(undefined, { quantosItens: 1 });
    const vistos = [];
    for (let volta = 0; volta < 4; volta++) { c.api.montar(); vistos.push(c.api.itens()[0].material); }
    expect(new Set(vistos).size, 'quatro voltas, quatro materiais diferentes').toBe(4);
  });

  it('[Right] remontar não acumula sprite nenhum — a volta recomeça limpa', () => {
    // O reinício das dez moedas remonta a reciclagem (ADR-0049 §7). Sem limpar, cada volta deixaria uma
    // camada inteira de lixo fantasma em cima da anterior.
    const c = cena();
    c.api.montar();
    const primeiro = c.filhos.length;
    c.api.montar();
    expect(c.filhos.length).toBe(primeiro);
  });

  it('[Right] o item APOIA na linha do pé, subindo a própria altura — não meio tile', () => {
    // A latinha tem 9px e o tile tem 16: descontar o tile a deixava boiando sete pixels no ar. Quem varre o
    // chão com a bengala não acha o que boia, e quem enxerga vê um objeto flutuando sem motivo.
    const c = cena(undefined, { alturaDoLixo: () => 9 });
    c.api.montar();
    const it = c.api.itens()[0];
    const sprite = c.filhos.find((s) => s.tex === 'tex:' + it.material);
    expect(it.y, 'o estado guarda a linha do pé, como a do jogador').toBe(2 * TILE);
    expect(sprite.y, 'e o sprite sobe os 9px da própria arte').toBe(2 * TILE - 9);
  });

  it('[Right] o item carregado fica NA BARRIGA: abaixo da cabeça e levemente à frente', () => {
    // "Deve aparecer abaixo da cabeça e levemente à frente, tampando a barriga sem tampar os braços." A
    // primeira versão o punha flutuando ACIMA da cabeça — visível, sim, mas lido como ícone de estado e não
    // como alguém carregando alguma coisa.
    const c = cena(undefined, { alturaDoLixo: () => 9, larguraDoLixo: () => 6, alturaDoJogador: 30 });
    c.api.montar();
    const it = c.api.itens()[0];
    c.api.atualizar([quem(0, it.x, it.y, 'pegar')]);
    expect(c.falas[0][0]).toBe('sr.lixo.pegou');
    c.api.atualizar([quem(0, 100, 50, 'nada', 0, 1)]);
    const sprite = c.filhos.find((s) => s.tex === 'tex:' + it.material);
    expect(sprite.y, 'topo 22px acima do pé — logo abaixo da cabeça de 8').toBe(50 - 22);
    expect(sprite.y + 9, 'e o objeto inteiro cabe acima do pé').toBeLessThan(50);
    expect(sprite.x, 'centrado no tronco (6 de largura), 2px à frente').toBe(100 - 3 + 2);
  });

  it('[Right] "à frente" segue PARA ONDE ELE OLHA, dos dois lados', () => {
    const c = cena(undefined, { larguraDoLixo: () => 6 });
    c.api.montar();
    const it = c.api.itens()[0];
    c.api.atualizar([quem(0, it.x, it.y, 'pegar')]);
    c.api.atualizar([quem(0, 100, 50, 'nada', 0, 1)]);
    const sprite = c.filhos.find((s) => s.tex === 'tex:' + it.material);
    const paraDireita = sprite.x;
    c.api.atualizar([quem(0, 100, 50, 'nada', 0, -1)]);
    expect(sprite.x, 'olhando para a esquerda, o objeto vai para a esquerda').toBeLessThan(paraDireita);
  });

  it('[Right] lixeira CERTA: o ponto sai UMA vez e o sprite some', () => {
    const c = cena();
    c.api.montar();
    const it = c.api.itens()[0];
    c.api.atualizar([quem(0, it.x, it.y, 'pegar')]);            // pega
    levarAteALixeira(c, LIXEIRA_DE[it.material]);             // deposita
    expect(c.pontos).toEqual([[0, it.material]]);
    const sprite = c.filhos.find((s) => s.tex === 'tex:' + it.material);
    expect(sprite.visible, 'o item saiu do mundo').toBe(false);
  });

  it('[Zero] PARADO EM CIMA DA LIXEIRA CERTA, O PONTO NÃO SE REPETE', () => {
    // O jogador de plataforma para em cima das coisas. Sem a guarda de entrada, ficar parado ali seria um
    // ponto por quadro — sessenta pontos por segundo pela mesma lata.
    const c = cena();
    c.api.montar();
    const it = c.api.itens()[0];
    c.api.atualizar([quem(0, it.x, it.y, 'pegar')]);
    const cor = LIXEIRA_DE[it.material];
    levarAteALixeira(c, cor);
    levarAteALixeira(c, cor);
    levarAteALixeira(c, cor);
    expect(c.pontos, 'três quadros no mesmo lugar, um ponto só').toHaveLength(1);
  });

  it('[Zero] PARADO NA LIXEIRA ERRADA, A RECUSA NÃO VIRA RAJADA', () => {
    // Mesma guarda, e aqui ela é de acessibilidade antes de ser de mecânica: a fala reiniciando a cada
    // quadro tranca o leitor de tela e a criança perde o controle do jogo.
    const c = cena();
    c.api.montar();
    const it = c.api.itens()[0];
    c.api.atualizar([quem(0, it.x, it.y, 'pegar')]);
    const errada = LIXEIRAS.find((cor) => cor !== LIXEIRA_DE[it.material]);
    levarAteALixeira(c, errada);
    levarAteALixeira(c, errada);
    expect(c.falas.filter(([k]) => k === 'sr.lixo.errou'), 'uma recusa, não duas').toHaveLength(1);
    expect(c.pontos).toEqual([]);
  });

  it('[Right] errou a cor e continua com o item na mão, para tentar a lixeira do lado', () => {
    const c = cena();
    c.api.montar();
    const it = c.api.itens()[0];
    c.api.atualizar([quem(0, it.x, it.y, 'pegar')]);
    const errada = LIXEIRAS.find((cor) => cor !== LIXEIRA_DE[it.material]);
    levarAteALixeira(c, errada);
    expect(c.api.itens()[0].dono, 'ainda na mão').toBe(0);
    levarAteALixeira(c, LIXEIRA_DE[it.material]);
    expect(c.pontos, 'e a segunda tentativa vale o ponto igual').toEqual([[0, it.material]]);
  });

  it('[Interface] o anúncio carrega IDENTIFICADOR, nunca texto — quem traduz é a raiz', () => {
    // O piso do projeto são três idiomas. Se a cena mandasse "latinha de alumínio", o jogo falaria português
    // em inglês e em espanhol, e nenhum teste de comportamento ficaria vermelho por isso.
    const c = cena();
    c.api.montar();
    const it = c.api.itens()[0];
    c.api.atualizar([quem(0, it.x, it.y, 'pegar')]);
    expect(c.falas[0]).toEqual(['sr.lixo.pegou', 0, { material: it.material }]);
    levarAteALixeira(c, LIXEIRA_DE[it.material]);
    expect(c.falas.at(-1)).toEqual(['sr.lixo.acertou', 0, { material: it.material, cor: LIXEIRA_DE[it.material] }]);
  });

  it('[Zero] COM LIXO NA MÃO, soltar e arremessar não fazem NADA aqui', () => {
    // `acaoDeCarga` já recusa as duas com lixo (`game/carry.PODE`), e este caso afirma que a cena não tem um
    // segundo caminho para elas: soltar e lançar o lixo SÃO a desobediência à placa. A única saída é a
    // lixeira. Sem este caso, um "conserto" futuro reabriria a porta pela cena sem ninguém notar.
    const c = cena();
    c.api.montar();
    const it = c.api.itens()[0];
    c.api.atualizar([quem(0, it.x, it.y, 'pegar')]);
    c.api.atualizar([quem(0, 150, 32, 'soltar')]);
    c.api.atualizar([quem(0, 150, 32, 'arremessar', 1)]);
    expect(c.api.itens()[0].dono, 'continua na mão dela').toBe(0);
    expect(c.falas.map(([k]) => k), 'e nada foi anunciado além do pegar').toEqual(['sr.lixo.pegou']);
  });

  it('[Right] O ALCANCE COBRE O TILE DO LADO — foi aí que o botão parecia quebrado', () => {
    // Medido no navegador com a tecla de verdade: a 16px do item, que é a criança EM PÉ NO TILE DO LADO, o
    // botão não fazia nada e não avisava nada. Do lado de quem joga, "o botão não funciona".
    const c = cena(undefined, { alcance: 24 });
    c.api.montar();
    const it = c.api.itens()[0];
    expect(c.api.temItemPerto(0, it.x - 16, it.y), 'um tile de distância').toBe(true);
    c.api.atualizar([quem(0, it.x - 16, it.y, 'pegar')]);
    expect(c.api.itens()[0].dono).toBe(0);
  });

  it('[Interface] `temItemPerto` é O alcance — a raiz não tem uma conta própria', () => {
    // Duas contas para a mesma pergunta divergem em silêncio no dia em que uma mudar: `acaoDeCarga` diria
    // "pegar" e `pegarPerto` não acharia nada. Botão que não faz nada, sem erro em lugar nenhum.
    const c = cena(undefined, { alcance: 24 });
    c.api.montar();
    const it = c.api.itens()[0];
    expect(c.api.temItemPerto(0, it.x + 100, it.y), 'longe').toBe(false);
    c.api.atualizar([quem(0, it.x, it.y, 'pegar')]);
    expect(c.api.temItemPerto(0, it.x, it.y), 'de mãos cheias não há o que pegar').toBe(false);
  });

  it('[Zero] ENCOSTAR NÃO PEGA — pegar é escolha, e é de botão', () => {
    // A primeira versão pegava por proximidade. Com o SOLTAR existindo, isso vira armadilha: a criança larga
    // o lixo para resolver outra coisa, dá um passo, e o item volta para a mão sozinho.
    const c = cena();
    c.api.montar();
    const it = c.api.itens()[0];
    c.api.atualizar([quem(0, it.x, it.y)]);            // em cima do item, sem pedir nada
    expect(c.api.itens()[0].dono).toBe(null);
    expect(c.falas).toEqual([]);
  });

  it('[Zero] jogador de mãos vazias passando pela lixeira não faz nada', () => {
    const c = cena();
    c.api.montar();
    levarAteALixeira(c, 'azul');
    expect(c.pontos).toEqual([]);
    expect(c.falas.filter(([k]) => k.startsWith('sr.lixo.'))).toEqual([]);
  });

  it('[Interface] dois jogadores carregam coisas diferentes, cada uma seguindo o seu dono', () => {
    const c = cena();
    c.api.montar();
    const [a, b] = c.api.itens();
    c.api.atualizar([quem(0, a.x, a.y, 'pegar'), quem(1, b.x, b.y, 'pegar')]);
    expect(c.api.itens()[0].dono).toBe(0);
    expect(c.api.itens()[1].dono).toBe(1);
    c.api.atualizar([quem(0, 60, 60), quem(1, 90, 70)]);  // os dois aquém da placa
    // O objeto carregado fica na barriga do dono: centrado no tronco e 2px à frente. O que este caso prova é
    // que cada um segue o SEU dono — a conta exata é do caso da barriga.
    const perto = (s, x) => Math.abs(s.x - x) <= 4;
    const sa = c.filhos.find((s) => s.tex === 'tex:' + a.material && perto(s, 60));
    const sb = c.filhos.find((s) => s.tex === 'tex:' + b.material && perto(s, 90));
    expect(sa, 'o item do jogador 0 está com ele').toBeTruthy();
    expect(sb, 'e o do jogador 1, com ele').toBeTruthy();
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · trocando `entrouNaLixeira(...)` por `sob >= 0` na cena → "[Zero] PARADO EM CIMA DA LIXEIRA CERTA"
//     reprova, e o efeito real é um ponto por quadro pela mesma lata.
//   · tirando o `limpar()` de `montar()` → "[Right] remontar não acumula sprite nenhum" reprova, e o efeito
//     real é uma camada de lixo fantasma por volta jogada.
//   · fazendo o sprite carregado ficar em `dono.y` em vez de `dono.y - ALTURA_NA_MAO` → "[Right] o item que a
//     criança pega passa a SEGUIR o dono" reprova, e o efeito real é o item sumir atrás do personagem.
//   · fazendo a cena pegar por PROXIMIDADE de novo (ignorando `j.acao`) → "[Zero] ENCOSTAR NÃO PEGA" reprova,
//     e o efeito real é o item voltando sozinho para a mão de quem acabou de soltá-lo.
//   · deixando de esconder o sprite do item descartado → "[Right] lixeira CERTA" reprova, e o efeito real é a
//     lata continuar desenhada depois de entrar na lixeira.
//   · tirando a `cor` do anúncio de acerto → "[Interface] o anúncio carrega IDENTIFICADOR" reprova, e o efeito
//     real é a fala perder justamente a cor, que é o conteúdo curricular (CONAMA 275/2001).
//   · escolhendo a PRIMEIRA lixeira em vez da mais próxima (em `game/recycling-world.lixeiraSob`) → o caso
//     "[Boundary] ENTRE DUAS LIXEIRAS" do arquivo vizinho reprova; foi um teste daqui que descobriu a falha.
