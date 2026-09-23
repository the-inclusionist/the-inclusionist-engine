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
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

/*
 * ========================= FASE 3: O NOME DO FICHEIRO TAMBÉM É SUPERFÍCIE =========================
 * Um jogo escreve `from '@the-inclusionist/engine/core/anel.js'`, logo um CAMINHO é contrato tanto quanto um nome. O que muda
 * face à fase 2 é o que se pode medir: um nome vive no retrato da superfície, mas um ficheiro vive no DISCO — e por isso estes
 * casos perguntam ao sistema de ficheiros, que é a única testemunha que não repete o que o mapa diz.
 */
/*
 * 🔴 O QUE MUDOU DE NOME E DEPOIS MUDOU DE REPOSITÓRIO. O mapa da fase 3 regista «X passou a Y», e para sete
 * ficheiros o Y deixou de existir aqui — não porque o rename falhou, mas porque o ADR-0228 tirou da engine os
 * módulos que descrevem um jogo, e estes foram com eles para o `game-platformer`.
 *
 * 📌 DECLARADOS COM O MOTIVO, e não apagados do mapa: o mapa é o registo de uma migração que aconteceu, e
 * reescrevê-lo faria a fase 3 parecer menor do que foi. É a mesma escolha que o livro dos ponteiros mortos faz,
 * pela mesma razão — «X virou Y» é dado SOBRE caminhos, e um livro que se deixa reescrever deixa de ser livro.
 *
 * ⚠️ E a metade VELHA do par continua a ser exigida: o ficheiro com o nome antigo não pode estar de volta aqui.
 * Só a existência do NOVO é dispensada, e só para estes sete.
 */
const SAIRAM = {
  'app/js/render/scenery-data.ts': 'ADR-0228: os cenários são de um jogo',
  'app/js/render/set-scenery.ts': 'ADR-0228: idem — quem escolhe o cenário é o cartucho',
  'tests/scenery-data.node.test.js': 'ADR-0228: foi com o módulo',
  'tests/set-scenery.node.test.js': 'ADR-0228: foi com o módulo',
  'tests/cloud-blanket.node.test.js': 'ADR-0228: nuvens são cenário — foi com `render/scene-sky`',
  'tests/scene-parallax-buildings.node.test.js': 'ADR-0228: foi com `render/scene-parallax`',
  'tests/scene-parallax-silhouettes.node.test.js': 'ADR-0228: foi com `render/scene-parallax`',
};

