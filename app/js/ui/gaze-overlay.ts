// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/gaze-overlay — HOW THE EYE CONTROL SHOWS ITSELF OVER THE GAME (ADR-0213 §6; issue #194).
//
// Five regions: four at the edges the eyes travel to, and the middle, where the child looks to measure the rest. A region says something
// only while the gaze is in it, so the text is always where the eyes already are:
// · a look that PREPARES (it did not come from the opposite side) says where to go now — up «go down!», right «go left!», and so on;
// · a look that came from the opposite side walks its cycle: «Loading...» (settling, and the cancel step) → the direction's Lucide arrow →
//   the face button, as the Xbox letter and the PlayStation shape each inside a circle → the shoulder inside a square → round again;
// · the middle asks to be looked at, with the seconds left, while the rest is being measured.
// Text is 16 px on a 720×360 game region and grows with it. The toggle has three levels (ADR-0213, superseding ADR-0212's eye cycle):
// off · outlines and the eyes · outlines, hatching and the eyes. The eyes and brows are the landmark lines only — never the camera's picture
// (ADR-0212) — mirrored, so they move the way the child moves.
// What a region shows is decided by `whatRegionShows`, plain data; `drawGazeOverlay` only follows it. Places and colours: interface-log.

import { t } from '../core/i18n.js';
import type { GazeZone } from '../input/gaze-relative.js';
import { GAZE_GROUPS, CANCEL, type GazePreview } from '../input/gaze-cycle.js';
import type { EyeLines } from '../platform/vision.js';

export type GazeOverlayLevel = 'off' | 'outlines' | 'hatched';
export type GazeRegion = GazeZone | 'middle';

/** Centre x, centre y, width, height — fractions of the game region. */
export const GAZE_REGIONS: { readonly [R in GazeRegion]: readonly [number, number, number, number] } = {
  up: [0.5, 0.1, 0.26, 0.18], right: [0.87, 0.5, 0.24, 0.24], down: [0.5, 0.9, 0.26, 0.18], left: [0.13, 0.5, 0.24, 0.24],
  middle: [0.5, 0.5, 0.24, 0.26],
};

export type ButtonShape = 'triangle' | 'circle' | 'cross' | 'square';
/** Each zone's face button: the Xbox letter and the PlayStation shape of the button on that side (ADR-0213 erratum: north is «Y»). */
export const FACE_BUTTON: { readonly [Z in GazeZone]: readonly [string, ButtonShape] } = {
  up: ['Y', 'triangle'], right: ['B', 'circle'], down: ['A', 'cross'], left: ['X', 'square'],
};
export const SHOULDER: { readonly [Z in GazeZone]: string } = { up: 'R1', right: 'R2', down: 'L2', left: 'L1' };

/**
 * Lucide `arrow-up`, `arrow-right`, `arrow-down`, `arrow-left`, 24×24 path data. Lucide's LICENSE lists these four as derived from Feather,
 * so the notice they carry is Feather's MIT (Cole Bemis), not Lucide's ISC — credited in docs/CREDITS.md.
 */
export const LUCIDE_ARROWS: { readonly [Z in GazeZone]: readonly string[] } = {
  up: ['m5 12 7-7 7 7', 'M12 19V5'], right: ['M5 12h14', 'm12 5 7 7-7 7'], down: ['M12 5v14', 'm19 12-7 7-7-7'], left: ['m12 19-7-7 7-7', 'M19 12H5'],
};

export interface GazeView {
  readonly zone: GazeZone | null;
  readonly armed: boolean;
  readonly preparing: boolean;
  readonly preview: GazePreview | null;
  readonly restReady: boolean;
  /** While the rest is being measured: how long it still needs. */
  readonly restLeftMs?: number;
}

export type RegionShows =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'text'; readonly key: string }
  | { readonly kind: 'arrow' }
  | { readonly kind: 'button' }
  | { readonly kind: 'shoulder'; readonly label: string };

export function whatRegionShows(region: GazeRegion, v: GazeView): RegionShows {
  if (region === 'middle') return v.restReady ? { kind: 'nothing' } : { kind: 'text', key: 'gaze.lookHere' };
  if (region !== v.zone) return { kind: 'nothing' };
  if (!v.armed) return v.preparing ? { kind: 'text', key: `gaze.prepare.${region}` } : { kind: 'nothing' };
  if (!v.preview || v.preview.item === CANCEL) return { kind: 'text', key: 'gaze.loading' };
  const i = (GAZE_GROUPS[region] as readonly string[]).indexOf(v.preview.item);
  if (i === 0) return { kind: 'arrow' };
  if (i === 1) return { kind: 'button' };
  if (i === 2) return { kind: 'shoulder', label: SHOULDER[region] };
  return { kind: 'nothing' };
}

/** 16 px on a 720×360 game region, in proportion to it, bounded by the tighter side. */
export const gazeFontPx = (width: number, height: number): number => 16 * Math.min(width / 720, height / 360);

