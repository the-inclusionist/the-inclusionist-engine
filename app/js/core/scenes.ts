// SPDX-License-Identifier: AGPL-3.0-or-later
// core/scenes — A PILHA DE CENAS (item 22, opção C3 do ADR-0030). Módulo-FOLHA: zero dependências, zero I/O.
//
// ========================= O QUE ELA SUBSTITUI, E POR QUE NÃO É UM ENUM MAIOR =========================
// Hoje o jogo tem `phase: 'title' | 'playing' | 'paused'` em `core/state`, lido por doze módulos. O ADR-0030
// registra C1 — alargar essa união — como NÃO-OPÇÃO, e a razão é curta: um segundo jogo continuaria amarrado
// ao NOSSO enum. Um jogo com tela de mapa, um com tela de resultados, um com senha entre sessões (item 23)
// precisariam pedir uma constante nova na engine para existir.
//
// Uma PILHA não tem esse problema porque não tem vocabulário: ela sabe que há cenas empilhadas e nada sobre o
// que cada uma significa. `title/playing/paused` vira `[titulo]`, `[jogo]`, `[jogo, pausa]` — e um mapa de
// fases vira `[mapa]` sem que este arquivo mude uma linha.
//
// ========================= AS TRÊS REGRAS, E O QUE CADA UMA PRESERVA =========================
// Elas não são convenção de biblioteca: cada uma reproduz um comportamento que o jogo já tem.
//
//   · `update` SÓ NO TOPO. É o congelamento da pausa. Hoje ele é `if (phase !== 'playing') return` espalhado;
//     aqui é estrutural — uma cena que não está no topo não recebe tempo, ponto.
//   · `draw` DE BAIXO PARA CIMA. É o menu de pausa desenhado SOBRE o mundo, com o mundo ainda visível. Se
//     desenhasse só o topo, pausar apagaria o jogo da tela.
//   · `input` SÓ NO TOPO, e ele DIZ se consumiu. É a mesma forma que o ADR-0033 deu à entrada modal: quem
//     está por cima decide, e o que ele não quer volta a descer. Sem o retorno, a pilha teria de adivinhar.
//
// ========================= O QUE ELA NÃO FAZ =========================
// Não desenha, não escuta evento, não conhece PIXI nem DOM. Recebe `dt` e devolve nada; recebe uma intenção e
// devolve um booleano. É o que a torna testável sem navegador e importável dos dois lados da fronteira.

/**
 * Uma cena. Todos os ganchos são OPCIONAIS de propósito: uma tela de título que só desenha não deveria
 * precisar declarar um `update` vazio, e um diálogo que só ouve não deveria precisar declarar um `draw`.
 */
export interface Scene {
  /** Nome legível — para depuração e para os testes afirmarem a pilha por nome, não por identidade. */
  readonly nome: string;
  /** Chamado ao ENTRAR (push, ou ao reaparecer no topo por um pop). */
  enter?(): void;
  /** Chamado ao SAIR (pop, ou ao ser coberto por um push). */
  exit?(): void;
  /** Tempo. Só o topo recebe. */
  update?(dt: number): void;
  /** Desenho. Todas recebem, de baixo para cima. */
  draw?(): void;
  /** Entrada. Só o topo recebe. Devolva `true` se consumiu — `false`/nada deixa a tecla seguir. */
  input?(intent: string): boolean | void;
}

export interface SceneStack {
  /** Empilha `s` no topo. A anterior recebe `exit()` mas CONTINUA na pilha (e continua sendo desenhada). */
  push(s: Scene): void;
  /** Desempilha o topo e devolve-o (ou `null` se vazia). Quem reaparecer recebe `enter()`. */
  pop(): Scene | null;
  /** Troca o topo — `pop` seguido de `push`, numa chamada, porque é o que "ir para outra tela" quer dizer. */
  replace(s: Scene): void;
  /** A cena do topo, ou `null`. */
  top(): Scene | null;
  /** Os nomes, da base para o topo. Cópia: quem lê não muta a pilha por acidente. */
  nomes(): string[];
  update(dt: number): void;
  draw(): void;
  /** Devolve `true` se a cena do topo consumiu a intenção. */
  input(intent: string): boolean;
}

/**
 * Cria uma pilha vazia.
 *
 * ⚠️ `enter`/`exit` são chamados em TRY/CATCH? NÃO — e é decisão, não esquecimento. Um erro dentro de
 * `enter()` significa que a cena não montou; engolir isso deixaria a pilha num estado que ninguém declarou, e
 * o sintoma apareceria três quadros depois, longe da causa. As chamadas de `update`/`draw`/`input` também
 * propagam: a engine não é o lugar de decidir que o erro de um jogo não importa.
 */
export function createSceneStack(): SceneStack {
  const stack: Scene[] = [];

  return {
    push(s) {
      stack[stack.length - 1]?.exit?.();
      stack.push(s);
      s.enter?.();
    },

    pop() {
      const out = stack.pop() ?? null;
      out?.exit?.();
      stack[stack.length - 1]?.enter?.();
      return out;
    },

    replace(s) {
      // NÃO é `this.pop()` seguido de `this.push(s)`: isso daria `enter()` à cena de baixo por um instante,
      // e ela reapareceria no topo entre as duas chamadas. Trocar é UMA transição, não duas.
      const out = stack.pop() ?? null;
      out?.exit?.();
      stack.push(s);
      s.enter?.();
    },

    top() { return stack[stack.length - 1] ?? null; },
    nomes() { return stack.map((s) => s.nome); },

    update(dt) { stack[stack.length - 1]?.update?.(dt); },

    draw() { for (const s of stack) s.draw?.(); },

    input(intent) { return stack[stack.length - 1]?.input?.(intent) === true; },
  };
}

/**
 * O QUE A CASCA PRECISA SABER DA CENA — três booleanos, e nenhum nome de fase.
 *
 * Era `Phase = 'title' | 'playing' | 'paused'`, importado de `core/state`. O ADR-0030 registra ALARGAR essa
 * união como NÃO-OPÇÃO, e a razão é curta: um segundo jogo continuaria amarrado ao NOSSO vocabulário — um
 * jogo com mapa de fases ou tela de resultados teria de pedir uma constante nova à engine para existir.
 *
 * E o repositório já aprendeu isto uma vez, por evidência e não por gosto: o `consumer-quiz` precisou se
 * declarar "pausado" para navegar os próprios menus, porque o `menu-nav` importava a fase. A correção de lá
 * foi trocar `getPhase()` por `isNavigable()`, um BOOLEANO — e está registrada em `core/constants` como o
 * erro a não repetir. Isto aqui é a mesma correção, aplicada à casca inteira.
 *
 * Quem NOMEIA as cenas é a raiz de composição, que é este jogo. Ela monta a pilha (`core/scenes`) e traduz o
 * topo nestes três fatos. Uma quarta cena que a casca não conheça responde `false` nos três, e a projeção
 * abaixo continua fazendo sentido: sem splash, sem menu de pausa, som mudo, foco no título.
 */
export interface SceneFacts {
  /** O topo é a tela de título (o splash cobre o mundo). */
  telaDeTitulo: boolean;
  /** O topo é o JOGO — o mundo recebe tempo, o som toca, o controle de toque pode aparecer. */
  mundoRodando: boolean;
  /** O topo é o menu de pausa. O jogo continua na pilha por baixo, e continua desenhado. */
  menuDePausa: boolean;
}
