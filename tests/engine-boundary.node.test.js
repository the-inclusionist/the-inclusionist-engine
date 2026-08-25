// SPDX-License-Identifier: GPL-3.0-or-later
// A FRONTEIRA ENGINE ↔ JOGO, como TESTE (ADR-0027, passo 4). Project node: só lê arquivos.
//
// O ADR-0027 traz uma heurística e a chama de decisiva:
//
//   "Um teste de um módulo de ENGINE cujo fixture precisa de uma MOEDA é prova de que o corte não pegou. Não
//    dá para ver isso lendo o módulo — só lendo o teste dele."
//
// E põe o passo 4 como o veredito: "se `createGame()` não puder ser escrito sem um parâmetro chamado
// `coinTarget`, a fronteira que este registro propõe está errada e os passos 5 a 7 NÃO PODEM COMEÇAR."
//
// Isto aqui é essa heurística virando gate. Enquanto era prosa num documento, ela dependia de alguém lembrar
// de aplicá-la; e um documento não reprova ninguém. Agora reprova.
//
// A FORMA É UMA LISTA QUE SÓ PODE ENCOLHER. Um teste que simplesmente falhasse seria apagado ou afrouxado na
// primeira pressa. Uma lista de dívida conhecida faz três coisas de uma vez: deixa a suíte verde hoje, torna a
// dívida CONTÁVEL, e faz qualquer aresta NOVA falhar na hora. Quem consertar uma linha apaga a linha; quem
// criar uma, descobre no mesmo minuto.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');
const CAMADAS_ENGINE = ['core', 'input', 'render', 'platform', 'ui', 'audio'];

