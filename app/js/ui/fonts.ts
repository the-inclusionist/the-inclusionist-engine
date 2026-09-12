// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/fonts.ts — catálogo de fontes (dados) + índice por chave + carga/persistência da escolha. Módulo-folha
// (só depende de storage). A instância `fontKey` e o setGameFont (aplica família/espaçamento) ficam no game.js.
import * as store from '../platform/storage.js';

/**
 * Uma fonte do catálogo. `fam` é o NOME DA FONTE — nome próprio, nunca traduzido. `d` guarda CHAVE i18n da
 * descrição, não o texto: mesma decisão de `VIZ_MODES` e `RM_LABEL`, e pelo mesmo motivo — uma tabela de
 * `const` com texto resolve uma vez, no import, e fica congelada no idioma do boot.
 */
/**
 * O PAPEL de uma face, e é a emenda do ADR-0012 (27/08) posta em dado (issue #87).
 *
 * ⚠️ NÃO É O MESMO QUE O GRUPO. O grupo (`sans`/`serif`/`hand`) é APARÊNCIA e serve para ler a lista; o papel
 * é ONDE A FACE PODE SER USADA, e é regra:
 *
 *   · `geral` — em qualquer lugar. São as únicas que o menu de tipografia oferece.
 *   · `caligrafica` — **só DENTRO das atividades escolares**, nunca no HUD nem nos menus, e por isso **não
 *     aparecem no menu de fonte**. Elas existem para a criança APRENDER a ler letra cursiva, o que é matéria;
 *     usá-las como interface é dar-lhe a matéria como obstáculo em todos os lugares onde ela só quer navegar.
 *   · `jogo` — a face que o JOGO usa no HUD, no título e em rótulos curtos de arcade. Também não aparece no
 *     menu, e pelo mesmo tipo de razão que as caligráficas: uma face de pixel de 8 bits é desenhada para
 *     dizer POUCAS palavras em tamanho grande. Como face de interface ela contradiz o argumento que faz a
 *     Atkinson Hyperlegible ser o padrão — pouca diferenciação entre letras, avanço largo, nenhuma variação
 *     de altura. É certa no HUD de um jogo de pixel-art e errada num menu que a criança precisa de LER.
 *
 * ⚠️ E O CORTE NÃO É O GRUPO `hand`. O `comicneue` está lá por aparência — a face é de propósito geral e é
 * frequentemente recomendada para dislexia. Tirá-la do menu removeria uma opção legitimamente acessível. A
 * definição boa é a lista do item 2 da #87, que nomeia as caligráficas dando-lhes tamanho mínimo.
 */
export type FontRole = 'geral' | 'caligrafica' | 'jogo';

/**
 * A MÃO DO PAÍS DESTA CRIANÇA, e o recuo do COLONIZADOR quando o país não tem a sua (ADR-0150 §1).
 *
 * 🎯 A regra é do Dev e é mais verdadeira do que a que substituiu: o ADR-0012 diz que a mão que se aprende a
 * escrever é NACIONAL e não linguística, e nunca disse o que fazer com as nações sem face própria. «O que os
 * Estados Unidos ensinam» era um padrão vestido de país; a mão do colonizador é uma afirmação verdadeira
 * sobre como a escola daquela criança a ensinou a escrever.
 *
 * 📌 E TRÊS FACES FECHAM O BURACO INTEIRO, porque o repertório já está limitado a inglês, português e
 * espanhol (ADR-0012). É o que torna a regra mais verdadeira também a mais barata de empacotar.
 *
 * ⚠️ ONDE O PAÍS ENSINA DUAS MÃOS, DEVOLVE AS DUAS, na ordem do Dev — a tradicional primeiro. É o que faz o
 * ciclo do 11.º botão ter SEIS posições nesses países em vez de cinco.
 */
