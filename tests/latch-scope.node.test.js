// SPDX-License-Identifier: AGPL-3.0-or-later
// THE LATCH BELONGS TO A TRANSPORT, and on four of them it is no choice at all (ADR-0104 §C, issue #114).
//
// ========================= THE DEFECT THESE CASES HOLD =========================
// Stored per PLAYER — per person, for every device at once — turning the latch on for the on-screen pad, where nobody
// holds a virtual button comfortably, also turned it on for the keyboard, where holding a key is exactly what the child
// can do. Nobody asked for that and nothing said so.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  ONE_COMMAND_AT_A_TIME, latchAlwaysOn, latchIsOptional,
  latchKey, legacyLatchKey, latchOf,
} from '../app/js/input/latch-scope.js';
import { defaultTransports } from '../app/js/input/transports.js';

const nada = { fromTransport: null, fromLegacy: null, byDefault: false };

describe('input/latch-scope · a chave leva o transporte no nome', () => {
  it('[Right] a chave nova separa jogador E transporte; a antiga só separa jogador', () => {
    expect(latchKey('togglemove', 0, 'toque')).toBe('incl_togglemove_p0_toque');
    expect(latchKey('togglerun', 1, 'teclado')).toBe('incl_togglerun_p1_teclado');
    expect(legacyLatchKey('togglemove', 0)).toBe('incl_togglemove_p0');
  });

  it('⚠️ [Interface] a chave nova COMEÇA pela antiga, e é isso que a torna migrável', () => {
    // If the new name were not an extension of the old one, the inheritance below would need a separate conversion
    // table — and a separate table is where a pair gets lost without anyone seeing.
    for (const base of ['togglemove', 'togglerun']) {
      for (const t of ['toque', 'teclado', 'gamepad']) {
        expect(latchKey(base, 0, t).startsWith(legacyLatchKey(base, 0))).toBe(true);
      }
    }
  });

  it('⚠️ [Interface] dois transportes NUNCA partilham chave — é o vazamento que o §C fecha', () => {
    const chaves = defaultTransports({ gamepad: () => true, keyboard: () => true, touch: () => true, mouse: () => true })
      .map((t) => latchKey('togglemove', 0, t.id));
    expect(new Set(chaves).size, 'dois transportes escrevem no mesmo lugar').toBe(chaves.length);
    // And two PLAYERS do not either, the separation that already existed and must not have been lost on the way.
    expect(latchKey('togglemove', 0, 'toque')).not.toBe(latchKey('togglemove', 1, 'toque'));
  });
});

describe('input/latch-scope · nos transportes de UM COMANDO ela não é preferência', () => {
  it('[Right] olhos, rosto, gestos e fala estão sempre ligados; os três de hoje não', () => {
    for (const t of ['olhos', 'rosto', 'gestos', 'fala']) {
      expect(latchAlwaysOn(t), `${t} deixou de estar sempre ligado`).toBe(true);
      expect(latchIsOptional(t), `${t} passou a oferecer a opção`).toBe(false);
    }
    for (const t of ['teclado', 'gamepad', 'toque']) {
      expect(latchAlwaysOn(t), `${t} passou a estar sempre ligado`).toBe(false);
      expect(latchIsOptional(t)).toBe(true);
    }
  });

  it('⚠️ [Zero] e um `false` guardado NÃO os desliga — nem pelo legado', () => {
    // The worst possible defect, on the controller of whoever has the fewest alternatives: a child who had turned the
    // latch off on the keyboard would inherit that `false` and be left with a gaze control that does not respond. So
    // the question «este transporte é de um comando?» comes BEFORE any read.
    const desligado = { fromTransport: false, fromLegacy: false, byDefault: false };
    for (const t of ONE_COMMAND_AT_A_TIME) {
      expect(latchOf(t, desligado), `${t} foi desligado por um valor guardado`).toBe(true);
    }
  });

  it('[Interface] os quatro nomes são exactamente quatro — acrescentar um é uma decisão', () => {
    // A transport enters this list because it emits one command at a time, not because it would be convenient. If
    // someone puts touch here, the option stops being offered to whoever wants it off.
    expect([...ONE_COMMAND_AT_A_TIME].sort()).toEqual(['fala', 'gestos', 'olhos', 'rosto']);
  });
});

describe('input/latch-scope · a resolução, e a herança da chave antiga', () => {
  it('[Right] o valor DESTE transporte vence tudo o resto', () => {
    expect(latchOf('toque', { fromTransport: true, fromLegacy: false, byDefault: false })).toBe(true);
    expect(latchOf('toque', { fromTransport: false, fromLegacy: true, byDefault: true })).toBe(false);
  });

  it('⚠️ [Boundary] sem valor deste transporte, o LEGADO herda — e herda para todos', () => {
    // The old value was set by the child in some context and the key did not record which. The ways out were losing
    // the setting, guessing a transport, or inheriting for all. Only the third takes nothing from whoever depends on
    // the setting, and the leak it keeps lasts until they touch it once on each device.
    for (const t of ['toque', 'teclado', 'gamepad']) {
      expect(latchOf(t, { fromTransport: null, fromLegacy: true, byDefault: false })).toBe(true);
    }
  });

  it('[Zero] sem nada guardado, o padrão de fábrica responde', () => {
    expect(latchOf('teclado', nada)).toBe(false);
    expect(latchOf('teclado', { ...nada, byDefault: true })).toBe(true);
  });

  it('⚠️ [Boundary] `false` guardado é um VALOR, e não uma ausência', () => {
    // The classic mistake of this design is writing `l.doTransporte || l.doLegado || l.padrao`: a deliberate `false`
    // would fall through to the legacy value and the child who TURNED OFF the latch would see it come back by itself.
    expect(latchOf('teclado', { fromTransport: false, fromLegacy: true, byDefault: true })).toBe(false);
    expect(latchOf('teclado', { fromTransport: null, fromLegacy: false, byDefault: true })).toBe(false);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · ⚠️ TAKING THE TRANSPORT OUT OF THE KEY (back to `incl_${base}_p${jogador}`) -> TWO fail. It is the whole defect in
//     its original form: turning the latch on for the on-screen pad turns it on for the keyboard.
//   · putting the question «este transporte e de um comando?» AFTER the reads -> the stored-`false` case fails. A child
//     who had turned the latch off on the keyboard would inherit that `false` and be left with a gaze control that
//     does not respond — on the controller of whoever has the fewest alternatives.
//   · replacing the two `null` checks with `l.doTransporte || l.doLegado || l.padrao` — the classic mistake of this
//     design — -> TWO fail. A deliberate `false` would become an absence, and the latch the child TURNED OFF would
//     come back by itself.
//   · removing the legacy inheritance -> TWO fail. The child would lose the setting they already had, which is the
//     cost the inheritance exists not to charge.
//   · putting `toque` on the one-command list -> THREE fail. The option would stop being offered to whoever wants it
//     off, and an on-screen pad HOLDS two points — it is not one-command.
//   · taking `olhos` off the list -> TWO fail. It is the mutation that shows the list is a decision and not a detail:
//     one name leaves and a whole controller stops working.
//   · `latchIsOptional` always returning `true` -> the four-transports case fails. The panel would draw a button that
//     can do nothing, which is worse than not drawing it.
