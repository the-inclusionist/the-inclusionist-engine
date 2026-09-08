// SPDX-License-Identifier: AGPL-3.0-or-later
// NADA NA ENGINE GUARDA O DESEMPENHO DE UMA CRIANÇA — a outra metade da dívida do ADR-0103 §confirmation.
//
// ========================= POR QUE ISTO É UM CRIVO E NÃO UMA BUSCA POR PALAVRA =========================
// A afirmação do ADR-0103 é uma AUSÊNCIA: «nenhum módulo escreve chave de histórico por habilidade». Uma
// ausência não se prova procurando a palavra «histórico» — quem a fosse escrever não a chamaria assim, e um
// `grep` verde seria a forma mais barata de o gate mentir.
//
// O que se pode provar é o INVENTÁRIO. A engine escreve em armazenamento a partir de dezoito ficheiros, e
// todos eles guardam a MESMA classe de coisa: preferência da criança ou estado desta partida. O crivo
// congela essa lista. Um ficheiro novo a escrever obriga alguém a acrescentar aqui uma linha que diga O QUE
// ele guarda — e é nessa linha que «isto é um histórico de desempenho» teria de ser escrito à mão, em vez de
// entrar sem que ninguém repare.
//
// ⚠️ E A RAZÃO DA PROIBIÇÃO É PEDAGÓGICA ANTES DE JURÍDICA, o que muda o que ela proíbe: o desenvolvimento
// oscila, a criança joga uma dada actividade talvez uma vez por semana, e um histórico guardado achata a
// oscilação numa linha de tendência que lê um recuo normal como regressão. O argumento da LGPD permitiria
// guardar assim que a controladoria estivesse resolvida; este não permite nunca.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../app/js/', import.meta.url));

/** Toda escrita em armazenamento, em qualquer das formas que este repositório usa. */
const ESCREVE = /(?:^|[^\w.])(?:store|ctx\.store)\.(?:set|setBool|setJSON)\s*\(|localStorage\.setItem|sessionStorage\.setItem|indexedDB/;

function ficheirosTs(dir = RAIZ) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...ficheirosTs(p));
    else if (nome.endsWith('.ts') && !nome.endsWith('.d.ts')) saida.push(p);
  }
  return saida;
}

/** Linhas de código (sem comentário de linha) que escrevem em armazenamento. */
function escritasDe(p) {
  return readFileSync(p, 'utf8').split(/\r?\n/)
    .filter((ln) => !/^\s*(\/\/|\*|\/\*)/.test(ln) && ESCREVE.test(ln)).length;
}

/**
 * O INVENTÁRIO. Chave = caminho a partir de `app/js/`; valor = o que aquele ficheiro guarda.
 *
 * ⚠️ Cada entrada diz de QUEM é a coisa guardada, porque é essa a pergunta que o ADR-0103 faz. Duas classes
 * existem, e o `platform/storage` explica a fronteira: `incl_*` é da CRIANÇA e segue com ela de jogo em jogo
 * (uma criança cega não pode reconfigurar a bengala em 300 jogos); `incl.<jogo>.*` é DESTA partida. Nenhuma
 * das duas é um histórico de desempenho, e é isso que este ficheiro afirma.
 */
const INVENTARIO = {
  'core/i18n.ts': 'criança · o idioma da interface',
  'core/state.ts': 'criança · modo visual, modo cego, caixa da letra, legendas, índice de menu, cores seguras e por dono, contornos do alto contraste, divisor da bengala, cadeira de rodas, um-botão',
  'input/gamepad.ts': 'criança · o mapa de botões deste MODELO de controle',
  'input/keyboard.ts': 'criança · o esquema de teclas',
  'input/touch.ts': 'criança · mapa de toque, medidas do pad em milímetros, desenho e direção',
  'platform/audio-mixer.ts': 'criança · liga/desliga e volume de cada categoria do mixer',
  'platform/storage.ts': 'a própria camada — é aqui que o `localStorage.setItem` vive, e só aqui',
  'render/crt.ts': 'criança · os parâmetros do filtro CRT',
  'render/fx.ts': 'criança · a intensidade dos efeitos de tela',
  'render/high-contrast.ts': 'criança · as cores por papel do alto contraste',
  'render/lq-filter.ts': 'criança · o nível do filtro de baixa qualidade',
  'render/viz-setters.ts': 'criança · a simulação visual escolhida, por jogador',
  'ui/activities-menu.ts': 'partida · a notação de fração e a tabuada escolhidas NESTE jogo',
  'ui/pause-icons.ts': 'criança · o nível do modo TEA',
  // ⚠️ Entrou em 2026-09-08 pela etapa 1 do ADR-0106, e a entrada diz de quem é a coisa guardada porque é
  // essa a pergunta: os quatro interruptores de movimento reduzido de CENA são preferência da CRIANÇA — eram
  // guardados por cada cartucho na MESMA chave da engine, e cinco jogos não os guardavam de todo.
  'ui/motion-scene.ts': 'criança · os quatro interruptores de movimento reduzido de cena (parallax, decor, itens, partículas)',
  'ui/settings-audio.ts': 'criança · a saída de áudio por jogador, o motor e a voz de TTS',
  'ui/settings-motion.ts': 'criança · as reduções de movimento, por jogador',
  'ui/settings-motor.ts': 'criança · o modo fácil por jogador',
  'ui/vlibras.ts': 'criança · a janela de Libras aberta ou fechada',
};

