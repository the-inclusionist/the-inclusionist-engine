// SPDX-License-Identifier: AGPL-3.0-or-later
// O ITEM 14 VIRANDO GATE: nenhum texto de interface em português cru dentro de `app/js/main.ts`.
// (Era `main.js` até a conversão para TypeScript; o gate segue o arquivo, e o caso [Zero] abaixo é o que
// avisa quando ele deixa de olhar alguma coisa — foi ele que pegou o renome.)
//
// ========================= POR QUE ISTO PRECISA DE UM TESTE =========================
// O item 14 começou com 26 literais pt-BR no main.js e terminou com zero. Sem um gate, o 27º entra na
// primeira pressa — e entra em SILÊNCIO: um texto cru funciona perfeitamente em português, que é o idioma em
// que o jogo é desenvolvido e testado. O defeito só aparece para quem escolheu outro idioma, e o pior caso é
// uma frase de LEITOR DE TELA: quem depende dela não tem a tela para desempatar.
//
// EU JÁ DECLAREI ESTE ITEM PRONTO UMA VEZ, ERRADO. Foi um grep meu que apontou para um arquivo inexistente,
// não devolveu nada, e eu li ausência como limpeza. É por isso que a regra não mora mais num relatório meu.
//
// ========================= O QUE O CRIVO OLHA, E O QUE ELE NÃO CONSEGUE VER =========================
// Ele lê os literais de string das linhas de CÓDIGO (sem comentário) e descarta o que é técnico POR FORMA:
// seletor CSS, identificador, chave i18n, caminho, media query, cor. O que sobra é candidato a texto de UI.
//
// A primeira versão deste crivo era mais estreita — exigia acento ou palavra portuguesa com espaço — e deixou
// passar `chip(g.sim,'Sim')+chip(g.nao,'Não')`: 'Sim' não tem acento e 'Não' tem três letras. Um crivo que
// falha ABERTO produz exatamente o relatório falso que este arquivo existe para impedir, então o de agora é
// largo e a lista de exceções é explícita — cada entrada com o motivo escrito, como nos outros gates daqui.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CR = String.fromCharCode(13);
const FONTE = readFileSync(join(process.cwd(), 'app', 'js', 'main.ts'), 'utf8').split(CR).join('');

/** Linhas de CÓDIGO: sem comentário de bloco, de linha, nem de fim de linha. Prosa não é interface. */
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

