// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hud-bands — the HUD the engine mounts from the numbers a cartridge declares by band (ADR-0168; ADR-0059 §1; issue #162).
//
// A number sits with what it is ABOUT (ADR-0059 §1). Two bands are the game's to fill:
//   · identity — true of the PERSON and surviving the round (the point count): top left, beside the quick bar;
//   · round — what this round granted and resets with it (a super-power, the round's objective counter): below the quick
//     bar (ADR-0168, erratum of 2026-09-13).
// 📌 The other two are not declared by a game: the session clock is the adult's (ADR-0050 §3), and the learning bars are a
// skill's (ADR-0049 §5). Neither has a producer in the engine yet, so neither is mounted.
//
// The HUD is STATE: consulted, never announced — no live region here (ADR-0059; `core/contract` §7).
//
// No I/O on import: `hudNumbersProblems` runs in node.
import type { Speakable } from '../core/contract.js';
import { t } from '../core/i18n.js';

export type HudBand = 'identity' | 'round';
const HUD_BANDS: readonly HudBand[] = ['identity', 'round'];

/** A count, or how many of how many. */
export type HudValue = number | { readonly have: number; readonly need: number };

export interface HudNumber {
  readonly band: HudBand;
  /** What is counted, in the interface language («points», «balls»). */
  readonly name: Speakable;
  /** The value now, for seat `seat`. Read on every animation frame while mounted, so it must be cheap. */
  readonly value: (seat: number) => HudValue;
}

/** What the child reads: «Points: 12», or «3 of 10 coins» — the frame in the dictionary, the name through a parameter. */
function hudNumberText(n: HudNumber, seat: number): string {
  const v = n.value(seat);
  return typeof v === 'number'
    ? t('hud.numero', { nome: n.name.text, valor: String(v) })
    : t('hud.contador', { have: String(v.have), need: String(v.need), nome: n.name.text });
}

/** Why a `hud` declaration is malformed; empty when it is well formed. Absent is well formed: no HUD is mounted. */
export function hudNumbersProblems(numbers: unknown): string[] {
  if (numbers === undefined) return [];
  if (!Array.isArray(numbers)) return ['hud must be a list of numbers'];
  const out: string[] = [];
  numbers.forEach((n: Partial<HudNumber> | null, i) => {
    if (!n || !HUD_BANDS.includes(n.band as HudBand)) out.push(`hud[${i}].band must be one of ${HUD_BANDS.join(', ')}`);
    if (!n || typeof n.name?.text !== 'string' || !n.name.text.trim()) out.push(`hud[${i}].name.text must say what is counted`);
    if (!n || typeof n.value !== 'function') out.push(`hud[${i}].value must be a function of the seat`);
  });
  return out;
}

export interface HudBandsMounted {
  readonly identity: HTMLElement;
  readonly round: HTMLElement;
  /** Rewrites what changed; `true` when any text did, so the caller measures the room again. */
  refresh(): boolean;
  remove(): void;
}

/** Mounts both bands in the game region, one element per declared number, and fills them. A band with no number is hidden. */
export function mountHudBands(doc: Document, region: HTMLElement, numbers: readonly HudNumber[], seat = 0): HudBandsMounted {
  const band = (cls: string, which: HudBand): { el: HTMLElement; items: [HudNumber, HTMLElement][] } => {
    const el = doc.createElement('div');
    el.className = `hud-faixa ${cls}`;
    const items = numbers.filter((n) => n.band === which).map((n): [HudNumber, HTMLElement] => {
      const p = doc.createElement('p');
      p.className = 'hud-numero';
      el.appendChild(p);
      return [n, p];
    });
    el.hidden = items.length === 0;
    region.appendChild(el);
    return { el, items };
  };
  const identity = band('hud-identidade', 'identity');
  const round = band('hud-rodada', 'round');
  const all = [...identity.items, ...round.items];
  function refresh(): boolean {
    let changed = false;
    for (const [n, p] of all) {
      const text = hudNumberText(n, seat);
      if (p.textContent !== text) { p.textContent = text; changed = true; }
    }
    return changed;
  }
  refresh();
  return {
    identity: identity.el,
    round: round.el,
    refresh,
    remove: () => { identity.el.remove(); round.el.remove(); },
  };
}