describe('ADR-0103 · a engine não guarda o desempenho de ninguém', () => {
  const escritores = ficheirosTs()
    .map((p) => [relative(RAIZ, p).split('\\').join('/'), escritasDe(p)])
    .filter(([, n]) => n > 0);

  it('⚠️ [Interface] nenhum ESCRITOR NOVO entrou sem ser declarado', () => {
    const novos = escritores.map(([m]) => m).filter((m) => !(m in INVENTARIO));
    expect(
      novos,
      'módulo novo a escrever em armazenamento. Acrescente-o ao INVENTARIO dizendo DE QUEM é a coisa '
      + 'guardada — e se a resposta for «o desempenho da criança», o ADR-0103 diz que não pode ser guardada.',
    ).toEqual([]);
  });

  it('⚠️ [Interface] o inventário não tem ÓRFÃOS — entrada que nomeia quem já não escreve', () => {
    // Sem este caso, o inventário apodrece: uma entrada podia continuar a descrever um ficheiro que deixou de
    // persistir, e a lista deixaria de ser uma medida para passar a ser uma lembrança. É o mesmo buraco que o
    // gate da superfície pública teve, e que custou dezoito casos verdes sobre uma porta que já não existia.
    const vivos = new Set(escritores.map(([m]) => m));
    const orfaos = Object.keys(INVENTARIO).filter((m) => !vivos.has(m));
    expect(orfaos, 'entrada do inventário a descrever um ficheiro que já não escreve nada').toEqual([]);
  });

  it('⚠️ [Right] a camada de CURRÍCULO não escreve nada — é ela que sabe como a criança vai', () => {
    // O crivo mais estreito e o mais importante: `educational/` é onde vivem o motor adaptativo e a barra, e
    // é exactamente daí que um histórico por habilidade sairia. Não há entrada de inventário possível aqui.
    const curriculo = escritores.filter(([m]) => m.startsWith('educational/'));
    expect(curriculo, 'o currículo passou a persistir — é o histórico que o ADR-0103 proíbe').toEqual([]);
  });

  it('[Interface] e ele continua a existir: um inventário vazio provaria por vácuo', () => {
    // Se a varredura deixasse de encontrar seja o que for (uma regex que morre, um caminho que muda), os três
    // casos acima passariam por não terem nada que examinar.
    expect(escritores.length, 'a varredura não achou escritor nenhum — a regex ou o caminho morreram').toBeGreaterThan(10);
    expect(escritores.some(([m]) => m === 'platform/storage.ts')).toBe(true);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
//   · ⚠️ A AMEACA REAL — pondo `localStorage.setItem('incl_hist_' + barra.skill, …)` dentro do
//     `educational/segment-bar` → reprovam QUATRO, dois deles aqui: "escritor NOVO" e "o CURRICULO nao
//     escreve nada". E o gate da propria barra apanha-o tambem, por dois caminhos independentes.
//   · apagando a linha do `ui/vlibras.ts` do INVENTARIO → reprova "escritor NOVO". E a deriva realista: a
//     lista deixa de cobrir quem escreve, e o crivo passa a olhar para menos do que existe.
//   · acrescentando ao INVENTARIO uma entrada para um ficheiro que nao existe → reprova o caso do ORFAO. Sem
//     ele a lista apodrece: descreveria coisas que ja nao acontecem, e pareceria maior do que e. E o mesmo
//     buraco que o gate da superficie publica teve, e que custou dezoito casos verdes sobre uma porta morta.
//   · matando a regex `ESCREVE` → reprovam DOIS, e o que interessa e o segundo: sem o caso do vacuo, os tres
//     de cima passariam por nao terem nada que examinar. Um crivo que nao acha nada nao prova ausencia
//     nenhuma — prova que o crivo morreu.
