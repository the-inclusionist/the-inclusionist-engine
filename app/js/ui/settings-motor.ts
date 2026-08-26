// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-motor — MOTOR / MOVIMENTO POR JOGADOR panel (Estágio 4): extracted from game.js's
// renderMovPlayers()/reflectFacil()/reflectAltMove()/setEasy() (~line 2136). Pure logic (per-player tab
// clamp/view-model, the "any player active" predicate, the Modo Fácil announcement text) is separated from the
// thin DOM-touching render/reflect functions. DI via initSettingsMotor(ctx): `$` (DOM selector), `srSay`,
// `store` (platform/storage shape), `players`/`getNumPlayers` (core/state.ts's live state) and two setters that
// stay OUTSIDE this module because they are shared with other UI surfaces: `setToggleMove` (also fired by the
// pause-menu quick-icon `iconAct('altmove', …)`, unrelated to this panel) and `rebuildCoins` (coin subsystem,
// Modo Fácil puts coins on the ground). Overlay open/close plumbing (frontOverlay, #movement hidden toggle,
// Escape handling, renderMapHub) is the SHARED helper used by every settings panel and stays in game.js.

import { toggleLabel } from './dom.js';
import type { PlayerView } from '../core/entity.js';
import { t } from '../core/i18n.js';
import { markChanged, markMenuChanged } from './changed-mark.js';
import { DEFAULTS } from '../core/state.js';
import type { DomQuery } from '../core/dom-query.js';

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** Minimal platform/storage.ts shape this module needs. */
export interface MotorStore {
  setBool(key: string, on: boolean): void;
}

/** Minimal per-player shape this module reads/writes (core/state.ts's `players` entries carry much more). */
/** As duas escolhas motoras por jogador: modo Fácil e teclas de alternância. */
export type MotorPlayer = PlayerView<'easy' | 'toggleMove'>;

export interface SettingsMotorCtx {
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /** Screen-reader announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Persistence (platform/storage.ts), injected. */
  store: MotorStore;
  /** Live player list (core/state.ts's `players` — mutated in place, same reference every call). */
  players: MotorPlayer[];
  /** Live player count (core/state.ts's `numPlayers`); a getter because the value is reassigned over time. */
  getNumPlayers: () => number;
  /** SHARED setter (also used by the pause-menu quick icon `altmove`) — stays in game.js, injected. */
  setToggleMove: (i: number, on: boolean) => void;
  /** Coin layout depends on any player's Modo Fácil (moedas no chão) — owned by the coin subsystem, injected. */
  rebuildCoins: () => void;
}

export interface SettingsMotorApi {
  /** Re-renders #movement-players (kept `hidden`, per E3 — see playerTabsHTML) and (re)wires its buttons. */
  renderMovPlayers: () => void;
  /** Reflects the selected player's Modo Fácil onto #opt-facil (+ the #opt-movement bar light). */
  reflectFacil: () => void;
  /** Reflects the selected player's alternância onto #opt-altmove (+ the #opt-movement bar light). */
  reflectAltMove: () => void;
  /** Sets Modo Fácil for player `i`; mirrors the old setEasy(i,on). */
  setEasy: (i: number, on: boolean) => void;
  /** Selects which player this panel edits (mirrors `selMovPlayer = pauseActor` before opening the panel). */
  setSelPlayer: (i: number) => void;
  /** Currently selected player index. */
  getSelPlayer: () => number;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no `document`, testable in node)
// ---------------------------------------------------------------------------------------------

/** localStorage key for a player's Modo Fácil flag (== platform/storage.ts's `easy_p{i}` pattern). */
export function easyKey(i: number): string {
  return 'incl_easy_p' + i;
}

/** Clamps the selected player back to 0 once it falls outside 0..numPlayers-1 (e.g. player count dropped). */
export function clampSelPlayer(sel: number, numPlayers: number): number {
  return sel >= numPlayers ? 0 : sel;
}

