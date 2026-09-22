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
  keys, keySource, markKey, markKeyWithoutSource, releaseKey, releaseAllKeys, sourceOf, held,
} from '../app/js/input/state.js';
import { stampSource, sourceOfEvent, SOURCE_KEY } from '../app/js/input/origem-sintetica.js';

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
};
// ✅ `input/touch-bindings.ts` saiu em 2026-09-08 (carimba `toque`), e `input/keydown.ts` saiu no mesmo dia.
//
// 🎯 A LISTA CHEGOU AO PISO, e é aqui que este crivo muda de significado: enquanto tinha entradas, ele
// reportava o estado do estrangulamento; com só o par lá dentro, ele passa a AFIRMAR A AUSÊNCIA INTEIRA —
// nenhum módulo desta engine escreve no conjunto de teclas sem dizer quem carregou. É o gate que o
// `confirmation` do ADR-0109 devia, e a razão de ele valer a pena está no que impede: a erasão a voltar por
// um escritor novo que ninguém reparou que entrou.
//
// ⚠️ O `keydown` saiu resolvendo o ponto difícil que esta lista carregava escrito na própria entrada dele — a
// webcam despachava `KeyboardEvent` sintético e seria carimbada `teclado`. A saída foi `input/origem-sintetica`:
// o carimbo viaja NO EVENTO, e `isTrusted` responde por quem não carimbou. Ver os casos lá em baixo.

