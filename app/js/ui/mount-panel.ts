// SPDX-License-Identifier: AGPL-3.0-or-later
// MOUNTING A SETTINGS PANEL — the twenty-five lines every consumer had to write, written once.
//
// ========================= WHY THIS EXISTS =========================
// ADR-0106 §1 is the Dev's standing rule: «the pause menu, its design and the accessibility icons are OFFERED
// BY THE ENGINE and not by the game's programming», and ADR-0122 hardened it to «not offered, not declinable».
// 📏 Measured on 2026-09-11, against a game that calls only `createGame`: the pause card mounts with ONE
// surviving button, and ZERO settings panels open.
//
// 🔴 AND THE CAUSE IS A CHAIN, NOT AN OVERSIGHT. `ui/panel-shell.mountShell` builds a panel's SHELL and no
// engine module ever called it — the only caller was `consumer-quiz/main-quiz.ts:320`. Each `ui/settings-*`
// module fills the INTERIOR of ids that nothing creates, so the failure mode was the worst available: the
// quiz recorded it as finding 6 — «the panel opens EMPTY, with no error».
//
// 🎯 WHAT WAS ACTUALLY MISSING WAS THIS FILE. The quiz's twenty-five lines are five steps — build the shell,
// put it in the document, wire the opener, wire the closer, join the Escape chain — and they are the same
// five for all eight panels. A consumer that repeats them eight times is a consumer that will get one of
// them wrong, and the one it gets wrong is a door a child cannot open.
//
// ⚠️ WHAT THIS DOES NOT DO, AND THE LINE IS ADR-0106 §5: it does not decide WHETHER a panel is mounted. A
// panel whose writers the engine cannot supply must not be mounted at all — «an icon is mounted when its
// action works, and not before». That judgement belongs to the composition root, which knows what it has.
import type { PanelLabels, PanelShell, PanelShellCtx } from './panel-shell.js';
import { applyLabels, mountShell } from './panel-shell.js';
import { navigableItems } from './menu-items.js';

/**
 * The latest redraw of each mounted overlay. A panel mounted twice (two cartridges on one page, ADR-0139) keeps ONE
 * language listener, and the listener asks this table — so it redraws with the words and render of the last mount.
 */
const redesenhoDoPainel = new WeakMap<HTMLElement, () => void>();
const ouvindoIdioma = new WeakSet<HTMLElement>();

/** The slice of the overlay stack a panel needs. Narrow on purpose: this file never opens a second panel. */
export interface PanelStack {
  /** Brings the overlay to the front of the z-order, as `ui/settings-panel` computes it. */
  readonly frontOverlay: (el: HTMLElement) => void;
  /** Joins the Escape chain. Without it, Escape walks an empty registry and the panel traps the child. */
  readonly register: (id: string, entry: { close: () => void; inEscapeChain: boolean }) => void;
  /** Returns focus to whatever opened the panel (WCAG 2.4.3). */
  readonly restoreFocus?: (id: string) => void;
}

export interface MountPanelCtx extends PanelShellCtx {
  /** Where the overlay lives. The composition root resolves it; this file does not guess at `#game-region`. */
  readonly host: HTMLElement;
  readonly overlays: PanelStack;
}

export interface MountPanelSpec {
  /** The panel's id: `typo`, `audio`, `visual`… Identity, resolved once — unlike the words below. */
  readonly id: string;
  /** The list's id when it is not `${id}-list`. One of the eight needs it — see `PanelShellSpec.idDaLista`. */
  readonly idDaLista?: string;
  /**
   * The panel's WORDS, already translated — and resolved AT EVERY OPEN rather than once at mount.
   *
   * 🔴 A function and not four strings, because the panel is born hidden and the boot has a gap. `initI18n`
   * applies the fallback language synchronously — so the page is never blank — and then ASKS for en/es, which
   * is asynchronous. Anything the JavaScript builds inside that gap captures the fallback text and nothing
   * rebuilds it; 📏 measured in a browser on 2026-09-08, the icon bar served five labels in English and three
   * still in the fallback, on the same line.
   *
   * 🎯 AND THE PANEL IS THE ONE PLACE WHERE THAT COSTS NOTHING TO FIX. Nobody reads a hidden dialog, so its
   * words only have to be right when it opens — no `localeReady()` wiring per panel, and a language changed
   * mid-game is right on the next open too.
   */
  readonly rotulos: () => PanelLabels;
  /**
   * The panel's own `render()`.
   *
   * ⚠️ CALLED ON EVERY OPEN, not once at mount. Two reasons, both measured in this tree: a panel that renders
   * once shows a stale state after the child changes the same setting from the quick bar; and
   * `ui/settings-panel.fillExplain` has to run after every render or the prose climbs back inside the rows
   * on the first click — the defect ADR-0129 measured in `settings-visual` and `settings-empathy`.
   */
  readonly render: () => void;
  // 🔴 `primeiroFoco` WAS REMOVED (ADR-0158): focus now always lands on «Voltar», item 1 — the way out is where the
  // cursor lands, as `resume` is in the pause root. ⚠️ Never `casca.lista`: a `div[role=group]` with no `tabindex`
  // accepts `.focus()`, moves nothing and reports nothing, and an `aria-modal` dialog would leave the reader outside.
  /**
   * THIS PANEL ALREADY WIRES ITS OWN `#X-close`, so pass its `close()` here instead of letting this file wire
   * a second listener onto the same button.
   *
   * 📏 Measured across the eight on 2026-09-11, and the three-way split is why this field is a function rather
   * than a flag: `settings-typo`, `-motor`, `-controls`, `-visual` and `-audio` have no `close()` at all and
   * need the whole five lines; `settings-caa` and `-empathy` have one AND bind the button themselves at init;
   * `settings-motion` has one and does NOT bind the button, so it takes the default path and its `close()`
   * simply goes unused.
   *
   * ⚠️ AND IT IS THE ESCAPE CHAIN THAT MAKES THIS MATTER, not tidiness. If this file wired its own closer and
   * registered it while the panel's button ran the panel's closer, one control would take two paths to the
   * same job — and the day one of them learns to do something extra, only half the ways out learn it.
   */
  readonly fecharProprio?: () => void;
}

