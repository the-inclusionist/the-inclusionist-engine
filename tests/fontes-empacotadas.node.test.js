// SPDX-License-Identifier: AGPL-3.0-or-later
// O QUE VIAJA DENTRO DO PACOTE — os gates que o ADR-0108 §confirmation deixou em dívida.
//
// ========================= POR QUE O PACOTE MERECE UM CRIVO =========================
// ⚠️ CADA FACE QUE VIAJA É UM DOWNLOAD QUE UMA ESCOLA PAGA NA PRIMEIRA CARGA, em máquinas que o pilar 1 do
// ADR-0010 nomeia: Positivo e Chromebook de escola pública. O ADR-0012 já cortara o roster «uma segunda vez,
// por ENTREGA», com essa razão escrita; o ADR-0108 fixou a lista das Playwrite. Uma lista de entrega mantida
// por memória é um pacote que cresce sozinho, e ninguém repara porque cada face isolada parece barata.
//
// ========================= O ANCORADOURO É O `fonts.css`, E NÃO A PASTA =========================
// ⚠️ Medido: `app/public/vendor/fonts/` tem 38 ficheiros e o `fonts.css` tem 38 `@font-face`. Mas a pasta não
// é a verdade — um `.woff2` sem `@font-face` não é utilizável por navegador nenhum, e um `@font-face` a
// apontar para um ficheiro que não existe é uma face morta que o navegador tenta buscar e falha. As duas
// falhas são silenciosas, e por isso os dois sentidos têm caso aqui.
//
// ========================= O QUE AINDA NÃO SE CONSEGUE AFIRMAR, DITO À FRENTE =========================
// 📏 Medido em 2026-09-08: **ZERO faces Playwrite estão empacotadas hoje**, e `git grep` por «playwrite» ou
// «ronde» em `app/js` devolve ZERO. A decisão do ADR-0108 está registada e ainda NÃO foi entregue.
//
// ⚠️ Isso decide a forma deste ficheiro. Um caso a exigir as OITO nasceria vermelho e ficaria vermelho, o que
// não é um gate — é um lembrete que trava a suite. O que se afirma é o que já se pode:
//
//   · a PROIBIÇÃO, que é enforceável hoje: nada de Playwrite fora das oito, e nada da Ronde;
//   · um PISO que só sobe: quantas das oito já chegaram. Hoje zero; no dia em que alguém acrescentar a
//     Brasil o piso sobe para um e não pode voltar. É o «teto que só desce» deste repositório, ao contrário.
//
// ✅ O AVISO DA RONDE FOI ESCRITO EM 2026-09-09, e a linha acima ficou desactualizada no mesmo dia. Ele dizia
// «não há chave i18n nenhuma que o diga» — e a saída foi criá-la: `font.off.ronde`, nos três idiomas, mais a
// entrada `ronde` no catálogo como `geral` + `off`. 📌 O que destravou não foi trabalho novo: foi medir que uma
// entrada `geral` com `off` RENDERIZA (`settings-typo.ts:145` filtra por papel, não por estado), logo a
// superfície já existia. Eu tinha assumido que a ronde teria de ser `caligrafica` e concluído que ficaria
// invisível.
//
// ⬜ UM GATE DO ADR-0108 CONTINUA POR ESCREVER, e é o que mede o que não existe: a chegada POR DOWNLOAD de uma
// face fora das oito — não há mecanismo de download nenhum. Fica registado em vez de fingido: um caso sobre
// uma função inexistente passaria por vácuo e diria que o trabalho está feito.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// O catálogo e os três dicionários, lidos dos MÓDULOS e não de uma cópia — a frase que a criança e o adulto
// leem é a que está aqui, e afirmá-la contra um literal ao lado mediria a cópia.
import { FONT_GROUPS, faceDisponivel, familiasDaFace } from '../app/js/ui/fonts.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

const VENDOR = fileURLToPath(new URL('../app/public/vendor/', import.meta.url));
const CSS = readFileSync(join(VENDOR, 'fonts.css'), 'utf8');
const NA_PASTA = readdirSync(join(VENDOR, 'fonts'));