describe('ADR-0109 · a origem da tecla viaja com ela', () => {
  beforeEach(() => { releaseAllKeys(); });

  it('[Right] marcar escreve NOS DOIS, e o `held` continua a ver a tecla', () => {
    markKey('KeyA', 'toque');
    expect(keys.has('KeyA')).toBe(true);
    expect(sourceOf('KeyA')).toBe('toque');
    expect(held({ ctrl: { jump: ['KeyA'] }, pad: -1 }, 'jump')).toBe(true);
  });

  it('⚠️ [Right] soltar limpa NOS DOIS — um mapa que sobrevive à tecla descreve quem já ninguém segura', () => {
    markKey('KeyA', 'toque');
    releaseKey('KeyA');
    expect(keys.has('KeyA')).toBe(false);
    expect(sourceOf('KeyA')).toBeUndefined();
    expect(keySource.size).toBe(0);
  });

  it('⚠️ [Zero] `soltarTodas` limpa os dois — é a rede do `blur`, e meia rede não é rede', () => {
    markKey('KeyA', 'toque');
    markKey('KeyB', 'teclado');
    releaseAllKeys();
    expect(keys.size).toBe(0);
    expect(keySource.size).toBe(0);
  });

  it('⚠️ [Zero] uma tecla de origem DESCONHECIDA responde `undefined`, e não um padrão', () => {
    // ⚠️ ESTE É O CASO QUE IMPEDE A ERASÃO DE VOLTAR POR OUTRA PORTA. Um padrão `teclado` faria uma tecla do
    // TOQUE — entrada por um escritor ainda não migrado — ser lida como teclado: a alternância desligava-se
    // sozinha e nada o diria. Não saber é uma resposta; fingir que se sabe não é.
    keys.add('KeyZ'); // o caminho antigo, que ainda existe enquanto os escritores migram
    expect(keys.has('KeyZ')).toBe(true);
    expect(sourceOf('KeyZ')).toBeUndefined();
  });

  it('[Boundary] marcar duas vezes com origens diferentes fica com a ÚLTIMA', () => {
    // A tecla é a mesma, o aparelho mudou — e o que interessa é quem a segura AGORA.
    markKey('KeyA', 'teclado');
    markKey('KeyA', 'toque');
    expect(sourceOf('KeyA')).toBe('toque');
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

  it('⚠️ [Interface] e o crivo continua VIVO: ele acha o PAR, que escreve cru por definição', () => {
    // Sem isto, uma regex morta deixaria os dois casos acima verdes por não terem nada que examinar.
    //
    // ⚠️ ANCORADO NUM NOME E JÁ NÃO NUMA CONTAGEM, e a troca foi obrigada pelo sucesso da migração: enquanto
    // havia escritores por migrar, «achou mais do que um» provava vida. Com a lista no piso a contagem é 1, e
    // `>= 1` seria uma afirmação que qualquer ficheiro satisfaria. O `input/state` é o único que escreve cru
    // por DESENHO — é ele o par —, então é ele a âncora que não pode desaparecer sem alguém reparar.
    const crus = new Set(ficheirosTs()
      .filter((p) => escritasCruasDe(p) > 0)
      .map((p) => relative(RAIZ, p).split('\\').join('/')));
    expect([...crus], 'a varredura não achou o par — a regex ou o caminho morreram').toContain('input/state.ts');
  });

  it('⚠️ [Zero] `marcarTeclaSemOrigem` APAGA a origem anterior, em vez de a deixar herdar', () => {
    // O defeito que esta linha impede é caro e silencioso: a criança joga por olhar, larga a tecla, e um
    // despacho sintético de fora repete o mesmo código. Sem o `delete`, a alternância continuaria a responder
    // «olhos» a uma aresta que já não é dela. Um mapa que guarda a resposta certa de ontem é pior que um vazio.
    markKey('KeyA', 'olhos');
    markKeyWithoutSource('KeyA');
    expect(keys.has('KeyA')).toBe(true);   // a tecla FUNCIONA: não saber quem a produziu não a invalida
    expect(sourceOf('KeyA')).toBeUndefined();
  });
});

// ========================= O CARIMBO NO EVENTO (input/origem-sintetica) =========================
// ⚠️ ISTO É O PONTO DIFÍCIL QUE A LISTA ACIMA CARREGOU DESDE O PRIMEIRO DIA. A webcam despacha `KeyboardEvent`
// sintético, entra pelo `keydown` e seria carimbada `teclado` — e a regra 3 do ADR-0109 diz que apertar uma
// tecla devolve o teclado SEM alternância, logo o olhar da criança desligaria sozinho a alternância de que ela
// depende, no meio da partida e sem nada na tela a dizê-lo.
describe('ADR-0109 · quem despachou este evento', () => {
  const ev = (over = {}) => ({ code: 'KeyA', ...over });

  it('[Right] um carimbo válido responde o transporte declarado', () => {
    expect(sourceOfEvent(stampSource(ev(), 'olhos'))).toBe('olhos');
  });

  it('[Right] sem carimbo, um evento DE CONFIANÇA é o teclado — a única inferência do módulo', () => {
    // `isTrusted` é a propriedade que um script não forja: significa que o navegador viu a pessoa carregar.
    expect(sourceOfEvent(ev({ isTrusted: true }))).toBe('teclado');
  });

  it('⚠️ [Zero] sem carimbo e SEM confiança responde `undefined`, e não `teclado`', () => {
    // ⚠️ É AQUI QUE A ERASÃO TENTARIA VOLTAR. Um sintético que ninguém assinou é código de fora que não
    // declarou; responder `'teclado'` seria pior do que a erasão original, porque teria forma de resposta.
    expect(sourceOfEvent(ev({ isTrusted: false }))).toBeUndefined();
    expect(sourceOfEvent(ev())).toBeUndefined(); // e a AUSÊNCIA de `isTrusted` não é um `true` por omissão
  });

  it('⚠️ [Boundary] um carimbo INVÁLIDO não vira transporte fantasma', () => {
    // O valor vem de um expando num objecto que este código não construiu. Sem `isTransportName`, um `'olho'`
    // mal escrito entrava no `keySource` e a alternância passava a decidir sobre um aparelho que não existe.
    const mau = ev({ isTrusted: true });
    mau[SOURCE_KEY] = 'olho';
    expect(sourceOfEvent(mau)).toBe('teclado'); // cai na regra seguinte, em vez de aceitar o lixo
    const naoString = ev();
    naoString[SOURCE_KEY] = { emUso: 'olhos' };
    expect(sourceOfEvent(naoString)).toBeUndefined();
  });

  it('⚠️ [Boundary] o carimbo GANHA de `isTrusted` — declaração vence inferência', () => {
    // A ordem das duas linhas é a regra. Um evento REAL que alguém reatribuiu (um pedal, um interruptor de
    // sopro que emite teclas de verdade) tem de ficar com o que quem carimbou se deu ao trabalho de declarar.
    expect(sourceOfEvent(stampSource(ev({ isTrusted: true }), 'gestos'))).toBe('gestos');
  });

  it('⚠️ [Interface] NADA nesta engine despacha tecla sintética sem carimbar', () => {
    // O crivo que fecha a porta do lado do ESCRITOR — o de cima fecha-a do lado do leitor, e uma porta só
    // fechada de um lado não está fechada. Inventário sobre a árvore real, não sobre um fixture.
    const semCarimbo = [];
    for (const p of ficheirosTs()) {
      for (const ln of readFileSync(p, 'utf8').split(/\r?\n/)) {
        if (/^\s*(\/\/|\*|\/\*)/.test(ln)) continue;
        if (/new KeyboardEvent\s*\(/.test(ln) && !/stampSource\s*\(/.test(ln)) {
          semCarimbo.push(relative(RAIZ, p).split('\\').join('/'));
        }
      }
    }
    expect(
      semCarimbo,
      'despacho de tecla sintética sem declarar o transporte. Envolva em `carimbarOrigem(…, transporte)` de '
      + '`input/origem-sintetica` — sem isso o evento chega ao `keydown` indistinguível de uma tecla premida.',
    ).toEqual([]);
  });

  it('⚠️ [Interface] e ESTE crivo também está vivo: a raiz ainda despacha a tecla de menu, e carimbada', () => {
    // Vácuo ao contrário do outro: aqui o perigo é a regex morrer e o caso acima passar por não achar nada. The webcam that used to
    // anchor this left with WebGazer (ADR-0214); the one synthetic key left is the menu key the pad and the controller hand to menus.
    const fonte = readFileSync(join(RAIZ, 'boot/create-game.ts'), 'utf8');
    expect(fonte, 'a raiz deixou de despachar a tecla de menu, ou o carimbo saiu').toMatch(/stampSource\([^\n]*KeyboardEvent/);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · `markKey` a escrever so em `keys` (sem o mapa) -> reprova "marcar escreve NOS DOIS". E a divergencia
//     silenciosa: o jogo anda na mesma e so a alternancia fica errada.
//   · `releaseKey` a nao apagar do mapa -> reprova "soltar limpa NOS DOIS". O mapa passaria a descrever
//     teclas que ja ninguem segura, e a origem lida seria a de um toque que acabou.
//   · `releaseAllKeys` a nao limpar o mapa -> reprova o caso do `blur`. Meia rede de ciclo de vida nao e rede.
//   · ⚠️ `sourceOf` a devolver `'teclado'` em vez de `undefined` -> reprova o caso da origem DESCONHECIDA.
//     E a mutacao mais perigosa das seis: e a leitura "razoavel" que faz a erasao voltar por outra porta.
//   · matando a regex `ESCREVE_CRU` -> reprovam DOIS, e o que interessa e o do VACUO: sem ele, o inventario
//     passaria por nao ter nada que examinar.
//   · tirando `input/keydown.ts` do `POR_MIGRAR` -> reprova "escritor CRU novo". E a deriva realista: a lista
//     deixa de cobrir quem escreve, e o crivo passa a olhar para menos do que existe.
