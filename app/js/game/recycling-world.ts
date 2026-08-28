// SPDX-License-Identifier: AGPL-3.0-or-later
// game/recycling-world — o estado do lixo no mundo: quem está no chão, quem está na mão, e o que a lixeira faz.
//
// A terceira e última peça da reciclagem, e cada uma responde uma pergunta diferente:
//   · `game/recycling`       — QUAL lixeira é a certa, e quanto vale (a regra)
//   · `game/recycling-spawn` — ONDE tudo nasce (a geografia)
//   · este                   — O QUE ACONTECE quando a criança encosta, carrega, solta ou deposita
//
// Lógica pura sobre estado explícito: nada de PIXI, nada de DOM, nada de `let` de módulo. O chamador é dono da
// lista de itens (ADR-0038: isto é estado de RODADA, morre com a partida), e cada função recebe e devolve.

// A REGRA (quem acerta, e o que a placa faz) vem de `game/recycling`; a GEOGRAFIA (onde as coisas nascem), de
// `game/recycling-spawn`. Uma primeira versão puxava a placa do módulo de geografia — o teste reprovou na
// hora com "is not a function", que é o defeito que um import errado produz em tempo de execução e que
// nenhum tipo pega em `.js` de teste.
import { descartar, MATERIAIS, type Material, type Lixeira } from './recycling.js';
import type { Ponto } from './recycling-spawn.js';

/** Um item de lixo no mundo. `dono` é o índice do jogador que o carrega, ou `null` se está no chão. */
export interface ItemDeLixo {
  x: number;
  y: number;
  material: Material;
  /** Já foi para a lixeira certa e saiu do mundo. */
  descartado: boolean;
  dono: number | null;
}

/** O resultado de uma ação sobre a carga, com o que o chamador precisa saber para reagir. */
export interface AcaoDeLixo {
  /** Pontos de COMPORTAMENTO ganhos agora (ADR-0049 §1). Nunca negativo. */
  pontos: number;
  /** Chave i18n do que anunciar, ou `null` se não há o que dizer. */
  fala: string | null;
}

const NADA: AcaoDeLixo = { pontos: 0, fala: null };

/**
 * Distribui os materiais pelas posições candidatas, um por posição, em rodízio.
 *
 * ⚠️ RODÍZIO E NÃO SORTEIO, e a diferença é de acessibilidade antes de ser de justiça: com sorteio, um mapa pode
 * nascer sem vidro nenhum, e a criança que precisa treinar vidro joga a fase inteira sem encontrar um. O rodízio
 * garante que os quatro apareçam sempre que houver quatro lugares.
 *
 * `escolher` recebe o total e devolve os índices usados — é por onde o chamador injeta o embaralhamento, para
 * este módulo continuar determinístico e testável.
 *
 * ⚠️ E `ordemInicial` É O QUE FAZ O RODÍZIO FUNCIONAR COM UM ITEM SÓ POR VOLTA, que é como o Dev quis o jogo.
 * Sem ele, `ordem` começa em 0 toda volta e o material é SEMPRE o primeiro da lista — a criança joga cem
 * voltas e só vê caixa de papelão, nunca uma lata. O rodízio existia para impedir exatamente isso, e a
 * quantidade 1 o desligava sem que nada ficasse vermelho: quem avança a ordem a cada volta é o chamador.
 */
export function montarItens(
  candidatos: readonly Ponto[], quantos: number, escolher: (total: number, n: number) => number[],
  ordemInicial = 0,
): ItemDeLixo[] {
  const n = Math.max(0, Math.min(quantos, candidatos.length));
  return escolher(candidatos.length, n).map((idx, ordem) => ({
    x: candidatos[idx]!.x,
    y: candidatos[idx]!.y,
    material: MATERIAIS[(ordemInicial + ordem) % MATERIAIS.length]!,
    descartado: false,
    dono: null,
  }));
}

/** O item que este jogador carrega, se houver. */
export function cargaDe(itens: readonly ItemDeLixo[], jogador: number): ItemDeLixo | null {
  return itens.find((i) => i.dono === jogador && !i.descartado) ?? null;
}

/**
 * Pega o item mais próximo ao alcance, se as mãos estiverem livres.
 *
 * ⚠️ MÃOS OCUPADAS NÃO PEGAM O SEGUNDO. Sem essa guarda a criança acumularia lixo invisível e o descarte
 * deixaria de ser uma escolha por item — que é onde o conteúdo está.
 */
