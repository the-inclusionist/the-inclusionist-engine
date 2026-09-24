// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of input/keyboard-runtime — PURE logic (node project, no document). ZOMBIES + Right-BICEP.
// Covers: actionForCode/ownerOfCode (pure routing given a key map) and the runtime through DI
// (kbFor/actionOf/whichPlayer/assignControls/computeControlsState), with KB/numPlayers/players injected.
import { describe, it, expect, beforeEach } from 'vitest';
import { actionForCode, ownerOfCode, initKeyboardRuntime } from '../app/js/input/keyboard-runtime.js';

// Test schemes (input/keyboard.ts format: action -> list of codes)
const solo = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], action1: ['KeyU'], action2: ['KeyJ', 'Space'], action4: ['KeyI'], action3: ['KeyK'] };
const p2a = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action1: ['KeyU'], action2: ['KeyJ'], action4: ['KeyI'], action3: ['KeyK'] };
const p2b = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], action1: ['Numpad8'], action2: ['Numpad5'], action4: ['Numpad9'], action3: ['Numpad6'] };
const p4 = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], action1: ['KeyZ'], action2: ['KeyX'], action4: ['KeyC'], action3: ['KeyV'] },
  { left: ['KeyJ'], right: ['KeyL'], up: ['KeyI'], down: ['KeyK'], action1: ['KeyM'], action2: ['Comma'], action4: ['Period'], action3: ['Semicolon', 'Slash'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], action1: ['Home'], action2: ['End'], action4: ['PageUp'], action3: ['PageDown'] },
  { left: ['Numpad4'], right: ['Numpad6'], up: ['Numpad8'], down: ['Numpad5'], action1: ['Numpad2'], action2: ['Numpad0'], action4: ['Numpad3'], action3: ['NumpadDecimal'] },
];

describe('actionForCode', () => {
  it('[Right] tecla mapeada retorna a ação dona dela', () => {
    expect(actionForCode(solo, 'KeyJ')).toBe('action2');
    expect(actionForCode(solo, 'KeyA')).toBe('left');
  });
  it('[Right] uma ação pode ter várias teclas (qualquer uma delas resolve a ação)', () => {
    expect(actionForCode(solo, 'Space')).toBe('action2');
    expect(actionForCode(solo, 'ArrowLeft')).toBe('left');
  });
  it('[Boundary] tecla de ninguém (fora do esquema) -> null', () => {
    expect(actionForCode(solo, 'KeyQ')).toBeNull();
  });
  it('[Zero] esquema vazio -> null para qualquer código', () => {
    expect(actionForCode({}, 'KeyJ')).toBeNull();
  });
  it('[Error] ação com lista de teclas vazia não quebra a varredura', () => {
    expect(() => actionForCode({ action2: [] }, 'KeyJ')).not.toThrow();
    expect(actionForCode({ action2: [] }, 'KeyJ')).toBeNull();
  });
  it('⚠️ [Boundary] tecla em duas ações do MESMO esquema: vence a primeira na ORDEM CANÓNICA, não na de inserção', () => {
    // ⚠️ Canonical order, not insertion order (issue #118): insertion order is an accident of how the object was built.
    // A scheme freshly loaded from the defaults and the SAME scheme after an `Object.assign` of a saved overlay have
    // different insertion orders — so the same child with the same inconsistent data could see the key fire one
    // action on one start and another on the next.
    //
    // With the closed `KeyScheme`, the index walks `ACTIONS`, which is declared and identical in both cases. `action3`
    // comes before `action4` in the canonical list, and that is why it wins here.
    const dup = { action4: ['KeyC'], action3: ['KeyC'] };
    expect(actionForCode(dup, 'KeyC')).toBe('action3');
    // And the proof that it is the canonical order and not «a outra»: reversing the insertion, the result does NOT change.
    expect(actionForCode({ action3: ['KeyC'], action4: ['KeyC'] }, 'KeyC')).toBe('action3');
  });
});

describe('ownerOfCode', () => {
  it('[Zero] nenhum esquema (array vazio) -> -1', () => {
    expect(ownerOfCode([], 'KeyA')).toBe(-1);
  });
  it('[Right] 1 jogador: tecla do esquema solo -> índice 0', () => {
    expect(ownerOfCode([solo], 'KeyJ')).toBe(0);
  });
  it('[Right] 4 jogadores: cada tecla resolve ao dono correto', () => {
    const schemes = p4;
    expect(ownerOfCode(schemes, 'KeyX')).toBe(0); // pulo do P1
    expect(ownerOfCode(schemes, 'Comma')).toBe(1); // pulo do P2
    expect(ownerOfCode(schemes, 'End')).toBe(2); // pulo do P3
    expect(ownerOfCode(schemes, 'Numpad0')).toBe(3); // pulo do P4
  });
  it('[Boundary] tecla de ninguém entre 4 jogadores -> -1', () => {
    expect(ownerOfCode(p4, 'KeyQ')).toBe(-1);
  });
  it('[Interface] retorna o PRIMEIRO dono na ordem dos jogadores quando dois esquemas colidem (dado inconsistente/remap malfeito)', () => {
    const a = { action2: ['KeyQ'] };
    const b = { action2: ['KeyQ'] };
    expect(ownerOfCode([a, b], 'KeyQ')).toBe(0);
  });
});

