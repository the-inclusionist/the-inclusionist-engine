// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/cenario-data — o CATÁLOGO de cenários (project node). ZOMBIES + Right-BICEP.
//
// Estas duas tabelas eram, até a etapa D2-b, o dado mais lido e menos protegido do jogo: `render/scene-sky`,
// `game/attract`, o splash e o `setCenario` liam de todas as quatro, e nenhuma linha de teste dizia qual é a
// FORMA de um tema. O que este arquivo protege não é a cor (cor é escolha, e mudar cor é legítimo) — é a
// CORRESPONDÊNCIA entre as tabelas e o CONTRATO que os leitores presumem sem verificar:
//
//   · todo tema de fundo GERADO tem `sky`, `cloud`, `hills` (pares) e `decor` — quem lê `T.cloud` não checa;
//   · todo tema COM DECORAÇÃO VIVA tem entrada em `THEME_FLORA` — `scene-sky` faz `const fl =
//     THEME_FLORA[cenario]` e, se não achar, simplesmente NÃO desenha grama. Um tema novo sem flora nasceria
//     careca, sem erro nenhum. O contrato está ancorado em `decor` e NÃO na origem do fundo: o Dev pediu fundo
//     raster para a Floresta, e uma floresta de fundo PNG continua sendo uma floresta com grama e borboletas;
//   · todo nome de `decor` pertence ao vocabulário que `stepV3Decor` sabe interpretar — um 'passaro' no lugar
//     de 'passaros' desliga os pássaros daquele tema para sempre, em silêncio absoluto.
//
// O último bloco PREGA um defeito herdado do monólito (validação por herança de protótipo). Ele NÃO é um
// teste de que a coisa está certa: é um teste de que ela está como está, para que o conserto seja visível.
import { describe, it, expect } from 'vitest';
import { CENARIOS, THEME_FLORA, CENARIO_PADRAO, hexN, normalizarCenario } from '../app/js/render/cenario-data.js';

