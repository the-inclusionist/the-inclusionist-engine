// SPDX-License-Identifier: AGPL-3.0-or-later
// render/player-anim.ts — A ESCOLHA DO QUADRO do personagem: dado o estado do jogador, QUAL textura desenhar.
// Extraída verbatim da segunda metade do `stepPlayer` do game.js (o trecho E15/E16/E17/E19/E20, de
// `const COYOTE=5` até `pl._tx=tx`). Ela morava dentro da função de física por acidente histórico — mas não é
// física: não move ninguém, não colide, não lê o mundo. É uma DECISÃO PURA a partir do estado já simulado,
// e é por isso que ela é render e mora aqui, ao lado de render/sprites (quem cria as texturas) e de
// render/viewports (quem as recolore por modo de visão).
//
// POR QUE A FRONTEIRA CAIU EXATAMENTE AQUI
// O `stepPlayer` do monólito fazia quatro coisas em sequência: (1) física, (2) coleta de moeda/quiz,
// (3) power-ups + chave/portão, (4) animação. A (1) já saiu para game/physics.ts (B1), que devolve
// `{ran, dir}` — e `dir` existe justamente porque a animação lê a DIREÇÃO DO INPUT, não `vx` (a colisão zera
// `vx` por quadros inteiros e isso reiniciava o ciclo de passos; só apareciam 2 dos 8 quadros). As (2) e (3)
// são LÓGICA DE JOGO — dependem de `coins`, `powerups`, `gate`, do quiz e do HUD — e continuam no game.js;
// não vieram junto de propósito, porque arrastá-las para cá traria de volta metade do monólito.
// O corte começa em `const COYOTE=5` e termina em `pl._tx=tx`. A ÚLTIMA linha do original,
// `if(pl.sprite) pl.sprite.texture=playerVizTex(tx, pl.viz)`, NÃO está aqui: ela toca um sprite do PIXI e o
// recolor por modo de visão. Ela vive em render/draw.ts (`animatePlayer`), que é quem já lida com PIXI.
// Assim este arquivo fica sem PIXI, sem DOM e sem estado de módulo — testável quadro a quadro no project
// `node` do Vitest.
//
// O QUE É "PURO" AQUI (e o que não é)
// A função é DETERMINÍSTICA dado `(pl, env)` e não faz I/O nenhum. Ela ESCREVE em `pl`, e isso é contrato,
// não efeito colateral escondido: os relógios de animação (`anim`, `walkAnim`, `idleTime`, `flavorT`),
// o quadro congelado da ventosa (`climbFrame`), o estado da gracinha (`flavor`) e as flags que o RESTO do
// jogo lê (`walking`/`running`, que a bengala do modo cego consome em draw; `idleNow`; `_tx`, o quadro-base
// em cor que o multi-tela recolore por viewport) moram no objeto do jogador desde o v3. Mover esses campos
// para dentro do módulo criaria um segundo lugar de verdade sobre o jogador — o oposto do que a
// modularização quer. O teste, por isso, sonda `pl` depois da chamada tanto quanto o valor de retorno.
//
// INJEÇÃO: `held` E `rnd` ENTRAM PELO `env`, NÃO POR IMPORT — e isso é um DESVIO CONSCIENTE do precedente de
// game/physics.ts, que importa os dois. Lá a âncora de regressão são as 14 trajetórias-ouro, que exigem o
// singleton de input e o RNG semeado reais; aqui não há trajetória-ouro nenhuma, e o valor da extração é
// poder atravessar a cadeia de prioridade ramo a ramo. Com `held` injetado, um teste liga "Correr" sem
// montar `keys`+`ctrl`+`padCur`; com `rnd` injetado, a gracinha sorteada é ESCOLHIDA em vez de descoberta.
// O game.js passa exatamente os mesmos `held` (input/state) e `rnd` (core/rng), então a ordem de consumo da
// semente — de que o attract-mode/replay depende — fica idêntica à do monólito.
// As texturas também entram pelo `env` (`env.tex`): os `TEX_*` de render/sprites são bindings VIVOS que só
// `initCharacterSprites()` preenche, e importá-los aqui amarraria o módulo ao boot do PIXI justamente na
// parte que queremos testar sem ele. `ANIM` (as cadências) é constante pura → import normal.
//
// ARMADILHA DE ORDEM DE BOOT: nenhuma. O módulo não tem estado próprio nem toca nada no import.

import { ANIM } from '../core/constants.js';
import type { ControlledPlayer } from '../core/entity.js';

