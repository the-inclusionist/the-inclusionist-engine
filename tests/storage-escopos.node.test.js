// SPDX-License-Identifier: AGPL-3.0-or-later
// OS DOIS ESCOPOS DE PERSISTÊNCIA (project node: só lê a tabela de chaves, sem localStorage).
//
// O namespacing óbvio — um prefixo por jogo em TUDO — seria um defeito de acessibilidade grave, e é isso que
// estes casos guardam. Uma criança cega configura modo cego, bengala, voz e velocidade de narração; uma
// criança daltônica escolhe a correção; uma disléxica escolhe a fonte. Com um espaço de nomes por jogo, ela
// refaria tudo isso nos 35 jogos do catálogo — e quem mais depende dos ajustes é quem menos tem margem para
// refazê-los.
//
// A linha entre os escopos não é técnica, é de PERTENCIMENTO: o que é da CRIANÇA fica compartilhado, o que é
// da PARTIDA fica no jogo. Se alguém um dia "padronizar" prefixando tudo, estes casos reprovam.
import { describe, it, expect } from 'vitest';
import * as store from '../app/js/platform/storage.js';
import { KEYS, kJogo } from '../app/js/platform/storage.js';

/** O id do jogo de plataforma. Aqui ele é DADO DE TESTE, não verdade da engine: a engine deixou de o ter
 *  (ADR-0080), e o que estes casos guardam é que ele continua a produzir exatamente as chaves antigas. */
const PLATAFORMA = 'inclusionist';

/** Tudo que é do escopo DO JOGO. Curto de propósito: na dúvida, a chave é da criança. */
const DO_JOGO = ['activity', 'quizlevel', 'cenario', 'tabsel', 'fracnot'];

/** O que pertence à CRIANÇA e segue com ela de jogo em jogo. Amostra representativa, não a lista inteira. */
const DA_CRIANCA = [
  'modocego', 'caneDiv', 'onebtn', 'wheelchair', 'hearingloss',   // acessibilidade motora/auditiva
  'viz', 'cbsafe', 'outfg', 'outbg', 'lq',                        // visão
  'ttsEngine', 'ttsVoice', 'lang',                                // voz e idioma
  'letterCase', 'captions', 'fontKey',                            // comunicação e leitura
  'padDesign', 'touchmap', 'padBtnMm',                            // controles e toque
];

describe('escopo DO JOGO — o que é de uma partida', () => {
  it('[Right] é uma FUNÇÃO do id, e o nome sai na forma `incl.<jogo>.<nome>`', () => {
    for (const k of DO_JOGO) expect(KEYS[k]('xis'), k).toBe('incl.xis.' + k);
  });

  it('[Right] ⚠️ dois jogos no mesmo perfil têm chaves DISJUNTAS — é o defeito da #108 em uma linha', () => {
    // Era este o estrago: `JOGO_ID` constante na engine, então o quiz e a plataforma escreviam os dois em
    // `incl.inclusionist.activity`. O segundo jogo aberto apagava o progresso do primeiro, sem erro nenhum.
    // O segundo id é NEUTRO de propósito: a propriedade é «dois jogos quaisquer não colidem», e nomear um
    // jogo concreto aqui acoplaria um fixture de engine ao catálogo — que é o que o `engine-boundary` guarda.
    const daPlataforma = DO_JOGO.map((k) => KEYS[k](PLATAFORMA)).concat(KEYS.attract(PLATAFORMA, 'campo'));
    const doOutro = DO_JOGO.map((k) => KEYS[k]('jogo-b')).concat(KEYS.attract('jogo-b', 'campo'));
    expect(daPlataforma.filter((n) => doOutro.includes(n)), 'chave partilhada entre dois jogos').toEqual([]);
  });

  it('[Right] e a plataforma continua a resolver as chaves QUE JÁ EXISTEM no aparelho da criança', () => {
    // O outro lado da mesma moeda: parametrizar o prefixo não pode renomear nada para quem já jogava. Os
    // nomes abaixo são verbatim os que a versão anterior produzia com `JOGO_ID` fixo.
    expect(KEYS.activity(PLATAFORMA)).toBe('incl.inclusionist.activity');
    expect(KEYS.quizlevel(PLATAFORMA)).toBe('incl.inclusionist.quizlevel');
    expect(KEYS.cenario(PLATAFORMA)).toBe('incl.inclusionist.cenario');
    expect(KEYS.tabsel(PLATAFORMA)).toBe('incl.inclusionist.tabsel');
    expect(KEYS.fracnot(PLATAFORMA)).toBe('incl.inclusionist.fracnot');
    expect(KEYS.attract(PLATAFORMA, 'campo')).toBe('incl.inclusionist.attract_campo');
  });

  it('[Right] cada uma guarda o nome LEGADO — é como o ajuste de quem já jogava sobrevive', () => {
    // Sem isto a renomeação seria uma perda silenciosa: a criança abriria o jogo e encontraria o nível 2 de
    // fábrica no lugar do 5 que ela tinha alcançado, sem nada explicando.
    for (const k of DO_JOGO) {
      expect(KEYS[k + 'Legado'], k).toBeTruthy();
      expect(KEYS[k + 'Legado'], k).toMatch(/^incl_/);
    }
  });

  it('[Interface] a gravação da demonstração também é do jogo, e também herda', () => {
    expect(KEYS.attract('xis', 'campo')).toBe(kJogo('xis', 'attract_campo'));
    expect(KEYS.attractLegado('campo')).toBe('incl_attract_campo'); // a legada NÃO leva id: é anterior ao escopo
  });
});

