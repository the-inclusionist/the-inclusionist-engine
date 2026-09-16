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
export async function levarPesadosParaEntrega({ destino, pesados, caminhoNaEntrega, buscar = fetch, sha256 = sha256DoNode }) {
  const linhas = [];
  for (const p of pesados) {
    if (!p.url) { linhas.push({ id: p.id, estado: 'sem-fonte' }); continue; }
    const alvo = join(destino, caminhoNaEntrega(p.url));
    if (existsSync(alvo) && sha256(readFileSync(alvo)) === p.sha256) { linhas.push({ id: p.id, estado: 'ja-tinha' }); continue; }
    try {
      const resp = await buscar(p.url);
      if (!resp.ok) { linhas.push({ id: p.id, estado: 'falhou', erro: `HTTP ${resp.status}` }); continue; }
      const corpo = await resp.arrayBuffer();
      const obtido = sha256(corpo);
      if (!p.sha256 || obtido !== p.sha256) {
        linhas.push({ id: p.id, estado: 'falhou', erro: `sha256 mismatch: expected ${p.sha256}, got ${obtido} — not written` });
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
export function argumentosDaEntrega(args) {
  return { destino: args.find((a) => !a.startsWith('--')), kokoro: args.includes('--kokoro') };
}

// Run as a program (directly, or through the `inclusionist-pesados` shim, which may be a symlink): compare real paths.
const executado = (() => { try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (executado) {
  const { destino, kokoro } = argumentosDaEntrega(process.argv.slice(2));
  if (!destino) { console.error('usage: inclusionist-pesados <delivery folder, e.g. dist> [--kokoro]'); process.exit(2); }
  const modulo = moduloDoPacote();
  if (!existsSync(fileURLToPath(modulo))) { console.error('dist-pkg/platform/pesados.js is missing beside this script: in the engine repository, run `npm run build:pkg` first'); process.exit(2); }
  const { PESADOS, caminhoNaEntrega, pesadosDoArranque } = await import(modulo);
  const ids = pesadosDoArranque({ kokoro });
  const { ok, linhas } = await levarPesadosParaEntrega({ destino, pesados: PESADOS.filter((p) => ids.includes(p.id)), caminhoNaEntrega });
  for (const l of linhas) console.log(`${l.estado.padEnd(9)} ${l.id}${l.erro ? ` — ${l.erro}` : ''}`);
  if (!ok) { console.error('a heavy file failed: the delivery is incomplete, and nothing unchecked was written'); process.exit(1); }
}
