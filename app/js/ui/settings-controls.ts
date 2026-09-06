// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-controls — Keyboard-remap panel (Estágio 4): extracted from game.js's renderControls()/keyName()/
// the captureAction+captureMapRef remap flow. Pure logic (key→label, cross-player conflict lookup) is separated
// from the thin DOM-touching render()/handleCaptureKeydown(). DI via initSettingsControls(ctx): `$` (DOM
// selector), `srSay`/`srAlert`, `store` (save/reset persistence), the live `kb` value + `setKB` setter, and the
// shared per-player helpers (`kbFor`/`getNumPlayers`/`applyControls`/`assignControls`) that game.js also uses
// elsewhere (gamepad binding, HUD, other settings panels) and therefore stay there, injected. Overlay open/close
// plumbing (#options hidden toggle, focus management, Escape-closes-dialog) and the pad-button-design select are
// shared/unrelated infra and stay in game.js. `openHelp()` (pause-menu help screen) reuses ACT_LABEL/keyName —
// both are exported here instead of duplicated.
import { t } from '../core/i18n.js';
import type { DomQuery } from '../core/dom-query.js';
import type { KeyScheme } from '../core/entity.js';
import type { KBDefaults } from '../input/keyboard.js';
import type { KeydownEventLike } from '../input/keydown.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** action -> list of physical key codes (KeyboardEvent.code), e.g. {jump:['KeyJ','Space']}. */
// `KeyScheme` mora em `core/entity` desde 2026-08-26: a entidade declara `ctrl: KeyScheme | null`, então
// ela é a dona. A mesma linha estava escrita em SEIS módulos. Reexportada para quem já a importava daqui.
export type { KeyScheme } from '../core/entity.js';

/** Opaque keyboard config (input/keyboard.ts's KBDefaults shape: {solo,p2,p3,p4}) — never indexed directly here;
 *  all per-player reads go through the injected `kbFor`, so this module stays decoupled from its exact shape. */
/** O `KBDefaults` de `input/keyboard`, que é o dono. Este módulo continua NÃO INDEXANDO o valor — toda
 *  leitura por jogador passa pelo `kbFor` injetado —, e é essa disciplina que o desacopla, não um tipo largo. */
export type KeyboardConfig = KBDefaults;

/** Minimal persistence shape this module needs (input/keyboard.ts's saveKB/resetKB — no direct localStorage). */
export interface ControlsStore {
  saveKB(kb: KeyboardConfig): void;
  resetKB(): KeyboardConfig;
}

export interface SettingsControlsCtx {
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /** Screen-reader "polite" announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Screen-reader "assertive" announcement (core/a11y-sr's srAlert) — used for the capture prompt/conflict. */
  srAlert: (msg: string) => void;
  /** Persistence (input/keyboard.ts's saveKB/resetKB), injected. */
  store: ControlsStore;
  /** The live keyboard config object (game.js's `KB`). Mutated in place by successful remaps. */
  kb: KeyboardConfig;
  /** Replaces game.js's `KB` binding wholesale — only used by "restaurar padrões" (reset reassigns, doesn't mutate). */
  setKB: (kb: KeyboardConfig) => void;
  /** Shared helper (game.js): the scheme for a given player index, given `kb`/numPlayers. Not owned by this panel —
   *  other systems (gamepad binding, HUD) call the same game.js function. */
  kbFor: (playerIndex: number) => KeyScheme;
  /** Shared: current player count (core/state.ts's numPlayers, read live via game.js). */
  getNumPlayers: () => number;
  /** Shared: propagates `kb` -> the live control aliases (game.js's applyControls). Called after remap/reset. */
  applyControls: () => void;
  /** Shared: propagates `kb` -> each player's `p.ctrl` (game.js's assignControls). Called after remap/reset. */
  assignControls: () => void;
}

export interface SettingsControlsApi {
  /** Re-renders #ctrl-list for the given player index and (re)wires its "Alterar" buttons. Idempotent. */
  render: (selPlayer: number) => void;
  /** True while a key capture is in progress (game.js's menuNavKey gates menu navigation on this). */
  isCapturing: () => boolean;
  /** Cancels any in-progress capture without re-rendering (dialog is closing anyway). */
  cancelCapture: () => void;
  /**
   * Feeds a keydown to the in-progress capture, if any. Returns true when the event was consumed (capture was
   * active — Escape/conflict/success all consume it) so game.js's own keydown handler can early-return exactly
   * like the old inline `if(captureAction){...}` block did. Returns false (no-op) when nothing is being captured.
   */
  /** `KeydownEventLike` de `input/keydown`, que é quem escuta o teclado e portanto é dono da forma do
   *  evento nesta engine. Este manipulador lê só `e.code` e chama `preventDefault()` — um subconjunto —,
   *  mas pedir o `KeyboardEvent` inteiro obrigava o despacho a entregar mais do que tem (ADR-0039). */
  handleCaptureKeydown: (e: KeydownEventLike) => boolean;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no `document`, testable in node)
// ---------------------------------------------------------------------------------------------

