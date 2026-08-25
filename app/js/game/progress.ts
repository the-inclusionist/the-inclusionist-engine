// SPDX-License-Identifier: GPL-3.0-or-later
// game/progress — O QUE ESTE JOGO GUARDA NUMA SENHA (item 23). O lado do JOGO de `core/password`.
//
// A engine sabe empacotar inteiros pequenos em letras legíveis, com verificação; ela não sabe — e não pode
// saber, pela regra do ADR-0033 — que existe "nível de alfabetização" ou "atividade". Quem sabe é este
// arquivo, e é ele que responde à única pergunta que importa aqui:
//
//     O QUE A CRIANÇA PERDE QUANDO A MÁQUINA DA ESCOLA É RESTAURADA?
//
// Duas coisas, e só duas:
//   · a ATIVIDADE em que ela estava (o `activity` do catálogo — de "Coletar 10 moedas" a "Escrevendo em Braille");
//   · o NÍVEL da alfabetização (1 a 5), que é o que uma professora levou semanas para fazer subir.
//
// O que NÃO entra, e por quê: o cenário, o número de telas, o alto contraste, a voz. Nada disso é progressão —
// é preferência, se remonta em dois segundos e mora nos ajustes COMPARTILHADOS (ADR-0028), que não são deste
// jogo. E cada campo a mais é uma letra a mais para uma criança de sete anos copiar do caderno sem errar.
// Com estes dois a senha tem QUATRO caracteres.
//
// O campo que eu tinha escrito e apaguei foram as LUZES — os 0 a 3 acertos seguidos da rodada. Ele conta
// acertos DENTRO de uma pergunta aberta, e no instante em que a senha é digitada não há pergunta aberta:
// aplicá-lo acenderia duas luzes sobre uma pergunta que a criança ainda não viu. Restava mostrá-lo à
// professora como "ela estava quase lá" — e isso custaria 2 bits, que aqui custam um QUINTO caractere para a
// criança copiar. Um campo que ninguém aplica não paga uma letra.
//
// ========================= A LISTA QUE SÓ PODE CRESCER, E SÓ NO FIM =========================
// `ORDEM_SENHA` é o que transforma um id de atividade num número. Ela NÃO é `listActivityIds()`, e a distinção
// é a coisa mais frágil deste arquivo: a ordem do catálogo é ordem de MENU, e mexer nela é uma decisão de
// interface — inserir "alf6" entre "alf5" e "mat1" é natural ali. Se a senha lesse aquela ordem, essa mudança
// de menu invalidaria TODA senha já escrita num caderno, sem erro nenhum aparecer: a criança digitaria a senha
// certa e cairia noutra atividade.
//
// Por isso esta lista é APENAS-APÊNDICE: id novo entra no FIM, id nenhum sai, nenhum troca de lugar. O teste
// (`tests/progress.node.test.js`) prende o prefixo de hoje e cobra que todo id do catálogo esteja aqui — uma
// atividade nova sem lugar na senha falha o teste em vez de sumir da senha em silêncio.
import { criarCodec, formatar, type CampoSenha } from '../core/password.js';
import { listActivityIds, DEFAULT_ACTIVITY_ID } from '../educational/activities-registry.js';
import { activity, setActivityValue } from '../core/state.js';
import { quizLevel, setQuizLevelValue } from './state.js';

/**
 * A ordem das atividades NA SENHA. Apenas-apêndice: acrescente no fim, nunca no meio, nunca remova.
 *
 * Um id aposentado continua aqui para sempre — ele guarda o número dos que vieram depois. Se um dia sair do
 * catálogo, `progressoDe` devolve a atividade padrão e a criança perde a atividade, mas não o nível.
 */
export const ORDEM_SENHA: readonly string[] = Object.freeze([
  'ludico',
  'alf1', 'alf2', 'alf3', 'alf4', 'alf5',
  'mat1', 'mat2', 'mat3', 'mat4', 'mat5', 'mat6',
  'fr2', 'fr3', 'fr42', 'fr5', 'fr632', 'fr2a6',
]);

/**
 * 6 bits para a atividade, e não 5, mesmo com 18 na lista hoje.
 *
 * 5 bits dariam 32 lugares, e a lista só cresce: no dia em que a 33ª atividade entrasse, ou a senha ganharia
 * um campo (invalidando todas as antigas) ou a atividade daria a volta e apontaria para outra. 6 bits custam
 * ZERO caracteres a mais aqui — 9 bits ocupam os mesmos 2 símbolos de corpo que 8 ocupariam — e compram 64
 * lugares. É a única folga do formato, e ela é de graça.
 */
export const CAMPOS: readonly CampoSenha[] = Object.freeze([
  { nome: 'atividade', bits: 6 },
  { nome: 'nivel', bits: 3 },  // 1..5 cabem; guarda-se o valor cru, e a leitura apara
]);

const codec = criarCodec(CAMPOS);

/** Quantos caracteres a senha tem — a grade de letras desenha exatamente estas casas. */
export const COMPRIMENTO_SENHA = codec.comprimento;

export interface Progresso {
  readonly atividade: string;
  /** 1..5 */
  readonly nivel: number;
}

const apara = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, Math.round(v) || min));

/** A senha que representa `p`. Valores fora da faixa são APARADOS aqui — a engine, essa, lança. */
export function senhaDe(p: Progresso): string {
  const i = ORDEM_SENHA.indexOf(p.atividade);
  return codec.codificar({
    atividade: i < 0 ? 0 : i, // atividade desconhecida vira a padrão: melhor voltar ao lúdico que não ter senha
    nivel: apara(p.nivel, 1, 5),
  });
}

/**
 * O progresso que a senha representa, ou `null` se ela não for uma senha deste jogo.
 *
 * Aparar na LEITURA não é redundância com `senhaDe`: uma senha válida pode carregar um `nivel` de 0, 6 ou 7 —
 * são valores que cabem nos 3 bits e que uma senha de uma versão futura poderia escrever. Trazê-los para a
 * faixa é o que impede que uma senha do futuro abra o jogo num nível que não existe.
 */
export function progressoDe(senha: string): Progresso | null {
  const v = codec.decodificar(senha);
  if (!v) return null;
  const id = ORDEM_SENHA[v.atividade!];
  return { atividade: id ?? DEFAULT_ACTIVITY_ID, nivel: apara(v.nivel!, 1, 5) };
}

/** A senha agrupada, para MOSTRAR. `progressoDe` aceita com ou sem o traço. */
export function senhaLegivel(p: Progresso): string {
  return formatar(senhaDe(p), 2);
}

/* ===================== as duas pontas que tocam o estado vivo ===================== */
//
// Ficam aqui, e não numa camada de interface, porque são a MESMA decisão de o que é progresso — escrita duas
// vezes daria duas listas que ninguém obriga a concordar (a lição que `game/session` já registrou sobre
// `makePlayer` e `resetPlayerState`). Quem desenha a senha na tela chama estas; a decisão do que ela contém
// mora num arquivo só.

/** O progresso de AGORA. A senha é de UMA criança: com a sala em quatro telas, cada uma leva a sua. */
export function progressoAtual(): Progresso {
  return { atividade: activity ?? DEFAULT_ACTIVITY_ID, nivel: quizLevel };
}

/** Aplica um progresso lido de uma senha. Os dois setters já persistem e emitem — é só isso que falta. */
export function aplicarProgresso(p: Progresso): void {
  setActivityValue(p.atividade);
  setQuizLevelValue(p.nivel);
}
