// SPDX-License-Identifier: AGPL-3.0-or-later
// THE MISSING DEFAULTS, AND THE ASD LEVEL THAT WAS FORGOTTEN EVERY SESSION (issue #61).
//
// ========================= WHAT THE MEASUREMENT FOUND, AND WHY THIS IS A FIX =========================
// ADR-0029's mark reads `DEFAULTS` and nothing else — issue #61's rule, and it is right: if it read two sources, the day
// they diverged would be the day the mark lied. The consequence is that **a value without a named default in
// `DEFAULTS` is a value the mark cannot mark**, and most of the quick bar's icons fell into that.
//
// ⚠️ WHEN NAMING THE DEFAULTS, TWO OF THEM WERE DEFECTS AND NOT OMISSIONS:
//
//   1. THE ASD LEVEL DID NOT PERSIST. `ui/pause-icons` kept it in a `let` whose comment called that «deliberately NOT
//      persisted — **verbatim**: game.js never wrote it to storage». The «verbatim» is what disqualifies it as a
//      decision: it was PRESERVED when extracting the monolith, not chosen. And ADR-0028 says every menu persists.
//
//      The cost fell on the child who needs it most: whoever uses QUIET mode had to set it again every session — and
//      that is who unexpected noise costs most. A setting that forgets itself is not a setting, it is a daily chore.
//
//   2. `p.viz` HAD NO DEFAULT. The bar's snapshot did `p.viz || ''`, and it worked by ACCIDENT: the empty string matches
//      neither `hc-direto` nor `fix-*`, so both icons stayed off for the right reason by mistake. `render/viz-modes`
//      already declared the `normal` mode with `kind:'normal'` — which does nothing — and nobody had said it was the
//      default.
//
// The persistence itself (the trip to `localStorage`) is proved in the BROWSER project, in `pause-icons.browser.test.js`;
// here stay the contract of the defaults and the sanitising, which are pure logic.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { DEFAULTS } from '../app/js/core/state.js';
import { sanitiseTeaLevel, CALM_NAMES } from '../app/js/core/calm-mode.js';
import { KEYS } from '../app/js/platform/storage.js';
import { VIZ_MODES } from '../app/js/render/viz-modes.js';

describe('os padrões que faltavam ao DEFAULTS (#61)', () => {
  it('⚠️ [Right] o nível TEA e o modo de visão têm padrão NOMEADO', () => {
    // Without these two names, ADR-0029's mark cannot mark most of the quick bar's icons — and a bar with two marked and
    // the rest not says the child did not touch the rest, which is false.
    expect(DEFAULTS.calmMode, 'o nível TEA voltou a não ter padrão').toBe(0);
    expect(DEFAULTS.viz, 'o modo de visão voltou a não ter padrão').toBe('normal');
  });

  it('⚠️ [Interface] o padrão do `viz` é um modo que NÃO FAZ NADA, e é `render/viz-modes` quem o diz', () => {
    // The default cannot be any string that happens not to match the prefixes: it must be a real, neutral mode. If
    // someone sets `DEFAULTS.viz` to a mode that corrects or simulates, the child starts the match inside a setting she
    // did not ask for — and this case fails.
    const modo = VIZ_MODES.find((m) => m.key === DEFAULTS.viz);
    expect(modo, `DEFAULTS.viz não é um modo de viz-modes: ${DEFAULTS.viz}`).toBeTruthy();
    expect(modo.kind, 'o padrão do viz deixou de ser o modo neutro').toBe('normal');
  });

  it('[Interface] o nível TEA tem chave de armazenamento própria', () => {
    expect(KEYS.tea).toBe('incl_tea');
  });
});

describe('o nível TEA saneado — dado do navegador é dado de fora', () => {
  it('[Right] os três níveis válidos atravessam intactos', () => {
    for (let n = 0; n < CALM_NAMES.length; n++) expect(sanitiseTeaLevel(n, DEFAULTS.calmMode)).toBe(n);
    expect(CALM_NAMES).toHaveLength(3); // normal · calmo · silencioso
  });

  it('⚠️ [Error] qualquer outra coisa volta ao padrão, e o motivo é o anúncio', () => {
    // `CALM_NAMES[3]` is `undefined`, and the icon's cycle does `t(CALM_NAMES[calmMode])` to ANNOUNCE the level to the
    // screen reader. A level outside the list would come out as an empty announcement — the blind child would press the
    // button and hear nothing, the quietest way for an accessibility control to fail.
    for (const lixo of [3, -1, 1.5, NaN, Infinity]) {
      expect(sanitiseTeaLevel(lixo, DEFAULTS.calmMode), `${lixo} passou como nível`).toBe(DEFAULTS.calmMode);
    }
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · removing `calmMode: 0` from `DEFAULTS` → the [Right] named-default case fails (and `tsc` fails with it, the best of
//     both worlds: the gate says why and the compiler stops you before the gate).
//   · setting `DEFAULTS.viz` to `'hc-direto'` → the [Interface] does-nothing-mode case fails on `kind`. It is the mutation
//     that matters: `'hc-direto'` IS a real mode, so a case that only checked that it exists in VIZ_MODES would stay
//     green while putting every child in high contrast by default.
//   · replacing `sanitiseTeaLevel`'s `>= 0 && < CALM_NAMES.length` with `>= 0` → the [Error] case fails on 3, exactly
//     the value that produces the empty announcement.
//   · replacing `Number.isInteger` with `typeof === 'number'` → the [Error] case fails on 1.5 and on NaN.
