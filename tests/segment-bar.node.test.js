// SPDX-License-Identifier: AGPL-3.0-or-later
// A BARRA DE DEZ SEGMENTOS NÃO DECIDE NADA — ela mostra o veredicto do motor adaptativo (#93, ADR-0049 §5).
//
// ========================= O QUE ESTES CASOS PROTEGEM =========================
// A leitura literal da issue («8 azuis sobem, 4 vermelhos seguidos ou 5 espalhados descem») produz uma
// segunda implementação de uma decisão que já vive no `faixaDe`. A arquitectura impede-a — o `educational/`
// não importa nada, logo a barra não alcança o `faixaDe` nem o `piso` —, e estes casos afirmam que a
// projecção que sobrou é fiel. O do PISO é o que prova que a cópia já estaria errada hoje.
//
// ⚠️ ESTE FICHEIRO É O TESTE E PODE IMPORTAR OS DOIS, que é justamente o que o módulo não pode. É por isso
// que os casos de junção — as duas uniões de resultado, e a janela — vivem aqui: são a costura entre dois
// módulos que, por decisão de camada, não se conhecem.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import {
  barraDe, corDoSegmento, aposSinalizar, SEGMENTOS_DA_BARRA,
} from '../app/js/educational/segment-bar.js';
import {
  faixaDe, resultadoDaQuestao, JANELA, ALVO_DE_SUBIDA, FALHAS_SEGUIDAS_QUE_DESCEM,
} from '../app/js/educational/adaptive-engine.js';

const PISO5 = 0.6; // o piso do chute de uma questão de cinco alternativas — o caso do ADR-0048
const rep = (r, n) => Array.from({ length: n }, () => r);
// A COSTURA, num sítio só: quem chama corre o motor e entrega o veredicto. A barra não tem como o fazer.
const barra = (hist, over = {}) =>
  barraDe('mat.fracoes', hist, faixaDe(hist, over.piso ?? PISO5), over);

describe('educational/segment-bar · a cor de um segmento é UMA QUESTÃO, nunca uma tentativa', () => {
  it('[Right] primeira→azul, mediada→verde, falhou→vermelho', () => {
    expect(corDoSegmento('primeira')).toBe('azul');
    expect(corDoSegmento('mediada')).toBe('verde');
    expect(corDoSegmento('falhou')).toBe('vermelho');
  });

  it('[Boundary] a barra mostra as ÚLTIMAS dez, da mais antiga para a mais nova', () => {
    const hist = [...rep('falhou', 4), ...rep('primeira', 10)];
    const b = barra(hist);
    expect(b.segmentos.length).toBe(SEGMENTOS_DA_BARRA);
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
    // Se alguém puser contadores próprios dentro do módulo — usando os segmentos, que ele tem — eles vão
    // coincidir com o motor em alguns casos e não em todos, e é aqui que a divergência aparece.
    const RES = ['primeira', 'mediada', 'falhou'];
    let semente = 7;
    const prox = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let n = 0; n < 100; n++) {
      const hist = Array.from({ length: 1 + Math.floor(prox() * 20) }, () => RES[Math.floor(prox() * 3)]);
      const b = barra(hist);
      const esperada = faixaDe(hist, PISO5).efeito;
      const dita = b.cor === 'roxa' ? 1 : b.cor === 'laranja' ? -1 : 0;
      expect(dita, `a barra disse ${b.cor} e o motor disse ${esperada} em [${hist.join(',')}]`).toBe(esperada);
    }
  });

  it('⚠️ [Interface] o PISO manda, e é por isso que «cinco vermelhos» não pode estar escrito na barra', () => {
    // Cinco falhadas em dez dá `resolvidas = 0,50`. Com piso 0,60 (cinco alternativas) isso DESCE. Com o piso
    // de uma questão de verdadeiro-ou-falso, muito mais alto, MENOS falhas já bastam — e uma barra com o
    // «cinco» literal continuaria a mostrar verde a uma criança que o motor já teria descido.
    const cincoEspalhadas = ['falhou', 'primeira', 'falhou', 'mediada', 'falhou', 'primeira', 'falhou', 'mediada', 'falhou', 'primeira'];
    expect(barra(cincoEspalhadas).cor).toBe('laranja');

    // QUATRO falhadas em dez: 0,60 de resolvidas. Com piso 0,60 o corte é `<=`, logo desce também.
    const quatro = ['falhou', 'primeira', 'falhou', 'mediada', 'falhou', 'primeira', 'falhou', 'mediada', 'primeira', 'mediada'];
    expect(barra(quatro, { piso: PISO5 }).cor, 'o `<=` do piso virou `<`').toBe('laranja');
    // E com um piso mais baixo a MESMA história não desce. Uma barra que contasse vermelhos não veria isto.
    expect(barra(quatro, { piso: 0.3 }).cor, 'a barra ignorou o piso — está a contar sozinha').toBe('nenhuma');
  });

  it('[Right] oito de primeira em dez sobem, e é o `ALVO_DE_SUBIDA` que o diz', () => {
    const oito = [...rep('primeira', 8), 'mediada', 'mediada'];
    expect(oito.filter((r) => r === 'primeira').length / JANELA).toBeGreaterThanOrEqual(ALVO_DE_SUBIDA);
    expect(barra(oito).cor).toBe('roxa');
    expect(barra(oito).veredicto.motivo).toBe('acertos-de-primeira');
  });

  it('[Right] quatro falhas SEGUIDAS descem na hora, mesmo sem a janela cheia', () => {
    const b = barra(rep('falhou', FALHAS_SEGUIDAS_QUE_DESCEM));
    expect(b.cor).toBe('laranja');
    expect(b.veredicto.motivo).toBe('quatro-seguidas');
  });

  it('⚠️ [Interface] COPIAR A RESPOSTA fica laranja de imediato, sem esperar por quatro falhadas', () => {
    // ADR-0049: falhadas as três tentativas e as três da explicação, a resposta aparece para copiar e «o
    // nível desce imediatamente». O histórico não distingue isso de um `falhou` qualquer — só a entrada
    // separada distingue —, e é por isso que ela existe.
    const uma = ['falhou'];
    expect(barra(uma).cor, 'uma falha sozinha não desce nível nenhum').toBe('nenhuma');
    expect(barra(uma, { copiouAResposta: true }).cor).toBe('laranja');
  });
});

