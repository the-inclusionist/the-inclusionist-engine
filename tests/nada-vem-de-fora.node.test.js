// SPDX-License-Identifier: AGPL-3.0-or-later
// NADA CHEGA DE FORA EM TEMPO DE EXECUÇÃO — o pilar 8 (offline/PWA), como inventário.
//
// ========================= POR QUE ISTO IMPORTA NUMA ESCOLA =========================
// O pilar 8 do ADR-0010 diz que este jogo funciona OFFLINE. Numa escola pública sem rede — que é o alvo, não a
// excepção — um módulo que busque código a um servidor de terceiros não degrada: ele simplesmente não faz
// nada. A criança liga o botão e não acontece coisa nenhuma, sem erro e sem explicação.
//
// 📏 MEDIDO EM 2026-09-08: a engine inteira tinha UMA busca de runtime externo, e ela era justamente no
// transporte assistido — o `ui/webcam` carrega o WebGazer de `webgazer.cs.brown.edu`. Ou seja: o único
// subsistema que exigia internet era o que serve a criança que menos pode ir buscar outra coisa.
//
// ⚠️ E EM 2026-09-09 PASSARAM A SER DUAS, POR DECISÃO E NÃO POR DERIVA. O `platform/pesados` desce as quatro
// vozes neurais no primeiro carregamento (ADR-0110 (b), pedido do Dev). A distinção que este ficheiro tem de
// fazer deixou de ser «há busca ou não há» e passou a ser QUANDO: uma busca na INSTALAÇÃO cumpre o pilar 8
// («primeiro dia online, depois offline-first», errata ditada pelo Dev); uma busca PREGUIÇOSA no primeiro uso
// viola-o, porque a máquina que nunca ligou aquele controle nunca a fez. O WebGazer é a segunda; é por isso
// que ele continua a ser um defeito e o buscador não.
//
// ⚠️ E A DISTINÇÃO QUE ESTE CRIVO TEM DE FAZER É A RAZÃO DE ELE SER INVENTÁRIO E NÃO PROIBIÇÃO: nem toda URL
// em código é uma busca. `http://www.w3.org/2000/svg` é um NAMESPACE XML — um identificador que o
// `createElementNS` exige, e que nunca sai da máquina. Um gate que as tratasse igual acusaria dois falsos, e
// um gate que acusa falsos é desligado antes de apanhar o verdadeiro.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));
const URL_QUALQUER = /https?:\/\/[^\s'"`)]+/g;

function ficheirosTs(dir = RAIZ) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...ficheirosTs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(p);
  }
  return saida;
}

/**
 * As URLs que vivem em CÓDIGO, por ficheiro.
 *
 * ⚠️ Comentários fora: esta engine explica-se muito, e metade das URLs que ela escreve estão em prosa a citar
 * uma fonte. Contá-las criaria o incentivo de APAGAR A EXPLICAÇÃO para baixar o número — que é a lição que o
 * `action-vocabulary-boundary` já deixou escrita.
 */
function urlsEmCodigo() {
  const fora = [];
  for (const p of ficheirosTs()) {
    const rel = relative(RAIZ, p).split('\\').join('/');
    readFileSync(p, 'utf8').split(/\r?\n/).forEach((ln) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
      for (const u of ln.match(URL_QUALQUER) ?? []) fora.push({ modulo: rel, url: u });
    });
  }
  return fora;
}

/**
 * O QUE PODE APARECER, e o que cada coisa é. ⚠️ As razões não são do mesmo TIPO, e é isso que a lista serve
 * para dizer: duas são identificadores que não viajam, e uma é uma busca a sério.
 */