const IDS = ['cidade', 'campo', 'cemiterio', 'espaco', 'floresta'];
const MORROS = IDS.filter((k) => CENARIOS[k].fundo === 'morros');
const PREDIOS = IDS.filter((k) => CENARIOS[k].fundo === 'predios');
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

  it('a Cidade é o único tema de PRÉDIOS, e traz uma faixa por camada de parallax', () => {
    // Era o único de fundo PNG até o ADR-0042. Agora é gerada como as outras — a diferença é que o relevo
    // dela é skyline e não morro —, e por isso ela ganhou `sky` e perdeu a exceção.
    expect(PREDIOS).toEqual(['cidade']);
    expect(MORROS).toHaveLength(4);
    expect(CENARIOS.cidade.predios).toHaveLength(3); // uma por camada de parallax
    expect(CENARIOS.cidade.hills).toBeUndefined();   // prédio não é morro
    expect(CENARIOS.cidade.sky.length).toBeGreaterThanOrEqual(2);
  });

  it('CONTRATO das faixas de prédio: base na tela, topos crescentes, DUAS profundidades, cores em #rrggbb', () => {
    for (const [i, f] of CENARIOS.cidade.predios.entries()) {
      expect(f.base, `faixa ${i} base`).toBeGreaterThan(0);
      expect(f.base).toBeLessThan(180);
      // `topo` é em y, então o PRIMEIRO número é o mais ALTO na tela e portanto o MENOR.
      for (const t of [f.topo, f.topoFundo]) {
        expect(t[0], `faixa ${i} topo`).toBeLessThan(t[1]);
        expect(t[0]).toBeGreaterThanOrEqual(0);
      }
      // A fileira do FUNDO é mais alta que a da frente — é o que dá a profundidade dentro da camada.
      expect(f.topoFundo[0], `faixa ${i}`).toBeLessThan(f.topo[0]);
      expect(f.corpo, `faixa ${i}: sem os dois tons a camada vira uma fileira só`).toHaveLength(2);
      expect(f.largura[0]).toBeGreaterThan(0);
      expect(f.largura[0]).toBeLessThanOrEqual(f.largura[1]);
      for (const c of [...f.corpo, ...(f.luz || [])]) expect(c, `faixa ${i}`).toMatch(HEX);
    }
  });

  it('a LUZ é quente (R > B) e cresce com a proximidade — foi assim que o original se mediu', () => {
    // A leitura errada desta propriedade é o que produziu a primeira arte, cinza: eu tinha tomado dois tons
    // de MASSA por "janela acesa/apagada". Separando por temperatura, luz é o que tem R maior que B.
    const rgb = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const acesos = [];
    for (const [i, f] of CENARIOS.cidade.predios.entries()) {
      expect(f.luz, `faixa ${i} sem luz`).toBeTruthy();
      for (const c of f.luz) {
        const [r, , b] = rgb(c);
        expect(r, `faixa ${i}: ${c} não é quente`).toBeGreaterThan(b);
      }
      // e a massa é FRIA, senão os dois se confundem — que foi exatamente o erro
      for (const c of f.corpo) {
        const [r, , b] = rgb(c);
        expect(b, `faixa ${i}: massa ${c} não é fria`).toBeGreaterThanOrEqual(r);
      }
      acesos.push(f.aceso);
    }
    expect(acesos[2]).toBeGreaterThan(acesos[1]);
    expect(acesos[1]).toBeGreaterThan(acesos[0]);
  });

  it('CONTRATO: todo tema de fundo GERADO traz cloud/hills como PARES de #rrggbb e decor não vazio', () => {
    for (const id of MORROS) {
      const T = CENARIOS[id];
      for (const campo of ['cloud', 'hills']) {
        expect(T[campo], id + '.' + campo).toBeDefined();
        expect(T[campo], id + '.' + campo).toHaveLength(2);
        for (const c of T[campo]) expect(c, id + '.' + campo).toMatch(HEX);
      }
      expect(T.decor, id + '.decor').toBeDefined();
      expect(T.decor.length, id + '.decor').toBeGreaterThan(0);
    }
  });

  it('CONTRATO: o céu é uma LISTA de paradas — duas ou mais, todas #rrggbb', () => {
    // Este caso exigia exatamente DUAS e reprovou o pôr do sol da Floresta, com razão: o contrato tinha
    // mudado. Um par continua sendo válido (é o que os outros três temas são), mas "par" deixou de ser a
    // regra — o que a regra sempre quis dizer é "cores de verdade, e mais de uma".
    for (const id of MORROS) {
      const ceu = CENARIOS[id].sky;
      expect(ceu, id + '.sky').toBeDefined();
      expect(ceu.length, id + '.sky').toBeGreaterThanOrEqual(2);
      for (const c of ceu) expect(c, id + '.sky').toMatch(HEX);
    }
  });

  it('a Floresta é um PÔR DO SOL: vermelho na linha do horizonte, amarelo acima dela', () => {
    // O que este caso guarda não é o gosto, é a ARITMÉTICA que põe a cor na altura certa. Com N paradas
    // igualmente espaçadas, a de índice i cai em y = 180·i/(N-1); com sete, o índice 3 é y=90 — a linha do
    // horizonte — e o índice 2 é y=60. Trocar a quantidade de paradas sem refazer a conta desloca o pôr do
    // sol inteiro para fora da tela, em silêncio, porque nada além disto confere onde uma cor cai.
    const ceu = CENARIOS.floresta.sky, n = ceu.length;
    const y = (i) => 180 * i / (n - 1);
    const vermelho = ceu.indexOf('#e0392c'), amarelo = ceu.indexOf('#ffd166');
    expect(y(vermelho)).toBe(90);
    expect(y(amarelo)).toBe(60);
    expect(amarelo).toBeLessThan(vermelho); // amarelo ACIMA do vermelho: é o que faz o laranja no meio
  });

  it('a Floresta é o único tema com SOL, e ele fica na altura do horizonte', () => {
    // `y` acima de 0.5 esconderia o disco inteiro atrás dos morros e o leque de raios sairia do nada; muito
    // abaixo e ele vira um sol de meio-dia, que é o oposto do que foi pedido.
    expect(CENARIOS.floresta.sol).toBeDefined();
    expect(CENARIOS.floresta.sol.cor).toMatch(HEX);
    expect(CENARIOS.floresta.sol.y).toBeGreaterThan(0.40);
    expect(CENARIOS.floresta.sol.y).toBeLessThanOrEqual(0.50);
    expect(MORROS.filter((id) => CENARIOS[id].sol)).toEqual(['floresta']);
  });

  it('CONTRATO: todo nome de decor é do vocabulário que scene-sky sabe interpretar', () => {
    for (const id of MORROS) for (const d of CENARIOS[id].decor) expect(DECOR_CONHECIDO, id + ' → ' + d).toContain(d);
  });

  // `stepV3Decor` desenha nuvem com `if (d.includes('nuvens') && T.cloud)`: pedir nuvem sem paleta não estoura,
  // só não desenha. É este o par que importa — o inverso ("todo tema TEM de usar nuvens") seria uma amarra
  // gratuita contra um tema futuro de céu limpo.
  it('CONTRATO: quem pede "nuvens" no decor tem a paleta cloud (senão a nuvem some sem erro)', () => {
    for (const id of MORROS) if (CENARIOS[id].decor.includes('nuvens')) expect(CENARIOS[id].cloud, id).toBeDefined();
  });
});

