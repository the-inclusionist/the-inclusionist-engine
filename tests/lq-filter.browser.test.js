// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of render/lq-filter — the DOM shell (BROWSER project): creates/reuses the <filter id="lq-enh"> node, builds the
// CSS filter string, persists lqT in the store `initLqFilter` receives (KEYS.lq = 'incl_lq') and fires the injected `onChange`
// (boot/create-game recomposes the world's CSS filter there — not this module's job).
// The pure curve/label (lqCurve/lqName) are tested in lq-filter.node.test.js. Module state is a singleton, so each
// test normalises it with setLq(0) + initLqFilter(noop) in the beforeEach.
import { describe, it, expect, beforeEach } from 'vitest';
import { ensureLqFilter, lqFilter, setLq, getLqT, initLqFilter, lqCurve } from '../app/js/render/lq-filter.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { KEYS } from '../app/js/platform/storage-keys.js';

let store;
beforeEach(() => {
  document.body.innerHTML = '';
  store = createStorage(memoryBackend()); // each case its own store (ADR-0232)
  initLqFilter({ onChange: () => {}, store });
  setLq(0); // known baseline: off
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
    document.body.innerHTML = ''; // proves lqFilter() does not recreate the node while OFF
    expect(lqFilter()).toBe('');
    expect(document.getElementById('lq-enh')).toBeNull();
  });

  it('[Right] lqT>0 → "url(#lq-enh)" e garante o nó ANTES de devolver a referência (evita url() solto)', () => {
    setLq(0.5);
    document.body.innerHTML = ''; // removes the node setLq created — lqFilter() must recreate it, not merely reference it
    expect(document.getElementById('lq-enh')).toBeNull();
    expect(lqFilter()).toBe('url(#lq-enh)');
    expect(document.getElementById('lq-enh')).not.toBeNull();
  });
});

describe('render/lq-filter — setLq', () => {
  it('[Boundary] clamps t to [0,1] and persists it in the injected store under KEYS.lq', () => {
    setLq(1.4);
    expect(getLqT()).toBe(1);
    expect(store.get(KEYS.lq)).toBe('1');
    setLq(-0.4);
    expect(getLqT()).toBe(0);
    expect(store.get(KEYS.lq)).toBe('0');
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

  it('[Interface] calls the injected onChange on every change — recomposing the filter is the host\'s (boot/create-game)', () => {
    let calls = 0;
    initLqFilter({ onChange: () => { calls++; }, store });
    setLq(0.2);
    setLq(0.6);
    expect(calls).toBe(2);
  });

  it('🔴 [Right] initLqFilter READS the stored amount — at init, not at import (ADR-0232)', () => {
    initLqFilter({ onChange: () => {}, store: createStorage(memoryBackend([[KEYS.lq, '0.5']])) });
    expect(getLqT(), 'the enhancement the child chose did not come back').toBe(0.5);
  });

  it('[Zero] sem initLqFilter chamado neste teste, onChange default (noop) não lança', () => {
    expect(() => setLq(0.1)).not.toThrow();
  });
});