export interface MountedPanel {
  readonly casca: PanelShell;
  readonly abrir: () => void;
  readonly fechar: () => void;
}

/**
 * Builds a panel's shell, puts it in the document, and wires open/close/Escape.
 *
 * Idempotent through `mountShell`, which reuses an overlay that already carries the id — so mounting twice
 * leaves one panel, which is what ADR-0139's third gate asks of two cartridges on one page.
 */
export function mountPanel(ctx: MountPanelCtx, spec: MountPanelSpec): MountedPanel {
  const casca = mountShell(ctx, { id: spec.id, idDaLista: spec.idDaLista, ...spec.rotulos() });
  // Appending an element that is already a child moves it; it never duplicates. Guarding on `parentNode`
  // would be the same operation written twice.
  ctx.host.appendChild(casca.overlay);

  const fechar = spec.fecharProprio ?? ((): void => {
    casca.overlay.hidden = true;
    ctx.overlays.restoreFocus?.(spec.id);
  });

  // 🔴 NO NUMBERING (ADR-0167): the stops drew their index here, renumbered by an observer on every render; the place is
  // now only spoken, after the name, by the navigation.

  const abrir = (): void => {
    // ⚠️ OS RÓTULOS ANTES DO `render()`, e a ordem tem consequência: `ui/settings-panel.fillExplain` lê o
    // `data-explain-idle` do cartão para montar o rodapé, e quem o chama é o render de cada painel.
    applyLabels(casca, spec.rotulos());
    spec.render();
    casca.overlay.hidden = false;
    ctx.overlays.frontOverlay(casca.overlay);
    casca.fechar.focus?.();
  };

  /*
   * A LANGUAGE CHANGED WITH THE PANEL OPEN REDRAWS IT, AND THE CHILD STAYS WHERE THEY WERE (ADR-0031). 📏 Measured: with
   * the panel open, `setLocale` left every word of it in the old language until it was closed and reopened.
   * 📌 Focus is kept by PLACE: the control itself when the render left it in the document, else the stop at the same
   * position — `render()` rebuilds rows by `innerHTML`, and a redraw that drops focus on «Voltar» loses the child's place.
   * A hidden panel does nothing: its words are resolved when it opens.
   */
  redesenhoDoPainel.set(casca.overlay, () => {
    if (casca.overlay.hidden) return;
    const doc = casca.card.ownerDocument;
    const focado = doc.activeElement as HTMLElement | null;
    const lugar = focado && casca.card.contains(focado) ? navigableItems(casca.card).indexOf(focado) : -1;
    applyLabels(casca, spec.rotulos());
    spec.render();
    if (lugar < 0 || !focado) return;
    const destino = focado.isConnected ? focado : navigableItems(casca.card)[lugar];
    if (destino && destino !== doc.activeElement) destino.focus();
  });
  const janela = casca.overlay.ownerDocument?.defaultView;
  if (janela && typeof janela.addEventListener === 'function' && !ouvindoIdioma.has(casca.overlay)) {
    ouvindoIdioma.add(casca.overlay);
    janela.addEventListener('i18n:change', () => { redesenhoDoPainel.get(casca.overlay)?.(); });
  }

  // Só quando o painel NÃO liga o próprio botão. Ver `fecharProprio`: dois ouvintes no mesmo controle são dois
  // donos da mesma saída, e é assim que elas divergem.
  if (!spec.fecharProprio) casca.fechar.addEventListener('click', fechar);
  // ⚠️ THE ESCAPE CHAIN IS NOT DECORATION. `ui/settings-panel.escapeTarget()` walks the registry, and under
  // `createGame` that registry was EMPTY — nothing had ever registered. A modal dialog no key closes is the
  // trap ADR-0044 §2 names about the pause itself: «a menu you cannot leave is a trap, and the trap costs
  // most to whoever cannot see it».
  ctx.overlays.register(spec.id, { close: fechar, inEscapeChain: true });

  return { casca, abrir, fechar };
}
