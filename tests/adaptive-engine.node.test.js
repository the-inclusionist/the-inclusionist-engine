// SPDX-License-Identifier: AGPL-3.0-or-later
// O MOTOR ADAPTATIVO — as três faixas, e a aritmética que as justifica (ADR-0048 §5/§6, issue #92).
//
// ========================= O QUE ESTE FICHEIRO PRENDE =========================
// A issue #92 pede, pelo nome, que os dois números que sustentam as faixas sejam presos junto com elas: o
// piso de chute de 0,60 e a probabilidade 0,40⁴ = 0,0256 de falhar quatro questões seguidas. Não são
// decoração do texto — são o motivo de a proficiência ler acertos DE PRIMEIRA e o motivo de quatro seguidas
// descerem na hora. Um teste que afira as faixas sem eles afere a implementação, não a decisão.
//
// ⚠️ E O CASO CENTRAL É O DA UNIDADE: quatro TENTATIVAS erradas dentro de uma questão × quatro QUESTÕES
// falhadas seguidas. As duas coisas parecem-se e têm efeitos opostos — a primeira é uma questão difícil, a
// segunda é o evento de 2,56% que manda descer. Confundi-las rebaixa uma criança por uma questão só, e é o
// defeito que a issue nomeia com todas as letras.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  guessFloor, resultadoDaQuestao, falhasSeguidas, bandOf,
  WINDOW, LEVEL_UP_TARGET, MISSES_IN_A_ROW_THAT_DROP,
} from '../app/js/educational/adaptive-engine.js';

/**
 * Um histórico de dez com `p` de primeira, `m` mediadas e o resto falhado.
 *
 * ⚠️ AS FALHAS SÃO INTERCALADAS, e a primeira versão deste ajudante não as intercalava — punha-as todas no
 * fim. O resultado é que qualquer fixture com quatro falhas ou mais disparava a regra das QUATRO SEGUIDAS
 * antes de a janela ser sequer olhada, e três casos reprovaram a acusar a faixa errada. O defeito era do
 * fixture e não do módulo, mas ensina o mesmo: uma sequência de falhas no fim não é «40% de falhas», é o
 * evento de 2,56% — e um ajudante de teste que as empilhe mede outra coisa sem avisar.
 */
function historico(p, m, f = WINDOW - p - m) {
  const bons = [...Array(p).fill('primeira'), ...Array(m).fill('mediada')];
  const total = bons.length + f;
  const saida = [];
  let usadasF = 0, usadasB = 0;
  for (let i = 0; i < total; i++) {
    const devidas = Math.floor(((i + 1) * f) / total);
    if (devidas > usadasF) { saida.push('falhou'); usadasF++; } else { saida.push(bons[usadasB++]); }
  }
  return saida;
}

