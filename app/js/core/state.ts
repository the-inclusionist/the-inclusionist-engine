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

// --- modoCego: MODO CEGO (A12e auditiva). Só as ajudas de áudio — bengala, sonar, guarda de beirada,
//     narração —, sem tela preta; a simulação de cegueira do Modo Empatia é outra coisa e liga esta por cima.
//
//     Migrado do main.js (ADR-0027 passo 4 / #50). Era a variável com MAIS encanamento de injeção do projeto:
//     dezesseis sítios em seis módulos passavam `getModoCego`/`setModoCego` por ctx, e a colisão a lia por
//     closure. Estado que seis módulos consultam não é do composition root; e enquanto for, `createGame()` não
//     pode existir sem capturá-la, que é justamente o teste de fronteira que o ADR-0027 quer rodar.
//
//     O SETTER FAZ TRÊS COISAS E SÓ TRÊS: grava, persiste, avisa. Os efeitos que o main.js pendurava no
//     antigo `setModoCego` — refazer os extras do nível, refletir o painel, anunciar ao leitor de tela — NÃO
//     entram aqui: são reação, e quem reage assina o evento. Um setter que sabe redesenhar a tela é um setter
//     que nenhum teste consegue chamar. ---
export let modoCego: boolean = store.getBool('incl_modocego');
export function setModoCegoValue(on: boolean): void {
  if (modoCego === on) return; // a guarda VEM DO ORIGINAL: sem ela o anúncio repetiria a cada clique redundante
  modoCego = on; store.setBool('incl_modocego', on); emit('modoCego', on);
}

// --- O ESTADO DO NÍVEL: portão, sólidos-só-cadeirante e power-ups.
//
//     Estes cinco não são preferência de ninguém: são o RESULTADO de `game/level-geometry.setupExtras()`, que
//     lê o mapa e devolve os quatro primeiros de uma vez, mais `buildWcGeom()`, que devolve o quinto. Moravam
//     no main.js porque `core/collision` precisa lê-los a cada consulta de tile e o main.js era o único lugar
//     que as duas pontas alcançavam.
//
//     Agora as duas pontas alcançam `core/state`, que é da mesma camada da colisão. A injeção da colisão FICA
//     como está de propósito: tirá-la tocaria treze arquivos de teste que hoje montam mundos falsos por
//     `initCollision(ctx)`, e trocar treze montagens de teste é mudança de arquitetura, não arrumação. O que
//     este passo faz é menor e suficiente: o main.js deixa de ser DONO do estado, que é o que `createGame()`
//     precisa para existir sem capturá-lo.
//
//     `setLevelExtras` recebe os quatro juntos porque é assim que nascem — uma desestruturação única no
//     main.js, que em ESM não pode mais existir (não se atribui a um binding importado). Separá-los em quatro
//     chamadas convidaria alguém a atualizar três e esquecer a quarta. ---

/**
 * Um tile do portão. O portão é uma LISTA deles, não um objeto com posição — escrevi `{x, y}` na primeira
 * versão e o navegador me desmentiu: `gate` é `[{tx:29,ty:36}, {tx:30,ty:36}, …]`.
 *
 * O `tsc` não podia pegar. Quem chama `setLevelExtras` é o `main.js`, que é JavaScript, então o tipo declarado
 * aqui não tinha do outro lado nada que o contradissesse. É um argumento concreto para o `createGame()` do
 * passo 4 nascer em TypeScript: enquanto o composition root for JS, todo contrato que só ele exercita é uma
 * afirmação sem verificador.
 *
 * Mínimo ESTRUTURAL, como o `PlayerQuiz`: o `MapGateTile` de verdade mora em `game/level-geometry` e é
 * atribuível a este. `core/` não importa de `game/`.
 */
export interface GateTile { readonly tx: number; readonly ty: number }

export let gateTiles: ReadonlySet<string> = new Set(); // "tx,ty" dos tiles do portão
export let gateOpen = true;                            // fechado ⇒ os tiles acima são sólidos
export let gate: readonly GateTile[] | null = null;
/** Os power-ups do nível. `unknown` de propósito: o `Powerup` real carrega um `PIXI.Sprite`, e `core/` não
 *  conhece PIXI — nem precisa, porque ninguém aqui olha para dentro deles. */
export let powerups: readonly unknown[] = [];

/** O que `game/level-geometry.setupExtras()` devolve — gravado em bloco, como nasce. */
export function setLevelExtras(x: {
  powerups: readonly unknown[]; gateTiles: ReadonlySet<string>; gate: readonly GateTile[] | null; gateOpen: boolean;
}): void {
  powerups = x.powerups; gateTiles = x.gateTiles; gate = x.gate; gateOpen = x.gateOpen;
  emit('levelExtras', x);
}

/** O portão abriu (ou fechou) durante a partida — o único dos cinco que muda fora da montagem do nível. */
export function setGateOpenValue(v: boolean): void {
  if (gateOpen === v) return;
  gateOpen = v; emit('gateOpen', v);
}

/** Sólidos que existem SÓ no modo cadeirante — pontes e plataformas que substituem degraus. */
export let wcSolid: ReadonlySet<string> = new Set();
export function setWcSolidValue(s: ReadonlySet<string>): void { wcSolid = s; emit('wcSolid', s); }

