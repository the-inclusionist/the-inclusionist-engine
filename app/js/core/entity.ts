// SPDX-License-Identifier: AGPL-3.0-or-later
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

// ⚠️ O PRIMEIRO IMPORT DESTE FICHEIRO, e ele é de propósito: `core/actions` é da MESMA camada e é a fonte
// única das quatorze posições. A regra que `core/` respeita é não importar de `game/` nem de `render/` —
// depender de um vizinho de camada que é puro dado não a viola, e é o que permite fechar o `KeyScheme`.
import type { Action } from './actions.js';

/**
 * Ação → lista de códigos físicos (`KeyA`, `ArrowLeft`…). Fonte única: estava triplicado em input/.
 *
 * ⚠️ FECHADO EM `Action` DESDE 2026-09-07 (issue #118, decisão do Dev), e era `Record<string, string[]>`.
 * Enquanto foi aberto, **faltar uma posição não dava erro de compilação** — e foi assim que o esquema de
 * dupla ficou com oito das quatorze, e que a `Space` do jogador 1 desapareceu sem que nada apitasse. O
 * defeito não era de digitação: era de o tipo aceitar um esquema incompleto como se fosse completo.
 *
 * ⚠️ E `null` NÃO É BURACO — é AUSÊNCIA DECLARADA, e é a metade que dá sentido a fechar o tipo. Um teclado
 * partido por quatro pode não ter lugar físico para ombros e gatilhos; dizer `null` afirma isso, e é o que o
 * aviso de alcance (`ui/reach-notice`, issue #112) lê para dizer à criança, ANTES de ela começar, quais das
 * ações do jogo o controlo dela não alcança. Inventar teclas para preencher seria mentir-lhe em silêncio.
 *
 * Quem consome tem de tratar o `null`: `input/keyboard-runtime`, `input/touch-bindings` e
 * `ui/settings-controls` fazem-no, e é isso que impede um `null` de virar um `undefined.includes`.
 */
export type KeyScheme = Record<Action, readonly string[] | null>;

/** Lados da ventosa-aranha: direita, esquerda, teto, chão. */
export type ClingSide = 'R' | 'L' | 'U' | 'D';

/* (`PlayerQuiz` SAIU daqui em 2026-08-25 — ADR-0033. Está em `game/entity`, com o campo que o usava.) */

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
  /* (`quiz` SAIU daqui em 2026-08-25 — ADR-0033: a entidade da ENGINE declara o que a engine possui, e um
   *  desafio de alfabetização é do JOGO. Está em `game/entity.GamePlayer`, com os três módulos que o leem de
   *  verdade — `game/physics`, `game/session` e `game/quiz`. A camada de ENTRADA deixou de precisar dele
   *  quando passou a entregar INTENÇÃO em vez de rotear a tecla para dentro do desafio.) */

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
  /**
   * A ALTERNÂNCIA DO BOTÃO DE CORRER (pedido do Dev): correr vira ESTADO em vez de "segurar".
   *
   * Irmã de `toggleMove` e pelo mesmo motivo — quem não consegue manter pressionado andava sem segurar e
   * continuava sem conseguir CORRER. Automática no controle de toque. Ver `game/run-toggle`.
   */
  toggleRun: boolean;
  /** A trava da corrida: com `toggleRun`, é ela que diz se está correndo agora. Vida de RODADA. */
  runLatch: boolean;
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
  /** render/fx → render/draw: fator de esmagamento (squash) e o temporizador que o decai (8 → 0).
   *  Os dois ANDAM JUNTOS — `stepSquash` escreve os dois e `drawPlayers` lê os dois. Declarar só o `sq`, como
   *  esta interface fazia até a conferência no navegador, é o erro de meia-dupla: o campo que sobra fica sem
   *  tipo nenhum e ninguém percebe, porque metade da regra continua compilando. */
  sq?: number;
  sqT?: number;
  /** render/player-anim → render/draw: o jogador está andando / correndo. Derivados por quadro a partir da
   *  velocidade e do estado de contato; existem porque a BENGALA precisa saber (a de corrida só aparece
   *  correndo, e correr exige `runCane`). Escritos pelo render, nunca pela fábrica. */
  walking?: boolean;
  running?: boolean;
  /** game/quiz: vitórias na atividade de alfabetização, zeradas a cada nova partida. */
  alfWins?: number;
  /** ui/settings-audio, ui/pause-icons: saída de áudio própria; `null`/ausente = compartilhada. */
  audioSink?: string | null;
  // `_ac` e `_acOut` NÃO ficam aqui (ADR-0039, opção A1). São o AudioContext e o nó de ganho da saída
  // dedicada, criados por `platform/audio-sonar`, que os declara em `PlayerAudioOut`. A entidade da engine
  // declara o que a ENGINE possui (ADR-0033), e um AudioContext por jogador é da plataforma de áudio.
  // Enquanto estavam aqui, a descrição mínima (`{ close(): void }` e `unknown`) discordava da real e o
  // `unknown` escondia a discordância — inclusive um `null` que o `ui/settings-audio` escreve e que o dono
  // não admitia.
  /** platform/audio-nav: temporizadores do sonar de parede e do guia. */
  wnT?: number;
  guideT?: number;
}

/**
 * Um jogador DEPOIS de `assignControls` — o `ctrl` deixou de ser `null`.
 *
 * Existe para dar nome a uma invariante que hoje é assumida em silêncio: `game/physics` e
 * `input/keyboard-runtime` declaram `ctrl` como não-nulo porque, no instante em que rodam, ele já foi
 * atribuído. Isso é verdade e continua verdade — mas era uma afirmação escondida dentro de uma interface
 * redigitada, onde ninguém a lia como afirmação. Aqui ela tem nome, e quem a usa está dizendo "eu só rodo
 * depois do boot", que é uma frase verificável, em vez de simplesmente não mencionar o `null`.
 */
export type ControlledPlayer = Player & { ctrl: KeyScheme };

/**
 * Atalho para as visões estreitas: `PlayerView<'x' | 'y'>` em vez de reescrever os campos.
 *
 * O ponto de não usar `Player` inteiro está no cabeçalho: o project `node` do Vitest monta jogadores de
 * mentira com só os campos que o módulo lê, e uma interface gorda obrigaria todo fixture a inventar 52.
 * Derivando, o módulo continua acoplado à sua fatia e o NOME e o TIPO de cada campo passam a ter fonte única.
 */
export type PlayerView<K extends keyof Player> = Pick<Player, K>;