const FAINT = 'rgba(234,242,248,0.35)', FAINT_HATCH = 'rgba(234,242,248,0.18)', PREPARE = '#ffd23f', ARMED = '#3ddc84', LINES = '#ffffff';

type Ctx = CanvasRenderingContext2D;

function hatch(ctx: Ctx, x: number, y: number, w: number, h: number, colour: string, step: number): void {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = colour; ctx.lineWidth = 1;
  for (let d = -h; d < w; d += step) { ctx.beginPath(); ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); ctx.stroke(); }
  ctx.restore();
}

function shape(ctx: Ctx, s: ButtonShape, x: number, y: number, r: number): void {
  ctx.beginPath();
  if (s === 'triangle') { ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.87, y + r * 0.5); ctx.lineTo(x - r * 0.87, y + r * 0.5); ctx.closePath(); }
  else if (s === 'circle') ctx.arc(x, y, r, 0, 2 * Math.PI);
  else if (s === 'square') ctx.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
  else { ctx.moveTo(x - r * 0.7, y - r * 0.7); ctx.lineTo(x + r * 0.7, y + r * 0.7); ctx.moveTo(x + r * 0.7, y - r * 0.7); ctx.lineTo(x - r * 0.7, y + r * 0.7); }
  ctx.stroke();
}

export interface GazeOverlayOptions {
  readonly level: GazeOverlayLevel;
  /** The face of this frame, to highlight the eyes and brows. */
  readonly face?: { readonly landmarks: ReadonlyArray<{ readonly x: number; readonly y: number }>; readonly lines: EyeLines } | null;
  readonly say?: (key: string) => string;
}

export function drawGazeOverlay(ctx: Ctx, width: number, height: number, view: GazeView, { level, face = null, say = t }: GazeOverlayOptions): void {
  ctx.clearRect(0, 0, width, height);
  if (level === 'off') return;
  const f = gazeFontPx(width, height);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const region of Object.keys(GAZE_REGIONS) as GazeRegion[]) {
    const [fx, fy, fw, fh] = GAZE_REGIONS[region];
    const w = fw * width, h = fh * height, cx = fx * width, cy = fy * height, x = cx - w / 2, y = cy - h / 2;
    const shows = whatRegionShows(region, view);
    const active = shows.kind !== 'nothing';
    const colour = !active ? FAINT : view.armed && region !== 'middle' ? ARMED : PREPARE;
    if (level === 'hatched') hatch(ctx, x, y, w, h, active ? colour : FAINT_HATCH, Math.max(6, f * 0.6));
    ctx.strokeStyle = colour; ctx.lineWidth = active ? 3 : 1; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = colour; ctx.lineWidth = Math.max(1.5, f / 8);
    ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
    if (shows.kind === 'text') {
      const counting = region === 'middle' && view.restLeftMs !== undefined;
      ctx.font = `bold ${f}px system-ui`; ctx.fillText(say(shows.key), cx, counting ? cy - f * 0.7 : cy);
      if (counting) { ctx.font = `${f * 0.85}px system-ui`; ctx.fillText(`${((view.restLeftMs ?? 0) / 1000).toFixed(1)} s`, cx, cy + f * 0.8); }
    } else if (shows.kind === 'arrow') {
      const side = f * 2.6;
      ctx.save(); ctx.translate(cx - side / 2, cy - side / 2); ctx.scale(side / 24, side / 24); ctx.lineWidth = 2;
      for (const d of LUCIDE_ARROWS[region as GazeZone]) ctx.stroke(new Path2D(d));
      ctx.restore();
    } else if (shows.kind === 'button') {
      const r = f * 1.15, dx = r * 1.35, [letter, s] = FACE_BUTTON[region as GazeZone];
      ctx.beginPath(); ctx.arc(cx - dx, cy, r, 0, 2 * Math.PI); ctx.stroke();
      ctx.font = `bold ${f * 1.1}px system-ui`; ctx.fillText(letter, cx - dx, cy + f * 0.05);
      ctx.beginPath(); ctx.arc(cx + dx, cy, r, 0, 2 * Math.PI); ctx.stroke();
      shape(ctx, s, cx + dx, cy, r * 0.55);
    } else if (shows.kind === 'shoulder') {
      const side = f * 2.4;
      ctx.strokeRect(cx - side / 2, cy - side / 2, side, side);
      ctx.font = `bold ${f * 1.05}px system-ui`; ctx.fillText(shows.label, cx, cy + f * 0.05);
    }
    ctx.shadowBlur = 0;
  }
  if (face) {
    ctx.strokeStyle = LINES; ctx.lineWidth = Math.max(2, f / 8); ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
    for (const { start, end } of [...face.lines.eyes, ...face.lines.brows]) {
      const a = face.landmarks[start], b = face.landmarks[end];
      if (!a || !b) continue;
      ctx.beginPath(); ctx.moveTo((1 - a.x) * width, a.y * height); ctx.lineTo((1 - b.x) * width, b.y * height); ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }
}
