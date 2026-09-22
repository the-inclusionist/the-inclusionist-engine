// SPDX-License-Identifier: AGPL-3.0-or-later
// render/viz-axes — OS DOIS EIXOS, e a simulação que NÃO é um deles (ADR-0076). Only dependency: the shapes, from `core/visual-state`.
//
// ========================= O DEFEITO QUE ISTO CONSERTA =========================
// Hoje o menu visual é UM rádio e `p.viz` guarda UMA string. Escolher `fix-deuter` desliga o contraste 7:1;
// escolher um nível de contraste desliga a correção. ⚠️ UMA CRIANÇA COM DALTONISMO QUE TAMBÉM PRECISE DE
// ALTO CONTRASTE NÃO PODE TER OS DOIS — e as duas necessidades coexistem numa mesma pessoa com frequência.
//
// ========================= POR QUE A SIMULAÇÃO NÃO É UM EIXO =========================
// Correção e simulação são ambas implementadas como filtro e servem a PROPÓSITOS OPOSTOS: uma deixa uma
// criança JOGAR, a outra deixa alguém SENTIR como é não conseguir. Agrupá-las pelo mecanismo já as fundiu
// duas vezes — no ADR-0011 (as correções listadas no painel de Empatia, de modo que *«a criança que
// PRECISAVA da correção tinha de a procurar no menu sobre fingir»*) e no ADR-0075.
//
// ⚠️ UM GRUPO DE AJUSTES CHAMA-SE PELO QUE ELE SERVE, NUNCA PELO COMO É IMPLEMENTADO.
//
// ========================= E POR QUE A SIMULAÇÃO É TRAVADA NOS DOIS PADRÕES =========================
// De uma tela já corrigida, uma simulação não mostra nem a deficiência nem a correção; por cima de um tema
// de alto contraste, mostra o que o tema faz e não o que a deuteranopia faz. Uma demonstração a correr em
// cima de uma adaptação não é uma demonstração mais fraca — **ela ensina uma coisa falsa**.

// The shapes live in `core/visual-state` (issue #167: `core/entity` holds them and may not import upward); the names
// stay exported here, where cartridges import them.
import type {
  Theme as TemaDoCore, Correction as CorrecaoDoCore, Simulation as SimulacaoDoCore, VisualState as VisualStateDoCore,
} from '../core/visual-state.js';
/** O eixo do CONTRASTE (`core/visual-state`). */
export type Theme = TemaDoCore;
/** O eixo da CORREÇÃO DE COR (`core/visual-state`). */
export type Correction = CorrecaoDoCore;
/** A simulação, que NÃO é eixo (`core/visual-state`). */
export type Simulation = SimulacaoDoCore;
/** O estado visual de UM jogador (`core/visual-state`). */
export type VisualState = VisualStateDoCore;

export const PADRAO: VisualState = Object.freeze({ tema: 'padrao', correcao: 'tricro', simulacao: null });

/**
 * Os dois eixos estão no padrão?
 *
 * ⚠️ É A PERGUNTA QUE LIBERA A SIMULAÇÃO, e é por isso que ela é uma função e não um booleano guardado:
 * guardar o resultado deixaria as duas coisas divergirem, e a divergência aqui significa uma demonstração a
 * correr por cima de uma adaptação — que ensina uma coisa falsa.
 */
export function nosPadroes(v: VisualState): boolean {
  return v.tema === 'padrao' && v.correcao === 'tricro';
}

/**
 * Esta simulação pode correr AGORA? E se não, por quê?
 *
 * ⚠️ DEVOLVE O MOTIVO E NÃO SÓ `false`. O ADR-0076 exige que a recusa seja VISÍVEL e explicada — nunca
 * silenciosamente removida, nunca aceita e depois ignorada. E o motivo é um FACTO SOBRE A DEMONSTRAÇÃO, não
 * uma repreensão a quem escolheu: quem ligou o alto contraste ligou-o porque precisa.
 */
