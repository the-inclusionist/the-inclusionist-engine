// SPDX-License-Identifier: AGPL-3.0-or-later
// core/route — POR ONDE SE VAI ATÉ LÁ, e não só onde é lá (#84, item 1).
//
// ========================= O DEFEITO QUE ISTO EXISTE PARA CONSERTAR =========================
// A issue #84 escreve-o em duas linhas, e elas são o módulo inteiro:
//
//     «Sem isso, qualquer pista aponta em LINHA RETA para o alvo, e a linha reta atravessa parede: hoje
//      `alvoMaisProximo()` mede distância pela métrica declarada e `panFor()` só compara `x`, então o guia
//      manda a criança andar para dentro de um bloco sólido e ela não tem como saber por quê.»
//
// ⚠️ E ELA NÃO TEM MESMO COMO SABER. Uma criança que vê ignora uma seta que aponta para uma parede sem sequer
// reparar que a ignorou. Quem depende da pista faz o que ela diz — e depois faz outra vez, porque a pista
// continua a dizer o mesmo. A pista errada é pior do que pista nenhuma: pista nenhuma deixa-a explorar.
//
// ========================= O QUE É «ATRAVESSÁVEL», E POR QUE NÃO É INVENÇÃO MINHA =========================
// A #84 pede «as direções por onde há AR OU ÁGUA». Essas duas palavras já estão no contrato, e cada `Role`
// diz de si mesmo se se atravessa — o conjunto abaixo é uma LEITURA do `core/contract`, não uma decisão nova:
//
//   free       «atravessável e sem significado próprio»          → o ar
//   water      «atravessa-se nadando»                            → a água
//   climb      «muda-se de altura interagindo com isto»          → a escada: é POR ELA que se sobe
//   key        «satisfaz um gate»                                → um objeto pousado, não uma barreira
//   structure  «cenário: chão, parede, o que sustenta»           → NÃO
//   gate       «barra até uma condição»                          → NÃO: barrar é o que ele faz
//   hazard     «machuca ao encostar»                             → NÃO, e é a única onde eu escolhi
//   goal       «o que a rodada pede»                             → caso à parte, ver `alvo` abaixo
//
// ⚠️ O `hazard` É A ESCOLHA, e declaro-a: a métrica dele não diz se se atravessa, diz o que custa. Rota que
// passa por espinho é rota que manda a criança levar dano — e no modo cego e no modo cadeirante o próprio
// `core/collision.isSolidType` já o trata como sólido, por decisão de acessibilidade. Encaminhar por cima
// dele contradiria a camada que existe para a proteger. Um jogo em que o espinho seja passagem obrigatória
// terá de dizê-lo por outro meio; hoje nenhum diz.
//
// ========================= O ALVO É SEMPRE PISÁVEL, E O CAMINHO NÃO =========================
// Um `goal` pode estar declarado numa célula que não se atravessa (uma bandeira dentro de um portão). Recusar
// entrar nela faria a rota nunca chegar a lado nenhum. A regra é assimétrica de propósito: **o último passo é
// sempre permitido; os do meio obedecem ao conjunto.** É a diferença entre «entrar no portão» e «atravessar o
// portão para continuar do outro lado».
//
// ========================= O ORÇAMENTO, QUE O PRÓPRIO CONTRATO PEDIU =========================
// ⚠️ `core/contract` avisa, na sua secção 5: «num espaço CONTÍNUO não há como enumerar os pontos, e num mapa
// grande enumerar seria caro por quadro». Este módulo não pode ignorar esse aviso só porque é conveniente.
// Por isso tem TETO de células visitadas e devolve `null` ao estourá-lo. `null` quer dizer **«não sei»**, e
// não «não há caminho» — quem chamar tem de tratar os dois iguais, que é o que uma pista honesta faz: cala-se.
//
// E não importa nada além do contrato: é lógica pura, aferida no project `node`.

import type { Role, Spot, Topology } from './contract.js';
import { distance } from './contract.js';

/**
 * Os papéis que uma rota atravessa. Leitura do `core/contract`, com o `hazard` de fora por decisão declarada
 * no cabeçalho — e `goal` de fora porque ele entra pela regra do último passo, não pela do meio.
 */
export const WALKABLE_ROLES: ReadonlySet<Role> = new Set<Role>(['free', 'water', 'climb', 'key']);

/** Este papel deixa passar? */
export function isWalkable(papel: Role): boolean {
  return WALKABLE_ROLES.has(papel);
}

export interface RouteCtx {
  /** Campo 1 do contrato. A métrica decide QUANTOS vizinhos um ponto tem. */
  readonly topology: Topology;
  /** Campo 2 do contrato: o que há neste ponto. Obrigatório na `GameDeclaration`, logo sempre disponível. */
  readonly roleAt: (at: Spot) => Role;
  /**
   * Teto de pontos visitados. Estourou → `null`, que é «não sei».
   *
   * 4096 é ~64×64 numa grade e cobre com folga os tabuleiros que existem hoje; num mapa de plataforma grande
   * ele corta antes de a busca custar um quadro. O número é PARÂMETRO porque o custo aceitável é de quem
   * chama: uma pista por quadro tolera muito menos do que um cálculo ao carregar a fase.
   */
  readonly orcamento?: number;
}

export interface Route {
  /** O PRÓXIMO ponto a pisar — a um passo de onde se está. É isto que uma pista aponta. */
  readonly proximo: Spot;
  /** Qual dos alvos a rota alcançou. Pode não ser o mais próximo em linha reta, e é esse o ponto. */
  readonly ate: Spot;
  /** Quantos passos ao longo do caminho. ⚠️ NÃO é `distance()`, que mede a reta que atravessa parede. */
  readonly passos: number;
}

