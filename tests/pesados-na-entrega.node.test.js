// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BUILD PUTS THE HEAVY FILES INTO THE DELIVERY, CHECKED (ADR-0177, issue #173).
//
// 📌 The upstream hosts are contacted by the BUILD, once; the child's device reads `pesados/` from the game's own origin. A
// file whose sha256 differs is not written, and the run reports failure — a delivery never carries an unchecked file.
// No network here: the fetch is injected.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { levarPesadosParaEntrega } from '../scripts/pesados-na-entrega.mjs';
import { caminhoNaEntrega } from '../app/js/platform/pesados.js';

const hash = (s) => createHash('sha256').update(s).digest('hex');
const ENTRADAS = [
  { id: 'voz:teste', url: 'https://huggingface.co/x/resolve/main/voz.onnx', sha256: hash('voz') },
  { id: 'visao:teste', url: 'https://cdn.jsdelivr.net/npm/pacote@1.0.0/visao.wasm', sha256: hash('visao') },
  { id: 'sem:fonte', url: null },
];
const CORPOS = { 'https://huggingface.co/x/resolve/main/voz.onnx': 'voz', 'https://cdn.jsdelivr.net/npm/pacote@1.0.0/visao.wasm': 'visao' };
const resposta = (texto) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(texto).buffer });

describe('the heavy files, put into the delivery by the build', () => {
  it('🔴 [Right] each file is written where the page asks for it, and the run reports success', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const { ok, linhas } = await levarPesadosParaEntrega({ destino, pesados: ENTRADAS, caminhoNaEntrega, buscar: async (u) => resposta(CORPOS[u]) });
      expect(ok).toBe(true);
      expect(readFileSync(join(destino, caminhoNaEntrega(ENTRADAS[0].url)), 'utf8')).toBe('voz');
      expect(readFileSync(join(destino, caminhoNaEntrega(ENTRADAS[1].url)), 'utf8')).toBe('visao');
      expect(linhas.find((l) => l.id === 'sem:fonte').estado).toBe('sem-fonte');
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('🔴 [Right] a body whose sha256 differs is NOT written, and the run reports failure', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const buscar = async (u) => resposta(u.endsWith('voz.onnx') ? 'adulterado' : CORPOS[u]);
      const { ok, linhas } = await levarPesadosParaEntrega({ destino, pesados: ENTRADAS, caminhoNaEntrega, buscar });
      expect(ok, 'an altered file let the delivery pass').toBe(false);
      expect(existsSync(join(destino, caminhoNaEntrega(ENTRADAS[0].url))), 'the altered file was written').toBe(false);
      expect(linhas.find((l) => l.id === 'voz:teste').erro).toMatch(/sha256 mismatch/);
      expect(existsSync(join(destino, caminhoNaEntrega(ENTRADAS[1].url))), 'one bad file stopped the good ones').toBe(true);
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('📌 [Boundary] a file already in the delivery with the right hash is not fetched again', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const ja = join(destino, caminhoNaEntrega(ENTRADAS[0].url));
      mkdirSync(dirname(ja), { recursive: true });
      writeFileSync(ja, 'voz');
      const pedidos = [];
      await levarPesadosParaEntrega({ destino, pesados: ENTRADAS, caminhoNaEntrega, buscar: async (u) => { pedidos.push(u); return resposta(CORPOS[u]); } });
      expect(pedidos).toEqual([ENTRADAS[1].url]);
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('🎯 [Zero] package.json runs it after building the package', () => {
    const script = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).scripts['pesados:entrega'];
    expect(script).toBe('npm run build:pkg && node scripts/pesados-na-entrega.mjs dist');
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   E1 the sha256 check removed                          🔴 not written on mismatch
//   E2 `ok` ignores failures                             🔴 reports failure
//   E3 the existing-file shortcut removed                🔴 not fetched again