const DECLARADAS = {
  'http://www.w3.org/2000/svg': 'NAMESPACE XML, não um endereço: o `createElementNS` exige-o para criar nós SVG, e ele nunca sai da máquina. Aparece no `render/cvd-matrices` e no `render/lq-filter`, que montam os filtros de daltonismo',
  'https://huggingface.co/diffusionstudio/piper-voices/resolve/main/': '⚠️ MUDOU DE ESPELHO EM 2026-09-09, e a razão é a regra «busca-se de onde o LEITOR lê»: era `rhasspy`, e o único consumidor destes bytes — o `@mintplex-labs/piper-tts-web` instalado, lido do bundle — busca em `diffusionstudio`. Endereços diferentes são caches diferentes, logo os 241 MB que o `platform/pesados` descia não eram lidos por ninguém e a biblioteca voltava a descarregá-los. 📏 Os dois espelhos servem os MESMOS bytes (63 201 294, medido nos dois). ENDEREÇO DECLARADO, e ainda não uma busca — a terceira categoria desta lista. O ADR-0114 exige que o host dos modelos seja NOMEADO NUM SÍTIO SÓ, e o `platform/voice-plan` é esse sítio: ele é PURO, não tem `fetch`, `import()` nem `script.src`, e nada nele sai da máquina. 📏 Medido em 2026-09-08 a partir do que o `piper.ttstool.com` busca; as quatro vozes respondem 200 com CORS aberto. ⚠️ Quando o buscador existir, ELE é que passa a contar como busca — e o caso estrutural abaixo é que o obriga, porque conta módulos que tocam na rede e não nomes numa lista',
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1': 'O RUNTIME DE VISÃO (ADR-0124), fixado na versão e descido na INSTALAÇÃO pelo `platform/pesados`. Não é busca preguiçosa: é a instalação do PWA, que o ADR-0116 declarou ser um acto de rede legítimo. 📏 Medido: os três ficheiros respondem 200 com CORS aberto',
  'https://storage.googleapis.com/mediapipe-models': 'OS MODELOS `.task` do MediaPipe — rosto+íris, gestos e mãos. ⚠️ Host diferente do runtime porque é assim que o Google os publica, e sem eles os 11,7 MB de WebAssembly não reconhecem coisa nenhuma: é o `.onnx` sem o `.onnx.json` outra vez. 📏 Medidos em 2026-09-09, `float16`',
  'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/dist': 'O MOTOR DE VOZ (ADR-0127), fixado. São três ficheiros e não um — a entrada de 23 KB importa dois pedaços com hash no nome, e trazer só a entrada dá um módulo que importa o que não está lá',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist': 'QUEM CORRE O MODELO DE VOZ. ⚠️ `ort-wasm-simd-threaded` e não o `jsep`: o jsep é o caminho WebGPU, pesa 21,7 MB contra 11,2, e o hardware do pilar 1 não é onde a WebGPU se ganha',
  'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize': 'THE VOICE\'S PHONEMIZER (#173): espeak-ng in WebAssembly and its pronunciation data, at the provider\'s own default address, with sha256. The BUILD fetches it into the delivery (`pesados:entrega`); `platform/tts` asks the provider for it at `pesados/` on this origin, and the service worker answers from the checked cache',
  'https://webgazer.cs.brown.edu/webgazer.js': 'WEBGAZER (ADR-0132), downloaded at INSTALL by `platform/pesados` and kept only when its sha256 matches (#168). `ui/webcam` runs it from that checked cache and no longer fetches it on first use (#169), so it no longer breaks pillar 8. ⚠️ The request still tells brown.edu the school\'s IP address — the open decision of the STRIDE client pass',
};

/**
 * ESTE MÓDULO TOCA NA REDE? — a pergunta que separa um ENDEREÇO de uma BUSCA.
 *
 * ⚠️ Estrutural e não por nome: procura a PRIMITIVA que sai da máquina. Um módulo pode nomear um endereço
 * (o ADR-0114 exige que um deles o faça) sem nunca o pedir, e tratá-los igual acusaria um falso — que é
 * como um gate é desligado antes de apanhar o verdadeiro.
 */
