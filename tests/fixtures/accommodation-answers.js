// SPDX-License-Identifier: AGPL-3.0-or-later
// tests/fixtures/accommodation-answers — the cartridge's answer to its accommodations (ADR-0153), for tests.
//
// Since ADR-0153 `createGame` and `mount()` REFUSE a cartridge that does not answer the sixteen game-keyed
// accommodations. Most boot tests measure something else, so they answer the plainest true thing: no subject
// anywhere. A case that measures an accommodation builds its own answer with `comAssunto`.
import { GAME_KEYED } from '../../app/js/core/accommodations.js';

/** Every game-keyed accommodation answered `false` — a game with no subject for any of them. */
export const SEM_ASSUNTO = Object.freeze(Object.fromEntries(GAME_KEYED.map((k) => [k, false])));

/** The same answer, with these accommodations given a word. */
export function comAssunto(palavras) {
  return Object.freeze({ ...SEM_ASSUNTO, ...palavras });
}