/** Uma textura de quadro. Opaca de propósito: este módulo ESCOLHE quadros, nunca os desenha. */
export type Frame = unknown;

/** Uma "gracinha" de descanso (render/sprites.FLAVORS): `seq` indexa `tex`, `hold` é o nº de ticks por passo. */
export interface FlavorLike {
  seq: readonly number[];
  hold: number;
  tex: readonly Frame[];
}

/** O conjunto COMPLETO de quadros do personagem. Espelha os `TEX_*` de render/sprites, com nomes curtos. */
export interface PlayerTextures {
  idle: readonly Frame[];       // TEX_IDLE — respiração (4 quadros); [0] é a pose neutra usada como "congelado"
  walk: readonly Frame[];       // TEX_WALK — 8 quadros
  run: readonly Frame[];        // TEX_RUN  — 4 quadros
  jumpUp: Frame;                // TEX_JUMP_UP   — quadro único (subindo: pernas recolhidas)
  jumpDown: Frame;              // TEX_JUMP_DOWN — quadro único (caindo: pernas estendidas)
  climb: readonly Frame[];      // TEX_CLIMB — escada
  fly: Frame;                   // TEX_FLY — quadro único
  clingWall: readonly Frame[];  // TEX_CLING_WALL — ventosa na parede
  clingCeil: readonly Frame[];  // TEX_CLING_CEIL — ventosa no teto (ciclo distinto: E18f)
  swim: readonly Frame[];       // TEX_SWIM      — nado com braçada
  swimIdle: readonly Frame[];   // TEX_SWIMIDLE  — boiando
  flavors: readonly FlavorLike[]; // FLAVORS
}

/** Os campos do jogador que a ANIMAÇÃO lê ou escreve. O objeto real (game/player.makePlayer) é superconjunto. */
/**
 * O jogador visto pela ANIMAÇÃO — derivado de core/entity. O que cada campo significa está documentado lá,
 * uma vez; o que importa registrar AQUI é o que este módulo faz com eles:
 *
 *  · LÊ o que a física produziu: `vx`/`vy`, os três contatos, `clinging`/`clingN`/`flying` e `airTime`
 *    (quadros desde que saiu do chão — a base do coyote-time). `runCane` decide se `running` pode ligar.
 *  · LÊ as preferências de Movimento Reduzido: `rmWalk` congela TODA a locomoção num quadro único,
 *    `rmBreath` congela a respiração do idle, `rmFlavor` desliga as gracinhas.
 *  · ESCREVE os relógios: `anim` (respiração), `walkAnim` (o passo — NUNCA reseta, senão o ciclo de 8
 *    reinicia), `climbFrame` (quadro CONGELADO da ventosa), `idleNow`/`idleTime`, `flavor`/`flavorT`,
 *    `walking`/`running` (lidos pelo desenho da bengala em render/draw) e `_tx`, o quadro-base EM COR a
 *    partir do qual o multi-tela recolore, por viewport.
 *  · `ctrl`/`pad` entram só porque `held` precisa deles. `ControlledPlayer`: a animação roda em partida.
 *
 * `clingN` era `string | null` aqui e `ClingSide | null` na física — a mesma face da ventosa, uma tipada e
 * a outra não. Derivar fecha isso sem discussão.
 */
export type AnimPlayer = Pick<ControlledPlayer,
  'vx' | 'vy' | 'onGround' | 'onLadder' | 'inWater' | 'clinging' | 'clingN' | 'flying' | 'airTime' | 'runCane' |
  'rmWalk' | 'rmBreath' | 'rmFlavor' |
  'anim' | 'walkAnim' | 'climbFrame' | 'idleNow' | 'idleTime' | 'flavor' | 'flavorT' |
  'walking' | 'running' | '_tx' |
  'ctrl' | 'pad'
>;

/** Tudo que a escolha do quadro precisa e que não mora no jogador. */
export interface PlayerAnimEnv {
  dt: number;                   // delta em "ticks" do PIXI (1 ≈ 1/60 s)
  dir: number;                  // direção do INPUT neste quadro (-1/0/+1), vinda de game/physics.stepPlayer
  wheelchair: boolean;          // empatia motora GLOBAL: sentado, pernas paradas
  held(pl: AnimPlayer, act: string): boolean; // input/state.held
  rnd(): number;                // core/rng.rnd (semeado) — sorteia QUAL gracinha toca
  tex: PlayerTextures;
}

