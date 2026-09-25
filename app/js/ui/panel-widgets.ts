// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/panel-widgets — ONE MENU ROW, built instead of required.
//
// ========================= WHAT THIS FIXES, ONE LEVEL BELOW `panel-shell` =========================
// `ui/panel-shell` cured the FRAME's invisible contract. The same invisible contract exists INSIDE: a settings panel
// reaches controls it does not create, each needing the right tag (`#cane-div` has to be a `<select>`, `#tts-vol` an
// `<input>`). Nothing in the type says so, and the failure mode is the same — the panel opens and the row is simply not
// there. This kit builds the row, so nobody has to provide it by hand.
//
// ========================= THE MENU RULE OF `CLAUDE.md` §4, BY CONSTRUCTION =========================
// «A explicação mora no RODAPÉ, e fica lá.» The row carries the short label in `<strong>` and nothing else in view; all
// the prose goes into a SINGLE `.opt-hint` inside the `<span>`, which the shell (`ui/settings-panel.fillExplain`) MOVES
// to the `.opt-explain` footer.
//
// ⚠️ AND HERE IT STOPS DEPENDING ON SOMEONE REMEMBERING: this function has no way to receive a second block of prose,
// nor a loose `<p>`. The other way turns the menu into a manual, closer to a configuration file than to a videogame
// menu.
//
// No `innerHTML`: everything through `create` + `textContent`, like `ui/panel-shell`. The text arrives from the CALLER
// already translated, so this module can be exercised with no dictionary.
import type { PanelShellCtx } from './panel-shell.js';

/**
 * The control's SHAPE, not its tag — because the question a panel asks is "does this turn on and off?", not "is this a
 * `<button>`?".
 *
 * 📏 The first three came from measuring the panels: `interruptor` (a switch) covers most of the controls they reach,
 * `escolha` (a select) and `cursor` (a slider) the rest. A new shape enters when a panel demands it, not before.
 */
export type ControlShape = 'interruptor' | 'escolha' | 'cursor' | 'radio' | 'button';

export interface ControlRowSpec {
  /** The CONTROL's id — `opt-facil`, `cane-div`. It is how the `settings-*` finds it. */
  readonly id: string;
  /** The SHORT label, already translated. It goes in the `<strong>`, and it is the only thing in view on the row. */
  readonly label: string;
  /**
   * The explanation, already translated. It goes into a SINGLE `.opt-hint`, which `fillExplain` moves to the footer.
   *
   * 📌 Absent = this row has no explanation, which is a legitimate answer. The footer then rests on the panel's text
   * (`data-explain-idle`) while the cursor is on it.
   */
  readonly hint?: string;
  /** The control's shape. Absent: `interruptor`, the most common case. */
  readonly shape?: ControlShape;
  /**
   * The name a screen reader announces, when it is not the label.
   *
   * ⚠️ IT EXISTS BECAUSE A SWITCH'S TEXT IS ITS STATE, not its name: a `<button>` whose `textContent` says "Off"
   * announces "Off, button" and the person does not know off WHAT. The `<strong>` beside it solves that for whoever SEES
   * the whole row; for whoever navigates control by control, this attribute solves it. Absent, it falls back to
   * `label` — which is the right answer, not a fallback.
   */
  readonly ariaLabel?: string;
}

export interface ControlRow {
  /** The whole `.ctrl-row`. It is where ADR-0029's `markChanged` puts the left-the-default mark. */
  readonly row: HTMLElement;
  /** The control itself, with the requested id. */
  readonly control: HTMLElement;
}

/**
 * Builds a menu row: a short label, a hint that goes to the footer, and a control.
 *
 * The row is NOT inserted anywhere — whoever mounts it decides the order, which in this project's menus is part of the
 * decision (ADR-0044 §2).
 */
