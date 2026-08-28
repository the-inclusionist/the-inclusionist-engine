// SPDX-License-Identifier: AGPL-3.0-or-later
// game/session.ts — O CICLO DE VIDA DA RODADA: começar, coletar, vencer, recomeçar, entrar, sair.
//
// Este módulo responde a UMA pergunta: "o que é uma rodada, e o que acontece nas suas bordas?". Tudo o que
// mora aqui muda o ESTADO DA PARTIDA — nunca a física (game/physics.ts), nunca o quadro desenhado
// (render/draw.ts, render/player-anim.ts). É o irmão de cima dos dois: a física move o corpo, o render mostra
// o corpo, e a sessão decide quando o corpo ganha uma moeda, quando a rodada acabou e quem está jogando.
//
// O QUE VEIO, E DE ONDE
//  · `collectFor(pl)` — o BLOCO DE COLETA que morava dentro do `stepPlayer` do game.js, entre a física e a
//    animação: pegar moeda (ou abrir o quiz), pegar power-up/chave e abrir o portão. Ele estava ali por
//    acidente histórico, do tempo em que `stepPlayer` era a função inteira; a etapa B1 tirou a física para
//    game/physics.ts e a C1 tirou a animação para render/player-anim + render/draw, e o que sobrou no meio
//    era exatamente isto: REGRA DE RODADA. Depois deste corte o `stepPlayer` do game.js vira três linhas —
//    física, sessão, animação — e cada uma mora no seu módulo.
//  · `updateHud` / `win` / `restartGame` — o fim e o recomeço.
//  · `setMode` — trocar de atividade (Lúdico / Soma-Sub / Sílabas) É reiniciar a rodada.
//  · `setNumPlayers` / `fitsN` / `isMobile` / `activateScreens` — o número de telas.
//  · `resetPlayerState` / `respawnPlayer` / `joinPlayer` — a vida de UM jogador com a partida em andamento.
//  · `releaseKey` / `quitGame` — o abandono.
//
// O QUE NÃO VEIO, E POR QUÊ
//  · `respawnFigure` (re-sorteia a posição de UMA moeda) fica no game.js: ela é dependência INJETADA do
//    game/quiz.ts, e trazê-la para cá criaria um ciclo session↔quiz sem ganhar nada — ela não sabe nada de
//    rodada, só de posição de moeda.
//  · `setupExtras` / `rebuildExtras` seguem no game.js: eles REATRIBUEM `powerups`, `gateTiles`, `gate` e
//    `gateOpen` por desestruturação, e esse quarteto é lido também pela colisão e pelo render. Entram por
//    injeção (`setupExtras()`) e por getter (`getPowerups`, `getGate`, `isGateOpen`).
//  · `configureRender`, `ensureSprites`, `assignControls`, `layout`, `reapplyVizAll`, `hideTouchControls`:
//    são as CONSEQUÊNCIAS de mudar o número de telas, não a decisão. Entram como callbacks.
//  · A fiação dos botões (`#opt-telas`, `#btn-again`, Alt+1..4, o item "Sair" do menu de pausa)
//    fica no game.js. Este módulo é chamado, não escuta.
//
// A DUPLICAÇÃO QUE EU ESPERAVA CURAR — E O QUE ACHEI NO LUGAR
// O comentário do monólito sobre `resetPlayerState` diz "Compartilha os campos com o restartGame", o que
// sugere duas listas de campos escritas à mão. NÃO É o caso: `restartGame` já chamava
// `players.forEach(resetPlayerState)`, então havia UMA lista só. A segunda lista existe, mas em outro lugar:
// `makePlayer` (game/player.ts) escreve o estado inicial de um jogador NOVO, e `resetPlayerState` escreve o
// estado inicial de um jogador RECOMEÇANDO — e as duas precisam concordar sobre o que é "começo de rodada"
// sem que nada as obrigue a isso. `joinPlayer` chama as duas em sequência, uma logo depois da outra.
// Não posso tocar `makePlayer` nesta etapa (é arquivo existente), então fiz o possível: extraí a lista para
// `roundStartFields(i)` — um objeto DECLARATIVO, testável sem jogador nenhum — e o teste compara campo a
// campo com o que `makePlayer(i)` produz. A divergência deixa de ser invisível: ela vira asserção.
// (O que descobri comparando: `makePlayer` não conhece `quit` nem `runCane`, e `resetPlayerState` não zera
// `facing`, `anim`, `walkAnim`, `airTime`, `stepT`, `guardT`, `climbFrame`, `flavorT` nem `_swap*`. Quase
// relógios recalculados a cada quadro; o teste registra a lista para que uma divergência NOVA apareça.)
// A duplicação literal que sobrou e que dá para pinçar aqui é a fórmula do spawn, `SPAWN_X + i*22`, escrita
// igual nos dois arquivos — o teste amarra as duas.
//
// A DECISÃO PURA ESCONDIDA DENTRO DO EFEITO
// O bloco de coleta tem, no meio de um `forEach` cheio de som, sprite e leitor de tela, uma conta que não
// depende de nada disso: a CAIXA DE COLETA (o corpo do jogador inflado pelo `pad` do modo Fácil) contra a
// CAIXA DO ITEM (15px nos modos didáticos, onde a figura/letra é desenhada 3px acima e à esquerda; 9px no
// Lúdico), e a escolha entre "abrir o quiz" e "pegar direto" conforme o MODO. `collectBox`, `coinItemBox`,
// `powerupBox`, `gateTileBox`, `overlaps` e `coinAction` são funções puras exportadas justamente para que
// essa parte seja testada sem DOM, sem PIXI e sem áudio — é onde um erro de sinal some sem sintoma.
//
// INJEÇÃO E ORDEM DE BOOT (a armadilha desta etapa)
// Regra da casa: o que o game.js REATRIBUI entra por GETTER; o que é estável entra por valor.
//   · GETTERS obrigatórios: `MODE`, `collected`, `ended`, `powerups`, `gate`, `gateOpen`, `pauseActor`,
//     `ownerColors`, `captionsOn` — todos `let` do game.js. `powerups`/`gate`/`gateOpen` são reatribuídos por
//     `setupExtras()`, que ESTE módulo chama dentro de `restartGame`: ler o valor antigo daria um portão
//     fantasma na rodada nova.
//   · `players` e `PCOLOR` entram por VALOR: são referências estáveis, mutadas in-place (o game.js faz
//     `players.push`/`players.length=n`, e este módulo faz o mesmo na MESMA referência).
//   · `player` (o `players[0]` local do game.js) É reatribuído por `setNumPlayers` → entra como o par
//     `getPlayerRef`/`setPlayerRef`.
//   · `reapplyVizAll` é `const` declarado LÁ EMBAIXO no game.js (viz-setters) — o monólito o chamava atrás de
//     `typeof reapplyVizAll==='function'`, guarda que hoje não protege nada (`typeof` sobre binding em TDZ
//     lança). Aqui ele é uma dependência normal, e é o game.js que o embrulha numa seta (`() => reapplyVizAll()`)
//     para que a resolução aconteça na CHAMADA — sempre pós-boot — e não na montagem do ctx.
//   · `closeQuiz` e `hideTouchControls` idem: são envólucros içados do game.js que dereferenciam `quizApi` e
//     `touchCtl` (constantes declaradas depois) só quando chamados.
//   · `MODE_LABELS`/`MODES` moram AQUI e são exportados: eram `const` do game.js declarados DEPOIS do ponto
//     onde `initSession` precisa ser chamado, e passá-los por valor cairia em TDZ no boot.
//
// SEM I/O NO IMPORT: o corpo do módulo só declara constantes de dado. Todo efeito passa por `initSession`.
// GUARDAS: o monólito fazia `$('#hud-coins').textContent=…` sem checar nulo (quebraria com o HTML fora do ar).
// Aqui cada consulta ao DOM passa por guarda — é a convenção da casa e é o que deixa o módulo rodar no
// project `node` com um `$` falso que devolve `null`.
//
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (C2).

