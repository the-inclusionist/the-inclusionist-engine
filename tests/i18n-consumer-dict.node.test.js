// SPDX-License-Identifier: AGPL-3.0-or-later
// O DICIONÁRIO DO CONSUMIDOR — o achado 2 do quiz, medido de fora do repositório e virado bloqueio.
//
// ========================= O QUE MUDOU DE PESO MORTO PARA IMPOSSIBILIDADE =========================
// O `consumer-quiz` anotou o achado 2 assim: *"os DICIONÁRIOS são do jogo de plataforma… Um segundo jogo
// herda 253 chaves das quais usa um punhado. Não é aresta de importação — é peso morto no pacote"*. Estava
// certo para um consumidor que mora DENTRO deste repositório: as chaves dele caberiam em `app/js/i18n/pt.ts`,
// e o custo seria só um dicionário gordo.
//
// De FORA, o mesmo achado deixa de ser peso e vira parede. Os locales entram por
//
//     const loaders = import.meta.glob('../i18n/*.ts')
//
// e esse glob é resolvido NO BUILD DA ENGINE, contra a pasta da engine. Um jogo instalado como
// `@the-inclusionist/engine` não tem como pôr um arquivo lá dentro, e `DICTS` é privado do módulo. O jogo
// fica sem NENHUM caminho para as próprias chaves — e o pilar 3 diz que toda string nasce localizável, sem
// exceção para quem é consumidor.
//
// ========================= POR QUE ISTO É TESTE E NÃO CONSERTO DIRETO =========================
// O gate nasce VERMELHO com a mutação confirmada, que aqui é a mais simples que existe: `registerDict` não
// existe ainda, então a chave do consumidor volta como a própria chave. Verde que nunca pôde ficar vermelho
// não prova nada, e neste repositório já aconteceu de uma regex morrer em silêncio com a checagem verde.
//
// ========================= A CADEIA DE RESOLUÇÃO QUE ESTE TESTE PRENDE =========================
// A engine já tinha DUAS camadas: `locale → pt → a própria chave`. Com o consumidor viram quatro, e a ordem
// não é arbitrária — ela espelha a que já existia, com o consumidor colado a cada degrau:
//
//     1. o dicionário do CONSUMIDOR no idioma corrente
//     2. o dicionário da ENGINE no idioma corrente
//     3. o dicionário do CONSUMIDOR em pt          (o "pt" do consumidor é a base DELE)
//     4. o dicionário da ENGINE em pt              (a base que já era)
//     5. a própria chave
//
// O degrau 3 é o que faz um jogo que só escreveu pt seguir legível quando a criança troca para inglês: ela lê
// português, exatamente como já lê hoje quando falta chave na engine. Degradar é melhor que calar.
import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Um DOM de mentira do tamanho exato do que `setLocale` toca: nada além disso vira dependência. */
function dublarDocumento() {
  vi.stubGlobal('document', { documentElement: { lang: '' }, querySelectorAll: () => [] });
  vi.stubGlobal('window', { dispatchEvent: () => true });
}

/** Uma instância LIMPA do módulo. `setLocale` guarda estado, e teste que herda estado de outro mente. */
async function carregarI18n() {
  vi.resetModules();
  dublarDocumento();
  const m = await import('../app/js/core/i18n.js');
  // a fresh module has no port: the composition root would have loaded one (ADR-0178), and so does this double
  m.loadLocale({ get: () => null, set: () => undefined, KEYS: { lang: 'incl_lang' } });
  return m;
}

