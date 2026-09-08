// SPDX-License-Identifier: AGPL-3.0-or-later
// O CENSO DOS SINKS DE MARKUP (issue #106) — e o que ele pode e não pode provar.
//
// ========================= POR QUE UM TESTE E NÃO UMA REGRA SEMGREP =========================
// A issue pede *"uma regra que de facto cubra isto, ou o lint equivalente"*. É um teste, por três razões:
//
//   · ⚠️ SEMGREP NÃO SABE DE ONDE VEM O DADO. A pergunta que interessa — «isto interpola texto que uma
//     pessoa escreveu?» — é de proveniência, e sintaticamente `el.innerHTML = f(x)` é igual quer `f` cole um
//     literal quer cole o que um professor digitou. Uma regra sintática ou acusa os 37 (e é desligada no
//     primeiro dia) ou não acusa nenhum.
//   · O gate que a casa já usa para o mesmo assunto é um teste: `i18n-sem-markup.node.test.js`.
//   · Uma regra semgrep não pode ser provada VERMELHA daqui — não há semgrep nesta máquina —, e a regra da
//     casa é que todo gate nasce vermelho com mutação confirmada. Gate que não se pôde ver falhar é hábito.
//
// ========================= O QUE ESTE GATE PROVA, E O QUE NÃO PROVA =========================
// ⚠️ ELE NÃO PROVA QUE OS 37 SÃO SEGUROS. Prova uma coisa mais modesta e que hoje ninguém prova: que
// **nenhum sink NOVO apareceu sem alguém olhar para ele**. É exatamente a lacuna que o cabeçalho do
// `i18n-sem-markup` nomeia desde 2026: *"qualquer `innerHTML` novo que interpole algo que não seja i18n,
// número ou chave enumerada"*.
//
// O CENSO ANTERIOR CONTINUA VALENDO, e foi feito da forma certa — por FONTE DE DADO, não por ponto (ver o
// cabeçalho daquele ficheiro): nome de dispositivo de áudio, nome de voz e progresso do assistente vão por
// `textContent`; id de gamepad é só chave de busca; palavras dos desafios são empacotadas; nenhum valor do
// armazenamento chega a markup. O i18n era o vetor aberto, e aquele gate fecha-o.
//
// ⚠️ E A ARQUITETURA MOVEU-SE POR BAIXO DAQUELE CENSO. Quando ele correu, o contrato não existia (ADR-0030) e
// todo jogo vivia nesta árvore. Hoje um jogo vive noutro repositório e consome a engine como pacote
// (ADR-0083) — então o texto que ELE declara (`Objective.name`, o rótulo de uma ação) é texto que esta árvore
// não revê. Dois sinks recebem isso, e é a razão de a lista `A_REVER` existir em vez de um verde limpo.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');
const SINK = /innerHTML\s*=|insertAdjacentHTML/;

/** Todos os `.ts` de `app/js`, recursivo. */
function ficheiros(dir = RAIZ, base = '') {
  const saida = [];
  for (const nome of readdirSync(dir).sort()) {
    const cheio = join(dir, nome);
    if (statSync(cheio).isDirectory()) saida.push(...ficheiros(cheio, base ? `${base}/${nome}` : nome));
    else if (nome.endsWith('.ts')) saida.push({ rel: base ? `${base}/${nome}` : nome, cheio });
  }
  return saida;
}

/** Os sinks de hoje: `ficheiro` + o começo da linha de CÓDIGO (comentário não conta). */
function sinksDeHoje() {
  const achados = [];
  for (const f of ficheiros()) {
    for (const bruta of readFileSync(f.cheio, 'utf8').split('\n')) {
      const linha = bruta.trim();
      if (!linha || linha.startsWith('//') || linha.startsWith('*')) continue;
      if (SINK.test(linha)) achados.push({ onde: f.rel, trecho: linha.slice(0, 52) });
    }
  }
  return achados;
}

/**
 * OS SINKS CLASSIFICADOS. A chave é `ficheiro :: começo da linha` — uma linha que se MOVE continua a casar,
 * uma linha que MUDA deixa de casar, e mudar a linha é exatamente quando ela precisa de ser revista de novo.
 *
 * `porque` não é decoração: é a única coisa que distingue este ficheiro de uma lista de supressões.
 */