import { t } from '../core/i18n.js';
import type { GamePlayerView, GamePlayer } from './entity.js'; // ADR-0033: a fatia do JOGO — `quiz` mora aqui
import { TILE, COIN_TARGET, EASY } from '../core/constants.js';
import { BOX, SPAWN_X, SPAWN_Y, makePlayer } from './player.js';
import { screenBaseSize } from '../core/screens.js';

import { coins, setCoins } from './state.js'; // item 19: `coins`/`quizLevel` sao estado do JOGO
import { pickCoins, takeCoin } from './coins.js';
import { puTaken, takePu, type Powerup } from './powerups.js';
import {
  rebuildCoins, addCoinsForOwner, respawnCoinsForOwner, showPower, getCoinSprites,
} from './coin-spawning.js';
import type { DomQuery } from '../core/dom-query.js';

/* ===================== dados de rodada (eram `const` do game.js) ===================== */

// `MODE_LABELS` e `MODES` SAÍRAM (ADR-0040). Existiam só para o botão `#opt-mode`: os rótulos que ele
// mostrava e a ordem em que ele ciclava. Com o botão removido — ele era o segundo caminho de escrita do
// MODE, e o que a issue #54 reproduziu —, ficaram sem chamador nenhum em produção. Sair é o certo: eram
// também prosa pt-BR fora do dicionário, do tipo que a nota do item 14 marca, mantida viva por um teste
// que só afirmava que os rótulos eram strings.
/** Rótulo do botão `#opt-telas`, indexado por `n-1`. Era literal DUPLICADO em setNumPlayers e joinPlayer. */
export const SCREEN_LABELS: readonly string[] = ['👤 1 tela', '👥 2 telas', '👨‍👧 3 telas', '👨‍👩‍👧‍👦 4 telas'];

/** Piso e teto de telas: 1..4, e `n|0` para engolir string/NaN vindos da UI. */
export function clampScreens(n: number): number { return Math.max(1, Math.min(4, n | 0)); }

/* ===================== a decisão PURA da coleta ===================== */

/** Retângulo em pixels de mundo (x,y = canto superior esquerdo). */
export interface Box { x: number; y: number; w: number; h: number }

/**
 * Caixa de COLETA do jogador: o corpo (BOX 10×30, ancorado nos pés) inflado pelo `pad` do modo Fácil.
 * É a única diferença de alcance entre Fácil e normal — daí ela ser o alvo de teste mais barato do módulo.
 */
export function collectBox(pl: { x: number; y: number; easy?: boolean }): Box {
  const pad = pl.easy ? EASY.pad : 0;
  return { x: pl.x - BOX.w / 2 - pad, y: pl.y - BOX.h - pad, w: BOX.w + 2 * pad, h: BOX.h + 2 * pad };
}

/**
 * Caixa do coletável. Nos modos didáticos a moeda é uma FIGURA/LETRA de 15px desenhada 3px acima e à
 * esquerda da célula (ver respawnFigure/rebuildCoins); no Lúdico é a moeda de 9px, na própria célula.
 */
export function coinItemBox(mode: string, cn: { x: number; y: number }): Box {
  const big = mode !== 'ludico';
  const sz = big ? 15 : 9, ox = big ? 3 : 0;
  return { x: cn.x - ox, y: cn.y - ox, w: sz, h: sz };
}

