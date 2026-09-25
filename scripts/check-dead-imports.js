#!/usr/bin/env node
// Finds named imports left unused in a `.js` file — by default `app/js/main.js`.
//
//     node scripts/check-dead-imports.js [file]
//
// ⚠️ The default target left with the game (ADR-0036): `app/js/main.js` is not in this tree, so run with no argument
// the script cannot read it and exits 2. Pass a file.
//
// Why it exists: a `.js` file is not typechecked by `tsc`, which does not complain about an unused import; nor does the
// bundler. A dead import goes through build, tests and browser with no symptom at all, and extractions leave them
// behind.
//
// Identifier boundary by lookaround, not `\b`: `$` and `$$` are not word characters, and with `\b` both showed up as
// dead while being the most used selectors of the file.
//
// A COMMENT IS NOT A USE. Scanning the raw body would count a name cited in a trail comment (`// X/Y extracted to
// core/foo.js`) as a reference, so the checker would get MORE blind the better the code explained itself — worse than
// none. Hence `semComentarios`: a character scanner, and not a regex, because `//` inside a string ('https://...',
// 'url(#...)') opens no comment, and cutting the line there would hide the rest of it from the check.
import { readFileSync } from 'node:fs'; // package.json declares type:module

const alvo = process.argv[2] || 'app/js/main.js';
let src;
try { src = readFileSync(alvo, 'utf8'); }
catch (e) { console.error('could not read ' + alvo + ' — ' + e.message); process.exit(2); }

/**
 * Erases line and block comments, keeping what is inside a string or template.
 * Replaces them with spaces (keeping the line breaks) so that identifier boundaries do not stick together.
 * Regular-expression literals are not tracked: at worst the scanner cuts TOO MUCH, and cutting too much can only raise
 * a false alarm — never silence, which is the failure that matters here.
 */
function semComentarios(txt) {
  let out = '', i = 0, aspas = null;
  while (i < txt.length) {
    const c = txt[i], d = txt[i + 1];
    if (aspas) {
      if (c === '\\') { out += '  '; i += 2; continue; }    // escape: consumes the pair
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

// Removes whole import DECLARATIONS, not the LINES that start with `import`: an import broken over two lines left its
// continuation in the body, and the names written there counted as uses of the very names that declaration imports.
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
    if (!re.test(corpo)) { console.log('DEAD IMPORT: ' + nome + '  <- ' + m[2]); mortos++; }
  }
}
console.log(mortos === 0 ? 'no dead import' : mortos + ' dead imports');
process.exit(mortos === 0 ? 0 : 1);