const ORCAMENTO_PADRAO = 4096;

/** Chave de um ponto na fila. Arredondada, porque no contínuo os pontos nascem de somas de `passo`. */
const chave = (s: Spot, casas: number): string =>
  s.x.toFixed(casas) + '|' + s.y.toFixed(casas) + '|' + (s.z ?? 0).toFixed(casas);

/**
 * Os deslocamentos de UM passo, na métrica declarada.
 *
 * ⚠️ `free` (L², espaço contínuo sem passo discreto) NÃO TEM VIZINHOS — e fingir que tem é a aproximação que
 * este módulo faz e declara: ele anda numa GRELHA de lado `unit`, nas oito direções. A alternativa seria não
 * responder nada num jogo de plataforma, que é justamente o gênero da issue. Quem ler uma rota `free` está a
 * ler uma amostragem, não uma trajetória — e é por isso que `passos` é uma contagem de células e não uma
 * medida física.
 */
function vizinhos(topo: Topology, passo: number): Spot[] {
  if (topo.kind === 'hotspots') return [];
  const dims = topo.size.length;
  const ortogonal = topo.move === 'orthogonal';
  const fora: Spot[] = [];
  const eixos = [-1, 0, 1];
  for (const dx of eixos) for (const dy of eixos) {
    for (const dz of dims > 2 ? eixos : [0]) {
      const n = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      if (n === 0) continue;
      if (ortogonal && n > 1) continue; // L¹: a diagonal não existe
      fora.push({ x: dx * passo, y: dy * passo, z: dz * passo });
    }
  }
  return fora;
}

/** O ponto cabe na extensão declarada? Grade conta células 0..n−1; contínuo conta unidades 0..n. */
function isInside(topo: Topology, s: Spot): boolean {
  if (topo.kind === 'hotspots') return false;
  const eixo = [s.x, s.y, s.z ?? 0];
  for (let i = 0; i < topo.size.length; i++) {
    const lim = topo.size[i] as number;
    if (eixo[i]! < 0) return false;
    if (topo.kind === 'grid' ? eixo[i]! > lim - 1 : eixo[i]! > lim) return false;
  }
  return true;
}

/**
 * A rota de `de` até o mais próximo ALCANÇÁVEL dos `alvos` — largura primeiro, sobre o que se atravessa.
 *
 * `null` quando não há alvo, quando nenhum é alcançável, quando a topologia não tem espaço (`hotspots`), ou
 * quando o orçamento estourou. Os quatro casos são o mesmo para quem chama: **não sei dizer por onde**.
 *
 * ⚠️ «MAIS PRÓXIMO» AQUI É AO LONGO DO CAMINHO, e é a diferença inteira. Um alvo a três células em linha reta
 * do outro lado de uma parede está mais LONGE do que um a oito células por um corredor aberto — e é o segundo
 * que a criança consegue alcançar.
 */
export function routeTo(ctx: RouteCtx, de: Spot, alvos: readonly Spot[]): Route | null {
  const topo = ctx.topology;
  if (topo.kind === 'hotspots' || alvos.length === 0) return null;

  const passo = topo.kind === 'continuous' ? topo.unit : 1;
  if (!(passo > 0)) return null; // uma unidade de zero faria a fila andar sem sair do sítio
  const casas = topo.kind === 'continuous' ? 4 : 0;
  // Chegou? Na grade é a mesma célula; no contínuo é meio passo, porque a grelha não cai em cima do alvo.
  const tolerancia = topo.kind === 'continuous' ? 0.5 : 0;
  const chegou = (s: Spot): Spot | null =>
    alvos.find((a) => distance(topo, s, a) <= tolerancia) ?? null;

  const alvoAqui = chegou(de);
  if (alvoAqui) return { proximo: de, ate: alvoAqui, passos: 0 };

  const saltos = vizinhos(topo, passo);
  const teto = ctx.orcamento ?? ORCAMENTO_PADRAO;
  const vistos = new Set<string>([chave(de, casas)]);
  // Cada item leva o PRIMEIRO passo que o originou — é só isso que a pista precisa de saber no fim.
  let fila: { at: Spot; primeiro: Spot; passos: number }[] = [{ at: de, primeiro: de, passos: 0 }];

  while (fila.length) {
    const proxima: typeof fila = [];
    for (const item of fila) {
      for (const d of saltos) {
        const vizinho: Spot = { x: item.at.x + d.x, y: item.at.y + d.y, z: (item.at.z ?? 0) + (d.z ?? 0) };
        if (!isInside(topo, vizinho)) continue;
        const k = chave(vizinho, casas);
        if (vistos.has(k)) continue;
        vistos.add(k);
        if (vistos.size > teto) return null; // «não sei», e é uma resposta
        const primeiro = item.passos === 0 ? vizinho : item.primeiro;
        // O ÚLTIMO PASSO É SEMPRE PERMITIDO: um alvo pode estar declarado numa célula que não se atravessa.
        const alvo = chegou(vizinho);
        if (alvo) return { proximo: primeiro, ate: alvo, passos: item.passos + 1 };
        if (!isWalkable(ctx.roleAt(vizinho))) continue;
        proxima.push({ at: vizinho, primeiro, passos: item.passos + 1 });
      }
    }
    fila = proxima;
  }
  return null;
}