/** Caixa do power-up/chave: 12×12 na própria posição, sem deslocamento. */
export function powerupBox(pu: { x: number; y: number }): Box {
  return { x: pu.x, y: pu.y, w: 12, h: 12 };
}

/** Caixa de UM tile do portão, com a margem `m` que faz o toque valer por cima e pelos lados. */
export function gateTileBox(gt: { tx: number; ty: number }, m = 4): Box {
  return { x: gt.tx * TILE - m, y: gt.ty * TILE - m, w: TILE + 2 * m, h: TILE + 2 * m };
}

/** Sobreposição AABB, ESTRITA nas quatro bordas — encostar exatamente na borda não coleta. */
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** O que tocar nesta moeda faz, dado o modo. `take` = pega direto; os outros abrem o desafio do jogador. */
export type CoinAction = 'somasub' | 'silabas' | 'take';
export function coinAction(mode: string, cn: { shape?: unknown; letter?: unknown }): CoinAction {
  if (mode === 'somasub' && cn.shape) return 'somasub';   // figura → conta de soma/subtração
  if (mode === 'silabas' && cn.letter) return 'silabas';  // letra → montar a palavra
  return 'take';                                          // Lúdico (e didático sem carga) → moeda comum
}

/* ===================== a decisão PURA do número de telas ===================== */

/**
 * Cabem `n` telas numa janela de `availW`×`availH`? Piso k=2 (cada viewport com pelo menos 640×360), com a
 * folga de 10px por eixo que o `layout()` também usa. Espelha a conta do layout — por isso a base vem de
 * core/screens, a mesma fonte única que o layout, o CRT e o HUD consomem.
 */
export function fitsScreens(n: number, availW: number, availH: number): boolean {
  const { w: baseW, h: baseH } = screenBaseSize(n);
  return availW >= 2 * (baseW - 10) && availH >= 2 * (baseH - 10);
}

/* ===================== a decisão PURA do texto da rodada ===================== */

/** Objetivo no HUD (`#hud-objective`) ao começar a rodada. Multi-tela vira corrida e ignora o modo. */
export function objectiveText(mode: string, n: number): string {
  if (n > 1) return t('hud.objective.multi', { n, alvo: COIN_TARGET });
  if (mode === 'somasub') return t('hud.objective.somasub');
  if (mode === 'silabas') return t('hud.objective.silabas');
  return t('hud.objective.ludico');
}

/** O que o leitor de tela anuncia ao começar a rodada. Mesma árvore de decisão do objetivo. */
export function restartAnnounce(mode: string, n: number): string {
  if (n > 1) return t('sr.round.multi', { n });
  if (mode === 'somasub') return t('sr.round.somasub');
  if (mode === 'silabas') return t('sr.round.silabas');
  return t('sr.round.ludico');
}

/* ===================== "um jogador no começo de uma rodada" (fonte única) ===================== */

/**
 * OS CAMPOS de um jogador recém-nascido numa rodada. Fonte ÚNICA: `resetPlayerState` apenas aplica este mapa.
 * Declarativo de propósito — é o que permite ao teste comparar campo a campo com `makePlayer(i)`, a OUTRA
 * lista (em game/player.ts) que precisa concordar com esta e que nada obriga a concordar.
 * `owned` nasce array NOVO a cada chamada: dois jogadores nunca compartilham o inventário.
 */
export function roundStartFields(i: number): Record<string, unknown> {
  return {
    x: SPAWN_X + i * 22, y: SPAWN_Y, vx: 0, vy: 0,   // spawn: MESMA fórmula de makePlayer (o teste amarra as duas)
    hurtTimer: 0, collected: 0, jumpBuffer: 0, waterStroke: 0, onLadder: false,
    quiz: null, quit: false, runCane: false,          // quit/runCane: makePlayer NÃO os conhece (ver o cabeçalho)
    activePower: 'off', owned: [], hasKey: false,
    swapEdge: false, specialEdge: false,
    jumpChain: 0, groundIdle: 0, clinging: false, clingN: null, flying: false,
    // A TRAVA DA CORRIDA zera, o AJUSTE não. `runLatch` é estado de RODADA — começar a partida correndo
    // porque a trava sobreviveu ao reinício seria a criança sendo levada por um botão que ela não apertou.
    // `toggleRun` fica de fora daqui de propósito: é escolha dela, irmã de `toggleMove`.
    runLatch: false,
    idleTime: 0, flavor: -1,
    // O elevador do cadeirante guarda para ONDE está viajando, e isto sobrevivia à rodada: quem reiniciasse
    // no meio de uma subida entrava no poço seguinte já sendo puxado para o destino da rodada anterior, sem
    // ter apertado nada. Não disparava no spawn só porque `onLadder` é zerado aqui e o elevador só roda
    // dentro da escada — a bomba ficava armada esperando o próximo poço. Reproduzido no navegador: 108px de
    // arrasto em 20 quadros, contra zero no mesmo cenário sem o destino velho.
    elevTarget: null,
  };
}

/* ===================== interfaces estruturais ===================== */

/** Os campos do jogador que a SESSÃO lê/escreve. O objeto real (makePlayer, ~45 campos) é um superconjunto. */
/**
 * O jogador visto pela SESSÃO (entrar, sair, recomeçar rodada). Derivado de core/entity, com uma exceção.
 *
 * `sprite` fica declarado aqui à mão de propósito: a sessão só toca em `alpha` e `visible` (apaga e reacende
 * o jogador entre rodadas), e `Pick` não sabe estreitar um objeto ANINHADO — derivar traria `x`, `y`, `scale`
 * e `texture` junto, e todo fixture de teste desta sessão teria de inventar um sprite PIXI completo para
 * exercitar duas propriedades. Estreitamento aninhado é legítimo e Pick não o expressa; o que não é legítimo
 * é redigitar os campos que Pick EXPRESSA, e esses todos saíram daqui.
 */
