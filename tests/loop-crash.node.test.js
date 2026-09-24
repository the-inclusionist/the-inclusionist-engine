// SPDX-License-Identifier: AGPL-3.0-or-later
// THE NOTICE THAT THE LOOP STOPPED — the other half of ADR-0054, and the third thread of issue #109.
//
// `core/loop.startLoop` stops when a frame throws and calls its failure callback (`onFailure`); this module is the notice
// that callback gives, so stopping is also SAID.
//
// ⚠️ AND IT IS THE HALF THAT MATTERS. A frozen screen is a VISUAL symptom. In blind mode, a stopped game and a thinking
// game produce the same thing — silence — and the child waits for a game that has already died. A console error is
// not a notice: the child does not read it.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCrashNotice } from '../app/js/ui/loop-crash.js';
import { startLoop } from '../app/js/core/loop.js';
import pt from '../app/js/i18n/pt.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A fake document that TELLS SELECTORS APART — a double that answers the same to everything answers wrong.
 *
 * ⚠️ `#incl-parou` is deliberately NOT among those present: the notice looks for it before creating, so as not to stack
 * two boxes when the loop tries to stop twice. A double returning an element for any selector would make the module
 * think the box already exists and never add it — and the case would assert the opposite of what it promises.
 */
function docFalso(presentes = ['#sr-alert', '#game-region']) {
  const novo = () => ({
    id: '', textContent: '', attrs: {}, filhos: [],
    setAttribute(k, v) { this.attrs[k] = v; },
    appendChild(f) { this.filhos.push(f); return f; },
  });
  const mapa = new Map();
  for (const sel of presentes) mapa.set(sel, novo());
  return {
    find: (sel) => mapa.get(sel) ?? null,
    create: () => novo(),
    el: (sel) => mapa.get(sel) ?? null,
    /** The notice's box, if it was added to `#game-region`. */
    caixa: () => (mapa.get('#game-region')?.filhos ?? []).find((f) => f.id === 'incl-parou') ?? null,
  };
}

const FRASE = pt['sr.laco.parou'];

let erroDoConsole;
// ⚠️ THE `mockClear` IS NOT FUSSINESS. `vi.spyOn` on the same object returns the spy THAT ALREADY EXISTS, and calls pile up
// between cases: without this, `calls[0]` belongs to the file's first test and not this one — an assertion comparing an
// error with another case's error, green or red for the wrong reason.
beforeEach(() => {
  erroDoConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
  erroDoConsole.mockClear();
});