const MAO_POR_PAIS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  BR: ['pwbr'],
  US: ['pwustrad', 'pwusmod'],   // os EUA ensinam duas, e escolher uma seria escolher pela criança
  GB: ['pwgbj', 'pwgbs'],        // joined e semi-joined
  ES: ['pwes', 'pwesdeco'],
  PT: ['pwpt'],
  CA: ['pwca'], MX: ['pwmx'], AR: ['pwar'], CL: ['pwcl'], CO: ['pwco'], CU: ['pwcu'], PE: ['pwpe'],
});

/** O recuo por LÍNGUA: a mão do colonizador. Três entradas cobrem todo país que o repertório admite. */
const MAO_POR_LINGUA: Readonly<Record<string, readonly string[]>> = Object.freeze({
  es: ['pwes', 'pwesdeco'],
  pt: ['pwpt'],
  en: ['pwgbj', 'pwgbs'],
});

/**
 * As chaves de fonte manuscrita para uma etiqueta BCP-47 — `pt-BR` → `['pwbr']`, `es-MX` → `['pwmx']`.
 *
 * ⚠️ LÊ A REGIÃO E DEPOIS A LÍNGUA, nesta ordem, e o caso que se esquece é a etiqueta SEM região: `en` sozinho
 * não nomeia país nenhum, e cair no recuo é a resposta certa — não é um erro, é uma criança cujo navegador
 * não disse onde ela está.
 *
 * 📌 Devolve LISTA e não uma face: onde o país ensina duas mãos, as duas entram no ciclo.
 * 📌 Devolve VAZIO para uma língua fora do repertório, e o vazio é dizível: quem chama tira a posição do
 * ciclo em vez de mostrar uma mão que não é de ninguém.
 */
/** Uma posição do ciclo de tipografia do 11.º botão: a CAIXA e a FACE, juntas (ADR-0149 §1). */
export interface PassoDeTipografia {
  /** `upper` = CAIXA ALTA; `mixed` = maiúscula e minúscula. Os valores de `core/state.letterCase`. */
  readonly caixa: 'upper' | 'mixed';
  /** A chave da face no catálogo. */
  readonly fonte: string;
  /**
   * O multiplicador de tamanho desta posição — 1 nas faces de leitura, **1,25 na mão do país** (ADR-0149 §1).
   *
   * 🔴 NÃO É PREFERÊNCIA, É O PISO DE LEGIBILIDADE JÁ MEDIDO. As Playwrite declaram `minPx: 20` desde a
   * emenda do ADR-0012 («abaixo disto a face deixa de ser DIFÍCIL e passa a ser ILEGÍVEL, que são coisas
   * diferentes: a dificuldade é o exercício, a ilegibilidade é a criança a desistir»). A base do documento é
   * 16 px, e 16 × 1,25 = 20 — o multiplicador É o piso, escrito como razão em vez de como número solto.
   */
  readonly escala: number;
}

/** O aumento da mão do país. Nomeado para o crivo o poder afirmar contra o `minPx` em vez de o repetir. */
export const ESCALA_DA_MAO = 1.25;
/** A base do documento, em px — o `font-size` de `html,body`. O piso sai de multiplicá-la pela escala. */
export const BASE_EM_PX = 16;

/**
 * O CICLO DO 11.º BOTÃO — cinco posições, ou seis onde o país ensina duas mãos (ADR-0149 §1, ADR-0150 §2).
 *
 * 🎯 CADA PASSO MUDA A CAIXA **E** A FACE, e é essa a decisão inteira. Hoje `letterCase` (`core/state`,
 * ADR-0028) e a face são dois controles em dois sítios; «Andika em caixa alta» é UMA escolha pedagógica de
 * quem alfabetiza, não duas. Uma criança não devia ter de saber o modelo para a fazer.
 *
 * 📌 COMEÇA NA ATKINSON, que é a posição (c) e o padrão do projeto. O ciclo é um anel: a partir dela, uma
 * pressão vai para a Lexend e a última volta ao início.
 *
 * ⚠️ A MÃO DO PAÍS PODE NÃO EXISTIR — uma etiqueta sem região e numa língua fora do repertório devolve vazio.
 * Nesse caso o ciclo tem QUATRO posições, e isso é a resposta certa: melhor uma posição a menos do que uma
 * que mostre a mão de um país que não é o daquela criança.
 *
 * 🔴 ARASAAC E PCS NÃO SÃO POSIÇÕES, e é a decisão e não um esquecimento: o ADR-0151 pô-los no ciclo de comunicação
 * como desabilitados, e o ADR-0155 §3 mudou para «Pular» — enquanto a licença não deixa, o ciclo não pára neles nem os
 * anuncia. Uma posição que existisse só para ser saltada seria dado sem leitor; entram no dia em que funcionarem.
 */
