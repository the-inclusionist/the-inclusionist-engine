// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/vozes-prontas.ts — A PONTE ENTRE O QUE DESCEU E O QUE A CRIANÇA OUVE (ADR-0110, gates 3 e 4).
//
// ========================= POR QUE ESTE MÓDULO EXISTE =========================
// 📏 MEDIDO EM 2026-09-09: `vozEmUso` — a função que o ADR-0110 chama «o gate 3 em forma de código» — tinha
// ZERO leitores em produção, e NADA no repositório produzia um `EstadosDasVozes`. O buscador que nasceu hoje
// relata `RelatorioPesado[]`. São DUAS linguagens para o mesmo facto, e nenhuma falava com a outra.
//
// ⚠️ ISSO NÃO É UM ENCAIXE QUE FALTAVA, É A FORMA DE DEFEITO QUE ESTE REPOSITÓRIO PERSEGUE: um modelo aferido
// e correcto, sem ninguém a lê-lo, ao lado de um mecanismo que produz a mesma verdade noutro vocabulário. O
// `render/viz-axes` esteve exactamente assim — «é ÓRFÃO» — e o que isso custou foi a composição dos dois eixos
// visuais a existir no papel e não na tela.
//
// ========================= 🎯 A REGRA QUE ESTE MÓDULO CARREGA, E É UMA SÓ =========================
// **UMA VOZ SÓ ESTÁ PRONTA QUANDO OS DOIS FICHEIROS DESCERAM.** O piper recusa-se a falar sem o `.onnx.json`,
// então uma voz com o modelo e sem a configuração é uma voz que NÃO FALA — e marcá-la `pronta` faria a engine
// anunciar «voz neural» e ficar muda. É pior do que a voz em falta, porque a primeira parece resolvida, e é
// literalmente a família do `reflectTTS` que o ADR-0110 nomeia ao pedir o gate 3.
import { VOZES_NEURAIS, type EstadoDaVoz, type EstadosDasVozes, type VozNeural } from './voice-plan.js';
import type { RelatorioPesado } from './pesados.js';

/** As duas ids que o catálogo dá a uma voz. Derivadas, não tabeladas — a tabela vive no catálogo. */
const idsDe = (v: VozNeural): readonly [string, string] => [`voz:${v.voice}`, `voz:${v.voice}:cfg`];

/**
 * O ESTADO DE CADA VOZ A PARTIR DO QUE O BUSCADOR RELATOU.
 *
 * ⚠️ `emCurso` NÃO É COSMÉTICA, E É O QUE IMPEDE ESTA PONTE DE MENTIR NOS DOIS SENTIDOS. O relatório só
 * contém o que JÁ resolveu, logo uma voz por relatar é ambígua: pode estar a caminho ou nunca ter sido
 * pedida. O `voice-plan` recusa-se a confundir as duas por escrito — «ausente não se disfarça de a buscar»,
 * porque isso esconderia um buscador que nunca arrancou atrás de uma frase tranquilizadora — e a única coisa
 * que desfaz a ambiguidade é quem chamou saber se a descarga ainda corre.
 *
 * 📌 E o par contrário importa igualmente: com a descarga TERMINADA, uma voz por relatar é `ausente` e nunca
 * `a-buscar`, senão a interface prometeria para sempre uma coisa que já não vem.
 */
export function estadosDasVozes(
  relatorio: readonly RelatorioPesado[],
  opcoes: { readonly emCurso?: boolean } = {},
  catalogo: readonly VozNeural[] = VOZES_NEURAIS,
): EstadosDasVozes {
  const porId = new Map(relatorio.map((r) => [r.id, r]));
  const saida: Record<string, EstadoDaVoz> = {};

  for (const v of catalogo) {
    const partes = idsDe(v).map((id) => porId.get(id));
    if (partes.some((p) => p && (p.estado === 'falhou' || p.estado === 'sem-fonte'))) {
      // 📌 UMA METADE FALHADA CHEGA PARA A VOZ INTEIRA FALHAR, e é o mesmo argumento da regra do cabeçalho
      // visto do outro lado: sem os dois ficheiros não há fala nenhuma, logo não há meia voz para oferecer.
      saida[v.voice] = 'falhou';
      continue;
    }
    if (partes.every((p) => p && (p.estado === 'baixado' || p.estado === 'ja-tinha'))) {
      saida[v.voice] = 'pronta';
      continue;
    }
    saida[v.voice] = opcoes.emCurso ? 'a-buscar' : 'ausente';
  }
  return Object.freeze(saida);
}

/**
 * AS IDS DAS COISAS PESADAS QUE SÃO VOZ — para quem queira descê-las primeiro, sem adivinhar o formato da id.
 *
 * ⚠️ Existe porque a alternativa é o consumidor escrever `p.id.startsWith('voz:')` no ponto de uso, e aí o
 * formato da id passa a ser contrato público sem nunca ter sido decidido como tal.
 */
export const idsDasVozes = (catalogo: readonly VozNeural[] = VOZES_NEURAIS): string[] =>
  catalogo.flatMap((v) => [...idsDe(v)]);

/** Reexportado para quem faz a ponte não ter de importar de dois sítios para responder a uma pergunta. */
export { vozEmUso, estadoDe } from './voice-plan.js';
export type { VozEmUso, EstadosDasVozes } from './voice-plan.js';
