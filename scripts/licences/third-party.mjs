// SPDX-License-Identifier: AGPL-3.0-or-later
//
// WHAT A DELIVERY OWES THE PEOPLE WHOSE HEAVY FILES IT CARRIES (ADR-0177 delivery of heavy files, ADR-0203 mirror).
//
// `inclusionist-heavy` copies third-party runtimes and models into a delivery's `heavy/` folder, and a copy handed to a school is
// a distribution: Apache-2.0 §4(a) asks for the licence text to travel with it and §4(d) for the NOTICE attributions, MIT for its
// copyright and permission notice, GPL-3.0 for its text and the Corresponding Source (§6). So every folder of `heavy/` that
// receives a file also receives the `LICENSE` and `NOTICE` of the project it belongs to (and eSpeak NG's a `SOURCE`), and
// `heavy/THIRD-PARTY-NOTICES.md` lists each project written, with where its texts sit.
//
// 📌 THE TEXTS LIVE HERE, beside this module, and ship in the npm package (`files`): the command runs from `node_modules` on a
// school's build machine, which has neither the engine's `node_modules` nor the mirror. Each was COPIED from a local file, never
// written from memory — `LICENCE_TEXTS` names the file and pins its sha256, and `tests/heavy-licences.node.test.js` holds both.
//
// 📌 A CATALOGUE ENTRY WITH NO GROUP HERE IS NOT WRITTEN: the delivery refuses a file whose licence nobody recorded, the same way
// it refuses a file whose sha256 differs. Adding an entry to `app/js/platform/heavy-catalogue.ts` means adding its group here.
//
// ⚠️ UNVERIFIED is written where the project holds no evidence: most upstream copyright lines are not held locally (the mirror's
// `LICENSE.md` files are statements the project wrote, not the upstream text; see `docs/CREDITS.md`).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const HERE = new URL('./', import.meta.url);

/**
 * The licence texts, each copied byte for byte from a local file (sha256 of the copy, with CRLF read as LF).
 * · Apache-2.0: the vosk-browser upstream text as the mirror holds it; its terms match, word for word, the Apache-2.0 text of
 *   `node_modules/detect-libc/LICENSE` up to «END OF TERMS AND CONDITIONS» (the appendix, a how-to, is not in it).
 * · MIT: the permission notice and disclaimer only — from «Permission is hereby granted» to the end — of
 *   `node_modules/pixi.js/LICENSE`. The copyright line above it is each project's own, written per group below.
 * · GPL-3.0: the licence file of the `espeak-ng` 1.0.2 npm package itself.
 */
export const LICENCE_TEXTS = Object.freeze({
  'Apache-2.0': { file: 'Apache-2.0.txt', sha256: 'bb618af833c817ab01c1564bd3ec75ba4b4f9cf30910a4a2168e30a674ee8cc6',
    from: 'the-inclusionist-lfs/vosk-browser-dynamic-execution-0/LICENSE' },
  MIT: { file: 'MIT.txt', sha256: '89807acf2309bd285f033404ee78581602f3cd9b819a16ac2f0e5f60ff4a473e',
    from: 'node_modules/pixi.js/LICENSE (from «Permission is hereby granted» to the end)' },
  'GPL-3.0': { file: 'GPL-3.0.txt', sha256: '3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986',
    from: 'node_modules/espeak-ng/LICENSE (npm espeak-ng 1.0.2)' },
  // ⚠️ Not the VLibras player repository's own LICENSE file (git blob 65c5ca88, never downloaded): the same licence as it
  // travels in LAViD's `vlibras-translator` 1.3.3 source distribution, downloaded for the ADR-0234 study.
  'LGPL-3.0': { file: 'LGPL-3.0.txt', sha256: 'e3a994d82e644b03a792a930f574002658412f62407f5fee083f2555c5f23118',
    from: 'vlibras-translator 1.3.3 source distribution, LICENSE' },
});

/**
 * The licence a group's own text builds on, which travels after it in the same `LICENSE`: the LGPL-3.0 is «the terms and
 * conditions of version 3 of the GNU General Public License, supplemented by the additional permissions listed below», and
 * its §4(b) asks for both texts with the work.
 */
const INCORPORATES = Object.freeze({ 'LGPL-3.0': 'GPL-3.0' });

