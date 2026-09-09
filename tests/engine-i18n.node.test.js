// SPDX-License-Identifier: AGPL-3.0-or-later
// O BURACO DO GATE DE i18n: `tests/main-i18n.node.test.js` vigia UM arquivo, e o problema não mora só nele.
//
// ========================= DOIS ACHADOS NO MESMO DIA =========================
// O item 19 moveu coisas através da fronteira, e duas vezes o que veio junto foi português cru:
//
//   · `ui/pause-icons` montava o rótulo do botão de nível: `'📚 Nível ' + level + ' · ' + qlName[level]`.
//   · `platform/audio` guardava as legendas dos earcons: '🔊 Coletou', '🔊 Ai! Dano', '🔊 Portão abriu'.
//
// As nove legendas são o que a criança SURDA lê no lugar do som. Num build em inglês ela lia português — e
// era exatamente a informação que a legenda existe para dar.
//
// Nenhum dos dois seria achado procurando bug de tradução: os dois moram onde a varredura não ia. O gate do
// item 14 lê `app/js/main.js` e para ali, e o item 14 declarou-se pronto com esse escopo — corretamente para
// o que ele prometia, e insuficiente para o que o pilar 3 promete.
//
// ========================= POR QUE O CRIVO É MAIS ESTREITO QUE O DO main.js =========================
// A varredura crua sobre as sete camadas de engine devolve 428 candidatos, e a maioria é RUÍDO: 'KeyA',
// 'ControlLeft', 'Atkinson Hyperlegible', 'CC BY-SA', 'select[data-slot]'. Uma lista de dívida com 428 linhas
// de ruído não é gate: é um arquivo que ninguém lê, e um gate que ninguém lê é pior que gate nenhum, porque
// ocupa o lugar de um que funcionaria.
//
// Este acrescenta um filtro de PRECISÃO ao crivo do item 14: o literal tem de parecer PROSA EM PORTUGUÊS —
// acento/cedilha, ou uma palavra funcional de pt-BR isolada. Nome de tecla, de fonte e de licença passam
// batido; frase não passa. Dos 428, sobram 75 em 19 módulos, e essas 75 são texto de verdade.
//
// O QUE ELE NÃO PEGA, dito para ninguém confiar demais: texto sem acento e sem palavra funcional — 'Coletou'
// sozinha teria escapado. É o preço da precisão, e a escolha é deliberada: um crivo largo aqui produziria a
// lista de 428 que ninguém manteria. Quando as 75 saírem, dá para apertar.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ_REPO = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const RAIZ = join(RAIZ_REPO, 'app', 'js');
const CR = String.fromCharCode(13);

/**
 * ⚠️ A LISTA DE CAMADAS ERA COPIADA À MÃO, E JÁ TINHA DIVERGIDO NOS DOIS SENTIDOS. Ela dizia
 * `['core','input','render','platform','ui','audio','boot']`, e medido em 2026-09-07:
 *
 *   · **`audio` não existe** — nunca houve `app/js/audio/`; os módulos de áudio vivem em `platform/`. O
 *     `if (!existsSync)` engolia-o em silêncio, e quem lesse a lista acreditava numa camada fantasma.
 *   · **`educational` e `i18n` são PUBLICADAS e não eram varridas** — sem uma linha a dizer porquê.
 *
 * O `tests/engine-package.node.test.js` já avisava contra exatamente isto, sobre si mesmo: «copiar seria a
 * divergência clássica: alguém acrescenta uma camada ao pacote, o gate segue vigiando as antigas, e o módulo
 * novo viaja sem ninguém olhar». Este ficheiro fazia a cópia contra a qual aquele avisa.
 *
 * Agora a lista SAI DO `tsconfig.pkg.json` — quem decide o que é engine publicada é quem a publica.
 *
 * ⚠️ E A CAMADA NOVA ENTRA POR OMISSÃO, que é melhor do que obrigar a classificá-la. `CAMADAS` é o publicado
 * MENOS o isento, então quem acrescentar uma camada ao pacote não precisa de se lembrar deste ficheiro: ela
 * nasce vigiada, e se trouxer prosa o caso da dívida reprova nomeando o módulo. Medido com uma camada
 * `inventada` de uma linha — sem prosa passa (vigiada, não suspeita), com prosa reprova.
 *
 * Ficar de FORA é que exige acto deliberado: entrar em `CAMADAS_ISENTAS`, com motivo escrito.
 */
