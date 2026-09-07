// SPDX-License-Identifier: AGPL-3.0-or-later
// A FRONTEIRA DO VOCABULÁRIO DE ENTRADA, como teste. Project node: só lê ficheiros.
//
// ========================= O QUE ELE SEPARA =========================
// O Dev disse o corte em 2026-09-06: *"deveríamos separar o que é do jogo, as ações com nome, do que é da
// engine, o nome abstrato e como é implementado nos diversos controles que programarmos."*
//
//   ENGINE  →  as quatorze POSIÇÕES (`core/actions.ts`) e como cada transporte as alcança.
//   JOGO    →  as PALAVRAS: pular, correr, trocar, especial — num `ActionPreset`.
//
// ========================= POR QUE ISTO É UM TETO E NÃO UMA PROIBIÇÃO =========================
// Medido hoje: a camada de engine diz as quatro palavras do jogo em 132 pontos, 13 ficheiros. Um teste que
// simplesmente reprovasse seria apagado ou afrouxado na primeira pressa — é a lição que o
// `engine-boundary.node.test.js` já escreveu e este ficheiro copia de propósito. Uma lista que só encolhe faz
// três coisas: deixa a suíte verde hoje, torna a dívida CONTÁVEL, e faz qualquer acoplamento NOVO falhar no
// mesmo minuto.
//
// ⚠️ E O DETECTOR TEM DE SER PRECISO OU A LISTA NASCE MENTINDO. `run` aparece em `toggleRun`, `runState`,
// `running` e `runEdge`, e NENHUMA delas é o nome de uma ação. Procura-se a palavra como IDENTIFICADOR, que
// neste código tem duas formas: literal entre aspas (`A('jump')`) e chave de objeto (`jump: b(0)`).
//
// ⚠️ COMENTÁRIOS FICAM DE FORA DA CONTAGEM, e isso é decisão: uma explicação que cita `jump` não acopla nada,
// e contá-la criaria o incentivo de APAGAR A EXPLICAÇÃO para baixar o número.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');
// ⚠️ `audio` ESTAVA AQUI E NUNCA EXISTIU (medido em 2026-09-07): os módulos de áudio vivem em `platform/`, e
// o `existsSync` de baixo devolvia lista vazia sem uma palavra. Era a terceira cópia da mesma lista à mão na
// suíte, e as três tinham derivado — a lista sai do `tsconfig.pkg.json`, que é quem decide o que é publicado.
// `educational` e `i18n` ficam de fora porque são DADO: uma não importa nada (gate próprio no
// `engine-boundary`) e a outra são os dicionários.
const CAMADAS_ENGINE = (() => {
  const cfg = JSON.parse(readFileSync(join(process.cwd(), 'tsconfig.pkg.json'), 'utf8')
    .split(String.fromCharCode(13)).join(''));
  return (cfg.include ?? [])
    .map((p) => p.split('\\').join('/'))
    .filter((p) => p.startsWith('app/js/'))
    .map((p) => p.slice('app/js/'.length))
    .filter((c) => c && !c.includes('/') && c !== 'educational' && c !== 'i18n')
    .sort();
})();

