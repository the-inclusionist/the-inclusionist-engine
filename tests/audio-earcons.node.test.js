// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de platform/audio-earcons (project NODE: Web Audio/SFX/showCaption/noiseHit falsos injetados por closure).
// Contrato-chave de a11y: a LEGENDA sai ANTES da checagem de som → surdo "vê" o earcon mesmo com áudio OFF. sfx toca
// 1 oscilador; doorSound escolhe timbre por material + dispara noiseHit. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { createAudioEarcons } from '../app/js/platform/audio-earcons.js';

function fakeAC() {
  const rec = { osc: 0, types: [] };
  const chain = { connect: () => chain };
  const mkOsc = () => { rec.osc++; const o = {
    type: '', frequency: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    connect: () => chain, start: () => {}, stop: () => {} };
    Object.defineProperty(o, 'type', { set: (v) => rec.types.push(v), get: () => rec.types[rec.types.length - 1] });
    return o; };
  const mkGain = () => ({ gain: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => chain });
  return { rec, ac: { currentTime: 0, destination: {}, createOscillator: mkOsc, createGain: mkGain } };
}

// A tabela é do JOGO (item 19) e `cap` guarda a CHAVE, não o texto. O fixture usa uma chave que NÃO existe
// no dicionário de propósito: `t()` devolve a própria chave quando não acha, então o caso continua podendo
// afirmar o que interessa — que a legenda sai — sem depender do texto de nenhum idioma.
const SFX = { alvo: { t: 'square', f: 880, d: 0.1, cap: 'sfx.teste' }, plain: { t: 'sine', f: 440, d: 0.1 } };

function setup(over = {}) {
  const caps = [], hits = [];
  const { rec, ac } = fakeAC();
  const ctx = {
    SFX,
    ensureAC: () => ac,
    catNode: () => null,
    audioOut: () => ({ connect: () => ({}) }),
    noiseHit: (mat) => hits.push(mat),
    getSoundOn: () => true,
    getVolume: () => 0.6,
    getCaptionsOn: () => true,
    showCaption: (t) => caps.push(t),
    ...over,
  };
  return { earcons: createAudioEarcons(ctx), rec, caps, hits };
}

describe('platform/audio-earcons', () => {
  it('[Zero] sfx com nome inexistente: no-op (sem legenda, sem som)', () => {
    const { earcons, rec, caps } = setup();
    earcons.sfx('nope');
    expect(caps).toEqual([]);
    expect(rec.osc).toBe(0);
  });

  it('[Cross-check a11y] som OFF mas legendas ON: legenda SAI, mas 0 osciladores', () => {
    const { earcons, rec, caps } = setup({ getSoundOn: () => false });
    earcons.sfx('alvo');
    expect(caps).toEqual(['sfx.teste']); // surdo vê o earcon mesmo sem áudio
    expect(rec.osc).toBe(0);
  });

  it('[Interface] legendas OFF: nenhuma legenda mesmo com .cap (mas o som toca)', () => {
    const { earcons, rec, caps } = setup({ getCaptionsOn: () => false });
    earcons.sfx('alvo');
    expect(caps).toEqual([]);
    expect(rec.osc).toBe(1);
  });

  it('[One] sfx com som ON: 1 oscilador; earcon sem .cap não legenda', () => {
    const { earcons, rec, caps } = setup();
    earcons.sfx('plain');
    expect(rec.osc).toBe(1);
    expect(caps).toEqual([]); // 'plain' não tem cap
  });

  it('[Boundary] doorSound(ferro)=square + noiseHit(ferro); doorSound(madeira)=sawtooth + noiseHit(madeira)', () => {
    const a = setup(); a.earcons.doorSound('ferro');
    expect(a.rec.types).toContain('square');
    expect(a.hits).toEqual(['ferro']);
    const b = setup(); b.earcons.doorSound('madeira');
    expect(b.rec.types).toContain('sawtooth');
    expect(b.hits).toEqual(['madeira']);
  });

  it('[Zero] doorSound com volume 0: 0 osciladores e nenhum noiseHit', () => {
    const { earcons, rec, hits } = setup({ getVolume: () => 0 });
    earcons.doorSound('ferro');
    expect(rec.osc).toBe(0);
    expect(hits).toEqual([]);
  });
});

