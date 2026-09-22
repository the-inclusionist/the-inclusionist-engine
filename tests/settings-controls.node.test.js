// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-controls — lógica PURA (project node, sem document). ZOMBIES + Right-BICEP.
// Cobre: keyName (código físico -> rótulo legível, com 'Space' passando por t()) e keyUsedByOther (conflito de
// remapeamento entre jogadores). Sem trocar de idioma nos testes, `t()` devolve o pt-BR do dicionário-base.
// O render()/handleCaptureKeydown() (tocam DOM) ficam em settings-controls.browser.test.js.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { ACT_LABEL } from '../app/js/ui/settings-controls.js';
// 📌 A metade PURA saiu para `ui/control-choices` em 22/09 (nota BL), e foi este ficheiro que marcou a costura
// antes de ela existir: os casos que ele já tinha eram todos sobre o que uma TECLA é, nenhum sobre um nó.
import { keyName, keyUsedByOther } from '../app/js/ui/control-choices.js';
import pt from '../app/js/i18n/pt.js';

describe('keyName', () => {
  it('[Right] KeyX -> X (remove o prefixo "Key")', () => {
    expect(keyName('KeyA')).toBe('A');
    expect(keyName('KeyZ')).toBe('Z');
  });
  it('[Right] ArrowX -> ↔X (prefixo "Arrow" vira a seta bidirecional)', () => {
    expect(keyName('ArrowLeft')).toBe('↔Left');
    expect(keyName('ArrowUp')).toBe('↔Up');
  });
  it('[Right] Space -> a palavra traduzida (pt-BR base: Espaço) — a única do mapa que tem tradução', () => {
    expect(keyName('Space')).toBe(pt['key.space']);
    expect(keyName('Space')).toBe('Espaço');
  });
  it('[Right] ShiftLeft/ShiftRight -> Shift', () => {
    expect(keyName('ShiftLeft')).toBe('Shift');
    expect(keyName('ShiftRight')).toBe('Shift');
  });
  it('[Boundary] código sem nenhum prefixo conhecido passa intacto', () => {
    expect(keyName('Comma')).toBe('Comma');
    expect(keyName('Numpad4')).toBe('Numpad4');
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
    expect(keyUsedByOther('KeyA', p0, [p0, p1, p2])).toBe(-1); // KeyA é só do p0, e p0===mapRef é pulado
  });
  it('[Interface] exclusão é por REFERÊNCIA, não por igualdade estrutural — um objeto igual mas distinto ainda conta', () => {
    const p0clone = { left: ['KeyA'], right: ['KeyD'], action2: ['KeyJ', 'Space'] }; // mesmo conteúdo, outra referência
    expect(keyUsedByOther('KeyA', p0, [p0clone, p1, p2])).toBe(0); // agora p0clone (índice 0) não é o mapRef
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
    // ⚠️ O fixture deste caso usava `{ extra: [...] }` — uma ação inventada — e esperava que ela disputasse a
    // tecla. Desde a #118 o esquema é fechado nas quatorze posições, e o crivo percorre `ACTIONS`: uma chave
    // fora da lista é invisível aqui, e a mudança está CERTA.
    //
    // O motivo é do lado da criança: um conflito só é real contra uma posição que algum transporte leia. Uma
    // tecla amarrada a `extra` não dispara nada — `actionForCode` também já não a vê —, então acusá-la de
    // conflito impediria a criança de usar uma tecla que na verdade está livre. Recusar o remapeamento por
    // causa de dado que não faz nada é o pior dos dois erros possíveis aqui.
    expect(keyUsedByOther('Space', p0, [p1, { extra: ['Space'] }])).toBe(-1);
  });
});

describe('ACT_LABEL', () => {
  it('[Interface] cobre as 8 ações do jogo, cada uma com uma CHAVE i18n que existe no dicionário', () => {
    // A tabela guarda chave, não texto (ver a nota no módulo). Aferir só `toBeTruthy()` deixaria passar uma
    // chave inventada, que renderiza a própria chave na tela — por isso a segunda asserção.
    const acts = ['left', 'right', 'up', 'down', 'action1', 'action2', 'action4', 'action3'];
    expect(Object.keys(ACT_LABEL)).toEqual(acts);
    for (const a of acts) expect(pt[ACT_LABEL[a]], `chave fora do dicionário: ${ACT_LABEL[a]}`).toBeTypeOf('string');
  });
});