export function controlRow(ctx: PanelShellCtx, spec: ControlRowSpec): ControlRow {
  const rowNode = ctx.create('div');
  rowNode.className = 'ctrl-row';

  const text = ctx.create('span');
  const shortLabel = ctx.create('strong');
  shortLabel.textContent = spec.label;
  text.appendChild(shortLabel);
  if (spec.hint) {
    // ⚠️ ONLY ONE, and it is what `fillExplain` looks for. Two `.opt-hint`s on one row would give the control two
    // descriptions, and the footer would show the first — the other would stay on the row, exactly the defect rule §4
    // exists to prevent.
    const explanation = ctx.create('span');
    explanation.className = 'opt-hint';
    explanation.textContent = spec.hint;
    text.appendChild(explanation);
  }
  rowNode.appendChild(text);

  const control = buildControl(ctx, spec);
  control.id = spec.id;
  control.setAttribute('aria-label', spec.ariaLabel ?? spec.label);
  rowNode.appendChild(control);

  return { row: rowNode, control: control };
}

/**
 * REWRITES THE WORDS OF A ROW THAT ALREADY EXISTS — the counterpart of `ui/panel-shell.applyLabels`, one level down.
 *
 * 🔴 The inside of a panel is mounted once, and anything mounted at boot captures the fallback language's text:
 * `initI18n` applies the fallback synchronously and REQUESTS the preferred one, which arrives later — a panel would serve
 * its TITLE in one language and its ROWS in another, on the same screen.
 *
 * ⚠️ AND NO UNIT TEST CATCHES IT, because they all run in a single language.
 *
 * ⚠️ REWRITE AND NOT REBUILD, for the reason `applyLabels` already states: each `ui/settings-*` wires its controls'
 * clicks ONCE, at boot. Remaking the row would leave a control in the document with no listener — a dead button that
 * looks alive (ADR-0106 §5).
 */
export function labelRow(rowNode: HTMLElement, spec: ControlRowSpec): void {
  const shortLabel = rowNode.querySelector<HTMLElement>('strong');
  if (shortLabel) shortLabel.textContent = spec.label;
  const explanation = rowNode.querySelector<HTMLElement>('.opt-hint');
  // ⚠️ A hint that DISAPPEARS has to be erased, not just left unwritten: on a retranslation into a dictionary without
  // the key, the old text would survive and the footer would rest in the previous language.
  if (explanation) explanation.textContent = spec.hint ?? '';
  // The control is found by COMPARING its id, not by building a selector from it: a selector needs the id escaped, escaping
  // needs `CSS.escape`, and `CSS` is a browser global that THROWS where it does not exist — it took down a boot in a case's fake
  // document once (2026-09-21). No selector, nothing to escape, no global (ADR-0221 step 7d).
  const control = [...rowNode.querySelectorAll<HTMLElement>('[id]')].find((el) => el.id === spec.id);
  if (control) control.setAttribute('aria-label', spec.ariaLabel ?? spec.label);
}

