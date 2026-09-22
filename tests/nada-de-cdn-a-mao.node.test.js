// SPDX-License-Identifier: AGPL-3.0-or-later
// NENHUMA BUSCA EXTERNA ESCRITA À MÃO — o inventário que estrangula por onde a engine toca na rede.
//
// ========================= A REGRA, REESCRITA EM 2026-09-09 =========================
// 🔴 A REGRA QUE ESTAVA AQUI FOI REVOGADA PELO ADR-0116, e deixá-la seria o defeito que este repositório
// persegue: um gate a argumentar por uma decisão que já não existe. Ela dizia — «um `<script src="https://…">`
// é uma dependência de rede NO PRIMEIRO USO, e a escola sem rede não recebe nada». O Dev derrubou a premissa:
// «NÃO FAZ SENTIDO BAIXAR ALGO VIA PWA, E CONSIDERAR QUE SE É PRA USAR VIA PWA OFFLINE NÃO É PRA BAIXAR NADA
// NO PRIMEIRO USO!» Um PWA chega pela rede; isso É a instalação. O pilar 8 passou a dizer o que mede:
// **PWA no primeiro dia ONLINE, depois OFFLINE-FIRST.**
//
// 📌 A REGRA NOVA É SOBRE TEMPO E NÃO SOBRE ORIGEM: **pré-cacheado na instalação, nunca buscado com preguiça
// no primeiro uso.** Um runtime de CDN fixada por versão, listado no manifesto de precache, é admissível — foi
// o que o Dev pediu desde o início («se conseguir usar cdnjs/jsdelivr é ótimo»). O que continua proibido é o
// endereço que só é buscado quando a criança carrega no botão, porque esse não estava lá no dia da instalação.
//
// ⚠️ E O VEREDICTO SOBRE O `ui/webcam.ts` NÃO MUDOU — mudou a razão. Aquele `<script src>` dispara no primeiro
// uso do controle por olhar, logo é busca preguiçosa, com CDN ou sem CDN. A regra velha condenava-o pelo host;
// a nova condena-o pelo MOMENTO, que é o que sempre esteve errado nele.
//
// 📌 ESTE CRIVO É A METADE DA FONTE. A outra metade — «e está mesmo no manifesto?» — só se afere depois de um
// build, e vive no `scripts/check-precache.mjs`, que desde `af35a7d` exige que uma entrada externa seja
// FIXADA e tenha peso declarado. Nenhum dos dois responde sozinho: aqui vê-se quem escreve um endereço, lá
// vê-se se ele chegou à instalação.
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
/**
 * ⚠️ A DESCULPA CARREGA UMA CONTAGEM, E NÃO SÓ UMA RAZÃO — medido em 2026-09-09, e a razão é um defeito que
 * este ficheiro tinha e que a sua própria entrada descrevia.
 *
 * O ADR-0114 pede que «o host dos modelos seja nomeado NUM SÍTIO SÓ». A lista, indexada por FICHEIRO,
 * afirmava isso à granularidade errada: I planted a second host in the module that named the models' host —
 * an `export const ESPELHO` for a CDN, que é exactamente o
 * movimento de quem constrói o buscador e quer um espelho para a escola — e os CINCO casos ficaram verdes.
 * O ficheiro já estava desculpado, então tudo o que crescesse dentro dele estava desculpado com ele.
 *
 * 📌 Com o número, «um sítio só» passa a ser afirmado como UM. Ele é um TECTO QUE SÓ DESCE: subir exige
 * mexer aqui e escrever porquê; descer exige actualizar o número, que é como o inventário encolhe.
 */
