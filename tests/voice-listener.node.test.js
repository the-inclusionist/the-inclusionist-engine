// SPDX-License-Identifier: AGPL-3.0-or-later
// THE COMMANDS' MICROPHONE, AND WHAT IT GIVES BACK (ADR-0189, ADR-0193; issue #184).
//
// Reading opens the microphone for one sentence and closes it; this one stays open while the child plays by voice. What is
// measured here is the whole promise of that «fica aberto»: that the sound goes to a recogniser ON THIS machine, that the
// grammar lets the recogniser say «não foi nenhuma destas», and — above all — that LETTING GO is part of the job. A page
// that keeps listening after the child turns voice off is the promise broken, however good the reason.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { startVoiceListening, VOICE_BLOCK } from '../app/js/platform/voice-listener.js';

/** A fake model that records the grammars asked of it and returns controllable recognisers. */
function modeloFalso() {
  const feitos = [];
  function KaldiRecognizer(sampleRate, grammar) {
    const r = {
      sampleRate, grammar, blocos: [], removido: false, ouvintes: {},
      on(evento, cb) { r.ouvintes[evento] = cb; },
      acceptWaveform(b) { r.blocos.push(b); },
      remove() { r.removido = true; },
    };
    feitos.push(r);
    return r;
  }
  const modelo = { KaldiRecognizer, terminate() { modelo.terminado = true; }, terminado: false };
  return { modelo, feitos };
}

function ambiente() {
  const faixas = [{ parada: false, stop() { this.parada = true; } }];
  const stream = { getTracks: () => faixas };
  const ligacoes = [];
  const no = { onaudioprocess: null, connect: (a) => ligacoes.push(a), disconnect() { no.desligado = true; }, desligado: false };
  const destino = { destino: true };
  const context = {
    sampleRate: 48000, destination: destino, fechado: false,
    createMediaStreamSource: () => ({ connect: (a) => ligacoes.push(a) }),
    createScriptProcessor: (n) => { context.bloco = n; return no; },
    close: async () => { context.fechado = true; },
  };
  return { faixas, stream, no, context, ligacoes, destino, getUserMedia: async () => stream };
}

const abrir = async (extra = {}) => {
  const { modelo, feitos } = modeloFalso();
  const amb = ambiente();
  const ouvidas = [];
  const fins = [];
  const ouvinte = await startVoiceListening({
    model: modelo, grammar: ['acima', 'abaixo'],
    getUserMedia: amb.getUserMedia, createContext: () => amb.context,
    onPartial: (t) => ouvidas.push(t), onFinal: () => fins.push(1), ...extra,
  });
  return { ouvinte, modelo, feitos, amb, ouvidas, fins };
};

describe('o que o reconhecedor recebe', () => {
  it('🔴 [Right] a gramática leva `[unk]`, senão tudo o que se diz vira o comando mais parecido', async () => {
    const { feitos } = await abrir();
    const gramatica = JSON.parse(feitos[0].grammar);
    expect(gramatica, 'sem «[unk]» uma frase que não é comando é empurrada para a palavra mais próxima').toContain('[unk]');
    expect(gramatica).toEqual(['acima', 'abaixo', '[unk]']);
  });

  it('📌 [Right] e ouve à taxa do aparelho, em blocos do tamanho que o laboratório mediu', async () => {
    const { feitos, amb } = await abrir();
    expect(feitos[0].sampleRate, 'uma taxa inventada faria o reconhecedor ouvir outra coisa').toBe(48000);
    expect(amb.bloco ?? amb.context.bloco).toBe(VOICE_BLOCK);
  });

  it('🔴 [Right] o som do microfone chega ao reconhecedor, bloco a bloco', async () => {
    const { feitos, amb } = await abrir();
    amb.no.onaudioprocess({ inputBuffer: 'bloco-1' });
    amb.no.onaudioprocess({ inputBuffer: 'bloco-2' });
    expect(feitos[0].blocos).toEqual(['bloco-1', 'bloco-2']);
  });

  it('🔴 [Right] o grafo chega ao DESTINO, senão nada é puxado por ele', async () => {
    const { amb } = await abrir();
    expect(amb.ligacoes, 'o nó ficou solto: o microfone abre e o reconhecedor não recebe nada').toContain(amb.destino);
  });

  it('🔴 [Right] um bloco que rebenta não leva o microfone com ele', async () => {
    const rebenta = { KaldiRecognizer: function K() { return { on() {}, acceptWaveform() { throw new Error('bum'); }, remove() {} }; } };
    const { amb } = await abrir({ model: rebenta });
    expect(() => amb.no.onaudioprocess({ inputBuffer: 'x' }), 'a criança perderia o resto da frase').not.toThrow();
  });
});

