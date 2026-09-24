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
  readonly budget?: number;
}

export interface Route {
  /** O PRÓXIMO ponto a pisar — a um passo de onde se está. É isto que uma pista aponta. */
  readonly next: Spot;
  /** Qual dos alvos a rota alcançou. Pode não ser o mais próximo em linha reta, e é esse o ponto. */
  readonly reached: Spot;
  /** Quantos passos ao longo do caminho. ⚠️ NÃO é `distance()`, que mede a reta que atravessa parede. */
  readonly steps: number;
}

const DEFAULT_BUDGET = 4096;

/** A spot's key in the queue. Rounded, because in continuous space spots are born from sums of `stride`. */
const chave = (s: Spot, cells: number): string =>
  s.x.toFixed(cells) + '|' + s.y.toFixed(cells) + '|' + (s.z ?? 0).toFixed(cells);

/**
 * Os deslocamentos de UM passo, na métrica declarada.
 *
 * ⚠️ `free` (L², espaço contínuo sem passo discreto) NÃO TEM VIZINHOS — e fingir que tem é a aproximação que
 * este módulo faz e declara: ele anda numa GRELHA de lado `unit`, nas oito direções. A alternativa seria não
 * responder nada num jogo de plataforma, que é justamente o gênero da issue. Quem ler uma rota `free` está a
 * ler uma amostragem, não uma trajetória — e é por isso que `steps` é uma contagem de células e não uma
 * medida física.
 */
function neighbours(shape: Topology, stride: number): Spot[] {
  if (shape.kind === 'hotspots') return [];
  const dims = shape.size.length;
  const orthogonal = shape.move === 'orthogonal';
  const out: Spot[] = [];
  const axes = [-1, 0, 1];
  for (const dx of axes) for (const dy of axes) {
    for (const dz of dims > 2 ? axes : [0]) {
      const n = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      if (n === 0) continue;
      if (orthogonal && n > 1) continue; // L¹: a diagonal não existe
      out.push({ x: dx * stride, y: dy * stride, z: dz * stride });
    }
  }
  return out;
}

/** O ponto cabe na extensão declarada? Grade conta células 0..n−1; contínuo conta unidades 0..n. */
function isInside(shape: Topology, s: Spot): boolean {
  if (shape.kind === 'hotspots') return false;
  const eixo = [s.x, s.y, s.z ?? 0];
  for (let i = 0; i < shape.size.length; i++) {
    const lim = shape.size[i] as number;
    if (eixo[i]! < 0) return false;
    if (shape.kind === 'grid' ? eixo[i]! > lim - 1 : eixo[i]! > lim) return false;
  }
  return true;
}

/**
 * A rota de `de` até o mais próximo ALCANÇÁVEL dos `targets` — largura primeiro, sobre o que se atravessa.
 *
 * `null` quando não há alvo, quando nenhum é alcançável, quando a topologia não tem espaço (`hotspots`), ou
 * quando o orçamento estourou. Os quatro casos são o mesmo para quem chama: **não sei dizer por onde**.
 *
 * ⚠️ «MAIS PRÓXIMO» AQUI É AO LONGO DO CAMINHO, e é a diferença inteira. Um alvo a três células em linha reta
 * do outro lado de uma parede está mais LONGE do que um a oito células por um corredor aberto — e é o segundo
 * que a criança consegue alcançar.
 */
export function routeTo(ctx: RouteCtx, de: Spot, targets: readonly Spot[]): Route | null {
  const shape = ctx.topology;
  if (shape.kind === 'hotspots' || targets.length === 0) return null;
  const walk = walkOf(shape);
  // a unit of zero would make the queue go nowhere, and a negative one would walk exactly like a positive one
  if (!(walk.step > 0)) return null;
  const arrived = (s: Spot): Spot | null => targets.find((a) => distance(shape, s, a) <= walk.tolerance) ?? null;

  const targetHere = arrived(de);
  if (targetHere) return { next: de, reached: targetHere, steps: 0 };

  const search: Search = {
    ctx, space: shape, arrived, keyDecimals: walk.keyDecimals, jumps: neighbours(shape, walk.step),
    budget: ctx.budget ?? DEFAULT_BUDGET, seen: new Set<string>([chave(de, walk.keyDecimals)]),
  };
  let level: Step[] = [{ at: de, first: de, steps: 0 }];
  while (level.length) {
    const next = nextLevel(search, level);
    if (!Array.isArray(next)) return next;
    level = next;
  }
  return null;
}

/** How a space is walked: the step, the decimals a point's key keeps, and how close counts as arrived. On a grid it is the
 *  same cell; in a continuous space half a step, because the sampling grid does not fall on the target. */
function walkOf(space: Exclude<Topology, { kind: 'hotspots' }>): { step: number; keyDecimals: number; tolerance: number } {
  return space.kind === 'continuous' ? { step: space.unit, keyDecimals: 4, tolerance: 0.5 } : { step: 1, keyDecimals: 0, tolerance: 0 };
}

/** One point of the search, carrying the FIRST step that led to it — all the guide needs to know at the end. */
interface Step { readonly at: Spot; readonly first: Spot; readonly steps: number }

/** What a search holds while it widens: the world, where it may step, how it recognises a target, and what it has seen. */
interface Search {
  readonly ctx: RouteCtx;
  readonly space: Topology;
  readonly arrived: (s: Spot) => Spot | null;
  readonly keyDecimals: number;
  readonly jumps: readonly Spot[];
  readonly budget: number;
  readonly seen: Set<string>;
}

/** Where one jump from a point lands, on every axis the space has. */
const stepFrom = (at: Spot, d: Spot): Spot => ({ x: at.x + d.x, y: at.y + d.y, z: (at.z ?? 0) + (d.z ?? 0) });

/** One ring further out. A route when a target is reached, `null` when the budget ran out («I cannot say», which is an
 *  answer), or the next ring. */
function nextLevel(s: Search, level: readonly Step[]): Route | null | Step[] {
  const next: Step[] = [];
  for (const item of level) {
    for (const d of s.jumps) {
      const neighbour = stepFrom(item.at, d);
      if (!isInside(s.space, neighbour)) continue;
      const k = chave(neighbour, s.keyDecimals);
      if (s.seen.has(k)) continue;
      s.seen.add(k);
      if (s.seen.size > s.budget) return null;
      const first = item.steps === 0 ? neighbour : item.first;
      // THE LAST STEP IS ALWAYS ALLOWED: a target may be declared on a cell that cannot be crossed.
      const target = s.arrived(neighbour);
      if (target) return { next: first, reached: target, steps: item.steps + 1 };
      if (isWalkable(s.ctx.roleAt(neighbour))) next.push({ at: neighbour, first, steps: item.steps + 1 });
    }
  }
  return next;
}
