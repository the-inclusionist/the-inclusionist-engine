// SPDX-License-Identifier: AGPL-3.0-or-later
// O CENSO DAS ISSUES CONTINUA VIVO — um crivo que não acha nada não prova a árvore, prova o detector.
//
// ========================= POR QUE UM RELATÓRIO PRECISA DE GATE =========================
// O `scripts/censo-de-issues.mjs` REPORTA e nunca reprova, de propósito (ADR-0126): a forma de um tracker não
// é coisa que um build vermelho conserte. ⚠️ **E é precisamente por isso que ele precisa deste ficheiro.** Um
// gate que reprova é lido no dia em que fica vermelho; um relatório que morre em silêncio imprime «0
// suspeitas» para sempre e ninguém volta a olhar. Foi o que aconteceu com o tira-comentários do
// `nada-de-cdn-a-mao`, que devolveu ZERO e eu quase reportei como «não há CDN».
//
// 📌 O que se exercita são as metades PURAS, com fixtures — nada aqui toca no `gh`, e o runner está guardado
// para não correr ao ser importado.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { PISTAS, contarCaixas, pistaDoTitulo } from '../scripts/censo-de-issues.mjs';

describe('o censo das issues', () => {
  it('🎯 [Vácuo] o detector de caixas ACHA uma caixa — é a metade que era o propósito do tracker', () => {
    // 📏 O número que produziu o ADR-0126: das 126 issues, 14 tinham uma caixa. Se este detector morrer, o
    // relatório passa a dizer que NENHUMA tem — e a leitura óbvia disso é «está tudo mal», que faz o número
    // ser ignorado tão depressa como um zero falso o faria.
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
    // 📌 A acentuação não pode decidir: «JOSE» e «JOSÉ» são a mesma pessoa, e um título perde o acento
    // por copiar-e-colar mais vezes do que se imagina.
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
    // 🎯 O número é a cláusula do ADR-0126: quatro casas. Uma quinta pista significa uma quinta casa, e isso
    // é uma decisão sobre onde o trabalho mora — não uma regex que alguém acrescenta a resolver um caso.
    expect(PISTAS.length).toBe(4);
    expect(new Set(PISTAS.map(([, casa]) => casa)).size, 'duas pistas apontam para a mesma casa').toBe(4);
  });
});

// ================================ MUTAÇÕES CONFERIDAS ================================
// 1. 🎯 o detector de caixas sem a bandeira `m` (`/^\s*[-*]\s*\[[ xX]\]/g`) → o [Vácuo] reprova em DUAS
//    asserções. É a mutação que importa: sem `m`, só a PRIMEIRA linha conta, e um corpo com dez caixas
//    reporta uma. O relatório continuaria a imprimir números — errados, e com ar de medição.
// 2. a pista do `[JOSÉ]` sem o `é` alternativo (`/^\[jose\]/i`) → o [Right] reprova na última asserção.
//    ⚠️ Esta nasceu de uma pergunta e não de uma teoria: os títulos deste tracker vêm de duas migrações, e
//    acentuação não sobrevive a toda a gente.
// 3. uma quinta pista acrescentada → o [Boundary] reprova. Não porque cinco seja errado, mas porque a
//    quinta casa é uma decisão do ADR-0126 e não uma regex de conveniência.
