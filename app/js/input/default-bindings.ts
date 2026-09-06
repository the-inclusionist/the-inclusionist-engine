// SPDX-License-Identifier: AGPL-3.0-or-later
// input/default-bindings — O QUE CADA TRANSPORTE OFERECE, POR PADRÃO, PARA CADA UMA DAS QUATORZE AÇÕES.
//
// ========================= O QUE ISTO É, E ONDE ELE MORA DE PROPÓSITO =========================
// O ADR-0085 decidiu as quatorze POSIÇÕES (`core/actions.ts`) e disse, em tantas palavras, que os nomes
// físicos — L1, R2, X, A — são BINDING e vivem no transporte, não no vocabulário. Este é o ficheiro onde eles
// vivem. Um transporte novo (fala, olhar, toque) traz a sua tabela e não toca em `core/actions`.
//
// ⚠️ NADA AQUI ESTÁ LIGADO AINDA. `input/gamepad` e `input/keyboard` continuam a falar os oito nomes de
// plataforma (`jump`, `run`, `swap`, `especial`); a migração é a issue #103. Esta tabela é o destino dela,
// escrita agora porque o Dev especificou o padrão — e uma especificação que fica no chat é uma decisão
// perdida.
//
// ========================= A SIMETRIA DO TECLADO, QUE NÃO É DECORAÇÃO =========================
// O padrão que o Dev especificou apoia-se num bloco do QWERTY:
//
//        7  8          ← L1 sobre U, R1 sobre I
//     Y  U  I  O       ← L2 à esquerda de U, R2 à direita de I
//     H  J  K  L
//
// ⚠️ E O MAPEAMENTO TECLADO↔XBOX É UMA ROTAÇÃO DE 45°, consistente nos quatro: X(oeste)→U(noroeste),
// Y(norte)→I(nordeste), B(leste)→K(sudeste), A(sul)→J(sudoeste). O losango do controle pousa no quadrado
// `U I / J K` girando um oitavo de volta. É por isso que a tabela cai bem no dedo: o que a memória muscular
// guarda é a POSIÇÃO RELATIVA, não a letra.
//
// ⚠️ E FOI ESSA SIMETRIA QUE DENUNCIOU UM ERRO NA ESPECIFICAÇÃO. Ela chegou com `I` atribuído DUAS vezes —
// para `action4` e para R2 —, e o par simétrico de `Y` (à esquerda de U) é `O` (à direita de I). Adotado `O`.
// O gate deste ficheiro reprova tecla repetida, então o erro não teria passado de qualquer forma; o que a
// simetria deu foi a tecla CERTA em vez de só a notícia de que havia uma errada.

import { ACTIONS, type Action } from '../core/actions.js';

/** `null` = este transporte NÃO alcança esta ação por padrão. Ausência declarada, nunca esquecimento. */
export type Binding<T> = T | null;

// ⚠️ UMA TECLA QUE EXISTE HOJE E NÃO TEM LUGAR NESTA TABELA: `Space`. O esquema solo de `input/keyboard.ts`
// tem `jump:['KeyJ','Space']` — a barra é um segundo atalho para o pulo desde sempre. A especificação do
// padrão não a menciona, e pô-la em `action2` por conta própria seria decidir que o pulo mora ali: se o
// preset da plataforma puser o pulo noutra posição, a barra segue o verbo errado, que é pior do que ela não
// existir. Fica de fora, dita aqui, e é decisão do Dev — não de quem escreve a tabela.

/**
 * Teclado, esquema SOLO. Códigos de `KeyboardEvent.code` — físicos, não a letra impressa, que muda com o
 * layout ABNT2/US e é a razão de nunca se usar `key` aqui.
 */
export const KEYBOARD_SOLO: Readonly<Record<Action, Binding<readonly string[]>>> = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  action1: ['KeyU'],
  action2: ['KeyJ', 'Space'],
  action3: ['KeyK'],
  action4: ['KeyI'],
  leftShoulder: ['Digit7'],  // L1
  leftTrigger: ['KeyY'],    // L2
  rightShoulder: ['Digit8'],  // R1
  rightTrigger: ['KeyO'],    // R2 — ver a nota da simetria acima
  // ⚠️ E ESTAS DUAS FECHAM UMA DÍVIDA QUE O ADR-0074 §1 REGISTROU: `start` existia em dois transportes de
  // nove e faltava no teclado. Deixa de faltar. A simetria é de MÃO: `F` fica ao lado do polegar da mão que
  // se move (o bloco WASD), `H` ao lado da mão que age (o bloco UIJK).
  // `Enter` acompanha `H` porque JÁ pausava — `input/keydown.ts:240` tem `PAUSE_KEYS = {Escape, Enter}` —,
  // então declará-lo aqui descreve o que a tecla faz há muito, em vez de lhe dar um trabalho novo.
  start: ['KeyH', 'Enter'],
  select: ['KeyF'],
};

/**
 * Gamepad, mapa PADRÃO da Gamepad API (`mapping: "standard"`), que é o que um controle de Xbox reporta.
 * O número é o índice em `gamepad.buttons`.
 */
export const GAMEPAD_STANDARD: Readonly<Record<Action, Binding<number>>> = {
  // As direções não vêm de botões: vêm do stick 0/1 e do D-pad 12–15, em `stdDirs`. Declarar `null` aqui
  // diria "não alcança", que é falso — por isso os índices do D-pad estão nomeados.
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  action1: 2,   // X
  action2: 0,   // A
  action3: 1,   // B
  action4: 3,   // Y
  leftShoulder: 4,   // L1
  leftTrigger: 6,   // L2 — ⚠️ gatilho ANALÓGICO: a API expõe-no como botão com `.value`, e em alguns
                //     controles também como eixo. `bindActive` já trata os dois; `padActions` só lê
                //     `pressed`, o que funciona mas descarta o curso do gatilho.
  rightShoulder: 5,   // R1
  rightTrigger: 7,   // R2 — mesma ressalva analógica
  start: 9,     // Start / Menu
  select: 8,    // Select / Back / View
};

/**
 * Todos os problemas de uma tabela de binding. VAZIA quer dizer conforme.
 *
 * ⚠️ O QUE ISTO EXISTE PARA APANHAR É O DUPLO, e ele já aconteceu: a especificação chegou com `I` em duas
 * ações. Um binding duplicado não dá erro em lado nenhum — as duas ações disparam juntas, e a criança vê uma
 * ação dupla intermitente que ninguém consegue reproduzir de propósito.
 */
export function bindingProblems<T>(tabela: Readonly<Record<Action, Binding<T | readonly T[]>>>): string[] {
  const p: string[] = [];
  const dono = new Map<string, Action>();

  for (const acao of ACTIONS) {
    if (!(acao in tabela)) { p.push(`binding: ${acao} is not declared - write null if the transport cannot reach it`); continue; }
    const v = tabela[acao];
    if (v === null) continue;
    const itens = Array.isArray(v) ? v : [v];
    if (itens.length === 0) { p.push(`binding: ${acao} has an empty list - write null instead`); continue; }
    for (const item of itens) {
      const chave = String(item);
      const anterior = dono.get(chave);
      if (anterior) p.push(`binding: ${chave} is bound to both ${anterior} and ${acao}`);
      else dono.set(chave, acao);
    }
  }
  return p;
}

/** As ações que este transporte NÃO alcança. É o que uma tela de seleção precisa dizer ANTES de a criança começar. */
export function unreachable<T>(tabela: Readonly<Record<Action, Binding<T | readonly T[]>>>): Action[] {
  return ACTIONS.filter((a) => tabela[a] === null || tabela[a] === undefined);
}
