// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/heavy.ts — THE HEAVY THINGS, DOWNLOADED ON FIRST LOAD (ADR-0110, ADR-0116, ADR-0119).
//
// ========================= WHAT THIS IS =========================
// Pillar 8 says "PWA ONLINE on the first day, then OFFLINE-FIRST", and ADR-0116 removed the contradiction that blocked
// this: installing is already a network act, so fetching at install violates nothing. What was missing was someone
// fetching.
//
// ⚠️ AND IT DOES NOT BLOCK THE GAME. The child plays while the heavy files come down; what must not happen is them
// reaching the second day, offline, and finding the voice was never fetched.
//
// ========================= THE THREE RULES THE SHAPE IMPOSES =========================
//  1. **ONE AT A TIME.** Four 60 MB downloads in parallel on a school link fight for the same bandwidth and none
//     finishes first — and the game, which needs the network for its own images, waits behind them.
//  2. **NEVER THROWS.** A network failure is REPORTED and the list goes on. A `throw` here would bring down a game's
//     start over a resource it may not even use today.
//  3. **IDEMPOTENT.** What is already in Cache Storage is not fetched again — which is what makes this safe to call on
//     every start instead of only "on the first", which nobody can detect honestly.
import {
  CACHE_HEAVY, HEAVY_FILES, DELIVERY_LISTS, readingLanguageOf, commandsLanguageOf, type HeavyFile, type DeliveryList,
} from './heavy-catalogue.js';

export { CACHE_HEAVY, HEAVY_FILES };

/** What happened to each entry, so the caller can tell a person. */
export interface HeavyReport {
  readonly id: string;
  readonly outcome: 'ja-tinha' | 'baixado' | 'falhou' | 'sem-fonte';
  readonly bytes?: number;
  readonly error?: string;
}

/**
 * 🔴 WHAT THE DOWNLOAD USES OF THE BROWSER, RECEIVED AND NEVER REACHED (ADR-0232 point 2): the root reads each from the host's
 * window. Required, because a port that falls back to the global is a global reached one step later (ADR-0224/0227).
 */
export interface HeavyOptions {
  /**
   * The host's `caches`, as its window answers it: `undefined` where it has none (an insecure context), and then every file
   * is reported and none fetched. Required all the same — the key is the root's statement of what it lent.
   */
  readonly cacheStorage: CacheStorage | undefined;
  /** The host's `fetch`, `undefined` where it has none, with the same answer. */
  readonly fetch: typeof fetch | undefined;
  /** Called on each resolved entry — what lets the interface say what is happening. */
  readonly onProgress?: (r: HeavyReport) => void;
  /**
   * The SHA-256 of a body, as lowercase hex (issue #168) — `sha256With(crypto.subtle)`. `null` (a host without
   * `crypto.subtle`, which is an insecure context) keeps NOTHING: unverifiable is not verified.
   */
  readonly digest: ((payload: ArrayBuffer) => Promise<string>) | null;
  /**
   * Only these ids, when given, and IN THIS ORDER — the download is one at a time, so the order is who waits (`heavyAtBoot`
   * puts the child's command model first). For a consumer that wants the voices and not the rest.
   */
  readonly only?: readonly string[];
  /** The page's address the delivery's `heavy/` folder is resolved against (`document.baseURI`). */
  readonly base: string;
}

