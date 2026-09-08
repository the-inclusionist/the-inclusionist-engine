#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// O RETRATO DA FORMA — a metade que o retrato de NOMES não consegue ver.
//
// ⚠️ POR QUE ISTO EXISTE. O `snapshot-public-surface.mjs` guarda os nomes que cada módulo exporta, e um nome
// que desaparece reprova. Medido em 2026-09-08 contra as quebras deste major, ele é CEGO às maiores:
//
//   · `GameDeclaration.holdsAtOnce()` passou a OBRIGATÓRIO — nome nenhum saiu, e os quatro jogos que
//     constroem a declaração deixam de compilar;
//   · `PlayerBase.visual` passou a obrigatório — idem;
//   · `SonarPlayer.viz` saiu de DENTRO da interface, que continua exportada com o mesmo nome;
//   · `PauseIconsCtx` ganhou dois campos obrigatórios e `IconStateSnapshot.viz` virou `visual`;
//   · `PhaseView.pauseOverlayHidden` saiu;
//   · e o `KeyScheme` fechou-se sobre catorze posições — um ESTREITAMENTO de união, que o gate dos nomes
//     não vê porque o nome `KeyScheme` continua lá.
//
// Nas seis, o nome exportado ficou exactamente igual. **A forma é que mudou**, e é a forma que o consumidor
// escreve no código dele.
//
// ⚠️ E A ASSIMETRIA AQUI NÃO É A MESMA do gate dos nomes. Lá, acrescentar é sempre compatível. Aqui não:
// acrescentar um membro OBRIGATÓRIO a uma interface quebra toda a gente que a constrói — foi exactamente o
// que o `holdsAtOnce` fez. Então acrescentar OPCIONAL passa em silêncio, e acrescentar OBRIGATÓRIO pede
// declaração, como pede a remoção.
//
// ⚠️ O QUE ESTE FICHEIRO NÃO É: um analisador de TypeScript. Ele conta chavetas sobre texto sem comentários,
// e há formas que lhe escapam (genéricos condicionais, uma chaveta dentro de um literal de string num tipo).
// Isso torna-o um crivo grosso e não uma prova — mas o que ele apanha, apanha antes de o major sair, e o que
// lhe escapa hoje escapava inteiro ao gate dos nomes.
//
// Uso: corre pelo `snapshot-public-surface.mjs`, que escreve os dois retratos de uma vez.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const RETRATO_FORMA = 'docs/6-DevOps-SRE/public-shape.json';

/** Fora comentários. Feito antes de contar chavetas, senão uma chaveta num comentário desalinha tudo. */
function semComentarios(txt) {
  return txt.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** O corpo entre a chaveta em `abre` e a que lhe corresponde. `null` quando não fecha. */
function corpo(txt, abre) {
  let d = 0;
  for (let i = abre; i < txt.length; i++) {
    if (txt[i] === '{') d++;
    else if (txt[i] === '}' && --d === 0) return txt.slice(abre + 1, i);
  }
  return null;
}

/** Os membros de nível 1 de um corpo de interface, com `?` a marcar o opcional. Ordenados. */
export function membrosDe(corpoTxt) {
  const fora = [];
  let d = 0;
  for (const linha of corpoTxt.split('\n')) {
    if (d === 0) {
      // ⚠️ `[k: string]: X` é assinatura de índice e não membro; começa por `[` e é deixada de fora.
      const m = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(\?)?\s*[:(<]/.exec(linha);
      if (m) fora.push(m[1] + (m[2] ? '?' : ''));
    }
    for (const c of linha) { if (c === '{') d++; else if (c === '}') d--; }
    if (d < 0) d = 0;
  }
  return [...new Set(fora)].sort();
}

/**
 * A forma de UM ficheiro: `{ 'interface Nome': ['a', 'b?'], 'type Nome': '<lado direito normalizado>' }`.
 *
 * Os aliases de tipo guardam-se pelo TEXTO do lado direito, com espaços colapsados, porque a maior parte
 * deles é união ou assinatura de função e não tem membros que se listem. É essa forma que apanha o
 * estreitamento de união — o caso do `KeyScheme`.
 */
export function formaDoTexto(fonte) {
  const txt = semComentarios(fonte);
  const fora = {};

  const reIface = /(?:^|\n)export\s+interface\s+([A-Za-z_$][\w$]*)[^{]*\{/g;
  for (let m; (m = reIface.exec(txt)) !== null;) {
    const c = corpo(txt, txt.indexOf('{', m.index + m[0].length - 1));
    if (c !== null) fora[`interface ${m[1]}`] = membrosDe(c);
  }

  const reAlias = /(?:^|\n)export\s+type\s+([A-Za-z_$][\w$]*)[^=]*=\s*([\s\S]*?);/g;
  for (let m; (m = reAlias.exec(txt)) !== null;) {
    fora[`type ${m[1]}`] = m[2].replace(/\s+/g, ' ').trim();
  }

  return fora;
}

function ficheiros(raiz, dir = raiz, fora = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) ficheiros(raiz, p, fora);
    else if (nome.endsWith('.ts')) fora.push(relative(raiz, p).split('\\').join('/'));
  }
  return fora;
}

/** A forma de toda a árvore, por módulo. Módulos sem tipo exportado nenhum não entram. */
export function formaDe(raizAppJs) {
  const fora = {};
  for (const rel of ficheiros(raizAppJs).sort()) {
    const f = formaDoTexto(readFileSync(join(raizAppJs, rel), 'utf8'));
    if (Object.keys(f).length) fora[rel] = f;
  }
  return fora;
}

/**
 * O que mudou de forma e QUEBRA quem consome.
 *
 * ⚠️ Um tipo que desapareceu inteiro NÃO entra aqui: o nome dele já é caso do gate dos nomes, e contá-lo nos
 * dois faria uma lista de seis linhas parecer doze. É o mesmo `continue` que aquele gate já tem, e pela
 * mesma razão.
 */
export function quebrasDeForma(antes, agora) {
  const fora = [];
  for (const [modulo, tipos] of Object.entries(antes)) {
    const hoje = agora[modulo];
    if (!hoje) continue; // o módulo inteiro saiu — é caso do gate dos nomes
    for (const [tipo, forma] of Object.entries(tipos)) {
      const nova = hoje[tipo];
      if (nova === undefined) continue; // o tipo saiu — idem

      if (typeof forma === 'string' || typeof nova === 'string') {
        if (forma !== nova) fora.push(`${modulo}  ${tipo}  mudou de forma: «${forma}» → «${nova}»`);
        continue;
      }

      const antesNomes = new Map(forma.map((n) => [n.replace(/\?$/, ''), n.endsWith('?')]));
      const agoraNomes = new Map(nova.map((n) => [n.replace(/\?$/, ''), n.endsWith('?')]));

      for (const [n, opcional] of antesNomes) {
        if (!agoraNomes.has(n)) fora.push(`${modulo}  ${tipo}.${n}  SAIU`);
        else if (opcional && !agoraNomes.get(n)) fora.push(`${modulo}  ${tipo}.${n}  era opcional e passou a OBRIGATÓRIO`);
      }
      for (const [n, opcional] of agoraNomes) {
        // ⚠️ Acrescentar OPCIONAL é compatível; acrescentar OBRIGATÓRIO quebra quem constrói o tipo. Foi
        // exactamente isto que o `holdsAtOnce` fez aos quatro jogos, sem nenhum nome ter desaparecido.
        if (!antesNomes.has(n) && !opcional) fora.push(`${modulo}  ${tipo}.${n}  ENTROU como obrigatório`);
      }
    }
  }
  return fora;
}
