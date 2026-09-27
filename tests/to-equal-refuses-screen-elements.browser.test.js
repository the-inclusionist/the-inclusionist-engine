// SPDX-License-Identifier: AGPL-3.0-or-later
// `toEqual` AND `toStrictEqual` REFUSE A SCREEN ELEMENT — the proof of the guard in `vitest.setup.browser.js` (the Dev, 2026-09-26:
// «crie uma trava geral que recusa toEqual com elementos de tela em qualquer teste futuro»).
//
// 🔴 Why: Vitest compares DOM nodes with `isEqualNode`, so a COPY passes as the element. The first case shows it — without the
// guard, `expect(el).toEqual(el.cloneNode(true))` passes — and that is how a mutation survived in the footer-glide work (c9a10098).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';

const REFUSED = /refuses a screen element .*isEqualNode.*toBe/s;
const paragraph = (text = 'Quanto é 2 mais 3?') => { const p = document.createElement('p'); p.textContent = text; return p; };

describe('a screen element on either side is refused, with the way out in the message', () => {
  it('🔴 [Right] a CLONE — the case the guard exists for: it would pass as the element', () => {
    const el = paragraph();
    const copy = el.cloneNode(true);
    expect(copy, 'the case measures nothing: the copy is the element').not.toBe(el);
    expect(() => expect(el).toEqual(copy)).toThrow(REFUSED);
    expect(() => expect(el).toStrictEqual(copy)).toThrow(REFUSED);
  });

  it('🔴 [Right] the SAME node is refused too: identity is `toBe`, and the guard does not guess which was meant', () => {
    const el = paragraph();
    expect(() => expect(el).toEqual(el)).toThrow(REFUSED);
    expect(() => expect(el).toStrictEqual(el)).toThrow(REFUSED);
  });

  it('🔴 [Right] the `.not` forms are refused', () => {
    const el = paragraph();
    expect(() => expect(el).not.toEqual(paragraph('outro'))).toThrow(REFUSED);
    expect(() => expect(el).not.toStrictEqual(paragraph('outro'))).toThrow(REFUSED);
  });

  it('🔴 [Right] a node held anywhere a deep equality looks, on either side', () => {
    const el = paragraph();
    const holder = document.createElement('div');
    holder.append(paragraph(), paragraph());
    const refused = [
      [[el], [el]], // an array
      [{ cursor: el }, { cursor: el }], // a plain object
      [{ deep: [{ at: [el] }] }, { deep: [{ at: [el] }] }], // nested
      [new Set([el]), new Set([el])],
      [new Map([['key', el]]), new Map([['key', el]])],
      [new Map([[el, 1]]), new Map([[el, 1]])], // a node as a key
      [holder.querySelectorAll('p'), [...holder.querySelectorAll('p')]], // a NodeList
      [holder.children, [...holder.children]], // an HTMLCollection
      [document.querySelectorAll('.nothing-matches'), []], // a NodeList, even empty: a list of screen elements
      [document.getElementsByClassName('nothing-matches'), []], // and an HTMLCollection
      [{ text: 'x' }, { text: el }], // only the expected side
      [[el], expect.arrayContaining([el])], // an asymmetric matcher's sample
      [document, document], // the document is a node
      [el.firstChild, el.firstChild], // and so is a text node
    ];
    for (const [actual, expected] of refused) {
      expect(() => expect(actual).toEqual(expected), `not refused: ${String(actual)}`).toThrow(REFUSED);
    }
  });
});

describe('ordinary values still compare', () => {
  it('🎯 [Right] equal values pass, different ones fail with the ordinary message — not the guard\'s', () => {
    expect({ list: [1, 'dois', { tres: 3 }], set: new Set(['a']), map: new Map([['k', [1]]]) })
      .toEqual({ list: [1, 'dois', { tres: 3 }], set: new Set(['a']), map: new Map([['k', [1]]]) });
    expect([1, 2]).toStrictEqual([1, 2]);
    expect({ a: 1 }).not.toEqual({ a: 2 });
    expect(() => expect({ a: 1 }).toEqual({ a: 2 })).toThrow(/expected/);
    expect(() => expect({ a: 1 }).toEqual({ a: 2 })).not.toThrow(REFUSED);
  });

  it('🎯 [Right] the two ways out the message names work: `toBe` per node, and a property', () => {
    const el = paragraph();
    const copy = el.cloneNode(true);
    expect(el).toBe(el);
    expect(copy).not.toBe(el);
    expect(copy.textContent).toEqual(el.textContent);
    expect([el, copy].map((n) => n.textContent)).toEqual(['Quanto é 2 mais 3?', 'Quanto é 2 mais 3?']);
  });

  it('🎯 [Right] objects of a class are walked as equality walks them: with no node they compare, with one they are refused', () => {
    class Box { constructor(v) { this.v = v; } }
    expect(new Box(1)).toEqual(new Box(1));
    expect({ when: new Date(0) }).toEqual({ when: new Date(0) });
    const el = paragraph();
    expect(() => expect(new Box(el)).toEqual(new Box(el))).toThrow(REFUSED);
  });

  it('🎯 [Right] a value that holds itself is walked once and still compares', () => {
    const loop = { name: 'laço' };
    loop.self = loop;
    const other = { name: 'laço' };
    other.self = other;
    expect(loop).toEqual(other);
  });
});

// ===== MUTATIONS CHECKED (2026-09-26) =====
// Applied one at a time to `vitest.setup.browser.js` by a script that counts the occurrences before replacing, each restored from a
// copy and verified by SHA-256:
// G1. the guard off                            → red: the clone, the same node, `.not`, anywhere, objects of a class
// G2. the expected side not checked            → red: anywhere (only the expected side)
// G3. the actual side not checked              → red: anywhere
// G4. NodeList and HTMLCollection not known    → red: anywhere (the empty ones)
// G5. a Set not walked · G6. a Map's keys not walked → red: anywhere
// G7. no cycle guard                           → red: a value that holds itself
// G8. own properties not walked                → red: anywhere, objects of a class
// G9. `toStrictEqual` not guarded              → red: the clone, the same node, `.not`