function buildControl(ctx: PanelShellCtx, spec: ControlRowSpec): HTMLElement {
  const controlShape = spec.shape ?? 'interruptor';
  if (controlShape === 'escolha') {
    const s = ctx.create('select');
    s.className = 'vol';
    return s;
  }
  if (controlShape === 'cursor') {
    const i = ctx.create('input');
    i.className = 'vol';
    i.setAttribute('type', 'range');
    // The volume slider's bounds, the same the audio panel reads: 0..100 in steps of 1, converted to the project's
    // 0..1 volume by the panel.
    i.setAttribute('min', '0');
    i.setAttribute('max', '100');
    i.setAttribute('step', '1');
    return i;
  }
  if (controlShape === 'button') {
    /*
     * 🎯 THE ONE SHAPE THAT HOLDS NO VALUE: the others answer "which position am I in", this one DOES something.
     * `ui/settings-controls` demands it — its button opens the capture of a key.
     *
     * 📌 No `aria-pressed` and no `role`: a button that acts already IS a button to whoever listens, and an announced
     * state that does not exist is worse than no state. The panel puts the FACE on it — for remapping, the current
     * keys —, because only the panel knows what the button shows.
     */
    const a = ctx.create('button');
    a.className = 'mode-btn';
    a.setAttribute('type', 'button');
    return a;
  }
  if (controlShape === 'radio') {
    /*
     * 🔴 A CHOICE IS NOT A SWITCH, and the difference is what the ADR-0012 amendment says in so many words: «THE MENU IS
     * A CHOICE, NOT A TOGGLE […] One font is active; the others are alternatives, not switches.» Hence three
     * differences: no `switch` class (which draws a 52×28 px knob, the drawing of a state that does not exist),
     * `role="radio"`, and `aria-checked` instead of `aria-pressed` — independent switches would announce on/off to
     * choose ONE thing.
     *
     * 📌 `ui/settings-typo` demands it. The panel, not the kit, groups the `role="radio"`s in a `role="radiogroup"`,
     * because the panel knows whether exclusivity covers a section or the whole menu.
     */
    const r = ctx.create('button');
    r.className = 'mode-btn';
    r.setAttribute('type', 'button');
    r.setAttribute('role', 'radio');
    r.setAttribute('aria-checked', 'false');
    return r;
  }
  const b = ctx.create('button');
  // `switch` is the class this project's CSS gives switches, and `aria-pressed` is what tells the state to whoever
  // listens. The panel reflects the value; what is born here is the HONEST state of something that has read nothing
  // yet: off.
  b.className = 'mode-btn switch';
  b.setAttribute('type', 'button');
  b.setAttribute('aria-pressed', 'false');
  return b;
}

/* ===================== THE SECTION HEADER — whose turn it is to act ===================== */

/**
 * The header of a panel section: a title and a tag that qualifies it.
 *
 * 📏 It is in the kit because several panels wrote it by hand, with the `.panel-sub__tag` markup copied into each — the
 * same reason as `controlRow`: a rule repeated across files is a rule that drifts.
 *
 * ⚠️ AND IT REFUSES TO EXIST OVER NOTHING, which is the behaviour that makes it worth a function. An "awaiting
 * negotiation" heading with no row under it tells the reader something is there when nothing is, and the person looks
 * for what the title promises. `rows` is the NUMBER of rows the section will have — passing it is what makes this rule
 * exercisable by a case, instead of an `if` no fixed tree reaches.
 *
 * 📌 The title and tag arrive ALREADY TRANSLATED, as in `controlRow`: the kit does not decide language, it builds shape.
 */
export function sectionHeader(ctx: PanelShellCtx, title: string, tag: string, rows: number): HTMLElement | null {
  if (rows === 0) return null;
  const h = ctx.create('h3');
  h.className = 'panel-sub';
  h.textContent = title + ' ';
  const mark = ctx.create('span');
  mark.className = 'panel-sub__tag';
  mark.textContent = tag;
  h.appendChild(mark);
  return h;
}

/* ===================== THE STEPS ⯇ ⯈ — choosing between positions with left and right (ADR-0151) ===================== */

/**
 * What a steps control needs: a name, the positions (already translated) and the current one.
 *
 * 🎯 THE DEV ASKED FOR IT, with an exact shape: the contrast boost «deve funcionar trocando entre desligado, linear,
 * misto e quadrático da mesma forma que se troca o número de jogadores, isto é, apertando botões direita e esquerda, e
 * não através de uma barra», and the rounded corners «também». A slider hides how many positions there are; a dropdown
 * hides them all until it opens. Steps always say where you are.
 *
 * 🔴 AND THE SHAPE IS A SINGLE LINE: «◀ Rótulo: valor ▶» (ADR-0130 errata, rule 3) — the Dev: «Não faça essa coisa
 * estranha. Escreva "< Rounded corner: off >"». It is the way to cycle between FEW positions — up to five; above that,
 * a dropdown.
 */
export interface StepsSpec {
  /** The control's spoken name — it goes to `aria-label`. */
  readonly label: string;
  /** The positions, in order, already translated. */
  readonly values: readonly string[];
  /** The index of the current position. */
  readonly current: number;
}

/**
 * The next step, CLAMPED at the ends — not a ring, and the difference is the decision.
 *
 * ⚠️ In a ring, right from the largest position would return to off: whoever adjusts looking for the maximum would pass
 * it without warning and switch off what they wanted to raise. Clamped, the end is a wall you feel — the number of
 * players, the model the Dev gave, does not wrap either.
 */
