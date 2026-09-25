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
import { CACHE_HEAVY, HEAVY_FILES, readingLanguageOf, commandsLanguageOf, type HeavyFile } from './heavy-catalogue.js';

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
  /** Only these ids, when given. For a consumer that wants the voices and not the rest. */
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
 * · The command models (issue #184): one per language too, 112 MiB for the three, and the runtime that loads them. Nothing in
 *   the game decides this — speaking instead of pressing is a way INTO the controller, and a cartridge does not get to close
 *   one (ADR-0111). What decides is the delivery: `inclusionist-heavy --commands pt` puts Portuguese in it.
 * · The Libras player (ADR-0234, route A), 19.3 MiB, only with `libras`: the root asks for it while deaf mode is on, so a device
 *   whose child never asks for signing never downloads it. No game declares it either — deaf mode is the person's (ADR-0111) —
 *   and a delivery built without `--libras` simply has none, the same quiet 404 as a missing command model.
 */
export function heavyAtBoot(
  declared: {
    readonly kokoro: boolean; readonly reading?: string | null; readonly commands?: string | null; readonly libras?: boolean;
  },
): readonly string[] {
  const reading = declared.reading ? declared.reading.split('-')[0]!.toLowerCase() : null;
  const commands = declared.commands ? declared.commands.split('-')[0]!.toLowerCase() : null;
  return HEAVY_FILES.filter((p) => {
    const language = readingLanguageOf(p.id);
    if (language) return language === reading;
    // 📌 THE COMMAND MODELS ARE A TRANSPORT'S, not a game's: no cartridge declares them, because a child who speaks instead of
    // pressing is reaching the controller, and a cartridge does not get to deny her a way in (ADR-0111). The LANGUAGE is still
    // asked — 112 MiB for the three — and the runtime comes with whichever one does.
    const commanded = commandsLanguageOf(p.id);
    if (commanded) return commanded === commands;
    if (p.id.startsWith('commands:runtime')) return !!commands;
    if (p.id.startsWith('libras:')) return !!declared.libras;
    if (p.id.startsWith('voz:runtime:onnx')) return declared.kokoro || !!reading;
    return declared.kokoro || !(p.id.startsWith('voz:kokoro:') || p.id.startsWith('voz:runtime:'));
  }).map((p) => p.id);
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
 */
export async function downloadHeavy(options: HeavyOptions): Promise<HeavyReport[]> {
  const targets = options.only ? HEAVY_FILES.filter((p) => options.only!.includes(p.id)) : HEAVY_FILES;
  const out: HeavyReport[] = [];
  const record = (r: HeavyReport): void => { out.push(r); options.onProgress?.(r); };

  const { cacheStorage, fetch: fetchFile, digest, base } = options;
  if (!cacheStorage || !fetchFile) {
    for (const p of targets) record({ id: p.id, outcome: 'falhou', error: 'sem Cache Storage ou sem fetch' });
    return out;
  }
  const tools: DownloadTools = { cache: await cacheStorage.open(CACHE_HEAVY), fetchFile, digest, base };
  for (const p of targets) record(await fetchOne(p, tools));
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
