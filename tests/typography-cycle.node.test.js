// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TYPOGRAPHY BUTTON'S CYCLE, and the hand of this child's country (ADR-0149 §1, ADR-0150 §1-§2).
//
// ========================= WHAT THIS FILE DECIDES =========================
// 🎯 EACH STEP CHANGES THE CASE **AND** THE FACE. `letterCase` (`core/state`, ADR-0028) and the face are two controls in
// two places, and «Andika em caixa alta» is ONE pedagogical choice of whoever teaches literacy. A child should not have to
// know the model to make it.
//
// 🔴 AND THE LAST POSITION IS HER COUNTRY'S HAND, with the COLONISER's fallback when the country has none of its own. The
// rule is the Dev's and it is truer than the one it replaced: «o que os Estados Unidos ensinam» was a default dressed as a
// country; Portugal's hand for Angola is a true statement about how the school taught it.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { typographyCycle, handsForTag, CYCLE_START, HANDWRITING_SCALE, BASE_EM_PX, FONT_BY_KEY } from '../app/js/ui/fonts.js';

describe('maosDaEtiqueta — a mão do país, e o recuo do colonizador', () => {
  it('🎯 [Right] a REGIÃO decide primeiro', () => {
    expect(handsForTag('pt-BR')).toEqual(['pwbr']);
    expect(handsForTag('es-MX')).toEqual(['pwmx']);
    expect(handsForTag('es-PE')).toEqual(['pwpe']);
    expect(handsForTag('es-CU')).toEqual(['pwcu']);
  });

  it('🔴 [Right] onde o país ensina DUAS mãos, devolve as duas — na ordem do Dev', () => {
    // The traditional one first. Choosing one would be choosing for the child, which is ADR-0108 §2's argument.
    expect(handsForTag('en-US')).toEqual(['pwustrad', 'pwusmod']);
    expect(handsForTag('en-GB')).toEqual(['pwgbj', 'pwgbs']);
    expect(handsForTag('es-ES')).toEqual(['pwes', 'pwesdeco']);
  });

  it('🔴 [Boundary] SEM REGIÃO cai no recuo por LÍNGUA — o caso que mais se esquece', () => {
    // ⚠️ A tag with no region is not an error: it is a child whose browser did not say where she is.
    expect(handsForTag('pt')).toEqual(['pwpt']);
    expect(handsForTag('es')).toEqual(['pwes', 'pwesdeco']);
    expect(handsForTag('en')).toEqual(['pwgbj', 'pwgbs']);
  });

  it('🔴 [Right] um país SEM mão própria recebe a do COLONIZADOR, e não a dos EUA', () => {
    // It is the Dev's correction to ADR-0149 §5, and the heart of ADR-0150. Angola and Mozambique get Portugal; Bolivia and
    // Paraguay get Spain; Ireland and Nigeria get England.
    expect(handsForTag('pt-AO')).toEqual(['pwpt']);
    expect(handsForTag('pt-MZ')).toEqual(['pwpt']);
    expect(handsForTag('es-BO')).toEqual(['pwes', 'pwesdeco']);
    expect(handsForTag('en-IE')).toEqual(['pwgbj', 'pwgbs']);
    expect(handsForTag('en-NG')).toEqual(['pwgbj', 'pwgbs']);
    // 📌 THE PAIR proving the fallback CHANGED: none of them falls to the United States.
    for (const tag of ['pt-AO', 'es-BO', 'en-IE']) {
      expect(handsForTag(tag), `${tag} caiu na mão dos EUA`).not.toContain('pwusmod');
    }
  });

  it('[Zero] língua fora do repertório, ou etiqueta vazia, devolve VAZIO', () => {
    // The repertoire is limited to English, Portuguese and Spanish (ADR-0012). Empty can be said: the caller removes the
    // position from the cycle instead of showing a hand that is nobody's.
    expect(handsForTag('fr-FR')).toEqual([]);
    expect(handsForTag('de')).toEqual([]);
    expect(handsForTag('')).toEqual([]);
    expect(handsForTag(null)).toEqual([]);
  });

  it('📌 [Boundary] a região é lida sem depender de MAIÚSCULAS nem da posição', () => {
    // `pt-br`, `pt-BR`, `pt-Latn-BR` — all three name the same country, and the browser delivers any of them.
    expect(handsForTag('pt-br')).toEqual(['pwbr']);
    expect(handsForTag('pt-Latn-BR')).toEqual(['pwbr']);
  });
});

describe('cicloDeTipografia — as cinco posições, ou seis', () => {
  it('🎯 [Right] as quatro primeiras são fixas, e a CAIXA anda com a FACE', () => {
    const c = typographyCycle('pt-BR');
    expect(c.slice(0, 4)).toEqual([
      { letterCase: 'upper', font: 'andika', scale: 1 },
      { letterCase: 'mixed', font: 'andika', scale: 1 },
      { letterCase: 'mixed', font: 'atkinson', scale: 1 },
      { letterCase: 'mixed', font: 'lexend', scale: 1 },
    ]);
  });

  it('🔴 [Right] o ciclo COMEÇA na Atkinson, que é a posição (c) e o padrão do projeto', () => {
    expect(typographyCycle('pt-BR')[CYCLE_START]).toEqual({ letterCase: 'mixed', font: 'atkinson', scale: 1 });
  });

  it('🔴 [Boundary] SEIS posições onde o país ensina duas mãos, CINCO onde ensina uma', () => {
    expect(typographyCycle('pt-BR')).toHaveLength(5);
    expect(typographyCycle('en-US')).toHaveLength(6);
    expect(typographyCycle('en-US')[5]).toEqual({ letterCase: 'mixed', font: 'pwusmod', scale: HANDWRITING_SCALE });
  });

  it('🔴 [Zero] sem mão nenhuma o ciclo tem QUATRO — e isso é a resposta certa', () => {
    // ⚠️ Better one position fewer than one showing the hand of a country that is not that child's.
    const c = typographyCycle('fr-FR');
    expect(c).toHaveLength(4);
    expect(c.some((p) => p.font.startsWith('pw')), 'entrou uma mão de país sem país').toBe(false);
  });

  it('📌 [Right] a POSIÇÃO (a) é a única em caixa alta — é o par da alfabetização', () => {
    // Without this, a cycle putting everything in `mixed` would pass the face cases above.
    const c = typographyCycle('pt-BR');
    expect(c.filter((p) => p.letterCase === 'upper')).toEqual([{ letterCase: 'upper', font: 'andika', scale: 1 }]);
  });
});

