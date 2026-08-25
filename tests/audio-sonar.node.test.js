// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de platform/audio-sonar — a NAVEGAÇÃO SONORA depois do corte do item 19 (project node).
//
// ========================= O FIXTURE É A PROVA =========================
// O ADR-0027 chama isto de a heurística decisiva: "um teste de um módulo de ENGINE cujo fixture precisa de uma
// MOEDA é prova de que o corte não pegou". O fixture antigo do sonar precisava — um array de moedas com
// `owner` e `taken`, mais `tileAt`, `solidAt`, `BOX`, `TILE` e um cenário, seis coisas de plataforma para
// perguntar "qual alvo está mais perto".
//
// Este não precisa de nenhuma. Ele DECLARA topologia, alvos e nome, que é o que qualquer jogo faz. E os casos
// abaixo rodam o MESMO sonar sobre três topologias — contínua, grade e lista — porque essa é a única forma de
// afirmar que ele viaja: se um gênero precisasse de um caso especial, o corte estaria no lugar errado.
import { describe, it, expect } from 'vitest';
import { createAudioSonar } from '../app/js/platform/audio-sonar.js';

const CONTINUO = { kind: 'continuous', width: 896, height: 992, unit: 16 };
const GRADE = { kind: 'grid', cols: 20, rows: 20 };
const LISTA = { kind: 'hotspots', order: ['q1', 'q2', 'q3', 'q4'] };

function setup(over = {}) {
  const tone = [], said = [], narrated = [];
  const ctx = {
    // `over.topology` e um VALOR (a topologia), e nao uma funcao. Vale dizer: passar `() => GRADE` aqui fez
    // o ctx devolver a FUNCAO para o modulo, `t.kind` virou undefined, `distance` caiu no ramo continuo e
    // dividiu por `undefined` — NaN, nenhum alvo escolhido, "nenhuma moeda por perto". Um fixture errado que
    // falha como se o modulo estivesse errado custa mais caro do que um que quebra.
    topology: () => over.topology || CONTINUO,
    targetsOf: (i) => (over.targetsOf ? over.targetsOf(i) : (over.alvos || [])),
    // Nome PADRÃO genérico, e não o do jogo de plataforma: um fixture de sonar que dissesse "moeda" a cada
    // linha reafirmaria por hábito o que o corte acabou de tirar do módulo. Os casos que precisam de um nome
    // concreto o declaram, e declaram um diferente cada vez.
    nameAt: over.nameAt || (() => ({ text: 'alvo', gender: 'm', plural: false })),
    tonePan: (freq, dur, cat, pan) => tone.push({ freq, cat, pan }),
    srSay: (t) => said.push(t), narrate: (t) => narrated.push(t),
    VIZ_BY_KEY: { normal: { kind: 'normal' }, cego: { kind: 'blind' }, baixa: { kind: 'lowvision' } },
    getModoCego: () => over.modoCego || false,
    LOGICAL_W: 320,
    getPlayers: () => over.players || [],
    getNumPlayers: () => over.numPlayers || 1,
    getAudioCtx: () => (over.audioCtx === undefined ? {} : over.audioCtx),
    getSoundOn: () => (over.soundOn === undefined ? true : over.soundOn),
    getAudioCat: () => (over.audioCat === undefined ? { guide: { on: true } } : over.audioCat),
  };
  return { som: createAudioSonar(ctx), tone, said, narrated };
}

const pl = (o = {}) => ({ x: 32, y: 32, viz: 'cego', i: 0, ...o });

describe('platform/audio-sonar · o que não depende de gênero', () => {
  it('[Boundary] needsAudioCues: modoCego=true sempre; blind/lowvision sim; normal não', () => {
    expect(setup({ modoCego: true }).som.needsAudioCues(pl({ viz: 'normal' }))).toBe(true);
    expect(setup().som.needsAudioCues(pl({ viz: 'cego' }))).toBe(true);
    expect(setup().som.needsAudioCues(pl({ viz: 'baixa' }))).toBe(true);
    expect(setup().som.needsAudioCues(pl({ viz: 'normal' }))).toBe(false);
  });

  it('[Simple] panFor: à direita > 0, à esquerda < 0, centrado ~0', () => {
    const { som } = setup();
    expect(som.panFor(320, pl({ x: 0 }))).toBeGreaterThan(0);
    expect(som.panFor(0, pl({ x: 320 }))).toBeLessThan(0);
    expect(som.panFor(32, pl({ x: 32 }))).toBe(0);
  });
});