export function pegarPerto(itens: ItemDeLixo[], jogador: number, x: number, y: number, alcance: number): ItemDeLixo | null {
  if (cargaDe(itens, jogador)) return null;
  let melhor: ItemDeLixo | null = null;
  let menor = Infinity;
  for (const it of itens) {
    if (it.descartado || it.dono !== null) continue;
    const d = Math.hypot(it.x - x, it.y - y);
    if (d <= alcance && d < menor) { menor = d; melhor = it; }
  }
  if (melhor) melhor.dono = jogador;
  return melhor;
}

/* ===================== SOLTAR E ARREMESSAR SAÍRAM DAQUI, E ISSO É A DECISÃO =====================
 *
 * Havia `passarPelaPlaca` (cruzou a linha carregando → o item cai ali) e `arremessar` (a barreira devolve o
 * que passaria da placa). As duas foram embora em 2026-08-28 porque a regra que elas implementavam estava
 * invertida: soltar e lançar o lixo SÃO a desobediência, não o conserto dela. O Dev: "se deixar cair o lixo,
 * ele está desobedecendo a placa, se lançar o lixo, também."
 *
 * Agora quem carrega lixo simplesmente não solta e não lança (`game/carry.PODE`), e quem carrega lixo não
 * passa da placa (`game/recycling.travarNaPlaca`). Não há o que este módulo faça com um lixo em trânsito,
 * porque lixo em trânsito só vai para um lugar: a lixeira. */

/**
 * Deposita a carga numa lixeira.
 *
 * Acertou: um ponto de COMPORTAMENTO e o item sai do mundo. Errou: nada acontece — o item VOLTA para a mão, e
 * isso é decisão: devolver ao chão faria a criança recomeçar o percurso por ter errado uma cor, que é punição
 * disfarçada de física.
 */
export function depositar(itens: ItemDeLixo[], jogador: number, lixeira: Lixeira | string): AcaoDeLixo {
  const carga = cargaDe(itens, jogador);
  if (!carga) return NADA;
  const r = descartar(carga.material, lixeira);
  if (!r.acertou) return { pontos: 0, fala: 'sr.lixo.errou' };
  carga.descartado = true;
  carga.dono = null;
  return { pontos: r.pontos, fala: 'sr.lixo.acertou' };
}

/** Uma lixeira POSTA no mundo: onde ela está e de que cor é. */
export interface PostoDeLixeira { x: number; y: number; cor: Lixeira }

/**
 * O ÍNDICE da lixeira sob o jogador, ou `-1` se ele não está em cima de nenhuma.
 *
 * O ponto de referência é o PÉ do jogador (`x`, `y` são os dele), e a caixa da lixeira ganha uma folga: a
 * criança encosta na lixeira andando ao lado dela, não pisando no seu topo.
 *
 * ⚠️ E DESEMPATA PELA MAIS PRÓXIMA, o que não é detalhe: as quatro ficam a 2px uma da outra
 * (`posicoesDasLixeiras`), então com folga as caixas se sobrepõem e QUALQUER varredura que pare na primeira
 * escolheria sempre a da esquerda. Uma criança parada entre a amarela e a verde depositaria na amarela sem
 * entender por quê — e aprenderia que a cor não importa, que é o oposto do conteúdo. Um teste meu caiu
 * exatamente nisso antes de o produto rodar.
 */
export function lixeiraSob(
  x: number, y: number, lixeiras: readonly PostoDeLixeira[], largura: number, altura: number, folga = 4,
): number {
  let melhor = -1, menor = Infinity;
  lixeiras.forEach((l, i) => {
    if (y < l.y - folga || y > l.y + altura + folga) return;
    const d = Math.abs(x - (l.x + largura / 2));
    if (d > largura / 2 + folga || d >= menor) return;
    menor = d; melhor = i;
  });
  return melhor;
}

/**
 * O descarte dispara na ENTRADA da lixeira, nunca enquanto se está dentro dela.
 *
 * ⚠️ É A GUARDA QUE IMPEDE O ERRO EM RAJADA. Sem ela, uma criança parada em cima da lixeira errada ouviria
 * "não é essa" sessenta vezes por segundo — e quem depende do leitor de tela ouviria a fala se reiniciar sem
 * parar, o que na prática tranca o jogo. `antes` é a lixeira do quadro passado; `-1` é "nenhuma".
 */
export function entrouNaLixeira(antes: number, agora: number): boolean {
  return agora >= 0 && agora !== antes;
}

/** Quantos itens ainda estão no mundo por descartar — para quem quiser mostrar progresso sem inventar um placar. */
export function faltamDescartar(itens: readonly ItemDeLixo[]): number {
  return itens.filter((i) => !i.descartado).length;
}