describe('o ciclo de COMUNICAÇÃO PULA ARASAAC e PCS (ADR-0155 §3)', () => {
  it('🔴 [Zero] numa volta inteira, em qualquer etiqueta, o ciclo NUNCA pára numa posição de pictogramas', () => {
    // «Pular» (the Dev): while the licence does not allow it, a position that cannot be chosen is not offered — neither
    // disabled nor announced. ⚠️ This case CHANGES the day the licence arrives: it is not to be deleted quietly, it is to be
    // replaced by what the position then does.
    for (const tag of ['pt-BR', 'en-US', 'es-ES', 'es', 'fr-FR', null]) {
      const ciclo = typographyCycle(tag);
      expect(ciclo.length, `o ciclo de ${tag} veio vazio — o caso mediria nada`).toBeGreaterThanOrEqual(4);
      const pictos = ciclo.filter((p) => /arasaac|pcs|picto/i.test(p.font));
      expect(pictos, `o ciclo de ${tag} oferece uma posição sem licença`).toEqual([]);
    }
  });
});

describe('a ESCALA da mão do país — 25% maior, e o piso não é gosto', () => {
  it('🔴 [Right] a escala × a base do documento dá EXACTAMENTE o `minPx` da face', () => {
    /*
     * 🔴 THIS IS THE CASE THAT MAKES 1.25 A REASON AND NOT A LOOSE NUMBER. The Playwrite faces declare `minPx: 20` since
     * ADR-0012's amendment, with the sentence explaining why: «abaixo disto a face deixa de ser DIFÍCIL e passa a ser
     * ILEGÍVEL, que são coisas diferentes — a dificuldade é o exercício, a ilegibilidade é a criança a desistir». The
     * document's base is 16 px, and 16 × 1.25 is 20.
     *
     * ⚠️ AND IT MEASURES AGAINST THE CATALOGUE, not against the written number: if someone raises a hand's `minPx` without
     * raising the scale, this case fails — which is exactly the day the child would lose legibility.
     */
    for (const tag of ['pt-BR', 'en-US', 'es-ES', 'pt-AO']) {
      for (const passo of typographyCycle(tag).filter((p) => p.scale !== 1)) {
        const piso = FONT_BY_KEY[passo.font]?.minPx;
        expect(piso, `a mão ${passo.font} não declara piso de tamanho`).toBeGreaterThan(0);
        expect(BASE_EM_PX * passo.scale,
          `${passo.font}: ${BASE_EM_PX}px × ${passo.scale} fica abaixo do piso de ${piso}px`)
          .toBeGreaterThanOrEqual(piso);
      }
    }
  });

  it('🔴 [Zero] só a mão do país é AUMENTADA — as faces de leitura ficam em 1', () => {
    // The pair. Without it, a scale applied to everything would pass the case above and give the whole interface a size
    // only one of the positions justifies.
    const c = typographyCycle('en-US');
    expect(c.filter((p) => p.scale !== 1).map((p) => p.font)).toEqual(['pwustrad', 'pwusmod']);
    expect(c.slice(0, 4).every((p) => p.scale === 1), 'uma face de leitura foi aumentada').toBe(true);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// Seven, seven red — applied by script with the occurrence count checked BEFORE each one:
//
//   J1 the REGION stops being read before the language   🔴 pt-BR would fall to the fallback
//   J2 English's fallback goes back to the US             🔴 it is ADR-0150's whole correction
//   J3 only the country's FIRST hand enters the cycle     🔴 the US would lose the second
//   J4 the cycle starts at position (a) and not (c)       🔴 it would open in capitals
//   J5 position (a) stops being CAPITALS                  🔴 the literacy pair vanishes
//   J6 a language outside the repertoire gets a hand      🔴 the hand of a country that is not hers
//   J7 the 11th icon mounts with nothing to act on it (pause-icons.node)  🔴 ADR-0106 §5
//
// And FOUR more on the scale of the country's hand (ADR-0149 §1), all four red:
//   K1 the scale drops to 1.1                             🔴 16 × 1.1 = 17.6 px, below the floor of 20
//   K2 the scale applies to ALL positions                 🔴 the whole interface would grow
//   K3 the hand stops being enlarged                      🔴 it stays at 16 px, below the floor
//   K4 the calc() leaves the `font-size` (settings-typo.browser)   🔴 the scale is written and the document ignores it
//
// ⚠️ K4 SURVIVED THE FIRST ROUND: the rule that makes position (e) 25% larger was written in the CSS and not pinned by any
// case. The sieve that pins it measures the COMPUTED `font-size` with the variable set — reading the sheet as text would
// measure what I wrote, not what applies.