describe('a aritmética que justifica os cortes (issue #92)', () => {
  it('⚠️ [Right] chutar com 3 tentativas em 5 alternativas resolve 60% das questões', () => {
    // 1 − (4/5 · 3/4 · 2/3) = 1 − 0,4 = 0,60. É este número que torna «8 de 10 RESOLVIDAS» inútil como prova
    // de proficiência: o chute puro produz quase isso sozinho.
    expect(guessFloor(5, 3)).toBeCloseTo(0.6, 10);
    expect(1 - (4 / 5) * (3 / 4) * (2 / 3)).toBeCloseTo(0.6, 10);
  });

  it('⚠️ [Right] falhar quatro QUESTÕES seguidas tem 2,56% de probabilidade — abaixo do corte de 5%', () => {
    const falharUma = 1 - guessFloor(5, 3);           // 0,40
    expect(falharUma ** MISSES_IN_A_ROW_THAT_DROP).toBeCloseTo(0.0256, 10);
    expect(falharUma ** MISSES_IN_A_ROW_THAT_DROP).toBeLessThan(0.05);
    // E TRÊS seguidas ainda NÃO passa o corte: 0,064 > 5%. É o que impede o número de ser 3.
    expect(falharUma ** 3).toBeGreaterThan(0.05);
  });

  it('[Interface] o piso é do TIPO de questão, e não uma constante embutida', () => {
    expect(guessFloor(2, 1)).toBeCloseTo(0.5, 10);    // verdadeiro/falso
    expect(guessFloor(10, 1)).toBeCloseTo(0.1, 10);   // dez alternativas, uma tentativa
    expect(guessFloor(4, 2)).toBeCloseTo(0.5, 10);    // 1 − (3/4 · 2/3)
    expect(guessFloor(5, 1)).toBeCloseTo(0.2, 10);
  });

  it('[Boundary] mais tentativas do que alternativas−1 não passa de certeza, e lixo devolve 0', () => {
    // Com 5 alternativas e 4 tentativas a criança esgota as erradas: o piso é 1. Pedir 9 tentativas não pode
    // devolver mais do que 1, e um `alternativas` inválido não pode devolver NaN para dentro da faixa.
    expect(guessFloor(5, 4)).toBeCloseTo(0.8, 10);   // sobra UMA por eliminar: falha com 1/5
    expect(guessFloor(5, 5)).toBeCloseTo(1, 10);     // esgotou as cinco: certeza
    expect(guessFloor(5, 9)).toBeCloseTo(1, 10);     // pedir mais não passa da certeza
    expect(guessFloor(1, 3)).toBe(0);
    expect(guessFloor(NaN, 3)).toBe(0);
  });
});

describe('⚠️ a unidade é a QUESTÃO, nunca a tentativa', () => {
  it('[Right] as tentativas de uma questão colapsam num resultado só', () => {
    expect(resultadoDaQuestao(1)).toBe('primeira');
    expect(resultadoDaQuestao(2)).toBe('mediada');
    expect(resultadoDaQuestao(3)).toBe('mediada');
    expect(resultadoDaQuestao(null)).toBe('falhou');
  });

  it('⚠️ [Right] QUATRO tentativas erradas na mesma questão ≠ QUATRO questões falhadas', () => {
    // O caso obrigatório da issue, e o mais caro de errar. À esquerda: uma questão difícil, respondida à
    // quinta. À direita: o evento de 2,56%. Se as duas descessem o nível, uma questão difícil rebaixaria a
    // criança sozinha.
    const umaQuestaoDificil = [resultadoDaQuestao(5)];
    const quatroQuestoesFalhadas = [null, null, null, null].map(resultadoDaQuestao);

    expect(umaQuestaoDificil).toEqual(['mediada']);
    expect(falhasSeguidas(umaQuestaoDificil)).toBe(0);
    expect(bandOf(umaQuestaoDificil, 0.6).efeito, 'uma questão difícil rebaixou a criança').toBe(0);

    expect(falhasSeguidas(quatroQuestoesFalhadas)).toBe(4);
    expect(bandOf(quatroQuestoesFalhadas, 0.6)).toEqual({
      faixa: 'frustracao', motivo: 'quatro-seguidas', efeito: -1,
    });
  });

  it('[Boundary] a contagem de seguidas quebra na primeira que não falhou', () => {
    expect(falhasSeguidas(['falhou', 'falhou', 'mediada', 'falhou', 'falhou'])).toBe(2);
    expect(falhasSeguidas(['primeira', 'falhou', 'falhou', 'falhou'])).toBe(3);
    expect(falhasSeguidas([])).toBe(0);
    // TRÊS seguidas ainda não descem — é a fronteira exata do corte.
    expect(bandOf(['falhou', 'falhou', 'falhou'], 0.6).efeito).toBe(0);
  });
});

