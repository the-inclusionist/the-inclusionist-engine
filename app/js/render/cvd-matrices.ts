// SPDX-License-Identifier: AGPL-3.0-or-later
// render/cvd-matrices — as SEIS matrizes de daltonismo (3 SIMULAÇÕES Machado 2009 sev. 1.0 + 3 CORREÇÕES
// C = I + M_err·(I − Sim), M_err de Fidaner et al.), num só lugar. Módulo-folha: ZERO dependências.
//
// A DUPLICAÇÃO QUE ESTE MÓDULO CURA (a sétima do refactor). Os mesmos 120 números existiam escritos DUAS
// vezes, em linguagens diferentes:
//   · `<feColorMatrix values="…">` em app/index.html — caminho de TELA ÚNICA (`filter: url(#cvd-…)` na
//     <canvas>); render/viz-modes só guarda o `url(#cvd-deuter)`, nunca os números.
//   · `PIXI.ColorMatrixFilter` dentro de `pixiFilterFor` no game.js — caminho MULTI-TELA (filtro GPU por
//     viewport, um modo por jogador).
// Batiam por sorte: nada ligava as duas cópias. Se divergissem, o sintoma seria SILENCIOSO e de
// ACESSIBILIDADE — a MESMA pessoa daltônica veria cores diferentes em tela única e em multi-tela, sem erro,
// sem log, sem teste vermelho. Agora os dois caminhos leem daqui: `render/viewports` monta o
// ColorMatrixFilter com estes arrays, e `installCvdFilters()` GERA os seis `<filter>` do index.html no boot
// a partir dos mesmos arrays (o HTML só guarda o `<defs id="cvd-defs">` vazio que os recebe).
//
// Este é um módulo-folha de propósito (mesmo formato de render/hc-role-data): um arquivo de dados sem
// dependência nenhuma pode ser lido tanto pelo pipeline de render quanto pelo boot do documento sem arrastar
// PixiJS para dentro do HTML nem o DOM para dentro do render.
//
// LAYOUT: 20 números = 4 linhas de 5 (R, G, B, A), em ordem de linha. É EXATAMENTE o mesmo layout nos dois
// destinos — `feColorMatrix type="matrix"` e `PIXI.ColorMatrixFilter#matrix` — por isso o array serve aos
// dois sem conversão. Aplicados em sRGB nos dois caminhos (aproximação padrão da web; ver a decisão 2 da
// pesquisa). Fonte primária e a conferência valor a valor: docs/research/PESQUISA-DALTONIZACAO.md.

/** As seis chaves de modo de daltonismo — as MESMAS chaves de `VIZ_MODES` em render/viz-modes. */
export type CvdKey = 'sim-protan' | 'sim-deuter' | 'sim-tritan' | 'fix-protan' | 'fix-deuter' | 'fix-tritan';

/** Ordem canônica: as três simulações (o que a pessoa vê) antes das três correções (o que a ajuda a ver). */
export const CVD_KEYS: readonly CvdKey[] = ['sim-protan', 'sim-deuter', 'sim-tritan', 'fix-protan', 'fix-deuter', 'fix-tritan'];

/**
 * As matrizes, 4×5 em ordem de linha. Linha A = `0 0 0 1 0` em todas: nenhum dos seis modos mexe em alfa.
 *
 * SIMULAÇÃO (Machado, Oliveira & Fernandes 2009, severidade 1.0 — valores conferidos na página dos autores,
 * UFRGS). CORREÇÃO (daltonização canônica): a linha R é identidade — não adianta modular o canal que a pessoa
 * não distingue — e o erro é reinjetado em G e B, onde há discriminação; a soma de cada linha é 1, então
 * branco e cinzas ficam preservados.
 */