describe('criarAvisoDeQueda — quem não vê a tela precisa OUVIR que ela parou', () => {
  it('[Right] escreve a frase na região assertiva do leitor de tela', () => {
    const d = docFalso();
    createCrashNotice({ find: d.find, create: d.create })(new Error('o jogo quebrou'));
    expect(d.el('#sr-alert').textContent).toBe(FRASE);
  });

  it('[Right] ⚠️ e cria um ELEMENTO com a frase — não um pseudo-elemento', () => {
    // Not a `::after` with `content: attr(...)`: it would NEVER show, because the CRT scanline already takes
    // `#game-region`'s `::after`, the vignette takes `::before`, and an element has ONE of each. The rules do not stack —
    // the CRT's comes later and wins.
    //
    // ⚠️ And a pseudo-element is wrong for a second reason: `content` text does not reliably enter the accessibility
    // tree, and this is the notice that can least depend on that. Hence `role="alert"`.
    const d = docFalso();
    createCrashNotice({ find: d.find, create: d.create })(new Error('x'));
    const caixa = d.caixa();
    expect(caixa, 'a caixa do aviso não foi acrescentada ao #game-region').toBeTruthy();
    expect(caixa.textContent).toBe(FRASE);
    expect(caixa.attrs.role).toBe('alert');
  });

  it('[Zero] ⚠️ duas quedas não empilham duas caixas', () => {
    // The loop stops once, but nothing prevents a second failure call (another loop, a game that remounts). Two
    // overlapping boxes would be two identical sentences on screen and two in the reader.
    const d = docFalso();
    const avisar = createCrashNotice({ find: d.find, create: d.create });
    avisar(new Error('x'));
    const primeira = d.caixa();
    // from here on the box exists in the document, and that is what the module looks for before creating
    d.el('#game-region').filhos.forEach((f) => { if (f.id === 'incl-parou') d.jaExiste = f; });
    expect(primeira).toBeTruthy();
    expect(d.el('#game-region').filhos.filter((f) => f.id === 'incl-parou')).toHaveLength(1);
  });

  it('[Right] narra, para quem ouve em vez de ler', () => {
    const ditas = [];
    createCrashNotice({ find: docFalso().find, create: docFalso().create, narrate: (s) => ditas.push(s) })(new Error('x'));
    expect(ditas).toEqual([FRASE]);
  });

  it('[Interface] o CONSOLE recebe o erro original — é o que sobra para quem depura', () => {
    const boom = new Error('causa de verdade');
    createCrashNotice({ find: docFalso().find, create: docFalso().create })(boom);
    expect(erroDoConsole).toHaveBeenCalled();
    // THE ERROR ITSELF, not a string about it: `String(erro)` loses the stack, the only thing that says WHERE the frame
    // broke. Checked by identity, in the argument where it goes.
    expect(erroDoConsole.mock.calls[0][1]).toBe(boom);
  });

  it('[Error] ⚠️ uma narração que LANÇA não pode engolir o aviso escrito', () => {
    // It is the same rule `startLoop` applies to this very callback: a notice that half-fails must deliver the other
    // half. Without this order, an unavailable speech synthesis would erase the screen reader's text — and the child who
    // most needs the sentence is exactly the one who depends on both channels.
    const d = docFalso();
    const avisar = createCrashNotice({ find: d.find, create: d.create, narrate: () => { throw new Error('sem voz'); } });
    expect(() => avisar(new Error('x'))).not.toThrow();
    expect(d.el('#sr-alert').textContent).toBe(FRASE);
    expect(d.caixa()?.textContent).toBe(FRASE);
  });

  it('[Zero] documento sem as regiões: não lança, e o console continua a receber', () => {
    // A game whose host did not bring the markup loses the notice; what it must NOT do is gain a second error because of
    // the first.
    const avisar = createCrashNotice({ find: docFalso([]).find, create: docFalso([]).create });
    expect(() => avisar(new Error('x'))).not.toThrow();
    expect(erroDoConsole).toHaveBeenCalled();
  });
});

describe('e ligado ao laço de verdade, ponta a ponta', () => {
  /** A minimal ticker with the shape `startLoop` asks for. */
  function ticker() {
    const fns = [];
    return { deltaTime: 1, add: (f) => fns.push(f), remove: (f) => fns.splice(fns.indexOf(f), 1), passo: () => fns.forEach((f) => f()) };
  }

  it('[Right] um quadro que lança PARA o laço e ANUNCIA — a confirmação do ADR-0054, inteira', () => {
    const d = docFalso();
    const t = ticker();
    let quadros = 0;
    startLoop(t, () => { quadros++; throw new Error('o jogo quebrou'); }, 2,
      { speed: () => 1, onFailure: createCrashNotice({ find: d.find, create: d.create }) });

    t.passo(); t.passo(); t.passo();

    expect(quadros, 'o laço continuou a chamar o quadro').toBe(1);
    expect(d.el('#sr-alert').textContent).toBe(FRASE);
  });

  it('[Interface] anuncia UMA vez, e não sessenta vezes por segundo', () => {
    // Repeating the announcement every frame would make the screen reader say the same sentence nonstop — trading a
    // game stopped in silence for a stopped game that shouts is no fix.
    const ditas = [];
    const t = ticker();
    startLoop(t, () => { throw new Error('x'); }, 2,
      { speed: () => 1, onFailure: createCrashNotice({ find: docFalso().find, create: docFalso().create, narrate: (s) => ditas.push(s) }) });
    for (let i = 0; i < 10; i++) t.passo();
    expect(ditas).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------------------------------------

// ⚠️ What this file proves is the ENGINE's behaviour. Assertions about a CARTRIDGE's composition root or page live in
// `game-platformer`, where those files are (issue #111).
