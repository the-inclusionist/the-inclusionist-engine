// SPDX-License-Identifier: AGPL-3.0-or-later
// `bearing` — PARA ONDE FICA O ALVO, nas palavras que a topologia declarou (ADR-0089, achado O4).
//
// O que isto substitui vale ser dito, porque o defeito era de acessibilidade e não de estilo. O sonar
// (`platform/audio-sonar.ts:176`) calculava o lado à mão, de `x` cru, com zona morta de ±4:
//
//     alvo.at.x < pl.x - 4 ? 'left' : alvo.at.x > pl.x + 4 ? 'right' : 'ahead'
//
// ⚠️ TRÊS PALAVRAS ONDE O CONTRATO TEM OITO — e, pior, MISTURANDO REFERENCIAIS. «esquerda» e «direita» são
// relativas à TELA; «à frente» é relativa ao CORPO. Uma criança cega que ouve as duas na mesma frase não tem
// como saber de que origem cada uma fala. E tudo o que estivesse acima ou abaixo dela virava «à frente» —
// a informação que mais falta a quem não vê a tela, apagada por uma zona morta.
//
// ⚠️ E ISTO NÃO É `Focus.heading`. Aquele é para onde a criança está VIRADA; este é para onde está o ALVO.
// São dois ângulos diferentes e o sonar precisa do segundo.
import { describe, it, expect } from 'vitest';
import { bearing } from '../app/js/core/contract.js';

const P = (x, y, z) => (z === undefined ? { x, y } : { x, y, z });
const O = P(0, 0);

const ROSA = { kind: 'grid', size: [9, 9], move: 'diagonal', frame: 'compass' };
const LADO = { kind: 'continuous', size: [100, 100], unit: 16, move: 'free', frame: 'clock' };
const CUBO = { kind: 'grid', size: [9, 9, 9], move: 'orthogonal', frame: 'compass' };
const LISTA = { kind: 'hotspots', order: ['q1', 'q2'] };

describe('rosa-dos-ventos — e `y` cresce para BAIXO, que é o detalhe que inverte tudo', () => {
  // ⚠️ O eixo vertical da TELA aponta para baixo: é a coordenada da canvas, herdada de todo o código que já
  // existe. Quem escrever `atan2(dy, dx)` em vez de `atan2(-dy, dx)` produz uma rosa perfeitamente coerente e
  // perfeitamente invertida — norte por sul —, e nada além destes casos a apanha.
  const casos = [
    ['e', P(5, 0)], ['w', P(-5, 0)],
    ['n', P(0, -5)], ['s', P(0, 5)],
    ['ne', P(5, -5)], ['nw', P(-5, -5)],
    ['se', P(5, 5)], ['sw', P(-5, 5)],
  ];
  it.each(casos)('[Right] o alvo em %s sai como %s', (esperado, alvo) => {
    expect(bearing(ROSA, O, alvo)).toEqual({ kind: 'compass', heading: esperado });
  });

  it('[Right] ⚠️ NORTE é para CIMA — o caso que apanha a rosa invertida', () => {
    // Escrito à parte do `it.each` de propósito: se alguém "arrumar" a tabela acima trocando os pares, este
    // continua a dizer o que a palavra tem de significar, sem depender da tabela.
    expect(bearing(ROSA, O, P(0, -1)).heading).toBe('n');
    expect(bearing(ROSA, O, P(0, 1)).heading).toBe('s');
  });

  it('[Boundary] o setor é de 45°, e a fronteira cai para o vizinho e não para o vazio', () => {
    expect(bearing(ROSA, O, P(10, -3)).heading).toBe('e');   // 16,7° — ainda leste
    expect(bearing(ROSA, O, P(10, -10)).heading).toBe('ne'); // 45° — nordeste cheio
    expect(bearing(ROSA, O, P(3, -10)).heading).toBe('n');   // 73,3° — já norte
  });
});

