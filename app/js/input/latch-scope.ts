// SPDX-License-Identifier: AGPL-3.0-or-later
// input/latch-scope — A ALTERNÂNCIA É DE UM TRANSPORTE, e não da criança (ADR-0104 §C, issue #114).
//
// ========================= O DEFEITO QUE ISTO CONSERTA, E ELE NÃO TINHA NOME =========================
// «Segurar vira alternar» estava guardado POR JOGADOR — `incl_togglemove_p0` —, o que quer dizer: por
// pessoa, e para todos os aparelhos ao mesmo tempo. Uma criança que liga a alternância no controle de TELA,
// porque num botão virtual ninguém segura com conforto, liga-a também no teclado, onde segurar uma tecla é
// exactamente o que ela sabe fazer. Ela não pediu isso e nada lho diz.
//
// ⚠️ E O REPOSITÓRIO JÁ CONHECIA O DEFEITO SEM O NOMEAR: o `core/state` traz a nota «a alternância do botão
// de CORRER nasce desligada de FÁBRICA — e liga sozinha no controle de tela, que é CONTEXTO e não escolha».
// Contexto é precisamente a palavra: o valor depende do aparelho em que a criança está. Guardá-lo por pessoa
// obrigava a distinguir «ligou porque quis» de «ligou porque é toque» com uma marca à parte (o ADR-0029), e
// essa marca existia para compensar uma chave que estava no escopo errado.
//
// O mapeamento de teclas já se guarda por transporte, e sempre se guardou. Esta é a mesma coisa.
//
// ========================= E PARA QUATRO TRANSPORTES ELA NÃO É ESCOLHA NENHUMA =========================
// ⚠️ Olhos, rosto, gestos e fala emitem UM COMANDO DE CADA VEZ. Não há como olhar para a esquerda e para o
// botão de pular ao mesmo tempo; não há como dizer duas palavras em simultâneo. Neles a alternância não é
// preferência — é a única forma de o controle funcionar, e oferecê-la como opção seria oferecer a uma
// criança a escolha de um controle que não funciona.
//
// Isto resolve, de passagem, uma tensão que o ADR-0084 tinha contra a sua própria regra «valor salvo
// significa escolha»: a alternância a ligar-se sozinha na webcam era uma excepção àquela regra. Deixa de
// ser, porque nestes transportes ela nunca foi um valor salvo — é uma propriedade do transporte.
//
// ⚠️ OS QUATRO AINDA NÃO EXISTEM COMO TRANSPORTE, e a regra fica escrita à mesma. Medido em 2026-09-08: o
// `defaultTransports` devolve três (gamepad, teclado, toque), e a webcam de então sintetizava `KeyboardEvent` — do
// ponto de vista da engine, ela ERA o teclado (os olhos passaram a apertar o controle virtual: ADR-0111, #197). Os três ícones da barra rápida dizem-no: `face`, `eyes` e
// `voice` estão marcados `soon`. Escrever a regra agora custa nada e faz com que eles cheguem COBERTOS, em
// vez de chegarem a uma excepção que alguém terá de se lembrar de abrir.
//
// Módulo-folha: não importa nada, nem sequer o `platform/storage` cujas chaves ele monta.

/**
 * Os transportes que emitem UM COMANDO DE CADA VEZ, e em que a alternância está sempre ligada.
 *
 * Os nomes são os que a barra rápida já usa para os ícones (`face`, `eyes`, `voice`), mais `gestos`, que é o
 * quarto que o ADR-0104 §C nomeia. Ficam em português como o resto do vocabulário de transporte
 * (`teclado`, `toque`) — `defaultTransports` já mistura, e mudar isso é outra conversa.
 */
export const ONE_COMMAND_AT_A_TIME: ReadonlySet<string> = new Set(['olhos', 'rosto', 'gestos', 'fala']);

/**
 * Neste transporte a alternância está sempre ligada?
 *
 * ⚠️ «Sempre ligada» e «ligada por omissão» são coisas diferentes, e a diferença é a que o ADR-0104 §C faz:
 * um padrão pode ser mudado, e mudá-lo aqui deixaria o controle inutilizável. Por isso o valor guardado nem
 * chega a ser lido nestes transportes — ver `latchOf`.
 */
