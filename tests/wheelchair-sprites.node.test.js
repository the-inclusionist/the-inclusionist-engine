// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/wheelchair-sprites — cor da bengala (project node). ZOMBIES + Right-BICEP. As draws são
// PIXI (verificadas no boot); aqui testamos o predicado puro caneColor.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (Estágio 4, render/wheelchair-sprites).
//
// ⚠️ MIGRADO PARA `visual` NA #104. A pergunta não mudou — «isto é baixa visão?» — e as chaves continuam a
// vir do catálogo em vez de escritas à mão, que era o que este ficheiro já fazia bem. O que mudou é que a
// resposta passa pelo modelo de dois eixos, e por isso o caso novo lá em baixo: um estado que a chave única
// NÃO consegue exprimir continua a responder certo.
import { describe, it, expect } from 'vitest';
import { caneColor } from '../app/js/render/wheelchair-sprites.js';
import { VIZ_BY_KEY } from '../app/js/render/viz-modes.js';
import { migrateVisual, PADRAO } from '../app/js/render/viz-axes.js';

describe('caneColor', () => {
  it('baixa visão → bengala VERDE (0x35d06a)', () => {
    const lowKey = Object.keys(VIZ_BY_KEY).find((k) => VIZ_BY_KEY[k].kind === 'lowvision');
    expect(lowKey).toBeTruthy(); // o catálogo tem um modo de baixa visão
    expect(caneColor({ visual: migrateVisual(lowKey) })).toBe(0x35d06a);
  });

  it('cego / demais → bengala BRANCA (0xf2f2f2)', () => {
    const blindKey = Object.keys(VIZ_BY_KEY).find((k) => VIZ_BY_KEY[k].kind === 'blind');
    if (blindKey) expect(caneColor({ visual: migrateVisual(blindKey) })).toBe(0xf2f2f2);
    expect(caneColor({ visual: migrateVisual('__inexistente__') })).toBe(0xf2f2f2); // desconhecida cai no branco
    expect(caneColor({ visual: PADRAO })).toBe(0xf2f2f2);
  });

  it('⚠️ [Right] alto contraste COM baixa visão continua verde — o estado que a chave única não sabia dizer', () => {
    // O ponto da #104 aplicado ao caso mais concreto que este módulo tem. Antes, uma criança em baixa visão
    // que ligasse o alto contraste trocava um pelo outro, porque `p.viz` só cabia um; a bengala dela deixava
    // de ser verde. Agora os dois coexistem, e a bengala continua a dizer o que ela precisa que diga.
    expect(caneColor({ visual: { tema: 'hc7', correcao: 'tricro', simulacao: 'lv-tunnel' } })).toBe(0x35d06a);
    // E o inverso: alto contraste SEM baixa visão continua branca, porque tema não é simulação.
    expect(caneColor({ visual: { tema: 'hc7', correcao: 'deuter', simulacao: null } })).toBe(0xf2f2f2);
  });
});
