// SPDX-License-Identifier: AGPL-3.0-or-later
// ONE COMMAND MODEL PER LANGUAGE, LOADED ONCE AND KEPT (ADR-0256; `platform/vosk-runtime.keepVoskModels`).
//
// 📏 Why this exists, measured on 2026-09-27: every start of the 👄 spawned a worker and unpacked ~40 MiB of model, and every
// choice by voice started two — the Dev's machine froze. The 👄 and a choice ask the same keeper; a listener that stops no longer
// ends the model; the root ends them all when it ends.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { keepVoskModels } from '../app/js/platform/vosk-runtime.js';

/** A loader whose models record whether they were ended. */
function loader({ fails = [] } = {}) {
  const log = { loads: [], ended: [] };
  const load = async (d) => {
    log.loads.push(d.language);
    if (fails.includes(d.language)) return { ok: false, missing: ['commands:model'] };
    const name = d.language;
    return { ok: true, model: { KaldiRecognizer: `recogniser of ${name}`, terminate: () => log.ended.push(name) } };
  };
  return { load, log };
}
const deps = (language) => ({ language, base: 'https://school.example/', hasFile: async () => true, loadBundle: async () => ({}) });

describe('the command models are kept', () => {
  it('🔴 [Right] a language is loaded once, however many ask — `pt` and `pt-BR` are the same model', async () => {
    const { load, log } = loader();
    const kept = keepVoskModels(load);
    await kept.load(deps('pt-BR'));
    await kept.load(deps('pt'));
    await kept.load(deps('pt-BR'));
    expect(log.loads).toEqual(['pt-BR']);
  });

  it('🔴 [Right] a listener ending the model it was handed ends NOTHING — the model stays for the next', async () => {
    const { load, log } = loader();
    const kept = keepVoskModels(load);
    const handed = await kept.load(deps('en-US'));
    expect(handed.model.KaldiRecognizer, 'the handed model does not reach the real recogniser').toBe('recogniser of en-US');
    handed.model.terminate();
    expect(log.ended, 'a listener that stopped ended the kept model').toEqual([]);
  });

  it('🔴 [Right] past `keep` languages the OLDEST is ended — the most recently asked stays', async () => {
    const { load, log } = loader();
    const kept = keepVoskModels(load, 2);
    await kept.load(deps('pt'));
    await kept.load(deps('en'));
    await kept.load(deps('pt')); // pt asked again: en is now the oldest
    await kept.load(deps('es'));
    await new Promise((r) => setTimeout(r, 0));
    expect(log.ended, 'the wrong model was pushed out').toEqual(['en']);
    await kept.load(deps('pt'));
    expect(log.loads, 'a model still kept was loaded again').toEqual(['pt', 'en', 'es']);
  });

  it('🔴 [Right] a load that failed is forgotten, so the model is found once it comes down', async () => {
    const fails = ['es'];
    const { load, log } = loader({ fails });
    const kept = keepVoskModels(load);
    expect((await kept.load(deps('es'))).ok).toBe(false);
    fails.length = 0;
    expect((await kept.load(deps('es'))).ok, 'a failed load was kept and answered again').toBe(true);
    expect(log.loads).toEqual(['es', 'es']);
  });

  it('🔴 [Right] the root\'s end ends every kept model', async () => {
    const { load, log } = loader();
    const kept = keepVoskModels(load);
    await kept.load(deps('pt'));
    await kept.load(deps('en'));
    kept.closeAll();
    await new Promise((r) => setTimeout(r, 0));
    expect(log.ended.sort()).toEqual(['en', 'pt']);
  });
});

// ===== MUTATIONS CHECKED (2026-09-27) =====
// a language loaded every time · the handed model ending the real one · the newest pushed out instead of the oldest · a failed
// load kept · closeAll ending nothing — 5 of 5 red (`scratchpad/mutate-one-ear.mjs`)
