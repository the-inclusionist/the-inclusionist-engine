// SPDX-License-Identifier: AGPL-3.0-or-later
// O QUE SOBREVIVE AO `tsc` E MENTE DO OUTRO LADO — o gate do ADR-0072 §4.
//
// ========================= O ACHADO QUE ESTE ARQUIVO EXISTE PARA IMPEDIR =========================
// O primeiro build de pacote de verdade (2026-09-05, `tsc -p tsconfig.pkg.json`) devolveu exit 0 e 103
// arquivos. Parecia pronto. Duas linhas do emitido diziam o contrário:
//
//   · `dist-pkg/core/i18n.js:67` — `import.meta.glob('../i18n/*.ts')`, COPIADA INTACTA. O `tsc` não é o Vite:
//     ele não conhece a construção e a trata como chamada comum. Num consumidor que não a transforme,
//     `import.meta.glob` é `undefined` e estoura no carregamento; num que a transforme, o padrão `*.ts` casa
//     ZERO arquivos ao lado de um emitido que só tem `.js`, e todo idioma que não fosse pt viraria português
//     sem erro nenhum.
//   · `dist-pkg/render/sprites.js:13` — `import { ATLAS_URL, FRAMES } from 'virtual:sprite-atlas'`, um módulo
//     que só existe dentro do plugin de build DESTE repositório.
//
// ========================= POR QUE O CRIVO É NA FONTE E NÃO NO EMITIDO =========================
// Testar `dist-pkg/` exigiria que o build tivesse rodado, e um gate que só funciona depois de um passo que
// alguém pode esquecer é um gate que falha ABERTO — o pior tipo, porque parece verde. A propriedade que
// importa é da FONTE: um módulo que só compila sob o Vite não pode ser publicado, e isso se lê sem compilar.
//
// ========================= E A LISTA DE CAMADAS VEM DO PRÓPRIO CONFIG =========================
// `tsconfig.pkg.json` é lido aqui em vez de a lista ser copiada. Copiar seria a divergência clássica: alguém
// acrescenta uma camada ao pacote, o gate segue vigiando as antigas, e o módulo novo viaja sem ninguém olhar.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ_REPO = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const CR = String.fromCharCode(13);

/** O `tsconfig.pkg.json`, sem os comentários `//N` que o TypeScript tolera e o `JSON.parse` não. */
function lerConfigDoPacote() {
  const bruto = readFileSync(join(RAIZ_REPO, 'tsconfig.pkg.json'), 'utf8').split(CR).join('');
  return JSON.parse(bruto);
}

const CFG = lerConfigDoPacote();
const EXCLUIDOS = new Set((CFG.exclude ?? []).map((p) => p.split('\\').join('/')));

/** Os `.ts` que o pacote de fato EMBARCA: o que o `include` alcança, menos o que o `exclude` tira. */
function modulosDoPacote() {
  const out = [];
  for (const entrada of CFG.include ?? []) {
    const abs = join(RAIZ_REPO, entrada);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isDirectory()) {
      for (const f of readdirSync(abs)) {
        if (!f.endsWith('.ts')) continue;
        const rel = `${entrada}/${f}`.split('\\').join('/');
        if (!EXCLUIDOS.has(rel)) out.push(rel);
      }
    } else if (!EXCLUIDOS.has(entrada.split('\\').join('/'))) {
      out.push(entrada.split('\\').join('/'));
    }
  }
  return out.sort();
}

const MODULOS = modulosDoPacote();
const fonte = (rel) => readFileSync(join(RAIZ_REPO, rel), 'utf8').split(CR).join('');

/** Linhas de CÓDIGO. Prosa que MENCIONA `import.meta.glob` não é `import.meta.glob` — e este arquivo e o
 *  `core/i18n` estão cheios de prosa que a menciona, exatamente para explicar por que ela saiu. */
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

