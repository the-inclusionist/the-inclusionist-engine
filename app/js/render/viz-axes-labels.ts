// SPDX-License-Identifier: AGPL-3.0-or-later
// render/viz-axes-labels — O MENU VISUAL COM DOIS CONTROLES (ADR-0076, issue #104), na metade pura.
//
// ========================= O COMENTÁRIO QUE AUTORIZA ESTA MUDANÇA =========================
// O `ui/settings-visual` justifica o controle ÚNICO com estas palavras, e elas continuam lá, verdadeiras
// sobre o dia em que foram escritas:
//
//     «Os sete vivem num CONTROLE SÓ, e isso não é economia de espaço: `p.viz` guarda UM valor. Dois
//      controles separados se sobrescreveriam em silêncio — a criança escolheria a correção, depois o
//      contraste, e perderia a correção sem nada dizer que perdeu.»
//
// ⚠️ A RAZÃO QUE ELE DÁ DEIXOU DE EXISTIR. `p.viz` já não guarda um valor: guarda dois eixos mais a
// simulação, e os escritores por eixo (`setTemaDoJogador`/`setCorrecaoDoJogador`) mexem num sem tocar no
// outro. O controle único era a forma honesta de contar uma exclusividade REAL; mantê-lo agora seria contar
// uma exclusividade que já não existe — e continuar a negar os dois a quem precisa dos dois.
//
// ========================= OS NOMES DOS PADRÕES SÃO DECISÃO, NÃO ROTINA =========================
// ⚠️ «Tema padrão» e «Visão tricromática», e o ADR-0076 fecha a *definition of done* com a regra que os
// escolheu: **nenhum rótulo de padrão diagnostica quem lê**. `modo sem deficiência visual` foi oferecido e
// recusado — ele diz à criança o que ela NÃO é, no menu que ela abriu para conseguir jogar. Um padrão
// chama-se pelo que ele É.
//
// E `Modo padrão` (o `viz.normal` de hoje) deixa de servir aqui: era o neutro PARTILHADO, de quando os dois
// eixos eram um só. Com dois controles, um «padrão» sem dizer padrão de QUÊ é ambíguo em ambos.
//
// Módulo puro: devolve HTML e chaves i18n, não toca documento nenhum. Quem monta é o `render/viz-setters`, na mesma camada (issue #167).
import { TEMAS, CORRECOES, type Theme, type Correction, type VisualState } from './viz-axes.js';

/** O rótulo de cada tema. Chave i18n — quem exibe resolve, como todo o resto do menu. */
export const ROTULO_DO_TEMA: Readonly<Record<Theme, string>> = Object.freeze({
  padrao: 'eixo.tema.padrao',
  hc3: 'viz.hc-direto',
  hc45: 'viz.hc-direto-45',
  hc7: 'viz.hc-direto-7',
});

/** O rótulo de cada correção de cor. */
export const ROTULO_DA_CORRECAO: Readonly<Record<Correction, string>> = Object.freeze({
  tricro: 'eixo.correcao.tricro',
  protan: 'viz.fix-protan',
  deuter: 'viz.fix-deuter',
  tritan: 'viz.fix-tritan',
});

/**
 * Os rótulos CURTOS, para os ícones da barra rápida — «7:1», «deuteranopia».
 *
 * ⚠️ SÃO AS CHAVES QUE JÁ EXISTIAM (`contrast.*`, `cvd.*`), re-chaveadas por eixo. A barra rápida sempre
 * falou curto porque anuncia UM ícone de cada vez, e o painel sempre falou por extenso porque a criança está
 * a ler uma lista — a diferença é de contexto e sobrevive à divisão. Reaproveitar em vez de traduzir de novo
 * é o que mantém a mesma palavra nos dois sítios.
 */
export const CURTO_DO_TEMA: Readonly<Record<Theme, string>> = Object.freeze({
  padrao: 'contrast.off', hc3: 'contrast.3', hc45: 'contrast.45', hc7: 'contrast.7',
});
export const CURTO_DA_CORRECAO: Readonly<Record<Correction, string>> = Object.freeze({
  tricro: 'cvd.off', protan: 'cvd.protan', deuter: 'cvd.deuter', tritan: 'cvd.tritan',
});

/** Os dois eixos, como o painel os identifica no DOM. */
export type EixoVisual = 'tema' | 'correcao';

/** Um tradutor, igual ao que o resto da interface recebe. */
export type Tradutor = (chave: string, params?: Record<string, string | number>) => string;

/**
 * As linhas de UM eixo, no formato de rádio que o painel já usa.
 *
 * ⚠️ RÁDIO E NÃO SETE BOTÕES, e o motivo sobrevive à divisão: DENTRO de um eixo os valores continuam
 * exclusivos — um tema de cada vez, uma correção de cada vez. O que deixou de ser exclusivo é a relação
 * ENTRE os eixos, e é por isso que eles viram dois rádios em vez de um.
 *
 * ⚠️ E MANTÉM-SE A FORMA DE LINHA VISÍVEL, não um `<select>`. O `settings-visual` regista o erro que o Dev
 * apanhou na primeira tentativa: dentro de uma caixa fechada, um controle cuja razão de existir é ser ACHADO
 * por quem enxerga mal fica «quase o mesmo que não ter movido».
 */
export function linhasDoEixo(
  eixo: EixoVisual,
  valores: readonly string[],
  rotulos: Readonly<Record<string, string>>,
  atual: string,
  t: Tradutor,
): string {
  return valores.map((valor) => {
    const sel = valor === atual;
    return `<div class="ctrl-row"><span><strong>${t(rotulos[valor]!)}</strong></span>`
      + `<button class="mode-btn${sel ? ' is-on' : ''}" role="radio" aria-checked="${sel}"`
      + ` data-eixo="${eixo}" data-valor="${valor}" type="button">${sel ? t('viz.escolhido') : t('viz.escolher')}</button></div>`;
  }).join('');
}

/**
 * Os DOIS eixos, um a seguir ao outro, com um título cada.
 *
 * O título existe porque dois rádios seguidos sem nome são um rádio de oito para quem lê depressa — e essa
 * leitura é exactamente o mal-entendido que a divisão existe para desfazer.
 */
export function eixosHtml(v: VisualState, t: Tradutor): string {
  return `<h3 class="opt-sub">${t('eixo.tema.titulo')}</h3>`
    + linhasDoEixo('tema', TEMAS, ROTULO_DO_TEMA, v.tema, t)
    + `<h3 class="opt-sub">${t('eixo.correcao.titulo')}</h3>`
    + linhasDoEixo('correcao', CORRECOES, ROTULO_DA_CORRECAO, v.correcao, t);
}

/** O que um clique num botão do painel quer dizer. `null` quando o botão não é de eixo nenhum. */
export interface EscolhaDeEixo {
  readonly eixo: EixoVisual;
  readonly valor: string;
}
export function escolhaDoBotao(dataset: { eixo?: string; valor?: string }): EscolhaDeEixo | null {
  const { eixo, valor } = dataset;
  if (eixo !== 'tema' && eixo !== 'correcao') return null;
  if (!valor) return null;
  const validos: readonly string[] = eixo === 'tema' ? TEMAS : CORRECOES;
  return validos.includes(valor) ? { eixo, valor } : null;
}
