// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BUILD-TIME GLOSSES (ADR-0234, route A — plan item 5b; `scripts/libras-glosses.mjs`), with a FAKE translator: no Python runs
// here. What is held: which texts are glossed (the engine's and the game's Portuguese, each once, holes kept), that a hole comes
// back as a hole even when the translator drops its placeholder, that the written glosses are what the player can sign from THIS
// delivery (a token with no sign spelled as the word is WRITTEN on the screen, not as the translator's lemma), that the pinned
// signs are checked by sha256, and — the reason the step exists as a step — that a delivery with `--libras` is NEVER written
// without its glosses: no environment, no model, another translator, each stops it by name.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import {
  textsToGloss, glossTexts, glossTokens, spellable, placeholderWord, runGlosser, setUpGlosser, deliverLibrasGlosses,
  deliverLibrasSigns, signsSourceOf, glosserEnvironment, glosserPython, readSignPins, PINNED, GLOSSER_PROJECT, writtenWords,
  spelledWord,
} from '../scripts/libras-glosses.mjs';
import { provisionalGloss } from '../app/js/ui/libras-glosses.ts';
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
    expect({ ...file, written: undefined }).toEqual({ format: 1, made: MADE, written: undefined, glosses: [
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
    expect(spellable(file, new Set(['PAPELÃO'])).file.glosses)
      .toEqual([['a', 'VOCE SOLTAR {o} [EXCLAMAÇÃO]'], ['b', 'PAPELÃO CAIXA']]);
  });
});

