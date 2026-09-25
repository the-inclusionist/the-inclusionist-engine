// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/libras-glosses — WHAT THE INTERPRETER HANDS THE PLAYER: the Libras gloss of the text the sonar found (ADR-0234, route A,
// plan item 5b).
//
// The player signs a GLOSS — Libras word order, in sign names — and the sonar finds Portuguese. Translating needs spaCy's full
// Portuguese parser, which does not run in a browser, and it does not have to: the text a child can be shown is AUTHORED, so the
// delivery glosses it once, at build time, with LAViD's rule-based `vlibras-translator` (`scripts/libras-glosses.mjs`, run by
// `inclusionist-heavy --libras`), and writes `glosses.json` beside the player's page. At run time nothing is translated: the
// text is LOOKED UP here.
//
// WHAT IS IN THE FILE: the engine's own Portuguese dictionary, and the game's when its delivery names it (`--libras-texts`).
// A string with `{param}` holes is kept as a TEMPLATE, glossed with its holes in place (`JOGADOR {n} ENTRAR [EXCLAMAÇÃO]`),
// because the value arrives only at run time: here the value is looked up in turn, and a value with no gloss of its own — a
// number, a name — is handed over by today's rule below, which the player fingerspells letter by letter.
//
// HOW A SCREEN IS LOOKED UP: the sonar reads the screen as sentences (`ui/screen-text`, one per line, joined), so the text is
// cut at sentence ends and, from the first sentence on, the LONGEST run of sentences that is a known text or matches a template
// is taken — a dictionary string may itself hold two sentences, or a colon the reader cut at. A sentence nothing matches falls
// back to today's rule, alone; the rest of the screen keeps its glosses.
//
// 📌 TODAY'S RULE (`provisionalGloss`), which stays the fallback: the words in capitals with the accents stripped, anything that
// is not a letter or a digit a separator. Not a gloss — the player fingerspells it — and the accents go because the player has
// no clip for an accented letter (📏 `Ã` measured: «Clip Ã não foi encontrado»).
//
// It reaches no global: the file comes through the fetch the interpreter was given (ADR-0232).

/** The file the delivery writes beside the player's page (`LIBRAS_PLAYER_FOLDER`), read by the interpreter. */
export const LIBRAS_GLOSSES_FILE = 'glosses.json';

/** The file's shape. `glosses` holds `[text, gloss]` pairs; a text with `{name}` holes is a template, its gloss has them too. */
export interface GlossFile {
  readonly format: 1;
  /** What made the glosses, e.g. `vlibras-translator 1.3.3 (rules) · pt_core_news_md 3.8.0`. For whoever reads the file. */
  readonly made: string;
  readonly glosses: readonly (readonly [text: string, gloss: string])[];
}

/** The text a player is handed for a text on screen. */
export type Glosser = (text: string) => string;

/**
 * The text as the player is handed it where no gloss is known: its words in capitals, accents stripped, anything that is not a
 * letter or a digit a separator. Not a gloss — see the header.
 */
export function provisionalGloss(text: string): string {
  return text.normalize('NFD').replace(/\p{M}+/gu, '').toUpperCase()
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean).join(' ');
}

/** Where the sonar's text is cut: after a sentence's end, before the next. */
const SENTENCE_END = /(?<=[.!?…:;])\s+/u;
/** A hole of a template (`split` and `replace` read the capture; `HAS_HOLE` only asks). */
const HOLE = /\{([^{}\s]+)\}/gu;
const HAS_HOLE = /\{[^{}\s]+\}/u;
const NUMBERED_HOLE = /\{\d+\}/gu;
/**
 * What a hole matches: any run of characters that does not cross a sentence's end — a template that starts or ends with a hole
 * would otherwise swallow the sentences around it when a longer run is tried.
 */
const VALUE = String.raw`((?:(?![.!?…:;]\s).)+?)`;
/** What the edges of a text may carry that does not change it: punctuation, an icon, a space. */
const EDGES = /^[^\p{L}\p{N}{}]+|[^\p{L}\p{N}{}]+$/gu;

/** The same text, however the screen wrote it: one space, no punctuation or icon at the edges, lower case. */
function keyOf(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').replace(EDGES, '').toLocaleLowerCase('pt-BR');
}

