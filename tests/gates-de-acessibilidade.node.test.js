// SPDX-License-Identifier: AGPL-3.0-or-later
// O ÍNDICE DE CRITÉRIOS APONTA PARA GATES QUE EXISTEM (issue #13).
//
// ========================= O QUE ESTE FICHEIRO IMPEDE =========================
// `docs/compliance/gates-de-acessibilidade.md` diz quais critérios da WCAG este repositório afere e quais ele
// apenas cita. É a metade automatizável da #13 e matéria-prima do relatório anual (ADR-0053).
//
// ⚠️ E É EXACTAMENTE A CLASSE DE DOCUMENTO QUE APODRECE PRIMEIRO: ele nomeia ficheiros de teste, e um ficheiro
// de teste que muda de nome ou desaparece deixa a linha a afirmar uma cobertura que já não existe. Foi medido
// em 07/09 que três issues abertas apontavam para ficheiros que saíram com o cartucho, e nada dizia — num
// índice de conformidade o mesmo silêncio é pior, porque alguém o vai ler para responder a uma auditoria.
//
// ⚠️ O QUE ELE NÃO AFERE: se o gate apontado mede MESMO aquele critério. Isso não é decidível por máquina —
// e é por isso que o documento separa «aferido» de «citado», em vez de dar um número único de conformidade.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const DOC = readFileSync(join(RAIZ, 'docs', 'compliance', 'gates-de-acessibilidade.md'), 'utf8');

/** Caminho do repositório citado entre crases. */
const RE_CAMINHO = /`((?:app|tests|scripts|docs|\.github)\/[A-Za-z0-9_\-./]+\.[a-z]+)`/g;
const caminhos = [...new Set([...DOC.matchAll(RE_CAMINHO)].map((m) => m[1]))];

/** As linhas de tabela: `| **N.N.N** … |`. */
const linhasDeCriterio = DOC.split(/\r?\n/).filter((l) => /^\|\s*\*\*\d\.\d+\.\d+\*\*/.test(l));

describe('o índice de critérios de acessibilidade (#13)', () => {
  it('[Zero] o crivo está mesmo a ler o documento', () => {
    expect(DOC.length).toBeGreaterThan(2000);
    expect(caminhos.length, 'nenhum caminho citado').toBeGreaterThanOrEqual(12);
    expect(linhasDeCriterio.length, 'nenhuma linha de critério').toBeGreaterThanOrEqual(12);
  });

  it('⚠️ [Right] todo ficheiro citado EXISTE', () => {
    const mortos = caminhos.filter((c) => !existsSync(join(RAIZ, c)));
    expect(mortos, 'o índice aponta para ficheiro inexistente:\n  ' + mortos.join('\n  ')).toEqual([]);
  });

  it('⚠️ [Right] toda linha da tabela de AFERIDOS nomeia pelo menos um ficheiro de `tests/`', () => {
    // A distinção que dá sentido ao documento: um critério na tabela de aferidos sem um caso a apontá-lo é
    // uma citação a passar por gate — que é precisamente o que a tabela de baixo existe para separar.
    const corte = DOC.indexOf('## ⚠️ Citados e NÃO aferidos');
    expect(corte, 'a secção dos buracos desapareceu do documento').toBeGreaterThan(0);
    const aferidos = DOC.slice(0, corte).split(/\r?\n/).filter((l) => /^\|\s*\*\*\d\.\d+\.\d+\*\*/.test(l));
    expect(aferidos.length).toBeGreaterThanOrEqual(9);
    const fracas = aferidos.filter((l) => !/`tests\/[^`]+\.test\.js`/.test(l)).map((l) => l.slice(0, 60));
    expect(fracas, 'critério na tabela de AFERIDOS sem caso em tests/:\n  ' + fracas.join('\n  ')).toEqual([]);
  });

  it('⚠️ [Interface] o buraco do 2.3.1 continua nomeado enquanto o `FLASH_LIMIT` não existir', () => {
    // ⚠️ É a linha mais urgente do documento e a mais fácil de apagar por distração: a ORDEM correta de um
    // limitador de cintilação está garantida por teste, e o limitador NÃO EXISTE. É promessa de segurança
    // sobre epilepsia fotossensível, não de conforto.
    //
    // Este caso liga as duas pontas: enquanto `core/layers` disser que o `FLASH_LIMIT` não está implementado,
    // o documento tem de continuar a dizê-lo. Quando alguém o implementar, este caso reprova — e obriga a
    // mover o 2.3.1 para a tabela de cima, que é exactamente o que se quer que aconteça.
    const layers = readFileSync(join(RAIZ, 'app', 'js', 'core', 'layers.ts'), 'utf8');
    // ⚠️ O `[\s\S]{0,40}?` e não `\s+`: a frase atravessa uma quebra de linha de comentário, então entre
    // `FLASH_LIMIT` e `ainda` há um `\n// ` que nenhum `\s+` casa. É a mesma armadilha do CRLF que este
    // repositório já pagou — um padrão que casa zero deixa o caso verde a medir nada.
    const naoImplementado = /FLASH_LIMIT[\s\S]{0,40}?NÃO está implementado/.test(layers);
    expect(naoImplementado, 'o FLASH_LIMIT foi implementado — mova o 2.3.1 para a tabela dos AFERIDOS').toBe(true);
    expect(DOC, 'o buraco do 2.3.1 saiu do índice sem o limitador ter sido escrito').toContain('2.3.1');
  });

  it('[Error] o crivo APANHA um caminho inventado — senão os casos acima não provam nada', () => {
    const falso = '`tests/nao-existe.node.test.js`';
    const achado = [...falso.matchAll(RE_CAMINHO)].map((m) => m[1]);
    expect(achado).toEqual(['tests/nao-existe.node.test.js']);
    expect(existsSync(join(RAIZ, achado[0]))).toBe(false);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · trocando `tests/weather.node.test.js` por `tests/weather-x.node.test.js` no documento → "[Right] todo
//     ficheiro citado EXISTE" reprova nomeando-o.
//   · tirando o ficheiro de `tests/` da linha do 1.3.1 (deixando só a promessa) → "[Right] toda linha de
//     AFERIDOS" reprova, que é o caso que impede uma citação de passar por gate.
//   · apagando do `core/layers.ts` a frase «FLASH_LIMIT ainda NÃO está implementado» → "[Interface] o buraco
//     do 2.3.1" reprova com a mensagem que manda mover o critério para a tabela de cima. ⚠️ É a mutação que
//     torna este ficheiro útil no dia em que a dívida for paga, em vez de ele ficar a descrever um passado.
//   · trocando o `RE_CAMINHO` por um que não case nada → "[Zero]" e "[Error]" reprovam. Sem o `[Zero]`, um
//     crivo partido deixaria "[Right] todo ficheiro citado" verde sobre um conjunto vazio.
