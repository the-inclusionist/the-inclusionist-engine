// SPDX-License-Identifier: AGPL-3.0-or-later
// NENHUM MODELO DE VOZ VIAJA NO PACOTE — o primeiro gate que o ADR-0110 deve.
//
// ========================= O QUE ELE GUARDA =========================
// O ADR-0110 mediu duas entregas e o Dev escolheu a (b): a engine GARANTE quatro vozes neurais e busca-as ela
// própria no primeiro arranque, em segundo plano. A (a) — os modelos a viajar no tarball — foi recusada com
// número: ~244 MB puxados por cada `npm ci` de cada um de trezentos repositórios, a maioria dos quais nunca
// abre um navegador.
//
// ⚠️ E O REGISTO DIZ POR ESCRITO PARA QUE ISTO EXISTE: «written before the code so that the code cannot
// quietly choose D2 by putting the models in the package "just for now"». Um «só por agora» de 61 MB não se
// desfaz — passa a estar instalado em trezentos sítios antes de alguém reparar.
//
// ⚠️ E UMA ASSERÇÃO DE TAMANHO NÃO SERVE, o que o próprio registo antecipa: «aprovaria um build que embarca
// UMA voz e deriva». Pior — um tecto que só desce sobre o `vendor` COLIDIRIA COM OUTRA DECISÃO ACEITE: o
// ADR-0108 diz que oito faces Playwrite VÃO ser empacotadas, e o tecto reprovaria a entrega delas. A métrica
// certa aqui é a NATUREZA do ficheiro, não o peso.
//
// 📌 E o crivo é por INVENTÁRIO e não por busca de palavra, na forma do `fontes-empacotadas`: «isto foi
// empacotado» não se grepa no código — vê-se na árvore que o pacote leva.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const PKG = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));

/**
 * O que um MODELO DE VOZ parece, das duas fontes que o ADR-0065 §5 conhece e da que ele proíbe.
 *
 * ⚠️ `.wasm` ESTÁ AQUI E NÃO É EXAGERO: o ADR-0094 mediu 135 MB de runtime sherpa, e foi esse número que
 * decidiu que um jogo que nunca fala não o pode pagar. Um runtime empacotado é a mesma decisão revertida.
 * ⚠️ `.bin`/`.param` são a forma `ncnn`, que o ADR-0065 §5 recusa por ser outro motor de inferência — o
 * mesmo engano que os dois links do Dev traziam em 2026-09-08.
 */
const EXTENSOES_DE_MODELO = new Set(['.onnx', '.wasm', '.bin', '.param', '.tflite']);
const NOMES_DE_MODELO = /(^|[\\/])(vits-piper|sherpa|piper|kokoro|espeak-ng-data)|(^|[\\/])(tokens|lexicon)\.txt$/i;

/** As entradas de `files` que existem no disco — o pacote é o que elas alcançam. */
function arvoreDoPacote() {
  const saida = [];
  const anda = (p) => {
    if (!existsSync(p)) return;
    if (statSync(p).isDirectory()) { for (const n of readdirSync(p)) anda(join(p, n)); return; }
    saida.push(p.slice(RAIZ.length + 1).split('\\').join('/'));
  };
  for (const entrada of PKG.files ?? []) anda(join(RAIZ, entrada));
  return saida;
}

const extensaoDe = (p) => { const i = p.lastIndexOf('.'); return i < 0 ? '' : p.slice(i).toLowerCase(); };

describe('ADR-0114 · e ONDE o runtime vendorizado tem de ficar, que não é o sítio óbvio', () => {
  // 🔴 A ARMADILHA, MEDIDA EM 2026-09-09 e escrita aqui porque é aqui que alguém vai estar quando o gate
  // acima disparar. O ADR-0114 diz que um runtime pesado é «vendorizado no `dist` da aplicação, não no
  // pacote npm». O sítio óbvio para o pôr é `app/public/vendor/` — onde já vivem as fontes — e esse é
  // exactamente o sítio que o pacote PUBLICA.
  //
  // 📏 Provado plantando um `.wasm` lá: o caso acima reprova, nomeando o ficheiro. O que ele não diz, e este
  // bloco diz, é PARA ONDE ir em vez disso.

  it('🔴 [Interface] `app/public/vendor` VIAJA no pacote — é por isso que vendorizar ali reprova', () => {
    expect(PKG.files, 'a lista de `files` mudou de forma; releia este bloco antes de confiar nele')
      .toContain('app/public/vendor');
  });

  // 🎯 E O CAMINHO CERTO: `app/public/` é o `publicDir` do Vite (a raiz da build é `app`), logo tudo o que
  // está lá é copiado tal e qual para `dist/` — e o `files` publica APENAS o `vendor` de dentro dele. Um
  // runtime em `app/public/<qualquer outra pasta>/` chega ao PWA e ao precache sem entrar no `npm ci` de
  // trezentos repositórios, que é as duas metades do que o ADR-0114 pede.
  it('🎯 [Interface] `app/public` chega ao `dist` e NÃO é publicado, tirando o `vendor`', () => {
    const publicados = (PKG.files ?? []).filter((f) => f.startsWith('app/public'));
    expect(publicados, 'o `app/public` inteiro passou a ser publicado — um runtime ali iria no pacote')
      .toEqual(['app/public/vendor']);

    // ⚠️ E a outra metade da afirmação é sobre o BUILD, não sobre o `package.json`: o que está em
    //    `app/public` aparece em `dist`. Afirmado sobre a árvore construída, e não sobre a configuração —
    //    ler o `publicDir` do `vite.config` mediria a intenção; ler o `dist` mede o que aconteceu.
    const noPublic = readdirSync(join(RAIZ, 'app', 'public'));
    // ⚠️ O VÁCUO PRIMEIRO: com `app/public` vazio o laço abaixo não afirmaria nada e o caso ficaria verde a
    //    olhar para o nada — que é a forma como esta afirmação deixaria de valer sem ninguém reparar.
    expect(noPublic.length, '`app/public` está vazio: o laço abaixo não mede nada').toBeGreaterThan(0);
    const noDist = existsSync(join(RAIZ, 'dist')) ? readdirSync(join(RAIZ, 'dist')) : null;
    if (noDist === null) return; // sem build nesta árvore: a afirmação do `files` acima já vale por si
    for (const nome of noPublic) {
      expect(noDist, `${nome} está em app/public e não chegou ao dist`).toContain(nome);
    }
  });
});