function camadasPublicadas() {
  const bruto = readFileSync(join(RAIZ_REPO, 'tsconfig.pkg.json'), 'utf8').split(CR).join('');
  const cfg = JSON.parse(bruto);
  return (cfg.include ?? [])
    .map((p) => p.split('\\').join('/'))
    .filter((p) => p.startsWith('app/js/'))
    .map((p) => p.slice('app/js/'.length))
    .filter((c) => c && !c.includes('/'))
    .sort();
}

/**
 * As camadas publicadas que este crivo NÃO varre, cada uma com o motivo. Isenção sem motivo é afrouxamento
 * disfarçado; isenção sem lista é um buraco que ninguém vê.
 */
const CAMADAS_ISENTAS = new Map([
  ['i18n', 'são os DICIONÁRIOS: medir texto neles seria proibir o produto de ter palavras'],
  ['educational', 'ADR-0032 + pilar 3: currículo é REESCRITO por idioma, não traduzido — o pt-BR daqui não '
    + 'entra nos dicionários de propósito, e são 26 literais que estão certos onde estão'],
]);

const CAMADAS = camadasPublicadas().filter((c) => !CAMADAS_ISENTAS.has(c));

const MODULOS = CAMADAS.flatMap((c) => {
  const dir = join(RAIZ, c);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${c}/${f}`);
});
const fonte = (m) => readFileSync(join(RAIZ, ...m.split('/')), 'utf8').split(CR).join('');

/** Linhas de CÓDIGO: sem comentário. Prosa em comentário não vai para tela nenhuma. */
function linhasDeCodigo(texto) {
  const out = [];
  let bloco = false;
  texto.split('\n').forEach((ln, i) => {
    const t = ln.trim();
    if (bloco) { if (t.includes('*/')) bloco = false; return; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) bloco = true; return; }
    if (t.startsWith('//') || t.startsWith('*')) return;
    out.push([i + 1, ln.replace(/\/\/.*$/, '')]);
  });
  return out;
}

/** Técnico POR FORMA — as MESMAS regras do gate do main.js, copiadas de propósito (ver o caso final). */
const TECNICO = [
  /^[#.[]/,                        // seletor CSS
  /^[a-z][a-zA-Z0-9]*$/,           // identificador de uma palavra
  /^[a-z0-9_]+$/,                  // snake_case / id (minúsculo de propósito: texto de UI começa maiúsculo)
  /^[a-z]+([.-][a-z0-9]*)+$/i,     // chave i18n, classe, arquivo
  /^(https?:)?\//,                 // url / caminho
  /^[\s\d\W]*$/,                   // só símbolo, número ou espaço
  /^[a-z]+\/[a-z0-9.-]+$/i,        // mime / caminho curto
];

/** Parece PROSA em pt-BR? Acento/cedilha, ou palavra funcional ISOLADA (com fronteira, senão 'mode' casa 'de'). */
const ACENTO = /[áàâãéêíóôõúüç]/i;
const PALAVRA_PT = /\b(de|da|do|das|dos|para|com|sem|em|no|na|nos|nas|um|uma|os|as|ou|que|ao|aos|pelo|pela|seu|sua|mais|todos|toda|cada)\b/i;
const pareceProsa = (s) => ACENTO.test(s) || PALAVRA_PT.test(s);

const semMarcacao = (s) => s.replace(/\$\{[^}]*\}/g, '').replace(/<[^>]*>/g, '').trim();
const STR = new RegExp("(['\"`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1", 'g');

/** Literais de um módulo que parecem texto de interface em português. */
function crus(m) {
  const out = [];
  for (const [n, ln] of linhasDeCodigo(fonte(m))) {
    for (const mm of ln.matchAll(STR)) {
      const s = mm[2];
      if (s.length < 2) continue;
      if (TECNICO.some((re) => re.test(s))) continue;
      if (s.includes('<') && !/[A-Za-zÀ-ü]{2}/.test(semMarcacao(s))) continue; // moldura sem texto
      if (!pareceProsa(s)) continue;
      out.push(`${n}: ${JSON.stringify(s.slice(0, 60))}`);
    }
  }
  return out;
}

/**
 * Dívida CONHECIDA em 2026-08-25 — TETO por módulo, e só encolhe.
 *
 * Teto e não igualdade, pela mesma razão do gate de fixtures: um módulo ganha e perde literais por mil
 * motivos que não têm nada a ver com idioma, e um caso que reprovasse a cada edição inocente seria afrouxado
 * na primeira pressa. O que ele proíbe é a única coisa que importa — que o texto cru CRESÇA.
 */
/**
 * ISENTOS, e a isenção é de CLASSIFICAÇÃO, não de dívida.
 *
 * `ui/debug-panel.ts` estava na tabela de dívida com teto 13, e o teto é a forma errada de tratá-lo: ele
 * obriga a empurrar um número toda vez que um instrumento de depuração ganha uma linha, e empurrar um teto
 * que "só encolhe" é justamente o afrouxamento que esta tabela existe para impedir. Fingir que é dívida
 * transforma a regra num incômodo, e regra incômoda é regra afrouxada.
 *
 * O painel não é interface do JOGO. Ele só existe com `?debug=true`, e o leitor dele é quem programa — a
 * mesma pessoa para quem `core/contract` escreve as mensagens de `throw`. Traduzir um instrumento de
 * depuração para três idiomas custaria manutenção e não alcançaria criança nenhuma, que é o que o pilar 3
 * protege.
 *
 * ⚠️ ESTA LISTA TEM UM ITEM, e a régua para entrar nela é estreita: o módulo tem de ser INALCANÇÁVEL sem uma
 * bandeira de desenvolvimento. Um painel que a criança possa abrir não entra aqui — entra na tabela abaixo,
 * com teto, como todos os outros.
 */
const ISENTOS = new Set(['ui/debug-panel.ts']);

const CRU_CONHECIDO = {
  // ⚠️ OS NÚMEROS SAEM DAQUI, e não de um script meu de fora. A primeira versão desta tabela foi preenchida
  // por uma varredura à parte e ela contou MENOS em sete módulos — eu tinha perdido as fronteiras de palavra
  // (``) do casador de prosa, e `mode` casava com `de`. O gate reprovou e estava certo. Quem for atualizar
  // esta tabela, atualize-a pelo que ESTE arquivo reporta; é a mesma lição do gate de fixtures.

  /* --- PAINÉIS DE AJUSTE: rótulos e dicas montados em markup, ainda sem `data-i18n`. --- */
  'ui/map-hub.ts': 8,
  'ui/settings-motion.ts': 6,   // 7 → 6 em 2026-08-27: a etiqueta "todos os jogadores" das seções, que estava
                               // escrita à mão três vezes, virou uma chamada a `t('rm.sec.all')`
  'ui/settings-visual.ts': 7,
  'ui/settings-caa.ts': 5,
  'ui/caa-sets.ts': 3,             // descrições dos conjuntos de pictogramas (licença, origem cultural)
  'ui/hud.ts': 1,

  'ui/settings-panel.ts': 1,
  // ⚠️ `ui/settings-controls.ts` SAIU DA TABELA em 2026-09-07 (#125). O teto era 1 — o `'Pressione…'` que o
  // botão em captura escrevia — e havia outra frase inteira ao lado dele, a linha do `#ctrl-players`, que o
  // crivo não contava por vir num template com interpolação. As duas passam por `t()` agora.
  //
  // O caso `[Zero] a lista não guarda módulo que já se limpou` foi quem cobrou, e é o desenho: uma entrada
  // órfã faz a tabela mentir sobre o tamanho da dívida, e uma dívida que parece maior do que é acaba
  // ignorada como um todo.

  /* --- CURRÍCULO, e este é diferente dos outros: pilar 3 manda REESCREVER por idioma, não traduzir. --- */
  'ui/activities-menu.ts': 3,     // era 5: o item 5 do ADR-0044 tirou os `lbl` crus de PM_BTNS, que nunca iam para a tela      // 'pré-silábico', 'silábico'… as hipóteses de Ferreiro (ADR-0032)

  /* --- FORA de `ui/`: menos, e cada um por um motivo próprio. --- */
  'platform/audio-mixer.ts': 5,    // rótulos das categorias do mixer de áudio
  'input/touch.ts': 3,             // 'mão de criança' / 'mão de adulto' — classificação, mas VAI para a tela
  'core/tiles.ts': 2,
  // ⚠️ `input/gamepad.ts` SAIU DA TABELA em 2026-09-07 (#123), e o que ela contava não era o que estava lá.
  // O teto era 2 — as duas frases COM acento do assistente de mapeamento. Havia CINCO: `' — aperte: '`,
  // `'Mapeados: '` e `'. Agora SOLTE tudo.'` não têm acento nem palavra funcional da lista, e por isso o
  // crivo passava-lhes ao lado. É exactamente o buraco que o cabeçalho deste ficheiro declara («'Coletou'
  // sozinha teria escapado»), medido num módulo real em vez de suposto.
  //
  // E a causa de as cinco terem ficado tanto tempo é um nome: o parâmetro do `wizSay` chamava-se `t` e
  // sombreava o `t` do `core/i18n` dentro da função inteira. Traduzir ali era impossível sem primeiro
  // reparar no sombreamento, e nada dá erro por isso.
  //
  // As cinco passam por `t('pad.wiz.*')` nos três dicionários. O caso `[Interface]` abaixo proíbe entrada
  // órfã, então esta linha não pode voltar sem dívida a acompanhá-la.
  'render/high-contrast.ts': 1,
  'render/viz-setters.ts': 1,

  /* --- MENSAGENS DE PROGRAMADOR, e não de interface: `throw` e listas de conformidade que quem escreve um
   *     preset lê no console. Ficam na lista mesmo assim, COM o motivo — um crivo por FORMA não distingue "o
   *     que a criança lê" de "o que o dev lê", e uma exceção sem contagem é uma porta aberta. --- */
  'boot/create-game.ts': 15,       // a mensagem do `throw` e as lacunas do hospedeiro
                                   // ⚠️ 12 → 15 em 2026-09-08: a VOZ NEURAL ausente. Medido: três dos seis
                                   // jogos não declaram `carregarVozNeural` e ficavam sem voz neural em
                                   // silêncio — contra a promessa escrita do ADR-0065 §3 de que um cartucho
                                   // «não tem de saber que existe». Três linhas pela mesma razão das
                                   // anteriores: a frase nomeia a saída, o declínio E o que a criança perde.
                                   // ⚠️ 9 → 12 em 2026-09-08: o sítio do MENU DE PAUSA (etapa 2 do ADR-0106).
                                   // Três linhas porque a frase nomeia a saída (`host.pauseHost` /
                                   // `#game-region`), o que a criança perde, E o declínio que diz «é de
                                   // propósito» — as três coisas que separam uma lacuna consertável de um
                                   // aviso que se arquiva. Mesma classe das anteriores: HOSPEDEIRO.
                                   // ⚠️ 8 → 9 em 2026-09-08: o elemento da barra que não aceita conteúdo nem
                                   // clique (etapa 2 do ADR-0106). Mesma classe das outras — lacuna do
                                   // HOSPEDEIRO, lida por quem integra a engine — e a linha existe porque a
                                   // alternativa era pior: sem ela, um duplo sem `addEventListener` derrubava
                                   // o BOOT INTEIRO, e derrubar o jogo por causa da barra seria tirá-lo de
                                   // toda a gente para não o dar a ninguém.
                                   // ⚠️ 5 → 8 em 2026-09-08: o ATOR DA PAUSA com mais de um assento (achado 3
                                   // da auditoria do `game-soccer`). São TRÊS linhas e não uma porque a frase
                                   // é longa de propósito — ela nomeia a saída (`declines.semAtorDePausa`) e o
                                   // que se perde (ninguém além do primeiro assento remapeia), e um caso do
                                   // gate exige as duas coisas. Encurtá-la para pagar menos ao livro-razão
                                   // seria pagar com a única parte que serve a quem lê a linha.
                                   // Mesma classe das anteriores: lacuna do HOSPEDEIRO, lida por quem integra
                                   // a engine e não por uma criança.
                                   // ⚠️ 4 → 5 em 2026-09-08: a barra de acessibilidade que falta na primeira
                                   // tela (issue #114 / pedido do Dev). Sobe pela MESMA razão que as duas
                                   // linhas abaixo — é lacuna do hospedeiro, lida por quem integra a engine
                                   // e não por uma criança —, e a medição que a motivou vale a nota: CINCO
                                   // dos seis jogos do catálogo local não têm barra nenhuma. Uma linha nova
                                   // aqui é o preço de a engine deixar de se calar sobre isso.
                                   // 3 → 4 em 2026-09-06: o ADR-0087 acrescentou «mundo declarado não
                                   // encontrado», que é a lacuna do hospedeiro para o campo novo. Sobe pela
                                   // mesma razão das outras deste bloco: são mensagens que quem INTEGRA a
                                   // engine lê, e não texto que chega a uma criança — o crivo é por FORMA e
                                   // não distingue os dois.
  'platform/pesados-catalogo.ts': 6, // ⚠️ AS RAZÕES DE UMA COISA PESADA NÃO TER FONTE, e uma criança nunca as
                                   // lê: elas dizem a QUEM MONTA UM JOGO que o runtime de visão espera pela
                                   // #129 e que a arte do LCP espera pela quarentena. São o mecanismo inteiro
                                   // do ADR-0119 — a diferença entre «este subsistema ainda não tem de onde
                                   // vir» e «este subsistema está tratado» —, e passá-las por `t()` seria
                                   // pedir aos três dicionários que carregassem o estado de duas issues.
                                   // 📌 O gate do `pesados` exige que cada uma tenha MAIS DE 40 CARACTERES:
                                   // encurtá-las para pagar menos a este livro-razão pagaria com a única
                                   // parte que serve a quem as lê.
                                   // 📏 SÃO SEIS LINHAS E TRÊS RAZÕES — cada uma parte-se em duas por caber
                                   // na largura, e o crivo conta LITERAIS e não frases. O número foi MEDIDO
                                   // depois de eu escrever `4` por estimativa e o teto me apanhar: a
                                   // terceira razão é a do identificador de voz torto, que eu tinha
                                   // esquecido de contar.
  'platform/pesados.ts': 1,        // «sem Cache Storage ou sem fetch» — o estado de um ambiente sem as duas
                                   // primitivas, que em produção é um navegador antigo e no gate é o caso do
                                   // vácuo. Vai no campo `erro` de um relatório, que a engine não mostra a
                                   // ninguém: quem decide se aquilo chega a uma tela é o jogo, e aí é ELE que
                                   // escolhe as palavras (ADR-0111 — a palavra que chega a uma pessoa é a do
                                   // JOGO).
  'core/contract.ts': 1,           // ⚠️ VOLTOU À LISTA, e a volta é honesta em vez de silenciosa: ela saiu
                                   // daqui em 2026-09-06 quando as dezesseis mensagens de `conformanceProblems`
                                   // passaram a inglês e o módulo zerou. O ADR-0087 acrescentou o campo
                                   // `world`, e com ele uma frase — «declare the element that IS the game» —
                                   // que o crivo por FORMA conta como prosa, esteja em que língua estiver.
                                   // Não é um módulo velho a piorar: é um campo novo com a sua mensagem.
  'core/actions.ts': 2,            // 1 → 2 em 2026-09-06: `presetProblems` acrescentou «the child would see
                                   // an unlabelled control». Subiu porque a função é NOVA, não porque um
                                   // módulo velho piorou — e o teto sobe pela mesma razão que desce: ele
                                   // conta o que existe.
                                   // ⚠️ ESTÁ EM INGLÊS, e entrou aqui na mesma: «a game with no action cannot
                                   // be played», de `actionSetProblems`. O crivo é por FORMA — prosa com
                                   // fronteiras de palavra —, e prosa em inglês tem a mesma forma que prosa em
                                   // português. Registrar é mais barato que ensinar o crivo a distinguir
                                   // idioma, e mais honesto: a linha 151 já diz que exceção sem contagem é
                                   // porta aberta. Quem lê esta frase é quem escreve um preset (ADR-0085).
};

describe('texto cru em português nas camadas de ENGINE (o buraco do gate do item 14)', () => {
  it('[Right] NENHUM módulo NOVO passa a ter texto de interface em português cru', () => {
    const novos = MODULOS.filter((m) => !(m in CRU_CONHECIDO) && !ISENTOS.has(m))
      .flatMap((m) => crus(m).map((l) => `${m}:${l}`));
    expect(novos, 'texto cru em módulo de engine — passe por t() ou registre o motivo').toEqual([]);
  });

  it('[Boundary] a dívida de cada módulo é um TETO: só encolhe', () => {
    const cresceram = {};
    for (const [m, teto] of Object.entries(CRU_CONHECIDO)) {
      const n = crus(m).length;
      if (n > teto) cresceram[m] = `${teto} → ${n}`;
    }
    expect(cresceram, 'módulo ganhou texto cru novo — o pilar 3 anda para trás').toEqual({});
  });

  it('[Zero] a lista não guarda módulo que já se limpou', () => {
    // Sem este caso a lista viraria cemitério: entradas de módulos já traduzidos continuariam autorizando
    // que o texto voltasse, e ninguém saberia que o gate parou de proteger aquele arquivo.
    for (const m of Object.keys(CRU_CONHECIDO)) {
      expect(crus(m).length, `${m} já não tem texto cru — apague-o de CRU_CONHECIDO`).toBeGreaterThan(0);
    }
  });

  it('[Interface] o total é CONTÁVEL, e o número é o tamanho do que falta', () => {
    // 75 em 19 módulos. Não é decoração: é a diferença entre "o pilar 3 vale" e "o pilar 3 vale no main.js".
    const total = Object.values(CRU_CONHECIDO).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(76);
    expect(Object.keys(CRU_CONHECIDO).length).toBeLessThanOrEqual(20);
  });

  it('[Cross-check] o crivo ainda pega o que os DOIS achados de hoje eram', () => {
    // O caso que impede este arquivo de virar decoração. Se alguém apertar o `TECNICO` ou o `pareceProsa` até
    // o gate ficar verde, estas duas frases — que existiram de verdade, em módulos de engine — voltariam a
    // passar. Elas são o piso do que o crivo tem de enxergar.
    const comoEra = (s) => !TECNICO.some((re) => re.test(s)) && pareceProsa(s);
    expect(comoEra('📚 Nível 2 · Silábico'), 'o rótulo do menu de pausa').toBe(true);
    expect(comoEra('🔊 Portão abriu'), 'a legenda do earcon do portão').toBe(true);
    // E o contrário: o que era ruído continua sendo ruído, senão a lista volta a ter 428 linhas.
    expect(comoEra('ControlLeft')).toBe(false);
    expect(comoEra('Atkinson Hyperlegible')).toBe(false);
    expect(comoEra('select[data-slot]')).toBe(false);
  });
});

// ==========================================================================================================
// ⚠️ TODA CAMADA PUBLICADA E VARRIDA OU ISENTA COM MOTIVO — NENHUMA FICA DE FORA EM SILENCIO
//
// Achado em 2026-09-07, ao auditar uma medicao minha que tinha saido errada por um padrao de busca que
// escondia um ficheiro. A lista de camadas deste ficheiro era COPIADA a mao e ja tinha divergido nos dois
// sentidos: nomeava `audio`, que nunca existiu, e nao nomeava `educational` nem `i18n`, que sao publicadas.
//
// O `engine-package.node.test.js` avisa contra exatamente isto sobre si mesmo. Este ficheiro fazia a copia
// contra a qual aquele avisa — e o `if (!existsSync)` engolia o erro sem uma palavra.
// ==========================================================================================================
describe('nenhuma camada publicada fica fora do crivo em silencio', () => {
  const PUBLICADAS = camadasPublicadas();

  it('[Interface] a leitura do config acha camadas — senao tudo abaixo seria vazio', () => {
    expect(PUBLICADAS.length, 'o `include` do tsconfig.pkg.json nao deu camada nenhuma').toBeGreaterThan(4);
    expect(PUBLICADAS).toContain('core');
  });

  it('⚠️ [Right] camada publicada entra por OMISSAO — esquecer nao a deixa de fora', () => {
    // ⚠️ ESCREVI ISTO PRIMEIRO COMO «toda camada esta varrida OU isenta», e essa metade NAO PODIA FALHAR:
    // `CAMADAS` e o publicado MENOS o isento, entao orfa e impossivel por construcao. Uma assercao que nao
    // pode reprovar e ruido com aparencia de rigor, e a mutacao que a tentava reprovar passou verde.
    //
    // O que fica e a propriedade de verdade, e ela e melhor do que a que eu queria: uma camada nova nasce
    // VIGIADA. Quem a acrescentar ao pacote nao precisa de se lembrar deste ficheiro — e se ela trouxer
    // prosa, o caso da divida reprova nomeando o modulo. Medido com uma camada `inventada` de uma linha.
    expect(CAMADAS).toEqual(PUBLICADAS.filter((c) => !CAMADAS_ISENTAS.has(c)));
    expect(CAMADAS.length, 'a lista varrida esvaziou-se').toBeGreaterThan(3);
  });

  it('⚠️ [Zero] nenhuma ISENCAO e orfa, e cada uma carrega o motivo', () => {
    // Esta reprova mesmo: uma isencao para uma camada que ja nao e publicada faz a lista mentir sobre o
    // tamanho do buraco, que e a regra dos outros livros-razao desta arvore.
    for (const [camada, motivo] of CAMADAS_ISENTAS) {
      expect(PUBLICADAS, `${camada} esta isenta e ja nao e publicada — a isencao ficou orfa`).toContain(camada);
      expect(motivo.length, `motivo curto demais para ser motivo: ${camada}`).toBeGreaterThan(40);
    }
  });

  it('⚠️ [Zero] e nenhuma camada VARRIDA e fantasma — era o caso do `audio`', () => {
    const fantasmas = CAMADAS.filter((c) => !existsSync(join(RAIZ, c)));
    expect(fantasmas, 'camada na lista que nao existe no disco: o crivo diz que a vigia e nao vigia nada').toEqual([]);
  });

  it('⚠️ [Cross-check] a isencao do `educational` CARREGA PESO — varre-lo acharia prosa', () => {
    // Uma isencao que nao muda nada e decoracao, e decoracao e o que sobrevive a uma limpeza distraida.
    // Este caso prova que a decisao do ADR-0032 e a unica coisa que separa aquela camada da tabela de divida.
    const dir = join(RAIZ, 'educational');
    const achados = readdirSync(dir).filter((f) => f.endsWith('.ts')).flatMap((f) => crus('educational/' + f));
    expect(achados.length, 'o `educational` deixou de ter prosa pt-BR; a isencao dele virou decoracao').toBeGreaterThan(10);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · pondo `"app/js/audio"` de volta no `include` do `tsconfig.pkg.json` → "[Zero] nenhuma camada VARRIDA e
//     fantasma" reprova. Era o estado real deste ficheiro ate hoje, e o `if (!existsSync)` engolia-o.
//   · isentando uma camada que nao e publicada → "[Zero] nenhuma ISENCAO e orfa" reprova.
//   · acrescentando uma camada `inventada` ao pacote COM uma frase pt-BR dentro → "[Right] NENHUM modulo NOVO
//     passa a ter texto cru" reprova nomeando `inventada/x.ts`. E a prova de que a inclusao por omissao
//     funciona: quem acrescenta uma camada nao precisa de se lembrar deste ficheiro.
//   · ⚠️ a MESMA camada `inventada` SEM prosa dentro → nenhum caso reprova, e esta certo: uma camada nova e
//     vigiada, nao suspeita. Foi esta mutacao que mostrou que a minha primeira redacao do caso acima era
//     vazia — eu tinha escrito «toda camada esta varrida OU isenta», que nao pode falhar porque `CAMADAS` e
//     definida como o publicado menos o isento.
