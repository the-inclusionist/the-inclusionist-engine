// SPDX-License-Identifier: AGPL-3.0-or-later
// REDUCED SCENE MOTION BELONGS TO THE ENGINE (ADR-0106 §4, step 1).
//
// ⚠️ THIS MODULE WAS BORN GREEN, SO GREEN IS NOT THE PROOF. It fixes no visible defect: it gives the engine four things
// every cartridge had to remember to write. What proves coverage are the mutations at the end of the file.
//
// ⚠️ AND THE CASE THAT MATTERS MOST IS THE TRUNCATED SAVE, because it is the only one where the right behaviour and the
// convenient one diverge: spreading the object (`{...guardado}`) is shorter and leaves a missing key as `undefined` —
// which reads as «não reduzido» for a child who asked for reduction.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, afterEach } from 'vitest';
import {
  SCENE_KEYS, CHARACTER_ANIMATIONS, sceneDefault, readStoredScene, storeScene,
} from '../app/js/ui/motion-scene.js';
import { RM_LABEL } from '../app/js/ui/motion-choices.js';
import { KEYS } from '../app/js/platform/storage.js';

/** A fake `localStorage`, because the `node` project has none and the storage layer degrades silently (every access is
 *  `try/catch`) — without the double, the truncated case would have nothing to read. */
function comArmazenamento(inicial = {}) {
  const dados = { ...inicial };
  globalThis.localStorage = {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
  };
  return dados;
}
afterEach(() => { delete globalThis.localStorage; });

describe('ADR-0106 · o movimento reduzido de cena pertence à engine', () => {
  it('[Right] sem nada guardado, as QUATRO chaves existem e seguem o padrão do sistema', () => {
    comArmazenamento();
    const rm = readStoredScene();
    // The `node` project has no `window`, so `defaultReducedMotion()` answers `false` — and what is asserted is that the
    // four keys EXIST with that value, not that the value is false in itself.
    expect(Object.keys(rm).sort()).toEqual(['decor', 'items', 'parallax', 'particles']);
    expect(Object.values(rm).every((v) => v === false)).toBe(true);
    expect(rm).toEqual(sceneDefault());
  });

  it('⚠️ [Right] um guardado TRUNCADO não deixa chave por preencher — `undefined` seria «não reduzido»', () => {
    // An object with ONE key is what a truncated store, or one from an earlier version, returns.
    comArmazenamento({ [KEYS.reducedMotion]: JSON.stringify({ parallax: true }) });
    const rm = readStoredScene();
    expect(rm.parallax).toBe(true);
    expect(rm.decor).toBe(false);
    expect(rm.items).toBe(false);
    expect(rm.particles).toBe(false);
    expect(Object.keys(rm).sort()).toEqual(['decor', 'items', 'parallax', 'particles']);
  });

  it('⚠️ [Right] uma chave A MAIS no guardado NÃO entra — o dado vem do navegador de uma criança', () => {
    comArmazenamento({ [KEYS.reducedMotion]: JSON.stringify({ parallax: true, cintilar: true }) });
    expect(Object.keys(readStoredScene()).sort()).toEqual(['decor', 'items', 'parallax', 'particles']);
  });

  it('[Right] um guardado corrompido cai no padrão em vez de rebentar', () => {
    comArmazenamento({ [KEYS.reducedMotion]: 'isto não é JSON' });
    expect(readStoredScene()).toEqual(sceneDefault());
  });

  it('[Right] `guardarCena` escreve na chave da ENGINE, que é onde o cartucho já escrevia', () => {
    // The silent migration this case prevents: storing under another key would lose the setting of every child who
    // already played, with nothing saying it was lost.
    const dados = comArmazenamento();
    storeScene({ parallax: true, decor: false, items: true, particles: false });
    expect(JSON.parse(dados[KEYS.reducedMotion])).toEqual({ parallax: true, decor: false, items: true, particles: false });
  });

  it('⚠️ [Interface] os rótulos do personagem são os que o `RM_LABEL` produz — duas tabelas, uma palavra', () => {
    // A cross-check between tables written separately, not a mirror: `RM_LABEL` maps `walk`→`rm.walk`, and this list maps
    // `rmWalk`→`rm.walk`. Writing `rm.andar` on one side fails here.
    const producidos = new Set(Object.values(RM_LABEL));
    for (const a of CHARACTER_ANIMATIONS) {
      expect(producidos.has(a.lbl), `${a.prop} usa «${a.lbl}», que o RM_LABEL não produz`).toBe(true);
    }
    expect(CHARACTER_ANIMATIONS.map((a) => a.prop)).toEqual(['rmWalk', 'rmBreath', 'rmFlavor']);
  });

  it('[Interface] as quatro chaves de cena também são rotuladas pelo `RM_LABEL`', () => {
    for (const k of SCENE_KEYS) {
      expect(RM_LABEL[k], `a cena «${k}» não tem rótulo`).toBeTruthy();
    }
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · ⚠️ replacing the loop with `{ ...guardado }` in `readStoredScene` -> TWO fail: the TRUNCATED one (the three
//     missing keys stay `undefined`, and `undefined` reads as «nao reduzido» for whoever asked for reduction) and the
//     EXTRA-key one (`cintilar` enters the object). It is the shorter and more readable of the two versions, which is
//     exactly why it needs a case holding it.
//   · replacing `!!guardado[k]` with `guardado[k]` -> the TRUNCATED case fails: missing keys stop being `false` and
//     become `undefined`, and `toBe(false)` catches the difference an `if` would not.
//   · changing the key in `storeScene` -> "escreve na chave da ENGINE" fails. Without that case, a key change would
//     pass green and lose the setting of every child who already played.
//   · removing the read's `try/catch` (via `getJSON`) is not mutable from here — the CORRUPTED case covers the
//     behaviour, not the implementation: with `JSON.parse` throwing unguarded, it fails.
//   · removing `'particles'` from `SCENE_KEYS` -> ⚠️ fails NO test: **it does not compile**. The `_COBRE_A_UNIAO`
//     guard is the COMPILER's, on purpose — a hand-written list beside a union is the defect shape this file exists to
//     undo, and a test repeating it would be a third copy. Checked: `npx tsc --noEmit` gives TS2322 on the guard's line.
//   · replacing `lbl: 'rm.walk'` with `lbl: 'rm.andar'` -> the case of the character's labels and `RM_LABEL` fails. The
//     two tables were written in different places, so this is a cross-check and not a mirror: the assertion does not
//     move with the action.
