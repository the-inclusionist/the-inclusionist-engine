// SPDX-License-Identifier: AGPL-3.0-or-later
// NADA CHEGA DE FORA EM TEMPO DE EXECUÇÃO — o pilar 8 (offline/PWA), como inventário.
//
// ========================= POR QUE ISTO IMPORTA NUMA ESCOLA =========================
// O pilar 8 do ADR-0010 diz que este jogo funciona OFFLINE. Numa escola pública sem rede — que é o alvo, não a
// excepção — um módulo que busque código a um servidor de terceiros não degrada: ele simplesmente não faz
// nada. A criança liga o botão e não acontece coisa nenhuma, sem erro e sem explicação.
//
// 📏 MEDIDO EM 2026-09-08: a engine inteira tem UMA busca de runtime externo, e ela é justamente no transporte
// assistido — o `ui/webcam` carrega o WebGazer de `webgazer.cs.brown.edu`. Ou seja: o único subsistema que
// exige internet é o que serve a criança que menos pode ir buscar outra coisa.
//
// ⚠️ E A DISTINÇÃO QUE ESTE CRIVO TEM DE FAZER É A RAZÃO DE ELE SER INVENTÁRIO E NÃO PROIBIÇÃO: nem toda URL
// em código é uma busca. `http://www.w3.org/2000/svg` é um NAMESPACE XML — um identificador que o
// `createElementNS` exige, e que nunca sai da máquina. Um gate que as tratasse igual acusaria dois falsos, e
// um gate que acusa falsos é desligado antes de apanhar o verdadeiro.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));
const URL_QUALQUER = /https?:\/\/[^\s'"`)]+/g;

function ficheirosTs(dir = RAIZ) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...ficheirosTs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(p);
  }
  return saida;
}

/**
 * As URLs que vivem em CÓDIGO, por ficheiro.
 *
 * ⚠️ Comentários fora: esta engine explica-se muito, e metade das URLs que ela escreve estão em prosa a citar
 * uma fonte. Contá-las criaria o incentivo de APAGAR A EXPLICAÇÃO para baixar o número — que é a lição que o
 * `action-vocabulary-boundary` já deixou escrita.
 */
function urlsEmCodigo() {
  const fora = [];
  for (const p of ficheirosTs()) {
    const rel = relative(RAIZ, p).split('\\').join('/');
    readFileSync(p, 'utf8').split(/\r?\n/).forEach((ln) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
      for (const u of ln.match(URL_QUALQUER) ?? []) fora.push({ modulo: rel, url: u });
    });
  }
  return fora;
}

/**
 * O QUE PODE APARECER, e o que cada coisa é. ⚠️ As razões não são do mesmo TIPO, e é isso que a lista serve
 * para dizer: duas são identificadores que não viajam, e uma é uma busca a sério.
 */
const DECLARADAS = {
  'http://www.w3.org/2000/svg': 'NAMESPACE XML, não um endereço: o `createElementNS` exige-o para criar nós SVG, e ele nunca sai da máquina. Aparece no `render/cvd-matrices` e no `render/lq-filter`, que montam os filtros de daltonismo',
  'https://webgazer.cs.brown.edu/webgazer.js': '🔴 A ÚNICA BUSCA EXTERNA DA ENGINE, e viola o pilar 8. O `ui/webcam` carrega o WebGazer de um CDN no primeiro uso, e o próprio cabeçalho do ficheiro admite-o: «vendorizar p/ offline é futuro». Numa escola sem rede, a criança que depende do olhar liga o botão e não acontece nada. Travado na #129, que decide de onde vem um runtime pesado — e a resposta serve TRÊS subsistemas, não só este',
};

describe('pilar 8 · nada chega de fora sem estar declarado', () => {
  it('🎯 [Zero] nenhuma URL nova entrou em código sem uma razão escrita', () => {
    const novas = urlsEmCodigo().filter(({ url }) => !(url in DECLARADAS));
    expect(
      novas.map(({ modulo, url }) => `${modulo}  ${url}`),
      'URL nova em código de execução. O pilar 8 diz que este jogo funciona OFFLINE — numa escola sem rede, '
      + 'uma busca externa não degrada, ela simplesmente não acontece. Se for um NAMESPACE (não viaja), '
      + 'declare-o aqui a dizê-lo; se for uma busca, ela precisa de decisão antes de código (ver #129).',
    ).toEqual([]);
  });

  it('[Interface] a lista não tem órfãos — uma URL que saiu do código sai dela', () => {
    // É por aqui que esta lista ENCOLHE: quando a #129 for decidida e o WebGazer sair, a entrada dele tem de
    // sair também, senão o inventário reportaria uma dívida já paga.
    const presentes = new Set(urlsEmCodigo().map((u) => u.url));
    expect(Object.keys(DECLARADAS).filter((u) => !presentes.has(u)), 'entrada de uma URL que já não existe').toEqual([]);
  });

  it('⚠️ [Interface] e a varredura está VIVA: ela lê a árvore e o detector reconhece uma URL', () => {
    expect(ficheirosTs().length, 'a varredura não achou módulo nenhum').toBeGreaterThan(50);
    expect(urlsEmCodigo().length, 'nenhuma URL achada — o detector morreu').toBeGreaterThan(0);
    expect('const s = "https://exemplo.org/x.js";'.match(URL_QUALQUER)).toEqual(['https://exemplo.org/x.js']);
  });

  it('📌 [Right] e a busca externa que existe continua a ser UMA — o número é o assunto', () => {
    // ⚠️ A afirmação forte deste ficheiro não é «há uma lista»: é que a engine tem UMA dependência de rede em
    // tempo de execução, e que ela está no transporte assistido. Duas seriam outra conversa, e o crivo tem de
    // a forçar em vez de a diluir numa lista que cresce.
    const buscas = urlsEmCodigo().filter(({ url }) => !url.startsWith('http://www.w3.org/'));
    expect(buscas.map((b) => b.modulo), 'a engine ganhou uma segunda busca externa').toEqual(['ui/webcam.ts']);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Quatro, tres mortas e uma EQUIVALENTE hoje — e o «hoje» esta medido, nao suposto.
//
//   1. uma SEGUNDA busca externa a aparecer num modulo real (`platform/tts`) -> reprovam DOIS: o dos
//      declarados e o que afirma que a busca externa continua a ser UMA. E o defeito mais provavel deste
//      ficheiro: nao alguem apagar o crivo, alguem acrescentar um CDN a resolver um problema.
//   2. o detector de URLs morto -> reprovam TRES. Um crivo de ausencia que nao acha nada esta verde pela pior
//      razao possivel.
//   4. o WebGazer a passar a ser local (`/vendor/webgazer.js`) -> reprovam DOIS, e ⚠️ ESTA REPROVA POR BOA
//      NOTICIA: e a #129 resolvida. Quando acontecer, a entrada do WebGazer sai desta lista e o caso do
//      «continua a ser UMA» passa a exigir uma lista VAZIA. Fica escrito para ninguem ler o vermelho como
//      regressao.
//
//   3. ⚠️ os comentarios a voltarem a contar -> SOBREVIVE, e e equivalencia por VACUIDADE: medido, ha ZERO
//      URLs em comentario em `app/js` inteiro, entao o filtro nao remove nada hoje. Ele FICA na mesma, e
//      deixa de ser equivalente no primeiro comentario que cite uma fonte — «ver https://…» seria acusado
//      como busca nova. A licao e a mesma que o `action-vocabulary-boundary` ja escreveu: contar a prosa cria
//      o incentivo de APAGAR A EXPLICACAO para baixar o numero.
