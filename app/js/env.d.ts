// SPDX-License-Identifier: AGPL-3.0-or-later
// Tipos de ambiente do build. __BUILD__ é injetado pelo Vite (define) em vite.config.ts — carimbo de versão.
declare const __BUILD__: { version: string; sha: string; date: string; env: string };

/**
 * O módulo VIRTUAL do atlas de sprites (item 22, X2) — gerado por `scripts/vite-plugin-atlas.mjs`.
 *
 * Existe só em tempo de build/dev; o `tsc` precisa da declaração para não acusar módulo inexistente. O tipo
 * é o CONTRATO entre o plugin e o `render/sprites`: se um dos dois mudar de forma, isto aqui é o que reprova.
 */
declare module 'virtual:sprite-atlas' {
  /** Caminho do PNG empacotado, relativo à raiz servida. */
  export const ATLAS_URL: string;
  /** `anim/idx` → retângulo do quadro dentro do atlas. */
  export const FRAMES: Record<string, { x: number; y: number; w: number; h: number }>;
}

/**
 * OS GANCHOS DE TESTE PENDURADOS NA `window`, declarados porque o `main.ts` os cria e os estende.
 *
 * `__incl` é o objeto que o PROTOCOLO DE VERIFICAÇÃO deste projeto usa: conferir o boot é conferir que
 * `typeof window.__incl === 'object'`, e daí ler `phase`, `players`, `canvas`. Ele não é detalhe de
 * implementação — é contrato, e por isso está aqui e não num `as any` no ponto de uso.
 *
 * ⚠️ A DECLARAÇÃO É UM PISO, NÃO O CONTRATO INTEIRO, e isso é dito em vez de disfarçado: o objeto tem cerca
 * de cinquenta membros montados num literal só, e os testes de navegador o leem em tempo de execução, sem
 * tipo. O índice `[k: string]` é o que deixa esse literal ser atribuído; os três nomeados são os que o
 * `main.ts` acrescenta DEPOIS da criação, e esses o compilador passa a cobrar. Declarar os cinquenta é
 * trabalho que só paga quando o `__incl` virar a API de teste da engine — hoje ele é do jogo, que está de
 * mudança (ADR-0036).
 */
interface InclTestHooks {
  [k: string]: unknown;
  layout?: () => void;
  showTouch?: () => void;
  get_librasOpen?: () => boolean;
}

interface Window {
  /** O parser de mapa em glifo, exposto para o harness de navegador. */
  __tiles?: unknown;
  __incl?: InclTestHooks;
}

/**
 * TELA CHEIA COM PREFIXO DE FORNECEDOR, e ela é declarada em vez de convertida porque é uma API DE VERDADE:
 * o Safari — inclusive o do iPad, que é a máquina de várias escolas — só oferece `webkitRequestFullscreen`.
 * O `main.ts` já faz a detecção certa (`el.requestFullscreen || el.webkitRequestFullscreen`); o que faltava
 * era o `lib.dom` conhecer o segundo nome.
 *
 * Opcional porque em Chrome e Firefox ele não existe — e é justamente por ser opcional que a detecção do
 * `main.ts` continua sendo obrigatória. Um cast ali teria calado o compilador e apagado essa obrigação.
 */
interface HTMLElement {
  webkitRequestFullscreen?: () => void;
}
