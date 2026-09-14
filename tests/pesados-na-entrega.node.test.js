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
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { levarPesadosParaEntrega, argumentosDaEntrega } from '../scripts/pesados-na-entrega.mjs';
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

// A CARTRIDGE'S BUILD RUNS IT FROM THE INSTALLED PACKAGE (issue #173): `npx inclusionist-pesados dist` after its own build.
describe('the script, reachable by a cartridge', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

  it('🔴 [Right] the package publishes the script and names it as a command', () => {
    expect(pkg.files, 'the script is not published: a cartridge has no way to put the heavy files into its delivery').toContain('scripts/pesados-na-entrega.mjs');
    expect(pkg.bin?.['inclusionist-pesados']).toBe('scripts/pesados-na-entrega.mjs');
  });

  it('🔴 [Right] it finds the catalogue beside itself, not in the caller\'s folder', () => {
    // run from a folder with no `dist-pkg`, as a cartridge's build does: the module comes from the package's own install
    const fora = mkdtempSync(join(tmpdir(), 'cartucho-'));
    try {
      const url = pathToFileURL(join(process.cwd(), 'scripts', 'pesados-na-entrega.mjs')).href;
      const saida = execFileSync(process.execPath, ['--input-type=module', '-e', `const m = await import(${JSON.stringify(url)}); console.log(m.moduloDoPacote());`], { cwd: fora, encoding: 'utf8' }).trim();
      expect(fileURLToPath(saida)).toBe(join(process.cwd(), 'dist-pkg', 'platform', 'pesados.js'));
    } finally { rmSync(fora, { recursive: true, force: true }); }
  });

  it('🔴 [Right] Kokoro enters a delivery only with `--kokoro`, in any position (ADR-0198 §5)', () => {
    expect([argumentosDaEntrega(['dist']), argumentosDaEntrega(['--kokoro', 'dist']), argumentosDaEntrega(['dist', '--kokoro'])])
      .toEqual([{ destino: 'dist', kokoro: false }, { destino: 'dist', kokoro: true }, { destino: 'dist', kokoro: true }]);
    expect(argumentosDaEntrega(['--kokoro']).destino, 'the flag taken for the folder').toBeUndefined();
  });

  it('📌 [Boundary] run as a program without a destination, it stops with the usage — and never starts downloading', () => {
    const fora = mkdtempSync(join(tmpdir(), 'cartucho-'));
    try {
      let status = 0, stderr = '';
      try { execFileSync(process.execPath, [join(process.cwd(), 'scripts', 'pesados-na-entrega.mjs')], { cwd: fora, encoding: 'utf8', stdio: 'pipe' }); }
      catch (e) { status = e.status; stderr = e.stderr; }
      expect(status, 'the script did not run as a program').toBe(2);
      expect(stderr).toMatch(/usage: inclusionist-pesados/);
    } finally { rmSync(fora, { recursive: true, force: true }); }
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   E1 the sha256 check removed                          🔴 not written on mismatch
//   E2 `ok` ignores failures                             🔴 reports failure
//   E3 the existing-file shortcut removed                🔴 not fetched again
//   N1 the script left out of `files`                    🔴 published
//   N2 no `bin`                                          🔴 published
//   N3 the catalogue read from the caller's folder       🔴 beside itself
//   N4 never runs as a program                           🔴 stops with the usage
//   N5 run detection by the shim's name                  🔴 stops with the usage (a direct `node` run is not recognised)
//   N6 `--kokoro` read as always on                      🔴 only with `--kokoro`
//   N7 the flag taken as the folder                      🔴 only with `--kokoro`
//   ⚠️ The filter's wiring in the program body is not run here: it would download the catalogue.
