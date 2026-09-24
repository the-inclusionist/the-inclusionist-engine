// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BUILD PUTS THE HEAVY FILES INTO THE DELIVERY, CHECKED (ADR-0177, issue #173).
//
// 📌 The upstream hosts are contacted by the BUILD, once; the child's device reads `heavy/` from the game's own origin. A
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
import { levarPesadosParaEntrega, argumentosDaEntrega } from '../scripts/heavy-into-the-delivery.mjs';
import { deliveryPath } from '../app/js/platform/heavy.js';

const hash = (s) => createHash('sha256').update(s).digest('hex');
// the ids carry real group prefixes (`voz:kokoro`, `visao`): an id with no licence group is refused (heavy-licences test)
const ENTRADAS = [
  { id: 'voz:kokoro:teste', url: 'https://huggingface.co/x/resolve/main/voz.onnx', sha256: hash('voz') },
  { id: 'visao:teste', url: 'https://cdn.jsdelivr.net/npm/pacote@1.0.0/visao.wasm', sha256: hash('visao') },
  { id: 'sem:fonte', url: null },
];
const CORPOS = { 'https://huggingface.co/x/resolve/main/voz.onnx': 'voz', 'https://cdn.jsdelivr.net/npm/pacote@1.0.0/visao.wasm': 'visao' };
const resposta = (texto) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(texto).buffer });

