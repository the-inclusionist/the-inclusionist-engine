#!/usr/bin/env node
// Acha import nomeado que ficou sem uso em app/js/game.js.
//
//     node scripts/check-dead-imports.js [arquivo]
//
// Por que existe: `game.js` é `.js`, então o `tsc` não o typecheca e não reclama de import não usado; o
// bundler tampouco. Um import morto atravessa build, testes e navegador sem sintoma nenhum. A cada extração
// alguns nomes deixam de ser usados aqui, e sem isto eles se acumulam — quinze de uma vez, na primeira
// passada, resíduo de várias ondas.
//
// Fronteira de identificador por lookaround, não por `\b`: `$` e `$$` não são caracteres de palavra, e com
// `\b` os dois apareciam como mortos enquanto são os seletores mais usados do arquivo.
import { readFileSync } from 'node:fs'; // o package.json declara type:module

const alvo = process.argv[2] || 'app/js/game.js';
let src;
try { src = readFileSync(alvo, 'utf8'); }
catch (e) { console.error('não consegui ler ' + alvo + ' — ' + e.message); process.exit(2); }

const corpo = src.split('\n').filter((l) => !/^import\s/.test(l)).join('\n');
const escapa = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let mortos = 0;
for (const m of src.matchAll(/^import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+'([^']+)';/gm)) {
  for (let nome of m[1].split(',')) {
    nome = nome.trim().replace(/^type\s+/, '');
    if (!nome) continue;
    if (nome.includes(' as ')) nome = nome.split(' as ').pop().trim();
    if (!nome) continue;
    const re = new RegExp('(?<![\\w$])' + escapa(nome) + '(?![\\w$])');
    if (!re.test(corpo)) { console.log('IMPORT MORTO: ' + nome + '  <- ' + m[2]); mortos++; }
  }
}
console.log(mortos === 0 ? 'nenhum import morto' : mortos + ' imports mortos');
process.exit(mortos === 0 ? 0 : 1);
