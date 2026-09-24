// SPDX-License-Identifier: AGPL-3.0-or-later
// input/pointer-space.ts — THE ONE PLACE THAT CONVERTS A SCREEN POINT. A leaf module: arithmetic only.
//
// ========================= WHAT THE MEASUREMENT FOR ISSUE #105 FOUND =========================
// The issue asked to READ before writing — to establish how much of a pointer already existed inside the touch input, so
// that "almost all of it" would become an extraction and not a new subsystem. The measured answer was more interesting:
//
//   · The CAPTURE already existed WHOLE, in the touch pad's pointer wiring: `pointerdown`/`move`/`up`/`cancel`,
//     `setPointerCapture` with a graceful fallback, `lostpointercapture` as a net, `contextmenu` suppressed, and one
//     pointer at a time. None of it needs writing again.
//   · The POINT, on the other hand, was RECEIVED AND THROWN AWAY — each direction reader reduced it to `dx,dy` from the
//     CENTRE and returned directions.
//
// ⚠️ A continuous position arrives and is squeezed into "left/right/up" before any other consumer sees it, and nothing is
// left for whoever needs it. The pointer is not a new foundation — it is the foundation gaze already needed and never had.
//
// ⚠️ AND WHAT EXISTS NOWHERE: hover (position without a press), buttons, the wheel — and what #105's definition of done
// asks for first, ONE place that converts screen→game. This file is that place; the rest stays open in the issue.

/** The element's rectangle (what `getBoundingClientRect()` gives, reduced to what the sum uses). */
export interface RectLike { left: number; top: number; width: number; height: number }

/** A point in px, relative to the element's CENTRE. The shape a directional pad reads. */
export interface FromCentre { dx: number; dy: number }

/** A point as a FRACTION of the element: `0,0` is the top-left corner and `1,1` the bottom-right. */
export interface AsFraction { fx: number; fy: number }

/**
 * The point relative to the CENTRE, in element px.
 *
 * The touch pad's direction functions each opened with these same two lines. Two repeated lines rarely pay for an
 * extraction — this pays for another reason: while the centre sum was written inside each one, a NEW consumer (a pointer,
 * a gaze) had no way to get the point without going through a function that had already turned it into directions.
 */
export function fromCentre(px: number, py: number, rect: RectLike): FromCentre {
  return { dx: px - (rect.left + rect.width / 2), dy: py - (rect.top + rect.height / 2) };
}

/**
 * The point as a FRACTION of the element.
 *
 * ⚠️ IT DOES NOT SATURATE TO 0..1, on purpose. A captured pointer leaves the element and still counts — that is what
 * `setPointerCapture` exists to allow — and saturating here would erase the difference between "at the edge" and "far
 * past the edge", which is exactly what a drag needs to know. Whoever wants to saturate, saturates; whoever saturated here
 * could not go back.
 *
 * ⚠️ AND ZERO WIDTH RETURNS ZERO instead of `Infinity`. An element not measured yet (display:none, the first frame) gives
 * `width: 0`, and a `NaN`/`Infinity` from here would travel into the physics before anyone saw it. The guard belongs to
 * the sum, not to each caller.
 */
export function asFraction(px: number, py: number, rect: RectLike): AsFraction {
  return {
    fx: rect.width ? (px - rect.left) / rect.width : 0,
    fy: rect.height ? (py - rect.top) / rect.height : 0,
  };
}
