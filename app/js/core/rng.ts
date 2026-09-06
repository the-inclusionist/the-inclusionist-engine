// SPDX-License-Identifier: AGPL-3.0-or-later
// core/rng.ts — RNG semeado (LCG determinístico) p/ reprodutibilidade (coin placement / testes estáveis).
// Módulo-folha PURO, ZERO deps.
//
// ⚠️ DUAS COISAS MUDARAM AQUI NA MESMA MIGRAÇÃO, E ISSO É DE PROPÓSITO (issue #107).
//
// 1. `createRng(semente)` existe. A regra D13 do ADR-0038 — «um módulo que guarda estado exporta uma
//    fábrica `createX()`» — nomeava este módulo desde sempre e a conversão nunca aconteceu. O preço foi
//    medido pelo `game-15puzzle`, o segundo consumidor externo: com uma única corrente compartilhada por
//    doze módulos (`game/*`, `render/fx`, `render/weather`, `render/draw`), «embaralhamento determinístico
//    a partir da semente S» só é reproduzível numa página onde mais nada desenha — e a engine existe
//    justamente para que o jogo NÃO esteja sozinho na página. Cada consumidor faz a sua corrente.
//
// 2. A aritmética do LCG estava a perder precisão. `_seed * 1103515245` com `_seed` perto de 2³¹ chega a
//    ~2,37×10¹⁸, acima de 2⁵³: os bits BAIXOS — exatamente os que o `& 0x7fffffff` guarda — eram
//    arredondados fora antes de a máscara correr. `Math.imul` faz a multiplicação em 32 bits, que é o que
//    um LCG de 32 bits sempre quis dizer.
//
// ⚠️ POR QUE AS DUAS JUNTAS. Cada uma sozinha muda a sequência semeada. Fazer uma hoje e a outra depois
// mudaria as sequências DUAS vezes, e da segunda vez ninguém se lembraria do porquê — o defeito ficaria a
// parecer regressão. Uma migração, uma mudança de sequência, uma explicação.
//
// ⚠️ O QUE NÃO MUDA: continua determinístico. A aritmética antiga também era reprodutível (ponto flutuante
// é determinístico), e foi por isso que o defeito nunca apareceu: não era aleatoriedade errada, era um
// gerador PIOR do que o que foi escrito. Fixtures que dependiam dos valores concretos mudam de valor.

/** Uma corrente de números pseudoaleatórios independente de qualquer outra. */
export interface Rng {
  /** [0, 1). */
  readonly rnd: () => number;
  /** Inteiro em [lo, hi], ambos inclusive. */
  readonly randInt: (lo: number, hi: number) => number;
  /** Cópia baralhada (Fisher-Yates); não toca no original. */
  readonly shuffle: <T>(arr: readonly T[]) => T[];
  /** Reposiciona ESTA corrente. Não alcança nenhuma outra. */
  readonly reseed: (s: number) => void;
}

/** A semente do jogo próprio da engine. Um consumidor externo escolhe a sua. */
export const SEMENTE_PADRAO = 20260601;

export const createRng = (semente: number = SEMENTE_PADRAO): Rng => {
  let _seed = semente >>> 0;
  // `Math.imul` e não `*`: ver o cabeçalho. O `+ 12345` cabe em segurança porque `imul` já devolveu
  // um inteiro de 32 bits com sinal, e a máscara `& 0x7fffffff` desfaz o sinal.
  const rnd = (): number => (_seed = (Math.imul(_seed, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff;
  const randInt = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));
  const shuffle = <T>(arr: readonly T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const reseed = (s: number): void => { _seed = s >>> 0; };
  return { rnd, randInt, shuffle, reseed };
};

// ⚠️ A CORRENTE DO JOGO PRÓPRIO DA ENGINE, e SÓ dela. Existe porque `game/` ainda vive aqui dentro
// (issue #111: o cartucho que ainda não saiu, ADR-0036/ADR-0083). Quando `game/` sair, isto sai com ele.
// UM CONSUMIDOR EXTERNO NÃO DEVE IMPORTAR ESTES QUATRO — são estado partilhado, que é o defeito que a
// fábrica acima conserta. Faça `createRng(suaSemente)`.
const _padrao = createRng(SEMENTE_PADRAO);
export const reseed = _padrao.reseed;
export const rnd = _padrao.rnd;
export const randInt = _padrao.randInt;
export const shuffle = _padrao.shuffle;

// ⚠️ A CORRENTE DA DECORAÇÃO, separada da de cima porque a mistura era o defeito CONCRETO.
// `render/fx` tira um número por partícula, `render/weather` por gota, `render/draw` dois por tremor de
// câmara — dezenas por quadro. Saindo da mesma corrente das moedas, «semeie com S e o mapa sai igual»
// passava a depender de quantas partículas a tela desenhou antes, o que ninguém controla nem repara.
// Enfeite NÃO pode mover o sorteio do jogo. São dois assuntos, e agora são duas correntes.
// A semente é outra de propósito: se fosse a mesma, as duas correntes andariam em paralelo e o enfeite
// ficaria correlacionado com o mapa — determinístico, mas visivelmente repetitivo.
export const rngDecoracao = createRng(SEMENTE_PADRAO ^ 0x5eed);
