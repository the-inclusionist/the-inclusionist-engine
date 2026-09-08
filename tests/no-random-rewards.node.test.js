// SPDX-License-Identifier: AGPL-3.0-or-later
// NENHUM ELEMENTO ALEATÓRIO EM RECOMPENSA ALGUMA — a segunda metade da dívida do §5 da issue #93.
//
// ========================= AS PALAVRAS DA ISSUE, E O QUE ELAS EXIGEM =========================
// «Sem recompensa variável, lootbox ou caixa aleatória. **Nenhum elemento aleatório em recompensa alguma** —
// asseverado sobre o CÓDIGO DE RECOMPENSA, não prometido em documento.»
//
// A última oração é a especificação deste ficheiro: a issue recusa antecipadamente a resposta «está escrito
// no registo que não fazemos isso». O que se afirma aqui é o código.
//
// ========================= POR QUE É UM CRIVO E NÃO UMA BUSCA POR PALAVRA =========================
// A afirmação é uma AUSÊNCIA, e uma ausência não se prova procurando «lootbox»: quem a escrevesse não lhe
// chamaria isso. O que se prova é o INVENTÁRIO — a engine inteira é varrida por aleatoriedade, a lista de
// quem a usa fica congelada, e cada entrada diz O QUE aquele módulo sorteia. Um módulo novo a sortear obriga
// alguém a escrever essa linha à mão, e é aí que «isto varia a recompensa» teria de ser escrito em vez de
// entrar sem ninguém reparar.
//
// ⚠️ E A RAZÃO NÃO É DE GOSTO. Recompensa variável é o mecanismo do caça-níqueis, e o ADR-0049 ordena as
// comemorações com uma regra que a exclui: «nenhuma recompensa pode ser superior à percepção de crescimento
// pessoal». Um sorteio põe a surpresa acima da curva da criança, que é exactamente a inversão proibida.
//
// ========================= O QUE ESTE FICHEIRO NÃO ALCANÇA, DITO À FRENTE =========================
// ⚠️ Ele mede aleatoriedade ESCRITA no módulo, não recebida por injecção: o `platform/audio-jingles` não tem
// import nenhum (medido — o ctx traz tudo), então um hospedeiro poderia injectar-lhe uma primitiva que
// sorteia. Isso é do hospedeiro e não se vê daqui. O que se vê, e é o que a issue pede, é o código.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));

/** Toda fonte de aleatoriedade que um módulo pode escrever. `crypto.*` entra porque é a saída óbvia de quem
 *  quiser contornar o `Math.random` sem lhe chamar sorteio. */
