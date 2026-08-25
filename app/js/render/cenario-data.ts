// SPDX-License-Identifier: GPL-3.0-or-later
// render/cenario-data — O CATÁLOGO DE CENÁRIOS: os quatro temas do jogo como DADO, e nada além disso.
//
// Este é o módulo-FOLHA da etapa D2-b: zero imports, zero PIXI, zero DOM, zero I/O. Ele responde a uma única
// pergunta — "quais são os cenários, e de que cor é cada um?" — e é justamente por não responder a mais
// nenhuma que ele pode ser lido, importado e testado por qualquer um dos seus consumidores sem arrastar meio
// motor junto.
//
// ======================= POR QUE A FRONTEIRA CAIU AQUI =======================
// `CENARIOS` e `THEME_FLORA` são as duas tabelas mais LIDAS e menos PROTEGIDAS do monólito. Antes desta
// extração elas eram `const` no meio do `game.js` e chegavam aos módulos por INJEÇÃO — `render/scene-sky.ts`
// as recebe inteiras no `SceneSkyCtx` (`CENARIOS`, `THEME_FLORA`), `game/attract.ts` recebe `CENARIOS` para
// sortear o tema da demo, o splash recebe a lista reduzida a `{id,nome}`, e `setCenario` as consulta para
// validar e para pintar. Cinco leitores, nenhum teste, e nenhum lugar onde a FORMA de um tema estivesse
// escrita: cada leitor descobria por acidente que `T.cloud` só existe quando `T.v3` é verdadeiro, e que
// `THEME_FLORA` não tem entrada para 'cidade'.
//
// Separar o dado da máquina que o consome é o corte mais barato e mais duradouro desta região: um tema novo
// (uma estação, um bioma) passa a ser uma linha AQUI, e as invariantes que os leitores presumem viram
// asserção em `tests/cenario-data.node.test.js` — em particular a mais silenciosa de todas, "todo tema `v3`
// tem `sky`, `cloud`, `hills`, `decor` E uma entrada em `THEME_FLORA`". Quebrar essa correspondência não
// derruba nada: `scene-sky` faz `const fl = THEME_FLORA[cenario]` e simplesmente não desenha grama. O tema
// novo nasceria careca, e ninguém saberia dizer por quê.
//
// ======================= O QUE ESTÁ AQUI, E POR QUÊ ESTÁ JUNTO =======================
//  · `CENARIOS`     — os quatro temas + a Cidade. `v3:false` (Cidade) significa "meu fundo vem de PNG e eu
//                     tenho o céu/tráfego próprios de render/scene-city"; `v3:true` significa "meu fundo é
//                     GERADO pelas fórmulas da v3.1.100 (render/scene-parallax) a partir destas cores".
//                     Nenhum tema tem chuva — chuva é da Cidade, e é decisão de render/weather.
//  · `THEME_FLORA`  — grama e flores por tema. Tabela IRMÃ da de cima e SÓ dos temas `v3`: a Cidade não tem
//                     flora. Fica no mesmo arquivo porque as duas descrevem O MESMO tema por chaves iguais e
//                     precisam ser editadas no mesmo gesto; separá-las convidaria exatamente a divergência
//                     que o teste de correspondência existe para pegar.
//  · `hexN`         — '#rrggbb' → número, o tradutor entre o dado (string, legível na tabela acima) e o PIXI
//                     (`beginFill` quer inteiro). Ele vivia solto no meio do bloco de parallax do game.js e
//                     tinha UM chamador: o `SceneSkyCtx`. É função da TABELA, não do parallax — todas as
//                     cores que ele converte estão neste arquivo — e por isso veio para cá, e não para
//                     render/parallax.
//  · `normalizarCenario` — a validação de `setCenario` ("tema desconhecido → 'cidade'"), isolada do efeito.
//
// ======================= O QUE NÃO VEIO =======================
//  · As FÓRMULAS que transformam estas cores em pixel (`themeSkyTexture`, `themeHillsTexture`,
//    `parallaxPlaceholder`, `hillHeight`) já moram em render/scene-parallax.ts desde o Estágio 4. Este
//    arquivo é a entrada delas, não a implementação.
//  · O desenho da flora (`drawV3Grass`) e da decoração viva é de render/scene-sky.ts. Aqui só a paleta.
//  · Os FATORES de profundidade das 3 camadas (`PARALLAX`) NÃO estão aqui, apesar de também serem dado: eles
//    não variam por tema — descrevem a GEOMETRIA do fundo, e vivem ao lado da conta que os usa, em
//    render/parallax.ts. Uma tabela de tema aqui, uma tabela de câmera lá.
//
// ======================= ⚠️ COMPORTAMENTO PRESERVADO: `normalizarCenario` ACEITA CHAVE HERDADA =======================
// O monólito valida com `if(!CENARIOS[theme])theme='cidade'`. `CENARIOS` é um objeto literal, logo herda de
// `Object.prototype`: `CENARIOS['toString']` é uma FUNÇÃO, e portanto truthy, e portanto 'toString' passa na
// validação como se fosse um tema. O `setCenario` então persiste 'toString' em `incl_cenario`, tenta baixar
// `assets/cenarios/toString/c4.png` e o jogo fica sem fundo. Só é alcançável por um valor forjado (chave de
// localStorage adulterada; `window.__incl.setCenario('constructor')`), nunca pela UI — que monta o seletor a
// partir de `Object.keys(CENARIOS)`.
// ISTO É O COMPORTAMENTO ATUAL E FOI COPIADO TAL E QUAL, de propósito: esta etapa é uma EXTRAÇÃO, e trocar a
// checagem por `hasOwnProperty` aqui seria consertar às escondidas, dentro de um movimento cuja garantia é
// justamente "nada mudou". O teste PREGA a falha (`normalizarCenario('toString') === 'toString'`), para que o
// conserto — quando vier — seja uma mudança visível de asserção e não uma surpresa.
//
// SEM I/O NO IMPORT: o corpo do módulo só declara literais. Não há `init`, não há factory, não há efeito —
// e por isso não há armadilha de ordem de boot: importar este arquivo é sempre seguro, em qualquer ponto.
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (D2-b).

