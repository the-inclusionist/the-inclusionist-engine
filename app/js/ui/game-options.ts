// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/game-options — the options of THIS game, declared by the cartridge as rows and drawn by the engine (ADR-0182; issue #178).
//
// «Opções do jogo» opens what is this game's (ADR-0146); the cartridge says what the rows are — its words, the kind of
// control, how to read and write the value — and the engine draws them with its own panel widgets, so every menu a child
// opens has one identity and keeps the menu rules (ADR-0158, ADR-0159, ADR-0167) without the game re-implementing them.
// A cartridge draws its own options only where the rows cannot express what it needs (ADR-0182 §3).
//
// No I/O on import: `gameOptionsProblems` runs in node.
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
  const out: string[] = [];
  const ids = new Set<string>();
  options.forEach((o: Record<string, unknown> | null, i) => {
    const at = `gameOptions[${i}]`;
    if (!o || typeof o !== 'object') { out.push(`${at} must be a row`); return; }
    if (typeof o.id !== 'string' || !o.id.trim()) out.push(`${at}.id must name the row`);
    else if (ids.has(o.id)) out.push(`${at}.id «${o.id}» repeats an earlier row's`);
    else ids.add(o.id);
    if (!KINDS.includes(o.kind as GameOption['kind'])) out.push(`${at}.kind must be one of ${KINDS.join(', ')}`);
    if (typeof o.label !== 'string' || !o.label.trim()) out.push(`${at}.label must say what the row is, in the game's words`);
    if (o.hint !== undefined && typeof o.hint !== 'string') out.push(`${at}.hint must be text`);
    if (typeof o.read !== 'function') out.push(`${at}.read must be a function returning the value in use`);
    if (typeof o.write !== 'function') out.push(`${at}.write must be a function taking the new value`);
    if (o.kind !== 'steps' && o.kind !== 'list') return;
    const values = o.values;
    if (!Array.isArray(values) || values.length < 2) { out.push(`${at}.values must hold at least two positions`); return; }
    if (o.kind === 'steps' && values.length > MAX_STEPS) {
      out.push(`${at}.values holds ${values.length} steps: steps hold at most five positions — past that, declare a list (ADR-0130)`);
    }
    const seenValues = new Set<string>();
    values.forEach((v: Record<string, unknown> | null, j) => {
      if (!v || typeof v.value !== 'string' || typeof v.label !== 'string' || !v.label.trim()) {
        out.push(`${at}.values[${j}] must have a value and a label`);
      } else if (seenValues.has(v.value)) {
        out.push(`${at}.values[${j}] «${v.value}» repeats an earlier position`);
      } else {
        seenValues.add(v.value);
      }
    });
  });
  return out;
}

export interface GameOptionsDrawCtx extends PanelShellCtx {
  /** Where a change is said (the polite live region). */
  readonly dizer: (texto: string) => void;
}

/**
 * Draws the rows into `lista`, replacing what was there — the rows are the CURRENT cartridge's, and `mount()` may have
 * swapped it (ADR-0142). Every value shown is READ from the cartridge, at drawing and after each write.
 */
export function drawGameOptions(ctx: GameOptionsDrawCtx, lista: HTMLElement, options: readonly GameOption[]): void {
  while (lista.firstChild) lista.removeChild(lista.firstChild); // node by node: no markup sink, and a host without `replaceChildren` still clears
  for (const o of options) {
    const id = `game-option-${o.id}`;
    if (o.kind === 'switch') {
      const { linha, controle } = controlRow(ctx, { id, rotulo: o.label, dica: o.hint });
      const refletir = (): boolean => {
        const on = o.read();
        controle.classList.toggle('is-on', on);
        controle.setAttribute('aria-pressed', String(on));
        controle.textContent = toggleLabel(on);
        return on;
      };
      refletir();
      controle.addEventListener('click', () => {
        o.write(!o.read());
        ctx.dizer(`${o.label}: ${toggleLabel(refletir())}`);
      });
      lista.appendChild(linha);
      continue;
    }
    const labelOf = (valor: string): string => o.values.find((v) => v.value === valor)?.label ?? valor;
    if (o.kind === 'list') {
      const { linha, controle } = controlRow(ctx, { id, rotulo: o.label, dica: o.hint, forma: 'escolha' });
      const sel = controle as HTMLSelectElement;
      for (const v of o.values) {
        const op = ctx.criar('option') as HTMLOptionElement;
        op.value = v.value;
        op.textContent = v.label;
        sel.appendChild(op);
      }
      sel.value = o.read();
      sel.addEventListener('change', () => {
        o.write(sel.value);
        sel.value = o.read();
        ctx.dizer(`${o.label}: ${labelOf(sel.value)}`);
      });
      lista.appendChild(linha);
      continue;
    }
    // steps: the row IS the control, «◀ Label: value ▶» (ADR-0130 erratum); the hint rides in the row for the footer
    const indice = (): number => Math.max(0, o.values.findIndex((v) => v.value === o.read()));
    const spec = () => ({ rotulo: o.label, valores: o.values.map((v) => v.label), atual: indice() });
    const linha = ctx.criar('div');
    linha.className = 'ctrl-row ctrl-row--passos';
    const envelope = ctx.criar('span');
    if (o.hint) {
      const dica = ctx.criar('span');
      dica.className = 'opt-hint';
      dica.textContent = o.hint;
      envelope.appendChild(dica);
    }
    linha.appendChild(envelope);
    const passos = mountSteps(ctx, spec());
    passos.id = id;
    linha.appendChild(passos);
    passos.addEventListener('passo', (ev) => {
      const atual = indice();
      const nextIndex = nextStep(atual, o.values.length, (ev as CustomEvent<number>).detail);
      if (nextIndex === atual) return; // at the wall nothing moved, and nothing is said
      o.write(o.values[nextIndex]!.value);
      updateSteps(passos, spec());
      ctx.dizer(`${o.label}: ${labelOf(o.read())}`);
    });
    lista.appendChild(linha);
  }
}
