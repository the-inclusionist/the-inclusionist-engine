// SPDX-License-Identifier: GPL-3.0-or-later
// core/entity — O JOGADOR, escrito UMA vez. Passo 1 do ADR-0027, e o único que o ADR chama de pré-requisito
// de todos os outros. Não move nada e não muda nada em tempo de execução: `tsc --noEmit` é o teste inteiro.
//
// O PROBLEMA QUE ISTO RESOLVE. `core/state.players` é `unknown[]`. O tipo se perde exatamente na fronteira em
// que a entidade atravessa o programa, então cada módulo que precisa de um jogador escreveu à mão a sua
// própria visão estrutural e fez cast. São VINTE E TRÊS — o ADR-0027 estimou dez, contei uma a uma e são 23 —
// e elas já não concordam entre si:
//
//   · `quiz` tem QUATRO formas: `unknown` (physics, session, touch), `Quiz | null` (quiz),
//     `{ kind: string } | null` (gamepad) e `{ kind?: string } | null` (keydown). O `kind` é obrigatório numa
//     e opcional na outra, para o MESMO objeto.
//   · `easy` é obrigatório em physics, gamepad e settings-motor; opcional em session, keydown, touch-bindings
//     e draw. Um jogador sem `easy` é aceito por metade do programa e rejeitado pela outra.
//   · `jumpEdge`, idem: obrigatório em physics/gamepad/attract, opcional em session/keydown/touch-bindings.
//   · `quit` é obrigatório em gamepad e hud, opcional em session. `toggleMove` é obrigatório em
//     settings-motor, opcional em pause-icons. `viz` é obrigatório em draw, opcional em pause-icons.
//   · `KeyScheme` (= `Record<string, string[]>`) está declarado três vezes: em input/keyboard-runtime,
//     input/keyboard e input/keydown.
//
// Nada disso é hipótese sobre o futuro: é a mesma forma de falha que já custou uma escalada quebrada no modo
// Fácil, quando três cópias da tabela ação→borda divergiram. Uma cópia que ninguém obriga a concordar diverge.
//
// COMO ISTO É USADO — e por que os módulos NÃO devem importar `Player` inteiro. A propriedade que faz o
// projeto testável no project `node` do Vitest é que cada módulo declara a fatia MÍNIMA de que precisa e o
// teste monta um objeto de mentira com só aqueles campos. Trocar 23 visões estreitas por uma interface gorda
// destruiria isso: todo fixture de teste passaria a ter de inventar 52 campos.
//
// A saída é derivar em vez de redigitar: `Pick<Player, 'x' | 'y' | 'vx'>` em vez de reescrever os três campos.
// O módulo continua acoplado só à sua fatia; o teste continua montando só aquilo; mas o NOME e o TIPO de cada
// campo passam a ter uma fonte única, e renomear um campo quebra a compilação de todos os consumidores no
// mesmo instante, que é precisamente o que hoje não acontece.
//
// A FRONTEIRA DE CAMADA. `core/` não pode importar de `game/` nem de `render/` — seria inverter a dependência.
// Por isso os campos que apontam para outras camadas entram aqui pelo MÍNIMO ESTRUTURAL: `core` sabe que o
// jogador tem um quiz, não sabe o que é um quiz. Os tipos ricos (`Quiz` em game/quiz, `PlayerSprite` em
// render/draw) são atribuíveis a estes, e é o compilador que garante isso no ponto de uso.

/** Ação → lista de códigos físicos (`KeyA`, `ArrowLeft`…). Fonte única: estava triplicado em input/. */
export type KeyScheme = Record<string, string[]>;

/** Lados da ventosa-aranha: direita, esquerda, teto, chão. */
export type ClingSide = 'R' | 'L' | 'U' | 'D';

/**
 * O mínimo que QUALQUER camada precisa saber de um quiz aberto. Todas as cinco variantes de `Quiz`
 * (game/quiz) satisfazem isto por construção: `kind` é o discriminante da união e `coinIndex`/`revealed`
 * vêm de `QuizCommon`. Quem precisa do quiz de verdade — só game/quiz — usa a união, não isto.
 */
export interface PlayerQuiz {
  kind: string;
  coinIndex: number;
  revealed: boolean;
}

/**
 * O sprite do jogador visto pelo jogo: posição, opacidade, escala e textura. Mesma forma que render/draw
 * declara como `PlayerSprite` — é um PIXI.Sprite reduzido ao que o jogo escreve nele, de propósito, para que
 * a lógica rode no project `node` com um sprite de mentira.
 */
export interface PlayerSpriteLike {
  x: number;
  y: number;
  alpha: number;
  visible: boolean;
  scale: { set(x: number, y: number): void };
  texture: unknown;
}

