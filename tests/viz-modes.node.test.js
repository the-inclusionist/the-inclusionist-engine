// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de render/viz-modes — a tabela dos 16 modos visuais e as listas DERIVADAS dela (project node).
//
// ========================= ESTE ARQUIVO NÃO EXISTIA =========================
// `render/viz-modes` é folha, é dado puro e decide TODA a acessibilidade visual do jogo — quem aparece no
// menu de empatia, quem aparece no de visão, qual filtro de CSS cada modo aplica, e agora qual deles precisa
// de um mundo para existir. Nada disso tinha teste próprio: as listas derivadas eram exercitadas de lado,
// pelos testes de quem as consome, e uma tabela errada apareceria como um menu estranho em outro arquivo.
//
// O que os casos perseguem não é a tabela em si (dado literal não erra sozinho): é que as listas DERIVADAS
// continuem derivando. Uma lista que passasse a ser escrita à mão pareceria idêntica até o dia em que alguém
// acrescentasse um modo e ele sumisse de um dos menus, em silêncio.
import { describe, it, expect } from 'vitest';
import {
  VIZ_MODES, VIZ_BY_KEY, VIZ_FILTER, VIZ_CYCLE, VIZ_CORRECTIONS,
  simulatesDisability, needsCanvas, VIZ_DOM_ONLY, VIZ_CANVAS_ONLY,
} from '../app/js/render/viz-modes.js';

describe('a tabela e os índices', () => {
  it('[Right] toda chave é única, e VIZ_BY_KEY cobre todas', () => {
    const chaves = VIZ_MODES.map((m) => m.key);
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const k of chaves) expect(VIZ_BY_KEY[k], k).toBeTruthy();
  });

  it('[Right] VIZ_CYCLE é a ordem da tabela — o ciclo do botão segue a lista, não uma cópia dela', () => {
    expect(VIZ_CYCLE).toEqual(VIZ_MODES.map((m) => m.key));
  });

  it('[Interface] `nome` e `desc` guardam CHAVE i18n, nunca texto', () => {
    // A decisão está escrita no cabeçalho do módulo: uma tabela de `const` com texto resolve UMA vez, no
    // import, e fica congelada no idioma do boot. Este menu é o que uma criança de baixa visão lê para
    // configurar o próprio jogo — em inglês ele viraria a única página que ela não consegue usar.
    for (const m of VIZ_MODES) {
      expect(m.nome, m.key).toMatch(/^viz\./);
      expect(m.desc, m.key).toMatch(/^viz\.desc\./);
    }
  });

  it('[Right] todo modo com filtro de CSS declarado existe na tabela', () => {
    for (const k of Object.keys(VIZ_FILTER)) expect(VIZ_BY_KEY[k], k).toBeTruthy();
  });
});

describe('simulatesDisability — simular contra corrigir', () => {
  it('[Right] as três correções de daltonismo NÃO simulam, e as três simulações simulam', () => {
    // A distinção que o `kind` não fazia e que o ADR-0028 obrigou a fazer: desligar as simulações é o que o
    // "restaurar padrões" do menu de empatia deve fazer; desligar as correções junto tiraria de uma criança
    // daltônica a única correção que ela tem, a partir de um menu feito para quem NÃO tem a condição.
    for (const k of ['fix-protan', 'fix-deuter', 'fix-tritan']) expect(simulatesDisability(k), k).toBe(false);
    for (const k of ['sim-protan', 'sim-deuter', 'sim-tritan']) expect(simulatesDisability(k), k).toBe(true);
  });

  it('[Zero] chave desconhecida não simula — diante do desconhecido, a resposta que não remove nada', () => {
    expect(simulatesDisability('nao-existe')).toBe(false);
    expect(simulatesDisability('')).toBe(false);
  });

  it('[Right] VIZ_CORRECTIONS é DERIVADA: exatamente os filtros que não simulam', () => {
    expect(VIZ_CORRECTIONS.map((m) => m.key).sort())
      .toEqual(VIZ_MODES.filter((m) => m.kind === 'filter' && !m.sim).map((m) => m.key).sort());
    expect(VIZ_CORRECTIONS).toHaveLength(3);
  });
});