export type SessionPlayer = GamePlayerView<
  'i' | 'x' | 'y' | 'easy' | 'collected' | 'hasKey' | 'runCane' | 'quit' | 'quiz' |
  'activePower' | 'owned' | 'clinging' | 'flying' | 'jumpEdge' | 'pad'
> & { sprite?: { alpha: number; visible: boolean } | null };

/**
 * O VENCEDOR, do ponto de vista da vitória: onde soltar o confete (`x`/`y`/`sprite`) e qual é o número
 * dele (`i`). São os quatro campos que `win()` lê, e mais nenhum.
 *
 * Existe separado de `SessionPlayer` porque `win` é chamado de FORA — `game/quiz` o repassa quando a
 * criança fecha o desafio com as moedas completas, e o jogador que ele tem em mãos é um `QuizPlayer`,
 * uma fatia diferente. Pedir `SessionPlayer` ali era exigir dez campos que a vitória não olha, e a
 * exigência caía justamente sobre quem só estava REPASSANDO o objeto.
 */
export type Vencedor = GamePlayerView<'i' | 'x' | 'y'> & { sprite?: { alpha: number; visible: boolean } | null };

/** Uma moeda/coletável (game/coins). `owner` é o dono (Lote C: cada um só coleta a própria cor). */
export interface SessionCoin {
  x: number; y: number; owner: number; taken: boolean;
  shape?: string; letter?: string;
}

/** Um tile do portão (level-geometry): coordenada de GRADE, não de pixel. */
export interface GateTile { tx: number; ty: number }

/** Power-up materializado: os predicados vêm de game/powerups; aqui só a posição e o sprite. */
export interface SessionPowerup extends Powerup {
  x: number; y: number;
  sprite?: { visible: boolean } | null;
}

/** O mínimo de um elemento do DOM que este módulo toca. Estrutural: nada de `HTMLElement` importado. */
export interface SessionEl {
  textContent: string | null;
  hidden: boolean;
  clientWidth: number;
  clientHeight: number;
  setAttribute(name: string, value: string): void;
  focus(): void;
}
/** O seletor do game.js (ui/dom.ts `$`), injetado — o módulo nunca toca `document`. */
// `DomQuery` vem de `core/dom-query` (2026-08-26). A versão local era NÃO-GENÉRICA e devolvia o
// `SessionEl` estrutural — e uma função genérica atribuída a uma assinatura não-genérica é
// instanciada pela RESTRIÇÃO, não pelo padrão: o `$` virava `Element`, que não tem `hidden`.
// O `SessionEl` continua abaixo: ele é a fatia que este módulo LÊ, e `HTMLElement` a satisfaz.
export type { DomQuery } from '../core/dom-query.js';

/** Uma região secreta (darkRegions do game.js): a sessão só reescurece a máscara e re-arma o anúncio. */
export interface DarkRegion { announced: boolean; gfx: { alpha: number; visible: boolean } }

export interface SessionCtx {
  /* --- A RODADA (ADR-0038): a lista de jogadores e a contagem vêm da instância que a raiz possui ---
     Eram `players`/`numPlayers`/`setNumPlayersValue`, `let` de `core/state` importados como bindings vivos.
     Um `let` de módulo é compartilhado por qualquer segundo jogo que a mesma página carregue (D13 do
     `demos`), e a lista de jogadores é o exemplo mais caro disso: o jogo seguinte começaria com os
     jogadores do anterior ainda dentro.

     `getPlayers` devolve MUTÁVEL, e só para este módulo. Ele é o dono da entrada e da saída de jogador —
     `ps.push(makePlayer(i))` e `ps.length = n` são daqui —, e é por isso que a rodada não tem setter para
     a lista: trocá-la inteira deixaria para trás as referências que os outros módulos já guardaram. */
  getPlayers(): unknown[];
  getNumPlayers(): number;
  setNumPlayers(n: number): void;

  /* --- DOM e mídia --- */
  $: DomQuery;
  librasReserve(): number;        // hoje sempre 0: o intérprete não empurra mais a tela (ver ui/vlibras)
  isCoarsePointer(): boolean;     // adaptador de matchMedia (pointer:coarse + hover:none) — é o que torna isMobile testável

  /* --- estado REATRIBUÍDO no game.js (obrigatoriamente getters) --- */
  getMode(): string;                                    // DERIVADO de `activity` (ADR-0040): só leitura
  setEnded(v: boolean): void;                             // `let ended`
  getPowerups(): readonly SessionPowerup[];               // só LIDO: quem reatribui a lista é o `setLevelExtras` da RODADA
  getGate(): readonly GateTile[] | null;                           // `let gate` — idem
  isGateOpen(): boolean; setGateOpen(v: boolean): void;   // `let gateOpen` — idem
  getPauseActor(): number;                                // `let pauseActor` — quem abriu o menu de pausa
  ownerColors(): boolean;                                 // `let ownerColors` — brilho na cor do dono?
  captionsOn(): boolean;                                  // `let captionsOn` — legenda de som