/** Upstream NOTICE files, copied unchanged. */
export const NOTICE_TEXTS = Object.freeze({
  'vosk-browser': { file: 'vosk-browser.NOTICE.txt', sha256: '31dac6be41950e1c649686f51a1fe1b47c9cdcd993def80bd104f85df2badd5c',
    from: 'the-inclusionist-lfs/vosk-browser-dynamic-execution-0/NOTICE' },
});

/**
 * One group per upstream project. `ids` are catalogue id prefixes: an id belongs to a group when it equals one or continues it
 * after a colon. `copyright` holds lines as a local file states them; `copyrightUnverified` says why there is none.
 */
export const THIRD_PARTY = Object.freeze([
  {
    key: 'mediapipe-tasks-vision',
    ids: ['visao'],
    project: 'MediaPipe tasks-vision (Google): the runtime and the Face Landmarker, Gesture Recognizer and Hand Landmarker models',
    version: '@mediapipe/tasks-vision 1.0.1; models float16, version 1',
    spdx: 'Apache-2.0',
    licence: 'Apache-2.0',
    copyright: [],
    copyrightUnverified: 'the runtime files carry no licence header, the .task bundles carry no licence file, and the package is not installed where this was written',
    notice: [
      'Obtained unchanged from https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1 (runtime) and https://storage.googleapis.com/mediapipe-models (models).',
      'Licence as stated by the project\'s mirror (the-inclusionist-lfs/mediapipe-tasks-vision-1.0.1/LICENSE.md) and ADR-0203\'s erratum.',
      'UNVERIFIED: the hand and gesture model cards were not read (engine issue #192), and whether upstream publishes a NOTICE file.',
    ],
  },
  {
    key: 'espeak-ng',
    ids: ['voz:runtime:fonemas'],
    project: 'eSpeak NG, WebAssembly build (npm package espeak-ng)',
    version: 'espeak-ng 1.0.2 (npm); the binary reports eSpeak NG 1.52-dev',
    spdx: 'GPL-3.0-or-later',
    licence: 'GPL-3.0',
    copyright: [],
    copyrightUnverified: 'the npm package carries the GPL-3.0 text and no copyright line of its own, and the two files carry no licence header',
    notice: [
      'dist/espeak-ng.js and dist/espeak-ng.wasm of the npm package espeak-ng 1.0.2, unchanged (https://cdn.jsdelivr.net/npm/espeak-ng@1.0.2).',
      'The package declares GPL-3.0-or-later (package.json "license"). Where its source is: SOURCE, beside this file.',
    ],
    source: [
      'eSpeak NG in WebAssembly: where the source of the files in this folder is',
      '',
      'The files here are dist/espeak-ng.js and dist/espeak-ng.wasm of the npm package espeak-ng, version 1.0.2, unchanged: the',
      'build checks each against the sha256 pinned in The Inclusionist engine\'s heavy-file catalogue before writing it. They are',
      'licensed under the GNU General Public License, version 3 or later: the full text is LICENSE, beside this file.',
      '',
      'What the package itself states about its origin:',
      '- the package\'s repository: git+https://github.com/ianmarmour/espeak-ng.js.git (package.json "repository"); the package',
      '  names no commit of it;',
      '- the eSpeak NG source it compiles: https://github.com/espeak-ng/espeak-ng.git, cloned by the build recipe in the package\'s',
      '  README, which names no tag and no commit;',
      '- the version the binary reports: the string "1.52-dev", read from espeak-ng.wasm.',
      '',
      'The exact eSpeak NG revision these files were built from is UNVERIFIED.',
      '',
      'This delivery does not include the Corresponding Source, and The Inclusionist does not host it yet. How the project provides',
      'it is an open decision, recorded in engine issue #192.',
    ],
  },
  {
    key: 'onnxruntime-web',
    ids: ['voz:runtime:onnx'],
    project: 'ONNX Runtime Web (Microsoft)',
    version: 'onnxruntime-web 1.27.0',
    spdx: 'MIT',
    licence: 'MIT',
    copyright: ['Copyright (c) Microsoft Corporation. All rights reserved.'],
    copyrightFrom: 'the header of dist/ort.webgpu.bundle.min.mjs',
    notice: [
      'Three files of the npm package onnxruntime-web 1.27.0, unchanged (https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0).',
      'The package declares MIT (package.json "license") and ships no licence file; the copyright line is the bundle\'s own header.',
      'UNVERIFIED: the third-party notices of the libraries compiled into the .wasm are not held locally.',
    ],
  },
  {
    key: 'kokoro',
    ids: ['voz:kokoro'],
    project: 'Kokoro-82M (hexgrad), ONNX export by onnx-community',
    version: 'v1.0 (onnx-community/Kokoro-82M-v1.0-ONNX)',
    spdx: 'Apache-2.0',
    licence: 'Apache-2.0',
    copyright: [],
    copyrightUnverified: 'no copyright line of hexgrad or onnx-community is held locally',
    notice: [
      'Obtained unchanged from https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX: the fp32 model, the tokenizer and one style table per voice.',
      'Kokoro-82M (hexgrad), Apache-2.0. Its model card credits training audio under CC BY licences: Koniwa (CC BY 3.0) and SIWIS (CC BY 4.0).',
    ],
  },
  {
    key: 'whisper-small',
    ids: ['reading:pt'],
    project: 'Whisper small (OpenAI), exported to ONNX by The Inclusionist',
    version: 'openai/whisper-small',
    spdx: 'Apache-2.0',
    licence: 'Apache-2.0',
    copyright: [],
    copyrightUnverified: 'no copyright line of OpenAI for this model is held locally',
    notice: [
      'Weights: https://huggingface.co/openai/whisper-small, Apache-2.0.',
      'CHANGED by The Inclusionist: exported to ONNX and quantized to 8 bits (encoder, decoder, decoder with past); the tokenizer, configuration and mel filterbank are copied unchanged. Recipe: the engine\'s scripts/models/export-whisper-small.py.',
    ],
  },
  {
    key: 'moonshine-streaming-small-en',
    ids: ['reading:en'],
    project: 'Moonshine streaming small (Useful Sensors / Moonshine AI), ONNX export by Workmind',
    version: 'Workmind/moonshine-streaming-small-ONNX (base model UsefulSensors/moonshine-streaming-small)',
    spdx: 'MIT',
    licence: 'MIT',
    copyright: [],
    copyrightUnverified: 'the export declares `license: mit`, but no copyright line of Useful Sensors, Moonshine AI or Workmind is held locally',
    notice: [
      'Obtained unchanged from https://huggingface.co/Workmind/moonshine-streaming-small-ONNX.',
    ],
  },
  {
    key: 'moonshine-streaming-small-es',
    ids: ['reading:es'],
    project: 'Moonshine streaming small es (Moonshine AI / Useful Sensors), exported to ONNX by The Inclusionist',
    version: 'moonshine-ai/moonshine-streaming-small-es, revision 8cb0974f29ca24d6b645518c430efc8c57cd0073',
    spdx: 'MIT',
    licence: 'MIT',
    copyright: [],
    copyrightUnverified: 'the model declares `license: mit`, but no copyright line of Moonshine AI or Useful Sensors is held locally',
    notice: [
      'Weights: https://huggingface.co/moonshine-ai/moonshine-streaming-small-es at the revision above.',
      'CHANGED by The Inclusionist: exported to ONNX (encoder fp32, decoders quantized to 8 bits); the tokenizer and configuration are copied unchanged. Recipe: the engine\'s scripts/models/export-moonshine-streaming-es.py.',
    ],
  },
  {
    key: 'vosk-browser',
    ids: ['commands:runtime'],
    project: 'Vosk for the browser: vosk-browser, vosk-api and Kaldi, built by The Inclusionist',
    version: 'lichess-org/vosk-browser 50a6347 with alphacep/vosk-api d714dff',
    spdx: 'Apache-2.0',
    licence: 'Apache-2.0',
    copyright: ['Copyright 2020-2022 Ciaran O\'Reilly', 'Copyright 2020, Denis Treskunov', 'Copyright 2019-2022 Alpha Cephei Inc. All Rights Reserved.'],
    copyrightFrom: 'the upstream vosk-browser NOTICE',
    upstreamNotice: 'vosk-browser',
    notice: [
      'CHANGED by The Inclusionist: built from the sources above with one added link flag, -s DYNAMIC_EXECUTION=0, so the runtime runs under a Content-Security-Policy without \'unsafe-eval\'. Recipe and patch: the engine\'s scripts/models/build-vosk-browser.ps1 and scripts/models/vosk-browser-dynamic-execution.patch.',
      'The binary also contains Kaldi, OpenFst, CLAPACK (BSD-3-Clause), clapack-wasm, zlib (Zlib), libarchive (BSD-2-Clause) and Emscripten and musl (MIT); each one\'s notice is in the upstream NOTICE above.',
    ],
  },
  {
    key: 'vosk-models',
    ids: ['commands:model'],
    project: 'Vosk small models (Alpha Cephei)',
    version: 'vosk-model-small-pt-0.3, vosk-model-small-en-us-0.15, vosk-model-small-es-0.42',
    spdx: 'Apache-2.0',
    licence: 'Apache-2.0',
    copyright: ['Copyright 2020 Alpha Cephei Inc (vosk-model-small-en-us-0.15)', 'Copyright 2022-2050 AC Technologies LLC (vosk-model-small-es-0.42)'],
    copyrightFrom: 'each archive\'s README; vosk-model-small-pt-0.3\'s states none',
    notice: [
      'From https://alphacephei.com/vosk/models, which states Apache-2.0; the archives themselves state no licence.',
      'CHANGED by The Inclusionist: repacked unchanged from the upstream zips into the .tar.gz vosk-browser loads (the engine\'s scripts/models/repack-vosk-models.py).',
    ],
  },
  {
    key: 'vlibras-player',
    ids: ['libras:player'],
    project: 'VLibras player: the Unity WebGL build of the signing avatar, from the repository spbgovbr-vlibras/vlibras-web-browsers',
    version: 'public/unity/ at commit 9d093f259ac732d755a19e80cd03c8233c70435d («feat: update unity build (28-08-26)»); Unity 2018 WebGL',
    // ⚠️ Two things, said as two: what the repository declares, and the closed runtime inside the build it does not cover.
    spdx: 'LGPL-3.0 AND LicenseRef-Unity-Runtime',
    licence: 'LGPL-3.0',
    copyright: [],
    copyrightUnverified: 'the four files carry no copyright line, and nothing of the repository beyond their metadata and its declared licence was read',
    notice: [
      'unity-loader.js, playerweb.wasm.framework.unityweb, playerweb.wasm.code.unityweb and playerweb.data.unityweb, obtained unchanged from https://raw.githubusercontent.com/spbgovbr-vlibras/vlibras-web-browsers/9d093f259ac732d755a19e80cd03c8233c70435d/public/unity/ (each file\'s git blob id there matches the copy The Inclusionist measured).',
      'The repository declares LGPL-3.0. LICENSE beside this file is the LGPL-3.0 text followed by the GPL-3.0 text it incorporates; the LGPL text was copied from the vlibras-translator 1.3.3 distribution, not from this repository.',
      'NOT COVERED BY THAT LICENCE, as far as The Inclusionist knows: these files are a Unity 2018 WebGL build, and the wasm code, the framework JavaScript and the data file contain Unity Technologies\' proprietary runtime. No corresponding source for it is published, and the terms under which it may be redistributed have NOT been determined. The Inclusionist carries it as a declared, temporary exception (its ADR-0234) until a free player replaces it.',
      'CHANGED by The Inclusionist: playerweb.framework.noeval.js, beside this file, is playerweb.wasm.framework.unityweb decompressed (brotli), prefixed with UnityLoader["__vlFramework"]=, and with its one eval(str) replaced by window.__vlExternalCall(str), a parser that accepts only plain calls to the player\'s five event functions with JSON arguments. It is generated by the engine\'s scripts/vlibras-player.mjs, which refuses an input whose sha256 is not the pinned one.',
    ],
  },
]);

