// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/pause-buttons — the items of the pause card the engine mounts: root, the game's options and the inclusion settings.
//
// Menu data for `ui/pause-icons`. They lived in `ui/activities-menu`, the platformer's title menu, which left the engine
// (ADR-0174, issue #171); the card is the engine's, so its buttons stay.

/** One row of the per-screen pause menu. `letra` marks the label that ABC/abc rewrites live. */
export interface PauseBtnDef {
  readonly act: string;
  /**
   * RAW label, used only when the button has a dynamic label (`dynamicLabel`/`level`).
   *
   * Optional because `pmBtnMarkup` resolves every ordinary button through `t('pause.' + act)`, so text here would
   * never reach a screen — it would be raw text inside an ENGINE module, waiting for someone to trust it. No entry
   * today sets a dynamic label; the `pause.*` key is the source, and it exists in all three languages.
   */
  readonly lbl?: string;
  readonly dynamicLabel?: boolean;
  readonly level?: boolean;
}

/** The pause menu's items — MENU DATA, so it lives with the other menu tables. The pause slice (ui/pause-icons)
 *  receives it through its own ctx instead of re-declaring it; nobody owns two copies of a list of buttons. */
export const PM_BTNS: readonly PauseBtnDef[] = [
  // ===================== THE ORDER IS THE DECISION (ADR-0044 §2) =====================
  // A menu you cannot leave is a trap, and the trap costs most to whoever cannot see it. `resume` comes FIRST because
  // that is what a pause is for. `quit` comes LAST because it is its least wanted outcome — and, since the list is a
  // RING, one key UP from `resume` reaches it: far in reading order, near to the finger.
  //
  // The settings panels live in `PM_OPTIONS_BTNS`.
  //
  // 🔴 SIX (ADR-0151), and the number is MEASURED, not taste: at 640×360, the target screen, seven items fit exactly
  // and more overflow, while the target ruler is already at its floor (ADR-0095: «tela menor mostra menos itens, não
  // alvos menores»).
  //
  // 📌 The accessibility bar and the print view are reached through SELECT — «basta apertar SELECT que se tem a visão
  // apropriada pra print», in the Dev's words. Their `act`s still exist and work for whoever passes a list of their own.
  { act: 'resume' },
  // Help — how to play comes SECOND: it is the first thing someone who paused without knowing how to play looks for.
  { act: 'ajuda' },
  // ⚠️ The `act` stays `addplayer` and the LABEL is the number of players (ADR-0147 §3): `ui/shell.ts` implements
  // `pauseActs.addplayer`, and cases in `shell.browser.test.js` call it.
  { act: 'addplayer' },
  // Inclusion settings: what the child CARRIES between games (ADR-0146, named by ADR-0151).
  { act: 'options' },
  // Game options: what belongs to THIS game. The door drops by itself when the game declares nothing of its own.
  { act: 'opcoesdojogo' },
  { act: 'quit' },
];

/**
 * THE THIRD LIST: what belongs to THIS game (ADR-0146, ADR-0145).
 *
 * ⚠️ IT STARTS WITH THE BACK ITEM AND NOTHING ELSE, and the emptiness is the decision: the engine does not know what a
 * game has of its own — the game declares it. A list the engine filled in would be the wheelchair in chess again.
 *
 * 📌 And that is why the door drops by itself: `rootThatActs` drops a door whose room is empty, and with this list
 * reduced to `pmback` that is exactly the case of a game that declares nothing.
 */
export const PM_GAME_BTNS: readonly PauseBtnDef[] = [
  { act: 'pmback' },
];

/**
 * THE INCLUSION SETTINGS SUBMENU — the panels, in the order the Dev dictated (ADR-0151).
 *
 * The way out comes FIRST here too, for the same reason `resume` comes first there: ADR-0044's rule is about menus,
 * not about one menu. A submenu you cannot leave is the same trap, one level down.
 */
export const PM_OPTIONS_BTNS: readonly PauseBtnDef[] = [
  // 📌 Not here, and each has somewhere to go (ADR-0151): letter case walks the communication cycle of the bar's
  // eleventh button, and typography — «quem escolhe a tipografia é o jogo, o jogador escolhe suas fontes via o menu de
  // acessibilidade rápida».
  // 📏 AND THE NUMBER IS WHAT FITS at 640×360; the submenu has its own case in the 44 px gate, not only the root.
  // ✅ The audio panel (music, ambience, interaction, earcons), separate from hearing accessibility, is listed because
  // the panel it opens exists — a door to a panel that does not exist would be ADR-0106 §5's dead button.
  { act: 'pmback' },
  { act: 'empatia' },
  { act: 'audio' },
  { act: 'som' },
  { act: 'motora' },
  { act: 'visual' },
  { act: 'anim' },
];