/**
 * Coyote-time da ANIMAÇÃO (E16), em quadros. Existe para matar o flicker walk↔jump no pouso: `onGround`
 * pisca por 1 quadro ao repousar, e sem essa folga o personagem alternava entre andar e pular ao aterrissar.
 * É o coyote do RENDER e é independente do coyote da física (game/physics) — mudar um não muda o outro.
 */
export const COYOTE = 5;

/**
 * COMO A CRIANÇA ESTÁ, derivado uma vez por quadro e lido por várias situações. Não é estado: é a leitura do
 * que a física já produziu, e sai daqui para nenhuma delas ter de a repetir (duas respostas para a mesma
 * pergunta é como as duas portas de entrada passaram a discordar — errata do ADR-0111).
 */
interface Stance {
  readonly airborne: boolean;
  readonly moving: boolean;
  /** Pernas paradas: cadeirante ou movimento reduzido. As duas acabam no mesmo quadro único, por vias diferentes. */
  readonly wcFreeze: boolean;
}

function stanceOf(pl: AnimPlayer, env: PlayerAnimEnv): Stance {
  // E16: estado aéreo ESTÁVEL — subindo (vy<0) entra na hora; cair/sair de borda só após o coyote-time.
  const grounded = pl.airTime <= COYOTE;
  return {
    airborne: !pl.clinging && ((pl.vy < 0 && !pl.onGround) || !grounded),
    // 'moving' baseado no INPUT (direção segurada), NÃO em vx — a colisão zera vx por quadros e isso resetava
    // o ciclo (só apareciam 2 dos 8 quadros). Assim os 8 quadros tocam contínuos.
    moving: (env.dir !== 0) && grounded && !pl.clinging,
    wcFreeze: env.wheelchair || !!pl.rmWalk,
  };
}

/** As bandeiras que o RESTO do jogo lê, e os dois relógios. Escritas antes de se escolher o quadro. */
function writeFlags(pl: AnimPlayer, env: PlayerAnimEnv, s: Stance): void {
  pl.walking = s.moving && !pl.inWater && !pl.onLadder && !pl.flying; // p/ a bengala: só aparece andando
  pl.running = pl.walking && env.held(pl, 'action1') && !!pl.runCane; // correndo: só com a bengala de corrida
  pl.anim += env.dt;                                 // idle (clock contínuo)
  pl.walkAnim += env.dt;                             // clock do passo NUNCA reseta → ciclo de 8 sem reinício
}

function clingFrame(pl: AnimPlayer, env: PlayerAnimEnv): Frame {
  const CL = pl.clingN === 'U' ? env.tex.clingCeil : env.tex.clingWall; // E18f: teto e parede usam ciclos distintos
  // só avança ao MOVER; parado MANTÉM o quadro, e o movimento reduzido nunca o avança
  if (!pl.rmWalk && (pl.vx !== 0 || pl.vy !== 0)) pl.climbFrame = Math.floor(pl.walkAnim / ANIM.clingHold) % CL.length;
  return CL[(pl.rmWalk ? 0 : (pl.climbFrame || 0)) % CL.length];
}

function ladderFrame(pl: AnimPlayer, env: PlayerAnimEnv): Frame {
  if (env.wheelchair) return env.tex.idle[0];        // ELEVADOR cadeirante: pose PARADA (idle), não de escada
  const CB = env.tex.climb;
  const climbing = (pl.vy !== 0) && !pl.rmWalk;
  return climbing ? CB[Math.floor(pl.walkAnim / ANIM.climbHold) % CB.length] : CB[0];
}

function waterFrame(pl: AnimPlayer, env: PlayerAnimEnv, s: Stance): Frame {
  // movendo = braçada; parado ou congelado = pernas paradas
  const stroking = ((env.dir !== 0) || env.held(pl, 'action2')) && !s.wcFreeze;
  const SW = stroking ? env.tex.swim : env.tex.swimIdle;
  return s.wcFreeze ? SW[0] : SW[Math.floor(pl.walkAnim / ANIM.swimHold) % SW.length];
}

function airborneFrame(pl: AnimPlayer, env: PlayerAnimEnv, s: Stance): Frame {
  // cadeirante caindo = pose neutra sentado; congelado = pulo num quadro só
  if (s.wcFreeze) return env.wheelchair ? env.tex.idle[0] : env.tex.jumpUp;
  return pl.vy < 0 ? env.tex.jumpUp : env.tex.jumpDown; // subindo: pernas recolhidas / caindo: estendidas
}

