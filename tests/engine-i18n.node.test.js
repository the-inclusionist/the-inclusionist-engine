// SPDX-License-Identifier: AGPL-3.0-or-later
// O BURACO DO GATE DE i18n: `tests/main-i18n.node.test.js` vigia UM arquivo, e o problema não mora só nele.
//
// ========================= DOIS ACHADOS NO MESMO DIA =========================
// O item 19 moveu coisas através da fronteira, e duas vezes o que veio junto foi português cru:
//
//   · `ui/pause-icons` montava o rótulo do botão de nível: `'📚 Nível ' + level + ' · ' + qlName[level]`.
//   · `platform/audio` guardava as legendas dos earcons: '🔊 Coletou', '🔊 Ai! Dano', '🔊 Portão abriu'.
//
// As nove legendas são o que a criança SURDA lê no lugar do som. Num build em inglês ela lia português — e
// era exatamente a informação que a legenda existe para dar.
//
// Nenhum dos dois seria achado procurando bug de tradução: os dois moram onde a varredura não ia. O gate do
// item 14 lê `app/js/main.js` e para ali, e o item 14 declarou-se pronto com esse escopo — corretamente para
// o que ele prometia, e insuficiente para o que o pilar 3 promete.
//
// ========================= POR QUE O CRIVO É MAIS ESTREITO QUE O DO main.js =========================
// A varredura crua sobre as sete camadas de engine devolve 428 candidatos, e a maioria é RUÍDO: 'KeyA',
// 'ControlLeft', 'Atkinson Hyperlegible', 'CC BY-SA', 'select[data-slot]'. Uma lista de dívida com 428 linhas
// de ruído não é gate: é um arquivo que ninguém lê, e um gate que ninguém lê é pior que gate nenhum, porque
// ocupa o lugar de um que funcionaria.
//
// Este acrescenta um filtro de PRECISÃO ao crivo do item 14: o literal tem de parecer PROSA EM PORTUGUÊS —
// acento/cedilha, ou uma palavra funcional de pt-BR isolada. Nome de tecla, de fonte e de licença passam
// batido; frase não passa. Dos 428, sobram 75 em 19 módulos, e essas 75 são texto de verdade.
//
// O QUE ELE NÃO PEGA, dito para ninguém confiar demais: texto sem acento e sem palavra funcional — 'Coletou'
// sozinha teria escapado. É o preço da precisão, e a escolha é deliberada: um crivo largo aqui produziria a
// lista de 428 que ninguém manteria. Quando as 75 saírem, dá para apertar.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');
const CAMADAS = ['core', 'input', 'render', 'platform', 'ui', 'audio', 'boot'];
const CR = String.fromCharCode(13);

