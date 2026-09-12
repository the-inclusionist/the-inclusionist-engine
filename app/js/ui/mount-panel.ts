// SPDX-License-Identifier: AGPL-3.0-or-later
// MOUNTING A SETTINGS PANEL — the twenty-five lines every consumer had to write, written once.
//
// ========================= WHY THIS EXISTS =========================
// ADR-0106 §1 is the Dev's standing rule: «the pause menu, its design and the accessibility icons are OFFERED
// BY THE ENGINE and not by the game's programming», and ADR-0122 hardened it to «not offered, not declinable».
// 📏 Measured on 2026-09-11, against a game that calls only `createGame`: the pause card mounts with ONE
// surviving button, and ZERO settings panels open.
//
// 🔴 AND THE CAUSE IS A CHAIN, NOT AN OVERSIGHT. `ui/panel-shell.montarCasca` builds a panel's SHELL and no
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
import { aplicarRotulos, montarCasca } from './panel-shell.js';

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
   * words only have to be right when it opens — no `idiomaPronto()` wiring per panel, and a language changed
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
  /**
   * What receives focus when the panel opens, as a selector inside the card.
   *
   * 📌 Optional, and the fallback is a real element rather than a polite gesture: the first enabled control
   * in the list, else the close button. ⚠️ It is NOT `casca.lista` — that is a `div[role=group]` with no
   * `tabindex`, so `.focus()` on it does nothing AND REPORTS NOTHING, which is the failure shape this
   * repository keeps paying for. A dialog that opens with focus still outside it cannot be reached by a
   * keyboard, and `aria-modal` makes that worse: the reader is told it is modal and then left outside.
   */
  readonly primeiroFoco?: string;
}

export interface MountedPanel {
  readonly casca: PanelShell;
  readonly abrir: () => void;
  readonly fechar: () => void;
}

/**
 * Builds a panel's shell, puts it in the document, and wires open/close/Escape.
 *
 * Idempotent through `montarCasca`, which reuses an overlay that already carries the id — so mounting twice
 * leaves one panel, which is what ADR-0139's third gate asks of two cartridges on one page.
 */
export function montarPainel(ctx: MountPanelCtx, spec: MountPanelSpec): MountedPanel {
  const casca = montarCasca(ctx, { id: spec.id, ...spec.rotulos() });
  // Appending an element that is already a child moves it; it never duplicates. Guarding on `parentNode`
  // would be the same operation written twice.
  ctx.host.appendChild(casca.overlay);

  const fechar = (): void => {
    casca.overlay.hidden = true;
    ctx.overlays.restoreFocus?.(spec.id);
  };

  const abrir = (): void => {
    // ⚠️ OS RÓTULOS ANTES DO `render()`, e a ordem tem consequência: `ui/settings-panel.fillExplain` lê o
    // `data-explain-idle` do cartão para montar o rodapé, e quem o chama é o render de cada painel.
    aplicarRotulos(casca, spec.rotulos());
    spec.render();
    casca.overlay.hidden = false;
    ctx.overlays.frontOverlay(casca.overlay);
    const pedido = spec.primeiroFoco ? casca.card.querySelector<HTMLElement>(spec.primeiroFoco) : null;
    const primeiroVivo = casca.lista.querySelector<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])');
    (pedido ?? primeiroVivo ?? casca.fechar).focus?.();
  };

  casca.fechar.addEventListener('click', fechar);
  // ⚠️ THE ESCAPE CHAIN IS NOT DECORATION. `ui/settings-panel.escapeTarget()` walks the registry, and under
  // `createGame` that registry was EMPTY — nothing had ever registered. A modal dialog no key closes is the
  // trap ADR-0044 §2 names about the pause itself: «a menu you cannot leave is a trap, and the trap costs
  // most to whoever cannot see it».
  ctx.overlays.register(spec.id, { close: fechar, inEscapeChain: true });

  return { casca, abrir, fechar };
}
