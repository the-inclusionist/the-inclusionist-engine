// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/flash-sampler — READING THE WORLD'S CANVAS TO ANSWER WCAG 2.3.1 (study item B2; ADR-0027; issue #203).
//
// The pure half of this has lived in `core/flash-threshold` since it was written: given the luminance of a grid over time, it
// says whether the general flash threshold is crossed. THIS is the half that has to touch a browser — copy the world's canvas
// into a small one, read its pixels frame by frame, and turn them into the grid the pure half expects. It lived inside
// `boot/create-game`, and it left for the reason ADR-0221 gives: 📏 that file reached 2185 lines and 330 decision nodes, and
// the debt is paid by SUBJECT.
//
// ⚠️ IT ONLY RUNS WHEN IT IS CALLED, and that is a decision and not an omission: sampling a canvas every frame would cost a
// school's machine the very thing the engine exists to protect. `Engine.medirFlashes(ms)` is how an adult asks.
//
// 📌 THE THREE REFUSALS ARE AS MUCH THE ANSWER AS THE MEASUREMENT, and each names what a developer must do: a world that is not
// a canvas cannot be read at all; a host without `getImageData` or `requestAnimationFrame` cannot sample; and a canvas that
// reads transparent in every frame is the WebGL case, where the buffer is thrown away unless `preserveDrawingBuffer` asked it
// not to be. A silent `false` would have sent somebody looking for a flash that was never measured.

import { analyseFlashes, COLUMNS, ROWS, type LuminanceFrame } from '../core/flash-threshold.js';

/** What a measurement found. `passa` and `piorSegundo` exist only when the canvas was actually read. */
export interface FlashMeasurement {
  readonly lido: boolean;
  readonly motivo?: string;
  readonly passa?: boolean;
  readonly piorSegundo?: number;
}

/** Ten samples per cell of the pure half's grid — enough for an average, small enough to read every frame. */
const SAMPLE_COLS = COLUMNS * 10;
const SAMPLE_ROWS = ROWS * 10;

/** sRGB → linear light, which is what a luminance average may be taken over (WCAG's own definition). */
const linear = (v: number): number => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };

export interface FlashSamplerCtx {
  /** The world's canvas, read at the moment of the call — a `mount()` may have replaced the world. */
  readonly canvas: () => HTMLCanvasElement | null;
  /** A scratch canvas of our own: the world's is never resized, only copied from. */
  readonly scratch: () => HTMLCanvasElement;
  /** `requestAnimationFrame`, absent in a host that cannot animate — then there is nothing to sample over time. */
  readonly frame?: (cb: (t: number) => void) => void;
  /** Where a failure goes, so `problems` carries it for whoever reads the page's diagnosis. */
  readonly report: (line: string) => void;
}

export function sampleFlashes(ctx: FlashSamplerCtx, ms: number): Promise<FlashMeasurement> {
  const canvas = ctx.canvas();
  if (!canvas) return Promise.resolve({ lido: false, motivo: 'the world is not a canvas and contains none to read' });
  const copy = ctx.scratch();
  copy.width = SAMPLE_COLS;
  copy.height = SAMPLE_ROWS;
  const c2d = copy.getContext('2d', { willReadFrequently: true });
  const frame = ctx.frame;
  if (!c2d || typeof frame !== 'function') return Promise.resolve({ lido: false, motivo: 'this host cannot sample canvases' });

  return new Promise((resolve) => {
    const frames: LuminanceFrame[] = [];
    let start = -1;
    let anyPixel = false;
    const step = (now: number): void => {
      if (start < 0) start = now;
      let px: Uint8ClampedArray;
      try {
        c2d.clearRect(0, 0, SAMPLE_COLS, SAMPLE_ROWS);
        c2d.drawImage(canvas, 0, 0, SAMPLE_COLS, SAMPLE_ROWS);
        px = c2d.getImageData(0, 0, SAMPLE_COLS, SAMPLE_ROWS).data;
      } catch {
        resolve({ lido: false, motivo: 'the page may not read the world\'s canvas (an image from another origin drew on it)' });
        return;
      }
      const grid = new Float32Array(COLUMNS * ROWS);
      for (let y = 0; y < SAMPLE_ROWS; y++) {
        for (let x = 0; x < SAMPLE_COLS; x++) {
          const i = (y * SAMPLE_COLS + x) * 4;
          if (px[i + 3]) anyPixel = true;
          const l = 0.2126 * linear(px[i]!) + 0.7152 * linear(px[i + 1]!) + 0.0722 * linear(px[i + 2]!);
          grid[Math.floor(y / 10) * COLUMNS + Math.floor(x / 10)] += l / 100;
        }
      }
      frames.push({ t: now - start, luminances: grid });
      if (now - start < ms) { frame(step); return; }
      if (!anyPixel) {
        resolve({ lido: false, motivo: 'the world\'s canvas read transparent in every frame (WebGL canvases need preserveDrawingBuffer)' });
        return;
      }
      const { passes: passa, worstSecond: piorSegundo } = analyseFlashes(frames);
      if (!passa) {
        ctx.report(`the world's canvas flashed ${piorSegundo} times in one second within a 10-degree field `
          + '(WCAG 2.3.1 allows 3): it can trigger a seizure in a child with photosensitive epilepsy — slow or dim it');
      }
      resolve({ lido: true, passa, piorSegundo });
    };
    frame(step);
  });
}
