#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Puts the heavy files into a delivery (ADR-0177, issue #173): each upstream address of the download catalogue is fetched at
// BUILD time, checked against its pinned sha256, and written to `<destination>/pesados/<host><path>` — where the page asks for
// it. A file whose hash differs stops the build: nothing unchecked reaches a delivery.
//
// Usage (after `npm run build`): `npm run pesados:entrega` — builds the package, then `node scripts/pesados-na-entrega.mjs dist`.
// ⚠️ It downloads about 300 MB from Hugging Face, jsDelivr, Google Storage and webgazer.cs.brown.edu: the build machine
// contacts them once, and the child's device never does.

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

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

if ((process.argv[1] ?? '').split(/[\\/]/).pop() === 'pesados-na-entrega.mjs') {
  const destino = process.argv[2];
  if (!destino) { console.error('usage: node scripts/pesados-na-entrega.mjs <delivery folder, e.g. dist>'); process.exit(2); }
  const modulo = join(process.cwd(), 'dist-pkg', 'platform', 'pesados.js');
  if (!existsSync(modulo)) { console.error('dist-pkg/platform/pesados.js is missing: run `npm run build:pkg` first'); process.exit(2); }
  const { PESADOS, caminhoNaEntrega } = await import(pathToFileURL(modulo).href);
  const { ok, linhas } = await levarPesadosParaEntrega({ destino, pesados: PESADOS, caminhoNaEntrega });
  for (const l of linhas) console.log(`${l.estado.padEnd(9)} ${l.id}${l.erro ? ` — ${l.erro}` : ''}`);
  if (!ok) { console.error('a heavy file failed: the delivery is incomplete, and nothing unchecked was written'); process.exit(1); }
}
