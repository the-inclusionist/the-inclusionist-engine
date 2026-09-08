// SPDX-License-Identifier: AGPL-3.0-or-later
// educational/segment-bar — A BARRA DE DEZ SEGMENTOS do ADR-0049 §5 (issue #93), e ela não decide nada.
//
// ========================= A BARRA NÃO PODE CONTAR, E ISSO É ESTRUTURAL =========================
// A leitura literal da issue #93 produz um módulo com contadores próprios: «oito azuis → roxa, cinco
// vermelhos → laranja». Escrevê-lo assim seria pôr no repositório uma SEGUNDA implementação de uma decisão
// que já existe no `faixaDe` do motor adaptativo:
//
//   · «oito azuis sobem»            é o `ALVO_DE_SUBIDA = 0.8` — 8 de primeira em 10;
//   · «quatro vermelhos seguidos»   é o `FALHAS_SEGUIDAS_QUE_DESCEM = 4`;
//   · «cinco vermelhos espalhados»  é `resolvidas <= piso` — 5 falhadas em 10 dá 0,50, abaixo do piso 0,60.
//
// O próprio ADR-0049 diz isto em voz alta: «That is what makes every number in ADR-0048 §5 line up.»
//
// ⚠️ E AS DUAS CÓPIAS JÁ DISCORDARIAM HOJE, o que torna isto um defeito e não um gosto: «cinco espalhados»
// só é o limiar quando o piso é 0,60, e o piso é PARÂMETRO — sai do número de alternativas da questão
// (`pisoDoChute`). Num item de verdadeiro-ou-falso o piso é muito mais alto e menos falhas já bastam; a
// barra escrita com o «cinco» literal continuaria a mostrar verde a uma criança que o motor já teria descido.
//
// ⚠️ POR ISSO O VEREDICTO ENTRA PRONTO, e é a arquitectura que o obriga em vez de a disciplina. O `educational/`
// não importa NADA — nem os seus vizinhos (ADR-0032; a camada é DADO e viaja sozinha para o
// `the-inclusionist-knowledge-tree` do ADR-0058). Este módulo não tem, portanto, como chamar o `faixaDe`; e
// como também não recebe o `piso`, não tem sequer os números com que recalcular a regra. Ele SÓ pode
// projectar o que lhe deram. Um gate consegue afirmar que duas implementações concordam; esta forma torna a
// segunda implementação impossível de escrever aqui dentro.
//
// ========================= E ELA NÃO GUARDA NADA (ADR-0103) =========================
// ⚠️ Este módulo não persiste e não pode vir a persistir. O ADR-0103 decidiu que a barra não vive em lado
// nenhum — nem engine, nem cartucho, nem Bússola Escolar — e a razão é PEDAGÓGICA antes de jurídica: o
// desenvolvimento oscila, a criança joga uma dada actividade talvez uma vez por semana, e um histórico
// guardado achata a oscilação numa linha de tendência que lê um recuo normal como regressão. O argumento
// jurídico permitiria guardar assim que a controladoria estivesse resolvida; este não permite nunca. Os dois
// gates que o §confirmation daquele registo deixou em dívida são `tests/segment-bar.node.test.js` e
// `tests/no-stored-history.node.test.js`.
//
// «Permanente» no ADR-0049 §5 quer dizer PERMANENTE ENTRE ACTIVIDADES DA MESMA SESSÃO — a actividade é o
// veículo, a barra é a leitura da criança numa árvore de habilidade, e uma árvore sobrevive a uma
// actividade. Não quer dizer permanente entre dias.

/**
 * O que sobra de uma questão depois de as tentativas dela colapsarem.
 *
 * ⚠️ DECLARADO AQUI, e não importado do `adaptive-engine`, porque a camada não importa nada. As duas uniões
 * são estruturalmente idênticas — em TypeScript isso basta para o valor de um atravessar para o outro sem
 * conversão — e o caso `[Interface]` do gate afirma que continuam idênticas. Se alguém acrescentar um quarto
 * resultado ao motor e esquecer este ficheiro, é lá que se descobre.
 */
export type Resultado = 'primeira' | 'mediada' | 'falhou';

/** A cor de UM segmento. Uma questão, nunca uma tentativa. */
export type Segmento =
  | 'azul'      // certo de primeira — desempenho sem apoio
  | 'verde'     // certo numa tentativa posterior — desempenho com mediação
  | 'vermelho'; // falhou: a TERCEIRA tentativa também errou

/**
 * A cor da barra INTEIRA, que é o veredicto do motor adaptativo a ficar visível.
 *
 * `nenhuma` não é «apagada» — é a barra a mostrar os seus segmentos, que é o estado normal. Laranja e roxa
 * cobrem-nos porque são a única coisa que interessa naquele instante.
 */
export type CorDaBarra = 'nenhuma' | 'laranja' | 'roxa';

/**
 * O VEREDICTO, visto daqui: a fatia mínima do que o `faixaDe` devolve.
 *
 * Só `efeito` e `motivo`, e nem sequer a `faixa` — a barra não precisa de saber que a criança está «na zona»,
 * precisa de saber se subiu, desceu ou ficou. `motivo` existe para o anúncio ao leitor de tela poder dizer a
 * RAZÃO: «desceu porque quatro seguidas» é informação; «ficou laranja» é decoração.
 */
export interface VeredictoLido {
  readonly efeito: -1 | 0 | 1;
  readonly motivo: string;
}