const MODULOS = CAMADAS.flatMap((c) => {
  const dir = join(RAIZ, c);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${c}/${f}`);
});
const fonte = (m) => readFileSync(join(RAIZ, ...m.split('/')), 'utf8').split(CR).join('');

/** Linhas de CÓDIGO: sem comentário. Prosa em comentário não vai para tela nenhuma. */
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

/** Técnico POR FORMA — as MESMAS regras do gate do main.js, copiadas de propósito (ver o caso final). */
const TECNICO = [
  /^[#.[]/,                        // seletor CSS
  /^[a-z][a-zA-Z0-9]*$/,           // identificador de uma palavra
  /^[a-z0-9_]+$/,                  // snake_case / id (minúsculo de propósito: texto de UI começa maiúsculo)
  /^[a-z]+([.-][a-z0-9]*)+$/i,     // chave i18n, classe, arquivo
  /^(https?:)?\//,                 // url / caminho
  /^[\s\d\W]*$/,                   // só símbolo, número ou espaço
  /^[a-z]+\/[a-z0-9.-]+$/i,        // mime / caminho curto
];

/** Parece PROSA em pt-BR? Acento/cedilha, ou palavra funcional ISOLADA (com fronteira, senão 'mode' casa 'de'). */
const ACENTO = /[áàâãéêíóôõúüç]/i;
const PALAVRA_PT = /\b(de|da|do|das|dos|para|com|sem|em|no|na|nos|nas|um|uma|os|as|ou|que|ao|aos|pelo|pela|seu|sua|mais|todos|toda|cada)\b/i;
const pareceProsa = (s) => ACENTO.test(s) || PALAVRA_PT.test(s);

const semMarcacao = (s) => s.replace(/\$\{[^}]*\}/g, '').replace(/<[^>]*>/g, '').trim();
const STR = new RegExp("(['\"`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1", 'g');

/** Literais de um módulo que parecem texto de interface em português. */
function crus(m) {
  const out = [];
  for (const [n, ln] of linhasDeCodigo(fonte(m))) {
    for (const mm of ln.matchAll(STR)) {
      const s = mm[2];
      if (s.length < 2) continue;
      if (TECNICO.some((re) => re.test(s))) continue;
      if (s.includes('<') && !/[A-Za-zÀ-ü]{2}/.test(semMarcacao(s))) continue; // moldura sem texto
      if (!pareceProsa(s)) continue;
      out.push(`${n}: ${JSON.stringify(s.slice(0, 60))}`);
    }
  }
  return out;
}

/**
 * Dívida CONHECIDA em 2026-08-25 — TETO por módulo, e só encolhe.
 *
 * Teto e não igualdade, pela mesma razão do gate de fixtures: um módulo ganha e perde literais por mil
 * motivos que não têm nada a ver com idioma, e um caso que reprovasse a cada edição inocente seria afrouxado
 * na primeira pressa. O que ele proíbe é a única coisa que importa — que o texto cru CRESÇA.
 */
/**
 * ISENTOS, e a isenção é de CLASSIFICAÇÃO, não de dívida.
 *
 * `ui/debug-panel.ts` estava na tabela de dívida com teto 13, e o teto é a forma errada de tratá-lo: ele
 * obriga a empurrar um número toda vez que um instrumento de depuração ganha uma linha, e empurrar um teto
 * que "só encolhe" é justamente o afrouxamento que esta tabela existe para impedir. Fingir que é dívida
 * transforma a regra num incômodo, e regra incômoda é regra afrouxada.
 *
 * O painel não é interface do JOGO. Ele só existe com `?debug=true`, e o leitor dele é quem programa — a
 * mesma pessoa para quem `core/contract` escreve as mensagens de `throw`. Traduzir um instrumento de
 * depuração para três idiomas custaria manutenção e não alcançaria criança nenhuma, que é o que o pilar 3
 * protege.
 *
 * ⚠️ ESTA LISTA TEM UM ITEM, e a régua para entrar nela é estreita: o módulo tem de ser INALCANÇÁVEL sem uma
 * bandeira de desenvolvimento. Um painel que a criança possa abrir não entra aqui — entra na tabela abaixo,
 * com teto, como todos os outros.
 */
const ISENTOS = new Set(['ui/debug-panel.ts']);

const CRU_CONHECIDO = {
  // ⚠️ OS NÚMEROS SAEM DAQUI, e não de um script meu de fora. A primeira versão desta tabela foi preenchida
  // por uma varredura à parte e ela contou MENOS em sete módulos — eu tinha perdido as fronteiras de palavra
  // (``) do casador de prosa, e `mode` casava com `de`. O gate reprovou e estava certo. Quem for atualizar
  // esta tabela, atualize-a pelo que ESTE arquivo reporta; é a mesma lição do gate de fixtures.

  /* --- PAINÉIS DE AJUSTE: rótulos e dicas montados em markup, ainda sem `data-i18n`. --- */
  'ui/map-hub.ts': 8,
  'ui/settings-motion.ts': 6,   // 7 → 6 em 2026-08-27: a etiqueta "todos os jogadores" das seções, que estava
                               // escrita à mão três vezes, virou uma chamada a `t('rm.sec.all')`
  'ui/settings-visual.ts': 7,
  'ui/settings-caa.ts': 5,
  'ui/caa-sets.ts': 3,             // descrições dos conjuntos de pictogramas (licença, origem cultural)
  'ui/hud.ts': 1,

  'ui/settings-panel.ts': 1,
  'ui/settings-controls.ts': 1,

  /* --- CURRÍCULO, e este é diferente dos outros: pilar 3 manda REESCREVER por idioma, não traduzir. --- */
  'ui/activities-menu.ts': 3,     // era 5: o item 5 do ADR-0044 tirou os `lbl` crus de PM_BTNS, que nunca iam para a tela      // 'pré-silábico', 'silábico'… as hipóteses de Ferreiro (ADR-0032)

  /* --- FORA de `ui/`: menos, e cada um por um motivo próprio. --- */
  'platform/audio-mixer.ts': 5,    // rótulos das categorias do mixer de áudio
  'input/touch.ts': 3,             // 'mão de criança' / 'mão de adulto' — classificação, mas VAI para a tela
  'core/tiles.ts': 2,
  'input/gamepad.ts': 2,
  'render/high-contrast.ts': 1,
  'render/viz-setters.ts': 1,

  /* --- MENSAGENS DE PROGRAMADOR, e não de interface: `throw` e listas de conformidade que quem escreve um
   *     preset lê no console. Ficam na lista mesmo assim, COM o motivo — um crivo por FORMA não distingue "o
   *     que a criança lê" de "o que o dev lê", e uma exceção sem contagem é uma porta aberta. --- */
  'boot/create-game.ts': 3,        // a mensagem do `throw` e as lacunas do hospedeiro
  'render/sprites.ts': 1,          // `console.warn` de quadro fora do atlas — o dev lê, a criança não
};

describe('texto cru em português nas camadas de ENGINE (o buraco do gate do item 14)', () => {
  it('[Right] NENHUM módulo NOVO passa a ter texto de interface em português cru', () => {
    const novos = MODULOS.filter((m) => !(m in CRU_CONHECIDO) && !ISENTOS.has(m))
      .flatMap((m) => crus(m).map((l) => `${m}:${l}`));
    expect(novos, 'texto cru em módulo de engine — passe por t() ou registre o motivo').toEqual([]);
  });

  it('[Boundary] a dívida de cada módulo é um TETO: só encolhe', () => {
    const cresceram = {};
    for (const [m, teto] of Object.entries(CRU_CONHECIDO)) {
      const n = crus(m).length;
      if (n > teto) cresceram[m] = `${teto} → ${n}`;
    }
    expect(cresceram, 'módulo ganhou texto cru novo — o pilar 3 anda para trás').toEqual({});
  });

  it('[Zero] a lista não guarda módulo que já se limpou', () => {
    // Sem este caso a lista viraria cemitério: entradas de módulos já traduzidos continuariam autorizando
    // que o texto voltasse, e ninguém saberia que o gate parou de proteger aquele arquivo.
    for (const m of Object.keys(CRU_CONHECIDO)) {
      expect(crus(m).length, `${m} já não tem texto cru — apague-o de CRU_CONHECIDO`).toBeGreaterThan(0);
    }
  });

  it('[Interface] o total é CONTÁVEL, e o número é o tamanho do que falta', () => {
    // 75 em 19 módulos. Não é decoração: é a diferença entre "o pilar 3 vale" e "o pilar 3 vale no main.js".
    const total = Object.values(CRU_CONHECIDO).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(76);
    expect(Object.keys(CRU_CONHECIDO).length).toBeLessThanOrEqual(20);
  });

  it('[Cross-check] o crivo ainda pega o que os DOIS achados de hoje eram', () => {
    // O caso que impede este arquivo de virar decoração. Se alguém apertar o `TECNICO` ou o `pareceProsa` até
    // o gate ficar verde, estas duas frases — que existiram de verdade, em módulos de engine — voltariam a
    // passar. Elas são o piso do que o crivo tem de enxergar.
    const comoEra = (s) => !TECNICO.some((re) => re.test(s)) && pareceProsa(s);
    expect(comoEra('📚 Nível 2 · Silábico'), 'o rótulo do menu de pausa').toBe(true);
    expect(comoEra('🔊 Portão abriu'), 'a legenda do earcon do portão').toBe(true);
    // E o contrário: o que era ruído continua sendo ruído, senão a lista volta a ter 428 linhas.
    expect(comoEra('ControlLeft')).toBe(false);
    expect(comoEra('Atkinson Hyperlegible')).toBe(false);
    expect(comoEra('select[data-slot]')).toBe(false);
  });
});
