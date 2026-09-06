// SPDX-License-Identifier: AGPL-3.0-or-later
// O gate da MIGRAÇÃO DE DADO SALVO (issue #103, e é a metade que mexe no navegador da criança).
//
// ⚠️ O QUE ESTÁ EM JOGO NÃO É COMPATIBILIDADE, É UMA ADAPTAÇÃO. Quem remapeou teclas normalmente remapeou por
// necessidade — alcance de mão, dedo que não estica, teclado sem numpad. Um esquema salvo com as chaves
// antigas que deixe de casar não dá erro: as teclas simplesmente param de responder, e a criança conclui que
// o jogo quebrou. Perder isso é perder uma adaptação, não uma preferência.
import { describe, it, expect } from 'vitest';
import { migrarEsquema, migrarSalvo, VOCABULARIO_ANTIGO } from '../app/js/input/vocabulary-migration.js';

/** Um esquema tal como está salvo hoje, no vocabulário de plataforma. */
const ANTIGO = {
  left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
  run: ['KeyU'], jump: ['KeyJ', 'Space'], swap: ['KeyI'], especial: ['KeyK'],
};

describe('a tradução segue o ADR-0086, e não o ADR-0074', () => {
  it('⚠️ `run` é `action1` e `jump` é `action2` — a tabela do 0074 movia a tecla da criança', () => {
    expect(VOCABULARIO_ANTIGO).toEqual({
      run: 'action1', jump: 'action2', especial: 'action3', swap: 'action4',
    });
  });

  it('cada tecla chega à posição certa, sem se mover', () => {
    const novo = migrarEsquema(ANTIGO);
    expect(novo.action1).toEqual(['KeyU']);          // correr
    expect(novo.action2).toEqual(['KeyJ', 'Space']); // pular
    expect(novo.action3).toEqual(['KeyK']);          // especial
    expect(novo.action4).toEqual(['KeyI']);          // trocar
  });

  it('as direções atravessam intactas — nunca mudaram de nome', () => {
    const novo = migrarEsquema(ANTIGO);
    expect(novo.left).toEqual(['KeyA']);
    expect(novo.right).toEqual(['KeyD']);
    expect(novo.up).toEqual(['KeyW']);
    expect(novo.down).toEqual(['KeyS']);
  });

  it('⚠️ NENHUMA tecla se perde: o conjunto de códigos é o mesmo antes e depois', () => {
    // A asserção que vale, porque é a única que apanha um erro de tradução de QUALQUER chave, inclusive
    // uma que este teste não pensou em nomear.
    const codigos = (e) => [...new Set(Object.values(e).flat())].sort();
    expect(codigos(migrarEsquema(ANTIGO))).toEqual(codigos(ANTIGO));
  });
});

describe('a função aguenta o mundo real', () => {
  it('é IDEMPOTENTE — aplicada duas vezes dá o mesmo', () => {
    // `loadKB` pode correr mais de uma vez na mesma sessão; uma migração que estragasse na segunda
    // passagem falharia longe da causa.
    const uma = migrarEsquema(ANTIGO);
    expect(migrarEsquema(uma)).toEqual(uma);
  });

  it('chave desconhecida atravessa em vez de ser apagada', () => {
    const comLixo = { ...ANTIGO, action7: ['KeyO'], qualquer: ['F13'] };
    const novo = migrarEsquema(comLixo);
    expect(novo.action7).toEqual(['KeyO']);
    expect(novo.qualquer).toEqual(['F13']);
  });

  it('esquema meio migrado UNE as duas chaves em vez de perder uma', () => {
    // Perder uma tecla é o dano; ter a mesma duas vezes não é.
    const meio = { jump: ['KeyJ'], action2: ['Space'] };
    expect(migrarEsquema(meio).action2.sort()).toEqual(['KeyJ', 'Space']);
  });

  it('nulo e indefinido não estouram', () => {
    expect(migrarEsquema(null)).toBeNull();
    expect(migrarEsquema(undefined)).toBeNull();
    expect(migrarSalvo(null)).toBeNull();
  });
});

describe('o objeto salvo inteiro, com os quatro formatos que existem', () => {
  it('solo, p2, p3 e p4 são todos traduzidos', () => {
    const salvo = { solo: ANTIGO, p2: [ANTIGO, ANTIGO], p3: [ANTIGO], p4: [ANTIGO, ANTIGO, ANTIGO, ANTIGO] };
    const novo = migrarSalvo(salvo);
    expect(novo.solo.action2).toEqual(['KeyJ', 'Space']);
    expect(novo.p2).toHaveLength(2);
    expect(novo.p2[1].action1).toEqual(['KeyU']);
    expect(novo.p3[0].action3).toEqual(['KeyK']);
    expect(novo.p4[3].action4).toEqual(['KeyI']);
  });

  it('⚠️ o formato mais antigo, `p34`, também é traduzido — ele já sobreviveu a uma migração', () => {
    // `loadKB` migra a FORMA de `p34` para p3+p4 desde antes; se o vocabulário não fosse migrado aqui,
    // o dado mais velho de todos seria o único a se perder.
    const novo = migrarSalvo({ p34: [ANTIGO, null, ANTIGO] });
    expect(novo.p34[0].action2).toEqual(['KeyJ', 'Space']);
    expect(novo.p34[1]).toBeNull();
    expect(novo.p34[2].action1).toEqual(['KeyU']);
  });

  it('grupo ausente continua ausente — não se inventa esquema', () => {
    const novo = migrarSalvo({ solo: ANTIGO });
    expect(novo.p2).toBeUndefined();
    expect(novo.p3).toBeUndefined();
    expect(novo.p4).toBeUndefined();
  });
});