const SEGUROS = [
  // ⚠️ CINCO ENTRADAS SAIRAM DAQUI em 2026-09-07 (issue #111): eram sinks de main.ts e de game/**, e os
  // dois deixaram este repositorio. O censo cobre a ENGINE; os sinks do cartucho sao agora censo do jogo,
  // em game-platformer. O caso [Zero] deste ficheiro — a lista nao guarda sink que ja nao existe — foi
  // exatamente quem apontou as cinco, uma a uma, em vez de as deixar a apodrecer numa lista verde.
  ['consumer-quiz/main-quiz.ts', 'if (!p) { app.innerHTML =', 'dois NÚMEROS interpolados'],
  ['consumer-quiz/main-quiz.ts', 'seletor.innerHTML = opcoes.map', 'chave enumerada + i18n'],
  ['render/viz-setters.ts', "tabs.innerHTML = '';", 'string vazia: limpa o elemento, nada entra'],
  ['render/viz-setters.ts', 'el.innerHTML = vizGroupHtml(modes, cur)', 'modos enumerados + i18n'],
  // ⚠️ OS DOIS EIXOS (#104). Mesma classe do de cima e pelo mesmo motivo: o `eixosHtml` interpola só valores
  // ENUMERADOS (`TEMAS`/`CORRECOES`, congelados no `viz-axes`) e texto que passou por `t()`. Nada aqui vem
  // de armazenamento, de URL ou do que uma criança digitou — que é a fronteira que este censo guarda.
  ['render/viz-setters.ts', 'el.innerHTML = eixosHtml(v, t)', 'eixos enumerados + i18n'],
  ['render/viz-setters.ts', 'const tabs = ctx.$(tabsSel); if (tabs) { tabs.hidden', 'string vazia: limpa o elemento, nada entra'],
  ['ui/debug-panel.ts', "p.innerHTML = '<strong>", 'literal inteiro: o titulo do painel de ?debug'],
  ['ui/hud.ts', "gameHudEl.innerHTML = '';", 'string vazia: limpa o elemento, nada entra'],
  ['ui/hud.ts', 'd.innerHTML = vphudHtml(', '⚠️ CONSERTADO 2026-09-06: o nome do jogo saiu do markup e vai por `setAttribute`'],
  ['ui/hud.ts', "if (scr && !scr.querySelector('.vp-wait'))", 'só o ÍNDICE da tela, um número'],
  ['ui/map-hub.ts', 'el.innerHTML = mapHubMarkup(np)', 'só o número de jogadores'],
  ['ui/pause-icons.ts', 'sp.innerHTML = screenPauseMarkup({', 'markup da engine + i18n'],
  // ⚠️ O argumento entrou em 2026-09-08 (ADR-0106 §5) e NÃO muda a classificação: `iconesDoJogo` é uma
  // sub-lista do `PAUSE_ICONS`, que é constante do módulo — nada de fora do repositório alcança este sink.
  ['ui/pause-icons.ts', 'bar.innerHTML = quickBarMarkup(iconesDoJogo);', 'markup da engine + i18n'],
  ['ui/settings-audio.ts', "sel.innerHTML = '';", 'string vazia: limpa o elemento, nada entra'],
  ['ui/settings-audio.ts', "el.innerHTML = '';", 'string vazia: limpa o elemento, nada entra'],
  ['ui/settings-caa.ts', 'el.innerHTML = caaListHtml(', 'i18n + caixa enumerada'],
  ['ui/settings-motion.ts', "tabs.innerHTML = '';", 'string vazia: limpa o elemento, nada entra'],
  ['ui/settings-motor.ts', 'tabs.innerHTML = playerTabsHTML(', 'números (quantos jogadores, qual selecionado)'],
  ['ui/settings-panel.ts', 'span.innerHTML = strong.outerHTML', 'DOM de volta ao DOM: nenhum texto novo entra'],
  ['ui/settings-visual.ts', 'el.innerHTML = renderVisualPanelHtml(', 'i18n + valores enumerados'],
  ['ui/shell.ts', 'el.innerHTML = legendHtml(l1, l2)', 'so i18n, e o dicionario tem gate proprio'],
  ['ui/settings-controls.ts', 'el.innerHTML = ctx.acoesDoJogo().map(', '⚠️ CONSERTADO 2026-09-06: a palavra do jogo saiu do markup e entra por `textContent`'],
  ['input/touch.ts', 'el.innerHTML = TOUCH_SLOTS.map((s) =>', '⚠️ CONSERTADO 2026-09-06: idem — o `<option>` nasce vazio e recebe o rótulo por texto'],
  ['consumer-quiz/main-quiz.ts', 'app.innerHTML = perguntaHtml(p, foco)', '⚠️ CONSERTADO 2026-09-06: enunciado e alternativas passam por `escaparHtml`, com gate hostil em `consumer-quiz`'],
  ['ui/activities-menu.ts', "const cen = ctx.$<HTMLElement>('#tm-cen')", '⚠️ CONSERTADO 2026-09-06: `c.id` (do jogo) vai por `escaparHtml` no atributo `data-cen`; o `nome` é chave de i18n'],
  ['ui/activities-menu.ts', "const alf = ctx.$<HTMLElement>('#tm-alf')", 'ids do catálogo (`educational/activities-registry`, código) + i18n'],
  ['ui/activities-menu.ts', "const mat = ctx.$<HTMLElement>('#tm-mat')", 'ids do catálogo (código) + i18n'],
  ['ui/activities-menu.ts', "const fr = ctx.$<HTMLElement>('#tm-fr')", 'ids do catálogo (código) + as cinco notações enumeradas'],
  ['ui/activities-menu.ts', "const tab = ctx.$<HTMLElement>('#tm-tab')", 'só NÚMEROS de tabuada (`TAB_ROWS`) + i18n'],
  ['ui/settings-audio.ts', "el.innerHTML = '<p class=\"opt-hint\">' +", 'uma única chave de i18n, escolhida por um booleano'],
  ['ui/settings-controls.ts', "tabs.innerHTML = '<span class=\"opt-hint\" style=\"widt", '⚠️ CONSERTADO 2026-09-07 (#125): era um literal em português cravado COM o `<strong>` e o plural à mão. Agora o sink é só ESQUELETO — zero dado, zero interpolação — e as três partes do texto entram por `textContent`, com o molde partido no marcador `{modo}` antes da substituição. O dicionário continua sem markup, que é o que o `i18n-sem-markup` exige'],
  ['ui/settings-motion.ts', 'el.innerHTML =', 'literais + o índice do jogador + linhas montadas de tabelas da engine'],
  ['ui/settings-typo.ts', 'el.innerHTML = typoListHTML(fontKey)', 'as 18 fontes são tabela da engine; os grupos e rótulos saem dela'],
  ['ui/settings-audio.ts', 'el.innerHTML = catsListHTML(', '⚠️ DECIDIDO 2026-09-06 pelo Dev: as categorias de áudio são DA ENGINE. `c.lbl` entra em dois `aria-label`, e `ctx.audioCats` é injetado — mas categoria de áudio é vocabulário de MISTURA (voz, guia, sonar, efeitos), não conteúdo de jogo. Um jogo que precisasse de uma categoria própria estaria a pedir um canal de mixer novo, o que é decisão de arquitetura e entraria por um caminho declarado, com o escape junto'],
];

