// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TWO KEYBOARD TABLES HAVE TO AGREE WHERE THEY OVERLAP (issue #118).
//
// ========================= WHAT THIS FILE PREVENTS =========================
// There were TWO keyboard tables in the tree:
//
//   `input/keyboard.ts`        → `KB_DEFAULTS`      the LIVE one — what the game uses
//   `input/default-bindings.ts`→ `KEYBOARD_SOLO`/`KEYBOARD_DUO`  14 positions   recorded in ADR-0096
//
// ⚠️ AND DIVERGENCE GIVES NO SYMPTOM. Each table is flawless alone: the live one passes in the game, the recorded one
// passes its gate. Whoever touches one has no way of knowing the other exists. A silent difference between two sources
// is the defect this repository has already paid for sixteen times with `DomQuery`.
//
// Since #118 `input/keyboard.ts` DERIVES `solo` and `p2` from `input/default-bindings` (the last case below pins the
// derivation); `p3`/`p4` are still its own. The agreement cases stay, because they are what catches a table pasted back.
//
// ========================= WHAT THIS GATE FOUND WHEN IT WAS BORN (07/09) =========================
// Issue #118 claims «as oito coincidem tecla a tecla». ⚠️ THEY DID NOT. Seven of the eight did; the eighth was player 1's
// `action2` in TWO-PLAYER mode:
//
//     KEYBOARD_DUO[0].action2   ['KeyJ', 'Space']    ← the recorded one, and the one ADR-0096 decided
//     KB_DEFAULTS.p2[0].action2 ['KeyJ']             ← the live one: the space bar had vanished
//
// The space bar has always been jump's second shortcut, and in solo both tables give it. In two-player mode the live one
// took it away — with nothing taking it from player 2, who never had it. It is not a conflict or a compile error: it is a
// child playing with a friend whose Space stops jumping, and nobody else noticing.
//
// ⚠️ AND WHAT POINTS AT WHICH OF THE TWO WAS WRONG is a rule the recorded table ALREADY obeys: **player 1 in two-player
// mode is solo MINUS THE ARROWS, and nothing more.** `Space` is not an arrow. The recorded table's gate asserts this
// position by position since ADR-0096; here the same rule applies to the live table, which is where it costs.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_DEFAULTS } from '../app/js/input/keyboard.js';
import { KEYBOARD_SOLO, KEYBOARD_DUO, conflictsBetweenTables } from '../app/js/input/default-bindings.js';
import { initKeyboardRuntime } from '../app/js/input/keyboard-runtime.js';

/** The positions BOTH tables declare. Read from the live table, not written here: if it grows, the sieve grows with it
 *  instead of measuring eight out of habit. */
const PARTILHADAS = Object.keys(KB_DEFAULTS.solo);

/** The directions, which are the only legitimate difference between solo and player 1 in two-player mode. */
const SETAS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** Where `viva` and `registada` disagree, on the shared positions. Empty means they agree. */
function divergencias(viva, registada, nome) {
  const fora = [];
  for (const pos of PARTILHADAS) {
    const a = JSON.stringify(viva[pos]);
    const b = JSON.stringify(registada[pos]);
    if (a !== b) fora.push(`${nome}.${pos}: viva ${a} × registada ${b}`);
  }
  return fora;
}

