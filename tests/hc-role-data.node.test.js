// SPDX-License-Identifier: GPL-3.0-or-later
// render/hc-role-data — a fonte única dos papéis do color-blocking.
//
// O que estes testes existem para pegar: os papéis viviam em DUAS listas independentes (uma no painel visual,
// outra no repinte de alto contraste) e a divergência era silenciosa — um quinto papel no render ganharia cor
// e não ganharia seletor, sem erro de tipo. Verificado adicionando um quinto papel de mentira: os casos abaixo
// ficam vermelhos.
//
// NÃO estão aqui, de propósito, dois casos que eu havia escrito e que não podem falhar: `ROLE_KEYS` AGORA É
// `HC_ROLE_KEYS` (mesma referência) e `HC_ROLE` nasce de uma cópia de `HC_ROLE_DEF`. Compará-los seria afirmar
// que um objeto é igual a si mesmo — passa sempre, prova nada, e ainda dá a impressão de cobertura.
import { describe, it, expect } from 'vitest';
import { HC_ROLE_KEYS, HC_ROLE_DEF } from '../app/js/render/hc-role-data.js';
import { ROLE_LABELS } from '../app/js/ui/settings-visual.js';

describe('render/hc-role-data — a lista de papéis', () => {
  it('[Right] tem exatamente os quatro papéis, na ordem em que o painel os desenha', () => {
    expect(HC_ROLE_KEYS).toEqual(['hazard', 'climb', 'water', 'gate']);
  });

  it('[Interface] a paleta padrão cobre exatamente as chaves declaradas — nem sobra, nem falta', () => {
    expect(Object.keys(HC_ROLE_DEF).sort()).toEqual([...HC_ROLE_KEYS].sort());
  });

  it('[Right] toda cor padrão é um RGB de três canais dentro de 0..255', () => {
    for (const k of HC_ROLE_KEYS) {
      const c = HC_ROLE_DEF[k];
      expect(c).toHaveLength(3);
      for (const ch of c) {
        expect(ch).toBeGreaterThanOrEqual(0);
        expect(ch).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('render/hc-role-data — o painel acompanha a lista', () => {
  // ESTE é o caso que discrimina: ROLE_LABELS é escrito à mão em ui/settings-visual e não deriva da lista.
  // É por ele que um papel novo no render, sem rótulo no painel, deixa de passar despercebido — o seletor de
  // cor existiria com legenda vazia, que é pior que não existir para quem usa leitor de tela.
  it('[Interface] todo papel tem rótulo legível no painel — sem seletor anônimo', () => {
    for (const k of HC_ROLE_KEYS) {
      expect(typeof ROLE_LABELS[k]).toBe('string');
      expect(ROLE_LABELS[k].length).toBeGreaterThan(0);
    }
  });

  it('[Interface] o painel não inventa rótulo para papel que não existe', () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...HC_ROLE_KEYS].sort());
  });
});
