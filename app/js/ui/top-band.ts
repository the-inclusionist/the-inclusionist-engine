// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/top-band.ts — HOW MUCH SPACE THE ENGINE KEEPS FOR ITSELF AT THE TOP OF THE SCREEN (ADR-0148 §3; issue #160).
//
// The engine draws things over the game — the accessibility bar, the name of the pointed icon, the HUD's mission line
// under the bar (the rest of the HUD is a row at the bottom, `ui/hud-row`) and the scan chip — and the game has to know how much of the top is not its own. This module measures what is there and
// writes three variables on the region: `--barra-a11y-h`, the whole band, `--scan-top`, where the chip sits, and
// `--hud-mission-top`, where the mission stands under the bar (0 with no bar) — which the stylesheet reads for the bands a
// caller mounts on the region with no HUD row, since those never pass through here.
//
// 📌 It is a calculation, not wiring, which is exactly what a composition root should not hold (Seemann; Fowler): a root
// is large because it connects many things, not because it decides (ADR-0221).
//
// ⚠️ IT RECEIVES THE NODES AND THE MEASURER, and never reaches a global: this module's global reach is ZERO, which is
// what lets it be measured in a document that is not the browser's.
//
// 🔴 THE ORDER OF THE TWO WRITES IS THE DECISION: the chip is placed by `--scan-top`, which does NOT depend on it; only the
// band does. Placing it by the band it makes grow creates a loop — the chip pushes the band, the band pushes the chip,
// and it walks down the screen on every measurement. A loop is invisible to a single measurement, so the case that
// holds it measures the chip, lets the scan advance three steps — which is what re-measures the band in real use — and
// demands the same place.

/** What this module needs to see in order to measure. All injected: the module reaches neither `document` nor `window`. */
export interface TopBandCtx {
  /** The game region, where the two variables are written. Absent: there is nowhere to write, and nothing is written. */
  readonly region: HTMLElement | null;
  /** The accessibility bar. ⚠️ Absent = a ZERO band: there is nothing to reserve, and reserving anyway would take the
   *  first line of the screen from the game — 12% of the height at 640×360. */
  readonly bar: HTMLElement | null;
  /**
   * The HUD column that sits at the TOP, when mounted: the mission's, centred under the bar (ADR-0239 erratum). The rest of
   * the HUD is a row at the bottom (`ui/hud-row`), and counting it here would give the game's top to the bottom row.
   */
  readonly hud: { readonly left: HTMLElement } | null;
  /** `getComputedStyle`, injected. Absent in a document that lacks it, and then the name line is not measured. */
  readonly computedStyle?: (el: HTMLElement) => CSSStyleDeclaration;
}

/** A quarter of the scale's base, resolved BY THE STYLESHEET through a probe, so the rule has one home. */
function breathingRoom(region: HTMLElement, fallback: number): number {
  const probe = region.ownerDocument.createElement('div');
  // A quarter of the scale's base size, not of the name's: a face with a higher floor grows its TEXT, not this gap
  // (#172). `--espaco-fixo` is what shrinks with Ctrl −.
  probe.style.cssText = 'position:absolute;visibility:hidden;height:calc(var(--ui-fs,16px) / 4 * var(--espaco-fixo,1))';
  region.appendChild(probe);
  const h = probe.getBoundingClientRect().height || fallback;
  probe.remove();
  return h;
}

/**
 * The room the bar asks for: its bottom, or the bottom of the pointed icon's NAME line, plus breathing room.
 *
 * 📌 The name line counts whether or not it is showing a name — reserving only while pointing would move the game under
 * the child's finger, and leaving it out lets the name cover the top of the game.
 */
function barRoom(ctx: TopBandCtx, top: number): { room: number; breath: number } {
  const { region, bar, computedStyle } = ctx;
  if (!region || !bar || typeof bar.getBoundingClientRect !== 'function') return { room: 0, breath: 4 };
  let bottom = bar.getBoundingClientRect().bottom;
  let breath = 0;
  const name = bar.querySelector<HTMLElement>('.pause-icons-cap');
  if (name && computedStyle) {
    const cs = computedStyle(name);
    const fs = parseFloat(cs.fontSize) || 16;
    const line = (parseFloat(cs.lineHeight) || fs * 1.2) + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    bottom = name.getBoundingClientRect().top + line;
    breath = breathingRoom(region, fs / 4);
  }
  return { room: bottom - top + breath, breath };
}

/**
 * Where the mission sits, and the room it asks for: TOP CENTRE, just under the quick bar (ADR-0239 erratum), a light gap
 * below the bar's own box. 📌 The bar's momentary name line may cover it while a name shows — the Dev's call: «a legenda é
 * momentânea, a escrita da missão aparece o tempo todo» — so the mission is placed by the BAR and not by the name line, and
 * the room below the top counts whichever of the two reaches lower.
 */
function hudRoom(ctx: TopBandCtx, top: number, breath: number, room: number, under: string): number {
  const { region, hud } = ctx;
  if (!region || !hud || hud.left.hidden) return room;
  hud.left.style.top = under;
  return Math.max(room, hud.left.getBoundingClientRect().bottom - top + Math.max(breath, 4));
}

/**
 * Measures the top and writes `--hud-mission-top`, `--scan-top` and `--barra-a11y-h` on the region.
 *
 * 🔴 THE SCAN CHIP TAKES ROOM FOR THE SAME REASON AS THE NAME LINE (ADR-0218): it is HUD, and HUD that does not reserve its
 * space is the engine writing over the game. But it is PLACED by `--scan-top`, written BEFORE it widens the room; see
 * the loop in the header.
 */
export function reserveTopBand(ctx: TopBandCtx): void {
  const { region } = ctx;
  if (!region || typeof region.style?.setProperty !== 'function') return;
  const measures = typeof region.getBoundingClientRect === 'function';
  if (!measures) { region.style.setProperty('--barra-a11y-h', '0px'); return; }

  const top = region.getBoundingClientRect().top;
  const { room: barPart, breath } = barRoom(ctx, top);
  // the mission's place: just under the bar's own box, by the light gap — also for bands a caller mounts on the region with no
  // row, which the stylesheet places by `--hud-mission-top`; with no bar there is nothing to stand under, and '' removes it
  const barBox = ctx.bar && typeof ctx.bar.getBoundingClientRect === 'function' ? ctx.bar.getBoundingClientRect() : null;
  const under = barBox ? `${Math.ceil(barBox.bottom - top + Math.max(breath, 4))}px` : '';
  region.style.setProperty('--hud-mission-top', under);
  let room = hudRoom(ctx, top, breath, barPart, under);

  region.style.setProperty('--scan-top', `${Math.ceil(Math.max(0, room - breath))}px`);
  const chip = region.querySelector<HTMLElement>('.scan-now');
  if (chip && !chip.hidden) room = Math.max(0, room - breath) + chip.getBoundingClientRect().height + breath;
  region.style.setProperty('--barra-a11y-h', `${Math.ceil(room)}px`);
}