function modulosDe(camada) {
  const dir = join(RAIZ, camada);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${camada}/${f}`);
}
const MODULOS = CAMADAS_ENGINE.flatMap(modulosDe);
// NORMALIZA A QUEBRA DE LINHA ao ler, e isso nao e higiene: sem ela este arquivo ja mentiu uma vez. Com CRLF
// cada linha termina em CR, e CR e TERMINADOR DE LINHA para uma regex — o ponto nao o alcanca, entao o ancora
// de fim em /\/\/.*$/ nunca chegava e o removedor de comentarios NAO REMOVIA NADA. O teste entao acusava dois
// comentarios de fim de linha em core/layers como se fossem dependencia. Um filtro que falha ABERTO e pior que
// filtro nenhum: ele produz uma lista de divida falsa, e quem for conserta-la nao acha o que consertar.
const CR = String.fromCharCode(13);
const fonte = (m) => readFileSync(join(RAIZ, ...m.split('/')), 'utf8').split(CR).join('');

/** Linhas de CÓDIGO: sem comentário de bloco, de linha, nem de fim de linha. Prosa não é dependência —
 *  "moedas no chão" dentro do anúncio do Modo Fácil descreve o jogo, não amarra o módulo a ele. */
function linhasDeCodigo(texto) {
  const out = [];
  let bloco = false;
  texto.split('\n').forEach((ln, i) => {
    const t = ln.trim();
    if (bloco) { if (t.includes('*/')) bloco = false; return; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) bloco = true; return; }
    if (t.startsWith('//') || t.startsWith('*')) return;
    out.push([i + 1, ln.replace(/\/\/.*$/, '')]);
  });
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// 1. ARESTAS DE IMPORTAÇÃO — a evidência mais dura, porque não é um nome: é uma dependência que o compilador
//    segue. Um módulo de engine que importa de `game/` não pode ser empacotado sem levar o jogo junto.
// ---------------------------------------------------------------------------------------------------------

/** Dívida CONHECIDA em 2026-08-25. Esta lista só encolhe. Cada linha é uma issue esperando. */
const IMPORTS_CONHECIDOS = {
  'render/draw.ts': ['game/player.js', 'game/powerups.js', 'game/coin-spawning.js'],
  'render/textures.ts': ['game/activity-content.js'],
  'ui/activities-menu.ts': ['game/activities-registry.js'],
};

function importsDeJogo(m) {
  return [...fonte(m).matchAll(/from '\.\.\/(game\/[\w.-]+)'/g)].map((x) => x[1]);
}

describe('fronteira engine↔jogo — arestas de importação (ADR-0027 passo 4)', () => {
  it('[Right] NENHUM módulo de engine importa de game/ além da dívida conhecida', () => {
    const novas = {};
    for (const m of MODULOS) {
      const extras = importsDeJogo(m).filter((i) => !(IMPORTS_CONHECIDOS[m] || []).includes(i));
      if (extras.length) novas[m] = extras;
    }
    expect(novas, 'aresta NOVA de engine para game/ — some com ela ou registre o porquê').toEqual({});
  });

  it('[Interface] a dívida conhecida ainda EXISTE — linha consertada é linha apagada daqui', () => {
    // Sem este caso a lista viraria um cemitério: entradas de arestas que já sumiram continuariam permitindo
    // que elas voltassem, e ninguém saberia que o teste tinha parado de proteger aquele arquivo.
    for (const [m, esperados] of Object.entries(IMPORTS_CONHECIDOS)) {
      const atuais = importsDeJogo(m);
      for (const e of esperados) {
        expect(atuais, `${m}: '${e}' não existe mais — apague-o de IMPORTS_CONHECIDOS`).toContain(e);
      }
    }
  });

  it('[Boundary] a dívida cabe em TRÊS módulos — o número é o que diz quão perto a fronteira está', () => {
    // Não é decoração: é a diferença entre "a fronteira está errada" e "a fronteira está a três módulos de
    // valer". O ADR-0027 pergunta se o passo 5 pode começar, e é este número que responde.
    expect(Object.keys(IMPORTS_CONHECIDOS)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------------------------------------
// 2. O NOME QUE O ADR ESCOLHEU. `coinTarget` é o exemplo do registro, e ele existe: `ui/hud.vphudHtml` recebe
//    um alvo de moedas. Um jogo sem moedas não tem o que passar ali, e o HUD é engine.
// ---------------------------------------------------------------------------------------------------------

const MOEDA = /\b(coin|coins|coinTarget|moeda|moedas)\b/i;

/** Dívida CONHECIDA de VOCABULÁRIO em 2026-08-25 — só encolhe, mesma regra. */
const MOEDA_CONHECIDA = new Set([
  'ui/hud.ts',              // vphudHtml(coinTarget) + o campo `coins` do view-model: o caso do ADR, ao pé da letra
  'platform/audio-nav.ts',  // o sonar aponta para a `Coin` mais próxima; o PROPÓSITO é engine, o TIPO é do jogo
  'render/draw.ts',         // já contado acima pelas importações
  'core/state.ts',          // `coins: unknown[]` — estado do jogo morando no estado compartilhado
  'platform/audio.ts',      // earcon de chave 'coin': conteúdo sonoro do jogo na tabela da engine
  'platform/audio-mixer.ts', 'ui/settings-motion.ts', 'ui/settings-motor.ts', // rótulos/anúncios, não dependência
]);

describe('fronteira engine↔jogo — o vocabulário do ADR', () => {
  it('[Right] nenhum módulo de engine NOVO passa a falar de moeda no código', () => {
    // A falha CITA a linha. Um teste de fronteira que só diz "este arquivo" manda a pessoa procurar o que ela
    // já procuraria — e a linha costuma ser um comentário de fim de linha, ou seja, um falso positivo que
    // custaria dez minutos para ser reconhecido como tal.
    const novos = MODULOS.filter((m) => !MOEDA_CONHECIDA.has(m))
      .flatMap((m) => linhasDeCodigo(fonte(m)).filter(([, ln]) => MOEDA.test(ln)).map(([n, ln]) => `${m}:${n}  ${ln.trim()}`));
    expect(novos, 'módulo de engine falando de moeda — o corte não pegou aqui').toEqual([]);
  });

  it('[Interface] `coinTarget` continua na assinatura de ui/hud — é o veredito do passo 4, não um detalhe', () => {
    // Enquanto esta linha passar, `createGame()` não pode ser escrito sem um alvo de moedas em algum lugar da
    // cadeia, e o ADR-0027 diz o que isso significa: o passo 5 (a divisão em pacotes) NÃO COMEÇA.
    expect(fonte('ui/hud.ts')).toMatch(/vphudHtml\s*\(\s*coinTarget/);
  });

  it('[Zero] a lista de dívida de vocabulário não guarda módulo que já se limpou', () => {
    for (const m of MOEDA_CONHECIDA) {
      const sujo = linhasDeCodigo(fonte(m)).some(([, ln]) => MOEDA.test(ln));
      expect(sujo, `${m} já não fala de moeda — apague-o de MOEDA_CONHECIDA`).toBe(true);
    }
  });
});
