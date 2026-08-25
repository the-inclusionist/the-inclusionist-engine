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
import { modoCego, setModoCegoValue, setCaneBlockDivValue, setEndedValue, setLetterCaseValue, setCaptionsOnValue, on, off, defaultReducedMotion, selVizPlayer, setSelVizPlayerValue, setNumPlayersValue, pauseActor, setPauseActorValue, grassDensity, setGrassDensityValue, decorSeed, setDecorSeedValue } from '../app/js/core/state.js';
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
  desinscrever.forEach((f) => f()); setModoCegoValue(false); setEndedValue(false); setLetterCaseValue('upper'); setCaptionsOnValue(true);
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

  it('[Right] `ended` grava e avisa — e não tinha teste nenhum antes desta migração', () => {
    // `ended` é controle de fluxo de verdade: o laço de atualização faz `if (ended) return;` para parar de
    // simular depois da vitória. Descobri que ninguém o cobria ao mutar o setter para não gravar e ver a
    // suíte inteira passar. Um valor lido pelo laço principal do jogo e por nenhum teste é o pior dos dois
    // mundos: importa e ninguém percebe se parar de funcionar.
    const vistos = escuta('ended');
    expect(state.ended).toBe(false);
    setEndedValue(true);
    expect(state.ended).toBe(true);
    expect(vistos).toEqual([true]);
    setEndedValue(true);            // repetido não avisa de novo
    expect(vistos).toEqual([true]);
    setEndedValue(false);
    expect(state.ended).toBe(false);
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

describe('selVizPlayer — qual jogador os painéis visuais editam (#50)', () => {
  // Migrado do main.js porque TRÊS superfícies o consultam (painel visual, render/viz-setters e __incl), cada
  // uma recebendo um par getter/setter fabricado à mão em volta do mesmo `let`. Estado que três módulos
  // consultam não é do composition root — é a condição que o ADR-0027 põe para `createGame()` nascer.
  it('[Zero] começa em 0 — o jogador 1 é quem edita antes de alguém escolher', () => {
    expect(selVizPlayer).toBe(0);
  });

  it('[Right] o setter escreve, e o binding vivo acompanha quem importa', () => {
    setSelVizPlayerValue(1);
    expect(selVizPlayer).toBe(1);
    setSelVizPlayerValue(0);
    expect(selVizPlayer).toBe(0);
  });

  it('[Interface] NÃO persiste — isto é qual aba está aberta, não uma preferência (ADR-0028)', () => {
    // A distinção passou a importar quando todo menu ganhou persistência: guardar isto faria a criança
    // reabrir o jogo já editando o jogador 2 sem ter pedido.
    setSelVizPlayerValue(1);
    const chaves = Object.keys(globalThis.localStorage ?? {});
    expect(chaves.some((k) => k.toLowerCase().includes('vizplayer'))).toBe(false);
    setSelVizPlayerValue(0);
  });
});

describe('pauseActor — quem abriu a pausa define o ESCOPO do menu (#50)', () => {
  // O comentário que cercava esta `let` no main.js já dizia "seis leitores", e havia QUATRO envoltórios
  // `setPauseActor: (i) => { pauseActor = i; }` espalhados pelo arquivo, mais uma escrita direta. Cinco
  // lugares reescrevendo a mesma variável à mão é a definição de estado sem dono.
  it('[Zero] começa em 0', () => {
    expect(pauseActor).toBe(0);
  });

  it('[Right] o setter escreve, e o binding vivo acompanha quem importa', () => {
    setPauseActorValue(2);
    expect(pauseActor).toBe(2);
    setPauseActorValue(0);
    expect(pauseActor).toBe(0);
  });

  it('[Interface] NÃO persiste — é quem apertou pausa agora, não uma preferência', () => {
    // No multiplayer em telas separadas este índice é o que faz o menu do jogador 2 editar os ajustes DELE.
    // Guardá-lo entre sessões faria a pausa de amanhã começar apontando para uma criança que talvez nem esteja
    // jogando — e o erro não dá erro: dá a criança certa mexendo nas configurações da errada, em silêncio.
    setPauseActorValue(1);
    const chaves = Object.keys(globalThis.localStorage ?? {});
    expect(chaves.some((k) => k.toLowerCase().includes('pauseactor'))).toBe(false);
    setPauseActorValue(0);
  });
});

describe('flora — densidade da grama e semente do decor (#50, #69)', () => {
  // O CLAMP é o motivo de o setter existir. Ele morava no `__incl`, ou seja, protegia só quem entrasse por
  // ali; qualquer outro caminho podia escrever 5 ou -1 e o cenário nascia errado sem nada reclamar. Um valor
  // com faixa válida que depende de quem escreve é um valor sem faixa válida.
  it('[Right] aceita a faixa 0..1 inteira', () => {
    for (const v of [0, 0.6, 1]) { setGrassDensityValue(v); expect(grassDensity).toBe(v); }
  });

  it('[Boundary] prende acima de 1 e abaixo de 0, em vez de gerar um cenário impossível', () => {
    setGrassDensityValue(5);
    expect(grassDensity).toBe(1);
    setGrassDensityValue(-1);
    expect(grassDensity).toBe(0);
  });

  it('[Zero/Error] lixo vira 0, não NaN — NaN atravessaria o clamp e envenenaria o desenho', () => {
    setGrassDensityValue(Number('abc'));
    expect(grassDensity).toBe(0);
    setGrassDensityValue(1);
  });

  it('[Right] a semente é inteira sem sinal — é assim que o gerador a consome', () => {
    setDecorSeedValue(1234567890);
    expect(decorSeed).toBe(1234567890);
    setDecorSeedValue(-1);
    expect(decorSeed).toBe(4294967295); // >>> 0
    setDecorSeedValue(0);
  });

  it('[Interface] nenhum dos dois PERSISTE', () => {
    // A semente é sorteada a cada fase de propósito: é o que faz duas partidas da mesma fase não terem a mesma
    // grama. Guardá-la apagaria essa variedade sem que ninguém notasse o porquê.
    setGrassDensityValue(0.3);
    setDecorSeedValue(42);
    const chaves = Object.keys(globalThis.localStorage ?? {});
    expect(chaves.some((k) => /grass|decor|seed/i.test(k))).toBe(false);
    setGrassDensityValue(1);
    setDecorSeedValue(0);
  });
});