describe('as três faixas, na fronteira exata de cada uma (ADR-0048 §5)', () => {
  it('⚠️ [Boundary] 8 de 10 DE PRIMEIRA sobe; 7 de primeira não sobe', () => {
    expect(bandOf(historico(8, 2), 0.6)).toEqual({
      faixa: 'proficiente', motivo: 'acertos-de-primeira', efeito: 1,
    });
    expect(bandOf(historico(7, 3), 0.6).faixa, '7 de primeira subiu de nível').toBe('zona');
    expect(LEVEL_UP_TARGET).toBe(0.8);
  });

  it('⚠️ [Boundary] 8 de 10 RESOLVIDAS não sobe — é quase o que o chute puro produz', () => {
    // A afirmação inteira da issue, numa linha: o mesmo 8/10, lido pela medida errada, promoveria por sorte.
    const oitoResolvidasMasSoTresDePrimeira = historico(3, 5);
    expect(oitoResolvidasMasSoTresDePrimeira.filter((r) => r !== 'falhou')).toHaveLength(8);
    expect(bandOf(oitoResolvidasMasSoTresDePrimeira, 0.6).faixa).toBe('zona');
  });

  it('[Boundary] 7 de 10 resolvidas mantém, 6 de 10 desce — o corte é `≤`, não `<`', () => {
    // 6/10 é EXACTAMENTE o piso de 0,60. A tabela do registo diz «≤ 6 das últimas 10» e é ela que manda; a
    // prosa da mesma issue diz «abaixo do piso», que é resumo. Seguir a prosa deixaria a criança um nível
    // acima com um desempenho que o chute reproduz.
    expect(bandOf(historico(0, 7), 0.6)).toEqual({ faixa: 'zona', motivo: 'dentro-da-zona', efeito: 0 });
    expect(bandOf(historico(0, 6), 0.6)).toEqual({
      faixa: 'frustracao', motivo: 'resolvidas-no-piso', efeito: -1,
    });
  });

  it('[Interface] o piso muda o corte de baixo — o mesmo histórico julga diferente por tipo', () => {
    // Cinco resolvidas de dez: acima do piso de uma questão de dez alternativas (0,10), no piso de uma de
    // verdadeiro/falso (0,50). O mesmo desempenho, dois veredictos, e é o que «o piso é parâmetro» significa.
    const cincoResolvidas = historico(0, 5);
    expect(bandOf(cincoResolvidas, 0.1).faixa).toBe('zona');
    expect(bandOf(cincoResolvidas, 0.5).faixa).toBe('frustracao');
  });

  it('[Right] a tabela completa de resultados por questão sobrevive ao trajeto', () => {
    // As três medidas que a issue diz que o jogo hoje reduz a duas. Uma janela com as três presentes tem de
    // as distinguir — se `'mediada'` fosse tratada como `'primeira'`, este histórico subiria de nível.
    const h = historico(6, 3, 1);
    expect(h.filter((r) => r === 'primeira')).toHaveLength(6);
    expect(h.filter((r) => r === 'mediada')).toHaveLength(3);
    expect(h.filter((r) => r === 'falhou')).toHaveLength(1);
    expect(bandOf(h, 0.6), '6 de primeira + 3 mediadas subiu — a mediação foi contada como autonomia')
      .toEqual({ faixa: 'zona', motivo: 'dentro-da-zona', efeito: 0 });
  });
});

