// SPDX-License-Identifier: AGPL-3.0-or-later
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
import { createAudioSonar, passoDoMundo, PAN_PACES } from '../app/js/platform/audio-sonar.js';

const CONTINUO = { kind: 'continuous', size: [896, 992], unit: 16, move: 'free', frame: 'clock' };
// `move: 'diagonal'` explicito: e a regra que este fixture SEMPRE assumiu, e ela deixou de ser a unica
// (ADR-0089). Sem o campo, o caso da diagonal estaria a afirmar um padrao em vez de uma declaracao.
const GRADE = { kind: 'grid', size: [20, 20], move: 'diagonal', frame: 'compass' };
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
    // «as 3 horas» e não «à direita»: o fixture declara `frame: 'clock'`, que é o referencial de uma
    // plataforma 2D vista de lado. A palavra vem do JOGO, e não de uma conta sobre `x` cru (ADR-0089).
    expect(said[0]).toContain('às 3 horas');
    expect(narrated.length).toBe(1);
  });

  it('[Interface] cada jogador recebe a SUA lista — o índice atravessa', () => {
    const { som, said } = setup({ targetsOf: (i) => (i === 0 ? [{ x: 300, y: 32 }] : [{ x: 8, y: 32 }]) });
    som.sonar(pl({ i: 0 }));
    som.sonar(pl({ i: 1 }));
    expect(said[0]).toContain('às 3 horas'); // 300 está à direita de 32 → 3 horas
    expect(said[1]).toContain('às 9 horas'); // 8 está à esquerda → 9 horas
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

// -----------------------------------------------------------------------------------------------------------
describe('a NARRAÇÃO diz o RUMO, e o rumo vem do referencial que o jogo declarou (ADR-0089)', () => {
  // O que isto substitui: `alvo.at.x < pl.x - 4 ? 'left' : alvo.at.x > pl.x + 4 ? 'right' : 'ahead'`.
  // Três palavras onde o contrato tem oito, e misturando referencial de TELA (esquerda, direita) com
  // referencial de CORPO (à frente) — quem ouve não tem como saber de qual origem cada uma fala.
  const acima = { x: 32, y: 0 }, abaixo = { x: 32, y: 64 };

  it('[Right] ⚠️ ACIMA e ABAIXO deixam de virar «à frente» — é o defeito, em uma linha', () => {
    // Com a zona morta de ±4, TUDO o que estivesse na mesma coluna virava «à frente», estivesse acima ou
    // abaixo. Era justamente a informação que mais falta a quem não vê a tela, apagada por uma conta sobre
    // `x` que não olhava para `y` nenhum.
    expect(sonarDe([acima])).toContain('às 12 horas');
    expect(sonarDe([abaixo])).toContain('às 6 horas');
  });

  it('[Interface] o MESMO alvo dá palavras diferentes conforme o referencial declarado', () => {
    // O par que prova que o campo `frame` é lido, e não que dois fixtures por acaso diferem noutra coisa.
    expect(sonarDe([acima])).toContain('às 12 horas');            // CONTINUO declara `frame: 'clock'`
    expect(sonarDe([acima], GRADE)).toContain('ao norte');        // GRADE declara `frame: 'compass'`
  });

  it('[Many] num jogo de bússola, as quatro direções saem com o nome próprio', () => {
    expect(sonarDe([{ x: 32, y: 0 }], GRADE)).toContain('ao norte');
    expect(sonarDe([{ x: 32, y: 64 }], GRADE)).toContain('ao sul');
    expect(sonarDe([{ x: 64, y: 32 }], GRADE)).toContain('a leste');
    expect(sonarDe([{ x: 0, y: 32 }], GRADE)).toContain('a oeste');
  });

  it('[Zero] alvo no MESMO lugar não ganha direção inventada', () => {
    expect(sonarDe([{ x: 32, y: 32 }])).toContain('aqui mesmo');
  });

  it('[Boundary] ⚠️ a hora 1 tem forma PRÓPRIA — «às 1 horas» não é português', () => {
    // Uma chave com `{h}` cobre onze das doze horas, e é por isso que a décima segunda passa despercebida:
    // o caso só existe se alguém escolher um alvo a ~30° do topo. Sem ele, a mutação que apaga o singular
    // fica verde — e o leitor de tela passa a ler uma frase agramatical a cada sonar da hora 1.
    const frase = sonarDe([{ x: 37, y: 23 }]); // ~30° no sentido horário a partir do topo
    expect(frase).toContain('à 1 hora');
    expect(frase).not.toContain('às 1 horas');
  });

  /** Dispara o sonar uma vez e devolve a frase dita. */
  function sonarDe(alvos, topology) {
    const { som, said } = setup(topology ? { alvos, topology } : { alvos });
    som.sonar(pl());
    return said[0];
  }
});

// ==========================================================================================================
// ⚠️ A LARGURA DO ESTEREO E MEDIDA NA REGUA DO MUNDO, NAO NA DA TELA (#121)
//
// O pan dividia por `LOGICAL_W * 0.55` = 320 x 0,55 = **176 pixels de ECRA**, e o que ele divide (`wx - pl.x`)
// vem da TOPOLOGIA. As duas reguas so coincidem quando o mundo tambem e medido em pixels.
//
// Medido ao construir o `game-soccer`: num campo de 90 METROS, um colega dez metros a direita da
// `10 / 176 = 0,057` — mono, na pratica. O sonar ficaria **certo e inaudivel**, a mesma classe de defeito que
// o quiz registou como «certo e inutil». Para a plataforma era verdade por acaso, e para `grid`/`hotspots`
// era vacuo — e e por isso que ninguem viu.
//
// ⚠️ ONZE NAO E NUMERO NOVO: 176 px / `unit: TILE` = 16 sao exatamente 11 tiles. O primeiro caso abaixo
// afirma que a crianca da plataforma continua a ouvir EXATAMENTE o que ouvia.
//
// MUTACOES CONFERIDAS (no fim do bloco).
// ==========================================================================================================
describe('platform/audio-sonar — o pan na regua declarada (#121)', () => {
  const CAMPO = { kind: 'continuous', size: [90, 60], unit: 1, move: 'free', frame: 'compass' };

  it('⚠️ [Right] a plataforma ouve EXATAMENTE o que ouvia — 11 passos de 16 sao os 176 px de antes', () => {
    const { som } = setup(); // CONTINUO, unit: 16
    expect(som.panFor(0 + 176, pl({ x: 0 })), 'a saturacao mudou de sitio').toBe(1);
    expect(som.panFor(0 + 88, pl({ x: 0 })), 'meia largura deixou de ser meio pan').toBeCloseTo(0.5, 6);
    expect(som.panFor(0 - 176, pl({ x: 0 }))).toBe(-1);
  });

  it('⚠️ [Right] no campo de metros dez metros a direita JA SE OUVEM', () => {
    // O numero da issue: com o denominador de ecra dava 0,057. Com 11 passos de 1 metro da 0,909.
    const { som } = setup({ topology: CAMPO });
    const pan = som.panFor(10, pl({ x: 0, y: 0 }));
    expect(pan).toBeCloseTo(10 / 11, 6);
    expect(pan, 'continua praticamente mono').toBeGreaterThan(0.5);
  });

  it('⚠️ [Cross-check] e a formula ANTIGA dava mesmo 0,057 — o defeito, em aritmetica', () => {
    // Sem isto, o caso de cima podia estar verde por o numero da issue estar errado, e eu nao saberia.
    expect(10 / (320 * 0.55)).toBeCloseTo(0.057, 3);
  });

  it('[Right] na grade um passo e uma celula', () => {
    const { som } = setup({ topology: GRADE });
    expect(som.panFor(11, pl({ x: 0, y: 0 }))).toBe(1);
    expect(som.panFor(5.5, pl({ x: 0, y: 0 }))).toBeCloseTo(0.5, 6);
  });

  it('⚠️ [Zero] `hotspots` nao tem lado — o pan e ZERO, e nao um numero calculado sobre indices', () => {
    // Uma lista e uma ORDEM, nao uma geometria. O `bearing` do contrato ja responde `none` pelo mesmo motivo;
    // apontar para a direita numa lista de perguntas e apontar para nada.
    const { som } = setup({ topology: LISTA });
    expect(som.panFor(3, pl({ x: 0, y: 0 }))).toBe(0);
    expect(som.panFor(-3, pl({ x: 0, y: 0 }))).toBe(0);
  });

  it('[Boundary] o pan continua preso entre -1 e 1 em qualquer topologia', () => {
    for (const topology of [CONTINUO, GRADE, CAMPO]) {
      const { som } = setup({ topology });
      expect(som.panFor(1e9, pl({ x: 0, y: 0 }))).toBe(1);
      expect(som.panFor(-1e9, pl({ x: 0, y: 0 }))).toBe(-1);
    }
  });

  it('⚠️ [Interface] `passoDoMundo` responde pelas tres topologias, e a lista responde ZERO', () => {
    expect(passoDoMundo(CONTINUO)).toBe(16);
    expect(passoDoMundo(CAMPO)).toBe(1);
    expect(passoDoMundo(GRADE)).toBe(1);
    expect(passoDoMundo(LISTA)).toBe(0);
    expect(PAN_PACES, '11 e a releitura de 176/16; mudar isto muda o que a crianca ja ouve').toBe(11);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · repondo `(ctx.LOGICAL_W * 0.55)` como denominador → reprovam DOIS: "[Right] no campo de metros" com
//     **0,0568** — o numero exato que a auditoria mediu — e "[Right] na grade um passo e uma celula". E a
//     #121 reproduzida, e o `[Cross-check]` ao lado confirma que o numero da issue estava certo.
//   · trocando `PAN_PACES` de 11 para 12 → reprovam QUATRO, incluindo "[Right] a plataforma ouve EXATAMENTE
//     o que ouvia". E o que impede o conserto de mexer, de passagem, no que ja funcionava para uma crianca.
//   · fazendo `passoDoMundo` devolver 1 para `hotspots` → reprovam DOIS: "[Zero] `hotspots` nao tem lado" e o
//     "[Interface]". Um pan calculado sobre indices de lista aponta para um lado que nao existe.
//   · tirando o `Math.max(-1, Math.min(1, ...))` → "[Boundary] o pan continua preso" reprova nas tres.
