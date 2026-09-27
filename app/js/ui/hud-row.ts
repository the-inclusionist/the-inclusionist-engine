// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hud-row — THE HUD IS ONE ROW AT THE BOTTOM of the game region (ADR-0239; issue #94), and this module builds the row's
// cells and measures the room it takes.
//
// Left to right: the learning bars · the session clock, in the centre · the score, with the power above it · the game's map.
// The mission is not here: it sits at the top centre, just under the quick bar (ADR-0239 erratum; `ui/top-band`).
//
// WHO SITS OVER WHOM at the bottom (ADR-0239 point 6), written as two variables on the region that the stylesheet reads:
//   · `--hud-row-bottom` — how far above the region's lower edge the row stands: 0, or the height of the on-screen pad's
//     lower parts while the pad shows, so the row sits ABOVE the pad;
//   · `--hud-row-h` — the row's own height, so the sound caption and the button legend sit above it, and a game's workspace
//     ends above it: `--rodape-h` is these two and nothing else, because the caption and the legend are momentary and
//     overlay the workspace while they show (ADR-0239 erratum).
// The explanation band covers the row while a menu is open: that is the stylesheet's alone.
//
// ⚠️ IT RECEIVES THE NODES and reaches no global (ADR-0232), like `ui/top-band`.

/** The row's cells, each a place something else fills: the bands (`ui/hud-bands`), the clock (`ui/session-clock`), the map. */
export interface HudRow {
  readonly row: HTMLElement;
  /** Bottom left: the learning bars. */
  readonly learning: HTMLElement;
  /** Bottom centre: the session clock. */
  readonly clock: HTMLElement;
  /** Between the centre and the right: the power above the score. */
  readonly score: HTMLElement;
  /** Bottom right: where a game mounts its own map. Empty, it is not drawn (ADR-0239 point 4). */
  readonly map: HTMLElement;
}

/**
 * Builds the row in `region`, BEFORE the screen footer when one exists, so the explanation band — drawn later on the same
 * layer — covers it. `null` where the region takes no children.
 */
export function mountHudRow(doc: Document, region: HTMLElement | null): HudRow | null {
  if (!region || typeof region.insertBefore !== 'function') return null;
  const cell = (cls: string): HTMLElement => { const el = doc.createElement('div'); el.className = cls; return el; };
  const row = cell('hud-row');
  const learning = cell('hud-row-cell hud-row-learning');
  const clock = cell('hud-row-cell hud-row-clock');
  const end = cell('hud-row-cell hud-row-end');
  const score = cell('hud-score');
  const map = cell('hud-map');
  end.appendChild(score);
  end.appendChild(map);
  for (const c of [learning, clock, end]) row.appendChild(c);
  // `children` may be missing in a host double; then there is no footer to go before
  region.insertBefore(row, Array.from(region.children ?? []).find((c) => c.classList.contains('rodape-da-tela')) ?? null);
  return { row, learning, clock, score, map };
}

/** What `reserveBottomBand` measures. The pad is the on-screen controller (`#touch-controls`), when the page has one. */
export interface BottomBandCtx {
  readonly region: HTMLElement | null;
  readonly row: HTMLElement | null;
  readonly pad: HTMLElement | null;
}

/** A pad part counts when it stands on the region's lower edge — within this many pixels of it. */
const ON_THE_EDGE_PX = 24;

/** How high the pad's lower parts reach above the region's lower edge while the pad shows; 0 when it is hidden or absent. */
function padReach(pad: HTMLElement | null, regionBottom: number): number {
  if (!pad || pad.hidden) return 0;
  let reach = 0;
  for (const part of [...pad.children]) {
    const b = part.getBoundingClientRect();
    if (b.height > 0 && regionBottom - b.bottom <= ON_THE_EDGE_PX) reach = Math.max(reach, regionBottom - b.top);
  }
  return reach;
}

/** The pad, or a part of it, in a mutation: its `hidden` changed, its parts were rebuilt, or it came or went. */
function aboutThePad(r: MutationRecord): boolean {
  return [r.target, ...Array.from(r.addedNodes), ...Array.from(r.removedNodes)].some((n) => !!(n as Element).closest?.('#touch-controls'));
}

/**
 * THE ROW FOLLOWS THE PAD AT ONCE (ADR-0239 §6): `measure` runs again whenever the on-screen pad under `host` shows, hides or is
 * rebuilt, by whichever door — a touch, a key, a menu opening or closing (ADR-0166), a new cartridge. A resize and the session
 * clock's tick are not enough: between them the row stood behind the pad for up to a second, and the explanation band that
 * stands where the row stands lay over the pad's START pill. A mutation observer answers before the next frame is drawn.
 * Returns what stops it; nothing is watched where the host has no observer.
 */
export function followThePad(host: Node | null, Observer: typeof MutationObserver | undefined, measure: () => void): () => void {
  if (!host || typeof Observer !== 'function') return () => {};
  const observer = new Observer((records) => { if (records.some(aboutThePad)) measure(); });
  observer.observe(host, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  return () => observer.disconnect();
}

/** Measures the bottom and writes `--hud-row-bottom` and `--hud-row-h` on the region (see the header). */
export function reserveBottomBand(ctx: BottomBandCtx): void {
  const { region, row } = ctx;
  if (!region || !row || typeof region.getBoundingClientRect !== 'function') return;
  const lift = Math.ceil(padReach(ctx.pad, region.getBoundingClientRect().bottom));
  region.style.setProperty('--hud-row-bottom', `${lift}px`);
  region.style.setProperty('--hud-row-h', `${Math.ceil(row.getBoundingClientRect().height)}px`);
}
