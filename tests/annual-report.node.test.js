// SPDX-License-Identifier: AGPL-3.0-or-later
// THE GATE OF THE ONLY OBLIGATION THAT UNDOES ITSELF (ADR-0053, issue #95).
//
// ========================= WHAT THIS FILE PREVENTS =========================
// Of the twenty-two divergences found between the filed document and the ADRs, the annual report was the only one that
// RECURS. All the others are done once and stay done; this one is undone by time, by nobody's decision — and §51.j gives
// the reason best: *«compromisso sem prestação de contas periódica degrada silenciosamente»*.
//
// The gate lives in `scripts/check-annual-report.mjs` and runs in CI. This file holds its ARITHMETIC, which is where an
// error would go unnoticed: a gate that looked only at the current year would be green in 2028 because of the 2028
// report, with 2027 never written — and it would be claiming the commitment was kept in the year it was not.
//
// ⚠️ WHAT IT DOES NOT HOLD, and the script says so out loud in its own success message: the report's QUALITY. An empty
// file satisfies the gate. ADR-0053 writes it as an accepted consequence — «the gate buys the ritual, not the quality»
// — and the `[Interface]` case below exists so that this caveat cannot be deleted silently, because deleting it would
// turn a green of existence into a green of compliance.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { anosEmFalta, primeiroAnoDevido, lerDeclaracao, NOME_DO_RELATORIO }
  from '../scripts/check-annual-report.mjs';

const FONTE = readFileSync(join(process.cwd(), 'scripts', 'check-annual-report.mjs'), 'utf8');

describe('scripts/check-annual-report · o relatório anual do §51.j (ADR-0053)', () => {
  it('[Zero] sem declaração e sem relatório o gate está DORMENTE — e dormente não é reprovado', () => {
    // ADR-0053 leaves the start open on purpose: «the first report is due for the first calendar year in which the
    // systems are in use, not now». No file of this repository knows that date, and inventing it would be a second
    // opinion on a fact only the Dev has.
    expect(primeiroAnoDevido(null, [])).toBe(null);
    expect(anosEmFalta(null, 2026, [])).toEqual([]);
  });

  it('[Right] armado em 2024 e nenhum relatório escrito: os três anos são cobrados', () => {
    expect(anosEmFalta(2024, 2026, [])).toEqual([2024, 2025, 2026]);
  });

  it('⚠️ [Boundary] um buraco NO MEIO é cobrado — o gate olha para trás, não só para o ano corrente', () => {
    // The defect this case prevents has a specific and expensive shape: someone writes the 2026 report, the pipeline goes
    // green, and 2025 stays unwritten forever. The obligation is annual; the check has to be too.
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
    // Two paths, each serving a moment. The declaration arms BEFORE the first report is due, which is the case ADR-0053
    // asks for by name. The oldest report arms AFTER, and exists so the obligation cannot be started and dropped: writing
    // the first is what makes the second mandatory.
    expect(primeiroAnoDevido(null, [2027, 2029])).toBe(2027);
    // ⚠️ The declaration beats an older report: if someone fills in a year before the start — a volunteer, an example —,
    // the file still decides, and the reports are evidence.
    expect(primeiroAnoDevido(2028, [2027, 2029])).toBe(2028);
  });

  it('[Error] a declaração só aceita quatro dígitos, e rebenta em vez de adivinhar', () => {
    // An unreadable declaration must NOT fall into the dormant branch: it would be the easiest way to disarm the gate
    // without deleting anything — writing `em breve` in the file and staying green forever.
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
    // Issue #95 asks for this in writing: *«o alcance, dito no próprio gate — ele garante que o exercício não
    // se encerra sem alguém escrever; não garante que o texto preste. Escrever isso no cabeçalho do script
    // evita que o verde seja lido como conformidade.»*
    //
    // Without this case, deleting the caveat would be an invisible change that alters the MEANING of every future green,
    // in a file an audit will read.
    expect(FONTE, 'a ressalva saiu da mensagem de sucesso: um verde de existência passaria por conformidade')
      .toContain('Existence only — nobody checked the text.');
    expect(FONTE, 'a ressalva saiu do cabeçalho do script')
      .toMatch(/IT CANNOT JUDGE WHETHER THE REPORT IS ANY GOOD/);
  });
});

// ========================= MUTATIONS CHECKED =========================
// The arithmetic, by mutation in `scripts/check-annual-report.mjs`:
//   · making `anosEmFalta`'s loop start at `anoAtual` instead of `primeiroAno` — that is, the gate looking only at the
//     current year → `[Boundary] um buraco NO MEIO` (in both assertions) and `[Right] armado em 2024` fail. The other
//     seven cases stay green, which shows the size of the hole: such a gate would pass as correct in any year someone had
//     written SOMETHING.
//   · replacing `if (!m) throw` with `if (!m) return null` in `lerDeclaracao` → `[Error] quatro dígitos` fails. It is
//     the mutation that matters most: with it, writing `em breve` in `PRIMEIRO-ANO` would disarm the gate silently and
//     forever.
//   · deleting the «(Existence only …)» suffix from the success message → `[Interface] a mensagem de sucesso DIZ` fails.
//   · replacing `\d{4}` with `\d+` in `NOME_DO_RELATORIO` → `[Error] relatorio-27.md` fails.
//
// And the WHOLE SCRIPT, run against trial folders with `COMPLIANCE_DIR`/`ANO_ATUAL`:
//   A) declared 2024, zero reports, year 2026 → exit 1, demands 2024, 2025 and 2026.
//   B) 2024 and 2026 present, 2025 missing    → exit 1, demands ONLY 2025.
//   C) all three present                      → exit 0.
//   D) no declaration, only `relatorio-2026.md` → exit 0 (armed itself in 2026).
//   E) no declaration, only `relatorio-2024.md` → exit 1, demands 2025 and 2026.
//   F) `PRIMEIRO-ANO` with `em breve`         → exit 1, and the message names the invalid content.
