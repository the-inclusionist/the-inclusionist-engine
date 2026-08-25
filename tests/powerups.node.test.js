// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/powerups — predicados de coleta (project node). Padrões: ZOMBIES + Right-BICEP.
// Funções PURAS: operam num objeto power-up + índice do jogador. Chave = global; demais = por jogador.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, game/powerups).
import { describe, it, expect } from 'vitest';
import { puTaken, takePu } from '../app/js/game/powerups.js';

describe('puTaken', () => {
  it('Zero/vazio: item novo não foi pego por ninguém', () => {
    expect(puTaken({ kind: 'fly' }, 0)).toBe(false);
    expect(puTaken({ kind: 'fly', by: [] }, 2)).toBe(false);
  });
  it('a CHAVE é global: taken vale para todos os jogadores', () => {
    const key = { kind: 'key', taken: true };
    expect(puTaken(key, 0)).toBe(true);
    expect(puTaken(key, 3)).toBe(true); // mesmo índice alto → global
  });
  it('power-up comum é POR JOGADOR: só quem está em by[] o tem', () => {
    const pu = { kind: 'turbo', by: [1, undefined, 1] };
    expect(puTaken(pu, 0)).toBe(true);
    expect(puTaken(pu, 1)).toBe(false); // buraco no array
    expect(puTaken(pu, 2)).toBe(true);
    expect(puTaken(pu, 5)).toBe(false); // fora do array
  });
  it('sem by[] cai no taken (compat: item antigo/single-player)', () => {
    expect(puTaken({ kind: 'fly', taken: true }, 1)).toBe(true);
  });
});

describe('takePu', () => {
  it('CHAVE: marca global (taken=true), ignora o índice', () => {
    const key = { kind: 'key' };
    takePu(key, 3);
    expect(key.taken).toBe(true);
    expect(puTaken(key, 0)).toBe(true); // qualquer jogador vê a chave pega
  });
  it('comum: marca só aquele jogador em by[]', () => {
    const pu = { kind: 'turbo' };
    takePu(pu, 2);
    expect(pu.by[2]).toBe(1);
    expect(puTaken(pu, 2)).toBe(true);
    expect(puTaken(pu, 0)).toBe(false); // outro jogador não foi afetado
  });
  it('jogador 0 também espelha em taken (single-player usa taken)', () => {
    const pu = { kind: 'fly' };
    takePu(pu, 0);
    expect(pu.taken).toBe(true);
    expect(pu.by[0]).toBe(1);
  });
  it('Idempotente/muitos: pegar de novo mantém pego; jogadores independentes', () => {
    const pu = { kind: 'wallcling' };
    takePu(pu, 1);
    takePu(pu, 1); // de novo
    takePu(pu, 4);
    expect(puTaken(pu, 1)).toBe(true);
    expect(puTaken(pu, 4)).toBe(true);
    expect(puTaken(pu, 3)).toBe(false);
  });
});
