// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/help-panel — WHICH BUTTON DOES WHAT, in this game, on this child's keyboard: a slide show, one slide per button.
//
// ========================= WHY THIS MODULE EXISTS =========================
// 🔴 MEASURED 2026-09-12: the pause card carries a `ajuda` item and NOTHING in the engine can action it, so
// `itensQueAccionam` hides it in every game. The help screen that used to fill it — `openHelp()` — did not
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
export const SEM_TECLA = 'help.noKey';

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

/** Builds the slide show's frame: the stop, its two arrows, the slide and the dots. `mostrarSlide` fills it. */
export function montarSlides(ctx: SlideCtx): HTMLElement {
  const el = ctx.criar('div');
  el.className = 'slides';
  el.setAttribute('role', 'spinbutton');
  el.setAttribute('tabindex', '0');
  el.setAttribute('data-passos', '');
  const seta = (delta: -1 | 1, glifo: string): HTMLElement => {
    const s = ctx.criar('span');
    s.className = 'passo-seta';
    s.setAttribute('data-passo', String(delta));
    s.setAttribute('aria-hidden', 'true');
    s.textContent = glifo;
    s.addEventListener('click', () => el.dispatchEvent(new CustomEvent('passo', { detail: delta, bubbles: true })));
    return s;
  };
  const slide = ctx.criar('div');
  slide.className = 'slide';
  slide.setAttribute('aria-hidden', 'true'); // heard through the stop's value, once
  const tecla = ctx.criar('kbd');
  tecla.className = 'slide-tecla';
  const palavra = ctx.criar('p');
  palavra.className = 'slide-palavra';
  const texto = ctx.criar('p');
  texto.className = 'slide-texto';
  const pontos = ctx.criar('div');
  pontos.className = 'slide-pontos';
  for (const filho of [tecla, palavra, texto, pontos]) slide.appendChild(filho);
  el.appendChild(seta(-1, '◀'));
  el.appendChild(slide);
  el.appendChild(seta(1, '▶'));
  return el;
}

/**
 * Shows slide `i` (held at the ends, like every steps control: the last slide is a wall, not a way back to the first) and returns
 * the index shown, and what a screen reader hears of it.
 */
export function mostrarSlide(
  el: HTMLElement,
  rows: readonly HelpRow[],
  i: number,
  ctx: SlideCtx & { readonly t: (k: string, p?: Record<string, string>) => string; readonly titulo: string },
): { readonly indice: number; readonly falado: string } {
  const ultimo = Math.max(0, rows.length - 1);
  const indice = Math.max(0, Math.min(ultimo, i));
  const r = rows[indice];
  const slide = el.querySelector<HTMLElement>('.slide');
  const tecla = el.querySelector<HTMLElement>('.slide-tecla');
  const palavra = el.querySelector<HTMLElement>('.slide-palavra');
  const texto = el.querySelector<HTMLElement>('.slide-texto');
  const pontos = el.querySelector<HTMLElement>('.slide-pontos');
  if (!r || !slide || !tecla || !palavra || !texto || !pontos) return { indice, falado: '' };
  slide.setAttribute('data-act', r.action);
  tecla.textContent = r.key ?? ctx.t(SEM_TECLA);
  if (r.key) tecla.removeAttribute('data-sem-tecla');
  else tecla.setAttribute('data-sem-tecla', '1');
  palavra.textContent = r.word;
  texto.textContent = r.hint ?? '';
  texto.hidden = !r.hint;
  while (pontos.firstChild) pontos.removeChild(pontos.firstChild);
  rows.forEach((_, n) => {
    const p = ctx.criar('span');
    p.className = n === indice ? 'slide-ponto is-on' : 'slide-ponto';
    pontos.appendChild(p);
  });
  // a game's sentence that already ends in a full stop is not given a second one
  const falado = [r.word, r.hint, r.key ? ctx.t('help.slide.tecla', { k: r.key }) : ctx.t(SEM_TECLA)]
    .filter(Boolean).map((parte) => parte!.replace(/[.!?…]+\s*$/, '')).join('. ');
  el.setAttribute('aria-label', ctx.titulo);
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', String(ultimo));
  el.setAttribute('aria-valuenow', String(indice));
  el.setAttribute('aria-valuetext', falado);
  el.querySelector<HTMLElement>('[data-passo="-1"]')?.classList.toggle('no-limite', indice === 0);
  el.querySelector<HTMLElement>('[data-passo="1"]')?.classList.toggle('no-limite', indice === ultimo);
  return { indice, falado };
}
