// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE BUILD-TIME GLOSSES (ADR-0234, route A — plan item 5b): run by `inclusionist-heavy --libras`, before the player is written.
// The player signs a GLOSS, and the text a child is shown is Portuguese; translating it needs spaCy's Portuguese parser, which
// does not run in a browser. It does not have to: that text is AUTHORED, so it is glossed here, once, on the build machine, and
// written beside the player as `glosses.json` (`ui/libras-glosses` reads it).
//
// WHICH TEXTS, and why these:
//   · THE ENGINE'S OWN PORTUGUESE DICTIONARY, all of it (`dist-pkg/i18n/pt.js`). The sonar reads what is on the screen — a
//     panel, the pause card, a notice, the navigation sentence of a world it cannot read — and which key lands where is decided
//     by the code that renders it, not by the key's name. A filter by prefix would drop a string the day a panel starts showing
//     it, silently; glossing all of it costs build time only.
//   · THE GAME'S OWN DICTIONARY, when the game's delivery names it: `--libras-texts <file>`, repeatable — a JSON object of
//     `key: "pt string"` (what the game hands `registerDict('pt', …)`), a JSON array of strings, or an ES module whose default
//     export is either. A game's text that lives in no dictionary (written straight into its page) is not glossed: the
//     interpreter hands it over by the fallback rule.
//   · NOT en or es: the translator reads Brazilian Portuguese only, and Libras is Brazil's.
// A string with `{param}` holes is glossed with each hole in place (`JOGADOR {n} ENTRAR [EXCLAMAÇÃO]`): the translator reads a
// placeholder word where each hole is, and the word is put back as the hole. The VALUE is known only at run time, and there the
// interpreter looks it up in turn, or fingerspells it (`ui/libras-glosses`). A string that is only holes is not glossed.
//
// 🔴 THE RULE-BASED MODE ONLY: `gloss.py` calls `translate(text, neural=False)`. The neural mode fetches LAViD's model, which
// declares no licence.
//
// 🔴 A DELIVERY BUILT WITH `--libras` IS NEVER WRITTEN WITHOUT ITS GLOSSES. No environment, no model, a translator of another
// version: each THROWS here, saying what is missing and the one command that sets it up, and the delivery stops. The glosser
// runs in an environment OUTSIDE the repository (`INCLUSIONIST_LIBRAS_ENV`, else `~/.cache/the-inclusionist/libras-glosses`),
// built from `libras-glosses/uv.lock` by `inclusionist-heavy --libras-setup` — which needs `uv` and Python 3.12 on this machine,
// and never downloads a Python.
//
// THE SIGNS those glosses use are delivered here too, into `libras/signs/`, but ONLY the ones pinned by sha256 in
// `libras-signs.json` (the Dev authorised the download: «Autorizo»): LAViD's dictionary repository at a pinned commit, fetched
// from there or from `--base`, and a byte that differs from the pin is REFUSED. The GPL-3.0 and a NOTICE naming the source are
// written beside them.
//
// 🔴 A WORD WITH NO SIGN IS SPELLED AS IT IS WRITTEN (ADR-0234 erratum; the Dev: «Soletra-se a palavra escrita»). The translator
// returns LEMMAS, and a token the delivery carries no sign for is fingerspelled — so «entrou» would be spelled E-N-T-R-A-R. So
// `gloss.py` also reports each text's words as written, with the forms the translator can make of each; every gloss token is
// aligned back to the word that produced it (`writtenWords`), and a token with no sign carried is replaced by THAT word, in
// capitals, its accents stripped as the player's letters require and its Ç kept, a letter of its own (`spelledWord`, the
// run-time fallback's own rule). The child sees spelled what she reads. Measured on the engine's dictionary, and printed by
// every delivery: see `spellable`.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The uv project that pins the glosser's environment (`pyproject.toml`, `uv.lock`, `gloss.py`). */
export const GLOSSER_PROJECT = fileURLToPath(new URL('./libras-glosses/', import.meta.url));

