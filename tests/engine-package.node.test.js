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

  it('[Right] `render/sprites` está FORA do pacote — é o módulo que importa `virtual:sprite-atlas`', () => {
    expect(EXCLUIDOS.has('app/js/render/sprites.ts')).toBe(true);
    expect(/from\s*['"]virtual:sprite-atlas['"]/.test(fonte('app/js/render/sprites.ts'))).toBe(true);
  });

  it('[Boundary] e ele PODE ficar de fora: nenhum módulo embarcado o importa', () => {
    const importadores = MODULOS.filter((m) =>
      linhasDeCodigo(fonte(m)).some(([, l]) => /from\s*['"][^'"]*render\/sprites\.js['"]/.test(l)));
    expect(importadores, 'excluir um módulo que alguém embarcado importa quebra o pacote').toEqual([]);
  });

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
