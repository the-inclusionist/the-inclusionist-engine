#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Puts the heavy files into a delivery (ADR-0177, issue #173): each upstream address of the download catalogue is fetched at
// BUILD time, checked against its pinned sha256, and written to `<destination>/pesados/<host><path>` — where the page asks for
// it. A file whose hash differs stops the build: nothing unchecked reaches a delivery.
//
// Usage (after `npm run build`): `npm run pesados:entrega` — builds the package, then `node scripts/pesados-na-entrega.mjs dist`.
// A cartridge, after its own build, runs the published command: `npx inclusionist-pesados dist`. The catalogue is read from the
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
  return new URL('../dist-pkg/platform/pesados.js', import.meta.url).href;
}

const sha256DoNode = (buf) => createHash('sha256').update(Buffer.from(buf)).digest('hex');

/**
 * Fetches, checks and writes every entry with an address. Returns one line per entry; `ok` is false when any file failed.
 * Everything is injected so a gate can run it without the network.
 */
export async function levarPesadosParaEntrega({ destino, pesados, caminhoNaEntrega, buscar = fetch, sha256 = sha256DoNode,
  base = '', fonteDe = (url) => url, lerLocal = (caminho) => readFileSync(caminho) }) {
  const linhas = [];
  for (const p of pesados) {
    if (!p.url) { linhas.push({ id: p.id, estado: 'sem-fonte' }); continue; }
    const alvo = join(destino, caminhoNaEntrega(p.url));
    if (existsSync(alvo) && sha256(readFileSync(alvo)) === p.sha256) { linhas.push({ id: p.id, estado: 'ja-tinha' }); continue; }
    const fonte = fonteDe(p.url, base);
    const daRede = /^https?:\/\//i.test(fonte);
    try {
      let corpo;
      if (daRede) {
        const resp = await buscar(fonte);
        if (!resp.ok) { linhas.push({ id: p.id, estado: 'falhou', erro: `HTTP ${resp.status} — ${fonte}` }); continue; }
        corpo = await resp.arrayBuffer();
      } else {
        corpo = lerLocal(fonte);
      }
      const obtido = sha256(corpo);
      if (!p.sha256 || obtido !== p.sha256) {
        linhas.push({ id: p.id, estado: 'falhou', erro: `sha256 mismatch at ${fonte}: expected ${p.sha256}, got ${obtido} — not written` });
        continue;
      }
      mkdirSync(dirname(alvo), { recursive: true });
      writeFileSync(alvo, Buffer.from(corpo));
      linhas.push({ id: p.id, estado: 'escrito', bytes: corpo.byteLength });
    } catch (e) {
      linhas.push({ id: p.id, estado: 'falhou', erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return { ok: linhas.every((l) => l.estado !== 'falhou'), linhas };
}

/**
 * The command's arguments: the delivery folder, and `--kokoro` for a game that fills the Kokoro port — without it Kokoro's model and
 * voices stay out of the delivery, as they stay out of the start's download (ADR-0198 §5).
 */
export function argumentosDaEntrega(args, ambiente = process.env) {
  // ⚠️ `--base <value>` eats the token after it: without that, the value was read as the delivery folder (caught by its case).
  let destino, base;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base') { base = args[++i]; continue; }
    if (!args[i].startsWith('--') && destino === undefined) destino = args[i];
  }
  return { destino, kokoro: args.includes('--kokoro'), base: base ?? ambiente.INCLUSIONIST_HEAVY_BASE ?? '' };
}

/** A `.env` beside the build, if there is one: Node reads it into `process.env`, and the command line still wins. */
export function carregarEnv(caminho = join(process.cwd(), '.env'), carregar = process.loadEnvFile) {
  try { if (existsSync(caminho)) carregar.call(process, caminho); return true; } catch { return false; }
}

// Run as a program (directly, or through the `inclusionist-pesados` shim, which may be a symlink): compare real paths.
const executado = (() => { try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (executado) {
  carregarEnv();
  const { destino, kokoro, base } = argumentosDaEntrega(process.argv.slice(2));
  if (!destino) { console.error('usage: inclusionist-pesados <delivery folder, e.g. dist> [--kokoro]'); process.exit(2); }
  const modulo = moduloDoPacote();
  if (!existsSync(fileURLToPath(modulo))) { console.error('dist-pkg/platform/pesados.js is missing beside this script: in the engine repository, run `npm run build:pkg` first'); process.exit(2); }
  const { PESADOS, caminhoNaEntrega, pesadosDoArranque } = await import(modulo);
  const { heavySourceOf } = await import(new URL('../dist-pkg/platform/heavy-mirror.js', import.meta.url).href);
  const ids = pesadosDoArranque({ kokoro });
  if (base) console.log(`base: ${base}`);
  const { ok, linhas } = await levarPesadosParaEntrega({
    destino, pesados: PESADOS.filter((p) => ids.includes(p.id)), caminhoNaEntrega, base, fonteDe: heavySourceOf,
  });
  for (const l of linhas) console.log(`${l.estado.padEnd(9)} ${l.id}${l.erro ? ` — ${l.erro}` : ''}`);
  if (!ok) { console.error('a heavy file failed: the delivery is incomplete, and nothing unchecked was written'); process.exit(1); }
}
