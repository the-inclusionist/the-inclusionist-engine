// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/storage is a FACTORY (ADR-0232 point 2, issue #207): `createStorage(backend)` wraps the object it is given and
// reaches no global. What this file holds is what the injection is FOR — two stores built over two backends share nothing,
// which is why two test files (or two roots on one page) stop racing for the same keys — and that the store keeps the
// exception-proof answers the page's `localStorage` used to get.
import { describe, it, expect } from 'vitest';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

/** A backend that throws on every call, as `localStorage` does on file:// and in some private modes. */
const throwing = () => ({
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
});

describe('platform/storage — the store is built around the backend it is given', () => {
  it('🔴 [Right] two stores over two backends share nothing: a key written in one is absent from the other', () => {
    const a = createStorage(memoryBackend());
    const b = createStorage(memoryBackend());
    a.set('incl_tea', 2);
    expect(a.getNum('incl_tea', 0)).toBe(2);
    expect(b.getNum('incl_tea', 0), 'the second store read the first one\'s key').toBe(0);
  });

  it('[Right] every typed read and write goes through the backend', () => {
    const backend = memoryBackend();
    const store = createStorage(backend);
    store.setBool('incl_libras', true);
    store.setJSON('incl_crt2', { scan: 0, vig: 1, round: 2 });
    expect(backend.getItem('incl_libras')).toBe('1');
    expect(store.getBool('incl_libras')).toBe(true);
    expect(store.getJSON('incl_crt2')).toEqual({ scan: 0, vig: 1, round: 2 });
    store.remove('incl_libras');
    expect(backend.getItem('incl_libras')).toBeNull();
  });

  it('[Right] the backend can be seeded — a test starts from exactly the keys it names', () => {
    const store = createStorage(memoryBackend([['incl_lq', '0.5']]));
    expect(store.getNum('incl_lq', 0)).toBe(0.5);
  });

  it('[Right] the legacy inheritance reads the old key only while the new one is absent', () => {
    const store = createStorage(memoryBackend([['incl_activity', 'old']]));
    expect(store.getWithLegacy('incl.g.activity', 'incl_activity', 'none')).toBe('old');
    store.set('incl.g.activity', 'new');
    expect(store.getWithLegacy('incl.g.activity', 'incl_activity', 'none')).toBe('new');
    store.setJSON('incl.g.json', [1]);
    expect(store.getJsonWithLegacy('incl.g.json', 'incl_activity', null)).toEqual([1]);
  });

  it('🔴 [Error] a backend that throws gives every fallback and never throws', () => {
    const store = createStorage(throwing());
    expect(store.get('k', 'fallback')).toBe('fallback');
    expect(store.getNum('k', 7)).toBe(7);
    expect(store.getJSON('k', { a: 1 })).toEqual({ a: 1 });
    expect(store.set('k', 1), 'a refused write must say so').toBe(false);
    expect(() => { store.setJSON('k', {}); store.remove('k'); store.setBool('k', true); }).not.toThrow();
  });

  it('[Boundary] no backend at all (a host with no storage) answers like a throwing one', () => {
    const store = createStorage(null);
    expect(store.get('k', null)).toBeNull();
    expect(store.getBool('k', true)).toBe(true);
    expect(store.set('k', 1)).toBe(false);
  });

  it('[Right] a store spread into another object keeps its backend — `loadLocale({ ...store, … })` does exactly that', () => {
    const store = createStorage(memoryBackend());
    const port = { ...store, extra: true };
    port.set('incl_lang', 'en');
    expect(store.get('incl_lang', null)).toBe('en');
  });
});