/**
 * Quantos segmentos a barra tem.
 *
 * Dez, e tem de ser a mesma `JANELA` que o motor adaptativo julga: uma barra que mostrasse doze questões
 * enquanto o motor julga dez estaria a mostrar duas que não contam para o veredicto que a colore. O gate
 * afirma a igualdade, porque este ficheiro não pode importar a constante.
 */
export const SEGMENTOS_DA_BARRA = 10;

/** Uma barra pronta a desenhar. Tudo aqui é derivado; não há nada para mutar. */
export interface Barra {
  /** A árvore de habilidade desta barra. O ADR-0049 §5 manda uma barra POR habilidade, de uma a três, e o
   *  segmento cai na barra da habilidade que a questão exercitou — sem isto, duas habilidades ligadas ao
   *  mesmo tempo partilhariam um histórico e as faixas mediriam a média de duas crianças diferentes. */
  readonly skill: string;
  /** Os segmentos, do mais ANTIGO para o mais novo, no máximo `SEGMENTOS_DA_BARRA`. Menos do que isso no
   *  começo da sessão: a barra enche-se, e não nasce cheia de espaços que pareçam erros. */
  readonly segmentos: readonly Segmento[];
  readonly cor: CorDaBarra;
  /** O veredicto que produziu a cor, tal como entrou. */
  readonly veredicto: VeredictoLido;
}

/**
 * Um resultado de questão vira uma cor. É a tradução inteira, e é 1 para 1 de propósito.
 *
 * ⚠️ UMA QUESTÃO, NUNCA UMA TENTATIVA. Duas tentativas erradas não são um erro — são a tolerância; o
 * segmento só fica vermelho depois da terceira. O `resultadoDaQuestao` do motor é quem faz esse colapso, e é
 * por isso que esta função recebe o resultado e não o número de tentativas: se recebesse tentativas, uma
 * questão difícil pintaria três vermelhos e desceria de nível uma criança que estava apenas a pensar.
 */
export function corDoSegmento(r: Resultado): Segmento {
  return r === 'primeira' ? 'azul' : r === 'mediada' ? 'verde' : 'vermelho';
}

/** O que se sabe além do histórico e do veredicto. */
export interface Contexto {
  /**
   * ⚠️ A CRIANÇA CHEGOU A COPIAR A RESPOSTA (ADR-0049): falhou as três tentativas, falhou as três da
   * explicação, e a resposta apareceu para ela copiar. Aí «o nível desce IMEDIATAMENTE, sem esperar por
   * quatro questões falhadas — a barra fica laranja de uma vez».
   *
   * É a única entrada que não vem do histórico nem do veredicto, e tem de existir separada porque o
   * histórico não a distingue: copiar a resposta produz um `'falhou'` igual ao de quem errou três vezes e
   * seguiu em frente. A diferença entre as duas é pedagógica, e é ela que decide se o nível desce agora ou
   * daqui a três questões.
   */
  readonly copiouAResposta?: boolean;
}

/**
 * A barra de uma habilidade: o histórico dela, colorido pelo veredicto que o motor já emitiu.
 *
 * ⚠️ O HISTÓRICO É O DA HABILIDADE, não o da sessão, e o veredicto tem de ser o DAQUELE histórico. Passar
 * aqui o histórico misturado de duas habilidades é o defeito que o ADR-0049 §5 nomeia: as faixas passariam a
 * medir a média de duas crianças diferentes. Quem chama separa; este módulo não tem como saber que não
 * separou — nem tem como julgar, que é precisamente o ponto.
 */
export function barraDe(
  skill: string,
  historico: readonly Resultado[],
  veredicto: VeredictoLido,
  ctx: Contexto = {},
): Barra {
  const segmentos = historico.slice(-SEGMENTOS_DA_BARRA).map(corDoSegmento);
  // A rendição vence o veredicto porque ela É uma descida, decidida antes e por outro caminho. Escrevê-la
  // como `|| efeito < 0` em vez de a testar primeiro daria o mesmo resultado hoje e mentiria sobre a ordem.
  const cor: CorDaBarra = ctx.copiouAResposta ? 'laranja'
    : veredicto.efeito > 0 ? 'roxa'
      : veredicto.efeito < 0 ? 'laranja' : 'nenhuma';
  return { skill, segmentos, cor, veredicto };
}

/**
 * O histórico DEPOIS de a barra ter sinalizado — porque «sobe» leva consigo «e a contagem zera».
 *
 * ⚠️ O ZERAR ESTÁ ESCRITO PARA O ROXO E INFERIDO PARA O LARANJA, e a inferência fica declarada aqui em vez de
 * escondida no código. O ADR-0049 §5 diz «ALL PURPLE — eight blues: the level rises, AND THE COUNT RESETS», e
 * não diz nada equivalente para o laranja. Mas não zerar no laranja não é neutro: os quatro vermelhos
 * continuariam na janela e a barra voltaria a mandar descer a CADA questão nova, até eles rolarem para fora
 * — quatro descidas de nível onde a decisão foi uma. Um registo que manda descer de nível não pode, pelo
 * mesmo facto, mandar descer quatro vezes.
 *
 * Fica como pergunta para o Dev; enquanto ele não a responder, esta é a leitura que não produz um defeito.
 */
export function aposSinalizar(
  historico: readonly Resultado[],
  barra: Barra,
): readonly Resultado[] {
  return barra.cor === 'nenhuma' ? historico : [];
}