describe('THEME_FLORA — a tabela irmã', () => {
  it('CONTRATO: existe uma flora para cada tema COM DECOR, e para nenhum outro', () => {
    // Ancorado em `decor`, não em `fundo`. Se estivesse ancorado no fundo, dar arte raster à Floresta
    // quebraria este caso sem que nada de errado tivesse acontecido — e o jeito rápido de "consertar" seria
    // tirar a flora dela, que é exatamente o estrago que a separação do antigo `v3` existe para evitar.
    const comDecor = IDS.filter((k) => (CENARIOS[k].decor ?? []).length > 0);
    expect(Object.keys(THEME_FLORA).sort()).toEqual([...comDecor].sort());
    for (const id of comDecor) expect(THEME_FLORA[id], id).toBeTruthy();
  });

  it('a Cidade não tem flora (e o leitor tem de aguentar o undefined)', () => {
    expect(THEME_FLORA.cidade).toBeUndefined();
  });

  it('toda flora traz as cinco cores e ao menos uma pétala, todas em #rrggbb', () => {
    for (const id of MORROS) {
      const fl = THEME_FLORA[id];
      for (const campo of ['base', 'top', 'bLt', 'bDk', 'center']) expect(fl[campo], id + '.' + campo).toMatch(HEX);
      expect(fl.petals.length, id + '.petals').toBeGreaterThan(0);
      for (const p of fl.petals) expect(p, id + '.petals').toMatch(HEX);
    }
  });

  it('o tufo CLARO e o ESCURO são cores diferentes (senão a grama vira um bloco chapado)', () => {
    for (const id of MORROS) expect(THEME_FLORA[id].bLt, id).not.toBe(THEME_FLORA[id].bDk);
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
    for (const id of MORROS) { const T = CENARIOS[id], fl = THEME_FLORA[id];
      todas.push(...T.sky, ...T.cloud, ...T.hills, fl.base, fl.top, fl.bLt, fl.bDk, fl.center, ...fl.petals); }
    // A Cidade entra pelas cores DELA — o céu e os seis tons de prédio. Antes ela não entrava neste caso
    // nenhum, porque não tinha cor: era um PNG.
    for (const id of PREDIOS) { const T = CENARIOS[id];
      todas.push(...T.sky);
      for (const f of T.predios) todas.push(...f.corpo, ...(f.luz || [])); }
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
