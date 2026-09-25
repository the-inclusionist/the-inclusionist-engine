// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/game-options — the options of THIS game, declared by the cartridge as rows and drawn by the engine (ADR-0182; issue #178).
//
// «Opções do jogo» opens what is this game's (ADR-0146); the cartridge says what the rows are — its words, the kind of
// control, how to read and write the value — and the engine draws them with its own panel widgets, so every menu a child
// opens has one identity and keeps the menu rules (ADR-0158, ADR-0159, ADR-0167) without the game re-implementing them.
// A cartridge draws its own options only where the rows cannot express what it needs (ADR-0182 §3).
//
// No I/O on import: `gameOptionsProblems` runs in node.
import type { Translate } from '../core/i18n.js';
import { controlRow, mountSteps, updateSteps, nextStep } from './panel-widgets.js';
import type { PanelShellCtx } from './panel-shell.js';
import { toggleLabel } from './dom.js';

/** One position of a steps or list row: the value the cartridge reads and writes, and its label in the interface language. */
export interface GameOptionValue {
  readonly value: string;
  readonly label: string;
}

interface GameOptionBase {
  /** Stable and unique among the game's rows; the control is `#game-option-<id>`. */
  readonly id: string;
  /** The row's short name, in the interface language. */
  readonly label: string;
  /** The explanation, shown in the footer (CLAUDE.md §4). */
  readonly hint?: string;
}

export type GameOption =
  | (GameOptionBase & {
    /** Steps «◀ Label: value ▶», up to five positions; a list, any number (ADR-0130 erratum). */
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
/** ADR-0130 erratum, rule 3: steps cycle among FEW positions — up to five; past that, a list. */
const MAX_STEPS = 5;

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

/** Each field a row must have, and what is said when it does not: a row comes from outside the engine, so its TYPE is checked. */
const FIELD_CHECKS: readonly (readonly [(o: Row) => boolean, string])[] = [
  [(o) => KINDS.includes(o.kind as GameOption['kind']), `kind must be one of ${KINDS.join(', ')}`],
  [(o) => typeof o.label === 'string' && !!o.label.trim(), "label must say what the row is, in the game's words"],
  [(o) => o.hint === undefined || typeof o.hint === 'string', 'hint must be text'],
  [(o) => typeof o.read === 'function', 'read must be a function returning the value in use'],
  [(o) => typeof o.write === 'function', 'write must be a function taking the new value'],
];

/** The positions of a steps or list row: at least two, at most five for steps, each with a value and a label, none repeated. */
function valuesProblems(o: Row, at: string): string[] {
  const values = o.values;
  if (!Array.isArray(values) || values.length < 2) return [`${at}.values must hold at least two positions`];
  const out = o.kind === 'steps' && values.length > MAX_STEPS
    ? [`${at}.values holds ${values.length} steps: steps hold at most five positions — past that, declare a list (ADR-0130)`] : [];
  const seen = new Set<string>();
  values.forEach((v: Row | null, j) => {
    const problem = positionProblem(v, `${at}.values[${j}]`, seen);
    if (problem) out.push(problem);
  });
  return out;
}

function positionProblem(v: Row | null, at: string, seen: Set<string>): string | null {
  if (!v || typeof v.value !== 'string' || typeof v.label !== 'string' || !v.label.trim()) return `${at} must have a value and a label`;
  if (seen.has(v.value)) return `${at} «${v.value}» repeats an earlier position`;
  seen.add(v.value);
  return null;
}

export interface GameOptionsDrawCtx extends PanelShellCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /** Where a change is said (the polite live region). */
  readonly say: (text: string) => void;
}

/**
 * Draws the rows into `list`, replacing what was there — the rows are the CURRENT cartridge's, and `mount()` may have
 * swapped it (ADR-0142). Every value shown is READ from the cartridge, at drawing and after each write.
 */
export function drawGameOptions(ctx: GameOptionsDrawCtx, list: HTMLElement, options: readonly GameOption[]): void {
  const { t } = ctx;
  while (list.firstChild) list.removeChild(list.firstChild); // node by node: no markup sink, and a host without `replaceChildren` still clears
  for (const o of options) {
    const id = `game-option-${o.id}`;
    if (o.kind === 'switch') {
      const { row: rowNode, controle: switchButton } = controlRow(ctx, { id, label: o.label, hint: o.hint });
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
        ctx.say(`${o.label}: ${toggleLabel(t, reflect())}`);
      });
      list.appendChild(rowNode);
      continue;
    }
    const labelOf = (chosen: string): string => o.values.find((v) => v.value === chosen)?.label ?? chosen;
    if (o.kind === 'list') {
      const { row: rowNode, controle: control } = controlRow(ctx, { id, label: o.label, hint: o.hint, shape: 'escolha' });
      const sel = control as HTMLSelectElement;
      for (const v of o.values) {
        const op = ctx.create('option') as HTMLOptionElement;
        op.value = v.value;
        op.textContent = v.label;
        sel.appendChild(op);
      }
      sel.value = o.read();
      sel.addEventListener('change', () => {
        o.write(sel.value);
        sel.value = o.read();
        ctx.say(`${o.label}: ${labelOf(sel.value)}`);
      });
      list.appendChild(rowNode);
      continue;
    }
    // steps: the row IS the control, «◀ Label: value ▶» (ADR-0130 erratum); the hint rides in the row for the footer
    const selectedIndex = (): number => Math.max(0, o.values.findIndex((v) => v.value === o.read()));
    const spec = () => ({ label: o.label, values: o.values.map((v) => v.label), current: selectedIndex() });
    const rowNode = ctx.create('div');
    rowNode.className = 'ctrl-row ctrl-row--passos';
    const envelope = ctx.create('span');
    if (o.hint) {
      const explanation = ctx.create('span');
      explanation.className = 'opt-hint';
      explanation.textContent = o.hint;
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
      ctx.say(`${o.label}: ${labelOf(o.read())}`);
    });
    list.appendChild(rowNode);
  }
}