// 🔴 ERA `\bfetch\s*\(` ATÉ 2026-09-09, E O BUSCADOR DAS COISAS PESADAS PASSOU-LHE AO LADO. O
// `platform/pesados.ts` RECEBE o `fetch` (`readonly buscar?: typeof fetch`, com
// `opcoes.buscar ?? fetch`) e chama-o por outro nome — `buscar(p.url)`. A primitiva está lá, o nome
// dela desapareceu do sítio onde ela é usada.
// ⚠️ E ISSO NÃO FOI EVASÃO, FOI BOM DESENHO: injectar a primitiva é o que torna o buscador testável sem
// rede, e é o mesmo movimento que o `input/touch` já recomenda («injectar o BOOLEANO, não o estado»). Um
// discriminador derrotado por DESENHO CERTO é pior do que um derrotado por descuido: ninguém fez nada de
// errado, e por isso ninguém vai à procura.
// 📌 `\bfetch\b` apanha o nome em posição de VALOR (`typeof fetch`, `?? fetch`) e não só de chamada. Medido
// em 2026-09-09 na árvore inteira: passa de três módulos para QUATRO, e o quarto é o buscador — zero falsos.
const REDE = /\bfetch\b|\bimport\s*\(|\.src\s*=|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket|new\s+EventSource/;
/**
 * OS MÓDULOS QUE TOCAM NUMA PRIMITIVA DE REDE, e o que cada um faz com ela.
 *
 * ⚠️ TOCAR NA PRIMITIVA NÃO É SAIR DA MÁQUINA, e é essa a distinção que a lista existe para escrever. Dois
 * destes carregam recurso LOCAL — um chunk do próprio pacote, um sprite do próprio cartucho — e contá-los
 * como dependência de rede seria o mesmo erro que contar o namespace do W3C como busca.
 *
 * 📌 A lista é afirmada por IGUALDADE e não por inclusão: um módulo novo com `fetch` reprova, e um módulo
 * que deixe de tocar na rede também — que é como o inventário ENCOLHE quando a #129 for resolvida.
 */
const TOCAM_NA_REDE = {
  'core/i18n.ts': 'LOCAL. `import(\'../i18n/en.js\')` — os dicionários de en/es são chunks do próprio pacote, '
    + 'cortados pelo Vite e servidos pelo service worker. Nada sai da máquina; o `import()` está no crivo '
    + 'porque com um especificador absoluto ele SAI, e é por isso que o discriminador o inclui',
  'input/gamepad.ts': 'LOCAL. `img.src = ctx.spriteBase + …` no assistente de mapeamento — arte do CARTUCHO, '
    + 'por caminho relativo. ⚠️ Um cartucho que ponha uma URL absoluta em `spriteBase` transforma isto numa '
    + 'busca sem tocar na engine; o crivo não o alcança porque o literal viveria no jogo, e fica escrito aqui '
    + 'para não ser descoberto numa escola',
  'platform/pesados.ts': '🎯 A SEGUNDA BUSCA EXTERNA DA ENGINE, e é DECIDIDA — ADR-0110 (b): os quatro '
    + 'modelos de voz não viajam no pacote e descem no primeiro carregamento. ⚠️ NÃO VIOLA O PILAR 8, e a '
    + 'diferença é a errata que o próprio Dev ditou: «primeiro uso não pode ser considerado rede porque o '
    + 'próprio sistema está sendo baixado». O que o pilar proíbe é depender da rede DEPOIS do primeiro dia — '
    + 'e é precisamente isso que este módulo conserta, porque hoje a voz nunca desce e a criança chega ao '
    + 'segundo dia sem ela. 📌 Ele não tem URL em código: os endereços vêm do `platform/voice-plan`, o sítio '
    + 'único do ADR-0114',
  'ui/webcam.ts': '🔴 A BUSCA QUE VIOLA O PILAR 8, e continua por resolver. `<script src>` do WebGazer, '
    + 'PREGUIÇOSO — dispara quando a criança liga o controle por olhar, logo a máquina que nunca o ligou não '
    + 'o tem, e sem rede não acontece nada. Travado na #129. Sai daqui quando o runtime entrar no precache',
};

function tocaNaRede(modulo) {
  const src = readFileSync(join(RAIZ, modulo), 'utf8')
    .split(/\r?\n/).filter((ln) => !/^\s*(\/\/|\*|\/\*)/.test(ln)).join('\n');
  return REDE.test(src);
}

describe('pilar 8 · nada chega de fora sem estar declarado', () => {
  it('🎯 [Zero] nenhuma URL nova entrou em código sem uma razão escrita', () => {
    const novas = urlsEmCodigo().filter(({ url }) => !(url in DECLARADAS));
    expect(
      novas.map(({ modulo, url }) => `${modulo}  ${url}`),
      'URL nova em código de execução. O pilar 8 diz que este jogo funciona OFFLINE — numa escola sem rede, '
      + 'uma busca externa não degrada, ela simplesmente não acontece. Se for um NAMESPACE (não viaja), '
      + 'declare-o aqui a dizê-lo; se for uma busca, ela precisa de decisão antes de código (ver #129).',
    ).toEqual([]);
  });

  it('[Interface] a lista não tem órfãos — uma URL que saiu do código sai dela', () => {
    // É por aqui que esta lista ENCOLHE: quando a #129 for decidida e o WebGazer sair, a entrada dele tem de
    // sair também, senão o inventário reportaria uma dívida já paga.
    const presentes = new Set(urlsEmCodigo().map((u) => u.url));
    expect(Object.keys(DECLARADAS).filter((u) => !presentes.has(u)), 'entrada de uma URL que já não existe').toEqual([]);
  });

  it('⚠️ [Interface] e a varredura está VIVA: ela lê a árvore e o detector reconhece uma URL', () => {
    expect(ficheirosTs().length, 'a varredura não achou módulo nenhum').toBeGreaterThan(50);
    expect(urlsEmCodigo().length, 'nenhuma URL achada — o detector morreu').toBeGreaterThan(0);
    expect('const s = "https://exemplo.org/x.js";'.match(URL_QUALQUER)).toEqual(['https://exemplo.org/x.js']);
  });

  it('📌 [Right] TODO módulo que toca numa primitiva de rede está declarado — o inventário é o assunto', () => {
    // ⚠️ A afirmação forte deste ficheiro não é «há uma lista»: é que se sabe, uma a uma, quais são as
    // dependências de rede desta engine e o que cada uma faz. Uma a mais tem de custar uma linha escrita.
    //
    // 🎯 O DISCRIMINADOR PASSOU A SER ESTRUTURAL EM 2026-09-08, e a mudança é um aperto e não um alívio.
    //    Era «não é o namespace do W3C, logo é uma busca» — que assume que só há duas categorias. O ADR-0114
    //    criou a terceira: um ENDEREÇO declarado num módulo puro, para um buscador que ainda não existe.
    //    Agora conta-se quem toca mesmo na REDE: um módulo é uma busca quando contém uma primitiva de rede.
    //    ⚠️ Uma lista de nomes teria deixado passar o buscador no dia em que ele nascesse NAQUELE ficheiro;
    //    esta forma apanha-o, porque é a primitiva que o denuncia e não o endereço.
    // 🔴 E EM 2026-09-09 O CASO MUDOU DE FORMA OUTRA VEZ, porque a forma anterior tinha um BURACO que este
    //    ficheiro não podia ver: ela contava módulos que tocam na rede **de entre os que têm uma URL em
    //    código**. O buscador das coisas pesadas não tem nenhuma — as quatro moram no `platform/voice-plan`,
    //    de onde chegam por import. Ele fetcha, e era invisível ao caso que existe para contar quem fetcha.
    //    ⚠️ Separar CATÁLOGO de BUSCADOR é bom desenho (a lista é dado, o buscador é regra), e é exactamente
    //    o que abria a porta: o literal fica de um lado, a primitiva do outro, e um crivo que exija os dois
    //    no mesmo ficheiro não vê nenhum dos dois. Agora conta-se a PRIMITIVA onde quer que ela esteja.
    const naRede = ficheirosTs()
      .map((p) => relative(RAIZ, p).split('\\').join('/'))
      .filter((m) => tocaNaRede(m));
    expect(naRede.sort(), 'módulo novo a tocar numa primitiva de rede — declare-o em TOCAM_NA_REDE com o que ele faz')
      .toEqual(Object.keys(TOCAM_NA_REDE).sort());
  });

  // 📌 O PAR QUE IMPEDE A CATEGORIA NOVA DE VIRAR PORTA DOS FUNDOS: o módulo que NOMEIA o host tem de
  // continuar sem tocar na rede. No dia em que ele ganhar um `fetch`, o caso acima acusa-o — e este diz
  // porquê, antes de alguém ter de o descobrir.
  it('📌 [Zero] o módulo que NOMEIA o host dos modelos não toca na rede', () => {
    expect(tocaNaRede('platform/voice-plan.ts'), 'o catálogo passou a buscar — deixou de ser um endereço').toBe(false);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Quatro, tres mortas e uma EQUIVALENTE hoje — e o «hoje» esta medido, nao suposto.
//
//   1. uma SEGUNDA busca externa a aparecer num modulo real (`platform/tts`) -> reprovam DOIS: o dos
//      declarados e o que afirma que a busca externa continua a ser UMA. E o defeito mais provavel deste
//      ficheiro: nao alguem apagar o crivo, alguem acrescentar um CDN a resolver um problema.
//   2. o detector de URLs morto -> reprovam TRES. Um crivo de ausencia que nao acha nada esta verde pela pior
//      razao possivel.
//   4. o WebGazer a passar a ser local (`/vendor/webgazer.js`) -> reprovam DOIS, e ⚠️ ESTA REPROVA POR BOA
//      NOTICIA: e a #129 resolvida. Quando acontecer, a entrada do WebGazer sai desta lista e o caso do
//      «continua a ser UMA» passa a exigir uma lista VAZIA. Fica escrito para ninguem ler o vermelho como
//      regressao.
//
//   5. 🎯 O DISCRIMINADOR DE VOLTA A `\bfetch\s*\(` (2026-09-09) -> reprova o inventario, e e a mutacao que
//      prova o conserto do dia: com ela, o `platform/pesados` — que RECEBE o `fetch` e o chama por outro
//      nome — desaparece do conjunto medido e a engine volta a parecer ter tres modulos de rede em vez de
//      quatro. ⚠️ Ela nao apanha um descuido: apanha BOM DESENHO a cegar um crivo, que e o buraco mais caro
//      porque ninguem fez nada de errado.
//   6. um modulo novo a ganhar `fetch(` sem entrada em `TOCAM_NA_REDE` -> reprova pela mesma assercao, que e
//      a metade para que a lista existe. ⚠️ E a IGUALDADE (e nao a inclusao) e o que faz a lista ENCOLHER:
//      no dia em que o WebGazer entrar no precache, a entrada dele tem de SAIR, senao o inventario reporta
//      uma divida ja paga.
//
//   3. ⚠️ os comentarios a voltarem a contar -> SOBREVIVE, e e equivalencia por VACUIDADE: medido, ha ZERO
//      URLs em comentario em `app/js` inteiro, entao o filtro nao remove nada hoje. Ele FICA na mesma, e
//      deixa de ser equivalente no primeiro comentario que cite uma fonte — «ver https://…» seria acusado
//      como busca nova. A licao e a mesma que o `action-vocabulary-boundary` ja escreveu: contar a prosa cria
//      o incentivo de APAGAR A EXPLICACAO para baixar o numero.