export const CVD_MATRIX: Record<CvdKey, readonly number[]> = {
  'sim-protan': [0.152286, 1.052583, -0.204868, 0, 0, 0.114503, 0.786281, 0.099216, 0, 0, -0.003882, -0.048116, 1.051998, 0, 0, 0, 0, 0, 1, 0],
  'sim-deuter': [0.367322, 0.860646, -0.227968, 0, 0, 0.280085, 0.672501, 0.047413, 0, 0, -0.011820, 0.042940, 0.968881, 0, 0, 0, 0, 0, 1, 0],
  'sim-tritan': [1.255528, -0.076749, -0.178779, 0, 0, -0.078411, 0.930809, 0.147602, 0, 0, 0.004733, 0.691367, 0.303900, 0, 0, 0, 0, 0, 1, 0],
  'fix-protan': [1, 0, 0, 0, 0, 0.478897, 0.476911, 0.044192, 0, 0, 0.597282, -0.688692, 1.091410, 0, 0, 0, 0, 0, 1, 0],
  'fix-deuter': [1, 0, 0, 0, 0, 0.162790, 0.725047, 0.112165, 0, 0, 0.454695, -0.645392, 1.190697, 0, 0, 0, 0, 0, 1, 0],
  'fix-tritan': [1, 0, 0, 0, 0, -0.100459, 1.122915, -0.022457, 0, 0, -0.183603, -0.637643, 1.821245, 0, 0, 0, 0, 0, 1, 0],
};

/**
 * Modo → id do `<filter>` SVG. Os ids são API PÚBLICA deste módulo: `VIZ_FILTER` (render/viz-modes) pede o
 * filtro pelo `url(#…)`, e é este mapa que promete que o filtro com aquele id vai existir no documento.
 * Renomear um id aqui sem renomear lá apaga a canvas (referência de filtro inexistente não renderiza).
 */
export const CVD_SVG_ID: Record<CvdKey, string> = {
  'sim-protan': 'cvd-protan', 'sim-deuter': 'cvd-deuter', 'sim-tritan': 'cvd-tritan',
  'fix-protan': 'cvd-fix-protan', 'fix-deuter': 'cvd-fix-deuter', 'fix-tritan': 'cvd-fix-tritan',
};

/** Atributo `values` de um `<feColorMatrix>`: as 4 linhas separadas por espaço duplo (legibilidade). PURA. */
export function cvdMatrixValues(k: CvdKey): string {
  const m = CVD_MATRIX[k];
  return [0, 5, 10, 15].map((i) => m.slice(i, i + 5).join(' ')).join('  ');
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Gera os seis `<filter>` DENTRO do `<defs id="cvd-defs">` do index.html, a partir de `CVD_MATRIX`.
 *
 * Por que no boot e não escrito à mão no HTML: era exatamente a segunda cópia dos números. Construído com
 * `createElementNS` (e não `innerHTML`) porque `<filter>`/`<feColorMatrix>` só funcionam no namespace SVG —
 * com innerHTML o resultado depende do algoritmo de fragmento do navegador.
 *
 * Idempotente: esvazia o host antes de preencher, então chamar duas vezes não duplica ids (id duplicado faria
 * o navegador escolher o primeiro — falha silenciosa outra vez).
 *
 * @returns quantos filtros foram instalados (0 = host ausente; o chamador decide se isso é fatal).
 */
export function installCvdFilters(host: Element | null | undefined): number {
  if (!host) return 0;
  const doc = host.ownerDocument;
  if (!doc) return 0;
  while (host.firstChild) host.removeChild(host.firstChild);
  let n = 0;
  for (const k of CVD_KEYS) {
    const f = doc.createElementNS(SVG_NS, 'filter');
    f.setAttribute('id', CVD_SVG_ID[k]);
    f.setAttribute('color-interpolation-filters', 'sRGB'); // idem PIXI: os dois caminhos operam em sRGB
    const fe = doc.createElementNS(SVG_NS, 'feColorMatrix');
    fe.setAttribute('type', 'matrix');
    fe.setAttribute('values', cvdMatrixValues(k));
    f.appendChild(fe);
    host.appendChild(f);
    n++;
  }
  return n;
}