describe('as duas tabelas de teclado concordam nas oito posições partilhadas (#118)', () => {
  it('[Zero] o crivo está mesmo a comparar — as posições partilhadas existem nos dois lados', () => {
    // Without this, an empty `PARTILHADAS` (or a position that exists on only one side) would give green comparing nothing.
    expect(PARTILHADAS.length).toBeGreaterThanOrEqual(8);
    for (const pos of PARTILHADAS) {
      expect(KEYBOARD_SOLO[pos], `${pos} não existe na tabela registada`).toBeDefined();
      expect(KB_DEFAULTS.solo[pos], `${pos} não existe na tabela viva`).toBeDefined();
    }
  });

  it('[Right] o esquema SOLO concorda tecla a tecla', () => {
    expect(divergencias(KB_DEFAULTS.solo, KEYBOARD_SOLO, 'solo')).toEqual([]);
  });

  it('⚠️ [Right] o esquema de DUPLA concorda tecla a tecla, nos dois jogadores', () => {
    // This is where the gate was born red: `Space` was in player 1's recorded table and not in the live one.
    const fora = [
      ...divergencias(KB_DEFAULTS.p2[0], KEYBOARD_DUO[0], 'p2[0]'),
      ...divergencias(KB_DEFAULTS.p2[1], KEYBOARD_DUO[1], 'p2[1]'),
    ];
    expect(fora, 'as duas tabelas divergiram: ' + fora.join(' | ')).toEqual([]);
  });

  it('⚠️ [Boundary] o jogador 1 em dupla é o SOLO MENOS AS SETAS, e nada mais', () => {
    // The rule that points at which of the two tables is wrong when they diverge, and which the recorded one already obeys
    // (see `default-bindings.node.test.js`). Without it, «divergiram» does not say which side to fix.
    for (const pos of PARTILHADAS) {
      const esperado = (KB_DEFAULTS.solo[pos] ?? []).filter((c) => !SETAS.includes(c));
      expect(KB_DEFAULTS.p2[0][pos], `${pos} do jogador 1 em dupla não é o solo menos as setas`)
        .toEqual(esperado);
    }
    // And the other half of the same rule: the arrows stay with player 2, whole.
    expect(KB_DEFAULTS.p2[1].up).toEqual(['ArrowUp']);
    expect(KB_DEFAULTS.p2[0].up, 'a seta ficou com o jogador 1 e vai mover os dois bonecos').not.toContain('ArrowUp');
  });

  it('⚠️ [Right] o crivo cruzado corre sobre o conjunto VIVO — p2, p3 e p4', () => {
    // The issue asks for this in so many words: «é para isso que existe `conflictsBetweenTables`, e ele tem de correr
    // sobre o conjunto que ficar vivo». Run only on the RECORDED table, which is not what the game uses, the sieve would
    // exist and guard nothing.
    for (const grupo of ['p2', 'p3', 'p4']) {
      expect(conflictsBetweenTables(KB_DEFAULTS[grupo]), `${grupo}: dois jogadores disputam a mesma tecla`)
        .toEqual([]);
    }
  });

  it('⚠️ [Right] a BARRA tem dono em dupla — é a tecla com que o controle por OLHAR salta', () => {
    // The measured consequence of the divergence, and what makes it costly instead of tidy.
    //
    // An assistive input that synthesises `Space` for «olhar para cima = pular» (as the webcam did) makes the child who
    // plays with her eyes jump with the space bar and nothing else. `input/keyboard-runtime.whichPlayer` looks for the code
    // in the ACTIVE players' schemes; with the space bar out of the live two-player table, it had no owner and the answer
    // was -1, while `KeyA`/`KeyD`, used for walking, were still player 1's.
    //
    // That is: a second player joining took JUMP away from whoever plays with their eyes, and left walking. Nothing errs
    // out loud; the child simply does not jump any more.
    const rt = initKeyboardRuntime({
      getKB: () => KB_DEFAULTS,
      getNumPlayers: () => 2,
      getPlayers: () => [{ ctrl: null }, { ctrl: null }],
    });
    expect(rt.whichPlayer('KeyA'), 'o andar do olhar perdeu o dono').toBe(0);
    expect(rt.whichPlayer('Space'), 'o PULO do olhar não tem dono em dupla (ui/webcam.ts:40)').toBe(0);
    expect(rt.actionOf('Space', 0)).toBe('action2');
  });

  it('⚠️ [Right] JÁ NÃO HÁ DUAS TABELAS — a viva é derivada da registada, e não uma cópia dela', () => {
    // ⚠️ THIS CASE REPLACES THE QUESTION. With two lists, the best that could be done was measure whether they agreed — and
    // a measure of agreement only catches the divergence AFTER it exists. Since #118 (the Dev's decision: close
    // `KeyScheme`), `input/keyboard.ts` derives `solo` and `p2` from `input/default-bindings`, which is where ADR-0096 put
    // the decision. There is nothing to diverge.
    //
    // The sieve reads the FILE and not the value, on purpose: a `deepEqual` would stay green the day someone pasted the
    // table back with the same values — and that is exactly where divergence is reborn.
    const fonte = readFileSync(join(process.cwd(), 'app', 'js', 'input', 'keyboard.ts'), 'utf8');
    const soloDeclarado = /solo\s*:\s*\{/.test(fonte);
    expect(soloDeclarado, 'o esquema solo voltou a ser escrito à mão em input/keyboard.ts').toBe(false);
    expect(fonte, 'a tabela viva deixou de derivar da registada').toMatch(/KEYBOARD_SOLO/);
    expect(fonte, 'a tabela de dupla deixou de derivar da registada').toMatch(/KEYBOARD_DUO/);
  });

  it('[Interface] o crivo APANHA uma divergência plantada — senão os casos acima não provam nada', () => {
    const adulterada = { ...KB_DEFAULTS.solo, action1: ['KeyZ'] };
    const achados = divergencias(adulterada, KEYBOARD_SOLO, 'solo');
    expect(achados).toHaveLength(1);
    expect(achados[0]).toContain('action1');
    expect(achados[0]).toContain('KeyZ');
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · ⚠️ BORN RED WITH NO MUTATION AT ALL, against the tree as it was: `KB_DEFAULTS.p2[0].action2` was `['KeyJ']` and the
//     recorded one `['KeyJ','Space']`. `[Right] DUPLA` and `[Boundary] solo menos as setas` failed. The fix was to give the
//     space bar back to the live table, because it is the recorded one that carries ADR-0096's decision and the live one
//     that was behind.
//   · removing `Space` again from `KB_DEFAULTS.p2[0].action2` → the SAME THREE cases fail, including the gaze one. It is
//     the mutation that is the defect.
//   · putting `ArrowUp` in `KB_DEFAULTS.p2[0].up` → THREE fail: `[Boundary]` (on both ends — the equality and the
//     `not.toContain`), `[Right] DUPLA` (the recorded one does not have it) and ⚠️ `[Right] o crivo cruzado sobre o
//     conjunto VIVO`, which now sees `ArrowUp` claimed by both players. Three independent sieves catching the same defect
//     — both characters moving together —, which shows that running the sieve on the live table was not ceremony: it was
//     the only one of the three looking at what the game uses.
//   · swapping `KeyU` for `KeyZ` in `KB_DEFAULTS.solo.action1` → `[Right] SOLO` fails, naming the position, and so does
//     `[Boundary]`, because it derives the expectation FROM SOLO — moving solo moves the two-player ruler with it, which
//     is precisely the relation the case asserts.