describe('initKeyboardRuntime — kbFor', () => {
  it('[Right] numPlayers<=1 sempre devolve kb.solo, mesmo pedindo o índice 2', () => {
    const kb = { solo, p2: [p2a, p2b], p3: [], p4: [] };
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 1, getPlayers: () => [] });
    expect(rt.kbFor(0)).toBe(solo);
    expect(rt.kbFor(2)).toBe(solo);
  });
  it('[Right] numPlayers=2 devolve o esquema de p2 pelo índice', () => {
    const kb = { solo, p2: [p2a, p2b], p3: [], p4: [] };
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 2, getPlayers: () => [] });
    expect(rt.kbFor(0)).toBe(p2a);
    expect(rt.kbFor(1)).toBe(p2b);
  });
  it('[Boundary] índice fora da faixa de p2 cai para o esquema 0 (dado incompleto)', () => {
    const kb = { solo, p2: [p2a], p3: [], p4: [] }; // only 1 scheme saved for 2-player mode
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 2, getPlayers: () => [] });
    expect(rt.kbFor(1)).toBe(p2a);
  });
  it('[Right] numPlayers=4 usa kb.p4 (modo 4 é INDEPENDENTE do modo 3)', () => {
    const kb = { solo, p2: [], p3: [p4[0], p4[1], p4[2]], p4 };
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 4, getPlayers: () => [] });
    expect(rt.kbFor(3)).toBe(p4[3]);
  });
});

describe('initKeyboardRuntime — actionOf / whichPlayer', () => {
  const kb = { solo, p2: [p2a, p2b], p3: [], p4 };

  it('[Right] actionOf resolve a ação PELO ESQUEMA do jogador pedido, não pelo de outro', () => {
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 2, getPlayers: () => [] });
    expect(rt.actionOf('KeyJ', 0)).toBe('action2'); // owner: P1 (p2a)
    expect(rt.actionOf('KeyJ', 1)).toBeNull(); // P2 (p2b) has no KeyJ
    expect(rt.actionOf('Numpad5', 1)).toBe('action2'); // owner: P2 (p2b)
  });
  it('[Boundary] tecla de ninguém -> actionOf null e whichPlayer -1', () => {
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 2, getPlayers: () => [] });
    expect(rt.actionOf('KeyQ', 0)).toBeNull();
    expect(rt.whichPlayer('KeyQ')).toBe(-1);
  });
  it('[Right] whichPlayer varre 1 jogador (solo)', () => {
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 1, getPlayers: () => [] });
    expect(rt.whichPlayer('KeyJ')).toBe(0); // solo.jump inclui KeyJ
  });
  it('[Right] whichPlayer varre 4 jogadores e acha o dono certo', () => {
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 4, getPlayers: () => [] });
    expect(rt.whichPlayer('End')).toBe(2); // P3's jump in the 4-player scheme
    expect(rt.whichPlayer('NumpadDecimal')).toBe(3); // P4's special
  });
  it('[Interface] remapeada: mudar o code na MESMA ação move o dono junto (kbFor lê o kb atual, sem cache)', () => {
    const mutableP2a = { ...p2a, action2: ['KeyR'] }; // remap: P1's jump is now R
    const kb2 = { solo, p2: [mutableP2a, p2b], p3: [], p4: [] };
    const rt = initKeyboardRuntime({ getKB: () => kb2, getNumPlayers: () => 2, getPlayers: () => [] });
    expect(rt.actionOf('KeyR', 0)).toBe('action2');
    expect(rt.actionOf('KeyJ', 0)).toBeNull(); // the old key no longer resolves
  });
});

describe('initKeyboardRuntime — assignControls', () => {
  it('[Right] atribui p.ctrl = kbFor(i) para cada jogador ativo, in-place', () => {
    const kb = { solo, p2: [p2a, p2b], p3: [], p4: [] };
    const players = [{ ctrl: null }, { ctrl: null }];
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 2, getPlayers: () => players });
    rt.assignControls();
    expect(players[0].ctrl).toBe(p2a);
    expect(players[1].ctrl).toBe(p2b);
  });
  it('[Zero] lista de jogadores vazia não quebra', () => {
    const kb = { solo, p2: [], p3: [], p4: [] };
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 1, getPlayers: () => [] });
    expect(() => rt.assignControls()).not.toThrow();
  });
});

