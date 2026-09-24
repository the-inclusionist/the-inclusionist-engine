// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/menu-nav — the navigation DECISION, without a DOM (node project): turning a key into an intent, walking
// a list, adjusting a select/slider, and stepping through the pause list.
//
// Why this is an ACCESSIBILITY test and not arithmetic: each function here is a gesture someone makes without seeing
// the screen. A flipped sign in a step function breaks nothing visible — the menu is still drawn, the buttons still
// clickable with the mouse — and simply makes an item unreachable for someone with only a keyboard. It is the kind of
// regression that passes build, eye and screenshot.
//
// The DOM shell (real focus, `offsetParent`, z-index, Escape) is in menu-nav.browser.test.js and is NOT repeated here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hasIntent, stepInRing } from '../app/js/ui/menu-nav.js';
import {
  KEY_YES, KEY_NO, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, menuKeyIntent, selectStep, selectWrap, rangeStep, stepInPause,
} from '../app/js/ui/menu-intent.js';

const NONE = { yes: false, no: false, up: false, down: false, left: false, right: false };
const only = (...ks) => ({ ...NONE, ...Object.fromEntries(ks.map((k) => [k, true])) });

describe('menuKeyIntent — tecla física → intenção', () => {
  it('as quatro teclas de "sim" genéricas confirmam', () => {
    for (const c of ['Space', 'KeyJ', 'Enter', 'NumpadEnter']) {
      expect(menuKeyIntent(c, null).yes, c).toBe(true);
    }
  });

  // This case PINS DEFECT 2 (known, not fixed): Escape is the "back" intent, the SAME as the pad's "special" action.
  // There is no "close dialog" intent separate from "back to the game".
  it('Escape é "não" — e é a MESMA intenção que a ação "action3" (defeito 2, pinado)', () => {
    expect(menuKeyIntent('Escape', null).no).toBe(true);
    expect(menuKeyIntent('KeyL', 'action3').no).toBe(true);
    // and Escape is NO other intent — if it were, the menu would move when trying to go back
    const k = menuKeyIntent('Escape', null);
    expect([k.yes, k.up, k.down, k.left, k.right]).toEqual([false, false, false, false, false]);
  });

  it('WASD e as setas andam; a ação remapeada do dono da tecla vale igual', () => {
    expect(menuKeyIntent('KeyW', null).up).toBe(true);
    expect(menuKeyIntent('ArrowDown', null).down).toBe(true);
    expect(menuKeyIntent('KeyA', null).left).toBe(true);
    expect(menuKeyIntent('ArrowRight', null).right).toBe(true);
    // an exotic key, but remapped to "up" by the player: it navigates the same (the pillar — remapping holds in menus)
    expect(menuKeyIntent('Numpad8', 'up').up).toBe(true);
  });

  it('tecla sem função nenhuma não expressa intenção (e por isso NÃO é consumida)', () => {
    expect(hasIntent(menuKeyIntent('KeyQ', null))).toBe(false);
    expect(hasIntent(menuKeyIntent('Escape', null))).toBe(true);
  });

  it('as tabelas genéricas não se sobrepõem entre si', () => {
    const sets = [KEY_YES, KEY_NO, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT];
    const all = sets.flatMap((s) => [...s]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('passos de lista e de controle', () => {
  // A RING, not a clamp (ADR-0044): with one menu per screen every list is a ring, and that is what puts `quit` ONE key
  // away from `resume` without the two being near each other.
  //
  // MUTATION CHECKED: putting `stepInRing` back to the old `Math.max(0, Math.min(len-1, idx+delta))`, the case fails
  // with "expected 0 to be 4" — before the first there is no longer a last.
  it('stepInRing dá a volta nas DUAS pontas — e o `%` de negativo não escapa', () => {
    expect(stepInRing(5, 4, +1), 'depois do último vem o primeiro').toBe(0);
    expect(stepInRing(5, 0, -1), 'antes do primeiro vem o último').toBe(4);
    expect(stepInRing(5, 2, +1)).toBe(3);
    expect(stepInRing(5, 2, -1)).toBe(1);
    // JavaScript's `%` returns a NEGATIVE for a negative operand (`-1 % 5 === -1`), and a negative array index returns
    // `undefined` — which here would become `undefined.focus()`. The extra `+ len` exists for that.
    expect(stepInRing(5, 0, -3), 'salto negativo maior que um passo').toBe(2);
  });

  it('[Zero] lista vazia não estoura — anel de tamanho zero devolve 0, não NaN', () => {
    // `% 0` is NaN, and `items[NaN]` is `undefined`. A menu with no items really happens: a panel that renders before
    // its content arrives.
    expect(stepInRing(0, 0, +1)).toBe(0);
    expect(stepInRing(0, 3, -1)).toBe(0);
  });

  it('AJUSTAR VALOR continua preso nas pontas — a diferença é deliberada', () => {
    // Going from maximum to minimum volume with one key is a fright, not a convenience. In a game with audio cues for
    // blindness, a volume fright is harm.
    expect(selectStep(0, 5, -1)).toBe(0);
    expect(selectStep(4, 5, +1)).toBe(4);
  });

  it('select: esquerda/direita são passo PRESO; "sim" dá a volta (diferença deliberada)', () => {
    expect(selectStep(0, 3, -1)).toBe(0);
    expect(selectStep(2, 3, +1)).toBe(2);
    expect(selectWrap(2, 3)).toBe(0);
    expect(selectWrap(0, 3)).toBe(1);
  });

  it('slider anda um STEP e respeita min/max; step ausente ou zero vale 1', () => {
    expect(rangeStep(4, 0, 10, 2, +1)).toBe(6);
    expect(rangeStep(0, 0, 10, 2, -1)).toBe(0);
    expect(rangeStep(10, 0, 10, 2, +1)).toBe(10);
    expect(rangeStep(4, 0, 10, 0, +1)).toBe(5);   // `+cur.step||1`
    expect(rangeStep(4, 0, 10, NaN, -1)).toBe(3); // idem
  });
});

describe('passoNaPausa — a pausa virou LISTA, e a lista virou anel', () => {
  // The pause card is a LIST, not a two-zone grid (ADR-0044): the icon bar lives in the HUD (item 7). A grid needs
  // border rules the child has to discover without seeing — none of them discoverable, only learnt by bumping into
  // them. XAG 106 allows wrapping for a LINEAR menu and forbids it for a 2-D grid; with one list, what was forbidden
  // becomes the recommendation. ONE rule is left, stated in a sentence: after the last comes the first, and before the
  // first comes the last.
  const N = 7; // a seven-item pause list, as in ADR-0044 §2

  it('[Right] baixo e direita andam para a frente; cima e esquerda, para trás', () => {
    expect(stepInPause(N, 0, only('down'))).toBe(1);
    expect(stepInPause(N, 0, only('right'))).toBe(1);
    expect(stepInPause(N, 3, only('up'))).toBe(2);
    expect(stepInPause(N, 3, only('left'))).toBe(2);
  });

  it('[Right] a PROMESSA do ADR-0044: `quit` a uma tecla de `resume`', () => {
    // `resume` is item 0 and `quit` is 6. One UP key on the first reaches the last — far in reading, neighbours under the
    // finger. It is the sentence that opened the record, and this case makes it true or false.
    expect(stepInPause(N, 0, only('up')), 'para cima em `resume` tem de cair em `quit`').toBe(N - 1);
    expect(stepInPause(N, N - 1, only('down')), 'para baixo em `quit` tem de voltar a `resume`').toBe(0);
  });

  it('[Boundary] cursor perdido (índice negativo) entra como 0 — verbatim do `if(idx<0)idx=0`', () => {
    // A menu that just opened with no selection must not make the cursor appear in the middle of the list. It enters
    // from the start, whichever way one walks.
    expect(stepInPause(N, -1, only('down'))).toBe(1);
    expect(stepInPause(N, -1, only('up'))).toBe(N - 1);
  });

  it('[Zero] lista vazia não estoura e não inventa índice', () => {
    expect(stepInPause(0, 0, only('down'))).toBe(0);
  });

  it('[Many] TODO item é alcançável a partir de `resume` só com baixo — e a volta fecha', () => {
    // On a grid this needed a breadth-first search; on a list it fits in one line, and that is the saving: a structure
    // that needs a breadth-first search to prove it navigable is a structure the child must explore blind to learn.
    const vistos = new Set();
    let i = 0;
    for (let passo = 0; passo < N; passo++) { vistos.add(i); i = stepInPause(N, i, only('down')); }
    expect(vistos.size).toBe(N);
    expect(i, 'depois de N passos o cursor tem de estar de volta no começo').toBe(0);
  });
});

describe('a independência do módulo — o que ele NÃO conhece', () => {
  const fonte = readFileSync(join(process.cwd(), 'app', 'js', 'ui', 'menu-nav.ts'), 'utf8');

  it('[Right] NÃO importa `core/state` — o modelo de fases é de quem consome, não deste módulo', () => {
    // Importing `phase` would leave a second game no way to bring its own phase model: the `consumer-quiz` had to declare
    // itself "paused" to navigate its own menus (finding 10). The question is `isNavigable()` in the ctx. If the import
    // comes back, this case fails — and the cost of it coming back is invisible from inside a platformer, where a menu
    // is ALWAYS a pause thing.
    expect(fonte).not.toMatch(/from '\.\.\/core\/state\.js'/);
  });

  it('[Interface] o ctx pergunta um BOOLEANO, e não a fase — é o que evita a mentira', () => {
    // Injecting `getPhase()` would have killed the import and kept the problem: the consumer would still have to return
    // the string `'paused'`, the platformer's vocabulary. Asking "can one navigate now?" lets each game answer in its own
    // language. The difference is small in the diff and it is the whole point.
    // The 2nd assertion checks the FIELD (`getPhase:`), not the word: the module explains in a comment why `getPhase` was
    // refused, and forbidding the word would forbid the explanation too — hence the colon, which the prose
    // (`getPhase()`, with parentheses) does not have.
    expect(fonte).toMatch(/isNavigable: \(\) => boolean/);
    expect(fonte).not.toMatch(/getPhase\s*:/);
  });
});
