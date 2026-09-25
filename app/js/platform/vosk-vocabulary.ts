// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/vosk-vocabulary — THE WORDS A VOSK MODEL KNOWS, READ FROM ITS OWN ARCHIVE (ADR-0194 §4, ADR-0169).
//
// A menu item whose name has a word the model lacks cannot be said: Kaldi drops that word from the grammar and the item goes
// mute. The recogniser cannot tell the page so, and this was MEASURED in the delivery's runtime (`vosk-browser-dynamic-
// execution-0`), not assumed: the drop is a Kaldi warning («Ignoring word missing in vocabulary: 'acao'») written by the wasm to
// the WORKER's console, never posted to the page, and the bundle's API has no call that lists the vocabulary. So the page reads
// the list where the model keeps it — the output symbol table of its word graph `Gr.fst`, in the header, before any state — from
// the same archive the worker opens, and stops reading as soon as the table ends.
//
// 📏 In `vosk-model-small-pt-0.3.tar.gz` (the delivery's archive, sorted by `scripts/models/repack-vosk-models.py`) `Gr.fst` is
// the first entry and its table (99 105 words) ends 4 MB into the uncompressed tar; «configurações», «ação» and «estibordo» are
// in it, «configuracoes», «acao» and «boreste» are not — the same answers the earlier lab and browser measurements gave. The es
// and en archives were NOT on the machine that measured this; their `Gr.fst` should sit under `graph/`, after other entries,
// which the walk below passes over.
//
// ⚠️ A model with no `Gr.fst` answers `null` («cannot know»), not an empty set: such a model has no runtime grammar at all, and
// an empty set would report every word of every name as missing.

/** The magic numbers of an OpenFst binary file and of a symbol table written inside one (`fst/fst.h`, `fst/symbol-table.h`). */
const FST_MAGIC = 2125659606;
const SYMBOL_TABLE_MAGIC = 2125658996;
/** The header flags that say an input / output symbol table follows the header. */
const HAS_INPUT_SYMBOLS = 1;
const HAS_OUTPUT_SYMBOLS = 2;
const TAR_BLOCK = 512;
/** Guards against reading a corrupt length as a request for gigabytes. */
const MAX_STRING = 1 << 16;
const MAX_SYMBOLS = 5_000_000;

const UTF8 = new TextDecoder('utf-8');
const ASCII = new TextDecoder('latin1');

/** The archive ended, or a length in it cannot be true: whatever was being read cannot be known. */
class Unreadable extends Error {}

/**
 * A pull reader over a byte stream: takes exactly what it is asked for, across chunk boundaries, and THROWS `Unreadable` when the
 * stream ends first — so a reader of a format states the format, and one `catch` answers every truncation.
 */
class Bytes {
  private readonly chunks: Uint8Array[] = [];
  private head = 0;
  private have = 0;
  private readonly source: ReadableStreamDefaultReader<Uint8Array>;

  constructor(source: ReadableStreamDefaultReader<Uint8Array>) { this.source = source; }

  private async fill(n: number): Promise<void> {
    while (this.have < n) {
      const { done, value } = await this.source.read();
      if (done) throw new Unreadable('the archive ended');
      if (value.length) { this.chunks.push(value); this.have += value.length; }
    }
  }

  private drop(k: number): void {
    this.head += k;
    this.have -= k;
    if (this.head === this.chunks[0]!.length) { this.chunks.shift(); this.head = 0; }
  }

  /** The next `n` bytes. */
  async take(n: number): Promise<Uint8Array> {
    await this.fill(n);
    const out = new Uint8Array(n);
    for (let o = 0; o < n;) {
      const k = Math.min(n - o, this.chunks[0]!.length - this.head);
      out.set(this.chunks[0]!.subarray(this.head, this.head + k), o);
      o += k;
      this.drop(k);
    }
    return out;
  }

  /** Passes `n` bytes without keeping them. */
  async skip(n: number): Promise<void> {
    for (let left = n; left > 0;) {
      await this.fill(1);
      const k = Math.min(left, this.chunks[0]!.length - this.head);
      left -= k;
      this.drop(k);
    }
  }

  async int32(): Promise<number> { return new DataView((await this.take(4)).buffer).getInt32(0, true); }

  async int64(): Promise<number> { return Number(new DataView((await this.take(8)).buffer).getBigInt64(0, true)); }

