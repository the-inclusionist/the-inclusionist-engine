// SPDX-License-Identifier: GPL-3.0-or-later
// input/edges — a tabela "ação → borda de entrada", e a regra de quem pode levantá-la. Módulo FOLHA: zero
// imports, nada de DOM, nada de estado.
//
// POR QUE ISTO EXISTE COMO MÓDULO
// Uma "borda" é o instante em que o jogador ACABOU de acionar algo — `jumpEdge`, `runEdge`, `leftEdge`… — em
// oposição a manter pressionado. Quem levanta borda são os três caminhos de entrada, e cada um tinha a sua
// própria cópia da mesma tabela: `input/keydown.ts`, `input/gamepad.ts` (seis `if` à mão) e
// `input/touch-bindings.ts`. Três cópias que precisavam concordar, e nada obrigando.
//
// Elas divergiram. A cópia do toque não tinha a guarda do modo Fácil, e como `runEdge` NÃO é a velocidade de
// corrida — é o gatilho que gruda e solta da parede, a escalada tipo aranha de `updateCling` em
// `game/physics.ts:177` e `:179` — o resultado foi que a criança em modo Fácil (que existe para dificuldade
// motora) não conseguia escalar com teclado nem com controle, e conseguia com o botão da tela. No tablet de
// escola pública, o toque não é o caminho alternativo: é o único. O sintoma foi corrigido antes deste módulo;
// este módulo é o que impede a divergência de voltar, porque agora só há um lugar onde ela poderia morar.
//
// A ORDEM DA TABELA É OBSERVÁVEL: `edgesFor` devolve a lista na ordem em que percorre, e há teste ancorando-a.

/** As seis bordas de entrada, pelo nome do campo que elas levantam no jogador. */
export type EdgeFlag = 'jumpEdge' | 'runEdge' | 'leftEdge' | 'rightEdge' | 'swapEdge' | 'specialEdge';
/** As seis ações que levantam borda. Nomeado (e não `string`) para o compilador casar com o `ActionKey` de
 *  input/gamepad, que é quem lê a tabela passando a ação adiante. */
export type EdgeAction = 'jump' | 'run' | 'left' | 'right' | 'swap' | 'especial';

/** Ação → borda, na ORDEM em que os três caminhos as levantam. */
export const EDGE_BY_ACTION: ReadonlyArray<readonly [EdgeAction, EdgeFlag]> = Object.freeze([
  ['jump', 'jumpEdge'], ['run', 'runEdge'], ['left', 'leftEdge'],
  ['right', 'rightEdge'], ['swap', 'swapEdge'], ['especial', 'specialEdge'],
] as ReadonlyArray<readonly [EdgeAction, EdgeFlag]>);

/**
 * Este jogador pode levantar a borda desta ação?
 *
 * Hoje há uma regra só, e ela é de acessibilidade: no modo Fácil o `run` não levanta borda — sem correr, e
 * portanto sem escalada de parede. Vale para teclado, controle e toque, que é justamente o ponto.
 * Se um dia houver uma segunda regra, ela entra AQUI e passa a valer nos três de uma vez.
 */
export function edgeAllowed(action: EdgeAction, easy: boolean | undefined): boolean {
  return !(action === 'run' && !!easy);
}

// ---------------------------------------------------------------------------------------------
// A INTENÇÃO DE NAVEGAR UM MENU
// ---------------------------------------------------------------------------------------------

/**
 * As seis intenções de navegação de menu — a mesma história das bordas, um andar acima.
 *
 * Estava declarada QUATRO vezes: `input/gamepad`, `ui/menu-nav`, `ui/activities-menu` e, sob o nome
 * `TitleNav`, `input/keydown`. Três delas traziam um comentário dizendo "MESMA forma que…", que é uma cópia
 * pedindo para ser notada. E já tinham divergido: a de `ui/activities-menu` declarava os seis campos
 * OPCIONAIS e as outras três, obrigatórios — de modo que `navTitle` aceitava `{}` enquanto quem a alimenta
 * sempre manda os seis.
 *
 * Mora em `input/` porque é uma intenção de ENTRADA: quem a produz são os tradutores (teclado, controle,
 * toque, e amanhã voz e webcam) e quem a consome é a UI. `input/` nunca importa de `ui/`; `ui/` já importa de
 * `input/devices`. A direção é essa.
 *
 * OPCIONAIS de propósito, ao contrário das bordas: um tradutor manda só o que aconteceu. `{ down: true }` é
 * uma frase completa — "para baixo" —, e obrigar os outros cinco `false` faria cada chamada carregar cinco
 * negações que ninguém lê. É a forma que `ui/activities-menu` já usava, e é a certa; o que estava errado era
 * as outras três discordarem dela.
 */
export interface NavKeys {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
  /** Confirmar / entrar. */
  yes?: boolean;
  /** Voltar / cancelar. */
  no?: boolean;
}

/**
 * Alguma intenção foi expressa neste quadro? Sem intenção, a tecla NÃO é consumida — nem `preventDefault`,
 * nem `stopPropagation`, nem `navTitle`.
 *
 * Estava escrita DUAS vezes, com o mesmo corpo e nomes diferentes: `hasIntent` em `ui/menu-nav` e
 * `hasTitleIntent` em `input/keydown`. Quase deixei as duas onde estavam, no raciocínio de que mover o tipo
 * para cá e criar uma função nova seria trocar seis por meia dúzia — o raciocínio estava certo e o número,
 * errado: não era uma cópia, eram duas, e o canônico apaga as duas. Os dois módulos reexportam com o nome
 * que os chamadores e os testes deles já usam.
 *
 * O `!!` importa: com os campos opcionais, a cadeia de `||` devolve `boolean | undefined`. Foi o compilador
 * que apontou, ao estreitar o tipo — as duas funções vinham devolvendo `undefined` como se fosse `false`.
 */
export function hasNavIntent(k: NavKeys): boolean {
  return !!(k.yes || k.no || k.up || k.down || k.left || k.right);
}
