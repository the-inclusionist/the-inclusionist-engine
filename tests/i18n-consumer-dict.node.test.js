// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CONSUMER'S DICTIONARY — the quiz's finding 2, measured from outside the repository.
//
// ========================= WHY A GAME NEEDS ITS OWN DOOR =========================
// Inside this repository a consumer's keys could fit in `app/js/i18n/pt.ts`, at the cost of a fat dictionary. From
// OUTSIDE that is a wall: the engine's locales are loaded by the engine module itself, and a game installed as
// `@the-inclusionist/engine` has no way to put a file there. Without its root translator's `registerDict` (fed by
// `CreateGameOptions.dictionaries`) the game would have NO path to its own keys — and pillar 3 says every string is born localisable, with
// no exception for consumers.
//
// The gate was born RED with the mutation confirmed: without `registerDict`, the consumer's key comes back as the key
// itself. Green that could never have been red proves nothing.
//
// ========================= THE RESOLUTION CHAIN THIS TEST PINS =========================
// The engine alone has `locale → pt → the key itself`. With the consumer there are more steps, and the order is not
// arbitrary — it mirrors the engine's, with the consumer placed before each step:
//
//     1. the CONSUMER's dictionary in the current language
//     2. the ENGINE's dictionary in the current language
//     3. the CONSUMER's dictionary in pt          (the consumer's "pt" is ITS base)
//     4. the ENGINE's dictionary in pt            (the engine's base)
//     5. the key itself
//
// Step 3 is what keeps a game that only wrote pt readable when the child switches to English: they read Portuguese,
// just as they do when a key is missing in the engine. Degrading beats going silent.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';

/**
 * A CLEAN translator — the door a game's dictionary goes through since `core/i18n` holds no state (ADR-0232 D3): it is the
 * root's, built here as the root builds it, with a port that keeps nothing (ADR-0178). A test that inherits another's state lies.
 */
async function carregarI18n() {
  return createTranslator({ get: () => null, set: () => undefined, KEYS: { lang: 'incl_lang' } });
}

describe('core/i18n aceita o dicionário de um CONSUMIDOR (achado 2, de fora do repositório)', () => {
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
    expect(daEngine).not.toBe('menu.restoreDefaults'); // the key exists in the engine, or the test measures nothing
    i18n.registerDict('pt', { 'menu.restoreDefaults': 'Voltar ao começo' });
    expect(i18n.t('menu.restoreDefaults')).toBe('Voltar ao começo');
  });

  it('[Boundary] registrar um idioma AINDA NÃO CARREGADO funciona: vale quando se troca para ele', async () => {
    const i18n = await carregarI18n();
    i18n.registerDict('en', { 'jogo.2048.titulo': '2048 · Power of Two' });
    expect(i18n.locale()).toBe('pt');
    await i18n.setLocale('en');
    expect(i18n.t('jogo.2048.titulo')).toBe('2048 · Power of Two');
  });

  it('[Cross-check] a cadeia degrada para o pt DO CONSUMIDOR quando ele não escreveu o idioma corrente', async () => {
    const i18n = await carregarI18n();
    i18n.registerDict('pt', { 'jogo.2048.soEmPt': 'só em português' });
    await i18n.setLocale('es');
    // The same behaviour the engine has for its OWN keys: falls back to pt instead of going silent.
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
    // The pt dictionary is an IMPORTED object. If `registerDict` mutated it, the override would survive into a second
    // translator — and a second game on the same page would inherit the first one's strings.
    const segundo = await carregarI18n();
    expect(segundo.t('menu.restoreDefaults')).not.toBe('Voltar ao começo');
  });

  it('[Simple] a chave do consumidor NÃO vaza para um idioma que ele não registrou como se fosse da engine', async () => {
    const i18n = await carregarI18n();
    i18n.registerDict('en', { 'jogo.2048.soEmEn': 'only in English' });
    // In pt, with no pt registration and no engine key, the contract is the usual one: the key itself.
    expect(i18n.t('jogo.2048.soEmEn')).toBe('jogo.2048.soEmEn');
  });
});

// -----------------------------------------------------------------------------------------------------------
describe('A FRONTEIRA DAS STRINGS DE UM JOGO — marcacao nao entra (issue #106)', () => {
  // ⚠️ WHY THIS GATE EXISTS: it closes a hole that only appeared when the engine became a PACKAGE.
  //
  // `tests/i18n-without-markup.node.test.js` sweeps THIS tree's dictionaries and proves no entry has a tag. It does not
  // reach a game's dictionary — the strings a GAME registers at run time, from another repository (ADR-0083). A test of this tree
  // does not see them, and has no way to.
  //
  // ⚠️ AND THEY WIN OVER THE ENGINE'S DICTIONARY: the resolver looks at the game's FIRST. A game can override ANY key —
  // including the ones the engine pastes into markup — so «i18n» would stop meaning «texto que alguem desta arvore
  // reviu» with nothing recording the change.
  //
  // The check goes at the BOUNDARY because the boundary is ONE. One check per sink would be many places to forget, and
  // forgetting leaves no trace.
  let erro;
  beforeEach(() => { erro = vi.spyOn(console, 'error').mockImplementation(() => {}); erro.mockClear(); });

  it('[Right] ⚠️ uma chave com tag e RECUSADA, e a engine continua a responder a sua', async () => {
    const i18n = await carregarI18n();
    const recusadas = i18n.registerDict('pt', { 'menu.alf': '<img src=x onerror=alert(1)>' });
    expect(recusadas).toEqual(['menu.alf']);
    // The engine's key survives: the game did not override it, and the interface is left with no hole.
    expect(i18n.t('menu.alf')).not.toContain('<img');
  });

  it('[Right] e a recusa e ALTA — descartar em silencio lê-se como defeito da engine', async () => {
    // ⚠️ THIS CASE REGISTERS ITS OWN KEY. Asserting the spy right after the previous case would depend on ORDER: with the
    // `beforeEach`'s `mockClear`, it would assert on an empty spy. A case that only passes after another measures
    // nothing — it measures its neighbour.
    const i18n = await carregarI18n();
    i18n.registerDict('pt', { 'jogo.gritou': '<span>tag</span>' });
    expect(erro).toHaveBeenCalled();
    expect(String(erro.mock.calls[0])).toContain('jogo.gritou');
  });

  it('[Right] as chaves BOAS do mesmo registo entram — a recusa e por entrada, nao por lote', async () => {
    // Refusing the whole batch over one key would punish the game for a typo in another.
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
    // `a < b` has `<` and is not a tag: what matches is `<` followed by a LETTER or a slash. A check that failed basic
    // maths would be removed by whoever writes the game, and then it protects nothing.
    const i18n = await carregarI18n();
    const bons = { 'jogo.m1': 'a < b', 'jogo.m2': '5<10', 'jogo.m3': 'ganhou 3 de 4', 'jogo.m4': 'R$ 5 & 10' };
    expect(i18n.registerDict('pt', bons)).toEqual([]);
    expect(i18n.t('jogo.m1')).toBe('a < b');
    expect(i18n.t('jogo.m2')).toBe('5<10');
  });
});
