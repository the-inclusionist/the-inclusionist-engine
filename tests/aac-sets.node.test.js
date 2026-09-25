// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/aac-sets + the pure logic of ui/settings-aac (node project, no document). ADR-0233 (which replaces ADR-0028's
// roster and tiers), issue #57.
//
// What these cases protect is NOT only the list — it is the RULE behind it: a set may be chosen only once a licence is
// recorded for it. The day a set becomes selectable for being popular or easy to integrate, with no licence written
// down, the catalogue will have stopped being true, and this is where that has to hurt.
import { describe, it, expect } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
import { AAC_SETS, AAC_BY_KEY, aacAvailable, aacSelectable, aacReason, aacLabel } from '../app/js/ui/aac-sets.js';
import { upperCaseOn, lettersRowSpec, aacRowSpec, aacControlId, AAC_SECTIONS } from '../app/js/ui/settings-aac.js';

/** A licensed set the catalogue does not hold, so the cases can show the predicates CAN answer yes. */
const LICENSED = { key: 'probe', name: 'Probe Symbols', tier: 'licensed', license: 'test licence' };

describe('AAC_SETS — the catalogue (ADR-0233)', () => {
  it('[Right] only the two candidates are listed: ARASAAC and PCS', () => {
    // The literals, so the case cannot pass by reading the same table the code reads.
    expect(AAC_SETS.map((s) => s.key)).toEqual(['arasaac', 'pcs']);
  });

  it('[Boundary] the sets the Dev dropped are gone, not merely locked', () => {
    for (const k of ['mulberry', 'blissymbolics', 'tawasol', 'sclera', 'symbolstix', 'widgit']) {
      expect(AAC_BY_KEY[k], k).toBeUndefined();
    }
  });

  it('[Zero] NO set is selectable today, because no licence has been obtained', () => {
    expect(aacAvailable()).toEqual([]);
    for (const s of AAC_SETS) {
      expect(s.tier, s.key).toBe('unlicensed');
      expect(s.license, s.key).toBeNull();
    }
  });

  it('[Boundary] the LETTERS are not in this list — they became a switch, not a set', () => {
    // The Dev's decision: a binary question presented as two rows forces the child to compare both to discover they are
    // the same question. What stays here is what really is a list.
    expect(AAC_SETS.some((s) => s.key.startsWith('letras'))).toBe(false);
  });

  it('[Interface] AAC_BY_KEY covers the whole catalogue, with no key lost', () => {
    expect(Object.keys(AAC_BY_KEY)).toHaveLength(AAC_SETS.length);
  });
});

describe('the licence gate — a set with no recorded licence can never be selectable (ADR-0233)', () => {
  it('🔴 [Right] every set: selectable only with a licence written down, and licensed exactly when one is', () => {
    // Offering a set the project has no licence for is a legal problem, not a bug. Two sides, both checked on every set:
    // no recorded licence → not selectable; and the tier agrees with the record, so `licensed` cannot be claimed empty.
    for (const s of AAC_SETS) {
      const recorded = typeof s.license === 'string' && s.license.trim() !== '';
      if (!recorded) expect(aacSelectable(s), `${s.key} is selectable with no recorded licence`).toBe(false);
      expect(s.tier === 'licensed', `${s.key}: tier and recorded licence disagree`).toBe(recorded);
    }
    for (const s of aacAvailable()) expect(s.license, s.key).toMatch(/\S/);
  });

  it('[Right] a licensed set IS selectable — the gate is not a predicate that always says no', () => {
    expect(aacSelectable(LICENSED)).toBe(true);
    for (const s of AAC_SETS) expect(aacSelectable(s), s.key).toBe(false);
  });
});

describe('aacReason — one answer, because there is one reason', () => {
  it('[Zero] a selectable set has no reason — there is nothing to explain', () => {
    expect(aacReason(LICENSED)).toBeNull();
  });

  it('[Right] an unlicensed set says so: «no licence»', () => {
    for (const k of ['arasaac', 'pcs']) expect(aacReason(AAC_BY_KEY[k]), k).toBe('aac.noLicence');
  });

  it('[Interface] the label carries the reason beside the name — the row explains itself', () => {
    expect(aacLabel(translate, AAC_BY_KEY.pcs)).toBe('PCS — sem licença');
    expect(aacLabel(translate, LICENSED)).toBe('Probe Symbols');
  });
});

describe('o interruptor das letras', () => {
  it('[Right] ligado é `upper`; desligado é `mixed`, que INCLUI as minúsculas', () => {
    expect(upperCaseOn('upper')).toBe(true);
    expect(upperCaseOn('mixed')).toBe(false);
  });

  it('[Interface] a linha explica o DESLIGADO — senão "off" fica sem significado', () => {
    // Off is not no letters: it is upper AND lower case. A switch whose off is not explained leaves the child guessing
    // what she loses by switching it off.
    expect(lettersRowSpec(translate).hint).toContain('minúsculas');
  });

  it('[Interface] o interruptor das letras é o piso: sem motivo, porque não depende de arquivo nenhum', () => {
    // Every pictogram set carries a reason for not serving; this one has none to carry. If one day it does, it is because
    // it became dependent on something — and then the reason shows up here before it shows up on screen.
    expect(lettersRowSpec(translate).ariaLabel).toBeUndefined();
  });
});

describe('aacRowSpec — what a set row SAYS, before any node exists', () => {
  it('[Interface] the reason enters the ACCESSIBLE NAME — whoever does not see the row hears why it does not serve', () => {
    expect(aacRowSpec(translate, AAC_BY_KEY.arasaac).ariaLabel).toBe('ARASAAC, sem licença');
    expect(aacRowSpec(translate, AAC_BY_KEY.pcs).hint).toBe('sem licença');
  });

  it('[Interface] a licensed set shows its licence in the SAME hint, not in a second line of prose', () => {
    // The CLAUDE.md §4 menu rule: a single `.opt-hint` per row. Two gave two descriptions to the same control, and the
    // footer showed the first — the other stayed in the row, becoming the manual the rule forbids.
    const spec = aacRowSpec(translate, LICENSED);
    expect(spec.hint).toBe('Licença: test licence');
    expect(spec.ariaLabel).toBe('Probe Symbols');
  });

  it('[Right] the id comes from the catalogue key, which is unique by construction', () => {
    const ids = AAC_SETS.map((s) => aacRowSpec(translate, s).id);
    expect(new Set(ids).size).toBe(AAC_SETS.length);
    expect(ids).toEqual(['caa-set-arasaac', 'caa-set-pcs']);
    expect(ids).toContain(aacControlId('pcs'));
  });
});

describe('AAC_SECTIONS — two sections, and the first does NOT come from the catalogue', () => {
  it('[Right] the letters switch is the «now» section; the pictogram sets are the other', () => {
    const [now, pictograms, ...rest] = AAC_SECTIONS.map((s) => s.rows(translate));
    expect(rest).toEqual([]);
    expect(now.map((l) => l.id)).toEqual(['caa-caixa-alta']);
    expect(pictograms.map((l) => l.id)).toEqual(['arasaac', 'pcs'].map(aacControlId));
    expect(AAC_SECTIONS.map((s) => s.title)).toEqual(['aac.secao.agora', 'aac.section.pictograms']);
  });
});
