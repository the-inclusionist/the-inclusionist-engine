// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/panel-shell — THE SHELL OF A SETTINGS PANEL, built instead of required.
//
// ========================= WHAT THIS FIXES =========================
// A second consumer (issue #63) measured it: a panel's ctx asks for `$` and `store`, but what it REALLY requires is
// that the consumer's document contain five ids (`#typo`, `#typo-list`, `#typo-close`, …). Nothing in the type says so;
// it is found by trial, and the failure mode is the worst possible one — the panel opens EMPTY, with no error.
//
// Each `ui/settings-*.ts` fills the INSIDE of its panel; this module builds the OUTSIDE — the veil, the card, the title,
// the actions row and the reset button — and returns the ids it created, so the contract is stated instead of
// discovered.
//
// ⚠️ AND THE MENU RULE OF `CLAUDE.md` §4 IS BUILT IN, not remembered. A panel's introduction goes in the card's
// `data-explain-idle` — never in a `<p>` of prose at the top —, because a menu that explains item by item makes the
// child READ EVERYTHING to find what they want (issue #62). The shell has no way to receive a `<p>` at the top.
//
// ========================= THE SHAPE =========================
//
//     <div id="X" class="overlay" hidden>
//       <div class="overlay__card" role="dialog" aria-modal="true" aria-labelledby="X-title" [data-explain-idle]>
//         <h2 id="X-title">…</h2>
//         <button id="X-close">…</button>                                           ← item 1 (ADR-0158)
//         <div id="X-list" class="ctrl-list" role="group" aria-label="…"></div>   ← the inside, from settings-*
//         <div class="overlay__actions">
//           <button id="X-reset">…</button>
//         </div>
//       </div>
//     </div>
//
// ⚠️ THE `.opt-explain` FOOTER IS NOT CREATED HERE, on purpose: `ui/settings-panel.fillExplain` creates it when it moves
// the first hint there. Creating it empty here would give an `aria-live` region that announces nothing, and two hands
// creating the same node is how it would end up duplicated.
//
// No `innerHTML`: everything through `create` + `textContent`, like `ui/loop-crash` and `ui/focus-trap`. The title and
// the list label come from the CALLER already resolved — this module does not translate, so it can be exercised with no
// dictionary.
//
// ⚠️ AND IT IMPORTS NOTHING. A shell that does not use `innerHTML` does not need to escape text either: `textContent`
// escapes by construction. An import "for convenience" is how a leaf module stops being one, and how a future reader
// starts looking for an interpolation that does not exist.

/** The things from `document` the shell needs. The same shape as `ui/loop-crash`. */
export interface PanelShellCtx {
  /** `document.querySelector`, injected — the shell never reaches the global `document`. */
  find: (sel: string) => HTMLElement | null;
  /** `document.createElement`, injected. */
  create: (tag: string) => HTMLElement;
}

export interface PanelShellSpec {
  /** The panel's id: `typo`, `audio`, `visual`… It produces `#X`, `#X-title`, `#X-list`, `#X-reset`, `#X-close`. */
  id: string;
  /**
   * The LIST's id, when it is not `${id}-list`.
   *
   * 📏 Exactly one panel diverges: `settings-motion` lives in the `#animation` overlay — with `#animation-reset` and
   * `#animation-close`, which match — and reads its list at **`#motion-list`**.
   *
   * ⚠️ AND THE ANSWER IS NOT TO RENAME. The id a `settings-*` reads is a contract with the markup of whoever already uses
   * it. An optional field costs one line and breaks no one; the rename would cost the motion panel to whoever already has
   * markup.
   */
  listId?: string;
  /** The title, ALREADY TRANSLATED. It goes in through `textContent`. */
  title: string;
  /** The list's `aria-label`, already translated — the group name the child hears on entering it. */
  listLabel: string;
  /** The two buttons' labels, already translated. `closeLabel` is the word for BACK (item 1, ADR-0158). */
  resetLabel: string;
  closeLabel: string;
  /**
   * The panel's introduction, already translated. It becomes the footer's RESTING text, via `data-explain-idle`.
   *
   * ⚠️ IT IS THE ONLY PATH THIS SHELL OFFERS FOR AN INTRODUCTION, which is the point of issue #62: there is no way to
   * pass a paragraph of prose to the top of the card. Absent = the panel has no introduction, which is a legitimate
   * answer and not an omission.
   */
  intro?: string;
}

/**
 * THE SHELL'S WORDS, without the id — everything that changes when the language changes, and nothing that does not.
 *
 * ⚠️ SEPARATE FROM THE `id` ON PURPOSE, the separation `ui/mount-panel` needs: the id is identity and resolves once; the
 * labels are TRANSLATED TEXT and resolve on every open. A type joining them would make whoever retranslates repeat the
 * id, and repeating an identity is how it drifts.
 */
export type PanelLabels = Omit<PanelShellSpec, 'id'>;

