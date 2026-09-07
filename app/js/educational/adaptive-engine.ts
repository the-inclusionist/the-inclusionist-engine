// SPDX-License-Identifier: AGPL-3.0-or-later
// educational/adaptive-engine — AS TRÊS FAIXAS, e as DUAS medidas que hoje viram uma (ADR-0048 §5/§6, #92).
//
// ========================= O DEFEITO QUE ISTO EXISTE PARA NÃO REPETIR =========================
// Uma atividade com retentativa produz DUAS informações por questão e o jogo guarda uma: se acertou. A que se
// perde é a que importa mais — **acertou de primeira** ou **acertou com apoio**. Sem essa distinção não há
// zona de desenvolvimento proximal; há só dificuldade, que é uma escada sem corrimão.
//
// A retentativa É o apoio graduado. Uma criança que acerta na terceira está a aprender COM mediação, e é
// exactamente essa a faixa em que se quer que ela fique. Deitar fora o número da tentativa transforma-a numa
// criança «que acertou», indistinguível de quem acertou sozinha — e o motor sobe o nível dela.
//
// ========================= POR QUE A PROFICIÊNCIA É 8/10 DE PRIMEIRA =========================
// A aritmética é o argumento inteiro, e por isso está presa por teste em vez de comentada:
//
//   · Chutar com 3 tentativas em 5 alternativas acerta em 60% das questões: 1 − (4/5 · 3/4 · 2/3) = 0,60.
//     ⚠️ É POR ISSO que a proficiência lê acertos DE PRIMEIRA e não questões resolvidas: «8 de 10 resolvidas»
//     é praticamente o que o chute puro produz, e promoveria por sorte.
//   · Falhar QUATRO questões seguidas tem 0,40⁴ = 0,0256 de probabilidade — abaixo do corte de 5%. É por isso
//     que quatro seguidas descem o nível na hora, sem esperar a janela fechar.
//
// ⚠️ A UNIDADE É A QUESTÃO, NUNCA A TENTATIVA, e confundi-las é o defeito caro: quatro tentativas erradas
// acontecem dentro de UMA questão difícil e são normais; quatro QUESTÕES falhadas é o evento de 2,56%.
// `resultadoDaQuestao` existe para que as tentativas colapsem numa questão ANTES de a faixa as ver — a
// distinção é estrutural, e não uma regra que alguém tenha de lembrar.
//
// ========================= O QUE ESTE FICHEIRO NÃO FAZ =========================
// Não guarda nada. Recebe a lista de resultados e devolve a faixa — onde vive o histórico por habilidade está
// indecidido (ADR-0049 §5 diz, textualmente, que «a casa da barra está indecidida», e o ADR-0048 §6c manda-o
// para um sistema que ainda não existe em repositório nenhum). A função pura constrói-se hoje; a persistência
// não, e escrevê-la aqui seria decidir por omissão o que dois registos aceites deixaram em aberto.
//
// E não importa NADA, como toda a camada `educational/` (ADR-0032): ela é dado, e o gate de fronteira afere.

/** O que sobra de uma questão depois de as tentativas dela colapsarem. */
export type ResultadoDaQuestao =
  | 'primeira'   // certo na 1ª tentativa — desempenho SEM apoio
  | 'mediada'    // certo numa tentativa posterior — desempenho COM mediação (a retentativa é o apoio)
  | 'falhou';    // além da zona

/** A faixa em que a criança está, e o que ela manda fazer com o nível. */
export type Faixa = 'proficiente' | 'zona' | 'frustracao';

/** Por que a faixa é essa. Existe para o anúncio ao leitor de tela e para a barra do ADR-0049 poderem dizer
 *  a razão em vez de só o resultado — e para um teste poder distinguir duas faixas iguais por motivos
 *  diferentes, que é onde um motor adaptativo erra sem dar sinal. */
export type Motivo =
  | 'acertos-de-primeira'   // subiu: ≥ 80% de primeira
  | 'quatro-seguidas'       // desceu na hora: o evento de 2,56%
  | 'resolvidas-no-piso'    // desceu: as resolvidas não passam do que o chute produziria
  | 'dentro-da-zona'        // manteve: resolve com apoio
  | 'janela-incompleta';    // manteve: ainda não há questões que cheguem para julgar

export interface Veredicto {
  faixa: Faixa;
  motivo: Motivo;
  /** −1 desce, 0 mantém, +1 sobe. O ADR-0048 §5 chama a isto o efeito da faixa. */
  efeito: -1 | 0 | 1;
}

/** Quantas questões a janela olha. Dez é o número do registo. */
export const JANELA = 10;

/** A fração de acertos DE PRIMEIRA a partir da qual se sobe. 0,80 = 8 em 10, e vale para qualquer tipo. */
export const ALVO_DE_SUBIDA = 0.8;

/** Quantas QUESTÕES falhadas seguidas descem o nível na hora. Quatro, porque 0,40⁴ < 5%. */
export const FALHAS_SEGUIDAS_QUE_DESCEM = 4;

