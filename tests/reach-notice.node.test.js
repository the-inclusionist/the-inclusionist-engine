// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SENTENCES OF THE REACH NOTICE (issue #112). The screen is checked in the browser project; here it is the TEXT,
// which is the part that needs careful reading and translating into three languages.
//
// ⚠️ WHAT THIS NOTICE EXISTS TO PREVENT: the on-screen control has fewer slots (13) than the vocabulary has actions
// (14). On a public-school tablet touch is not the alternative path — it is the only one. Without the sentence, the
// child finds out mid-game that she cannot reach an action and concludes the game is broken, with no way of knowing
// it is not.
import { describe, it, expect } from 'vitest';
import { noticeRows } from '../app/js/ui/reach-notice.js';
// `reach`/`defaultTransports` belong to the engine, and they are what builds the reach this file talks about. The
// game's preset is not imported: assertions about the platform game's preset live in `game-platformer` (issue #111).
import { reach, defaultTransports } from '../app/js/input/transports.js';
import { ACTIONS } from '../app/js/core/actions.js';
import pt from '../app/js/i18n/pt.js';

/** A test translator that returns the KEY and the parameters — so the cases talk about structure, not prose. */
const cru = (k, p) => (p ? `${k}(${Object.entries(p).map(([a, b]) => `${a}=${b}`).join(',')})` : k);

/** And one that uses the real dictionary, for the cases that need to assert the sentence. */
const real = (k, p) => {
  let s = pt[k];
  if (s === undefined) throw new Error(`chave i18n ausente: ${k}`);
  for (const [a, b] of Object.entries(p ?? {})) s = s.split(`{${a}}`).join(String(b));
  return s;
};

const sempre = () => true, nunca = () => false;
const TABLET = defaultTransports({ gamepad: nunca, keyboard: nunca, touch: sempre, mouse: nunca });
const DESKTOP = defaultTransports({ gamepad: nunca, keyboard: sempre, touch: nunca, mouse: sempre });

describe('quando NÃO há o que dizer, não se diz nada', () => {
  it('[Zero] alcance ok devolve zero linhas — um aviso que aparece sempre deixa de ser lido', () => {
    expect(noticeRows(reach(DESKTOP, ACTIONS, 1), cru)).toEqual([]);
  });

  it('[Boundary] e um jogo cujas ações CABEM no toque, e que segura UMA de cada vez, também não avisa', () => {
    const nove = ACTIONS.slice(0, 9);
    expect(noticeRows(reach(TABLET, nove, 1), cru)).toEqual([]);
  });
});

describe('⚠️ O PONTO CEGO DO ADR-0104: cabe nas ações e ainda assim não dá para jogar', () => {
  // This block is the reason the second axis exists, and the case above is what it corrects. While `reach` only
  // measured «chega às ações», a game of nine actions passed on a control with at least nine slots: `ok` true, card
  // never shown. But running, walking and jumping at once are THREE FINGERS, and the cheap device recognises two — the
  // child tried, nothing happened, and nothing anywhere said why. `ok` was asserting «dá para jogar» about a game that
  // could not be played.
  const nove = ACTIONS.slice(0, 9);

  it('⚠️ [Right] nove ações cabem nos nove lugares do toque, e SEGURAR três reprova na mesma', () => {
    const a = reach(TABLET, nove, 3);
    expect(a.short, 'apareceu como curto de LUGARES — não é esse o defeito').toEqual([]);
    expect(a.ok, 'o `ok` continua a dizer que dá para jogar').toBe(false);
    expect(a.cannotHold).toEqual([{ id: 'toque', holds: 2 }]);
  });

  it('⚠️ [Right] e a frase diz os DOIS números, que é o que a torna acionável', () => {
    const linhas = noticeRows(reach(TABLET, nove, 3), real);
    expect(linhas).toContain('O controle de tela segura 2 botões de cada vez, e este jogo pede 3 ao mesmo tempo.');
  });

  it('[Boundary] segurar DOIS ainda passa — o piso é dois, e o piso é para ser usado', () => {
    expect(reach(TABLET, nove, 2).ok).toBe(true);
    expect(reach(TABLET, nove, 2).cannotHold).toEqual([]);
  });

  it('⚠️ [Interface] um transporte SEM tecto declarado não reprova por falta de medida', () => {
    // The keyboard and the gamepad declare no `holds`. Absent means «não medimos isto», and refusing for lack of a
    // measure would turn ignorance into an accusation: they would fail EVERY game.
    expect(reach(DESKTOP, nove, 9).ok, 'o teclado reprovou por não ter número').toBe(true);
    expect(reach(DESKTOP, nove, 9).cannotHold).toEqual([]);
  });

  it('⚠️ [Interface] o transporte que já está CURTO de lugares não aparece duas vezes', () => {
    // A transport on both lists would make the card state two problems where there is one, and the child would read a
    // wall instead of a difference.
    const a = reach(TABLET, ACTIONS, 3); // 14 actions on a 13-slot transport (nine up to ADR-0160's shoulders), and it still asks for 3 fingers
    expect(a.short.map((c) => c.id)).toEqual(['toque']);
    expect(a.cannotHold, 'o toque foi acusado duas vezes pelo mesmo aparelho').toEqual([]);
  });
});

