// SPDX-License-Identifier: AGPL-3.0-or-later
// scripts/stamp-license.mjs — CARIMBA A LICENÇA no que vai para o tarball, e faz disso uma garantia de
// CONSTRUÇÃO em vez de um efeito colateral do compilador.
//
// ========================= O ACHADO, E ELE É SILENCIOSO =========================
// Todos os 114 fontes de engine abrem com `// SPDX-License-Identifier: AGPL-3.0-or-later`. Medido em
// 2026-09-06: TRÊS dos 112 `.js` emitidos saíam SEM ele — `core/run-state`, `render/viz-modes` e
// `ui/reach-notice`. O `tsc` anexa um comentário de topo ao primeiro nó do ficheiro, e quando esse nó é
// ELIDIDO (`import type`, e às vezes um `export type`) o comentário vai embora junto.
//
// ⚠️ E A REGRA EXATA NÃO É ENUNCIÁVEL COM CONFIANÇA: `core/contract.ts` e `render/viz-modes.ts` abrem os dois
// com `export type` e só um perdia o cabeçalho. Tentei um crivo na FONTE que previsse isso e ele acusou 24
// ficheiros quando só 3 estavam partidos — largo demais, e um gate construído sobre uma regra que ninguém
// sabe escrever é pior do que gate nenhum.
//
// ⚠️ E OS 112 `.d.ts` NÃO LEVAVAM CABEÇALHO NENHUM. O `tsc` não copia o comentário de topo para a declaração,
// então metade do que se publica viajava sem a linha — e um `.d.ts` copiado para fora do pacote é código como
// qualquer outro.
//
// ========================= POR QUE CARIMBAR, E NÃO CONSERTAR A FONTE =========================
// Uma linha em branco antes do primeiro `import type` faz o `tsc` emitir o comentário — testado, funciona. Mas
// deixa a licença dependente de um detalhe de formatação que a próxima reordenação de imports desfaz sem
// ninguém ver. Carimbar é determinístico: o que sai do build TEM a linha, quaisquer que sejam as manias do
// compilador, e cobre os `.d.ts` de graça.
//
// ⚠️ ISTO NÃO SUBSTITUI O `LICENSE` NEM O CAMPO `license`. Os dois já existem e são o que a lei e o npm leem;
// o cabeçalho por ficheiro é o que acompanha um ficheiro que alguém copie para fora — que é justamente o caso
// que a AGPL mais precisa de cobrir.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CABECALHO = '// SPDX-License-Identifier: AGPL-3.0-or-later';

/**
 * O conteúdo já carimbado. Puro, e é o que o teste exercita.
 *
 * ⚠️ IDEMPOTENTE POR DESENHO: o carimbo corre a cada build, e um segundo carimbo empilharia a linha. A
 * comparação é com a PRIMEIRA linha e não com `includes`, porque um ficheiro que MENCIONE o identificador no
 * meio (este próprio script, por exemplo) não está carimbado — está a falar do assunto.
 */
export function carimbar(texto) {
  const primeira = texto.slice(0, texto.indexOf('\n') === -1 ? texto.length : texto.indexOf('\n')).trim();
  if (primeira === CABECALHO) return texto;
  return CABECALHO + '\n' + texto;
}

/** Os `.js` e `.d.ts` de uma pasta, recursivo. */
export function emitidos(dir) {
  const saida = [];
  for (const nome of readdirSync(dir).sort()) {
    const cheio = join(dir, nome);
    if (statSync(cheio).isDirectory()) saida.push(...emitidos(cheio));
    else if (nome.endsWith('.js') || nome.endsWith('.d.ts')) saida.push(cheio);
  }
  return saida;
}

// Corre como script; importável como módulo pelo teste (o `main` do Node não bate ao ser importado).
if (process.argv[1] && process.argv[1].endsWith('stamp-license.mjs')) {
  const dir = process.argv[2] || 'dist-pkg';
  let tocados = 0;
  for (const f of emitidos(dir)) {
    const antes = readFileSync(f, 'utf8');
    const depois = carimbar(antes);
    if (depois !== antes) { writeFileSync(f, depois); tocados++; }
  }
  console.log(`[licença] ${tocados} ficheiro(s) carimbado(s) em ${dir}`);
}