/**
 * O piso de chute de um tipo de questão: a fração de questões que a sorte pura resolve.
 *
 * Sorteio SEM reposição — quem erra uma alternativa não a volta a escolher —, então a chance de falhar as
 * `tentativas` todas é o produto de `(alternativas−1−i)/(alternativas−i)`, e o piso é o complemento.
 *
 * ⚠️ ELE É PARÂMETRO E NÃO CONSTANTE, e a issue #92 pede isso pelo nome: «o módulo recebe o piso como
 * parâmetro, não o embute». Uma atividade de duas alternativas tem piso 0,50 com uma tentativa; uma de dez
 * com uma tentativa tem 0,10. Embutir o 0,60 do caso de cinco faria o motor julgar todas as outras pela
 * aritmética da errada.
 */
export function pisoDeChute(alternativas: number, tentativas: number): number {
  if (!Number.isFinite(alternativas) || alternativas < 2) return 0;
  // O tecto é o número de ALTERNATIVAS, não uma a menos: com tantas tentativas quantas alternativas a
  // criança esgota todas as erradas e a certeza é 1. Pedir mais não pode passar disso.
  const t = Math.max(0, Math.min(Math.floor(tentativas), Math.floor(alternativas)));
  let falhaTudo = 1;
  for (let i = 0; i < t; i++) falhaTudo *= (alternativas - 1 - i) / (alternativas - i);
  return 1 - falhaTudo;
}

/**
 * As tentativas de UMA questão colapsam num resultado.
 *
 * `acertouNaTentativa` é 1-based; `null` quando a criança não acertou em nenhuma. É aqui que quatro tentativas
 * erradas deixam de poder ser confundidas com quatro questões falhadas: elas produzem UM `'falhou'`.
 */
export function resultadoDaQuestao(acertouNaTentativa: number | null): ResultadoDaQuestao {
  if (acertouNaTentativa === null || !Number.isFinite(acertouNaTentativa)) return 'falhou';
  return acertouNaTentativa <= 1 ? 'primeira' : 'mediada';
}

/** Quantas questões terminaram em falha, contadas do fim para trás até à primeira que não falhou. */
export function falhasSeguidas(historico: readonly ResultadoDaQuestao[]): number {
  let n = 0;
  for (let i = historico.length - 1; i >= 0 && historico[i] === 'falhou'; i--) n++;
  return n;
}

/**
 * A faixa da criança nesta habilidade, dado o histórico de questões e o piso de chute do tipo.
 *
 * A ORDEM DAS PERGUNTAS É A DECISÃO, e é esta:
 *
 *   1. QUATRO FALHAS SEGUIDAS descem na hora — antes de tudo, e mesmo com a janela incompleta. Não é um
 *      atalho: quatro questões falhadas seguidas é o evento de 2,56%, e ele não fica mais provável por a
 *      criança ter respondido poucas questões. Esperar a janela fechar seria deixá-la mais seis questões
 *      num nível que já se sabe alto.
 *   2. JANELA INCOMPLETA mantém. ⚠️ Esta regra NÃO está na issue #92 e é decisão minha, declarada: com três
 *      questões respondidas, «resolvidas ≤ piso» dispararia com duas falhas, e rebaixar uma criança por duas
 *      questões é exactamente o erro que a unidade-questão existe para evitar. A regra da janela pede dez
 *      questões porque é sobre dez que a aritmética foi feita.
 *   3. ≥ 80% DE PRIMEIRA sobe.
 *   4. RESOLVIDAS NO PISO OU ABAIXO descem.
 *   5. O resto é a zona, que é onde se quer estar.
 *
 * ⚠️ O CORTE DE BAIXO É `≤` E NÃO `<`, e a diferença é uma questão inteira: a tabela do registo diz «≤ 6 das
 * últimas 10», e 6/10 é exactamente o piso de 0,60 do caso de cinco alternativas. A prosa da mesma issue diz
 * «abaixo do piso», que é o resumo e não a regra. Quem seguir a prosa deixa a criança um nível acima com um
 * desempenho que o chute puro reproduz.
 */
export function faixaDe(
  historico: readonly ResultadoDaQuestao[],
  piso: number,
  janela: number = JANELA,
): Veredicto {
  if (falhasSeguidas(historico) >= FALHAS_SEGUIDAS_QUE_DESCEM) {
    return { faixa: 'frustracao', motivo: 'quatro-seguidas', efeito: -1 };
  }
  if (historico.length < janela) {
    return { faixa: 'zona', motivo: 'janela-incompleta', efeito: 0 };
  }

  const ultimas = historico.slice(-janela);
  const dePrimeira = ultimas.filter((r) => r === 'primeira').length / janela;
  const resolvidas = ultimas.filter((r) => r !== 'falhou').length / janela;

  if (dePrimeira >= ALVO_DE_SUBIDA) return { faixa: 'proficiente', motivo: 'acertos-de-primeira', efeito: 1 };
  if (resolvidas <= piso) return { faixa: 'frustracao', motivo: 'resolvidas-no-piso', efeito: -1 };
  return { faixa: 'zona', motivo: 'dentro-da-zona', efeito: 0 };
}