/** What the shell returns: the node and the ids it created, so the panel does not guess them. */
export interface PanelShell {
  overlay: HTMLElement;
  card: HTMLElement;
  /** The card's `<h2>`. Exposed because whoever retranslates the panel writes into it — see `applyLabels`. */
  title: HTMLElement;
  list: HTMLElement;
  reset: HTMLElement;
  close: HTMLElement;
  /** The five selectors this panel guarantees. It is the contract, stated instead of discovered. */
  ids: { overlay: string; title: string; list: string; reset: string; close: string };
}

/** The ids a panel of `id` occupies. Exported because a gate and a consumer need to name them. */
export function shellIds(id: string, customListId?: string): PanelShell['ids'] {
  return {
    overlay: id,
    title: `${id}-title`,
    list: customListId ?? `${id}-list`,
    reset: `${id}-reset`,
    close: `${id}-close`,
  };
}

/**
 * Mounts (or reuses) the shell of panel `spec.id` and returns its parts.
 *
 * IDEMPOTENT: if a `#id` already exists, it is reused and the card's content is rebuilt. A panel mounted twice cannot
 * end up with two veils — and it can be mounted more than once (two cartridges on one page, ADR-0139).
 */
export function mountShell(ctx: PanelShellCtx, spec: PanelShellSpec): PanelShell {
  const ids = shellIds(spec.id, spec.listId);
  const overlay = ctx.find('#' + ids.overlay) ?? ctx.create('div');
  overlay.id = ids.overlay;
  overlay.className = 'overlay';
  overlay.hidden = true;
  while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

  const card = ctx.create('div');
  card.className = 'overlay__card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', ids.title);

  const h2 = ctx.create('h2');
  h2.id = ids.title;
  card.appendChild(h2);

  // ADR-0158: «Voltar» is item 1 and nothing closes the panel after its rows. The way out is where the cursor lands
  // when the panel opens — a close button at the bottom made the child walk every row to leave. The id stays
  // `#X-close`, which is contract; only its place and its word changed.
  const backButton = button(ctx, ids.close, 'mode-btn overlay__back');
  card.appendChild(backButton);

  const listNode = ctx.create('div');
  listNode.id = ids.list;
  listNode.className = 'ctrl-list';
  listNode.setAttribute('role', 'group');
  card.appendChild(listNode);

  const actionsRow = ctx.create('div');
  actionsRow.className = 'overlay__actions';
  const reset = button(ctx, ids.reset, 'mode-btn');
  actionsRow.appendChild(reset);
  card.appendChild(actionsRow);

  overlay.appendChild(card);
  const shell: PanelShell = { overlay, card, title: h2, list: listNode, reset, close: backButton, ids };
  applyLabels(shell, spec);
  return shell;
}

/**
 * WRITES THE SHELL'S WORDS — separate from construction because they change AFTER it exists.
 *
 * 🔴 `initI18n` applies the fallback language synchronously — so the page is never blank — and, if the preferred
 * language is another, REQUESTS the switch, which is asynchronous. Anything JavaScript builds in that gap captures the
 * fallback text and nothing rebuilds it; and the language can also change mid-game.
 *
 * ⚠️ AND REBUILDING THE SHELL TO FIX THE TITLE DOES NOT WORK. `mountShell` empties the card, and each `ui/settings-*`
 * wires its `#X-reset` ONCE, at `init` — remounting leaves the reset button in the document with no listener, a dead
 * button that looks alive (ADR-0106 §5). Writing only the words touches no listener.
 *
 * IDEMPOTENT: writing the same labels twice is writing the same labels.
 */
export function applyLabels(shell: PanelShell, r: PanelLabels): void {
  shell.title.textContent = r.title;
  shell.list.setAttribute('aria-label', r.listLabel);
  shell.reset.textContent = r.resetLabel;
  shell.close.textContent = r.closeLabel;
  // the arrow is drawn by the stylesheet, out of the name (ADR-0159 rule 12)
  shell.close.setAttribute('data-glifo', '↩');
  // The panel's introduction is the footer's RESTING text (CLAUDE.md §4), never a `<p>` at the top.
  // ⚠️ ABSENCE HAS TO ERASE, not just stop writing: on a retranslation into a dictionary without the key, the old
  // attribute would survive and the footer would rest in the previous language.
  if (r.intro) shell.card.setAttribute('data-explain-idle', r.intro);
  else shell.card.removeAttribute('data-explain-idle');
}

function button(ctx: PanelShellCtx, id: string, cssClass: string): HTMLElement {
  const b = ctx.create('button');
  b.id = id;
  b.className = cssClass;
  b.setAttribute('type', 'button');
  // The label comes in through `applyLabels`, by `textContent` and not `innerHTML`: a translated label is outside data
  // like any other, and a consumer's dictionary can bring anything inside it.
  return b;
}
