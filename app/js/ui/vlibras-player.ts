// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/vlibras-player.ts — THE INTERPRETER THAT SIGNS: the VLibras player, served by the delivery from the page's own origin and
// driven through its `postMessage` API (ADR-0234, route A — «route A now, route B next»).
//
// The player is a same-origin iframe (`libras/player/index.html`, written by `inclusionist-heavy --libras`) that appears in front
// of the screen when the sonar hands deaf mode its text. THE PROTOCOL, measured in route A and in this order:
//   1. the frame is opened on the first request, and the interpreter waits for `on_load_player` (a device without WebGL answers
//      `on_error`; one that never answers is given up on after `loadTimeoutMs`);
//   2. `PlayerManager.setBaseUrl(<the delivery's signs folder>)` — BEFORE the first `playNow`, or the first word is asked of the
//      hosted dictionary, which the policy blocks, and is spelled instead of signed;
//   3. `PlayerManager.playNow(<gloss>)`, and the request resolves when `counter_gloss` says the last token was played
//      ([done, total] with done = total > 0 — the player also sends [0, 0] as it starts).
// `hide()` stops the player and takes the frame off the screen; `dispose()` removes it.
//
// 📌 ONLY WHERE THE DELIVERY SHIPPED THE PLAYER: before opening anything, the interpreter asks for the player's Unity
// configuration, which only the delivery step writes. No configuration — a delivery built without `--libras`, or the engine's own
// tests — and it answers exactly as `NO_INTERPRETER` does, so `problems` and the child hear the same «signing unavailable».
//
// THE GLOSS. The player signs a GLOSS — Libras word order, in sign names — and the text the sonar found is Portuguese. The
// delivery glossed the engine's and the game's texts at build time and wrote them beside the player (`glosses.json`); the
// interpreter reads that file once, with the configuration, and hands the player the gloss `ui/libras-glosses` looks up. A text
// the file does not cover — a delivery without it, a sentence no dictionary holds, a `{param}`'s value — becomes its words in
// capitals with the accents stripped, which the player fingerspells. A word the delivery carries no sign for is fingerspelled
// too, from the letters the player carries — as it is WRITTEN on the screen, not as the translator's lemma: the delivery put
// the written word in the gloss for it (`scripts/libras-glosses.mjs`, ADR-0234 erratum).
import { NO_INTERPRETER, type Interpreter, type SignResult } from './vlibras.js';
import { LIBRAS_PLAYER_FOLDER, LIBRAS_SIGNS_FOLDER } from '../platform/heavy-catalogue.js';
import { LIBRAS_GLOSSES_FILE, loadGlosser, provisionalGloss, type Glosser } from './libras-glosses.js';

/** What the interpreter is built over. Every port is the root's. */
export interface VlibrasPlayerPorts {
  /** The host's document: the frame is created in it and put in front of the screen. */
  readonly doc: Document;
  /** The host's window: the player's messages arrive on it, and it keeps the load's timer. */
  readonly win: Pick<Window, 'addEventListener' | 'removeEventListener' | 'setTimeout' | 'clearTimeout'>;
  /** The host's `fetch`, to ask whether the delivery shipped the player; `undefined` where it has none, and then it did not. */
  readonly fetch: ((url: string) => Promise<Response>) | undefined;
  /** The page's address the delivery's folders are resolved against (`document.baseURI`). */
  readonly base: string;
  /** The frame's accessible name, read when the frame is made — the page's language at that moment. */
  readonly title: () => string;
  /** Where the player's page is, under `base`. The delivery's folder unless a test points elsewhere. */
  readonly playerFolder?: string;
  /** How long the player may take to load before the request is answered «unavailable». */
  readonly loadTimeoutMs?: number;
}

/** The Unity object every call of this interpreter goes to (the player's `UNITY_OBJECTS.PLAYER`). */
const PLAYER = 'PlayerManager';
/** 📏 Measured on localhost: 3.6–3.9 s to `on_load_player`. A school machine gets many times that before it is given up on. */
const LOAD_TIMEOUT_MS = 60_000;

/** The player's configuration marks a delivery that shipped it: JSON naming its data and code, never a fallback page. */
async function playerShipped(fetchFile: VlibrasPlayerPorts['fetch'], url: string): Promise<boolean> {
  if (!fetchFile) return false;
  try {
    const resp = await fetchFile(url);
    if (!resp.ok) return false;
    const config = await resp.json() as { dataUrl?: unknown; wasmCodeUrl?: unknown } | null;
    return typeof config?.dataUrl === 'string' && typeof config.wasmCodeUrl === 'string';
  } catch {
    return false;
  }
}

/** What one of the player's messages means to the interpreter: it loaded, it cannot run, a text was played through, or nothing. */
type PlayerNews = { readonly kind: 'loaded' | 'played' } | { readonly kind: 'failed'; readonly why: string } | null;

function newsOf(data: unknown): PlayerNews {
  const m = data as { type?: unknown; event?: unknown; data?: unknown } | null;
  if (m?.type !== 'unity_event') return null;
  if (m.event === 'on_load_player') return { kind: 'loaded' };
  if (m.event === 'on_error') return { kind: 'failed', why: String(m.data) };
  return m.event === 'counter_gloss' && lastTokenPlayed(m.data) ? { kind: 'played' } : null;
}

/** `counter_gloss` is `[done, total]`; the text is through when `done` reaches a `total` above zero — `[0, 0]` is the start. */
function lastTokenPlayed(counter: unknown): boolean {
  if (!Array.isArray(counter)) return false;
  const [done, total] = counter as unknown[];
  return typeof done === 'number' && typeof total === 'number' && total > 0 && done >= total;
}

