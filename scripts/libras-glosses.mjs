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
// `libras-signs.json` — none yet: fetching LAViD's sign bundles waits for the Dev. A token with no pinned sign is fingerspelled by
// the player, so its accents are stripped in the written glosses (the player has no clip for an accented letter).

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
  return { glosses: out.glosses, made: `${got} · spaCy ${out.spacy}` };
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

/**
 * Glosses `texts` with `translate(inputs) → { glosses, made }` (sync or async): returns the file `ui/libras-glosses` reads,
 * `{ format: 1, made, glosses: [[text, gloss], …] }`. A template whose placeholder the translator dropped is glossed again in
 * pieces — the fixed text between its holes — and the holes put between them.
 */
export async function glossTexts(texts, translate) {
  const prepared = texts.map(withPlaceholders);
  const first = await translate(prepared.map((p) => p.input));
  const glosses = prepared.map((p, i) => withHoles(first.glosses[i], p.names));

  const redo = texts.map((text, i) => (glosses[i] === null ? text.split(HOLE) : null));
  const pieces = redo.flatMap((parts) => (parts ? parts.filter((_, i) => i % 2 === 0) : []));
  if (pieces.length) {
    const second = await translate(pieces.map((p) => (HAS_LETTER.test(p) ? p : '')));
    let next = 0;
    for (const [i, parts] of redo.entries()) {
      if (!parts) continue;
      glosses[i] = parts.map((part, j) => (j % 2 ? `{${part}}` : second.glosses[next++])).join(' ').replace(/\s+/gu, ' ').trim();
    }
  }
  return { format: 1, made: first.made, glosses: texts.map((text, i) => [text, glosses[i]]) };
}

/** The punctuation marks the translator writes for the player (`[PONTO]`), and a hole — neither is a sign to fetch. */
const NOT_A_SIGN = /^\[.*\]$|^\{.*\}$/u;

/** The distinct tokens the glosses ask the player to sign, sorted. */
export function glossTokens(file) {
  const tokens = new Set();
  for (const [, gloss] of file.glosses) {
    for (const token of gloss.split(/\s+/u)) if (token && !NOT_A_SIGN.test(token)) tokens.add(token);
  }
  return [...tokens].sort();
}

/**
 * The glosses as the player can sign them from THIS delivery: a token with no sign carried is fingerspelled, and its accents
 * are stripped, because the player has no clip for an accented letter.
 */
export function spellable(file, carried) {
  const spell = (token) => (NOT_A_SIGN.test(token) || carried.has(token) ? token : token.normalize('NFD').replace(/\p{M}+/gu, ''));
  return { ...file, glosses: file.glosses.map(([text, gloss]) => [text, gloss.split(/\s+/u).filter(Boolean).map(spell).join(' ')]) };
}

/** The sign pins: `{ source, signs: { NAME: { sha256, bytes } } }`. None yet — see the header. */
export function readSignPins(path = fileURLToPath(new URL('./libras-signs.json', import.meta.url))) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const GPL_3 = new URL('./licences/GPL-3.0.txt', import.meta.url);

/**
 * Puts into `<destino>/<folder>` the sign of every token that has a pin, checked by sha256 — from `base` (an address or a
 * folder) when one is given, else from the pins' `source`. Returns `{ carried: [{ name, sha256 }], unpinned: [names] }`.
 * THROWS on a sign whose bytes are not the pinned ones: nothing unchecked reaches a delivery.
 */
export async function deliverLibrasSigns({ destino, folder, tokens, pins, base = '', fetch: fetchFile = fetch,
  read = (p) => readFileSync(p), sha256 = sha256OfNode }) {
  const carried = [];
  const unpinned = [];
  for (const name of tokens) {
    const pin = pins.signs?.[name];
    if (!pin) { unpinned.push(name); continue; }
    const target = join(destino, folder, name);
    if (existsSync(target) && sha256(readFileSync(target)) === pin.sha256) { carried.push({ name, sha256: pin.sha256 }); continue; }
    const from = base || pins.source;
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
      + `(vlibras-dictionary-sources, GPL-3.0), obtained unchanged from ${pins.source}; their sources are the .blend files of `
      + 'https://gitlab.lavid.ufpb.br/vlibras-public/vlibras-dictionary/vlibras-dictionary-sources\n');
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
 * player's folder. Returns what the player needs (`signs`, for its sign-set revision) and what the build prints. THROWS — and
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
  writeFileSync(join(destino, path), `${JSON.stringify(spellable(file, new Set(carried.map((s) => s.name))), null, 1)}\n`);
  return { path, texts: texts.length, tokens: tokens.length, signs: carried, unpinned };
}
