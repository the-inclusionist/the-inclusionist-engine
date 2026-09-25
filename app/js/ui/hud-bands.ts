// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hud-bands — the HUD the engine mounts from the numbers a cartridge declares by band (ADR-0168, ADR-0175; issue #162).
//
// A number sits with what it is ABOUT (ADR-0059 §1). Four bands are the game's to fill: the mission at the top centre, the
// rest in the HUD ROW at the bottom (ADR-0239; the row's cells are `ui/hud-row`'s):
//   · identity — true of the PERSON and surviving the round (the point count): the SCORE, between the row's centre and its
//     right, a count drawn as five digits with leading zeros and clamped at 99999, and named for a listener as the number
//     itself (ADR-0238);
//   · mission — a round's objective counter: top centre, just under the quick bar (ADR-0239 erratum; `ui/top-band` places
//     it from the bar's box), in the column still named `left`/`.hud-esquerda`;
//   · power — the super-power in use: above the score;
//   · learning — where the child stands in a skill: one ten-segment bar per skill, one to three, at the row's left and
//     covered, with the whole row, by the explanation band while it shows (ADR-0049 §5).
// 📌 The session clock, in the row's centre, is not declared by a game: it measures the session, never an activity
// (ADR-0050 §3), and the ROOT mounts it for every cartridge (`ui/session-clock`, ADR-0236).
//
// The HUD is STATE: consulted, never announced — no live region here (ADR-0059; `core/contract` §7).
//
// No I/O on import: `hudNumbersProblems` runs in node.
import type { Speakable } from '../core/contract.js';
import type { Translate } from '../core/i18n.js';

export type HudBand = 'identity' | 'mission' | 'power' | 'learning';
const HUD_BANDS: readonly HudBand[] = ['identity', 'mission', 'power', 'learning'];
/** ADR-0049 §5: three ten-segment bars are thirty lit elements; a fourth stops being a reading. */
const MAX_BARS = 3;
const SEGMENTS = 10;

/**
 * A skill's bar, as `educational/segment-bar.barOf` returns it — the same field names and values, so its `Bar` passes
 * straight in. Written again here because `ui` does not import `educational` (ADR-0173).
 */
export interface HudBar {
  readonly segmentos: readonly ('azul' | 'verde' | 'vermelho')[];
  readonly cor: 'nenhuma' | 'laranja' | 'roxa';
}

export type HudNumber =
  | {
    readonly band: 'identity' | 'mission' | 'power';
    /** What is counted, in the interface language («points», «balls»). */
    readonly name: Speakable;
    /** A count, or how many of how many, for seat `seat`. Read on every animation frame while mounted: keep it cheap. */
    readonly value: (seat: number) => number | { readonly have: number; readonly need: number };
  }
  | {
    readonly band: 'learning';
    /** The skill, in the interface language. */
    readonly name: Speakable;
    readonly value: (seat: number) => HudBar;
  };

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
  const bars = numbers.filter((n) => n?.band === 'learning').length;
  if (bars > MAX_BARS) out.push(`hud declares ${bars} learning bars: at most ${MAX_BARS}, one per skill the adult enabled (ADR-0049 §5)`);
  return out;
}

/** The HUD row's cells the bands go into (`ui/hud-row`, ADR-0239). */
export interface HudRowSlots {
  readonly learning: HTMLElement;
  readonly score: HTMLElement;
}

export interface HudBandsMounted {
  /** The mission, at the top centre under the quick bar (the name is from when it sat top left). */
  readonly left: HTMLElement;
  /** The power in use, above the score. */
  readonly right: HTMLElement;
  /** The identity numbers — the score — in five digits (ADR-0238). */
  readonly points: HTMLElement;
  readonly learning: HTMLElement;
  /** Rewrites what changed; `true` when a text at the top did, so the caller measures the room again. */
  refresh(): boolean;
  remove(): void;
}

/** The highest count five digits hold; a larger score is shown as this (ADR-0238). */
const MAX_POINTS = 99_999;

/**
 * A count as FIVE DIGITS WITH LEADING ZEROS, clamped to 0…99999 (ADR-0238): 12 is «00012». `shown` is the number those digits
 * say, which is what a listener hears — the same number a sighted child sees, never the zeros.
 */
export function fiveDigits(count: number): { readonly digits: string; readonly shown: number } {
  const shown = Math.min(MAX_POINTS, Math.max(0, Math.floor(count) || 0));
  return { digits: String(shown).padStart(5, '0'), shown };
}

type TopNumber = HudNumber & { band: 'identity' | 'mission' | 'power' };

/**
 * What the child reads, and — for the points — what a listener hears instead (`label`): the frame in the dictionary, the name
 * through a parameter (pillar 3). A count of objectives keeps its «3 of 10» wherever it is declared.
 */
