// SPDX-License-Identifier: AGPL-3.0-or-later
// O GATE DO CORTE POR TEMPO DE VIDA (ADR-0038, passo 4 da Fase B do plano).
//
// ========================= POR QUE ISTO É UM GATE, E NÃO UM TESTE =========================
// O ADR-0038 cortou o estado por TEMPO DE VIDA e escolheu de propósito um critério MECÂNICO, e não uma
// definição:
//
//     persistido em chave `incl_*` compartilhada = PÁGINA · em `kJogo()` = JOGO · não persistido = RODADA
//
// Um critério mecânico existe para poder virar máquina. Enquanto ele mora só no texto do registro, o próximo
// `export let` entra em `core/state` sem que nada pergunte de que tempo de vida ele é — foi assim que
// `cenario`, `activity`, `coins`, `quizLevel`, `players` e `numPlayers` acabaram todos no mesmo arquivo.
//
// Duas afirmações, e elas são independentes:
//
//   1. TODO setter de `core/state` PERSISTE. É o que faz daquele módulo o de PÁGINA: um valor que não
//      sobrevive a fechar o jogo não tem o que fazer ali. Um `export let` novo sem persistência reprova aqui.
//   2. NENHUM campo de `core/run-state` persiste. É a metade que impede o caminho inverso — um estado de
//      partida ganhando um `store.set()` "só para não perder ao recarregar" e virando, sem discussão, uma
//      preferência da criança.
//
// ========================= ONDE O FALSO ENTRA =========================
// ABAIXO do `platform/storage`, na API do navegador, e não no lugar dele. É a mesma escolha de
// `tests/state.node.test.js`, pelo mesmo motivo: o storage real é à prova de exceção (ele engole tudo em
// `file://` e no modo privado), então substituí-lo mediria o falso. Com o `localStorage` falso por baixo, o
// que se afere é que o setter MANDA persistir, com o módulo de persistência de verdade no caminho.
//
// As MUTAÇÕES CONFERIDAS estão no fim do arquivo.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as state from '../app/js/core/state.js';
import { createRunState } from '../app/js/core/run-state.js';

/**
 * Os setters de `core/state` que NÃO persistem, com o motivo de cada um. A lista é curta de propósito: ela é
 * a dívida visível do corte, e cada linha aqui é uma coisa que ainda vai sair.
 */
const SEM_PERSISTIR: Record<string, string> = {
  // (`setPhaseValue` estava aqui e SAIU em 2026-08-26 — o `phase` virou a pilha de `core/scenes`, e com ele
  //  foi embora a única RODADA que ainda morava na engine. A lista encolheu, que é o que ela deve fazer.)
  // `initVizMode` NÃO é setter: é a carga do boot, e ela não persiste DE PROPÓSITO — o padrão vem de
  // `prefers-contrast`, e gravá-lo travaria o rastreio da preferência do sistema (ver o comentário lá).
  initVizMode: 'boot: o padrão de mídia deve seguir o sistema a cada abertura',
};

/**
 * DOIS valores por setter, e o par não é excesso — é o conserto de uma vacuidade que a mutação flagrou.
 *
 * Quase todo setter daqui começa com `if (valorAtual === novo) return;`. `core/state` é módulo, e módulo é
 * carregado UMA vez por processo de teste: o segundo caso a chamar `setWheelchairValue(true)` encontra o
 * valor já em `true`, sai pelo guarda e não escreve NADA. O caso passava por não ter o que reprovar.
 *
 * Chamando com os dois valores, pelo menos uma das chamadas atravessa o guarda, seja qual for o estado em
 * que o módulo esteja — e a ordem dos casos deixa de importar.
 */
const ARGUMENTOS: Record<string, readonly [unknown, unknown]> = {
  setVizModeValue: ['sim-deuter', 'normal'], setModoCegoValue: [true, false],
  setLetterCaseValue: ['lower', 'upper'], setCaptionsOnValue: [false, true],
  setCbSafeValue: [true, false], setOwnerColorsValue: [false, true],
  setOutlineFgValue: [2, 0], setOutlineBgValue: [2, 0], setCaneBlockDivValue: [4, 2],
  setWheelchairValue: [true, false], setOneButtonValue: [true, false], setGameSpeedValue: [0.5, 1], setSemForcaValue: [true, false], setCameraControlValue: ['eyes', 'off'], setCaptionPpmValue: [175, 125],
  setSpeechPpmValue: [404, 254], setInputCooldownValue: [500, 0],
  setMenuIndexOnValue: [false, true], setSwitchScanValue: [true, false],
};

let localAntigo: unknown;
let escritas: string[] = [];

beforeEach(() => {
  localAntigo = (globalThis as { localStorage?: unknown }).localStorage;
  const mapa = new Map<string, string>();
  escritas = [];
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (mapa.has(k) ? mapa.get(k)! : null),
    setItem: (k: string, v: string) => { escritas.push(k); mapa.set(k, String(v)); },
    removeItem: (k: string) => { mapa.delete(k); },
  };
});
afterEach(() => {
  if (localAntigo === undefined) delete (globalThis as { localStorage?: unknown }).localStorage;
  else (globalThis as { localStorage?: unknown }).localStorage = localAntigo;
});

/** Todos os setters exportados por `core/state`, DESCOBERTOS — não uma lista escrita à mão. */
function settersDoModulo(): string[] {
  const m = state as unknown as Record<string, unknown>;
  return Object.keys(state).filter((k) => /^(set|init)/.test(k) && typeof m[k] === 'function');
}

