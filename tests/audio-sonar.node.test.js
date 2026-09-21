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
import {
  createAudioSonar, passoDoMundo, PAN_PACES, GUIA_TIPO, GUIA_VOL, QUADROS_ENTRE_ROTAS,
} from '../app/js/platform/audio-sonar.js';
import { CORTE_LONGE, CORTE_PERTO } from '../app/js/platform/guide-intensity.js';
import { routeTo } from '../app/js/core/route.js';
import { distance } from '../app/js/core/contract.js';

// ========================= O CONTEXTO DE ÁUDIO FALSO =========================
// ⚠️ ELE PRECISOU DE EXISTIR, e o motivo é a mudança inteira do #84 item 2. Enquanto o guia era um BIPE, ele
// saía pelo `tonePan` injectado e o fixture só precisava de um array — o `getAudioCtx: () => ({})` acima
// bastava, porque ninguém lhe chamava método nenhum. Uma presença CONTÍNUA é um GRAFO que fica, e um grafo
// não passa por `tonePan`: é `createOscillator` + `createBiquadFilter` + `createGain`, e são esses nós que os
// casos abaixo interrogam.
//
// ⚠️ E É POR ISSO QUE OS QUATRO CASOS ANTIGOS DESTE BLOCO FORAM REESCRITOS, e não ajustados: três deles
// afirmavam pelo `tone` (`tonePan`) — e com o guia fora do `tonePan` eles passariam para sempre, a verde,
// sem tocar no código que dizem cobrir. Um teste que lê pela ligação não falha quando a ligação muda.
function param() {
  return { value: 0, alvos: [], setTargetAtTime(v) { this.value = v; this.alvos.push(v); } };
}

function fakeAC() {
  const osciladores = [], filtros = [], ganhos = [], panners = [], destinos = [];
  const liga = (self) => (n) => { destinos.push({ de: self, para: n }); return n; };
  const ac = {
    currentTime: 0,
    destination: { _nome: 'destination', connect() {} },
    createOscillator() {
      const o = { _nome: 'osc', type: '', frequency: param(), inicios: 0, parouEm: null, start() { o.inicios++; }, stop(t) { o.parouEm = t; } };
      o.connect = liga(o); osciladores.push(o); return o;
    },
    createBiquadFilter() { const f = { _nome: 'filtro', type: '', frequency: param(), Q: param() }; f.connect = liga(f); filtros.push(f); return f; },
    createGain() { const g = { _nome: 'ganho', gain: param() }; g.connect = liga(g); ganhos.push(g); return g; },
    createStereoPanner() { const p = { _nome: 'panner', pan: param() }; p.connect = liga(p); panners.push(p); return p; },
  };
  return { ac, osciladores, filtros, ganhos, panners, destinos };
}

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
    // ⚠️ A TABELA DE MODOS SAIU DAQUI (#104), e o fixture melhorou com a saída. Ela declarava
    // `{ normal, cego, baixa }` — três chaves que NÃO EXISTEM no catálogo real (`normal`, `blind`,
    // `lv-*`) — e o módulo atravessava-a com `pl.viz`. Ou seja: o teste inventava um vocabulário para o
    // módulo consultar, e passava por isso. Agora o ctx responde a PERGUNTA, e o fixture diz em português
    // quais jogadores têm a visão comprometida, que é o que os casos sempre quiseram dizer.
    visaoComprometida: (pl) => (over.visaoComprometida ? over.visaoComprometida(pl) : !!pl.vePouco),
    getModoCego: () => over.blindMode || false,
    LOGICAL_W: 320,
    getPlayers: () => over.players || [],
    getNumPlayers: () => over.numPlayers || 1,
    getAudioCtx: () => (over.audioCtx === undefined ? {} : over.audioCtx),
    getSoundOn: () => (over.soundOn === undefined ? true : over.soundOn),
    getAudioCat: () => (over.audioCat === undefined ? { guide: { on: true } } : over.audioCat),
    // Os quatro do guia. `roleAt` OMITIDO por omissão: o fixture antigo não o tinha, e o módulo tem de
    // continuar a funcionar sem ele — é a promessa de compatibilidade que o campo opcional faz.
    roleAt: over.roleAt,
    catNode: over.catNode, audioOut: over.audioOut, getVolume: over.getVolume,
  };
  return { som: createAudioSonar(ctx), tone, said, narrated };
}

/** Um setup com contexto de áudio de verdade (o falso) — tudo o que interroga o GRAFO passa por aqui. */
function setupGuia(over = {}) {
  const f = fakeAC();
  return { ...setup({ audioCtx: f.ac, ...over }), ...f };
}

