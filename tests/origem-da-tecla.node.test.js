// SPDX-License-Identifier: AGPL-3.0-or-later
// A ORIGEM DA TECLA NÃO SE PERDE À PORTA — a metade da ARESTA do ADR-0109, e o crivo que ela deve.
//
// ========================= A ERASÃO QUE ISTO EXISTE PARA ACABAR =========================
// A issue #114 §C ficou por construir dois meses por uma razão medida: `input/state.keys` é um `Set<string>`
// de CÓDIGOS, o toque escreve lá dentro e a webcam despacha `KeyboardEvent` sintético — quando o `held()`
// responde, já não há como saber QUEM carregou. A pergunta que a alternância faz («este toque veio de um
// aparelho com alternância?») tinha a resposta deitada fora antes de ser feita.
//
// ⚠️ E O CRIVO É INVENTÁRIO, não busca por palavra: «isto perdeu a origem» não se grepa. O que se congela é
// a lista de quem escreve no conjunto SEM passar pelo par — e cada entrada diz que transporte aquele módulo
// vai carimbar quando migrar. É essa frase, escrita à mão, que impede um escritor novo de entrar calado.
//
// 📌 HOJE A LISTA NÃO ESTÁ VAZIA, e isso é o estado real do estrangulamento: o campo novo existe ao lado do
// velho, sincronizado num ponto só, e os quatro escritores migram um a um — cada commit verde. A lista
// encolhe; quando chegar a zero, o crivo passa a afirmar a ausência inteira.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  keys, origemDaTecla, marcarTecla, soltarTecla, soltarTodas, origemDe, held,
} from '../app/js/input/state.js';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));

/** Escrita directa no conjunto de teclas, em qualquer dos nomes por que ele viaja. */
const ESCREVE_CRU = /\b(?:heldKeys|keys)\.(?:add|delete|clear)\s*\(/;

function ficheirosTs(dir = RAIZ) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...ficheirosTs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(p);
  }
  return saida;
}

/** Linhas de CÓDIGO (comentário não conta) que mexem no conjunto sem passar pelo par. */
function escritasCruasDe(p) {
  return readFileSync(p, 'utf8').split(/\r?\n/)
    .filter((ln) => !/^\s*(\/\/|\*|\/\*)/.test(ln) && ESCREVE_CRU.test(ln)).length;
}

/**
 * QUEM AINDA ESCREVE CRU, e que transporte cada um vai carimbar quando migrar.
 *
 * ⚠️ O `input/state.ts` está aqui e FICA: é ele o par. Os outros dois saem à medida que migram.
 */
const POR_MIGRAR = {
  'input/state.ts': 'o PAR — é aqui que `marcarTecla`/`soltarTecla`/`soltarTodas` vivem, e é por isso que ele escreve',
  'input/keydown.ts': 'vai carimbar `teclado` — ⚠️ MENOS quando o evento não for de confiança: a webcam despacha `KeyboardEvent` sintético e cairia como teclado. `isTrusted` distingue-os, e QUAL transporte assistido é ainda tem de vir declarado',
  'input/touch-bindings.ts': 'vai carimbar `toque` — é o transporte cuja alternância a regra 2 do ADR-0109 liga',
};

