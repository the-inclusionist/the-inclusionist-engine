// SPDX-License-Identifier: AGPL-3.0-or-later
// render/low-vision-drawing — what a colour filter cannot make: the white film of cataract, the tunnel of glaucoma, the central
// scotoma of macular degeneration and the scattered scotomas of diabetic retinopathy. They are a DRAWING over the world, not a
// transformation of its colours.
//
// One drawing, two consumers: `render/viewports` stamps it into each viewport's texture, and `boot/create-game` lays it over
// the declared world for the empathy panel (issue #182). Written once so the two cannot show different simulations under one name.

/** The simulations drawn rather than filtered. `haze` is also a filter under `createGame`, which draws only the other three. */
export type LowVisionDrawing = 'haze' | 'tunnel' | 'macular' | 'diabetic';

/** Draws simulation `lv` on a `w`×`h` context, over transparency. An unknown key draws nothing. */
export function drawLowVision(c: CanvasRenderingContext2D, lv: string, w: number, h: number): void {
  const cx = w / 2, cy = h / 2;
  if (lv === 'haze') { c.fillStyle = 'rgba(244,246,250,0.42)'; c.fillRect(0, 0, w, h); }
  else if (lv === 'tunnel') { const g = c.createRadialGradient(cx, cy, h * 0.12, cx, cy, h * 0.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,.99)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
  else if (lv === 'macular') { const g = c.createRadialGradient(cx, cy, 2, cx, cy, h * 0.34); g.addColorStop(0, 'rgba(12,12,15,.95)'); g.addColorStop(.55, 'rgba(12,12,15,.5)'); g.addColorStop(1, 'rgba(12,12,15,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
  else if (lv === 'diabetic') { for (const [fx, fy, fr] of [[.22, .3, .1], [.64, .22, .075], [.8, .58, .11], [.4, .7, .085], [.16, .8, .07], [.54, .48, .06]] as const) { const x = fx * w, y = fy * h, r = fr * w, g = c.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, 'rgba(10,10,14,.95)'); g.addColorStop(.5, 'rgba(10,10,14,.7)'); g.addColorStop(1, 'rgba(10,10,14,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } }
}
