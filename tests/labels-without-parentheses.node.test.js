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
import { RM_LABEL } from '../app/js/ui/motion-choices.ts';
import { PERSONAS_DO_PAD } from '../app/js/input/touch.ts';
import { PAUSE_ICONS } from '../app/js/core/pause-icon-catalogue.ts';

const DICIONARIOS = { pt, en, es };

/** Every label key the engine's panels draw in a row, from the tables themselves — not a list copied here. */
const ROTULOS = [
  ...AUDIO_CATS.map((c) => c.lbl),
  ...Object.values(RM_LABEL),
  ...PERSONAS_DO_PAD.map((p) => p.label),
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

  it('🔴 [Right] the "under construction" tag is a word of its own, never a parenthesis after a label (ADR-0159 rule 6)', () => {
    // Measured in dist/quiz.html: «Webcam — face (under construction)» was the name of three bar icons. The BAR's version of
    // this («icon.soon») left with the `soon` mechanism on 2026-09-21 (issue #184); the tag that survives is the panels' one,
    // added after the label by `motionRowHtml`, and the rule it has to keep obeying is the same one.
    for (const [lang, dic] of Object.entries(DICIONARIOS)) {
      expect(dic['ui.soon'], `${lang} ui.soon missing`).toBeTruthy();
      expect(dic['ui.soon'], `${lang} «${dic['ui.soon']}»`).not.toMatch(/[()]/);
    }
    // 🔴 AND THE BAR'S KEY MUST NOT COME BACK without the mechanism: a key nobody reads is a promise to a child that no
    // code keeps — the icon would be labelled «under construction» and still act.
    for (const [lang, dic] of Object.entries(DICIONARIOS)) {
      expect(dic['icon.soon'], `${lang} icon.soon is back with no consumer`).toBeUndefined();
    }
  });

  it('🔴 [Right] every quick-bar icon has a short NAME and an EXPLANATION for the footer, in pt, en and es', () => {
    // The Dev: the name below the row, what it does in the footer. The names carried their explanation in parentheses
    // («Modo cego (navegação sonora)»); the explanation is the icon's own `.dica`, which the footer shows.
    const problemas = [];
    for (const [lang, dic] of Object.entries(DICIONARIOS)) {
      for (const { n } of PAUSE_ICONS) {
        if (/[()]/.test(dic[n] ?? '')) problemas.push(`${lang} ${n} «${dic[n]}»`);
        if (!dic[`${n}.dica`]) problemas.push(`${lang} ${n}.dica missing`);
      }
    }
    expect(problemas, problemas.join(' · ')).toEqual([]);
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
