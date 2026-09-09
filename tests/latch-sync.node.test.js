// SPDX-License-Identifier: AGPL-3.0-or-later
// A ALTERNÂNCIA SEGUE O CONTROLE — e trocar de controle NÃO escreve nada (ADR-0113 cláusula 1, issue #127).
//
// ========================= O QUE ESTE FICHEIRO AFIRMA, E POR QUE É EM SEQUÊNCIAS =========================
// «Trocar de controle troca a alternância» não quer dizer nada sem se ter trocado. É a lição que os casos do
// `input/transporte-em-uso` já tinham escrito: um caso que chama uma função uma vez mede a função; o que faz
// a criança tropeçar é a ORDEM. Então os casos daqui são sequências — o mesmo jogador, dois aparelhos.
//
// 🎯 E A PROPRIEDADE MAIS IMPORTANTE É NEGATIVA: o armazenamento CONTA as escritas, e a troca de transporte
// tem de somar ZERO. Um `sincronizar` que gravasse o valor resolvido apagaria, na primeira aresta, a escolha
// que a criança fez no outro controle — e ficaria verde em todos os casos positivos.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { aplicarAlternancia, sincronizarAlternancia, BASE_DA_MARCHA } from '../app/js/input/latch-sync.js';
import { chaveDaAlternancia, chaveLegadaDaAlternancia } from '../app/js/input/latch-scope.js';

/** Um armazém de mentira que CONTA as escritas — é a contagem que prova a cláusula 1. */
function armazemFalso(inicial = {}) {
  const dados = { ...inicial };
  const escritas = [];
  return {
    get: (chave) => (chave in dados ? dados[chave] : null),
    set: (chave, valor) => { escritas.push(chave); dados[chave] = valor; },
    escritas,
  };
}

const jogador = () => ({ toggleMove: false, walkDir: 0 });
const chave = (i, transporte) => chaveDaAlternancia(BASE_DA_MARCHA, i, transporte);
const legada = (i) => chaveLegadaDaAlternancia(BASE_DA_MARCHA, i);

describe('a alternância resolvida para o transporte em uso', () => {
  it('[Zero] nada guardado e sem legado: fica o padrão de fábrica, e ninguém escreve', () => {
    const a = armazemFalso();
    const p = jogador();
    expect(sincronizarAlternancia(p, a, 0, 'teclado', false), 'não havia o que mudar').toBe(false);
    expect(p.toggleMove).toBe(false);
    expect(a.escritas, 'resolver não é gravar').toEqual([]);
  });

  it('🎯 [Sequência] o MESMO jogador com dois aparelhos recebe duas respostas — e o disco não é tocado', () => {
    const a = armazemFalso({ [chave(0, 'gamepad')]: '1', [chave(0, 'teclado')]: '0' });
    const p = jogador();

    expect(sincronizarAlternancia(p, a, 0, 'gamepad', false), 'ligou ao pegar no controle').toBe(true);
    expect(p.toggleMove, 'o valor do GAMEPAD não chegou').toBe(true);

    expect(sincronizarAlternancia(p, a, 0, 'teclado', false), 'a troca tinha de mudar a resposta').toBe(true);
    expect(p.toggleMove, 'o teclado herdou o estado do gamepad').toBe(false);

    expect(a.escritas, 'trocar de aparelho GRAVOU — a escolha do outro controle seria apagada').toEqual([]);
  });

  it('⚠️ [Boundary] o `false` guardado é um VALOR: não deixa o legado ligado passar por cima', () => {
    const a = armazemFalso({ [chave(0, 'teclado')]: '0', [legada(0)]: '1' });
    const p = jogador();
    sincronizarAlternancia(p, a, 0, 'teclado', false);
    expect(p.toggleMove, 'o legado atropelou uma escolha explícita deste aparelho').toBe(false);
  });

  it('📌 a criança que já jogava não perde o ajuste: só o legado, e ele vale para o aparelho novo', () => {
    const a = armazemFalso({ [legada(0)]: '1' });
    const p = jogador();
    sincronizarAlternancia(p, a, 0, 'gamepad', false);
    expect(p.toggleMove, 'o ajuste guardado antes da divisão desapareceu').toBe(true);
  });

  it('🔴 nos quatro assistidos responde LIGADA mesmo com um `false` guardado — ADR-0113 cláusula 3', () => {
    for (const transporte of ['olhos', 'rosto', 'gestos', 'fala']) {
      const a = armazemFalso({ [chave(0, transporte)]: '0', [legada(0)]: '0' });
      const p = jogador();
      sincronizarAlternancia(p, a, 0, transporte, false);
      expect(p.toggleMove, `${transporte} ficou sem a alternância de que depende`).toBe(true);
    }
  });

  it('[Muitos] jogadores diferentes não partilham a chave', () => {
    const a = armazemFalso({ [chave(0, 'teclado')]: '1', [chave(1, 'teclado')]: '0' });
    const p0 = jogador(); const p1 = jogador();
    sincronizarAlternancia(p0, a, 0, 'teclado', false);
    sincronizarAlternancia(p1, a, 1, 'teclado', false);
    expect([p0.toggleMove, p1.toggleMove]).toEqual([true, false]);
  });
});

