#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Migrates the GitLab issues to GitHub KEEPING THE NUMBERS.

    python tools/migrate-issues-to-github.py            # dry run: writes nothing
    python tools/migrate-issues-to-github.py --go       # creates for real

The migration has run (the 101 GitLab issues are #1..#101 on GitHub); the script stays as its record.

WHY THE NUMBERS SURVIVE, and why that is fragile
------------------------------------------------
On GitHub, issues and pull requests share ONE counter, which starts at 1 in a new repository.
The GitLab issues here are `iid` 1..N with no gaps. So, created in ascending order in a
repository with no issue and no PR, they get exactly the same numbers — and every `#N`
written in an ADR, in a commit message and in another issue's body keeps pointing at the
right thing.

⚠️ THE FRAGILITY, and it is the reason for the integrity gate below: any PR opened before the
end consumes a number and shifts everything after it, with no warning and no way back. So
this script CHECKS, before each creation, that GitHub's next number is exactly the `iid` it
is about to create. At the first divergence it STOPS — better to stop halfway than to finish
with a numbering that lies.

WHAT DOES NOT CROSS OVER, said up front so it is not discovered later
--------------------------------------------------------------------
  · the original AUTHOR (everything becomes whoever runs the script) — written in the footer;
  · the creation DATE (it becomes the migration's date) — written in the footer;
  · the closed state is reapplied at the end, not at creation;
  · milestones and the board do not come;
  · labels are recreated by name, without the original's colour or description.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time

# The Windows console opens in cp1252, and a title with "↔" brings the print down in the middle of the
# migration — at the worst possible moment. Force UTF-8 on the output before any print.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

GITLAB = "jrocha-dev/inclusionist-engine"
GITHUB = "the-inclusionist/the-inclusionist-engine"
PAUSA = 1.5          # seconds between writes: GitHub has a secondary limit on content creation
PAGINA = 100


def roda(cmd: list[str]) -> str:
    """Runs and returns stdout as UTF-8 text. A process error aborts the script."""
    r = subprocess.run(cmd, capture_output=True)
    saida = r.stdout.decode("utf-8", errors="replace")
    if r.returncode != 0:
        erro = r.stderr.decode("utf-8", errors="replace")
        sys.exit("FAILED: %s\n%s\n%s" % (" ".join(cmd), saida[:800], erro[:800]))
    return saida


def glab_json(caminho: str):
    return json.loads(roda(["glab", "api", caminho]) or "[]")


def gh_json(caminho: str):
    return json.loads(roda(["gh", "api", caminho]) or "[]")


def issues_do_gitlab() -> list[dict]:
    todas: list[dict] = []
    for pagina in range(1, 20):
        lote = glab_json("projects/%s/issues?state=all&per_page=%d&page=%d"
                         % (GITLAB.replace("/", "%2F"), PAGINA, pagina))
        if not lote:
            break
        todas += lote
    return sorted(todas, key=lambda i: i["iid"])


def comentarios(iid: int) -> list[dict]:
    """Humans only: `system: true` are GitLab's automatic notes and are not worth the trip."""
    notas = glab_json("projects/%s/issues/%d/notes?per_page=%d&sort=asc"
                      % (GITLAB.replace("/", "%2F"), iid, PAGINA))
    return [n for n in notas if not n.get("system")]


def numeros_no_github() -> list[int]:
    """EVERY number already used in the repository — issue and PR share the counter.

    ⚠️ `per_page=1&sort=created&direction=desc` is NOT asked on every creation, and the reason is
    measured: on 2026-09-05 the migration stopped at iid 3 saying the next number would be #2,
    with #1 and #2 already created. GitHub's list is EVENTUALLY CONSISTENT — 1.5 s after the
    write it still returned #1 as the most recent. What knows the number at that moment is the
    POST's response, and that is what the loop uses. This sweep runs ONCE, at the start, to
    know where to resume from.
    """
    numeros: list[int] = []
    for pagina in range(1, 30):
        lote = gh_json("repos/%s/issues?state=all&per_page=%d&page=%d" % (GITHUB, PAGINA, pagina))
        if not lote:
            break
        numeros += [i["number"] for i in lote]
    return sorted(numeros)


def rodape(issue: dict) -> str:
    autor = (issue.get("author") or {}).get("name") or (issue.get("author") or {}).get("username") or "?"
    labels = ", ".join(issue.get("labels") or []) or "—"
    return (
        "\n\n---\n"
        "<sub>Migrada do GitLab em %s. Original: `%s#%d` · aberta por **%s** em %s · "
        "estado no GitLab: **%s** · labels: %s · %s</sub>"
        % (time.strftime("%Y-%m-%d"), GITLAB, issue["iid"], autor,
           (issue.get("created_at") or "")[:10], issue.get("state", "?"), labels,
           issue.get("web_url", ""))
    )


def preflight(issues: list[dict], ensaio: bool) -> int:
    """Checks what can be checked and returns the last number already created (0 if none)."""
    iids = [i["iid"] for i in issues]
    faltando = [n for n in range(1, max(iids) + 1) if n not in set(iids)]
    print("GitLab: %d issues, iid %d..%d, gaps: %s"
          % (len(issues), min(iids), max(iids), faltando or "none"))
    if faltando:
        sys.exit("ABORTED: there are gaps in the GitLab numbering; the numbers will NOT match. "
                 "Decide first whether to create filler issues for the gaps.")

    repo = gh_json("repos/%s" % GITHUB)
    if not repo.get("has_issues"):
        sys.exit("ABORTED: issues are disabled in %s." % GITHUB)
    ja = numeros_no_github()
    if not ja:
        print("GitHub: %s has its counter at zero. Will create #%d..#%d."
              % (GITHUB, min(iids), max(iids)))
        feito = 0
    else:
        # Resuming is only safe if what exists is exactly the PREFIX 1..k. Any gap or any number
# above the migration's end means the counter already moved for another reason, and then
# the numbering no longer closes — better to stop than to "fix" it.
        feito = max(ja)
        if ja != list(range(1, feito + 1)):
            sys.exit("ABORTED: the numbers in %s are not the prefix 1..%d (they are %s). "
                     "The counter already moved another way and the numbering will not close."
                     % (GITHUB, feito, ja[:12]))
        if feito >= max(iids):
            print("Nothing to do: #1..#%d already exist." % feito)
            return feito
        print("RESUMING: #1..#%d already exist in %s. Will create #%d..#%d."
              % (feito, GITHUB, feito + 1, max(iids)))
    if ensaio:
        print("\n*** DRY RUN — nothing will be written. Run with --go for real. ***")
    return feito


def garante_labels(issues: list[dict], ensaio: bool) -> None:
    nomes = sorted({l for i in issues for l in (i.get("labels") or [])})
    if not nomes:
        return
    existentes = {l["name"] for l in gh_json("repos/%s/labels?per_page=100" % GITHUB)}
    faltam = [n for n in nomes if n not in existentes]
    print("labels: %d on GitLab, %d to create" % (len(nomes), len(faltam)))
    if ensaio:
        return
    for nome in faltam:
        roda(["gh", "api", "--method", "POST", "repos/%s/labels" % GITHUB,
              "-f", "name=%s" % nome, "-f", "color=ededed"])
        time.sleep(0.4)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--go", action="store_true", help="writes for real (the default is a dry run)")
    ap.add_argument("--sem-comentarios", action="store_true", help="does not bring the comments")
    args = ap.parse_args()
    ensaio = not args.go

    issues = issues_do_gitlab()
    feito = preflight(issues, ensaio)
    garante_labels(issues, ensaio)
    esperado = feito + 1

    fechar: list[int] = []
    for issue in issues:
        iid = issue["iid"]
        if iid <= feito:                      # already migrated in an earlier run
            if issue.get("state") == "closed":
                fechar.append(iid)
            continue

        # ---- the integrity gate, in two halves ----
# BEFORE: the local counter has to be exactly at the iid. It starts at the sweep made at
# the start and then advances by the number the POST returned — which is the only datum
# that suffers no replication lag.
        if esperado != iid:
            sys.exit("STOPPED at iid %d: the next number would be #%d. The numbering diverged — "
                     "someone opened a PR or an issue. Nothing more will be created." % (iid, esperado))

        titulo = issue.get("title") or "(sem título)"
        corpo = (issue.get("description") or "") + rodape(issue)
        print("#%-4d %-9s %s" % (iid, issue.get("state"), titulo[:70]))
        if ensaio:
            esperado = iid + 1          # in a dry run nobody creates, so the counter moves here
            if issue.get("state") == "closed":
                fechar.append(iid)
            continue

        cmd = ["gh", "api", "--method", "POST", "repos/%s/issues" % GITHUB,
               "-f", "title=%s" % titulo, "-f", "body=%s" % corpo]
        for l in issue.get("labels") or []:
            cmd += ["-f", "labels[]=%s" % l]
        criada = json.loads(roda(cmd))
        # AFTER: the other half of the gate, and the one that really rules — the POST's response gives the
# real number. If it is not the iid, stop here, before the next issue inherits the error.
        if criada["number"] != iid:
            sys.exit("STOPPED: GitHub created #%d for iid %d. Nothing more will be created."
                     % (criada["number"], iid))
        esperado = criada["number"] + 1
        time.sleep(PAUSA)

        if not args.sem_comentarios:
            for nota in comentarios(iid):
                autor = (nota.get("author") or {}).get("name") or "?"
                texto = ("<sub>**%s** em %s, no GitLab:</sub>\n\n%s"
                         % (autor, (nota.get("created_at") or "")[:10], nota.get("body") or ""))
                roda(["gh", "api", "--method", "POST",
                      "repos/%s/issues/%d/comments" % (GITHUB, iid), "-f", "body=%s" % texto])
                time.sleep(PAUSA)

        if issue.get("state") == "closed":
            fechar.append(iid)

    # ---- close only at the END: closing during creation does not change the counter, but makes the log unreadable
    print("\nto close: %d" % len(fechar))
    if not ensaio:
        for numero in fechar:
            roda(["gh", "api", "--method", "PATCH", "repos/%s/issues/%d" % (GITHUB, numero),
                  "-f", "state=closed"])
            time.sleep(PAUSA)

    print("\ndone. %d issues, %d closed." % (len(issues), len(fechar)))
    print("Check: gh issue list -R %s --state all --limit 5" % GITHUB)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