export function latchAlwaysOn(transporte: string): boolean {
  return ONE_COMMAND_AT_A_TIME.has(transporte);
}

/**
 * A opção deve ser OFERECIDA para este transporte?
 *
 * O contrário de `latchAlwaysOn`, e existe com nome próprio porque quem pergunta é outro: um
 * chama para decidir o estado, o outro para decidir se desenha o botão. Um painel que desenhasse o botão e
 * ignorasse o clique seria pior do que não o desenhar.
 */
export function latchIsOptional(transporte: string): boolean {
  return !latchAlwaysOn(transporte);
}

/**
 * A chave de armazenamento da alternância, agora com o transporte no nome.
 *
 * ⚠️ FUNÇÃO, e não concatenação no ponto de uso, pela razão que o `platform/storage` já escreveu sobre as
 * chaves por jogador: «virar função aqui é o que impede que um deles escreva num nome torto». Não é
 * hipótese — o `ui/settings-mobility` reescrevia `'incl_togglerun_p' + i` à mão, com um comentário ao lado a
 * dizer «== toggleRunP de platform/storage». Duas cópias de um nome mudam uma de cada vez.
 *
 * `base` é `togglemove` ou `togglerun`, os dois nomes que já existem no armazenamento da criança.
 */
export function latchKey(base: string, jogador: number, transporte: string): string {
  return `incl_${base}_p${jogador}_${transporte}`;
}

/**
 * A chave ANTIGA, por jogador e sem transporte. Continua a ser lida, e nunca mais escrita.
 *
 * ⚠️ ELA HERDA PARA TODOS OS TRANSPORTES, e a escolha custa uma frase a explicar. O valor velho foi posto
 * pela criança nalgum contexto, e não há como saber qual — a chave não o registava, que é o defeito. As
 * saídas eram três: perder o ajuste dela, adivinhar um transporte, ou herdar para todos. Herdar para todos é
 * a única que não tira nada a quem depende do ajuste, e o vazamento que ela mantém dura só até a criança
 * mexer no assunto uma vez em cada aparelho. Perder o ajuste custaria mais, e a quem menos pode pagar.
 *
 * É também o padrão que este repositório já escolheu para este mesmo valor: o `KEYS.toggleMoveLegacy` existe
 * desde a migração anterior, e a nota do `platform/storage` diz porquê — «a chave velha fica onde está: é
 * dado da criança, não meu para apagar, e a sua permanência é o que torna um retorno possível».
 */
export function legacyLatchKey(base: string, jogador: number): string {
  return `incl_${base}_p${jogador}`;
}

/** O que se sabe ao resolver a alternância de um transporte. */
export interface LatchReading {
  /** O que está guardado para ESTE transporte. `null` = nunca foi escrito. */
  readonly fromTransport: boolean | null;
  /** O que está guardado na chave antiga, sem transporte. `null` = nunca foi escrito. */
  readonly fromLegacy: boolean | null;
  /** O padrão de fábrica (`DEFAULTS.toggleMove` / `DEFAULTS.toggleRun`). */
  readonly byDefault: boolean;
}

/**
 * A alternância deste transporte, resolvida.
 *
 * A ordem é: transporte de um comando → SEMPRE ligada, e nem se lê o resto · valor deste transporte · valor
 * legado · padrão de fábrica.
 *
 * ⚠️ O TRANSPORTE DE UM COMANDO VEM PRIMEIRO, e não por atalho: se ele lesse o guardado primeiro, uma
 * criança que tivesse desligado a alternância no teclado herdaria esse `false` pelo legado e ficaria com um
 * controle de olhar que não responde — o pior defeito possível, no controle de quem tem menos alternativas.
 */
export function latchOf(transporte: string, l: LatchReading): boolean {
  if (latchAlwaysOn(transporte)) return true;
  if (l.fromTransport !== null) return l.fromTransport;
  if (l.fromLegacy !== null) return l.fromLegacy;
  return l.byDefault;
}