const SORTEIA = /Math\.random\s*\(|crypto\.getRandomValues\s*\(|crypto\.randomUUID\s*\(/;

function ficheirosTs(dir = RAIZ) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...ficheirosTs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(p);
  }
  return saida;
}

/**
 * Linhas de CÓDIGO (sem comentário de linha) que sorteiam.
 *
 * ⚠️ A GUARDA DE COMENTÁRIO EXISTE E HOJE NÃO É O QUE PROTEGE — e isso soube-se por uma mutação que
 * SOBREVIVEU. Tirá-la não reprovava nada, porque os três comentários que hoje nomeiam `Math.random` neste
 * repositório escrevem-no SEM parênteses (`` `Math.random` ``), e a regex exige o `(`. Ela fica na mesma, e
 * agora com um caso próprio: o dia em que alguém escrever um exemplo de código num comentário — que é a
 * forma natural de documentar o que NÃO fazer — é o dia em que ela passa a ser a única defesa.
 */
export function contaSorteios(texto) {
  return texto.split(/\r?\n/)
    .filter((ln) => !/^\s*(\/\/|\*|\/\*)/.test(ln) && SORTEIA.test(ln)).length;
}

function sorteiosDe(p) {
  return contaSorteios(readFileSync(p, 'utf8'));
}

/**
 * O INVENTÁRIO da aleatoriedade. Chave = caminho a partir de `app/js/`; valor = O QUE aquele módulo sorteia.
 *
 * ⚠️ Cada entrada diz o que varia, porque é essa a pergunta do §5. As três de hoje variam TIMBRE — a textura
 * de um ruído —, e nenhuma delas escolhe o que a criança recebe.
 */
const INVENTARIO = {
  'platform/audio-ambient.ts': 'timbre · ruído rosa do ambiente e a frequência do passa-baixo de cada rajada',
  'platform/audio.ts': 'timbre · o buffer de ruído branco que os efeitos usam como fonte',
};

/**
 * O CÓDIGO DE RECOMPENSA — os módulos sobre os quais a issue manda asseverar.
 *
 * ⚠️ A lista é escrita à mão de propósito, e o caso do ÓRFÃO logo abaixo é o que a impede de apodrecer:
 * «que módulos são recompensa» é juízo, não sintaxe, e um crivo que o adivinhasse erraria em silêncio.
 *
 * 📌 As comemorações do §3 (domínio e superação) ainda não existem. Quando existirem, entram AQUI — e é o
 * caso do órfão que garante que esta lista continua a descrever o repositório em vez de o recordar.
 */
const RECOMPENSA = [
  'platform/audio-jingles.ts',    // as recompensas SONORAS: vitória, enigma resolvido, fogos
  'educational/adaptive-engine.ts', // as faixas que decidem subir e descer de nível
  'educational/segment-bar.ts',   // a barra que projecta o veredicto de dez questões
];

const sorteadores = ficheirosTs()
  .map((p) => [relative(RAIZ, p).split('\\').join('/'), sorteiosDe(p)])
  .filter(([, n]) => n > 0)
  .map(([m]) => m);

describe('issue #93 §5 · nenhum elemento aleatório em recompensa alguma', () => {
  it('⚠️ [Zero] NENHUM módulo de RECOMPENSA sorteia', () => {
    // O caso que a issue nomeia. Hoje passa por os três não terem sorteio nenhum — e é o caso de baixo, o
    // do vácuo, que impede isto de passar por a varredura ter morrido.
    const culpados = RECOMPENSA.filter((m) => sorteadores.includes(m));
    expect(
      culpados,
      'código de recompensa a sortear. Recompensa variável é o mecanismo do caça-níqueis, e o ADR-0049 '
      + 'ordena as comemorações com a regra que a exclui: nenhuma recompensa acima da percepção de crescimento.',
    ).toEqual([]);
  });

  it('⚠️ [Zero] a camada de CURRÍCULO não sorteia — é ela que decide o que a criança vê a seguir', () => {
    // O crivo mais estreito: `educational/` é onde vivem o motor adaptativo e a barra. Um sorteio ali não
    // varia um prémio — varia a PROGRESSÃO, que é pior.
    expect(sorteadores.filter((m) => m.startsWith('educational/'))).toEqual([]);
  });

  it('⚠️ [Interface] nenhum sorteador NOVO entrou sem ser declarado', () => {
    const novos = sorteadores.filter((m) => !(m in INVENTARIO));
    expect(
      novos,
      'módulo novo a sortear. Acrescente-o ao INVENTARIO dizendo O QUE ele sorteia — e se a resposta for '
      + '«o que a criança recebe», o §5 da #93 diz que não pode.',
    ).toEqual([]);
  });

  it('[Interface] o inventário não tem ÓRFÃOS — entrada que nomeia quem já não sorteia', () => {
    const vivos = new Set(sorteadores);
    expect(Object.keys(INVENTARIO).filter((m) => !vivos.has(m))).toEqual([]);
  });

  it('[Interface] a lista de RECOMPENSA não tem órfãos — senão descreve um repositório que não existe', () => {
    const todos = new Set(ficheirosTs().map((p) => relative(RAIZ, p).split('\\').join('/')));
    expect(RECOMPENSA.filter((m) => !todos.has(m)), 'módulo de recompensa que já não existe').toEqual([]);
  });

  it('⚠️ [Interface] e o crivo CONTINUA VIVO: ele acha o sorteio que existe de verdade', () => {
    // Sem isto, os três casos acima passariam por a regex ou o caminho terem morrido — «um crivo que não acha
    // nada não prova ausência nenhuma, prova que o crivo morreu». E a prova não é um fixture: é código REAL
    // deste repositório, o buffer de ruído branco que o `platform/audio` constrói.
    expect(sorteadores, 'a varredura não achou sorteio nenhum — a regex ou o caminho morreram')
      .toContain('platform/audio.ts');
    expect(sorteadores.length).toBeGreaterThan(1);
  });

  it('[Right] os módulos que NOMEIAM `Math.random` para dizer que não o usam não são acusados', () => {
    // O `render/scene-parallax` escreve «PURO E DETERMINÍSTICO … Sem `Math.random`, a mesma fase desenha o
    // mesmo horizonte». Acusá-los seria acusar precisamente quem obedece à regra.
    expect(sorteadores).not.toContain('render/scene-parallax.ts');
    expect(sorteadores).not.toContain('render/camera.ts');
  });

  it('⚠️ [Right] e um EXEMPLO DE CÓDIGO dentro de um comentário também não conta', () => {
    // ⚠️ ESTE CASO NASCEU DE UMA MUTAÇÃO SOBREVIVENTE. Tirar a guarda de comentário não reprovava nada,
    // porque os comentários deste repositório escrevem `` `Math.random` `` sem parênteses e a regex exige o
    // `(`. O caso acima passava, mas não pela razão que dizia. A forma natural de documentar uma proibição é
    // mostrar o código proibido — e é aí que a guarda passa a ser a única defesa.
    expect(contaSorteios('// nunca faça isto: const premio = Math.random();')).toBe(0);
    expect(contaSorteios(' * @example const x = crypto.randomUUID();')).toBe(0);
    // E o outro lado, que é o que impede a guarda de virar um buraco: código a sério continua a contar.
    expect(contaSorteios('const premio = Math.random();')).toBe(1);
    expect(contaSorteios('const id = crypto.randomUUID(); // com comentário no FIM da linha')).toBe(1);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Sete, cada uma aplicada por script a ficheiro e com contagem de ocorrencias (=1 nas sete).
//   · ⚠️ A AMEACA REAL — pondo `Math.random()` dentro do `educational/segment-bar` -> reprovam TRES, por
//     caminhos independentes: "modulo de RECOMPENSA sorteia", "a camada de CURRICULO nao sorteia" e
//     "sorteador NOVO". Um sorteio ali nao varia um premio: varia a PROGRESSAO, que e pior.
//   · pondo `Math.random()` no `platform/audio-jingles` (as recompensas SONORAS) -> reprovam DOIS.
//   · matando a regex `SORTEIA` -> reprovam DOIS, e o que interessa e o do VACUO: sem ele, os tres casos de
//     ausencia passariam por nao terem nada que examinar. Um crivo que nao acha nada nao prova ausencia
//     nenhuma — prova que o crivo morreu. E a prova de vida NAO e um fixture: e o buffer de ruido branco que
//     o `platform/audio` constroi de verdade.
//   · tirando uma entrada do INVENTARIO -> reprovam DOIS ("sorteador NOVO" e o ORFAO), que e a medida de que
//     a lista tem de acompanhar o repositorio nos dois sentidos.
//   · pondo na lista de RECOMPENSA um modulo que nao existe -> reprova o orfao dela. Sem esse caso a lista
//     apodrece: descreveria um repositorio que ja nao existe, e pareceria cobrir mais do que cobre.
//   · ⚠️ tirando a guarda de COMENTARIO -> SOBREVIVEU na primeira volta, e a sobrevivencia era informacao: os
//     tres comentarios que hoje nomeiam `Math.random` escrevem-no SEM parenteses, e a regex exige o `(`. O
//     caso que existia passava, mas nao pela razao que dizia. Escrito o caso do EXEMPLO DE CODIGO num
//     comentario — que e a forma natural de documentar uma proibicao —, a mesma mutacao passou a reprovar.
//   · tirando o ramo `crypto.*` da regex -> reprova o mesmo caso. Ele esta la porque `crypto.randomUUID` e a
//     saida obvia de quem quiser sortear sem escrever a palavra `random` ao lado de `Math`.
