// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of render/viz-modes — the table of the 16 visual modes and the lists DERIVED from it (node project).
//
// ========================= WHY THIS FILE =========================
// `render/viz-modes` is a leaf, it is pure data and it decides ALL of the game's visual accessibility — who appears in the
// empathy menu, who appears in the vision one, which CSS filter each mode applies, and which of them needs a world to
// exist. Exercised only from the side, by the tests of whoever consumes them, a wrong table would show up as a strange
// menu in another file.
//
// What the cases pursue is not the table itself (literal data does not go wrong by itself): it is that the DERIVED lists
// keep deriving. A list written by hand would look identical until the day someone added a mode and it vanished from one
// of the menus, in silence.
import { describe, it, expect } from 'vitest';
import {
  VIZ_MODES, VIZ_BY_KEY, VIZ_FILTER, VIZ_CYCLE, VIZ_CORRECTIONS,
  simulatesDisability, needsCanvas, VIZ_DOM_ONLY, VIZ_CANVAS_ONLY,
} from '../app/js/render/viz-modes.js';

describe('a tabela e os índices', () => {
  it('[Right] toda chave é única, e VIZ_BY_KEY cobre todas', () => {
    const chaves = VIZ_MODES.map((m) => m.key);
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const k of chaves) expect(VIZ_BY_KEY[k], k).toBeTruthy();
  });

  it('[Right] VIZ_CYCLE é a ordem da tabela — o ciclo do botão segue a lista, não uma cópia dela', () => {
    expect(VIZ_CYCLE).toEqual(VIZ_MODES.map((m) => m.key));
  });

  it('[Interface] `nome` e `desc` guardam CHAVE i18n, nunca texto', () => {
    // The decision is written in the module's header: a `const` table with text resolves ONCE, at import, and stays frozen
    // in the boot language. This menu is what a low-vision child reads to set up her own game — in English it would become
    // the one page she cannot use.
    for (const m of VIZ_MODES) {
      expect(m.name, m.key).toMatch(/^viz\./);
      expect(m.desc, m.key).toMatch(/^viz\.desc\./);
    }
  });

  it('[Right] todo modo com filtro de CSS declarado existe na tabela', () => {
    for (const k of Object.keys(VIZ_FILTER)) expect(VIZ_BY_KEY[k], k).toBeTruthy();
  });
});

describe('simulatesDisability — simular contra corrigir', () => {
  it('[Right] as três correções de daltonismo NÃO simulam, e as três simulações simulam', () => {
    // The distinction `kind` did not make and ADR-0028 forced: turning the simulations off is what the empathy menu's
    // "restaurar padrões" has to do; turning the corrections off with them would take from a colour-blind child the only
    // correction she has, from a menu made for whoever does NOT have the condition.
    for (const k of ['fix-protan', 'fix-deuter', 'fix-tritan']) expect(simulatesDisability(k), k).toBe(false);
    for (const k of ['sim-protan', 'sim-deuter', 'sim-tritan']) expect(simulatesDisability(k), k).toBe(true);
  });

  it('[Zero] chave desconhecida não simula — diante do desconhecido, a resposta que não remove nada', () => {
    expect(simulatesDisability('nao-existe')).toBe(false);
    expect(simulatesDisability('')).toBe(false);
  });

  it('[Right] VIZ_CORRECTIONS é DERIVADA: exatamente os filtros que não simulam', () => {
    expect(VIZ_CORRECTIONS.map((m) => m.key).sort())
      .toEqual(VIZ_MODES.filter((m) => m.kind === 'filter' && !m.sim).map((m) => m.key).sort());
    expect(VIZ_CORRECTIONS).toHaveLength(3);
  });
});

/* ===================== THE TWO STACKS WITH ONE NAME (finding 8, item 19) ===================== */

describe('needsCanvas — qual modo exige um mundo', () => {
  it('[Right] só os `hcnew` precisam de canvas: são os que repintam textura de tile', () => {
    for (const m of VIZ_MODES) expect(needsCanvas(m.key), m.key).toBe(m.kind === 'hcnew');
  });

  it('[Zero] chave desconhecida NÃO exige canvas — a resposta que não tira nada de ninguém', () => {
    // The same rule as `simulatesDisability`. Here "safe" is falling into the DOM stack: a consumer with no world can
    // still offer the mode, and the error in the opposite direction would hide accessibility from whoever uses it.
    expect(needsCanvas('nao-existe')).toBe(false);
    expect(needsCanvas('')).toBe(false);
  });
});

describe('VIZ_DOM_ONLY / VIZ_CANVAS_ONLY — a partição', () => {
  it('[Right] juntas são os 16 modos, sem sobra e sem repetição', () => {
    // It is what makes them a PARTITION and not two convenient lists. A mode falling outside both — or in both — would be a
    // mode whose stack nobody knows, and the consumer would go back to guessing.
    expect(VIZ_DOM_ONLY.length + VIZ_CANVAS_ONLY.length).toBe(VIZ_MODES.length);
    const chaves = [...VIZ_DOM_ONLY, ...VIZ_CANVAS_ONLY].map((m) => m.key).sort();
    expect(chaves).toEqual(VIZ_MODES.map((m) => m.key).sort());
    expect(new Set(chaves).size).toBe(VIZ_MODES.length);
  });

  it('[Right] a pilha de CANVAS é exatamente os três `hc-direto`', () => {
    expect(VIZ_CANVAS_ONLY.map((m) => m.key)).toEqual(['hc-direto', 'hc-direto-45', 'hc-direto-7']);
  });

  it('[Many] a pilha que VIAJA é maior do que "os filtros de daltonismo": 13 dos 16', () => {
    // The number matters because finding 8 is easy to read as "high contrast does not travel, so visual accessibility
    // does not travel". Thirteen modes travel. What does not travel is three.
    const chaves = VIZ_DOM_ONLY.map((m) => m.key);
    expect(chaves).toContain('normal');
    expect(chaves).toContain('fix-deuter');
    expect(chaves).toContain('lv-tunnel');
    expect(chaves).toContain('blind');
    expect(VIZ_DOM_ONLY).toHaveLength(13);
  });

  it('[Cross-check] as CORREÇÕES de daltonismo estão todas na pilha que viaja', () => {
    // The case that links the two questions without mixing them: correcting colour blindness is DOM, and so the
    // colour-blind child has her correction in any game of the catalogue — not only in this one.
    const dom = new Set(VIZ_DOM_ONLY.map((m) => m.key));
    for (const c of VIZ_CORRECTIONS) expect(dom, c.key).toContain(c.key);
  });

  it('[Interface] todo modo da pilha de DOM tem filtro declarado, ou é o `normal`', () => {
    // If a mode says "I do not need a canvas" and carries no CSS filter, it does NOTHING in a game with no world — and it
    // would appear in the menu as an option that changes nothing at all. It is this partition's silent defect.
    for (const m of VIZ_DOM_ONLY) {
      if (m.key === 'normal') continue;
      expect(VIZ_FILTER[m.key] !== undefined, m.key).toBe(true);
    }
  });
});