describe('platform/audio-sonar · o alvo vem do CONTRATO, não de um array de moedas', () => {
  it('[Many] escolhe o mais próximo entre os alvos DECLARADOS, e conta', () => {
    // O filtro por dono e por "já coletada" SUMIU daqui, e é essa ausência que interessa: quem decide o que
    // ainda conta é o jogo, em `targetsOf`. O sonar recebe uma lista e compara distâncias.
    const { som, said, narrated } = setup({ alvos: [{ x: 300, y: 32 }, { x: 48, y: 32 }] });
    som.sonar(pl());
    expect(som.sonarCount).toBe(1);
    expect(said[0]).toContain('à direita');
    expect(narrated.length).toBe(1);
  });

  it('[Interface] cada jogador recebe a SUA lista — o índice atravessa', () => {
    const { som, said } = setup({ targetsOf: (i) => (i === 0 ? [{ x: 300, y: 32 }] : [{ x: 8, y: 32 }]) });
    som.sonar(pl({ i: 0 }));
    som.sonar(pl({ i: 1 }));
    expect(said[0]).toContain('à direita'); // 300 está à direita de 32
    expect(said[1]).toContain('à esquerda'); // 8 está à esquerda
  });

  it('[Zero] lista de alvos VAZIA é resposta legítima: avisa e não quebra', () => {
    const { som, said } = setup({ alvos: [] });
    som.sonar(pl());
    expect(said).toEqual(['Nada por perto.']);
  });

  it('[Right] o NOME do alvo vem do jogo — a engine não diz mais "moeda" por conta própria', () => {
    // O caso que mede o campo 3. Antes o anúncio trazia `t('sr.nav.coin')` cravado; num jogo de perguntas
    // isso faria o sonar de uma criança cega falar de moedas que não existem.
    const { som, said } = setup({
      alvos: [{ x: 48, y: 32 }],
      nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
    });
    som.sonar(pl());
    expect(said[0]).toContain('pergunta');
    expect(said[0]).not.toContain('alvo'); // nem o fallback genérico: quem nomeia é o jogo
  });

  it('[Error] alvo declarado SEM nome cai numa palavra genérica, e não numa chave crua', () => {
    const { som, said } = setup({ alvos: [{ x: 48, y: 32 }], nameAt: () => null });
    som.sonar(pl());
    expect(said[0]).toContain('alvo');
    expect(said[0]).not.toContain('sr.nav');
  });
});

describe('platform/audio-sonar · a MÉTRICA é a declarada (é o que faz o sonar viajar)', () => {
  // Os três casos abaixo rodam o MESMO código sobre três topologias. É a afirmação central do item 19, e a
  // única maneira honesta de a fazer: se algum deles precisasse de um ramo próprio no módulo, o sonar não
  // seria da engine — seria da plataforma com um disfarce.

  it('[Right] contínuo: distância em UNIDADES, então 4 e 9 tiles seguem sendo os limiares de antes', () => {
    const perto = setup({ alvos: [{ x: 32 + 3 * 16, y: 32 }] });   // 3 unidades → "muito perto"
    perto.som.sonar(pl());
    const longe = setup({ alvos: [{ x: 32 + 12 * 16, y: 32 }] });  // 12 unidades → "longe"
    longe.som.sonar(pl());
    expect(perto.said[0]).not.toEqual(longe.said[0]);
    expect(perto.said[0]).toContain('bem perto');
    expect(longe.said[0]).toContain('longe');
  });

  it('[Right] grade: a distância é em CASAS, e a diagonal custa uma só', () => {
    const { som, said } = setup({ topology: GRADE, alvos: [{ x: 3, y: 3 }] });
    som.sonar(pl({ x: 2, y: 2 })); // Chebyshev: 1 casa → "muito perto"
    expect(said[0]).toContain('bem perto');
  });

  it('[Right] lista: a distância é diferença de ÍNDICE — um quiz usa o mesmo sonar', () => {
    const { som, said } = setup({
      topology: LISTA,
      alvos: [{ x: 3, y: 0 }],
      nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }),
    });
    som.sonar(pl({ x: 0, y: 0 })); // 3 de distância → "muito perto"
    expect(said[0]).toContain('pergunta');
    expect(said[0]).toContain('bem perto');
  });

  it('[Cross-check] a MESMA separação em unidades dá a MESMA frase em qualquer topologia', () => {
    // Se este caso cair, alguma topologia ganhou tratamento especial dentro do módulo — que é exatamente o
    // que o corte existe para impedir.
    const cont = setup({ alvos: [{ x: 32 + 6 * 16, y: 32 }] }); cont.som.sonar(pl());
    const grade = setup({ topology: GRADE, alvos: [{ x: 6, y: 0 }] }); grade.som.sonar(pl({ x: 0, y: 0 }));
    const lista = setup({ topology: LISTA, alvos: [{ x: 6, y: 0 }] }); lista.som.sonar(pl({ x: 0, y: 0 }));
    const dist = (t) => t.replace(/^.*?,\s*/, ''); // tira o lado, guarda a distância
    expect(dist(grade.said[0])).toBe(dist(cont.said[0]));
    expect(dist(lista.said[0])).toBe(dist(cont.said[0]));
  });
});

describe('platform/audio-sonar · updateGuide, o beacon em laço', () => {
  it('[Zero] não faz nada se a categoria guide está OFF', () => {
    const { som, tone } = setup({ audioCat: { guide: { on: false } }, players: [pl()], alvos: [{ x: 48, y: 32 }] });
    for (let i = 0; i < 60; i++) som.updateGuide();
    expect(tone.length).toBe(0);
    expect(som.guideCount).toBe(0);
  });

  it('[Interface] pinga (~0,8s) para o jogador que precisa de pistas', () => {
    const { som, tone } = setup({ players: [pl({ viz: 'cego' })], alvos: [{ x: 60, y: 32 }] });
    for (let i = 0; i < 48; i++) som.updateGuide();
    expect(som.guideCount).toBe(1);
    expect(tone.some((t) => t.cat === 'guide')).toBe(true);
  });

  it('[Zero] jogador SEM necessidade de pista não recebe beacon, mesmo com alvo perto', () => {
    const { som } = setup({ players: [pl({ viz: 'normal' })], alvos: [{ x: 40, y: 32 }] });
    for (let i = 0; i < 60; i++) som.updateGuide();
    expect(som.guideCount).toBe(0);
  });

  it('[Zero] sem alvo declarado, o beacon fica calado em vez de apontar para lugar nenhum', () => {
    const { som, tone } = setup({ players: [pl({ viz: 'cego' })], alvos: [] });
    for (let i = 0; i < 60; i++) som.updateGuide();
    expect(som.guideCount).toBe(0);
    expect(tone.length).toBe(0);
  });
});
