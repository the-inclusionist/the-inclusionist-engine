// SPDX-License-Identifier: AGPL-3.0-or-later
// #104'S NET: what each of the 16 single-value modes DID has to keep being done after the split into two axes.
//
// ========================= WHY THIS EXISTS =========================
// Issue #104 calls the migration «the dangerous half», and ADR-0076 says why: the saved setting keeps the old single
// value, and without the translation the visual mode EACH CHILD HAS ALREADY CHOSEN is thrown away. Whoever chose
// `fix-deuter` chose it because that is how they see.
//
// ⚠️ AND THIS FILE DOES NOT DESCRIBE WHAT SOMEONE THINKS THE CODE DOES — it derives the old behaviour from the REAL TABLES
// (`VIZ_FILTER`, `needsCanvas`, `VIZ_BY_KEY.kind`, `simulatesDisability`) and requires the new model to produce the same.
// A net written from a reading would protect the reading, not the child. It is the difference between a
// characterisation test and a paraphrase.
//
// ========================= WHAT «O MESMO» MEANS, MECHANISM BY MECHANISM =========================
// Measured in `render/viewports`, which is what applies it:
//   · `playerVizTex(base, mode)` only does something when `DIRECT_CFG[mode]` exists — the three `hc-direto*`, which are
//     exactly the `needsCanvas` ones. For everything else it returns the texture as it came.
//   · `pixiFilterFor(mode)` only produces a filter for the six colour-blindness keys, `blind` and the five `lv-*` — which
//     are exactly the keys of `VIZ_FILTER`.
// So the new model's (direct, filter) pair is comparable, key by key, with the pair the old table produced. That is what
// the cases below assert.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import {
  VIZ_CYCLE, VIZ_FILTER, VIZ_BY_KEY, needsCanvas, simulatesDisability,
} from '../app/js/render/viz-modes.js';
import {
  migrateVisual, howItApplies, textureKey, legacyKey, isSimulation, isBlind, isLowVision, hasHighContrast,
  bothAxesAtDefault, DEFAULT_VISUAL, LEGACY_KEYS,
} from '../app/js/render/viz-axes.js';

/** What the OLD table did with this key, derived from it and not written by hand. */
const comportamentoAntigo = (k) => ({
  direct: needsCanvas(k) ? k : null,
  filter: k in VIZ_FILTER ? k : null,
});

describe('#104 · a migração preserva o que cada modo FAZ', () => {
  it('⚠️ [Interface] os 16 modos de hoje estão TODOS cobertos pela migração', () => {
    // If a mode were left out, the child who chose it would fall to the default with nothing warning — and the default is
    // precisely the screen she cannot use.
    const semCobertura = VIZ_CYCLE.filter((k) => !LEGACY_KEYS.includes(k));
    expect(semCobertura, 'modo antigo sem tradução: a escolha desta criança seria descartada').toEqual([]);
    expect(LEGACY_KEYS.length).toBe(VIZ_CYCLE.length);
  });

  it('⚠️ [Right] cada modo produz o MESMO par (direto, filtro) que produzia', () => {
    for (const k of VIZ_CYCLE) {
      expect(howItApplies(migrateVisual(k)), `o modo «${k}» mudou de comportamento na migração`)
        .toEqual(comportamentoAntigo(k));
    }
  });

  it('⚠️ [Right] e o que o sprite usa de textura não muda', () => {
    // `playerVizTex` only acts when the mode has `DIRECT_CFG`, that is, when `needsCanvas`. The new key may be another
    // word as long as it falls on the same side of that question.
    for (const k of VIZ_CYCLE) {
      expect(needsCanvas(textureKey(migrateVisual(k))), `a textura do modo «${k}» trocou de caminho`)
        .toBe(needsCanvas(k));
    }
  });

  it('⚠️ [Right] «isto simula uma deficiência?» responde igual aos 16 — é o que o reset da empatia usa', () => {
    // The empathy menu's «restaurar padrões» button turns SIMULATIONS off. If the classification slipped, it would start
    // turning a CORRECTION off — taking from a colour-blind child the only correction she has, from the menu that exists
    // for whoever does not have the disability.
    for (const k of VIZ_CYCLE) {
      expect(isSimulation(migrateVisual(k)), `«${k}» trocou de lado entre simular e corrigir`)
        .toBe(simulatesDisability(k));
    }
  });

  it('[Right] cegueira e baixa visão continuam a ser reconhecidas pelo `kind` que já as reconhecia', () => {
    for (const k of VIZ_CYCLE) {
      const v = migrateVisual(k);
      expect(isBlind(v), k).toBe(VIZ_BY_KEY[k].kind === 'blind');
      expect(isLowVision(v), k).toBe(VIZ_BY_KEY[k].kind === 'lowvision');
      expect(hasHighContrast(v), k).toBe(needsCanvas(k));
    }
  });

  it('⚠️ [Boundary] os 13 modos que NÃO são alto contraste deixam os dois eixos no padrão', () => {
    // It is what frees the simulation (ADR-0076): a demonstration on top of an adaptation teaches something false. After
    // the migration, every old mode that was not a theme has to keep allowing simulation.
    for (const k of VIZ_CYCLE) {
      const v = migrateVisual(k);
      const eraTema = needsCanvas(k);
      const eraCorrecao = k.startsWith('fix-');
      expect(bothAxesAtDefault(v), `«${k}» passou a bloquear a simulação`).toBe(!eraTema && !eraCorrecao);
    }
  });

  it('[Zero] lixo, ausência e uma chave de outra versão caem no padrão em vez de estourar', () => {
    // The data comes from a child's browser: it may be from another machine, a future version, or corrupted.
    for (const mau of [undefined, null, '', 'modo-de-2030', 42, [], { tema: 'roxo' }]) {
      expect(migrateVisual(mau), String(mau)).toEqual(DEFAULT_VISUAL);
    }
  });

  it('⚠️ [Interface] a migração é IDEMPOTENTE — ela corre mais de uma vez por sessão', () => {
    // The reading happens per player, and the already migrated value passes through here again. If the second pass changed
    // anything, the child's setting would drift by itself between two readings.
    for (const k of VIZ_CYCLE) {
      const uma = migrateVisual(k);
      expect(migrateVisual(uma), `«${k}» não sobreviveu à segunda migração`).toEqual(uma);
      expect(migrateVisual(JSON.parse(JSON.stringify(uma))), `«${k}» não sobreviveu a ida e volta por JSON`).toEqual(uma);
    }
  });
});

