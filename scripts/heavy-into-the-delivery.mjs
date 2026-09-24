#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Puts the heavy files into a delivery (ADR-0177, issue #173): each upstream address of the download catalogue is fetched at
// BUILD time, checked against its pinned sha256, and written to `<destination>/heavy/<host><path>` — where the page asks for
// it. A file whose hash differs stops the build: nothing unchecked reaches a delivery.
//
// Usage (after `npm run build`): `npm run heavy:delivery` — builds the package, then `node scripts/heavy-into-the-delivery.mjs dist`.
// A cartridge, after its own build, runs the published command: `npx inclusionist-heavy dist`. The catalogue is read from the
// package beside this script, never from the caller's folder.
// ⚠️ It downloads about 300 MB from Hugging Face, jsDelivr and Google Storage: the build machine
// contacts them once, and the child's device never does.
//
// WHERE FROM IS A CHOICE (the Dev, 2026-09-21): `--base <address or folder>`, the variable `INCLUSIONIST_HEAVY_BASE`, or a `.env`
// beside the build. With a base, each file comes from the project's mirror, a school's server or a folder on this machine
// (`platform/heavy-mirror`); without one, from upstream. The sha256 check does not move: a base that serves other bytes writes
// nothing, which is why pointing elsewhere is safe and needs no trust.

import { mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

/** The compiled catalogue of the package this script ships in — beside it, whatever folder the build runs from. */
export function moduloDoPacote() {
  return new URL('../dist-pkg/platform/heavy.js', import.meta.url).href;
}

const sha256DoNode = (buf) => createHash('sha256').update(Buffer.from(buf)).digest('hex');

/**
 * Fetches, checks and writes every entry with an address. Returns one line per entry; `ok` is false when any file failed.
 * Everything is injected so a gate can run it without the network.
 */
export async function levarPesadosParaEntrega({ destino, pesados, deliveryPath, fetch: buscar = fetch, sha256 = sha256DoNode,
  base = '', fonteDe = (url) => url, lerLocal = (caminho) => readFileSync(caminho) }) {
  const linhas = [];
  for (const p of pesados) {
    if (!p.url) { linhas.push({ id: p.id, outcome: 'sem-fonte' }); continue; }
    const alvo = join(destino, deliveryPath(p.url));
    if (existsSync(alvo) && sha256(readFileSync(alvo)) === p.sha256) { linhas.push({ id: p.id, outcome: 'ja-tinha' }); continue; }
    const fonte = fonteDe(p.url, base);
    const daRede = /^https?:\/\//i.test(fonte);
    try {
      let corpo;
      if (daRede) {
        const resp = await buscar(fonte);
        if (!resp.ok) { linhas.push({ id: p.id, outcome: 'falhou', error: `HTTP ${resp.status} — ${fonte}` }); continue; }
        corpo = await resp.arrayBuffer();
      } else {
        corpo = lerLocal(fonte);
      }
      const obtido = sha256(corpo);
      if (!p.sha256 || obtido !== p.sha256) {
        linhas.push({ id: p.id, outcome: 'falhou', error: `sha256 mismatch at ${fonte}: expected ${p.sha256}, got ${obtido} — not written` });
        continue;
      }
      mkdirSync(dirname(alvo), { recursive: true });
      writeFileSync(alvo, Buffer.from(corpo));
      linhas.push({ id: p.id, outcome: 'escrito', bytes: corpo.byteLength });
    } catch (e) {
      linhas.push({ id: p.id, outcome: 'falhou', error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { ok: linhas.every((l) => l.outcome !== 'falhou'), linhas };
}

/**
 * The command's arguments, which are the game's answers (ADR-0216 §3) said to the build:
 *
 * · `--kokoro` for a game that declares `uses: { neuralVoice: true }` — without it Kokoro's model, voices and runtime stay out of
 *   the delivery, as they stay out of the start's download.
 * · `--reading <pt|en|es>`, repeatable, for a game that declares `uses: { reading: true }`: each language named puts ITS model in
 *   the delivery (pt 378 MiB, en 162, es 310). A delivery for a school that reads in one language carries one.
 * · `--commands <pt|en|es>`, repeatable: the voice COMMANDS (issue #184), 31–39 MiB a language plus 3.1 MiB of runtime. No game
 *   declares this one — saying «menu» is a way into the controller, not a feature (ADR-0111) — so it is the DELIVERY that says
 *   which languages it serves. Without it a child who speaks is told the delivery carries no model for her language.
 */
export function argumentosDaEntrega(args, ambiente = process.env) {
  // ⚠️ `--base <value>` eats the token after it: without that, the value was read as the delivery folder (caught by its case).
  let destino, base;
  const reading = [];
  const commands = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base') { base = args[++i]; continue; }
    if (args[i] === '--reading') { const v = args[++i]; if (v) reading.push(v); continue; }
    if (args[i] === '--commands') { const v = args[++i]; if (v) commands.push(v); continue; }
    if (!args[i].startsWith('--') && destino === undefined) destino = args[i];
  }
  return { destino, kokoro: args.includes('--kokoro'), reading, commands, base: base ?? ambiente.INCLUSIONIST_HEAVY_BASE ?? '' };
}

/** A `.env` beside the build, if there is one: Node reads it into `process.env`, and the command line still wins. */
export function carregarEnv(caminho = join(process.cwd(), '.env'), carregar = process.loadEnvFile) {
  try { if (existsSync(caminho)) carregar.call(process, caminho); return true; } catch { return false; }
}

// Run as a program (directly, or through the `inclusionist-heavy` shim, which may be a symlink): compare real paths.
const executado = (() => { try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (executado) {
  carregarEnv();
  const { destino, kokoro, reading, commands, base } = argumentosDaEntrega(process.argv.slice(2));
  if (!destino) { console.error('usage: inclusionist-heavy <delivery folder, e.g. dist> [--kokoro] [--reading pt|en|es]… [--commands pt|en|es]…'); process.exit(2); }
  const modulo = moduloDoPacote();
  if (!existsSync(fileURLToPath(modulo))) { console.error('dist-pkg/platform/heavy.js is missing beside this script: in the engine repository, run `npm run build:pkg` first'); process.exit(2); }
  const { HEAVY_FILES, deliveryPath, heavyAtBoot } = await import(modulo);
  const { heavySourceOf } = await import(new URL('../dist-pkg/platform/heavy-mirror.js', import.meta.url).href);
  // one pass per language, because the start asks for ONE and the delivery may hold several
  const ids = [...new Set([
    ...heavyAtBoot({ kokoro }),
    ...reading.flatMap((lingua) => heavyAtBoot({ kokoro: false, reading: lingua })),
    ...commands.flatMap((lingua) => heavyAtBoot({ kokoro: false, commands: lingua })),
  ])];
  if (base) console.log(`base: ${base}`);
  const { ok, linhas } = await levarPesadosParaEntrega({
    destino, pesados: HEAVY_FILES.filter((p) => ids.includes(p.id)), deliveryPath, base, fonteDe: heavySourceOf,
  });
  for (const l of linhas) console.log(`${l.outcome.padEnd(9)} ${l.id}${l.error ? ` — ${l.error}` : ''}`);
  if (!ok) { console.error('a heavy file failed: the delivery is incomplete, and nothing unchecked was written'); process.exit(1); }
}
