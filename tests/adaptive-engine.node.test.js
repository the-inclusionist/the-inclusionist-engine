// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ADAPTIVE ENGINE — the three bands, and the arithmetic that justifies them (ADR-0048 §5/§6, issue #92).
//
// ========================= WHAT THIS FILE HOLDS =========================
// Issue #92 asks, by name, that the two numbers behind the bands be held together with them: the guessing floor of 0.60
// and the probability 0.40⁴ = 0.0256 of failing four questions in a row. They are not decoration of the text — they are
// why proficiency reads FIRST-TRY answers and why four in a row drop at once. A test that checks the bands without them
// checks the implementation, not the decision.
//
// ⚠️ AND THE CENTRAL CASE IS THE UNIT'S: four wrong ATTEMPTS inside one question × four QUESTIONS failed in a row. The two
// look alike and have opposite effects — the first is a hard question, the second is the 2.56% event that says drop.
// Confusing them demotes a child for a single question, and it is the defect the issue names in full.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import {
  guessFloor, resultadoDaQuestao, falhasSeguidas, bandOf,
  WINDOW, LEVEL_UP_TARGET, MISSES_IN_A_ROW_THAT_DROP,
} from '../app/js/educational/adaptive-engine.js';

/**
 * A history of ten with `p` first-try, `m` mediated and the rest failed.
 *
 * ⚠️ THE FAILURES ARE INTERLEAVED. Stacked at the end, any fixture with four failures or more fired the FOUR-IN-A-ROW rule
 * before the window was even looked at, and three cases failed accusing the wrong band. The defect was the fixture's, not
 * the module's, but it teaches the same thing: a run of failures at the end is not 40% failures, it is the 2.56% event —
 * and a test helper that stacks them measures something else without saying so.
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
    // 1 − (4/5 · 3/4 · 2/3) = 1 − 0.4 = 0.60. That number is what makes 8 of 10 SOLVED useless as proof of proficiency:
    // pure guessing produces almost that on its own.
    expect(guessFloor(5, 3)).toBeCloseTo(0.6, 10);
    expect(1 - (4 / 5) * (3 / 4) * (2 / 3)).toBeCloseTo(0.6, 10);
  });

  it('⚠️ [Right] falhar quatro QUESTÕES seguidas tem 2,56% de probabilidade — abaixo do corte de 5%', () => {
    const falharUma = 1 - guessFloor(5, 3);           // 0,40
    expect(falharUma ** MISSES_IN_A_ROW_THAT_DROP).toBeCloseTo(0.0256, 10);
    expect(falharUma ** MISSES_IN_A_ROW_THAT_DROP).toBeLessThan(0.05);
    // And THREE in a row still do NOT pass the cut: 0.064 > 5%. That is what keeps the number from being 3.
    expect(falharUma ** 3).toBeGreaterThan(0.05);
  });

  it('[Interface] o piso é do TIPO de questão, e não uma constante embutida', () => {
    expect(guessFloor(2, 1)).toBeCloseTo(0.5, 10);    // verdadeiro/falso
    expect(guessFloor(10, 1)).toBeCloseTo(0.1, 10);   // dez alternativas, uma tentativa
    expect(guessFloor(4, 2)).toBeCloseTo(0.5, 10);    // 1 − (3/4 · 2/3)
    expect(guessFloor(5, 1)).toBeCloseTo(0.2, 10);
  });

  it('[Boundary] mais tentativas do que alternativas−1 não passa de certeza, e lixo devolve 0', () => {
    // With 5 options and 4 attempts the child runs out of wrong ones: the floor is 1. Asking for 9 attempts cannot return
    // more than 1, and an invalid `alternativas` cannot return NaN into the band.
    expect(guessFloor(5, 4)).toBeCloseTo(0.8, 10);   // ONE left to eliminate: fails with 1/5
    expect(guessFloor(5, 5)).toBeCloseTo(1, 10);     // all five used up: certainty
    expect(guessFloor(5, 9)).toBeCloseTo(1, 10);     // asking for more does not go past certainty
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
    // The issue's mandatory case, and the most expensive to get wrong. On the left: a hard question, answered on the fifth
    // try. On the right: the 2.56% event. If both dropped the level, one hard question would demote the child by itself.
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
    // THREE in a row do not drop yet — the exact edge of the cut.
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
    // The issue's whole claim, in one line: the same 8/10, read by the wrong measure, would promote by luck.
    const oitoResolvidasMasSoTresDePrimeira = historico(3, 5);
    expect(oitoResolvidasMasSoTresDePrimeira.filter((r) => r !== 'falhou')).toHaveLength(8);
    expect(bandOf(oitoResolvidasMasSoTresDePrimeira, 0.6).faixa).toBe('zona');
  });

  it('[Boundary] 7 de 10 resolvidas mantém, 6 de 10 desce — o corte é `≤`, não `<`', () => {
    // 6/10 is EXACTLY the 0.60 floor. The record's table says «≤ 6 das últimas 10» and it rules; the same issue's prose
    // says below the floor, which is a summary. Following the prose would leave the child a level up with a performance
    // guessing reproduces.
    expect(bandOf(historico(0, 7), 0.6)).toEqual({ faixa: 'zona', motivo: 'dentro-da-zona', efeito: 0 });
    expect(bandOf(historico(0, 6), 0.6)).toEqual({
      faixa: 'frustracao', motivo: 'resolvidas-no-piso', efeito: -1,
    });
  });

  it('[Interface] o piso muda o corte de baixo — o mesmo histórico julga diferente por tipo', () => {
    // Five solved out of ten: above the floor of a ten-option question (0.10), at the floor of a true/false one (0.50).
    // The same performance, two verdicts, and that is what the floor being a parameter means.
    const cincoResolvidas = historico(0, 5);
    expect(bandOf(cincoResolvidas, 0.1).faixa).toBe('zona');
    expect(bandOf(cincoResolvidas, 0.5).faixa).toBe('frustracao');
  });

  it('[Right] a tabela completa de resultados por questão sobrevive ao trajeto', () => {
    // The three measures the issue says the game reduces to two today. A window with all three present must tell them
    // apart — if `'mediada'` were treated as `'primeira'`, this history would go up a level.
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
    // The guard of the `historico` helper. Without it, a fixture with four stacked failures would make the window cases
    // measure the in-a-row rule and pass for the wrong reason — which happened while writing this file, in three cases
    // at once.
    for (const [p, m] of [[8, 2], [7, 3], [3, 5], [0, 7], [0, 6], [0, 5], [6, 3]]) {
      const h = historico(p, m);
      expect(h).toHaveLength(WINDOW);
      expect(falhasSeguidas(h), `o fixture (${p},${m}) empilhou falhas no fim`)
        .toBeLessThan(MISSES_IN_A_ROW_THAT_DROP);
    }
  });

  it('⚠️ [Boundary] duas falhas em três questões NÃO rebaixam — a aritmética é sobre dez', () => {
    // The rule is not in issue #92; it is written in the module as a decision of its own. The reason is the same as the
    // question-as-unit one: with three answered, solved ≤ floor would fire on two failures, and demoting for two
    // questions is the error the rest of the file exists not to make.
    expect(bandOf(['falhou', 'mediada', 'falhou'], 0.6)).toEqual({
      faixa: 'zona', motivo: 'janela-incompleta', efeito: 0,
    });
  });

  it('⚠️ [Interface] mas QUATRO seguidas descem mesmo com a janela incompleta', () => {
    // The exception, and it is deliberate: four questions failed in a row do not become likelier because the child has
    // answered few. Waiting for the window to close would leave her six more questions on a level already known too high.
    const quatro = ['falhou', 'falhou', 'falhou', 'falhou'];
    expect(quatro.length).toBeLessThan(WINDOW);
    expect(bandOf(quatro, 0.6).efeito).toBe(-1);
  });

  it('[Exercise] a janela olha as ÚLTIMAS, e o passado sai dela', () => {
    // Ten old failures followed by ten first-try successes: the child went up, and the old history does not hold her.
    // Without the `slice(-janela)` the same list would return frustration forever.
    const h = [...Array(10).fill('falhou'), ...Array(10).fill('primeira')];
    expect(bandOf(h, 0.6)).toEqual({ faixa: 'proficiente', motivo: 'acertos-de-primeira', efeito: 1 });
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · replacing `acertouNaTentativa <= 1` with `<= 2` (mediation on the 2nd attempt passing as autonomy)
//     → `as tentativas colapsam num resultado só` fails.
//   · replacing `resolvidas <= piso` with `resolvidas < piso` → TWO fail: `[Boundary] … o corte é ≤` at 6 of 10 — the
//     child left a level up with guessing's performance — and `[Interface] o piso muda o corte`, because the true/false
//     edge is exactly 0.50.
//   · replacing `>= LEVEL_UP_TARGET` with `> LEVEL_UP_TARGET` → `[Boundary] 8 de 10 DE PRIMEIRA sobe` fails.
//   · demanding a full window BEFORE the four-in-a-row rule → TWO fail, the two that describe the 2.56% event:
//     `QUATRO tentativas … ≠ QUATRO questões` and `quatro seguidas descem mesmo com a janela incompleta`. The order of
//     the questions IS the decision.
//   · replacing `historico.slice(-janela)` with `slice(0, janela)` → `[Exercise] a janela olha as ÚLTIMAS` fails: the
//     child stays stuck in her past.
//   · ⚠️ replacing `r === 'primeira'` with `r !== 'falhou'` in the promotion numerator → THREE fail: both promotion edges
//     and the full table of results. It is issue #92 whole in one mutation — reading solved where the decision says first
//     try promotes by luck, and three independent cases say so.
//
// ⚠️ AND TWO DEFECTS CAUGHT WHILE WRITING THIS, both instructive:
//   1. `guessFloor(5, 4)` is 0.80 and not 1 — with four attempts on five options ONE is left to eliminate, and one fails
//      with 1/5. The expectation was wrong and the module right; the attempts ceiling became `alternativas` (certainty
//      there) instead of `alternativas − 1`.
//   2. the `historico` helper stacked the failures AT THE END, so any fixture with four or more fired the in-a-row rule
//      before the window was looked at — three cases failed measuring the wrong rule for the wrong reason. The failures
//      are interleaved now, and a `[Zero]` case makes sure no fixture hides a run again.