export function cicloDeTipografia(tag: string | null | undefined): readonly PassoDeTipografia[] {
  const maos = maosDaEtiqueta(tag);
  return Object.freeze([
    { caixa: 'upper', fonte: 'andika', escala: 1 } as const,   // (a) o par da alfabetização
    { caixa: 'mixed', fonte: 'andika', escala: 1 } as const,   // (b)
    { caixa: 'mixed', fonte: 'atkinson', escala: 1 } as const, // (c) o padrão — o ciclo começa aqui
    { caixa: 'mixed', fonte: 'lexend', escala: 1 } as const,   // (d)
    // (e), e (f) onde o país ensina duas. ⚠️ 25% MAIOR, e o número não é gosto: a base do documento é 16 px,
    // as Playwrite declaram `minPx: 20`, e 16 × 1,25 é exactamente 20. A escala É o piso.
    ...maos.map((fonte) => ({ caixa: 'mixed', fonte, escala: ESCALA_DA_MAO } as const)),
  ]);
}

/** O índice de onde o ciclo COMEÇA — a posição (c). Nomeado para o crivo o poder afirmar sem o recontar. */
export const INICIO_DO_CICLO = 2;

export function maosDaEtiqueta(tag: string | null | undefined): readonly string[] {
  if (!tag) return [];
  const partes = String(tag).split('-');
  const lingua = (partes[0] ?? '').toLowerCase();
  const regiao = partes.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p))?.toUpperCase();
  if (regiao && MAO_POR_PAIS[regiao]) return MAO_POR_PAIS[regiao]!;
  return MAO_POR_LINGUA[lingua] ?? [];
}