/** Whether ANY player currently uses Modo Fácil or alternância — lights the #opt-movement bar button. */
export function anyMotorActive(players: MotorPlayer[]): boolean {
  return players.some((p) => p.easy || p.toggleMove);
}

/** '❚❚ Ligado' / '▶ Desligado' para #opt-facil e #opt-altmove. Reexporta o de ui/dom, que é o único que
 *  existe desde o item 14 — o corpo daqui era uma cópia, e o comentário já dizia "shared" sem sê-lo. */
export const onOffLabel = toggleLabel;

/**
 * Full innerHTML for #movement-players, given the player count and the active index. Pure string building —
 * no DOM. NOTE (verbatim from game.js, E3): the panel keeps this list `hidden` — a single player edits only
 * their own screen (scope = pauseActor) — but the tabs/buttons are still built and wired for >1 player.
 */
export function playerTabsHTML(numPlayers: number, selected: number): string {
  if (numPlayers <= 1) return '';
  return Array.from(
    { length: numPlayers },
    (_, p) => `<button class="mode-btn${p === selected ? ' is-on' : ''}" data-mp="${p}" type="button">Jogador ${p + 1}</button>`,
  ).join('');
}

/**
 * O 'Jogador N: ' que abre um anúncio quando há mais de uma tela. Uma tela só não leva prefixo — dizer
 * "Jogador 1" para quem está sozinho é ruído, e ruído no leitor de tela custa tempo de escuta.
 */
export function playerPrefix(i: number, numPlayers: number): string {
  return numPlayers > 1 ? t('sr.player.prefix', { n: i + 1 }) : '';
}

