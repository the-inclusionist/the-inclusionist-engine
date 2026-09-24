// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-controls — PURE logic (node project, no document). ZOMBIES + Right-BICEP.
// Covers: keyName (physical code -> readable label, with 'Space' going through t()) and keyUsedByOther (a remapping
// conflict between players). Without switching language in the tests, `t()` returns the base dictionary's pt-BR.
// render()/handleCaptureKeydown() (they touch the DOM) are in settings-controls.browser.test.js.
// See docs/5-Refactoring/plan-modularization-map.md.
import { describe, it, expect } from 'vitest';
import { ACT_LABEL } from '../app/js/ui/settings-controls.js';
// 📌 The PURE half lives in `ui/control-choices` (note BL); the cases here were all about what a KEY is, none about a node.
import { keyName, keyUsedByOther } from '../app/js/ui/control-choices.js';
import pt from '../app/js/i18n/pt.js';

describe('keyName', () => {
  it('[Right] KeyX -> X (remove o prefixo "Key")', () => {
    expect(keyName('KeyA')).toBe('A');
    expect(keyName('KeyZ')).toBe('Z');
  });
  it('🔴 [Right] cada seta é A SUA seta, e mais nada', () => {
    // 🔴 The Dev saw `↔Up` in a screenshot on 22/09: «Por que está escrevendo "↔Up", "↔Down" etc ao invés de
    // simplesmente "↑", "↓", "←" e "→"? Não escolha poluir a UI.» The defect came from the SHAPE: a chain of
    // substitutions in which `Arrow` became a TWO-WAY arrow and the rest of the name was left stuck to it.
    expect(keyName('ArrowUp')).toBe('↑');
    expect(keyName('ArrowDown')).toBe('↓');
    expect(keyName('ArrowLeft')).toBe('←');
    expect(keyName('ArrowRight')).toBe('→');
    // ⚠️ And the four are DISTINCT: a table with the same arrow in two directions would pass the cases above written one
    // by one, and the child would see two different keys with the same label.
    const setas = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].map(keyName);
    expect(new Set(setas).size).toBe(4);
    for (const s of setas) expect(s, 'uma seta é UM glifo, não um nome de código').toHaveLength(1);
  });

  it('🔴 [Right] o TECLADO NUMÉRICO e os dígitos também não mostram o nome da máquina', () => {
    // The same pollution, one keyboard over: `Digit1` and `Numpad5` came out intact. 📌 And `Num 5` is not `5` because
    // they are different PHYSICAL keys — the two-player scheme uses both, and two equal labels on the same list would
    // send the child to press the wrong one.
    expect(keyName('Digit1')).toBe('1');
    expect(keyName('Numpad5')).toBe('Num 5');
    expect(keyName('Numpad5')).not.toBe(keyName('Digit5'));
  });
  it('[Right] Space -> a palavra traduzida (pt-BR base: Espaço) — a única do mapa que tem tradução', () => {
    expect(keyName('Space')).toBe(pt['key.space']);
    expect(keyName('Space')).toBe('Espaço');
  });
  it('[Right] ShiftLeft/ShiftRight -> Shift', () => {
    expect(keyName('ShiftLeft')).toBe('Shift');
    expect(keyName('ShiftRight')).toBe('Shift');
  });
  it('[Boundary] código sem nenhum prefixo conhecido passa intacto — e isso é honestidade, não descuido', () => {
    // `Comma` is ugly and it is true. Inventing a name for it would be guessing, and a guess on the remapping screen
    // sends the child to press the wrong key.
    expect(keyName('Comma')).toBe('Comma');
    expect(keyName('Semicolon')).toBe('Semicolon');
  });
  it('[Zero] string vazia não lança e retorna vazio', () => {
    expect(keyName('')).toBe('');
  });
  it('[Error] entrada não-string é coagida para string (defensivo, como o original String(code))', () => {
    expect(keyName(undefined)).toBe('undefined');
    expect(keyName(null)).toBe('null');
  });
});

