#!/usr/bin/env node
// Acha import nomeado que ficou sem uso em app/js/main.js.
//
//     node scripts/check-dead-imports.js [arquivo]
//
// Por que existe: `main.js` é `.js`, então o `tsc` não o typecheca e não reclama de import não usado; o
// bundler tampouco. Um import morto atravessa build, testes e navegador sem sintoma nenhum. A cada extração
// alguns nomes deixam de ser usados aqui, e sem isto eles se acumulam — quinze de uma vez, na primeira
// passada, resíduo de várias ondas.
//
// Fronteira de identificador por lookaround, não por `\b`: `$` e `$$` não são caracteres de palavra, e com
// `\b` os dois apareciam como mortos enquanto são os seletores mais usados do arquivo.
//
// COMENTARIO NAO E USO. A primeira versao varria o corpo cru e dava o arquivo por limpo enquanto dezenas de
// imports estavam mortos: cada extracao deixa para tras uma linha de trilha do tipo `// X/Y extraidos p/
// core/foo.js`, e o nome citado ali contava como referencia. O ponto cego crescia na mesma proporcao em que a
// refatoracao se documentava — um conferidor que fica MAIS cego quanto melhor o codigo se explica e pior que
// nenhum. Dai `semComentarios`: um varredor de caractere, e nao um regex, porque `//` dentro de string
// ('https://...', 'url(#...)') nao abre comentario e cortar a linha ali esconderia o resto dela do exame.
import { readFileSync } from 'node:fs'; // o package.json declara type:module

const alvo = process.argv[2] || 'app/js/main.js';
let src;
try { src = readFileSync(alvo, 'utf8'); }
catch (e) { console.error('não consegui ler ' + alvo + ' — ' + e.message); process.exit(2); }

/**
 * Apaga comentarios de linha e de bloco, preservando o que estiver dentro de string ou template.
 * Troca por espaco (mantendo as quebras) para que fronteiras de identificador nao se colem.
 * Literais de expressao regular nao sao rastreados: no pior caso o varredor corta a MAIS, e cortar a mais so
 * pode gerar alarme falso — nunca silencio, que e a falha que importa aqui.
 */
function semComentarios(txt) {
  let out = '', i = 0, aspas = null;
  while (i < txt.length) {
    const c = txt[i], d = txt[i + 1];
    if (aspas) {
      if (c === '\\') { out += '  '; i += 2; continue; }    // escape: consome o par
      if (c === aspas) aspas = null;
      out += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { aspas = c; out += c; i++; continue; }
    if (c === '/' && d === '/') { while (i < txt.length && txt[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && d === '*') {
      i += 2; out += '  ';
      while (i < txt.length && !(txt[i] === '*' && txt[i + 1] === '/')) { out += txt[i] === '\n' ? '\n' : ' '; i++; }
      i += 2; out += '  '; continue;
    }
    out += c; i++;
  }
  return out;
}

// Tira as DECLARACOES de import inteiras, e nao as LINHAS que comecam com `import`: um import quebrado em
// duas linhas deixava a continuacao dentro do corpo, e os nomes escritos ali contavam como uso dos proprios
// nomes que aquela declaracao importa. Dois mortos sobreviveram assim, invisiveis ate a declaracao ser
// reescrita numa linha so.
const corpo = semComentarios(src.replace(/^import\s[^;]*;/gm, ''));
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