  /** An OpenFst string: a 32-bit length, then that many bytes of UTF-8. */
  async text(): Promise<string> { return UTF8.decode(await this.take(bounded(await this.int32(), MAX_STRING))); }
}

/** A length read from the archive, refused when it cannot be one. */
function bounded(n: number, max: number): number {
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Unreadable(`a length of ${n}`);
  return n;
}

/** A NUL-padded tar field as text. */
const field = (block: Uint8Array, from: number, length: number): string =>
  ASCII.decode(block.subarray(from, from + length)).replace(/\0.*$/s, '');

/** The value of `path` in a pax extended header, if it sets one. */
const paxPath = (data: Uint8Array): string | null => /(?:^|\n)\d+ path=([^\n]*)\n/.exec(UTF8.decode(data))?.[1] ?? null;

/** The path a ustar header names: its prefix and its name. */
const headerPath = (header: Uint8Array): string => {
  const prefix = field(header, 345, 155);
  return prefix ? `${prefix}/${field(header, 0, 100)}` : field(header, 0, 100);
};

const isWordGraph = (type: string, path: string): boolean => (type === '0' || type === '\0') && /(?:^|\/)Gr\.fst$/.test(path);

/**
 * Walks the tar entries until one whose path ends in `/Gr.fst` and leaves the reader at its first byte. `false` when the archive
 * ends without one. Pax (`x`) and GNU long-name (`L`) headers name the entry that follows them; a global pax header is skipped.
 */
async function toWordGraph(bytes: Bytes): Promise<boolean> {
  let named: string | null = null;
  for (;;) {
    const header = await bytes.take(TAR_BLOCK);
    if (header.every((b) => b === 0)) return false;
    const size = bounded(parseInt(field(header, 124, 12).trim() || '0', 8), Number.MAX_SAFE_INTEGER);
    const padded = Math.ceil(size / TAR_BLOCK) * TAR_BLOCK;
    const type = String.fromCharCode(header[156]!);
    if (type === 'x' || type === 'L') {
      const data = (await bytes.take(padded)).subarray(0, size);
      named = type === 'x' ? paxPath(data) : field(data, 0, size);
      continue;
    }
    if (isWordGraph(type, named ?? headerPath(header))) return true;
    named = null;
    await bytes.skip(padded);
  }
}

/** One symbol table, as `fst::SymbolTable::Write` lays it out: magic, name, available key, size, then (symbol, key) pairs. */
async function symbolTable(bytes: Bytes): Promise<Set<string>> {
  if ((await bytes.int32()) !== SYMBOL_TABLE_MAGIC) throw new Unreadable('not a symbol table');
  await bytes.text();
  await bytes.int64();
  const size = bounded(await bytes.int64(), MAX_SYMBOLS);
  const words = new Set<string>();
  for (let i = 0; i < size; i++) {
    words.add(await bytes.text());
    await bytes.int64();
  }
  return words;
}

/**
 * The OpenFst header up to its flags — magic, fst type, arc type, version, flags, properties, start, states, arcs — and the flags,
 * leaving the reader at the first symbol table.
 */
async function fstFlags(bytes: Bytes): Promise<number> {
  if ((await bytes.int32()) !== FST_MAGIC) throw new Unreadable('not an OpenFst file');
  await bytes.text();
  await bytes.text();
  await bytes.int32();
  const flags = await bytes.int32();
  await bytes.skip(4 * 8);
  return flags;
}

/**
 * The words the model in this `.tar.gz` knows — the output symbol table of its `Gr.fst` — or `null` when that cannot be read
 * (no word graph, a header that is not OpenFst's, a stream that ends early). Stops reading the archive once the table is read.
 */
export async function readModelVocabulary(archive: ReadableStream<BufferSource>): Promise<ReadonlySet<string> | null> {
  const reader = archive.pipeThrough(new DecompressionStream('gzip')).getReader();
  const bytes = new Bytes(reader);
  try {
    if (!(await toWordGraph(bytes))) return null;
    const flags = await fstFlags(bytes);
    const input = flags & HAS_INPUT_SYMBOLS ? await symbolTable(bytes) : null;
    // the words a grammar is matched against are the OUTPUT side; an acceptor written with one table has it on both
    return flags & HAS_OUTPUT_SYMBOLS ? await symbolTable(bytes) : input;
  } catch {
    return null; // truncated, not OpenFst, not gzip: each is one more «cannot know»
  } finally {
    reader.cancel().catch(() => { /* already finished */ });
  }
}