describe('a regra que acompanha o desligar', () => {
  it('🔴 desligar PARA quem anda por travamento — senão a personagem anda sozinha, sem erro nenhum', () => {
    const p = { toggleMove: true, walkDir: -1 };
    expect(aplicarAlternancia(p, false)).toBe(true);
    expect(p.walkDir, 'a criança largou tudo e a personagem continuou a andar').toBe(0);
  });

  it('⚠️ LIGAR não mexe na direcção — zerá-la a cada aresta seria o defeito ao contrário, e mais frequente', () => {
    const p = { toggleMove: false, walkDir: 1 };
    aplicarAlternancia(p, true);
    expect(p.walkDir, 'ligar tirou a direcção a quem estava a andar').toBe(1);
  });

  it('[Um] a segunda chamada com o mesmo valor não muda nada, e diz que não mudou', () => {
    const p = { toggleMove: true, walkDir: 2 };
    expect(aplicarAlternancia(p, true), 'idempotência: quem anuncia por aresta repetiria a frase').toBe(false);
    expect(p.walkDir).toBe(2);
  });
});

// ============================================================================================
// O QUE FAZ DA CACHE UMA CACHE: UM ESCRITOR SÓ
// ============================================================================================
//
// 🎯 `p.toggleMove` é uma CACHE DERIVADA desde a issue #127 — a engine reescreve-o na aresta, a partir da
// chave do transporte em uso, e o laço de física do cartucho continua a lê-lo. Isso só é verdade enquanto
// houver UM escritor. Um segundo, em qualquer módulo, faz o campo divergir da fonte de que ele diz derivar —
// e a divergência não erra em voz alta: a criança troca de aparelho, o valor não a acompanha, e nada o diz.
//
// ⚠️ TECTO E NÃO PISO. Este número não pode SUBIR. Ele pode descer (se um dia o campo sair), e por isso a
// asserção é sobre o conjunto e não sobre a contagem: um nome novo tem de aparecer na mensagem de reprovação
// para quem o leia saber onde foi.
//
// 📌 E ele fala só da ENGINE. O `game-platformer` escreve `pl.toggleMove` no laço dele, e isso é legítimo e
// não é medível daqui — a lição do ADR-0121 é que a CI deste repositório não pode depender do estado de
// outro. O que se afirma é o que esta árvore controla.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'app', 'js');

/** ⚠️ NÃO come URLs: `(^|[^:])//` deixa o `https://` em paz. Um tira-comentários ingénuo já enganou este
 *  repositório duas vezes, e das duas o resultado foi uma varredura vazia lida como ausência. */
const semComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n\r]*/g, '$1');

function ficheiros(dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { out.push(...ficheiros(p)); continue; }
    if (n.endsWith('.ts')) out.push(p);
  }
  return out;
}

const escritores = () => ficheiros(RAIZ)
  .filter((f) => /\.toggleMove\s*=[^=]/.test(semComentarios(readFileSync(f, 'utf8'))))
  .map((f) => f.replace(RAIZ, '').replace(/\\/g, '/').replace(/^\//, ''))
  .sort();

describe('quem escreve a alternância no jogador', () => {
  it('🎯 [Interface] a engine tem UM escritor, e é o dono da regra', () => {
    expect(escritores(), 'escritor novo de `toggleMove`: a cache deixou de derivar da chave do transporte')
      .toEqual(['input/latch-sync.ts']);
  });

  it('📌 [Vácuo] a varredura ACHA o escritor que existe — senão ela aprovaria uma árvore vazia', () => {
    // Sem este caso, matar a regex deixa o [Interface] a comparar `[]` com `[]` e o gate fica cego para
    // sempre. É a metade da SAÍDA, que é o que separa inventário de monumento.
    expect(escritores().length, 'a varredura não acha nada — está cega, e não é a árvore que está limpa')
      .toBeGreaterThan(0);
  });
});

// ================================ MUTAÇÕES CONFERIDAS ================================
// 1. `sincronizarAlternancia` a gravar o valor resolvido (`armazem.set(...)`) → 🎯 a [Sequência] reprova pela
//    contagem de escritas, e SÓ por ela: todos os casos de valor continuariam verdes. É a mutação que separa
//    «a alternância segue o controle» de «a alternância segue o último controle e apaga os outros».
// 2. ignorar o argumento `transporte` (fixar `'teclado'`) → a [Sequência] reprova na segunda asserção.
// 3. tirar o `if (!ligada) p.walkDir = 0` → o caso do desligar reprova, com a frase do defeito escrita.
// 4. `p.walkDir = 0` incondicional → o caso do LIGAR reprova. As duas mutações juntas são a razão de a linha
//    ser condicional, e nenhuma delas sozinha o mostrava.
// 5. `lerTriEstado` a colapsar «nunca escrito» em `false` (o `getBool` que o `latch-store` recusa) → o caso do
//    LEGADO reprova: a criança que já jogava perde o ajuste no primeiro arranque depois da actualização.
