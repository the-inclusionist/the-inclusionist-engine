// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-aac.ts — THE AUGMENTATIVE AND ALTERNATIVE COMMUNICATION MENU (ADR-0028, issue #57).
//
// The catalogue (who exists, under which licence, in which tier) lives in ./aac-sets.js; only the screen is here. DI by
// ctx, like the sibling panels: no global beyond what is injected.
//
// WHAT THIS MENU IS TODAY, said without make-up: a letter-case switch that already shows, beside it, the pictogram sets
// to come. Only the letter case works — the pictograms are thousands of files that have not entered the repository, and
// some of the sets depend on a negotiation that is not ours.
//
// Showing what does not work would be dishonest if the menu did not say WHY. It does, with two different answers on
// purpose: in preparation (the licence is settled, the work is ours) and awaiting negotiation (the permission is someone
// else's). An educator who reads the first knows to wait; one who reads the second knows waiting does not help. Hiding
// everything that does not work yet would make the educator conclude the game has no pictograms at all — the wrong
// conclusion, and the one that costs most to whoever needs them.
//
// LETTER vs PICTOGRAM: the case choice is `letterCase` (core/state). There is NO parallel `aacMode`, and that is a
// decision: while only one question is answerable, a second variable for it would be duplication dressed as
// architecture. See the note in core/state.
//
// ========================= THE PANEL KIT =========================
// The rows are built as NODES by the kit (`ui/mount-panel` + `ui/panel-widgets`), which is ADR-0129 — «Sim, terminamos
// a adoção», the Dev said.
//
// 🎯 What pays for it is not aesthetic: the menu rule of `CLAUDE.md` §4 — short label in view, ALL the prose in a single
// `.opt-hint` inside the `<span>` — holds BY CONSTRUCTION, because `controlRow` writes it. In hand-built strings it held
// by convention, and a convention repeated across files is a convention that drifts.
//
// 📌 And mounting happens ONCE, with render REFLECTING: rebuilding the list on every click would force rewiring the
// listeners on every render and drop the focus. Relabelling instead of rebuilding is what `labelRow` exists for.
import type { Translate } from '../core/i18n.js';
import { DEFAULTS } from '../core/setting-defaults.js';
import type { LetterCase } from '../core/state.js';
import { AAC_SETS, AAC_BY_KEY, aacReason, type AacSet } from './aac-sets.js';
import { markChanged, markMenuChanged } from './changed-mark.js';
import { controlRow, labelRow, sectionHeader, type ControlRowSpec } from './panel-widgets.js';
import type { PanelShellCtx } from './panel-shell.js';
import { toggleLabel } from './dom.js';

/**
 * The LETTERS row is a SWITCH, not two options (the Dev's decision). On = upper case only; off = upper and lower case.
 * A binary question presented as two rows makes the child compare both to discover they are the same question.
 */
export function upperCaseOn(letterCase: LetterCase): boolean {
  return letterCase === 'upper';
}

/** The id of a set's control. It comes from the catalogue `key`, unique by construction (`AAC_BY_KEY`). */
export const aacControlId = (key: string): string => `caa-set-${key}`;

/** The letters switch. Always available: it is the offline floor, and never depended on any file. */
export function lettersRowSpec(t: Translate): ControlRowSpec {
  return { id: 'caa-caixa-alta', label: t('aac.letras'), hint: t('aac.letras.dica') };
}

/**
 * A menu row: a SHORT LABEL and nothing else in view.
 *
 * Everything that explains — note, licence, status — goes into a single `.opt-hint`, which the shell (`fillExplain`)
 * recognises and MOVES to the footer. Prose hung inside the row turns the menu into a manual, closer to a configuration
 * file than to a videogame menu — the Dev saw exactly that.
 *
 * `ariaLabel` carries the reason, so whoever navigates by keyboard hears why the row does not respond without hunting
 * for the footer. `disabled` belongs to the CONTROL and not the text: the status leaves the label, never the button.
 */
