// SPDX-License-Identifier: AGPL-3.0-or-later
// render/crt-cede — O CRT DECORATIVO CEDE À ACESSIBILIDADE, e cada efeito tem uma saída.
//
// ========================= POR QUE É UM MÓDULO E NÃO UM `if` =========================
// A regra parece uma linha e tem oito combinações, das quais duas são armadilha:
//
//   · "manter" NÃO PODE LIGAR um efeito desligado. Quem desligou a scanline não pode vê-la voltar ao entrar em
//     alto contraste — seria o contrário do que a opção promete.
//   · ceder NÃO PODE APAGAR a preferência. O nível gravado fica intacto; o que muda é a EXIBIÇÃO. Ao sair do
//     modo de acessibilidade, o efeito volta sozinho, sem a criança ter de reconfigurar nada.
//
// Um `if` em linha dentro de `applyCrt` esconde as duas e não é testável em node (aquele módulo toca o DOM e o
// `localStorage`). Aqui entra a preferência, sai uma resposta.
//
// ========================= A DECISÃO, E A EXCEÇÃO QUE ELA CARREGA =========================
// O pilar diz que a acessibilidade vence a estética (ADR-0010), e o ADR-0020 sempre mandou os modos de a11y
// suprimirem o CRT decorativo — mas isso nunca tinha sido implementado, e a scanline chegou a ficar de fora por
// decisão declarada ("Scanline não deverá ceder a acessibilidade por enquanto").
//
// Em 2026-08-27 o Dev fechou a questão nos dois sentidos ao mesmo tempo:
//
//   "ceda o scanline e o CRT à acessibilidade, mas deixe uma opção de não ceder para cada um no menu conforto
//    visual."
//
// O PADRÃO passa a respeitar o pilar; a EXCEÇÃO passa a ser da criança e não do programa. Isso importa: uma
// exceção que o código toma sozinho enfraquece o pilar para todo mundo; uma exceção que a pessoa liga no menu
// dela é o pilar funcionando — a11y venceu, e quem quis outra coisa disse isso.

/** A preferência gravada de UM efeito decorativo. */
export interface PreferenciaDeEfeito {
  /** O nível salvo. 0 = desligado. Scanline e vinheta são on/off; só os cantos têm três níveis. */
  nivel: number;
  /** A criança pediu que ESTE efeito não ceda quando um modo de acessibilidade visual estiver ligado? */
  manterEmA11y: boolean;
}

/**
 * Este efeito decorativo aparece AGORA?
 *
 * Desligado nunca aparece — e é a primeira pergunta de propósito, porque é ela que impede "manter" de virar
 * "ligar". Depois disso, só a acessibilidade suprime, e só se a criança não tiver pedido o contrário.
 */
export function efeitoDecorativoVisivel(p: PreferenciaDeEfeito, a11yVisualAtiva: boolean): boolean {
  if (!p.nivel) return false;
  return !a11yVisualAtiva || p.manterEmA11y;
}
