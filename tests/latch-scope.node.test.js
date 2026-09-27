// SPDX-License-Identifier: AGPL-3.0-or-later
// THE LATCH BELONGS TO A TRANSPORT, and on four of them the GAME sets its default (ADR-0104 §C, issue #114, ADR-0249).
//
// ========================= THE DEFECT THESE CASES HOLD =========================
// Stored per PLAYER — per person, for every device at once — turning the latch on for the on-screen pad, where nobody
// holds a virtual button comfortably, also turned it on for the keyboard, where holding a key is exactly what the child
// can do. Nobody asked for that and nothing said so.
//
// And on eyes, face, gestures and speech (ADR-0249): a word or a look is one tap. Whether the tap keeps going is the
// game's `holdsKeys()` — «direita» keeps a platform character walking, «abaixo» moves a quiz cursor once — and the
// child's stored choice for that transport wins over it.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  ONE_COMMAND_AT_A_TIME, latchDefaultFromGame,
  latchKey, legacyLatchKey, latchOf,
} from '../app/js/input/latch-scope.js';
import { defaultTransports } from '../app/js/input/transports.js';

const nada = { fromTransport: null, fromLegacy: null, byDefault: false, gameHoldsKeys: false };
const QUATRO = ['olhos', 'rosto', 'gestos', 'fala'];

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

describe('input/latch-scope · nos transportes de UM COMANDO o padrão é o do jogo (ADR-0249)', () => {
  it('[Right] olhos, rosto, gestos e fala tomam o padrão do jogo; os três de hoje não', () => {
    for (const t of QUATRO) expect(latchDefaultFromGame(t), `${t} deixou de seguir o jogo`).toBe(true);
    for (const t of ['teclado', 'gamepad', 'toque']) {
      expect(latchDefaultFromGame(t), `${t} passou a seguir o jogo — teclado e toque guardam as suas regras`).toBe(false);
    }
  });

  it('🔴 [Right] um jogo que NÃO segura teclas: sem nada guardado, a fala e a câmara NÃO aderem', () => {
    // The quiz: «abaixo» must press once. A latch here would keep the press down and the next word would only release it.
    for (const t of QUATRO) {
      expect(latchOf(t, { ...nada, gameHoldsKeys: false }), `${t} aderiu num jogo que não segura nada`).toBe(false);
    }
  });

  it('🔴 [Right] um jogo que segura teclas: sem nada guardado, eles aderem', () => {
    // The platform game: «direita» keeps the character walking.
    for (const t of QUATRO) {
      expect(latchOf(t, { ...nada, gameHoldsKeys: true }), `${t} não aderiu num jogo que segura`).toBe(true);
    }
  });

  it('🎯 [Right] a escolha GUARDADA para aquele transporte vence qualquer dos dois padrões', () => {
    for (const t of QUATRO) {
      expect(latchOf(t, { ...nada, fromTransport: false, gameHoldsKeys: true }), `${t}: o «desligado» dela foi ignorado`)
        .toBe(false);
      expect(latchOf(t, { ...nada, fromTransport: true, gameHoldsKeys: false }), `${t}: o «ligado» dela foi ignorado`)
        .toBe(true);
    }
  });

  it('⚠️ [Boundary] o LEGADO não chega aos quatro — lá o padrão é do jogo, não do teclado', () => {
    // The per-player key is still written by every latch change, on any device: a choice made on the keyboard is not a
    // choice about how a spoken word behaves in THIS game. Inheriting it would latch a quiz for the child who latched
    // her keyboard.
    for (const t of QUATRO) {
      expect(latchOf(t, { ...nada, fromLegacy: true, gameHoldsKeys: false }), `${t} herdou o legado do teclado`).toBe(false);
      expect(latchOf(t, { ...nada, fromLegacy: false, gameHoldsKeys: true }), `${t} herdou o legado do teclado`).toBe(true);
    }
  });

  it('[Boundary] e o padrão do jogo NÃO toca os três de hoje', () => {
    for (const t of ['teclado', 'gamepad', 'toque']) {
      expect(latchOf(t, { ...nada, gameHoldsKeys: true }), `${t} passou a aderir porque o jogo segura`).toBe(false);
    }
  });

  it('[Interface] os quatro nomes são exactamente quatro — acrescentar um é uma decisão', () => {
    // A transport enters this list because it emits one command at a time, not because it would be convenient. If
    // someone puts touch here, its default stops being the factory's and becomes the game's.
    expect([...ONE_COMMAND_AT_A_TIME].sort()).toEqual(['fala', 'gestos', 'olhos', 'rosto']);
  });
});

