// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/pesados.ts — AS COISAS PESADAS, BAIXADAS NO PRIMEIRO CARREGAMENTO (ADR-0110, ADR-0116, ADR-0119).
//
// ========================= O QUE ISTO É =========================
// O pilar 8 diz «PWA no primeiro dia ONLINE, depois OFFLINE-FIRST», e o ADR-0116 tirou a contradição que
// travava isto: instalar já é um acto de rede, logo buscar na instalação não viola nada. O que faltava era
// alguém a buscar.
//
// 📏 MEDIDO EM 2026-09-09, e é o estado que este ficheiro existe para mudar: das quatro coisas pesadas que a
// engine promete (fontes · voz neural · runtime de visão · arte do LCP), só as FONTES viajavam de verdade.
// As vozes eram porta do cartucho, o runtime de visão era um `<script src>` de CDN buscado com preguiça no
// PRIMEIRO USO, e a arte do LCP não existe.
//
// ⚠️ E ISTO NÃO BLOQUEIA O JOGO. A criança joga enquanto os 241 MB descem; o que não pode acontecer é ela
// chegar ao segundo dia, sem rede, e descobrir que a voz nunca foi buscada.
//
// ========================= AS TRÊS REGRAS QUE A FORMA IMPÕE =========================
//  1. **UM DE CADA VEZ.** Quatro descargas de 60 MB em paralelo num link de escola disputam a mesma banda e
//     nenhuma acaba primeiro — e o jogo, que precisa da rede para as próprias imagens, fica atrás delas.
//  2. **NUNCA LANÇA.** Uma falha de rede é REPORTADA e a lista continua. Um `throw` aqui derrubaria o
//     arranque de um jogo por causa de um recurso que ele nem usa hoje.
//  3. **IDEMPOTENTE.** O que já está na Cache Storage não é buscado outra vez — é o que torna isto seguro de
//     chamar em todo arranque em vez de só «no primeiro», que ninguém sabe detectar com honestidade.
import { CACHE_PESADOS, PESADOS, type Pesado } from './pesados-catalogo.js';

export { CACHE_PESADOS, PESADOS };
export type { Pesado };

/** O que aconteceu com cada entrada, para quem chama poder dizê-lo a uma pessoa. */
export interface RelatorioPesado {
  readonly id: string;
  readonly estado: 'ja-tinha' | 'baixado' | 'falhou' | 'sem-fonte';
  readonly bytes?: number;
  readonly erro?: string;
}

export interface OpcoesDosPesados {
  /** `caches` do navegador. Injectado para o gate não precisar de um. */
  readonly cacheStorage?: CacheStorage;
  /** `fetch`. Injectado pela mesma razão. */
  readonly buscar?: typeof fetch;
  /** Chamado a cada entrada resolvida — é o que deixa a interface dizer o que está a acontecer. */
  readonly aoProgredir?: (r: RelatorioPesado) => void;
  /** Só estas ids, se dado. Serve ao consumidor que quer as vozes e não o resto. */
  readonly apenas?: readonly string[];
}

/**
 * BAIXA O QUE FALTA, UM DE CADA VEZ, E DEVOLVE O QUE ACONTECEU COM CADA UM.
 *
 * ⚠️ AS ENTRADAS SEM `url` NÃO SÃO SALTADAS EM SILÊNCIO — devolvem `sem-fonte`. É a diferença entre «este
 * subsistema ainda não tem de onde vir» e «este subsistema está tratado», e é exactamente a distinção que o
 * ADR-0119 mediu em falta: a engine PROMETIA quatro coisas e entregava uma, sem nada a dizê-lo.
 */
export async function baixarPesados(opcoes: OpcoesDosPesados = {}): Promise<RelatorioPesado[]> {
  const cs = opcoes.cacheStorage ?? (typeof caches !== 'undefined' ? caches : undefined);
  const buscar = opcoes.buscar ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  const alvos = opcoes.apenas
    ? PESADOS.filter((p) => opcoes.apenas!.includes(p.id))
    : PESADOS;

  const out: RelatorioPesado[] = [];
  const conta = (r: RelatorioPesado): void => { out.push(r); opcoes.aoProgredir?.(r); };

  if (!cs || !buscar) {
    for (const p of alvos) conta({ id: p.id, estado: 'falhou', erro: 'sem Cache Storage ou sem fetch' });
    return out;
  }

  const cache = await cs.open(CACHE_PESADOS);
  for (const p of alvos) {
    if (!p.url) { conta({ id: p.id, estado: 'sem-fonte', erro: p.porQueNaoTemFonte }); continue; }
    try {
      if (await cache.match(p.url)) { conta({ id: p.id, estado: 'ja-tinha' }); continue; }
      const resp = await buscar(p.url);
      if (!resp.ok) { conta({ id: p.id, estado: 'falhou', erro: `HTTP ${resp.status}` }); continue; }
      await cache.put(p.url, resp.clone());
      conta({ id: p.id, estado: 'baixado', bytes: p.bytes });
    } catch (e) {
      conta({ id: p.id, estado: 'falhou', erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

/** O peso do que ainda falta, em bytes — para um aviso poder dizer «faltam 241 MB» antes de começar. */
export function pesoPorBaixar(relatorio: readonly RelatorioPesado[]): number {
  const feitos = new Set(relatorio.filter((r) => r.estado === 'ja-tinha' || r.estado === 'baixado').map((r) => r.id));
  return PESADOS.filter((p) => p.url && !feitos.has(p.id)).reduce((s, p) => s + (p.bytes ?? 0), 0);
}
