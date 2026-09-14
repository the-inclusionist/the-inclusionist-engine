// SPDX-License-Identifier: AGPL-3.0-or-later
// A TELA DE AJUDA: qual botão faz o quê, NESTE jogo, no teclado DESTA criança (ADR-0147 §4).
//
// ========================= O QUE ESTE FICHEIRO GUARDA =========================
// 🔴 O item `ajuda` está na lista de pausa desde o ADR-0044 e a engine nunca o soube accionar — a tela que o
// preenchia saiu com o cartucho (#111). O que entra agora tem de obedecer à fronteira do ADR-0074: a engine
// sabe que uma POSIÇÃO existe, só o JOGO sabe a palavra. Os três casos que importam são todos ausências:
// posição que o jogo não declara não aparece; palavra em branco não aparece; e nenhuma célula mostra um
// identificador.
//
// 📌 A metade pura é `helpRows`/`helpListHtml`, e é por isso que este ficheiro é `node`: nada aqui precisa de
// DOM, e o que precisa (montar o painel, ligar o item) está no `boot-create-game.browser`.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { helpRows } from '../app/js/ui/help-panel.js';

/** Um `keyName` de mentira, para o caso não medir a formatação de tecla — que é doutro módulo. */
const nomeDaTecla = (code) => `«${code}»`;
/** Um jogo que declara TRÊS posições das catorze, e só uma com explicação. */
const PRESET = {
  action2: { label: 'Pular', hint: 'Sai do chão e volta.' },
  left: { label: 'Ir para a esquerda' },
  start: { label: 'Pausa' },
};
/** O esquema desta criança: `action2` remapeado para `KeyZ`, `left` na seta, `start` sem tecla nenhuma. */
const ESQUEMA = { action2: ['KeyZ', 'Space'], left: ['ArrowLeft'], start: null };
const teclas = (a) => ESQUEMA[a];

describe('helpRows — a tabela de ajuda de um assento', () => {
  it('🔴 [Zero] uma posição que o jogo NÃO declara está AUSENTE — e não é uma linha vazia', () => {
    const linhas = helpRows(PRESET, teclas, nomeDaTecla);
    expect(linhas.map((l) => l.action)).toEqual(['left', 'action2', 'start']);
    // 📌 O PAR que o torna uma afirmação e não uma contagem: as onze que sobram têm de estar mesmo fora.
    expect(linhas.some((l) => l.action === 'action1'), 'apareceu uma posição que o jogo não nomeia').toBe(false);
    expect(linhas.some((l) => l.action === 'rightTrigger')).toBe(false);
  });

  it('🔴 [Zero] NENHUMA célula mostra um identificador — é a fronteira do ADR-0074 em forma de caso', () => {
    // ⚠️ ESTE É O DEFEITO QUE O `labellerFrom` DEVOLVE `null` PARA IMPEDIR, e uma tela de ajuda é o pior sítio
    // para ele aparecer: a criança abre-a precisamente porque não sabe o que o botão faz.
    const texto = JSON.stringify(helpRows(PRESET, teclas, nomeDaTecla));
    for (const id of ['action1', 'action2', 'action3', 'leftShoulder', 'rightTrigger']) {
      expect(texto.includes(`"word":"${id}"`), `a palavra da linha é o identificador «${id}»`).toBe(false);
    }
  });

  it('⚠️ [Zero] um rótulo EM BRANCO vale o mesmo que rótulo nenhum', () => {
    // É o defeito silencioso que o `presetProblems` já nomeia noutro sítio: para quem usa leitor de tela, uma
    // linha com o rótulo em espaços é um item que existe e não tem nome.
    const linhas = helpRows({ ...PRESET, action3: { label: '   ' } }, teclas, nomeDaTecla);
    expect(linhas.some((l) => l.action === 'action3'), 'um rótulo de espaços virou linha').toBe(false);
  });

  it('🎯 [Right] a tecla é a REMAPEADA desta criança, não a de fábrica', () => {
    const linhas = helpRows(PRESET, teclas, nomeDaTecla);
    const pular = linhas.find((l) => l.action === 'action2');
    // O esquema põe `KeyZ` à frente; o padrão da engine para `action2` é `KeyJ`/`Space`.
    expect(pular.key, 'a ajuda mostrou a tecla de fábrica em vez da que a criança pôs').toBe('«KeyZ»');
    expect(pular.key).not.toBe('«KeyJ»');
  });

  it('📌 [Boundary] a posição que o teclado NÃO alcança diz `null` — e isso é informação', () => {
    // Quem joga só com controle ou só com o dedo tem posições sem tecla. Dizê-lo é melhor do que uma linha
    // vazia, e é o mesmo princípio do `KeyScheme` que declara catorze ausências em vez de um objeto vazio.
    const linhas = helpRows(PRESET, teclas, nomeDaTecla);
    expect(linhas.find((l) => l.action === 'start').key).toBeNull();
    expect(linhas.find((l) => l.action === 'left').key).toBe('«ArrowLeft»');
  });

  it('[Zero] sem `preset` a tabela é VAZIA — não há o que dizer, e não se inventa', () => {
    expect(helpRows(undefined, teclas, nomeDaTecla)).toEqual([]);
    expect(helpRows(null, teclas, nomeDaTecla)).toEqual([]);
  });

  it('[Right] a ordem é a CANÓNICA de `ACTIONS`, e não a que o jogo escreveu o objeto', () => {
    // ⚠️ O fixture declara `action2` PRIMEIRO e `left` depois; a saída inverte-os, porque é a ordem que a
    // criança encontra em toda a outra superfície (remapeamento, assistente de pad, legenda do título).
    expect(Object.keys(PRESET)).toEqual(['action2', 'left', 'start']);
    expect(helpRows(PRESET, teclas, nomeDaTecla).map((l) => l.action)).toEqual(['left', 'action2', 'start']);
  });
});

// The slide show built from these rows is measured in a document: `tests/help-panel.browser.test.js`.

// ============================== MUTAÇÕES CONFERIDAS ==============================
// Aplicadas por script ao ficheiro, com a contagem de ocorrências conferida ANTES de cada uma.
//
//   D1 o guarda de rótulo em branco sai                        🔴 a linha muda aparece
//   D2 o guarda inteiro sai                                    🔴 as catorze posições viram linhas
//   D3 a ordem passa a ser a das chaves do objeto do jogo      🔴 a canónica deixa de valer
//   D5 a tecla ausente vira `''` em vez de `null`              🔴 «não alcança» deixa de ser dizível
//   D8 a ajuda monta-se sem `preset`   (alvo: `boot-create-game.node`)
//   D9 a lacuna da ajuda deixa de ser dita  (idem)
//
// ⚠️ E UMA SOBREVIVEU, dita aqui em vez de escondida: `word: word.label || action` — pôr o identificador
// quando a palavra falta — fica VERDE. Não é buraco: o guarda de D1 já recusa a linha antes, logo aquele
// ramo é INALCANÇÁVEL. O caso «nenhuma célula mostra um identificador» continua a afirmar a fronteira do
// ADR-0074, e quem a garante é o guarda, não a expressão. Um crivo que a prendesse teria de tirar o guarda
// primeiro — e aí estaria a medir outra coisa.
