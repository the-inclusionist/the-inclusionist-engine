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
