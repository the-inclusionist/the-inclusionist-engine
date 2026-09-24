// SPDX-License-Identifier: AGPL-3.0-or-later
// input/pointer.ts — O QUE O JOGO RECEBE QUANDO PEDE UM PONTEIRO (ADR-0112), na metade PURA.
//
// ========================= O QUE ESTE MÓDULO É =========================
// Uma AMOSTRA de ponteiro e as perguntas que se fazem sobre ela. Sem DOM, sem tempo, sem eventos. Quem captura
// é `input/touch-bindings.wirePointerPad`, que a issue #105 mediu como já existindo inteiro; quem converte um
// ponto de tela é `input/pointer-space`, que também já existe. Falta o que fica ENTRE os dois: a forma que
// atravessa a fronteira até ao cartucho.
//
// ⚠️ E A AMOSTRA CARREGA A ORIGEM, porque o ADR-0111 diz que todo comando a carrega. Um traço feito com o
// olhar e um traço feito com o rato têm de ser distinguíveis pela engine — as regras de transporte assistido
// do ADR-0109 dependem de saber qual aparelho está em uso, e um desenho não é excepção.
//
// 📌 A ORIGEM É OBRIGATÓRIA AQUI, ao contrário do `sourceOf` das teclas, que devolve `undefined`. A diferença
// não é de rigor, é de estrutura: uma tecla entra num conjunto PARTILHADO onde qualquer código pode despachar
// um evento sintético, então «não sei» é uma resposta honesta. Uma amostra de ponteiro é construída PELO
// transporte que a produziu — ele sabe sempre o que é, porque é ele próprio.

import type { TransportName } from './transport-in-use.js';
import type { AsFraction } from './pointer-space.js';

/**
 * Onde o ponteiro está e o que ele está a fazer.
 *
 * `fx`/`fy` são fracção do elemento do jogo, na convenção do `pointer-space`: `0,0` é o canto superior
 * esquerdo e `1,1` o inferior direito. ⚠️ Podem sair de `0..1` — ver `isInside`.
 */
export interface PointerSample {
  readonly fx: number;
  readonly fy: number;
  /** Quem produziu esta amostra (ADR-0111). */
  readonly source: TransportName;
  /** A «caneta» está em baixo? Rato: botão premido. Toque: dedo em contacto. Olhar: permanência. */
  readonly pressed: boolean;
}

/** O repouso: centro da região, sem aperto, teclado — o mesmo padrão que o `transport-in-use` assume. */
export const PADRAO: PointerSample = Object.freeze({ fx: 0.5, fy: 0.5, source: 'teclado', pressed: false });

/**
 * A amostra está DENTRO da região do jogo?
 *
 * ⚠️ ESTA PERGUNTA EXISTE SEPARADA DA POSIÇÃO, e é a decisão inteira deste ficheiro. O `asFraction` não satura
 * de propósito («quem saturasse aqui não teria como voltar atrás»), e há duas coisas a jusante que precisam
 * de metades opostas dela:
 *
 *   · DESENHAR precisa da posição PRESA a `0..1`, senão o traço salta para fora da tela quando a mão
 *     ultrapassa a borda durante um arrasto capturado;
 *   · o MODO OLHOS 3 do ADR-0104 usa «olhar para fora da tela» como comando de navegação — para uma criança
 *     com ELA severa, olhar para cima FORA do écran é o gesto que abre a lista de acções.
 *
 * ⚠️ SATURAR SEM GUARDAR ESTA RESPOSTA MATARIA O SEGUNDO. É a mesma família de defeito que este repositório
 * já pagou várias vezes: uma informação deitada fora à porta, e o consumidor que dela dependia a descobrir
 * tarde que a pergunta já não tem resposta.
 */
export function isInside(f: AsFraction): boolean {
  return f.fx >= 0 && f.fx <= 1 && f.fy >= 0 && f.fy <= 1;
}

/**
 * A posição PRESA a `0..1`, para quem desenha.
 *
 * 📌 Devolve o MESMO objecto quando já está dentro, e não uma cópia. O ponteiro é amostrado a cada quadro, e
 * uma alocação por quadro num aparelho de escola é exactamente o tipo de custo que o pilar 1 recusa.
 */
export function clampInside(f: AsFraction): AsFraction {
  if (isInside(f)) return f;
  return { fx: Math.min(1, Math.max(0, f.fx)), fy: Math.min(1, Math.max(0, f.fy)) };
}

/** A borda do aperto entre duas amostras: a caneta desceu, subiu, ou nada mudou. */
export type PressEdge = 'desceu' | 'subiu' | null;

/**
 * Comparar duas amostras dá a BORDA, que é o que um jogo lê.
 *
 * ⚠️ A BORDA E NÃO O ESTADO, pela razão que o `padPrevAct` deste repositório já escreve para o gamepad: um
 * jogo que perguntasse «está apertado?» a cada quadro desenharia o mesmo ponto sessenta vezes, e um que
 * quisesse reagir ao clique teria de guardar o quadro anterior por sua conta — trezentas vezes.
 */
export function pressEdge(anterior: PointerSample, current: PointerSample): PressEdge {
  if (anterior.pressed === current.pressed) return null;
  return current.pressed ? 'desceu' : 'subiu';
}

/**
 * O TRANSPORTE MUDOU entre estas duas amostras?
 *
 * ⚠️ Existe porque o ADR-0109 faz da troca de aparelho um evento com consequência — a alternância segue o
 * aparelho em uso —, e um ponteiro é um dos sítios onde a troca acontece sem que nenhuma tecla seja premida:
 * a criança larga o rato e olha para a tela. Sem esta pergunta, a troca seria invisível até à próxima tecla.
 */
export function switchedTransport(anterior: PointerSample, current: PointerSample): boolean {
  return anterior.source !== current.source;
}