describe('quando há, a informação é ACIONÁVEL — não «faltam lugares»', () => {
  it('[Right] diz quantas o jogo pede, quem está curto com quantos lugares, e o que resolveria', () => {
    const linhas = noticeRows(reach(TABLET, ACTIONS, 1), cru);
    expect(linhas).toEqual([
      `reach.titulo(pedidas=${ACTIONS.length})`,
      'reach.curto(transporte=reach.nome.toque,lugares=13)',
      'reach.ligue(saida=reach.nome.gamepadreach.oureach.nome.teclado)',
    ]);
  });

  it('[Right] e em português sai uma frase que uma criança consegue seguir', () => {
    const linhas = noticeRows(reach(TABLET, ACTIONS, 1), real);
    expect(linhas[0]).toBe('Este jogo usa 14 ações.');
    expect(linhas[1]).toBe('O controle de tela tem 13 lugares — não chegam para todas.');
    expect(linhas[2]).toBe('Ligue controle ou teclado e você joga com todas.');
  });

  it('[Zero] ⚠️ quando NADA resolveria, a frase é OUTRA — mandar ligar um controle seria mentir', () => {
    // The game asks for more positions than any transport of this device offers. Here the problem is the GAME's, and
    // saying «ligue um controle» would send the child looking for something that fixes nothing.
    const demais = [...ACTIONS, ...ACTIONS, ...ACTIONS]; // 42 positions: above even the gamepad
    const linhas = noticeRows(reach(defaultTransports({ gamepad: sempre, keyboard: sempre, touch: sempre, mouse: sempre }), demais), cru);
    expect(linhas).toContain('reach.semSaida');
    expect(linhas.some((l) => l.startsWith('reach.ligue'))).toBe(false);
  });

  it('[Interface] todas as chaves usadas EXISTEM no dicionário base', () => {
    // The `real` translator throws on a missing key, so this is the assertion. A missing key gives no error in the
    // browser — it gives the raw key on screen, or an empty sentence in a screen reader, which is worse.
    expect(() => noticeRows(reach(TABLET, ACTIONS, 1), real)).not.toThrow();
    expect(() => noticeRows(reach(defaultTransports({ gamepad: sempre, keyboard: sempre, touch: sempre, mouse: sempre }),
      [...ACTIONS, ...ACTIONS, ...ACTIONS]), real)).not.toThrow();
  });
});

// -----------------------------------------------------------------------------------------------------------
// ⚠️ The describe `as DUAS raizes mostram o aviso` lives in `game-platformer/tests/reach-notice-plataforma.node.test.js`
// (issue #111). Its two assertions were not about the engine — they read `main.ts`'s source and asserted that the
// platform game's REAL preset has NINE actions. With the cartridge out, neither can be checked here, and faking the
// preset would erase exactly what they prove. What stays in this file is the TEXT of the notice, which is engine
// behaviour and depends on no game.

// ========================= MUTATIONS CHECKED (the second axis, ADR-0104) =========================
//   · `holds()` always returning `true` (the ceiling stops counting, and back comes the model where «chega» was the
//     only question) -> TWO fail, the two of the blind spot. It is the state of the repository until today.
//   · `holds()` reading absence as ZERO -> FOUR fail, and three of them are OLD cases: the keyboard and the gamepad,
//     which declare no ceiling, would fail EVERY game. Absence of a measure cannot become an accusation, and the
//     damage of reading it that way is much bigger than the new case that names it.
//   · `HOLDS_TOUCH` from 2 to 5 — which is exactly what `maxTouchPoints` tends to announce -> TWO fail. It is the
//     mutation that represents the whole decision of ADR-0104 §B: five is the number the device SAYS, two is what it DOES.
//   · `ok` back to `reachable(lista, acoes)` -> TWO fail. It would go back to saying «da para jogar» about a game that
//     cannot be played.
//   · `naoSeguram` without the `carries` filter -> the double-accusation case fails: the same device would appear on
//     both lists and the child would read two problems where there is one.
//   · removing the loop of the third sentence from `ui/reach-notice` -> the Portuguese sentence fails. `ok` would fail
//     and nobody would say why, which is the worse version of the original defect.
//
// And in `tests/contract.node.test.js`, about the required field:
//   · accepting an absent `holdsAtOnce` -> THREE fail, including the count of the nine fields.
//   · accepting zero -> the zero case fails. A game that holds nothing is not playable, and accepting it would make the
//     reach arithmetic pass by vacuity.
