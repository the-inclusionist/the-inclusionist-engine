// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ONE PLACE THAT CONVERTS A SCREEN POINT (issue #105, first item of the `definition of done`).
//
// The CAPTURE lives whole in `touch-bindings.wirePointerPad` — `pointerdown`/`move`/`up`/`cancel`, `setPointerCapture`
// with a fallback, `lostpointercapture` as a net, `contextmenu` suppressed, one pointer at a time. The POINT used to be
// reduced inside each consumer (the pad functions to `dx,dy` from the centre); while the arithmetic lived inside each
// of them, a NEW consumer — a pointer, a gaze that wanted to draw — had no way to get the point without going through
// a function that had already turned it into directions. `input/pointer-space` is that arithmetic, once.
import { describe, it, expect } from 'vitest';
import { fromCentre, asFraction } from '../app/js/input/pointer-space.js';
import { crossDirsAt, stickDirsAt, stickKnobOffset } from '../app/js/input/touch-bindings.js';

const R = { left: 100, top: 200, width: 80, height: 40 }; // centro em (140, 220)

describe('doCentro — o ponto relativo ao CENTRO, que é o que um direcional lê', () => {
  it('[Right] o centro do elemento é a origem', () => {
    expect(fromCentre(140, 220, R)).toEqual({ dx: 0, dy: 0 });
  });

  it('[Right] os sinais seguem a tela: x cresce para a direita, y para BAIXO', () => {
    expect(fromCentre(180, 200, R)).toEqual({ dx: 40, dy: -20 });
    expect(fromCentre(100, 240, R)).toEqual({ dx: -40, dy: 20 });
  });

  it('[Boundary] fora do elemento continua a valer — é o que a captura de ponteiro existe para permitir', () => {
    // A finger (or a mouse) leaving the element with the gesture still going produces points outside. Clamping
    // here would erase the difference between «na borda» and «muito para lá dela», which is what a drag needs.
    expect(fromCentre(1000, 220, R).dx).toBe(860);
  });
});

describe('emFracao — o ponto como fração do elemento, que é o que o olhar lê', () => {
  it('[Right] canto superior esquerdo é 0,0; inferior direito é 1,1; centro é 0,5', () => {
    expect(asFraction(100, 200, R)).toEqual({ fx: 0, fy: 0 });
    expect(asFraction(180, 240, R)).toEqual({ fx: 1, fy: 1 });
    expect(asFraction(140, 220, R)).toEqual({ fx: 0.5, fy: 0.5 });
  });

  it('[Zero] ⚠️ elemento de largura ZERO devolve zero, e não Infinity', () => {
    // An element not yet measured (display:none, first frame) gives `width: 0`. An `Infinity` or `NaN` coming out
    // of here would travel into the physics before anyone saw it — and `NaN < 0.4` is `false`, so the defect would
    // show up as «o olhar parou de funcionar», with no error at all.
    expect(asFraction(50, 50, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ fx: 0, fy: 0 });
  });

  it('[Boundary] e também não satura — quem quiser saturar, satura; quem saturasse aqui não voltaria atrás', () => {
    // ⚠️ BOTH AXES: the property belongs to the FUNCTION, not to one of its axes, and a mutation clamping only `fy`
    // would pass an assertion on `fx` alone. The same trap as always: the assertion has to be on the side where the
    // change would show.
    expect(asFraction(20, 200, R)).toEqual({ fx: -1, fy: 0 });
    expect(asFraction(260, 320, R)).toEqual({ fx: 2, fy: 3 });
  });
});

describe('e os três consumidores de toque continuam a responder o mesmo', () => {
  // ⚠️ These cases are the extraction's NET: the three functions had the arithmetic written inside them, and what an
  // extraction can break in silence is precisely a flipped sign. Values computed by hand from `R`.
  it('[Right] a cruz decide pelos mesmos limiares de antes', () => {
    expect(crossDirsAt(140, 220, R)).toEqual({ left: false, right: false, up: false, down: false }); // centro
    expect(crossDirsAt(179, 220, R).right).toBe(true);
    expect(crossDirsAt(101, 220, R).left).toBe(true);
    expect(crossDirsAt(140, 201, R).up).toBe(true);   // y menor = para CIMA
    expect(crossDirsAt(140, 239, R).down).toBe(true);
  });

  it('[Right] o analógico usa a zona morta em px que lhe passam', () => {
    expect(stickDirsAt(150, 220, R, 5).right).toBe(true);
    expect(stickDirsAt(143, 220, R, 5).right).toBe(false); // dx=3, inside the dead zone of 5
  });

  it('[Right] a manopla recorta pelo RAIO e mantém o ângulo', () => {
    // Radial clipping, not per axis: at 3-4-5, with travel 5, it must come out exactly at the requested point.
    expect(stickKnobOffset(143, 224, R, 5)).toEqual({ x: 3, y: 4 });
    // and at twice the distance, the same angle with the length cut at the travel
    expect(stickKnobOffset(146, 228, R, 5)).toEqual({ x: 3, y: 4 });
  });
});