describe('initKeyboardRuntime — computeControlsState', () => {
  let kb;
  beforeEach(() => { kb = { solo, p2: [p2a, p2b], p3: [], p4 }; });

  it('[Right] controls é sempre kb.solo (alias do P1), mesmo com numPlayers>1', () => {
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 2, getPlayers: () => [{ ctrl: p2a }, { ctrl: p2b }] });
    const s = rt.computeControlsState();
    expect(s.controls).toBe(solo);
    expect(s.action2).toBe(solo.action2);
    expect(s.left).toBe(solo.left);
    expect(s.action1).toBe(solo.action1); // action1: computed, and no engine caller reads it
  });
  it('[Right] gameKeys reúne as teclas de TODOS os jogadores ativos (todas as ações, não só direção/pulo)', () => {
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 2, getPlayers: () => [{ ctrl: p2a }, { ctrl: p2b }] });
    const s = rt.computeControlsState();
    expect(s.gameKeys).toEqual(expect.arrayContaining(['KeyA', 'KeyD', 'KeyI', 'KeyK', 'ArrowLeft', 'Numpad9'])); // includes both players' swap/special
  });
  it('[Zero] sem jogadores ativos, cai no fallback de 5 ações (jump/left/right/up/down do kb.solo — SEM run)', () => {
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 0, getPlayers: () => [] });
    const s = rt.computeControlsState();
    expect(new Set(s.gameKeys)).toEqual(new Set([...solo.action2, ...solo.left, ...solo.right, ...solo.up, ...solo.down]));
    expect(s.gameKeys).not.toContain('KeyU'); // solo.action1 — the fallback leaves the run key out
  });
  it('[Many] 4 jogadores: gameKeys cobre as 8 ações × 4 jogadores sem duplicar (Set)', () => {
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 4, getPlayers: () => p4.map((c) => ({ ctrl: c })) });
    const s = rt.computeControlsState();
    const expected = new Set();
    p4.forEach((scheme) => Object.values(scheme).forEach((codes) => codes.forEach((c) => expected.add(c))));
    expect(new Set(s.gameKeys)).toEqual(expected);
    expect(s.gameKeys.length).toBe(expected.size); // no duplicates
  });
});

// ---------------------------------------------------------------------------------------------
// controlsState / refreshControls — the memo of the controls state (D1)
// ---------------------------------------------------------------------------------------------
describe('controlsState / refreshControls — memoria e invalidacao', () => {
  // What these cases protect is the memo's PROPERTY that would be easy to lose: it does not recompute by itself. If
  // someone "improves" controlsState() to recompute on every read, a remap takes effect before it is applied, and the
  // first case below turns red.
  function rt(kbRef, players) {
    return initKeyboardRuntime({ getKB: () => kbRef.kb, getNumPlayers: () => players.length, getPlayers: () => players });
  }

  it('[Right] a 1a leitura calcula e as seguintes devolvem O MESMO objeto (nao recalcula)', () => {
    const r = rt({ kb: { solo } }, [{ ctrl: solo }]);
    const a = r.controlsState();
    expect(r.controlsState()).toBe(a); // identidade, nao igualdade
  });

  it('[Right] mudar o KB NAO muda o estado memorizado ate refreshControls() — era o papel do applyControls()', () => {
    const ref = { kb: { solo } };
    const r = rt(ref, [{ ctrl: solo }]);
    expect(r.controlsState().action2).toEqual(['KeyJ', 'Space']);
    ref.kb = { solo: { ...solo, action2: ['KeyP'] } };  // the controls panel remapped...
    expect(r.controlsState().action2).toEqual(['KeyJ', 'Space']); // ...and has not applied it yet
    r.refreshControls();
    expect(r.controlsState().action2).toEqual(['KeyP']);
  });

  it('[Right] refreshControls devolve o mesmo objeto que a leitura seguinte entrega', () => {
    const r = rt({ kb: { solo } }, [{ ctrl: solo }]);
    const novo = r.refreshControls();
    expect(r.controlsState()).toBe(novo);
  });

  it('[Boundary] entrar um jogador so entra em gameKeys depois do refresh', () => {
    // gameKeys comes from kbFor(i), which picks the table by the NUMBER of screens (kb.solo / kb.p2 / ...), not from the
    // player object's `ctrl` — so the two-player scheme comes in through kb.p2, not through the push.
    const jogadores = [{ ctrl: p2a }];
    const r = rt({ kb: { solo, p2: [p2a, p2b] } }, jogadores);
    expect(r.controlsState().gameKeys).not.toContain('Numpad5'); // 1 screen: falls to kb.solo
    jogadores.push({ ctrl: p2b });                    // joinPlayer mid-game -> 2 screens
    expect(r.controlsState().gameKeys).not.toContain('Numpad5'); // memoised: still the 1-screen state
    r.refreshControls();
    expect(r.controlsState().gameKeys).toContain('Numpad5');
  });

  it('[Right] o valor memorizado e o mesmo que computeControlsState() devolveria', () => {
    const r = rt({ kb: { solo } }, [{ ctrl: solo }]);
    expect(r.controlsState()).toEqual(r.computeControlsState());
  });
});
