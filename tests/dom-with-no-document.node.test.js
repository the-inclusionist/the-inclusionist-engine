// SPDX-License-Identifier: AGPL-3.0-or-later
// AN ANNOUNCEMENT WITH NOWHERE TO WRITE STAYS SILENT — FINDING 15, where it was born.
//
// The path: a game that declares a pointer (ADR-0112) on a device that cannot point FAILS the reach check, which shows
// `ui/reach-notice`, which announces through the root's announcer. Booting the engine against an INJECTED document (an
// iframe, an editor beside the game, this project) must not kill `createGame` inside an ANNOUNCEMENT.
//
// 📌 Since ADR-0232 D4 no module reads the page-wide `document`: the global selectors `$`/`$$` this file used to hold to
// «return `null`, never throw» are gone, and the announcer queries the document it is GIVEN. What is left to prove is
// the downstream half: a document with no regions, and a host with no frames, silence the announcement instead of
// throwing.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';

describe('an announcer with no document regions (project node)', () => {
  it('⚠️ [Zero] this project has NO `document` — the file\'s premise, asserted', () => {
    // Without this, the case below would pass in an environment with a DOM while proving nothing.
    expect(typeof globalThis.document, 'this case lost its point: there is a DOM here').toBe('undefined');
  });

  it('⚠️ [Right] a downstream consumer survives — the announcement goes quiet, it does not throw', async () => {
    const { createAnnouncer } = await import('../app/js/core/a11y-sr.js');
    const announcer = createAnnouncer({ doc: { querySelector: () => null }, raf: () => { throw new Error('no region, no frame'); } });
    expect(() => announcer.alert('a tecla já está em uso')).not.toThrow();
    expect(() => announcer.say('Jogador 2 entrou')).not.toThrow();
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · the announcer writing into a region it did not find (dropping its `null` guard) -> the downstream case fails.
//   · ⚠️ The PREMISE case is not mutated: it exists so the file cannot pass by mistake in an environment WITH a DOM.
//   · The `$`/`$$` cases left with the functions (ADR-0232 D4); their mutations have no subject any more.
