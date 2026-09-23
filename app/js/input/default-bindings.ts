// SPDX-License-Identifier: AGPL-3.0-or-later
// input/default-bindings — O QUE CADA TRANSPORTE OFERECE, POR PADRÃO, PARA CADA UMA DAS QUATORZE AÇÕES.
//
// ========================= O QUE ISTO É, E ONDE ELE MORA DE PROPÓSITO =========================
// O ADR-0085 decidiu as quatorze POSIÇÕES (`core/actions.ts`) e disse, em tantas palavras, que os nomes
// físicos — L1, R2, X, A — são BINDING e vivem no transporte, não no vocabulário. Este é o ficheiro onde eles
// vivem. Um transporte novo (fala, olhar, toque) traz a sua tabela e não toca em `core/actions`.
//
// ✅ AS TRÊS ESTÃO LIGADAS, e esta nota já mentiu duas vezes — cada versão dela era verdade no dia em que foi
// escrita e deixou de ser sem ninguém a corrigir. A primeira dizia «NADA AQUI ESTÁ LIGADO AINDA» (morreu com a
// issue #103, 06/09); a segunda dizia que só o gamepad estava, e morreu com a issue #118, que uniu as duas
// tabelas de teclado. 📏 Medido em 2026-09-09:
//
//   · `GAMEPAD_STANDARD` — `input/gamepad.ts:129` lê os índices desta tabela em vez de literais, e a ligação
//     apanhou uma discordância real: `action1` corria em X, R1 e R2 enquanto a tabela declarava R1 e R2 como
//     ombro e gatilho.
//   · `KEYBOARD_SOLO` / `KEYBOARD_DUO` — `input/keyboard.ts:73` constrói o `KB_DEFAULTS` a partir delas
//     (`vivo(KEYBOARD_SOLO)` e `KEYBOARD_DUO.map(vivo)`). Deixaram de ser duas listas paralelas: são a MESMA
//     decisão, derivada, e por isso a divergência de antes não pode voltar por esquecimento.
//
// ⚠️ E A DERIVAÇÃO É POR CÓPIA PROFUNDA (`vivo` faz JSON round-trip), em DUAS camadas — verificado antes de
// escrito, porque a primeira versão desta linha dizia mais do que é verdade. `input/keyboard.ts` copia estas
// tabelas para o `KB_DEFAULTS`, e copia OUTRA VEZ para o `kb` mutável. O remapeamento da criança muta o `kb`
// («remapear uma tecla MUTA o objeto», diz o `setKB`), logo ele já não alcançaria isto nem sem a primeira
// cópia. O que a primeira camada compra é o resto: `KB_DEFAULTS` é exportado, e sem ela qualquer consumidor
// que lhe escrevesse dentro alterava o padrão de fábrica desta tabela para toda a gente.
//
// 📌 A LIÇÃO QUE ESTA NOTA CARREGA AGORA É SOBRE SI PRÓPRIA: um comentário que descreve estado de ligação
// apodrece a cada entrega. Este diz a DATA da medição, para que a próxima pessoa saiba contra o que a
// comparar em vez de acreditar.
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