/** What the glosses are made with, checked against what the environment reports: another version is refused, not trusted. */
export const PINNED = Object.freeze({ translator: '1.3.3', model: 'pt_core_news_md', modelVersion: '3.8.0', mode: 'rules' });

/** The one command that builds the environment, as a game's delivery and this repository each run it. */
export const SETUP_COMMAND = '`npx inclusionist-heavy --libras-setup` (in this repository: `npm run libras:setup`)';

const sha256OfNode = (bytes) => createHash('sha256').update(Buffer.from(bytes)).digest('hex');

/** Where the glosser's environment lives: never inside the repository or `node_modules`. */
export function glosserEnvironment(env = process.env, home = homedir()) {
  return env.INCLUSIONIST_LIBRAS_ENV || join(home, '.cache', 'the-inclusionist', 'libras-glosses');
}

/** The environment's interpreter. */
export function glosserPython(envDir, platform = process.platform) {
  return platform === 'win32' ? join(envDir, 'Scripts', 'python.exe') : join(envDir, 'bin', 'python');
}

/**
 * Builds the environment from the lock, or THROWS saying why. `uv sync --locked` refuses a lock that drifted from the project,
 * and `--no-python-downloads` makes a missing Python 3.12 an error instead of a silent download.
 */
export function setUpGlosser({ envDir = glosserEnvironment(), run = spawnSync, project = GLOSSER_PROJECT, env = process.env } = {}) {
  const done = run('uv', ['sync', '--locked', '--no-python-downloads', '--project', project], {
    stdio: 'inherit', env: { ...env, UV_PROJECT_ENVIRONMENT: envDir },
  });
  if (done.error?.code === 'ENOENT') {
    throw new Error('the Libras glosser needs `uv`, and it is not installed on this machine: install it '
      + '(https://docs.astral.sh/uv/getting-started/installation/) and run the setup again');
  }
  if (done.error || done.status !== 0) {
    throw new Error(`uv could not build the Libras glosser's environment at ${envDir} (exit ${done.status ?? done.error?.message}): `
      + 'it needs Python 3.12 installed on this machine — uv is told never to download one — and the network once, for what '
      + 'libras-glosses/uv.lock pins');
  }
  return envDir;
}

/**
 * The translator, run once over `inputs` in the environment: returns `{ glosses, made }`, one gloss per input — or THROWS,
 * saying what is missing and how to set it up.
 */