export function nextStep(from: number, total: number, delta: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, from + Math.sign(delta)));
}

/**
 * Builds the control: ONE focusable element (`role="spinbutton"`) with the two arrows inside.
 *
 * ⚠️ THE ARROWS ARE NOT BUTTONS, on purpose: menu navigation treats every `button` as an item, and three items for one
 * adjustment would make the cursor stop twice on nameless arrows. Focus belongs to the control; the arrows are FINGER
 * targets (`data-passo`), outside the accessibility tree — whoever listens gets the `aria-valuetext`.
 *
 * The control emits `passo` (`CustomEvent<number>`, -1 or +1): a tapped arrow emits it from here, and the keyboard's and
 * controller's left and right emit it through `ui/menu-nav`. The user listens to a single event.
 */
export function mountSteps(ctx: PanelShellCtx, spec: StepsSpec): HTMLElement {
  const el = ctx.create('div');
  el.className = 'passos';
  el.setAttribute('role', 'spinbutton');
  el.setAttribute('tabindex', '0');
  el.setAttribute('data-passos', '');
  const arrow = (delta: -1 | 1, glyph: string): HTMLElement => {
    const s = ctx.create('span');
    s.className = 'passo-seta';
    s.setAttribute('data-passo', String(delta));
    s.setAttribute('aria-hidden', 'true');
    s.textContent = glyph;
    s.addEventListener('click', () => el.dispatchEvent(new CustomEvent('passo', { detail: delta, bubbles: true })));
    return s;
  };
  const value = ctx.create('span');
  value.className = 'passo-valor';
  el.appendChild(arrow(-1, '◀'));
  el.appendChild(value);
  el.appendChild(arrow(1, '▶'));
  updateSteps(el, spec);
  return el;
}

/* ===================== ONE EXCLUSIVE CHOICE, DRAWN BY ITS SIZE (ADR-0130 rule 3 and erratum) ===================== */

/**
 * How many positions still CYCLE. The Dev's number (ADR-0130 erratum, 2026-09-12): «Acima de cinco itens deve ser dropdown».
 * Five or fewer are one row «◀ Label: value ▶» — every position is one step away and the row always says where it is;
 * more than five, a dropdown, because a cycle that long is walked more than it is chosen.
 */
export const MAX_CYCLE_POSITIONS = 5;

/** One position of an exclusive choice: what is stored, and what is shown and heard (already translated). */
export interface ChoicePosition {
  readonly value: string;
  readonly label: string;
}

/** An exclusive choice: its spoken name, its positions in order, and the value in use. */
export interface ChoiceSpec {
  readonly label: string;
  readonly values: readonly ChoicePosition[];
  readonly current: string;
}

/**
 * Builds the control for ONE EXCLUSIVE CHOICE, and its SIZE picks the control, not the panel's author (ADR-0130 rule 3):
 * up to `MAX_CYCLE_POSITIONS` a steps control (`mountSteps`), more a `<select>`. A choice whose size depends on the moment —
 * the game's named positions, the audio outputs plugged in — takes the control its size asks for NOW, drawn again when it
 * changes.
 *
 * Both shapes answer the same way, so whoever builds a row does not branch: `pick(value)` runs when the child chooses, the
 * value in use is in `data-value`, and a bubbling `change` follows the pick — a list that listens for `change` hears either.
 * A value not among the positions shows the first, as a `<select>` does.
 */