/** Chama o setter com os DOIS valores. Ver a nota de `ARGUMENTOS`: com um só, o guarda de igualdade torna
 *  o caso dependente da ordem — e um caso dependente de ordem é um caso que um dia passa à toa. */
function chamar(nome: string): void {
  const f = (state as unknown as Record<string, (v: unknown) => void>)[nome];
  for (const v of ARGUMENTOS[nome]) f(v);
}

describe('ADR-0038 · PÁGINA — o que mora em core/state sobrevive a fechar o jogo', () => {
  it('a descoberta é MECÂNICA: a lista de setters sai do módulo, não de um array daqui', () => {
    // Sem isto o gate mediria só o que alguém se lembrou de listar — e o binding esquecido é justamente o
    // que ele existe para pegar.
    const achados = settersDoModulo();
    expect(achados.length).toBeGreaterThanOrEqual(11);
    expect(achados).toContain('setModoCegoValue');
    expect(achados).toContain('setOneButtonValue');
  });

  it('[Right] TODO setter persiste — um binding novo sem persistência reprova aqui', () => {
    const semGravar: string[] = [];
    for (const nome of settersDoModulo()) {
      if (nome in SEM_PERSISTIR) continue;
      escritas = [];
      expect(ARGUMENTOS[nome], 'setter novo sem par de valores em ARGUMENTOS: ' + nome).toBeDefined();
      chamar(nome);
      if (!escritas.length) semGravar.push(nome);
    }
    expect(semGravar, 'PÁGINA sem persistência: ' + semGravar.join(', ')).toEqual([]);
  });

  it('[Right] e persiste em chave COMPARTILHADA, nunca no escopo do jogo', () => {
    // A distinção é de acessibilidade, não de arrumação: prefixar por jogo faria a criança cega reconfigurar
    // modo cego, bengala e voz nos 35 jogos do catálogo. `tests/storage-escopos` guarda a TABELA de chaves;
    // este caso guarda o CAMINHO — o que o setter de fato escreve quando roda.
    const foraDeEscopo: string[] = [];
    for (const nome of settersDoModulo()) {
      if (nome in SEM_PERSISTIR) continue;
      escritas = [];
      chamar(nome);
      for (const k of escritas) if (!/^incl_/.test(k)) foraDeEscopo.push(k);
    }
    expect(foraDeEscopo, 'PÁGINA em chave de JOGO: ' + foraDeEscopo.join(', ')).toEqual([]);
  });

  it('[Interface] as exceções são NOMEADAS, com motivo — a lista é a dívida visível do corte', () => {
    for (const [nome, motivo] of Object.entries(SEM_PERSISTIR)) {
      expect(settersDoModulo(), 'exceção obsoleta: ' + nome).toContain(nome);
      expect(motivo.length).toBeGreaterThan(20);
    }
  });
});

describe('ADR-0038 · RODADA — o que não sobrevive à partida não é gravado', () => {
  it('[Zero] criar uma rodada não escreve nada', () => {
    escritas = [];
    createRunState();
    expect(escritas).toEqual([]);
  });

  it('[Right] NENHUM setter da rodada persiste — nem o grassDensity, que tem faixa e clamp', () => {
    // O `grassDensity` é o candidato natural a escorregar: ele tem validação, e um campo validado parece uma
    // preferência. Não é — é a grama DESTA fase, e a fase seguinte sorteia outra.
    const r = createRunState<{ kind: string }>();
    escritas = [];
    r.setLevelExtras({ powerups: [{ kind: 'fly' }], gateTiles: new Set(['1,1']), gate: [{ tx: 1, ty: 1 }], gateOpen: false });
    r.setGateOpen(true);
    r.setWcSolid(new Set(['2,2']));
    r.setEnded(true);
    r.setDecorSeed(1234);
    r.setGrassDensity(0.4);
    r.setSelVizPlayer(2);
    r.setPauseActor(1);
    r.setNumPlayers(3);
    expect(escritas, 'RODADA persistiu: ' + escritas.join(', ')).toEqual([]);
  });

  it('[Interface] duas rodadas são INDEPENDENTES — é a razão de a fábrica existir', () => {
    // A casca do `demos` carrega jogo após jogo na mesma página (ADR-0036/D13). Com `export let`, o portão
    // aberto no jogo anterior continuaria aberto no seguinte, sem erro nenhum.
    const a = createRunState();
    const b = createRunState();
    a.setGateOpen(false); a.setNumPlayers(4); a.players.push({} as never);
    expect(b.gateOpen).toBe(true);
    expect(b.numPlayers).toBe(1);
    expect(b.players).toHaveLength(0);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
// Cada uma foi aplicada, o caso foi visto VERMELHO com a mensagem anotada, e a mutação foi desfeita:
//
//   · tirar o `store.setBool` de `setCaptionsOnValue` (core/state)
//       → "PÁGINA sem persistência: setCaptionsOnValue"
//   · fazer `setGrassDensity` gravar `incl_grass` (core/run-state)
//       → "RODADA persistiu: incl_grass"
//   · trocar a chave de `setWheelchairValue` por `store.KEYS.cenario`, que é do escopo do JOGO
//       → "PÁGINA em chave de JOGO: incl.inclusionist.cenario"
//
// A TERCEIRA foi a que valeu a pena: na primeira escrita deste arquivo ela passou VERDE, e passou porque o
// caso estava vazio — o guarda `if (valorAtual === novo) return;` fazia o segundo caso a chamar o setter não
// escrever nada. Foi o que trouxe o par de valores de `ARGUMENTOS`. Um gate que não é mutado é um gate que
// se acredita.