/** Grama e flores de um tema `v3` (render/scene-sky.drawV3Grass). Cores em '#rrggbb'. */
export interface Flora {
  base: string;     // faixa de base da grama (2px no topo do tile)
  top: string;      // 1px mais claro por cima da base
  bLt: string;      // tufo claro (alterna com bDk)
  bDk: string;      // tufo escuro — e o caule da flor
  center: string;   // miolo da flor
  petals: string[]; // pétalas sorteadas por hash do tile
}

/**
 * Um cenário.
 *
 * O CAMPO `v3` FOI SEPARADO EM DOIS (2026-08-25), e o motivo é um pedido que ele não conseguia atender.
 * Ele significava três coisas ao mesmo tempo — "meu fundo é gerado das cores", "tenho céu vivo compartilhado"
 * e "tenho flora" — e isso funcionava enquanto só existiam dois tipos de tema: a Cidade (PNG, cena própria,
 * sem flora) e os quatro gerados (cores, céu vivo, flora).
 *
 * O Dev pediu FUNDO RASTER PARA A FLORESTA, mantendo a floresta como floresta. Isso é uma combinação nova —
 * PNG **com** flora e céu vivo — e ela não cabia num booleano só: virar `v3` para false teria tirado a grama,
 * as flores e as borboletas dela junto com o fundo gerado.
 *
 * Agora são duas perguntas independentes, e cada leitor faz a sua:
 *   · `fundo`     — de onde vêm as três camadas de parallax. Lido por render/parallax.
 *   · `decor`     — que decoração viva o céu recebe. Lido por render/scene-sky, pela PRESENÇA, não por rótulo.
 * A flora segue a mesma regra: quem tem entrada em THEME_FLORA tem flora, e ponto.
 */
export interface CenarioTema {
  /** CHAVE i18n do nome exibido. Chave e não texto: tabela de módulo resolvida no import congelaria o idioma
   *  no boot (ver a nota em input/devices). Quem exibe resolve com `t()`. */
  nome: string;
  /** De onde vêm as 3 camadas de fundo: `'gerado'` das cores abaixo, ou `'png'` de `cenarios/<tema>/c4|3|2.png`. */
  fundo: 'gerado' | 'png';
  sky?: [string, string];   // gradiente vertical do céu (topo → horizonte) — só `fundo:'gerado'`
  cloud?: [string, string]; // nuvem de tela: corpo + sombra — só `fundo:'gerado'`
  hills?: [string, string]; // as duas bandas de morro: [fundo, frente] — só `fundo:'gerado'`
  decor?: string[];         // decoração viva ligada neste tema (render/scene-sky.stepV3Decor)
}

/** O tema para o qual todo valor desconhecido cai. */
export const CENARIO_PADRAO = 'cidade';

