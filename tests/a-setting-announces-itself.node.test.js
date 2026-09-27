// SPDX-License-Identifier: AGPL-3.0-or-later
// A SETTING THAT CHANGES WITHOUT SAYING SO IS INVISIBLE TO WHOEVER USES A SCREEN READER.
//
// ========================= THE DEFECT THIS EXISTS TO NOT REPEAT =========================
// The audio panel's `#opt-modocego` was once MUTE. Its five siblings announced (sound, narration, the cane divider, the
// menu index, the audio output) and it did not — it only SEEMED to, because a cartridge announced from its own blind-mode
// setter, and the panel inherited the effect for free.
//
// ⚠️ AND THE SILENCE BECAME REACHABLE ONLY WHEN THE FIELD GOT AN ENGINE DEFAULT. While `setBlindMode` was REQUIRED,
// every consumer had to supply a setter, and the platformer's spoke. The moment the field became optional — with a
// default that stores, persists and emits, but does NOT speak —, a game that does not inject it had a toggle that
// changes the state and does not say so.
//
// ========================= THE RULE, AND WHY IT CAN BE GATED =========================
// The neighbours of the fixed module were looked at («uma causa achada não é a causa toda») and there are THREE more
// settings of the same shape: hearing loss, one-button and wheelchair. The announcement of all three lives in the
// INJECTED setter — `ui/settings-empathy` records the dependency without noticing, in the reset button's comment:
// «Cada setter já é idempotente e ANUNCIA SOZINHO ao mudar».
//
// 📌 TODAY THERE IS NO SILENCE: the three are still REQUIRED, so every consumer supplies a setter. What this file asserts
// is the only half a machine can see: **while the announcement lives in the injected setter, the field cannot become
// optional**. Making one of them optional demands, IN THE SAME COMMIT, moving the announcement into the panel — and that
// is what the failure message tells whoever gets there.
//
// ⚠️ WHAT THIS DOES NOT PROVE, said up front: that the panels announce. Those are behaviour cases, and they live in the
// panels' files (blind mode's is in `settings-audio.browser`). Here only the DOOR the defect came in by is guarded.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formaDe, memberKeys } from '../scripts/shape-surface.mjs';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const forma = formaDe(join(RAIZ, 'app', 'js'));

/** Where each setting's announcement lives TODAY, measured on both sides. */
const ANUNCIO_NO_SETTER_INJETADO = [
  {
    modulo: 'ui/settings-empathy.ts', type: 'interface EmpathySettingsCtx', campo: 'setHearingLoss',
    onde: 'game-platformer/main.ts:568 — `sr.empathy.hearingOn/Off`',
  },
  {
    modulo: 'ui/settings-empathy.ts', type: 'interface EmpathySettingsCtx', campo: 'setOneButton',
    onde: 'game-platformer/main.ts:1664 — `sr.motor.oneButtonOn/Off`',
  },
  {
    modulo: 'ui/settings-empathy.ts', type: 'interface EmpathySettingsCtx', campo: 'setWheelchair',
    onde: 'game-platformer/main.ts:1667+ — depois dos efeitos',
  },
];

// The keys of an interface entry are its member names, with `?` on the optional ones.
const membros = (modulo, tipo) => memberKeys(forma[modulo]?.[tipo]);

describe('um ajuste não pode ficar mudo ao ganhar padrão da engine', () => {
  it('⚠️ [Interface] o crivo está VIVO — lê os tipos de verdade', () => {
    // Without this, an empty list would make the cases below pass for having nothing to examine.
    expect(membros('ui/settings-empathy.ts', 'interface EmpathySettingsCtx').length).toBeGreaterThan(10);
    expect(membros('ui/pause-icons.ts', 'interface PauseIconsCtx').length).toBeGreaterThan(10);
  });

  it('⚠️ [Zero] os TRÊS cujo anúncio mora no cartucho continuam OBRIGATÓRIOS', () => {
    const opcionais = ANUNCIO_NO_SETTER_INJETADO.filter(
      (a) => membros(a.modulo, a.type).includes(`${a.campo}?`),
    );
    expect(
      opcionais.map((a) => `${a.campo} (anúncio em ${a.onde})`),
      'ESTE CAMPO VIROU OPCIONAL E O ANÚNCIO FICOU NO CARTUCHO. Um jogo que não injecta o setter passa a ter '
      + 'um alternador que muda o estado sem o dizer — invisível para quem usa leitor de tela. Mova o `srSay` '
      + 'para o PAINEL no MESMO commit, ponha-lhe um caso, e tire a entrada da lista deste ficheiro. Foi '
      + 'exactamente isto que aconteceu ao `#opt-modocego` em 2026-09-08.',
    ).toEqual([]);
  });

  it('📌 [Right] e o modo cego é o exemplo RESOLVIDO — opcional porque o anúncio mudou de casa', () => {
    // The rule has a way out, and it was taken: `setBlindMode` is optional in the three places that asked for it, and the
    // audio panel now announces (case in `settings-audio.browser.test.js`). Without this case, the rule would read as
    // never making anything optional, which is not what it says.
    expect(membros('ui/pause-icons.ts', 'interface PauseIconsCtx')).toContain('setBlindMode?');
    expect(membros('ui/settings-audio.ts', 'interface SettingsAudioCtx')).toContain('setBlindMode?');
    // And the field is NOT on the list above — because the announcement no longer lives in the cartridge.
    expect(ANUNCIO_NO_SETTER_INJETADO.some((a) => a.campo === 'setBlindMode')).toBe(false);
  });

  it('[Interface] a lista não tem ÓRFÃOS — entrada que nomeia campo inexistente', () => {
    const orfaos = ANUNCIO_NO_SETTER_INJETADO.filter((a) => {
      const m = membros(a.modulo, a.type);
      return !m.includes(a.campo) && !m.includes(`${a.campo}?`);
    });
    expect(orfaos.map((a) => a.campo), 'entrada a descrever um campo que já não existe').toEqual([]);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · making `setHearingLoss` optional in `EmpathySettingsCtx` (the REAL tree) -> fails the three-are-still-required
//     case, naming the field and where the announcement lives. It is today's defect trying to repeat itself.
//   · taking `setBlindMode?` out of `PauseIconsCtx` (back to required) -> fails the SOLVED-example case. Without it the
//     rule would read as never making anything optional, which is not what it says — and a rule with no way out is a
//     rule someone switches off.
//   · putting on the list a field that does not exist -> fails the ORPHAN case. Without it the list rots and starts
//     describing a repository that no longer exists.
//   · making `formaDe` return `{}` -> fails the VACUUM case, and only it: the other three would pass for having nothing
//     to examine.