// ⚠️ A `Space` ESTÁ EM `action2`, E ISTO É A HISTÓRIA DE COMO LÁ FOI PARAR — porque este bloco dizia o
// contrário e sobreviveu à decisão que o revogou.
//
// Ela ficou de fora da primeira versão desta tabela, e a razão estava certa: a barra é o segundo atalho do
// pulo desde sempre, a especificação do padrão não a mencionava, e pô-la em `action2` por conta própria
// seria decidir que o pulo mora ali. Se o preset da plataforma puser o pulo noutra posição, a barra segue o
// verbo errado — pior do que ela não existir.
//
// O Dev decidiu (ADR-0086 §2) que o pulo mora em `action2`, e a barra voltou. O texto acima continuou a
// dizer «fica de fora» durante todo esse tempo, ao lado de duas linhas que a declaram. Corrigido em
// 2026-09-07, na mesma passagem da issue #118 — que trata exactamente desta classe de erro: um comentário
// que descreve um estado que já passou.

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
 * Teclado, esquema de DOIS JOGADORES — as quatorze posições para cada um (ADR-0096).
 *
 * ⚠️ O JOGADOR 1 AQUI NÃO É O `KEYBOARD_SOLO`, e a diferença é UMA e obrigatória: as SETAS saem dele. No solo
 * elas são um segundo caminho para o direcional; em dupla são o direcional DO OUTRO. Deixá-las nos dois faria
 * os dois bonecos andarem juntos — um defeito que não dá erro em lado nenhum e que só se vê jogando a dois.
 * `conflictsBetweenTables` existe por causa desta linha.
 *
 * ⚠️ E A GEOMETRIA DO JOGADOR 2 É A MESMA DO JOGADOR 1, TRANSPOSTA PARA O TECLADO NUMÉRICO — o que faz a
 * memória muscular atravessar de um lado da mesa para o outro:
 *
 *        7  8            /  *          ombros na linha DE CIMA
 *     Y  U  I  O      7  8  9  +       gatilhos nas PONTAS da linha das ações
 *        J  K            5  6
 *
 *   action1 U ↔ Numpad8 (cima-esquerda)   action4 I ↔ Numpad9 (cima-direita)
 *   action2 J ↔ Numpad5 (baixo-esquerda)  action3 K ↔ Numpad6 (baixo-direita)
 *
 * O bloco `U I / J K` e o bloco `8 9 / 5 6` têm a MESMA forma, então a rotação de 45° que o cabeçalho deste
 * ficheiro descreve para o Xbox vale igual para o jogador 2. Não é coincidência de teclado: é o que torna o
 * padrão ensinável uma vez só.
 *
 * ⚠️ `Digit7`/`Digit8` (jogador 1) e `Numpad7` (jogador 2) SÃO TECLAS DIFERENTES, e é por isso que a
 * especificação do Dev diz «alphanumeric» e «numeric» em tantas palavras. `KeyboardEvent.code` distingue-as
 * sempre; `key` não — com Num Lock desligado o numérico chega como `ArrowUp`/`Home`, e um esquema lido por
 * `key` juntaria o direcional do jogador 2 com as ações dele. Mais uma razão de este ficheiro só falar
 * `code`.
 */