/**
 * WHAT A GAME'S START FETCHES (ADR-0216 §3): the catalogue, less what this game did not ask for.
 *
 * · The neural voice — its model, its voices AND the runtime that speaks them: without that answer they are 372 MB taken from a
 *   school's link and a child's device for nothing.
 * · The reading models: 850 MiB for the three languages, so `reading` is not a yes or no but a LANGUAGE — the child's, known at
 *   boot. A delivery may carry more than one; a device downloads the one being read in. A game that never listens gets none.
 * · 🔴 THE GRAPH RUNTIME IS NOT THE VOICE'S, and its `voz:` name said otherwise. `platform/onnx-runtime` runs Kokoro AND the
 *   reading models, so a game that only LISTENS needs it: without this line its delivery carried a 378 MiB model and nothing
 *   able to open it, and the first `listen()` asked for a file the build never wrote. Measured on 2026-09-21, building the
 *   very delivery this exists to serve. The PHONEMIZER (`voz:runtime:fonemas`, 18.7 MiB) stays the voice's — nothing else
 *   turns letters into sounds.
 * · The command models (issue #184): one per language too, 108 MiB for the three, and the runtime that loads them. Nothing in
 *   the game decides this — speaking instead of pressing is a way INTO the controller, and a cartridge does not get to close
 *   one (ADR-0111). `commands` is a language or a LIST of them, and the models come in the list's order: the root asks for
 *   every language the page can switch to, the child's first, because a language changed mid-game must find its model already
 *   kept (ADR-0225 erratum, the Dev: «A entrega leva as três línguas.»). The delivery carries the three unless its
 *   `--commands` list narrows it; a language it did not carry is a quiet 404 here and a line of `problems` when she speaks.
 * · The Libras player (ADR-0234): the delivery's list of its avatar, clips, glosses and three.js chunk (34.9 MB in the engine's
 *   delivery), only with `libras`: the root asks for it while deaf mode is on, so a device whose child never asks for signing
 *   never downloads it. No game declares it either — deaf mode is the person's (ADR-0111) — and a delivery built without
 *   `--libras` simply has none, the same quiet 404 as a missing command model. No catalogue file is the player's: it is all the
 *   delivery's own, kept by what the delivery carries.
 * The ids are the catalogue's files, then the delivery lists (`DELIVERY_LISTS`), by one rule.
 */
export function heavyAtBoot(
  declared: {
    readonly kokoro: boolean; readonly reading?: string | null;
    readonly commands?: string | readonly string[] | null; readonly libras?: boolean;
  },
): readonly string[] {
  const baseLanguage = (tag: string): string => tag.split('-')[0]!.toLowerCase();
  const reading = declared.reading ? baseLanguage(declared.reading) : null;
  const askedLanguages = declared.commands == null ? [] : typeof declared.commands === 'string' ? [declared.commands] : declared.commands;
  const commands = [...new Set(askedLanguages.filter(Boolean).map(baseLanguage))];
  const asked = (id: string): boolean => {
    const language = readingLanguageOf(id);
    if (language) return language === reading;
    // 📌 THE COMMAND MODELS ARE A TRANSPORT'S, not a game's: no cartridge declares them, because a child who speaks instead of
    // pressing is reaching the controller, and a cartridge does not get to deny her a way in (ADR-0111). The LANGUAGES are
    // still asked, and the runtime comes with whichever one is.
    const commanded = commandsLanguageOf(id);
    if (commanded) return commands.includes(commanded);
    if (id.startsWith('commands:runtime')) return commands.length > 0;
    if (id.startsWith('libras:')) return !!declared.libras;
    if (id.startsWith('voz:runtime:onnx')) return declared.kokoro || !!reading;
    return declared.kokoro || !(id.startsWith('voz:kokoro:') || id.startsWith('voz:runtime:'));
  };
  const chosen = HEAVY_FILES.filter((p) => asked(p.id));
  // ⚠️ THE CHILD'S MODEL FIRST: the download is one file at a time (rule 1), so the command models take their slots in the order
  // the languages were asked — a Spanish child does not wait behind 70 MiB of Portuguese and English before her own.
  const models = chosen.filter((p) => commandsLanguageOf(p.id))
    .sort((a, b) => commands.indexOf(commandsLanguageOf(a.id)!) - commands.indexOf(commandsLanguageOf(b.id)!));
  let slot = 0;
  return [
    ...chosen.map((p) => (commandsLanguageOf(p.id) ? models[slot++]! : p).id),
    ...DELIVERY_LISTS.map((l) => l.id).filter(asked),
  ];
}