describe('o mapa dos FICHEIROS diz a verdade sobre o disco', () => {
  const fileLayers = () => Object.entries(readMap().fileLayers ?? {});

  it('🔴 [Right] o que uma camada aplicada moveu ESTÁ movido: o novo existe, o velho não', () => {
    const feitas = fileLayers().filter(([, l]) => l.done);
    expect(feitas.length, 'nenhuma camada de ficheiros foi aplicada ainda — este caso não mede nada').toBeGreaterThan(0);
    const errados = [];
    for (const [camada, l] of feitas) {
      for (const [velho, novo] of Object.entries(l.files)) {
        if (existsSync(join(RAIZ, velho))) errados.push(`${camada}: ${velho} continua lá`);
        if (!existsSync(join(RAIZ, novo)) && !(novo in SAIRAM)) errados.push(`${camada}: ${novo} não existe`);
      }
    }
    expect(errados, 'o mapa diz que moveu e o disco diz que não').toEqual([]);
  });

  it('⚠️ [Zero] uma entrada de `SAIRAM` que VOLTOU reprova — senão a lista de excepções vira coringa', () => {
    /*
     * 🔴 Uma lista de excepções que sobrevive ao facto que a justificava é pior do que não a ter: ela autoriza
     * de graça. Este caso é o par do de cima, e é o que mantém a dispensa amarrada à realidade — se um destes
     * sete voltar à árvore, a linha que o dispensa tem de sair com ele.
     */
    const voltaram = Object.keys(SAIRAM).filter((p) => existsSync(join(RAIZ, p)));
    expect(voltaram, 'está de volta na árvore e continua declarado como tendo saído').toEqual([]);
  });

  it('🔴 [Right] o caminho novo é inglês, e nenhum ficheiro velho aponta para dois sítios', () => {
    const todas = fileLayers().flatMap(([, l]) => Object.entries(l.files));
    const pt = new Set(JSON.parse(readFileSync(join(RAIZ, 'scripts/word-lists.json'), 'utf8')).portuguese);
    // O nome do ficheiro parte-se como um identificador se parte: por `-`, `.` e `_`, e o que sobra é palavra.
    const palavras = (p) => p.split('/').pop().replace(/\.[a-z.]+$/i, '').split(/[-._]/).map((w) => w.toLowerCase());
    const aindaPortugues = todas.filter(([, novo]) => palavras(novo).some((w) => pt.has(w)));
    expect(aindaPortugues, 'um caminho «novo» que continua português move para o mesmo problema').toEqual([]);
    const destinos = todas.map(([, novo]) => novo);
    expect(new Set(destinos).size, 'dois ficheiros velhos apontam para o mesmo ficheiro novo').toBe(destinos.length);
  });

  it('🎯 [Zero] e NINGUÉM na árvore ainda importa um caminho que já não existe', () => {
    /*
     * ⚠️ ESTE É O CASO QUE O `tsc` NÃO FAZ, e é por isso que ele está aqui: um `import` de um ficheiro que sumiu é erro de
     * tipos, sim — mas um caminho escrito numa CADEIA (um crivo que nomeia o módulo que guarda, um livro-razão chaveado por
     * caminho, um `.md`) não é lido por compilador nenhum. Foi assim que o inventário da dívida ficou a falar de
     * `core/anel.ts` depois de `core/anel.ts` já não existir.
     */
    const movidos = fileLayers().filter(([, l]) => l.done).flatMap(([, l]) => Object.keys(l.files));
    expect(movidos.length, 'nada movido — este caso não mede nada').toBeGreaterThan(0);
    // As duas formas de cada caminho movido (`.ts` no disco, `.js` num import), numa alternação só. O `Set` guarda a
    // contagem igual à da versão anterior: uma entrada por FORMA distinta encontrada no ficheiro, não por ocorrência.
    const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const FORMAS_MOVIDAS = new RegExp(
      [...new Set(movidos.flatMap((v) => [v, v.replace(/\.ts$/, '.js')]))].map(escapar).join('|'), 'g');
    const rastreados = execFileSync('git', ['ls-files'], { cwd: RAIZ, encoding: 'utf8' }).trim().split(/\r?\n/);
    const sobras = [];
    for (const f of rastreados) {
      if (f === 'scripts/rename-map.json' || f === 'scripts/apply-file-rename.mjs') continue; // CITAM os velhos de propósito
      if (f === 'docs/6-DevOps-SRE/Breaking-Changes.md' || f === 'CHANGELOG.md') continue;    // a tabela de migração vive deles
      if (f === 'tests/rename-map.node.test.js') continue;                                     // e este ficheiro também os cita
      /*
       * ⚠️ E O LIVRO DOS PONTEIROS MORTOS, que é o caso mais interessante desta lista porque nasceu de DOIS PORTÕES EM
       * CONFLITO. O `ponteiros-de-registo` exige que um caminho citado por um registo e já inexistente seja DECLARADO pelo
       * nome, com o motivo; este caso proíbe escrever um caminho movido. Os dois têm razão, e quem cede é este: um livro que
       * regista o que morreu tem de poder nomear o que morreu. A prosa de um registo é história e não se reescreve (ADR-0057),
       * logo alguém tem de dizer, em algum sítio, para onde o ficheiro foi — e esse sítio é aquele livro.
       */
      if (f === 'tests/ponteiros-de-registo.node.test.js') continue;
      const texto = readFileSync(join(RAIZ, f), 'utf8');
      // ⚠️ UMA PASSAGEM POR FICHEIRO, e não uma por caminho movido. A primeira versão fazia `includes` para cada uma das
      // ~320 formas dentro do laço dos ~1050 ficheiros rastreados — ~335 mil varreduras do texto inteiro —, e sob a carga
      // da suíte o caso estourava o tecto de 5 s em cerca de uma corrida em cinco. Um vermelho que vem da máquina e não
      // do código invalida o que estiver a ser medido ao lado dele; o conserto é o trabalho encolher, nunca o relógio crescer.
      for (const forma of new Set([...texto.matchAll(FORMAS_MOVIDAS)].map((m) => m[0]))) sobras.push(`${f} → ${forma}`);
    }
    expect(sobras, 'alguém ainda escreve um caminho que foi movido').toEqual([]);
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

/*
 * ========================= MUTAÇÕES CONFERIDAS =========================
 * ⚠️ O cabeçalho deste ficheiro prometia esta secção desde que ele nasceu e ela não existia. As da FASE 2 estão escritas nas
 * mensagens dos oito commits das camadas, que é onde nasceram; as da FASE 3 ficam aqui, onde foram prometidas (2026-09-22).
 *
 * FASE 3 — os três casos dos nomes de FICHEIRO:
 *   1. o mapa diz que moveu e o disco discorda (`ring.ts` devolvido a `anel.ts`) ......... 2 VERMELHOS (o do disco e o das sobras)
 *   2. um caminho «novo» que continua português (`anel-novo.ts`) ........................ 3 VERMELHOS
 *   3. uma referência obsoleta deixada escrita num ficheiro rastreado ................... 1 VERMELHO, e é SÓ o caso das sobras
 *      — é a mutação que mais importa, porque é a única que o `tsc` nunca veria: um caminho dentro de uma CADEIA (um crivo que
 *        nomeia o módulo que guarda, um livro-razão chaveado por caminho, um `.md`) não é lido por compilador nenhum.
 *   4. dois ficheiros velhos a apontar para o mesmo ficheiro novo ...................... 3 VERMELHOS
 *
 * 🔴 E O PRÓPRIO SCRIPT DE MUTAÇÃO ESTRAGOU A ÁRVORE à primeira volta: o «desfazer» apagava o ficheiro reposto sem perguntar se
 * ele existia, e com a mutação 1 aplicada (o novo já não existe) apagou-o de vez. Reposto à mão, e o guarda entrou no script.
 * Uma ferramenta de mutação sem rede é pior do que mutação nenhuma — ela mede e destrói na mesma passagem.
 */
