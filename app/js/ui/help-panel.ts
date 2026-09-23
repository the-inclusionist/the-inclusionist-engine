// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/help-panel — WHICH BUTTON DOES WHAT, in this game, on this child's keyboard: a slide show, one slide per button.
//
// ========================= WHY THIS MODULE EXISTS =========================
// 🔴 MEASURED 2026-09-12: the pause card carries a `ajuda` item and NOTHING in the engine can action it, so
// `itemsThatAct` hides it in every game. The help screen that used to fill it — `openHelp()` — did not
// die: it LEFT WITH THE CARTRIDGE (#111) and now lives in `game-platformer/app/js/main.ts`. So each of the
// three hundred games would have to write its own, which is the arrangement ADR-0139 measured failing in five
// games of six.
//
// 🎯 AND THE ENGINE ALREADY HAS EVERY INGREDIENT, which is what makes this cheap rather than new:
//   · WHICH positions this game uses, and the game's own WORD for each — `ActionPreset` (ADR-0085).
//   · The sentence that explains one — the `hint` of that preset, a field declared, typed, documented and,
//     until this module, never displayed anywhere.
//   · WHICH KEY reaches it FOR THIS CHILD — `input/keyboard-runtime.kbFor(seat)`, i.e. her remap and not the
//     factory default.
//
// ⚠️ THE ENGINE NEVER NAMES AN ACTION HERE, and that is the whole boundary (ADR-0074, ADR-0086). It knows a
// POSITION exists; only the game knows the word. A row whose word is missing is therefore ABSENT — never a
// row reading «action2», which is the defect `labellerFrom` returns `null` to prevent.
//
// 📌 AND THIS IS THE MIGRATION `ui/settings-controls.ACT_LABEL` HAS BEEN WAITING FOR. That table holds ONE
// game's words — `act.run`, `act.jump` — inside the engine, and its own header says it can only leave once
// the help screen asks the GAME instead. This module is a help screen that asks the game.
import { ACTIONS, type Action, type ActionPreset } from '../core/actions.js';

/** One line of the help table. `key` is `null` when this child's keyboard does not reach the position. */
export interface HelpRow {
  readonly action: Action;
  /** Already human-readable (`keyName`), or `null` — «this transport does not reach it» is information. */
  readonly key: string | null;
  /** The GAME's word. Never an identifier: a position without one produces no row at all. */
  readonly word: string;
  /** The game's own sentence for this position, when it declared one. */
  readonly hint?: string;
}

/**
 * The help table for one seat.
 *
 * ⚠️ WALKS `ACTIONS` AND NOT THE PRESET'S OWN KEYS, for the reason `presetActions` already carries: the
 * canonical order is the one the child meets everywhere else — the remap screen, the pad wizard, the
 * on-screen legend. A help screen ordered by whatever order the game happened to write its object in would
 * teach a different order from every other surface.
 *
 * @param preset  what this game declares — positions, words, hints.
 * @param keysOf  the codes bound to a position FOR THIS SEAT. `kbFor(seat)[action]`, so a child who remapped
 *                sees her own key. `null`/empty means the keyboard does not reach it.
 * @param keyName code → readable label (`ui/settings-controls.keyName`), injected so this half stays pure.
 */
export function helpRows(
  preset: ActionPreset | null | undefined,
  keysOf: (a: Action) => readonly string[] | null | undefined,
  keyName: (code: string) => string,
): HelpRow[] {
  if (!preset) return [];
  const rows: HelpRow[] = [];
  for (const action of ACTIONS) {
    const word = preset[action];
    // ⚠️ A BLANK LABEL IS THE SAME AS NO LABEL, and it is the case `presetProblems` already names: a row
    // whose word is whitespace reads, to a screen reader, as a button with no name.
    if (!word || !word.label.trim()) continue;
    // 📌 THE FIRST CODE, and the rest are not lost — they are the same position, and a help screen that listed
    // every alias would spend the child's attention on the keyboard instead of on the game. The remap screen
    // is where all of them are visible, because THERE they are the subject.
    const codes = keysOf(action);
    const key = codes && codes.length ? keyName(codes[0]!) : null;
    rows.push({ action, key, word: word.label, ...(word.hint ? { hint: word.hint } : {}) });
  }
  return rows;
}

/** What the slide says where the keyboard reaches nothing. A KEY, not a sentence — the caller translates it. */
export const NO_KEY = 'help.noKey';