/**
 * WHERE THE DELIVERY SERVES A HEAVY FILE (ADR-0177, issue #173): `heavy/<host><path>` beside the page. The child's device
 * reads it from the game's own origin; the upstream address is only where the build fetched it from.
 * 📌 The upstream address stays the CACHE KEY: it is what the voice and vision libraries ask for, and the service worker answers
 * them from the checked cache without a network request.
 *
 * 🔴 THE FOLDER WAS CALLED «pesados» UNTIL 2026-09-21 (ADR-0219). 📏 What that costs a school was measured before it changed:
 * the entries are kept under the UPSTREAM address, so nothing is re-downloaded — what breaks is a delivery built by the old
 * `bin` under a new engine, which asks for `heavy/…` and gets a 404 until the delivery is built again.
 */
export function deliveryPath(url: string): string {
  const u = new URL(url);
  return `heavy/${u.host}${u.pathname}`;
}

/**
 * The inverse, for the service worker: a request for `…/heavy/<host><path>` is answered from the entry kept under
 * `https://<host><path>`; any other address has no key (`null`). It is the route's `cacheKeyWillBeUsed` itself, so it also
 * takes Workbox's `{ request }`. Self-contained on purpose — the PWA plugin copies this function's SOURCE into `sw.js`, where
 * nothing else from this module exists.
 *
 * ⚠️ THE OFFSET COMES FROM THE FOLDER'S OWN LENGTH, and it is written this way because of what a blind rename would have done
 * here: the old code advanced by 9, the length of the old folder's name with its slashes, and `/heavy/` is 7 — a text
 * replacement of the name alone would
 * have left every cache key with two characters of the host eaten, and the only symptom would be a cache that never hits.
 */
export function deliveryCacheKey(urlOrRequest: string | { readonly request: { readonly url: string } }): string | null {
  const folder = '/heavy/';
  const urlPath = new URL(typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest.request.url).pathname;
  const i = urlPath.indexOf(folder);
  return i < 0 ? null : 'https://' + urlPath.slice(i + folder.length);
}

/**
 * DOWNLOADS WHAT IS MISSING, ONE AT A TIME, AND RETURNS WHAT HAPPENED TO EACH.
 *
 * ⚠️ ENTRIES WITHOUT A `url` ARE NOT SKIPPED IN SILENCE — they return `sem-fonte`. It is the difference between "this
 * subsystem has nowhere to come from yet" and "this subsystem is handled", exactly the distinction ADR-0119 measured as
 * missing: the engine PROMISED four things and delivered one, with nothing saying so.
 *
 * The catalogue's files come first, then the delivery's lists (`DELIVERY_LISTS`), each list ONE report for all its files.
 */
export async function downloadHeavy(options: HeavyOptions): Promise<HeavyReport[]> {
  const targets = options.only
    ? [...new Set(options.only)].flatMap((id) => HEAVY_FILES.filter((p) => p.id === id))
    : HEAVY_FILES;
  const lists = DELIVERY_LISTS.filter((l) => !options.only || options.only.includes(l.id));
  const out: HeavyReport[] = [];
  const record = (r: HeavyReport): void => { out.push(r); options.onProgress?.(r); };

  const { cacheStorage, fetch: fetchFile, digest, base } = options;
  if (!cacheStorage || !fetchFile) {
    for (const p of [...targets, ...lists]) record({ id: p.id, outcome: 'falhou', error: 'sem Cache Storage ou sem fetch' });
    return out;
  }
  const tools: DownloadTools = { cache: await cacheStorage.open(CACHE_HEAVY), fetchFile, digest, base };
  for (const p of targets) record(await fetchOne(p, tools));
  for (const l of lists) record(await keepListed(l, tools));
  return out;
}

/** What one download works with: the open cache, the fetch, the hash, and the page the delivery is resolved against. */
interface DownloadTools {
  readonly cache: Cache;
  readonly fetchFile: typeof fetch;
  readonly digest: ((body: ArrayBuffer) => Promise<string>) | null;
  readonly base: string;
}