function walkingFrame(pl: AnimPlayer, env: PlayerAnimEnv, s: Stance): Frame {
  if (s.wcFreeze) return env.tex.idle[0];            // cadeirante/movimento reduzido: anda sem ciclo de passos
  const running = env.held(pl, 'action1');           // E19: correr ≠ andar — passada E cadência distintas
  const M = running ? env.tex.run : env.tex.walk;
  const hold = running ? ANIM.runHold : ANIM.walkHold;
  return M[Math.floor(pl.walkAnim / hold) % M.length];
}

/** E20: parado → respira; após `flavorDelay`, uma gracinha. É o único braço que guarda uma máquina de estado. */
function idleFrame(pl: AnimPlayer, env: PlayerAnimEnv): Frame {
  pl.idleNow = true;
  pl.idleTime += env.dt;
  let tx: Frame | null = null;
  if (pl.rmFlavor) pl.flavor = -1;                   // gracinhas têm toggle próprio — há quem se incomode
  else {
    if (pl.flavor < 0 && pl.idleTime > ANIM.flavorDelay) { pl.flavor = Math.floor(env.rnd() * env.tex.flavors.length); pl.flavorT = 0; }
    if (pl.flavor >= 0) {
      const F = env.tex.flavors[pl.flavor];
      const step = Math.floor(pl.flavorT / F.hold);
      pl.flavorT += env.dt;
      if (step >= F.seq.length) { pl.flavor = -1; pl.idleTime = 0; } else { tx = F.tex[F.seq[step]]; }
    }
  }
  if (tx !== null) return tx;
  const II = env.tex.idle;                           // respiração: congela ou cicla
  return pl.rmBreath ? II[0] : II[Math.floor(pl.anim / ANIM.idleHold) % II.length];
}

/**
 * A CADEIA DE PRIORIDADE E17 COMO TABELA, e a ORDEM desta lista É a regra — do mais específico ao mais genérico.
 *
 * 🎯 Ela era uma escada de sete `else if`, e os dois lados eram a mesma coisa disfarçada: «como a criança está»
 * → «que quadro mostrar», que é um mapeamento. Escrita como escada, acrescentar uma situação era abrir a função
 * e escolher onde encaixar; escrita como tabela, é acrescentar uma LINHA, e a precedência lê-se de cima a baixo
 * sem seguir aninhamento nenhum. É a mesma forma que esta casa já usa para o glifo de uma tecla e para a regra
 * de um ícone da barra.
 *
 * Estar na água DENTRO de uma escada mostra escada; grudado na parede dentro d'água mostra ventosa — e isso
 * agora é visível na ordem em vez de estar implícito no encadeamento.
 */
const SITUATIONS: readonly {
  readonly when: (pl: AnimPlayer, s: Stance) => boolean;
  readonly frame: (pl: AnimPlayer, env: PlayerAnimEnv, s: Stance) => Frame;
}[] = [
  { when: (pl) => pl.clinging, frame: clingFrame },
  { when: (pl) => pl.onLadder, frame: ladderFrame },
  { when: (pl) => pl.inWater, frame: waterFrame },
  { when: (pl) => pl.flying, frame: (_pl, env) => env.tex.fly },
  { when: (_pl, s) => s.airborne, frame: airborneFrame },
  { when: (_pl, s) => s.moving, frame: walkingFrame },
  // ⚠️ A ÚLTIMA RESPONDE SEMPRE, e é isso que faz da tabela uma cadeia: sem ela um estado que nenhuma linha
  // reconhecesse devolveria `undefined`, e um quadro ausente não falha — desenha o anterior para sempre.
  { when: () => true, frame: idleFrame },
];

/**
 * Escolhe o quadro do jogador para ESTE tick e adianta os relógios de animação.
 *
 * Também escreve em `pl` (ver AnimPlayer): `walking`/`running` (bengala), `idleNow`, os relógios e `_tx`.
 *
 * @returns o quadro escolhido (o mesmo valor que fica em `pl._tx`).
 */
export function choosePlayerFrame(pl: AnimPlayer, env: PlayerAnimEnv): Frame {
  const s = stanceOf(pl, env);
  writeFlags(pl, env, s);
  pl.idleNow = false;                                     // só o braço do idle o liga
  const tx = SITUATIONS.find((x) => x.when(pl, s))!.frame(pl, env, s);
  if (!pl.idleNow) { pl.idleTime = 0; pl.flavor = -1; }   // saiu do idle → zera gracinha
  pl._tx = tx;                                            // quadro base (cor) p/ recolor por viewport
  return tx;
}