const BUSCAS_A_MAO = {
  'platform/kokoro.ts': {
    urls: 1,
    porque:
      'ENDEREÇO DECLARADO, not a fetch: the Kokoro model repository (ADR-0186, ADR-0198), named once so the catalogue and a game\'s '
      + 'port build the same paths; the module is pure. The build fetches the files into the delivery (ADR-0177); the page asks for '
      + 'them at `heavy/`. A second host here would be a mirror chosen in silence',
  },
  'platform/heavy-mirror.ts': {
    // 8 → 10 with the command models and their runtime (issue #184): two more FOLDERS of the same mirror, not two more suppliers.
    urls: 10,
    porque:
      'ENDEREÇOS DECLARADOS, not fetches: the table that maps each address the catalogue already names to the folder a mirror '
      + 'serves it under (the Dev, 2026-09-21: a base for local testing, for the project\'s bucket, or for a school\'s own '
      + 'server). The module is pure — it returns a string. Every one is already in `pesados-catalogo`, and an address here that '
      + 'is not there would be a mirror of something nobody catalogued. 📌 THREE are the reading models (ADR-0201 erratum, issue '
      + '#185), folder by folder, and their upstream IS the project\'s own mirror because both exports were made here — listing '
      + 'them is what lets a build read 850 MiB from the staging tree instead of over a school\'s link. 📌 The other TWO are what '
      + 'the project does NOT mirror and why (the voice runtime: espeak-ng is GPL and a mirror obliges publishing its source, '
      + 'issue #192) — named so that «fetched upstream even with a base» is a written decision and not an omission',
  },
  'platform/pesados-catalogo.ts': {
    urls: 5,
    porque:
      'OS RUNTIMES QUE A ENGINE PASSOU A DESCER NA INSTALAÇÃO (ADR-0124, ADR-0132, decisões do Dev ' +
      'de 2026-09-09). ⚠️ CDN FIXADA É PERMITIDA e o ADR-0116 diz porquê: o pilar 8 proíbe depender da rede ' +
      'DEPOIS do primeiro dia, e isto desce com tudo o resto na instalação. ' +
      '📌 The `2` is TWO ORIGINS, each defensible on its own: (1) `@mediapipe/tasks-vision` ' +
      'em jsDelivr — o runtime de visão; (2) `storage.googleapis.com/mediapipe-models` — os modelos `.task`, ' +
      'que vivem noutro host porque o Google os publica assim, e sem eles o runtime não reconhece nada. ' +
      'WebGazer (`webgazer.cs.brown.edu`) left with ADR-0214. ' +
      '📌 TWO are the voice runtime (ADR-0216): espeak-ng and onnxruntime-web, both on jsDelivr — the ' +
      'same origin already defended above, and written here so the engine imports nothing from npm at run time. ' +
      '📌 The FIFTH is the project\'s own mirror (ADR-0203), which is not a third party: the reading models live there because ' +
      'both ONNX exports were made by this project and have no upstream to point at (ADR-0201 erratum, issue #185). ' +
      'A SIXTH address, or a new origin, is a supplier entering without a decision. They leave this list when the bytes are ' +
      'servidos de origem própria',
  },
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

  /* 🎯 O CASO QUE FALTAVA, e o defeito que ele apanha estava DENTRO da desculpa. «Num sítio só» era afirmado
   * por FICHEIRO: com o ficheiro na lista, uma segunda URL dentro dele passava. Provado plantando um
   * `ESPELHO` jsDelivr ao lado do `HOST_DOS_MODELOS` — cinco casos verdes, e a cláusula do ADR-0114 morta.
   *
   * ⚠️ E o sítio onde ele morde é o único sítio onde isto vai acontecer: quem ligar o buscador da #129 tem
   * um problema real de escola sem rede e um espelho é a resposta óbvia. O gate não a proíbe — obriga-a a
   * passar por aqui, com o número e a razão, em vez de aparecer como uma linha a mais num ficheiro puro. */
  it('🎯 [Fronteira] um ficheiro desculpado não pode ganhar uma SEGUNDA URL', () => {
    const aMais = [];
    for (const [f, { urls }] of Object.entries(BUSCAS_A_MAO)) {
      const suas = BUSCAS.filter((a) => a.f === f).map((a) => a.url);
      if (suas.length > urls) aMais.push(`${f}: ${urls} declarada(s), ${suas.length} achada(s) → ${suas.join(' · ')}`);
    }
    expect(aMais, `URL nova isInside de um ficheiro já desculpado: ${aMais.join(' | ')}`).toEqual([]);
  });

  // ⚠️ A SAÍDA, e agora ela tem DUAS metades. Sem elas a lista vira monumento: a entrada do WebGazer
  // continuaria a dizer que existe uma dependência de rede depois de o ADR-0114 a ter retirado, e a próxima
  // pessoa leria história como estado. A segunda metade é o número: um tecto que ficou acima do real
  // desculpa por antecipação a URL que ainda não existe.
  it('[Fronteira] entrada da lista que já não busca nada sai daqui, e o número acompanha a descida', () => {
    const resolvidas = Object.keys(BUSCAS_A_MAO).filter((f) => !BUSCAS.some((a) => a.f === f));
    expect(resolvidas, `já não faz busca externa; apague a entrada: ${resolvidas.join(', ')}`).toEqual([]);

    const inchadas = Object.entries(BUSCAS_A_MAO)
      .filter(([f, { urls }]) => BUSCAS.some((a) => a.f === f) && BUSCAS.filter((a) => a.f === f).length < urls)
      .map(([f, { urls }]) => `${f}: declara ${urls}, tem ${BUSCAS.filter((a) => a.f === f).length}`);
    expect(inchadas, `o tecto ficou acima do real e desculpa por antecipação: ${inchadas.join(' | ')}`).toEqual([]);
  });

  // 📌 O PAR que prova que a exclusão é uma REGRA e não um buraco: um espaço de nomes é aceite, e uma URL
  // qualquer no MESMO ficheiro não seria.
  it('[Fronteira] o espaço de nomes do SVG é aceite; qualquer outra URL do mesmo ficheiro não seria', () => {
    const svg = TODAS.filter((a) => a.url === 'http://www.w3.org/2000/svg');
    expect(svg.length, 'o `createElementNS` deixou de usar o espaço de nomes').toBe(2);
    for (const a of svg) expect(BUSCAS.some((b) => b.f === a.f && b.url === a.url)).toBe(false);
    expect(NAO_E_BUSCA.startsWith('http://www.w3.org/'), 'a exclusão é por prefixo do W3C, não uma lista').toBe(true);
  });

  /* 🎯 A REGRA DO ADR-0116 FEITA ESTRUTURAL: um ENDEREÇO não é uma BUSCA, e é a diferença entre o que se
   * pré-cacheia e o que se busca com preguiça. `platform/kokoro` NAMES the host and never asks it — a
   * módulo puro, e é essa pureza que deixa o buscador escolher o momento.
   *
   * ⚠️ If `kokoro` gains a `fetch`, deixa de ser endereço declarado e passa a ser a busca preguiçosa que a desculpa dele diz que não
   * é. (The case's other side was `ui/webcam`, which left with WebGazer — ADR-0214.)
   *
   * 📌 A regex é DUPLICADA do `nada-vem-de-fora` de propósito, pela razão que aquele ficheiro escreve: um
   * gate tem de poder discordar do outro. */
  const REDE = /\bfetch\s*\(|\bimport\s*\(|\.src\s*=|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket|new\s+EventSource/;
  const pede = (f) => REDE.test(semComentarios(readFileSync(join(RAIZ, f), 'utf8')));

  it('🎯 [Fronteira] endereço DECLARADO e busca PREGUIÇOSA são coisas diferentes, e o crivo sabe qual é qual', () => {
    expect(pede('platform/kokoro.ts'), 'platform/kokoro gained a fetch — it is no longer a declared address').toBe(false);
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