describe('the heavy files, put into the delivery by the build', () => {
  it('🔴 [Right] each file is written where the page asks for it, and the run reports success', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const { ok, linhas } = await levarPesadosParaEntrega({ destino, pesados: ENTRADAS, deliveryPath, fetch: async (u) => resposta(CORPOS[u]) });
      expect(ok).toBe(true);
      expect(readFileSync(join(destino, deliveryPath(ENTRADAS[0].url)), 'utf8')).toBe('voz');
      expect(readFileSync(join(destino, deliveryPath(ENTRADAS[1].url)), 'utf8')).toBe('visao');
      expect(linhas.find((l) => l.id === 'sem:fonte').outcome).toBe('sem-fonte');
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('🔴 [Right] a body whose sha256 differs is NOT written, and the run reports failure', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const buscar = async (u) => resposta(u.endsWith('voz.onnx') ? 'adulterado' : CORPOS[u]);
      const { ok, linhas } = await levarPesadosParaEntrega({ destino, pesados: ENTRADAS, deliveryPath, fetch: buscar });
      expect(ok, 'an altered file let the delivery pass').toBe(false);
      expect(existsSync(join(destino, deliveryPath(ENTRADAS[0].url))), 'the altered file was written').toBe(false);
      expect(linhas.find((l) => l.id === 'voz:kokoro:teste').error).toMatch(/sha256 mismatch/);
      expect(existsSync(join(destino, deliveryPath(ENTRADAS[1].url))), 'one bad file stopped the good ones').toBe(true);
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('🔴 [Right] with a base, the bytes come from the mirror — and land where the page asks for them', async () => {
    // the Dev, 2026-09-21: a `.env` pointing at a local copy while testing, at the project's bucket otherwise. The delivery
    // path never moves, because it is what the child's page asks for; only where the build READS from does.
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const pedidos = [];
      const { ok } = await levarPesadosParaEntrega({
        destino, pesados: ENTRADAS, deliveryPath, base: 'https://espelho.exemplo',
        fonteDe: (url, base) => `${base}/espelhado/${url.split('/').pop()}`,
        fetch: async (u) => { pedidos.push(u); return resposta(CORPOS[Object.keys(CORPOS).find((k) => k.endsWith(u.split('/').pop()))]); },
      });
      expect(ok).toBe(true);
      expect(pedidos).toEqual(['https://espelho.exemplo/espelhado/voz.onnx', 'https://espelho.exemplo/espelhado/visao.wasm']);
      expect(readFileSync(join(destino, deliveryPath(ENTRADAS[0].url)), 'utf8'), 'the delivery path followed the mirror').toBe('voz');
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('🔴 [Right] a base that is a FOLDER is read from the disk, with no network at all', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    const espelho = mkdtempSync(join(tmpdir(), 'espelho-'));
    try {
      for (const [url, corpo] of Object.entries(CORPOS)) writeFileSync(join(espelho, url.split('/').pop()), corpo);
      const { ok, linhas } = await levarPesadosParaEntrega({
        destino, pesados: ENTRADAS, deliveryPath, base: espelho,
        fonteDe: (url, base) => join(base, url.split('/').pop()),
        fetch: async () => { throw new Error('the network was used with a local base'); },
      });
      expect(ok, linhas.map((l) => l.error).join(' ')).toBe(true);
      expect(readFileSync(join(destino, deliveryPath(ENTRADAS[1].url)), 'utf8')).toBe('visao');
    } finally { rmSync(destino, { recursive: true, force: true }); rmSync(espelho, { recursive: true, force: true }); }
  });

  it('🔴 [Right] a mirror that serves OTHER bytes writes nothing — which is what makes a base safe to change', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const { ok, linhas } = await levarPesadosParaEntrega({
        destino, pesados: ENTRADAS, deliveryPath, base: 'https://espelho.exemplo',
        fonteDe: (url, base) => `${base}/${url.split('/').pop()}`, fetch: async () => resposta('outra coisa'),
      });
      expect(ok).toBe(false);
      expect(linhas.find((l) => l.id === 'voz:kokoro:teste').error, 'the error does not say WHERE the bytes came from').toMatch(/espelho\.exemplo/);
      expect(existsSync(join(destino, deliveryPath(ENTRADAS[0].url)))).toBe(false);
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('📌 [Boundary] a file already in the delivery with the right hash is not fetched again', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const ja = join(destino, deliveryPath(ENTRADAS[0].url));
      mkdirSync(dirname(ja), { recursive: true });
      writeFileSync(ja, 'voz');
      const pedidos = [];
      await levarPesadosParaEntrega({ destino, pesados: ENTRADAS, deliveryPath, fetch: async (u) => { pedidos.push(u); return resposta(CORPOS[u]); } });
      expect(pedidos).toEqual([ENTRADAS[1].url]);
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('🎯 [Zero] package.json runs it after building the package', () => {
    const script = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).scripts['heavy:delivery'];
    // `--kokoro`: the engine's quiz demo fills the Kokoro port (ADR-0198 erratum)
    expect(script).toBe('npm run build:pkg && node scripts/heavy-into-the-delivery.mjs dist --kokoro');
  });
});

// A CARTRIDGE'S BUILD RUNS IT FROM THE INSTALLED PACKAGE (issue #173): `npx inclusionist-heavy dist` after its own build.
describe('the script, reachable by a cartridge', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

  it('🔴 [Right] the package publishes the script and names it as a command', () => {
    expect(pkg.files, 'the script is not published: a cartridge has no way to put the heavy files into its delivery').toContain('scripts/heavy-into-the-delivery.mjs');
    expect(pkg.bin?.['inclusionist-heavy']).toBe('scripts/heavy-into-the-delivery.mjs');
  });

  it('🔴 [Right] it finds the catalogue beside itself, not in the caller\'s folder', () => {
    // run from a folder with no `dist-pkg`, as a cartridge's build does: the module comes from the package's own install
    const fora = mkdtempSync(join(tmpdir(), 'cartucho-'));
    try {
      const url = pathToFileURL(join(process.cwd(), 'scripts', 'heavy-into-the-delivery.mjs')).href;
      const saida = execFileSync(process.execPath, ['--input-type=module', '-e', `const m = await import(${JSON.stringify(url)}); console.log(m.moduloDoPacote());`], { cwd: fora, encoding: 'utf8' }).trim();
      expect(fileURLToPath(saida)).toBe(join(process.cwd(), 'dist-pkg', 'platform', 'heavy.js'));
    } finally { rmSync(fora, { recursive: true, force: true }); }
  });

  it('🔴 [Right] Kokoro enters a delivery only with `--kokoro`, in any position (ADR-0216 §3)', () => {
    const semBase = (a) => { const { base, ...resto } = argumentosDaEntrega(a, {}); return resto; };
    expect([semBase(['dist']), semBase(['--kokoro', 'dist']), semBase(['dist', '--kokoro'])])
      .toEqual([{ destino: 'dist', kokoro: false, reading: [], commands: [] }, { destino: 'dist', kokoro: true, reading: [], commands: [] },
        { destino: 'dist', kokoro: true, reading: [], commands: [] }]);
    expect(argumentosDaEntrega(['--kokoro'], {}).destino, 'the flag taken for the folder').toBeUndefined();
  });

  it('🔴 [Right] the spoken languages are named one by one, and a flag never eats the delivery folder', () => {
    const semBase = (a) => { const { base, ...resto } = argumentosDaEntrega(a, {}); return resto; };
    expect(semBase(['dist', '--commands', 'pt', '--commands', 'es']))
      .toEqual({ destino: 'dist', kokoro: false, reading: [], commands: ['pt', 'es'] });
    // ⚠️ AND WITH THE FLAG FIRST, which is the only position that can see its VALUE being taken for the folder: `--base` had
    // exactly this hole and a mutation walked through it there too.
    expect(semBase(['--commands', 'pt', 'dist']), 'the language was read as the delivery folder')
      .toEqual({ destino: 'dist', kokoro: false, reading: [], commands: ['pt'] });
  });

  /**
   * 🔴 A READING MODEL ENTERS BY LANGUAGE, and the flag repeats (ADR-0216 §3): a delivery for a school that reads in two
   * languages carries two, and one that reads in none carries none — 378 MiB for pt, 162 for en, 310 for es.
   *
   * ⚠️ `--reading` eats the token after it, like `--base`: without that, `pt` would be read as the delivery folder, which is the
   * defect a surviving mutation already caught once on the other flag.
   */
  it('🔴 [Right] each `--reading <language>` adds its model, and its value is never taken for the folder', () => {
    expect(argumentosDaEntrega(['dist'], {}).reading, 'a language appeared where nobody asked for one').toEqual([]);
    expect(argumentosDaEntrega(['dist', '--reading', 'pt'], {}).reading).toEqual(['pt']);
    const duas = argumentosDaEntrega(['--reading', 'pt', '--reading', 'es', 'dist'], {});
    expect(duas.reading, 'the second language was dropped').toEqual(['pt', 'es']);
    expect(duas.destino, 'a language was taken for the delivery folder').toBe('dist');
    expect(argumentosDaEntrega(['--reading', 'pt'], {}).destino, 'the value was taken for the folder').toBeUndefined();
  });

  it('🔴 [Right] the base comes from `--base`, from the environment, or from neither — and the flag wins', () => {
    // the Dev, 2026-09-21: «Precisamos de um .env que aponte para local quando estivermos testando em local e [para a conta R2]
    // quando estivermos usando estes recursos na minha conta.»
    expect(argumentosDaEntrega(['dist'], {}).base, 'a base appeared where nobody asked for one').toBe('');
    expect(argumentosDaEntrega(['dist'], { INCLUSIONIST_HEAVY_BASE: 'https://espelho.exemplo' }).base).toBe('https://espelho.exemplo');
    const comFlag = argumentosDaEntrega(['dist', '--base', 'D:\\lfs', '--kokoro'], { INCLUSIONIST_HEAVY_BASE: 'https://espelho.exemplo' });
    expect(comFlag, 'the flag must beat the environment, and the folder must not be eaten by it')
      .toEqual({ destino: 'dist', kokoro: true, reading: [], commands: [], base: 'D:\\lfs' });
    // ⚠️ AND WITH THE FLAG FIRST: the case above cannot see the value being taken for the folder, because the folder was read
    // before it. A mutation that forgot to skip the value survived exactly here.
    expect(argumentosDaEntrega(['--base', 'D:\\lfs', 'dist'], {}), 'the base\'s value was taken for the delivery folder')
      .toEqual({ destino: 'dist', kokoro: false, reading: [], commands: [], base: 'D:\\lfs' });
  });

  it('📌 [Boundary] run as a program without a destination, it stops with the usage — and never starts downloading', () => {
    const fora = mkdtempSync(join(tmpdir(), 'cartucho-'));
    try {
      let status = 0, stderr = '';
      try { execFileSync(process.execPath, [join(process.cwd(), 'scripts', 'heavy-into-the-delivery.mjs')], { cwd: fora, encoding: 'utf8', stdio: 'pipe' }); }
      catch (e) { status = e.status; stderr = e.stderr; }
      expect(status, 'the script did not run as a program').toBe(2);
      expect(stderr).toMatch(/usage: inclusionist-heavy/);
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
