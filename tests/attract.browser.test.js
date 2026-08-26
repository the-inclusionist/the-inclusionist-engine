// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de game/attract (project BROWSER: usa document + localStorage). Contrato: inicia a demo aos 60s (>3600
// ticks) no título; o robô/replay dirige o P1; qualquer entrada encerra; ?record=1 grava o P1. Injeção por closure
// (getters p/ bindings vivos). Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Tier 1, game/attract).
import { describe, it, expect, beforeEach } from 'vitest';
import { createAttract } from '../app/js/game/attract.js';

function setup(over = {}) {
  document.body.innerHTML = '<div id="title-overlay"></div><div id="game-region"></div>';
  const state = { cenario: 'campo', activity: 'ludico', phase: 'title', restarts: 0 };
  const player = { x: 10, y: 20, facing: 1, vx: 0, vy: 0, onGround: true, jumpEdge: false };
  const keys = new Set();
  const said = [], alerted = [];
  const ctx = {
    CENARIOS: { campo: { nome: 'Campo' }, floresta: { nome: 'Floresta' } },
    keys,
    getPlayers: () => [player],
    getCenario: () => state.cenario,
    // 2026-08-26: um booleano e dois verbos no lugar de `getPhase`/`setPhase` (ADR-0030 C3). O falso segue
    // guardando a string em `state.phase`, que é o que os casos afirmam.
    mundoRodando: () => state.phase === 'playing',
    setCenario: (c) => { state.cenario = c; },
    setActivity: (a) => { state.activity = a; },
    restartGame: () => { state.restarts++; },
    entrarNoJogo: () => { state.phase = 'playing'; },
    voltarAoTitulo: () => { state.phase = 'title'; },
    randInt: () => 0, // determinístico → 1º cenário (campo)
    kbFor: () => ({ right: ['ArrowRight'], left: ['ArrowLeft'] }),
    srSay: (t) => said.push(t),
    srAlert: (t) => alerted.push(t),
    $: (s) => document.querySelector(s),
    search: '',
    ...over,
  };
  return { ctl: createAttract(ctx), ctx, state, player, keys, said, alerted };
}

describe('game/attract', () => {
  beforeEach(() => { document.body.innerHTML = ''; try { localStorage.clear(); } catch { /* off */ } });

  it('[Zero] onInput fora da demo: não encerra e retorna false', () => {
    const { ctl } = setup();
    expect(ctl.onInput()).toBe(false);
    expect(ctl.isAttract()).toBe(false);
  });

  it('[Interface] titleIdleTick inicia a demo só APÓS 3600 ticks visível (setPhase playing + banner + restart)', () => {
    const { ctl, state } = setup();
    for (let i = 0; i < 3600; i++) ctl.titleIdleTick(true);
    expect(ctl.isAttract()).toBe(false); // 3600 ainda não (precisa > 3600)
    ctl.titleIdleTick(true); // 3601 → inicia
    expect(ctl.isAttract()).toBe(true);
    expect(state.phase).toBe('playing');
    expect(state.restarts).toBeGreaterThan(0);
    expect(document.querySelector('#attract-banner')).not.toBeNull();
  });

  it('[Interface] onInput durante a demo encerra (setPhase title, retorna true)', () => {
    const { ctl, state } = setup();
    ctl.startAttract();
    expect(ctl.isAttract()).toBe(true);
    expect(ctl.onInput()).toBe(true);
    expect(ctl.isAttract()).toBe(false);
    expect(state.phase).toBe('title');
  });

  it('[Interface] stepAttract (robô) dirige o P1 pelas teclas e encerra aos 30s (t ≥ 1800)', () => {
    const { ctl, keys } = setup();
    ctl.startAttract(); // sem gravação → robô
    ctl.stepAttract(1); // dir>0 → adiciona a tecla direita
    expect(keys.has('ArrowRight')).toBe(true);
    ctl.stepAttract(2000); // t ≥ 1800 → encerra
    expect(ctl.isAttract()).toBe(false);
  });

  it('[Boundary] stepAttract com gravação (replay) posiciona o P1 pela amostra', () => {
    const rec = [[111, 222, -1], ...Array.from({ length: 20 }, () => [1, 2, 1])]; // > 10 amostras
    localStorage.setItem('incl_attract_campo', JSON.stringify(rec));
    const { ctl, player } = setup();
    ctl.startAttract(); // campo → carrega a gravação
    ctl.stepAttract(1); // idx 0 → 1ª amostra
    expect([player.x, player.y, player.facing]).toEqual([111, 222, -1]);
  });

  it('[Interface] recordTick com ?record=1: após 180 amostras salva no localStorage + srAlert', () => {
    const { ctl, alerted, state } = setup({ search: '?record=1' });
    state.phase = 'playing';
    for (let i = 0; i < 180 * 10; i++) ctl.recordTick(); // 1 amostra a cada 10 ticks
    // A GRAVAÇÃO passou a ir para o escopo DO JOGO (`incl.inclusionist.attract_campo`): uma demonstração é de
    // uma fase DESTE jogo e não significa nada em outro do catálogo. A LEITURA ainda herda do nome antigo —
    // é o caso logo acima, que continua semeando pelo nome velho e continua verde.
    const saved = localStorage.getItem('incl.inclusionist.attract_campo');
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved).length).toBe(180);
    expect(alerted.length).toBe(1);
  });
});