describe('educational/segment-bar · o que ela NÃO faz', () => {
  it('⚠️ [Interface] o módulo não importa NADA — nem armazenamento, nem o motor que o colore', async () => {
    // Duas dívidas num caso só. A do ADR-0103 (a barra não persiste; a razão é pedagógica antes de jurídica,
    // e um histórico guardado leria um recuo normal como regressão sob qualquer controlador) e a do ADR-0032
    // (o currículo é DADO e viaja sozinho). É a segunda que faz a primeira barata de garantir: um módulo que
    // não importa nada não tem por onde alcançar o `localStorage`.
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../app/js/educational/segment-bar.ts', import.meta.url), 'utf8');
    const importa = [...src.matchAll(/^\s*import[\s(]/gm)].map((m) => m[0]);
    expect(importa, 'o currículo passou a depender de código — ver ADR-0032').toEqual([]);
    expect(/localStorage|sessionStorage|indexedDB|platform\/storage/.test(src), 'a barra tocou em armazenamento').toBe(false);
  });

  it('⚠️ [Interface] as duas uniões de RESULTADO continuam idênticas, apesar de os módulos não se conhecerem', () => {
    // O preço de a camada não importar nada: `Resultado` está declarado nos dois ficheiros. Em TypeScript
    // duas uniões estruturalmente iguais atravessam uma para a outra sem conversão — e sem ninguém a avisar
    // quando deixam de ser iguais. Este caso é o aviso. Se o motor ganhar um quarto resultado, ele cai aqui
    // em vez de a barra o pintar como vermelho por omissão.
    const doMotor = [resultadoDaQuestao(1), resultadoDaQuestao(3), resultadoDaQuestao(null)];
    expect(new Set(doMotor)).toEqual(new Set(['primeira', 'mediada', 'falhou']));
    for (const r of doMotor) {
      expect(['azul', 'verde', 'vermelho'], `o motor devolve «${r}» e a barra não sabe pintá-lo`)
        .toContain(corDoSegmento(r));
    }
  });

  it('[Right] sinalizar ZERA a contagem; não sinalizar deixa o histórico intacto', () => {
    const oito = [...rep('primeira', 8), 'mediada', 'mediada'];
    expect(aposSinalizar(oito, barra(oito))).toEqual([]);
    const quatro = rep('falhou', FALHAS_SEGUIDAS_QUE_DESCEM);
    expect(aposSinalizar(quatro, barra(quatro)), 'o laranja não zerou: desceria de nível a cada questão nova').toEqual([]);
    const meio = ['primeira', 'mediada', 'falhou'];
    expect(aposSinalizar(meio, barra(meio))).toBe(meio);
  });

  it('[Interface] a barra tem tantos segmentos quanto a JANELA que o motor julga', () => {
    // Uma barra de doze mostraria duas questões que o veredicto não olhou.
    expect(SEGMENTOS_DA_BARRA).toBe(JANELA);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · ⚠️ A BARRA VOLTA A CONTAR SOZINHA — trocando o veredicto por `vermelhos >= 5 ? laranja : azuis >= 8 ?
//     roxa`, que e literalmente o que a issue #93 diz — reprovam QUATRO: "NUNCA discorda do faixaDe" (nas
//     cem historias), "o PISO manda", "quatro falhas SEGUIDAS" (a copia so olha a janela, e nao ha janela
//     cheia) e o zerar. E a mutacao mais importante do ficheiro: e a implementacao que uma leitura literal
//     da issue produz, e ela discorda do motor em quatro frentes.
//   · tirando o `ctx.copiouAResposta` do inicio da expressao → reprova "COPIAR A RESPOSTA fica laranja de
//     imediato". O nivel desceria so tres questoes depois, quando o ADR-0049 diz «sem esperar».
//   · fazendo o `aposSinalizar` zerar so no roxo → reprova o caso do zerar. Os quatro vermelhos ficariam na
//     janela e a barra mandaria descer a CADA questao nova — quatro descidas onde a decisao foi uma.
//   · `SEGMENTOS_DA_BARRA` de 10 para 12 → reprovam DOIS: a barra mostraria duas questoes que o veredicto
//     nao olhou.
//   · `mediada` a devolver `azul` → reprovam DOIS. Mediacao passaria a parecer desempenho sem apoio, que e
//     precisamente a distincao que o ADR-0048 §5 usa para julgar.
//   · acrescentando `import * as store from '../platform/storage.js'` → reprovam TRES, e em DOIS ficheiros:
//     o caso do ADR-0103 aqui, e os dois casos do `engine-boundary` que dizem que o curriculo nao importa
//     nada. E o que torna a proibicao de persistir barata: um modulo sem imports nao alcanca o localStorage.
