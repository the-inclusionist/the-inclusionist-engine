// SPDX-License-Identifier: AGPL-3.0-or-later
// NENHUM CDN ESCRITO À MÃO — o gate que o ADR-0114 deve, e o único dos cinco que já morde hoje.
//
// ========================= A REGRA =========================
// O ADR-0114 decidiu que um runtime pesado viaja COM o PWA — vendorizado no `dist` da aplicação e
// pré-cacheado pelo service worker — e que só os MODELOS vêm da rede. A consequência imediata é que a engine
// não pode ter um endereço externo escrito à mão dentro do código: um `<script src="https://…">` é uma
// dependência de rede no primeiro uso, e a escola sem rede não recebe nada.
//
// 📏 MEDIDO EM 2026-09-08: a engine tem exactamente TRÊS URLs absolutas em código, e só UMA delas é uma busca.
// As outras duas são o espaço de nomes do SVG (`http://www.w3.org/2000/svg`), que o `createElementNS` exige e
// que **nunca toca na rede**. Excluí-las é a diferença entre um crivo e um alarme que alguém desliga — e a
// exclusão é uma REGRA escrita, não um silêncio.
//
// ========================= ⚠️ O DETECTOR QUASE MENTIU, E O ERRO ERA MEU =========================
// 🔴 A primeira varredura devolveu **ZERO** e eu quase reportei «não há CDN escrito à mão». O tira-comentários
// era `replace(/\/\/[^\n\r]*/g, '')` — e **toda URL tem `//` dentro**. Ele via `https:` e apagava
// `//webgazer.cs.brown.edu/webgazer.js'; s.async = true;` como se fosse comentário. O crivo comia exactamente
// aquilo que existe para caçar.
//
// 📌 É a segunda vez que um tira-comentários engana este repositório (a primeira deixava passar comentário no
// fim da linha), e a lição é a mesma dos resultados vazios: **uma varredura que devolve zero prova o detector,
// não a árvore.** O caso do vácuo aqui embaixo é o que impede a repetição — ele exige que a varredura ache as
// três, incluindo os dois espaços de nomes que ela depois recusa.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));

/**
 * AS BUSCAS EXTERNAS ESCRITAS À MÃO QUE AINDA EXISTEM, e por que cada uma continua aqui.
 *
 * ⚠️ A LISTA TEM DE ENCOLHER. Uma entrada nova sem razão escrita à mão é a engine a ganhar uma dependência de
 * rede sem ninguém decidir — que é exactamente como esta chegou.
 */
const BUSCAS_A_MAO = {
  'ui/webcam.ts':
    'o WebGazer, carregado por `<script src>` de `webgazer.cs.brown.edu` no primeiro uso do controle por ' +
    'olhar. É a única busca de runtime externo da engine e a razão de a issue #129 existir. O ADR-0114 ' +
    'retira-a: o runtime passa a ser vendorizado no `dist` e pré-cacheado. ' +
    '📌 Ele já AVISA quando falha (`srAlert(sr.eyes.needsInternet)`), o que é melhor do que silêncio e não ' +
    'satisfaz o pilar 8 — a criança continua sem controle por olhar numa escola sem rede. ' +
    'Sai daqui quando a vendorização existir.',
};

/**
 * ⚠️ ESPAÇOS DE NOMES XML NÃO SÃO BUSCAS, e a exclusão é por PREFIXO e com razão escrita, não caso a caso.
 * `http://www.w3.org/2000/svg` é o argumento obrigatório do `createElementNS`; o navegador nunca o resolve.
 * Acusá-los faria o gate reprovar duas linhas correctas do `render/` e ser desligado antes de apanhar a real.
 */
const NAO_E_BUSCA = 'http://www.w3.org/';

function ficheiros(dir = RAIZ, pref = '') {
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { out.push(...ficheiros(p, `${pref}${n}/`)); continue; }
    if (n.endsWith('.ts') && !n.endsWith('.d.ts')) out.push(`${pref}${n}`);
  }
  return out;
}

/**
 * ⚠️ O `(^|[^:])` É O CONSERTO, e sem ele este ficheiro não mede nada. Um `//` precedido de `:` é o dobro
 * da barra de um esquema (`https://`), nunca o início de um comentário.
 */
function semComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n\r]*/g, '$1');
}

