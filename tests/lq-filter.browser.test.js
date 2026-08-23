// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de render/lq-filter — casca DOM (project BROWSER): cria/reusa o nó <filter id="lq-enh">, monta a
// string de CSS filter, persiste lqT em platform/storage (KEYS.lq = 'incl_lq', migrado do localStorage direto)
// e dispara o `onChange` injetado (game.js recompõe o CSS filter ali — não é responsabilidade deste módulo).
// A curva/rótulo puros (lqCurve/lqName) são testados em lq-filter.node.test.js. Estado do módulo é singleton →
// cada teste normaliza com setLq(0) + initLqFilter(noop) no beforeEach, como tests/fx.node.test.js faz p/ fx.
import { describe, it, expect, beforeEach } from 'vitest';
import { ensureLqFilter, lqFilter, setLq, getLqT, initLqFilter, lqCurve } from '../app/js/render/lq-filter.js';
import * as store from '../app/js/platform/storage.js';

beforeEach(() => {
  document.body.innerHTML = '';
  initLqFilter({ onChange: () => {} });
  setLq(0); // baseline conhecido: desligado (também limpa o localStorage de teste anterior)
});

describe('render/lq-filter — ensureLqFilter', () => {
  it('[Right] cria <filter id="lq-enh"> com 3 feFunc* (R/G/B) tipo table, dentro de uma <svg> aria-hidden', () => {
    const f = ensureLqFilter();
    expect(f.id).toBe('lq-enh');
    expect(f.getAttribute('color-interpolation-filters')).toBe('sRGB');
    const funcs = f.querySelectorAll('feFuncR,feFuncG,feFuncB');
    expect(funcs.length).toBe(3);
    funcs.forEach((fn) => expect(fn.getAttribute('type')).toBe('table'));
    expect(f.closest('svg').getAttribute('aria-hidden')).toBe('true');
  });

  it('[Idempotent] chamadas repetidas devolvem o MESMO nó — não duplica a <svg> no body', () => {
    const f1 = ensureLqFilter();
    const f2 = ensureLqFilter();
    expect(f1).toBe(f2);
    expect(document.querySelectorAll('svg').length).toBe(1);
  });
});

describe('render/lq-filter — lqFilter (string de CSS filter)', () => {
  it('[Boundary] lqT=0 → string vazia, sem criar o nó', () => {
    setLq(0);
    document.body.innerHTML = ''; // prova que lqFilter() não recria o nó quando está OFF
    expect(lqFilter()).toBe('');
    expect(document.getElementById('lq-enh')).toBeNull();
  });

  it('[Right] lqT>0 → "url(#lq-enh)" e garante o nó ANTES de devolver a referência (evita url() solto)', () => {
    setLq(0.5);
    document.body.innerHTML = ''; // apaga o nó criado pelo setLq — lqFilter() deve recriá-lo, não só referenciar
    expect(document.getElementById('lq-enh')).toBeNull();
    expect(lqFilter()).toBe('url(#lq-enh)');
    expect(document.getElementById('lq-enh')).not.toBeNull();
  });
});

describe('render/lq-filter — setLq', () => {
  it('[Boundary] clampa t em [0,1] e persiste em platform/storage sob KEYS.lq', () => {
    setLq(1.4);
    expect(getLqT()).toBe(1);
    expect(store.get(store.KEYS.lq)).toBe('1');
    setLq(-0.4);
    expect(getLqT()).toBe(0);
    expect(store.get(store.KEYS.lq)).toBe('0');
  });

  it('[Right] com t>0, escreve tableValues=lqCurve(t) nos 3 feFunc* do nó existente', () => {
    setLq(0.3);
    const f = document.getElementById('lq-enh');
    const tv = lqCurve(0.3);
    f.querySelectorAll('feFuncR,feFuncG,feFuncB').forEach((fn) => expect(fn.getAttribute('tableValues')).toBe(tv));
  });

  it('[Right] atualiza um filtro JÁ existente no DOM (não recria a <svg>) ao trocar t de novo', () => {
    setLq(0.2);
    const svgCountBefore = document.querySelectorAll('svg').length;
    setLq(0.8);
    expect(document.querySelectorAll('svg').length).toBe(svgCountBefore);
    const f = document.getElementById('lq-enh');
    const tv = lqCurve(0.8);
    f.querySelectorAll('feFuncR,feFuncG,feFuncB').forEach((fn) => expect(fn.getAttribute('tableValues')).toBe(tv));
  });

  it('[Interface] chama o onChange injetado a cada troca — a recomposição do filtro fica em game.js', () => {
    let calls = 0;
    initLqFilter({ onChange: () => { calls++; } });
    setLq(0.2);
    setLq(0.6);
    expect(calls).toBe(2);
  });

  it('[Zero] sem initLqFilter chamado neste teste, onChange default (noop) não lança', () => {
    expect(() => setLq(0.1)).not.toThrow();
  });
});