/**
 * AS QUE VIAJAM. Escritas como aparecem no nome de família da Google Fonts.
 *
 * ⚠️ A forma da lista É o argumento, e ela mudou DUAS VEZES por decisão do Dev — por isso as duas camadas
 * ficam escritas separadas, em vez de fundidas numa lista de quinze que não diz de onde veio nenhuma.
 *
 * 📌 AS OITO ORIGINAIS (ADR-0108 §2) são as Américas com as DUAS mãos americanas, porque os EUA ensinam duas
 * e escolher uma seria escolher pela criança.
 *
 * 🔴 AS SETE NOVAS (ADR-0150) entram por uma regra diferente, e revogam o «nada de empacotar» do ADR-0108:
 * três são o RECUO POR LÍNGUA — um país sem mão própria recebe a do colonizador, e por isso Espanha,
 * Portugal e Inglaterra cobrem TODO país que falta —, duas foram pedidas por nome (Cuba, Peru), e duas são a
 * segunda mão de um país que ensina duas, exactamente como US Trad/Modern.
 *
 * ⚠️ E O CRIVO CONTINUA A PERGUNTAR PELO PREFIXO, que é o que o mantém vivo: uma décima sexta («Playwrite
 * IE», «Playwrite NG», ou qualquer `Guides`) é apanhada sem ter de ser prevista pelo nome.
 */
const AS_OITO = Object.freeze([
  'Playwrite BR', 'Playwrite US Trad', 'Playwrite US Modern', 'Playwrite CA',
  'Playwrite MX', 'Playwrite AR', 'Playwrite CL', 'Playwrite CO',
]);
const AS_SETE_NOVAS = Object.freeze([
  'Playwrite ES', 'Playwrite PT', 'Playwrite GB J',   // os recuos por língua
  'Playwrite CU', 'Playwrite PE',                      // pedidas por nome
  'Playwrite ES Deco', 'Playwrite GB S',               // a segunda mão de quem ensina duas
]);
const AS_EMPACOTADAS = Object.freeze([...AS_OITO, ...AS_SETE_NOVAS]);

/** As três faces da ronde francesa. NENHUMA pode ser empacotada — são gratuitas só para uso PESSOAL. */
const A_RONDE = Object.freeze(['Ronde Script', 'OPTIFrench-Script', 'Merveille']);

/* ---------- as metades puras, para que os fixtures as conduzam ---------- */

/** Os nomes de família declarados num CSS. */
export function familiasDe(css) {
  return [...new Set([...css.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]))];
}

