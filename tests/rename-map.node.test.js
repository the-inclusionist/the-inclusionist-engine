// SPDX-License-Identifier: AGPL-3.0-or-later
//
// O MAPA DA RENOMEAÇÃO, E A REGRA QUE IMPEDE ELE DE ESTRAGAR PROSA (ADR-0219; issue #202).
//
// A superfície pública passa a falar inglês numa release quebrante só, e o que renomeia é um FICHEIRO — o mapa —, porque a
// tabela de migração é impressa dele: um nome não pode ser renomeado sem ficar escrito. O que este crivo mede é o que uma
// suíte grande não veria num commit de 93 ficheiros.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renameInText, readMap } from '../scripts/apply-rename.mjs';

const RAIZ = process.cwd().endsWith('app') ? join(process.cwd(), '..') : process.cwd();

describe('o mapa é declaração, não adivinhação', () => {
  /*
   * ⚠️ SÓ AS CAMADAS POR APLICAR, e a razão é mecânica: depois de uma camada correr, o nome NOVO existe na árvore de
   * propósito, e uma verificação de colisão que não soubesse disso acusaria o próprio trabalho de ontem. O campo `done` de
   * cada camada é o que separa «ainda vai renomear» de «já renomeou» — e é por isso que ele é dado do mapa e não memória.
   */
  it('🔴 [Right] todo nome novo é inglês, e nenhum choca com um nome que já existe', () => {
    const mapa = readMap();
    const porAplicar = Object.values(mapa.layers).filter((l) => !l.done);
    const pares = porAplicar.flatMap((l) => Object.entries(l.names));
    const aplicadas = Object.values(mapa.layers).filter((l) => l.done);
    expect(pares.length + aplicadas.length, 'o mapa está vazio').toBeGreaterThan(0);

    const retrato = JSON.parse(readFileSync(join(RAIZ, 'docs/6-DevOps-SRE/public-surface.json'), 'utf8'));
    const existentes = new Set(Object.values(retrato).flat());
    const { pt } = (() => {
      const l = JSON.parse(readFileSync(join(RAIZ, 'scripts/word-lists.json'), 'utf8'));
      return { pt: new Set(l.portuguese) };
    })();
    const palavras = (n) => n.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

    const aindaPortugues = pares.filter(([, novo]) => palavras(novo).some((w) => pt.has(w)));
    expect(aindaPortugues, 'um nome «novo» que continua português renomeia para o mesmo problema').toEqual([]);
    // 🔴 Uma COLISÃO é a forma silenciosa de estragar isto: dois módulos a publicar o mesmo nome, e o `tsc` só reclama onde os
    // dois se encontram — que pode ser em nenhum ficheiro.
    const colisoes = pares.filter(([velho, novo]) => existentes.has(novo) && novo !== velho);
    expect(colisoes, 'o nome novo já é de outra coisa').toEqual([]);
    const destinos = pares.map(([, novo]) => novo);
    expect(new Set(destinos).size, 'dois nomes velhos apontam para o mesmo nome novo').toBe(destinos.length);
  });
});

describe('a renomeação não estraga prosa', () => {
  const nomes = { LINHAS: 'ROWS', modoCego: 'blindMode' };

  it('🔴 [Right] em código renomeia tudo — inclusive dentro de cadeias, porque um nome de evento É a superfície', () => {
    const antes = "import { LINHAS } from './x.js';\nstate.on('modoCego', () => LINHAS);\n";
    expect(renameInText(antes, nomes).text)
      .toBe("import { ROWS } from './x.js';\nstate.on('blindMode', () => ROWS);\n");
  });

  /*
   * 🔴 ESTE É O CASO QUE FEZ A REGRA EXISTIR. 📏 Medido antes de renomear uma linha: `LINHAS` é o número de linhas da grelha de
   * flashes E é a palavra portuguesa em dezassete comentários de prosa deste repositório. Uma substituição por palavra inteira
   * deixaria «🎯 TRÊS ROWS, UM PAINEL» — prosa estragada dentro de um commit grande demais para alguém a ver.
   */
  it('🔴 [Zero] num comentário, a PALAVRA fica e o identificador entre crases muda', () => {
    const antes = '// 🎯 TRÊS LINHAS, UM PAINEL: o `LINHAS` da grelha é outra coisa\nconst n = LINHAS;\n';
    const depois = renameInText(antes, nomes).text;
    expect(depois, 'a prosa do comentário foi reescrita').toContain('TRÊS LINHAS, UM PAINEL');
    expect(depois, 'o identificador citado entre crases ficou com o nome velho').toContain('`ROWS`');
    expect(depois, 'o código não foi renomeado').toContain('const n = ROWS;');
  });

  it('⚠️ [Boundary] num `.md` é o contrário: tudo é prosa menos o que está entre crases', () => {
    const antes = 'As LINHAS do rodapé mudaram, e `LINHAS` passou a ser lido do catálogo.\n';
    expect(renameInText(antes, nomes, { prose: true }).text)
      .toBe('As LINHAS do rodapé mudaram, e `ROWS` passou a ser lido do catálogo.\n');
  });

  it('🎯 [Zero] palavra INTEIRA: um nome que contém outro não é partido ao meio', () => {
    const antes = 'const LINHAS_DO_RODAPE = 2; const x = modoCegoDica; const y = LINHAS;\n';
    expect(renameInText(antes, nomes).text)
      .toBe('const LINHAS_DO_RODAPE = 2; const x = modoCegoDica; const y = ROWS;\n');
  });

  /*
   * 🔴 O CASO QUE FALTAVA, e ele custou um valor de DADOS já commitado: `'dentro-da-zona'` — o motivo que o motor adaptativo
   * dá para manter o nível — saiu como `'isInside-da-zona'`, metade em inglês, numa cadeia que nenhuma tabela de migração
   * menciona e que um jogo pode ter guardado. A regra de então dizia «cadeia sem espaços é um nome»; a regra certa é mais
   * estreita: renomeia-se uma cadeia quando ela É o nome, inteira. É o que distingue o nome de um evento («modoCego», que a
   * superfície publica) de um pedaço de um valor composto.
   */
  it('🔴 [Zero] numa cadeia só se renomeia o nome INTEIRO — um valor composto é dado, não nome', () => {
    const nomes = { dentro: 'isInside', modoCego: 'blindMode' };
    expect(renameInText("const m = 'dentro-da-zona';", nomes).text,
      'um pedaço de um valor composto foi renomeado').toBe("const m = 'dentro-da-zona';");
    expect(renameInText("state.on('modoCego', f);", nomes).text,
      'o nome de um evento É a superfície pública, e ficou por renomear').toBe("state.on('blindMode', f);");
    expect(renameInText('if (dentro(f)) return;', nomes).text).toBe('if (isInside(f)) return;');
  });

  it('📌 [Interface] e a conta do que mudou é por nome — é ela que diz se um nome do mapa não existe na árvore', () => {
    const { counted } = renameInText('LINHAS + LINHAS + modoCego', nomes);
    expect(counted).toEqual({ LINHAS: 2, modoCego: 1 });
  });
});
