// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de render/cenario-data — o CATÁLOGO de cenários (project node). ZOMBIES + Right-BICEP.
//
// Estas duas tabelas eram, até a etapa D2-b, o dado mais lido e menos protegido do jogo: `render/scene-sky`,
// `game/attract`, o splash e o `setCenario` liam de todas as quatro, e nenhuma linha de teste dizia qual é a
// FORMA de um tema. O que este arquivo protege não é a cor (cor é escolha, e mudar cor é legítimo) — é a
// CORRESPONDÊNCIA entre as tabelas e o CONTRATO que os leitores presumem sem verificar:
//
//   · todo tema `v3` tem `sky`, `cloud`, `hills` (pares) e `decor` — quem lê `T.cloud` não checa antes;
//   · todo tema `v3` tem entrada em `THEME_FLORA` — `scene-sky` faz `const fl = THEME_FLORA[cenario]` e, se
//     não achar, simplesmente NÃO desenha grama. Um tema novo sem flora nasceria careca, sem erro nenhum;
//   · todo nome de `decor` pertence ao vocabulário que `stepV3Decor` sabe interpretar — um 'passaro' no lugar
//     de 'passaros' desliga os pássaros daquele tema para sempre, em silêncio absoluto.
//
// O último bloco PREGA um defeito herdado do monólito (validação por herança de protótipo). Ele NÃO é um
// teste de que a coisa está certa: é um teste de que ela está como está, para que o conserto seja visível.
import { describe, it, expect } from 'vitest';
import { CENARIOS, THEME_FLORA, CENARIO_PADRAO, hexN, normalizarCenario } from '../app/js/render/cenario-data.js';

const IDS = ['cidade', 'campo', 'cemiterio', 'espaco', 'floresta'];
const V3 = IDS.filter((k) => CENARIOS[k].v3);
const HEX = /^#[0-9a-f]{6}$/;
// O vocabulário que render/scene-sky.stepV3Decor sabe interpretar (um `d.includes(...)` por item).
const DECOR_CONHECIDO = ['nuvens', 'passaros', 'borboletas', 'sparkles', 'minhocas', 'nevoa', 'vagalumes'];

describe('CENARIOS — o catálogo', () => {
  it('tem exatamente os cinco cenários do jogo, e a Cidade é o padrão', () => {
    expect(Object.keys(CENARIOS).sort()).toEqual([...IDS].sort());
    expect(CENARIO_PADRAO).toBe('cidade');
    expect(CENARIOS[CENARIO_PADRAO]).toBeTruthy();
  });

  it('todo tema tem nome legível e não vazio (é o rótulo do splash)', () => {
    for (const id of IDS) expect(CENARIOS[id].nome.length).toBeGreaterThan(0);
  });

  it('a Cidade é o único tema NÃO-v3, e não traz cor nenhuma (o fundo dela vem de PNG)', () => {
    expect(CENARIOS.cidade.v3).toBe(false);
    expect(CENARIOS.cidade.sky).toBeUndefined();
    expect(CENARIOS.cidade.hills).toBeUndefined();
    expect(CENARIOS.cidade.cloud).toBeUndefined();
    expect(V3).toHaveLength(4);
  });

  it('CONTRATO: todo tema v3 traz sky/cloud/hills como PARES de #rrggbb e um decor não vazio', () => {
    for (const id of V3) {
      const T = CENARIOS[id];
      for (const campo of ['sky', 'cloud', 'hills']) {
        expect(T[campo], id + '.' + campo).toBeDefined();
        expect(T[campo], id + '.' + campo).toHaveLength(2);
        for (const c of T[campo]) expect(c, id + '.' + campo).toMatch(HEX);
      }
      expect(T.decor, id + '.decor').toBeDefined();
      expect(T.decor.length, id + '.decor').toBeGreaterThan(0);
    }
  });

  it('CONTRATO: todo nome de decor é do vocabulário que scene-sky sabe interpretar', () => {
    for (const id of V3) for (const d of CENARIOS[id].decor) expect(DECOR_CONHECIDO, id + ' → ' + d).toContain(d);
  });

  // `stepV3Decor` desenha nuvem com `if (d.includes('nuvens') && T.cloud)`: pedir nuvem sem paleta não estoura,
  // só não desenha. É este o par que importa — o inverso ("todo tema TEM de usar nuvens") seria uma amarra
  // gratuita contra um tema futuro de céu limpo.
  it('CONTRATO: quem pede "nuvens" no decor tem a paleta cloud (senão a nuvem some sem erro)', () => {
    for (const id of V3) if (CENARIOS[id].decor.includes('nuvens')) expect(CENARIOS[id].cloud, id).toBeDefined();
  });
});

