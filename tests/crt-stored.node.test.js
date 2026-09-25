// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CRT A CHILD CHOSE, READ BACK: what `render/crt` makes of what the machine kept between sessions (ADR-0020, ADR-0047).
//
// 🔴 A probe before touching the load (2026-09-23) disabled fifteen of its decisions one at a time, and fourteen passed with the
// whole suite green: reading the old boolean format, the one-time return of the scanlines to ON in that migration, the corners
// mapping of `true`/`false`, the clamp to 0–2, the scanlines and the vignette being on/off only, a partial record keeping the
// defaults it does not name. The only stored value any case wrote was the factory one, so every answer looked right.
//
// The load runs in `createCrt`, from the store it receives (ADR-0232), so each case hands it a machine — a backend made of a
// Map. The config lives in the instance (ADR-0232 D4), so each case starts from its own.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createStorage } from '../app/js/platform/storage.js';
import { createCrt } from '../app/js/render/crt.js';

/** A machine's storage, holding exactly what a case says it holds. */
function maquina(guardado) {
  const m = new Map(Object.entries(guardado));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

/** The CRT the engine starts with on a machine that kept `guardado`. */
async function arrancarCom(guardado) {
  const { cfg } = createCrt({ region: () => null, win: { devicePixelRatio: 1 }, numPlayers: () => 1,
    scanlineYields: () => false, vignetteYields: () => false, store: createStorage(maquina(guardado)) });
  return { ...cfg };
}

const ATUAL = 'incl_crt2';
const ANTIGO = 'incl_crt';
const json = (o) => JSON.stringify(o);


describe('the stored CRT, read back at boot', () => {
  it('🔴 [Zero] a machine that kept nothing starts with the factory CRT: scanlines on, no vignette, the usual corners', async () => {
    expect(await arrancarCom({})).toEqual({ scan: 1, vig: 0, round: 1 });
  });

  it('🔴 [Right] what the child chose comes back as chosen — scanlines OFF included', async () => {
    expect(await arrancarCom({ [ATUAL]: json({ scan: 0, vig: 1, round: 2 }) })).toEqual({ scan: 0, vig: 1, round: 2 });
  });

  it('🔴 [Right] a record that names only some settings keeps the factory value of the others', async () => {
    expect(await arrancarCom({ [ATUAL]: json({ vig: 1 }) })).toEqual({ scan: 1, vig: 1, round: 1 });
  });

  it('🔴 [Right] the OLD format, all booleans, is read: a vignette on, and round corners on are the ROUNDEST level', async () => {
    // ⚠️ And the scanlines come back ON, once: the scanlines were made the default after this format existed (decision of
    // 2026-07-03), so a machine that still holds it never chose them off against the default.
    expect(await arrancarCom({ [ANTIGO]: json({ scan: false, vig: true, round: true }) }))
      .toEqual({ scan: 1, vig: 1, round: 2 });
  });

  it('🔴 [Right] and in the old format, round corners OFF are the usual corners, not square ones', async () => {
    expect(await arrancarCom({ [ANTIGO]: json({ vig: false, round: false }) })).toEqual({ scan: 1, vig: 0, round: 1 });
  });

  it('🔴 [Right] where both formats are kept, the current one wins', async () => {
    const arrancou = await arrancarCom({ [ATUAL]: json({ vig: 0 }), [ANTIGO]: json({ vig: true, round: true }) });
    expect(arrancou).toEqual({ scan: 1, vig: 0, round: 1 });
  });

  it('📌 [Boundary] a level out of range is clamped to 0–2, and a fraction dropped', async () => {
    expect((await arrancarCom({ [ATUAL]: json({ round: 7 }) })).round).toBe(2);
    expect((await arrancarCom({ [ATUAL]: json({ round: -3 }) })).round).toBe(0);
    expect((await arrancarCom({ [ATUAL]: json({ round: 1.9 }) })).round).toBe(1);
  });

  it('📌 [Boundary] the scanlines and the vignette are on or off — only the corners have three levels', async () => {
    expect(await arrancarCom({ [ATUAL]: json({ scan: 2, vig: 2, round: 2 }) })).toEqual({ scan: 1, vig: 1, round: 2 });
  });

  it('⚠️ [Error] a record that cannot be read starts the factory CRT, never a broken boot', async () => {
    expect(await arrancarCom({ [ATUAL]: 'não é json' })).toEqual({ scan: 1, vig: 0, round: 1 });
  });

  it('⚠️ [Error] and so does a record that reads as a number or a string, which has no settings in it', async () => {
    expect(await arrancarCom({ [ATUAL]: '5' })).toEqual({ scan: 1, vig: 0, round: 1 });
    expect(await arrancarCom({ [ATUAL]: json('scan') })).toEqual({ scan: 1, vig: 0, round: 1 });
  });
});

// ============================== MUTATIONS CHECKED ==============================
// `scratchpad/sonda-crt.py --novos`, the fifteen decisions of the load:
//   P1 the old format not read                      🔴 «the OLD format, all booleans, is read»
//   P3 the migration never counted as one           🔴 same (the scanlines stay off)
//   P5 absent keys read as 0                        🔴 «a record that names only some settings»
//   P6 / P7 the scanlines' return, dropped / always 🔴 «the OLD format…» / «…scanlines OFF included»
//   P8 / P9 the corners of `true` / `false`         🔴 «…ROUNDEST level» / «…round corners OFF are the usual corners»
//   P10 / P11 the clamp, above / below              🔴 «a level out of range is clamped»
//   P12 / P13 scanlines / vignette kept at 2        🔴 «…on or off»
//   P14 the factory scanlines off                   🔴 «a machine that kept nothing»
//   P15 an unreadable record thrown                 🔴 «a record that cannot be read»
// Two are EQUIVALENT and declared rather than caught:
//   P2 nothing stored parsed as `{}` instead of `null` — an empty object names no key, so the defaults stand either way;
//   P4 the object check dropped — a stored number or string then throws on `k in s`, and the same `catch` answers the
//      factory CRT.
//
// RE-PROBED IN THE NEW SHAPE (`crtFromStored`, `storedRecord`, `levelOf` — `scratchpad/sonda-crt-3.py`): 17 of 18 red. P4
// is NOT equivalent there any more: the `catch` now covers only the parse, so the object check alone keeps a stored number or
// string from throwing at import, and «a record that reads as a number or a string» holds it (green on the old shape too).
// P2 stays equivalent. Three more only the named steps let one ask: no record means no key is read, the current format is
// read first, and every stored value goes through its level.
