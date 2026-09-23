// SPDX-License-Identifier: AGPL-3.0-or-later
// O JOGO DECLARA O MAPA DE BOTÕES — e a criança que remapeou continua a ganhar (ADR-0115, issue #127).
//
// ========================= A METADE QUE FALTAVA, E O QUE A TRAVAVA =========================
// O campo do TECLADO entrou primeiro (`dbaff04`) e este ficou de fora com uma razão escrita: o
// `GAMEPAD_STANDARD` é lido num sítio só, mas nesse ponto o ASSENTO ainda não se conhecia — o `owner` só se
// resolvia mais abaixo, por ramo. A saída foi subir o assento no laço de sondagem, e é por isso que este
// ficheiro afirma DUAS coisas e não uma: a tabela, e a de que o laço a pede pelo assento certo.
//
// ⚠️ A PRECEDÊNCIA TEM UMA DIFERENÇA DE SÍTIO em relação ao teclado, e ela é o caso mais importante daqui: no
// controle, o mapa que a criança gravou no assistente não é uma camada por cima do padrão do jogo — é um RAMO
// inteiro do `padActions`. Se ele existe, o padrão do jogo nem é consultado. Nos dois aparelhos ela ganha; só
// não ganha da mesma maneira, e um dia alguém vai «arrumar» isso.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerPadMapping, padTable } from '../app/js/input/pad-defaults.js';
import { padActions } from '../app/js/input/pad-reading.js';
import { GAMEPAD_STANDARD } from '../app/js/input/default-bindings.js';

/** Um pad de mentira com os botões pedidos premidos. */
const pad = (...premidos) => ({
  id: 'std', index: 0, mapping: 'standard',
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: premidos.includes(i) })),
  axes: [0, 0, 0, 0],
});

beforeEach(() => { registerPadMapping(null); });
afterEach(() => { registerPadMapping(null); });

describe('a tabela de botões deste jogo', () => {
  it('[Zero] sem declaração, é a fábrica da engine — e é o MESMO objecto, não uma cópia', () => {
    expect(padTable(1, 0)).toBe(GAMEPAD_STANDARD);
  });

  it('[Right] o jogo troca UMA posição e o resto continua a ser da engine', () => {
    registerPadMapping(() => ({ action1: 3 }));
    const t = padTable(1, 0);
    expect(t.action1, 'o padrão do jogo não chegou').toBe(3);
    expect(t.action2, 'parcial virou substituição').toBe(GAMEPAD_STANDARD.action2);
  });

  it('🎯 [Boundary] o ASSENTO chega ao jogo — dois assentos podem querer arranjos diferentes', () => {
    registerPadMapping((jogadores, assento) => ({ action1: jogadores * 10 + assento }));
    expect(padTable(2, 0).action1).toBe(20);
    expect(padTable(2, 1).action1).toBe(21);
  });

  it('📌 `null` para um arranjo deixa esse arranjo com a fábrica', () => {
    registerPadMapping((jogadores) => (jogadores === 1 ? { action1: 3 } : null));
    expect(padTable(1, 0).action1).toBe(3);
    expect(padTable(2, 0)).toBe(GAMEPAD_STANDARD);
  });

  it('⚠️ registar de novo APAGA a memória — senão o jogo seguinte lia a tabela do anterior', () => {
    registerPadMapping(() => ({ action1: 3 }));
    expect(padTable(1, 0).action1).toBe(3);
    registerPadMapping(() => ({ action1: 7 }));
    expect(padTable(1, 0).action1, 'a memória sobreviveu ao registo').toBe(7);
  });

  it('[Interface] a mesma pergunta duas vezes devolve o MESMO objecto — isto corre por quadro', () => {
    registerPadMapping(() => ({ action1: 3 }));
    expect(padTable(1, 0)).toBe(padTable(1, 0));
  });
});

describe('a leitura dos botões, com a tabela do jogo', () => {
  it('[Right] o botão que o JOGO escolheu levanta a acção, e o da fábrica já não', () => {
    const t = { ...GAMEPAD_STANDARD, action1: 3 };
    expect(padActions(pad(3), null, t).action1, 'o botão declarado pelo jogo não respondeu').toBe(true);
    expect(padActions(pad(GAMEPAD_STANDARD.action1), null, t).action1, 'o botão da fábrica continuou a valer').toBe(false);
  });

  it('[Zero] sem tabela, a assinatura devolve o comportamento de sempre', () => {
    expect(padActions(pad(GAMEPAD_STANDARD.action1), null).action1).toBe(true);
  });

  it('🔴 o mapa que a CRIANÇA gravou no assistente ignora o padrão do jogo — e é assim que tem de ser', () => {
    // ⚠️ O ramo do `custom` nem consulta a tabela. Um jogo que declare `action1: 3` não pode reescrever o
    // botão que ela escolheu no assistente por não conseguir alcançar o outro.
    const custom = { action1: { b: 9 } };
    const t = { ...GAMEPAD_STANDARD, action1: 3 };
    expect(padActions(pad(9), custom, t).action1, 'a escolha dela deixou de valer').toBe(true);
    expect(padActions(pad(3), custom, t).action1, 'o padrão do jogo passou por cima dela').toBe(false);
  });
});

// ================================ MUTAÇÕES CONFERIDAS ================================
// 1. `padTable` a ignorar o `assento` (chave só com `jogadores`) → o caso do ASSENTO reprova, e é o que
//    justifica ter subido o `owner` no laço de sondagem.
// 2. `registerPadMapping` sem o `memo.clear()` → o caso do registo repetido reprova. Sem ele, o segundo
//    jogo montado na mesma página lê a tabela do primeiro — e a leitura está certa em toda parte menos no
//    valor.
// 3. `padActions` a ler `GAMEPAD_STANDARD` em vez do parâmetro → o primeiro caso da segunda secção reprova.
// 4. o ramo do `custom` a fundir a tabela do jogo por cima → o caso da criança reprova. Não é hipótese: é
//    exactamente a «arrumação» que alguém faz ao ver dois caminhos parecidos.
