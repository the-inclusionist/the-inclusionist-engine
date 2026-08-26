// SPDX-License-Identifier: AGPL-3.0-or-later
// core/run-state — O ESTADO DA RODADA, como fábrica (ADR-0038, Fase B do plano).
//
// ========================= POR QUE FÁBRICA, E NÃO MAIS `export let` =========================
// A D13 da especificação do `inclusionist-demos` diz, em uma linha:
//
//     "No module-level mutable state in the engine. A module that holds state exports a `createX()` factory."
//
// O motivo não é gosto: a casca do `demos` carrega JOGO APÓS JOGO NA MESMA PÁGINA. Estado de módulo
// sobrevive à troca, e o portão que ficou aberto no jogo anterior continua aberto no seguinte — a menos que
// alguém se lembre de zerar. "Alguém se lembra" não é mecanismo.
//
// O ADR-0038 cortou o estado por TEMPO DE VIDA, e o critério é mecânico: persistido em chave `incl_*`
// compartilhada = PÁGINA; em chave `kJogo()` = JOGO; NÃO persistido = RODADA. Estes cinco campos não são
// persistidos em lugar nenhum, e é por isso que estão aqui.
//
// ========================= POR QUE OS EXTRAS DE NÍVEL PRIMEIRO =========================
// Porque são a fatia que dá para mover inteira e conferir: `main.ts` é o ÚNICO módulo que os importava de
// `core/state`. Todos os outros — `core/collision`, `game/level-geometry`, `game/session`, `render/draw`,
// `render/viz-setters` — já os recebiam por injeção, cada um com o seu getter. A mudança encosta em dois
// arquivos, não em vinte, e o resto da RODADA (`players`, `numPlayers`, `ended`, `decorSeed`, `pauseActor`,
// `selVizPlayer`, `grassDensity`) segue depois, um grupo por vez.
//
// ========================= O GENÉRICO NÃO É ENFEITE =========================
// `powerups` era `readonly unknown[]` em `core/state`, e o `unknown` era o sintoma de uma regra: a engine
// NÃO PODE conhecer o tipo de um power-up, que é do jogo (ADR-0033). Mas `unknown` também não é um supertipo
// útil — nenhum consumidor consegue ler nada dele, e todos acabavam pedindo `Powerup[]`, o que produzia três
// erros de tipo no composition root.
//
// O genérico responde às duas coisas ao mesmo tempo: a ENGINE declara a FORMA (uma lista de power-ups que
// pertence à rodada) e o JOGO fornece o TIPO na hora de criar a instância. Ninguém precisa mentir.
import type { GateTile } from './state.js';

/**
 * OS EXTRAS DO NÍVEL — o que o mapa monta a cada rodada e ninguém persiste.
 *
 * `P` é o tipo do power-up, e ele vem de quem cria a instância. Ver a nota do genérico no cabeçalho.
 */
export interface ExtrasDoNivel<P> {
  /** Os power-ups espalhados pelo nível. `readonly`: quem lê não reordena. */
  powerups: readonly P[];
  /** Os tiles do portão, como chaves `"tx,ty"` — `core/collision` só pergunta `.has()`. */
  gateTiles: ReadonlySet<string>;
  /** A lista de tiles do portão, ou `null` quando o nível não tem portão. */
  gate: readonly GateTile[] | null;
  /** Portão aberto? FECHADO significa que os tiles acima são sólidos. */
  gateOpen: boolean;
}

/**
 * O estado de RODADA. Hoje são os extras do nível mais o `wcSolid`; os outros campos chegam nos próximos
 * passos da Fase B.
 *
 * O `wcSolid` fica FORA do `ExtrasDoNivel` porque ele não nasce com os outros quatro: a geometria de
 * cadeirante é recalculada por conta própria quando o modo liga ou desliga, e tem setter só dela. Juntá-los
 * num objeto só faria a assinatura mentir sobre quando cada um muda.
 */
export interface RunState<P> extends ExtrasDoNivel<P> {
  /** Sólidos que só existem no modo cadeirante — rampas e plataformas, como chaves `"x,y"`. */
  wcSolid: ReadonlySet<string>;
  /**
   * Grava os quatro extras JUNTOS, que é como eles nascem.
   *
   * Um setter só, e não quatro, porque eles são um resultado só: `game/level-geometry.computeExtras()`
   * devolve os quatro de uma vez, e gravá-los separadamente abriria uma janela em que o portão de um nível
   * convive com os tiles de outro.
   */
  setLevelExtras(x: ExtrasDoNivel<P>): void;
  /** Abre ou fecha o portão. É o único dos cinco que muda DURANTE a rodada. */
  setGateOpen(v: boolean): void;
  /** Troca os sólidos de cadeirante (recalculados quando a geometria do nível muda). */
  setWcSolid(s: ReadonlySet<string>): void;
}

/**
 * Cria uma rodada. Sem I/O, sem estado de módulo, sem `emit` — quem quiser avisar alguém avisa por fora.
 *
 * ⚠️ OS EVENTOS FICARAM DE FORA DE PROPÓSITO. `core/state` emitia `gateOpen` e `wcSolid`, e o barramento
 * tinha ZERO assinantes (medido: 25 nomes de evento, 26 `emit()`, nenhum `on()`). Emitir para ninguém é
 * cerimônia, e mantê-la aqui obrigaria a fábrica a depender do barramento — justo o que a Fase C vai
 * refazer. Quando existir o primeiro assinante, ele entra por injeção, com o barramento já tipado.
 */
export function createRunState<P>(): RunState<P> {
  const r: RunState<P> = {
    powerups: [],
    gateTiles: new Set<string>(),
    gate: null,
    gateOpen: true,
    wcSolid: new Set<string>(),
    setLevelExtras(x: ExtrasDoNivel<P>): void {
      r.powerups = x.powerups;
      r.gateTiles = x.gateTiles;
      r.gate = x.gate;
      r.gateOpen = x.gateOpen;
    },
    setGateOpen(v: boolean): void { r.gateOpen = v; },
    setWcSolid(s: ReadonlySet<string>): void { r.wcSolid = s; },
  };
  return r;
}
