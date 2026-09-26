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
import { HEAVY_FILES } from '../app/js/platform/heavy-catalogue.js';
import { MIRROR_FOLDERS, NOT_MIRRORED, mirrorPathOf, heavySourceOf, baseIsRemote } from '../app/js/platform/heavy-mirror.js';

const BASE = 'https://lfs-oinclusionista.jrocha.dev.br';

describe('the base of the heavy files', () => {
  it('🔴 [Zero] with no base, every file is still fetched from upstream', () => {
    for (const p of HEAVY_FILES) {
      if (!p.url) continue;
      expect(heavySourceOf(p.url)).toBe(p.url);
      expect(heavySourceOf(p.url, '')).toBe(p.url);
    }
  });

  it('🔴 [Right] with a base, every catalogued file either has a path under it or is named as not mirrored, with a reason', () => {
    const semEspelho = HEAVY_FILES.filter((p) => p.url && !mirrorPathOf(p.url))
      .filter((p) => !NOT_MIRRORED.some(([prefix]) => p.url.startsWith(prefix)))
      .map((p) => p.id);
    expect(semEspelho, 'a heavy file the mirror does not hold: add its folder to MIRROR_FOLDERS, or say why not in NOT_MIRRORED').toEqual([]);
    for (const [prefix, why] of NOT_MIRRORED) {
      expect(HEAVY_FILES.some((p) => p.url?.startsWith(prefix)), `${prefix} is named as not mirrored and nothing uses it`).toBe(true);
      expect(why.length, 'a file left out of the mirror without a reason is a hole').toBeGreaterThan(20);
    }
  });

  it('🔴 [Right] nothing stays outside the mirror, and espeak-ng is read from the folder of the project\'s own build', () => {
    /*
     * 📌 The list of what stays upstream is EMPTY. Its last line was the npm build of eSpeak NG, kept on jsDelivr because the
     * project could not name the source it was built from, and mirroring a GPL binary is distributing it. The engine now pins its
     * own build (issue #192, `scripts/models/build-espeak-ng.ps1`), whose folder carries that source — so a base serves it like
     * any other file, from that folder, and a local base (the staging tree) is how a delivery is built before the upload.
     *
     * 🎯 What the case holds is the RULE, not the number: whatever stays outside the mirror carries a written REASON, and
     * everything not on that list must have a path in the mirror.
     */
    expect(NOT_MIRRORED, 'something left the mirror: write it here with its reason, and check what the bucket serves').toEqual([]);
    const foraDoEspelho = HEAVY_FILES.filter((p) => p.url && !mirrorPathOf(p.url))
      .filter((p) => !NOT_MIRRORED.some(([prefixo]) => p.url.startsWith(prefixo))).map((p) => p.id);
    expect(foraDoEspelho, 'um pesado sem caminho no espelho e sem razão para isso').toEqual([]);
    const ort = HEAVY_FILES.find((p) => p.id === 'voz:runtime:onnx').url;
    expect(heavySourceOf(ort, BASE)).toBe(`${BASE}/onnxruntime-web-1.27.0/dist/ort.webgpu.bundle.min.mjs`);
    const espeak = (id) => heavySourceOf(HEAVY_FILES.find((p) => p.id === id).url, 'C:\\lfs');
    expect(espeak('voz:runtime:fonemas')).toBe('C:\\lfs/espeak-ng-530bf0a/espeak-ng.js');
    expect(espeak('voz:runtime:fonemas:wasm')).toBe('C:\\lfs/espeak-ng-530bf0a/espeak-ng.wasm');
  });

  it('🔴 [Right] the path is the one the staging tree uses, folder by folder', () => {
    const ondeFica = (id) => heavySourceOf(HEAVY_FILES.find((p) => p.id === id).url, BASE);
    expect(ondeFica('voz:kokoro:modelo')).toBe(`${BASE}/kokoro-82m-v1.0-onnx/onnx/model.onnx`);
    expect(ondeFica('voz:kokoro:pf_dora')).toBe(`${BASE}/kokoro-82m-v1.0-onnx/voices/pf_dora.bin`);
    expect(ondeFica('visao:runtime:wasm')).toBe(`${BASE}/mediapipe-tasks-vision-1.0.1/tasks-vision@1.0.1/wasm/vision_wasm_internal.wasm`);
    expect(ondeFica('visao:modelo:gestos'))
      .toBe(`${BASE}/mediapipe-tasks-vision-1.0.1/models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`);
  });

  it('📌 [Boundary] a base with a trailing slash gives the same address as one without', () => {
    const url = HEAVY_FILES.find((p) => p.id === 'voz:kokoro:tokenizador').url;
    expect(heavySourceOf(url, `${BASE}/`)).toBe(heavySourceOf(url, BASE));
  });

  it('📌 [Right] a folder on the machine is a base too, and is told apart from an address', () => {
    const url = HEAVY_FILES.find((p) => p.id === 'visao:modelo:rosto').url;
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
// MUTATIONS CHECKED (2026-09-26, issue #192) — `scratchpad/espeak-own/mutate.mjs`:
//   · eSpeak NG put back in `NOT_MIRRORED`               → «nothing stays outside the mirror»
//   · the build's folder mapped to `espeak-ng-1.0.2`     → «nothing stays outside the mirror» (the path under a local base)