export type UnavailableReason = 'tema' | 'correcao' | 'ambos';
export function simulationUnavailable(v: VisualState): UnavailableReason | null {
  const t = v.tema !== 'padrao';
  const c = v.correcao !== 'tricro';
  if (t && c) return 'ambos';
  if (t) return 'tema';
  if (c) return 'correcao';
  return null;
}

/* ===================== A COMPOSIÇÃO ===================== */
//
// ⚠️ ELA JÁ ERA MECANICAMENTE POSSÍVEL, e é isso que torna o defeito mais caro do que parecia: o TEMA de
// alto contraste vai pela RENDERIZAÇÃO DIRETA (`DIRECT_CFG`/PIXI) e a CORREÇÃO vai por FILTRO CSS
// (`url(#cvd-fix-*)`). São dois mecanismos que não colidem. O que impedia os dois de coexistir não era a
// máquina — era o campo único que só cabia um valor.

/** A chave de modo DIRETO que este tema usa, ou `null` para o tema padrão. */
export function directTheme(v: VisualState): string | null {
  return v.tema === 'hc3' ? 'hc-direto'
    : v.tema === 'hc45' ? 'hc-direto-45'
      : v.tema === 'hc7' ? 'hc-direto-7'
        : null;
}

/**
 * A chave de FILTRO CSS que este estado usa, ou `null`.
 *
 * ⚠️ SIMULAÇÃO VENCE CORREÇÃO AQUI, e não é uma regra de precedência escondida: as duas não podem coexistir
 * porque `simulationUnavailable` já as separa — uma simulação só corre com a correção no padrão. Este `??`
 * é o que acontece quando alguém constrói um estado à mão que a interface não deixaria montar, e escolher a
 * simulação é o menos errado dos dois: ela é a intenção mais recente e mais visível.
 */
export function filterKey(v: VisualState): string | null {
  if (v.simulacao) return v.simulacao;
  return v.correcao === 'tricro' ? null : 'fix-' + (v.correcao === 'deuter' ? 'deuter' : v.correcao);
}

/**
 * As DUAS coisas que a raiz precisa aplicar, num objeto só.
 *
 * ⚠️ Devolver os dois JUNTOS é o ponto da issue #104: enquanto eram um campo, aplicar um apagava o outro.
 * Aqui um estado com tema `hc7` e correção `deuter` devolve os dois preenchidos, e é o que o gate afirma.
 */
export interface HowItApplies {
  /** A chave do modo direto (alto contraste), ou `null`. */
  readonly direto: string | null;
  /** A chave do filtro CSS (correção ou simulação), ou `null`. */
  readonly filtro: string | null;
}
export function howItApplies(v: VisualState): HowItApplies {
  return { direto: directTheme(v), filtro: filterKey(v) };
}

/* ===================== O QUE OS LEITORES DE FACTO PERGUNTAM ===================== */
//
// ⚠️ ESTAS FUNÇÕES SAÍRAM DE UMA MEDIDA, e não de um desenho a priori. Os 31 leitores de `p.viz` foram
// classificados pelo que PERGUNTAM, e a lista curta abaixo é o resultado — quatro perguntam o «kind», duas
// se é simulação, uma a textura, e o resto é escrita. Um leitor que precise de algo fora daqui é sinal de
// que a pergunta dele merecia um nome.
//
// ⚠️ E A MEDIDA TROUXE UM ACHADO: `ui/pause-icons` já tem `nextContrast` e `nextCvd`, cada uma a ciclar
// DENTRO do seu eixo. A interface já pensava em dois eixos há muito tempo; era o ARMAZENAMENTO que os
// colapsava num campo. As funções de ciclo abaixo são as mesmas duas, agora com onde guardar o resultado.

/** Há uma simulação a correr? É a pergunta que `simulatesDisability` fazia à string. */
export function isSimulation(v: VisualState): boolean {
  return v.simulacao !== null;
}

/** É a simulação de CEGUEIRA? O quiz e o sonar perguntam isto para se comportarem sem tela. */
export function isBlind(v: VisualState): boolean {
  return v.simulacao === 'blind';
}

