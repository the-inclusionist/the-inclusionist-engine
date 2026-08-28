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
import { LIXEIRA_DE, LIXEIRAS } from '../app/js/game/recycling.js';

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

/** Uma cena montada, com tudo de mentira e os registros do que ela anunciou e pontuou. */
function cena(linhas = ['........~...', '############'], extra = {}) {
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
    mundo: mundo(linhas),
    quantosItens: 4,
    escolherLugares: (total, n) => Array.from({ length: Math.min(n, total) }, (_, i) => i),
    lixeiraW: 12, lixeiraH: 15,
    alcance: 12,
    aoPontuar: (j, m) => pontos.push([j, m]),
    anunciar: (chave, j, sobre) => falas.push([chave, j, sobre]),
    ...extra,
  });
  return { api, filhos, pontos, falas };
}

/** Leva o jogador `j` ao CENTRO da lixeira `cor` — o centro, e não a borda, porque as quatro ficam a 2px
 *  uma da outra e uma borda pertence às duas (ver `lixeiraSob`). */
function levarAteALixeira(c, cor, j = 0) {
  const idx = LIXEIRAS.indexOf(cor);
  const x = idx * (12 + 2) + 6;          // centro da caixa daquela lixeira (ver posicoesDasLixeiras)
  const y = 2 * TILE - 15 + 2;           // as lixeiras encostam no fundo do mundo, que aqui tem 2 linhas
  c.api.atualizar([{ i: j, x, y }]);
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

  it('[Zero] cenário SEM água não ganha placa, e a cena monta assim mesmo', () => {
    const c = cena(['............', '############']);
    c.api.montar();
    expect(c.api.placaX()).toBe(null);
    expect(c.filhos.some((s) => s.tex === 'tex:placa')).toBe(false);
    expect(c.api.itens().length, 'e o lixo continua nascendo').toBeGreaterThan(0);
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

  it('[Right] o item que a criança pega passa a SEGUIR o dono, acima dele', () => {
    const c = cena();
    c.api.montar();
    const it = c.api.itens()[0];
    c.api.atualizar([{ i: 0, x: it.x, y: it.y }]);
    expect(c.falas[0][0]).toBe('sr.lixo.pegou');
    c.api.atualizar([{ i: 0, x: 100, y: 50 }]);   // aquém da placa, senão ele SOLTA o lixo ali (caso próprio)
    const sprite = c.filhos.find((s) => s.tex === 'tex:' + it.material);
    expect(sprite.x, 'segue o dono').toBe(100);
    expect(sprite.y, 'e flutua ACIMA dele, senão some atrás do personagem').toBeLessThan(50);
  });

  it('[Right] lixeira CERTA: o ponto sai UMA vez e o sprite some', () => {
    const c = cena();
    c.api.montar();
    const it = c.api.itens()[0];
    c.api.atualizar([{ i: 0, x: it.x, y: it.y }]);            // pega
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
    c.api.atualizar([{ i: 0, x: it.x, y: it.y }]);
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
    c.api.atualizar([{ i: 0, x: it.x, y: it.y }]);
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
    c.api.atualizar([{ i: 0, x: it.x, y: it.y }]);
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
    c.api.atualizar([{ i: 0, x: it.x, y: it.y }]);
    expect(c.falas[0]).toEqual(['sr.lixo.pegou', 0, { material: it.material }]);
    levarAteALixeira(c, LIXEIRA_DE[it.material]);
    expect(c.falas.at(-1)).toEqual(['sr.lixo.acertou', 0, { material: it.material, cor: LIXEIRA_DE[it.material] }]);
  });

  it('[Boundary] cruzar a placa carregando SOLTA o lixo, e não pontua nada', () => {
    const c = cena();
    c.api.montar();
    const it = c.api.itens()[0];
    c.api.atualizar([{ i: 0, x: it.x, y: it.y }]);
    c.api.atualizar([{ i: 0, x: c.api.placaX() + 40, y: it.y }]);
    expect(c.falas.map(([k]) => k)).toContain('sr.lixo.solta');
    expect(c.api.itens()[0].dono, 'caiu da mão na placa').toBe(null);
    expect(c.pontos, 'a placa NUNCA pune e NUNCA paga').toEqual([]);
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
    c.api.atualizar([{ i: 0, x: a.x, y: a.y }, { i: 1, x: b.x, y: b.y }]);
    expect(c.api.itens()[0].dono).toBe(0);
    expect(c.api.itens()[1].dono).toBe(1);
    c.api.atualizar([{ i: 0, x: 60, y: 60 }, { i: 1, x: 90, y: 70 }]);  // os dois aquém da placa
    const sa = c.filhos.find((s) => s.tex === 'tex:' + a.material && s.x === 60);
    const sb = c.filhos.find((s) => s.tex === 'tex:' + b.material && s.x === 90);
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
//   · deixando de esconder o sprite do item descartado → "[Right] lixeira CERTA" reprova, e o efeito real é a
//     lata continuar desenhada depois de entrar na lixeira.
//   · tirando a `cor` do anúncio de acerto → "[Interface] o anúncio carrega IDENTIFICADOR" reprova, e o efeito
//     real é a fala perder justamente a cor, que é o conteúdo curricular (CONAMA 275/2001).
//   · escolhendo a PRIMEIRA lixeira em vez da mais próxima (em `game/recycling-world.lixeiraSob`) → o caso
//     "[Boundary] ENTRE DUAS LIXEIRAS" do arquivo vizinho reprova; foi um teste daqui que descobriu a falha.