const URL_EM_LITERAL = /['"`](https?:\/\/[^'"`]+)['"`]/g;

/** Toda URL absoluta que aparece num literal de string, em código — inclusive as que não são buscas. */
function urlsEmCodigo() {
  const achados = [];
  for (const f of ficheiros()) {
    const src = semComentarios(readFileSync(join(RAIZ, f), 'utf8'));
    for (const m of src.matchAll(URL_EM_LITERAL)) achados.push({ f, url: m[1] });
  }
  return achados;
}

const TODAS = urlsEmCodigo();
const BUSCAS = TODAS.filter((a) => !a.url.startsWith(NAO_E_BUSCA));

describe('nenhum CDN escrito à mão · o inventário encolhe', () => {
  // 🎯 O CASO DO VÁCUO, e ele é o primeiro porque é o que apanha o defeito que eu cometi: se o detector
  // voltar a comer as URLs, TODAS fica vazia e o caso feliz fica verde a olhar para nada.
  it('🎯 [Vácuo] a varredura acha as três URLs de código, os dois espaços de nomes incluídos', () => {
    expect(TODAS.length, 'o tira-comentários voltou a comer as URLs — ver o cabeçalho').toBeGreaterThanOrEqual(3);
    expect(TODAS.filter((a) => a.url.startsWith(NAO_E_BUSCA)).length, 'os espaços de nomes do SVG sumiram').toBe(2);
  });

  it('[Feliz] nenhuma busca externa nova, e as que há estão declaradas', () => {
    const novas = BUSCAS.filter((a) => !(a.f in BUSCAS_A_MAO));
    const desc = novas.map((a) => `${a.f} → ${a.url}`);
    expect(desc, `busca externa que ninguém declarou: ${desc.join(' · ')}`).toEqual([]);
  });

  // ⚠️ A SAÍDA. Sem ela a lista vira monumento: a entrada do WebGazer continuaria a dizer que existe uma
  // dependência de rede depois de o ADR-0114 a ter retirado, e a próxima pessoa leria história como estado.
  it('[Fronteira] entrada da lista que já não busca nada sai daqui', () => {
    const resolvidas = Object.keys(BUSCAS_A_MAO).filter((f) => !BUSCAS.some((a) => a.f === f));
    expect(resolvidas, `já não faz busca externa; apague a entrada: ${resolvidas.join(', ')}`).toEqual([]);
  });

  // 📌 O PAR que prova que a exclusão é uma REGRA e não um buraco: um espaço de nomes é aceite, e uma URL
  // qualquer no MESMO ficheiro não seria.
  it('[Fronteira] o espaço de nomes do SVG é aceite; qualquer outra URL do mesmo ficheiro não seria', () => {
    const svg = TODAS.filter((a) => a.url === 'http://www.w3.org/2000/svg');
    expect(svg.length, 'o `createElementNS` deixou de usar o espaço de nomes').toBe(2);
    for (const a of svg) expect(BUSCAS.some((b) => b.f === a.f && b.url === a.url)).toBe(false);
    expect(NAO_E_BUSCA.startsWith('http://www.w3.org/'), 'a exclusão é por prefixo do W3C, não uma lista').toBe(true);
  });

  it('[Interface] `import()` dinâmico não traz especificador não-relativo', () => {
    const maus = [];
    for (const f of ficheiros()) {
      const src = semComentarios(readFileSync(join(RAIZ, f), 'utf8'));
      for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        if (!m[1].startsWith('.')) maus.push(`${f} → ${m[1]}`);
      }
    }
    expect(maus, `a engine passou a importar de fora por caminho dinâmico: ${maus.join(' · ')}`).toEqual([]);
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-08, por script, com contagem de ocorrências) =====
// 1. tirar `ui/webcam.ts` de `BUSCAS_A_MAO`            → [Feliz] reprova, nomeando a URL do WebGazer
// 2. acrescentar uma entrada já resolvida à lista      → [Fronteira] da saída reprova
// 3. `semComentarios` sem o `(^|[^:])` (o meu defeito) → reprovam o [Vácuo], a SAÍDA e o par. 🎯 E o que
//    interessa é qual NÃO reprova: o **[Feliz] fica verde**, porque uma lista vazia não tem entradas novas —
//    que é exactamente a forma como eu quase reportei «não há CDN escrito à mão». A regra sozinha não apanha
//    um crivo cego; quem o apanha é o vácuo. Medido, e diferente do que eu tinha previsto (eu escrevera que
//    só o vácuo reprovava).
// 4. `NAO_E_BUSCA` → 'http://www.w3.org/2000/svg' exacto → sobrevive: EQUIVALÊNCIA MEDIDA, porque hoje as duas
//    ocorrências são exactamente essa. Fica registada em vez de apagada — o prefixo cobre `1999/xlink` e os
//    outros namespaces do W3C no dia em que um deles aparecer, e apertá-lo agora não reprova nada.
// 5. `NAO_E_BUSCA` → 'http://'                          → [Fronteira] do par reprova, e devia: excluir todo
//    `http://` deixaria passar um CDN em texto plano, que é pior do que o que este gate caça.
