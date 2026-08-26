// SPDX-License-Identifier: AGPL-3.0-or-later
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
import { modoCego, setModoCegoValue, setCaneBlockDivValue, setLetterCaseValue, setCaptionsOnValue,
  on, off, defaultReducedMotion } from '../app/js/core/state.js';
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
  desinscrever.forEach((f) => f()); setModoCegoValue(false); setLetterCaseValue('upper'); setCaptionsOnValue(true);
  if (localAntigo === undefined) delete globalThis.localStorage; else globalThis.localStorage = localAntigo;
});

function escuta(evt) {
  const vistos = [];
  const fn = (v) => vistos.push(v);
  on(evt, fn);
  desinscrever.push(() => off(evt, fn));
  return vistos;
}

describe('core/state — modoCego e o espaçamento da bengala', () => {
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

  it('[Regressão] o espaçamento da bengala PERSISTE — antes era lido no boot e nunca gravado', () => {
    // DEFEITO ENCONTRADO PELA MIGRAÇÃO, não por busca. O main.js lia `incl_cane_div` no boot e o setter era
    // `(d) => { caneBlockDiv = d; }`, sem gravar — a chave estava até registrada em `storage.KEYS.caneDiv`,
    // então a intenção existia e a escrita nunca foi escrita. Efeito: a criança cega que escolhia uma batida
    // a cada MEIO bloco (resolução fina para medir distância andada) reencontrava o padrão a cada sessão,
    // sem aviso e sem explicação.
    setCaneBlockDivValue(2);
    expect(state.caneBlockDiv).toBe(2);
    expect(store.getNum('incl_cane_div', 1)).toBe(2);
  });

  it('[Error] valor corrompido no armazenamento não desliga a bengala', () => {
    // O `|| 1` vem do original e não é defensividade decorativa: um `incl_cane_div` corrompido viraria NaN,
    // e uma bengala que bate a cada NaN blocos não bate nunca — o modo de falha mais silencioso que existe
    // para quem navega por som.
    setCaneBlockDivValue(Number.NaN);
    expect(state.caneBlockDiv).toBe(1);
    setCaneBlockDivValue(0);
    expect(state.caneBlockDiv).toBe(1);
  });


  it('[Right] caixa da letra e legendas PERSISTEM — decisão do ADR-0028: todo menu persiste', () => {
    // A pergunta foi feita porque nenhum dos dois tinha chave nem leitura no boot, e inventar persistência
    // seria inventar a decisão. A resposta do Dev foi mais ampla: todo menu persiste E todo menu ganha um
    // reset dos próprios padrões. O motivo é acessibilidade, não conveniência — uma criança surda que liga as
    // legendas e as encontra desligadas amanhã paga esse preço todo dia.
    setLetterCaseValue('lower');
    expect(store.get('incl_lettercase', null)).toBe('lower');
    setCaptionsOnValue(false);
    expect(store.getBool('incl_captions', true)).toBe(false);
    setCaptionsOnValue(true);
    expect(store.getBool('incl_captions', false)).toBe(true);
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

describe('defaultReducedMotion — o padrão que o sistema decide', () => {
  // Este é o único DEFAULT do projeto que não é constante, e o motivo importa: devolver `false` numa máquina
  // cujo dono pediu menos movimento RELIGARIA a animação. O reset passaria a fazer, sozinho, o que a
  // WCAG 2.3.3 existe para impedir — e na tela de quem já tinha dito que não aguenta.
  it('[Zero] sem `window` (projeto node) responde false, em vez de explodir', () => {
    expect(typeof window).toBe('undefined');
    expect(defaultReducedMotion()).toBe(false);
  });

  it('[Interface] é uma FUNÇÃO, não um valor congelado no import', () => {
    // Se virasse `export const RM_DEFAULT = matchMedia(...)`, o valor seria lido uma vez no boot e nunca mais.
    // O sistema pode mudar a preferência com o jogo aberto, e um padrão que não acompanha deixa de ser padrão.
    expect(typeof defaultReducedMotion).toBe('function');
  });
});

// ========================= CINCO CAMPOS SAÍRAM DAQUI, E A COBERTURA FOI JUNTO =========================
// `ended`, `selVizPlayer`, `pauseActor`, `grassDensity` e `decorSeed` mudaram-se para `core/run-state` na
// Fase B (ADR-0038): nenhum deles persiste, e não-persistido é o critério de RODADA.
//
// Os casos deles NÃO foram apagados — foram reescritos em `tests/run-state.node.test.js` contra a fábrica,
// e ganharam um caso a mais que aqui era impossível: o do VAZAMENTO entre duas instâncias, que é a razão de
// a fábrica existir. Apagar cobertura numa migração é como perder o troco; movê-la é o mínimo.
//
// O que sobrou aqui é o estado de PÁGINA — acessibilidade, idioma, dispositivo — mais o `numPlayers`, o
// `players` e o `phase`, que são as próximas fatias.