const sentencesOf = (text: string): string[] => text.split(SENTENCE_END).filter((s) => s.trim() !== '');

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Template {
  readonly pattern: RegExp;
  readonly names: readonly string[];
  readonly gloss: string;
  /** How much of it is fixed text: the most specific template is tried first. */
  readonly fixed: number;
}

/** A template's text as a pattern over keys: its fixed parts as keys are, each hole a `VALUE`. */
function templateOf(text: string, gloss: string): Template | null {
  const names: string[] = [];
  const parts = text.split(HOLE); // even indices are fixed text, odd ones hole names
  for (let i = 1; i < parts.length; i += 2) names.push(parts[i]!);
  // each hole becomes `{0}`, `{1}`…: braces survive `keyOf`, and a name's capitals would not
  const marked = parts.map((p, i) => (i % 2 ? `{${(i - 1) / 2}}` : p)).join('');
  const key = keyOf(marked);
  const fixed = key.replace(NUMBERED_HOLE, '');
  if (!/[\p{L}\p{N}]/u.test(fixed)) return null; // all holes: it would match anything
  const source = key.split(NUMBERED_HOLE).map(escapeRegExp).join(VALUE);
  return { pattern: new RegExp(`^${source}$`, 'u'), names, gloss, fixed: fixed.length };
}

/** Is this a file the delivery wrote? Anything else is read as no file at all. */
function isGlossFile(data: unknown): data is GlossFile {
  const file = data as Partial<GlossFile> | null;
  return !!file && file.format === 1 && Array.isArray(file.glosses)
    && file.glosses.every((g) => Array.isArray(g) && typeof g[0] === 'string' && typeof g[1] === 'string');
}

/**
 * The glosser over a delivered file: known texts and templates first, today's rule for what neither covers. A file that is not
 * the delivery's (`null`, a fallback page, another format) glosses nothing, and every text gets today's rule.
 */
export function glosserOf(data: unknown): Glosser {
  const exact = new Map<string, string>();
  const templates: Template[] = [];
  let longest = 1;
  if (isGlossFile(data)) {
    for (const [text, gloss] of data.glosses) {
      if (!gloss.trim()) continue;
      if (HAS_HOLE.test(text)) {
        const template = templateOf(text, gloss);
        if (template) templates.push(template);
      } else {
        const key = keyOf(text);
        if (key && !exact.has(key)) exact.set(key, gloss);
      }
      longest = Math.max(longest, sentencesOf(text).length);
    }
    templates.sort((a, b) => b.fixed - a.fixed);
  }

  /** A value put into a template's hole: its own gloss when it is a known text, else today's rule. */
  const valueGloss = (value: string): string => exact.get(keyOf(value)) ?? provisionalGloss(value);

  const lookUp = (piece: string): string | null => {
    const key = keyOf(piece);
    if (!key) return null;
    const known = exact.get(key);
    if (known !== undefined) return known;
    for (const t of templates) {
      const m = t.pattern.exec(key);
      if (!m) continue;
      const values = new Map(t.names.map((name, i) => [name, valueGloss(m[i + 1]!)]));
      return t.gloss.replace(HOLE, (_, name: string) => values.get(name) ?? '').replace(/\s+/gu, ' ').trim();
    }
    return null;
  };

  return (text) => {
    const sentences = sentencesOf(text);
    const out: string[] = [];
    for (let i = 0; i < sentences.length;) {
      let taken = 0;
      for (let span = Math.min(longest, sentences.length - i); span >= 1 && !taken; span--) {
        const gloss = lookUp(sentences.slice(i, i + span).join(' '));
        if (gloss !== null) { if (gloss) out.push(gloss); taken = span; }
      }
      if (!taken) {
        const spelled = provisionalGloss(sentences[i]!);
        if (spelled) out.push(spelled);
        taken = 1;
      }
      i += taken;
    }
    return out.join(' ');
  };
}

/**
 * The glosser of the delivery the page came from: `glosses.json` read through `fetchFile`, or — no fetch, no file, not the
 * delivery's — today's rule for every text. Never rejects: a missing file costs the glosses, not the signing.
 */
export async function loadGlosser(fetchFile: ((url: string) => Promise<Response>) | undefined, url: string): Promise<Glosser> {
  if (!fetchFile) return glosserOf(null);
  try {
    const resp = await fetchFile(url);
    return glosserOf(resp.ok ? await resp.json() : null);
  } catch {
    return glosserOf(null);
  }
}
