// SPDX-License-Identifier: AGPL-3.0-or-later
// AS DUAS TABELAS DE TECLADO TÊM DE CONCORDAR ONDE SE SOBREPÕEM (issue #118).
//
// ========================= O QUE ESTE FICHEIRO IMPEDE =========================
// Há DUAS tabelas de teclado na árvore:
//
//   `input/keyboard.ts`        → `KB_DEFAULTS`      8 posições    VIVA — é a que o jogo usa
//   `input/default-bindings.ts`→ `KEYBOARD_SOLO`/`KEYBOARD_DUO`  14 posições   registada no ADR-0096
//
// ⚠️ E A DIVERGÊNCIA NÃO DÁ SINTOMA. Cada tabela é impecável sozinha: a viva passa no jogo, a registada passa
// no gate dela. Quem mexer numa não tem como saber que existe a outra — e é exactamente por isso que a
// divergência é perigosa hoje e não amanhã. Uma diferença silenciosa entre duas fontes é o defeito que este
// repositório já pagou dezasseis vezes com o `DomQuery`.
//
// ========================= O QUE ESTE GATE ACHOU AO NASCER (07/09) =========================
// A issue #118 afirma que «as oito coincidem tecla a tecla». ⚠️ NÃO COINCIDIAM. Sete das oito sim; a oitava
// era `action2` do jogador 1 em DUPLA:
//
//     KEYBOARD_DUO[0].action2   ['KeyJ', 'Space']    ← a registada, e a que o ADR-0096 decidiu
//     KB_DEFAULTS.p2[0].action2 ['KeyJ']             ← a viva: a barra tinha desaparecido
//
// A barra é o segundo atalho do pulo desde sempre, e no solo as duas tabelas dão-lha. Em dupla a viva
// tirava-a — sem que nada a tirasse do jogador 2, que nunca a teve. Não é conflito nem erro de compilação:
// é uma criança a jogar a dois cujo Espaço deixa de saltar, e mais ninguém a notar.
//
// ⚠️ E O QUE APONTA PARA QUAL DAS DUAS ESTAVA ERRADA é uma regra que a tabela registada JÁ obedece e a viva
// não: **o jogador 1 em dupla é o solo MENOS AS SETAS, e nada mais.** `Space` não é uma seta. O gate da
// tabela registada afirma isso posição a posição desde o ADR-0096; aqui a mesma regra passa a valer para a
// tabela viva, que é onde ela custa dinheiro.
//
// ========================= O QUE ESTE FICHEIRO NÃO FAZ =========================
// Não UNE as duas numa fonte só, e a issue diz porquê: unir obriga a decidir se `KeyScheme` deixa de ser
// `Record<string, string[]>` aberto, e onde moram as seis posições que faltam a `p3`/`p4` num teclado
// dividido por quatro — que pode não ter resposta boa, «o que é informação e não obstáculo». Enquanto as
// duas existirem, o que se pode garantir sem decidir nada é que não divirjam em silêncio.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_DEFAULTS } from '../app/js/input/keyboard.js';
import { KEYBOARD_SOLO, KEYBOARD_DUO, conflitosEntreTabelas } from '../app/js/input/default-bindings.js';
import { initKeyboardRuntime } from '../app/js/input/keyboard-runtime.js';

/** As posições que as DUAS tabelas declaram. Lidas da tabela viva, não escritas aqui: se ela crescer, o
 *  crivo cresce com ela em vez de continuar a medir oito por hábito. */
const PARTILHADAS = Object.keys(KB_DEFAULTS.solo);

/** As direcções, que são a única diferença legítima entre o solo e o jogador 1 em dupla. */
const SETAS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/** Onde `viva` e `registada` discordam, nas posições partilhadas. Vazia quer dizer que concordam. */
function divergencias(viva, registada, nome) {
  const fora = [];
  for (const pos of PARTILHADAS) {
    const a = JSON.stringify(viva[pos]);
    const b = JSON.stringify(registada[pos]);
    if (a !== b) fora.push(`${nome}.${pos}: viva ${a} × registada ${b}`);
  }
  return fora;
}