/** The group an id belongs to, or `null`. */
export function groupOf(id, groups = THIRD_PARTY) {
  return groups.find((g) => g.ids.some((p) => id === p || id.startsWith(`${p}:`))) ?? null;
}

const readStored = (file) => readFileSync(new URL(file, HERE), 'utf8');

/** The files that sit beside a group's heavy files: `LICENSE`, `NOTICE`, and `SOURCE` where the group has one. */
export function licenceFilesFor(group, read = readStored) {
  const incorporated = INCORPORATES[group.licence];
  const text = read(LICENCE_TEXTS[group.licence].file)
    + (incorporated ? `\n\n${'='.repeat(78)}\n\n${read(LICENCE_TEXTS[incorporated].file)}` : '');
  const copyright = group.copyright.length ? group.copyright : [`Copyright: UNVERIFIED — ${group.copyrightUnverified}.`];
  const licence = group.licence === 'MIT' ? `MIT License\n\n${copyright.join('\n')}\n\n${text}` : text;
  const own = [
    `${group.project}`,
    `${group.version}`,
    `Licence: ${group.spdx}. The full text is LICENSE, beside this file.`,
    ...(group.copyright.length ? [`Copyright (source: ${group.copyrightFrom}):`, ...group.copyright.map((c) => `  ${c}`)] : copyright),
    '',
    ...group.notice,
  ].join('\n');
  const notice = group.upstreamNotice
    ? `${read(NOTICE_TEXTS[group.upstreamNotice].file).trimEnd()}\n\n---\n\nAddendum by The Inclusionist, which distributes this build:\n\n${own}\n`
    : `${own}\n`;
  const files = { LICENSE: licence, NOTICE: notice };
  if (group.source) files.SOURCE = `${group.source.join('\n')}\n`;
  return files;
}

