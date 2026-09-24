// SPDX-License-Identifier: AGPL-3.0-or-later
// render/low-vision-drawing — what a colour filter cannot make: the white film of cataract, the tunnel of glaucoma, the central
// scotoma of macular degeneration and the scattered scotomas of diabetic retinopathy. They are a DRAWING over the world, not a
// transformation of its colours.
//
// One drawing, two consumers: `render/viewports` stamps it into each viewport's texture, and `boot/create-game` lays it over
// the declared world for the empathy panel (issue #182). Written once so the two cannot show different simulations under one name.

/** The simulations drawn rather than filtered. `haze` is also a filter under `createGame`, which draws only the other three. */
export type LowVisionDrawing = 'haze' | 'tunnel' | 'macular' | 'diabetic';

type Draw = (c: CanvasRenderingContext2D, w: number, h: number) => void;

/** Where the scattered scotomas of diabetic retinopathy sit, as fractions of the view: x, y and radius (of the width). */
const SCATTERED_SPOTS: readonly (readonly [number, number, number])[] = [[.22, .3, .1], [.64, .22, .075], [.8, .58, .11], [.4, .7, .085], [.16, .8, .07], [.54, .48, .06]];

/** One radial gradient: its centre and radii, and its colour stops from the inside out. */
function radial(c: CanvasRenderingContext2D, [x0, y0, r0, x1, y1, r1]: readonly number[], stops: readonly (readonly [number, string])[]): CanvasGradient {
  const g = c.createRadialGradient(x0!, y0!, r0!, x1!, y1!, r1!);
  for (const [at, colour] of stops) g.addColorStop(at, colour);
  return g;
}

/** Each drawn simulation, one row. A table and not a chain of `else if`: a fifth simulation is one more row. */
const DRAWN: Readonly<Record<LowVisionDrawing, Draw>> = Object.freeze({
  // a film over everything, translucent — the world shows through it, washed out
  haze: (c, w, h) => { c.fillStyle = 'rgba(244,246,250,0.42)'; c.fillRect(0, 0, w, h); },
  // the edges close in, the centre stays clear
  tunnel: (c, w, h) => {
    c.fillStyle = radial(c, [w / 2, h / 2, h * 0.12, w / 2, h / 2, h * 0.6], [[0, 'rgba(0,0,0,0)'], [.5, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,.99)']]);
    c.fillRect(0, 0, w, h);
  },
  // the centre is gone, the edges stay
  macular: (c, w, h) => {
    c.fillStyle = radial(c, [w / 2, h / 2, 2, w / 2, h / 2, h * 0.34], [[0, 'rgba(12,12,15,.95)'], [.55, 'rgba(12,12,15,.5)'], [1, 'rgba(12,12,15,0)']]);
    c.fillRect(0, 0, w, h);
  },
  // several dark spots, scattered, each in its own square
  diabetic: (c, w, h) => {
    for (const [fx, fy, fr] of SCATTERED_SPOTS) {
      const x = fx * w, y = fy * h, r = fr * w;
      c.fillStyle = radial(c, [x, y, 1, x, y, r], [[0, 'rgba(10,10,14,.95)'], [.5, 'rgba(10,10,14,.7)'], [1, 'rgba(10,10,14,0)']]);
      c.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  },
});

/** Draws simulation `lv` on a `w`×`h` context, over transparency. A key that is not a drawn simulation draws nothing. */
export function drawLowVision(c: CanvasRenderingContext2D, lv: string, w: number, h: number): void {
  // an OWN key only: `toString` is on every object, and it is not a simulation
  if (!Object.hasOwn(DRAWN, lv)) return;
  DRAWN[lv as LowVisionDrawing](c, w, h);
}