describe('o que a criança ouve de volta', () => {
  it('🔴 [Right] o parcial atravessa; um parcial vazio não acorda ninguém', async () => {
    const { feitos, ouvidas } = await abrir();
    feitos[0].ouvintes.partialresult({ result: { partial: 'acima' } });
    feitos[0].ouvintes.partialresult({ result: { partial: '' } });
    expect(ouvidas).toEqual(['acima']);
  });

  it('🔴 [Right] e o fim da frase é dito, para quem conta o que já respondeu recomeçar', async () => {
    const { feitos, fins } = await abrir();
    feitos[0].ouvintes.result({ result: { text: 'acima' } });
    expect(fins.length, 'sem isto, a mesma palavra dita outra vez não seria um comando novo').toBe(1);
  });
});

describe('largar é parte do trabalho', () => {
  it('🔴 [Right] parar solta a FAIXA do microfone, desliga o nó e fecha o contexto', async () => {
    const { ouvinte, amb, feitos, modelo } = await abrir();
    await ouvinte.stop();
    expect(amb.faixas[0].parada, 'a página continua a ouvir — é a promessa quebrada, não um resto').toBe(true);
    expect(amb.no.desligado).toBe(true);
    expect(amb.context.fechado).toBe(true);
    expect(feitos[0].removido).toBe(true);
    expect(modelo.terminado).toBe(true);
  });

  it('📌 [Boundary] parar duas vezes não rebenta, e um bloco atrasado depois de parar não é ouvido', async () => {
    const { ouvinte, amb, feitos } = await abrir();
    // ⚠️ THE BLOCK IS KEPT BEFORE STOPPING, and that is what makes this case a case: stopping switches `onaudioprocess` off,
    // so calling it through the node afterwards would measure nothing. What really exists is the block the browser ALREADY
    // HAS IN HAND when the child turns voice off — and a surviving mutation is what showed it was not being measured.
    const blocoEmVoo = amb.no.onaudioprocess;
    await ouvinte.stop();
    await ouvinte.stop();
    expect(amb.faixas[0].parada).toBe(true);
    blocoEmVoo({ inputBuffer: 'atrasado' });
    expect(feitos[0].blocos.length, 'ouviu som depois de a criança desligar a voz').toBe(0);
  });

  it('🔴 [Right] trocar a gramática troca o reconhecedor e deita o antigo fora — sem fechar o microfone', async () => {
    const { ouvinte, feitos, amb } = await abrir();
    ouvinte.setGrammar(['voltar ao jogo']);
    expect(feitos.length, 'a gramática nova não chegou a um reconhecedor').toBe(2);
    expect(JSON.parse(feitos[1].grammar)).toEqual(['voltar ao jogo', '[unk]']);
    expect(feitos[0].removido, 'o reconhecedor antigo ficou a ouvir em paralelo').toBe(true);
    expect(amb.faixas[0].parada, 'trocar a gramática fechou o microfone').toBe(false);
    // and the sound goes to the NEW one
    amb.no.onaudioprocess({ inputBuffer: 'depois' });
    expect(feitos[1].blocos).toEqual(['depois']);
  });
});

describe('um aparelho sem microfone', () => {
  it('🎯 [Zero] é RECUSADO dizendo, e não silenciosamente sem ouvir nada', async () => {
    const { modelo } = modeloFalso();
    await expect(startVoiceListening({ model: modelo, grammar: [], getUserMedia: undefined, createContext: () => ({}), onPartial: () => {} }))
      .rejects.toThrow(/microphone/);
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-voice-listener.py`.