/**
 * action key -> i18n KEY of the label shown in the panel. Also reused by main.js's openHelp() (pause-menu help
 * screen), which is why it lives here instead of being duplicated in two places.
 *
 * Holds keys, not text, for the reason spelled out in input/devices: a module-level const is evaluated once at
 * import, and core/i18n's `dict` is a `let` that setLocale reassigns — text captured here would freeze the
 * language at boot. Resolve with `t(ACT_LABEL[a])` at the point of use.
 */
export const ACT_LABEL: Record<string, string> = {
  left: 'act.left', right: 'act.right', up: 'act.up', down: 'act.down',
  action1: 'act.run', action2: 'act.jump', action4: 'act.swap', action3: 'act.especial',
};

/** Physical key code -> short readable label. Only 'Space' has a word to translate; the rest are glyphs and
 *  bare letters, identical in every language (that is why this is a chain of replaces and not a table). */
export function keyName(code: string): string {
  return String(code)
    .replace('Arrow', '↔')
    .replace('Key', '')
    .replace('Space', t('key.space'))
    .replace('ShiftLeft', 'Shift')
    .replace('ShiftRight', 'Shift');
}

/**
 * Which OTHER player already owns `code`, among `schemes` (one entry per player, same order as player index) —
 * or -1 if free. `mapRef` (the scheme currently being edited) is excluded by reference, mirroring the original
 * `keyUsedByOther(code, mapRef)` closing over `kbFor`/numPlayers in game.js. Built over a Map (code -> owner
 * index) so a scheme with many bound keys doesn't cost a full re-scan per lookup.
 */
export function keyUsedByOther(code: string, mapRef: KeyScheme, schemes: readonly KeyScheme[]): number {
  const owners = new Map<string, number>();
  schemes.forEach((m, i) => {
    if (m === mapRef) return;
    for (const a in m) for (const c of m[a] || []) if (!owners.has(c)) owners.set(c, i);
  });
  return owners.get(code) ?? -1;
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

interface CaptureState { action: string; mapRef: KeyScheme; player: number }

export function initSettingsControls(ctx: SettingsControlsCtx): SettingsControlsApi {
  let kb = ctx.kb;
  let capture: CaptureState | null = null;
  let lastPlayer = 0;

  function schemesFor(): KeyScheme[] {
    const n = ctx.getNumPlayers();
    return Array.from({ length: n }, (_, i) => ctx.kbFor(i));
  }

  function render(selPlayer: number): void {
    const el = ctx.$<HTMLElement>('#ctrl-list');
    if (!el) return;
    const n = ctx.getNumPlayers();
    const player = selPlayer >= n ? 0 : selPlayer;
    lastPlayer = player;

    // E3: sem abas de outros jogadores — você edita só o seu controle; só o hint muda com o modo.
    const tabs = ctx.$<HTMLElement>('#ctrl-players');
    if (tabs) {
      tabs.hidden = false;
      tabs.innerHTML = `<span class="opt-hint" style="width:100%;margin:0">Editando o <strong>seu</strong> controle — modo <strong>${n === 1 ? '1 jogador' : n + ' jogadores'}</strong>.</span>`;
    }

    const map = ctx.kbFor(player);
    el.innerHTML = Object.keys(ACT_LABEL).map((a) =>
      `<div class="ctrl-row"><span>${t(ACT_LABEL[a]!)}: ${(map[a] || []).map(keyName).map((k) => `<kbd>${k}</kbd>`).join(' ')}</span>` +
      `<button class="mode-btn" data-act="${a}" type="button" aria-label="${t('ctrl.changeKeyAria', { acao: t(ACT_LABEL[a]!), n: player + 1 })}">${t('ctrl.change')}</button></div>`
    ).join('');

    el.querySelectorAll<HTMLButtonElement>('button[data-act]').forEach((b) => {
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (!act) return;
        capture = { action: act, mapRef: map, player };
        b.textContent = 'Pressione…';
        ctx.srAlert(t('sr.ctrl.pressNewKey', { acao: t(ACT_LABEL[act]!), n: player + 1 }));
      });
    });
  }

  function isCapturing(): boolean {
    return capture !== null;
  }

  function cancelCapture(): void {
    capture = null;
  }

  function handleCaptureKeydown(e: KeydownEventLike): boolean {
    if (!capture) return false;
    if (e.code === 'Escape') {
      capture = null;
      render(lastPlayer);
      e.preventDefault();
      return true;
    }
    const other = keyUsedByOther(e.code, capture.mapRef, schemesFor());
    if (other >= 0) {
      ctx.srAlert(t('sr.ctrl.keyTaken', { n: other + 1 }));
      e.preventDefault();
      return true; // não associa: segue capturando
    }
    capture.mapRef[capture.action] = [e.code];
    ctx.store.saveKB(kb);
    ctx.applyControls();
    ctx.assignControls();
    capture = null;
    render(lastPlayer);
    e.preventDefault();
    return true;
  }

  const resetBtn = ctx.$<HTMLButtonElement>('#ctrl-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      kb = ctx.store.resetKB();
      ctx.setKB(kb);
      ctx.applyControls();
      ctx.assignControls();
      render(lastPlayer);
      ctx.srSay(t('sr.ctrl.reset'));
    });
  }

  return { render, isCapturing, cancelCapture, handleCaptureKeydown };
}