/**
 * ⚠️ O TETO. Estes ainda não foram classificados por fonte de dado, e a lista **só encolhe** — um sink que
 * sai daqui vai para `SEGUROS` com a razão escrita, ou é consertado.
 *
 * Os dois primeiros são a razão de este ficheiro existir agora e não depois: recebem texto DECLARADO POR UM
 * JOGO, que vive noutro repositório (ADR-0083). Os dois seguintes são os que a issue #106 nomeia — conteúdo
 * de atividade, hoje catálogo no código e AUTORADO assim que o ADR-0052 chegar.
 */
const A_REVER = [
];

const chave = (onde, trecho) => `${onde} :: ${trecho}`;
const CONHECIDOS = new Set([...SEGUROS, ...A_REVER].map(([o, t]) => chave(o, t)));
/** Um sink de hoje casa um conhecido quando a linha COMEÇA pelo trecho registrado. */
const casa = (s) => [...CONHECIDOS].find((k) => k.startsWith(`${s.onde} :: `) && s.trecho.startsWith(k.split(' :: ')[1]));

describe('censo dos sinks de markup — o gate diz «ninguém acrescentou um sem olhar»', () => {
  it('[Right] ⚠️ nenhum sink NOVO — é a lacuna que o `i18n-sem-markup` nomeia desde 2026', () => {
    // Um `innerHTML` novo que interpole algo que não seja i18n, número ou chave enumerada é o caminho pelo
    // qual isto deixa de ser censo e vira incidente. A lista acima é o que alguém já olhou; um sink fora dela
    // é um que ninguém olhou, e este caso nomeia-o em vez de o deixar passar num verde de 37.
    const novos = sinksDeHoje().filter((s) => !casa(s)).map((s) => chave(s.onde, s.trecho));
    expect(novos, 'sink de markup NOVO — classifique-o em SEGUROS ou em A_REVER antes de seguir').toEqual([]);
  });

  it('[Zero] a lista não guarda sink que já não existe', () => {
    // Entrada morta é pior que entrada nenhuma: dá a impressão de cobertura sobre código que sumiu, e a
    // próxima pessoa confia nela.
    const hoje = sinksDeHoje();
    const orfas = [...CONHECIDOS].filter((k) => !hoje.some((s) => casa(s) === k));
    expect(orfas, 'entrada da lista que não corresponde a nenhum sink real').toEqual([]);
  });

  it('[Boundary] ⚠️ o TETO só encolhe — `A_REVER` não pode crescer', () => {
    // O mesmo desenho do `engine-boundary`: teto e não igualdade, porque o que importa proibir é o
    // acoplamento CRESCER. Um sink por rever a mais é dívida nova disfarçada de dívida antiga.
    // ⚠️ O TETO DESCEU DE 15 → 13 → 12 → 11 → 1 em 2026-09-06, à medida que cada sink deixou de ser dívida e
    // passou a ser conserto ou classificação. Baixar o número faz parte do trabalho: um teto que fica onde
    // estava deixa a dívida caber de volta sem ninguém reparar.
    expect(A_REVER.length, 'a dívida de sinks por classificar cresceu').toBeLessThanOrEqual(0);
  });

  it('[Interface] toda entrada tem um PORQUÊ — sem isso a lista é uma tabela de supressões', () => {
    for (const [onde, trecho, porque] of [...SEGUROS, ...A_REVER]) {
      expect(porque, chave(onde, trecho)).toBeTruthy();
      expect(String(porque).length, chave(onde, trecho)).toBeGreaterThan(8);
    }
  });

  it('[Interface] ⚠️ e o gate continua honesto sobre o que NÃO prova', () => {
    // ESTE CASO MUDOU DE CONTEÚDO EM 2026-09-06, quando o teto chegou a zero. Enquanto havia dívida, ele
    // exigia a lista `A_REVER` NÃO-VAZIA — para o verde não se ler como auditoria. Com tudo classificado essa
    // exigência deixou de fazer sentido, e apagá-la sem mais teria deixado o ficheiro a parecer uma prova.
    //
    // ⚠️ O QUE ELE PROVA: que todo sink que existe está numa das duas listas, com um motivo escrito — ou
    // seja, que ninguém acrescentou um sem olhar. O que ele NÃO prova: que os 37 são seguros. Classificação
    // é juízo humano REGISTRADO, não demonstração; sete deles só são seguros porque foram CONSERTADOS, e os
    // gates desses conseratos vivem noutros ficheiros (`quiz-escape`, `settings-controls.browser`, `touch.browser`,
    // `i18n-consumer-dict`, `activities-menu`, `hud`).
    expect(SEGUROS.length + A_REVER.length).toBe(sinksDeHoje().length);
    expect(SEGUROS.length, 'sink sem classificação nenhuma').toBeGreaterThan(0);
  });
});
