#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""THE DEBT CENSUS STAYS ALIVE — a report that dies in silence prints «0» forever.

`divida-dos-registos.py` REPORTS and never fails, on purpose (ADR-0126). And precisely because of that it needs
this file: a gate that fails is read on the day it goes red; a report whose detector died keeps printing numbers
— zeros — and nobody looks again. This repository has already paid for that: a sweep returned ZERO and nearly
became «there is no CDN at all».

The cases run over a TEMPORARY tree, written here, with the VACUUM first.
MUTATIONS CHECKED at the end of the file.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
CENSO = AQUI / "divida-dos-registos.py"

REGISTO = """---
metadata:
  status: "accepted"
{confirmado}  date: 2026-01-01
  decision-makers: [Dev]
title: {titulo}
decision-outcome:
  chosen-option:
    link: "x"
  confirmation: |
    {conf}
more-information: |
  nothing
"""


# A proposal shaped like ADR-0098 to ADR-0101: the `consulted` list comes first, so `status:` sits far down.
PROPOSTA = """---
metadata:
  consulted:
{consultados}
  status: "proposed"
  date: 2026-01-01
  decision-makers: [Dev]
  informed: []
title: {titulo}
decision-outcome:
  confirmation: |
    Nothing is owed until the Dev decides.
more-information: |
  nothing
"""

# Its pair: a DECIDED record whose prose has a line that looks like a proposed status, near the top.
DECIDIDO_COM_ECO = """---
metadata:
  status: "accepted"
  date: 2026-01-01
  decision-makers: [Dev]
title: {titulo}
context-and-problem-statement: |
  The first draft of this record read
  status: proposed
  and the Dev decided it the same day.
decision-outcome:
  confirmation: |
    The gate IS the confirmation.
more-information: |
  nothing
"""


def escrever(dir_: Path, nome: str, conf: str, confirmado: bool = False) -> None:
    bloco = "  confirmed-by:\n    - engine:tests/x.test.js\n" if confirmado else ""
    (dir_ / nome).write_text(
        REGISTO.format(titulo=nome, conf=conf, confirmado=bloco), encoding="utf-8"
    )


def correr(dir_: Path) -> tuple[int, str]:
    p = subprocess.run(
        [sys.executable, str(CENSO), str(dir_)], capture_output=True, text=True, encoding="utf-8"
    )
    return p.returncode, p.stdout


def main() -> int:
    falhas = []

    with tempfile.TemporaryDirectory() as td:
        vazio = Path(td)

        # 🎯 THE VACUUM FIRST: a tree with no records cannot be read as «no debts». This is the case that
        # catches the dead detector, and it is the reason it comes first and not last.
        cod, saida = correr(vazio)
        if "DORMANT" not in saida:
            falhas.append("[Vacuum] an empty tree did not announce DORMANT — it would read zero as «all fine»")
        if cod != 0:
            falhas.append(f"[Vacuum] the census failed (code {cod}); it can never fail")

        # A record that OWES and has no way to be followed: it has to show up.
        escrever(vazio, "ADR-9001-deve-sem-rastro.yaml", "⚠️ NOT YET BUILT. The gates this owes: one thing.")
        cod, saida = correr(vazio)
        if "NO TRAIL — neither a named issue nor a `confirmed-by`: 1" not in saida:
            falhas.append("[Zero] debt with no trail was not counted")
        if "ADR-9001" not in saida:
            falhas.append("[Zero] the owing record was not NAMED — a number on its own cannot be chased")

        # ⚠️ THE PAIR: a debt WITH a named issue is not «no trail». Without this case, the sieve could count
        # every debtor and the distinction ADR-0126 asks for would disappear.
        escrever(vazio, "ADR-9002-deve-com-issue.yaml", "⚠️ NOT YET BUILT. See issue #42, which does the work.")
        cod, saida = correr(vazio)
        if "`confirmed-by`: 1" not in saida:
            falhas.append("[Boundary] the named issue did not take the record out of «no trail»")

        # And the other pair: `confirmed-by` is a trail too — the strongest one, because the validator OPENS the paths.
        escrever(vazio, "ADR-9003-deve-confirmado.yaml", "⚠️ NOT YET BUILT. Nothing more.", confirmado=True)
        cod, saida = correr(vazio)
        if "`confirmed-by`: 1" not in saida:
            falhas.append("[Boundary] `confirmed-by` did not count as a trail")

        # A record that owes NOTHING cannot be accused — a sieve that accuses everything gets switched off.
        escrever(vazio, "ADR-9004-nao-deve.yaml", "The gate IS the confirmation: it runs in CI every day.")
        cod, saida = correr(vazio)
        if "declare debt in the confirmation: 3" not in saida:
            falhas.append("[Zero] a record with no debt was counted as a debtor")

        # 🎯 A PROPOSAL IS READ WHEREVER ITS `status:` SITS. The census once read only the first 400 characters,
        # and ADR-0098 to ADR-0101 — long `consulted` lists, `status:` past character 700 — were counted as
        # decided: four decisions waiting for the Dev, and the line that exists to show them said nothing.
        consultados = "\n".join(f'    - "consulted source number {i}, long enough to push the status down"'
                                for i in range(12))
        proposta = PROPOSTA.format(titulo="ADR-9005", consultados=consultados)
        if proposta.index("status:") <= 400:
            falhas.append("[Boundary] the fixture no longer puts `status:` past character 400 — it tests nothing")
        (vazio / "ADR-9005-proposta-longa.yaml").write_text(proposta, encoding="utf-8")
        # ⚠️ THE PAIR: prose that LOOKS like a status is not one. Only `metadata.status` decides.
        (vazio / "ADR-9006-decidido-com-eco.yaml").write_text(
            DECIDIDO_COM_ECO.format(titulo="ADR-9006"), encoding="utf-8"
        )
        cod, saida = correr(vazio)
        espera = next((l for l in saida.splitlines() if "WAITING FOR A DECISION" in l), "")
        if "ADR-9005" not in espera:
            falhas.append("[Boundary] a `proposed` record whose status sits past character 400 was not listed "
                          "as waiting for a decision")
        if "ADR-9006" in espera or "(1)" not in espera:
            falhas.append(f"[Boundary] a decided record was listed as waiting for a decision: {espera.strip()!r}")
        if cod != 0:
            falhas.append(f"[Boundary] the census failed (code {cod}); it can never fail")

    for f in falhas:
        print(f"FAIL {f}")
    print(f"\ndebt census: {'OK' if not falhas else str(len(falhas)) + ' failure(s)'}")
    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(main())

# ================================ MUTATIONS CHECKED ================================
# 1. 🎯 `DEVE` no longer matching «NOT YET BUILT» -> THREE cases fail. It is the whole mutation: the census
#    would start saying «0 debtors» over 126 records, which is the false zero this file exists to
#    prevent.
# 2. the DORMANT branch removed (an empty tree printing «0 debts») -> [Vacuum] fails, and the defect is the
#    worst of all: a wrong path comes to be read as health.
# 3. `tem_issue or tem_confirmacao` -> only `tem_issue` -> the `confirmed-by` [Boundary] fails. Without it, the
#    STRONGEST form of trail — the one the validator really opens — would count as absence.
# 4. 🎯 the status read by a regex over the first 400 characters (the census before it parsed the YAML) -> both
#    [Boundary] cases on proposals fail: ADR-9005 goes missing from the waiting line, and ADR-9006 enters it
#    because its prose echoes a status near the top.