// ==========================================================================================================
// ⚠️ UM EARCON TEM DE PODER IR PARA ALGUM LADO (#124)
//
// Medido ao construir o `game-soccer`: marcar e sofrer golo tem de ser distinguivel **so de ouvido** — uma
// crianca cega ouve a sala reagir e precisa de saber para que lado ANTES de a narracao chegar. O desenho
// obvio e uma figura que SOBE para o golo dela e DESCE para o do outro, e a tabela nao o sabia dizer: o
// `SfxDef` tinha uma frequencia so, e o oscilador ficava parado nela.
//
// ⚠️ E A CAPACIDADE JA ESTAVA NO MESMO FICHEIRO, sem ser alcancavel da tabela: o `doorSound` faz exatamente
// isto com `frequency.exponentialRampToValueAtTime`. O conserto nao e sintese nova — e abrir a porta.
//
// Estes casos precisam de um AudioContext falso mais fino do que o de cima: aquele nao regista NADA do que
// se faz a `frequency`, entao uma rampa passaria por ele sem deixar rasto. Este anota as chamadas.
//
// MUTACOES CONFERIDAS (no fim do bloco).
// ==========================================================================================================
describe('platform/audio-earcons — a figura do earcon (#124)', () => {
  function acQueAnota() {
    const freq = { fixados: [], rampas: [] };
    const chain = { connect: () => chain };
    const mkOsc = () => ({
      type: '',
      frequency: {
        value: 0,
        setValueAtTime: (v, quando) => freq.fixados.push([v, quando]),
        exponentialRampToValueAtTime: (v, quando) => freq.rampas.push([v, quando]),
      },
      connect: () => chain, start: () => {}, stop: () => {},
    });
    const mkGain = () => ({ gain: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => chain });
    return { freq, ac: { currentTime: 0, destination: {}, createOscillator: mkOsc, createGain: mkGain } };
  }

  function toca(def) {
    const { freq, ac } = acQueAnota();
    const earcons = createAudioEarcons({
      SFX: { alvo: def },
      ensureAC: () => ac, catNode: () => null, audioOut: () => ({ connect: () => ({}) }),
      noiseHit: () => {}, getSoundOn: () => true, getVolume: () => 0.6,
      getCaptionsOn: () => false, showCaption: () => {},
    });
    earcons.sfx('alvo');
    return freq;
  }

  it('⚠️ [Right] com `f2` o earcon SOBE — parte de `f` e chega a `f2` no fim da duracao', () => {
    const freq = toca({ t: 'triangle', f: 300, d: 0.4, f2: 900 });
    expect(freq.fixados, 'nao fixou o ponto de partida; a curva comeca onde calhar').toEqual([[300, 0]]);
    expect(freq.rampas, 'nao rampou ate f2 no fim da duracao').toEqual([[900, 0.4]]);
  });

  it('[Right] e DESCE, que e a outra metade do par — a mesma tabela diz as duas', () => {
    const freq = toca({ t: 'triangle', f: 900, d: 0.4, f2: 300 });
    expect(freq.fixados).toEqual([[900, 0]]);
    expect(freq.rampas).toEqual([[300, 0.4]]);
  });

  it('[Zero] sem `f2` nada se mexe — a nota parada continua a ser o que sempre foi', () => {
    const freq = toca({ t: 'square', f: 520, d: 0.12 });
    expect(freq.fixados).toEqual([]);
    expect(freq.rampas).toEqual([]);
  });

  it('⚠️ [Boundary] `f2: 0` NAO rampa — a rampa exponencial lanca com alvo zero', () => {
    // Sem esta guarda, uma tabela com zero mataria o earcon INTEIRO pelo `catch` do `sfx()`, em silencio:
    // sem som e sem erro. E o pior modo de falhar que este ficheiro pode ter.
    const freq = toca({ t: 'sine', f: 440, d: 0.2, f2: 0 });
    expect(freq.rampas, 'pediu rampa para zero').toEqual([]);
  });

  it('[Boundary] `f2` igual a `f` nao rampa — nao ha figura nenhuma a desenhar', () => {
    const freq = toca({ t: 'sine', f: 440, d: 0.2, f2: 440 });
    expect(freq.rampas).toEqual([]);
  });

  it('⚠️ [Interface] o earcon com figura continua a legendar ANTES de olhar para o som', () => {
    // A ordem que a auditoria mandou registar como o que a engine ACERTOU. Um `f2` novo nao pode ter mexido
    // nela: quem le legenda recebe a informacao com as colunas mudas.
    const caps = [];
    const { ac } = acQueAnota();
    const earcons = createAudioEarcons({
      SFX: { alvo: { t: 'triangle', f: 300, d: 0.4, f2: 900, cap: 'sfx.teste' } },
      ensureAC: () => ac, catNode: () => null, audioOut: () => ({ connect: () => ({}) }),
      noiseHit: () => {}, getSoundOn: () => false, getVolume: () => 0,
      getCaptionsOn: () => true, showCaption: (x) => caps.push(x),
    });
    earcons.sfx('alvo');
    expect(caps, 'com o som desligado a legenda deixou de sair').toEqual(['sfx.teste']);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · tirando o bloco `if (typeof c.f2 === 'number' && ...)` → "[Right] com `f2` o earcon SOBE" e "[Right] e
//     DESCE" reprovam com as duas listas vazias. E a #124 reproduzida: a tabela pede uma figura e o
//     oscilador fica parado.
//   · trocando `c.f2 > 0` por `c.f2 >= 0` → "[Boundary] `f2: 0` NAO rampa" reprova, e no navegador de
//     verdade seria o earcon inteiro a morrer em silencio pelo `catch`.
//   · tirando o `setValueAtTime` e deixando so a rampa → reprovam as duas de subir/descer. O ponto de
//     partida da curva nao pode ficar por conta da implementacao.
//     ⚠️ E esta mutacao ABORTOU a primeira vez, com contagem ZERO: o ficheiro e CRLF e o `\n` do script nao
//     casou. Sem a contagem de ocorrencias ela teria "sobrevivido" sem nunca ter sido aplicada, e eu tinha
//     registado uma linha nao aferida como aferida. E o unico motivo de a contagem existir.
//   · trocando `t + c.d` por `t + 0.3` (o numero cravado do `doorSound`) → as duas de subir/descer reprovam
//     no instante. A figura tem de caber na duracao que a tabela declara, e nao numa constante emprestada.