/** Os ficheiros que os `src:` referem, sem a pasta. */
export function referidosPor(css) {
  return [...new Set([...css.matchAll(/url\('fonts\/([^']+)'\)/g)].map((m) => m[1]))];
}

/**
 * Uma família é Playwrite? Perguntado pelo PREFIXO e não por igualdade, de propósito: é assim que uma nona
 * («Playwrite IE», «Playwrite NG») é apanhada sem ter de ser prevista pelo nome.
 */
export function ehPlaywrite(familia) {
  return /^playwrite\b/i.test(familia.trim());
}

/** As Playwrite empacotadas que NÃO estão na lista. */
export function playwriteForaDasOito(familias) {
  return familias.filter((f) => ehPlaywrite(f) && !AS_EMPACOTADAS.includes(f.trim()));
}

/**
 * Qualquer sinal da ronde — família OU nome de ficheiro.
 *
 * ⚠️ Os dois, porque as duas portas são diferentes: um `.woff2` largado na pasta sem `@font-face` continua a
 * ser um ficheiro que este repositório DISTRIBUI, e distribuir é exactamente o que a licença não permite.
 */
export function sinaisDeRonde(familias, ficheiros) {
  const porFamilia = familias.filter((f) => A_RONDE.some((r) => f.trim().toLowerCase() === r.toLowerCase()));
  const chaves = ['ronde', 'optifrench', 'merveille'];
  const porFicheiro = ficheiros.filter((n) => chaves.some((c) => n.toLowerCase().includes(c)));
  return [...porFamilia, ...porFicheiro];
}

/**
 * Qualquer sinal de uma face «Closed Source» da Fontshare — família OU ficheiro.
 *
 * 🔴 A LICENÇA FOI LIDA EM 2026-09-12 (ITF Free Font License, versão 2.0 de 17/08/2026) e reprova duas vezes:
 * o §02 proíbe disponibilizar o ficheiro a terceiros por repositório, aplicação, plataforma ou servidor público,
 * e proíbe oferecê-lo como fonte selecionável a utilizadores terceiros. A engine é um repositório público AGPL e
 * uma biblioteca para trezentos jogos de terceiros. E a definição de obra derivada inclui a conversão de formato
 * — o `.woff2` que empacotamos já seria uma.
 */
export function sinaisDeFontshareFechada(familias, ficheiros) {
  const porFamilia = familias.filter((f) => /^clash\b/i.test(f.trim()));
  const porFicheiro = ficheiros.filter((n) => n.toLowerCase().includes('clash'));
  return [...porFamilia, ...porFicheiro];
}

const familias = familiasDe(CSS);
const referidos = referidosPor(CSS);

describe('ADR-0108 · o que viaja dentro do pacote', () => {
  it('⚠️ [Interface] o crivo está VIVO: lê famílias e ficheiros de verdade', () => {
    // O caso do vácuo, e primeiro pela mesma razão de sempre: sem ele, os casos de ausência abaixo passariam
    // por não terem nada que examinar. A prova é código real — as 38 faces que o repositório empacota hoje.
    expect(NA_PASTA.length, 'a pasta de fontes veio vazia — o caminho morreu').toBeGreaterThan(30);
    expect(referidos.length, 'nenhum `src` foi lido — a regex morreu').toBeGreaterThan(30);
    expect(familias, 'a família âncora não foi lida').toContain('Atkinson Hyperlegible');
  });

  it('⚠️ [Zero] NENHUMA Playwrite fora das oito viaja no pacote', () => {
    expect(
      playwriteForaDasOito(familias),
      'Playwrite empacotada que o ADR-0108 não nomeia. Cada face é um download que TODA escola paga, '
      + 'inclusive a que precisa de uma só — o roster é por língua, o PACOTE são as oito.',
    ).toEqual([]);
  });

  it('⚠️ [Zero] NENHUMA face da ronde é empacotada — é uso PESSOAL, não distribuição', () => {
    expect(
      sinaisDeRonde(familias, NA_PASTA),
      'ronde no pacote: as três são gratuitas só para uso pessoal, e empacotá-las é distribuir o que não '
      + 'foi licenciado para distribuição (ADR-0012, mantido pelo ADR-0108 §3)',
    ).toEqual([]);
  });

  it('🔴 [Zero] a Clash Display NÃO é empacotada — a ITF Free Font License proíbe distribuí-la (ADR-0150)', () => {
    // O ADR-0150 recusou-a «até a licença ser lida». Foi lida, e o que era espera virou recusa com motivo.
    expect(
      sinaisDeFontshareFechada(familias, NA_PASTA),
      'face Closed Source da Fontshare no pacote: a ITF FFL §02 proíbe distribuí-la por repositório, aplicação '
      + 'ou servidor público, e servi-la como fonte selecionável a terceiros — que é o que a engine faz',
    ).toEqual([]);
    // 📌 O par: o detector VÊ a família e o ficheiro, senão a ausência acima passava por cegueira.
    expect(sinaisDeFontshareFechada(['Clash Display', 'Lexend'], ['clashdisplay-var.woff2', 'lexend-var.woff2']))
      .toEqual(['Clash Display', 'clashdisplay-var.woff2']);
  });

  it('✅ [Boundary] o PISO das oito só sobe — hoje são OITO, e a decisão está entregue', () => {
    // ⚠️ ESTE É O CASO QUE DIZ A VERDADE SOBRE O ESTADO. O ADR-0108 decidiu que oito viajam; medido hoje,
    // viajam ZERO. Exigir as oito faria um caso vermelho permanente, que não é um gate — é um lembrete que
    // trava a suite. Um PISO regista o que já chegou e impede o recuo: no dia em que a Brasil entrar, este
    // número sobe para 1 e não pode voltar sem alguém o escrever aqui à mão.
    const PISO = 8;
    const presentes = familias.filter((f) => AS_OITO.includes(f.trim()));
    expect(presentes.length, `o pacote PERDEU Playwrite: tinha ${PISO}, tem ${presentes.length}`)
      .toBeGreaterThanOrEqual(PISO);
    // ✅ ENTREGUES EM 2026-09-09 — as oito chegaram (535 KB, um ficheiro variável por família) e o piso subiu
    // de ZERO para OITO. A linha que dizia «nenhuma delas chegou ainda» saiu por ter deixado de ser verdade:
    // era a outra metade do piso, e apagá-la é a decisão do ADR-0108 a passar de registada a entregue.
    expect(presentes.length, 'as oito são o piso: falta alguma').toBe(AS_OITO.length);
  });

  it('⚠️ [Interface] todo `@font-face` aponta para um ficheiro que EXISTE', () => {
    // Uma face órfã não dá erro: o navegador busca, falha, e cai na fonte seguinte da pilha. A criança que
    // precisa da Andika para ler recebe outra coisa, e ninguém vê.
    const naPasta = new Set(NA_PASTA);
    expect(referidos.filter((f) => !naPasta.has(f)), '`src` a apontar para ficheiro inexistente').toEqual([]);
  });

  it('⚠️ [Interface] todo ficheiro empacotado é REFERIDO — não há peso morto', () => {
    // O outro sentido, e é o que apanha o crescimento: um `.woff2` sem `@font-face` não é utilizável por
    // ninguém e mesmo assim viaja, é baixado e é pago. É a forma mais barata de um pacote engordar em silêncio.
    const usados = new Set(referidos);
    expect(NA_PASTA.filter((n) => n.endsWith('.woff2') && !usados.has(n)), 'ficheiro empacotado que ninguém declara').toEqual([]);
  });

  /* ===================== 🎯 O QUARTO GATE DO ADR-0108, e ele mudou de forma ao ser medido =====================
   *
   * O que a #87 pedia era «a CHEGADA POR DOWNLOAD de uma face fora das oito», e o estado ficou 🛑 durante dias
   * com a razão certa: não havia mecanismo de download nenhum. ⚠️ **E construir um HOJE seria um defeito**, por
   * três medições e não por preguiça:
   *
   *   1. O catálogo tem **as oito e mais nenhuma** Playwrite, e o jogo fala **três idiomas** (`app/js/i18n/`
   *      tem `pt`, `en`, `es`). As oito cobrem as Américas desses três. **A «criança na Irlanda» que eu
   *      próprio escrevi neste ficheiro não é alcançável**: o ADR-0012 limita o roster por LÍNGUA, e não há
   *      quarta língua. Não há hoje uma só pessoa que possa pedir a nona.
   *   2. Uma descarga SOB DEMANDA é, na forma, o defeito do WebGazer — preguiçosa, logo a máquina que nunca
   *      pediu aquela face não a tem, e sem rede não acontece nada. É a coisa que o `nada-vem-de-fora` acusa.
   *   3. Um gate sobre um mecanismo cujo GATILHO não pode ocorrer nasce vazio, e um gate que não pode ficar
   *      vermelho é um gate que alguém desliga.
   *
   * 🎯 ENTÃO O QUE SE AFIRMA É A REGRA DE QUE O DOWNLOAD SERIA UMA CONSEQUÊNCIA, e ela mede a árvore de hoje:
   * **nenhuma face é OFERECIDA sem uma forma de a obter.** Uma nona Playwrite não pode entrar no catálogo sem
   * ficheiro nem remédio — e no dia em que alguém a quiser pôr, é este caso que o obriga a construir a chegada
   * ANTES de a oferecer, que é a ordem certa.
   *
   * ⚠️ E ISTO NÃO É UMA REGRA INVENTADA: é a lição que o cabeçalho do `ui/fonts` já escreve por ter pagado
   * por ela. A `learningcurve` e a `kindergarten` eram entradas `.off` SEM FICHEIRO — «o menu oferecia-as e
   * ninguém as podia obter» — e saíram por isso. A regra existia, e nunca tinha sido gate.
   *
   * 📏 MEDIDO EM 2026-09-09: 26 entradas, 25 empacotadas, 1 (`ronde`) `off` com remédio accionável. Zero
   * excepções, logo a invariante é de DUAS pernas e não precisa de uma terceira para faces do sistema. */
  it('🎯 [Right] NENHUMA face é oferecida sem forma de a obter — empacotada, ou `off` com remédio', () => {
    const semSaida = [];
    for (const item of FONT_GROUPS.flatMap((g) => g.items)) {
      const empacotada = familiasDaFace(item).some((f) => familias.includes(f.trim()));
      if (empacotada) continue;
      // A outra perna: `off` com uma chave que RESOLVE nos três dicionários. Um `off` sem mensagem é a linha
      // cinzenta que não diz o que fazer — a criança perde a face e o adulto não sabe porquê.
      const remedio = item.off && [pt, en, es].every((d) => typeof d[item.off] === 'string' && d[item.off].length > 8);
      if (!remedio) semSaida.push(`${item.k} («${item.fam}»)`);
    }
    expect(
      semSaida,
      'face no catálogo que ninguém consegue obter: nem viaja no pacote, nem tem `off` com remédio nos três '
      + 'idiomas. É o defeito da `learningcurve` a voltar — o menu oferece, a criança escolhe, e o navegador '
      + 'cai na fonte seguinte da pilha sem nada o dizer. Se é uma Playwrite fora das oito, ela precisa da '
      + 'CHEGADA antes da oferta (ADR-0108 §2).',
    ).toEqual([]);

    // 📌 O PAR, e sem ele o caso passa por vacuidade: se o catálogo esvaziar ou o CSS deixar de ser lido, a
    // lista de faltosos fica vazia por não haver nada que medir. É a mesma armadilha do resultado vazio.
    expect(FONT_GROUPS.flatMap((g) => g.items).length, 'o catálogo esvaziou — o caso mediria o nada')
      .toBeGreaterThanOrEqual(26);
  });

  it('[Right] uma NONA Playwrite reprova — mesmo uma dentro do roster por língua', () => {
    // «Playwrite IE» é Irlanda: inglês, logo DENTRO do roster do ADR-0012 e FORA do pacote do ADR-0108. É
    // exactamente o caso que a distinção entre roster e pacote existe para tratar.
    expect(playwriteForaDasOito(['Playwrite BR', 'Playwrite IE'])).toEqual(['Playwrite IE']);
    expect(playwriteForaDasOito([...AS_OITO])).toEqual([]);
  });

  /* ===================== ADR-0108 §4 · A OPÇÃO DA RONDE FALA, E NOMEIA AS TRÊS =====================
   *
   * O ADR-0012 decidiu a licença — as três faces são livres só para uso PESSOAL e nunca são empacotadas — e
   * decidiu o controle: fica DESABILITADO enquanto nenhuma estiver presente. O que ninguém tinha escrito é o
   * que a opção DIZ. Um botão cinzento sem explicação ensina a um adulto que a funcionalidade está partida,
   * quando ela está a uma instalação de distância.
   *
   * 🎯 E A REGRA É NOMEAR AS TRÊS, não a categoria. «Instale uma fonte ronde» é inaccionável — um adulto não
   * age sobre uma categoria —, e é exactamente a forma que o ADR-0108 recusa por escrito. Este bloco existe
   * para que a frase não possa deslizar para lá.
   *
   * ⚠️ E É O QUE SEPARA ESTA ENTRADA `.off` DAS DUAS QUE ESTE CATÁLOGO JÁ REMOVEU. A `learningcurve` e a
   * `kindergarten` diziam «ainda não», que ninguém pode resolver, e saíram com essa razão escrita no
   * cabeçalho de `ui/fonts`. Esta diz o que fazer. A accionabilidade é a diferença, e é ela que este gate
   * afere — sem ele, a próxima pessoa remove a linha citando o comentário certo pelo motivo errado. */
  describe('ADR-0108 §4 · a opção desabilitada nomeia as três faces', () => {
    const RONDE = FONT_GROUPS.flatMap((g) => g.items).find((it) => it.k === 'ronde');

    it('[Vácuo] a entrada `ronde` existe no catálogo e está DESLIGADA', () => {
      expect(RONDE, 'a entrada da ronde saiu do catálogo — o ADR-0108 §4 ficou sem sujeito').toBeTruthy();
      expect(RONDE.off, 'a ronde ficou selecionável: as três faces não podem ser empacotadas').toBeTruthy();
      // 📌 `geral` e não `caligrafica`, apesar de ela ser caligráfica: o menu filtra as caligráficas, e uma
      // linha filtrada não diz nada a ninguém. O papel «certo» apagaria a única coisa que ela faz.
      expect(RONDE.papel, 'a ronde foi marcada como caligráfica e desapareceu do menu').toBeUndefined();
    });

    it('🎯 [Right] a mensagem nomeia AS TRÊS, nos três idiomas', () => {
      for (const [nome, dic] of [['pt', pt], ['en', en], ['es', es]]) {
        const msg = dic[RONDE.off];
        expect(msg, `${nome}: a chave \`${RONDE.off}\` não existe no dicionário`).toBeTruthy();
        for (const face of A_RONDE) {
          expect(msg, `${nome}: a mensagem não nomeia «${face}»`).toContain(face);
        }
      }
    });

    /* 🎯 O «ENQUANTO» DO ADR-0012, QUE ERA A METADE QUE FALTAVA. O registo diz que o controle fica desabilitado
     * «enquanto nenhuma fonte estiver presente» — o que implica DEIXAR de estar quando uma estiver. Sem isto a
     * opção nunca habilitava: o adulto seguia a instrução, instalava a face, e a linha continuava cinzenta a
     * mandá-lo instalar o que ele acabara de instalar. */
    it('🎯 [Right] com UMA das três instalada, a face fica disponível', () => {
      const so = (alvo) => (f) => f === alvo;
      for (const face of A_RONDE) {
        expect(faceDisponivel(RONDE, so(face)), `${face} instalada e a ronde continua indisponível`).toBe(true);
      }
    });

    it('⚠️ [Zero] sem nenhuma das três, continua indisponível — e SEM detector também', () => {
      expect(faceDisponivel(RONDE, () => false)).toBe(false);
      // 📌 O padrão sem detector é «indisponível», e é seguro por uma razão que não vale para todos os padrões
      // deste repositório: a linha fica desabilitada COM a mensagem, e a mensagem é accionável.
      expect(faceDisponivel(RONDE, undefined)).toBe(false);
    });

    it('📌 [Boundary] uma face que NÃO é `off` está disponível sem detector nenhum', () => {
      // O par que impede a regra de virar «tudo depende do detector»: as outras dezoito nunca dependeram dele.
      const atkinson = FONT_GROUPS.flatMap((g) => g.items).find((it) => it.k === 'atkinson');
      expect(faceDisponivel(atkinson, undefined)).toBe(true);
      expect(faceDisponivel(atkinson, () => false)).toBe(true);
    });

    it('⚠️ [Interface] a PILHA de três é lida como três famílias, não como uma', () => {
      // O `fam` da ronde é `'Ronde Script, OPTIFrench-Script, Merveille'`. Tratá-lo como um nome único faria
      // `check('16px "Ronde Script, OPTIFrench-Script, Merveille"')` — que devolve falso sempre, e a opção
      // nunca habilitaria por mais fontes que o adulto instalasse.
      expect(familiasDaFace(RONDE)).toEqual(A_RONDE);
    });

    it('⚠️ [Right] e uma frase que nomeia a CATEGORIA reprovaria — a forma que o ADR-0108 recusa', () => {
      // A regra como função, conduzida por fixture: sem isto o caso acima passaria por a frase actual estar
      // certa, e nada diria que a ERRADA é detectável. É a redacção que o registo rejeita, palavra por palavra.
      const nomeiaAsTres = (texto) => A_RONDE.every((f) => texto.includes(f));
      expect(nomeiaAsTres('Instale uma fonte ronde no aparelho.')).toBe(false);
      expect(nomeiaAsTres('Instale Ronde Script, OPTIFrench-Script ou Merveille.')).toBe(true);
      // ⚠️ E DUAS DAS TRÊS NÃO CHEGAM: quem tiver só as outras duas lê uma lista que não serve para ele.
      expect(nomeiaAsTres('Instale Ronde Script ou Merveille.')).toBe(false);
    });
  });

  it('[Right] a ronde é apanhada pela FAMÍLIA e também pelo FICHEIRO solto', () => {
    expect(sinaisDeRonde(['Merveille'], [])).toEqual(['Merveille']);
    expect(sinaisDeRonde([], ['ronde-script-400.woff2'])).toEqual(['ronde-script-400.woff2']);
    expect(sinaisDeRonde(['Atkinson Hyperlegible'], ['atkinson-400.woff2'])).toEqual([]);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Seis, cada uma aplicada por script a ficheiro e com contagem de ocorrencias (=1 nas seis).
//   · `ehPlaywrite` a devolver sempre falso -> reprova a NONA. Sem ele o crivo deixa de reconhecer a familia
//     que existe para reconhecer, e passa a aprovar qualquer coisa.
//   · `playwriteForaDasOito` a ignorar `AS_OITO` -> reprova a NONA pelo outro lado: passa a acusar tambem as
//     que DEVEM viajar, e um gate que acusa o correcto e desligado na semana seguinte.
//   · `sinaisDeRonde` sem a metade dos FICHEIROS -> reprova o caso da ronde. As duas portas sao diferentes:
//     um `.woff2` largado na pasta sem `@font-face` continua a ser distribuido, e distribuir e o que a
//     licenca nao permite.
//   · matando a regex das FAMILIAS -> reprova o caso do VACUO, e so ele. Sem esse caso, os dois `[Zero]`
//     passariam por nao terem nada que examinar.
//   · matando a regex dos `src` -> reprovam DOIS: o vacuo e o do PESO MORTO. O segundo e a medida de que ele
//     esta vivo — sem `src` nenhum lido, todo ficheiro parece nao referido.
//   · ⚠️ apontando um `src` REAL do `fonts.css` para um ficheiro que nao existe -> reprovam DOIS, e nao um: o
//     ORFAO (a face que o navegador busca e nao acha) e o PESO MORTO (o ficheiro que ficou sem quem o
//     declare). Aplicada ao asset de verdade e restaurada por copia. As duas falhas sao silenciosas em
//     producao: o navegador cai na fonte seguinte da pilha, e a crianca que precisa da Andika para ler
//     recebe outra coisa sem que nada o diga.
//
// ===== MUTACOES DO QUARTO GATE (2026-09-09) =====
//  N1. uma NONA Playwrite no catalogo sem ficheiro nem remedio (`{k:'pwie', fam:'Playwrite IE', …}` — Irlanda,
//      que e ingles logo DENTRO do roster por lingua) -> reprova, e reprova SOZINHA. 🎯 E essa solidao e a
//      medida do buraco: o caso «uma NONA Playwrite reprova» que ja existia conduz a metade PURA com um
//      fixture, entao ficou VERDE com a nona no catalogo a serio. Um afirma que a funcao sabe distinguir; o
//      outro afirma que a arvore nao tem nenhuma. Nao sao a mesma coisa, e so o segundo apanha a oferta.
//  N2. a ronde a perder o `off` -> reprovam QUATRO. A face deixa de ser empacotada E de dizer o que fazer,
//      que e exactamente a `learningcurve` de volta: o menu oferece e ninguem a pode obter.
//
// ⚠️ ESTA NOTA DIZIA O CONTRARIO ATE 2026-09-09, e a correcao e de CITACAO e nao de regra. Ela lia-se «o que
// nenhuma mutacao prova hoje: que as OITO chegam — elas nao existem no pacote». Isso deixou de ser verdade em
// `a365f8e`: as oito viajam (535 KB, um ficheiro variavel por familia), o PISO subiu de 0 para 8 e o caso
// exige-as por igualdade. Deixada como estava, ela mandaria o proximo leitor procurar um buraco ja tapado —
// e pior, faria o piso de 8 parecer aspiracional quando ele e medido.
