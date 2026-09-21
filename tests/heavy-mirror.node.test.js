// SPDX-License-Identifier: AGPL-3.0-or-later
// WHERE A HEAVY FILE COMES FROM (the Dev, 2026-09-21: a `.env` that points at a local copy while testing and at the project's
// bucket otherwise, «isso facilitaria quando tivermos que hospedar em outros servidores»).
//
// What must hold: with no base, nothing changes and the build still fetches upstream; with a base, every catalogued file has a
// path under it, and that path is the one the staging tree uses. The sha256 check is untouched either way — it is what makes
// moving the base safe.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { PESADOS } from '../app/js/platform/pesados-catalogo.js';
import { MIRROR_FOLDERS, mirrorPathOf, heavySourceOf, baseIsRemote } from '../app/js/platform/heavy-mirror.js';

const BASE = 'https://lfs-oinclusionista.jrocha.dev.br';

describe('the base of the heavy files', () => {
  it('🔴 [Zero] with no base, every file is still fetched from upstream', () => {
    for (const p of PESADOS) {
      if (!p.url) continue;
      expect(heavySourceOf(p.url)).toBe(p.url);
      expect(heavySourceOf(p.url, '')).toBe(p.url);
    }
  });

  it('🔴 [Right] with a base, every catalogued file has a path under it', () => {
    const semEspelho = PESADOS.filter((p) => p.url && !mirrorPathOf(p.url)).map((p) => p.id);
    expect(semEspelho, 'a heavy file the mirror does not hold: add its folder to MIRROR_FOLDERS').toEqual([]);
  });

  it('🔴 [Right] the path is the one the staging tree uses, folder by folder', () => {
    const ondeFica = (id) => heavySourceOf(PESADOS.find((p) => p.id === id).url, BASE);
    expect(ondeFica('voz:kokoro:modelo')).toBe(`${BASE}/kokoro-82m-v1.0-onnx/onnx/model.onnx`);
    expect(ondeFica('voz:kokoro:pf_dora')).toBe(`${BASE}/kokoro-82m-v1.0-onnx/voices/pf_dora.bin`);
    expect(ondeFica('visao:runtime:wasm')).toBe(`${BASE}/mediapipe-tasks-vision-1.0.1/tasks-vision@1.0.1/wasm/vision_wasm_internal.wasm`);
    expect(ondeFica('visao:modelo:gestos'))
      .toBe(`${BASE}/mediapipe-tasks-vision-1.0.1/models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`);
  });

  it('📌 [Boundary] a base with a trailing slash gives the same address as one without', () => {
    const url = PESADOS.find((p) => p.id === 'voz:kokoro:tokenizador').url;
    expect(heavySourceOf(url, `${BASE}/`)).toBe(heavySourceOf(url, BASE));
  });

  it('📌 [Right] a folder on the machine is a base too, and is told apart from an address', () => {
    const url = PESADOS.find((p) => p.id === 'visao:modelo:rosto').url;
    expect(heavySourceOf(url, 'C:\\lfs')).toBe('C:\\lfs/mediapipe-tasks-vision-1.0.1/models/face_landmarker/face_landmarker/float16/1/face_landmarker.task');
    expect(baseIsRemote('C:\\lfs')).toBe(false);
    expect(baseIsRemote('/srv/lfs')).toBe(false);
    expect(baseIsRemote(BASE)).toBe(true);
    expect(baseIsRemote('http://localhost:8207/lfs')).toBe(true);
  });

  it('⚠️ [Zero] an address of nobody\'s mirror is left alone: a base is not a rewrite rule', () => {
    expect(mirrorPathOf('https://example.org/whatever.bin')).toBeNull();
    expect(heavySourceOf('https://example.org/whatever.bin', BASE)).toBe('https://example.org/whatever.bin');
    expect(MIRROR_FOLDERS.length, 'the mapping emptied: every file would silently go on fetching upstream').toBeGreaterThan(2);
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-heavy-mirror.py`:
//   · the base used even where no mirror holds the file  → «an address of nobody's mirror is left alone»
//   · the base ignored when it is set                    → «with a base, every catalogued file has a path»
//   · the upstream prefix kept in the mirror path        → «the path is the one the staging tree uses»
//   · the trailing slash not trimmed                     → «a base with a trailing slash»
//   · a folder on the machine read as an address         → «a folder on the machine is a base too»