/* ===================== AS DUAS PILHAS COM UM NOME SÓ (achado 8, item 19) ===================== */

describe('needsCanvas — qual modo exige um mundo', () => {
  it('[Right] só os `hcnew` precisam de canvas: são os que repintam textura de tile', () => {
    for (const m of VIZ_MODES) expect(needsCanvas(m.key), m.key).toBe(m.kind === 'hcnew');
  });

  it('[Zero] chave desconhecida NÃO exige canvas — a resposta que não tira nada de ninguém', () => {
    // Mesma regra de `simulatesDisability`. Aqui "seguro" é cair na pilha de DOM: um consumidor sem mundo
    // ainda pode oferecer o modo, e o erro na direção oposta seria esconder acessibilidade de quem a usa.
    expect(needsCanvas('nao-existe')).toBe(false);
    expect(needsCanvas('')).toBe(false);
  });
});

describe('VIZ_DOM_ONLY / VIZ_CANVAS_ONLY — a partição', () => {
  it('[Right] juntas são os 16 modos, sem sobra e sem repetição', () => {
    // É o que faz delas uma PARTIÇÃO e não duas listas convenientes. Um modo que caísse fora das duas — ou
    // nas duas — seria um modo cuja pilha ninguém sabe, e o consumidor voltaria a adivinhar.
    expect(VIZ_DOM_ONLY.length + VIZ_CANVAS_ONLY.length).toBe(VIZ_MODES.length);
    const chaves = [...VIZ_DOM_ONLY, ...VIZ_CANVAS_ONLY].map((m) => m.key).sort();
    expect(chaves).toEqual(VIZ_MODES.map((m) => m.key).sort());
    expect(new Set(chaves).size).toBe(VIZ_MODES.length);
  });

  it('[Right] a pilha de CANVAS é exatamente os três `hc-direto`', () => {
    expect(VIZ_CANVAS_ONLY.map((m) => m.key)).toEqual(['hc-direto', 'hc-direto-45', 'hc-direto-7']);
  });

  it('[Many] a pilha que VIAJA é maior do que "os filtros de daltonismo": 13 dos 16', () => {
    // O número importa porque o achado 8 é fácil de ler como "o alto contraste não viaja, então a
    // acessibilidade visual não viaja". Treze modos viajam. O que não viaja são três.
    const chaves = VIZ_DOM_ONLY.map((m) => m.key);
    expect(chaves).toContain('normal');
    expect(chaves).toContain('fix-deuter');
    expect(chaves).toContain('lv-tunnel');
    expect(chaves).toContain('blind');
    expect(VIZ_DOM_ONLY).toHaveLength(13);
  });

  it('[Cross-check] as CORREÇÕES de daltonismo estão todas na pilha que viaja', () => {
    // O caso que liga as duas perguntas sem as misturar: corrigir daltonismo é DOM, e por isso a criança
    // daltônica tem a correção dela em qualquer jogo do catálogo — não só neste.
    const dom = new Set(VIZ_DOM_ONLY.map((m) => m.key));
    for (const c of VIZ_CORRECTIONS) expect(dom, c.key).toContain(c.key);
  });

  it('[Interface] todo modo da pilha de DOM tem filtro declarado, ou é o `normal`', () => {
    // Se um modo diz "não preciso de canvas" e não traz filtro de CSS, ele não faz NADA num jogo sem mundo —
    // e apareceria no menu como uma opção que não muda coisa alguma. É o defeito silencioso desta partição.
    for (const m of VIZ_DOM_ONLY) {
      if (m.key === 'normal') continue;
      expect(VIZ_FILTER[m.key] !== undefined, m.key).toBe(true);
    }
  });
});