/** srSay text for a Modo Fácil change. A frase inteira vem do dicionário — ver `sr.motor.easyOn`. */
export function easyAnnouncement(i: number, numPlayers: number, on: boolean): string {
  return playerPrefix(i, numPlayers) + t(on ? 'sr.motor.easyOn' : 'sr.motor.easyOff');
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

export function initSettingsMotor(ctx: SettingsMotorCtx): SettingsMotorApi {
  let selMovPlayer = 0; // jogador selecionado no painel Acessibilidade motora

  const facilBtn = ctx.$<HTMLElement>('#opt-facil');
  const altMoveBtn = ctx.$<HTMLElement>('#opt-altmove');

  // barra acende se QUALQUER jogador usa Fácil/alternância
  function reflectMovementBtn(): void {
    const b = ctx.$<HTMLElement>('#opt-movement');
    if (b) b.classList.toggle('is-on', anyMotorActive(ctx.players));
    refreshMarks();
  }

  /**
   * A marca de "saiu do padrão" (ADR-0029). Pendurada no reflect que JÁ roda a cada mudança dos dois
   * controles, porque uma marca que precise de uma chamada própria é uma marca que alguém vai esquecer —
   * e uma marca errada manda a criança desfazer o que ela nunca mexeu.
   *
   * O escopo segue o do reset deste menu: as duas PREFERÊNCIAS. Os métodos de entrada (olhos, mapeamento)
   * ficam de fora aqui também — não porque não possam mudar, mas porque o padrão deles não mora em DEFAULTS,
   * e marcar sem uma fonte única de "o que é padrão" seria inventar uma segunda opinião sobre isso.
   */
  function refreshMarks(): void {
    const easy = ctx.players.some((p) => !!p.easy) !== DEFAULTS.easy;
    const alt = ctx.players.some((p) => !!p.toggleMove) !== DEFAULTS.toggleMove;
    markChanged(facilBtn?.closest<HTMLElement>('.ctrl-row') ?? null, easy);
    markChanged(altMoveBtn?.closest<HTMLElement>('.ctrl-row') ?? null, alt);
    markMenuChanged(ctx.$<HTMLElement>('[data-act="motora"]'), [easy, alt]);
  }

  function reflectFacil(): void {
    const p = ctx.players[selMovPlayer];
    const on = !!(p && p.easy);
    if (facilBtn) {
      facilBtn.classList.toggle('is-on', on);
      facilBtn.setAttribute('aria-pressed', String(on));
      facilBtn.textContent = onOffLabel(on);
    }
    reflectMovementBtn();
  }

  function reflectAltMove(): void {
    const p = ctx.players[selMovPlayer];
    const on = !!(p && p.toggleMove);
    if (altMoveBtn) {
      altMoveBtn.classList.toggle('is-on', on);
      altMoveBtn.setAttribute('aria-pressed', String(on));
      altMoveBtn.textContent = onOffLabel(on);
    }
    reflectMovementBtn();
  }

  function setEasy(i: number, on: boolean): void {
    const p = ctx.players[i];
    if (!p) return;
    p.easy = on;
    ctx.store.setBool(easyKey(i), on);
    reflectFacil();
    ctx.rebuildCoins();
    ctx.srSay(easyAnnouncement(i, ctx.getNumPlayers(), on));
  }

  function renderMovPlayers(): void {
    const tabs = ctx.$<HTMLElement>('#movement-players');
    if (!tabs) return;
    const numPlayers = ctx.getNumPlayers();
    selMovPlayer = clampSelPlayer(selMovPlayer, numPlayers);
    tabs.hidden = true; // E3: sem abas — cada jogador edita só o seu (escopo = pauseActor)
    tabs.innerHTML = playerTabsHTML(numPlayers, selMovPlayer);
    tabs.querySelectorAll<HTMLButtonElement>('button[data-mp]').forEach((b) => {
      b.addEventListener('click', () => {
        selMovPlayer = Number(b.dataset.mp);
        renderMovPlayers();
        reflectFacil();
        reflectAltMove();
      });
    });
  }

  if (facilBtn) {
    facilBtn.addEventListener('click', () => setEasy(selMovPlayer, !ctx.players[selMovPlayer].easy));
  }
  if (altMoveBtn) {
    altMoveBtn.addEventListener('click', () => {
      ctx.setToggleMove(selMovPlayer, !ctx.players[selMovPlayer].toggleMove);
      reflectAltMove();
    });
  }

  // ---- restaurar os padrões DESTE menu (ADR-0028) ----
  //
  // O alcance aqui é MENOR que a tela, e de propósito. A Acessibilidade motora hospeda quatro coisas: Modo
  // Fácil, movimento por alternância, o controle pelos olhos (#opt-eyes) e o mapeamento de teclas (#map-hub).
  // O reset devolve as duas PREFERÊNCIAS e não encosta nos dois MÉTODOS DE ENTRADA, por uma razão que vale
  // mais que a simetria:
  //
  //   UM RESET SÓ PODE DESFAZER O QUE ELE TAMBÉM CONSEGUE REFAZER.
  //
  // A criança que joga com os olhos aponta com os olhos. Desligar o controle pela webcam tira dela o ponteiro
  // com que ela clicaria o botão de volta — o reset deixaria de remover uma armadilha para virar uma, e a
  // saída passaria a depender de outra pessoa estar por perto. O mesmo vale para quem remapeou as teclas
  // porque só alcança algumas: devolver o mapa de fábrica é devolver teclas que a mão dela não chega. Esse
  // mapeamento, aliás, já tem o reset dele (#ctrl-reset), onde a escolha é explícita e não um efeito colateral.
  //
  // Por isso o anúncio DIZ o que ficou de fora: um botão que restaura menos do que o nome promete precisa
  // dizer isso em voz alta, ou a criança conclui que ele não funcionou.
  const resetBtn = ctx.$<HTMLButtonElement>('#movement-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    ctx.players.forEach((p, i) => {
      if (p.easy) setEasy(i, false);
      if (p.toggleMove) ctx.setToggleMove(i, false);
    });
    reflectFacil();
    reflectAltMove();
    ctx.srSay(t('sr.motor.reset'));
  });

  reflectFacil();
  reflectAltMove();

  return {
    renderMovPlayers,
    reflectFacil,
    reflectAltMove,
    setEasy,
    setSelPlayer: (i: number) => { selMovPlayer = i; },
    getSelPlayer: () => selMovPlayer,
  };
}