export function runGlosser(inputs, { envDir = glosserEnvironment(), run = spawnSync, exists = existsSync,
  script = join(GLOSSER_PROJECT, 'gloss.py'), pinned = PINNED, env = process.env } = {}) {
  const python = glosserPython(envDir);
  if (!exists(python)) {
    throw new Error(`the Libras glosser's environment is missing (no ${python}): run ${SETUP_COMMAND} once — it needs uv and `
      + 'Python 3.12 — or point INCLUSIONIST_LIBRAS_ENV at one that exists');
  }
  const done = run(python, [script], {
    input: JSON.stringify({ texts: inputs }), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
    env: { ...env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });
  const said = String(done.stderr ?? '').trim().split(/\r?\n/).slice(-3).join(' · ');
  if (done.error) throw new Error(`the Libras glosser could not be started (${python}): ${done.error.message}`);
  if (done.status === 3) {
    throw new Error(`spaCy's Portuguese model ${pinned.model} is missing from the Libras glosser's environment: run `
      + `${SETUP_COMMAND} again (${said})`);
  }
  if (done.status === 4) {
    throw new Error(`the translator is missing from the Libras glosser's environment: run ${SETUP_COMMAND} again (${said})`);
  }
  if (done.status !== 0) throw new Error(`the Libras glosser failed (exit ${done.status}): ${said}`);
  let out;
  try { out = JSON.parse(done.stdout); } catch { throw new Error('the Libras glosser answered something that is not JSON'); }
  const got = `vlibras-translator ${out.translator} (${out.mode}) · ${out.model} ${out.modelVersion}`;
  if (out.translator !== pinned.translator || out.model !== pinned.model || out.modelVersion !== pinned.modelVersion
    || out.mode !== pinned.mode) {
    throw new Error(`REFUSED: the Libras glosser's environment has ${got}, and the glosses are made with vlibras-translator `
      + `${pinned.translator} (${pinned.mode}) · ${pinned.model} ${pinned.modelVersion} — run ${SETUP_COMMAND} again`);
  }
  if (!Array.isArray(out.glosses) || out.glosses.length !== inputs.length || out.glosses.some((g) => typeof g !== 'string')) {
    throw new Error(`the Libras glosser answered ${out.glosses?.length} glosses for ${inputs.length} texts`);
  }
  // without the words as written, a token with no sign would be spelled as its lemma — refused, not spelled wrong
  if (!Array.isArray(out.words) || out.words.length !== inputs.length || !out.words.every(isWordList)) {
    throw new Error(`the Libras glosser answered the written words of ${out.words?.length ?? 'no'} texts for ${inputs.length}: `
      + `run ${SETUP_COMMAND} again, or update the package`);
  }
  return { glosses: out.glosses, words: out.words, made: `${got} · spaCy ${out.spacy}` };
}

/** `[[as written, [forms…]], …]`, as `gloss.py` writes the words of one text. */
function isWordList(words) {
  return Array.isArray(words) && words.every((w) => Array.isArray(w) && typeof w[0] === 'string' && Array.isArray(w[1])
    && w[1].every((f) => typeof f === 'string'));
}

/** A hole of a template, as the engine's dictionaries write it (`core/i18n`). */
const HOLE = /\{([^{}\s]+)\}/gu;
const HAS_LETTER = /\p{L}/u;

/** The texts of one or more dictionaries (`key: string` objects or arrays), each once, with a letter outside its holes. */
export function textsToGloss(dictionaries) {
  const texts = new Set();
  for (const dict of dictionaries) {
    for (const text of Array.isArray(dict) ? dict : Object.values(dict ?? {})) {
      if (typeof text !== 'string') continue;
      const trimmed = text.trim();
      if (trimmed && HAS_LETTER.test(trimmed.replace(HOLE, ''))) texts.add(trimmed);
    }
  }
  return [...texts].sort();
}

/** The placeholder word read where hole `i` is: letters only (a digit is read as a number), and no plural `S` at the end. */
export function placeholderWord(i) {
  let letters = '';
  for (let n = i; ; n = Math.floor(n / 26) - 1) { letters = String.fromCharCode(65 + (n % 26)) + letters; if (n < 26) break; }
  return `ZPARAM${letters}Z`;
}

/** The text with each hole replaced by its placeholder word, and the holes' names in order. */
function withPlaceholders(text) {
  const names = [];
  const input = text.replace(HOLE, (_, name) => placeholderWord(names.push(name) - 1));
  return { input, names };
}

/** The gloss with each placeholder word put back as its hole — or `null` when the translator lost or doubled one. */
function withHoles(gloss, names) {
  let out = gloss;
  for (const [i, name] of names.entries()) {
    const word = placeholderWord(i);
    if (out.split(word).length !== 2) return null;
    out = out.replace(word, () => `{${name}}`);
  }
  return out;
}

/** The punctuation marks the translator writes for the player (`[PONTO]`), and a hole — neither is a sign to fetch. */
const NOT_A_SIGN = /^\[.*\]$|^\{.*\}$/u;

const tokensOf = (gloss) => gloss.split(/\s+/u).filter(Boolean);

/**
 * THE WORD AS WRITTEN behind each token of a gloss (ADR-0234, erratum «A WORD WITH NO SIGN IS SPELLED AS IT IS WRITTEN»): one
 * entry per token, `[word, how]`. `words` are the text's words as `gloss.py` reports them, each with the forms the translator's
 * rules can make of it; a token is matched to the words whose forms include it.
 *   · `one`   — the words that match all write it the same way: that word.
 *   · `order` — AMBIGUOUS, more than one written form matches (a lemma two words share): the translator's rule-based mode keeps
 *               the sentence's order, so the first unused matching word AFTER the last one taken is chosen, else the first
 *               unused, else the first.
 *   · `stem`  — no form matches, but an unused word shares all of the token but its last two letters (📏 the translator's
 *               rules re-end a word the lemmatizer does not: «mancha» → MANCHO, «névoa» → NÉVOAR, «película» → PELÍCULO): the
 *               word sharing the longest start, the first in the sentence on a tie.
 *   · `none`  — no word of the text gives this token (the translator made it: a compound, a synonym, a number it read as an
 *               hour): `word` is `null`, and the token is spelled as the translator wrote it — nothing better is known.
 * The punctuation marks and the holes are `[null, 'mark']`.
 */
export function writtenWords(gloss, words = []) {
  const used = new Set();
  let last = -1;
  const take = (j, how) => { used.add(j); last = j; return [words[j][0], how]; };
  return tokensOf(gloss).map((token) => {
    if (NOT_A_SIGN.test(token)) return [null, 'mark'];
    const key = token.normalize('NFC').toUpperCase();
    const hits = [];
    for (const [j, [word, forms]] of words.entries()) {
      if (word.normalize('NFC').toUpperCase() === key || forms.some((f) => f.normalize('NFC') === key)) hits.push(j);
    }
    if (!hits.length) {
      const stem = stemMatch(key, words, used);
      return stem === null ? [null, 'none'] : take(stem, 'stem');
    }
    const spellings = new Set(hits.map((j) => words[j][0].normalize('NFC').toLocaleLowerCase('pt-BR')));
    const j = hits.find((h) => h > last && !used.has(h)) ?? hits.find((h) => !used.has(h)) ?? hits[0];
    return take(j, spellings.size > 1 ? 'order' : 'one');
  });
}

/**
 * The unused word whose start is the longest shared with `key`, at least all of `key` but two letters and three — or `null`.
 * Only for a token with a letter: a number the translator split out («640» of «640×360») is spelled as it is.
 */
function stemMatch(key, words, used) {
  if (!/\p{L}/u.test(key)) return null;
  const floor = Math.max(3, [...key].length - 2);
  let best = null;
  let bestLength = floor - 1;
  for (const [j, [word]] of words.entries()) {
    if (used.has(j)) continue;
    const a = [...key];
    const b = [...word.normalize('NFC').toUpperCase()];
    let n = 0;
    while (n < a.length && n < b.length && a[n] === b[n]) n += 1;
    if (n > bestLength) { best = j; bestLength = n; }
  }
  return best;
}

/**
 * Glosses `texts` with `translate(inputs) → { glosses, words, made }` (sync or async): returns
 * `{ format: 1, made, glosses: [[text, gloss], …], written: [[[word, how], …], …] }` — `written` holds, per text and per gloss
 * token, the word as written (`writtenWords`), and `spellable` turns the two into the file `ui/libras-glosses` reads. A
 * template whose placeholder the translator dropped is glossed again in pieces — the fixed text between its holes — and the
 * holes put between them. A placeholder word is written as itself, so it aligns to itself, and becoming a hole keeps the tokens
 * where they were.
 */
export async function glossTexts(texts, translate) {
  const prepared = texts.map(withPlaceholders);
  const first = await translate(prepared.map((p) => p.input));
  const glosses = prepared.map((p, i) => withHoles(first.glosses[i], p.names));
  const written = prepared.map((_, i) => writtenWords(first.glosses[i], first.words?.[i]));

  const redo = texts.map((text, i) => (glosses[i] === null ? text.split(HOLE) : null));
  const pieces = redo.flatMap((parts) => (parts ? parts.filter((_, i) => i % 2 === 0) : []));
  if (pieces.length) {
    const second = await translate(pieces.map((p) => (HAS_LETTER.test(p) ? p : '')));
    let next = 0;
    for (const [i, parts] of redo.entries()) {
      if (!parts) continue;
      const glossed = parts.map((part, j) => {
        if (j % 2) return { gloss: `{${part}}`, written: [[null, 'mark']] };
        const n = next++;
        return { gloss: second.glosses[n], written: writtenWords(second.glosses[n], second.words?.[n]) };
      });
      glosses[i] = glossed.map((g) => g.gloss).join(' ').replace(/\s+/gu, ' ').trim();
      written[i] = glossed.flatMap((g) => g.written);
    }
  }
  return { format: 1, made: first.made, glosses: texts.map((text, i) => [text, glosses[i]]), written };
}

/** The distinct tokens the glosses ask the player to sign, sorted. */
export function glossTokens(file) {
  const tokens = new Set();
  for (const [, gloss] of file.glosses) {
    for (const token of gloss.split(/\s+/u)) if (token && !NOT_A_SIGN.test(token)) tokens.add(token);
  }
  return [...tokens].sort();
}

/**
 * A word as the player fingerspells it — the run-time fallback's rule (`ui/libras-glosses` `provisionalGloss`), so a word is
 * spelled the same whether the build or the run time spelled it: capitals, and every mark stripped but Ç's. The player has no
 * clip for an accented vowel (📏 `Ã` measured: «Clip Ã não foi encontrado»), so it is spelled as its base letter (Ã → A,
 * É → E); Ç is a letter of the Libras manual alphabet, with its own handshape and movement, and both routes carry it (📏 route
 * A spells «CAÇA» C-A-Ç-A from its own clip), so it stays Ç: the marks are stripped from each run with no Ç in it. Anything
 * that is not a letter or a digit separates.
 */
export function spelledWord(word) {
  return word.normalize('NFC').replace(/[^Çç]+/gu, (run) => run.normalize('NFD').replace(/\p{M}+/gu, '')).toUpperCase()
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ');
}

/**
 * The glosses as the player can sign them from THIS delivery, and how their spelled tokens were found: a carried sign, a
 * punctuation mark and a hole stay as they are; any other token is FINGERSPELLED, and what is spelled is the word as WRITTEN on
 * the screen (`written`, from `glossTexts`) — «entrou», not the translator's lemma «ENTRAR» (the Dev: «Soletra-se a palavra
 * escrita») — or the token itself where no written word gave it. Returns the file `ui/libras-glosses` reads (`[text, gloss]`
 * pairs, nothing else) and `spelled`: `{ tokens, asWritten, ambiguous, byStem, asTranslated }` over the spelled tokens (`ambiguous`
 * and `byStem` are among `asWritten`; see `writtenWords`).
 */
export function spellable(file, carried) {
  const spelled = { tokens: 0, asWritten: 0, ambiguous: 0, byStem: 0, asTranslated: 0 };
  const glosses = file.glosses.map(([text, gloss], i) => {
    const tokens = tokensOf(gloss);
    const written = file.written?.[i]?.length === tokens.length ? file.written[i] : [];
    return [text, tokens.map((token, k) => {
      if (NOT_A_SIGN.test(token) || carried.has(token)) return token;
      const [word, how] = written[k] ?? [null, 'none'];
      spelled.tokens += 1;
      if (word === null) { spelled.asTranslated += 1; return spelledWord(token); }
      spelled.asWritten += 1;
      if (how === 'order') spelled.ambiguous += 1;
      if (how === 'stem') spelled.byStem += 1;
      return spelledWord(word);
    }).filter(Boolean).join(' ')];
  });
  return { file: { format: file.format, made: file.made, glosses }, spelled };
}

/**
 * The sign pins: `{ commit, source, signs: { NAME: { sha256, bytes } } }` — `source` is the dictionary repository's folder at
 * `commit`, and a sign's address is `source` + its name, encoded.
 */
export function readSignPins(path = fileURLToPath(new URL('./libras-signs.json', import.meta.url))) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const GPL_3 = new URL('./licences/GPL-3.0.txt', import.meta.url);

/**
 * Where the signs are read from: the pins' `source` upstream, or — with a delivery's `--base` (an address or a folder) — the
 * folder `pins.mirror` names under it, laid out as `platform/heavy-mirror` lays out the other heavy files (the short commit in
 * the folder's name). Pins with no `mirror` are read from the base itself.
 */
export function signsSourceOf(pins, base = '') {
  if (!base) return pins.source;
  return pins.mirror ? `${base.replace(/[/\\]+$/, '')}/${pins.mirror}` : base;
}

/**
 * Puts into `<destino>/<folder>` the sign of every token that has a pin, checked by sha256 — from `base` (see `signsSourceOf`)
 * when one is given, else from the pins' `source`. Returns `{ carried: [{ name, sha256 }], unpinned: [names] }`.
 * THROWS on a sign whose bytes are not the pinned ones: nothing unchecked reaches a delivery.
 */
export async function deliverLibrasSigns({ destino, folder, tokens, pins, base = '', fetch: fetchFile = fetch,
  read = (p) => readFileSync(p), sha256 = sha256OfNode }) {
  const carried = [];
  const unpinned = [];
  const from = signsSourceOf(pins, base);
  for (const name of tokens) {
    const pin = pins.signs?.[name];
    if (!pin) { unpinned.push(name); continue; }
    const target = join(destino, folder, name);
    if (existsSync(target) && sha256(readFileSync(target)) === pin.sha256) { carried.push({ name, sha256: pin.sha256 }); continue; }
    let bytes;
    if (/^https?:\/\//i.test(from)) {
      const address = `${from.replace(/\/?$/, '/')}${encodeURIComponent(name)}`;
      const resp = await fetchFile(address);
      if (!resp.ok) throw new Error(`the sign ${name} could not be fetched: HTTP ${resp.status} — ${address}`);
      bytes = Buffer.from(await resp.arrayBuffer());
    } else {
      bytes = read(join(from, name));
    }
    const got = sha256(bytes);
    if (got !== pin.sha256) {
      throw new Error(`REFUSED the sign ${name}: sha256 ${got}, pinned ${pin.sha256} — not written`);
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    carried.push({ name, sha256: got });
  }
  if (carried.length) {
    writeFileSync(join(destino, folder, 'LICENSE'), readFileSync(GPL_3));
    writeFileSync(join(destino, folder, 'NOTICE'), 'The sign bundles in this folder are LAViD-UFPB\'s VLibras dictionary '
      + `(vlibras-dictionary-sources, GPL-3.0), unchanged: each file is the one at ${pins.source}<NAME>, checked by sha256; their `
      + 'sources are the .blend files of the same repository, '
      + `https://gitlab.lavid.ufpb.br/vlibras-public/vlibras-dictionary/vlibras-dictionary-sources${pins.commit ? ` (commit ${pins.commit})` : ''}\n`);
  }
  return { carried, unpinned };
}

/** Reads one `--libras-texts` file: JSON (object or array), or an ES module whose default export is one. */
export async function readTexts(path) {
  if (/\.(m?js)$/i.test(path)) return (await import(pathToFileURL(path).href)).default;
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * THE STEP `--libras` RUNS: glosses the dictionaries, delivers the pinned signs they use, and writes `glosses.json` into the
 * player's folder, every token with no sign carried spelled as written (`spellable`). Returns what the player needs (`signs`,
 * for its sign-set revision) and what the build prints (`spelled`: how the spelled tokens were found). THROWS — and
 * writes nothing — when the glosses cannot be made.
 */
export async function deliverLibrasGlosses({ destino, playerFolder, signsFolder, glossesFile, dictionaries, translate,
  pins = { source: '', signs: {} }, base = '', fetch: fetchFile, read }) {
  const texts = textsToGloss(dictionaries);
  if (!texts.length) throw new Error('there is no text to gloss: the engine\'s Portuguese dictionary was not found');
  const file = await glossTexts(texts, translate);
  const tokens = glossTokens(file);
  const { carried, unpinned } = await deliverLibrasSigns({
    destino, folder: signsFolder, tokens, pins, base, ...(fetchFile ? { fetch: fetchFile } : {}), ...(read ? { read } : {}),
  });
  const path = `${playerFolder}${glossesFile}`;
  mkdirSync(dirname(join(destino, path)), { recursive: true });
  const { file: playable, spelled } = spellable(file, new Set(carried.map((s) => s.name)));
  writeFileSync(join(destino, path), `${JSON.stringify(playable, null, 1)}\n`);
  return { path, texts: texts.length, tokens: tokens.length, signs: carried, unpinned, spelled };
}