  /* --- referências ESTÁVEIS (mutadas in-place, nunca trocadas) --- */
  PCOLOR: number[];               // cores dos 4 jogadores (o game.js troca os ELEMENTOS, nunca o array)
  darkRegions: DarkRegion[];      // áreas secretas: reescurecem a cada rodada
  /** O jogador 1. DERIVADO de `players[0]` no game.js, não guardado: o par `setPlayerRef` que existia aqui
   *  reatribuía uma variável que já apontava para o mesmo objeto — `players[0]` não muda de identidade. */
  getPlayerRef(): SessionPlayer;

  /* --- a11y e áudio --- */
  srSay(msg: string): void;                 // leitor de tela, "polite"
  srAlert(msg: string): void;               // leitor de tela, "assertive"
  narrate(msg: string): void;               // TTS (platform/tts)
  sfx(name: string): void;                  // earcons.sfx
  doorSound(material: string): void;        // earcons.doorSound (o portão é de madeira)
  playVictory(): void;                      // jingles.playVictory
  showCaption(txt: string): void;           // legenda visual do som (só se captionsOn)

  /** POWER_MSG do game.js: a frase de cada poder, JÁ TRADUZIDA. Entra como FUNÇÃO (igual em physics) porque
   *  o idioma muda em tempo de execução — uma tabela lida uma vez ficaria congelada no idioma do boot. */
  POWER_MSG: (kind: string) => string;

  /* --- juice (render/fx) --- */
  burstSparkle(x: number, y: number, color: number, n: number): void;
  addShake(amp: number, t: number): void;
  addHitstop(t: number): void;
  rnd(): number;                            // core/rng — semeado; o confete consome a MESMA sequência do monólito

  /* --- itens e cena --- */
  coinPools(): { shapes: readonly string[]; letters: readonly string[] }; // pools por MODO (o sorteio da rodada nova precisa)
  setupExtras(): void;                      // re-sorteia power-ups + chave e FECHA o portão (reatribui os 4 `let`)
  /**
   * A RODADA RECOMEÇOU — para o que nasce por volta e não é power-up nem moeda (hoje, a reciclagem).
   *
   * Existe separado de `setupExtras` porque os chamadores são outros: `setupExtras` roda também quando a
   * criança liga o Modo Fácil ou troca o modo de visão, e remontar o lixo ali tiraria da mão dela o item que
   * ela estava carregando — por ter mexido num ajuste de acessibilidade. Opcional: um jogo sem nada por volta
   * não passa nada.
   */
  aoReiniciarRodada?: () => void;
  rebuildExtras(): void;                    // re-desenha o portão aberto
  resetMinimap(): void;                     // fog-of-war da fase volta ao escuro

  /* --- quiz (envólucros içados do game.js: dereferenciam quizApi na CHAMADA) --- */
  openQuiz(pl: SessionPlayer, coinIndex: number, shapeId: string): void;
  openSilabas(pl: SessionPlayer, coinIndex: number, letter: string): void;
  closeQuiz(pl: SessionPlayer): void;

  /* --- telas: as CONSEQUÊNCIAS de mudar o nº de jogadores --- */
  /**
   * Carrega no jogador `i` as preferências salvas dele (visão, saída de áudio, Modo Fácil, movimento
   * reduzido). O parâmetro é o jogador INTEIRO, e não `SessionPlayer`, porque a sessão está ENTREGANDO
   * aqui, não lendo: nenhum dos campos que a raiz escreve está na fatia da sessão, e declarar a fatia
   * mínima em posição de parâmetro inverte por contravariância — quem entrega tem de prometer o que o
   * receptor precisa. É a mesma inversão do `SpriteLike`/`CoinSprite` (ADR-0039).
   *
   * E a sessão TEM esse tipo: ela mesma importa `makePlayer`. Os dois `as unknown as SessionPlayer` que
   * havia nas chamadas eram justamente o disfarce que escondia isto.
   */
  loadPlayerA11y(p: GamePlayer, i: number): void;
  assignControls(): void;                   // teclado migra entre os esquemas solo/N jogadores
  ensureSprites(): void;                    // cria/remove o sprite de cada jogador
  configureRender(): void;                  // tela única ↔ render-textures por viewport
  reapplyVizAll(): void;                    // filtro/overlay/bolinha por modo de visão (ver ordem de boot no topo)
  layout(): void;                           // escala inteira das telas na janela
  hideTouchControls(): void;                // MP não tem controle por toque (ambíguo)
  updateGameHud(): void;                    // HUD por jogador

  /* --- fase e título --- */
  /** VOLTAR AO TÍTULO e ENTRAR NO JOGO. Eram `setPhase('title')`/`setPhase('playing')` — dois verbos no
   *  lugar de uma string, porque quem empilha a cena é a raiz e este módulo só declara a intenção. */
  voltarAoTitulo(): void;
  entrarNoJogo(): void;
  /**
   * Devolve o splash ao menu PRINCIPAL. Sem argumento DE PROPÓSITO.
   *
   * A versão anterior era `titleShow(menuId: string)`, e o `string` era o sintoma: quais submenus existem
   * ('tm-main', 'tm-alf', 'tm-cen'…) é vocabulário da CASCA, e `ui/title` já o declara como `TitleMenuId`.
   * Adotá-lo aqui exigiria `game/` importar de `ui/`, coisa que esta árvore nunca faz. Manter `string`
   * deixava a união escapar por uma fresta.
   *
   * A saída não é escolher entre os dois: é notar que este módulo não precisa saber. Ele só quer dizer
   * "voltei ao título" — qual tela isso significa é decisão de quem tem as telas.
   */
  titleShowMain(): void;
}

