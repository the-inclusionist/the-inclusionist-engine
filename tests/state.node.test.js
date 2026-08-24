// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de core/state — o estado compartilhado e o seu barramento de eventos (project node).
//
// POR QUE SÓ AGORA. `core/state` é importado por 37 arquivos de teste e não tinha nenhum PRÓPRIO: todos o
// usavam como cenário (mutar `players`, chamar `setNumPlayersValue`) sem nunca aferir o contrato dele. Isso
// bastava enquanto ele só guardava valores; deixou de bastar quando começou a receber estado que seis
// módulos consultam, com persistência e evento acoplados — `modoCego` é o primeiro (#50).
//
// O QUE SE AFERE AQUI É A DISCIPLINA DO SETTER: gravar, persistir, avisar — e NADA MAIS. O antigo
// `setModoCego` do main.js refazia os extras do nível, refletia um painel de DOM e anunciava ao leitor de
// tela dentro do próprio setter, e por isso nenhum teste conseguia chamá-lo. A separação entre gravar e
// reagir é o que torna este arquivo possível, então é ela que os casos protegem.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { modoCego, setModoCegoValue, on, off } from '../app/js/core/state.js';
import * as store from '../app/js/platform/storage.js';

// `modoCego` é um binding VIVO: reimportar não é preciso, mas ler o valor antigo de uma cópia local seria o
// erro clássico — por isso os casos leem sempre do módulo.
import * as state from '../app/js/core/state.js';

// `platform/storage` é à PROVA DE EXCEÇÃO por desenho: `localStorage` lança em file:// e no modo privado de
// alguns navegadores, e isso derrubava o boot inteiro, então todo acesso é try/catch. No project node não há
// `localStorage` nenhum, de modo que toda gravação cai no catch e toda leitura devolve o padrão — silenciosa e
// corretamente. Por isso o stub vai ABAIXO do storage, na API do navegador, e não no lugar do storage: o que
// se quer aferir é que o setter MANDA persistir, com o módulo de persistência real no caminho.
let desinscrever = [];
let localAntigo;
beforeEach(() => {
  localAntigo = globalThis.localStorage;
  const mapa = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => { mapa.set(k, String(v)); },
    removeItem: (k) => { mapa.delete(k); },
  };
  setModoCegoValue(false); desinscrever = [];
});
afterEach(() => {
  desinscrever.forEach((f) => f()); setModoCegoValue(false);
  if (localAntigo === undefined) delete globalThis.localStorage; else globalThis.localStorage = localAntigo;
});

function escuta(evt) {
  const vistos = [];
  const fn = (v) => vistos.push(v);
  on(evt, fn);
  desinscrever.push(() => off(evt, fn));
  return vistos;
}

describe('core/state — modoCego', () => {
  it('[Right] o setter grava, e a leitura vê o valor novo pelo binding vivo', () => {
    expect(state.modoCego).toBe(false);
    setModoCegoValue(true);
    expect(state.modoCego).toBe(true);
  });

  it('[Right] persiste em incl_modocego, para o modo sobreviver a fechar o jogo', () => {
    setModoCegoValue(true);
    expect(store.getBool('incl_modocego')).toBe(true);
    setModoCegoValue(false);
    expect(store.getBool('incl_modocego')).toBe(false);
  });

  it('[Right] avisa quem assinou, com o valor novo', () => {
    const vistos = escuta('modoCego');
    setModoCegoValue(true);
    expect(vistos).toEqual([true]);
  });

  it('[Zero] gravar o valor QUE JÁ ESTÁ não avisa ninguém', () => {
    // A guarda vem do original e não é otimização: sem ela, cada clique redundante no ícone de pausa
    // repetiria o anúncio "Modo cego ligado" no ouvido de quem depende do leitor de tela.
    const vistos = escuta('modoCego');
    setModoCegoValue(false); // já é false
    expect(vistos).toEqual([]);
    setModoCegoValue(true);
    setModoCegoValue(true);
    expect(vistos).toEqual([true]); // e não [true, true]
  });

  it('[Interface] o setter NÃO reage — não toca DOM, não anuncia, não redesenha', () => {
    // É a propriedade que torna este arquivo possível. Se um dia alguém pendurar um efeito aqui, este caso
    // continua verde (não há como afirmar uma ausência em geral), mas o teste QUEBRA de outra forma: passaria
    // a precisar de `document`, e o project `node` não tem. A ausência de setup é a asserção.
    expect(typeof document).toBe('undefined');
    setModoCegoValue(true);
    expect(state.modoCego).toBe(true);
  });

  it('[Inverse] desinscrever para de receber', () => {
    const vistos = [];
    const fn = (v) => vistos.push(v);
    on('modoCego', fn);
    setModoCegoValue(true);
    off('modoCego', fn);
    setModoCegoValue(false);
    expect(vistos).toEqual([true]);
  });

  it('[Boundary] o import nomeado é uma FOTOGRAFIA; o binding do módulo é que é vivo', () => {
    // Distinção que já mordeu este projeto: `import { modoCego }` dá um binding vivo em ESM, mas copiá-lo
    // para uma variável local (`const m = modoCego`) congela o valor. O caso documenta os dois lados.
    const copia = state.modoCego;
    setModoCegoValue(true);
    expect(copia).toBe(false);        // a cópia local não acompanha
    expect(state.modoCego).toBe(true); // o binding do módulo, sim
    expect(modoCego).toBe(true);       // e o import nomeado também: ESM re-lê a célula
  });
});
