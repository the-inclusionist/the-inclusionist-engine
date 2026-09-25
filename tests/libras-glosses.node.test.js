// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BUILD-TIME GLOSSES (ADR-0234, route A — plan item 5b; `scripts/libras-glosses.mjs`), with a FAKE translator: no Python runs
// here. What is held: which texts are glossed (the engine's and the game's Portuguese, each once, holes kept), that a hole comes
// back as a hole even when the translator drops its placeholder, that the written glosses are what the player can sign from THIS
// delivery, that the pinned signs are checked by sha256, and — the reason the step exists as a step — that a delivery with
// `--libras` is NEVER written without its glosses: no environment, no model, another translator, each stops it by name.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import {
  textsToGloss, glossTexts, glossTokens, spellable, placeholderWord, runGlosser, setUpGlosser, deliverLibrasGlosses,
  deliverLibrasSigns, glosserEnvironment, glosserPython, readSignPins, PINNED, GLOSSER_PROJECT,
} from '../scripts/libras-glosses.mjs';
import { argumentosDaEntrega } from '../scripts/heavy-into-the-delivery.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const MADE = 'vlibras-translator 1.3.3 (rules) · pt_core_news_md 3.8.0 · spaCy 3.8.16';
/** A translator double: capitals, and the placeholder words through untouched — what the real one does with them. */
const upper = (inputs) => ({ glosses: inputs.map((t) => t.toUpperCase().replace(/[.!]/g, ' [PONTO]').trim()), made: MADE });
const tmp = () => mkdtempSync(join(tmpdir(), 'libras-glosses-'));

describe('which texts are glossed', () => {
  it('🔴 [Right] the engine\'s and the game\'s strings, each once, trimmed and sorted — a game\'s dictionary may be an array', () => {
    const engine = { 'a.x': 'Olhe aqui', 'a.y': '  Jogador {n} entrou!  ', 'a.z': 'Olhe aqui' };
    const game = ['Bem-vindo à escola.', 'Olhe aqui'];
    expect(textsToGloss([engine, game])).toEqual(['Bem-vindo à escola.', 'Jogador {n} entrou!', 'Olhe aqui']);
  });

  it('🎯 [Zero] a string with no letter outside its holes is not glossed — the value alone is looked up at run time', () => {
    expect(textsToGloss([{ a: '{n}', b: '{a} / {b}', c: '100%', d: '', e: 42, f: 'Nível {n}' }])).toEqual(['Nível {n}']);
  });
});

describe('the holes survive the translator', () => {
  it('🔴 [Right] each hole is read as a placeholder WORD and comes back as the hole, by name', async () => {
    const translate = vi.fn(upper);
    const file = await glossTexts(['Jogador {n} entrou!', 'Botão {sim} para confirmar, botão {nao} para voltar.'], translate);
    expect(translate.mock.calls[0][0], 'the translator was not handed a placeholder word for each hole')
      .toEqual([`Jogador ${placeholderWord(0)} entrou!`, `Botão ${placeholderWord(0)} para confirmar, botão ${placeholderWord(1)} para voltar.`]);
    expect(file).toEqual({ format: 1, made: MADE, glosses: [
      ['Jogador {n} entrou!', 'JOGADOR {n} ENTROU [PONTO]'],
      ['Botão {sim} para confirmar, botão {nao} para voltar.', 'BOTÃO {sim} PARA CONFIRMAR, BOTÃO {nao} PARA VOLTAR [PONTO]'],
    ] });
    expect(translate, 'a second pass ran where every placeholder came back').toHaveBeenCalledTimes(1);
  });

  it('📌 [Boundary] placeholder words are letters only, and never end in a plural S', () => {
    expect([0, 1, 25, 26, 27].map(placeholderWord)).toEqual(['ZPARAMAZ', 'ZPARAMBZ', 'ZPARAMZZ', 'ZPARAMAAZ', 'ZPARAMABZ']);
  });

  it('🔴 [Right] a template whose placeholder the translator DROPPED is glossed again in pieces, the hole between them', async () => {
    // the double drops every placeholder word, as the real one could with a word it reads as a determiner
    const dropping = (inputs) => ({ glosses: inputs.map((t) => t.replace(/ZPARAM[A-Z]+Z/g, '').toUpperCase().trim()), made: MADE });
    const translate = vi.fn(dropping);
    const file = await glossTexts(['Olhe aqui', 'Você soltou: {o}.'], translate);
    expect(file.glosses).toEqual([['Olhe aqui', 'OLHE AQUI'], ['Você soltou: {o}.', 'VOCÊ SOLTOU: {o}']]);
    expect(translate.mock.calls[1][0], 'the pieces are the fixed text between the holes, a piece with no letter sent empty')
      .toEqual(['Você soltou: ', '']);
  });
});