export function mountChoice(ctx: PanelShellCtx, spec: ChoiceSpec, pick: (value: string) => void): HTMLElement {
  if (spec.values.length <= MAX_CYCLE_POSITIONS) {
    const steps = mountSteps(ctx, stepsOf(spec));
    writeCycle(steps, spec);
    steps.addEventListener('passo', (ev) => {
      // read back from the element, never from this closure: an `updateChoice` since may have brought other words
      const live = readCycle(steps);
      const from = indexOfValue(live);
      const to = nextStep(from, live.values.length, (ev as CustomEvent<number>).detail);
      if (to === from) return; // at the wall nothing moved, and nothing is picked
      const value = live.values[to]!.value;
      writeCycle(steps, { ...live, current: value });
      pick(value);
      steps.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return steps;
  }
  const list = ctx.create('select') as HTMLSelectElement;
  list.className = 'vol';
  fillList(list, spec);
  list.addEventListener('change', () => { list.dataset.value = list.value; pick(list.value); });
  return list;
}

/** Where the current value sits among the positions; one not among them shows the first, as a `<select>` does. */
const indexOfValue = (s: ChoiceSpec): number => Math.max(0, s.values.findIndex((v) => v.value === s.current));
const stepsOf = (s: ChoiceSpec): StepsSpec => ({ label: s.label, values: s.values.map((v) => v.label), current: indexOfValue(s) });

/**
 * A cycle row keeps its whole choice ON THE ELEMENT — the positions in `data-positions`, the value in `data-value`, the
 * name in `aria-label` — so the control carries no state of its own that a redraw could leave behind.
 */
function writeCycle(el: HTMLElement, s: ChoiceSpec): void {
  el.dataset.positions = JSON.stringify(s.values);
  el.dataset.value = s.current;
  updateSteps(el, stepsOf(s));
}
function readCycle(el: HTMLElement): ChoiceSpec {
  return {
    label: el.getAttribute('aria-label') ?? '',
    values: JSON.parse(el.dataset.positions ?? '[]') as ChoicePosition[],
    current: el.dataset.value ?? '',
  };
}
function fillList(list: HTMLSelectElement, s: ChoiceSpec): void {
  // a `<select>` whose label is a sibling is announced as «combo box» and nothing else without its own name
  list.setAttribute('aria-label', s.label);
  while (list.firstChild) list.removeChild(list.firstChild);
  for (const v of s.values) {
    const option = list.ownerDocument.createElement('option');
    option.value = v.value;
    option.textContent = v.label; // text, never markup: a game's word goes through here
    list.appendChild(option);
  }
  list.value = s.current;
  list.dataset.value = list.value;
}

/**
 * REWRITES a choice built by `mountChoice`: its name, its positions' words and the value in use — the redraw a panel does
 * on every open, after a language change or when the value moved elsewhere. The SHAPE stays: a choice whose size can
 * cross five is built again, not updated.
 */
export function updateChoice(el: HTMLElement, spec: ChoiceSpec): void {
  if (el.tagName === 'SELECT') fillList(el as HTMLSelectElement, spec);
  // read by the attribute `writeCycle` always writes, and not by `hasAttribute`: a host's minimal document may lack it
  else if (el.dataset?.positions !== undefined) writeCycle(el, spec);
}

/** Reflects the current position: the written value, what is heard, and the ends that no longer move. */
export function updateSteps(el: HTMLElement, spec: StepsSpec): void {
  const lastIndex = Math.max(0, spec.values.length - 1);
  const from = Math.max(0, Math.min(lastIndex, spec.current));
  const text = spec.values[from] ?? '';
  el.setAttribute('aria-label', spec.label);
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', String(lastIndex));
  el.setAttribute('aria-valuenow', String(from));
  el.setAttribute('aria-valuetext', text);
  const value = el.querySelector<HTMLElement>('.passo-valor');
  // THE LABEL GOES INTO THE TEXT: the whole row is the control, «◀ Cantos arredondados: pequeno ▶». Whoever listens gets
  // the same in two parts — the name in `aria-label` and the position in `aria-valuetext` —, without the name repeated.
  if (value) value.textContent = spec.label ? `${spec.label}: ${text}` : text;
  // The end that no longer moves is marked — otherwise a wall's arrow looks like a broken button.
  el.querySelector<HTMLElement>('[data-passo="-1"]')?.classList.toggle('no-limite', from === 0);
  el.querySelector<HTMLElement>('[data-passo="1"]')?.classList.toggle('no-limite', from === lastIndex);
}
