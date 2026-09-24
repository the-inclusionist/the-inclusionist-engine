// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ISSUE CENSUS IS STILL ALIVE — a check that finds nothing proves the detector, not the tree.
//
// ========================= WHY A REPORT NEEDS A GATE =========================
// `scripts/issue-census.mjs` REPORTS and never fails, on purpose (ADR-0126): the shape of a tracker is not something a red
// build fixes. ⚠️ **And that is precisely why it needs this file.** A gate that fails is read the day it goes red; a
// report that dies silently prints zero suspects forever and nobody looks again. It is what happened with the
// comment-stripper of the no-hand-written-CDN check, which returned ZERO and was almost reported as there being no CDN.
//
// 📌 What is exercised are the PURE halves, with fixtures — nothing here touches `gh`, and the runner is guarded so it
// does not run on import.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { PISTAS, contarCaixas, pistaDoTitulo } from '../scripts/issue-census.mjs';

describe('o censo das issues', () => {
  it('🎯 [Vácuo] o detector de caixas ACHA uma caixa — é a metade que era o propósito do tracker', () => {
    // 📏 The number behind ADR-0126: of the 126 issues, 14 had a box. If this detector dies, the report says NONE has —
    // and the obvious reading of that is that everything is wrong, which gets the number ignored as fast as a false zero
    // would.
    expect(contarCaixas('- [ ] fazer a coisa'), 'caixa por fazer não contada').toBe(1);
    expect(contarCaixas('* [x] feita\n* [ ] por fazer'), 'as duas formas de caixa').toBe(2);
    expect(contarCaixas('  - [X] indentada'), 'caixa indentada perdida').toBe(1);
    expect(contarCaixas('texto sem caixa nenhuma'), 'achou caixa onde não há').toBe(0);
    expect(contarCaixas(undefined), 'corpo ausente devia dar zero, não rebentar').toBe(0);
  });

  it('🎯 [Right] cada uma das quatro pistas ACERTA no seu caso — e são quatro casas, não uma', () => {
    expect(pistaDoTitulo('Roadmap · Fase 5 — i18n')).toMatch(/ROADMAP/);
    expect(pistaDoTitulo('[JOSÉ] Field test with 5 children')).toMatch(/Test-Plan/);
    expect(pistaDoTitulo('[research] Internet multiplayer')).toMatch(/documento|registo/);
    expect(pistaDoTitulo('Choose a scheduled dependency updater')).toMatch(/REGISTO/);
    // 📌 Accents cannot decide: the name tag with and without its accent is the same person, and a title loses its
    // accent through copy-and-paste more often than one would think.
    expect(pistaDoTitulo('[JOSE] auditoria'), 'a pista morre sem acento').toMatch(/Test-Plan/);
  });

  it('⚠️ [Zero] uma issue de CÓDIGO não é acusada — a heurística que acusa tudo é desligada na primeira semana', () => {
    for (const t of [
      'Guia auditivo: trocar o bipe por intensidade',
      'Fronteira engine↔jogo: o corte das constantes',
      'Menu de Comunicação Aumentada e Alternativa',
      'Pointer transport: the foundation transports 8 and 9 do not have',
    ]) {
      expect(pistaDoTitulo(t), `falso positivo em «${t}»`).toBeNull();
    }
  });

  it('📌 [Boundary] as pistas são QUATRO, e cada uma nomeia uma casa diferente', () => {
    // 🎯 The number is ADR-0126's clause: four homes. A fifth clue means a fifth home, and that is a decision about where
    // work lives — not a regex someone adds to solve one case.
    expect(PISTAS.length).toBe(4);
    expect(new Set(PISTAS.map(([, casa]) => casa)).size, 'duas pistas apontam para a mesma casa').toBe(4);
  });
});

// ================================ MUTATIONS CHECKED ================================
// 1. 🎯 the box detector without the `m` flag (`/^\s*[-*]\s*\[[ xX]\]/g`) → [Vácuo] fails on TWO assertions. It is the
//    mutation that matters: without `m`, only the FIRST line counts, and a body with ten boxes reports one. The report
//    would go on printing numbers — wrong, and looking like a measurement.
// 2. the name-tag clue without the accented alternative (`/^\[jose\]/i`) → [Right] fails on its last assertion.
//    ⚠️ This one was born of a question and not a theory: this tracker's titles come from two migrations, and accents
//    do not survive everyone.
// 3. a fifth clue added → [Boundary] fails. Not because five is wrong, but because the fifth home is an ADR-0126
//    decision and not a convenience regex.