describe('ADR-0109 · a origem da tecla viaja com ela', () => {
  beforeEach(() => { soltarTodas(); });

  it('[Right] marcar escreve NOS DOIS, e o `held` continua a ver a tecla', () => {
    marcarTecla('KeyA', 'toque');
    expect(keys.has('KeyA')).toBe(true);
    expect(origemDe('KeyA')).toBe('toque');
    expect(held({ ctrl: { jump: ['KeyA'] }, pad: -1 }, 'jump')).toBe(true);
  });

  it('⚠️ [Right] soltar limpa NOS DOIS — um mapa que sobrevive à tecla descreve quem já ninguém segura', () => {
    marcarTecla('KeyA', 'toque');
    soltarTecla('KeyA');
    expect(keys.has('KeyA')).toBe(false);
    expect(origemDe('KeyA')).toBeUndefined();
    expect(origemDaTecla.size).toBe(0);
  });

  it('⚠️ [Zero] `soltarTodas` limpa os dois — é a rede do `blur`, e meia rede não é rede', () => {
    marcarTecla('KeyA', 'toque');
    marcarTecla('KeyB', 'teclado');
    soltarTodas();
    expect(keys.size).toBe(0);
    expect(origemDaTecla.size).toBe(0);
  });

  it('⚠️ [Zero] uma tecla de origem DESCONHECIDA responde `undefined`, e não um padrão', () => {
    // ⚠️ ESTE É O CASO QUE IMPEDE A ERASÃO DE VOLTAR POR OUTRA PORTA. Um padrão `teclado` faria uma tecla do
    // TOQUE — entrada por um escritor ainda não migrado — ser lida como teclado: a alternância desligava-se
    // sozinha e nada o diria. Não saber é uma resposta; fingir que se sabe não é.
    keys.add('KeyZ'); // o caminho antigo, que ainda existe enquanto os escritores migram
    expect(keys.has('KeyZ')).toBe(true);
    expect(origemDe('KeyZ')).toBeUndefined();
  });

  it('[Boundary] marcar duas vezes com origens diferentes fica com a ÚLTIMA', () => {
    // A tecla é a mesma, o aparelho mudou — e o que interessa é quem a segura AGORA.
    marcarTecla('KeyA', 'teclado');
    marcarTecla('KeyA', 'toque');
    expect(origemDe('KeyA')).toBe('toque');
    expect(keys.size).toBe(1);
  });

  it('⚠️ [Interface] nenhum escritor CRU novo entrou sem ser declarado', () => {
    const crus = ficheirosTs()
      .map((p) => [relative(RAIZ, p).split('\\').join('/'), escritasCruasDe(p)])
      .filter(([, n]) => n > 0)
      .map(([m]) => m);
    const novos = crus.filter((m) => !(m in POR_MIGRAR));
    expect(
      novos,
      'módulo novo a escrever no conjunto de teclas SEM origem. Use `marcarTecla`/`soltarTecla` de '
      + '`input/state`; se ainda não puder, declare-o aqui dizendo que transporte ele vai carimbar — e é '
      + 'nessa frase que «não sei de onde vem» teria de ser escrito à mão em vez de entrar calado.',
    ).toEqual([]);
  });

  it('[Interface] a lista de POR_MIGRAR não tem órfãos — quem já migrou sai dela', () => {
    const crus = new Set(ficheirosTs()
      .map((p) => [relative(RAIZ, p).split('\\').join('/'), escritasCruasDe(p)])
      .filter(([, n]) => n > 0).map(([m]) => m));
    expect(Object.keys(POR_MIGRAR).filter((m) => !crus.has(m)), 'entrada de quem já não escreve cru').toEqual([]);
  });

  it('⚠️ [Interface] e o crivo continua VIVO: ele acha os escritores que existem', () => {
    // Sem isto, uma regex morta deixaria os dois casos acima verdes por não terem nada que examinar.
    const crus = ficheirosTs().filter((p) => escritasCruasDe(p) > 0);
    expect(crus.length, 'a varredura não achou escritor nenhum — a regex ou o caminho morreram').toBeGreaterThan(1);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · `marcarTecla` a escrever so em `keys` (sem o mapa) -> reprova "marcar escreve NOS DOIS". E a divergencia
//     silenciosa: o jogo anda na mesma e so a alternancia fica errada.
//   · `soltarTecla` a nao apagar do mapa -> reprova "soltar limpa NOS DOIS". O mapa passaria a descrever
//     teclas que ja ninguem segura, e a origem lida seria a de um toque que acabou.
//   · `soltarTodas` a nao limpar o mapa -> reprova o caso do `blur`. Meia rede de ciclo de vida nao e rede.
//   · ⚠️ `origemDe` a devolver `'teclado'` em vez de `undefined` -> reprova o caso da origem DESCONHECIDA.
//     E a mutacao mais perigosa das seis: e a leitura "razoavel" que faz a erasao voltar por outra porta.
//   · matando a regex `ESCREVE_CRU` -> reprovam DOIS, e o que interessa e o do VACUO: sem ele, o inventario
//     passaria por nao ter nada que examinar.
//   · tirando `input/keydown.ts` do `POR_MIGRAR` -> reprova "escritor CRU novo". E a deriva realista: a lista
//     deixa de cobrir quem escreve, e o crivo passa a olhar para menos do que existe.