describe('a word with no sign is spelled AS IT IS WRITTEN (ADR-0234 erratum; the Dev: «Soletra-se a palavra escrita»)', () => {
  /**
   * A translator double that answers as `gloss.py` does: the gloss it is given for each input, and the input's words, each with
   * the forms named for it — the real translator returns LEMMAS, and the written word is only recoverable through these.
   */
  const translator = (answers) => (inputs) => ({
    made: MADE,
    glosses: inputs.map((i) => answers[i]?.gloss ?? ''),
    words: inputs.map((i) => answers[i]?.words ?? []),
  });
  const ENTROU = {
    'Jogador ZPARAMAZ entrou!': { gloss: 'JOGADOR ZPARAMAZ ENTRAR [EXCLAMAÇÃO]',
      words: [['Jogador', ['JOGADOR', 'JOGAR']], ['ZPARAMAZ', ['ZPARAMAZ']], ['entrou', ['ENTRAR', 'ENTROU']]] },
  };

  it('🔴 [Right] «entrou» is spelled ENTROU, not the lemma ENTRAR; a carried sign, the hole and the mark stay', async () => {
    const file = await glossTexts(['Jogador {n} entrou!'], translator(ENTROU));
    const { file: playable, spelled } = spellable(file, new Set(['JOGADOR']));
    expect(playable.glosses, 'the player was handed the lemma to spell').toEqual([['Jogador {n} entrou!', 'JOGADOR {n} ENTROU [EXCLAMAÇÃO]']]);
    expect(spelled).toEqual({ tokens: 1, asWritten: 1, ambiguous: 0, byStem: 0, asTranslated: 0 });
  });

  it('🔴 [Right] the whole step writes the written word into `glosses.json`', async () => {
    const destino = tmp();
    try {
      const pins = { source: '', signs: {} };
      await deliverLibrasGlosses({ destino, playerFolder: 'p/', signsFolder: 's/', glossesFile: 'g.json',
        dictionaries: [{ k: 'Jogador {n} entrou!' }], translate: translator(ENTROU), pins });
      expect(JSON.parse(readFileSync(join(destino, 'p/g.json'), 'utf8')).glosses)
        .toEqual([['Jogador {n} entrou!', 'JOGADOR {n} ENTROU [EXCLAMAÇÃO]']]);
    } finally { rmSync(destino, { recursive: true, force: true }); }
  });

  it('📌 [Boundary] an accented vowel is spelled as its base letter, Ç as Ç — the run time\'s own rule, word for word', async () => {
    const file = await glossTexts(['Atenção, você já é campeã'], translator({ 'Atenção, você já é campeã': {
      gloss: 'ATENÇÃO VOCÊ JÁ SER CAMPEÃO',
      words: [['Atenção', ['ATENÇÃO']], ['você', ['VOCÊ']], ['já', ['JÁ']], ['é', ['SER', 'É']], ['campeã', ['CAMPEÃ', 'CAMPEÃO']]] } }));
    expect(spellable(file, new Set(['VOCÊ'])).file.glosses[0][1]).toBe('ATENÇAO VOCÊ JA E CAMPEA');
    expect(spelledWord('ÁÉÍÓÚÂÊÔÃÕÜàèìòù'), 'an accented vowel kept its mark: the player has no clip for it').toBe('AEIOUAEOAOUAEIOU');
    for (const word of ['Atenção', 'campeã', 'Ç', 'ç', 'caça', 'espaço', 'ça', 'pôr-do-sol', 'd\'água', 'ÁÉÍÓÚÂÊÔÃÕÜ']) {
      expect(spelledWord(word), word).toBe(provisionalGloss(word));
    }
  });

  it('🔴 [Right] ROUTE A — «caça» and «espaço» with no sign carried are spelled CAÇA and ESPAÇO: Ç is a letter the player signs', async () => {
    const text = 'A caça no espaço';
    const file = await glossTexts([text], translator({ [text]: {
      gloss: 'CAÇAR ESPAÇO', words: [['A', ['A', 'O']], ['caça', ['CAÇA', 'CAÇAR']], ['no', ['NO', 'EM']], ['espaço', ['ESPAÇO']]] } }));
    expect(spellable(file, new Set()).file.glosses[0][1], 'the build spelled Ç as C').toBe('CAÇA ESPAÇO');
    expect(spelledWord('caça'), 'the build spelled Ç as C').toBe('CAÇA');
    expect(spelledWord('Espaço'), 'the build spelled Ç as C').toBe('ESPAÇO');
  });

  it('🔴 [Right] AMBIGUOUS — two words share the lemma: the next one in the sentence\'s order is taken', () => {
    const words = [['entrou', ['ENTRAR']], ['saiu', ['SAIR']], ['entra', ['ENTRAR']]];
    expect(writtenWords('SAIR ENTRAR', words)).toEqual([['saiu', 'one'], ['entra', 'order']]);
    expect(writtenWords('ENTRAR SAIR ENTRAR', words)).toEqual([['entrou', 'order'], ['saiu', 'one'], ['entra', 'order']]);
  });

  it('🔴 [Right] a token the rules re-ended (MANCHO of «mancha») is spelled from the word it starts like; a number is not', () => {
    expect(writtenWords('MANCHO', [['mancha', ['MANCHA', 'MANCHAR']]])).toEqual([['mancha', 'stem']]);
    expect(writtenWords('MANCHO', [['manhã', ['MANHÃ']]]), 'a word two letters away is not the same word').toEqual([[null, 'none']]);
    expect(writtenWords('640', [['640×360', ['640×360']]]), 'a number was matched by its start').toEqual([[null, 'none']]);
  });

  it('🎯 [Zero] a token no written word gives is spelled as the translator wrote it, and counted', async () => {
    const file = await glossTexts(['Três por um'], translator({ 'Três por um': { gloss: 'HORA1', words: [['Três', ['TRÊS']], ['por', ['POR']], ['um', ['UM']]] } }));
    expect(spellable(file, new Set()).file.glosses[0][1]).toBe('HORA1');
    expect(spellable(file, new Set()).spelled).toEqual({ tokens: 1, asWritten: 0, ambiguous: 0, byStem: 0, asTranslated: 1 });
  });

  it('🔴 [Right] a template glossed again in PIECES keeps each token beside its written word', async () => {
    const answers = {
      'Você soltou: ZPARAMAZ.': { gloss: 'VOCÊ SOLTAR [PONTO]', words: [] }, // the placeholder dropped: glossed again in pieces
      'Você soltou: ': { gloss: 'VOCÊ SOLTAR', words: [['Você', ['VOCÊ']], ['soltou', ['SOLTAR', 'SOLTOU']]] },
    };
    const file = await glossTexts(['Você soltou: {o}.'], translator(answers));
    expect(spellable(file, new Set(['VOCÊ'])).file.glosses[0][1]).toBe('VOCÊ SOLTOU {o}');
  });

  it('🔴 [Right] the glosser\'s answer without the written words is REFUSED — the lemma would be spelled instead', () => {
    const good = { translator: '1.3.3', spacy: '3.8.16', model: 'pt_core_news_md', modelVersion: '3.8.0', mode: 'rules', glosses: ['X'] };
    const run = (out) => () => ({ status: 0, stdout: JSON.stringify(out), stderr: '' });
    const opts = (out) => ({ envDir: 'ENV', run: run(out), exists: () => true });
    expect(() => runGlosser(['x'], opts(good))).toThrow(/written words of no texts for 1/);
    expect(() => runGlosser(['x'], opts({ ...good, words: [[['x', 'X']]] }))).toThrow(/written words/);
    expect(runGlosser(['x'], opts({ ...good, words: [[['x', ['X']]]] })).words).toEqual([[['x', ['X']]]]);
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
      expect(made).toEqual({ path: 'libras/player/glosses.json', texts: 2, tokens: 3, signs: [], unpinned: ['MARIA', 'OLÁ,', 'PONTOS:'],
        spelled: { tokens: 3, asWritten: 0, ambiguous: 0, byStem: 0, asTranslated: 3 } });
      const written = JSON.parse(readFileSync(join(destino, 'libras/player/glosses.json'), 'utf8'));
      expect(written, 'the file carries anything but the pairs the run time reads')
        .toEqual({ format: 1, made: MADE, glosses: [['Olá, Maria.', 'OLA MARIA [PONTO]'], ['Pontos: {n}', 'PONTOS {n}']] });
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
      expect(() => runGlosser(['x'], opts(answer({ ...good, ...other, glosses: ['X'], words: [[]] }))), JSON.stringify(other)).toThrow(/REFUSED/);
    }
  });

  it('📌 [Boundary] an answer with a gloss short, or not JSON, is refused', () => {
    expect(() => runGlosser(['x', 'y'], opts(answer({ ...good, glosses: ['X'], words: [[]] })))).toThrow(/1 glosses for 2 texts/);
    expect(() => runGlosser(['x'], opts(() => ({ status: 0, stdout: 'Warning: …', stderr: '' })))).toThrow(/not JSON/);
  });

  it('🔴 [Right] a good answer: one gloss per text, and what made them — the texts handed over as JSON on stdin', () => {
    const WORDS = [[['Olhe', ['OLHAR', 'OLHE']], ['aqui', ['AQUI']]]];
    const run = vi.fn(answer({ ...good, glosses: ['OLHE AQUI'], words: WORDS }));
    expect(runGlosser(['Olhe aqui'], opts(run))).toEqual({ glosses: ['OLHE AQUI'], words: WORDS, made: MADE });
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

  it('🔴 [Right] the signs are pinned at a COMMIT of LAViD\'s dictionary, WebGL 2018.3.1, each by sha256 and byte count', () => {
    const pins = readSignPins();
    const at = /^https:\/\/gitlab\.lavid\.ufpb\.br\/vlibras-public\/vlibras-dictionary\/vlibras-dictionary-sources\/-\/raw\/([0-9a-f]{40})\/FILES\/BUNDLES\/2018\.3\.1\/WEBGL\/BR\/$/
      .exec(pins.source);
    expect(at, `the source is not the dictionary at a pinned commit: ${pins.source}`).not.toBeNull();
    expect(at[1], 'the source and the commit it names disagree').toBe(pins.commit);
    const signs = Object.entries(pins.signs);
    expect(signs.length, 'the Dev authorised the signs the engine\'s glosses use; none is pinned').toBeGreaterThan(0);
    for (const [name, pin] of signs) {
      expect(pin.sha256, name).toMatch(/^[0-9a-f]{64}$/);
      expect(Number.isInteger(pin.bytes) && pin.bytes > 0, name).toBe(true);
    }
  });
});

describe('the signs, pinned by sha256', () => {
  const CASA = Buffer.from('UnityFS casa');
  const pins = { commit: 'c0ffee', source: 'https://dicionario.example/BR/', signs: { CASA: { sha256: sha(CASA), bytes: CASA.length } } };

  it('🔴 [Right] from a local base: a pinned sign is written and carried, one with no pin is listed, and the licence travels', async () => {
    const destino = tmp();
    const base = tmp();
    try {
      writeFileSync(join(base, 'CASA'), CASA);
      const out = await deliverLibrasSigns({ destino, folder: 'libras/signs/', tokens: ['CASA', 'XPTO'], pins, base });
      expect(out).toEqual({ carried: [{ name: 'CASA', sha256: sha(CASA) }], unpinned: ['XPTO'] });
      expect(readFileSync(join(destino, 'libras/signs/CASA'))).toEqual(CASA);
      expect(readFileSync(join(destino, 'libras/signs/LICENSE'), 'utf8')).toMatch(/GNU GENERAL PUBLIC LICENSE\s+Version 3/);
      expect(readFileSync(join(destino, 'libras/signs/NOTICE'), 'utf8'), 'the NOTICE does not say where the signs came from')
        .toMatch(/LAViD-UFPB.*GPL-3\.0.*https:\/\/dicionario\.example\/BR\/<NAME>.*commit c0ffee/s);
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

  it('🔴 [Right] with the delivery\'s `--base`, the signs are read from the pins\' `mirror` folder under it, never upstream', async () => {
    const destino = tmp();
    const base = tmp();
    try {
      mkdirSync(join(base, 'dict-c0ffee', 'BR'), { recursive: true });
      writeFileSync(join(base, 'dict-c0ffee', 'BR', 'CASA'), CASA);
      const upstream = vi.fn();
      const out = await deliverLibrasSigns({ destino, folder: 's/', tokens: ['CASA'], pins: { ...pins, mirror: 'dict-c0ffee/BR/' },
        base: `${base}/`, fetch: upstream });
      expect(out.carried).toEqual([{ name: 'CASA', sha256: sha(CASA) }]);
      expect(upstream).not.toHaveBeenCalled();
      expect(signsSourceOf({ ...pins, mirror: 'dict-c0ffee/BR/' }, 'https://mirror.example/')).toBe('https://mirror.example/dict-c0ffee/BR/');
      expect(signsSourceOf(pins, '')).toBe(pins.source);
    } finally { rmSync(destino, { recursive: true, force: true }); rmSync(base, { recursive: true, force: true }); }
  });

  it('📌 [Boundary] the real pins\' mirror folder carries the short commit, as the other mirrored heavy files do', () => {
    const real = readSignPins();
    expect(real.mirror).toBe(`vlibras-dictionary-sources-${real.commit.slice(0, 7)}/FILES/BUNDLES/2018.3.1/WEBGL/BR/`);
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
//   M14 `libras-signs.json` source on a branch (`/-/raw/main/`)  🔴 the signs are pinned at a COMMIT of LAViD's dictionary
//   M15 the NOTICE without the pinned source              🔴 from a local base: … the licence travels
//   M16 `--base` read as the signs' folder, `mirror` ignored   🔴 with the delivery's `--base`, … the pins' `mirror` folder
//   M17 `spellable` spells the token (the lemma), not the written word   🔴 «entrou» is spelled ENTROU · the whole step writes the
//       written word · an accented letter … word for word · a template glossed again in PIECES
//   M18 an ambiguous token takes the first match, not the next in order  🔴 AMBIGUOUS — two words share the lemma
//   M19 no match by the word's start                      🔴 a token the rules re-ended (MANCHO of «mancha»)
//   M20 a number matched by its start                     🔴 … a number is not
//   M21 the pieces of a re-glossed template keep the first pass's alignment  🔴 a template glossed again in PIECES
//   M22 the glosser's answer accepted without `words`     🔴 the glosser's answer without the written words is REFUSED
//   M23 `spelledWord` keeps the accents                   🔴 an accented vowel is spelled as its base letter, Ç as Ç · loses its
//       accents · writes `glosses.json` (2026-09-25, re-run scripted after Ç: restored from a copy, checked by sha256)
//   M24 `spelledWord` strips Ç's cedilla (the old rule)   🔴 ROUTE A — «caça» and «espaço» … spelled CAÇA and ESPAÇO · … Ç as Ç
//       (the agreement with `provisionalGloss`)