describe('as duas tabelas de teclado concordam nas oito posições partilhadas (#118)', () => {
  it('[Zero] o crivo está mesmo a comparar — as posições partilhadas existem nos dois lados', () => {
    // Sem isto, um `PARTILHADAS` vazio (ou uma posição que só existe num lado) daria verde a comparar nada.
    expect(PARTILHADAS.length).toBeGreaterThanOrEqual(8);
    for (const pos of PARTILHADAS) {
      expect(KEYBOARD_SOLO[pos], `${pos} não existe na tabela registada`).toBeDefined();
      expect(KB_DEFAULTS.solo[pos], `${pos} não existe na tabela viva`).toBeDefined();
    }
  });

  it('[Right] o esquema SOLO concorda tecla a tecla', () => {
    expect(divergencias(KB_DEFAULTS.solo, KEYBOARD_SOLO, 'solo')).toEqual([]);
  });

  it('⚠️ [Right] o esquema de DUPLA concorda tecla a tecla, nos dois jogadores', () => {
    // Foi aqui que o gate nasceu vermelho: `Space` estava na tabela registada do jogador 1 e não na viva.
    const fora = [
      ...divergencias(KB_DEFAULTS.p2[0], KEYBOARD_DUO[0], 'p2[0]'),
      ...divergencias(KB_DEFAULTS.p2[1], KEYBOARD_DUO[1], 'p2[1]'),
    ];
    expect(fora, 'as duas tabelas divergiram: ' + fora.join(' | ')).toEqual([]);
  });

  it('⚠️ [Boundary] o jogador 1 em dupla é o SOLO MENOS AS SETAS, e nada mais', () => {
    // A regra que aponta qual das duas tabelas está errada quando divergem, e que a registada já obedece
    // (ver `default-bindings.node.test.js`). Sem ela, «divergiram» não diz qual lado consertar.
    for (const pos of PARTILHADAS) {
      const esperado = (KB_DEFAULTS.solo[pos] ?? []).filter((c) => !SETAS.includes(c));
      expect(KB_DEFAULTS.p2[0][pos], `${pos} do jogador 1 em dupla não é o solo menos as setas`)
        .toEqual(esperado);
    }
    // E a outra metade da mesma regra: as setas ficam com o jogador 2, inteiras.
    expect(KB_DEFAULTS.p2[1].up).toEqual(['ArrowUp']);
    expect(KB_DEFAULTS.p2[0].up, 'a seta ficou com o jogador 1 e vai mover os dois bonecos').not.toContain('ArrowUp');
  });

  it('⚠️ [Right] o crivo cruzado corre sobre o conjunto VIVO — p2, p3 e p4', () => {
    // A issue pede isto em tantas palavras: «é para isso que existe `conflitosEntreTabelas`, e ele tem de
    // correr sobre o conjunto que ficar vivo». Até hoje ele só corria sobre a tabela REGISTADA, que não é a
    // que o jogo usa — quer dizer, o crivo existia e não guardava nada.
    for (const grupo of ['p2', 'p3', 'p4']) {
      expect(conflitosEntreTabelas(KB_DEFAULTS[grupo]), `${grupo}: dois jogadores disputam a mesma tecla`)
        .toEqual([]);
    }
  });

  it('⚠️ [Right] a BARRA tem dono em dupla — é a tecla com que o controle por OLHAR salta', () => {
    // A consequência medida da divergência, e é o que a torna cara em vez de arrumada.
    //
    // `ui/webcam.ts:40` sintetiza `Space` para «olhar para cima = pular» — a criança que joga com os olhos
    // salta com a barra e com mais nada. `input/keyboard-runtime.whichPlayer` procura o código nos esquemas
    // dos jogadores ATIVOS; com a barra fora da tabela viva de dupla, ela deixava de ter dono e a resposta
    // era -1. `KeyA`/`KeyD`, que o mesmo ficheiro usa para andar, continuavam a ser do jogador 1.
    //
    // Quer dizer: entrar um segundo jogador tirava o PULO de quem joga com os olhos, e deixava o andar. Nada
    // erra em voz alta; a criança simplesmente não salta mais.
    const rt = initKeyboardRuntime({
      getKB: () => KB_DEFAULTS,
      getNumPlayers: () => 2,
      getPlayers: () => [{ ctrl: null }, { ctrl: null }],
    });
    expect(rt.whichPlayer('KeyA'), 'o andar do olhar perdeu o dono').toBe(0);
    expect(rt.whichPlayer('Space'), 'o PULO do olhar não tem dono em dupla (ui/webcam.ts:40)').toBe(0);
    expect(rt.actionOf('Space', 0)).toBe('action2');
  });

  it('⚠️ [Right] JÁ NÃO HÁ DUAS TABELAS — a viva é derivada da registada, e não uma cópia dela', () => {
    // ⚠️ ESTE CASO SUBSTITUI A PERGUNTA. Enquanto havia duas listas, o melhor que se podia fazer era medir se
    // elas concordavam — e uma medição de concordância só apanha a divergência DEPOIS de ela existir. Desde a
    // #118 (decisão do Dev: fechar o `KeyScheme`), `input/keyboard.ts` deriva `solo` e `p2` de
    // `input/default-bindings`, que é onde o ADR-0096 pôs a decisão. Não há o que divergir.
    //
    // O crivo lê o FICHEIRO e não o valor, de propósito: um `deepEqual` continuaria verde no dia em que
    // alguém colasse a tabela de volta com os mesmos valores — e é justamente aí que a divergência renasce.
    const fonte = readFileSync(join(process.cwd(), 'app', 'js', 'input', 'keyboard.ts'), 'utf8');
    const soloDeclarado = /solo\s*:\s*\{/.test(fonte);
    expect(soloDeclarado, 'o esquema solo voltou a ser escrito à mão em input/keyboard.ts').toBe(false);
    expect(fonte, 'a tabela viva deixou de derivar da registada').toMatch(/KEYBOARD_SOLO/);
    expect(fonte, 'a tabela de dupla deixou de derivar da registada').toMatch(/KEYBOARD_DUO/);
  });

  it('[Interface] o crivo APANHA uma divergência plantada — senão os casos acima não provam nada', () => {
    const adulterada = { ...KB_DEFAULTS.solo, action1: ['KeyZ'] };
    const achados = divergencias(adulterada, KEYBOARD_SOLO, 'solo');
    expect(achados).toHaveLength(1);
    expect(achados[0]).toContain('action1');
    expect(achados[0]).toContain('KeyZ');
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · ⚠️ NASCEU VERMELHO SEM MUTAÇÃO NENHUMA, contra a árvore como ela estava: `KB_DEFAULTS.p2[0].action2`
//     era `['KeyJ']` e a registada `['KeyJ','Space']`. Reprovavam "[Right] DUPLA" e "[Boundary] solo menos
//     as setas". O conserto foi devolver a barra à tabela viva, porque é a registada que carrega a decisão
//     do ADR-0096 e é a viva que estava atrás.
//   · tirando `Space` outra vez de `KB_DEFAULTS.p2[0].action2` → reprovam os MESMOS TRÊS casos, incluindo o
//     do olhar. É a mutação que é o defeito.
//   · pondo `ArrowUp` em `KB_DEFAULTS.p2[0].up` → reprovam TRÊS: "[Boundary]" (nas duas pontas — a igualdade
//     e o `not.toContain`), "[Right] DUPLA" (a registada não a tem) e ⚠️ "[Right] o crivo cruzado sobre o
//     conjunto VIVO", que passa a ver `ArrowUp` reclamada pelos dois jogadores. Três crivos independentes a
//     apanhar o mesmo defeito — o de os dois bonecos andarem juntos —, e é o que mostra que correr o crivo
//     sobre a tabela viva não era cerimónia: era a única das três que olhava para o que o jogo usa.
//   · trocando `KeyU` por `KeyZ` em `KB_DEFAULTS.solo.action1` → reprovam "[Right] SOLO", nomeando a
//     posição, e "[Boundary]", porque ele deriva a expectativa DO SOLO — mexer no solo move a régua da
//     dupla junto, que é precisamente a relação que o caso afirma existir.