describe('relógio — a vista LATERAL, onde norte e sul não querem dizer nada', () => {
  // 12 horas é para CIMA e os ponteiros andam no sentido HORÁRIO. O erro fácil é medir no sentido
  // trigonométrico, que é anti-horário: aí 3 horas sai onde devia estar 9, e a frase fica coerente e errada.
  const casos = [[12, P(0, -5)], [3, P(5, 0)], [6, P(0, 5)], [9, P(-5, 0)], [2, P(5, -5)], [8, P(-5, 5)]];
  it.each(casos)('[Right] %i horas', (hora, alvo) => {
    expect(bearing(LADO, O, alvo)).toEqual({ kind: 'clock', hour: hora });
  });

  it('[Boundary] a hora é 1..12 e NUNCA 0 — «às 0 horas» não é coisa que se diga', () => {
    // O `% 12` devolve 0 para o topo, e 0 é a única saída que um mostrador não tem. Um `hour: 0` chegaria à
    // narração como chave de tradução inexistente, e o leitor de tela calaria — o defeito mais silencioso que
    // existe neste produto.
    for (let a = 0; a < 360; a += 7) {
      const r = bearing(LADO, O, P(Math.cos((a * Math.PI) / 180) * 9, -Math.sin((a * Math.PI) / 180) * 9));
      expect(r.hour, `${a}°`).toBeGreaterThanOrEqual(1);
      expect(r.hour, `${a}°`).toBeLessThanOrEqual(12);
    }
  });

  it('[Interface] o MESMO alvo dá palavras diferentes conforme o referencial declarado', () => {
    // O par que prova que o campo é lido, e não que os dois fixtures por acaso diferem noutra coisa.
    expect(bearing({ ...ROSA, frame: 'compass' }, O, P(5, -5))).toEqual({ kind: 'compass', heading: 'ne' });
    expect(bearing({ ...ROSA, frame: 'clock' }, O, P(5, -5))).toEqual({ kind: 'clock', hour: 2 });
  });
});

describe('o eixo vertical do ESPAÇO — zênite e nadir', () => {
  it('[Right] `z` cresce para CIMA: acima é zênite, abaixo é nadir', () => {
    // ⚠️ Convenção OPOSTA à do `y`, e escolhida: nada força a orientação do terceiro eixo, e «zênite» só pode
    // querer dizer o lado para onde a criança olharia levantando a cabeça. O `y` é para baixo porque é
    // coordenada de tela, herdada; o `z` é para cima porque é coordenada de mundo, decidida.
    expect(bearing(CUBO, P(0, 0, 0), P(0, 0, 5))).toEqual({ kind: 'compass', heading: 'zenith' });
    expect(bearing(CUBO, P(0, 0, 0), P(0, 0, -5))).toEqual({ kind: 'compass', heading: 'nadir' });
  });

  it('[Boundary] o vertical só ganha quando DOMINA o plano', () => {
    expect(bearing(CUBO, P(0, 0, 0), P(10, 0, 1)).heading).toBe('e');       // quase tudo no plano
    expect(bearing(CUBO, P(0, 0, 0), P(1, 0, 10)).heading).toBe('zenith');  // quase tudo na vertical
  });

  it('[Zero] ⚠️ numa topologia de DUAS dimensões o `z` é IGNORADO, mesmo que o ponto o traga', () => {
    // A dimensão é `size.length`, não o que o ponto por acaso carrega. Sem isto, um `z` esquecido num fixture
    // 2D mandaria a narração dizer «zênite» num jogo que não tem altura nenhuma.
    expect(bearing(ROSA, P(0, 0, 0), P(5, 0, 99))).toEqual({ kind: 'compass', heading: 'e' });
    expect(bearing(LADO, P(0, 0, 0), P(0, -5, 99))).toEqual({ kind: 'clock', hour: 12 });
  });

  it('[Interface] zênite e nadir saem como COMPASSO mesmo num jogo de relógio', () => {
    // Um mostrador não tem posição para «acima do plano». Devolver uma hora aqui seria inventar direção.
    expect(bearing({ ...CUBO, frame: 'clock' }, P(0, 0, 0), P(0, 0, 5)))
      .toEqual({ kind: 'compass', heading: 'zenith' });
  });
});

describe('quando não há direção que dizer', () => {
  it('[Zero] o mesmo lugar não tem rumo — e inventar um seria mentir', () => {
    expect(bearing(ROSA, P(3, 4), P(3, 4))).toEqual({ kind: 'none' });
    expect(bearing(LADO, P(3, 4), P(3, 4))).toEqual({ kind: 'none' });
    expect(bearing(CUBO, P(3, 4, 5), P(3, 4, 5))).toEqual({ kind: 'none' });
  });

  it('[Zero] uma LISTA não tem espaço, logo não tem direção', () => {
    expect(bearing(LISTA, P(0, 0), P(3, 0))).toEqual({ kind: 'none' });
  });
});
