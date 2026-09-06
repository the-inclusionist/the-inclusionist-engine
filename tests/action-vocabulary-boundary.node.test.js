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
const CAMADAS_ENGINE = ['core', 'input', 'render', 'platform', 'ui', 'audio', 'boot'];

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
  /* --- OS TRANSPORTES. É aqui que o acoplamento dói: eles não sabem ler um controle, sabem ler um
   *     controle DESTE jogo. Um segundo jogo que não pule reescreve-os ou herda um vocabulário alheio. --- */
  'input/gamepad.ts': 41,
  'input/keyboard.ts': 28,
  'input/edges.ts': 9,
  'input/devices.ts': 8,
  'input/keydown.ts': 7,
  'input/touch.ts': 4,
  'input/keyboard-runtime.ts': 2,
  'input/touch-bindings.ts': 1,

  /* --- ⚠️ A QUARENTENA, e ela é de natureza diferente de todas as outras linhas desta tabela. --- */
  'input/vocabulary-migration.ts': 4,
  // Este módulo TEM de dizer `jump`: traduzir o nome antigo é a função dele. Quando a tabela nasceu dentro
  // de `input/keyboard.ts`, este gate reprovou — e estava certo. A saída NÃO foi levantar o teto do
  // keyboard, que é o afrouxamento que este ficheiro existe para impedir; foi quarentenar o acoplamento
  // inteiro num módulo cujo nome diz que ele é histórico, com teto próprio e data de morte.
  // ⚠️ ELE SE APAGA quando não restar dado salvo no formato antigo — o que não se sabe do lado do código,
  // porque o dado está no navegador de cada criança. Enquanto houver, apagá-lo apaga o remapeamento
  // de quem o fez.

  /* --- A INTERFACE, que mostra os rótulos. Estes saem quando o preset existir: o rótulo passa a vir do
   *     jogo em vez de estar escrito na engine. --- */
  'ui/shell.ts': 20,
  'ui/settings-controls.ts': 4,
  'ui/menu-nav.ts': 2,

  /* --- OS DOIS DE FORA DA ENTRADA, e cada um por um motivo diferente. --- */
  'render/player-anim.ts': 4,   // nomes de ANIMAÇÃO ('run', 'jump'), não de ação — a separar quando o
                                // render receber o vocabulário do jogo; hoje coincidem por acidente
  'core/constants.ts': 2,       // constantes de afinação da plataforma, que saem com o cartucho (#111)
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
