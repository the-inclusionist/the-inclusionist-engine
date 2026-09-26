#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# THE GATE OF THE GATE — that what was NOT checked be SAID (ADR-0123 §3).
#
# ========================= WHY THIS EXISTS =========================
# 🔴 Since the records stopped living next to the code, a `confirmed-by: engine:app/js/x.ts` is only checked
# when someone passes the engine's root. Without it, the validator cannot open the file — and the only thing
# that separates that from a rubber stamp is the line that says «24 paths NOT checked».
#
# ⚠️ A DEFENCE WITHOUT A TEST IS A COMMENT. Deleting that `print` leaves the validator printing «123 sound, 0
# problems» without having opened a single artefact, and nothing anywhere fails. It is the exact shape of the
# false report this project has already caught three times: an empty sweep read as absence.
#
# 📌 NO DEPENDENCIES AND NO RUNNER: this repository keeps records, not an application. `python
# scripts/test-validate-adr.py` runs, exits 0 or 1, and CI reads the exit code — which is the same contract as
# the validator beside it.
#
# MUTATIONS CHECKED (at the end of the file).
import os
import shutil
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
VALIDADOR = os.path.join(AQUI, "validate-adr.py")

REGISTO = """---
metadata:
  shape: bundle
  status: "accepted"
  date: 2026-09-09
  decision-makers: [Dev]
  consulted: []
  informed: []
{confirmed}
title: {titulo}
context-and-problem-statement: |
  A fixture record. It exists so the validator has something to read.
decision-outcome:
  justification: |
    Nothing to decide: this record exists to exercise the sieve.
more-information: |
  Nothing.
"""


def escreve(pasta, numero, titulo, confirmed=""):
    caminho = os.path.join(pasta, f"ADR-{numero:04d}-fixture.yaml")
    with open(caminho, "w", encoding="utf-8") as fh:
        fh.write(REGISTO.format(titulo=titulo, confirmed=confirmed))
    return caminho