/** É uma das cinco simulações de BAIXA VISÃO? Elas pedem o overlay como textura, e não só um filtro. */
export function isLowVision(v: VisualState): boolean {
  return v.simulacao !== null && v.simulacao.startsWith('lv-');
}

/** O tema está fora do padrão? Era o `/^hc-direto/.test(s.viz)` espalhado pela interface. */
export function hasHighContrast(v: VisualState): boolean {
  return v.tema !== 'padrao';
}

/** Próximo TEMA no ciclo do ícone da barra rápida. Anda só no seu eixo, e não toca na correção. */
export function nextTheme(v: VisualState): VisualState {
  const i = THEMES.indexOf(v.tema);
  return { ...v, tema: THEMES[(i < 0 ? 0 : i + 1) % THEMES.length]! };
}

/**
 * Próxima CORREÇÃO no ciclo do ícone. Anda só no seu eixo, e não toca no tema.
 *
 * ⚠️ A ASSIMETRIA DO ORIGINAL FICA REGISTRADA E NÃO É COPIADA: `nextCvd` mapeava um valor desconhecido para
 * o ÍNDICE 1 (`fix-protan`) enquanto `nextContrast` mapeava para 0. Era um comentário no ficheiro a explicar
 * uma diferença que ninguém tinha decidido. Aqui as duas começam no padrão, porque um valor desconhecido é
 * exatamente o caso em que não se sabe o que a criança queria — e o padrão é a única resposta que não
 * escolhe por ela.
 */
export function nextCorrection(v: VisualState): VisualState {
  const i = CORRECTIONS.indexOf(v.correcao);
  return { ...v, correcao: CORRECTIONS[(i < 0 ? 0 : i + 1) % CORRECTIONS.length]! };
}

/**
 * A chave que o sprite do jogador usa para escolher textura.
 *
 * ⚠️ É a SIMULAÇÃO quando há uma, e o TEMA quando não há — nesta ordem porque é a ordem do que a criança vê:
 * uma cegueira simulada apaga a tela inteira, e nesse instante o tema não muda nada do que ela percebe.
 */
export function textureKey(v: VisualState): string {
  return v.simulacao ?? directTheme(v) ?? 'normal';
}

/**
 * A CHAVE ÚNICA que melhor descreve este estado no vocabulário ANTIGO — para quem só sabe ler uma.
 *
 * ⚠️ NÃO É A `textureKey`, e a diferença custou um gate vermelho para aparecer. A de textura devolve
 * `normal` para uma correção de cor, porque correção não muda textura nenhuma — e usá-la como espelho faria
 * uma criança em `fix-deuter` passar a gravar `'normal'` na chave legada. **Um leitor antigo perderia a
 * correção dela**, que é exactamente o estrago que a migração inteira existe para não cometer.
 *
 * A ordem é simulação → tema → correção → padrão, e ela preserva TODO ajuste que já existia: nenhum estado
 * antigo tinha dois eixos, então nenhum deles perde nada aqui.
 *
 * ⚠️ O ÚNICO CASO COM PERDA É O NOVO — `hc7 + fix-deuter` só cabe como uma das duas metades, e a escolhida é
 * o tema. Não há regressão possível nisso: esse estado NÃO EXISTIA antes, e um leitor que só entende uma
 * chave nunca soube exprimi-lo. Quem quiser as duas metades lê a chave nova, que existe precisamente para
 * isso.
 */
export function legacyKey(v: VisualState): string {
  return v.simulacao ?? directTheme(v) ?? filterKey(v) ?? 'normal';
}

/* ===================== A MIGRAÇÃO ===================== */
//
// ⚠️ ELA NÃO É OPCIONAL E VEM ANTES DA PRIMEIRA LEITURA DA FORMA NOVA. O ajuste salvo guarda o valor único
// antigo; sem a tradução, o modo visual que cada criança já escolheu é DESCARTADO — e quem escolheu um
// desses valores escolheu-o porque enxerga assim.

