// SPDX-License-Identifier: AGPL-3.0-or-later
// O SOMBREAMENTO DO TRADUTOR, como gate (project node: só lê arquivos).
//
// `t` é o tradutor de core/i18n. Um local chamado `t` no mesmo escopo o esconde, e a chamada `t('sr.algo')`
// deixa de traduzir para virar "chamar um número" ou "chamar um HTMLElement". Cinco vezes já:
// `tmTitleHtml(t)`, `lqName(t)`, `reflect(t)`, `const t = ctx.$(…)` e, hoje, `const t = e.timeStamp` no
// duplo-toque da bolinha indicadora — que é a ÚNICA saída visível de quem ligou a simulação de cegueira.
//
// POR QUE O GATE SÓ OLHA `.js`, E ISSO É O PONTO:
//
//   Em TypeScript o compilador JÁ PEGA. Sombrear `t` com um `HTMLElement` e depois chamá-lo é TS2349, e foi
//   assim que as quatro primeiras apareceram. Hoje há cinco arquivos `.ts` que sombreiam `t` sem risco nenhum,
//   porque nenhum deles CHAMA o `t` sombreado — e se chamasse, não compilaria. Proibir lá seria renomear cinco
//   variáveis para proteger contra o que já está protegido.
//
//   Em JavaScript não há quem pegue. `main.js` é o único `.js` do projeto que importa o tradutor, e é o mesmo
//   arquivo que já escapou de quatro contratos pelo mesmo motivo: `tsc` não o lê e a suíte não o exercita.
//   Este gate é a rede debaixo dessa lacuna específica, e ele some sozinho no dia em que o `main.js` virar
//   TypeScript — que é a razão de o ADR-0027 querer o `createGame()` tipado.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');
const CR = String.fromCharCode(13);
const fonte = (f) => readFileSync(join(RAIZ, f), 'utf8').split(CR).join('');

/** Só os `.js` da raiz de app/js — hoje `main.js`, e é dele que se trata. */
const JS = readdirSync(RAIZ).filter((f) => f.endsWith('.js'));

// O `import` do main.js é `import i18n, { t } from './core/i18n.js'` — DEFAULT mais nomeado. A primeira
// versão desta regex exigia a chave logo depois de `import`, e por isso não achava nada: o gate ficava verde
// por não estar olhando. Quem denunciou foi o caso [Zero] abaixo, que existe exatamente para isso — um gate
// que não olha nada é indistinguível de um gate satisfeito.
const IMPORTA_T = /import\s+[^;]*\{[^}]*\bt\b[^}]*\}\s*from\s*'[^']*i18n\.js'/;
const DECLARA_T = /(?:\bconst\s+t\s*=|\blet\s+t\s*=|\bvar\s+t\s*=)/;

/** Linhas de código: sem comentário de bloco, de linha, nem de fim de linha. */
function linhasDeCodigo(texto) {
  const out = [];
  let bloco = false;
  texto.split('\n').forEach((ln, i) => {
    const s = ln.trim();
    if (bloco) { if (s.includes('*/')) bloco = false; return; }
    if (s.startsWith('/*')) { if (!s.includes('*/')) bloco = true; return; }
    if (s.startsWith('//') || s.startsWith('*')) return;
    out.push([i + 1, ln.replace(/\/\/.*$/, '')]);
  });
  return out;
}

describe('nenhum `.js` sombreia o tradutor `t`', () => {
  it('[Right] quem importa `t` de core/i18n não declara um `t` local', () => {
    const achados = JS.filter((f) => IMPORTA_T.test(fonte(f)))
      .flatMap((f) => linhasDeCodigo(fonte(f))
        .filter(([, ln]) => DECLARA_T.test(ln))
        .map(([n, ln]) => `${f}:${n}  ${ln.trim()}`));
    // A falha CITA a linha: o nome tem uma letra e aparece dezenas de vezes por arquivo; sem a linha, quem
    // for consertar procura no escuro.
    expect(achados, '`t` local esconde o tradutor — renomeie o local').toEqual([]);
  });

  it('[Zero] o gate está olhando algum arquivo de verdade', () => {
    // Sem isto, o caso acima passaria para sempre no dia em que a pasta mudasse de forma ou o import fosse
    // reescrito — verde por não ter olhado nada, que é o pior jeito de um gate falhar.
    expect(JS.length).toBeGreaterThan(0);
    expect(JS.filter((f) => IMPORTA_T.test(fonte(f))).length).toBeGreaterThan(0);
  });
});
