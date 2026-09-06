// SPDX-License-Identifier: AGPL-3.0-or-later
// render/viz-axes — OS DOIS EIXOS, e a simulação que NÃO é um deles (ADR-0076). Módulo-folha, zero deps.
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

/** O eixo do CONTRASTE. `padrao` não é ausência de tema: é o tema desenhado do jogo. */
export type Tema = 'padrao' | 'hc3' | 'hc45' | 'hc7';

/** O eixo da CORREÇÃO DE COR. `tricro` = visão tricromática, e é um nome, não uma ausência. */
export type Correcao = 'tricro' | 'protan' | 'deuter' | 'tritan';

/** A simulação, que NÃO é eixo. `null` = nenhuma a correr. */
export type Simulacao = null | 'sim-protan' | 'sim-deuter' | 'sim-tritan'
  | 'lv-blur' | 'lv-haze' | 'lv-tunnel' | 'lv-macular' | 'lv-diabetic' | 'blind';

/** O estado visual de UM jogador. Substitui a string única de `p.viz`. */
export interface VisualState {
  readonly tema: Tema;
  readonly correcao: Correcao;
  readonly simulacao: Simulacao;
}

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
export type MotivoIndisponivel = 'tema' | 'correcao' | 'ambos';
export function simulacaoIndisponivel(v: VisualState): MotivoIndisponivel | null {
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
export function temaDireto(v: VisualState): string | null {
  return v.tema === 'hc3' ? 'hc-direto'
    : v.tema === 'hc45' ? 'hc-direto-45'
      : v.tema === 'hc7' ? 'hc-direto-7'
        : null;
}

/**
 * A chave de FILTRO CSS que este estado usa, ou `null`.
 *
 * ⚠️ SIMULAÇÃO VENCE CORREÇÃO AQUI, e não é uma regra de precedência escondida: as duas não podem coexistir
 * porque `simulacaoIndisponivel` já as separa — uma simulação só corre com a correção no padrão. Este `??`
 * é o que acontece quando alguém constrói um estado à mão que a interface não deixaria montar, e escolher a
 * simulação é o menos errado dos dois: ela é a intenção mais recente e mais visível.
 */
export function filtroChave(v: VisualState): string | null {
  if (v.simulacao) return v.simulacao;
  return v.correcao === 'tricro' ? null : 'fix-' + (v.correcao === 'deuter' ? 'deuter' : v.correcao);
}

/**
 * As DUAS coisas que a raiz precisa aplicar, num objeto só.
 *
 * ⚠️ Devolver os dois JUNTOS é o ponto da issue #104: enquanto eram um campo, aplicar um apagava o outro.
 * Aqui um estado com tema `hc7` e correção `deuter` devolve os dois preenchidos, e é o que o gate afirma.
 */
export interface Aplicacao {
  /** A chave do modo direto (alto contraste), ou `null`. */
  readonly direto: string | null;
  /** A chave do filtro CSS (correção ou simulação), ou `null`. */
  readonly filtro: string | null;
}
export function aplicacao(v: VisualState): Aplicacao {
  return { direto: temaDireto(v), filtro: filtroChave(v) };
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
export function migrarVisual(salvo: unknown): VisualState {
  if (typeof salvo === 'string') return DE_CHAVE_UNICA[salvo] ?? PADRAO;
  if (salvo && typeof salvo === 'object') {
    const o = salvo as Partial<VisualState>;
    return {
      tema: TEMAS.includes(o.tema as Tema) ? (o.tema as Tema) : PADRAO.tema,
      correcao: CORRECOES.includes(o.correcao as Correcao) ? (o.correcao as Correcao) : PADRAO.correcao,
      simulacao: SIMULACOES.includes(o.simulacao as Simulacao) ? (o.simulacao as Simulacao) : null,
    };
  }
  return PADRAO;
}

export const TEMAS: readonly Tema[] = ['padrao', 'hc3', 'hc45', 'hc7'];
export const CORRECOES: readonly Correcao[] = ['tricro', 'protan', 'deuter', 'tritan'];
export const SIMULACOES: readonly Simulacao[] = [
  null, 'sim-protan', 'sim-deuter', 'sim-tritan',
  'lv-blur', 'lv-haze', 'lv-tunnel', 'lv-macular', 'lv-diabetic', 'blind',
];

/** As chaves antigas que a migração conhece — exportada para o gate poder exigir que TODAS estejam cobertas. */
export const CHAVES_ANTIGAS: readonly string[] = Object.keys(DE_CHAVE_UNICA);