describe('ADR-0110 · a engine BUSCA as vozes, não as embarca', () => {
  const ARVORE = arvoreDoPacote();

  it('🎯 [Zero] nenhum ficheiro de MODELO ou de RUNTIME de voz viaja no pacote', () => {
    const presos = ARVORE.filter((p) => EXTENSOES_DE_MODELO.has(extensaoDe(p)) || NOMES_DE_MODELO.test(p));
    expect(
      presos,
      'modelo ou runtime de voz dentro do que o `npm pack` leva. O ADR-0110 escolheu a entrega (b) — a engine '
      + 'GARANTE as quatro vozes e busca-as no primeiro arranque —, e a (a) foi recusada com número: ~244 MB '
      + 'por cada `npm ci` de trezentos repositórios. Se a entrega tiver mesmo de mudar, o caminho é um '
      + 'registo que supersede o ADR-0110, não um ficheiro.',
    ).toEqual([]);
  });

  it('⚠️ [Interface] e a varredura está VIVA: ela lê a árvore que o pacote leva de verdade', () => {
    // Sem isto, um `files` mal lido ou um caminho errado deixariam o caso acima verde por não ter nada que
    // examinar — a forma de verde falso que este repositório já apanhou mais de uma vez.
    expect(PKG.files?.length, '`files` deixou de existir no package.json').toBeGreaterThan(0);
    expect(ARVORE.length, 'a varredura não achou ficheiro nenhum do pacote').toBeGreaterThan(20);
    // e o detector reconhece o defeito quando ele existe, em vez de nunca casar com nada
    expect(EXTENSOES_DE_MODELO.has(extensaoDe('app/public/vendor/vits-piper-pt_BR-faber-medium/model.onnx'))).toBe(true);
    expect(NOMES_DE_MODELO.test('app/public/vendor/sherpa-onnx-wasm-main.js')).toBe(true);
    expect(NOMES_DE_MODELO.test('app/public/vendor/andika-400.woff2')).toBe(false);
  });

  it('📌 [Right] o que o pacote LEVA hoje continua a ser fonte e folha de estilo', () => {
    // O outro lado do crivo: sem ele, apagar o `vendor` do `files` faria o caso de cima passar por vacuidade —
    // e as fontes que a criança precisa de ler desapareciam do pacote sem nada reprovar.
    const woff2 = ARVORE.filter((p) => extensaoDe(p) === '.woff2');
    expect(woff2.length, 'as fontes empacotadas sumiram do pacote').toBeGreaterThan(10);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Tres, todas mortas. ⚠️ E a primeira NAO E UMA EDICAO DE CODIGO: ela PLANTA o defeito na arvore —
// `app/public/vendor/vits-piper-pt_BR-faber-medium/model.onnx` — e apaga-o a seguir. Um crivo de inventario
// so se prova assim; mutar a regex prova que o detector esta vivo, nao que ele apanha a coisa real.
//
//   1. um modelo de voz a aparecer no `vendor` -> reprova o [Zero]. E o «so por agora» de 61 MB, exactamente
//      como o ADR-0110 o descreve.
//   2. o detector de extensoes morto -> reprova o [Interface]. Sem esse caso, um detector cego passaria por
//      nao achar nada, que e a forma de verde falso deste tipo de gate.
//   3. o `files` do package.json a perder o `vendor` -> reprova o caso das FONTES. ⚠️ Ele existe por causa da
//      assimetria: sem ele, apagar o `vendor` do pacote faria o [Zero] passar por VACUIDADE, e as fontes de
//      que a crianca precisa para LER sumiam do pacote sem nada reprovar. Um crivo de ausencia precisa sempre
//      do irmao que afirma o que TEM de continuar la.
