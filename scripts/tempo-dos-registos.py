#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""THE TWO TIMES OF A RECORD — the decision first, the confirmation after (ADR-0128).

=========================== THE DEFECT THIS CATCHES, AND IT HAPPENED EIGHT TIMES ===========================
On 2026-09-09 EIGHT accepted records opened with «⚠️ NOT YET BUILT» over work that was built —
0108, 0109, 0110, 0111, 0113, 0114, 0115 and 0124. Each was written before the code, and each went on
describing a future that had already happened.

AND THE MACHINE AGREED WITH THEM: the validator said «126 sound, 0 problems», because a record with no
`confirmed-by` has nothing to check. A record that declares debt and never confirms it stays sound FOREVER.

This sieve closes the contradiction that remains after the debt is paid: **a record that carries `confirmed-by`
cannot go on saying the work is still to be done.** Either the text was corrected — and an `errata` says what
changed, as ADR-0057 mandates — or the record contradicts itself, and whoever reads it next inherits the lie.

IT FAILS, unlike the debt census, and the difference is deliberate: this is mechanical and is fixed in one
commit (writing the erratum that should already be there). The census counts a debt that only WORK pays, and so
it only reports.

MEASURED BEFORE BEING WRITTEN: 127 records, 18 with `confirmed-by`, ZERO contradictory. It is born green and can
go red — which is the only way a rule gets kept.
"""
import re
import sys
from pathlib import Path

RAIZ = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "docs/2-Architecture/adr"

POR_CONSTRUIR = re.compile(r"NOT YET BUILT|NOT YET EXECUTED|gates this owes|⬜", re.I)
TEM_CONFIRMADO = re.compile(r"^\s*confirmed-by:", re.M)
TEM_ERRATA = re.compile(r"^\s*errata:", re.M)


def confirmacao(texto: str) -> str:
    i = texto.find("confirmation:")
    if i < 0:
        return ""
    j = texto.find("\nmore-information:", i)
    return texto[i:j if j > 0 else len(texto)]


def main() -> int:
    ficheiros = sorted(p for p in RAIZ.glob("ADR-*.yaml"))
    if not ficheiros:
        # DORMANT AND OUT LOUD: zero files is not zero contradictions. Saying «all fine» here would be the false
        # report this repository has already caught three times — and a sieve that passes the empty passes everything.
        print(f"records' times: DORMANT — no ADR-*.yaml in {RAIZ}")
        print("  ⚠️ this is NOT «zero contradictions»: it is zero measurements.")
        return 0

    com_confirmado, maus = 0, []
    for p in ficheiros:
        texto = p.read_text(encoding="utf-8")
        if not TEM_CONFIRMADO.search(texto):
            continue
        com_confirmado += 1
        if POR_CONSTRUIR.search(confirmacao(texto)) and not TEM_ERRATA.search(texto):
            maus.append(p.name)

    print(f"records' times · {len(ficheiros)} records · {com_confirmado} with `confirmed-by`")
    if not maus:
        print("  ✅ no record contradicts itself: whoever has `confirmed-by` does not say the work is still to be done.")
        return 0

    print(f"\n🔴 {len(maus)} record(s) CONTRADICT THEMSELVES — they carry `confirmed-by` and still say the")
    print("   work is yet to be built, with no `errata` saying what changed:\n")
    for n in maus:
        print(f"     {n}")
    print("\n  The confirmation is the record's SECOND time (ADR-0128): when the gate lands, the text stops")
    print("  speaking in the future and an `errata` says what changed (ADR-0057). A record that points at the gate and")
    print("  at the same time says it does not exist teaches the next reader to believe neither of the two.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
