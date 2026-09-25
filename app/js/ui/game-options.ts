// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/game-options — the options of THIS game, declared by the cartridge as rows and drawn by the engine (ADR-0182; issue #178).
//
// «Opções do jogo» opens what is this game's (ADR-0146); the cartridge says what the rows are — the KEYS of its words, the kind
// of control, how to read and write the value — and the engine draws them with its own panel widgets, so every menu a child
// opens has one identity and keeps the menu rules (ADR-0158, ADR-0159, ADR-0167) without the game re-implementing them.
// A cartridge draws its own options only where the rows cannot express what it needs (ADR-0182 §3).
//
// 🔴 KEYS AND NOT WORDS (ADR-0232 D3, erratum of 2026-09-25): every word of a row is resolved by the root's translator at every
// drawing, so a language change reaches the rows (ADR-0225). A row whose words the game's dictionaries lack is NOT drawn — a
// key on screen is an identifier in front of a child — and `problems` names the key (`ui/declared-words`).
//
// No I/O on import: `gameOptionsProblems` runs in node.
import type { Translate } from '../core/i18n.js';
import { controlRow, mountSteps, updateSteps, nextStep, MAX_CYCLE_POSITIONS } from './panel-widgets.js';
import type { PanelShellCtx } from './panel-shell.js';
import { toggleLabel } from './dom.js';

/** One position of a steps or list row: the value the cartridge reads and writes, and the key of its label. */
export interface GameOptionValue {
  readonly value: string;
  readonly labelKey: string;
}

interface GameOptionBase {
  /** Stable and unique among the game's rows; the control is `#game-option-<id>`. */
  readonly id: string;
  /** The key of the row's short name, in the game's dictionary. */
  readonly labelKey: string;
  /** The key of the explanation, shown in the footer (CLAUDE.md §4). */
  readonly hintKey?: string;
}

export type GameOption =
  | (GameOptionBase & {
    /**
     * An exclusive choice. The engine draws it by its SIZE (ADR-0130 rule 3): five positions or fewer are one row «◀ Label:
     * value ▶», more a dropdown — whichever kind is declared. `steps` still refuses more than five, since the game asked for a cycle.
     */
    readonly kind: 'steps' | 'list';
    readonly values: readonly GameOptionValue[];
    /** The value in use. Read at every opening and after every write: what shows is what the cartridge keeps. */
    readonly read: () => string;
    readonly write: (value: string) => void;
  })
  | (GameOptionBase & {
    readonly kind: 'switch';
    readonly read: () => boolean;
    readonly write: (on: boolean) => void;
  });

const KINDS: readonly GameOption['kind'][] = ['steps', 'list', 'switch'];

/** Why a `gameOptions` declaration is malformed; empty when it is well formed. Absent is well formed: no options of its own. */
export function gameOptionsProblems(options: unknown): string[] {
  if (options === undefined) return [];
  if (!Array.isArray(options)) return ['gameOptions must be a list of rows'];
  // a repeated id is only wrong the second time, so the ids seen so far travel from row to row
  const ids = new Set<string>();
  return options.flatMap((o: Row | null, i) => rowProblems(o, `gameOptions[${i}]`, ids));
}

type Row = Record<string, unknown>;

/** What is wrong with one row, in the order a reader of the declaration meets it: the row, its id, its fields, its positions. */
function rowProblems(o: Row | null, at: string, ids: Set<string>): string[] {
  if (!o || typeof o !== 'object') return [`${at} must be a row`];
  const out = [...idProblems(o, at, ids), ...FIELD_CHECKS.filter(([holds]) => !holds(o)).map(([, says]) => `${at}.${says}`)];
  if (o.kind === 'steps' || o.kind === 'list') out.push(...valuesProblems(o, at));
  return out;
}

function idProblems(o: Row, at: string, ids: Set<string>): string[] {
  if (typeof o.id !== 'string' || !o.id.trim()) return [`${at}.id must name the row`];
  if (ids.has(o.id)) return [`${at}.id «${o.id}» repeats an earlier row's`];
  ids.add(o.id);
  return [];
}

/** A key: text that is not blank. */
const isKey = (k: unknown): boolean => typeof k === 'string' && !!k.trim();

/** Each field a row must have, and what is said when it does not: a row comes from outside the engine, so its TYPE is checked. */
const FIELD_CHECKS: readonly (readonly [(o: Row) => boolean, string])[] = [
  [(o) => KINDS.includes(o.kind as GameOption['kind']), `kind must be one of ${KINDS.join(', ')}`],
  [(o) => isKey(o.labelKey), "labelKey must name the row by a key of the game's dictionary"],
  [(o) => o.hintKey === undefined || isKey(o.hintKey), "hintKey must be a key of the game's dictionary"],
  [(o) => typeof o.read === 'function', 'read must be a function returning the value in use'],
  [(o) => typeof o.write === 'function', 'write must be a function taking the new value'],
];

/** The positions of a steps or list row: at least two, at most five for steps, each with a value and a label key, none repeated. */
function valuesProblems(o: Row, at: string): string[] {
  const values = o.values;
  if (!Array.isArray(values) || values.length < 2) return [`${at}.values must hold at least two positions`];
  const out = o.kind === 'steps' && values.length > MAX_CYCLE_POSITIONS
    ? [`${at}.values holds ${values.length} steps: steps hold at most five positions — past that, declare a list (ADR-0130)`] : [];
  const seen = new Set<string>();
  values.forEach((v: Row | null, j) => {
    const problem = positionProblem(v, `${at}.values[${j}]`, seen);
    if (problem) out.push(problem);
  });
  return out;
}

