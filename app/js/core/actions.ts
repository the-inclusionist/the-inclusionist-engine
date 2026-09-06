// SPDX-License-Identifier: AGPL-3.0-or-later
// core/actions — AS QUATORZE AÇÕES ABSTRATAS. A fonte única do vocabulário de entrada da engine.
//
// ========================= O QUE ISTO É =========================
// O ADR-0074 decidiu que a engine conhece POSIÇÕES, não verbos, e que o JOGO fornece as palavras. Este módulo
// é a lista dessas posições e nada mais: zero dependências, zero I/O, importável dos dois lados da fronteira.
//
// ⚠️ ATÉ AQUI A LISTA SÓ EXISTIA NUM REGISTRO. O código continua com os oito nomes de plataforma
// (`jump`, `run`, `swap`, `especial`) espalhados por `input/gamepad`, `input/edges`, `input/devices` e
// `input/keydown` — a migração é a issue #103 e não aconteceu. Este módulo é o alvo dela: um sítio para onde
// os transportes passam a apontar, escrito antes para que a migração tenha destino em vez de o inventar.
//
// ========================= POR QUE QUATORZE E NÃO NOVE =========================
// O ADR-0074 registrou nove e escreveu, entre as suas próprias desvantagens, que «nove é um TETO que um gênero
// pode querer exceder, e o registro tem de dizer o que acontece». O Dev excedeu-o em 2026-09-06, pedindo mais
// cinco para jogos mais elaborados. O ADR-0085 é o que acontece.
//
// ⚠️ E OS NOMES SÃO `action5`..`action8`, NÃO `L1`/`R2`. O pedido veio nos nomes físicos do gamepad, e adotá-los
// repetiria o defeito que o ADR-0074 existe para corrigir: `jump` era significado de PLATAFORMA dentro da
// engine; `L1` seria significado de GAMEPAD. Num esquema de teclado L1 é uma tecla qualquer; no toque é um
// slot; num reconhecedor de fala é uma palavra. L1/L2/R1/R2 são o BINDING PADRÃO de um transporte, e vivem em
// `input/gamepad`. `select` é a exceção e é exceção pelo mesmo critério que já valia para `start`: é FUNÇÃO,
// não posição — o botão que abre o que é do sistema e não do mundo do jogo.

/** As quatorze posições que a engine conhece. Nenhuma delas é uma palavra que uma criança leia. */
export const ACTIONS = [
  'up', 'down', 'left', 'right',
  'action1', 'action2', 'action3', 'action4',
  'action5', 'action6', 'action7', 'action8',
  'start', 'select',
] as const;

export type Action = (typeof ACTIONS)[number];

/** As quatro direções, que todo transporte tem de alcançar. */
export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const satisfies readonly Action[];

/**
 * Os oito verbos. `action1`..`action4` são o núcleo que o ADR-0074 fixou; `action5`..`action8` são os quatro
 * do ADR-0085, cujo binding padrão em gamepad são os ombros e gatilhos.
 *
 * ⚠️ NÃO HÁ HIERARQUIA ENTRE ELES no contrato. A ordem é a de apresentação — no assistente do gamepad, na
 * tela de remapeamento — e não uma escala de importância: um jogo pode usar `action7` e nenhuma das outras.
 */
export const VERBS = [
  'action1', 'action2', 'action3', 'action4',
  'action5', 'action6', 'action7', 'action8',
] as const satisfies readonly Action[];

/**
 * As duas de SISTEMA. Não pertencem ao mundo do jogo: `start` pausa e retoma, `select` abre o que é da sessão.
 *
 * ⚠️ E É POR ISSO QUE A ENGINE PODE NOMEÁ-LAS e não pode nomear as outras. O ADR-0074 proíbe um nome abstrato
 * chegar a uma pessoa porque `action1` não diz nada a ninguém — mas «start» e «select» são o que está escrito
 * no próprio controle desde 1983, e a criança lê a legenda antes de ler a nossa.
 */
export const SYSTEM = ['start', 'select'] as const satisfies readonly Action[];

/** É uma ação conhecida? Guarda de fronteira para dado que veio de fora (mapa salvo, remapeamento). */
export function isAction(x: unknown): x is Action {
  return typeof x === 'string' && (ACTIONS as readonly string[]).includes(x);
}

/**
 * Uma declaração de ações usadas por um jogo é bem-formada? Devolve os problemas — VAZIA quer dizer conforme.
 *
 * ⚠️ EXIGIR AS QUATRO DIREÇÕES SERIA ERRADO, e a tentação é grande: um quiz navega por `up`/`down` e não usa
 * `left`/`right`; um jogo de um botão não usa nenhuma. Quem decide o conjunto é o jogo. O que esta função
 * confere é que o conjunto é NOMEÁVEL e não está vazio — um jogo sem ação nenhuma não tem como ser jogado, e
 * hoje isso falharia em silêncio no primeiro transporte que tentasse ligar-se a nada.
 */
export function actionSetProblems(used: readonly string[] | null | undefined): string[] {
  const p: string[] = [];
  if (!used) return ['action set: missing'];
  if (used.length === 0) return ['action set: empty - a game with no action cannot be played'];
  const desconhecidas = used.filter((a) => !isAction(a));
  if (desconhecidas.length) p.push(`action set: unknown action(s) ${desconhecidas.join(', ')}`);
  if (new Set(used).size !== used.length) p.push('action set: has a repeated action');
  return p;
}