/*
 * HELP IS A SLIDE SHOW, NOT A MENU (interface log, 2026-09-13). The Dev: the help screen «se assemelha a um menu e inclusive tem
 * um botão "restaurar padrões deste menu" quando na verdade deveria conter uma "apresentação de slides" (textos, figuras e no
 * máximo animações)». One slide per position the game names: the child's key drawn as a key cap (the figure), the game's word
 * and its sentence (the text). The slide show is ONE stop of the cursor, `[data-passos]`, so left and right turn the page through
 * the navigation every panel already has, and the arrows are finger targets; the dots say where the child is without a number
 * (ADR-0167).
 */

/** What building the slide show needs from the document — injected, as the panel shell takes it. */
export interface SlideCtx {
  readonly criar: (tag: string) => HTMLElement;
}

/** The surface a «how to play» figure draws on, and the time in seconds since the slide showed (still under reduced motion). */
export interface HowToPlaySurface {
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly time: number;
}

/**
 * One «how to play» slide, declared by the cartridge (ADR-0195; issue #188): «O "Como jogar" é justamente algo a ser feito pelo
 * cartucho.» The text is resolved at every showing, so it follows the language; the figure is drawn by the game on the engine's
 * surface — art stays data the game draws, never an embedded picture — and may animate by the time it is given.
 */
export interface HowToPlaySlide {
  readonly text: () => string;
  readonly figure?: (surface: HowToPlaySurface) => void;
}

/** Why a `howToPlay` declaration is malformed; empty when well formed. Absent is well formed: the help shows the buttons alone. */
export function howToPlayProblems(slides: unknown): string[] {
  if (slides === undefined) return [];
  if (!Array.isArray(slides)) return ['howToPlay must be a list of slides'];
  const out: string[] = [];
  slides.forEach((s: Record<string, unknown> | null, i) => {
    const at = `howToPlay[${i}]`;
    if (!s || typeof s !== 'object') { out.push(`${at} must be a slide`); return; }
    if (typeof s.text !== 'function') out.push(`${at}.text must be a function returning the slide's text, in the page's language`);
    if (s.figure !== undefined && typeof s.figure !== 'function') out.push(`${at}.figure must be a function drawing on the surface it is given`);
  });
  return out;
}

const isFromGame = (s: HelpRow | HowToPlaySlide): s is HowToPlaySlide => typeof (s as HowToPlaySlide).text === 'function';

/** What the engine's frame loop gives an animated figure; injected, so the loop is the page's. */
export interface FigureClock {
  readonly requestFrame: (cb: (ms: number) => void) => number;
  readonly cancelFrame: (id: number) => void;
  /** Reduced motion: the figure is drawn once, at time 0, and never again. */
  readonly reduced: boolean;
}

/**
 * Draws the shown slide's figure, and keeps drawing it while the slide show is in the document and the same slide is shown.
 * Returns a stop. A figure that throws is a cartridge defect: it stops drawing and the text stays.
 */
export function animateFigure(el: HTMLElement, slide: HowToPlaySlide, clock: FigureClock): () => void {
  const screen = el.querySelector<HTMLCanvasElement>('.slide-figura');
  const ctx = screen?.getContext('2d');
  if (!screen || !ctx || !slide.figure) return () => {};
  const figureFn = slide.figure;
  // the drawing surface is the size it is shown at, in CSS pixels, so a figure's coordinates are the ones the child sees
  const caixa = screen.getBoundingClientRect();
  if (caixa.width > 0 && caixa.height > 0) { screen.width = Math.round(caixa.width); screen.height = Math.round(caixa.height); }
  let id = 0, still = false, start = -1;
  const draw = (ms: number): void => {
    if (still || !el.isConnected) return;
    if (start < 0) start = ms;
    const time = clock.reduced ? 0 : (ms - start) / 1000;
    ctx.clearRect(0, 0, screen.width, screen.height);
    try { figureFn({ ctx, width: screen.width, height: screen.height, time }); } catch { still = true; return; }
    if (!clock.reduced) id = clock.requestFrame(draw);
  };
  draw(0);
  return () => { still = true; clock.cancelFrame(id); };
}