/** Roda `n` quadros, avançando o relógio como um motor real avançaria. */
function quadros(som, f, n) {
  for (let i = 0; i < n; i++) { f.ac.currentTime += 1 / 60; som.updateGuide(); }
}

const pl = (o = {}) => ({ x: 32, y: 32, vePouco: true, i: 0, ...o });

describe('platform/audio-sonar · o que não depende de gênero', () => {
  it('[Boundary] needsAudioCues: o modo cego LIGA para toda a gente; fora dele, quem vê pouco recebe', () => {
    // ⚠️ A REGRA QUE FICOU NESTE MÓDULO É A PRIMEIRA, e é a única que é mesmo dele: o modo cego vence a
    // visão declarada, porque ele é uma escolha de quem está a jogar e não uma medida do que ela enxerga.
    expect(setup({ blindMode: true }).som.needsAudioCues(pl({ vePouco: false }))).toBe(true);
    expect(setup().som.needsAudioCues(pl({ vePouco: true }))).toBe(true);
    expect(setup().som.needsAudioCues(pl({ vePouco: false }))).toBe(false);
    // E a metade visual é INJECTADA: o módulo não a calcula, e um ctx que responda outra coisa manda.
    expect(setup({ visaoComprometida: () => true }).som.needsAudioCues(pl({ vePouco: false }))).toBe(true);
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

describe('platform/audio-sonar · updateGuide, a PRESENÇA CONTÍNUA (#84 item 2)', () => {
  it('⚠️ [Right] O BIPE MORREU: um oscilador SÓ, que começa uma vez e nunca para sozinho', () => {
    // ESTE É O CASO QUE DEFINE A MUDANÇA. O guia antigo criava um `triangle` de 0,12 s a cada 48 quadros e
    // deitava-o fora; em 120 quadros havia DOIS osciladores, e cada um deles era um disparo. O veredicto do
    // Dev sobre isso: «um ping é a pior escolha possível, tenebroso para quem tem TEA». Se alguém voltar a
    // criar um oscilador por evento, esta contagem passa de 1 e o caso cai.
    const g = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 60, y: 32 }] });
    quadros(g.som, g, 120);
    expect(g.osciladores.length, 'nasceu mais de um oscilador — isto voltou a disparar').toBe(1);
    expect(g.osciladores[0].inicios).toBe(1);
    expect(g.osciladores[0].parouEm, 'o guia parou sozinho: virou um som com fim, que é um bipe').toBe(null);
    expect(g.som.guideCount).toBe(120); // conta QUADROS que soam, não bipes
  });

  it('⚠️ [Right] o timbre tem HARMÓNICOS e o filtro é passa-baixo — sem isso o eixo do brilho não existe', () => {
    // Um passa-baixo sobre uma `sine` não corta nada: não há harmónicos acima da fundamental. O guia ficaria
    // com o eixo principal morto e só o volume a trabalhar, sem que nada falhasse. E a `sawtooth` é também o
    // que o separa do sonar e da bengala, que são `sine`.
    const g = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 60, y: 32 }] });
    quadros(g.som, g, QUADROS_ENTRE_ROTAS);
    expect(g.osciladores[0].type).toBe(GUIA_TIPO);
    expect(GUIA_TIPO, 'uma senoide não tem o que filtrar').not.toBe('sine');
    expect(g.filtros[0].type).toBe('lowpass');
  });

  it('⚠️ [Right] aproximar-se ABRE o filtro; afastar-se fecha-o, e nenhum dos dois cala', () => {
    const perto = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 32 + 16, y: 32 }] });      // 1 passo
    const longe = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 32 + 20 * 16, y: 32 }] }); // 20 passos
    quadros(perto.som, perto, QUADROS_ENTRE_ROTAS + 2);
    quadros(longe.som, longe, QUADROS_ENTRE_ROTAS + 2);
    expect(perto.filtros[0].frequency.value).toBeGreaterThan(longe.filtros[0].frequency.value);
    expect(perto.ganhos[0].gain.value).toBeGreaterThan(longe.ganhos[0].gain.value);
    // ⚠️ E longe NÃO É SILÊNCIO. Se fosse, «longe» ficaria indistinguível de «não há alvo».
    expect(longe.ganhos[0].gain.value, 'o guia calou ao longe').toBeGreaterThan(0);
    expect(longe.filtros[0].frequency.value).toBeGreaterThanOrEqual(CORTE_LONGE);
    expect(perto.filtros[0].frequency.value).toBeLessThanOrEqual(CORTE_PERTO);
  });

  it('[Zero] categoria `guide` desligada: nenhum grafo nasce', () => {
    const g = setupGuia({ audioCat: { guide: { on: false } }, players: [pl()], alvos: [{ x: 48, y: 32 }] });
    quadros(g.som, g, 60);
    expect(g.osciladores.length).toBe(0);
    expect(g.som.guideCount).toBe(0);
  });

  it('[Zero] jogador que enxerga não ganha guia, mesmo com alvo ao lado', () => {
    const g = setupGuia({ players: [pl({ vePouco: false })], alvos: [{ x: 40, y: 32 }] });
    quadros(g.som, g, 60);
    expect(g.osciladores.length).toBe(0);
    expect(g.som.guideCount).toBe(0);
  });

  it('⚠️ [Zero] SEM ALVO o guia nem chega a acender — e nasceu vermelho a acender 60× por segundo', () => {
    // Silêncio é a ÚNICA afirmação que o guia pode fazer, e ela quer dizer «não há alvo» (o `VOL_LONGE` do
    // `guide-intensity` existe para que «longe» nunca a faça). Mas a primeira escrita disto acendia o grafo
    // e só depois perguntava pelo alvo: sessenta osciladores criados e destruídos por segundo, inaudíveis e
    // caros. É o custo novo da PERMANÊNCIA — o bipe não podia ter este defeito porque nada nele durava.
    const g = setupGuia({ players: [pl({ vePouco: true })], alvos: [] });
    quadros(g.som, g, 60);
    expect(g.osciladores.length, 'acendeu um grafo para não ter nada a apontar').toBe(0);
    expect(g.som.guideCount).toBe(0);
  });

  it('⚠️ [Interface] o alvo DESAPARECER a meio apaga o grafo — apanhar a última moeda cala o guia', () => {
    // O caminho de derrubada que o caso acima não exercita: aqui o guia chega a soar, e é a perda do alvo
    // (não a categoria, não o modo visual) que o desliga.
    let alvos = [{ x: 60, y: 32 }];
    const g = setupGuia({ players: [pl({ vePouco: true })], targetsOf: () => alvos });
    quadros(g.som, g, QUADROS_ENTRE_ROTAS + 2);
    expect(g.osciladores.length).toBe(1);
    expect(g.osciladores[0].parouEm).toBe(null);
    alvos = [];
    quadros(g.som, g, QUADROS_ENTRE_ROTAS + 1);
    expect(g.osciladores[0].parouEm, 'o alvo sumiu e o guia continuou a apontar para ele').not.toBe(null);
    expect(g.osciladores.length, 'apagou e acendeu outro — o laço voltou a girar').toBe(1);
  });

  it('⚠️ [Interface] desligar a categoria a MEIO apaga o grafo — um som que fica é um som que vaza', () => {
    // Enquanto o guia era um bipe, «desligar» era não disparar o próximo e o problema não existia. Um
    // oscilador permanente que ninguém pára continua a tocar com o cursor no zero.
    const cat = { guide: { on: true } };
    const g = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 60, y: 32 }], audioCat: cat });
    quadros(g.som, g, 30);
    expect(g.osciladores[0].parouEm).toBe(null);
    cat.guide.on = false;
    quadros(g.som, g, 2);
    expect(g.osciladores[0].parouEm, 'a categoria desligou e o oscilador continuou vivo').not.toBe(null);
  });

  it('[Interface] o volume MESTRE multiplica o guia, e não o desliga do grafo', () => {
    const g = setupGuia({ players: [pl({ vePouco: true })], alvos: [{ x: 48, y: 32 }], getVolume: () => 0 });
    quadros(g.som, g, QUADROS_ENTRE_ROTAS + 2);
    expect(g.ganhos[0].gain.value).toBe(0);
    expect(g.osciladores[0].parouEm, 'baixar o volume matou o grafo em vez de o silenciar').toBe(null);
  });

  it('[Simple] o ganho de base é MAIS BAIXO do que o do bipe que substitui', () => {
    // Um som que nunca para é percebido como mais alto do que um transiente do mesmo pico. O bipe usava 0,11.
    expect(GUIA_VOL).toBeLessThan(0.11);
    expect(GUIA_VOL, 'o piso de volume não pode ser zero').toBeGreaterThan(0);
  });
});

