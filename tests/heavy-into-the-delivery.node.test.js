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
import {
  levarPesadosParaEntrega, argumentosDaEntrega, idsOfTheDelivery, commandLanguagesOfTheDelivery, readingLanguagesOfTheDelivery,
  fontFamiliesOfTheDelivery, levarFontesParaEntrega,
} from '../scripts/heavy-into-the-delivery.mjs';
import { deliveryPath, heavyAtBoot, HEAVY_FILES } from '../app/js/platform/heavy.js';
import { commandsLanguageOf, readingLanguageOf } from '../app/js/platform/heavy-catalogue.js';

const hash = (s) => createHash('sha256').update(s).digest('hex');
/** The engine's font catalogue, read as the delivery reads it. */
const LIBRARY = JSON.parse(readFileSync(new URL('../app/js/platform/font-library.json', import.meta.url), 'utf8'));
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

  it('🔴 [Right] a second run on the same delivery keeps the notices of what the first one wrote', async () => {
    // 📏 measured 2026-09-25: `--libras` and then `--libras-avatar --commands none` on one folder left THIRD-PARTY-NOTICES.md
    // listing only the second run's files — the delivery still carried the first run's, now without their notice
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const buscar = async (u) => resposta(CORPOS[u]);
      await levarPesadosParaEntrega({ destino, pesados: [ENTRADAS[0]], deliveryPath, fetch: buscar, catalogue: ENTRADAS });
      await levarPesadosParaEntrega({ destino, pesados: [ENTRADAS[1]], deliveryPath, fetch: buscar, catalogue: ENTRADAS });
      const notices = readFileSync(join(destino, 'heavy', 'THIRD-PARTY-NOTICES.md'), 'utf8');
      const folderOf = (e) => deliveryPath(e.url).replace(/^heavy\//, '').replace(/\/[^/]*$/, '');
      expect(notices, 'the first run\'s file lost its notice').toContain(`${folderOf(ENTRADAS[0])}/LICENSE`);
      expect(notices).toContain(`${folderOf(ENTRADAS[1])}/LICENSE`);
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('🔴 [Right] and a file on disk whose bytes are not the pinned ones gets no notice from the catalogue', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const alheio = join(destino, deliveryPath(ENTRADAS[0].url));
      mkdirSync(join(alheio, '..'), { recursive: true });
      writeFileSync(alheio, 'not the pinned bytes');
      await levarPesadosParaEntrega({ destino, pesados: [ENTRADAS[1]], deliveryPath, fetch: async (u) => resposta(CORPOS[u]), catalogue: ENTRADAS });
      const notices = readFileSync(join(destino, 'heavy', 'THIRD-PARTY-NOTICES.md'), 'utf8');
      expect(notices).not.toContain('huggingface.co');
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
    const semBase = (a) => { const { base, fonts, ...resto } = argumentosDaEntrega(a, {}); return resto; };
    expect([semBase(['dist']), semBase(['--kokoro', 'dist']), semBase(['dist', '--kokoro'])])
      .toEqual([{ destino: 'dist', kokoro: false, reading: [], commands: [], libras: false, librasTexts: [], librasSetup: false }, { destino: 'dist', kokoro: true, reading: [], commands: [], libras: false, librasTexts: [], librasSetup: false },
        { destino: 'dist', kokoro: true, reading: [], commands: [], libras: false, librasTexts: [], librasSetup: false }]);
    expect(argumentosDaEntrega(['--kokoro'], {}).destino, 'the flag taken for the folder').toBeUndefined();
  });

  it('🔴 [Right] the spoken languages are named one by one, and a flag never eats the delivery folder', () => {
    const semBase = (a) => { const { base, fonts, ...resto } = argumentosDaEntrega(a, {}); return resto; };
    expect(semBase(['dist', '--commands', 'pt', '--commands', 'es']))
      .toEqual({ destino: 'dist', kokoro: false, reading: [], commands: ['pt', 'es'], libras: false, librasTexts: [], librasSetup: false });
    // ⚠️ AND WITH THE FLAG FIRST, which is the only position that can see its VALUE being taken for the folder: `--base` had
    // exactly this hole and a mutation walked through it there too.
    expect(semBase(['--commands', 'pt', 'dist']), 'the language was read as the delivery folder')
      .toEqual({ destino: 'dist', kokoro: false, reading: [], commands: ['pt'], libras: false, librasTexts: [], librasSetup: false });
  });

  /**
   * 🔴 THE LIBRAS PLAYER ENTERS ONLY WITH `--libras` (ADR-0234): no game declares signing — deaf mode is the person's —
   * so the delivery says whether it can sign. The flag takes no value, so it must never eat the folder either.
   */
  it('🔴 [Right] the Libras player enters a delivery only with `--libras`, in any position, and never eats the folder', () => {
    expect(argumentosDaEntrega(['dist'], {}).libras, 'a delivery asked for nothing and got the player').toBe(false);
    expect(argumentosDaEntrega(['dist', '--libras'], {})).toEqual(expect.objectContaining({ destino: 'dist', libras: true }));
    expect(argumentosDaEntrega(['--libras', 'dist'], {}), 'the folder after the flag was lost')
      .toEqual(expect.objectContaining({ destino: 'dist', libras: true }));
  });

  /**
   * 🔴 A READING MODEL ENTERS BY LANGUAGE, and the flag repeats (ADR-0216 §3): a delivery for a school that reads in two
   * languages carries two, and one that reads in none carries none — 378 MiB for pt, 162 for en, 310 for es.
   *
   * ⚠️ `--reading` eats the token after it, like `--base`: without that, `pt` would be read as the delivery folder, which is the
   * defect a surviving mutation already caught once on the other flag.
   */
  /**
   * 🔴 THE DELIVERY CARRIES THE THREE SPOKEN LANGUAGES BY DEFAULT (ADR-0225 erratum; the Dev: «A entrega leva as três línguas.»).
   * A delivery built for the boot language alone met a child who switched mid-game with no model for her new language. The
   * flag still NARROWS — the languages named, and only those — and `none` keeps the old default of no command model at all.
   * ⚠️ Measured on the ids the command writes, through the real `heavyAtBoot` and the real catalogue: the arguments alone are
   * the same `[]` with or without this decision, so a case on them would see nothing.
   */
  it('🔴 [Right] without `--commands` the delivery carries the pt, en and es command models; the flag narrows, `none` empties', () => {
    const ids = (args) => idsOfTheDelivery(argumentosDaEntrega(args, {}), { heavyAtBoot, catalogue: HEAVY_FILES, commandsLanguageOf, readingLanguageOf });
    const modelos = (args) => ids(args).filter((id) => id.startsWith('commands:model:')).sort();
    const runtime = HEAVY_FILES.map((p) => p.id).filter((id) => id.startsWith('commands:runtime'));
    expect(runtime.length, 'the catalogue has no command runtime: the case would pass empty').toBeGreaterThan(0);

    expect(modelos(['dist']), 'the default delivery does not carry the three languages').toEqual(['commands:model:en', 'commands:model:es', 'commands:model:pt']);
    for (const id of runtime) expect(ids(['dist']), `${id} left out of the default delivery`).toContain(id);
    expect(modelos(['dist', '--kokoro']), 'the npm script\'s delivery lost a language').toHaveLength(3);

    expect(modelos(['dist', '--commands', 'pt']), 'an explicit list did not narrow').toEqual(['commands:model:pt']);
    expect(modelos(['--commands', 'es', '--commands', 'pt', 'dist'])).toEqual(['commands:model:es', 'commands:model:pt']);
    expect(ids(['dist', '--commands', 'none']).filter((id) => id.startsWith('commands:')), '`none` still carried a command file')
      .toEqual([]);
  });

  it('📌 [Right] the default is every language the catalogue has a command model for — not a list written here', () => {
    expect(commandLanguagesOfTheDelivery([], HEAVY_FILES, commandsLanguageOf)).toEqual(['pt', 'en', 'es']);
    const comQuarta = [...HEAVY_FILES, { id: 'commands:model:fr', url: null }];
    expect(commandLanguagesOfTheDelivery([], comQuarta, commandsLanguageOf), 'a fourth language with a model is left out')
      .toEqual(['pt', 'en', 'es', 'fr']);
    expect(commandLanguagesOfTheDelivery(['en', 'none'], HEAVY_FILES, commandsLanguageOf)).toEqual(['en']);
  });

  /**
   * 🔴 A COMMAND LANGUAGE WITH NO MODEL STOPS THE COMMAND, as a reading one does. `--commands xx` used to carry the command
   * runtime and no model at all, in silence — 3.1 MiB that open nothing, and a delivery that looks as if it could hear.
   * 📏 Measured before the change through the program: `commands  xx`, and the three runtime files were the ones it went for.
   */
  it('🔴 [Right] a named language the catalogue has no command model for is refused by name, with the languages it has', () => {
    const linguas = (asked) => commandLanguagesOfTheDelivery(asked, HEAVY_FILES, commandsLanguageOf);
    expect(() => linguas(['xx']), 'a language with no model was carried as the runtime alone').toThrow(/--commands xx: .*pt, en, es/);
    expect(() => linguas(['pt', 'fr', 'de'])).toThrow(/--commands fr, de:/);
    expect(linguas(['pt-BR', 'es', 'pt']), 'a regional tag is its base language, once').toEqual(['pt', 'es']);
    expect(() => idsOfTheDelivery(argumentosDaEntrega(['out', '--commands', 'xx'], {}),
      { heavyAtBoot, catalogue: HEAVY_FILES, commandsLanguageOf, readingLanguageOf }), 'the ids were computed past an unknown language')
      .toThrow(/no command model/);
  });

  it('🔴 [Right] each `--reading <language>` adds its model, and its value is never taken for the folder', () => {
    expect(argumentosDaEntrega(['dist'], {}).reading, 'a language appeared where nobody asked for one').toEqual([]);
    expect(argumentosDaEntrega(['dist', '--reading', 'pt'], {}).reading).toEqual(['pt']);
    const duas = argumentosDaEntrega(['--reading', 'pt', '--reading', 'es', 'dist'], {});
    expect(duas.reading, 'the second language was dropped').toEqual(['pt', 'es']);
    expect(duas.destino, 'a language was taken for the delivery folder').toBe('dist');
    expect(argumentosDaEntrega(['--reading', 'pt'], {}).destino, 'the value was taken for the folder').toBeUndefined();
  });

  /**
   * 🔴 `--reading` ALONE IS EVERY LANGUAGE (ADR-0225 erratum of 2026-09-26; the Dev: «Negativo, baixar os três.»): at the end of
   * the line, or before another flag, it takes no value — and eats neither the flag after it nor the folder.
   */
  it('🔴 [Right] `--reading` with no value is `all`, last or before another flag, and eats neither', () => {
    expect(argumentosDaEntrega(['dist', '--reading'], {}).reading, 'the bare flag at the end carried nothing').toEqual(['all']);
    const antes = argumentosDaEntrega(['--reading', '--kokoro', 'dist'], {});
    expect(antes, 'the bare flag ate the flag after it, or the folder')
      .toEqual(expect.objectContaining({ destino: 'dist', kokoro: true, reading: ['all'] }));
    expect(argumentosDaEntrega(['dist', '--reading', '--commands', 'pt'], {}))
      .toEqual(expect.objectContaining({ reading: ['all'], commands: ['pt'] }));
  });

  it('🔴 [Right] the reading languages: none without the flag, the catalogue\'s three with it alone, those named when named', () => {
    const linguas = (asked) => readingLanguagesOfTheDelivery(asked, HEAVY_FILES, readingLanguageOf);
    expect(linguas([]), 'a delivery without `--reading` carried a reading model').toEqual([]);
    expect(linguas(['all']), '`--reading` alone does not carry the three').toEqual(['pt', 'en', 'es']);
    expect(linguas(['pt']), 'a named language did not narrow').toEqual(['pt']);
    expect(linguas(['es', 'pt-BR', 'es'])).toEqual(['es', 'pt']);
    expect(linguas(['none']), '`none` carried a language').toEqual([]);
    expect(linguas(['none', 'en'])).toEqual(['en']);
    const comQuarta = [...HEAVY_FILES, { id: 'reading:fr:encoder', url: null }];
    expect(readingLanguagesOfTheDelivery(['all'], comQuarta, readingLanguageOf), 'a fourth language with a model is left out of `all`')
      .toEqual(['pt', 'en', 'es', 'fr']);
  });

  /**
   * 🔴 A LANGUAGE WITH NO MODEL STOPS THE COMMAND. It used to carry nothing, in silence — and `--reading dist`, a folder after the
   * flag, was read as a language and carried nothing just as quietly.
   */
  it('🔴 [Right] a named language the catalogue has no reading model for is refused by name, with the languages it has', () => {
    const linguas = (asked) => readingLanguagesOfTheDelivery(asked, HEAVY_FILES, readingLanguageOf);
    expect(() => linguas(['dist']), 'a folder read as a language was carried as nothing').toThrow(/--reading dist: .*pt, en, es/);
    expect(() => linguas(['pt', 'fr'])).toThrow(/--reading fr:/);
    expect(() => idsOfTheDelivery(argumentosDaEntrega(['out', '--reading', 'dist'], {}),
      { heavyAtBoot, catalogue: HEAVY_FILES, commandsLanguageOf, readingLanguageOf }), 'the ids were computed past an unknown language')
      .toThrow(/no reading model/);
  });

  /**
   * 🔴 WHAT THE FLAG PUTS IN THE DELIVERY, through the real `heavyAtBoot` and the real catalogue: alone, the three languages'
   * models and the graph runtime that opens them; narrowed, exactly one language's — the same ids a narrowed delivery wrote before.
   */
  it('🔴 [Right] `--reading` alone carries the pt, en and es reading models; `--reading pt` carries pt\'s alone; `none`, none', () => {
    const ids = (args) => idsOfTheDelivery(argumentosDaEntrega(args, {}), { heavyAtBoot, catalogue: HEAVY_FILES, commandsLanguageOf, readingLanguageOf });
    const leitura = (args) => ids(args).filter((id) => id.startsWith('reading:')).sort();
    const doCatalogo = (...linguas) => HEAVY_FILES.map((p) => p.id).filter((id) => linguas.includes(readingLanguageOf(id) ?? '')).sort();
    expect(leitura(['dist', '--reading']), 'the bare flag did not carry the three').toEqual(doCatalogo('pt', 'en', 'es'));
    expect(leitura(['dist', '--reading', 'all'])).toEqual(doCatalogo('pt', 'en', 'es'));
    expect(leitura(['dist', '--reading', 'pt']), '`--reading pt` did not narrow to Portuguese').toEqual(doCatalogo('pt'));
    expect(leitura(['dist']), 'no flag carried a reading model').toEqual([]);
    expect(leitura(['dist', '--reading', 'none'])).toEqual([]);
    for (const id of HEAVY_FILES.map((p) => p.id).filter((x) => x.startsWith('voz:runtime:onnx'))) {
      expect(ids(['dist', '--reading']), `${id} left out: three models and nothing able to open them`).toContain(id);
    }
  });

  it('🔴 [Right] the base comes from `--base`, from the environment, or from neither — and the flag wins', () => {
    // the Dev, 2026-09-21: «Precisamos de um .env que aponte para local quando estivermos testando em local e [para a conta R2]
    // quando estivermos usando estes recursos na minha conta.»
    expect(argumentosDaEntrega(['dist'], {}).base, 'a base appeared where nobody asked for one').toBe('');
    expect(argumentosDaEntrega(['dist'], { INCLUSIONIST_HEAVY_BASE: 'https://espelho.exemplo' }).base).toBe('https://espelho.exemplo');
    const comFlag = argumentosDaEntrega(['dist', '--base', 'D:\\lfs', '--kokoro'], { INCLUSIONIST_HEAVY_BASE: 'https://espelho.exemplo' });
    expect(comFlag, 'the flag must beat the environment, and the folder must not be eaten by it')
      .toEqual({ destino: 'dist', kokoro: true, reading: [], commands: [], libras: false, librasTexts: [], librasSetup: false, fonts: [], base: 'D:\\lfs' });
    // ⚠️ AND WITH THE FLAG FIRST: the case above cannot see the value being taken for the folder, because the folder was read
    // before it. A mutation that forgot to skip the value survived exactly here.
    expect(argumentosDaEntrega(['--base', 'D:\\lfs', 'dist'], {}), 'the base\'s value was taken for the delivery folder')
      .toEqual({ destino: 'dist', kokoro: false, reading: [], commands: [], libras: false, librasTexts: [], librasSetup: false, fonts: [], base: 'D:\\lfs' });
  });

  it('🔴 [Right] `--fonts` is repeatable, each value a family or a list, and its value never eats the folder (ADR-0255)', () => {
    expect(argumentosDaEntrega(['--fonts', 'Lato,Press Start 2P', 'dist', '--fonts', 'Cookie'], {}).fonts)
      .toEqual(['Lato,Press Start 2P', 'Cookie']);
    expect(argumentosDaEntrega(['--fonts', 'Lato', 'dist'], {}).destino, 'the family was read as the delivery folder').toBe('dist');
    expect(argumentosDaEntrega(['dist'], {}).fonts, 'a delivery asked for no font and got some').toEqual([]);
    expect(fontFamiliesOfTheDelivery(['Lato,Press Start 2P', 'Cookie'], LIBRARY)).toEqual(['Lato', 'Press Start 2P', 'Cookie']);
    expect(fontFamiliesOfTheDelivery(['all'], LIBRARY)).toEqual(Object.keys(LIBRARY.families));
    expect(fontFamiliesOfTheDelivery(['none'], LIBRARY)).toEqual([]);
    expect(() => fontFamiliesOfTheDelivery(['Lato,Merriweather'], LIBRARY), 'a family the library does not hold was carried as nothing')
      .toThrow(/--fonts Merriweather: the engine's font library has no such family/);
  });
});

/*
 * THE FONT LIBRARY INTO THE DELIVERY (ADR-0255): a declared family's faces are checked against the ENGINE's catalogue — not the
 * mirror's word — and written where the page asks for them, with the family's licence text and notice beside them.
 */
describe('the font library, put into the delivery by the build', () => {
  const FONT_DIR = join(process.cwd(), 'app', 'public', 'vendor', 'fonts');
  const bytes = readFileSync(join(FONT_DIR, 'lexend-400.woff2'));
  // a fake library of one family, whose one face is a real font of the package (its `name` table is what the notice is read from)
  const library = { mirror: 'https://lfs.example/fonts', ranges: {},
    families: { Lexend: { folder: 'lexend', licence: 'OFL-1.1', faces: [{ file: 'lexend-400.woff2', weight: '400', style: 'normal', bytes: bytes.length, sha256: hash(bytes) }] } } };
  const mirrorFolder = () => {
    const base = mkdtempSync(join(tmpdir(), 'lfs-'));
    mkdirSync(join(base, 'fonts', 'lexend'), { recursive: true });
    writeFileSync(join(base, 'fonts', 'lexend', 'lexend-400.woff2'), bytes);
    return base;
  };
  const fromBase = (url, base) => `${base}/fonts${url.slice(library.mirror.length)}`;

  it('🔴 [Right] each face is written where the page asks for it, checked, with the family\'s licence and notice beside it', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    const base = mirrorFolder();
    try {
      const r = await levarFontesParaEntrega({ destino, families: ['Lexend'], library, deliveryPath, base, fonteDe: fromBase });
      expect(r.ok, JSON.stringify(r.linhas)).toBe(true);
      const at = join(destino, 'heavy', 'lfs.example', 'fonts', 'lexend');
      expect(readFileSync(join(at, 'lexend-400.woff2')).equals(bytes)).toBe(true);
      expect(readFileSync(join(at, 'OFL-1.1.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
      expect(readFileSync(join(at, 'NOTICE.txt'), 'utf8')).toContain('Copyright 2019 The Lexend Project Authors');
    } finally { rmSync(destino, { recursive: true, force: true }); rmSync(base, { recursive: true, force: true }); }
  });

  it('🔴 [Right] a TAMPERED face is not written, its family gets no notice, and the run reports failure', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    const base = mirrorFolder();
    try {
      const tampered = Buffer.from(bytes); tampered[tampered.length - 1] ^= 0xff;
      writeFileSync(join(base, 'fonts', 'lexend', 'lexend-400.woff2'), tampered);
      const r = await levarFontesParaEntrega({ destino, families: ['Lexend'], library, deliveryPath, base, fonteDe: fromBase });
      expect(r.ok, 'a tampered font was accepted').toBe(false);
      expect(r.linhas[0].error).toMatch(/sha256 mismatch/);
      // the tampered file is the one line: a family not delivered whole is not then asked for its notice, which would fail again
      expect(r.linhas.filter((l) => l.outcome === 'falhou').length, 'a follow-on failure buried the cause').toBe(1);
      const at = join(destino, 'heavy', 'lfs.example', 'fonts', 'lexend');
      expect(existsSync(join(at, 'lexend-400.woff2')), 'the tampered bytes were written').toBe(false);
      expect(existsSync(join(at, 'NOTICE.txt')), 'a family not delivered whole got a notice').toBe(false);
    } finally { rmSync(destino, { recursive: true, force: true }); rmSync(base, { recursive: true, force: true }); }
  });

  it('📌 [Boundary] a face already in the delivery with its pinned hash is not fetched again', async () => {
    const destino = mkdtempSync(join(tmpdir(), 'entrega-'));
    try {
      const at = join(destino, 'heavy', 'lfs.example', 'fonts', 'lexend');
      mkdirSync(at, { recursive: true });
      writeFileSync(join(at, 'lexend-400.woff2'), bytes);
      const r = await levarFontesParaEntrega({ destino, families: ['Lexend'], library, deliveryPath,
        fetch: () => { throw new Error('fetched again'); } });
      expect(r.linhas.map((l) => l.outcome)).toEqual(['ja-tinha']);
      expect(existsSync(join(at, 'NOTICE.txt'))).toBe(true);
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });
});

describe('the script\'s last step, the usage', () => {

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
//   E4 an entry the delivery makes downloaded like any — LEFT with `madeFrom` and route A's patched framework (phase B3)
//   N1 the script left out of `files`                    🔴 published
//   N2 no `bin`                                          🔴 published
//   N3 the catalogue read from the caller's folder       🔴 beside itself
//   N4 never runs as a program                           🔴 stops with the usage
//   N5 run detection by the shim's name                  🔴 stops with the usage (a direct `node` run is not recognised)
//   N6 `--kokoro` read as always on                      🔴 only with `--kokoro`
//   N7 the flag taken as the folder                      🔴 only with `--kokoro`
//   (2026-09-27, ADR-0255 — the font library, each applied by script and restored from a copy by sha256)
//   D1 the sha256 check skipped                          🔴 not written on mismatch · a mirror of other bytes · a TAMPERED face
//   D2 a family not delivered whole asked for its notice 🔴 a TAMPERED face (a follow-on failure buried the cause) — SURVIVED
//      first: the notice cannot be read from a missing file anyway, so the case now holds the report's single cause
//   D3 an unknown family carried as nothing, in silence  🔴 `--fonts` is repeatable … refused by name
//   D4 a face already delivered fetched again            🔴 a face already in the delivery is not fetched again
//   C1 no `--commands` carries no language (the old default)   🔴 the pt, en and es models
//   C2 no `--commands` carries one language                    🔴 the pt, en and es models
//   C3 an explicit `--commands` list does not narrow           🔴 the flag narrows
//   C4 `--commands none` read as a language                    🔴 `none` empties
//   ⚠️ The filter's wiring in the program body is not run here: it would download the catalogue.
//   L1 the bare `--reading` eats the token after it         🔴 alone is `all`, and eats neither
//   L2 `all` not honoured (carries nothing)                 🔴 alone carries the three
//   L3 the default is every language even without the flag 🔴 no flag carries none
//   L4 a named language does not narrow (always all)         🔴 `--reading pt` carries pt's alone
//   L5 an unknown language carried as nothing, in silence   🔴 refused by name
//   L6 `none` read as a language                             🔴 `none` carries none
//   ⚠️ The program's exit 2 on an unknown language is in its body, which needs `dist-pkg`: measured instead (2026-09-26),
//      `node scripts/heavy-into-the-delivery.mjs dist --reading fr` exits 2 naming `fr` before a byte is fetched.
//   K1 an unknown command language carried in silence      🔴 refused by name (`scratchpad/moonshine-fix/plan-commands.json`)
//   K2 a regional tag (`pt-BR`) refused as unknown          🔴 same
//   K3 the regional tags carried as they were written        🔴 same
//   K4 the message without the catalogue's languages         🔴 same
//   K5 the program checking the command languages late      measured instead (program body, `wiring-probe.mjs`): as written,
//      `--commands xx` exits 2 naming `xx` with no download line; mutated, it dies with an uncaught exception, exit 1
//   T1 a file already in the delivery gets no notice      🔴 a second run keeps the first run's notices
//   T2 any file on disk gets a notice, pinned or not      🔴 bytes that are not the pinned ones get no notice
//   T3 the program not passing the catalogue survives here (program body): measured instead on a real delivery,
//      2026-09-25 — `--libras` then `--libras-avatar --commands none` into one `dist` keeps all six projects' notices
