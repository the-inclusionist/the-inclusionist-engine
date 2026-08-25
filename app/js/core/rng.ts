// SPDX-License-Identifier: AGPL-3.0-or-later
// core/rng.ts — RNG semeado (LCG determinístico) p/ reprodutibilidade (coin placement / testes estáveis).
// Módulo-folha PURO, ZERO deps. _seed é privado; a sequência é IDÊNTICA à do monólito (mesma semente + mesma
// ordem de chamada). reseed() permite reproduzir/randomizar (o jogo final pode semear por nível). (Fase 2.26 / Tier 1)
let _seed = 20260601;
export const reseed = (s: number): void => { _seed = s >>> 0; };
export const rnd = (): number => (_seed = (_seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
export const randInt = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));
export const shuffle = <T>(arr: readonly T[]): T[] => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
