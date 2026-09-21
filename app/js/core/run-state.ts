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
// compartilhada = PÁGINA; em chave `gameKey()` = JOGO; NÃO persistido = RODADA. Estes cinco campos não são
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
import type { Player } from './entity.js';

/**
 * OS EXTRAS DO NÍVEL — o que o mapa monta a cada rodada e ninguém persiste.
 *
 * `P` é o tipo do power-up, e ele vem de quem cria a instância. Ver a nota do genérico no cabeçalho.
 */
export interface LevelExtras<P> {
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
 * O `wcSolid` fica FORA do `LevelExtras` porque ele não nasce com os outros quatro: a geometria de
 * cadeirante é recalculada por conta própria quando o modo liga ou desliga, e tem setter só dela. Juntá-los
 * num objeto só faria a assinatura mentir sobre quando cada um muda.
 */
export interface RunState<P> extends LevelExtras<P> {
  /** Sólidos que só existem no modo cadeirante — rampas e plataformas, como chaves `"x,y"`. */
  wcSolid: ReadonlySet<string>;

  /**
   * OS JOGADORES (1..4). Sem setter, e isso é declaração, não esquecimento: o array NUNCA é reatribuído —
   * ele é mutado no lugar (`push`, `splice`, `length`, `players[i]`), e quem faz isso é `game/session`, que
   * é o dono da entrada e da saída de jogador. Um setter aqui daria a impressão de que trocar a lista
   * inteira é uma operação prevista, e ela não é: as referências que os módulos guardam sobreviveriam à
   * troca apontando para a lista velha.
   *
   * `Player[]` é a visão da ENGINE. Cada jogo acrescenta campos (o `GamePlayer` daqui tem `quiz`), e os
   * consumidores que precisam deles estreitam por conta própria — a dívida de conversões que isso gera é
   * anterior a este arquivo e não muda com a mudança de endereço.
   */
  players: Player[];

  /**
   * QUANTOS jogadores/telas (1..4). Não persistido — a partida seguinte começa com um de novo, que é o
   * comportamento que uma sala de aula quer.
   */
  numPlayers: number;

  /** A rodada acabou (vitória). Trava a entrada e deixa o cenário simulando por trás do aviso. */
  ended: boolean;
  /** Semente da decoração do cenário. Sorteada a cada fase DE PROPÓSITO — é o que faz duas partidas da
   *  mesma fase não terem a mesma grama. */
  decorSeed: number;
  /** Fração das superfícies com grama: 1 = todas, 0.6 = 60% (a base das estações que virão). */
  grassDensity: number;
  /** QUAL jogador os painéis de acessibilidade visual estão editando. Não é preferência — é qual aba está
   *  aberta —, e por isso não se persiste: guardá-la faria a criança reabrir o jogo já editando o jogador 2. */
  selVizPlayer: number;
  /**
   * QUEM abriu o menu de pausa, e portanto o ESCOPO de tudo o que se faz dentro dele.
   *
   * Importa mais do que parece: em telas separadas, este índice é o que faz o menu do jogador 2 editar as
   * configurações DELE. Errar aqui não dá erro — dá a criança certa mexendo nos ajustes da criança errada,
   * em silêncio.
   */
  pauseActor: number;
  /**
   * Grava os quatro extras JUNTOS, que é como eles nascem.
   *
   * Um setter só, e não quatro, porque eles são um resultado só: `game/level-geometry.computeExtras()`
   * devolve os quatro de uma vez, e gravá-los separadamente abriria uma janela em que o portão de um nível
   * convive com os tiles de outro.
   */
  setLevelExtras(x: LevelExtras<P>): void;
  /** Abre ou fecha o portão. É o único dos cinco que muda DURANTE a rodada. */
  setGateOpen(v: boolean): void;
  /** Troca os sólidos de cadeirante (recalculados quando a geometria do nível muda). */
  setWcSolid(s: ReadonlySet<string>): void;