/** Construções que SÓ o Vite entende. Cada uma sobrevive ao `tsc` sem aviso, e é isso que as torna perigosas. */
const SO_NO_VITE = [
  { nome: 'import.meta.glob', re: /import\s*\.\s*meta\s*\.\s*glob\s*[<(]/ },
  { nome: "import de 'virtual:'", re: /from\s*['"]virtual:/ },
  { nome: '__BUILD__ (define do Vite)', re: /\b__BUILD__\b/ },
  { nome: 'import com sufixo ?raw/?url/?worker', re: /from\s*['"][^'"]+\?(raw|url|worker|inline)['"]/ },
];

/** [módulo, linha, construção] para tudo que o crivo pega. */
function ocorrencias(modulos = MODULOS) {
  const achados = [];
  for (const m of modulos) {
    for (const [n, linha] of linhasDeCodigo(fonte(m))) {
      for (const { nome, re } of SO_NO_VITE) if (re.test(linha)) achados.push([m, n, nome]);
    }
  }
  return achados;
}

describe('o pacote publicável não carrega construção que só o Vite entende (ADR-0072 §4)', () => {
  it('[Interface] o config nomeia camadas que EXISTEM, e alcança módulos', () => {
    for (const entrada of CFG.include ?? []) {
      expect(existsSync(join(RAIZ_REPO, entrada)), `tsconfig.pkg.json inclui ${entrada}, que não existe`).toBe(true);
    }
    expect(MODULOS.length).toBeGreaterThan(50);
  });

  it('[Zero] NENHUM módulo embarcado usa construção exclusiva do Vite', () => {
    const achados = ocorrencias();
    const legivel = achados.map(([m, n, nome]) => `${m}:${n} — ${nome}`);
    expect(legivel, 'sobrevive ao tsc e quebra (ou mente) do outro lado').toEqual([]);
  });

  // ⚠️ OS DOIS CASOS SOBRE `render/sprites` SAIRAM DAQUI em 2026-09-07 (issue #111), e nao por terem
  // deixado de importar: o MODULO mudou de repositorio. Eles afirmavam que ele estava no `exclude` do
  // `tsconfig.pkg.json` e que nenhum modulo embarcado o importava — as duas coisas continuam verdadeiras
  // e nenhuma e mais aferivel aqui, porque nao ha ficheiro que ler. A propriedade que elas protegiam
  // passou a ser garantida por CONSTRUCAO: o que nao esta na arvore nao entra no pacote.

  it('[Cross-check] o crivo ainda pega o que os DOIS achados de 05/09 eram', () => {
    const amostras = [
      "const loaders = import.meta.glob<{ default: LocaleDict }>('../i18n/*.ts');",
      "import { ATLAS_URL, FRAMES } from 'virtual:sprite-atlas';",
      "const v = String(__BUILD__.version);",
    ];
    for (const linha of amostras) {
      expect(SO_NO_VITE.some(({ re }) => re.test(linha)), `o crivo deixaria passar: ${linha}`).toBe(true);
    }
  });

  it('[Exception] prosa que MENCIONA a construção não conta — senão o gate proibiria explicar-se', () => {
    const comentada = '// os locales entram por import.meta.glob(...), e foi por isso que saíram';
    expect(linhasDeCodigo(comentada)).toEqual([]);
  });
});

// ===================================================================================================
// O SEGUNDO CRIVO: O QUE O PACOTE NOMEIA TEM DE SER O QUE ELE DECLARA
// ===================================================================================================
// ⚠️ O ACHADO QUE ESTE BLOCO EXISTE PARA IMPEDIR, e ele chegou de FORA: um consumidor real instalou
// `@the-inclusionist/engine@6.36.1` do registro e o build dele parou em
//
//     Rolldown failed to resolve import "@mintplex-labs/piper-tts-web"
//     from ".../@the-inclusionist/engine/dist-pkg/platform/tts.js"
//
// `platform/tts` é código EMBARCADO e nomeia esse pacote; o `package.json` o declarava em
// `devDependencies`, que o npm NÃO instala para quem consome. Ou seja: a versão publicada não podia
// ser compilada por ninguém — e nada aqui dentro tinha como saber, porque neste repositório o pacote
// está presente (é devDependency da própria árvore) e tudo resolve.
//
// ⚠️ E O DEFEITO ESCONDEU-SE NA FORMA DINÂMICA. A linha é `import('@mintplex-labs/piper-tts-web')`
// dentro de uma função, não um `from` no topo. Um crivo escrito só para `from '...'` ficaria verde por
// cima dela para sempre. Por isso o `[Right]` abaixo prende as DUAS formas pelo nome.
//
// POR QUE ISTO É UM `[Zero]` E NÃO UM TETO QUE ENCOLHE: medido em 06/09, os 112 módulos embarcados
// nomeiam TRÊS especificadores de terceiros ao todo. O resíduo honesto é vazio, então qualquer entrada
// é defeito — não há dívida legítima a tolerar.
describe('todo pacote que o código embarcado NOMEIA é declarado como dependência de execução', () => {
  const PKG = JSON.parse(readFileSync(join(RAIZ_REPO, 'package.json'), 'utf8'));
  const DECLARADOS = new Set([
    ...Object.keys(PKG.dependencies ?? {}),
    ...Object.keys(PKG.peerDependencies ?? {}),
  ]);

  /** `from 'x'`, `import 'x'` e `import('x')` — as três formas com que um módulo nomeia outro. */
  const ESPECIFICADOR = /(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g;

  /** O NOME DO PACOTE, não o caminho: `@scope/nome/sub.js` → `@scope/nome`; `foo/bar` → `foo`. */
  function nomeDoPacote(spec) {
    const p = spec.split('/');
    return spec.startsWith('@') ? p.slice(0, 2).join('/') : p[0];
  }

  /** Nomes de terceiros. Relativo, absoluto, `node:` e `virtual:` não são pacotes do npm — e o
   *  `virtual:` já é reprovado pelo crivo de cima, então reprová-lo aqui de novo só duplicaria o erro. */
  function especificadoresNus(linha) {
    const out = [];
    for (const m of linha.matchAll(ESPECIFICADOR)) {
      const s = m[1];
      if (s.startsWith('.') || s.startsWith('/') || s.startsWith('node:') || s.startsWith('virtual:')) continue;
      out.push(nomeDoPacote(s));
    }
    return out;
  }

  /** [módulo, linha, pacote] para tudo que os módulos embarcados nomeiam. */
  function nomeados(modulos = MODULOS) {
    const achados = [];
    for (const m of modulos) {
      for (const [n, linha] of linhasDeCodigo(fonte(m))) {
        for (const nome of especificadoresNus(linha)) achados.push([m, n, nome]);
      }
    }
    return achados;
  }

  it('[Zero] NENHUM módulo embarcado nomeia pacote fora de dependencies/peerDependencies', () => {
    const orfaos = nomeados()
      .filter(([, , nome]) => !DECLARADOS.has(nome))
      .map(([m, n, nome]) => `${m}:${n} — ${nome}`);
    expect(orfaos, 'devDependency não é instalada para quem consome: o pacote publicado não compila').toEqual([]);
  });

  it('[Right] o crivo enxerga a forma DINÂMICA, que é a forma em que o defeito veio', () => {
    const dinamica = "    import('@mintplex-labs/piper-tts-web').then(async (mod) => {";
    const estatica = "import { Application } from 'pixi.js';";
    const lateral = "import 'algum-polyfill';";
    expect(especificadoresNus(dinamica)).toEqual(['@mintplex-labs/piper-tts-web']);
    expect(especificadoresNus(estatica)).toEqual(['pixi.js']);
    expect(especificadoresNus(lateral)).toEqual(['algum-polyfill']);
  });

  it('[Right] o NOME do pacote sobrevive ao subcaminho — senão um `pixi.js/lib/x` viraria órfão', () => {
    expect(nomeDoPacote('@scope/nome/sub/coisa.js')).toBe('@scope/nome');
    expect(nomeDoPacote('pixi.js/lib/environment.mjs')).toBe('pixi.js');
    expect(nomeDoPacote('pixi.js')).toBe('pixi.js');
  });

  it('[Boundary] relativo, `node:` e `virtual:` NÃO são pacotes do npm', () => {
    expect(especificadoresNus("import * as store from './storage.js';")).toEqual([]);
    expect(especificadoresNus("import { readFileSync } from 'node:fs';")).toEqual([]);
    expect(especificadoresNus("import { FRAMES } from 'virtual:sprite-atlas';")).toEqual([]);
  });

  it('[Zero] e a recíproca: nada é declarado como dependência de execução sem alguém embarcado o nomear', () => {
    const usados = new Set(nomeados().map(([, , nome]) => nome));
    const naoUsados = [...DECLARADOS].filter((d) => !usados.has(d));
    expect(naoUsados, 'dependência de quem CONSOME que ninguém embarcado importa — se é só do app, é devDependency').toEqual([]);
  });

  it('[Exception] prosa que MENCIONA o pacote não conta — este arquivo o menciona sete vezes', () => {
    const comentada = "// a lib vem do npm: import('@mintplex-labs/piper-tts-web'), code-split pelo Vite";
    expect(linhasDeCodigo(comentada)).toEqual([]);
  });
});

// ===================================================================================================
// O TERCEIRO CRIVO: O QUE O PACOTE EMITE, ELE TEM DE DEIXAR ALCANÇAR
// ===================================================================================================
// ⚠️ O ACHADO, e ele chegou pela SEPARAÇÃO DO CARTUCHO (issue #111), não por leitura: um teste do jogo, no
// repositório novo, fez `import pt from '@the-inclusionist/engine/i18n/pt.js'` e recebeu
//
//     "./i18n/pt.js" is not exported under the conditions ["node","development","import"]
//
// O `tsconfig.pkg.json` INCLUI `app/js/i18n` — os três dicionários são emitidos e viajam no tarball — e o
// `exports` não tinha entrada para eles. Emitido e inalcançável: peso no pacote que ninguém pode usar, e uma
// porta fechada para o consumidor que quer conferir uma frase contra o dicionário em vez de contra uma cópia.
//
// ⚠️ E OS DOIS CRIVOS DE CIMA NÃO O VEEM, por construção: aquele olha o que o código NOMEIA, este olha o que
// o pacote OFERECE. São perguntas diferentes sobre o mesmo `package.json`, e a primeira estava verde.
//
// A EXCEÇÃO É `boot`, e é declarada: o único módulo dele é `create-game`, que é a entrada `.` do pacote.
// Uma camada de entrada não precisa de subcaminho — precisa de estar alcançável, e está.
describe('toda camada EMITIDA é alcançável pelo `exports` (achado da issue #111)', () => {
  const PKG = JSON.parse(readFileSync(join(RAIZ_REPO, 'package.json'), 'utf8'));
  const SUBCAMINHOS = Object.keys(PKG.exports ?? {});

  /** As camadas que o `tsconfig.pkg.json` manda emitir: `app/js/<camada>` → `<camada>`. */
  const CAMADAS_EMITIDAS = (CFG.include ?? [])
    .filter((e) => e.startsWith('app/js/'))
    .map((e) => e.slice('app/js/'.length));

  /** `boot` entra pela raiz `.` (create-game), e é a ÚNICA camada que pode não ter subcaminho próprio. */
  const PELA_RAIZ = new Set(['boot']);

  it('[Interface] o `exports` tem uma raiz `.`, e ela aponta para dentro de `boot`', () => {
    const raiz = PKG.exports?.['.'];
    const alvo = typeof raiz === 'string' ? raiz : raiz?.default;
    expect(alvo, 'sem raiz não há `import { createGame } from "@the-inclusionist/engine"`').toBeTruthy();
    expect(alvo).toContain('/boot/');
  });

  it('[Zero] NENHUMA camada emitida fica sem porta — emitido e inalcançável é peso morto', () => {
    const semPorta = CAMADAS_EMITIDAS
      .filter((c) => !PELA_RAIZ.has(c))
      .filter((c) => !SUBCAMINHOS.some((s) => s.startsWith(`./${c}/`)));
    expect(semPorta, 'camada que o tarball carrega e o consumidor não consegue importar').toEqual([]);
  });

  it('[Right] e o crivo PEGA a lacuna real que a separação encontrou', () => {
    // `i18n` era exatamente este caso em 06/09: incluída no build, ausente do `exports`. Sem esta prova, o
    // `[Zero]` acima poderia estar verde por não olhar nada.
    const semI18n = SUBCAMINHOS.filter((s) => !s.startsWith('./i18n/'));
    const faltando = CAMADAS_EMITIDAS
      .filter((c) => !PELA_RAIZ.has(c))
      .filter((c) => !semI18n.some((s) => s.startsWith(`./${c}/`)));
    expect(faltando, 'o crivo deixaria a lacuna do i18n passar').toEqual(['i18n']);
  });

  /**
   * ⚠️ A PORTA QUE PROMETE MAIS DO QUE ENTREGA, e ela é CONHECIDA e DELIBERADA — metade dela.
   *
   * `"./assets/*": "./app/public/*"` casa a pasta inteira, e o `files` embarca só `app/public/vendor`.
   * Medido no tarball 7.0.1: `assets/vendor/fonts.css` resolve; `assets/assets/sprites/…` dá 404.
   *
   * O QUE ESTÁ CERTO É A AUSÊNCIA: a arte NÃO é FOSS (pilar 10 do ADR-0010) e não pode viajar num pacote
   * AGPL. O que está errado é o PADRÃO, que promete a pasta toda — e estreitá-lo para `./assets/vendor/*`
   * mudaria o caminho de quem já escreve `engine/assets/vendor/fonts.css`, ou seja, é quebra de contrato e
   * decisão do Dev, não de quem escreve o gate. Fica como exceção NOMEADA, com o motivo, e com issue.
   */
  const PORTA_LARGA_DE_PROPOSITO = new Map([['./assets/*', 'a arte não é FOSS; só `vendor/` viaja — ver a issue']]);

  it('[Boundary] toda porta do `exports` aponta para algo que o pacote realmente EMBARCA', () => {
    // A recíproca: uma porta para uma pasta que o `files` não leva é um 404 prometido ao consumidor.
    const FILES = new Set(PKG.files ?? []);
    const problemas = [];
    for (const [sub, alvo] of Object.entries(PKG.exports ?? {})) {
      if (PORTA_LARGA_DE_PROPOSITO.has(sub)) continue;
      const destino = typeof alvo === 'string' ? alvo : alvo?.default;
      if (!destino) { problemas.push(`${sub}: sem destino`); continue; }
      const raiz = destino.replace(/^\.\//, '').split('/')[0];
      if (!FILES.has(raiz) && raiz !== 'package.json' && !FILES.has(destino.replace(/^\.\//, ''))) {
        problemas.push(`${sub} -> ${destino} (fora de \`files\`)`);
      }
    }
    expect(problemas).toEqual([]);
  });

  it('[Interface] a lista de portas largas NÃO cresce, e cada uma carrega o motivo', () => {
    // É a última saída deste crivo. Uma exceção sem motivo é afrouxamento disfarçado, e uma lista que cresce
    // é o crivo a ser desligado devagar. UMA hoje, e ela está documentada acima com a medida do tarball.
    expect(PORTA_LARGA_DE_PROPOSITO.size).toBeLessThanOrEqual(1);
    for (const [, motivo] of PORTA_LARGA_DE_PROPOSITO) expect(motivo.length).toBeGreaterThan(20);
  });
});
