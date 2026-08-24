// SPDX-License-Identifier: GPL-3.0-or-later
// core/state.ts — estado/cena do jogo (FONTE ÚNICA). Módulo-folha. As 8 mega-variáveis migram do game.js
// UMA A UMA, lidas como binding vivo (import) e escritas por setter.
// Bus mínimo (Map<evento, Set<fn>>) para os poucos leitores "de longe" que virão com os outros subsistemas.
import type { Player } from './entity.js';

import * as store from '../platform/storage.js'; // persistência (as mega-vars com chave leem/gravam aqui)

type Listener = (val: unknown) => void;
const _subs = new Map<string, Set<Listener>>();
export function on(evt: string, fn: Listener): () => void { if (!_subs.has(evt)) _subs.set(evt, new Set()); _subs.get(evt)!.add(fn); return () => off(evt, fn); }
export function off(evt: string, fn: Listener): void { const s = _subs.get(evt); if (s) s.delete(fn); }
function emit(evt: string, val: unknown): void { const s = _subs.get(evt); if (s) for (const fn of s) { try { fn(val); } catch (e) { /* noop */ } } }

// --- phase: 'title' | 'playing' | 'paused' (congela o jogo fora de 'playing') ---
// Leitura: importe `phase` (binding vivo) — as checagens `phase==='playing'` no game.js não mudam.
// Escrita: só via setPhaseValue() — aqui fica apenas o VALOR + evento; a reação de UI segue no setPhase() do game.js.
export type Phase = 'title' | 'playing' | 'paused';
export let phase: Phase = 'title';
export function setPhaseValue(p: Phase): void { phase = p; emit('phase', p); }

// --- quizLevel: 1..5 (nível do quiz de alfabetização; persistido em incl_quizlevel) ---
export let quizLevel: number = (() => { const v = store.getNum('incl_quizlevel', 2); return v >= 1 && v <= 5 ? v : 2; })();
export function setQuizLevelValue(n: number): void { quizLevel = Math.max(1, Math.min(5, n | 0)); store.set('incl_quizlevel', String(quizLevel)); emit('quizLevel', quizLevel); }

// --- numPlayers: 1..4 (nº de telas/jogadores; não persistido) ---
export let numPlayers = 1;
export function setNumPlayersValue(n: number): void { numPlayers = n; emit('numPlayers', n); }

// --- cenario: tema visual ativo (cidade/campo/…; persistido em incl_cenario). A validação contra CENARIOS e
//     o trabalho de textura ficam no setCenario() do game.js — aqui só o valor + persistência + evento. ---
export let cenario: string | null = null;
export function setCenarioValue(theme: string): void { cenario = theme; store.set('incl_cenario', theme); emit('cenario', theme); }

// --- activity: id da atividade selecionada (persistido em incl_activity). A validação contra ACTIVITIES
//     (objeto do game.js) fica no setActivity() do game.js — aqui só o valor cru + persistência + evento. ---
export let activity: string | null = store.get('incl_activity', 'ludico');
export function setActivityValue(id: string): void { activity = id; store.set('incl_activity', id); emit('activity', id); }

// --- vizMode: modo visual/cor ativo (persistido em incl_viz). A validação (VIZ_CYCLE) e o default por
//     prefers-contrast ficam no game.js. initVizMode NÃO persiste (o default de mídia deve seguir o SO a cada
//     boot; persistir travaria o rastreio de prefers-contrast). Mudanças do usuário usam setVizModeValue. ---
export let vizMode = 'normal';
export function initVizMode(mode: string): void { vizMode = mode; }
export function setVizModeValue(mode: string): void { vizMode = mode; store.set('incl_viz', mode); emit('vizMode', mode); }

// --- coins[]: moedas/coletáveis. Mutado IN-PLACE (push/forEach — usa a ref importada) mas também REATRIBUÍDO
//     (pickCoins/filter no game.js) — reatribuição via setCoins() (binding importado não pode ser reatribuído). ---
export let coins: unknown[] = [];
export function setCoins(arr: unknown[]): void { coins = arr; emit('coins', arr); }

// --- players[]: jogadores (1..4). NUNCA reatribuído (só mutado in-place: push/splice/length/players[i]) → não
//     precisa de setter; o main.js muta a referência importada. O array inicial (makePlayer) é populado no boot
//     pelo main.js (makePlayer é função de lá). A variável irmã `player` (= players[0]) fica local no main.js.
//
//     Era `unknown[]`, e essa era a origem das 23 visões estruturais: o tipo se perdia AQUI, na fronteira em
//     que a entidade atravessa o programa, e cada consumidor reconstruía o seu palpite. Agora é `Player[]`, o
//     que também aposenta os dois casts `as unknown as` que existiam só porque o TypeScript, com razão,
//     recusava converter `unknown[]` direto — e um cast duplo não estreita nada, desliga o verificador. ---
export let players: Player[] = [];
