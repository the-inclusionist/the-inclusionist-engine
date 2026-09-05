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
