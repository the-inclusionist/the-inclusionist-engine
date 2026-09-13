// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/hud-bands — the HUD the engine mounts from the numbers a cartridge declares by band (ADR-0168; ADR-0059 §1; issue #162).
//
// A number sits with what it is ABOUT (ADR-0059 §1). Three bands are the game's to fill:
//   · identity — true of the PERSON and surviving the round (the point count): top left, beside the quick bar;
//   · round — what this round granted and resets with it (a super-power, the round's objective counter): below the quick
//     bar (ADR-0168, erratum of 2026-09-13);
//   · learning — where the child stands in a skill: one ten-segment bar per skill, one to three, centred in the footer and
//     covered by the explanation band while it shows (ADR-0168 §3; ADR-0049 §5).
// 📌 The session clock is not declared by a game: it is the adult's (ADR-0050 §3), and nothing in the engine holds a session
// length yet, so it is not mounted.
//
// The HUD is STATE: consulted, never announced — no live region here (ADR-0059; `core/contract` §7).
//
// No I/O on import: `hudNumbersProblems` runs in node.
import type { Speakable } from '../core/contract.js';
import { t } from '../core/i18n.js';

export type HudBand = 'identity' | 'round' | 'learning';
const HUD_BANDS: readonly HudBand[] = ['identity', 'round', 'learning'];
/** ADR-0049 §5: three ten-segment bars are thirty lit elements; a fourth stops being a reading. */
const MAX_BARS = 3;
const SEGMENTS = 10;

/**
 * A skill's bar, as `educational/segment-bar.barraDe` returns it — the same field names and values, so its `Barra` passes
 * straight in. Written again here because `ui` does not import `educational` (ADR-0173).
 */
export interface HudBar {
  readonly segmentos: readonly ('azul' | 'verde' | 'vermelho')[];
  readonly cor: 'nenhuma' | 'laranja' | 'roxa';
}

export type HudNumber =
  | {
    readonly band: 'identity' | 'round';
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

export interface HudBandsMounted {
  readonly identity: HTMLElement;
  readonly round: HTMLElement;
  readonly learning: HTMLElement;
  /** Rewrites what changed; `true` when a text at the top did, so the caller measures the room again. */
  refresh(): boolean;
  remove(): void;
}

/** What the child reads, or hears on the bar: the frame in the dictionary, the name through a parameter (pillar 3). */
function numberText(n: HudNumber & { band: 'identity' | 'round' }, seat: number): string {
  const v = n.value(seat);
  return typeof v === 'number'
    ? t('hud.numero', { nome: n.name.text, valor: String(v) })
    : t('hud.contador', { have: String(v.have), need: String(v.need), nome: n.name.text });
}
function barLabel(name: string, bar: HudBar): string {
  const count = (c: string): string => String(bar.segmentos.filter((s) => s === c).length);
  const base = t('hud.barra', { nome: name, azuis: count('azul'), verdes: count('verde'), vermelhos: count('vermelho') });
  return bar.cor === 'roxa' ? `${base}. ${t('hud.barra.sobe')}` : bar.cor === 'laranja' ? `${base}. ${t('hud.barra.desce')}` : base;
}

/**
 * Mounts the three bands in the game region, one element per declared number, and fills them. A band with no number is
 * hidden. The learning band goes in BEFORE the screen footer when one exists, so the explanation band, drawn later on the
 * same layer, covers it.
 */
export function mountHudBands(doc: Document, region: HTMLElement, numbers: readonly HudNumber[], seat = 0): HudBandsMounted {
  const band = (cls: string, count: number): HTMLElement => {
    const el = doc.createElement('div');
    el.className = `hud-faixa ${cls}`;
    el.hidden = count === 0;
    return el;
  };
  const texts = numbers.filter((n): n is HudNumber & { band: 'identity' | 'round' } => n.band !== 'learning');
  const bars = numbers.filter((n): n is HudNumber & { band: 'learning' } => n.band === 'learning');
  const identity = band('hud-identidade', texts.filter((n) => n.band === 'identity').length);
  const round = band('hud-rodada', texts.filter((n) => n.band === 'round').length);
  const learning = band('hud-aprendizagem', bars.length);
  const lines = texts.map((n): [typeof n, HTMLElement] => {
    const p = doc.createElement('p');
    p.className = 'hud-numero';
    (n.band === 'identity' ? identity : round).appendChild(p);
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
  region.appendChild(identity);
  region.appendChild(round);
  region.insertBefore(learning, [...region.children].find((c) => c.classList.contains('rodape-da-tela')) ?? null);

  function refresh(): boolean {
    let changed = false;
    for (const [n, p] of lines) {
      const text = numberText(n, seat);
      if (p.textContent !== text) { p.textContent = text; changed = true; }
    }
    for (const [n, div] of bardivs) {
      const bar = n.value(seat);
      const shown = bar.segmentos.slice(-SEGMENTS);
      const label = barLabel(n.name.text, { segmentos: shown, cor: bar.cor }); // in the key: a language change rewrites it
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
    identity,
    round,
    learning,
    refresh,
    remove: () => { identity.remove(); round.remove(); learning.remove(); },
  };
}
