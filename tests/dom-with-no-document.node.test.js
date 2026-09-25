// SPDX-License-Identifier: AGPL-3.0-or-later
// A QUERY THAT PROMISES `null` MUST NOT THROW — FINDING 15, in the leaf where it was born.
//
// The path: a game that declares a pointer (ADR-0112) on a device that cannot point FAILS the reach check, which shows
// `ui/reach-notice`, which calls `core/a11y-sr.srAlert`, which calls `ui/dom`'s `$`. Where there is no global
// `document`, reading it is a `ReferenceError`, not `undefined` — so booting the engine against an INJECTED document
// (an iframe, an editor beside the game, this project) would kill `createGame` inside an ANNOUNCEMENT.
//
// 📌 The signature already states the rule: `$<T>(s): T | null`. Returning nothing is an expected result; throwing is
// not. This does not change WHERE the lookup happens — whoever needs another document injects their own, as
// `create-game` and `ui/pause-icons` do. It changes what happens when there is nowhere to look.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { $, $$ } from '../app/js/ui/dom.js';

describe('ui/dom sem documento nenhum (project node)', () => {
  it('⚠️ [Zero] este project NÃO tem `document` — é a premissa do ficheiro, e é afirmada', () => {
    // Without this, the cases below would pass in an environment with a DOM while proving nothing — the kind of false
    // green this repository has caught more than once.
    expect(typeof globalThis.document, 'este caso perdeu o sentido: há DOM aqui').toBe('undefined');
  });

  it('🎯 [Zero] `$` devolve `null` em vez de lançar', () => {
    expect(() => $('#sr-alert')).not.toThrow();
    expect($('#sr-alert')).toBeNull();
  });

  it('🎯 [Zero] `$$` devolve lista vazia em vez de lançar', () => {
    expect(() => $$('.pi-btn')).not.toThrow();
    expect($$('.pi-btn')).toEqual([]);
  });

  it('⚠️ [Right] e um consumidor a jusante sobrevive — o anúncio cala-se, não rebenta', async () => {
    // The real path that brought this to light. A screen reader with no region to write to has nothing to announce;
    // what it must not do is bring the game down over it. Since ADR-0232 D4 the announcer is built over the document it
    // is GIVEN: one with no regions is the case here, and the global it no longer reads is absent too.
    const { createAnnouncer } = await import('../app/js/core/a11y-sr.js');
    const announcer = createAnnouncer({ doc: { querySelector: () => null }, raf: () => { throw new Error('no region, no frame'); } });
    expect(() => announcer.alert('a tecla já está em uso')).not.toThrow();
    expect(() => announcer.say('Jogador 2 entrou')).not.toThrow();
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · 🎯 `$` back to reading the raw global (`document.querySelector(...)`) -> THREE fail: the two direct cases and the
//     downstream consumer's. Not an invented mutation — it is the code that used to be here.
//   · `$$` back to the raw global -> its own case fails. The two are separate on purpose: fixing one and forgetting the
//     other is a defect this repository has already paid for (the `releaseAllKeys` that cleared half the net), and one
//     mutation per function is what catches it.
//   · ⚠️ The PREMISE case (`typeof globalThis.document === 'undefined'`) is not mutated: it exists so the file cannot
//     pass by mistake in an environment WITH a DOM, where the other three would be green while proving nothing.
