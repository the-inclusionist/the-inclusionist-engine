// SPDX-License-Identifier: AGPL-3.0-or-later
// O GATE DA ÚNICA OBRIGAÇÃO QUE SE DESFAZ SOZINHA (ADR-0053, issue #95).
//
// ========================= O QUE ESTE FICHEIRO IMPEDE =========================
// Das vinte e duas divergências achadas entre o documento entregue e os ADRs, o relatório anual era a única
// que RECORRE. Todas as outras fazem-se uma vez e ficam feitas; esta desfaz-se com o tempo, sem decisão de
// ninguém — e o §51.j diz o motivo melhor do que eu diria: *«compromisso sem prestação de contas periódica
// degrada silenciosamente»*.
//
// O gate vive em `scripts/check-annual-report.mjs` e corre no CI. Este ficheiro prende a ARITMÉTICA dele,
// que é onde um erro passaria despercebido: um gate que olhasse só para o ano corrente ficaria verde em 2028
// por causa do relatório de 2028, com 2027 nunca escrito — e estaria a afirmar que o compromisso foi
// cumprido no ano em que não foi.
//
// ⚠️ O QUE ELE NÃO PRENDE, e o script diz isto em voz alta na própria mensagem de sucesso: a QUALIDADE do
// relatório. Um ficheiro vazio satisfaz o gate. O ADR-0053 escreve-o como consequência aceite — «the gate
// buys the ritual, not the quality» — e o caso `[Interface]` abaixo existe para que essa ressalva não possa
// ser apagada em silêncio, porque apagá-la transformaria um verde de existência num verde de conformidade.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { anosEmFalta, primeiroAnoDevido, lerDeclaracao, NOME_DO_RELATORIO }
  from '../scripts/check-annual-report.mjs';

const FONTE = readFileSync(join(process.cwd(), 'scripts', 'check-annual-report.mjs'), 'utf8');