describe('keyUsedByOther', () => {
  const p0 = { left: ['KeyA'], right: ['KeyD'], action2: ['KeyJ', 'Space'] };
  const p1 = { left: ['ArrowLeft'], right: ['ArrowRight'], action2: ['Numpad5'] };
  const p2 = { left: ['KeyF'], right: ['KeyH'], action2: ['KeyJ'] }; // KeyJ colide com p0.jump

  it('[Zero] sem nenhum esquema (schemes vazio) -> -1', () => {
    expect(keyUsedByOther('KeyA', p0, [])).toBe(-1);
  });
  it('[Right] tecla livre entre todos os esquemas -> -1', () => {
    expect(keyUsedByOther('KeyZ', p0, [p0, p1, p2])).toBe(-1);
  });
  it('[Right] tecla usada por OUTRO jogador -> retorna o índice dele', () => {
    expect(keyUsedByOther('ArrowLeft', p0, [p0, p1, p2])).toBe(1);
  });
  it('[Boundary] o próprio mapa sendo editado é excluído por referência (não conflita consigo mesmo)', () => {
    expect(keyUsedByOther('KeyA', p0, [p0, p1, p2])).toBe(-1); // KeyA belongs only to p0, and p0===mapRef is skipped
  });
  it('[Interface] exclusão é por REFERÊNCIA, não por igualdade estrutural — um objeto igual mas distinto ainda conta', () => {
    const p0clone = { left: ['KeyA'], right: ['KeyD'], action2: ['KeyJ', 'Space'] }; // same content, another reference
    expect(keyUsedByOther('KeyA', p0, [p0clone, p1, p2])).toBe(0); // now p0clone (index 0) is not the mapRef
  });
  it('[Right] retorna o primeiro dono na ORDEM dos jogadores quando há duplicidade (dado inconsistente)', () => {
    const dupA = { action2: ['KeyQ'] };
    const dupB = { action2: ['KeyQ'] };
    expect(keyUsedByOther('KeyQ', p0, [dupA, dupB])).toBe(0);
  });
  it('[Error] esquema com ação sem teclas (array vazio) não quebra a varredura', () => {
    const empty = { action2: [] };
    expect(() => keyUsedByOther('KeyJ', p0, [empty])).not.toThrow();
    expect(keyUsedByOther('KeyJ', p0, [empty])).toBe(-1);
  });
  it('[Many] varre corretamente um esquema com várias ações e teclas por ação', () => {
    expect(keyUsedByOther('Space', p0, [p1, p2])).toBe(-1);
    const withSpace = { action3: ['KeyX', 'Space'] };
    expect(keyUsedByOther('Space', p0, [p1, withSpace])).toBe(1);
  });

  it('⚠️ [Boundary] uma chave que NÃO é posição não reserva tecla nenhuma', () => {
    // ⚠️ The scheme is closed on the fourteen positions (#118), and the sieve walks `ACTIONS`: a key outside the list
    // (an invented `extra` action) is invisible here, and that is RIGHT.
    //
    // The reason is on the child's side: a conflict is only real against a position some transport reads. A key bound to
    // `extra` fires nothing — `actionForCode` does not see it either —, so accusing it of a conflict would stop the child
    // using a key that is actually free. Refusing a remap because of data that does nothing is the worse of the two
    // possible errors here.
    expect(keyUsedByOther('Space', p0, [p1, { extra: ['Space'] }])).toBe(-1);
  });
});

describe('ACT_LABEL', () => {
  it('[Interface] cobre as 8 ações do jogo, cada uma com uma CHAVE i18n que existe no dicionário', () => {
    // The table holds a key, not text (see the note in the module). Checking only `toBeTruthy()` would let an invented
    // key pass, which renders the key itself on screen — hence the second assertion.
    const acts = ['left', 'right', 'up', 'down', 'action1', 'action2', 'action4', 'action3'];
    expect(Object.keys(ACT_LABEL)).toEqual(acts);
    for (const a of acts) expect(pt[ACT_LABEL[a]], `chave fora do dicionário: ${ACT_LABEL[a]}`).toBeTypeOf('string');
  });
});
