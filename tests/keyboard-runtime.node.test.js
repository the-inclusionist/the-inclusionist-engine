// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de input/keyboard-runtime — lógica PURA (project node, sem document). ZOMBIES + Right-BICEP.
// Cobre: actionForCode/ownerOfCode (roteamento puro dado um mapa de teclas) e o runtime via DI
// (kbFor/actionOf/whichPlayer/assignControls/computeControlsState), com KB/numPlayers/players injetados.
import { describe, it, expect, beforeEach } from 'vitest';
import { actionForCode, ownerOfCode, initKeyboardRuntime } from '../app/js/input/keyboard-runtime.js';

// Esquemas de teste (formato de input/keyboard.ts: ação -> lista de codes)
const solo = { left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], run: ['KeyU'], jump: ['KeyJ', 'Space'], swap: ['KeyI'], especial: ['KeyK'] };
const p2a = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], run: ['KeyU'], jump: ['KeyJ'], swap: ['KeyI'], especial: ['KeyK'] };
const p2b = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], run: ['Numpad8'], jump: ['Numpad5'], swap: ['Numpad9'], especial: ['Numpad6'] };
const p4 = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], run: ['KeyZ'], jump: ['KeyX'], swap: ['KeyC'], especial: ['KeyV'] },
  { left: ['KeyJ'], right: ['KeyL'], up: ['KeyI'], down: ['KeyK'], run: ['KeyM'], jump: ['Comma'], swap: ['Period'], especial: ['Semicolon', 'Slash'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], run: ['Home'], jump: ['End'], swap: ['PageUp'], especial: ['PageDown'] },
  { left: ['Numpad4'], right: ['Numpad6'], up: ['Numpad8'], down: ['Numpad5'], run: ['Numpad2'], jump: ['Numpad0'], swap: ['Numpad3'], especial: ['NumpadDecimal'] },
];

describe('actionForCode', () => {
  it('[Right] tecla mapeada retorna a ação dona dela', () => {
    expect(actionForCode(solo, 'KeyJ')).toBe('jump');
    expect(actionForCode(solo, 'KeyA')).toBe('left');
  });
  it('[Right] uma ação pode ter várias teclas (qualquer uma delas resolve a ação)', () => {
    expect(actionForCode(solo, 'Space')).toBe('jump');
    expect(actionForCode(solo, 'ArrowLeft')).toBe('left');
  });
  it('[Boundary] tecla de ninguém (fora do esquema) -> null', () => {
    expect(actionForCode(solo, 'KeyQ')).toBeNull();
  });
  it('[Zero] esquema vazio -> null para qualquer código', () => {
    expect(actionForCode({}, 'KeyJ')).toBeNull();
  });
  it('[Error] ação com lista de teclas vazia não quebra a varredura', () => {
    expect(() => actionForCode({ jump: [] }, 'KeyJ')).not.toThrow();
    expect(actionForCode({ jump: [] }, 'KeyJ')).toBeNull();
  });
  it('[Boundary] tecla compartilhada por duas ações no MESMO esquema (dado inconsistente): primeira ação na ordem de inserção vence', () => {
    const dup = { swap: ['KeyC'], especial: ['KeyC'] };
    expect(actionForCode(dup, 'KeyC')).toBe('swap');
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
    const a = { jump: ['KeyQ'] };
    const b = { jump: ['KeyQ'] };
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
    const kb = { solo, p2: [p2a], p3: [], p4: [] }; // só 1 esquema salvo para modo 2
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
    expect(rt.actionOf('KeyJ', 0)).toBe('jump'); // dono: P1 (p2a)
    expect(rt.actionOf('KeyJ', 1)).toBeNull(); // P2 (p2b) não tem KeyJ
    expect(rt.actionOf('Numpad5', 1)).toBe('jump'); // dono: P2 (p2b)
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
    expect(rt.whichPlayer('End')).toBe(2); // pulo do P3 no esquema de 4
    expect(rt.whichPlayer('NumpadDecimal')).toBe(3); // especial do P4
  });
  it('[Interface] remapeada: mudar o code na MESMA ação move o dono junto (kbFor lê o kb atual, sem cache)', () => {
    const mutableP2a = { ...p2a, jump: ['KeyR'] }; // remap: pulo do P1 agora é R
    const kb2 = { solo, p2: [mutableP2a, p2b], p3: [], p4: [] };
    const rt = initKeyboardRuntime({ getKB: () => kb2, getNumPlayers: () => 2, getPlayers: () => [] });
    expect(rt.actionOf('KeyR', 0)).toBe('jump');
    expect(rt.actionOf('KeyJ', 0)).toBeNull(); // tecla antiga não resolve mais
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
    expect(s.jump).toBe(solo.jump);
    expect(s.left).toBe(solo.left);
    expect(s.run).toBe(solo.run); // KRUN: computado mas nunca lido pelo jogo (achado — ver relato)
  });
  it('[Right] gameKeys reúne as teclas de TODOS os jogadores ativos (todas as ações, não só direção/pulo)', () => {
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 2, getPlayers: () => [{ ctrl: p2a }, { ctrl: p2b }] });
    const s = rt.computeControlsState();
    expect(s.gameKeys).toEqual(expect.arrayContaining(['KeyA', 'KeyD', 'KeyI', 'KeyK', 'ArrowLeft', 'Numpad9'])); // inclui swap/especial de ambos
  });
  it('[Zero] sem jogadores ativos, cai no fallback de 5 ações (jump/left/right/up/down do kb.solo — SEM run)', () => {
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 0, getPlayers: () => [] });
    const s = rt.computeControlsState();
    expect(new Set(s.gameKeys)).toEqual(new Set([...solo.jump, ...solo.left, ...solo.right, ...solo.up, ...solo.down]));
    expect(s.gameKeys).not.toContain('KeyU'); // solo.run — o fallback original também não inclui KRUN
  });
  it('[Many] 4 jogadores: gameKeys cobre as 8 ações × 4 jogadores sem duplicar (Set)', () => {
    const rt = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => 4, getPlayers: () => p4.map((c) => ({ ctrl: c })) });
    const s = rt.computeControlsState();
    const expected = new Set();
    p4.forEach((scheme) => Object.values(scheme).forEach((codes) => codes.forEach((c) => expected.add(c))));
    expect(new Set(s.gameKeys)).toEqual(expected);
    expect(s.gameKeys.length).toBe(expected.size); // sem duplicatas
  });
});
