// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TEN-SEGMENT BAR DECIDES NOTHING — it shows the adaptive engine's verdict (#93, ADR-0049 §5).
//
// ========================= WHAT THESE CASES PROTECT =========================
// The literal reading of the issue («8 azuis sobem, 4 vermelhos seguidos ou 5 espalhados descem») produces a second
// implementation of a decision that already lives in `bandOf`. The architecture prevents it — `educational/` imports
// nothing, so the bar cannot reach `bandOf` or the floor —, and these cases assert that the projection that is left is
// faithful. The FLOOR case is the one proving a copy would already be wrong today.
//
// ⚠️ THIS FILE IS THE TEST AND MAY IMPORT BOTH, which is exactly what the module may not. That is why the joining
// cases — the two result unions, and the window — live here: they are the seam between two modules that, by layer
// decision, do not know each other.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import {
  barOf, corDoSegmento, afterSignalling, BAR_SEGMENTS,
} from '../app/js/educational/segment-bar.js';
import {
  bandOf, resultadoDaQuestao, WINDOW, LEVEL_UP_TARGET, MISSES_IN_A_ROW_THAT_DROP,
} from '../app/js/educational/adaptive-engine.js';

const PISO5 = 0.6; // the guessing floor of a five-option question — ADR-0048's case
const rep = (r, n) => Array.from({ length: n }, () => r);
// THE SEAM, in one place: the caller runs the engine and hands over the verdict. The bar has no way to do it.
const barra = (hist, over = {}) =>
  barOf('mat.fracoes', hist, bandOf(hist, over.piso ?? PISO5), over);

describe('educational/segment-bar · a cor de um segmento é UMA QUESTÃO, nunca uma tentativa', () => {
  it('[Right] primeira→azul, mediada→verde, falhou→vermelho', () => {
    expect(corDoSegmento('primeira')).toBe('azul');
    expect(corDoSegmento('mediada')).toBe('verde');
    expect(corDoSegmento('falhou')).toBe('vermelho');
  });

  it('[Boundary] a barra mostra as ÚLTIMAS dez, da mais antiga para a mais nova', () => {
    const hist = [...rep('falhou', 4), ...rep('primeira', 10)];
    const b = barra(hist);
    expect(b.segmentos.length).toBe(BAR_SEGMENTS);
    expect(b.segmentos.every((s) => s === 'azul'), 'as falhas velhas não saíram da janela').toBe(true);
  });

  it('[Zero] no começo da sessão ela está PARCIAL, e não cheia de espaços que pareçam erro', () => {
    const b = barra(['primeira', 'mediada']);
    expect(b.segmentos).toEqual(['azul', 'verde']);
    expect(b.cor, 'julgou com dois pontos de dados').toBe('nenhuma');
    expect(b.veredicto.motivo).toBe('janela-incompleta');
  });
});

describe('educational/segment-bar · a cor da BARRA é o veredicto, e não uma segunda contagem', () => {
  it('⚠️ [Interface] a barra NUNCA discorda do `faixaDe` — em cem histórias sorteadas deterministicamente', () => {
    // If someone puts counters of their own inside the module — using the segments, which it has — they will agree
    // with the engine in some cases and not in all, and this is where the divergence shows up.
    const RES = ['primeira', 'mediada', 'falhou'];
    let semente = 7;
    const prox = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let n = 0; n < 100; n++) {
      const hist = Array.from({ length: 1 + Math.floor(prox() * 20) }, () => RES[Math.floor(prox() * 3)]);
      const b = barra(hist);
      const esperada = bandOf(hist, PISO5).efeito;
      const dita = b.cor === 'roxa' ? 1 : b.cor === 'laranja' ? -1 : 0;
      expect(dita, `a barra disse ${b.cor} e o motor disse ${esperada} em [${hist.join(',')}]`).toBe(esperada);
    }
  });

  it('⚠️ [Interface] o PISO manda, e é por isso que «cinco vermelhos» não pode estar escrito na barra', () => {
    // Five failed out of ten gives `resolvidas = 0.50`. With a 0.60 floor (five options) that DROPS. With the floor of a
    // true-or-false question, much higher, FEWER failures already suffice — and a bar with a literal «cinco» would keep
    // showing green to a child the engine would already have dropped.
    const cincoEspalhadas = ['falhou', 'primeira', 'falhou', 'mediada', 'falhou', 'primeira', 'falhou', 'mediada', 'falhou', 'primeira'];
    expect(barra(cincoEspalhadas).cor).toBe('laranja');

    // FOUR failed out of ten: 0.60 solved. With a 0.60 floor the cut is `<=`, so it drops too.
    const quatro = ['falhou', 'primeira', 'falhou', 'mediada', 'falhou', 'primeira', 'falhou', 'mediada', 'primeira', 'mediada'];
    expect(barra(quatro, { piso: PISO5 }).cor, 'o `<=` do piso virou `<`').toBe('laranja');
    // And with a lower floor the SAME story does not drop. A bar counting reds would not see this.
    expect(barra(quatro, { piso: 0.3 }).cor, 'a barra ignorou o piso — está a contar sozinha').toBe('nenhuma');
  });

  it('[Right] oito de primeira em dez sobem, e é o `LEVEL_UP_TARGET` que o diz', () => {
    const oito = [...rep('primeira', 8), 'mediada', 'mediada'];
    expect(oito.filter((r) => r === 'primeira').length / WINDOW).toBeGreaterThanOrEqual(LEVEL_UP_TARGET);
    expect(barra(oito).cor).toBe('roxa');
    expect(barra(oito).veredicto.motivo).toBe('acertos-de-primeira');
  });

  it('[Right] quatro falhas SEGUIDAS descem na hora, mesmo sem a janela cheia', () => {
    const b = barra(rep('falhou', MISSES_IN_A_ROW_THAT_DROP));
    expect(b.cor).toBe('laranja');
    expect(b.veredicto.motivo).toBe('quatro-seguidas');
  });

  it('⚠️ [Interface] COPIAR A RESPOSTA fica laranja de imediato, sem esperar por quatro falhadas', () => {
    // ADR-0049: once the three attempts and the three of the explanation have failed, the answer appears to be copied
    // and «o nível desce imediatamente». The history does not tell that apart from any `falhou` — only the separate
    // input does —, and that is why it exists.
    const uma = ['falhou'];
    expect(barra(uma).cor, 'uma falha sozinha não desce nível nenhum').toBe('nenhuma');
    expect(barra(uma, { copiouAResposta: true }).cor).toBe('laranja');
  });
});