describe('escopo COMPARTILHADO — o que é da criança', () => {
  it('[Right] NENHUM ajuste de acessibilidade leva prefixo de jogo', () => {
    // É o caso central deste arquivo. Se ele reprovar, alguém prefixou uma preferência da criança — e o
    // efeito, num catálogo de 35 jogos, é obrigá-la a reconfigurar tudo 35 vezes.
    const prefixadas = DA_CRIANCA.filter((k) => String(KEYS[k]).startsWith('incl.'));
    expect(prefixadas, 'preferência da criança com prefixo de jogo').toEqual([]);
  });

  it('[Right] e todas continuam no formato antigo, que é o que as mantém compartilhadas', () => {
    for (const k of DA_CRIANCA) expect(KEYS[k], k).toMatch(/^incl_/);
  });

  it('[Boundary] as chaves POR JOGADOR são da criança também — a tela 2 é uma criança, não um jogo', () => {
    for (const f of ['vizP', 'sinkP', 'easyP', 'rmWalkP']) {
      expect(KEYS[f](1), f).toMatch(/^incl_/);
      expect(KEYS[f](1), f).not.toMatch(/^incl\./);
    }
  });
});

describe('os dois escopos não se confundem', () => {
  it('[Zero] nenhuma chave está nas duas listas', () => {
    expect(DO_JOGO.filter((k) => DA_CRIANCA.includes(k))).toEqual([]);
  });

  it('[Interface] o id entra pelo argumento, e é ele que aparece no prefixo', () => {
    expect(kJogo('inclusionist', 'x')).toBe('incl.inclusionist.x');
    expect(kJogo('15puzzle', 'x')).toBe('incl.15puzzle.x');
  });

  it('[Zero] ⚠️ a ENGINE não guarda id de jogo nenhum — era o achado 1 do ADR-0080', () => {
    // `JOGO_ID = "inclusionist"` morava aqui. O teste do ADR-0080 é uma pergunta — *um segundo jogo quereria
    // um valor diferente?* — e este campo respondia sim de forma cara: colisão silenciosa de progresso.
    expect(store.JOGO_ID, 'a engine voltou a guardar o id de um jogo').toBeUndefined();
  });

  it('[Zero] ⚠️ e a distinção dos dois escopos vive na FORMA, não só no comentário', () => {
    // Chave da criança é STRING (não tem onde receber um id); chave da partida é FUNÇÃO (sem o id não
    // compila). É o que impede tanto prefixar por engano uma preferência quanto esquecer de escopar uma
    // chave de partida — os dois enganos que o comentário sozinho não conseguia impedir.
    for (const k of DA_CRIANCA) expect(typeof KEYS[k], k).toBe('string');
    for (const k of DO_JOGO) expect(typeof KEYS[k], k).toBe('function');
  });
});