/* L6 (REFEITO — fiel à v3.1.100): os 4 temas usam EXATAMENTE o céu, as nuvens, as montanhas, a grama
   e a decoração viva de lá (fórmulas copiadas). BLOCOS = Clarity SEM recolor (a v3 não recoloria tiles
   por tema). NENHUM tema tem chuva — chuva é só da Cidade. */
// ⚠️ TRÊS IDS MENTEM, e o rótulo é que está certo. `cemiterio` é "Amanhecer no Campo" e `espaco` é "Noite no
// Campo" (ver `cen.*` nos dicionários): os temas mudaram, os ids ficaram. Com `campo` = "Dia no Campo", os três
// são o MESMO lugar em três horas do dia, e é por isso que compartilham a silhueta em render/scene-parallax.
// Renomear os ids é migração de dado persistido (`incl_cenario` e as gravações de demonstração os guardam),
// então fica para uma rodada própria — e este aviso é a rede até lá. Quem ler só o id planta a arte errada;
// foi o que quase aconteceu.
//
// SE UM DIA HOUVER TEMA DE ESPAÇO OU DE HALLOWEEN (decisão do Dev, 2026-08-25): no de espaço, os BLOCOS do
// nível viram partes de estação espacial — não é só trocar o céu. E o de Halloween é uma FESTA de Halloween,
// não um cemitério: abóboras, fantasias e doces, não túmulos.
export const CENARIOS: Record<string, CenarioTema> = {
  cidade:    { nome: 'cen.cidade', fundo: 'png' },
  campo:     { nome: 'cen.campo',          fundo: 'gerado', sky: ['#86c5e8', '#cfeecb'], cloud: ['#ffffff', '#d4e6f5'], hills: ['#9fd47e', '#6fb84e'], decor: ['nuvens', 'passaros', 'borboletas'] },
  cemiterio: { nome: 'cen.cemiterio',      fundo: 'gerado', sky: ['#2b2540', '#5a4f6b'], cloud: ['#d9c4dd', '#a98fb6'], hills: ['#4a5f55', '#33473d'], decor: ['nuvens', 'passaros', 'sparkles', 'minhocas', 'nevoa'] },
  espaco:    { nome: 'cen.espaco',         fundo: 'gerado', sky: ['#05030f', '#161033'], cloud: ['#3a3550', '#262238'], hills: ['#1e3030', '#142024'], decor: ['nuvens', 'sparkles', 'vagalumes'] },
  floresta:  { nome: 'cen.floresta',       fundo: 'gerado', sky: ['#3f6b50', '#8fbf73'], cloud: ['#cfe6b8', '#a7cf86'], hills: ['#2f5e35', '#1f4226'], decor: ['nuvens', 'passaros', 'borboletas'] },
};

/** v3 exato — grama/flores por tema. SÓ dos temas `v3`: a Cidade não tem flora (por isso o `| undefined`). */
export const THEME_FLORA: Record<string, Flora | undefined> = {
  campo:     { base: '#52933c', top: '#7cc35a', bLt: '#8fd968', bDk: '#46822f', center: '#ffe14d', petals: ['#ffe14d', '#ff7eb6', '#ffffff', '#ff6b6b'] },
  cemiterio: { base: '#46624f', top: '#5e7d68', bLt: '#6f9079', bDk: '#3a5244', center: '#f0e6d0', petals: ['#c9b6e8', '#e7c9dd', '#b6c9e8'] },
  espaco:    { base: '#2d4650', top: '#40606a', bLt: '#557f88', bDk: '#26404a', center: '#fff6c0', petals: ['#d6ecff', '#ffffff', '#cfffe8'] },
  floresta:  { base: '#3a7a34', top: '#5fa84a', bLt: '#6fc255', bDk: '#2f6329', center: '#ffe14d', petals: ['#c98ce0', '#ffffff', '#ffd166', '#ff7eb6'] },
};

/** '#rrggbb' → 0xrrggbb, para o `beginFill` do PIXI. Verbatim do `hexN` do game.js. */
export const hexN = (s: string): number => parseInt(String(s).slice(1), 16);

/**
 * A validação de `setCenario`, sem o efeito: tema conhecido passa, o resto vira 'cidade'.
 * ⚠️ Cópia FIEL do monólito, herança do `Object.prototype` inclusive — ver o cabeçalho.
 */
export function normalizarCenario(theme: string): string {
  if (!CENARIOS[theme]) return CENARIO_PADRAO;
  return theme;
}