def corre(*args):
    # ⚠️ `encoding="utf-8"` AND NOT THE DEFAULT: the validator prints ⚠️ and 📌, and on Windows `text=True` decodes
    # with the console's cp1252 — which blows up with `UnicodeDecodeError` before any assertion runs.
    # Caught while running, on the first attempt. `errors="replace"` so the case never dies over one byte.
    r = subprocess.run(
        [sys.executable, VALIDADOR, *args],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    return r.returncode, (r.stdout or "") + (r.stderr or "")


falhas = []


def exige(condicao, porque):
    if not condicao:
        falhas.append(porque)


with tempfile.TemporaryDirectory() as base:
    adr = os.path.join(base, "adr")
    engine = os.path.join(base, "engine-de-mentira")
    os.makedirs(adr)
    os.makedirs(engine)
    with open(os.path.join(engine, "existe.ts"), "w", encoding="utf-8") as fh:
        fh.write("// the artefact that confirms the record\n")

    escreve(adr, 1, "with a confirmation in another repository",
            "  confirmed-by:\n    - engine:existe.ts")
    escreve(adr, 2, "with no confirmation at all")

    # [Vacuum] — before anything: the sieve FINDS the fixture. Without this, a validator that read nothing would
    # pass every case below for having nothing to fail.
    codigo, saida = corre(adr)
    exige("2 records" in saida, f"the validator did not read the fixture — it would measure nothing. Output:\n{saida}")

    # 🎯 [Zero] WITHOUT the engine's root: they are sound, AND the line about what was not checked shows up.
    exige(codigo == 0, f"the fixture should be sound without `--repo`; it exited {codigo}. Output:\n{saida}")
    exige("NOT checked" in saida,
          "the validator went SILENT about what it did not check — it is a rubber stamp, not a sieve. "
          f"Output:\n{saida}")
    exige("`engine`" in saida, f"the line does not name the missing repository. Output:\n{saida}")

    # [Right] WITH the right root: it really checks, and stops warning.
    codigo, saida = corre(adr, "--repo", f"engine={engine}")
    exige(codigo == 0, f"with the right root it should exit 0; it exited {codigo}. Output:\n{saida}")
    exige("NOT checked" not in saida,
          f"it warned that it did not check, with the root in hand. Output:\n{saida}")

    # 🔴 [Boundary] A PREFIX NOBODY DECLARED is a problem, and not «not checked». It was the case ADR-0123 said it
    # could not pay for, and the sentence was badly put: the risk is not the repository changing its name, it is
    # the label never having existed — and a typo would go on living inside the everyday message.
    escreve(adr, 3, "with a prefix that does not exist",
            "  confirmed-by:\n    - enigne:existe.ts")
    codigo, saida = corre(adr)
    exige(codigo != 0, f"an unknown prefix should fail; it exited {codigo}. Output:\n{saida}")
    exige("not a declared repository" in saida,
          f"it failed, but not for the right reason. Output:\n{saida}")
    os.remove(os.path.join(adr, "ADR-0003-fixture.yaml"))

    # 🔴 [Inverse] WITH the wrong root: it fails, and the message says what it measured against.
    codigo, saida = corre(adr, "--repo", f"engine={os.path.join(base, 'nao-existe')}")
    exige(codigo != 0, f"a wrong root should fail; it exited {codigo}. Output:\n{saida}")
    exige("existe.ts" in saida, f"the failure does not name the path. Output:\n{saida}")
    exige("nao-existe" in saida,
          f"the failure does not say against WHICH root it measured — it looks like a lying record. Output:\n{saida}")

    # ======================= the INDEX, which drained seven records in silence =======================
    indice = os.path.join(adr, "README.md")

    # [Vacuum] FIRST, and it is the case that matters most: without `README.md` the sieve SKIPS, and it has to
    # skip — a records tree with no index is not a broken tree. ⚠️ But a skip nobody asserts is like a sieve
    # switched off: if `os.path.exists` became a constant `True`, nothing below would notice.
    codigo, saida = corre(adr)
    exige(codigo == 0, f"with no index at all it should skip and exit 0; it exited {codigo}. Output:\n{saida}")
    exige("no row in the index" not in saida,
          f"it reported a missing index row in a tree that has no index at all. Output:\n{saida}")

    # [Right] with an index that names ONE of the two, the other is reported — and the one reported is the missing one.
    with open(indice, "w", encoding="utf-8") as fh:
        fh.write("| ADR | Decision | Status |\n|---|---|---|\n"
                 "| [ADR-0001](ADR-0001-fixture.yaml) | the one that is there | accepted |\n")
    codigo, saida = corre(adr)
    exige(codigo != 0, f"a record outside the index should fail; it exited {codigo}. Output:\n{saida}")
    exige("ADR-0002" in saida, f"it failed without naming WHICH record is missing. Output:\n{saida}")
    exige("ADR-0001" not in saida.replace("ADR-0001-fixture.yaml", ""),
          f"it also reported the record that HAS a row. Output:\n{saida}")

    # 🎯 [Boundary] BEING MENTIONED IS NOT HAVING A ROW, and that is exactly how the seven hid:
    # a record cited inside the prose of another row shows up to a `grep` and still has no entry.
    with open(indice, "w", encoding="utf-8") as fh:
        fh.write("| ADR | Decision | Status |\n|---|---|---|\n"
                 "| [ADR-0001](ADR-0001-fixture.yaml) | supersedes ADR-0002 in part | accepted |\n")
    codigo, saida = corre(adr)
    exige(codigo != 0,
          f"ADR-0002 is only MENTIONED in the prose of another row and it passed anyway; it exited {codigo}. "
          f"Output:\n{saida}")

    # [Inverse] with both indexed, green again — otherwise it would be a gate that can never go green.
    with open(indice, "w", encoding="utf-8") as fh:
        fh.write("| ADR | Decision | Status |\n|---|---|---|\n"
                 "| [ADR-0001](ADR-0001-fixture.yaml) | the first | accepted |\n"
                 "| [ADR-0002](ADR-0002-fixture.yaml) | the second | accepted |\n")
    codigo, saida = corre(adr)
    exige(codigo == 0, f"with both in the index it should exit 0; it exited {codigo}. Output:\n{saida}")

    # ============ CITATIONS ACROSS TREES (ADR-0229): a record moved to a game ============
    # The home tree (`adr`) cites 0005, which lives in the game; the game's tree cites 0001, which stayed home.
    jogo = os.path.join(base, "jogo")
    arvore_do_jogo = os.path.join(jogo, "docs", "2-Architecture", "adr")
    os.makedirs(arvore_do_jogo)
    escreve(arvore_do_jogo, 5, "the game's record, which cites ADR-0001 that stayed home")
    escreve(adr, 4, "cites ADR-0005, which moved to the game")
    casa_sem_linha = ("| ADR | Decision | Status |\n|---|---|---|\n"
                      "| [ADR-0001](ADR-0001-fixture.yaml) | the first | accepted |\n"
                      "| [ADR-0002](ADR-0002-fixture.yaml) | the second | accepted |\n"
                      "| [ADR-0004](ADR-0004-fixture.yaml) | the fourth | accepted |\n")
    linha_movida = ("| [ADR-0005](game-platformer:docs/2-Architecture/adr/ADR-0005-fixture.yaml) "
                    "| moved | accepted |\n")
    with open(indice, "w", encoding="utf-8") as fh:
        fh.write(casa_sem_linha)

    # 🔴 [Boundary] with no row and no `--repo`, the citation of 0005 FAILS — it never becomes «not checked»,
    # otherwise ADR-0010's one-digit error would come to live inside the message that all is well.
    codigo, saida = corre(adr)
    exige(codigo != 0 and "cites ADR-0005" in saida,
          f"a citation no tree answers passed; it exited {codigo}. Output:\n{saida}")

    # 🎯 [Zero] with the «moved» row and WITHOUT the game's root: green, and the row is COUNTED and said.
    with open(indice, "w", encoding="utf-8") as fh:
        fh.write(casa_sem_linha + linha_movida)
    codigo, saida = corre(adr)
    exige(codigo == 0, f"the «moved» row should answer for the citation; it exited {codigo}. Output:\n{saida}")
    exige("index rows moved to `game-platformer` NOT checked" in saida,
          f"the moved row was not checked and the validator kept quiet. Output:\n{saida}")

    # [Right] WITH the game's root: it checks the file on the other side, and stops warning.
    codigo, saida = corre(adr, "--repo", f"game-platformer={jogo}")
    exige(codigo == 0 and "index rows moved" not in saida,
          f"with the game's root it should check and keep quiet; it exited {codigo}. Output:\n{saida}")

    # 🔴 [Inverse] the row points at a file that is not there: it fails the INDEX.
    os.rename(os.path.join(arvore_do_jogo, "ADR-0005-fixture.yaml"), os.path.join(arvore_do_jogo, "fora.yaml"))
    codigo, saida = corre(adr, "--repo", f"game-platformer={jogo}")
    exige(codigo != 0 and "FAIL README.md" in saida,
          f"the «moved» row points at nothing and passed; it exited {codigo}. Output:\n{saida}")
    os.rename(os.path.join(arvore_do_jogo, "fora.yaml"), os.path.join(arvore_do_jogo, "ADR-0005-fixture.yaml"))

    # 🔴 [Boundary] a label nobody declared on the «moved» row fails, for the same reason as
    # `confirmed-by`: counting it as «not checked» would hide the typo in the everyday message.
    with open(indice, "w", encoding="utf-8") as fh:
        fh.write(casa_sem_linha + linha_movida.replace("game-platformer:", "game-platfromer:"))
    codigo, saida = corre(adr)
    exige(codigo != 0 and "not a declared repository" in saida,
          f"a row with a wrong label passed; it exited {codigo}. Output:\n{saida}")
    with open(indice, "w", encoding="utf-8") as fh:
        fh.write(casa_sem_linha + linha_movida)

    # 🔴 [Inverse] the file stayed home AND the row says it moved: one of the two is stale.
    escreve(adr, 5, "the copy that was left behind")
    codigo, saida = corre(adr, "--repo", f"game-platformer={jogo}")
    exige(codigo != 0 and "one of the two is stale" in saida,
          f"a record in two homes passed; it exited {codigo}. Output:\n{saida}")
    os.remove(os.path.join(adr, "ADR-0005-fixture.yaml"))

    # The other side: the GAME's tree cites 0001. Without home declared it fails; with it, it is sound.
    codigo, saida = corre(arvore_do_jogo)
    exige(codigo != 0 and "cites ADR-0001" in saida,
          f"the game's tree cited what it does not have and passed without `--repo`; it exited {codigo}. Output:\n{saida}")
    # The home tree is copied into the shape of a repository (`<root>/docs/2-Architecture/adr`), which is where the
    # validator looks — the loose `adr` fixture does not have that shape.
    casa = os.path.join(base, "casa")
    shutil.copytree(adr, os.path.join(casa, "docs", "2-Architecture", "adr"))
    codigo, saida = corre(arvore_do_jogo, "--repo", f"docs={casa}")
    exige(codigo == 0, f"with home declared the game's tree should be sound; it exited {codigo}. Output:\n{saida}")

    # 🔴 [Boundary] declaring the tree ITSELF does not let it answer for itself: its index has a row for
    # 0009 with no file at all, and that row cannot come to count as proof just because `--repo` points at it.
    escreve(arvore_do_jogo, 6, "cites ADR-0009, which exists nowhere")
    with open(os.path.join(arvore_do_jogo, "README.md"), "w", encoding="utf-8") as fh:
        fh.write("| ADR | Decision | Status |\n|---|---|---|\n"
                 "| [ADR-0005](ADR-0005-fixture.yaml) | the fifth | accepted |\n"
                 "| [ADR-0006](ADR-0006-fixture.yaml) | the sixth | accepted |\n"
                 "| [ADR-0009](ADR-0009-fixture.yaml) | a row with no file | accepted |\n")
    codigo, saida = corre(arvore_do_jogo, "--repo", f"docs={casa}", "--repo", f"game-platformer={jogo}")
    exige(codigo != 0 and "cites ADR-0009" in saida,
          f"a number no tree has passed; it exited {codigo}. Output:\n{saida}")

    # ============ A SUPERSESSION PAIR ACROSS TREES (ADR-0242): the engine's records went home ============
    # `docs` keeps ADR-0010; the engine's ADR-0011 supersedes part of it. Each half lives in its own repository.
    lado_docs = os.path.join(base, "lado-docs", "docs", "2-Architecture", "adr")
    raiz_engine = os.path.join(base, "lado-engine")
    lado_engine = os.path.join(raiz_engine, "docs", "2-Architecture", "adr")
    os.makedirs(lado_docs)
    os.makedirs(lado_engine)
    escreve(lado_docs, 10, "superseded in part by a record that went home to the engine",
            '  superseded-in-part:\n    - by: ADR-0011\n      what: "the part the engine decides now"')
    com_espelho = "  supersedes-in-part: [ADR-0010]"
    escreve(lado_engine, 11, "supersedes part of a record that stayed in docs", com_espelho)
    linha_da_casa = "| [ADR-0010](ADR-0010-fixture.yaml) | the one that stayed | accepted |\n"
    linha_da_engine = "| [ADR-0011](engine:docs/2-Architecture/adr/ADR-0011-fixture.yaml) | went home | accepted |\n"
    indice_docs = os.path.join(lado_docs, "README.md")
    with open(indice_docs, "w", encoding="utf-8") as fh:
        fh.write("| ADR | Decision | Status |\n|---|---|---|\n" + linha_da_casa)

    # 🔴 [Boundary] with no row and no root, the other half is NOWHERE, and that fails — it never becomes «not
    # checked», or a mistyped number in `by:` would live inside the message that says all is well.
    codigo, saida = corre(lado_docs)
    exige(codigo != 0 and "ADR-0011, which does not exist" in saida,
          f"a pair whose other half no tree answers for passed; it exited {codigo}. Output:\n{saida}")

    # 🎯 [Zero] with the row and WITHOUT the engine's root: green, and the pair is COUNTED and said.
    with open(indice_docs, "w", encoding="utf-8") as fh:
        fh.write("| ADR | Decision | Status |\n|---|---|---|\n" + linha_da_casa + linha_da_engine)
    codigo, saida = corre(lado_docs)
    exige(codigo == 0, f"the pair across trees should be sound without the root; it exited {codigo}. Output:\n{saida}")
    exige("supersession pointers into `engine` NOT checked" in saida,
          f"the pair was not checked and the validator kept quiet. Output:\n{saida}")

    # [Right] WITH the engine's root: the other half is READ, the pair is checked, and the warning stops.
    codigo, saida = corre(lado_docs, "--repo", f"engine={raiz_engine}")
    exige(codigo == 0 and "supersession pointers" not in saida,
          f"with the engine's root the pair should be checked and quiet; it exited {codigo}. Output:\n{saida}")

    # 🔴 [Inverse] the other half forgets the mirror: with the root in hand, that FAILS, and says on which side.
    os.remove(os.path.join(lado_engine, "ADR-0011-fixture.yaml"))
    escreve(lado_engine, 11, "no longer says what it supersedes")
    codigo, saida = corre(lado_docs, "--repo", f"engine={raiz_engine}")
    exige(codigo != 0 and "ADR-0011 (in `engine:`) does not list ADR-0010" in saida,
          f"a pair missing its mirror in another tree passed; it exited {codigo}. Output:\n{saida}")

if falhas:
    for f in falhas:
        print(f"FAIL {f}")
    print(f"\n{len(falhas)} problem(s)")
    raise SystemExit(1)
print("validator: what is not checked is said, and what is checked fails when it is missing")

# ================================ MUTATIONS CHECKED ================================
# 1. deleting the loop that prints `NOT checked` in `main()` → the [Zero] case fails. It is the whole mutation:
#    without it, the validator says «all sound» without having opened an artefact, and no other case notices.
# 2. counting the unchecked as a PROBLEM instead of skipping it → the [Zero] case fails on the exit code.
#    It would be the other way to get it wrong: a repository that only has records would be red forever, and a
#    gate that can never go green is a gate someone switches off.
# 3. taking `--repo` out of the parser (going back to resolving everything against the `cwd`) → [Right] fails: the
#    qualified paths would stop being found even with the correct root.
# 4. the index sieve looking for `ADR-\d{4}` at any position in the line instead of `^\| \[ADR-\d{4}\]`
#    → [Boundary] fails. It is the mutation that matters most in this block, because it is the REAL shape of the
#    defect: the seven missing records all showed up to a `grep` by number, cited in the prose of other rows,
#    and a sieve like that would have said «everything is indexed» during all seven.
# 5. swapping `os.path.exists(indice)` for `True` → [Vacuum] fails with a traceback instead of skipping.
#    Conversely, fixing it at `False` leaves the whole block green forever — and it is [Right] that catches it.
#
# CITATIONS ACROSS TREES (ADR-0229), 9 of 9 red on 2026-09-23:
# 6. the other declared tree stopping answering → the game's tree, with home declared, fails.
# 7. the «moved» row stopping answering → home's [Zero] fails.
# 8. the tree being validated answering for itself when `--repo` points at it → the 0009 [Boundary] goes green.
# 9. a record with a file at home AND a «moved» row passing → the two-homes [Inverse] fails.
# 10. a wrong label on the «moved» row being COUNTED instead of failing → the label [Boundary] fails.
# 11. the file on the other side not being checked → the missing-file [Inverse] fails.
# 12. silencing the count of moved rows → [Zero] fails. It is mutation 1, one floor down.
# 13. the index failure exiting 0, and 14. no longer printing it → the missing-file [Inverse] fails.
#    The index is not a record and does not enter the «N records» count, but a row that points at nothing is the
#    same lie as a `confirmed-by` pointing at nothing.
#
# A SUPERSESSION PAIR ACROSS TREES (ADR-0242):
# 15. the other declared tree's metadata not being read → [Right] fails: the pair is counted with the root in hand.
# 16. silencing the count of pairs → [Zero] fails. Mutation 1 again, for the pairs.
# 17. a pair with no other half anywhere being COUNTED instead of failing → the pair [Boundary] fails.
# 18. the mirror check skipped for a pair read from another tree → the pair [Inverse] goes green.
