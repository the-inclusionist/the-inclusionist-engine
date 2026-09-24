// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/reach-notice.ts — THE SCREEN THAT SAYS, BEFORE STARTING, that this child's controller does not reach this game.
// Issue #112; the arithmetic is `input/transports`'s (ADR-0079 §3).
//
// ⚠️ WHY THIS IS NOT POLISH. A transport has a fixed number of slots and a game can ask for more positions than it has
// (ADR-0085). On a public-school tablet, touch is not the alternative path, it is the ONLY one. Without this screen the
// child discovers in the middle of a match that an action is out of reach and concludes the game is broken, with no
// way to know it is not. The honest answer is a sentence BEFORE, not half a playable screen.
//
// ⚠️ IT INFORMS, IT DOES NOT REFUSE — and that decision holds up everything else. Keyboard detection is imprecise by
// nature: no API says a physical keyboard is attached, and a tablet WITH a keyboard answers "touch" to the
// `pointer:coarse && hover:none` the project uses. If this screen blocked, that tablet would get a FALSE refusal in a
// game it can play. By informing, the error costs one extra sentence and never a closed door.
//
// ⚠️ AND THE TEXT IS SHAPED APART FROM THE DOM on purpose: the sentences are what needs careful reading and translating
// into three languages, and the node project can check them with no browser.
import type { Reach } from '../input/transports.js';

/** `core/i18n.t` — injected so the core stays pure and the test can see the raw keys. */
export type Translator = (key: string, params?: Record<string, string | number>) => string;

/**
 * THE NOTICE'S SENTENCES, in reading order. Empty = there is nothing to say, which is the common case.
 *
 * ⚠️ THE LAST LINE HAS TWO FORMS, and the difference between them is the difference between helping and lying:
 *
 *   · some transport would serve if switched on → tell the child to switch it on, which is actionable.
 *   · there is none → telling them to plug in a controller would send the child looking for something that does not
 *     solve it. Then the problem is the GAME's, which asks for more positions than any transport on this device
 *     offers, and the honest sentence is a different one.
 */
export function noticeRows(a: Reach, t: Translator): string[] {
  if (a.ok) return [];

  const name = (id: string): string => t('reach.nome.' + id);
  const rows = [t('reach.titulo', { pedidas: a.asked })];

  for (const c of a.short) {
    rows.push(t('reach.curto', { transporte: name(c.id), lugares: c.slots }));
  }

  // ⚠️ THE THIRD SENTENCE exists because a transport can REACH every action and still not let the child play
  // (ADR-0104): holding three actions at once takes three fingers, and a phone that recognises two does not give
  // them. The child would try, nothing would happen, and they would conclude the game was broken.
  for (const s of a.cannotHold) {
    rows.push(t('reach.naoSegura', { transporte: name(s.id), segura: s.holds, pedidas: a.holdsAsked }));
  }

  rows.push(a.wouldServeIfOn.length
    ? t('reach.ligue', { saida: a.wouldServeIfOn.map(name).join(t('reach.ou')) })
    : t('reach.semSaida'));

  return rows;
}

export interface ReachNoticeCtx {
  /** `querySelector` of this game's document. */
  find: (sel: string) => HTMLElement | null;
  /** `document.createElement`. Injected like everything else that touches the document. */
  create: (tag: string) => HTMLElement;
  t: Translator;
  /** Assertive announcement. A blind child has to HEAR this — they will not see the card. */
  srAlert: (text: string) => void;
}

/** The card's id. Stable because the test and the stylesheet look for it. */
export const REACH_NOTICE_ID = 'reach-notice';

/**
 * Shows the notice, if there is something to say. Returns `true` when it showed.
 *
 * ⚠️ BUILT FROM NODES AND NOT `innerHTML`. The sentences go through `t()`, and a dictionary is content that changes
 * without code review — exactly the boundary issue #106 maps. `textContent` settles it with nothing to escape.
 */
export function showReachNotice(ctx: ReachNoticeCtx, a: Reach): boolean {
  const rows = noticeRows(a, ctx.t);
  if (rows.length === 0) return false;

  const isInside = ctx.find('#game-region');
  if (!isInside) return false; // without the host's markup there is nowhere to show it; `problems` already reports that

  const overlay = ctx.create('div');
  overlay.id = REACH_NOTICE_ID;
  overlay.className = 'overlay';

  const card = ctx.create('div');
  card.className = 'overlay__card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('tabindex', '-1');

  for (const [i, text] of rows.entries()) {
    const p = ctx.create('p');
    p.textContent = text;
    if (i === 0) p.className = 'reach-notice__titulo';
    card.appendChild(p);
  }

  // ⚠️ THE BUTTON IS WHAT MAKES THIS A NOTICE AND NOT A CLOSED DOOR. See the header: keyboard detection errs, and the
  // error is only acceptable while the child can carry on.
  const continueButton = ctx.create('button');
  continueButton.setAttribute('type', 'button');
  continueButton.className = 'mode-btn';
  continueButton.textContent = ctx.t('reach.continuar');
  continueButton.addEventListener('click', () => overlay.remove());
  card.appendChild(continueButton);

  overlay.appendChild(card);
  isInside.appendChild(overlay);

  // Focus goes to the card, not the button: the child has to HEAR the reason before finding the way out.
  // (On the button, a screen reader would read "Play anyway" and the rest would be left for whoever looked.)
  card.focus();
  ctx.srAlert(rows.join(' '));
  return true;
}
