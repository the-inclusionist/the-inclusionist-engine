// SPDX-License-Identifier: AGPL-3.0-or-later
// render/viz-refusal — POR QUE A SIMULAÇÃO NÃO ESTÁ DISPONÍVEL, dito à criança (ADR-0076, issue #104).
//
// ========================= O QUE A RECUSA TEM DE FAZER, E O QUE ELA NÃO PODE FAZER =========================
// O ADR-0076 exige que uma simulação indisponível apareça **VISÍVEL e explicada** — «never silently removed,
// never accepted then ignored». As duas metades dessa frase descrevem dois defeitos diferentes:
//
//   · REMOVER EM SILÊNCIO ensina que a coisa não existe. Um adulto que ontem mostrou a simulação a uma turma
//     e hoje não a acha conclui que ela foi tirada, e não que ele próprio ligou o alto contraste.
//   · ACEITAR E IGNORAR é pior: a demonstração PARECE estar a correr. Sobre uma tela já corrigida, ela não
//     mostra nem a deficiência nem a correção; sobre um tema de alto contraste, mostra o que o TEMA faz e não
//     o que a deuteranopia faz. ⚠️ Não é uma demonstração mais fraca — **ela ensina uma coisa falsa**.
//
// ⚠️ E O MOTIVO É UM FACTO SOBRE A DEMONSTRAÇÃO, NUNCA UMA REPREENSÃO A QUEM ESCOLHEU. Quem ligou o alto
// contraste ligou-o porque precisa; quem ligou a correção de cor vê melhor com ela. A frase diz o que a
// demonstração precisa para ser honesta, e diz como voltar — nunca «desligue isso».
//
// ========================= POR QUE ISTO É UM MÓDULO PURO =========================
// Mesma forma do `ui/reach-notice`: devolve DADO (chave i18n + parâmetros), não texto pronto. A frase é da
// interface e tem de passar por `t()`; devolver português daqui repetiria o defeito que o `PADWIZ_STEPS` já
// deixou de cometer. E, sendo puro, o desenho da recusa é conferível no project `node`, sem documento.
//
// Módulo-folha: importa só os tipos e o predicado do modelo de dois eixos.
import { simulationUnavailable, type UnavailableReason, type VisualState } from './viz-axes.js';

/** Uma linha pronta a traduzir: a chave e o que ela precisa. `null` = não há nada a dizer. */
export interface Refusal {
  readonly chave: string;
  /** O que a criança tem de desfazer para a demonstração ser honesta. Entra na frase por `{eixo}`. */
  readonly eixo: UnavailableReason;
}

/**
 * A chave i18n do motivo, por eixo fora do padrão.
 *
 * ⚠️ TRÊS CHAVES E NÃO UMA COM PARÂMETRO, e a diferença é de tradução e não de estilo: em português «o tema»
 * e «a correção de cor» levam artigos diferentes, e «os dois» não é o plural de nenhum dos dois. Uma frase
 * com `{eixo}` obrigaria cada idioma a montar concordância a partir de um substantivo solto — que é
 * exactamente o defeito que o `sr.nav.clockOne` já registou para «às 1 horas».
 */
export const REASON_KEY: Readonly<Record<UnavailableReason, string>> = Object.freeze({
  tema: 'sim.indisponivel.tema',
  correcao: 'sim.indisponivel.correcao',
  ambos: 'sim.indisponivel.ambos',
});

/**
 * Esta simulação pode ser oferecida? E se não, o que dizer.
 *
 * `null` = pode; a interface não mostra nada, porque um aviso que aparece sempre deixa de ser lido.
 */
export function simulationRefusal(v: VisualState): Refusal | null {
  const motivo = simulationUnavailable(v);
  return motivo === null ? null : { chave: REASON_KEY[motivo], eixo: motivo };
}

/**
 * A simulação deve aparecer DESABILITADA em vez de sumir?
 *
 * ⚠️ SEMPRE, E É A METADE «never silently removed» DO ADR-0076. Existe como função com nome próprio, e não
 * como um `!recusa` no ponto de uso, porque ela responde a uma pergunta diferente: `simulationRefusal` diz
 * *por que* não dá; esta diz *que a linha continua na tela*. Quem desenha precisa das duas, e juntá-las numa
 * só faria a resposta «não há motivo» parecer «não desenhe a linha».
 */
export function showsEvenWhenUnavailable(): boolean {
  return true;
}
