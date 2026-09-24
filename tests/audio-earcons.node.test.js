// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de platform/audio-earcons (project NODE: Web Audio/SFX/showCaption/noiseHit falsos injetados por closure).
// Contrato-chave de a11y: a LEGENDA sai ANTES da checagem de som → surdo "vê" o earcon mesmo com áudio OFF. sfx toca
// 1 oscilador; doorSound escolhe timbre por material + dispara noiseHit. Ver docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { createAudioEarcons } from '../app/js/platform/audio-earcons.js';
import { t } from '../app/js/core/i18n.js';

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

// ==========================================================================================================
// WHERE AN EARCON GOES, HOW LOUD, FOR HOW LONG — and what the door does (probed 2026-09-23)
//
// A probe of `sfx` and `doorSound` found eleven decisions no case above could see, because the fake above records
// oscillators and types and nothing else: the bus a sound is routed to, its peak and its floor, when it stops,
// a caption resolved into the child's language, a Web Audio that throws, and the door's pitch, bus and «sound
// off». This context writes all of it down.
// ==========================================================================================================
describe('platform/audio-earcons — the bus, the level, the length, and the door', () => {
  function acQueGrava() {
    const rec = { destinos: [], ganhos: [], paradas: [], fixados: [], osc: 0 };
    const no = (nome) => ({ _nome: nome, connect: (n) => { rec.destinos.push(n._nome); return n; } });
    const ac = {
      currentTime: 0,
      destination: no('destination'),
      createOscillator: () => {
        rec.osc++;
        return { ...no('osc'), type: '', start: () => {}, stop: (quando) => rec.paradas.push(quando),
          frequency: { value: 0, setValueAtTime: (v) => rec.fixados.push(v), exponentialRampToValueAtTime: () => {} } };
      },
      createGain: () => ({ ...no('ganho'), gain: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: (v) => rec.ganhos.push(v) } }),
    };
    return { rec, ac, no };
  }

  function montar(over = {}) {
    const { rec, ac, no } = acQueGrava();
    const caps = [], hits = [], pedidos = [];
    const earcons = createAudioEarcons({
      SFX: { alvo: { t: 'square', f: 880, d: 0.1, cap: 'gaze.lookHere' } },
      ensureAC: () => ac,
      catNode: (cat) => { pedidos.push(cat); return over.barramento ? no(`${cat}-bus`) : null; },
      audioOut: () => (over.semMestre ? null : no('mestre')),
      noiseHit: (m) => hits.push(m), getSoundOn: () => over.somLigado ?? true, getVolume: () => over.volume ?? 0.6,
      getCaptionsOn: () => true, showCaption: (x) => caps.push(x),
      ...over.ctx,
    });
    return { earcons, rec, caps, hits, pedidos };
  }

  it('🔴 [Right] the caption is shown in the child\'s language — the table keeps a KEY and whoever shows it resolves it', () => {
    const { earcons, caps } = montar();
    earcons.sfx('alvo');
    expect(caps[0], 'the key itself reached the caption').not.toBe('gaze.lookHere');
    expect(caps[0]).toBe(t('gaze.lookHere'));
  });

  it('🔴 [Zero] the sound on at volume ZERO plays nothing — and the caption still comes out', () => {
    const { earcons, rec, caps } = montar({ volume: 0 });
    earcons.sfx('alvo');
    expect(rec.osc).toBe(0);
    expect(caps).toHaveLength(1);
  });

  it('🔴 [Right] an earcon goes to the `earcons` bus; without one to the master; without that to the device', () => {
    const noBarramento = montar({ barramento: true });
    noBarramento.earcons.sfx('alvo');
    expect(noBarramento.pedidos).toEqual(['earcons']);
    expect(noBarramento.rec.destinos.at(-1)).toBe('earcons-bus');
    const noMestre = montar();
    noMestre.earcons.sfx('alvo');
    expect(noMestre.rec.destinos.at(-1)).toBe('mestre');
    const noAparelho = montar({ semMestre: true });
    noAparelho.earcons.sfx('alvo');
    expect(noAparelho.rec.destinos.at(-1)).toBe('destination');
  });

  it('🔴 [Right] the peak follows the master volume, with a floor so a low volume is still heard', () => {
    const alto = montar({ volume: 0.6 });
    alto.earcons.sfx('alvo');
    expect(alto.rec.ganhos[0]).toBeCloseTo(0.15, 6);
    const baixo = montar({ volume: 0.01 });
    baixo.earcons.sfx('alvo');
    expect(baixo.rec.ganhos[0], 'the floor').toBeCloseTo(0.02, 6);
  });

  it('🔴 [Right] it stops when the table says, a moment after the sound has faded', () => {
    const { earcons, rec } = montar();
    earcons.sfx('alvo');
    expect(rec.paradas).toEqual([0.1 + 0.02]);
  });

  it('⚠️ [Error] a Web Audio that throws is silent — the game goes on, and the caption is already out', () => {
    const { earcons, caps } = montar({ ctx: { ensureAC: () => ({ createOscillator: () => { throw new Error('no audio'); } }) } });
    expect(() => earcons.sfx('alvo')).not.toThrow();
    expect(caps).toHaveLength(1);
  });

  it('🔴 [Zero] a door with the game\'s sound OFF makes no sound and no thud', () => {
    const { earcons, rec, hits } = montar({ somLigado: false });
    earcons.doorSound('ferro');
    expect([rec.osc, hits]).toEqual([0, []]);
  });

  it('🔴 [Right] an iron door starts higher than a wooden one, and a door goes to the `interact` bus', () => {
    const ferro = montar({ barramento: true });
    ferro.earcons.doorSound('ferro');
    const madeira = montar();
    madeira.earcons.doorSound('madeira');
    expect([ferro.rec.fixados[0], madeira.rec.fixados[0]]).toEqual([520, 200]);
    expect(ferro.pedidos).toEqual(['interact']);
    expect(ferro.rec.destinos.at(-1)).toBe('interact-bus');
  });
});

// Two survivors are EQUIVALENT and declared rather than caught: dropping the «no context» guard in `sfx` (the null context then
// throws inside the same `catch`, and the answer is the same silence), and dropping the check that `f2` is a NUMBER (a typed
// table's `f2` is a number or absent, and an absent one is not `> 0`).