describe('educational/segment-bar · o que ela NÃO faz', () => {
  it('⚠️ [Interface] o módulo não importa NADA — nem armazenamento, nem o motor que o colore', async () => {
    // Two debts in one case. ADR-0103's (the bar does not persist; the reason is pedagogical before it is legal, and a
    // stored history would read a normal step back as regression under any controller) and ADR-0032's (the curriculum
    // is DATA and travels alone). It is the second that makes the first cheap to guarantee: a module that imports
    // nothing has no way to reach `localStorage`.
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../app/js/educational/segment-bar.ts', import.meta.url), 'utf8');
    const importa = [...src.matchAll(/^\s*import[\s(]/gm)].map((m) => m[0]);
    expect(importa, 'o currículo passou a depender de código — ver ADR-0032').toEqual([]);
    expect(/localStorage|sessionStorage|indexedDB|platform\/storage/.test(src), 'a barra tocou em armazenamento').toBe(false);
  });

  it('⚠️ [Interface] as duas uniões de RESULTADO continuam idênticas, apesar de os módulos não se conhecerem', () => {
    // The price of the layer importing nothing: `Resultado` is declared in both files. In TypeScript two structurally
    // equal unions pass into each other with no conversion — and with nobody warning when they stop being equal. This
    // case is the warning. If the engine gains a fourth result, it lands here instead of the bar painting it red by
    // omission.
    const doMotor = [resultadoDaQuestao(1), resultadoDaQuestao(3), resultadoDaQuestao(null)];
    expect(new Set(doMotor)).toEqual(new Set(['primeira', 'mediada', 'falhou']));
    for (const r of doMotor) {
      expect(['azul', 'verde', 'vermelho'], `o motor devolve «${r}» e a barra não sabe pintá-lo`)
        .toContain(corDoSegmento(r));
    }
  });

  it('[Right] sinalizar ZERA a contagem; não sinalizar deixa o histórico intacto', () => {
    const oito = [...rep('primeira', 8), 'mediada', 'mediada'];
    expect(afterSignalling(oito, barra(oito))).toEqual([]);
    const quatro = rep('falhou', MISSES_IN_A_ROW_THAT_DROP);
    expect(afterSignalling(quatro, barra(quatro)), 'o laranja não zerou: desceria de nível a cada questão nova').toEqual([]);
    const meio = ['primeira', 'mediada', 'falhou'];
    expect(afterSignalling(meio, barra(meio))).toBe(meio);
  });

  it('[Interface] a barra tem tantos segmentos quanto a JANELA que o motor julga', () => {
    // A bar of twelve would show two questions the verdict did not look at.
    expect(BAR_SEGMENTS).toBe(WINDOW);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · ⚠️ THE BAR COUNTING ON ITS OWN AGAIN — replacing the verdict with `vermelhos >= 5 ? laranja : azuis >= 8 ?
//     roxa`, which is literally what issue #93 says — FOUR fail: "NUNCA discorda do faixaDe" (in the hundred stories),
//     "o PISO manda", "quatro falhas SEGUIDAS" (the copy only looks at the window, and there is no full window) and
//     the reset. It is the most important mutation of the file: it is the implementation a literal reading of the
//     issue produces, and it disagrees with the engine on four fronts.
//   · removing `ctx.copiouAResposta` from the start of the expression → fails "COPIAR A RESPOSTA fica laranja de
//     imediato". The level would only drop three questions later, when ADR-0049 says «sem esperar».
//   · making `afterSignalling` reset only on purple → fails the reset case. The four reds would stay in the window and
//     the bar would call for a drop at EVERY new question — four drops where the decision was one.
//   · `BAR_SEGMENTS` from 10 to 12 → TWO fail: the bar would show two questions the verdict did not look at.
//   · `mediada` returning `azul` → TWO fail. Mediation would look like unsupported performance, which is precisely the
//     distinction ADR-0048 §5 uses to judge.
//   · adding `import * as store from '../platform/storage.js'` → THREE fail, in TWO files: the ADR-0103 case here, and
//     the two `engine-boundary` cases that say the curriculum imports nothing. That is what makes the ban on persisting
//     cheap: a module with no imports cannot reach localStorage.