const CR = String.fromCharCode(13);
const COMENTARIO_LINHA = new RegExp('//[^\\n' + CR + ']*', 'g');
const COMENTARIO_BLOCO = /\/\*[\s\S]*?\*\//g;
const LITERAL = /['"](jump|run|swap|especial)['"]/g;
const CHAVE = /(?<![\w.])(jump|run|swap|especial)\s*:/g;

function modulosDe(camada) {
  const dir = join(RAIZ, camada);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${camada}/${f}`);
}
const MODULOS = CAMADAS_ENGINE.flatMap(modulosDe);

function ocorrencias(modulo) {
  const bruto = readFileSync(join(RAIZ, modulo), 'utf8').split(CR).join('');
  const semComentarios = bruto.replace(COMENTARIO_BLOCO, '').replace(COMENTARIO_LINHA, '');
  const a = semComentarios.match(LITERAL) || [];
  const b = semComentarios.match(CHAVE) || [];
  return a.length + b.length;
}

/**
 * ⚠️ OS NÚMEROS SAEM DESTE FICHEIRO, e não de uma varredura de fora. É a mesma lição que o gate de i18n
 * aprendeu à força: a primeira tabela dele foi preenchida por um script à parte e contou MENOS em sete
 * módulos. Quem for baixar um número, baixe-o pelo que ESTE teste reporta.
 *
 * Medido em 2026-09-06, antes de a migração da issue #103 começar.
 */
const DIVIDA = {
  /* --- ⚠️ OS TRANSPORTES SAÍRAM DAQUI EM 2026-09-06, e a lista de onde saíram fica escrita porque o número
   *     É o resultado: `input/gamepad` 41 · `input/keyboard` 28 · `ui/shell` 20 · `input/edges` 9 ·
   *     `input/devices` 8 · `input/keydown` 7 · `input/touch` 4 · `ui/settings-controls` 4 ·
   *     `input/keyboard-runtime` 2 · `ui/menu-nav` 2 · `input/touch-bindings` 1 = CENTO E VINTE E SEIS
   *     pontos, todos migrados para `action1`..`action4`.
   *
   *     Nenhuma linha morta fica: o teste [Zero] abaixo reprova quem tiver teto e dívida zero, e foi ele
   *     que exigiu esta limpeza no mesmo minuto em que a migração acabou. --- */

  /* --- ⚠️ A QUARENTENA, de natureza diferente de tudo o mais nesta tabela. --- */
  'input/vocabulary-migration.ts': 4,
  // Este módulo TEM de dizer `jump`: traduzir o nome antigo é a função dele. Quando a tabela nasceu dentro
  // de `input/keyboard.ts`, este gate reprovou — e estava certo. A saída NÃO foi levantar o teto do
  // keyboard, que é o afrouxamento que este ficheiro existe para impedir; foi quarentenar o acoplamento
  // inteiro num módulo cujo nome diz que ele é histórico, com teto próprio e data de morte.
  // ⚠️ ELE SE APAGA quando não restar dado salvo no formato antigo — o que não se sabe do lado do código,
  // porque o dado está no navegador de cada criança. Enquanto houver, apagá-lo apaga o remapeamento de
  // quem o fez.

  /* --- O QUE SOBRA, e nenhum dos dois é acoplamento de ENTRADA. --- */
  'core/constants.ts': 2,       // afinação da plataforma (`TUNE.jumpVel`), que sai com o cartucho (#111)
  'render/player-anim.ts': 1,   // ⚠️ `tex.run` é NOME DE ANIMAÇÃO — o conjunto de quadros da corrida — e
                                // NÃO o nome de uma ação. O renomeador da migração trocou-o por engano e
                                // o teste rebentou com `Cannot read properties of undefined`. Fica como
                                // lembrete de que um crivo por FORMA não distingue os dois sentidos que a
                                // mesma palavra tem neste repositório.
};

describe('a engine não fala as palavras do jogo (o corte do Dev, 2026-09-06)', () => {
  it('[Right] NENHUM módulo NOVO passa a nomear uma ação do jogo', () => {
    const novos = MODULOS.filter((m) => !(m in DIVIDA))
      .flatMap((m) => (ocorrencias(m) > 0 ? [`${m}:${ocorrencias(m)}`] : []));
    expect(novos, 'módulo de engine nomeando ação do jogo — use `core/actions` e o preset do jogo').toEqual([]);
  });

  it('[Boundary] a dívida de cada módulo é um TETO: só encolhe', () => {
    const cresceram = {};
    for (const [m, teto] of Object.entries(DIVIDA)) {
      const n = ocorrencias(m);
      if (n > teto) cresceram[m] = `${teto} → ${n}`;
    }
    expect(cresceram, 'módulo ganhou acoplamento novo ao vocabulário do jogo').toEqual({});
  });

  it('[Zero] a lista não guarda módulo que já se limpou', () => {
    // Sem esta, uma entrada morta ficaria a dizer que há dívida onde não há, e a próxima pessoa
    // procuraria o que consertar sem achar.
    const limpos = Object.keys(DIVIDA).filter((m) => ocorrencias(m) === 0);
    expect(limpos, 'módulo com teto e sem dívida — apague a linha').toEqual([]);
  });

  it('⚠️ o total A PAGAR desce, e a quarentena não conta nele', () => {
    // ⚠️ ESTA ASSERÇÃO JÁ ESTEVE ERRADA, e o erro vale mais escrito do que corrigido em silêncio: ela somava
    // `input/vocabulary-migration.ts` ao total, então criar o módulo de migração fez o número SUBIR de 132
    // para 136 e o gate reprovou uma mudança que estava certa.
    //
    // A quarentena não é dívida que a migração paga — ela É a migração. Dívida é o que os transportes têm de
    // deixar de dizer; o tradutor tem de dizer, e desaparece por outro caminho (quando não houver mais dado
    // antigo), não por alguém o consertar.
    const APAGA_SE_SOZINHO = ['input/vocabulary-migration.ts'];
    const aPagar = Object.keys(DIVIDA)
      .filter((m) => !APAGA_SE_SOZINHO.includes(m))
      .reduce((s, m) => s + ocorrencias(m), 0);
    expect(aPagar).toBeGreaterThan(0);
    expect(aPagar).toBeLessThanOrEqual(132);
  });

  it('os dois módulos NOVOS do vocabulário estão limpos, e é isso que prova que o corte é possível', () => {
    expect(ocorrencias('core/actions.ts')).toBe(0);
    expect(ocorrencias('input/default-bindings.ts')).toBe(0);
  });
});