describe('#104 · e o que a divisão TORNA POSSÍVEL, que é o ponto da issue', () => {
  it('⚠️ [Right] `hc7` E `fix-deuter` ao mesmo tempo, com os DOIS aplicados', () => {
    // Box nº 1 of the definition of done, and the reason the issue exists: a child with colour blindness who ALSO needs
    // high contrast could not have both. No old key can express this state — that is why the case builds it by hand.
    const os_dois = { tema: 'hc7', correcao: 'deuter', simulacao: null };
    expect(howItApplies(os_dois)).toEqual({ direct: 'hc-direto-7', filter: 'fix-deuter' });
    expect(bothAxesAtDefault(os_dois), 'com um eixo fora do padrão a simulação tem de ficar travada').toBe(false);
  });

  it('⚠️ [Right] a chave LEGADA preserva TODO ajuste que já existia — ida e volta pelos 16 modos', () => {
    // ⚠️ THIS CASE WAS BORN FROM A RED GATE, and the defect it caught is the worst kind: silent and at the child's cost.
    // The first writing used `textureKey` as the mirror — and it returns `normal` for a colour correction, because a
    // correction changes no texture at all. A child in `fix-deuter` would start writing `'normal'` to the old key, and an
    // old reader (the published cartridge) would lose her correction with nothing said.
    for (const k of VIZ_CYCLE) {
      expect(legacyKey(migrateVisual(k)), `o modo «${k}» não sobrevive à chave legada`).toBe(k);
    }
  });

  it('⚠️ [Boundary] e o ÚNICO caso com perda é o que nunca existiu antes', () => {
    // `hc7 + fix-deuter` only fits as one of its two halves in the old vocabulary. No regression is possible there: the
    // state is NEW, and a single-key reader never knew how to express it. Whoever wants both halves reads the new key,
    // which exists for that.
    expect(legacyKey({ tema: 'hc7', correcao: 'deuter', simulacao: null })).toBe('hc-direto-7');
    // And the simulation beats both, because it is the one that blanks the whole screen.
    expect(legacyKey({ tema: 'hc7', correcao: 'deuter', simulacao: 'blind' })).toBe('blind');
  });

  it('[Right] mexer num eixo não mexe no outro — uma asserção em cada sentido', () => {
    const base = { tema: 'hc45', correcao: 'protan', simulacao: null };
    expect(howItApplies({ ...base, tema: 'padrao' }).filter, 'tirar o tema apagou a correção').toBe('fix-protan');
    expect(howItApplies({ ...base, correcao: 'tricro' }).direct, 'tirar a correção apagou o tema').toBe('hc-direto-45');
  });
});

// ========================= MUTATIONS CHECKED =========================
// ⚠️ A characterisation net IS BORN GREEN by definition — it describes what already happens. So the proof that it serves
// is not the green: it is that every plausible damage to the migration turns it red. Seven, all applied by script to
// `render/viz-axes.ts`, with occurrence counts:
//   · ⚠️ DELETING `fix-deuter` from the table -> THREE fail. It is the damage the issue calls «the dangerous half»: the
//     child who chose that correction goes back to the default, in silence, and the default is exactly the screen she
//     cannot use.
//   · switching `hc-direto-7` to the `hc45` theme — a mistake of ONE step, the kind that passes a quick read -> fails the
//     pair. The child who asked for 7:1 would get 4.5:1 and nothing would say so.
//   · making `fix-protan` migrate to the SIMULATION `sim-protan` -> THREE fail, and the middle one is what matters: the
//     empathy menu's «restaurar padroes» turns simulations off, so this swap would make it turn off a colour-blind child's
//     correction — from the menu that exists for whoever is NOT colour-blind.
//   · removing the object branch from `migrateVisual` (it stops being idempotent) -> fails idempotence. The reading
//     happens per player and more than once per session; the setting would drift by itself between two readings.
//   · `filterKey` always returning `null` -> THREE fail, including the two cases of what the split MAKES POSSIBLE. The
//     correction axis would go mute.
//   · `directTheme` returning `null` for every theme -> TWO fail: the pair and the sprite's texture.
//   · `migrateVisual` THROWING on an unknown key -> fails the rubbish case. The data comes from a child's browser and may
//     be from another machine or a future version; a `throw` there takes the game down because of a preference.
