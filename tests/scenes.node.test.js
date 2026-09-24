// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of core/scenes — the scene stack (item 22, C3). Node project: no DOM, no PIXI.
//
// The stack's three rules are not a library convention: each reproduces a behaviour the game already has, and that is
// why they deserve a test. `update` only on top IS the pause's freeze; `draw` bottom-up IS the menu drawn over the world
// with the world visible; `input` only on top IS ADR-0033's modal input.
//
// The case closing the file is the one that matters most: the three phases of TODAY (`title`/`playing`/`paused`), said
// as a stack, produce exactly what the enum produces. If that were not true, the stack would replace nothing — it would
// be a second way of saying the same thing, at twice the cost.
import { describe, it, expect } from 'vitest';
import { createSceneStack } from '../app/js/core/scenes.js';

/** A scene that WRITES DOWN everything it receives — that is how "who was called, and in what order" is asserted. */
function cena(nome, log, over = {}) {
  return {
    name: nome,
    enter: () => log.push(`${nome}:enter`),
    exit: () => log.push(`${nome}:exit`),
    update: (dt) => log.push(`${nome}:update:${dt}`),
    draw: () => log.push(`${nome}:draw`),
    input: (i) => { log.push(`${nome}:input:${i}`); return false; },
    ...over,
  };
}

describe('empilhar e desempilhar', () => {
  it('[Zero] pilha vazia não quebra em nada', () => {
    const p = createSceneStack();
    expect(p.top()).toBeNull();
    expect(p.names()).toEqual([]);
    expect(p.pop()).toBeNull();
    expect(() => { p.update(1); p.draw(); }).not.toThrow();
    expect(p.input('confirm')).toBe(false);
  });

  it('[Right] push avisa quem sai e quem entra, nessa ordem', () => {
    const log = [];
    const p = createSceneStack();
    p.push(cena('jogo', log));
    p.push(cena('pausa', log));
    expect(log).toEqual(['jogo:enter', 'jogo:exit', 'pausa:enter']);
    expect(p.names()).toEqual(['jogo', 'pausa']);
  });

  it('[Inverse] pop devolve o topo e RESSUSCITA quem estava embaixo', () => {
    // The `enter()` of whoever reappears is what makes "back from the pause" an event, and not a silence. Without it,
    // the scene below returns to the top without knowing — and that is where, for instance, keyboard focus is taken back.
    const log = [];
    const p = createSceneStack();
    p.push(cena('jogo', log));
    p.push(cena('pausa', log));
    log.length = 0;
    const fora = p.pop();
    expect(fora.name).toBe('pausa');
    expect(log).toEqual(['pausa:exit', 'jogo:enter']);
    expect(p.names()).toEqual(['jogo']);
  });

  it('[Right] replace é UMA transição, e não um pop seguido de push', () => {
    // If it were pop+push, the scene below would get `enter()` for an instant and reappear on top between the two calls.
    // In a screen transition that is a frame with the wrong scene — visible, and intermittent.
    const log = [];
    const p = createSceneStack();
    p.push(cena('menu', log));
    p.push(cena('mapa', log));
    log.length = 0;
    p.replace(cena('nivel', log));
    expect(log).toEqual(['mapa:exit', 'nivel:enter']);
    expect(log).not.toContain('menu:enter'); // the one below did NOT reappear midway
    expect(p.names()).toEqual(['menu', 'nivel']);
  });

  it('[Interface] `names()` é CÓPIA — quem lê não muta a pilha por acidente', () => {
    const p = createSceneStack();
    p.push(cena('a', []));
    p.names().push('intruso');
    expect(p.names()).toEqual(['a']);
  });
});

describe('as três regras', () => {
  it('[Right] update só no TOPO — é o congelamento da pausa, virado estrutura', () => {
    const log = [];
    const p = createSceneStack();
    p.push(cena('jogo', log));
    p.push(cena('pausa', log));
    log.length = 0;
    p.update(2);
    expect(log).toEqual(['pausa:update:2']); // the game does NOT simulate under the menu
  });

  it('[Right] draw de BAIXO para cima — o menu por cima, o mundo ainda visível', () => {
    const log = [];
    const p = createSceneStack();
    p.push(cena('jogo', log));
    p.push(cena('pausa', log));
    log.length = 0;
    p.draw();
    expect(log).toEqual(['jogo:draw', 'pausa:draw']);
  });

  it('[Right] input só no topo, e o RETORNO diz se consumiu', () => {
    const log = [];
    const p = createSceneStack();
    p.push(cena('jogo', log));
    p.push(cena('pausa', log, { input: (i) => { log.push('pausa:input:' + i); return true; } }));
    log.length = 0;
    expect(p.input('up')).toBe(true);
    expect(log).toEqual(['pausa:input:up']); // the game does not see the key
  });

  it('[Boundary] topo que NÃO consome devolve false — a tecla é de outro dono', () => {
    // The distinction ADR-0033 gave modal input: "it belongs to the modal" and "it means something in the modal" are
    // different questions. Without the return value the stack would have to guess, and guessing here is swallowing a
    // key in silence.
    const p = createSceneStack();
    p.push({ name: 'x', input: () => false });
    expect(p.input('qualquer')).toBe(false);
  });

  it('[Zero] cena SEM ganchos é legítima — nada de `update` vazio por obrigação', () => {
    const p = createSceneStack();
    p.push({ name: 'so-nome' });
    expect(() => { p.update(1); p.draw(); }).not.toThrow();
    expect(p.input('a')).toBe(false);
  });
});

describe('as fases de HOJE, ditas como pilha', () => {
  // The case that decides whether this replaces anything. `title`/`playing`/`paused` become `[titulo]`, `[jogo]` and
  // `[jogo, pausa]` — and the facts `ui/shell.phaseView` reads (`SceneFacts`) come out of the stack without it knowing
  // any of the three names.
  const montar = (fases) => {
    const p = createSceneStack();
    for (const f of fases) p.push({ name: f });
    return p;
  };
  /** The three questions `phaseView`'s answers derive from — asked of the STACK, not of the enum. */
  const fatos = (p) => ({
    titleScreen: p.top()?.name === 'titulo',
    worldRunning: p.top()?.name === 'jogo',
    pauseMenu: p.top()?.name === 'pausa',
  });

  it('[Right] title → [titulo]', () => {
    expect(fatos(montar(['titulo']))).toEqual({ titleScreen: true, worldRunning: false, pauseMenu: false });
  });

  it('[Right] playing → [jogo]', () => {
    expect(fatos(montar(['jogo']))).toEqual({ titleScreen: false, worldRunning: true, pauseMenu: false });
  });

  it('[Right] paused → [jogo, pausa] — e o JOGO continua na pilha, que é o que o enum não dizia', () => {
    // It is the difference that motivates the change. `phase === 'paused'` erases the information that there is a game
    // underneath; the stack keeps it, and from it comes "the world is still drawn, but gets no time".
    const p = montar(['jogo', 'pausa']);
    expect(fatos(p)).toEqual({ titleScreen: false, worldRunning: false, pauseMenu: true });
    expect(p.names()).toEqual(['jogo', 'pausa']);
  });

  it('[Interface] um gênero que o enum NÃO comporta cabe sem mudar esta pilha', () => {
    // Why C1 (widening the union) is a non-option in ADR-0030: a game with a level map and a results screen would need
    // two new constants IN THE ENGINE. Here it just pushes.
    const p = montar(['titulo', 'mapa', 'nivel', 'resultado']);
    expect(p.names()).toEqual(['titulo', 'mapa', 'nivel', 'resultado']);
    expect(p.top().name).toBe('resultado');
  });
});
