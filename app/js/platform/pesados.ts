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
import { CACHE_PESADOS, PESADOS, readingLanguageOf, type Pesado } from './pesados-catalogo.js';

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
  /**
   * The SHA-256 of a body, as lowercase hex (issue #168). Injected for the gate; by default `crypto.subtle`. `null`, or a
   * host without `crypto.subtle` (an insecure context), keeps NOTHING: unverifiable is not verified.
   */
  readonly digest?: ((corpo: ArrayBuffer) => Promise<string>) | null;
  /** Só estas ids, se dado. Serve ao consumidor que quer as vozes e não o resto. */
  readonly apenas?: readonly string[];
  /** The page's address the delivery's `pesados/` folder is resolved against. By default the page's own (`location.href`). */
  readonly base?: string;
}

/**
 * WHAT A GAME'S START FETCHES (ADR-0216 §3): the catalogue, less what this game did not ask for.
 *
 * · The neural voice — its model, its voices AND the runtime that speaks them: without that answer they are 372 MB taken from a
 *   school's link and a child's device for nothing.
 * · The reading models: 850 MiB for the three languages, so `reading` is not a yes or no but a LANGUAGE — the child's, known at
 *   boot. A delivery may carry more than one; a device downloads the one being read in. A game that never listens gets none.
 * · 🔴 THE GRAPH RUNTIME IS NOT THE VOICE'S, and its `voz:` name said otherwise. `platform/onnx-runtime` runs Kokoro AND the
 *   reading models, so a game that only LISTENS needs it: without this line its delivery carried a 378 MiB model and nothing
 *   able to open it, and the first `listen()` asked for a file the build never wrote. Measured on 2026-09-21, building the
 *   very delivery this exists to serve. The PHONEMIZER (`voz:runtime:fonemas`, 18.7 MiB) stays the voice's — nothing else
 *   turns letters into sounds.
 */
export function pesadosDoArranque(portas: { readonly kokoro: boolean; readonly reading?: string | null }): readonly string[] {
  const reading = portas.reading ? portas.reading.split('-')[0]!.toLowerCase() : null;
  return PESADOS.filter((p) => {
    const language = readingLanguageOf(p.id);
    if (language) return language === reading;
    if (p.id.startsWith('voz:runtime:onnx')) return portas.kokoro || !!reading;
    return portas.kokoro || !(p.id.startsWith('voz:kokoro:') || p.id.startsWith('voz:runtime:'));
  }).map((p) => p.id);
}

/**
 * WHERE THE DELIVERY SERVES A HEAVY FILE (ADR-0177, issue #173): `pesados/<host><path>` beside the page. The child's device
 * reads it from the game's own origin; the upstream address is only where the build fetched it from.
 * 📌 The upstream address stays the CACHE KEY: it is what the voice and vision libraries ask for, and the service worker answers
 * them from the checked cache without a network request.
 */
export function caminhoNaEntrega(url: string): string {
  const u = new URL(url);
  return `pesados/${u.host}${u.pathname}`;
}

/**
 * The inverse, for the service worker: a request for `…/pesados/<host><path>` is answered from the entry kept under
 * `https://<host><path>`; any other address has no key (`null`). It is the route's `cacheKeyWillBeUsed` itself, so it also
 * takes Workbox's `{ request }`. Self-contained on purpose — the PWA plugin copies this function's SOURCE into `sw.js`, where
 * nothing else from this module exists.
 */
export function chaveDaEntrega(pedido: string | { readonly request: { readonly url: string } }): string | null {
  const caminho = new URL(typeof pedido === 'string' ? pedido : pedido.request.url).pathname;
  const i = caminho.indexOf('/pesados/');
  return i < 0 ? null : 'https://' + caminho.slice(i + 9);
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

  const digest = opcoes.digest === undefined ? (temSubtle() ? sha256Hex : null) : opcoes.digest;
  const base = opcoes.base ?? (globalThis as { location?: { href: string } }).location?.href;

  const cache = await cs.open(CACHE_PESADOS);
  for (const p of alvos) {
    if (!p.url) { conta({ id: p.id, estado: 'sem-fonte', erro: p.porQueNaoTemFonte }); continue; }
    try {
      if (await cache.match(p.url)) { conta({ id: p.id, estado: 'ja-tinha' }); continue; }
      // from the delivery's own origin, never from the upstream host (ADR-0177)
      const naEntrega = caminhoNaEntrega(p.url);
      const resp = await buscar(base ? new URL(naEntrega, base).href : naEntrega);
      if (!resp.ok) { conta({ id: p.id, estado: 'falhou', erro: `HTTP ${resp.status}` }); continue; }
      /*
       * CHECKED BEFORE KEPT (issue #168; STRIDE client pass). What is kept runs in the child's page and is served offline
       * from then on, so a body whose SHA-256 is not the measured one never enters the cache.
       */
      if (!p.sha256 || !digest) {
        conta({ id: p.id, estado: 'falhou', erro: !p.sha256 ? 'this entry pins its sha256 nowhere: there is nothing to check it against' : 'this host cannot compute a sha256 (crypto.subtle needs a secure context)' });
        continue;
      }
      const corpo = await resp.arrayBuffer();
      const obtido = await digest(corpo);
      if (obtido !== p.sha256) {
        conta({ id: p.id, estado: 'falhou', erro: `sha256 mismatch: expected ${p.sha256}, got ${obtido} — not kept` });
        continue;
      }
      await cache.put(p.url, new Response(corpo, { status: resp.status, statusText: resp.statusText, headers: resp.headers }));
      conta({ id: p.id, estado: 'baixado', bytes: p.bytes });
    } catch (e) {
      conta({ id: p.id, estado: 'falhou', erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

const temSubtle = (): boolean => !!(globalThis as { crypto?: Crypto }).crypto?.subtle;

/** The SHA-256 of a body as lowercase hex, by `crypto.subtle` (issue #168). Needs a secure context. */
export async function sha256Hex(corpo: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(await (globalThis as { crypto: Crypto }).crypto.subtle.digest('SHA-256', corpo));
  return [...bytes].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** O peso do que ainda falta, em bytes — para um aviso poder dizer «faltam 241 MB» antes de começar. */
export function pesoPorBaixar(relatorio: readonly RelatorioPesado[]): number {
  const feitos = new Set(relatorio.filter((r) => r.estado === 'ja-tinha' || r.estado === 'baixado').map((r) => r.id));
  return PESADOS.filter((p) => p.url && !feitos.has(p.id)).reduce((s, p) => s + (p.bytes ?? 0), 0);
}
