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
 * ⚠️ A RÉGUA PARA ENTRAR AQUI É ESTREITA, e são DUAS portas, ambas com o mesmo teste por trás: «traduzir isto
 * alcançaria alguma criança?». Um painel que a criança possa abrir não entra — entra na tabela abaixo, com teto,
 * como todos os outros.
 *
 * 1. O módulo é INALCANÇÁVEL sem uma bandeira de desenvolvimento (`ui/debug-panel.ts`).
 * 2. 🔴 O texto cru NÃO É LIDO POR NINGUÉM — é DITO por uma criança e ouvido por um modelo (`input/voice-map.ts`,
 *    2026-09-21, issue #184). As mesas de vocabulário são o que a criança fala em pt, es e en, e já são POR LÍNGUA:
 *    a escolha que o `t()` faria está feita um nível acima, no `voiceWordsFor`. E a acentuação delas é DADO e não
 *    prosa — 📏 medido num navegador: com «acao» em vez de «ação», o modelo pt respondeu «Ignoring word missing in
 *    vocabulary» e a primeira posição do controle ficou muda, sem erro em lado nenhum. Pôr estas palavras no teto
 *    obrigaria a escolher entre pagar dívida por escrever português CERTO e escrever uma palavra que o
 *    reconhecedor não tem — e a segunda opção custa a criança.
 */
const ISENTOS = new Set(['ui/debug-panel.ts', 'input/voice-map.ts']);

const CRU_CONHECIDO = {
  // ⚠️ OS NÚMEROS SAEM DAQUI, e não de um script meu de fora. A primeira versão desta tabela foi preenchida
  // por uma varredura à parte e ela contou MENOS em sete módulos — eu tinha perdido as fronteiras de palavra
  // (``) do casador de prosa, e `mode` casava com `de`. O gate reprovou e estava certo. Quem for atualizar
  // esta tabela, atualize-a pelo que ESTE arquivo reporta; é a mesma lição do gate de fixtures.

  /* --- PAINÉIS DE AJUSTE: rótulos e dicas montados em markup, ainda sem `data-i18n`. --- */
  'ui/map-hub.ts': 8,
  'ui/settings-motion.ts': 6,   // 7 → 6 em 2026-08-27: a etiqueta "todos os jogadores" das seções, que estava
                               // escrita à mão três vezes, virou uma chamada a `t('rm.sec.all')`
                               // 🔴 FICA EM 6 EM 2026-09-12, e o motivo vale mais que o número: o sufixo do
                               // assento deste módulo foi consertado (passou a `t('pause.cardSeat')`) e a
                               // contagem NÃO MEXEU. Eu baixei o teto para 5 por suposição e o próprio crivo
                               // me reprovou.
                               // ⚠️ A causa é um CEGO deste crivo, e é do tamanho do defeito que ele existe
                               // para apanhar: ele conta literais que `pareceProsa` reconhece como texto de
                               // interface, e um fragmento de UMA palavra — o nome de um papel, colado a um
                               // número por concatenação — não se parece com prosa. Logo a forma «palavra +
                               // variável», que é exactamente como o português cru sobrevive em markup
                               // gerado, atravessa o livro-razão inteiro sem ser vista.
                               // 📌 Os dois «Jogador N» que o Dev nomeou em 2026-09-12 estavam AMBOS nesta
                               // forma, e nenhum dos dois estava contado em lado nenhum.
  // ⚠️ 7 → 3 em 2026-09-22, e é PAGAMENTO e não mudança de morada: as duas linhas de português cru deste painel — os
  // itens na cor do dono e as cores do color-blocking — passaram pelo dicionário (ADR-0225), com a explicação no seu
  // `.opt-hint`, e com elas foram os dois `aria-label` (a cor de cada papel e o ↺). 📌 E o número é 3 e não 2 porque
  // há DOIS casos a contar coisas diferentes: um relata o que passa do tecto, o outro é a catraca por módulo — foi
  // ela que recusou o 2 que eu tinha escrito, com o número medido ao lado. Descer até ao medido é o que impede a
  // folga de virar licença; parar acima dele seria deixar a porta entreaberta.
  // ⚠️ A ENTRADA MUDOU DE MÓDULO em 2026-09-23, e as DUAS metades estão no mesmo commit — é o que separa uma
  // mudança de morada de uma dívida nova. As três frases são os nomes dos quatro papéis do color-blocking
  // (`ROLE_LABELS`), que saíram com a metade pura para `ui/visual-choices`. O `ui/settings-visual` desce a ZERO e
  // sai desta tabela; o total do livro não se move.
  // 📌 E elas continuam a ser dívida DECLARADA pela razão que já estava escrita: «perigo (lava)» é a palavra de UM
  // jogo, e quem as nomeia à criança é o nome acessível de cada cor, onde atravessam por `{param}`.
  'ui/visual-choices.ts': 3,
  'ui/settings-caa.ts': 5,
  'ui/caa-sets.ts': 3,
  'ui/locale-flags.ts': 2,       // each language named IN ITSELF, beside its flag: a child who cannot read the current language still finds theirs             // descrições dos conjuntos de pictogramas (licença, origem cultural)
  // ✅ `ui/hud.ts` SAIU DA LISTA em 2026-09-12, e é a SEGUNDA entrada que este livro-razão perde por conserto
  // em vez de por contagem. Era o selo «aperte um botão para entrar» da tela ainda sem dono — a única frase
  // que diz a uma criança COMO entrar, em português, num jogo em inglês. Virou `hud.waitBadge`.
  // 📌 Chave PRÓPRIA e não o `sr.player.pressToJoin` que se lhe parece: aquela é para quem escuta e diz
  // «aperte um botão»; esta diz QUAL botão, porque quem a lê tem outras pessoas à volta.

  // ✅ `ui/settings-panel.ts` SAIU DA LISTA em 2026-09-12, e é a primeira entrada que este livro-razão perde
  // por conserto em vez de por contagem. Era o `EXPLAIN_IDLE` — o texto de REPOUSO do rodapé de todo painel —,
  // e até esse dia ninguém o via: nenhum painel montado pela engine existia, logo o rodapé nunca chegava a uma
  // tela. 📏 Com quatro painéis montados, ele apareceu: medido no navegador, no `quiz.html` com `lang="en"`, o
  // cartão dizia «Hearing accessibility» e o rodapé respondia em português. Virou chave i18n, resolvida no
  // ponto de uso — que corre a cada `fillExplain`, logo acompanha a troca de idioma.
  // ⚠️ `ui/settings-controls.ts` SAIU DA TABELA em 2026-09-07 (#125). O teto era 1 — o `'Pressione…'` que o
  // botão em captura escrevia — e havia outra frase inteira ao lado dele, a linha do `#ctrl-players`, que o
  // crivo não contava por vir num template com interpolação. As duas passam por `t()` agora.
  //
  // O caso `[Zero] a lista não guarda módulo que já se limpou` foi quem cobrou, e é o desenho: uma entrada
  // órfã faz a tabela mentir sobre o tamanho da dívida, e uma dívida que parece maior do que é acaba
  // ignorada como um todo.

  /* --- CURRÍCULO, e este é diferente dos outros: pilar 3 manda REESCREVER por idioma, não traduzir. --- */

  /* --- FORA de `ui/`: menos, e cada um por um motivo próprio. --- */
  'input/touch.ts': 8,             // 'mão de criança' / 'mão de adulto' — classificação, mas VAI para a tela
                                   // ⚠️ 3 → 8 em 2026-09-12: as DUAS linhas de `touchGaps` (ADR-0143 §4),
                                   // partidas em cinco literais por caberem na largura. Mesma classe de todas
                                   // as do `boot/create-game`: é lacuna lida por quem INTEGRA a engine, e não
                                   // texto que chegue a uma criança — o crivo é por FORMA e não distingue os
                                   // dois. 📌 E elas existem para acabar com o silêncio que este mesmo
                                   // subsistema tinha: `touch-bindings.ts:506` desistia sem uma palavra, e um
                                   // jogo ficava sem pad sem que nada o dissesse. Encurtá-las para pagar menos
                                   // a este livro-razão pagaria com a parte que serve a quem as lê — a frase
                                   // nomeia a saída (`preset`, «remapeie um slot») E o que a criança perde.
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
  // ⚠️ 23 → 20 em 2026-09-22, e a descida é MUDANÇA DE MORADA e não pagamento: as linhas que o
  // `problemasDoCartucho` escrevia saíram com ele para `core/cartridge-problems` (ADR-0221 passo 7c). Um teto que
  // ficasse em 23 seria uma porta aberta — e o caso `[Interface]` abaixo, que exige o número CONTADO e não um
  // orçamento, foi quem o disse: ele recusou 21 contra 20 reais.
  'boot/create-game.ts': 20,       // a mensagem do `throw` e as lacunas do hospedeiro
  // ⚠️ AS DUAS QUE VIERAM DA RAIZ, e a razão de ficarem cruas não mudou com a mudança de casa: quem as lê é quem
  // INTEGRA a engine — a que diz que não há voz neural e a que diz que o ator de pausa não foi passado nomeiam
  // ambas o campo a declarar. `problems` é canal de diagnóstico em inglês por decisão (ADR-0169).
  'core/cartridge-problems.ts': 2,
                                   // ⚠️ 20 → 23 em 2026-09-12: a linha que diz que o JOGO desenha por cima
                                   // da barra de acessibilidade (ADR-0148 §3). Mesma classe das outras deste
                                   // módulo — quem a lê é quem INTEGRA a engine —, e ela nomeia os nós que
                                   // invadem e a variável a ler, porque uma linha que só dissesse «há
                                   // sobreposição» deixava o consumidor a caçar.
                                   // 📏 E ela existe porque este defeito NÃO FALHA em lado nenhum: medido no
                                   // `dist/quiz.html`, o `H2.quiz-pergunta` ocupa os mesmos pixels dos botões
                                   // e nada — nem erro, nem tipo, nem consola — o dizia.
                                   // ⚠️ 18 → 20 em 2026-09-12: a linha que diz porque a AJUDA não foi montada
                                   // sem `preset` (ADR-0147 §4). Mesma classe de todas as anteriores — quem a
                                   // lê é quem INTEGRA a engine, e ela nomeia o campo que falta e o registo
                                   // que o define, porque uma linha que só dissesse «falta algo» seria a
                                   // «lacuna que o consumidor lê como escolha» do ADR-0106 §2.
                                   // ⚠️ 15 → 18 em 2026-09-11: o hospedeiro da pausa FORA de `#game-region`
                                   // (ADR-0106 §1, os painéis de ajustes). Mesma classe de todas as anteriores
                                   // — lacuna do HOSPEDEIRO, lida por quem integra a engine — e a linha existe
                                   // porque a alternativa é o silêncio que este repositório já paga caro:
                                   // `ui/settings-panel.topVisibleOverlay` varre `'#game-region .overlay'`, e
                                   // é por ele que o `ui/menu-nav` acha o diálogo de cima. Um painel fora desse
                                   // escopo ABRE e fecha com Escape, e as SETAS não andam dentro dele — quem só
                                   // navega por teclado descobre-o sozinho, sem erro em lado nenhum. Três
                                   // literais pela razão das outras: a frase nomeia a saída (`host.pauseHost`
                                   // dentro de `#game-region`), o mecanismo e o que a criança perde.
                                   // ⚠️ 12 → 15 em 2026-09-08: a VOZ NEURAL ausente. Medido: três dos seis
                                   // jogos não declaram a porta da voz neural e ficavam sem voz neural em
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
  'platform/vosk-runtime.ts': 1,     // ⚠️ UMA MENSAGEM DE `throw` PARA QUEM MONTA UMA ENTREGA, no molde das do `core/contract`:
                                     // «o bundle carregou e não definiu o global — a entrega tem o ficheiro errado». Nenhuma
                                     // criança a lê; quem a lê é quem construiu a entrega, e é a única pessoa que a pode
                                     // consertar. O crivo é por FORMA e não distingue as duas.
  'platform/heavy-catalogue.ts': 6, // ⚠️ AS RAZÕES DE UMA COISA PESADA NÃO TER FONTE, e uma criança nunca as
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
  'platform/onnx-runtime.ts': 1,   // «the heavy catalogue has no address for …» — thrown at whoever BUILDS a game, when an id of
                                   // the heavy catalogue is asked for and is not there. A child never reaches it: it fires before
                                   // a voice or a reading exists, and the engine turns it into the refusal the caller reports
                                   // (ADR-0169). It lived in `kokoro-runtime` until the graph runner became one module for both.
  'platform/reading-runtime.ts': 2, // «the project has no model for …» e «this model has no token for … transcription» —
                                   // os dois são erros para quem CONSTRÓI um jogo: uma língua fora das três, e um modelo
                                   // cujo tokenizador não tem a instrução de transcrever. A criança não os alcança: o `listen()`
                                   // dela vira a recusa que o chamador reporta (ADR-0169), e é essa linha que é traduzida.
  'platform/reading.ts': 1,        // «reading has no microphone here» — dito a quem MONTA a engine sem a captura de som; a
                                   // linha que a criança e o adulto leem é a de `problems`, que nomeia a metade que falta.
  'platform/heavy.ts': 1,        // «sem Cache Storage ou sem fetch» — o estado de um ambiente sem as duas
                                   // primitivas, que em produção é um navegador antigo e no gate é o caso do
                                   // vácuo. Vai no campo `erro` de um relatório, que a engine não mostra a
                                   // ninguém: quem decide se aquilo chega a uma tela é o jogo, e aí é ELE que
                                   // escolhe as palavras (ADR-0111 — a palavra que chega a uma pessoa é a do
                                   // JOGO).
  'core/genres.ts': 3,             // The engine's genre list (ADR-0156): two genre NAMES with an apostrophe («Shoot 'em
                                   // ups», «Beat 'em up games»), kept exactly as the Dev transcribed them, and the
                                   // refusal a cartridge's author reads when a genre is not in the list. Data and a
                                   // message for whoever writes a cartridge (ADR-0169), never text a child sees.
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
    //
    // ⚠️ 76 → 79 em 2026-09-12, E ISTO É CRESCIMENTO DE DÍVIDA, dito como tal. As três entradas são as linhas
    // de `touchGaps` (ADR-0143 §4), e a razão de elas não passarem por `t()` é a que o
    // `platform/heavy-catalogue` já escreveu: são mensagens que quem INTEGRA a engine lê, e pô-las no
    // dicionário seria pedir aos três idiomas que carregassem diagnóstico de integração.
    //
    // 📌 O que compra a subida é o que ela paga: elas existem para acabar com um silêncio TOTAL —
    // `touch-bindings.ts:506` desistia sem uma palavra, e um jogo ficava sem controle virtual sem que nada o
    // dissesse. Trocar cinco literais deste livro-razão por uma lacuna que deixa de ser invisível é a troca
    // que este tecto existe para tornar consciente, não a que ele existe para proibir.
    // ✅ E 79 → 78 no mesmo dia, pela outra direcção: o `ui/settings-panel` saiu da lista inteiro. Um tecto
    // que só sobe é um orçamento; este desce quando alguém conserta, e foi o que aconteceu.
    //
    // 📌 78 → 77 → 79 em 2026-09-12, e as duas metades são deliberadas e de sinais contrários:
    //   ✅ −1 · `ui/hud.ts` SAIU inteiro. Era o selo «aperte um botão para entrar» da tela ainda sem dono — a
    //      única frase que diz a uma criança COMO entrar, em português num jogo em inglês. É a SEGUNDA
    //      entrada que este livro-razão perde por conserto em vez de por contagem.
    //   ⚠️ +2 · a linha que diz porque a AJUDA não foi montada sem `preset` (ADR-0147 §4). Mesma classe das
    //      outras de `boot/create-game`: quem a lê é quem INTEGRA a engine, e pô-la no dicionário seria pedir
    //      aos três idiomas que carregassem diagnóstico de integração.
    //
    // 🔴 E O QUE ESTE NÚMERO NÃO MEDE ficou medido no mesmo dia, ao consertar os dois «Jogador N» que o Dev
    // nomeou: o crivo conta literais que `pareceProsa` reconhece como texto de interface, e um fragmento de
    // UMA palavra colado a um número por concatenação não se parece com prosa. A forma «palavra + variável»
    // — que é como o português cru sobrevive dentro de markup gerado — atravessa este livro-razão inteiro sem
    // ser vista, e os dois que o Dev apontou estavam ambos nela. O total é um piso, não um retrato.
    // ⚠️ 79 → 82 no mesmo dia: a linha da barra de acessibilidade tapada (ADR-0148 §3). É dívida a crescer,
    // dita como tal — e o que a compra é o que ela paga: um defeito que não falhava em lado nenhum passou a
    // ter uma linha que nomeia os nós invasores e a variável que os tira de lá.
    // ⚠️ 82 → 85 com a leitura (ADR-0216 §2): três linhas ditas a quem CONSTRÓI um jogo ou MONTA a engine — uma língua fora das
    // três, um tokenizador sem a instrução de transcrever, e uma captura de som que não foi passada. Nenhuma delas chega a uma
    // criança: o `listen()` dela devolve a recusa que o chamador reporta, e é essa que passa por `t()`. Pôr diagnóstico de
    // integração nos três dicionários seria pedir a pt, en e es que carregassem o manual de quem instala.
    // ⚠️ 85 → 84 e 20 → 21 ENTRADAS em 2026-09-22, e as duas metades dizem a mesma coisa: `problemasDoCartucho` saiu
    // da raiz para `core/cartridge-problems` (ADR-0221 passo 7c). O TOTAL desceu — três linhas saíram da raiz e duas
    // voltaram a ser contadas na casa nova —, e o que subiu foi o número de MORADAS. 🔴 E o teto de entradas existe
    // justamente para isso doer: uma lista de excepções que cresce sem o total crescer ainda é uma lista maior para
    // quem a lê. Sobe aqui porque um módulo se PARTIU, e a prova é o total no mesmo commit.
    const total = Object.values(CRU_CONHECIDO).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(84);
    expect(Object.keys(CRU_CONHECIDO).length).toBeLessThanOrEqual(21);
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