describe('⚠️ a janela incompleta, que é decisão minha e está declarada', () => {
  it('[Zero] sem histórico nenhum não há veredicto — mantém, e diz por quê', () => {
    expect(bandOf([], 0.6)).toEqual({ faixa: 'zona', motivo: 'janela-incompleta', efeito: 0 });
  });

  it('[Zero] e os fixtures deste ficheiro não escondem uma sequência de quatro', () => {
    // A guarda do ajudante `historico`. Sem ela, um fixture com quatro falhas empilhadas faria os casos da
    // janela medirem a regra das seguidas e passarem pelo motivo errado — foi o que aconteceu ao escrever
    // este ficheiro, em três casos de uma vez.
    for (const [p, m] of [[8, 2], [7, 3], [3, 5], [0, 7], [0, 6], [0, 5], [6, 3]]) {
      const h = historico(p, m);
      expect(h).toHaveLength(WINDOW);
      expect(falhasSeguidas(h), `o fixture (${p},${m}) empilhou falhas no fim`)
        .toBeLessThan(MISSES_IN_A_ROW_THAT_DROP);
    }
  });

  it('⚠️ [Boundary] duas falhas em três questões NÃO rebaixam — a aritmética é sobre dez', () => {
    // A regra não está na issue #92 e está escrita no módulo como decisão minha. O motivo é o mesmo da
    // unidade-questão: com três respondidas, «resolvidas ≤ piso» dispararia com duas falhas, e rebaixar por
    // duas questões é o erro que o resto do ficheiro existe para não cometer.
    expect(bandOf(['falhou', 'mediada', 'falhou'], 0.6)).toEqual({
      faixa: 'zona', motivo: 'janela-incompleta', efeito: 0,
    });
  });

  it('⚠️ [Interface] mas QUATRO seguidas descem mesmo com a janela incompleta', () => {
    // A excepção, e ela é deliberada: quatro questões falhadas seguidas não ficam mais prováveis por a
    // criança ter respondido poucas. Esperar a janela fechar seria deixá-la mais seis questões num nível
    // que já se sabe alto.
    const quatro = ['falhou', 'falhou', 'falhou', 'falhou'];
    expect(quatro.length).toBeLessThan(WINDOW);
    expect(bandOf(quatro, 0.6).efeito).toBe(-1);
  });

  it('[Exercise] a janela olha as ÚLTIMAS, e o passado sai dela', () => {
    // Dez falhas antigas seguidas de dez acertos de primeira: a criança subiu, e o histórico antigo não a
    // segura. Sem o `slice(-janela)` a mesma lista devolveria frustração para sempre.
    const h = [...Array(10).fill('falhou'), ...Array(10).fill('primeira')];
    expect(bandOf(h, 0.6)).toEqual({ faixa: 'proficiente', motivo: 'acertos-de-primeira', efeito: 1 });
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · trocando `acertouNaTentativa <= 1` por `<= 2` (a mediação da 2ª tentativa a passar por autonomia)
//     → "as tentativas colapsam num resultado só" reprova.
//   · trocando `resolvidas <= piso` por `resolvidas < piso` → reprovam DOIS: "[Boundary] o corte é `≤`" em
//     6 de 10 — a criança que fica um nível acima com o desempenho do chute — e "[Interface] o piso muda o
//     corte", porque a fronteira do verdadeiro/falso é exactamente 0,50.
//   · trocando `>= LEVEL_UP_TARGET` por `> LEVEL_UP_TARGET` → "[Boundary] 8 de 10 DE PRIMEIRA sobe" reprova.
//   · exigindo janela cheia ANTES da regra de quatro seguidas → reprovam DOIS, e são os dois que descrevem
//     o evento de 2,56%: "QUATRO tentativas ≠ QUATRO questões" e "quatro seguidas descem mesmo com a janela
//     incompleta". A ordem das perguntas É a decisão.
//   · trocando `historico.slice(-janela)` por `slice(0, janela)` → "[Exercise] a janela olha as ÚLTIMAS"
//     reprova: a criança fica presa no passado dela.
//   · ⚠️ trocando `r === 'primeira'` por `r !== 'falhou'` no numerador da subida → reprovam TRÊS: as duas
//     fronteiras de subida e a tabela completa de resultados. É a issue #92 inteira numa mutação — ler
//     «resolvidas» onde a decisão diz «de primeira» promove por sorte, e três casos independentes dizem-no.
//
// ⚠️ E DOIS DEFEITOS APANHADOS AO ESCREVER ISTO, ambos meus e ambos instrutivos:
//   1. `guessFloor(5, 4)` é 0,80 e não 1 — com quatro tentativas em cinco alternativas sobra UMA por
//      eliminar, e falha-se com 1/5. Eu tinha escrito a expectativa errada e o módulo estava certo; o tecto
//      de tentativas passou a ser `alternativas` (aí sim, certeza) em vez de `alternativas − 1`.
//   2. o ajudante `historico` empilhava as falhas NO FIM, e por isso qualquer fixture com quatro ou mais
//      disparava a regra das seguidas antes de a janela ser olhada — três casos reprovaram a medir a regra
//      errada pelo motivo errado. As falhas passaram a ser intercaladas, e há um caso `[Zero]` a garantir
//      que nenhum fixture volta a esconder uma sequência.
