// SPDX-License-Identifier: AGPL-3.0-or-later
// A CARTRIDGE DECLARES A LIBRARY FONT, AND THE ENGINE DOES THE REST — or says why not (ADR-0255).
//
// The engine packages only its own faces. A game that draws in a family of the font library declares it (`uses.fonts`); the root
// writes the family's `@font-face` rules itself, pointing at the delivery's `heavy/` on the page's own origin (where the service
// worker answers from the checked cache), and keeps each file in that cache, checked by sha256. This page is served by the test
// server, which carries NO delivery: every face is asked for and not found — exactly the delivery built without `--fonts`, which
// must be a line of `problems` naming the family and the fix, never a silent fallback.
//
// 📌 ONE ROOT PER FILE, for the reason the gamepad file carries: two roots on a page find each other through document-wide queries.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

let motor;
const reports = [];
const declaracao = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'a', gender: 'f', plural: false }), focusOf: () => null,
  objectiveOf: () => ({ name: { text: 'a', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [],
});
const until = async (ok, ms = 8000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 25))) if (ok()) return true;
  return false;
};
const sheet = () => document.getElementById('incl-library-fonts')?.textContent ?? '';
// the typography a child left stored: a library face (Inter) this game does NOT declare — restored after, the origin is shared
const storedBefore = localStorage.getItem('incl_font_k');

beforeAll(async () => {
  localStorage.setItem('incl_font_k', 'inter');
  document.body.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"><div id="title-icons"></div></div>';
  const { createGame } = await import('../app/js/boot/create-game.js');
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaracao(), host: { doc: document, win: window }, players: [{ ctrl: 0 }],
    // two library families, one the engine packages itself (declaring it asks for nothing), one the library does not hold
    uses: { fonts: ['Lato', 'Press Start 2P', 'Andika', 'Nobody Sans'] },
    onHeavyProgress: (r) => reports.push(r),
  });
  await until(() => sheet() !== '');
});
afterAll(() => {
  motor?.dispose(); document.body.innerHTML = ''; document.getElementById('incl-library-fonts')?.remove();
  if (storedBefore === null) localStorage.removeItem('incl_font_k'); else localStorage.setItem('incl_font_k', storedBefore);
  for (const k of ['fonte', 'cursiva']) delete document.documentElement.dataset[k];
  document.documentElement.style.removeProperty('--font-custom');
});

describe('a cartridge that declares library fonts', () => {
  it('🔴 [Right] gets their @font-face rules, written by the engine, each at the delivery\'s heavy/ on the page\'s origin', () => {
    const css = sheet();
    expect(css, 'no rule was written for a declared library family').toContain("font-family:'Lato'");
    expect(css).toContain("font-family:'Press Start 2P'");
    const heavy = new URL('heavy/lfs-oinclusionista.jrocha.dev.br/fonts/lato/lato-400.woff2', document.baseURI).href;
    expect(css, 'the face does not point at the delivery\'s heavy/').toContain(`url('${heavy}')`);
    // the author's original covers the family: no unicode-range cuts it (ADR-0254)
    expect(css.split('\n').find((r) => r.includes("'Lato'")), 'an original was cut by a unicode-range').not.toContain('unicode-range');
    expect(css, 'an engine face was declared again from the library').not.toContain("'Andika'");
    expect(css).not.toContain('Nobody Sans');
  });

  it('🔴 [Right] each face is asked for FIRST, and one the delivery does not carry is a line of `problems` naming the family and the fix', async () => {
    expect(await until(() => motor.problems.some((l) => l.startsWith('font «Lato»'))), 'an undelivered family was not reported').toBe(true);
    const line = motor.problems.find((l) => l.startsWith('font «Lato»'));
    expect(line).toContain('`uses.fonts`');
    expect(line, 'the line does not say how to fix it').toContain('--fonts "Lato"');
    // the fonts come before the heavy catalogue: a few hundred KB the child sees do not wait behind the models
    expect(reports[0]?.id, 'the first file kept was not a declared font').toMatch(/^font:/);
    // said ONCE per family, however many of its files failed
    expect(motor.problems.filter((l) => l.startsWith('font «Lato»')).length).toBe(1);
  });

  it('🔴 [Right] a family the library does not hold is said by name; an engine face declared is said nothing of', () => {
    expect(motor.problems.some((l) => l.startsWith('font «Nobody Sans»') && l.includes('no such family')), 'an unknown family passed in silence')
      .toBe(true);
    expect(motor.problems.some((l) => l.includes('«Andika»')), 'declaring an engine face was reported as a problem').toBe(false);
  });

  it('🔴 [Right] a stored library face this game did NOT declare is drawn as the default — and the choice stays stored', () => {
    // `document.fonts.check` would answer true for Inter (no rule declares it, so nothing to load): the root asks the declaration
    expect(document.documentElement.dataset.fonte, 'a face with no @font-face was applied: the child reads the system font')
      .toBe('padrao');
    expect(localStorage.getItem('incl_font_k'), 'the child\'s stored choice was written over').toBe('inter');
  });
});

// MUTATIONS CHECKED (2026-09-27), each applied by script — the anchor counted, exactly once — and restored from a copy by sha256:
//   B1 the root points the face at the mirror's address, not the delivery's heavy/   🔴 the rules at heavy/
//   B2 the root does not hand the download's reports to the library                 🔴 an undelivered family is a line of problems
//   B3 the root's detector answers «present» for every family (`fonts.check`'s answer) 🔴 a stored undeclared face drawn as default
//   B4 the boot applies the stored face whatever it is (the rule before ADR-0255)      🔴 a stored undeclared face drawn as default
