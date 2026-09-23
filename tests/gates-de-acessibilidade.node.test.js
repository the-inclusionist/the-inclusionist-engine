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
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Todo módulo de `app/js`, para uma pergunta que é sobre a ÁRVORE e não sobre um ficheiro nomeado. */
function todosOsModulos(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) todosOsModulos(p, out);
    else if (n.endsWith('.ts')) out.push(p);
  }
  return out;
}

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
    /*
     * 🔴 O PISO DESCEU DE NOVE PARA OITO EM 23/09, e não é afrouxamento: é o número a seguir a realidade. Dois
     * critérios SAÍRAM da tabela dos aferidos porque os casos que os provavam saíram do repositório na F12
     * (ADR-0228) — o 2.2.2 ia com o gate do clima e o 2.4.1 com os da ordem de camadas. ⚠️ Eles não foram
     * apagados: estão na tabela dos BURACOS, que é onde um critério sem caso AQUI pertence, e essa é a perda
     * que este commit regista em vez de esconder.
     *
     * 📌 O piso existe para apanhar o documento a DESABAR (uma varredura que deixe de casar devolve zero e
     * nada reprova), não para fixar quantos critérios estão provados. Por isso ele acompanha a tabela.
     */
    expect(aferidos.length).toBeGreaterThanOrEqual(8);
    const fracas = aferidos.filter((l) => !/`tests\/[^`]+\.test\.js`/.test(l)).map((l) => l.slice(0, 60));
    expect(fracas, 'critério na tabela de AFERIDOS sem caso em tests/:\n  ' + fracas.join('\n  ')).toEqual([]);
  });

  it('⚠️ [Interface] o buraco do 2.3.1 continua nomeado enquanto o `FLASH_LIMIT` não existir', () => {
    /*
     * 🔴 O BURACO FICOU MAIOR EM 23/09, E ESTE CASO MUDOU DE FORMA POR ISSO. Ele lia `core/layers.ts`, que
     * DECLARAVA o `FLASH_LIMIT` como o passe mais externo e dizia, no próprio ficheiro, que ele ainda não
     * estava implementado. Esse módulo saiu na F12 (ADR-0228): uma ordem-z é a ordem das camadas de um jogo.
     *
     * ⚠️ O QUE SAIU COM ELE NÃO FOI SÓ A ORDEM — foi o único sítio da engine onde o limitador de cintilação
     * tinha morada marcada. Antes havia «o lugar certo já ocupado»; agora não há lugar nenhum. E isto é
     * SEGURANÇA sobre epilepsia fotossensível, não conforto.
     *
     * 🎯 Então o caso passa a medir a ausência em vez de a declaração: enquanto NENHUM módulo desta árvore
     * nomear o `FLASH_LIMIT`, o 2.3.1 tem de continuar nomeado como buraco. No dia em que a engine voltar a
     * declará-lo — que é a fronteira seguinte — este caso reprova e obriga a rever a linha.
     */
    /*
     * ⚠️ DECLARAÇÃO E NÃO MENÇÃO, e a primeira escrita deste caso confundiu as duas: o `core/flash-threshold`
     * NOMEIA o `FLASH_LIMIT` num comentário — «ADR-0020 names a FLASH_LIMIT pass and the engine limits nothing
     * a cartridge flashes: it does not own the render» — que é precisamente uma frase sobre o que a engine NÃO
     * tem. Procurar o texto fazia o caso reprovar por causa da frase que lhe dá razão.
     */
    const DECLARA = /(?:const|let|var|export\s+const)\s+FLASH_LIMIT\b|\bFLASH_LIMIT\s*:/;
    const declarado = todosOsModulos(join(RAIZ, 'app', 'js')).some((f) => DECLARA.test(readFileSync(f, 'utf8')));
    expect(declarado, 'a engine voltou a declarar o FLASH_LIMIT — reveja a linha do 2.3.1 neste índice').toBe(false);
    expect(DOC, 'o buraco do 2.3.1 saiu do índice sem o limitador ter sido escrito').toContain('2.3.1');
    expect(DOC, 'o índice deixou de dizer que a própria DECLARAÇÃO do limitador saiu').toContain('ADR-0228');
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