export interface SessionApi {
  /** Coleta de UM jogador neste quadro: moeda/quiz, power-up/chave e portão. Chamada pelo `stepPlayer`. */
  collectFor(pl: SessionPlayer): void;
  updateHud(): void;
  win(pl: Vencedor | null): void;
  restartGame(): void;

  setNumPlayers(n: number): void;
  fitsN(n: number): boolean;
  isMobile(): boolean;
  activateScreens(n: number): void;
  resetPlayerState(p: SessionPlayer, i: number): void;
  respawnPlayer(k: number): void;
  joinPlayer(padIdx: number | null): boolean;
  releaseKey(pl: SessionPlayer | null | undefined): void;
  quitGame(): void;
}

export function initSession(ctx: SessionCtx): SessionApi {
  // O salto por `unknown` VOLTOU em 2026-08-25, e por um motivo melhor do que o de antes: `core/state.players`
  // é `Player[]`, a visão da ENGINE, e o campo `quiz` saiu de lá (ADR-0033). Este jogo sabe que os jogadores
  // dele carregam mais; a engine não pode saber. Antes o salto existia porque o tipo era frouxo — agora
  // existe porque a fronteira é firme.
  const P = () => ctx.getPlayers() as unknown as SessionPlayer[];
  const N = () => ctx.getNumPlayers();
  /** Prefixo "Jogador N: " nas falas — some quando só há uma tela. */
  const who = (pl: SessionPlayer): string => (N() > 1 ? `Jogador ${pl.i + 1}: ` : '');
  /** Fala + narração juntas (o par srSay/tts.narrate aparece três vezes no bloco de coleta). */
  const sayAndNarrate = (msg: string): void => { ctx.srSay(msg); ctx.narrate(msg); };

  /* ===================== coleta (era o miolo do stepPlayer) ===================== */

  function collectCoins(pl: SessionPlayer, box: Box): void {
    const mode = ctx.getMode();
    (coins as SessionCoin[]).forEach((cn, i) => {
      if (cn.taken || cn.owner !== pl.i) return;             // Lote C: só coleta os itens da SUA cor
      if (!overlaps(box, coinItemBox(mode, cn))) return;
      const act = coinAction(mode, cn);
      if (act === 'somasub') { if (!pl.quiz) ctx.openQuiz(pl, i, cn.shape as string); return; }   // L3: quiz POR JOGADOR (MP incluso)
      if (act === 'silabas') { if (!pl.quiz) ctx.openSilabas(pl, i, cn.letter as string); return; }
      takeCoin(cn);
      const spr = getCoinSprites()[i]; if (spr) spr.visible = false; // some p/ todas as telas (item tem 1 dono)
      pl.collected++;
      ctx.sfx('coin');
      ctx.burstSparkle(cn.x + 5, cn.y + 5, ctx.ownerColors() ? (ctx.PCOLOR[cn.owner] || 0xffd23f) : 0xffd23f, 8); // JUICE: brilho na cor do dono (segue a opção)
      updateHud();
      sayAndNarrate(who(pl) + `Moeda ${pl.collected} de ${COIN_TARGET}.`);
      if (pl.collected >= COIN_TARGET) win(pl);
    });
  }

  function collectPowerups(pl: SessionPlayer, box: Box): void {
    ctx.getPowerups().forEach(pu => {
      if (puTaken(pu, pl.i)) return;
      if (!overlaps(box, powerupBox(pu))) return;
      takePu(pu, pl.i);
      // chave: some p/ todos; demais: por viewport (quem já pegou deixa de ver, no draw)
      if ((N() <= 1 || pu.kind === 'key') && pu.sprite) pu.sprite.visible = false;
      ctx.burstSparkle(pu.x + 6, pu.y + 6, 0xfff1a8, 10); ctx.addHitstop(3); // JUICE: brilho dourado + micro hit-stop
      const w = who(pl);
      if (pu.kind === 'key') { // chave individual: só o portador a tem — mas o portão, aberto, vale p/ todos
        pl.hasKey = true; ctx.sfx('key');
        ctx.srAlert(t('sr.key.taken', { who: w })); // `who` atravessa sem traduzir: é 'Jogador N: ' ou vazio
        return;
      }
      if (pu.kind === 'runcane') { // cego: a bengala com roda habilita CORRER
        pl.runCane = true; ctx.sfx('power');
        sayAndNarrate(w + 'Bengala de corrida! Agora dá para correr — segure Correr.');
        return;
      }
      if (!pl.owned.includes(pu.kind)) pl.owned.push(pu.kind); // entra no inventário; ativo = o último pego
      pl.activePower = pu.kind; pl.clinging = false; pl.flying = false;
      ctx.sfx('power'); showPower(pl);
      const pm = w + ctx.POWER_MSG(pu.kind);
      ctx.srSay(t('sr.power.swapHint', { msg: pm })); ctx.narrate(pm);
    });
  }

  function openGateIfTouched(pl: SessionPlayer, box: Box): void {
    const gate = ctx.getGate();
    if (!gate || ctx.isGateOpen() || !pl.hasKey) return; // o portão (vários tiles) abre se o PORTADOR o toca
    for (const gt of gate) {
      if (!overlaps(box, gateTileBox(gt))) continue;
      ctx.setGateOpen(true); ctx.rebuildExtras();
      ctx.sfx('gate'); ctx.doorSound('madeira');
      ctx.srAlert(t('sr.gate.open'));
      ctx.addShake(2, 12); // JUICE: portão pesado sacode a tela
      break;
    }
  }

  function collectFor(pl: SessionPlayer): void {
    const box = collectBox(pl); // Fácil: hitbox de coleta +4px por lado
    collectCoins(pl, box);
    collectPowerups(pl, box);
    openGateIfTouched(pl, box);
  }

  /* ===================== fim e recomeço da rodada ===================== */

  function updateHud(): void {
    const el = ctx.$('#hud-coins'); if (!el) return;
    const ps = P();
    el.textContent = N() <= 1
      ? String(ps[0].collected)
      : ps.map((p, i) => `P${i + 1}:${p.collected}`).join('  ');
  }

  function win(pl: Vencedor | null): void {
    ctx.setEnded(true);
    if (ctx.captionsOn()) ctx.showCaption('🔊 Vitória! 🎆');
    ctx.playVictory();
    const obj = ctx.$('#hud-objective'); if (obj) obj.textContent = 'Concluído! 🎉';
    if (pl && pl.sprite) { // JUICE: confete nas 4 cores
      for (let i = 0; i < 4; i++) {
        ctx.burstSparkle(pl.x + (ctx.rnd() - 0.5) * 24, pl.y - BOX.h / 2 - ctx.rnd() * 12, ctx.PCOLOR[i] || 0xffd23f, 10);
      }
    }
    const w = N() > 1 ? `Jogador ${(pl ? pl.i : 0) + 1} venceu! ` : '';
    const msg = `${w}Coletou as ${COIN_TARGET} moedas.`;
    const wm = ctx.$('#win-msg'); if (wm) wm.textContent = msg;
    const ov = ctx.$('#win-overlay'); if (ov) ov.hidden = false;
    ctx.srAlert(msg); ctx.narrate(`${w}Venceu! Coletou as ${COIN_TARGET} moedas.`);
    const again = ctx.$('#btn-again'); if (again) again.focus();
  }

  function restartGame(): void {
    P().forEach(p => ctx.closeQuiz(p));                  // L3: quiz é por jogador
    setCoins(pickCoins(COIN_TARGET, ctx.coinPools()));
    rebuildCoins();
    ctx.setupExtras();                                   // E12: re-posiciona power-ups + chave; portão volta a fechar
    ctx.darkRegions.forEach(r => { r.announced = false; r.gfx.alpha = 1; r.gfx.visible = true; }); // re-escurece segredos
    ctx.resetMinimap();                                  // fim de fase: o MINIMAPA volta a ficar escuro
    ctx.setEnded(false);
    P().forEach(resetPlayerState);
    updateHud();
    const obj = ctx.$('#hud-objective'); if (obj) obj.textContent = objectiveText(ctx.getMode(), N());
    const ov = ctx.$('#win-overlay'); if (ov) ov.hidden = true;
    // (dicas de início removidas — o rodapé do splash mostra os controles)
    ctx.aoReiniciarRodada?.();                           // ADR-0049 §7: a volta recomeça inteira (o lixo volta ao chão)
    ctx.srSay(restartAnnounce(ctx.getMode(), N()));
  }

  // `setMode` FOI EMBORA (ADR-0040). Ele existia para escrever o `let MODE` do game.js e depois reiniciar a
  // rodada; com o MODE derivado de `activity`, escrever o modo sem escrever a atividade é exatamente a
  // divergência que a issue #54 reproduziu. Quem troca de atividade é `ui/activities-menu.setActivity`, que
  // grava `activity` e reinicia — e o MODE segue sozinho. O botão `#opt-mode` saiu junto: era superfície de
  // depuração (dentro de `#topbar-tools hidden`, revelada só por `?debug=true`) e mostrava um estado que
  // deixou de existir separadamente.

  function focusGame(): void { const g = ctx.$('#game-region'); if (g) g.focus(); }

  /* ===================== nº de telas ===================== */

  /** Reflete `n` no botão `#opt-telas`. `aria` distingue os DOIS chamadores — ver o defeito no relatório. */
  /**
   * Reflete o número de telas no botão da barra — o texto visível E o nome falado, sempre os dois.
   *
   * Havia um parâmetro `aria` aqui, e o `joinPlayer` passava `false`: quem entrasse em jogo em andamento
   * deixava o botão dizendo "3 telas" na tela e "Telas: 2" no leitor. Não existe motivo para um chamador
   * querer que o rótulo falado minte, então o parâmetro não existe mais.
   */
  function reflectScreenButton(n: number): void {
    const tb = ctx.$('#opt-telas'); if (!tb) return;
    tb.textContent = SCREEN_LABELS[n - 1];
    tb.setAttribute('aria-label', 'Telas: ' + n + '. Toque para trocar.');
  }

  /** Cresce ou encolhe o array de jogadores até `n`, preservando os que já existem (e o `pad` de cada um). */
  function resizePlayers(n: number): void {
    const ps = P();
    if (n > ps.length) { for (let i = ps.length; i < n; i++) { const p = makePlayer(i); ctx.loadPlayerA11y(p, i); ps.push(p); } }
    else if (n < ps.length) { ps.length = n; }
    ctx.setNumPlayers(n);
  }

  /** E11: nº de jogadores (1–4 telas lado a lado, simulação compartilhada). SEMPRE reinicia a rodada. */
  function setNumPlayers(n: number): void {
    n = clampScreens(n);
    resizePlayers(n);
    ctx.assignControls(); ctx.ensureSprites(); // p.pad é PRESERVADO no objeto do jogador (associação direta)
    reflectScreenButton(n);
    if (n > 1) ctx.hideTouchControls();         // E13: várias telas → sem controle por toque (ambíguo)
    ctx.configureRender();
    ctx.reapplyVizAll();                        // solo: filtro/overlay/bolinha global; MP: filtros por viewport
    restartGame(); ctx.layout(); focusGame();
  }

  /** Lote B: cabe N telas na janela atual? Sem `#stage-wrap` no documento, otimista (o layout ainda não rodou). */
  function fitsN(n: number): boolean {
    const wrap = ctx.$('#stage-wrap'); if (!wrap) return true;
    const availW = (wrap.clientWidth || 320) - ctx.librasReserve();
    const availH = wrap.clientHeight || 180;
    return fitsScreens(n, availW, availH);
  }

  /** Celular/tablet: ponteiro grosso + sem hover (não dispara em notebook com touch) → o jogo é 1 tela só. */
  function isMobile(): boolean { return ctx.isCoarsePointer(); }

  /**
   * Alt+1/2/3/4. CRESCER = os novos jogadores ENTRAM no jogo em andamento (sem reinício, L1 — correção do
   * José 2026-07-02); DIMINUIR = nova rodada (remover jogador muda a corrida, então a corrida recomeça).
   */
  function activateScreens(n: number): void {
    n = clampScreens(n);
    if (isMobile() && n > 1) { ctx.srAlert(t('sr.screens.mobileOnly')); return; } // B2: mobile = 1 jogador
    if (n === N()) { ctx.srSay(n > 1 ? t('sr.screens.alreadyN', { n }) : t('sr.screens.already1')); return; }
    if (n > N()) {
      if (!fitsN(n)) { ctx.srAlert(t('sr.screens.wontFitN', { n })); return; }
      while (N() < n) { if (!joinPlayer(null)) break; }
      ctx.srSay(t('sr.screens.activeN', { n: N() }));
      return;
    }
    setNumPlayers(n);
    ctx.srSay(n > 1 ? t('sr.screens.newRoundN', { n }) : t('sr.screens.newRound1'));
  }

  /* ===================== a vida de UM jogador ===================== */

  /** Reseta UM jogador ao spawn (rodada nova só na tela dele). Aplica `roundStartFields` — a lista única. */
  function resetPlayerState(p: SessionPlayer, i: number): void {
    Object.assign(p, roundStartFields(i));
    if (i === 0) showPower(p); // (redundante: o próprio showPower já sai cedo se p !== players[0]) — preservado
    if (p.sprite) { p.sprite.alpha = 1; p.sprite.visible = true; }
  }

  /** L1: recomeça SÓ este jogador — coleta do zero e itens dele re-sorteados; os dos outros ficam intactos. */
  function respawnPlayer(k: number): void {
    const p = P()[k]; if (!p) return;
    resetPlayerState(p, k);
    respawnCoinsForOwner(k);
    ctx.updateGameHud();
    ctx.srSay(t('sr.player.restarted', { n: k + 1 }));
  }

  /** L1: entra num jogo EM ANDAMENTO (sem reiniciar a rodada dos outros): cria o jogador, a tela e os itens. */
  function joinPlayer(padIdx: number | null): boolean {
    if (isMobile()) { ctx.srAlert(t('sr.screens.mobileOnly')); return false; }
    if (N() >= 4) { ctx.srAlert(t('sr.screens.maxPlayers')); return false; }
    if (!fitsN(N() + 1)) { ctx.srAlert(t('sr.screens.wontFitOneMore')); return false; }
    const ps = P();
    const i = ps.length, p = makePlayer(i);
    ctx.loadPlayerA11y(p, i);
    if (padIdx != null) p.pad = padIdx;
    ps.push(p); ctx.setNumPlayers(ps.length);
    ctx.assignControls(); ctx.ensureSprites(); ctx.hideTouchControls(); // teclado migra p/ N jogadores; toque sai
    ctx.configureRender(); ctx.reapplyVizAll(); ctx.layout();
    resetPlayerState(p, i); addCoinsForOwner(i); // itens PRÓPRIOS dão spawn; os dos outros ficam intactos
    reflectScreenButton(N());
    ctx.srSay(t('sr.player.joined', { n: i + 1 }));
    return true;
  }

  /* ===================== abandono ===================== */

  /** Portador saiu do jogo → a chave volta à posição inicial (fica disponível de novo para os outros). */
  function releaseKey(pl: SessionPlayer | null | undefined): void {
    if (!pl || !pl.hasKey) return;
    pl.hasKey = false;
    const key = ctx.getPowerups().find(p => p.kind === 'key');
    if (!key) return;
    key.taken = false; key.by = [];
    if (key.sprite) key.sprite.visible = true;
    ctx.srAlert(t('sr.key.returned'));
  }

  /** Volta ao menu inicial (mesmo caminho do "sair" solo e do "todo mundo saiu" em MP). */
  function backToTitle(msg: string): void {
    restartGame(); ctx.voltarAoTitulo(); ctx.titleShowMain(); ctx.srSay(msg);
  }

  /** Sair: solo → MENU INICIAL; MP → a tela do jogador fica preta; TODOS saindo → menu inicial. */
  function quitGame(): void {
    if (N() <= 1) { backToTitle('Jogo abandonado. Escolha a próxima atividade.'); return; }
    const ps = P();
    const q = ctx.getPauseActor() || 0;
    releaseKey(ps[q]); ps[q].quit = true;
    if (ps.every(p => p.quit)) { // trocar de jogo = todo mundo sai
      ps.forEach(p => { p.quit = false; });
      backToTitle('Todos saíram. Escolham a próxima atividade.');
      return;
    }
    ctx.entrarNoJogo();
    ctx.srSay(t('sr.player.quit', { n: q + 1 }));
  }

  return {
    collectFor, updateHud, win, restartGame,
    setNumPlayers, fitsN, isMobile, activateScreens,
    resetPlayerState, respawnPlayer, joinPlayer,
    releaseKey, quitGame,
  };
}
