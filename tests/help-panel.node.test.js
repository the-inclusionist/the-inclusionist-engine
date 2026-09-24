// SPDX-License-Identifier: AGPL-3.0-or-later
// THE HELP SCREEN: which button does what, in THIS game, on THIS child's keyboard (ADR-0147 §4).
//
// ========================= WHAT THIS FILE GUARDS =========================
// 🔴 The pause list's `ajuda` item (ADR-0044) must obey ADR-0074's boundary: the engine knows a POSITION exists, only
// the GAME knows the word. The three cases that matter are all absences: a position the game does not declare does
// not appear; a blank word does not appear; and no cell shows an identifier.
//
// 📌 The pure half is `helpRows`/`helpListHtml`, which is why this file is `node`: nothing here needs a DOM, and what
// does (mounting the panel, wiring the item) is in `boot-create-game.browser`.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { helpRows } from '../app/js/ui/help-panel.js';

/** A fake `keyName`, so the case does not measure key formatting — which belongs to another module. */
const nomeDaTecla = (code) => `«${code}»`;
/** A game that declares THREE of the fourteen positions, and only one with an explanation. */
const PRESET = {
  action2: { label: 'Pular', hint: 'Sai do chão e volta.' },
  left: { label: 'Ir para a esquerda' },
  start: { label: 'Pausa' },
};
/** This child's scheme: `action2` remapped to `KeyZ`, `left` on the arrow, `start` with no key at all. */
const ESQUEMA = { action2: ['KeyZ', 'Space'], left: ['ArrowLeft'], start: null };
const teclas = (a) => ESQUEMA[a];

describe('helpRows — a tabela de ajuda de um assento', () => {
  it('🔴 [Zero] uma posição que o jogo NÃO declara está AUSENTE — e não é uma linha vazia', () => {
    const linhas = helpRows(PRESET, teclas, nomeDaTecla);
    expect(linhas.map((l) => l.action)).toEqual(['left', 'action2', 'start']);
    // 📌 THE PAIR that makes it an assertion and not a count: the eleven left over must really be out.
    expect(linhas.some((l) => l.action === 'action1'), 'apareceu uma posição que o jogo não nomeia').toBe(false);
    expect(linhas.some((l) => l.action === 'rightTrigger')).toBe(false);
  });

  it('🔴 [Zero] NENHUMA célula mostra um identificador — é a fronteira do ADR-0074 em forma de caso', () => {
    // ⚠️ THIS IS THE DEFECT `labellerFrom` RETURNS `null` TO PREVENT, and a help screen is the worst place for it to
    // appear: the child opens it precisely because they do not know what the button does.
    const texto = JSON.stringify(helpRows(PRESET, teclas, nomeDaTecla));
    for (const id of ['action1', 'action2', 'action3', 'leftShoulder', 'rightTrigger']) {
      expect(texto.includes(`"word":"${id}"`), `a palavra da linha é o identificador «${id}»`).toBe(false);
    }
  });

  it('⚠️ [Zero] um rótulo EM BRANCO vale o mesmo que rótulo nenhum', () => {
    // It is the silent defect `presetProblems` already names elsewhere: for a screen-reader user, a row whose label is
    // spaces is an item that exists and has no name.
    const linhas = helpRows({ ...PRESET, action3: { label: '   ' } }, teclas, nomeDaTecla);
    expect(linhas.some((l) => l.action === 'action3'), 'um rótulo de espaços virou linha').toBe(false);
  });

  it('🎯 [Right] a tecla é a REMAPEADA desta criança, não a de fábrica', () => {
    const linhas = helpRows(PRESET, teclas, nomeDaTecla);
    const pular = linhas.find((l) => l.action === 'action2');
    // The scheme puts `KeyZ` first; the engine's default for `action2` is `KeyJ`/`Space`.
    expect(pular.key, 'a ajuda mostrou a tecla de fábrica em vez da que a criança pôs').toBe('«KeyZ»');
    expect(pular.key).not.toBe('«KeyJ»');
  });

  it('📌 [Boundary] a posição que o teclado NÃO alcança diz `null` — e isso é informação', () => {
    // Whoever plays only with a pad or only with a finger has positions with no key. Saying so beats an empty row, and it
    // is the same principle as the `KeyScheme` that declares fourteen absences instead of an empty object.
    const linhas = helpRows(PRESET, teclas, nomeDaTecla);
    expect(linhas.find((l) => l.action === 'start').key).toBeNull();
    expect(linhas.find((l) => l.action === 'left').key).toBe('«ArrowLeft»');
  });

  it('[Zero] sem `preset` a tabela é VAZIA — não há o que dizer, e não se inventa', () => {
    expect(helpRows(undefined, teclas, nomeDaTecla)).toEqual([]);
    expect(helpRows(null, teclas, nomeDaTecla)).toEqual([]);
  });

  it('[Right] a ordem é a CANÓNICA de `ACTIONS`, e não a que o jogo escreveu o objeto', () => {
    // ⚠️ The fixture declares `action2` FIRST and `left` after; the output swaps them, because that is the order the child
    // meets on every other surface (remapping, the pad wizard, the title caption).
    expect(Object.keys(PRESET)).toEqual(['action2', 'left', 'start']);
    expect(helpRows(PRESET, teclas, nomeDaTecla).map((l) => l.action)).toEqual(['left', 'action2', 'start']);
  });
});

// The slide show built from these rows is measured in a document: `tests/help-panel.browser.test.js`.

// ============================== MUTATIONS CHECKED ==============================
// Applied by script to the file, with the occurrence count checked BEFORE each one.
//
//   D1 the blank-label guard removed                            🔴 the mute row appears
//   D2 the whole guard removed                                  🔴 all fourteen positions become rows
//   D3 the order becomes the game object's key order            🔴 the canonical order stops holding
//   D5 the missing key becomes `''` instead of `null`           🔴 «não alcança» can no longer be said
//   D8 the help is mounted without `preset`   (target: `boot-create-game.node`)
//   D9 the help's gap is no longer reported  (same)
//
// ⚠️ AND ONE SURVIVED, stated here rather than hidden: `word: word.label || action` — putting the identifier when the
// word is missing — stays GREEN. It is not a hole: D1's guard already refuses the row first, so that branch is
// UNREACHABLE. The case «nenhuma célula mostra um identificador» still asserts ADR-0074's boundary, and what
// guarantees it is the guard, not the expression. A check that held it would have to remove the guard first — and
// then it would be measuring something else.