/** É técnico POR FORMA — não por estar numa lista de perdão. Seletor, id, chave, caminho, cor, media query. */
const TECNICO = [
  /^[#.[]/,                        // seletor CSS
  /^[a-z][a-zA-Z0-9]*$/,           // identificador de uma palavra
  // SEM a flag `i`, e isto foi um achado do caso abaixo: com ela, a regra engolia QUALQUER palavra única —
  // 'Sim', 'Voltar', 'Jogar', 'On'. A assimetria é o que salva o crivo: identificador começa minúsculo, texto
  // de interface começa MAIÚSCULO. Uma palavra capitalizada sozinha passa a ser acusada, que é o certo.
  /^[a-z0-9_]+$/,                  // snake_case / id (minúsculo de propósito)
  /^[a-z]+([.-][a-z0-9]*)+$/i,     // chave i18n (inteira ou PREFIXO: 'sr.power.' + kind), classe, arquivo
  /^(https?:)?\//,                 // url / caminho absoluto
  /^[\s\d\W]*$/,                   // só símbolo, número ou espaço (emoji, '—', '·')
  /^[a-z]+\/[a-z0-9.-]+$/i,        // mime / caminho curto
];

/**
 * Literais que NÃO são texto de interface e que a forma sozinha não distingue. Cada um com o motivo — uma
 * lista sem motivo é afrouxamento disfarçado, mesma regra dos outros gates deste diretório.
 */
const NAO_E_INTERFACE = new Set([
  'use strict',                                  // diretiva do JavaScript
  'assets/levels/clarity.map.txt',               // caminho do mapa
  '(prefers-contrast: more)', '(pointer:coarse)', '(hover:none)', // media queries
  'rgba(225,232,244,0.85)',                      // cor do canvas
  'button[data-viz]', 'button[data-font]:not([disabled])', // seletores com atributo
  'h1 .ver',                                     // seletor composto
  // Título da ABA do navegador. "The Inclusionist" é NOME DO PRODUTO e "PixiJS" é nome de biblioteca — nomes
  // próprios não se traduzem, e é a mesma razão pela qual `sr.audio.engineSet` está na lista de coincidências.
  'The Inclusionist · ${v} (PixiJS)',
]);

/**
 * ESPECIFICADOR DE IMPORT — `import('x')`, `import … from 'x'`, `export … from 'x'`.
 *
 * ⚠️ REGRA DE FORMA, e não uma entrada em `NAO_E_INTERFACE`, pela razão que o `semMarcacao` abaixo já dá:
 * a lista perdoa UM literal, a forma decide a CLASSE. Um especificador de import não pode ser texto de
 * interface por construção — ele é resolvido pelo empacotador, nunca lido por ninguém.
 *
 * Nasceu com `carregarVozNeural: () => import('@mintplex-labs/piper-tts-web')` (ADR-0094), que é o único
 * ponto da árvore a nomear o fornecedor da voz neural — e é aqui de propósito, porque `main.ts` fica fora
 * do pacote publicado e o nome não viaja para consumidor nenhum. Os outros imports do ficheiro já passavam
 * por acaso, casando o regex de caminho curto; este escapava só por causa do `@` do escopo.
 */
function ehEspecificadorDeImport(linha, indiceDoLiteral) {
  const antes = linha.slice(0, indiceDoLiteral);
  return /(?:\bfrom|\bimport)\s*\(?\s*$/.test(antes);
}

/**
 * MOLDURA DE MARKUP: tira as interpolações e as tags; se não sobrar palavra, é estrutura e não texto.
 *
 * Isto é REGRA DE FORMA, e a diferença importa: eu tinha começado listando cada template em
 * NAO_E_INTERFACE, o que perdoa a moldura E o texto cru que alguém puser dentro dela amanhã. Assim,
 * `<div><span>${txt}</span></div>` passa e `<div><span>Power-ups: …</span></div>` é acusado — que é
 * exatamente a diferença entre a versão de antes e a de depois deste item.
 *
 * O conteúdo das `${}` não some da vista: ele é literal do próprio arquivo e passa pelo crivo por conta.
 */
function semMarcacao(s) {
  return s.replace(/\$\{[^}]*\}/g, '').replace(/<[^>]*>/g, '').trim();
}

/** Todo literal de string das linhas de código que não seja técnico nem excetuado. */
function candidatos() {
  const STR = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  const out = [];
  for (const [n, ln] of linhasDeCodigo(FONTE)) {
    for (const m of ln.matchAll(STR)) {
      const s = m[2];
      if (s.length < 2) continue;
      if (ehEspecificadorDeImport(ln, m.index)) continue;
      if (TECNICO.some((re) => re.test(s)) || NAO_E_INTERFACE.has(s)) continue;
      if (s.includes('<') && !/[A-Za-zÀ-ü]{2}/.test(semMarcacao(s))) continue; // moldura de markup, sem texto
      out.push(`${n}: "${s.slice(0, 70)}"`);
    }
  }
  return out;
}

describe('item 14 — main.js não guarda texto de interface', () => {
  it('[Right] nenhum literal de UI cru; tudo passa por t()', () => {
    // A falha CITA a linha e o texto: um gate que diz só "este arquivo" manda a pessoa procurar o que ela já
    // procuraria. Se o literal novo for técnico e a forma não bastar, acrescente-o a NAO_E_INTERFACE COM O
    // MOTIVO — nunca afrouxe o crivo.
    expect(candidatos(), 'texto cru no main.js — passe por t() ou justifique em NAO_E_INTERFACE').toEqual([]);
  });

  it('[Interface] o crivo enxerga texto curto e sem acento — foi assim que "Sim" escapou', () => {
    // A primeira versão exigia acento ou palavra com espaço, e deixou `chip(g.sim,'Sim')` passar. Este caso
    // prova que o crivo de hoje pegaria: se ele voltar a filtrar por acento, aqui reprova.
    const falso = linhasDeCodigo("const x = chip(g.sim,'Sim');");
    expect(falso).toHaveLength(1);
    expect(TECNICO.some((re) => re.test('Sim')), '"Sim" não pode ser classificado como técnico').toBe(false);
  });

  it('[Zero] comentário NÃO é interface — prosa em português é o normal deste projeto', () => {
    // Os comentários do main.js são em pt-BR por decisão (CLAUDE.md: a conversa com o Dev é em pt-BR). Um
    // gate que os lesse acusaria centenas de falsos positivos e seria desligado na mesma semana.
    expect(linhasDeCodigo('// Movimento por alternância ligado\nconst a = 1;')).toEqual([[2, 'const a = 1;']]);
  });

  it('[Boundary] a regra do especificador perdoa o ALVO do import, e nada mais na linha', () => {
    // ⚠️ O caso que a torna estreita: uma linha PODE ter a palavra `import` e um texto de interface, e o
    // perdão só vale para o literal que vem imediatamente a seguir a `import`/`from`. Sem esta prova, a
    // regra de forma seria um perdão por linha disfarçado de regra — que é o afrouxamento que o cabeçalho
    // deste ficheiro proíbe.
    const alvo = "  carregarVozNeural: () => import('@mintplex-labs/piper-tts-web') });";
    const iAlvo = alvo.indexOf("'@mintplex");
    expect(ehEspecificadorDeImport(alvo, iAlvo), 'o alvo do import tem de ser perdoado').toBe(true);

    const misto = "import('x').then(() => srSay('Voz neural pronta'));";
    expect(ehEspecificadorDeImport(misto, misto.indexOf("'x'"))).toBe(true);
    expect(ehEspecificadorDeImport(misto, misto.indexOf("'Voz")), 'texto na MESMA linha continua acusado').toBe(false);

    const naoImporta = "const rotulo = 'Importar mapa';"; // a palavra `Importar` não é a palavra-chave
    expect(ehEspecificadorDeImport(naoImporta, naoImporta.indexOf("'Importar"))).toBe(false);
  });

  it('[Interface] a lista de exceções não cresce sem controle', () => {
    // Ela é a última porta de saída deste gate — as outras duas (TECNICO e a moldura de markup) são regras
    // de FORMA, que não perdoam texto cru. Dez é o que existe hoje; passar disso quer dizer que alguém está
    // perdoando texto em vez de traduzi-lo, e o número é o que torna isso visível.
    expect(NAO_E_INTERFACE.size).toBeLessThanOrEqual(10);
  });
});
