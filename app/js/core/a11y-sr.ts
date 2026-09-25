// SPDX-License-Identifier: AGPL-3.0-or-later
// core/a11y-sr.ts — announcements for the SCREEN READER. `say` = the "polite" aria-live region (`#sr-status`);
// `alert` = the "assertive" region (`#sr-alert`). Clear → next frame → write forces the reader to announce the same text
// again when it repeats.
//
// 🔴 A FACTORY (ADR-0232 D4, issue #207): the announcer used to be two module functions over the GLOBAL document, the
// global `requestAnimationFrame` and a module-level Libras mirror a host registered — so a root building in another
// document (an iframe, an editor beside the game) announced into the page's regions, and two roots shared one mirror.
// Now each root builds its own over the document and the frames its host lends. The factory stays PUBLISHED for a game
// that must announce with no root at all — its boot failed before `createGame` returned (game-chess's rootless alert).
//
// THE LIBRAS MIRROR IS AN EXPLICIT SINK OF EACH ANNOUNCER, and nothing connects it by default. Today a game that wants
// its announcements signed connects it (`Engine.mirrorAnnouncements(engine.libras.say)`); the games that do not, do not
// sign — the behaviour before this factory, kept on purpose until the Dev decides (D4 decision DD1). Having the root
// mirror everything is the one line `announcer.mirrorTo(libras.say)` in the root. The sink arrives by injection so this
// core module never imports ui/ (ADR-0173).

/** What an announcer writes through: the document holding the two regions, and the host's next frame. */
export interface AnnouncerPorts {
  /** The document whose `#sr-status` and `#sr-alert` are written. A document without them announces nothing, silently. */
  readonly doc: Pick<Document, 'querySelector'>;
  /**
   * The host's `requestAnimationFrame`, AS THE HOST HAS IT: the clear-then-write dance needs one frame between. REQUIRED, and
   * `undefined` is an answer — a host with no frames (a test double): the announcer then writes at once,
   * which is the only honest thing left to do. The absence is answered HERE so that no composition root grows a branch for it
   * (ADR-0221: the root carries wiring, not decisions).
   */
  readonly raf: ((cb: FrameRequestCallback) => number) | undefined;
}

/** One root's announcer. */
export interface Announcer {
  /** "Polite" announcement (status): does not interrupt what the reader is saying. */
  readonly say: (text: string) => void;
  /** "Assertive" announcement (alert): interrupts and speaks now (errors, important warnings). */
  readonly alert: (text: string) => void;
  /**
   * Sends every announcement of THIS announcer also to `sink` (the Libras interpreter's `say`), until the returned release
   * is called. One sink at a time: a second call replaces the first, and releasing a replaced sink changes nothing.
   */
  readonly mirrorTo: (sink: (text: string) => void) => () => void;
}

const NO_MIRROR = (): void => { /* nothing signs until a sink is connected */ };

export function createAnnouncer({ doc, raf }: AnnouncerPorts): Announcer {
  const nextFrame = (cb: () => void): void => { if (raf) raf(() => { cb(); }); else cb(); };
  let mirror: (text: string) => void = NO_MIRROR;
  const write = (region: string, text: string): void => {
    const el = doc.querySelector<HTMLElement>(region);
    if (el) { el.textContent = ''; nextFrame(() => { el.textContent = text; }); }
    mirror(text);
  };
  return {
    say: (text) => { write('#sr-status', text); },
    alert: (text) => { write('#sr-alert', text); },
    mirrorTo: (sink) => {
      mirror = sink;
      return () => { if (mirror === sink) mirror = NO_MIRROR; };
    },
  };
}
