// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/latch-refusal.ts — QUANDO A ALTERNÂNCIA NÃO É UMA ESCOLHA, e o que se diz a quem carregou no botão.
//
// ========================= A CLÁUSULA 3 DO ADR-0113 =========================
// «É impossível desligá-la em modos que não tem como funcionar sem ela (voz e câmera)» — a frase do Dev. Em
// olhos, rosto, gestos e fala a alternância é o que faz a entrada funcionar: sem ela, um comando de cada vez
// significa que a criança não consegue andar e agir.
//
// ⚠️ E O CONTROLE NÃO SOME — FICA DESABILITADO, COM O MOTIVO DITO. Sumir ensina que a coisa não existe: um
// adulto conclui que ela foi retirada, não que a webcam a exige. É a mesma metade «never silently removed»
// que o ADR-0076 escreveu para a simulação, e este ficheiro é o irmão do `ui/simulation-refusal` de propósito
// — mesma forma, mesmo lugar na camada, e portanto conferível no project `node`, sem documento.
//
// 🔴 E O MOTIVO É UM FACTO SOBRE O APARELHO, NUNCA UMA REPREENSÃO. «O controle por olhar precisa das teclas de
// alternância para funcionar» diz por que o botão não responde; «não desligue isto» repreende uma criança por
// mexer num ajuste de que ela depende. O ADR-0076 já pagou esta distinção uma vez, e a mutação que a apanhou
// trocava a frase por uma mais curta, mais clara e mais útil — que reprovava na mesma.
//
// Módulo-folha: importa só a regra pura da alternância.
import { latchIsOptional, ONE_COMMAND_AT_A_TIME } from '../input/latch-scope.js';

/** Uma linha pronta a traduzir. `null` = há escolha, e não há nada a dizer. */
export interface RecusaDaAlternancia {
  readonly chave: string;
  /** O transporte que a exige — fica disponível para quem quiser compor a frase de outro modo. */
  readonly transporte: string;
}

/**
 * A chave i18n do motivo, POR TRANSPORTE.
 *
 * ⚠️ QUATRO CHAVES E NÃO UMA COM `{aparelho}`, e a razão é de tradução e não de estilo: «os gestos» é plural
 * e «o olhar» não, logo uma frase única obrigaria cada idioma a montar concordância a partir de um
 * substantivo solto. É exactamente o defeito que o `sr.nav.clockOne` registou para «às 1 horas», e que o
 * `ui/simulation-refusal` já recusou pela mesma razão com os três eixos dele.
 */
export const CHAVE_DA_RECUSA: Readonly<Record<string, string>> = Object.freeze({
  olhos: 'alt.exigida.olhos',
  rosto: 'alt.exigida.rosto',
  gestos: 'alt.exigida.gestos',
  fala: 'alt.exigida.fala',
});

/**
 * A alternância pode ser desligada neste aparelho? E se não, o que dizer.
 *
 * `null` = pode; a interface não mostra nada, porque um aviso que aparece sempre deixa de ser lido.
 */
export function recusaDaAlternancia(transporte: string): RecusaDaAlternancia | null {
  if (latchIsOptional(transporte)) return null;
  const chave = CHAVE_DA_RECUSA[transporte];
  // 📌 Um transporte que exija alternância e não tenha frase seria um botão desabilitado SEM motivo — pior do
  // que o defeito que isto conserta, porque a criança deixa de saber sequer que há uma razão. O gate afirma
  // que os dois conjuntos coincidem; aqui a ausência degrada para «não recuso», que mantém o controle vivo.
  return chave ? { chave, transporte } : null;
}

/**
 * O controle continua NA TELA quando a alternância é exigida?
 *
 * ⚠️ SEMPRE, e é a metade «não some» da cláusula 3. Existe como função com nome próprio, e não como um
 * `!recusa` no ponto de uso, porque responde a outra pergunta: `recusaDaAlternancia` diz *por que* não dá;
 * esta diz *que a linha continua na tela*. Juntá-las faria «não há motivo» parecer «não desenhe a linha».
 */
export function mostraMesmoExigida(): boolean {
  return true;
}

/** Os transportes que exigem alternância, para quem precisa de os enumerar. Vem da REGRA, não de uma cópia. */
export const EXIGEM_ALTERNANCIA: ReadonlySet<string> = ONE_COMMAND_AT_A_TIME;