export type FontItem = {
  k: string; fam: string; fb: string; d?: string; off?: string;
  /** Ausente = `geral`. Só as caligráficas se declaram, porque são a excepção. */
  papel?: FontRole;
  /**
   * O menor tamanho, em px, em que esta face ainda é legível (item 2 da #87, números do Dev).
   *
   * ⚠️ Abaixo disto a face deixa de ser DIFÍCIL e passa a ser ILEGÍVEL, que são coisas diferentes: a
   * dificuldade é o exercício, a ilegibilidade é a criança a desistir. Por isso é gate e não recomendação.
   */
  minPx?: number;
};
/** Um grupo do catálogo. `g` também guarda CHAVE ('font.group.sans'), pelo mesmo motivo. */
export type FontGroup = { g: string; items: FontItem[] };
export const FONT_GROUPS: FontGroup[] = [
  {g:'font.group.sans', items:[
    {k:'atkinson',   fam:'Atkinson Hyperlegible', fb:'sans', d:'font.desc.atkinson'},
    {k:'lexend',     fam:'Lexend',                fb:'sans', d:'font.desc.lexend'},
    {k:'quattro',    fam:'iA Writer Quattro',     fb:'sans', d:'font.desc.quattro'},
    {k:'andika',     fam:'Andika',                fb:'sans', d:'font.desc.andika'},
    // ⚠️ A OPENDYSLEXIC ENTRA SEM NENHUMA ALEGAÇÃO DE EFICÁCIA, e a restrição é da issue #87 item 3 e do
    // `docs/game-design/typography.md`, que diz por extenso: «Ofereça a Dyslexie e a OpenDyslexic apenas como
    // escolha do usuário. A pesquisa não mostra ganho de leitura com elas.» A descrição dela fala do DESENHO
    // (hastes pesadas em baixo), nunca do efeito — prometer leitura melhor seria vender a uma criança
    // disléxica uma coisa que a evidência não sustenta, e ela é quem menos pode pagar por isso.
    {k:'opendyslexic', fam:'OpenDyslexic',       fb:'sans', d:'font.desc.opendyslexic'},
    {k:'sourcesans', fam:'Source Sans 3',         fb:'sans'},
    {k:'inter',      fam:'Inter',                 fb:'sans'},
    {k:'opensans',   fam:'Open Sans',             fb:'sans'},
    {k:'lato',       fam:'Lato',                  fb:'sans'},
    // ⚠️ AS QUATRO ARREDONDADAS entram a pedido do Dev (2026-09-12) e entram SEM descrição, de propósito: as
    // quatro linhas acima também não a têm, e um `d` existe quando há algo a dizer que o nome não diz — a
    // Atkinson tem-no porque o Braille Institute a desenhou para isto, a OpenDyslexic porque a descrição dela
    // tem de falar do DESENHO e nunca do efeito. «Arredondada» não é uma alegação, é o que se vê.
    //
    // 📌 `geral` (papel implícito): são faces de interface, não caligráficas e não de jogo — logo seguem o
    // espaçamento da BDA que o ADR-0149 §2 generaliza, e aparecem no menu de tipografia como as outras.
    //
    // ⚠️ `Fredoka` E NÃO «Fredoka One»: o pedido usou o nome legado. A Google publica hoje a família variável
    // como `Fredoka`; a estática antiga era o peso 600 dela. Ver o bloco correspondente em `fonts.css`.
    {k:'fredoka',    fam:'Fredoka',               fb:'sans'},
    {k:'quicksand',  fam:'Quicksand',             fb:'sans'},
    {k:'nunito',     fam:'Nunito',                fb:'sans'},
    {k:'teachers',   fam:'Teachers',              fb:'sans'},
    /*
     * MAIS SETE SEM SERIFA (ADR-0150, pedido do Dev de 2026-09-12). Sete da lista dele já cá estavam —
     * Source Sans 3, Inter, Open Sans, Lato acima, e as três serifadas abaixo — e não se repetem.
     *
     * 🔴 A CLASH DISPLAY NÃO ENTRA, e a ausência é medida e não esquecida: ela **não está no Google Fonts**.
     * É da Fontshare (Indian Type Foundry), e o §3 do `LICENSES.md` exige a licença conferida ANTES de
     * empacotar — o mesmo teste que as três faces da ronde reprovaram, por serem livres só para uso PESSOAL.
     * 🔴 LIDA EM 2026-09-12, E REPROVA: é «Closed Source», sob a ITF Free Font License, cujo §02 proíbe distribuir
     * o ficheiro por repositório, aplicação ou servidor público e servi-lo como fonte selecionável a terceiros.
     * O que era espera virou recusa com motivo; o crivo está em `tests/fontes-empacotadas.node.test.js`.
     */
    {k:'robotoflex', fam:'Roboto Flex',           fb:'sans'},
    {k:'ubuntu',     fam:'Ubuntu',                fb:'sans'},
    {k:'notosans',   fam:'Noto Sans',             fb:'sans'},
    {k:'spacegrotesk', fam:'Space Grotesk',       fb:'sans'},
    {k:'sora',       fam:'Sora',                  fb:'sans'},
    {k:'jakarta',    fam:'Plus Jakarta Sans',     fb:'sans'} ]},
    // ⚠️ A COMFORTAA ENTROU E SAIU NO MESMO DIA, por decisão do Dev: «ruim para dislexia». A razão está na
    // face — as formas quase geométricas reduzem a diferenciação entre letras, que é o eixo pelo qual a
    // Atkinson Hyperlegible é a padrão deste projeto. Fica escrito porque uma face que sai sem rasto volta a
    // ser proposta pelo próximo que olhar para a lista e achar que falta uma arredondada.
  {g:'font.group.serif', items:[
    {k:'literata',    fam:'Literata',       fb:'serif'},
    {k:'sourceserif', fam:'Source Serif 4', fb:'serif'},
    {k:'newsreader',  fam:'Newsreader',     fb:'serif'},
    // Cinco de LEITURA, do mesmo pedido: serifadas de texto corrido, como as três acima.
    {k:'merriweather', fam:'Merriweather',  fb:'serif'},
    {k:'lora',        fam:'Lora',           fb:'serif'},
    {k:'spectral',    fam:'Spectral',       fb:'serif'},
    {k:'domine',      fam:'Domine',         fb:'serif'},
    {k:'bitter',      fam:'Bitter',         fb:'serif'},
    /*
     * ⚠️ AS QUATRO DE DISPLAY SÃO OUTRA COISA, e entram com o aviso escrito em vez de misturadas com as de
     * leitura. Playfair Display, DM Serif Display, Fraunces e Bodoni Moda têm CONTRASTE ALTO — hastes grossas
     * ao lado de hastes finíssimas — e a Bodoni é o extremo do eixo. É exactamente o que a Atkinson
     * Hyperlegible foi desenhada para NÃO ser, e em corpo pequeno as hastes finas desaparecem primeiro para
     * quem menos enxerga.
     *
     * 📌 Ficam na mesma, porque OFERECER não é aplicar: o padrão continua a ser a Atkinson, e quem escolhe
     * uma destas está a escolher. O que seria defeito é a engine ADOPTAR uma delas sozinha.
     * 🔴 E elas não são para corpo de texto de atividade; um jogo que as use num enunciado longo está a usar
     * uma face de título como face de leitura.
     */
    {k:'playfair',    fam:'Playfair Display', fb:'serif'},
    {k:'dmserifdisplay', fam:'DM Serif Display', fb:'serif'},
    {k:'fraunces',    fam:'Fraunces',       fb:'serif'},
    {k:'bodonimoda',  fam:'Bodoni Moda',    fb:'serif'} ]},
  // ⚠️ QUATRO FACES SAÍRAM DAQUI EM 2026-09-07 (issue #87, item 3, decisão do Dev):
  //   · `greatvibes` (44 KB) e `ufcook` (20 KB) — peso que o roster não paga;
  //   · `learningcurve` e `kindergarten` — eram entradas `.off` SEM FICHEIRO, isto é, o menu oferecia-as
  //     desabilitadas e nada existia por trás. Uma linha que só serve para dizer «ainda não» é uma linha que
  //     a criança lê e não pode usar.
  {g:'font.group.hand', items:[
    {k:'pinyon',     fam:'Pinyon Script',       fb:'cursive', d:'font.desc.pinyon', papel:'caligrafica', minPx:24},
    {k:'ufmag',      fam:'UnifrakturMaguntia',  fb:'cursive', d:'font.desc.ufmag',  papel:'caligrafica', minPx:20},
    // Fondamento entra pela emenda do ADR-0012 (#87 item 3) com o mínimo que o Dev fixou. Caligráfica, logo
    // fora do menu — ela é para os botões DENTRO das atividades escolares, não para a interface.
    {k:'fondamento', fam:'Fondamento',          fb:'cursive', d:'font.desc.fondamento', papel:'caligrafica', minPx:20},
    // ⚠️ `comicneue` NÃO é caligráfica, e está neste grupo só por aparência: é uma face de propósito geral,
    // frequentemente recomendada para dislexia. Marcá-la como caligráfica tirá-la-ia do menu — removendo uma
    // opção legitimamente acessível pelo formato do grupo em vez de pelo papel.
    {k:'comicneue',  fam:'Comic Neue',          fb:'cursive', d:'font.desc.comicneue'},
    /*
     * A RONDE FRANCESA — o item 4 da #87, decidido no ADR-0108 §4. Ela NUNCA é empacotada: as três faces são
     * livres só para uso PESSOAL (ADR-0012), e distribuí-las seria distribuir o que não foi licenciado para
     * distribuição. O que muda é que a opção passa a FALAR.
     *
     * ⚠️ E ISTO NÃO É A ENTRADA `.off` QUE ESTE CATÁLOGO JÁ REMOVEU. O cabeçalho acima tirou a `learningcurve`
     * e a `kindergarten` com a razão certa — «uma linha que só serve para dizer "ainda não" é uma linha que a
     * criança lê e não pode usar». A diferença é ACCIONABILIDADE, e é a razão que o ADR-0108 dá por extenso:
     * aquelas diziam «ainda não», que ninguém pode resolver; esta diz QUAIS TRÊS FONTES INSTALAR, que um
     * adulto resolve numa tarde. 📌 «Instale uma fonte ronde» seria o defeito de volta — um adulto não age
     * sobre uma categoria —, e é por isso que a mensagem nomeia as três.
     *
     * ⚠️ `papel` AUSENTE, logo `geral`, e é deliberado apesar de a ronde ser caligráfica por natureza: as
     * caligráficas são filtradas do menu (`papelDaFonte === 'geral'`), e uma linha filtrada não pode dizer
     * nada a ninguém. Marcar o papel «certo» aqui apagaria a única coisa que este item existe para fazer.
     */
    /*
     * AS OITO PLAYWRITE — o item 3 da #87, decidido no ADR-0108 §2 e entregue em 2026-09-09.
     *
     * ⚠️ `papel: caligrafica`, logo FORA DO MENU: elas são a mão que se aprende a escrever, para os botões
     * DENTRO das atividades escolares, e não uma opção de interface. É a divisão do item 1 desta issue.
     *
     * 📌 `minPx: 20` é o mesmo piso que as outras três cursivas carregam. A lista de mínimos da #87 não
     * nomeia a Playwrite — o número é o das irmãs, e não uma medição própria; corrigir-se com uma linha.
     */
    {k:'pwbr', fam:'Playwrite BR', fb:'cursive', d:'font.desc.pw.br', papel:'caligrafica', minPx:20},
    {k:'pwustrad', fam:'Playwrite US Trad', fb:'cursive', d:'font.desc.pw.ustrad', papel:'caligrafica', minPx:20},
    {k:'pwusmod', fam:'Playwrite US Modern', fb:'cursive', d:'font.desc.pw.usmod', papel:'caligrafica', minPx:20},
    {k:'pwca', fam:'Playwrite CA', fb:'cursive', d:'font.desc.pw.ca', papel:'caligrafica', minPx:20},
    {k:'pwmx', fam:'Playwrite MX', fb:'cursive', d:'font.desc.pw.mx', papel:'caligrafica', minPx:20},
    {k:'pwar', fam:'Playwrite AR', fb:'cursive', d:'font.desc.pw.ar', papel:'caligrafica', minPx:20},
    {k:'pwcl', fam:'Playwrite CL', fb:'cursive', d:'font.desc.pw.cl', papel:'caligrafica', minPx:20},
    {k:'pwco', fam:'Playwrite CO', fb:'cursive', d:'font.desc.pw.co', papel:'caligrafica', minPx:20},
    /*
     * MAIS SETE, e elas existem por uma REGRA e não por gosto (ADR-0150, decisão do Dev de 2026-09-12).
     *
     * 🎯 `pwes`, `pwpt` e `pwgbj` são o RECUO POR LÍNGUA: um país sem Playwrite própria recebe a do
     * COLONIZADOR — espanhol → Espanha, português → Portugal, inglês → Inglaterra —, e já não a dos Estados
     * Unidos, que era o recuo da primeira versão do ADR-0149.
     * 📌 `pwcu` e `pwpe` foram pedidas por nome; `pwesdeco` e `pwgbs` entram pela outra metade da regra, que
     * é «onde o país tem mais de um TRAÇO, aparecem os dois» — como US Trad e US Modern.
     *
     * ⚠️ AS «GUIDES» NÃO ENTRAM, por decisão do Dev. 📏 Medido no catálogo da Google: catorze países têm uma
     * `Playwrite XX Guides`, e ela não é um segundo traço — é o MESMO traço com as pautas de caligrafia por
     * cima. A engine não as usa; um jogo que precise delas traz a sua própria fonte.
     *
     * 🔴 E ELAS SÃO EMPACOTADAS, o que REVOGA o P3 do ADR-0108 («nada de empacotar: estas são baixadas
     * conforme necessário»). A decisão nova é dele e é literal: «estas fontes devem ser baixadas no primeiro
     * dia para fazer parte do PWA». Fica escrito porque o registo antigo continua a dizer o contrário.
     */
    {k:'pwes', fam:'Playwrite ES', fb:'cursive', papel:'caligrafica', minPx:20},
    {k:'pwesdeco', fam:'Playwrite ES Deco', fb:'cursive', papel:'caligrafica', minPx:20},
    {k:'pwpt', fam:'Playwrite PT', fb:'cursive', papel:'caligrafica', minPx:20},
    {k:'pwgbj', fam:'Playwrite GB J', fb:'cursive', papel:'caligrafica', minPx:20},
    {k:'pwgbs', fam:'Playwrite GB S', fb:'cursive', papel:'caligrafica', minPx:20},
    {k:'pwcu', fam:'Playwrite CU', fb:'cursive', papel:'caligrafica', minPx:20},
    {k:'pwpe', fam:'Playwrite PE', fb:'cursive', papel:'caligrafica', minPx:20},
    {k:'ronde', fam:'Ronde Script, OPTIFrench-Script, Merveille', fb:'cursive',
      d:'font.desc.ronde', off:'font.off.ronde'} ]},
  // ⚠️ A FACE DO JOGO, e ela tem grupo próprio porque não é nem sans, nem serifada, nem manuscrita — é uma
  // face de PIXEL, e pô-la em qualquer um dos três diria a coisa errada sobre ela na lista.
  //
  // Ela NÃO aparece no menu (`papel:'jogo'`), e o ficheiro veio do `SP-the-inclusionist-whackwhack`, onde já
  // estava verificado. Ver a nota do `@font-face` em `vendor/fonts.css`: o subconjunto errado desta família
  // carrega, declara-se e reporta-se como certo, e não desenha uma única letra latina.
  {g:'font.group.arcade', items:[
    {k:'pressstart', fam:'Press Start 2P', fb:'monospace', d:'font.desc.pressstart', papel:'jogo'} ]},
];