// ========================= MUTACOES CONFERIDAS (a fiacao do guia) =========================
// Aplicadas por script ao ficheiro, com contagem de ocorrencias, uma de cada vez.
//   · `let g = pl._guia` → `let g = null` (o grafo deixa de sobreviver ao quadro) → reprovam TRES: "O BIPE
//     MORREU" (60 osciladores em vez de 1) e os dois casos de derrubada, que passam a olhar para o oscilador
//     errado. E a mutacao produz literalmente o defeito que este item existe para tirar, sessenta vezes pior.
//   · `GUIA_TIPO` de `sawtooth` para `sine` → reprova "o timbre tem HARMONICOS". O guia continuaria a soar e
//     o filtro continuaria a mover-se; o que morreria em silencio e o EIXO PRINCIPAL, porque uma senoide nao
//     tem harmonicos para um passa-baixo cortar.
//   · tirando o `desligarGuia(pl)` da guarda de cima → reprova "desligar a categoria a MEIO". O oscilador
//     fica vivo com o cursor no zero — um som que dura e um som que vaza.
//   · `if (roleAt)` → `if (roleAt && false)` (tudo cai na reta) → reprova "a distancia e a que a crianca
//     ANDA". O guia voltaria a dizer «quase la» de um alvo atras de uma parede.
//   · `GUIA_VOL * i.volume * vol` → `GUIA_VOL * i.volume` → reprova "o volume MESTRE multiplica". O guia
//     ignoraria o cursor de volume do jogo, e so esse.
//   · tirando o `if (!alvoMaisProximo(pl)) continue` de antes de acender → reprovam DOIS: "SEM ALVO o guia
//     nem chega a acender" e o caso do alvo que desaparece. E o defeito que esta bateria apanhou por si: a
//     primeira escrita acendia e apagava um grafo por quadro.

