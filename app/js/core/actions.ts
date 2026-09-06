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
// ⚠️ E OS QUATRO NOVOS CHAMAM-SE `leftShoulder`, `leftTrigger`, `rightShoulder`, `rightTrigger` — NÃO
// `action5`..`action8`. Eu argumentei pelos números e o Dev decidiu contra, em 2026-09-06, com uma razão que
// o ADR-0086 registra: `action7` é ilegível no ponto onde alguém programa, e um vocabulário que ninguém
// consegue ler em voz alta não é abstração, é cifra. O ADR-0085 dizia o contrário; foi supersedido, não
// emendado.
//
// ⚠️ E A OBJEÇÃO CONTINUA ESCRITA, porque ela não some por a decisão ter sido outra: ombro e gatilho são
// FORMA DE GAMEPAD. Num teclado, `leftTrigger` é a tecla Y; num toque, um slot; num reconhecedor de fala, uma
// palavra. O ADR-0086 responde que a forma é ANATÔMICA antes de ser de gamepad — dois dedos por mão, um por
// cima do outro — e que isso atravessa transportes melhor do que um número atravessa. Quem discordar leia os
// dois registros, que é para isso que eles existem.
//
// `start` e `select` mantêm nome pelo critério que já valia para `start`: são FUNÇÃO, não posição — o que é
// do sistema e não do mundo do jogo.

/** As quatorze posições que a engine conhece. Nenhuma delas é uma palavra que uma criança leia. */
export const ACTIONS = [
  'up', 'down', 'left', 'right',
  'action1', 'action2', 'action3', 'action4',
  'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger',
  'start', 'select',
] as const;

export type Action = (typeof ACTIONS)[number];

/** As quatro direções, que todo transporte tem de alcançar. */
export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const satisfies readonly Action[];

/**
 * Os oito verbos, em DUAS metades que se nomeiam por critérios diferentes, e isso é decisão e não descuido:
 *
 * · `action1`..`action4` — o losango. NUMERADOS, porque quatro posições em cruz não têm nomes que
 *   atravessem gêneros: o que uma plataforma chama de pulo, um quiz chama de confirmar.
 * · `leftShoulder`, `leftTrigger`, `rightShoulder`, `rightTrigger` — NOMEADOS pela anatomia da mão: dois
 *   dedos por mão, um por cima do outro. ADR-0086.
 *
 * ⚠️ NÃO HÁ HIERARQUIA ENTRE ELES no contrato. A ordem é a de apresentação — no assistente do gamepad, na
 * tela de remapeamento — e não uma escala de importância: um jogo pode usar `rightShoulder` e nenhuma outra.
 */
export const VERBS = [
  'action1', 'action2', 'action3', 'action4',
  'leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger',
] as const satisfies readonly Action[];

/**
 * As duas de SISTEMA. Não pertencem ao mundo do jogo: `start` pausa e retoma, `select` abre o que é da sessão.
 *
 * ⚠️ E É POR ISSO QUE A ENGINE PODE NOMEÁ-LAS e não pode nomear as outras. O ADR-0074 proíbe um nome abstrato
 * chegar a uma pessoa porque `action1` não diz nada a ninguém — mas «start» e «select» são o que está escrito
 * no próprio controle desde 1983, e a criança lê a legenda antes de ler a nossa.
 */
export const SYSTEM = ['start', 'select'] as const satisfies readonly Action[];

/* ===================== O PRESET: ONDE AS PALAVRAS DO JOGO MORAM ===================== */
//
// ⚠️ ESTE É O OUTRO LADO DO CORTE, e sem ele a lista acima não separa nada. A engine conhece POSIÇÕES; o
// jogo conhece PALAVRAS; e alguém tem de dizer qual palavra está em qual posição. Esse alguém é o jogo, e o
// que ele entrega é isto.
//
// ⚠️ E O DEFEITO QUE ISTO EXISTE PARA CONSERTAR ESTÁ MEDIDO: em 2026-09-06 a camada de entrada da engine
// dizia `jump`, `run`, `swap` e `especial` em 132 pontos, dentro de 13 ficheiros — `input/gamepad` sozinho
// tem 41. Quer dizer que os transportes não sabem ler um controle: sabem ler um controle DESTE jogo. Um
// segundo jogo que não pule reescreve os transportes ou herda um vocabulário que não é o dele.

/** O que a criança lê e ouve para uma posição: o nome, e a frase que o explica quando ela pergunta. */
export interface ActionWord {
  /** «Pular», «Confirmar», «Colocar peça». NUNCA `action2` — nome abstrato que chega a uma pessoa é defeito. */
  readonly label: string;
  /** Opcional, para a tela de remapeamento: o que este botão faz, numa frase. */
  readonly hint?: string;
}

/**
 * O vocabulário de UM jogo: para cada posição que ele usa, a palavra dele.
 *
 * ⚠️ PARCIAL DE PROPÓSITO. Um jogo declara SÓ as posições que usa. Exigir as quatorze obrigaria um quiz a
 * inventar nome para um gatilho que ele não tem, e um nome inventado acaba numa tela de remapeamento à
 * frente de uma criança.
 */
export type ActionPreset = Partial<Readonly<Record<Action, ActionWord>>>;

/** As posições que este preset nomeia, na ordem canônica de `ACTIONS`. */
export function presetActions(p: ActionPreset): Action[] {
  return ACTIONS.filter((a) => p[a] !== undefined);
}

/**
 * Um preset é bem-formado? Devolve os problemas — VAZIA quer dizer conforme.
 *
 * ⚠️ O QUE ELE APANHA É O RÓTULO VAZIO, e é o mesmo defeito silencioso de `speakableProblems` em
 * `core/contract`: um `label` em branco não quebra nada, não avisa ninguém, e deixa a tela de remapeamento
 * com uma linha muda — que para quem usa leitor de tela é um botão que existe e não tem nome.
 */
export function presetProblems(p: ActionPreset | null | undefined): string[] {
  if (!p) return ['preset: missing'];
  const problemas: string[] = [];
  const nomeadas = presetActions(p);
  if (nomeadas.length === 0) problemas.push('preset: names no action - the child would see an unlabelled control');
  for (const chave of Object.keys(p)) {
    if (!isAction(chave)) problemas.push(`preset: ${chave} is not an action`);
  }
  for (const a of nomeadas) {
    const w = p[a];
    if (!w || !w.label || !w.label.trim()) {
      problemas.push(`preset: ${a} has an empty label - the remap screen would show a nameless button`);
    }
  }
  return problemas;
}

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