function lineFace(t: Translate, n: TopNumber, seat: number): { readonly text: string; readonly label: string | null } {
  const v = n.value(seat);
  if (typeof v !== 'number') return { text: t('hud.contador', { have: String(v.have), need: String(v.need), nome: n.name.text }), label: null };
  if (n.band !== 'identity') return { text: t('hud.numero', { nome: n.name.text, valor: String(v) }), label: null };
  const { digits, shown } = fiveDigits(v);
  return { text: digits, label: t('hud.points', { count: String(shown), name: n.name.text }) };
}
function barLabel(t: Translate, name: string, bar: HudBar): string {
  const count = (c: string): string => String(bar.segmentos.filter((s) => s === c).length);
  const base = t('hud.barra', { nome: name, azuis: count('azul'), verdes: count('verde'), vermelhos: count('vermelho') });
  return bar.cor === 'roxa' ? `${base}. ${t('hud.barra.sobe')}` : bar.cor === 'laranja' ? `${base}. ${t('hud.barra.desce')}` : base;
}

/**
 * Mounts the bands, one element per declared number, and fills them: the mission in the game region, the rest in the HUD
 * row's cells (`row`). A place with no number is hidden. Without a row every band goes in the region itself — the learning
 * band BEFORE the screen footer when one exists, so the explanation band, drawn later on the same layer, covers it.
 */
export function mountHudBands(
  t: Translate, doc: Document, region: HTMLElement, numbers: readonly HudNumber[], seat = 0, row?: HudRowSlots,
): HudBandsMounted {
  const band = (cls: string, count: number): HTMLElement => {
    const el = doc.createElement('div');
    el.className = `hud-faixa ${cls}`;
    el.hidden = count === 0;
    return el;
  };
  const texts = numbers.filter((n): n is TopNumber => n.band !== 'learning');
  const bars = numbers.filter((n): n is HudNumber & { band: 'learning' } => n.band === 'learning');
  const ofBand = (b: TopNumber['band']): TopNumber[] => texts.filter((n) => n.band === b);
  const left = band('hud-esquerda', ofBand('mission').length);
  const right = band('hud-direita', ofBand('power').length);
  const points = band('hud-points', ofBand('identity').length);
  const learning = band('hud-aprendizagem', bars.length);
  const place = { identity: points, mission: left, power: right } as const;
  const lines = texts.map((n): [typeof n, HTMLElement] => {
    const p = doc.createElement('p');
    p.className = 'hud-numero';
    p.dataset.band = n.band;
    place[n.band].appendChild(p);
    return [n, p];
  });
  const bardivs = bars.map((n): [typeof n, HTMLElement] => {
    const div = doc.createElement('div');
    div.className = 'hud-barra';
    div.setAttribute('role', 'img');
    for (let i = 0; i < SEGMENTS; i++) div.appendChild(doc.createElement('span')).className = 'hud-seg';
    learning.appendChild(div);
    return [n, div];
  });
  region.appendChild(left);
  // the power ABOVE the score (ADR-0239 point 3): the order of the two in their cell is the order on screen
  (row?.score ?? region).append(right, points);
  if (row) row.learning.appendChild(learning);
  else region.insertBefore(learning, [...region.children].find((c) => c.classList.contains('rodape-da-tela')) ?? null);

  function refresh(): boolean {
    let changed = false;
    for (const [n, p] of lines) {
      const face = lineFace(t, n, seat);
      if (p.textContent !== face.text) { p.textContent = face.text; changed = true; }
      // the points are an image of a number for a listener: the name says «12 points», never «zero zero zero one two»
      if (face.label !== null && p.getAttribute('aria-label') !== face.label) { p.setAttribute('role', 'img'); p.setAttribute('aria-label', face.label); }
    }
    for (const [n, div] of bardivs) {
      const bar = n.value(seat);
      const shown = bar.segmentos.slice(-SEGMENTS);
      const label = barLabel(t, n.name.text, { segmentos: shown, cor: bar.cor }); // in the key: a language change rewrites it
      const key = `${bar.cor}:${shown.join(',')}:${label}`;
      if (div.dataset.estado === key) continue;
      div.dataset.estado = key;
      div.dataset.cor = bar.cor;
      [...div.children].forEach((cell, i) => { (cell as HTMLElement).dataset.seg = shown[i] ?? 'vazio'; });
      div.setAttribute('aria-label', label);
    }
    return changed;
  }
  refresh();
  return {
    left,
    right,
    points,
    learning,
    refresh,
    remove: () => { left.remove(); points.remove(); right.remove(); learning.remove(); },
  };
}