describe('scripts/check-annual-report · o relatório anual do §51.j (ADR-0053)', () => {
  it('[Zero] sem declaração e sem relatório o gate está DORMENTE — e dormente não é reprovado', () => {
    // O ADR-0053 deixa o início em aberto de propósito: «the first report is due for the first calendar year
    // in which the systems are in use, not now». Nenhum ficheiro deste repositório sabe essa data, e
    // inventá-la seria uma segunda opinião sobre um facto que só o Dev tem.
    expect(primeiroAnoDevido(null, [])).toBe(null);
    expect(anosEmFalta(null, 2026, [])).toEqual([]);
  });

  it('[Right] armado em 2024 e nenhum relatório escrito: os três anos são cobrados', () => {
    expect(anosEmFalta(2024, 2026, [])).toEqual([2024, 2025, 2026]);
  });

  it('⚠️ [Boundary] um buraco NO MEIO é cobrado — o gate olha para trás, não só para o ano corrente', () => {
    // O defeito que este caso impede tem uma forma específica e cara: alguém escreve o relatório de 2026,
    // o pipeline fica verde, e 2025 fica por escrever para sempre. A obrigação é anual; a verificação
    // também tem de ser.
    expect(anosEmFalta(2024, 2026, [2024, 2026])).toEqual([2025]);
    expect(anosEmFalta(2024, 2028, [2028])).toEqual([2024, 2025, 2026, 2027]);
  });

  it('[Right] com todos os anos escritos não sobra nada a cobrar', () => {
    expect(anosEmFalta(2024, 2026, [2024, 2025, 2026])).toEqual([]);
    expect(anosEmFalta(2026, 2026, [2026])).toEqual([]);
  });

  it('[Boundary] armado para o FUTURO não cobra nada — a obrigação começa no ano declarado', () => {
    expect(anosEmFalta(2030, 2026, [])).toEqual([]);
  });

  it('[Interface] o PRIMEIRO RELATÓRIO arma o gate sozinho, e a declaração vence-o', () => {
    // Dois caminhos, e cada um serve um momento. A declaração arma ANTES do primeiro relatório vencer, que
    // é o caso que o ADR-0053 pede pelo nome. O relatório mais antigo arma DEPOIS, e existe para que a
    // obrigação não possa ser começada e largada: escrever o primeiro é o que torna o segundo obrigatório.
    expect(primeiroAnoDevido(null, [2027, 2029])).toBe(2027);
    // ⚠️ A declaração vence um relatório mais antigo: se alguém preencher um ano anterior ao início — um
    // voluntário, um exemplo —, quem decide continua a ser o ficheiro, e os relatórios são prova.
    expect(primeiroAnoDevido(2028, [2027, 2029])).toBe(2028);
  });

  it('[Error] a declaração só aceita quatro dígitos, e rebenta em vez de adivinhar', () => {
    // Uma declaração ilegível NÃO pode cair no ramo dormente: seria a forma mais fácil de desarmar o gate
    // sem apagar nada — escrever «em breve» no ficheiro e ficar verde para sempre.
    expect(lerDeclaracao('2027')).toBe(2027);
    expect(lerDeclaracao(' 2027\n')).toBe(2027);
    for (const lixo of ['', 'em breve', '27', '20270', '2027-01', 'MMXXVII']) {
      expect(() => lerDeclaracao(lixo), JSON.stringify(lixo) + ' passou como ano').toThrow();
    }
  });

  it('[Error] `relatorio-27.md` não é o relatório de 2027 — é uma gralha, e não conta', () => {
    expect(NOME_DO_RELATORIO.exec('relatorio-2027.md')?.[1]).toBe('2027');
    for (const nome of ['relatorio-27.md', 'relatorio-2027.txt', 'relatorio.md', 'RELATORIO-2027.md', 'x-relatorio-2027.md']) {
      expect(NOME_DO_RELATORIO.test(nome), nome + ' foi aceite como relatório').toBe(false);
    }
  });

  it('⚠️ [Interface] a mensagem de sucesso DIZ que só afere existência — a ressalva é parte do gate', () => {
    // A issue #95 pede isto por escrito: *«o alcance, dito no próprio gate — ele garante que o exercício não
    // se encerra sem alguém escrever; não garante que o texto preste. Escrever isso no cabeçalho do script
    // evita que o verde seja lido como conformidade.»*
    //
    // Sem este caso, apagar a ressalva seria uma alteração invisível que muda o SIGNIFICADO de todos os
    // verdes futuros, num ficheiro que uma auditoria vai ler.
    expect(FONTE, 'a ressalva saiu da mensagem de sucesso: um verde de existência passaria por conformidade')
      .toContain('Existence only — nobody checked the text.');
    expect(FONTE, 'a ressalva saiu do cabeçalho do script')
      .toMatch(/IT CANNOT JUDGE WHETHER THE REPORT IS ANY GOOD/);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
// A aritmética, por mutação no `scripts/check-annual-report.mjs`:
//   · fazendo o laço de `anosEmFalta` começar em `anoAtual` em vez de `primeiroAno` — quer dizer, o gate a
//     olhar só para o ano corrente → reprovam "[Boundary] um buraco NO MEIO" (nas duas asserções) e
//     "[Right] armado em 2024". Os restantes sete casos continuam verdes, que é o que mostra o tamanho do
//     buraco: um gate assim passaria por correcto em qualquer ano em que alguém tivesse escrito ALGO.
//   · trocando `if (!m) throw` por `if (!m) return null` em `lerDeclaracao` → "[Error] quatro dígitos"
//     reprova. É a mutação que importa mais: com ela, escrever «em breve» no `PRIMEIRO-ANO` desarmaria o
//     gate em silêncio e para sempre.
//   · apagando o sufixo «(Existence only …)» da mensagem de sucesso → "[Interface] a mensagem de sucesso
//     DIZ" reprova.
//   · trocando `\d{4}` por `\d+` em `NOME_DO_RELATORIO` → "[Error] relatorio-27.md" reprova.
//
// E o SCRIPT INTEIRO, corrido contra pastas de ensaio com `COMPLIANCE_DIR`/`ANO_ATUAL` (07/09):
//   A) declarado 2024, zero relatórios, ano 2026 → exit 1, cobra 2024, 2025 e 2026.
//   B) 2024 e 2026 presentes, 2025 em falta      → exit 1, cobra SÓ 2025.
//   C) os três presentes                         → exit 0.
//   D) sem declaração, só `relatorio-2026.md`    → exit 0 (auto-armou em 2026).
//   E) sem declaração, só `relatorio-2024.md`    → exit 1, cobra 2025 e 2026.
//   F) `PRIMEIRO-ANO` com «em breve»             → exit 1, e a mensagem nomeia o conteúdo inválido.
