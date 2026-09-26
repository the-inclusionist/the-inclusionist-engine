// SPDX-License-Identifier: AGPL-3.0-or-later
// A DELIVERY CARRIES THE LICENCE OF EVERY HEAVY FILE IT CARRIES (ADR-0177, ADR-0203; scripts/licences/third-party.mjs).
//
// 📌 Apache-2.0 §4(a) and §4(d), MIT's notice condition and GPL-3.0 all attach to the COPY: a school that receives `heavy/` has to
// receive the texts with it. The whole catalogue is run through the delivery here — no network, the fetch and the hash are
// injected — and every folder that received a file must hold its project's `LICENSE` and `NOTICE`, listed in
// `heavy/THIRD-PARTY-NOTICES.md`.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { levarPesadosParaEntrega } from '../scripts/heavy-into-the-delivery.mjs';
import { THIRD_PARTY, LICENCE_TEXTS, NOTICE_TEXTS, groupOf } from '../scripts/licences/third-party.mjs';
import { deliveryPath } from '../app/js/platform/heavy.js';
import { HEAVY_FILES } from '../app/js/platform/heavy-catalogue.js';

const ROOT = process.cwd();
const WITH_URL = HEAVY_FILES.filter((p) => p.url);
const folderOf = (p) => dirname(deliveryPath(p.url)).replaceAll('\\', '/');

/** The whole catalogue, delivered with fake bodies: each body is its URL, and the hash says what the catalogue pins for it. */
async function deliverAll(destino, extra = {}) {
  const pinned = new Map(WITH_URL.map((p) => [p.url, p.sha256]));
  return levarPesadosParaEntrega({
    destino, pesados: HEAVY_FILES, deliveryPath,
    fetch: async (u) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(u).buffer }),
    sha256: (buf) => pinned.get(Buffer.from(buf).toString('utf8')) ?? 'not-a-catalogue-body',
    ...extra,
  });
}

// the licence each SPDX id must be, by words of the text itself — not through the table that picks the file
const MARKERS = {
  'Apache-2.0': ['Apache License', 'Version 2.0, January 2004', 'END OF TERMS AND CONDITIONS'],
  MIT: ['Permission is hereby granted, free of charge', 'THE SOFTWARE IS PROVIDED "AS IS"'],
  'GPL-3.0-or-later': ['GNU GENERAL PUBLIC LICENSE', 'Version 3, 29 June 2007', 'Corresponding Source'],
};

