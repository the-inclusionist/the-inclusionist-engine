// SPDX-License-Identifier: AGPL-3.0-or-later
// A VOSK MODEL ARCHIVE BUILT IN MEMORY — the layout `platform/vosk-vocabulary` reads, with no model downloaded.
//
// The bytes follow the formats as the real archive has them, measured on `vosk-model-small-pt-0.3.tar.gz` on 2026-09-25: a gzipped
// ustar whose `Gr.fst` is an OpenFst binary (magic 2125659606, «ngram», «standard», version 4, flags 3) with its input and output
// symbol tables right after the header, each in `fst::SymbolTable::Write`'s layout. Only what the reader reads is real; the states
// that follow are filler.
//
// 📌 NO NODE BUFFERS: the same fixture serves the node and the browser projects (the early stop is measured in the browser, where
// `DecompressionStream` has backpressure — Node's pulls the whole source at once, measured on 2026-09-25).

const UTF8 = new TextEncoder();

const concat = (parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};
const le32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n, true); return b; };
const le64 = (n) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigInt64(0, BigInt(n), true); return b; };
const fstString = (s) => { const b = UTF8.encode(s); return concat([le32(b.length), b]); };

/** `n` bytes that do not compress (so a test can tell «read to the end» from «stopped early» by what was pulled). */
export function noise(n) {
  const b = new Uint8Array(n);
  for (let at = 0; at < n; at += 65536) crypto.getRandomValues(b.subarray(at, Math.min(n, at + 65536)));
  return b;
}

/** Text as bytes. */
export const text = (s) => UTF8.encode(s);

/** One `fst::SymbolTable` as written inside an FST header. */
export function symbolTable(words, magic = 2125658996) {
  const parts = [le32(magic), fstString('words'), le64(words.length), le64(words.length)];
  words.forEach((w, i) => { parts.push(fstString(w), le64(i)); });
  return concat(parts);
}

/**
 * The bytes of a `Gr.fst`: the header, the symbol tables the flags announce, then `tail` (the states, filler here).
 * `input`/`output` are word lists or `null` (absent, and the flag says so).
 */
export function wordGraph({ input = null, output = null, magic = 2125659606, tableMagic = 2125658996, tail = new Uint8Array(64) } = {}) {
  const flags = (input ? 1 : 0) | (output ? 2 : 0);
  return concat([
    le32(magic), fstString('ngram'), fstString('standard'), le32(4), le32(flags),
    le64(0), le64(1), le64(3), le64(0),
    ...(input ? [symbolTable(input, tableMagic)] : []), ...(output ? [symbolTable(output, tableMagic)] : []),
    tail,
  ]);
}

/** One 512-byte ustar header. `type` is the typeflag character; a name over 100 bytes is split into prefix and name. */
function tarHeader(path, size, type = '0') {
  const h = new Uint8Array(512);
  const put = (s, at) => { h.set(UTF8.encode(s), at); };
  let name = path, prefix = '';
  if (UTF8.encode(path).length > 100) { const cut = path.lastIndexOf('/'); prefix = path.slice(0, cut); name = path.slice(cut + 1); }
  put(name, 0);
  put('0000644\0', 100);
  put('0000000\0', 108);
  put('0000000\0', 116);
  put(`${size.toString(8).padStart(11, '0')}\0`, 124);
  put('00000000000\0', 136);
  put('        ', 148);
  put(type, 156);
  put('ustar\0', 257);
  put('00', 263);
  put(prefix, 345);
  const sum = h.reduce((n, b) => n + b, 0);
  put(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  return h;
}

const padded = (data) => concat([data, new Uint8Array((512 - (data.length % 512)) % 512)]);

/** A pax extended header that names the next entry `path` (what Python's PAX_FORMAT writes for a long or non-ASCII name). */
export function paxFor(path) {
  const body = `path=${path}`;
  let n = body.length + 3;
  while (`${n} ${body}\n`.length !== n) n = `${n} ${body}\n`.length;
  return { path: 'PaxHeader', type: 'x', data: UTF8.encode(`${n} ${body}\n`) };
}

/** The uncompressed tar of these entries, in this order: `{ path, data, type? }`. */
export function modelTar(entries) {
  const parts = [];
  for (const e of entries) parts.push(tarHeader(e.path, e.data.length, e.type ?? '0'), padded(e.data));
  parts.push(new Uint8Array(1024));
  return concat(parts);
}

/** Bytes gzipped — by the platform's own `CompressionStream`, which both projects have. */
export async function gzip(bytes) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
}

/** A `.tar.gz` of these entries. */
export const modelArchive = async (entries) => gzip(modelTar(entries));

/**
 * The archive as a stream in chunks of `chunk` bytes, counting how many bytes were PULLED — a reader that stops early pulls less
 * than the whole.
 */
export function streamOf(bytes, chunk = 64 * 1024) {
  const counter = { pulled: 0, total: bytes.length, cancelled: false };
  let at = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (at >= bytes.length) { controller.close(); return; }
      const next = bytes.slice(at, at + chunk);
      at += next.length;
      counter.pulled = at;
      controller.enqueue(next);
    },
    cancel() { counter.cancelled = true; },
  }, { highWaterMark: 0 });
  return { stream, counter };
}