// --- letterCase: as letras aparecem em CAIXA ALTA ou minúscula. É escolha pedagógica, não estética: a
//     alfabetização brasileira costuma começar em caixa alta, e a criança que já passou dessa fase precisa da
//     minúscula. Lido pelo `disp` que o quiz usa em toda letra que exibe ou soletra.
//
// --- captionsOn: legendas dos sons (a11y surdez).
//
//     ESTES DOIS NÃO PERSISTEM, e a ausência é deliberada em vez de esquecida: ao contrário de `caneBlockDiv`
//     — que tinha chave registrada em storage.KEYS e uma gravação faltante, ou seja, uma intenção quebrada —
//     nenhum dos dois tem chave prevista nem leitura no boot. Não há indício de que alguém tenha decidido que
//     deviam sobreviver à sessão. Acrescentar persistência aqui seria inventar a decisão, não cumpri-la; a
//     pergunta está registrada como issue. Por isso o setter faz DUAS coisas: grava e avisa. ---
export type LetterCase = 'lower' | 'upper';
export let letterCase: LetterCase = 'upper';
export function setLetterCaseValue(c: LetterCase): void {
  if (letterCase === c) return;
  letterCase = c; emit('letterCase', c);
}

export let captionsOn = true;
export function setCaptionsOnValue(on: boolean): void {
  const v = !!on;
  if (captionsOn === v) return;
  captionsOn = v; emit('captionsOn', v);
}

// --- cbSafe: PALETA SEGURA PARA DALTONISMO (Okabe-Ito). Não é um filtro sobre a imagem — é a escolha das
//     cores de origem, aplicada IN-PLACE em PCOLOR para que todo mundo que já referencia a array veja a troca. ---
export let cbSafe: boolean = store.getBool(store.KEYS.cbsafe, false);
export function setCbSafeValue(on: boolean): void {
  const v = !!on;
  if (cbSafe === v) return;
  cbSafe = v; store.setBool(store.KEYS.cbsafe, v); emit('cbSafe', v);
}

// --- ownerColors: no multijogador, cada item aparece na cor de QUEM pode pegá-lo. Desligado, todos veem a cor
//     original — o que é preferível para quem não distingue as cores dos donos. ---
export let ownerColors: boolean = store.getBool(store.KEYS.ownercolors, true);
export function setOwnerColorsValue(on: boolean): void {
  const v = !!on;
  if (ownerColors === v) return;
  ownerColors = v; store.setBool(store.KEYS.ownercolors, v); emit('ownerColors', v);
}

/** Espessura de contorno: 0 nenhum · 1 fino · 2 grosso. Fora da faixa satura, não rejeita. */
export type OutlineLevel = 0 | 1 | 2;
const nivelContorno = (v: number): OutlineLevel => Math.max(0, Math.min(2, v | 0)) as OutlineLevel;

// --- hcOutlineFg / hcOutlineBg: CONTORNOS do alto contraste, e são dois porque servem a critérios diferentes.
//     `fg` contorna o primeiro plano — personagem e itens — e atende a WCAG 2.4.7 (foco visível). `bg` contorna
//     o perímetro externo de plataforma, água e lava, delimitando navegável × não-navegável, e atende a
//     WCAG 1.4.11 (contraste de componente ≥ 3:1). Confundi-los apagaria uma das duas garantias.
//
//     A saturação em 0..2 vem do original e é dupla: no boot (contra um localStorage corrompido) e na escrita
//     (contra um chamador). No main.js isso obrigava a declarar com um valor provisório e reatribuir na linha
//     seguinte, porque a leitura saturada não cabia no mesmo `let`; aqui a função a resolve de uma vez. ---
export let hcOutlineFg: OutlineLevel = nivelContorno(store.getNum(store.KEYS.outfg, 1));
export function setOutlineFgValue(v: number): void {
  const n = nivelContorno(v);
  if (hcOutlineFg === n) return;
  hcOutlineFg = n; store.set(store.KEYS.outfg, n); emit('hcOutlineFg', n);
}
export let hcOutlineBg: OutlineLevel = nivelContorno(store.getNum(store.KEYS.outbg, 1));
export function setOutlineBgValue(v: number): void {
  const n = nivelContorno(v);
  if (hcOutlineBg === n) return;
  hcOutlineBg = n; store.set(store.KEYS.outbg, n); emit('hcOutlineBg', n);
}

// --- caneBlockDiv: espaçamento da batida da BENGALA, em blocos pisados. 1 = uma batida por bloco;
//     2 = uma batida a cada meio bloco. Não é preferência de som: é a resolução com que uma criança cega
//     mede a distância que andou, e por isso a colisão a lê a cada passo. ---
export let caneBlockDiv: number = store.getNum('incl_cane_div', 1) || 1;
export function setCaneBlockDivValue(div: number): void {
  const d = (+div) || 1; // o `|| 1` vem do original: um valor corrompido no localStorage viraria NaN e a
  if (caneBlockDiv === d) return; //  bengala pararia de bater, que é o modo de falha mais silencioso possível
  caneBlockDiv = d; store.set('incl_cane_div', d); emit('caneBlockDiv', d);
}

// --- wheelchair: MODO CADEIRANTE. Muda a geometria do nível inteiro — degraus e escada viram rampas e
//     elevadores, moedas descem para o chão, lava vira chão, e só voo e super-corrida sobrevivem como poderes.
//     Por isso a colisão a lê: `isSolidType` responde diferente com ela ligada. ---
export let wheelchair: boolean = store.getBool('incl_wheelchair');
export function setWheelchairValue(on: boolean): void {
  if (wheelchair === on) return;
  wheelchair = on; store.setBool('incl_wheelchair', on); emit('wheelchair', on);
}

// --- oneButton: UM BOTÃO POR VEZ. Ignora combinações simultâneas, para quem não consegue pressionar duas
//     teclas ao mesmo tempo. ---
export let oneButton: boolean = store.getBool('incl_onebtn');
export function setOneButtonValue(on: boolean): void {
  if (oneButton === on) return;
  oneButton = on; store.setBool('incl_onebtn', on); emit('oneButton', on);
}
