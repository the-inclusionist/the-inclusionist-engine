// SPDX-License-Identifier: AGPL-3.0-or-later
// NO LABEL OF AN ENGINE PANEL CARRIES ITS EXPLANATION IN PARENTHESES (ADR-0158, issue #152).
//
// The Dev: «Você está colocando entre parênteses informações que deveriam ir para o rodapé.» The browser case in
// `boot-create-game.browser` reads the rows a child sees — but only the rows that fixture shows: no character (so
// no walk/breath/flavor rows) and one pad size out of four. This file reads the WORDS instead, every one of them, in
// the three languages the game must speak, straight from the tables the panels draw from.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import pt from '../app/js/i18n/pt.ts';
import en from '../app/js/i18n/en.ts';
import es from '../app/js/i18n/es.ts';
import { AUDIO_CATS } from '../app/js/platform/audio-mixer.ts';
import { RM_LABEL } from '../app/js/ui/settings-motion.ts';
import { PERSONAS_DO_PAD } from '../app/js/input/touch.ts';

const DICIONARIOS = { pt, en, es };

/** Every label key the engine's panels draw in a row, from the tables themselves — not a list copied here. */
const ROTULOS = [
  ...AUDIO_CATS.map((c) => c.lbl),
  ...Object.values(RM_LABEL),
  ...PERSONAS_DO_PAD.map((p) => p.rotulo),
  'audio.modocego', 'audio.narracao',
];
// ⚠️ NO HINTS HERE ON PURPOSE. The parentheses held one game's examples — «água, rua», «moedas», «andar, escalar» — and
// they were first moved into engine hints; the Dev refused: «Você está criando regras para jogo que não existe.»
// They were deleted, not moved: the engine does not describe a game it does not know.

describe('panel labels carry no parentheses', () => {
  it('[Zero] the tables are not empty — the case would pass over nothing', () => {
    expect(ROTULOS.length).toBeGreaterThan(15);
  });

  it('🔴 [Zero] the platformer\'s examples did not come back as ENGINE hints', () => {
    for (const [lang, dic] of Object.entries(DICIONARIOS)) {
      const voltaram = Object.keys(dic).filter((k) => /^(audio\.cat\.[a-z]+|rm\.[a-z]+)\.dica$/.test(k));
      expect(voltaram, `${lang}: ${voltaram.join(', ')}`).toEqual([]);
    }
  });

  it('🔴 [Right] no label has a parenthesis, in pt, en or es', () => {
    const achados = [];
    for (const [lang, dic] of Object.entries(DICIONARIOS)) {
      for (const k of ROTULOS) if (/[()]/.test(dic[k] ?? '')) achados.push(`${lang} ${k} «${dic[k]}»`);
    }
    expect(achados, achados.join(' · ')).toEqual([]);
  });

  it('🔴 [Right] every label EXISTS in the three dictionaries — a missing key is shown as its id', () => {
    const faltam = [];
    for (const [lang, dic] of Object.entries(DICIONARIOS)) {
      for (const k of ROTULOS) if (!dic[k]) faltam.push(`${lang} ${k}`);
    }
    expect(faltam, faltam.join(' · ')).toEqual([]);
  });
});

// ===== MUTATIONS CHECKED (2026-09-12) =====
// Run together with the browser case «NO row of an engine panel carries an explanation in parentheses»:
// R1 `rm.decor` back to «Decoração (nuvens, grama)»          → red in both files
// R2 a pad persona back to «criança grande (12 anos)»         → red HERE only — the browser fixture never shows it,
//    which is the reason this file exists
// R3 the blind-mode row back on the bar's `icon.blind`          → red (browser: the row the child sees)
// R4 a category hint written back into its label, in parens     → red (browser)
// (R5 and R6 gated the hints, which were removed on the Dev's objection — see above)