export function aacRowSpec(t: Translate, s: AacSet): ControlRowSpec {
  const reason = aacReason(s);
  const explains = [s.note, s.license ? `Licença: ${s.license}` : '', reason ? t(reason) : '']
    .filter(Boolean).join(' · ');
  return {
    id: aacControlId(s.key),
    label: s.name,
    ...(explains ? { hint: explains } : {}),
    ariaLabel: `${s.name}${reason ? ', ' + t(reason) : ''}`,
  };
}

/**
 * The menu's three sections, in decision order: the section says WHOSE turn it is to act.
 *
 * 📌 Each produces its own rows instead of filtering the catalogue, because the first does not come from the catalogue
 * — the letters are a switch and not a set, the Dev's decision that took them out of the list. A table whose first row
 * is the exception to all the others lies about what it is.
 */
export const AAC_SECTIONS: ReadonlyArray<{ title: string; tag: string; rows: (t: Translate) => ControlRowSpec[] }> = [
  { title: 'aac.secao.agora', tag: 'aac.secao.agoraTag', rows: (t) => [lettersRowSpec(t)] },
  {
    title: 'aac.secao.preparo',
    tag: 'aac.secao.preparoTag',
    rows: (t) => AAC_SETS.filter((s) => s.tier !== 'negotiating').map((s) => aacRowSpec(t, s)),
  },
  {
    title: 'aac.secao.negociacao',
    tag: 'aac.secao.negociacaoTag',
    rows: (t) => AAC_SETS.filter((s) => s.tier === 'negotiating').map((s) => aacRowSpec(t, s)),
  },
];

/**
 * Mounts the menu's inside ONCE. Called again, it RELABELS instead of rebuilding.
 *
 * ⚠️ Relabel and not rebuild, for the reason `labelRow` already states: listeners are wired at boot, and remaking the
 * row would leave a control in the document with no listener — a dead button that looks alive (ADR-0106 §5). And the
 * text may have been captured at boot, while the language was still the fallback.
 */
export function mountAacInside(t: Translate, ctx: PanelShellCtx, list: HTMLElement): void {
  for (const section of AAC_SECTIONS) {
    const specs = section.rows(t);
    const header = sectionHeader(ctx, t(section.title), t(section.tag), specs.length);
    if (header && !list.querySelector(`[data-caa-section="${section.title}"]`)) {
      header.setAttribute('data-caa-section', section.title);
      list.appendChild(header);
    }
    for (const spec of specs) {
      const old = ctx.find('#' + spec.id)?.closest<HTMLElement>('.ctrl-row');
      if (old) labelRow(old, spec);
      else list.appendChild(newRow(ctx, spec));
    }
  }
}

/**
 * A new row, with what the kit does not know about this panel: the set's key and the lock.
 *
 * No set is available today. A button that does nothing is worse than absence, because it spends trust — so it comes
 * locked, and the reason is already in `ariaLabel` for whoever navigates by keyboard.
 */
function newRow(ctx: PanelShellCtx, spec: ControlRowSpec): HTMLElement {
  const { row: row, control: control } = controlRow(ctx, spec);
  if (spec.id === 'caa-caixa-alta') { row.id = 'caa-letras'; return row; }
  const key = spec.id.replace('caa-set-', '');
  control.setAttribute('data-caa', key);
  if (!AAC_BY_KEY[key]?.available) control.setAttribute('disabled', '');
  return row;
}

export interface SettingsAacCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  $: <T extends Element = Element>(sel: string) => T | null;
  srSay: (msg: string) => void;
  /** Live read of core/state `letterCase` (the binding is reassigned by the setter). */
  getLetterCase: () => LetterCase;
  /** core/state `setLetterCaseValue` PLUS the reflection the game needs (re-rendering its text, labels). */
  setLetterCase: (c: LetterCase) => void;
  frontOverlay: (el: HTMLElement | null) => void;
  /** Moves the rows' prose to the footer (ui/settings-panel `fillExplain`). Called on EVERY render, not only on open:
   *  relabelling a row puts the hint back inside it, and without this call the menu turns into a manual again on the
   *  first click. */
  fillExplain: (card: HTMLElement | null) => void;
  restoreFocus?: (id: string) => boolean;
}