describe('core/i18n aceita o dicionário de um CONSUMIDOR (achado 2, de fora do repositório)', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('[Zero] chave que ninguém registrou continua voltando como ela mesma', async () => {
    const i18n = await carregarI18n();
    expect(i18n.t('jogo.2048.naoRegistrada')).toBe('jogo.2048.naoRegistrada');
  });

  it('[One] a chave do consumidor no idioma corrente é traduzida', async () => {
    const i18n = await carregarI18n();
    i18n.registerDict('pt', { 'jogo.2048.titulo': '2048 · Potência de 2' });
    expect(i18n.t('jogo.2048.titulo')).toBe('2048 · Potência de 2');
  });

  it('[Many] dois registros no mesmo idioma se SOMAM, e o segundo não apaga o primeiro', async () => {
    const i18n = await carregarI18n();
    i18n.registerDict('pt', { 'jogo.2048.a': 'A' });
    i18n.registerDict('pt', { 'jogo.2048.b': 'B' });
    expect([i18n.t('jogo.2048.a'), i18n.t('jogo.2048.b')]).toEqual(['A', 'B']);
  });

  it('[Interface] a interpolação de {param} vale para a string do consumidor como para a da engine', async () => {
    const i18n = await carregarI18n();
    i18n.registerDict('pt', { 'jogo.2048.fundiu': 'Juntou {a} e {a} — virou {b}' });
    expect(i18n.t('jogo.2048.fundiu', { a: 8, b: 16 })).toBe('Juntou 8 e 8 — virou 16');
  });

  it('[Right] a chave do consumidor VENCE a da engine com o mesmo nome — e isso é deliberado', async () => {
    const i18n = await carregarI18n();
    const daEngine = i18n.t('menu.restoreDefaults');
    expect(daEngine).not.toBe('menu.restoreDefaults'); // a chave existe na engine, senão o teste não mede nada
    i18n.registerDict('pt', { 'menu.restoreDefaults': 'Voltar ao começo' });
    expect(i18n.t('menu.restoreDefaults')).toBe('Voltar ao começo');
  });

  it('[Boundary] registrar um idioma AINDA NÃO CARREGADO funciona: vale quando se troca para ele', async () => {
    const i18n = await carregarI18n();
    i18n.registerDict('en', { 'jogo.2048.titulo': '2048 · Power of Two' });
    expect(i18n.getLocale()).toBe('pt');
    await i18n.setLocale('en');
    expect(i18n.t('jogo.2048.titulo')).toBe('2048 · Power of Two');
  });

  it('[Cross-check] a cadeia degrada para o pt DO CONSUMIDOR quando ele não escreveu o idioma corrente', async () => {
    const i18n = await carregarI18n();
    i18n.registerDict('pt', { 'jogo.2048.soEmPt': 'só em português' });
    await i18n.setLocale('es');
    // Mesmo comportamento que a engine já tem para as PRÓPRIAS chaves: cai no pt em vez de calar.
    expect(i18n.t('jogo.2048.soEmPt')).toBe('só em português');
  });

  it('[Boundary] o idioma mais específico vence o pt do consumidor, e não o contrário', async () => {
    const i18n = await carregarI18n();
    i18n.registerDict('pt', { 'jogo.2048.titulo': 'Potência de 2' });
    i18n.registerDict('es', { 'jogo.2048.titulo': 'Potencia de 2' });
    await i18n.setLocale('es');
    expect(i18n.t('jogo.2048.titulo')).toBe('Potencia de 2');
  });

  it('[Exception] o registro do consumidor NÃO contamina o dicionário da engine em outra instância', async () => {
    const primeiro = await carregarI18n();
    primeiro.registerDict('pt', { 'menu.restoreDefaults': 'Voltar ao começo' });
    expect(primeiro.t('menu.restoreDefaults')).toBe('Voltar ao começo');
    // O dicionário de pt é um objeto IMPORTADO. Se `registerDict` o mutasse, a sobreposição sobreviveria
    // a um módulo novo — e um segundo jogo na mesma página herdaria as strings do primeiro.
    const segundo = await carregarI18n();
    expect(segundo.t('menu.restoreDefaults')).not.toBe('Voltar ao começo');
  });

  it('[Simple] a chave do consumidor NÃO vaza para um idioma que ele não registrou como se fosse da engine', async () => {
    const i18n = await carregarI18n();
    i18n.registerDict('en', { 'jogo.2048.soEmEn': 'only in English' });
    // Em pt, sem registro em pt e sem chave na engine, o contrato é o de sempre: a própria chave.
    expect(i18n.t('jogo.2048.soEmEn')).toBe('jogo.2048.soEmEn');
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('A FRONTEIRA DAS STRINGS DE UM JOGO — marcacao nao entra (issue #106)', () => {
  // ⚠️ POR QUE ESTE GATE EXISTE, e ele fecha um buraco que so apareceu quando a engine virou PACOTE.
  //
  // `tests/i18n-sem-markup.node.test.js` varre os dicionarios DESTA arvore e prova que nenhuma entrada tem
  // tag. Ele nao alcanca o `EXTRA` — as strings que um JOGO regista em tempo de execucao, de outro
  // repositorio (ADR-0083). Um teste desta arvore nao as ve, e nao tem como ver.
  //
  // ⚠️ E ELAS GANHAM DO DICIONARIO DA ENGINE: `resolver` consulta o `EXTRA` PRIMEIRO. Um jogo podia sobrepor
  // QUALQUER chave — inclusive as ~15 que a engine cola em markup —, e «i18n» tinha deixado de significar
  // «texto que alguem desta arvore reviu» sem que nada registasse a mudanca.
  //
  // A verificacao vai na FRONTEIRA porque a fronteira e UMA. Quinze sinks seriam quinze lugares para
  // esquecer, e o esquecimento nao deixa rasto.
  let erro;
  beforeEach(() => { erro = vi.spyOn(console, 'error').mockImplementation(() => {}); erro.mockClear(); });

  it('[Right] ⚠️ uma chave com tag e RECUSADA, e a engine continua a responder a sua', async () => {
    const i18n = await carregarI18n();
    const recusadas = i18n.registerDict('pt', { 'menu.alf': '<img src=x onerror=alert(1)>' });
    expect(recusadas).toEqual(['menu.alf']);
    // A chave da engine sobrevive: o jogo nao a sobrepos, e a interface nao fica com um buraco.
    expect(i18n.t('menu.alf')).not.toContain('<img');
  });

  it('[Right] e a recusa e ALTA — descartar em silencio lê-se como defeito da engine', async () => {
    // ⚠️ ESTE CASO REGISTA A SUA PROPRIA CHAVE. A primeira versao afirmava o espiao logo a seguir ao caso
    // anterior, e passou a depender da ORDEM: com o `mockClear` do `beforeEach`, ele afirmava sobre um
    // espiao vazio. Um caso que so passa depois de outro nao afere nada — afere o vizinho.
    const i18n = await carregarI18n();
    i18n.registerDict('pt', { 'jogo.gritou': '<span>tag</span>' });
    expect(erro).toHaveBeenCalled();
    expect(String(erro.mock.calls[0])).toContain('jogo.gritou');
  });

  it('[Right] as chaves BOAS do mesmo registo entram — a recusa e por entrada, nao por lote', async () => {
    // Recusar o lote inteiro por causa de uma chave puniria o jogo por um erro de digitacao numa outra.
    const i18n = await carregarI18n();
    const recusadas = i18n.registerDict('pt', {
      'jogo.ok': 'palavra boa', 'jogo.mau': '<b>tag</b>', 'jogo.ok2': 'outra boa',
    });
    expect(recusadas).toEqual(['jogo.mau']);
    expect(i18n.t('jogo.ok')).toBe('palavra boa');
    expect(i18n.t('jogo.ok2')).toBe('outra boa');
    expect(i18n.t('jogo.mau')).toBe('jogo.mau'); // recusada: volta a propria chave
  });

  it('[Boundary] o crivo recusa a ENTIDADE tambem — `&lt;script&gt;` volta a ser tag ao ser colado', async () => {
    const i18n = await carregarI18n();
    expect(i18n.registerDict('pt', { 'jogo.ent': '&lt;script&gt;alert(1)&lt;/script&gt;' })).toEqual(['jogo.ent']);
  });

  it('[Zero] ⚠️ e NAO recusa texto legitimo — um crivo que recusa demais e desligado no primeiro dia', async () => {
    // `a < b` tem `<` e nao e tag: o que casa e `<` seguido de LETRA ou de barra. Um crivo que reprovasse
    // matematica basica seria removido por quem escreve o jogo, e ai nao protege nada.
    const i18n = await carregarI18n();
    const bons = { 'jogo.m1': 'a < b', 'jogo.m2': '5<10', 'jogo.m3': 'ganhou 3 de 4', 'jogo.m4': 'R$ 5 & 10' };
    expect(i18n.registerDict('pt', bons)).toEqual([]);
    expect(i18n.t('jogo.m1')).toBe('a < b');
    expect(i18n.t('jogo.m2')).toBe('5<10');
  });
});