export const KEYBOARD_DUO: readonly Readonly<Record<Action, Binding<readonly string[]>>>[] = Object.freeze([
  {
    // JOGADOR 1 — a mão esquerda anda (WASD), a direita age (UIJK). Sem as setas: são do jogador 2.
    up: ['KeyW'],
    down: ['KeyS'],
    left: ['KeyA'],
    right: ['KeyD'],
    action1: ['KeyU'],
    action2: ['KeyJ', 'Space'],
    action3: ['KeyK'],
    action4: ['KeyI'],
    leftShoulder: ['Digit7'],
    leftTrigger: ['KeyY'],
    rightShoulder: ['Digit8'],
    rightTrigger: ['KeyO'],
    start: ['KeyH', 'Enter'],
    select: ['KeyF'],
  },
  {
    // JOGADOR 2 — as setas andam, o teclado numérico age. `Enter` fica com o jogador 1; o `NumpadEnter` não
    // entra aqui de propósito, porque `ui/menu-nav` já o usa como CONFIRMAR em qualquer menu (KEY_YES) e
    // `input/keydown` registra, verbatim, que ele NÃO pausa. Dar-lhe um terceiro trabalho seria sobrepor.
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    action1: ['Numpad8'],
    action2: ['Numpad5'],
    action3: ['Numpad6'],
    action4: ['Numpad9'],
    leftShoulder: ['NumpadDivide'],     // a tecla `/` do bloco numérico
    leftTrigger: ['Numpad7'],
    rightShoulder: ['NumpadMultiply'],  // a tecla `*`
    rightTrigger: ['NumpadAdd'],        // a tecla `+`
    /**
     * ⚠️ `ShiftRight` É A PORTA DE SAÍDA, E ELA FALTAVA (#122).
     *
     * Um Chromebook não tem bloco numérico, e um Chromebook é o hardware que o pilar 1 nomeia. Medido em
     * 2026-09-07: das catorze posições deste assento, **DEZ só se alcançam pelo numpad** — as oito ações
     * mais o `start` e o `select`. A criança da segunda cadeira anda pelas setas, não age em nada, e **não
     * consegue abrir o menu para consertar**, porque a tecla que abre o menu está no mesmo bloco que falta.
     *
     * Isso é o que a auditoria chamou de «um padrão do qual a criança não escapa», e o conserto que ela pede
     * é textual: *«tornar o próprio padrão remapeável, e não trocar as teclas que ele escolheu».* As teclas
     * ficam — o layout do numpad é melhor onde ele existe, é um bloco físico sob uma mão, e não tira nada ao
     * primeiro jogador. O que entra é UMA porta que todo teclado tem, para o remapeamento ser alcançável.
     *
     * ⚠️ E É SÓ NO `start`, de propósito: da pausa alcança-se a tela de remapeamento, e de lá TODAS as outras
     * treze posições. Uma porta chega para escapar; cada padrão a mais é uma tecla tirada do bolo comum, e
     * este teclado já é repartido por duas crianças.
     *
     * `ShiftRight` porque existe em todo o teclado, fica ao lado do bloco de setas (a mesma mão que já as
     * usa), não é tecla de texto — e está LIVRE nas quatro tabelas, o que foi medido e não suposto.
     */
    start: ['Numpad1', 'ShiftRight'],
    select: ['Numpad0'],
  },
]);

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
export function bindingProblems<T>(table: Readonly<Record<Action, Binding<T | readonly T[]>>>): string[] {
  const p: string[] = [];
  const dono = new Map<string, Action>();

  for (const acao of ACTIONS) {
    if (!(acao in table)) { p.push(`binding: ${acao} is not declared - write null if the transport cannot reach it`); continue; }
    const v = table[acao];
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

/**
 * As teclas que DUAS OU MAIS tabelas reclamam para si. VAZIA quer dizer que os jogadores não se atropelam.
 *
 * ⚠️ ISTO É UM PROBLEMA DIFERENTE DO `bindingProblems`, E FOI POR ISSO QUE PRECISOU DE FUNÇÃO PRÓPRIA: aquele
 * olha UMA tabela e apanha a mesma tecla em duas ações; este olha DUAS tabelas e apanha a mesma tecla em dois
 * JOGADORES. Cada esquema do `KEYBOARD_DUO` passa no primeiro sozinho — e as setas, se ficassem nos dois,
 * fariam os dois bonecos andarem juntos sem que nada reprovasse.
 *
 * A mensagem nomeia os dois donos, porque «tecla repetida» manda procurar o que a função já sabe.
 */
export function conflictsBetweenTables<T>(
  tables: readonly Readonly<Record<Action, Binding<T | readonly T[]>>>[],
): string[] {
  const p: string[] = [];
  const dono = new Map<string, string>();
  tables.forEach((table, i) => {
    for (const acao of ACTIONS) {
      const v = table[acao];
      if (v === null || v === undefined) continue;
      for (const item of (Array.isArray(v) ? v : [v]) as readonly T[]) {
        const chave = String(item);
        const aqui = `p${i + 1}.${acao}`;
        const anterior = dono.get(chave);
        if (anterior) p.push(`cross: ${chave} is claimed by both ${anterior} and ${aqui}`);
        else dono.set(chave, aqui);
      }
    }
  });
  return p;
}

/** As ações que este transporte NÃO alcança. É o que uma tela de seleção precisa dizer ANTES de a criança começar. */
export function unreachable<T>(table: Readonly<Record<Action, Binding<T | readonly T[]>>>): Action[] {
  return ACTIONS.filter((a) => table[a] === null || table[a] === undefined);
}