  setEnded(v: boolean): void;
  setDecorSeed(s: number): void;
  /**
   * ⚠️ O CLAMP MORA AQUI, e é a razão de este setter existir.
   *
   * `grassDensity` é uma FRAÇÃO, e antes de `core/state` a proteção vivia no `window.__incl` — ou seja, só
   * quem entrasse por ali era protegido. Qualquer outro caminho podia escrever 5 ou -1 e o cenário nascia
   * errado sem nada reclamar. Um valor com faixa válida que depende de quem escreve é um valor sem faixa.
   */
  setGrassDensity(v: number): void;
  setSelVizPlayer(i: number): void;
  setPauseActor(i: number): void;
  /** Troca o número de jogadores e AVISA (ver `RunOptions.aoTrocarJogadores`). */
  setNumPlayers(n: number): void;
}

/**
 * O que a rodada precisa saber do mundo lá fora. Hoje é uma coisa só, e ela existe por um motivo concreto.
 *
 * `core/state.setNumPlayersValue` emitia `numPlayers` no barramento. Mover o campo para cá e simplesmente
 * PARAR de emitir removeria em silêncio uma capacidade que a Fase C acabou de formalizar — e removê-la sem
 * ninguém notar (o barramento ainda não tem assinante) é exatamente o tipo de perda que este repositório
 * escreve ADR para não repetir.
 *
 * Então o aviso entra por INJEÇÃO, como o cabeçalho deste arquivo prometeu, e é OPCIONAL: uma rodada sem
 * barramento funciona igual. Avisos são para painéis, e um painel ausente não é erro.
 */
export interface RunOptions {
  /** Chamado depois de `setNumPlayers`. Na raiz de composição é `(n) => emit('numPlayers', n)`. */
  aoTrocarJogadores?: (n: number) => void;
}

/**
 * Cria uma rodada. Sem I/O, sem estado de módulo, sem `emit` — quem quiser avisar alguém avisa por fora.
 *
 * ⚠️ OS EVENTOS FICARAM DE FORA DE PROPÓSITO. `core/state` emitia `gateOpen` e `wcSolid`, e o barramento
 * tinha ZERO assinantes (medido: 25 nomes de evento, 26 `emit()`, nenhum `on()`). Emitir para ninguém é
 * cerimônia, e mantê-la aqui obrigaria a fábrica a depender do barramento — justo o que a Fase C vai
 * refazer. Quando existir o primeiro assinante, ele entra por injeção, com o barramento já tipado.
 */
export function createRunState<P>(opcoes: RunOptions = {}): RunState<P> {
  const r: RunState<P> = {
    powerups: [],
    gateTiles: new Set<string>(),
    gate: null,
    gateOpen: true,
    wcSolid: new Set<string>(),
    players: [],
    numPlayers: 1,
    setLevelExtras(x: LevelExtras<P>): void {
      r.powerups = x.powerups;
      r.gateTiles = x.gateTiles;
      r.gate = x.gate;
      r.gateOpen = x.gateOpen;
    },
    setGateOpen(v: boolean): void { r.gateOpen = v; },
    setWcSolid(s: ReadonlySet<string>): void { r.wcSolid = s; },

    ended: false,
    decorSeed: 0,
    grassDensity: 1,
    selVizPlayer: 0,
    pauseActor: 0,
    setEnded(v: boolean): void { r.ended = !!v; },
    setDecorSeed(s: number): void { r.decorSeed = s >>> 0; },
    setGrassDensity(v: number): void { r.grassDensity = Math.max(0, Math.min(1, +v || 0)); },
    setSelVizPlayer(i: number): void { r.selVizPlayer = i; },
    setPauseActor(i: number): void { r.pauseActor = i; },
    setNumPlayers(n: number): void { r.numPlayers = n; opcoes.aoTrocarJogadores?.(n); },
  };
  return r;
}
