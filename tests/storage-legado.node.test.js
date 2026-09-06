// SPDX-License-Identifier: AGPL-3.0-or-later
// A HERANÇA DE CHAVE LEGADA — `getComLegado` / `getJSONComLegado`, que até hoje não tinham nenhum caso.
//
// Vale dizer o que se perde quando isto quebra, porque não é um valor: é a continuidade. A criança que já
// jogava tem o nível 5, o cenário escolhido e a gravação da demonstração gravados nos NOMES ANTIGOS. Renomear
// a chave sem herança não dá erro nenhum — dá um jogo de fábrica. Ela abre e encontra o nível 2 no lugar do 5,
// sem nada explicando, e não há como ela saber que o ajuste existia.
//
// Por isso a herança é só de LEITURA: a escrita vai para o nome novo e a chave velha fica onde está. É dado da
// criança, não meu para apagar, e a permanência dela é o que torna um retorno possível — se a migração se
// revelar errada, o valor original ainda lá.
//
// ⚠️ O CASO QUE MAIS IMPORTA AQUI É O DO VALOR FALSO. `''`, `'0'` e `false` são VALORES ESCOLHIDOS, não
// ausências: a criança que desligou a bengala escolheu `'0'` tanto quanto quem a ligou escolheu `'1'`. Um
// `if (v)` no lugar de `if (v !== null)` compila, passa em todo caso com valor "normal", e apaga em silêncio
// exatamente as escolhas de desligar. É a mutação que estes casos existem para apanhar.
//
// O stub de `localStorage` vai ABAIXO do storage, na API do navegador, e não no lugar do storage: o que se
// quer aferir é o módulo de persistência REAL no caminho. (No project node não existe `localStorage`, então
// sem o stub toda leitura devolveria o padrão — silenciosa e inutilmente.)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { get, set, setJSON, getComLegado, getJSONComLegado } from '../app/js/platform/storage.js';

const NOVA = 'incl.jogo.nivel';
const LEGADA = 'incl_nivel';

let localAntigo;
beforeEach(() => {
  localAntigo = globalThis.localStorage;
  const mapa = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => { mapa.set(k, String(v)); },
    removeItem: (k) => { mapa.delete(k); },
  };
});
afterEach(() => {
  if (localAntigo === undefined) delete globalThis.localStorage; else globalThis.localStorage = localAntigo;
});

describe('getComLegado — a chave nova ganha, a velha sustenta', () => {
  it('[Right] com a NOVA presente, é ela que responde — mesmo havendo legada', () => {
    set(NOVA, '5');
    set(LEGADA, '2');
    expect(getComLegado(NOVA, LEGADA, 'padrao')).toBe('5');
  });

  it('[Right] sem a nova, HERDA a legada — é assim que o nível 5 sobrevive à renomeação', () => {
    set(LEGADA, '5');
    expect(getComLegado(NOVA, LEGADA, 'padrao')).toBe('5');
  });

  it('[Zero] sem nenhuma das duas, devolve o padrão', () => {
    expect(getComLegado(NOVA, LEGADA, 'padrao')).toBe('padrao');
    expect(getComLegado(NOVA, LEGADA)).toBe(null);
  });

  it('[Boundary] ⚠️ um valor FALSO herdado é um valor: `0` e `` não caem no padrão', () => {
    // Quem desligou a bengala gravou '0'. Tratar isso como ausência devolve o padrão LIGADO, e a criança
    // reencontra ligada a coisa que ela desligou — o pior tipo de defeito de acessibilidade, porque parece
    // que o programa ignorou a escolha dela.
    set(LEGADA, '0');
    expect(getComLegado(NOVA, LEGADA, '1')).toBe('0');
    set(LEGADA, '');
    expect(getComLegado(NOVA, LEGADA, 'padrao')).toBe('');
  });

  it('[Boundary] ⚠️ e um valor falso na NOVA também ganha — é AQUI que `!== null` decide', () => {
    // Este é o caso que discrimina, e ele quase não entrou. Do lado da LEGADA, `if (v)` e `if (v !== null)`
    // dão o mesmo resultado: a nova está ausente das duas maneiras. Só quando a NOVA carrega o valor falso é
    // que a diferença aparece — e aí ela devolve o valor da chave que a criança já tinha ABANDONADO.
    //
    // ⚠️ E a string falsa é uma só: `'0'` é TRUTHY em JavaScript, ao contrário do que a intuição de outras
    // linguagens sugere. Um caso escrito com `'0'` passaria sob a mutação e não provaria nada.
    set(NOVA, '');
    set(LEGADA, 'valor-abandonado');
    expect(getComLegado(NOVA, LEGADA, 'padrao')).toBe('');
  });

  it('[Interface] LER não migra — a legada continua lá e a nova continua ausente', () => {
    // A permanência da chave velha é o que torna um retorno possível. Se a leitura gravasse na nova, a
    // primeira leitura seria irreversível e uma migração errada não teria volta.
    set(LEGADA, '5');
    getComLegado(NOVA, LEGADA, 'padrao');
    expect(get(NOVA, null), 'a leitura gravou na chave nova').toBe(null);
    expect(get(LEGADA, null), 'a leitura apagou a chave legada').toBe('5');
  });
});

describe('getJSONComLegado — a mesma herança, para o outro formato', () => {
  it('[Right] a nova ganha; sem ela, herda a legada', () => {
    setJSON(NOVA, { nivel: 5 });
    setJSON(LEGADA, { nivel: 2 });
    expect(getJSONComLegado(NOVA, LEGADA)).toEqual({ nivel: 5 });

    globalThis.localStorage.removeItem(NOVA);
    expect(getJSONComLegado(NOVA, LEGADA)).toEqual({ nivel: 2 });
  });

  it('[Zero] sem nenhuma das duas, devolve o padrão', () => {
    expect(getJSONComLegado(NOVA, LEGADA, { nivel: 1 })).toEqual({ nivel: 1 });
    expect(getJSONComLegado(NOVA, LEGADA)).toBe(null);
  });

  it('[Boundary] ⚠️ `false` e `0` herdados são valores — a metade JSON tem a mesma armadilha', () => {
    // Se a herança dos dois formatos não for a mesma, metade das chaves migra e a outra metade some, que é o
    // pior dos dois mundos: nem o dado antigo nem um erro que o denuncie.
    setJSON(LEGADA, false);
    expect(getJSONComLegado(NOVA, LEGADA, true)).toBe(false);
    setJSON(LEGADA, 0);
    expect(getJSONComLegado(NOVA, LEGADA, 9)).toBe(0);

    // ⚠️ E o mesmo do lado da NOVA, que é o lado onde `!== null` de facto decide. Em JSON a armadilha é
    // maior do que em texto: `false`, `0`, `''` e `null` são todos falsos, então um `if (v)` aqui devolve o
    // ajuste ANTIGO a quem acabou de desligar a coisa no ajuste novo.
    setJSON(NOVA, false);
    setJSON(LEGADA, true);
    expect(getJSONComLegado(NOVA, LEGADA)).toBe(false);
  });

  it('[Error] JSON corrompido na nova cai para a legada em vez de derrubar o boot', () => {
    // `localStorage` é dado que pode ter sido escrito por uma versão anterior, por outra aba, ou ter sido
    // truncado. Um `JSON.parse` que lança aqui derruba o boot inteiro, porque `core/state` lê no import.
    set(NOVA, '{isto nao e json');
    setJSON(LEGADA, { nivel: 5 });
    expect(getJSONComLegado(NOVA, LEGADA)).toEqual({ nivel: 5 });
  });
});
