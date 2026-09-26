#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
"""THE RECORDS' DEBT — a record that owes work has to say WHO does it (ADR-0126).

=========================== WHY THIS EXISTS, MEASURED AND NOT ASSUMED ===========================
ADR-0126 closed with a clause: «EVERY RECORD THAT OWES WORK NAMES THE ISSUE THAT DOES IT», and the reason
written was to keep «a decisao e um registo» from becoming the place where work is filed without anyone
scheduling it.

MEASURED on 2026-09-09, and the measurement changed the shape of the gate: of the 126 records, TWELVE declare
debt in the confirmation and TEN name no issue at all. But on opening three of them, the debt was OLD TEXT —
ADR-0110, 0111 and 0115 opened with «NOT YET BUILT» over work that was already built.

AND WORST OF ALL: the validator said «126 sound, 0 problems» — because those records had NO `confirmed-by` at
all. A record that declares debt and never confirms it stays SOUND FOREVER. The debt is invisible to the machine
exactly while nobody pays it, which is the opposite of what is wanted.

So the sieve asks two things, not one:
  1. does the record declare debt?  (text: NOT YET BUILT / NOT YET EXECUTED / gates this owes / empty box)
  2. if so, is there a way to follow it? — a named ISSUE, OR a `confirmed-by` (which the validator OPENS).

IT REPORTS AND DOES NOT FAIL. Fixing twelve historical records is not the work of one commit, and a gate that is
born red and stays red is a gate someone switches off — the lesson `check-annual-report` already carries. The
number is a CEILING THAT ONLY GOES DOWN, and it always exits 0.
"""
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

RAIZ = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "docs/2-Architecture/adr"

DEVE = re.compile(r"NOT YET BUILT|NOT YET EXECUTED|gates this owes|⬜", re.I)
ISSUE = re.compile(r"(?:issue\s+)?#\d+|[a-z][a-z0-9-]*#\d+", re.I)


def confirmacao(texto: str) -> str:
    """The `confirmation` block, up to the next `more-information`. Empty if there is none."""
    i = texto.find("confirmation:")
    if i < 0:
        return ""
    j = texto.find("\nmore-information:", i)
    return texto[i:j if j > 0 else len(texto)]


def main() -> int:
    ficheiros = sorted(p for p in RAIZ.glob("ADR-*.yaml"))
    if not ficheiros:
        # DORMANT AND OUT LOUD: zero files is not zero debts, and saying «all fine» here would be the false
        # report this project has already caught three times.
        print(f"records' debt: DORMANT — no ADR-*.yaml in {RAIZ}")
        print("  ⚠️ this is NOT «zero debts»: it is zero measurements.")
        return 0
    if yaml is None:
        # DORMANT for the same reason: without a parser the status of a record cannot be read, and printing
        # «no proposals» would be a measurement that never happened.
        print("records' debt: DORMANT — PyYAML is missing (pip install pyyaml)")
        print("  ⚠️ this is NOT «zero debts»: it is zero measurements.")
        return 0

    devedores, sem_rastro = [], []
    for p in ficheiros:
        texto = p.read_text(encoding="utf-8")
        conf = confirmacao(texto)
        if not conf or not DEVE.search(conf):
            continue
        devedores.append(p.name)
        tem_issue = bool(ISSUE.search(conf))
        tem_confirmacao = "confirmed-by:" in texto
        if not tem_issue and not tem_confirmacao:
            sem_rastro.append(p.name)

    # ⏳ AND THE DECISIONS WAITING FOR THE DEV, which are the other way for something to sit still. A `proposed`
    # record owes no gates — there is no decision to owe them — so the counters above do not see it. Without this
    # line, a measured and written proposal sits in the same silence that a closed issue would take it out of.
    # 📌 The status is READ BY THE PARSER, as `metadata.status`, and not searched for in the text: a record
    # whose `consulted` list runs long puts `status:` hundreds of characters down (ADR-0098 to ADR-0101 have it
    # past character 700), and a prefix read skips it without a sound. A record that does not parse is NAMED
    # rather than counted as «not proposed», because an unread status is not an answer.
    propostas, ilegiveis = [], []
    for p in ficheiros:
        try:
            doc = yaml.safe_load(p.read_text(encoding="utf-8"))
        except yaml.YAMLError:
            ilegiveis.append(p.name)
            continue
        meta = doc.get("metadata") if isinstance(doc, dict) else None
        if isinstance(meta, dict) and meta.get("status") == "proposed":
            propostas.append(p.name)

    print(f"records' debt · {len(ficheiros)} records")
    if propostas:
        print(f"  ⏳ WAITING FOR A DECISION ({len(propostas)}): " + ", ".join(n[:12] for n in propostas))
    if ilegiveis:
        print(f"  ⚠️ STATUS UNREADABLE — the record does not parse ({len(ilegiveis)}): "
              + ", ".join(n[:12] for n in ilegiveis))
    print(f"  declare debt in the confirmation: {len(devedores)}")
    print(f"  🔴 NO TRAIL — neither a named issue nor a `confirmed-by`: {len(sem_rastro)}")
    for n in sem_rastro:
        print(f"     {n[:16]}")
    print()
    print("  ⚠️ «no trail» does not mean «not done»: it means nobody can KNOW, from here, whether it")
    print("     is done. Three of them on 2026-09-09 were DONE and the text still said they were not —")
    print("     and the validator passed them, because a record with no `confirmed-by` has nothing to check.")
    print("  (report: never fails — see the header and ADR-0126)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