export interface SettingsAacApi {
  render: () => void;
  open: () => void;
  close: () => void;
}

export function initSettingsAac(ctx: SettingsAacCtx): SettingsAacApi {
  const { t } = ctx;
  /*
   * 📌 THE KIT'S CTX COMES FROM THE LIST NODE ITSELF, not from a global `document` nor a new contract field.
   * `ownerDocument` is the document that list LIVES in — exactly the document the rows must be born in —, so this
   * module's global reach stays ZERO (ADR-0221) and `SettingsAacCtx`, which is published surface, gains no required
   * member (ADR-0172).
   */
  const panelCtx = (list: HTMLElement): PanelShellCtx => ({
    find: (sel) => ctx.$<HTMLElement>(sel),
    create: (tag) => list.ownerDocument.createElement(tag),
  });

  function reflect(): void {
    const b = ctx.$<HTMLButtonElement>('#caa-caixa-alta');
    if (!b) return;
    const on = upperCaseOn(ctx.getLetterCase());
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
    // The switch's text is the STATE; its name is in the `<strong>` beside it and in the `aria-label`.
    b.textContent = toggleLabel(t, on);
  }

  function render(): void {
    const el = ctx.$<HTMLElement>('#caa-list');
    if (!el) return;
    mountAacInside(t, panelCtx(el), el);
    reflect();
    ctx.fillExplain(ctx.$<HTMLElement>('#caa .overlay__card'));
    refreshMarks();
  }

  /** The left-the-default mark (ADR-0029), on the chosen row and on the menu's button. */
  function refreshMarks(): void {
    const changed = ctx.getLetterCase() !== DEFAULTS.letterCase;
    markChanged(t, ctx.$<HTMLElement>('#caa-letras'), changed);
    markMenuChanged(t, ctx.$<HTMLElement>('[data-act="caa"]'), [changed]);
  }

  function open(): void {
    const ov = ctx.$<HTMLElement>('#caa');
    if (!ov) return;
    render();
    ov.hidden = false;
    ctx.frontOverlay(ov);
    const f = ov.querySelector<HTMLElement>('button');
    if (f) f.focus();
  }

  function close(): void {
    const ov = ctx.$<HTMLElement>('#caa');
    if (!ov) return;
    ov.hidden = true;
    ctx.restoreFocus?.('caa');
  }

  /*
   * The listeners are wired ONCE, on the list, by delegation — which mounting once allows. What protects an
   * unavailable set is its own button's `disabled`, written where it is born; a listener that only guards and then does
   * nothing would be inert code dressed as protection.
   */
  const list = ctx.$<HTMLElement>('#caa-list');
  if (list) list.addEventListener('click', (ev) => {
    const hit = (ev.target as HTMLElement | null)?.closest<HTMLElement>('#caa-caixa-alta');
    if (!hit) return;
    const turnOn = !upperCaseOn(ctx.getLetterCase());
    ctx.setLetterCase(turnOn ? 'upper' : 'mixed');
    render();
    ctx.srSay(t(turnOn ? 'sr.aac.caixaAltaOn' : 'sr.aac.caixaAltaOff'));
  });

  const closeBtn = ctx.$<HTMLElement>('#caa-close');
  if (closeBtn) closeBtn.addEventListener('click', close);

  // ---- reset THIS menu's defaults (ADR-0028) ----
  // The menu has one choice, so the reset is one line — but where it returns to is worth saying: the default case,
  // where Brazilian literacy usually starts. A child who switched the case and can no longer read the screen needs a way
  // back that ends at what their teacher uses.
  const resetBtn = ctx.$<HTMLElement>('#caa-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    ctx.setLetterCase(DEFAULTS.letterCase);
    render();
    ctx.srSay(t('sr.aac.reset'));
  });

  return { render, open, close };
}
