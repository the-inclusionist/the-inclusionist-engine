// SPDX-License-Identifier: AGPL-3.0-or-later
// EACH TEST FILE KEEPS ITS OWN STORAGE, AND A ROOT KEEPS THE CHILD'S SETTINGS WHERE ITS HOST SAYS (ADR-0232, issue #207).
//
// The browser suite's instability (F9) was a race: ~115 files on one origin, one `localStorage`, files writing the same
// keys while others booted. The structural answer is that the engine reaches no storage by import — a root builds its
// store from what its host lends — so the suite can lend each file its own. This file holds both halves:
//   · the harness: this file's window storage is the file's own backend, empty at the start, not the origin's `Storage`;
//   · the engine: a root writes where its host says — the window's storage when the host lends only a window, and
//     `host.storage` when it lends one, which then wins.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, afterEach } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';
import { fileBackend } from './fixtures/file-storage.js';
import { memoryBackend } from '../app/js/platform/storage.js';

// Read before any case writes: what this file inherited from the rest of the suite.
const inheritedKeys = localStorage.length;

const declaration = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});

const roots = [];
let host;
async function boot(extraHost = {}) {
  const { createGame } = await import('../app/js/boot/create-game.js');
  host = document.createElement('div');
  host.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region"></div><div id="title-icons"></div>';
  document.body.appendChild(host);
  const root = createGame({ accommodations: SEM_ASSUNTO, declaration: declaration(), downloadHeavy: false,
    host: { doc: document, win: window, ...extraHost } });
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const r of roots.splice(0)) r.dispose();
  host?.remove();
  document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove());
});

describe('the harness lends each file its own storage', () => {
  it('🔴 [Right] this file\'s window storage is its own backend — not the origin\'s, and empty when the file began', () => {
    expect(window.localStorage, 'the window still lends the origin\'s storage, which every file shares').toBe(fileBackend);
    expect(localStorage instanceof Storage, 'the origin\'s Storage is still in place').toBe(false);
    expect(inheritedKeys, 'this file began with keys another file wrote').toBe(0);
  });
});

describe('a root keeps the child\'s settings where its host says (ADR-0232)', () => {
  it('🔴 [Right] lent only a window, the root keeps the calm level in THAT window\'s storage', async () => {
    await boot();
    document.querySelector('#title-icons [data-pi="tea"]').click();
    expect(fileBackend.getItem('incl_tea'), 'the root kept the calm level somewhere its host did not lend').toBe('1');
    fileBackend.removeItem('incl_tea');
  });

  it('🔴 [Right] lent a storage, the root keeps it THERE, and the window\'s is left alone', async () => {
    const storage = memoryBackend();
    await boot({ storage });
    document.querySelector('#title-icons [data-pi="tea"]').click();
    expect(storage.getItem('incl_tea'), 'the lent storage did not receive the calm level').toBe('1');
    expect(fileBackend.getItem('incl_tea'), 'the root wrote past the storage its host lent').toBeNull();
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   S1 the browser setup not lending the file's backend to the window    🔴 the harness case, and «lent only a window»
//   S2 `hostStorage` ignoring `host.storage`                              🔴 the «lent a storage» case
//   S3 `hostStorage` ignoring the window (`null` when no storage is lent)  🔴 the «lent only a window» case