/** Builds the interpreter over the VLibras player the delivery shipped — or, where it shipped none, `NO_INTERPRETER`'s answer. */
export function createVlibrasInterpreter(ports: VlibrasPlayerPorts): Interpreter {
  const { doc, win } = ports;
  const folder = ports.playerFolder ?? LIBRAS_PLAYER_FOLDER;
  /**
   * The addresses, resolved at the FIRST request and not at build: a root boots on a host whose document has no address (a
   * test's double), and an address it cannot resolve is a player it cannot find — an answer, never a failed boot.
   */
  let where: {
    readonly page: string; readonly origin: string; readonly config: string; readonly glosses: string; readonly signs: string;
  } | null = null;
  const addresses = (): typeof where => {
    if (where) return where;
    try {
      const page = new URL(`${folder}index.html`, ports.base);
      where = { page: page.href, origin: page.origin, config: new URL('playerweb.json', page).href,
        glosses: new URL(LIBRAS_GLOSSES_FILE, page).href, signs: new URL(LIBRAS_SIGNS_FOLDER, ports.base).href };
    } catch { /* no address to resolve against: no player can be found, and the request says so below */ }
    return where;
  };
  const loadTimeoutMs = ports.loadTimeoutMs ?? LOAD_TIMEOUT_MS;

  let shipped: Promise<boolean> | null = null;
  /** The delivery's glosses, read once — alongside the player's first load, never before the player is known to be there. */
  let glosser: Promise<Glosser> | null = null;
  let frame: HTMLIFrameElement | null = null;
  let loading: Promise<SignResult> | null = null;
  /** Hears the load's outcome while the frame is loading. */
  let loadHeard: ((r: SignResult) => void) | null = null;
  /** The request being signed now, answered when its last token was played. */
  let playing: ((r: SignResult) => void) | null = null;
  /** Moves on every `hide()` and at `dispose()`: a request that waited across one is not played. */
  let generation = 0;
  let disposed = false;

  const send = (method: string, params?: string): void => {
    if (where) frame?.contentWindow?.postMessage({ type: 'unity', object: PLAYER, method, params }, where.origin);
  };
  const answerPlaying = (r: SignResult): void => { const answer = playing; playing = null; answer?.(r); };

  const heard = (e: MessageEvent): void => {
    if (!frame || !where || e.source !== frame.contentWindow || e.origin !== where.origin) return;
    const news = newsOf(e.data);
    if (news?.kind === 'loaded') loadHeard?.({ signed: true });
    else if (news?.kind === 'failed') loadHeard?.({ signed: false, reason: `the Libras player cannot run here: ${news.why}` });
    else if (news?.kind === 'played') answerPlaying({ signed: true });
  };

  const removeFrame = (): void => {
    win.removeEventListener('message', heard);
    frame?.remove();
    frame = null;
    loading = null;
    loadHeard = null;
  };

  /** Opens the player once, and answers when it has loaded and been told where the signs are — or why it could not. */
  const load = (at: NonNullable<typeof where>): Promise<SignResult> => {
    if (loading) return loading;
    loading = new Promise<SignResult>((resolve) => {
      const made = doc.createElement('iframe');
      made.title = ports.title();
      made.tabIndex = -1; // the keyboard stays with the game: the player is watched, never operated
      Object.assign(made.style, {
        position: 'fixed', right: '0', bottom: '0', width: 'max(25vw, 200px)', height: 'max(50vh, 200px)', border: '0',
        background: 'transparent', pointerEvents: 'none', zIndex: '2147483000',
      });
      frame = made;
      const timer = win.setTimeout(() => {
        finish({ signed: false, reason: `the Libras player did not load within ${Math.round(loadTimeoutMs / 1000)} s` });
      }, loadTimeoutMs);
      const finish = (r: SignResult): void => {
        win.clearTimeout(timer);
        loadHeard = null;
        if (r.signed) send('setBaseUrl', at.signs);
        else removeFrame(); // the next press tries again, from a fresh frame
        resolve(r);
      };
      loadHeard = finish;
      win.addEventListener('message', heard);
      made.src = at.page;
      doc.body.append(made);
    });
    return loading;
  };

  const released = (): SignResult => ({ signed: false, reason: 'the interpreter was taken off the screen before it signed' });
  /** Whether a request that started at `asked` was overtaken by a `hide()` or the root's end while it waited. */
  const overtaken = (asked: number): boolean => disposed || asked !== generation;

  return {
    sign: async (text) => {
      // nothing to sign is not a failure, and nothing goes to `problems`
      if (!provisionalGloss(text)) return { signed: true };
      const asked = generation;
      const at = addresses();
      if (!at || !(await (shipped ??= playerShipped(ports.fetch, at.config)))) {
        return NO_INTERPRETER.sign(text);
      }
      if (overtaken(asked)) return released();
      const glossing = (glosser ??= loadGlosser(ports.fetch, at.glosses));
      const ready = await load(at);
      if (!ready.signed) return ready;
      const glossOf = await glossing;
      if (overtaken(asked) || !frame) return released();
      const gloss = glossOf(text) || provisionalGloss(text);
      frame.hidden = false;
      // 📌 A new press replaces what was being signed — the Dev: the sonar signs what is on screen, not a queue. The one it
      // replaced is not a failure: the child asked again.
      answerPlaying({ signed: true });
      return new Promise<SignResult>((resolve) => {
        playing = resolve;
        send('playNow', gloss);
      });
    },
    hide: () => {
      generation += 1;
      if (!frame) return;
      send('stopAll');
      frame.hidden = true;
      answerPlaying(released());
    },
    dispose: () => {
      disposed = true;
      generation += 1;
      answerPlaying(released());
      loadHeard?.(released());
      removeFrame();
    },
  };
}