/** One file's fate: already kept, fetched from the delivery and checked, or refused — always with the reason. */
async function fetchOne(p: HeavyFile, t: DownloadTools): Promise<HeavyReport> {
  if (!p.url) return { id: p.id, outcome: 'sem-fonte', error: p.whyNoSource };
  try {
    if (await t.cache.match(p.url)) return { id: p.id, outcome: 'ja-tinha' };
    // from the delivery's own origin, never from the upstream host (ADR-0177)
    const resp = await t.fetchFile(new URL(deliveryPath(p.url), t.base).href);
    if (!resp.ok) return { id: p.id, outcome: 'falhou', error: `HTTP ${resp.status}` };
    return await keepIfChecked(p, p.url, resp, t);
  } catch (e) {
    return { id: p.id, outcome: 'falhou', error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * CHECKED BEFORE KEPT (issue #168; STRIDE client pass). What is kept runs in the child's page and is served offline from then
 * on, so a body whose SHA-256 is not the measured one never enters the cache. It is kept under the UPSTREAM address, which is
 * what the voice and vision libraries ask for.
 */
async function keepIfChecked(p: HeavyFile, url: string, resp: Response, t: DownloadTools): Promise<HeavyReport> {
  const refused = (reason: string): HeavyReport => ({ id: p.id, outcome: 'falhou', error: reason });
  if (!p.sha256) return refused('this entry pins its sha256 nowhere: there is nothing to check it against');
  if (!t.digest) return refused('this host cannot compute a sha256 (crypto.subtle needs a secure context)');
  const body = await resp.arrayBuffer();
  const got = await t.digest(body);
  if (got !== p.sha256) return refused(`sha256 mismatch: expected ${p.sha256}, got ${got} — not kept`);
  await t.cache.put(url, new Response(body, { status: resp.status, statusText: resp.statusText, headers: resp.headers }));
  return { id: p.id, outcome: 'baixado', bytes: p.bytes };
}

/** The header a file kept from a delivery's list carries its listed sha256 in: how a later start knows it is kept, and current. */
const LISTED_SHA256 = 'x-inclusionist-sha256';

/** One file a delivery's list names: its path as listed, its address under the page, and the sha256 its bytes must have. */
interface ListedFile { readonly path: string; readonly url: string; readonly sha256: string }

/**
 * The files a delivery's list names, or a THROW saying why the list is refused whole: a list with no `files`, an entry without a
 * path or a sha256, or one whose address falls outside the list's folders (a `..`, another origin, a query) — the list may only
 * put the player's own files in the checked cache, never the game's page nor anything a route outside those folders serves.
 */
function listedFiles(data: unknown, l: DeliveryList, base: string): ListedFile[] {
  const files = (data as { files?: unknown } | null)?.files;
  if (!Array.isArray(files)) throw new Error('its `files` is missing');
  const folders = l.folders.map((folder) => new URL(folder, base).href);
  return files.map((f: unknown) => {
    const { path, sha256 } = (f ?? {}) as { path?: unknown; sha256?: unknown };
    if (typeof path !== 'string' || typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) {
      throw new Error(`a listed file is malformed: ${JSON.stringify(f)}`);
    }
    const at = new URL(path, base);
    const url = at.href;
    if (at.search || at.hash || !folders.some((folder) => url.startsWith(folder) && url.length > folder.length)) {
      throw new Error(`it names ${path}, outside ${l.folders.join(' and ')}`);
    }
    return { path, url, sha256 };
  });
}

/**
 * A DELIVERY'S LIST, KEPT FILE BY FILE (ADR-0234, pillar 8): the list is read from the page's origin, and each file it names is
 * fetched from there, CHECKED against its listed sha256, and kept under its own address, where the service worker answers it
 * offline. A file already kept with that sha256 is not fetched again; a body that is not the listed one is never kept, and the
 * report names it. One report for the list: `baixado` with the bytes fetched, `ja-tinha`, or `falhou` with the files refused.
 */
async function keepListed(l: DeliveryList, t: DownloadTools): Promise<HeavyReport> {
  const failed = (error: string): HeavyReport => ({ id: l.id, outcome: 'falhou', error });
  const digest = t.digest;
  if (!digest) return failed('this host cannot compute a sha256 (crypto.subtle needs a secure context)');
  const files = await readList(l, t);
  if (typeof files === 'string') return failed(files);
  const refused: string[] = [];
  let bytes = 0;
  let fetched = 0;
  for (const f of files) {
    const kept = await keepListedFile(f, t, digest);
    if (typeof kept === 'string') refused.push(`${f.path}: ${kept}`);
    else if (kept !== null) { bytes += kept; fetched += 1; }
  }
  if (!refused.length) return fetched ? { id: l.id, outcome: 'baixado', bytes } : { id: l.id, outcome: 'ja-tinha' };
  const more = refused.length > 5 ? `; and ${refused.length - 5} more` : '';
  return failed(`${refused.length} of ${files.length} files of ${l.path} not kept: ${refused.slice(0, 5).join('; ')}${more}`);
}

/** The list's files, or why it is refused whole (not there, not JSON, or naming what it may not). */
async function readList(l: DeliveryList, t: DownloadTools): Promise<ListedFile[] | string> {
  try {
    // never an old copy of the list: it is what says which files are current
    const resp = await t.fetchFile(new URL(l.path, t.base).href, { cache: 'no-store' });
    if (!resp.ok) return `HTTP ${resp.status} — ${l.path}`;
    return listedFiles(await resp.json(), l, t.base);
  } catch (e) {
    return `the list ${l.path} is refused: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** One listed file: `null` when it is already kept with its listed hash, the bytes kept, or why it was not kept. */
async function keepListedFile(f: ListedFile, t: DownloadTools, digest: (body: ArrayBuffer) => Promise<string>): Promise<number | null | string> {
  try {
    if ((await t.cache.match(f.url))?.headers.get(LISTED_SHA256) === f.sha256) return null;
    /*
     * 📌 THE LISTED HASH GOES IN THE QUERY: the service worker answers these folders from this cache by their address, so a file
     * the list CHANGED would be answered with the copy it replaces. Another address reaches the delivery, and the old copy stays
     * kept until the new one is checked — offline a child keeps the player she had.
     */
    const resp = await t.fetchFile(`${f.url}?sha256=${f.sha256}`);
    if (!resp.ok) return `HTTP ${resp.status}`;
    const body = await resp.arrayBuffer();
    const got = await digest(body);
    if (got !== f.sha256) return `sha256 mismatch: expected ${f.sha256}, got ${got} — not kept`;
    const headers = new Headers(resp.headers);
    headers.set(LISTED_SHA256, f.sha256);
    await t.cache.put(f.url, new Response(body, { status: resp.status, statusText: resp.statusText, headers }));
    return body.byteLength;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/**
 * THE SHA-256 OF A BODY AS LOWERCASE HEX, by the `crypto.subtle` it is handed (issue #168) — or `null` when there is none,
 * which is a host outside a secure context: the answer `HeavyOptions.digest` reads as «cannot hash, so keep nothing».
 */
export function sha256With(subtle: Pick<SubtleCrypto, 'digest'> | null | undefined): ((payload: ArrayBuffer) => Promise<string>) | null {
  if (!subtle) return null;
  return async (payload) => {
    const bytes = new Uint8Array(await subtle.digest('SHA-256', payload));
    return [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('');
  };
}

/**
 * WHETHER A CATALOGUE FILE IS IN THE CHECKED CACHE, by its upstream address — what `platform/vision` and
 * `platform/vosk-runtime` ask before loading anything. The host's `caches` is handed in; `undefined` (an insecure context)
 * holds nothing, so every file is missing and the loader names them.
 */
export function checkedCacheHas(cacheStorage: CacheStorage | undefined): (upstreamUrl: string) => Promise<boolean> {
  return async (url) => !!cacheStorage && !!(await (await cacheStorage.open(CACHE_HEAVY)).match(url));
}

/** The size of what is still missing, in bytes — so a notice can say how much is left before it starts. */
export function bytesLeftToDownload(soFar: readonly HeavyReport[]): number {
  const feitos = new Set(soFar.filter((r) => r.outcome === 'ja-tinha' || r.outcome === 'baixado').map((r) => r.id));
  return HEAVY_FILES.filter((p) => p.url && !feitos.has(p.id)).reduce((s, p) => s + (p.bytes ?? 0), 0);
}