describe('what the player can sign from this delivery', () => {
  const file = { format: 1, made: MADE, glosses: [['a', 'VOCÊ SOLTAR {o} [EXCLAMAÇÃO]'], ['b', 'PAPELÃO CAIXA']] };

  it('🔴 [Right] the sign names the glosses ask for: each once, without the punctuation marks or the holes', () => {
    expect(glossTokens(file)).toEqual(['CAIXA', 'PAPELÃO', 'SOLTAR', 'VOCÊ']);
  });

  it('🔴 [Right] a token with no sign carried loses its accents (it is fingerspelled); a carried one, the marks and the holes keep them', () => {
    expect(spellable(file, new Set(['PAPELÃO'])).glosses)
      .toEqual([['a', 'VOCE SOLTAR {o} [EXCLAMAÇÃO]'], ['b', 'PAPELÃO CAIXA']]);
  });
});

describe('the step `--libras` runs', () => {
  it('🔴 [Right] writes `glosses.json` into the player\'s folder, from the engine\'s and the game\'s texts', async () => {
    const destino = tmp();
    try {
      const made = await deliverLibrasGlosses({
        destino, playerFolder: 'libras/player/', signsFolder: 'libras/signs/', glossesFile: 'glosses.json',
        dictionaries: [{ k: 'Olá, Maria.' }, ['Pontos: {n}']], translate: upper,
      });
      expect(made).toEqual({ path: 'libras/player/glosses.json', texts: 2, tokens: 3, signs: [], unpinned: ['MARIA', 'OLÁ,', 'PONTOS:'] });
      const written = JSON.parse(readFileSync(join(destino, 'libras/player/glosses.json'), 'utf8'));
      expect(written).toEqual({ format: 1, made: MADE, glosses: [['Olá, Maria.', 'OLA, MARIA [PONTO]'], ['Pontos: {n}', 'PONTOS: {n}']] });
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('🔴 [Right] a translator that fails stops the step, and NOTHING is written', async () => {
    const destino = tmp();
    try {
      const failing = () => { throw new Error('the Libras glosser\'s environment is missing'); };
      await expect(deliverLibrasGlosses({ destino, playerFolder: 'libras/player/', signsFolder: 'libras/signs/',
        glossesFile: 'glosses.json', dictionaries: [{ k: 'Olhe aqui' }], translate: failing })).rejects.toThrow(/environment is missing/);
      expect(existsSync(join(destino, 'libras')), 'a delivery got a Libras folder from a glosser that failed').toBe(false);
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('🎯 [Zero] no text at all is refused: the engine\'s dictionary was not found, and an empty file would read as glossed', async () => {
    await expect(deliverLibrasGlosses({ destino: tmp(), playerFolder: 'p/', signsFolder: 's/', glossesFile: 'g.json',
      dictionaries: [{}], translate: upper })).rejects.toThrow(/no text to gloss/);
  });
});

describe('the glosser fails LOUDLY', () => {
  const answer = (out, status = 0, stderr = '') => () => ({ status, stdout: JSON.stringify(out), stderr });
  const good = { translator: '1.3.3', spacy: '3.8.16', model: 'pt_core_news_md', modelVersion: '3.8.0', mode: 'rules' };
  const opts = (run) => ({ envDir: 'ENV', run, exists: () => true });

  it('🔴 [Right] no environment: it says so and names the ONE command that builds it — Python is never started', () => {
    const run = vi.fn();
    expect(() => runGlosser(['x'], { envDir: 'ENV', run, exists: () => false }))
      .toThrow(/environment is missing .*npx inclusionist-heavy --libras-setup.*uv and Python 3\.12/);
    expect(run).not.toHaveBeenCalled();
  });

  it('🔴 [Right] no spaCy model (exit 3), no translator (exit 4), any other exit: each by name', () => {
    expect(() => runGlosser(['x'], opts(answer({}, 3, 'OSError: [E050]')))).toThrow(/model pt_core_news_md is missing .*--libras-setup/);
    expect(() => runGlosser(['x'], opts(answer({}, 4)))).toThrow(/translator is missing/);
    expect(() => runGlosser(['x'], opts(answer({}, 1, 'Traceback\nboom')))).toThrow(/glosser failed \(exit 1\): Traceback · boom/);
  });

  it('🔴 [Right] a translator, model or mode other than the pinned ones is REFUSED, not trusted', () => {
    for (const other of [{ translator: '1.3.4' }, { modelVersion: '3.7.0' }, { model: 'pt_core_news_lg' }, { mode: 'neural' }]) {
      expect(() => runGlosser(['x'], opts(answer({ ...good, ...other, glosses: ['X'] }))), JSON.stringify(other)).toThrow(/REFUSED/);
    }
  });

  it('📌 [Boundary] an answer with a gloss short, or not JSON, is refused', () => {
    expect(() => runGlosser(['x', 'y'], opts(answer({ ...good, glosses: ['X'] })))).toThrow(/1 glosses for 2 texts/);
    expect(() => runGlosser(['x'], opts(() => ({ status: 0, stdout: 'Warning: …', stderr: '' })))).toThrow(/not JSON/);
  });

  it('🔴 [Right] a good answer: one gloss per text, and what made them — the texts handed over as JSON on stdin', () => {
    const run = vi.fn(answer({ ...good, glosses: ['OLHE AQUI'] }));
    expect(runGlosser(['Olhe aqui'], opts(run))).toEqual({ glosses: ['OLHE AQUI'], made: MADE });
    const [python, args, how] = run.mock.calls[0];
    expect(python).toBe(glosserPython('ENV'));
    expect(args).toEqual([join(GLOSSER_PROJECT, 'gloss.py')]);
    expect(JSON.parse(how.input)).toEqual({ texts: ['Olhe aqui'] });
  });

  it('🔴 [Right] setup: no `uv` is said by name; a failed sync names Python 3.12; it runs locked, and never downloads a Python', () => {
    expect(() => setUpGlosser({ envDir: 'E', run: () => ({ error: Object.assign(new Error('spawn uv ENOENT'), { code: 'ENOENT' }) }) }))
      .toThrow(/needs `uv`, and it is not installed/);
    expect(() => setUpGlosser({ envDir: 'E', run: () => ({ status: 2 }) })).toThrow(/needs Python 3\.12 .*never to download one/);
    const run = vi.fn(() => ({ status: 0 }));
    expect(setUpGlosser({ envDir: 'E', run, env: {} })).toBe('E');
    expect(run.mock.calls[0][0]).toBe('uv');
    expect(run.mock.calls[0][1]).toEqual(['sync', '--locked', '--no-python-downloads', '--project', GLOSSER_PROJECT]);
    expect(run.mock.calls[0][2].env.UV_PROJECT_ENVIRONMENT, 'the environment would be built inside the repository').toBe('E');
  });

  it('📌 [Boundary] the environment lives outside the repository unless the machine says where', () => {
    expect(glosserEnvironment({}, '/home/x')).toBe(join('/home/x', '.cache', 'the-inclusionist', 'libras-glosses'));
    expect(glosserEnvironment({ INCLUSIONIST_LIBRAS_ENV: 'D:\\env' }, '/home/x')).toBe('D:\\env');
    expect(glosserPython('E', 'win32')).toBe(join('E', 'Scripts', 'python.exe'));
    expect(glosserPython('E', 'linux')).toBe(join('E', 'bin', 'python'));
  });
});

describe('the pins: rule-based only, and reproducible', () => {
  const lock = readFileSync(join(GLOSSER_PROJECT, 'uv.lock'), 'utf8');

  it('🔴 [Right] the lock pins the translator 1.3.3 and spaCy\'s model 3.8.0 by hash, and PINNED says the same', () => {
    expect(lock).toMatch(/name = "vlibras-translator"\nversion = "1\.3\.3"[\s\S]*?sha256:157ab2d2b4559eec366cba9d8abcf0ef06e0b3b30e95b83d739e153bfac4e2b5/);
    expect(lock).toMatch(/name = "pt-core-news-md"\nversion = "3\.8\.0"[\s\S]*?sha256:54382cda034e41f3ec605ceeb924cd6cfdbced00a65f7afa12218520ba7008c5/);
    expect(PINNED).toEqual({ translator: '1.3.3', model: 'pt_core_news_md', modelVersion: '3.8.0', mode: 'rules' });
  });

  it('🔴 [Right] never the neural mode: no torch in the lock, and the glosser asks for `neural=False` only', () => {
    expect(lock, 'the neural extra entered the environment').not.toMatch(/name = "torch"/);
    const glosser = readFileSync(join(GLOSSER_PROJECT, 'gloss.py'), 'utf8');
    expect(glosser).toMatch(/translate\(text, neural=False\)/);
    expect(glosser).not.toMatch(/neural\s*=\s*True/);
  });

  it('📌 [Boundary] no sign is pinned yet: fetching LAViD\'s bundles waits for the Dev', () => {
    expect(readSignPins().signs).toEqual({});
  });
});

describe('the signs, pinned by sha256', () => {
  const CASA = Buffer.from('UnityFS casa');
  const pins = { source: 'https://dicionario.example/BR/', signs: { CASA: { sha256: sha(CASA), bytes: CASA.length } } };

  it('🔴 [Right] from a local base: a pinned sign is written and carried, one with no pin is listed, and the licence travels', async () => {
    const destino = tmp();
    const base = tmp();
    try {
      writeFileSync(join(base, 'CASA'), CASA);
      const out = await deliverLibrasSigns({ destino, folder: 'libras/signs/', tokens: ['CASA', 'XPTO'], pins, base });
      expect(out).toEqual({ carried: [{ name: 'CASA', sha256: sha(CASA) }], unpinned: ['XPTO'] });
      expect(readFileSync(join(destino, 'libras/signs/CASA'))).toEqual(CASA);
      expect(readFileSync(join(destino, 'libras/signs/LICENSE'), 'utf8')).toMatch(/GNU GENERAL PUBLIC LICENSE\s+Version 3/);
      expect(existsSync(join(destino, 'libras/signs/XPTO')), 'a sign with no pin was fetched').toBe(false);
    } finally { rmSync(destino, { recursive: true, force: true }); rmSync(base, { recursive: true, force: true }); }
  });

  it('🔴 [Right] a sign whose bytes are not the pinned ones is REFUSED, and not written', async () => {
    const destino = tmp();
    const base = tmp();
    try {
      writeFileSync(join(base, 'CASA'), 'other bytes');
      await expect(deliverLibrasSigns({ destino, folder: 'libras/signs/', tokens: ['CASA'], pins, base })).rejects.toThrow(/REFUSED the sign CASA/);
      expect(existsSync(join(destino, 'libras/signs/CASA'))).toBe(false);
    } finally { rmSync(destino, { recursive: true, force: true }); rmSync(base, { recursive: true, force: true }); }
  });

  it('📌 [Boundary] with no base, from the pins\' source, the name encoded; nothing pinned, nothing fetched and no licence', async () => {
    const destino = tmp();
    try {
      const fetchFile = vi.fn(async () => ({ ok: true, arrayBuffer: async () => CASA }));
      await deliverLibrasSigns({ destino, folder: 's/', tokens: ['CASA'], pins, fetch: fetchFile });
      expect(fetchFile).toHaveBeenCalledWith('https://dicionario.example/BR/CASA');
      const none = vi.fn();
      expect(await deliverLibrasSigns({ destino: tmp(), folder: 's/', tokens: ['PAPELÃO'], pins: { source: '', signs: {} }, fetch: none }))
        .toEqual({ carried: [], unpinned: ['PAPELÃO'] });
      expect(none).not.toHaveBeenCalled();
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });
});

describe('the delivery\'s arguments', () => {
  it('🔴 [Right] `--libras-texts <file>` repeats, implies `--libras`, and its value is never taken for the folder', () => {
    const a = argumentosDaEntrega(['--libras-texts', 'game-pt.json', 'dist', '--libras-texts', 'more.mjs'], {});
    expect(a).toEqual(expect.objectContaining({ destino: 'dist', libras: true, librasTexts: ['game-pt.json', 'more.mjs'] }));
    expect(argumentosDaEntrega(['dist'], {}).librasTexts).toEqual([]);
  });

  it('📌 [Boundary] `--libras-setup` asks for the environment only — no folder needed', () => {
    expect(argumentosDaEntrega(['--libras-setup'], {})).toEqual(expect.objectContaining({ destino: undefined, librasSetup: true }));
    expect(argumentosDaEntrega(['dist'], {}).librasSetup).toBe(false);
  });
});

// ============================== MUTATIONS CHECKED ==============================
// (each run on `scripts/libras-glosses.mjs` unless named, and restored; the red is the case that caught it)
//   M1 the environment's existence not checked            🔴 no environment: it says so and names the ONE command
//   M2 the pinned versions not compared                   🔴 a translator, model or mode other than the pinned ones is REFUSED
//   M3 exit 3 (no spaCy model) not read                   🔴 no spaCy model, no translator, any other exit: each by name
//   M4 the placeholder words not put back as holes        🔴 each hole comes back as the hole · writes `glosses.json`
//   M5 no second pass in pieces                           🔴 a template whose placeholder the translator DROPPED
//   M6 accents kept on a token with no sign carried       🔴 a token with no sign carried loses its accents · writes `glosses.json`
//   M7 a sign's sha256 not checked                        🔴 a sign whose bytes are not the pinned ones is REFUSED
//   M8 the player's folder made before glossing           🔴 a translator that fails stops the step, and NOTHING is written
//   M9 `--no-python-downloads` dropped from the setup     🔴 setup: … it runs locked, and never downloads a Python
//   M10 hole-only strings glossed                         🎯 a string with no letter outside its holes is not glossed
//   M11 `gloss.py` asks for `neural=True`                 🔴 never the neural mode
//   M12 `--libras-texts` not skipping its value (heavy-into-the-delivery.mjs)  🔴 `--libras-texts <file>` … never taken for the folder
//   M13 a missing `uv` not said by name                   🔴 setup: no `uv` is said by name
