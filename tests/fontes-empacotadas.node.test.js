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
// ⬜ E DOIS GATES DO ADR-0108 CONTINUAM POR ESCREVER, porque o que eles medem não existe: o AVISO da Ronde
// (não há chave i18n nenhuma que o diga) e a chegada POR DOWNLOAD de uma face fora das oito (não há mecanismo
// de download). Ficam registados aqui em vez de fingidos — um caso sobre uma função inexistente passaria por
// vácuo e diria que o trabalho está feito.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// O catálogo e os três dicionários, lidos dos MÓDULOS e não de uma cópia — a frase que a criança e o adulto
// leem é a que está aqui, e afirmá-la contra um literal ao lado mediria a cópia.
import { FONT_GROUPS } from '../app/js/ui/fonts.js';
import pt from '../app/js/i18n/pt.js';
import en from '../app/js/i18n/en.js';
import es from '../app/js/i18n/es.js';

const VENDOR = fileURLToPath(new URL('../app/public/vendor/', import.meta.url));
const CSS = readFileSync(join(VENDOR, 'fonts.css'), 'utf8');
const NA_PASTA = readdirSync(join(VENDOR, 'fonts'));

/**
 * AS OITO QUE VIAJAM (ADR-0108 §2). Escritas como aparecem no nome de família da Google Fonts.
 *
 * ⚠️ A forma da lista É o argumento, e o registo di-lo: são as Américas com as DUAS mãos americanas, porque
 * os EUA ensinam duas e escolher uma seria escolher pela criança.
 */
const AS_OITO = Object.freeze([
  'Playwrite BR', 'Playwrite US Trad', 'Playwrite US Modern', 'Playwrite CA',
  'Playwrite MX', 'Playwrite AR', 'Playwrite CL', 'Playwrite CO',
]);

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

/** As Playwrite empacotadas que NÃO estão nas oito. */
export function playwriteForaDasOito(familias) {
  return familias.filter((f) => ehPlaywrite(f) && !AS_OITO.includes(f.trim()));
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

  it('⚠️ [Boundary] o PISO das oito só sobe — hoje é ZERO, e isso é a decisão por entregar', () => {
    // ⚠️ ESTE É O CASO QUE DIZ A VERDADE SOBRE O ESTADO. O ADR-0108 decidiu que oito viajam; medido hoje,
    // viajam ZERO. Exigir as oito faria um caso vermelho permanente, que não é um gate — é um lembrete que
    // trava a suite. Um PISO regista o que já chegou e impede o recuo: no dia em que a Brasil entrar, este
    // número sobe para 1 e não pode voltar sem alguém o escrever aqui à mão.
    const PISO = 0;
    const presentes = familias.filter((f) => AS_OITO.includes(f.trim()));
    expect(presentes.length, `o pacote PERDEU Playwrite: tinha ${PISO}, tem ${presentes.length}`)
      .toBeGreaterThanOrEqual(PISO);
    // E a outra metade da verdade: nenhuma delas chegou ainda.
    expect(presentes.length, 'chegou alguma das oito — suba o PISO acima e apague esta linha').toBe(0);
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
// ⚠️ O QUE NENHUMA MUTACAO PROVA HOJE: que as OITO chegam. Elas nao existem no pacote, e o caso do PISO diz
// isso por extenso em vez de o esconder. Quando a primeira entrar, o piso sobe e passa a haver o que medir.
