// SPDX-License-Identifier: GPL-3.0-or-later
// ui/caa-sets.ts — O CATÁLOGO DA COMUNICAÇÃO AUMENTADA E ALTERNATIVA (ADR-0028). Módulo-folha: dados puros e
// dois predicados, zero DOM, zero I/O. Quem desenha o menu é ui/settings-caa; quem decide o que ele oferece
// é este arquivo, porque a decisão é de LICENÇA e não de interface.
//
// PARA QUEM ISTO EXISTE: há crianças que leem símbolos e não letras. Para elas, o pictograma não é um enfeite
// nem uma muleta — é a escrita. Um jogo educativo que só sabe exibir letras simplesmente não fala com elas.
//
// A REGRA QUE ORGANIZA A LISTA: a camada de cada conjunto é decidida pela LICENÇA DELE e por mais nada — não
// pela qualidade, não pelo tamanho, não pela facilidade de integrar. No instante em que um conjunto mudar de
// camada por outro motivo, este arquivo terá deixado de ser verdadeiro.
//
// `tier` é o FATO JURÍDICO (podemos redistribuir? é preciso baixar? falta permissão?). `disponivel` é o FATO
// DE HOJE (funciona nesta build?). São duas perguntas diferentes e o menu precisa das duas: a primeira diz
// quem tem de agir, a segunda diz o que a criança consegue escolher agora.
import { t } from '../core/i18n.js';

export type CaaTier =
  /** CC BY-SA ou nosso: pode viajar dentro do jogo, funciona sem rede nenhuma. */
  | 'bundled'
  /** A licença permite usar, não redistribuir: quem baixa é a pessoa, uma vez, e fica em cache. */
  | 'fetched'
  /** Falta permissão. Aparece no menu, não é escolhível. */
  | 'negotiating';

export interface CaaSet {
  readonly key: string;
  readonly nome: string;
  readonly tier: CaaTier;
  /** Licença como ela foi VERIFICADA, ou null quando ainda não há. Texto curto, para caber na tela. */
  readonly licenca: string | null;
  /** Funciona NESTA build? Hoje só as letras — os pictogramas são arquivos que ainda não vieram. */
  readonly disponivel: boolean;
  /** Só para pictogramas: uma linha sobre a origem, quando ela muda o que a escolha significa. */
  readonly nota?: string;
}

// AS LETRAS NÃO ESTÃO NESTA LISTA, e a ausência é decisão do Dev. Elas eram duas entradas — "maiúsculas e
// minúsculas" e "maiúsculas somente" — e viraram UM interruptor: "Letras maiúsculas", ligado ou desligado,
// com o desligado significando as duas caixas. Uma escolha binária apresentada como duas opções faz a criança
// comparar duas linhas para descobrir que são a mesma pergunta; um interruptor pergunta uma vez.
//
// Sobra aqui o que é de verdade uma LISTA: os conjuntos de pictogramas, entre os quais se escolhe um.
export const CAA_SETS: readonly CaaSet[] = [
  // --- PICTOGRAMAS que PODEM viajar com o jogo (CC BY-SA, verificado pelo Dev em 2026-08-24). ---
  { key: 'mulberry', nome: 'Mulberry Symbols', tier: 'bundled', licenca: 'CC BY-SA', disponivel: false },
  { key: 'blissymbolics', nome: 'Blissymbolics', tier: 'bundled', licenca: 'CC BY-SA 4.0', disponivel: false,
    nota: 'Escrita simbólica própria: os símbolos se combinam para formar sentidos novos.' },
  { key: 'tawasol', nome: 'Tawasol', tier: 'bundled', licenca: 'CC BY-SA 4.0', disponivel: false,
    nota: 'Desenhado na e para a cultura árabe. Um pictograma não é neutro — a criança reconhece mais depressa os objetos, as roupas e os rostos do próprio mundo.' },

  // --- PICTOGRAMA que precisa ser BAIXADO. ---
  { key: 'arasaac', nome: 'ARASAAC', tier: 'fetched', licenca: 'baixado à parte', disponivel: false },

  // --- AGUARDANDO NEGOCIAÇÃO. Ficam visíveis de propósito: ver `caaMotivo`. ---
  { key: 'sclera', nome: 'Sclera', tier: 'negotiating', licenca: null, disponivel: false },
  { key: 'pcs', nome: 'PCS', tier: 'negotiating', licenca: null, disponivel: false },
  { key: 'symbolstix', nome: 'SymbolStix', tier: 'negotiating', licenca: null, disponivel: false },
  { key: 'widgit', nome: 'Widgit Symbols', tier: 'negotiating', licenca: null, disponivel: false },
];

export const CAA_BY_KEY: Readonly<Record<string, CaaSet>> = Object.fromEntries(CAA_SETS.map((s) => [s.key, s]));

/** Quais CONJUNTOS a criança pode escolher hoje: nenhum. O menu não finge o contrário — os pictogramas são
 *  milhares de arquivos que ainda não entraram no repositório, e quatro deles dependem de negociação. */
export function caaDisponiveis(): CaaSet[] {
  return CAA_SETS.filter((s) => s.disponivel);
}

/**
 * Por que este conjunto não está disponível — chave i18n, nunca texto pronto.
 *
 * As duas respostas dizem coisas diferentes a quem lê, e é por isso que são duas: "em preparação" quer dizer
 * que a licença está resolvida e o trabalho é NOSSO; "aguardando negociação" quer dizer que a permissão é de
 * OUTRA PESSOA e nenhum esforço nosso a antecipa.
 *
 * E é por isso que os indisponíveis aparecem em vez de serem escondidos: são justamente os conjuntos que uma
 * escola brasileira tem mais chance de já usar em outro produto. O educador que procura PCS e não acha conclui
 * que o jogo não faz — quando o obstáculo é uma licença, não uma capacidade. Esconder responderia a pergunta
 * errada, e responderia errado.
 */
export function caaMotivo(s: CaaSet): string | null {
  if (s.disponivel) return null;
  return s.tier === 'negotiating' ? 'caa.aguardandoNegociacao' : 'caa.emPreparo';
}

/** Rótulo pronto para a linha do menu: nome + o motivo, quando há um. */
export function caaRotulo(s: CaaSet): string {
  const motivo = caaMotivo(s);
  return motivo ? `${s.nome} — ${t(motivo)}` : s.nome;
}