/** O valor único antigo → o estado de dois eixos. Chave desconhecida cai no padrão, e nunca estoura. */
const DE_CHAVE_UNICA: Readonly<Record<string, VisualState>> = Object.freeze({
  normal: PADRAO,

  // Os três níveis de contraste viram TEMA, e a correção fica no padrão.
  'hc-direto': { tema: 'hc3', correcao: 'tricro', simulacao: null },
  'hc-direto-45': { tema: 'hc45', correcao: 'tricro', simulacao: null },
  'hc-direto-7': { tema: 'hc7', correcao: 'tricro', simulacao: null },

  // As três correções viram CORREÇÃO, e o tema fica no padrão.
  'fix-protan': { tema: 'padrao', correcao: 'protan', simulacao: null },
  'fix-deuter': { tema: 'padrao', correcao: 'deuter', simulacao: null },
  'fix-tritan': { tema: 'padrao', correcao: 'tritan', simulacao: null },

  // ⚠️ AS NOVE SIMULAÇÕES VOLTAM COM OS DOIS EIXOS NO PADRÃO, e não é perda de informação: uma simulação
  // só era possível a partir do padrão de qualquer maneira, porque ela SUBSTITUÍA tudo o resto. O que a
  // forma nova acrescenta é dizer isso em vez de o deixar implícito.
  'sim-protan': { tema: 'padrao', correcao: 'tricro', simulacao: 'sim-protan' },
  'sim-deuter': { tema: 'padrao', correcao: 'tricro', simulacao: 'sim-deuter' },
  'sim-tritan': { tema: 'padrao', correcao: 'tricro', simulacao: 'sim-tritan' },
  'lv-blur': { tema: 'padrao', correcao: 'tricro', simulacao: 'lv-blur' },
  'lv-haze': { tema: 'padrao', correcao: 'tricro', simulacao: 'lv-haze' },
  'lv-tunnel': { tema: 'padrao', correcao: 'tricro', simulacao: 'lv-tunnel' },
  'lv-macular': { tema: 'padrao', correcao: 'tricro', simulacao: 'lv-macular' },
  'lv-diabetic': { tema: 'padrao', correcao: 'tricro', simulacao: 'lv-diabetic' },
  blind: { tema: 'padrao', correcao: 'tricro', simulacao: 'blind' },
});

/**
 * Traduz o valor salvo. Aceita o antigo (string) e o novo (objeto), e devolve sempre um estado válido.
 *
 * ⚠️ IDEMPOTENTE POR CONSTRUÇÃO: um objeto já migrado atravessa com os campos conferidos. Importa porque a
 * leitura acontece por jogador e mais de uma vez por sessão.
 *
 * ⚠️ E DESCONHECIDO CAI NO PADRÃO EM VEZ DE ESTOURAR. O dado vem do navegador de uma criança e pode ser de
 * uma versão futura, de outra máquina, ou lixo. Um `throw` aqui tiraria o jogo do ar por causa de uma
 * preferência; o padrão apenas devolve o jogo como ele nasce.
 */
export function migrateVisual(salvo: unknown): VisualState {
  if (typeof salvo === 'string') return DE_CHAVE_UNICA[salvo] ?? PADRAO;
  if (salvo && typeof salvo === 'object') {
    const o = salvo as Partial<VisualState>;
    return {
      tema: THEMES.includes(o.tema as Theme) ? (o.tema as Theme) : PADRAO.tema,
      correcao: CORRECTIONS.includes(o.correcao as Correction) ? (o.correcao as Correction) : PADRAO.correcao,
      simulacao: SIMULATIONS.includes(o.simulacao as Simulation) ? (o.simulacao as Simulation) : null,
    };
  }
  return PADRAO;
}

export const THEMES: readonly Theme[] = ['padrao', 'hc3', 'hc45', 'hc7'];
export const CORRECTIONS: readonly Correction[] = ['tricro', 'protan', 'deuter', 'tritan'];
export const SIMULATIONS: readonly Simulation[] = [
  null, 'sim-protan', 'sim-deuter', 'sim-tritan',
  'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind',
];

/** As chaves antigas que a migração conhece — exportada para o gate poder exigir que TODAS estejam cobertas. */
export const LEGACY_KEYS: readonly string[] = Object.keys(DE_CHAVE_UNICA);