/** O papel de uma face; ausente no catálogo quer dizer `geral`. */
export function papelDaFonte(it: FontItem): FontRole { return it.papel ?? 'geral'; }

/**
 * AS FAMÍLIAS QUE UMA FACE ACEITA, do `fam` que pode ser uma PILHA.
 *
 * 📌 A Ronde declara três (`'Ronde Script, OPTIFrench-Script, Merveille'`) porque qualquer uma delas serve —
 * são três desenhos da mesma letra de mão, e um adulto instala a que encontrar. As outras faces declaram uma
 * só, e para elas isto devolve uma lista de um.
 */
export function familiasDaFace(it: FontItem): string[] {
  return it.fam.split(',').map((f) => f.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

/**
 * ESTA FACE PODE SER USADA AGORA? — o `off` deixa de ser uma sentença e passa a ser uma CONDIÇÃO.
 *
 * O ADR-0012 decidiu que a opção da ronde «fica DESABILITADA enquanto nenhuma fonte estiver presente», e o
 * ADR-0108 §4 acrescentou o que ela diz. A palavra «enquanto» é o que esta função constrói: uma face `off`
 * volta a ficar disponível no instante em que o adulto instala uma das que a mensagem nomeia.
 *
 * ⚠️ O DETECTOR É INJECTADO, e nunca `document.fonts` lido daqui: este módulo é o catálogo, corre em node nos
 * gates, e ler um global do navegador aqui é o ACHADO 15 outra vez — o `srAlert` que rebentou o boot contra um
 * documento injectado.
 * 📌 E o PADRÃO É «não instalada», que é seguro por uma razão que não vale para todos os padrões deste
 * repositório: sem detector a opção fica desabilitada COM a mensagem, e a mensagem diz ao adulto exactamente
 * o que fazer. O silêncio não decide nada contra a criança — ele mantém o estado que já existia e que é
 * accionável. É o oposto do `seguraTeclas`, onde os dois lados do padrão erravam.
 */
export function faceDisponivel(it: FontItem, instalada?: (familia: string) => boolean): boolean {
  if (!it.off) return true;
  return !!instalada && familiasDaFace(it).some((f) => instalada(f));
}

/** As faces que o MENU pode oferecer: só as gerais (emenda do ADR-0012). */
export const OFERECIVEIS: FontItem[] = FONT_GROUPS.flatMap((g) => g.items).filter((it) => papelDaFonte(it) === 'geral');
export const FONT_BY_KEY: Record<string, FontItem> = {}; FONT_GROUPS.forEach((g) => g.items.forEach((it) => { FONT_BY_KEY[it.k] = it; }));

/** Narrow store shape these need — lets a caller inject a fake without touching real storage. */
export interface FontStore { get(key: string, fallback: string | null): string | null; set(key: string, v: string): void; }

export const FONT_KEY = 'incl_font_k';
export const FONT_KEY_LEGACY = 'incl_fonte'; // pre-Fase-2: 'alfabetizacao' | 'dislexia'

/**
 * A fonte de fábrica, com nome. Atkinson Hyperlegible foi desenhada pelo Braille Institute justamente para
 * quem tem baixa visão — distingue as formas que mais se confundem (I/l/1, O/0). É por isso que ela é o padrão
 * e não uma preferência estética, e é por isso que o "restaurar padrões" da tipografia (ADR-0028) volta para
 * cá: o caminho de volta de um menu de acessibilidade tem que terminar na escolha mais legível, não numa
 * qualquer. Usada em DOIS lugares — o fim da cadeia de boot logo abaixo e o reset do painel —, e uma constante
 * porque duas cópias de um padrão são duas chances de o reset devolver algo que o jogo nunca usou.
 */
export const DEFAULT_FONT_KEY = 'atkinson';

/**
 * Boot choice: validated persisted key (ignores .off fonts) -> legacy-key migration -> DEFAULT_FONT_KEY.
 *
 * ⚠️ E UMA CALIGRÁFICA GUARDADA VOLTA AO PADRÃO (issue #87, 2026-09-07). Antes da emenda do ADR-0012 o menu
 * oferecia as sete caligráficas, então há crianças com `pinyon` ou `ufmag` guardados — e o valor salvo
 * continua a ser escolha delas, que não é nossa para desfazer sem motivo. O motivo existe: a emenda diz que
 * uma caligráfica **não pode ser a face da interface**, e o menu deixou de a oferecer. Deixá-la valer daria
 * uma interface inteira em letra cursiva a quem já não tem como sair dela pelo menu — uma armadilha, e das
 * silenciosas.
 *
 * ⚠️ E UMA CHAVE APAGADA TAMBÉM VOLTA, pelo mesmo caminho: as quatro faces que saíram do roster já não estão
 * no `FONT_BY_KEY`, então quem tinha `greatvibes` guardado cai no padrão em vez de ficar sem face nenhuma.
 */
export function resolveFontKey(s: FontStore): string {
  const k = s.get(FONT_KEY, null);
  if (k && FONT_BY_KEY[k] && !FONT_BY_KEY[k].off && papelDaFonte(FONT_BY_KEY[k]) === 'geral') return k;
  const leg = s.get(FONT_KEY_LEGACY, null);
  if (leg === 'alfabetizacao') return 'andika';
  if (leg === 'dislexia') return 'lexend';
  return DEFAULT_FONT_KEY;
}
export function persistFontKey(s: FontStore, k: string): void { s.set(FONT_KEY, k); }

// Conveniencia sobre o storage real — mesma logica, sem duplicá-la.
export function loadFontKey(): string { return resolveFontKey(store); }
export function saveFontKey(k: string): void { persistFontKey(store, k); }