describe('THEME_FLORA — a tabela irmã', () => {
  it('CONTRATO: existe uma flora para CADA tema v3, e para nenhum outro', () => {
    expect(Object.keys(THEME_FLORA).sort()).toEqual([...V3].sort());
    for (const id of V3) expect(THEME_FLORA[id], id).toBeTruthy();
  });

  it('a Cidade não tem flora (e o leitor tem de aguentar o undefined)', () => {
    expect(THEME_FLORA.cidade).toBeUndefined();
  });

  it('toda flora traz as cinco cores e ao menos uma pétala, todas em #rrggbb', () => {
    for (const id of V3) {
      const fl = THEME_FLORA[id];
      for (const campo of ['base', 'top', 'bLt', 'bDk', 'center']) expect(fl[campo], id + '.' + campo).toMatch(HEX);
      expect(fl.petals.length, id + '.petals').toBeGreaterThan(0);
      for (const p of fl.petals) expect(p, id + '.petals').toMatch(HEX);
    }
  });

  it('o tufo CLARO e o ESCURO são cores diferentes (senão a grama vira um bloco chapado)', () => {
    for (const id of V3) expect(THEME_FLORA[id].bLt, id).not.toBe(THEME_FLORA[id].bDk);
  });
});

describe('hexN', () => {
  it('converte #rrggbb para o inteiro que o beginFill do PIXI espera', () => {
    expect(hexN('#000000')).toBe(0x000000);
    expect(hexN('#ffffff')).toBe(0xffffff);
    expect(hexN('#86c5e8')).toBe(0x86c5e8);
  });
  it('Boundary: toda cor das duas tabelas cabe em 24 bits', () => {
    const todas = [];
    for (const id of V3) { const T = CENARIOS[id], fl = THEME_FLORA[id];
      todas.push(...T.sky, ...T.cloud, ...T.hills, fl.base, fl.top, fl.bLt, fl.bDk, fl.center, ...fl.petals); }
    expect(todas.length).toBeGreaterThan(40);
    for (const c of todas) { const n = hexN(c); expect(Number.isNaN(n)).toBe(false); expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(0xffffff); }
  });
});

describe('normalizarCenario', () => {
  it('deixa passar todo tema do catálogo, sem tocar', () => {
    for (const id of IDS) expect(normalizarCenario(id)).toBe(id);
  });
  it('tema desconhecido cai para a Cidade', () => {
    for (const lixo of ['praia', 'noite', 'CAMPO', 'campo ', '']) expect(normalizarCenario(lixo)).toBe('cidade');
  });
  it('Zero/nulo: undefined e null também caem para a Cidade', () => {
    expect(normalizarCenario(undefined)).toBe('cidade');
    expect(normalizarCenario(null)).toBe('cidade');
  });
  it('é idempotente (normalizar duas vezes não muda nada)', () => {
    for (const v of ['campo', 'praia', '']) expect(normalizarCenario(normalizarCenario(v))).toBe(normalizarCenario(v));
  });

  // ⚠️ PREGO DE DEFEITO — não é "certo", é "como está". Ver o cabeçalho de render/cenario-data.ts.
  // `CENARIOS` é objeto literal, logo `CENARIOS['toString']` é a função herdada do Object.prototype: truthy,
  // e portanto aprovada como tema. Só alcançável por valor forjado (localStorage adulterado, __incl), nunca
  // pela UI — que monta o seletor de Object.keys(CENARIOS). Quando for consertado, ESTE teste é que muda.
  it('DEFEITO PREGADO: chave herdada do Object.prototype passa na validação como se fosse tema', () => {
    expect(normalizarCenario('toString')).toBe('toString');
    expect(normalizarCenario('constructor')).toBe('constructor');
    expect(Object.prototype.hasOwnProperty.call(CENARIOS, 'toString')).toBe(false); // e não é tema de verdade
  });
});