/**
 * O JOGADOR. Os campos até `_swapSonar` são os que `game/player.makePlayer` cria — todos obrigatórios, porque
 * a fábrica sempre os escreve. Depois vêm os que outros subsistemas ACRESCENTAM em tempo de execução, e esses
 * são opcionais porque um jogador recém-criado genuinamente não os tem.
 *
 * A distinção não é cosmética: hoje `physics` exige `elevTarget` como opcional e `gamepad` exige `quit` como
 * obrigatório, e as duas leem o MESMO objeto. Escrever de que lado da linha cada campo cai é metade do valor
 * deste arquivo.
 */
export interface Player {
  // --- identidade e corpo ---
  i: number;
  x: number;
  y: number;
  vx: number;
  vy: number;

  // --- contato com o mundo ---
  onGround: boolean;
  onLadder: boolean;
  inWater: boolean;
  clinging: boolean;
  /** Face à qual a ventosa-aranha está grudada; `null` quando não está grudado. */
  clingN: ClingSide | null;
  flying: boolean;
  airTime: number;

  // --- animação ---
  facing: number; // 1 = direita, -1 = esquerda
  anim: number;
  walkAnim: number;
  climbFrame: number;
  idleNow: boolean;
  idleTime: number;
  groundIdle: number;
  flavor: number;
  flavorT: number;
  /** Quadro corrente. `Frame` é `unknown` em render/player-anim — a textura é opaca para o jogo. */
  _tx: unknown;

  // --- movimento ---
  jumpBuffer: number;
  jumpChain: number;
  waterStroke: number;
  walkDir: number;
  hurtTimer: number;

  // --- bordas de entrada (um quadro de duração; input/edges é quem as liga) ---
  jumpEdge: boolean;
  runEdge: boolean;
  swapEdge: boolean;
  specialEdge: boolean;
  leftEdge: boolean;
  rightEdge: boolean;

  // --- progresso ---
  collected: number;
  owned: string[];
  activePower: string;
  hasKey: boolean;
  /** Quiz aberto, ou `null`. `game/quiz` estreita isto para a união `Quiz`. */
  quiz: PlayerQuiz | null;

  // --- configuração por jogador ---
  /**
   * Esquema de teclas. `makePlayer` nasce com `null` e `assignControls` preenche no boot — por isso o `| null`.
   * `game/physics` e `input/keyboard-runtime` declaram este campo como NÃO-nulo, o que é verdade no instante
   * em que eles rodam mas não é verdade no tipo. Divergência REAL, deixada visível aqui de propósito em vez de
   * apagada: quem estreitar precisa fazê-lo explicitamente, no ponto onde sabe que já foi atribuído.
   */
  ctrl: KeyScheme | null;
  /** Índice do gamepad, ou -1 quando o jogador não tem controle físico. */
  pad: number;
  viz: string;
  easy: boolean;
  toggleMove: boolean;
  rmWalk: boolean;
  rmBreath: boolean;
  rmFlavor: boolean;

  // --- cadência de áudio e detecção de segurar-trocar (sonar) ---
  stepT: number;
  guardT: number;
  _swapDown: boolean;
  _swapT: number;
  _swapSonar: boolean;

  // --- sprite (criado pelo render, não pela fábrica) ---
  sprite: PlayerSpriteLike | null;

  // ============================================================================================
  // Acrescentados em tempo de execução por outros subsistemas — opcionais porque um jogador
  // recém-criado não os tem.
  // ============================================================================================

  /** ui/shell, input/gamepad, ui/hud: o jogador pediu para sair. */
  quit?: boolean;
  /** game/session: entrou no meio da partida e aguarda a próxima rodada. */
  waiting?: boolean;
  /** game/level-geometry, game/physics: andar de destino do elevador em que está. */
  elevTarget?: number | null;
  /** game/physics: velocidade de queda memorizada para o som de impacto. */
  _fallV?: number;
  /** game/physics: distância pisada desde a última batida de bengala. */
  caneDist?: number;
  /** game/session, render/player-anim: usa a bengala de corrida (o cego só corre com ela). */
  runCane?: boolean;
  /** render/draw: fator de esmagamento (squash) do quadro corrente. */
  sq?: number;
  /** game/quiz: vitórias na atividade de alfabetização, zeradas a cada nova partida. */
  alfWins?: number;
  /** ui/settings-audio, ui/pause-icons: saída de áudio própria; `null`/ausente = compartilhada. */
  audioSink?: string | null;
  /** ui/settings-audio, platform/audio-nav: AudioContext próprio da saída dedicada. */
  _ac?: { close: () => void } | null;
  /** platform/audio-nav: nó de ganho da saída dedicada. */
  _acOut?: unknown;
  /** platform/audio-nav: temporizadores do sonar de parede e do guia. */
  wnT?: number;
  guideT?: number;
}