describe('input/latch-scope · a resolução, e a herança da chave antiga', () => {
  it('[Right] o valor DESTE transporte vence tudo o resto', () => {
    expect(latchOf('toque', { ...nada, fromTransport: true, fromLegacy: false })).toBe(true);
    expect(latchOf('toque', { ...nada, fromTransport: false, fromLegacy: true, byDefault: true })).toBe(false);
  });

  it('⚠️ [Boundary] sem valor deste transporte, o LEGADO herda — para o teclado, o comando e o toque', () => {
    // The old value was set by the child in some context and the key did not record which. The ways out were losing
    // the setting, guessing a transport, or inheriting for all. Only the third takes nothing from whoever depends on
    // the setting, and the leak it keeps lasts until they touch it once on each device.
    for (const t of ['toque', 'teclado', 'gamepad']) {
      expect(latchOf(t, { ...nada, fromLegacy: true })).toBe(true);
    }
  });

  it('[Zero] sem nada guardado, o padrão de fábrica responde', () => {
    expect(latchOf('teclado', nada)).toBe(false);
    expect(latchOf('teclado', { ...nada, byDefault: true })).toBe(true);
  });

  it('⚠️ [Boundary] `false` guardado é um VALOR, e não uma ausência', () => {
    // The classic mistake of this design is writing `l.fromTransport || l.fromLegacy || l.byDefault`: a deliberate `false`
    // would fall through to the legacy value and the child who TURNED OFF the latch would see it come back by itself.
    expect(latchOf('teclado', { ...nada, fromTransport: false, fromLegacy: true, byDefault: true })).toBe(false);
    expect(latchOf('teclado', { ...nada, fromLegacy: false, byDefault: true })).toBe(false);
  });
});

// ========================= MUTATIONS CHECKED =========================
// (2026-09-27, ADR-0249) — `scratchpad/latch-by-game/mutate.mjs`, one occurrence required per anchor, restored from a copy
// checked by SHA-256 (14 red across the latch files and the root for the first):
//   · `latchOf` answering `true` on the four again, before the stored value (the superseded rule) 🔴 «um jogo que NÃO segura…»,
//     «a escolha GUARDADA…», «o LEGADO não chega…»
//   · the game's answer read BEFORE the stored value                                🔴 «a escolha GUARDADA…»
//   · the four inheriting the legacy key                                            🔴 «o LEGADO não chega aos quatro»
//   · `latchOf` ignoring the game's answer (always `false`)                         🔴 «um jogo que segura teclas…», «o LEGADO…»
//   · `latchDefaultFromGame` answering for every transport                           🔴 «os três de hoje não», «NÃO toca os três»,
//     the legacy inheritance and the factory default
// Kept from 2026-09-08:
//   · ⚠️ TAKING THE TRANSPORT OUT OF THE KEY (back to `incl_${base}_p${player}`) -> TWO fail. It is the whole defect in
//     its original form: turning the latch on for the on-screen pad turns it on for the keyboard.
//   · replacing the two `null` checks with `||` — the classic mistake of this design — -> the `false`-is-a-value case fails.
//   · removing the legacy inheritance -> TWO fail. The child would lose the setting they already had.
//   · putting `toque` on the one-command list -> THREE fail.
//   · taking `olhos` off the list -> the four-names cases fail.