function positionProblem(v: Row | null, at: string, seen: Set<string>): string | null {
  if (!v || typeof v.value !== 'string' || !isKey(v.labelKey)) return `${at} must have a value and a labelKey`;
  if (seen.has(v.value)) return `${at} «${v.value}» repeats an earlier position`;
  seen.add(v.value);
  return null;
}

export interface GameOptionsDrawCtx extends PanelShellCtx {
  /** Translates the engine's own words in the page's language — the root's translator (ADR-0232 D3). */
  t: Translate;
  /** Resolves a key the GAME declared, in the page's language; `null` when its dictionaries lack it (`Translator.word`). */
  readonly word: (key: string) => string | null;
  /** Where a change is said (the polite live region). */
  readonly say: (text: string) => void;
}

/** One row's words, resolved now; `null` when its name or any position's name is missing — then the row is not drawn. */
interface RowWords {
  readonly label: string;
  readonly hint?: string;
  /** The label of each position, by value. */
  readonly values: ReadonlyMap<string, string>;
}

function rowWords(o: GameOption, word: (key: string) => string | null): RowWords | null {
  const label = word(o.labelKey);
  if (!label) return null;
  const hint = o.hintKey ? word(o.hintKey) : null;
  const values = new Map<string, string>();
  if (o.kind !== 'switch') {
    for (const v of o.values) {
      const positionLabel = word(v.labelKey);
      if (!positionLabel) return null;
      values.set(v.value, positionLabel);
    }
  }
  return { label, ...(hint ? { hint } : {}), values };
}

/**
 * Draws the rows into `list`, replacing what was there — the rows are the CURRENT cartridge's, and `mount()` may have
 * swapped it (ADR-0142). Every value shown is READ from the cartridge, and every word RESOLVED, at drawing and after each write.
 */
export function drawGameOptions(ctx: GameOptionsDrawCtx, list: HTMLElement, options: readonly GameOption[]): void {
  const { t } = ctx;
  while (list.firstChild) list.removeChild(list.firstChild); // node by node: no markup sink, and a host without `replaceChildren` still clears
  for (const o of options) {
    const words = rowWords(o, ctx.word);
    if (!words) continue;
    const id = `game-option-${o.id}`;
    if (o.kind === 'switch') {
      const { row: rowNode, control: switchButton } = controlRow(ctx, { id, label: words.label, hint: words.hint });
      const reflect = (): boolean => {
        const on = o.read();
        switchButton.classList.toggle('is-on', on);
        switchButton.setAttribute('aria-pressed', String(on));
        switchButton.textContent = toggleLabel(t, on);
        return on;
      };
      reflect();
      switchButton.addEventListener('click', () => {
        o.write(!o.read());
        ctx.say(`${words.label}: ${toggleLabel(t, reflect())}`);
      });
      list.appendChild(rowNode);
      continue;
    }
    const labelOf = (chosen: string): string => words.values.get(chosen) ?? '';
    // ⚠️ BY SIZE, NOT BY KIND (ADR-0130 rule 3): a `list` of five or fewer is a cycle row like `steps`, below
    if (o.values.length > MAX_CYCLE_POSITIONS) {
      const { row: rowNode, control: control } = controlRow(ctx, { id, label: words.label, hint: words.hint, shape: 'escolha' });
      const sel = control as HTMLSelectElement;
      for (const v of o.values) {
        const op = ctx.create('option') as HTMLOptionElement;
        op.value = v.value;
        op.textContent = labelOf(v.value);
        sel.appendChild(op);
      }
      sel.value = o.read();
      sel.addEventListener('change', () => {
        o.write(sel.value);
        sel.value = o.read();
        ctx.say(`${words.label}: ${labelOf(sel.value)}`);
      });
      list.appendChild(rowNode);
      continue;
    }
    // steps: the row IS the control, «◀ Label: value ▶» (ADR-0130 erratum); the hint rides in the row for the footer
    const selectedIndex = (): number => Math.max(0, o.values.findIndex((v) => v.value === o.read()));
    const spec = () => ({ label: words.label, values: o.values.map((v) => labelOf(v.value)), current: selectedIndex() });
    const rowNode = ctx.create('div');
    rowNode.className = 'ctrl-row ctrl-row--passos';
    const envelope = ctx.create('span');
    if (words.hint) {
      const explanation = ctx.create('span');
      explanation.className = 'opt-hint';
      explanation.textContent = words.hint;
      envelope.appendChild(explanation);
    }
    rowNode.appendChild(envelope);
    const stepper = mountSteps(ctx, spec());
    stepper.id = id;
    rowNode.appendChild(stepper);
    stepper.addEventListener('passo', (ev) => {
      const currentIndex = selectedIndex();
      const nextIndex = nextStep(currentIndex, o.values.length, (ev as CustomEvent<number>).detail);
      if (nextIndex === currentIndex) return; // at the wall nothing moved, and nothing is said
      o.write(o.values[nextIndex]!.value);
      updateSteps(stepper, spec());
      ctx.say(`${words.label}: ${labelOf(o.read())}`);
    });
    list.appendChild(rowNode);
  }
}