/** `heavy/THIRD-PARTY-NOTICES.md`: each project in this delivery, its licence, its copyright, and where its texts sit. */
export function thirdPartyNotices(written) {
  const lines = [
    '# Third-party notices',
    '',
    'The files under `heavy/` are not The Inclusionist\'s: each belongs to the project listed below and is distributed under that',
    'project\'s licence. Every folder that holds one of them also holds the project\'s `LICENSE` and `NOTICE`.',
    '',
  ];
  for (const { group, folders } of written) {
    lines.push(`## ${group.project}`, '');
    lines.push(`- **Version:** ${group.version}`);
    lines.push(`- **Licence (SPDX):** \`${group.spdx}\``);
    if (group.copyright.length) lines.push(`- **Copyright** (source: ${group.copyrightFrom}): ${group.copyright.join(' · ')}`);
    else lines.push(`- **Copyright:** UNVERIFIED — ${group.copyrightUnverified}.`);
    lines.push('- **Licence text and notices in this delivery:**');
    for (const f of folders) {
      const names = ['LICENSE', 'NOTICE', ...(group.source ? ['SOURCE'] : [])];
      lines.push(`  - ${names.map((n) => `\`${f}/${n}\``).join(', ')}`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * Writes the licence files beside every heavy file present in the delivery, and `heavy/THIRD-PARTY-NOTICES.md`.
 * `present` is `[{ id, path }]`, `path` being the delivery path (`heavy/<host><path>`). Throws when a file has no group, or when
 * two groups would write the same folder — one `LICENSE` cannot speak for two projects.
 */
export function writeLicences({ destination, present, groups = THIRD_PARTY, read = readStored }) {
  const byGroup = new Map();
  const owner = new Map();
  for (const { id, path } of present) {
    const group = groupOf(id, groups);
    if (!group) throw new Error(`no licence recorded for ${id} in scripts/licences/third-party.mjs`);
    const folder = dirname(path).replaceAll('\\', '/');
    const other = owner.get(folder);
    if (other && other !== group) throw new Error(`${folder} would hold the licence of both ${other.key} and ${group.key}`);
    owner.set(folder, group);
    if (!byGroup.has(group)) byGroup.set(group, new Set());
    byGroup.get(group).add(folder);
  }
  const written = [];
  for (const group of groups) {
    if (!byGroup.has(group)) continue;
    const files = licenceFilesFor(group, read);
    const folders = [...byGroup.get(group)].sort();
    for (const folder of folders) {
      mkdirSync(join(destination, folder), { recursive: true });
      for (const [name, text] of Object.entries(files)) writeFileSync(join(destination, folder, name), text);
    }
    written.push({ group, folders: folders.map((f) => f.replace(/^heavy\//, '')) });
  }
  if (written.length) writeFileSync(join(destination, 'heavy', 'THIRD-PARTY-NOTICES.md'), thirdPartyNotices(written));
  return written.map(({ group, folders }) => ({ key: group.key, folders }));
}
