// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/simulation-list — THE ONE LIST OF SIMULATIONS THE EMPATHY PANEL OFFERS (ADR-0159 rule 7; ADR-0074; ADR-0129).
//
// More than five positions means a dropdown and not a row of buttons (ADR-0159 rule 7), and there are ten of these. The row
// is built ONCE AND KEPT, which is the decision the whole shape follows from: the child opens this panel to try a
// simulation, look at the game, come back and try another, and a row rebuilt at every opening would take the focus off the
// list every time she did.
//
// 🎯 AND THAT IS WHY EVERYTHING A READER TAKES FROM IT IS WRITTEN AT EACH OPENING instead of at build time: the row's short
// label, the list's own accessible name, and the name of every option. What is built once is the SHAPE; what is rewritten is
// the TEXT. Two of them freeze the language otherwise, and a list that says «Simulações» to a child playing in English is a
// list she cannot use.
//
// ⚠️ PROBED BEFORE IT MOVED, and five of nine decisions were blind — the list could lose its accessible name, pile a second
// set of options on every opening, and name each option by its KEY. They have cases now
// (`tests/the-simulation-list-is-read-in-the-language-of-now.browser.test.js`).
//
// 📌 THE EXPLANATION IS A WORD OF THIS ROW LIKE THE OTHERS, and it is written by `render` for the same reason. It used to be
// written at build time and stayed in the language it was built in — not this list's fault alone, since 14 of the 28
// explanation-bearing rows of the engine's panels did the same: `ui/settings-panel.fillExplain` DESTROYED the `.opt-hint` on
// the way to the footer, so every producer's rewrite landed on a node that was no longer there. It now hides it instead.

import type { Translate } from '../core/i18n.js';
import { VIZ_BY_KEY } from '../render/viz-modes.js';

export interface SimulationListCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /** The host's DOM query — this module never reaches a global (ADR-0221 step 7d). */
  readonly find: <T extends Element>(selector: string) => T | null;
  /** Makes an element. Injected for the same reason: no `document` in here. */
  readonly make: <K extends keyof HTMLElementTagNameMap>(tag: K) => HTMLElementTagNameMap[K];
  /**
   * The simulations offered, in the order the child reads them.
   *
   * 📌 DATA AND NOT A CONSTANT OF THIS MODULE: which simulations an engine offers is a decision of whoever composes it, and
   * a key this module cannot resolve is then something a caller can actually do — which is what lets the guard below be
   * driven by a case instead of only protecting a future edit of a private list.
   */
  readonly keys: readonly string[];
  /** What is running on the world right now. The list always shows IT, so a refused choice (ADR-0076) comes back by itself. */
  readonly running: () => string | null;
  /** The child picked one. */
  readonly picked: (key: string) => void;
}

export interface SimulationList {
  /** Builds the row if it is not there yet, and writes every word of it in the language of now. */
  render(listSelector: string): void;
}

export function createSimulationList(ctx: SimulationListCtx): SimulationList {
  const { t } = ctx;
  /** The row, once. Everything after this writes into it. */
  function build(list: HTMLElement): HTMLSelectElement {
    const row = ctx.make('div');
    row.className = 'ctrl-row';
    const envelope = ctx.make('span');
    envelope.appendChild(ctx.make('strong'));
    const hint = ctx.make('span');
    hint.className = 'opt-hint'; // CLAUDE.md §4: the prose belongs to the footer, and this is how it gets there
    envelope.appendChild(hint); // the TEXT is written by `render`, like every other word of this row
    row.appendChild(envelope);
    const choice = ctx.make('select');
    choice.id = 'opt-simulacao';
    choice.className = 'vol';
    row.appendChild(choice);
    list.textContent = '';
    list.appendChild(row);
    // the render below writes the list back from the world, so a refused choice returns to what runs
    choice.addEventListener('change', () => { ctx.picked(choice.value); });
    return choice;
  }

  return {
    render(listSelector) {
      const list = ctx.find<HTMLElement>(listSelector);
      if (!list) return;
      const choice = list.querySelector<HTMLSelectElement>('#opt-simulacao') ?? build(list);
      const label = t('empathy.grupo.rotulo');
      const row = choice.closest('.ctrl-row');
      const strong = row?.querySelector('strong');
      if (strong) strong.textContent = label;
      // the explanation is a word of this row like the others, so it is rewritten here and not left at build time —
      // `ui/settings-panel.fillExplain` hides this node rather than destroying it, so the write reaches the footer
      const hint = row?.querySelector<HTMLElement>('.opt-hint');
      if (hint) hint.textContent = t('empathy.simulacao.dica');
      // a `<select>` whose label is a sibling is announced as «combo box» and nothing else without this
      choice.setAttribute('aria-label', label);
      choice.textContent = ''; // rewritten, never appended: twice open would be twice the options
      for (const key of ctx.keys) {
        const mode = VIZ_BY_KEY[key];
        if (!mode) continue; // a key no mode answers for would become a blank option the child can choose
        const option = ctx.make('option');
        option.value = key;
        option.textContent = t(mode.name); // what it DOES, never the key that stores it (ADR-0074)
        choice.appendChild(option);
      }
      choice.value = ctx.running() ?? 'normal';
    },
  };
}
