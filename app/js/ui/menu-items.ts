// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/menu-items — WHAT COUNTS AS A MENU ITEM, and the number each one shows (ADR-0158).
//
// ========================= WHY ONE MODULE HOLDS BOTH =========================
// ADR-0158 rule 2: «the number is the spoken index's number». The spoken index is computed by `ui/menu-nav` over
// the cursor's stops; if the numbers were computed over anything else — rows, say — a row holding a switch and a
// volume slider would show one number and be announced as two. So the list of stops lives HERE, once, and both the
// navigation and the numbering read it. Two copies of a selector is how «2 of 7» and a written «3» drift apart.
//
// 📌 A LEAF, importing nothing: `ui/mount-panel` needs the numbering and must not pull `ui/menu-nav`, which pulls the
// whole pause slice.

/** The controls that are a stop of the cursor. `[data-passos]` is ONE stop: its arrows are finger targets. */
export const ITEM_SELECTOR = 'button:not([disabled]), select:not([disabled]), input[type=range]:not([disabled]), [data-passos]';

/**
 * The stops of a card, in reading order — only the ones laid out.
 *
 * `offsetParent === null` = out of the layout flow (hidden, `display:none`, or inside a hidden tab). Without it the
 * cursor lands on an invisible control and the screen reader announces something nobody sees.
 */
export function itensNavegaveis(card: ParentNode): HTMLElement[] {
  return [...card.querySelectorAll<HTMLElement>(ITEM_SELECTOR)].filter((el) => el.offsetParent !== null);
}

/** The attribute a row or a button carries its number in; drawn by `style.css` with `attr()`. */
export const ATRIBUTO_DO_NUMERO = 'data-item-num';
const CLASSE_DO_NUMERO = 'item-num';

/**
 * Writes each stop's number, 1..n, where the eye finds it.
 *
 * · the FIRST stop of a `.ctrl-row` numbers the ROW — the number sits before the row's label;
 * · a further stop in the same row gets its own number right before it (a `span`, since a range input draws no
 *   `::before`);
 * · a stop outside any row (the «Voltar» row, the reset) numbers itself.
 *
 * IDEMPOTENT: every earlier number is cleared first, so a re-render, a row that hides, or a panel opened twice
 * leaves exactly one number per stop. `aria-hidden` on the span, `/ ""` in the stylesheet: the number stays out of
 * the accessible name, because the spoken index already says it.
 */
export function numerarItens(card: HTMLElement): void {
  for (const el of card.querySelectorAll<HTMLElement>(`[${ATRIBUTO_DO_NUMERO}]`)) el.removeAttribute(ATRIBUTO_DO_NUMERO);
  for (const el of card.querySelectorAll<HTMLElement>(`.${CLASSE_DO_NUMERO}`)) el.remove();
  itensNavegaveis(card).forEach((item, i) => {
    const n = String(i + 1);
    const linha = item.closest<HTMLElement>('.ctrl-row');
    if (!linha || !card.contains(linha)) { item.setAttribute(ATRIBUTO_DO_NUMERO, n); return; }
    if (!linha.hasAttribute(ATRIBUTO_DO_NUMERO)) { linha.setAttribute(ATRIBUTO_DO_NUMERO, n); return; }
    const marca = (card.ownerDocument ?? document).createElement('span');
    marca.className = CLASSE_DO_NUMERO;
    marca.setAttribute('aria-hidden', 'true');
    marca.textContent = n;
    item.before(marca);
  });
}