describe('platform/audio-sonar · a rota, quando o jogo a permite (#84 item 2)', () => {
  // Uma grade 20×20 com uma PAREDE vertical em x = 5, aberta só em y = 19. O alvo fica logo do outro lado:
  // em reta são 2 casas; a pé são muitas, porque é preciso descer, contornar e voltar.
  const PAREDE = (at) => (at.x === 5 && at.y !== 19 ? 'solid' : 'free');
  const GRADE_ORTO = { kind: 'grid', size: [20, 20], move: 'orthogonal', frame: 'compass' };

  it('⚠️ [Right] com `roleAt`, a distância é a que a criança ANDA — não a reta que atravessa a parede', () => {
    const comRota = setupGuia({
      topology: GRADE_ORTO, roleAt: PAREDE,
      players: [pl({ x: 4, y: 0, vePouco: true })], alvos: [{ x: 6, y: 0 }],
    });
    const semRota = setupGuia({ // MESMO cenário, sem o campo 2 injectado
      topology: GRADE_ORTO,
      players: [pl({ x: 4, y: 0, vePouco: true })], alvos: [{ x: 6, y: 0 }],
    });
    quadros(comRota.som, comRota, QUADROS_ENTRE_ROTAS + 2);
    quadros(semRota.som, semRota, QUADROS_ENTRE_ROTAS + 2);
    // A reta diz «2 casas» e abre o filtro quase todo; a rota sabe da parede e mantém-no fechado.
    expect(
      comRota.filtros[0].frequency.value,
      'a rota não foi usada: o guia diz «quase lá» de um alvo atrás de uma parede',
    ).toBeLessThan(semRota.filtros[0].frequency.value);
  });

  it('⚠️ [Interface] as DUAS distâncias já estão na mesma unidade: passos', () => {
    // É a asserção que impede a conversão a mais. `distance()` divide pela `unit` no ramo contínuo, e
    // `routeTo().passos` conta passos por definição — dividir outra vez pelo passo do mundo poria o guia no
    // brilho máximo para sempre num jogo com `unit = 16`. É o defeito que a #121 tirou do `panFor`.
    const semParede = { topology: GRADE_ORTO, roleAt: () => 'free' };
    const rota = routeTo({ ...semParede, topology: GRADE_ORTO }, { x: 0, y: 0 }, [{ x: 7, y: 0 }]);
    expect(rota.passos).toBe(distance(GRADE_ORTO, { x: 0, y: 0 }, { x: 7, y: 0 }));
    // E com parede a rota é ESTRITAMENTE maior — nunca menor do que a reta, em nenhum caso.
    const desvio = routeTo({ topology: GRADE_ORTO, roleAt: PAREDE }, { x: 4, y: 0 }, [{ x: 6, y: 0 }]);
    expect(desvio.passos).toBeGreaterThan(distance(GRADE_ORTO, { x: 4, y: 0 }, { x: 6, y: 0 }));
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
