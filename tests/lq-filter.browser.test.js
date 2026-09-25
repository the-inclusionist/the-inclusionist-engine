// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of render/lq-filter — the DOM shell (BROWSER project): creates/reuses the <filter id="lq-enh"> node in the document
// it is handed, builds the CSS filter string, persists the amount in the store `createLqFilter` receives (KEYS.lq =
// 'incl_lq') and fires the injected `onChange` (boot/create-game recomposes the world's CSS filter there — not this
// module's job). The pure curve/label (lqCurve/lqName) are tested in lq-filter.node.test.js. Each case builds its own
// instance over its own store (ADR-0232 D4): the amount lives in the instance, never in the module.
import { describe, it, expect, beforeEach } from 'vitest';
import { createLqFilter, lqCurve } from '../app/js/render/lq-filter.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import { KEYS } from '../app/js/platform/storage-keys.js';

let store, lq;
beforeEach(() => {
  document.body.innerHTML = '';
  store = createStorage(memoryBackend()); // each case its own store (ADR-0232)
  lq = createLqFilter({ doc: document, onChange: () => {}, store }); // known baseline: off
});

describe('render/lq-filter — the <filter> node', () => {
  it('[Right] cria <filter id="lq-enh"> com 3 feFunc* (R/G/B) tipo table, dentro de uma <svg> aria-hidden', () => {
    lq.set(0.5);
    const f = document.getElementById('lq-enh');
    expect(f.getAttribute('color-interpolation-filters')).toBe('sRGB');
    const funcs = f.querySelectorAll('feFuncR,feFuncG,feFuncB');
    expect(funcs.length).toBe(3);
    funcs.forEach((fn) => expect(fn.getAttribute('type')).toBe('table'));
    expect(f.closest('svg').getAttribute('aria-hidden')).toBe('true');
  });

  it('[Idempotent] chamadas repetidas reusam o MESMO nó — não duplica a <svg> no body', () => {
    lq.set(0.5);
    const f1 = document.getElementById('lq-enh');
    lq.filter(); lq.filter();
    expect(document.getElementById('lq-enh')).toBe(f1);
    expect(document.querySelectorAll('svg').length).toBe(1);
  });

  it('🔴 [Right] the node is created in the document the ctx HANDS over, never the global one (ADR-0232 D4)', () => {
    const other = document.implementation.createHTMLDocument('other');
    const elsewhere = createLqFilter({ doc: other, onChange: () => {}, store });
    elsewhere.set(0.4);
    expect(other.getElementById('lq-enh'), 'no node in the handed document').not.toBeNull();
    expect(document.getElementById('lq-enh'), 'a node leaked into the global document').toBeNull();
  });
});

describe('render/lq-filter — filter() (string de CSS filter)', () => {
  it('[Boundary] amount 0 → string vazia, sem criar o nó', () => {
    lq.set(0);
    document.body.innerHTML = ''; // proves filter() does not recreate the node while OFF
    expect(lq.filter()).toBe('');
    expect(document.getElementById('lq-enh')).toBeNull();
  });

  it('[Right] amount>0 → "url(#lq-enh)" e garante o nó ANTES de devolver a referência (evita url() solto)', () => {
    lq.set(0.5);
    document.body.innerHTML = ''; // removes the node set() created — filter() must recreate it, not merely reference it
    expect(document.getElementById('lq-enh')).toBeNull();
    expect(lq.filter()).toBe('url(#lq-enh)');
    expect(document.getElementById('lq-enh')).not.toBeNull();
  });
});

describe('render/lq-filter — set', () => {
  it('[Boundary] clamps t to [0,1] and persists it in the injected store under KEYS.lq', () => {
    lq.set(1.4);
    expect(lq.t()).toBe(1);
    expect(store.get(KEYS.lq)).toBe('1');
    lq.set(-0.4);
    expect(lq.t()).toBe(0);
    expect(store.get(KEYS.lq)).toBe('0');
  });

  it('[Right] com t>0, escreve tableValues=lqCurve(t) nos 3 feFunc* do nó existente', () => {
    lq.set(0.3);
    const f = document.getElementById('lq-enh');
    const tv = lqCurve(0.3);
    f.querySelectorAll('feFuncR,feFuncG,feFuncB').forEach((fn) => expect(fn.getAttribute('tableValues')).toBe(tv));
  });

  it('[Right] atualiza um filtro JÁ existente no DOM (não recria a <svg>) ao trocar t de novo', () => {
    lq.set(0.2);
    const svgCountBefore = document.querySelectorAll('svg').length;
    lq.set(0.8);
    expect(document.querySelectorAll('svg').length).toBe(svgCountBefore);
    const f = document.getElementById('lq-enh');
    const tv = lqCurve(0.8);
    f.querySelectorAll('feFuncR,feFuncG,feFuncB').forEach((fn) => expect(fn.getAttribute('tableValues')).toBe(tv));
  });

  it('[Interface] calls the injected onChange on every change — recomposing the filter is the host\'s (boot/create-game)', () => {
    let calls = 0;
    const counted = createLqFilter({ doc: document, onChange: () => { calls++; }, store });
    counted.set(0.2);
    counted.set(0.6);
    expect(calls).toBe(2);
  });

  it('🔴 [Right] createLqFilter READS the stored amount — at build, not at import (ADR-0232)', () => {
    const stored = createLqFilter({ doc: document, onChange: () => {}, store: createStorage(memoryBackend([[KEYS.lq, '0.5']])) });
    expect(stored.t(), 'the enhancement the child chose did not come back').toBe(0.5);
  });

  it('🔴 [Right] TWO instances keep their own amount (ADR-0232 D4, ADR-0142: two roots share nothing)', () => {
    const a = createLqFilter({ doc: document, onChange: () => {}, store: createStorage(memoryBackend()) });
    const b = createLqFilter({ doc: document, onChange: () => {}, store: createStorage(memoryBackend()) });
    a.set(0.7);
    expect(b.t(), 'the second root sees the first root\'s enhancement').toBe(0);
  });
});