/** Builds the slide show's frame: the stop, its two arrows, the slide and the dots. `showSlide` fills it. */
export function mountSlides(ctx: SlideCtx): HTMLElement {
  const el = ctx.criar('div');
  el.className = 'slides';
  el.setAttribute('role', 'spinbutton');
  el.setAttribute('tabindex', '0');
  el.setAttribute('data-passos', '');
  const arrow = (delta: -1 | 1, glyph: string): HTMLElement => {
    const s = ctx.criar('span');
    s.className = 'passo-seta';
    s.setAttribute('data-passo', String(delta));
    s.setAttribute('aria-hidden', 'true');
    s.textContent = glyph;
    s.addEventListener('click', () => el.dispatchEvent(new CustomEvent('passo', { detail: delta, bubbles: true })));
    return s;
  };
  const slide = ctx.criar('div');
  slide.className = 'slide';
  slide.setAttribute('aria-hidden', 'true'); // heard through the stop's value, once
  const figureFn = ctx.criar('canvas');
  figureFn.className = 'slide-figura';
  figureFn.hidden = true;
  const keyGlyphOf = ctx.criar('kbd');
  keyGlyphOf.className = 'slide-tecla';
  const palavra = ctx.criar('p');
  palavra.className = 'slide-palavra';
  const texto = ctx.criar('p');
  texto.className = 'slide-texto';
  const dots = ctx.criar('div');
  dots.className = 'slide-pontos';
  for (const child of [figureFn, keyGlyphOf, palavra, texto, dots]) slide.appendChild(child);
  el.appendChild(arrow(-1, '◀'));
  el.appendChild(slide);
  el.appendChild(arrow(1, '▶'));
  return el;
}

/**
 * Shows slide `i` (held at the ends, like every steps control: the last slide is a wall, not a way back to the first) and returns
 * the index shown, and what a screen reader hears of it. A slide is a button row (`helpRows`) or a cartridge's «how to play» slide
 * (ADR-0195), which the help puts first.
 */
export function showSlide(
  el: HTMLElement,
  rows: readonly (HelpRow | HowToPlaySlide)[],
  i: number,
  ctx: SlideCtx & { readonly t: (k: string, p?: Record<string, string>) => string; readonly titulo: string },
): { readonly indice: number; readonly falado: string } {
  const last = Math.max(0, rows.length - 1);
  const indice = Math.max(0, Math.min(last, i));
  const r = rows[indice];
  const slide = el.querySelector<HTMLElement>('.slide');
  const figureFn = el.querySelector<HTMLCanvasElement>('.slide-figura');
  const keyGlyphOf = el.querySelector<HTMLElement>('.slide-tecla');
  const palavra = el.querySelector<HTMLElement>('.slide-palavra');
  const texto = el.querySelector<HTMLElement>('.slide-texto');
  const dots = el.querySelector<HTMLElement>('.slide-pontos');
  if (!r || !slide || !figureFn || !keyGlyphOf || !palavra || !texto || !dots) return { indice, falado: '' };
  while (dots.firstChild) dots.removeChild(dots.firstChild);
  rows.forEach((_, n) => {
    const p = ctx.criar('span');
    p.className = n === indice ? 'slide-ponto is-on' : 'slide-ponto';
    dots.appendChild(p);
  });
  // a sentence that already ends in a full stop is not given a second one
  const joinParts = (parts: readonly (string | undefined)[]): string =>
    parts.filter(Boolean).map((part) => part!.replace(/[.!?…]+\s*$/, '')).join('. ');
  let falado: string;
  if (isFromGame(r)) {
    slide.setAttribute('data-kind', 'play');
    slide.removeAttribute('data-act');
    figureFn.hidden = !r.figure;
    keyGlyphOf.hidden = true;
    palavra.hidden = true;
    const phrase = r.text();
    texto.textContent = phrase;
    texto.hidden = false;
    falado = joinParts([phrase]);
  } else {
    slide.setAttribute('data-kind', 'button');
    slide.setAttribute('data-act', r.action);
    figureFn.hidden = true;
    keyGlyphOf.hidden = false;
    palavra.hidden = false;
    keyGlyphOf.textContent = r.key ?? ctx.t(NO_KEY);
    if (r.key) keyGlyphOf.removeAttribute('data-sem-tecla');
    else keyGlyphOf.setAttribute('data-sem-tecla', '1');
    palavra.textContent = r.word;
    texto.textContent = r.hint ?? '';
    texto.hidden = !r.hint;
    falado = joinParts([r.word, r.hint, r.key ? ctx.t('help.slide.tecla', { k: r.key }) : ctx.t(NO_KEY)]);
  }
  el.setAttribute('aria-label', ctx.titulo);
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', String(last));
  el.setAttribute('aria-valuenow', String(indice));
  el.setAttribute('aria-valuetext', falado);
  el.querySelector<HTMLElement>('[data-passo="-1"]')?.classList.toggle('no-limite', indice === 0);
  el.querySelector<HTMLElement>('[data-passo="1"]')?.classList.toggle('no-limite', indice === last);
  return { indice, falado };
}