describe('the licences travel with the heavy files', () => {
  /*
   * ⚠️ THE WHOLE CATALOGUE IS DELIVERED ONCE, and the three cases that only READ a normal delivery read this one. Each used
   * to deliver its own: ~50 files and every licence text written to disk, three times over, each ~0.45 s alone — and under
   * the load of several suites at once, the writes pushed all three past the 5 s ceiling. A red that comes from the machine
   * and not the code invalidates whatever is measured beside it; the fix is the work shrinking, never the clock growing.
   * 📌 The delivery is the same one each built — same catalogue, same fake bodies, nothing a case changes — and no case
   * writes into it. The two cases that deliver something ELSE (an unknown licence, two projects in a folder) keep their own.
   */
  let destino, entrega;
  beforeAll(async () => {
    destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    entrega = await deliverAll(destino);
  });
  afterAll(() => { if (destino) rmSync(destino, { recursive: true, force: true }); });

  it('🎯 [Vacuum] every catalogue entry with an address belongs to exactly one licence group', () => {
    expect(WITH_URL.length, 'the catalogue read as empty — the gate would pass by checking nothing').toBeGreaterThan(40);
    const orphans = WITH_URL.filter((p) => !groupOf(p.id)).map((p) => p.id);
    expect(orphans, 'a heavy file with no recorded licence: add its group to scripts/licences/third-party.mjs').toEqual([]);
    const twice = WITH_URL.filter((p) => THIRD_PARTY.filter((g) => groupOf(p.id, [g])).length > 1).map((p) => p.id);
    expect(twice).toEqual([]);
  });

  it('🔴 [Right] every folder that receives a heavy file holds its project\'s LICENSE and NOTICE, and the notices list it', () => {
    const { ok, linhas, licences } = entrega;
    expect(ok, linhas.filter((l) => l.error).map((l) => `${l.id}: ${l.error}`).join('\n')).toBe(true);
    expect(licences.map((l) => l.key).sort()).toEqual(['espeak-ng', 'kokoro', 'mediapipe-tasks-vision', 'moonshine-streaming-small-en',
      'moonshine-streaming-small-es', 'onnxruntime-web', 'vosk-browser', 'vosk-models', 'whisper-small']);

    const notices = join(destino, 'heavy', 'THIRD-PARTY-NOTICES.md');
    expect(existsSync(notices), 'heavy/THIRD-PARTY-NOTICES.md was not written').toBe(true);
    const list = readFileSync(notices, 'utf8');

    const missing = [];
    for (const p of WITH_URL) {
      const folder = folderOf(p);
      const group = groupOf(p.id);
      for (const name of ['LICENSE', 'NOTICE']) if (!existsSync(join(destino, folder, name))) missing.push(`${folder}/${name} (${p.id})`);
      if (!existsSync(join(destino, folder, 'LICENSE'))) continue;
      const text = readFileSync(join(destino, folder, 'LICENSE'), 'utf8');
      for (const m of MARKERS[group.spdx]) if (!text.includes(m)) missing.push(`${folder}/LICENSE lacks «${m}» (${group.spdx})`);
      const listed = `\`${folder.replace(/^heavy\//, '')}/LICENSE\``;
      if (!list.includes(listed)) missing.push(`THIRD-PARTY-NOTICES.md does not list ${listed}`);
    }
    expect(missing).toEqual([]);
    for (const g of THIRD_PARTY) {
      expect(list, `${g.key} is not named in the notices`).toContain(`## ${g.project}`);
      expect(list).toContain(`\`${g.spdx}\``);
    }
  });

  it('🔴 [Right] eSpeak NG (GPL-3.0) carries a SOURCE note naming its Corresponding Source: the commit the recipe pins, and the recipe', () => {
    /*
     * GPL-3.0 §6(d): object code offered from a place carries «clear directions next to the object code saying where to find the
     * Corresponding Source». The build is the project's own (issue #192), so the source is a COMMIT and a RECIPE — and the three
     * places that name them (the recipe, the catalogue's folder, this note) must name the same ones, or the directions point at
     * a source that did not make these bytes.
     */
    const wasm = WITH_URL.find((p) => p.id === 'voz:runtime:fonemas:wasm');
    const source = readFileSync(join(destino, folderOf(wasm), 'SOURCE'), 'utf8');
    const recipe = readFileSync(join(ROOT, 'scripts', 'models', 'build-espeak-ng.ps1'), 'utf8').replaceAll('\r\n', '\n');
    const commit = recipe.match(/^\$commit = '([0-9a-f]{40})'$/m)?.[1];
    expect(commit, 'the recipe no longer pins a full commit').toBeTruthy();
    expect(recipe, 'the recipe links without refusing eval — the policy has no unsafe-eval').toContain('-sDYNAMIC_EXECUTION=0');
    const folder = wasm.url.slice(0, wasm.url.lastIndexOf('/'));
    expect(folder.endsWith(`/espeak-ng-${commit.slice(0, 7)}`), `the catalogue's folder ${folder} is not the recipe's commit`).toBe(true);
    expect(source).toContain(`commit ${commit}`);
    expect(source).toContain('https://github.com/espeak-ng/espeak-ng.git');
    expect(source).toContain('scripts/models/build-espeak-ng.ps1');
    expect(source).toContain(`${folder}/corresponding-source/`);
    expect(source, 'the source is named now: nothing about it is unverified').not.toMatch(/UNVERIFIED/);
  });

  it('🔴 [Right] MIT carries its copyright line, or says it is unverified; the Vosk NOTICE is the upstream one, whole', () => {
    const read = (id, name) => readFileSync(join(destino, folderOf(WITH_URL.find((p) => p.id === id)), name), 'utf8');
    expect(read('voz:runtime:onnx', 'LICENSE')).toMatch(/^MIT License\n\nCopyright \(c\) Microsoft Corporation\. All rights reserved\.\n\nPermission/);
    expect(read('reading:en:encoder', 'LICENSE')).toMatch(/^MIT License\n\nCopyright: UNVERIFIED/);
    const upstream = readFileSync(join(ROOT, 'scripts', 'licences', 'vosk-browser.NOTICE.txt'), 'utf8').trimEnd();
    expect(read('commands:runtime', 'NOTICE').startsWith(upstream), 'the Vosk runtime NOTICE is not the upstream one').toBe(true);
    expect(read('commands:runtime', 'NOTICE')).toContain('DYNAMIC_EXECUTION=0');
  });

  it('🔴 [Right] a file whose licence nobody recorded is NOT written, and the run fails', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const entry = { id: 'unknown:thing', url: 'https://example.org/thing.bin', sha256: createHash('sha256').update('x').digest('hex') };
      const { ok, linhas } = await levarPesadosParaEntrega({ destino, pesados: [entry], deliveryPath,
        fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('x').buffer }) });
      expect(ok).toBe(false);
      expect(linhas[0].error).toMatch(/no licence recorded/);
      expect(existsSync(join(destino, deliveryPath(entry.url))), 'a file with no licence reached the delivery').toBe(false);
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('📌 [Boundary] two projects in one folder fail the run: one LICENSE cannot speak for both', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const body = (s) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(s).buffer });
      const h = (s) => createHash('sha256').update(s).digest('hex');
      const pesados = [
        { id: 'voz:kokoro:a', url: 'https://example.org/same/a.bin', sha256: h('https://example.org/same/a.bin') },
        { id: 'visao:b', url: 'https://example.org/same/b.bin', sha256: h('https://example.org/same/b.bin') },
      ];
      const { ok, linhas } = await levarPesadosParaEntrega({ destino, pesados, deliveryPath, fetch: async (u) => body(u) });
      expect(ok).toBe(false);
      expect(linhas.find((l) => l.id === 'licences')?.error).toMatch(/both/);
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('🔴 [Right] the stored texts are the bytes they were copied from, and the package ships them', () => {
    const sha = (f) => createHash('sha256').update(readFileSync(join(ROOT, 'scripts', 'licences', f), 'utf8').replaceAll('\r\n', '\n')).digest('hex');
    for (const t of [...Object.values(LICENCE_TEXTS), ...Object.values(NOTICE_TEXTS)]) {
      expect(sha(t.file), `${t.file} no longer matches ${t.from}`).toBe(t.sha256);
    }
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.files, 'the licence texts are not published: a delivery built from the npm package would carry none').toContain('scripts/licences');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   L1 one group's folders skipped when writing (kokoro)          🔴 every folder holds LICENSE and NOTICE
//   L2 THIRD-PARTY-NOTICES.md not written                          🔴 the notices were not written
//   L3 the group check before fetching removed                     🔴 a file with no licence is not written
//   L4 the one-folder-one-project check removed                     🔴 two projects in one folder fail
//   L5 `scripts/licences` left out of `files`                       🔴 the package ships them
//   L6 no LICENSE written for the MIT groups                        🔴 every folder holds LICENSE · MIT carries its copyright line
//   L7 the SOURCE note names another commit than the recipe         🔴 eSpeak NG carries a SOURCE note naming its source
//   L8 the catalogue's eSpeak NG folder names another commit         🔴 eSpeak NG carries a SOURCE note naming its source
//   L9 the recipe's -sDYNAMIC_EXECUTION=0 removed                   🔴 eSpeak NG carries a SOURCE note naming its source
