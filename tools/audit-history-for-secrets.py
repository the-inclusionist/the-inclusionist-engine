#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sweeps the WHOLE history for secrets and personal data, before the repository goes public.

    python tools/audit-history-for-secrets.py            # every local ref
    python tools/audit-history-for-secrets.py --ref main # one ref only

ADR-0066 §3 lists this as a condition for any repository going public, and says why: on
2026-09-04 FILE NAMES and absolute paths were checked, and the CONTENT was not.

⚠️ WHAT THIS SWEEP IS AND WHAT IT IS NOT. It reads the PATCH of every commit — what went in and
what came out — and matches known expressions. That catches whatever has a recognisable shape:
an API key, a private key, a CPF, a CNPJ, a phone number, an absolute path. **It does not catch a
shapeless secret** (a password that looks like any word), nor personal data in prose ("the pupil
João, 3rd grade"). A clean result here is NOT proof that there is nothing; it is proof that there
is nothing WITH THESE SHAPES. Saying so is part of the result.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections import defaultdict

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Each rule: (name, regex, severity). HIGH = treated as a leak until proven otherwise.
REGRAS: list[tuple[str, re.Pattern[str], str]] = [
    ("private key",          re.compile(r"BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY"), "HIGH"),
    ("GitHub token",         re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b"), "HIGH"),
    ("GitHub token (new)",   re.compile(r"\bgithub_pat_[A-Za-z0-9_]{22,}\b"), "HIGH"),
    ("GitLab token",         re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}\b"), "HIGH"),
    ("AWS key",              re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "HIGH"),
    ("Google key",           re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"), "HIGH"),
    ("OpenAI-style key",     re.compile(r"\bsk-[A-Za-z0-9]{32,}\b"), "HIGH"),
    ("Slack token",          re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"), "HIGH"),
    ("Cloudflare token",     re.compile(r"CLOUDFLARE_API_TOKEN\s*[:=]\s*[\"']?[A-Za-z0-9_-]{20,}"), "HIGH"),
    ("assigned secret",      re.compile(r"(?i)\b(?:password|senha|secret|api[_-]?key|access[_-]?token)"
                                        r"\s*[:=]\s*[\"'][^\"'\s]{8,}[\"']"), "HIGH"),
    ("CPF",                  re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b"), "HIGH"),
    ("CNPJ",                 re.compile(r"\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b"), "MEDIUM"),
    ("BR phone number",      re.compile(r"\(\d{2}\)\s?9?\d{4}[- ]?\d{4}\b"), "MEDIUM"),
    ("absolute path",        re.compile(r"[A-Za-z]:\\\\?(?:Users|Dropbox|Documents)\\\\?"), "LOW"),
    ("e-mail",               re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "LOW"),
]

# E-mails that are the project's own and are not a finding. Everything else is reported.
EMAILS_CONHECIDOS = re.compile(
    r"(?:noreply@anthropic\.com|jrocha\.developer@gmail\.com|@users\.noreply\.(?:github|gitlab)\.com"
    r"|jrocha-dev|example\.com|localhost)")

# Lines that are almost always noise in a lockfile and a phoneme dictionary.
RUIDO = re.compile(r"^[-+]\s*(?:\"integrity\"|\"resolved\"|sha512-|sha1-)")


def varrer(ref: str | None) -> dict[str, list[tuple[str, str, str]]]:
    cmd = ["git", "log", "-p", "--no-color", "--no-merges",
           "--format=%x00COMMIT%x00%H%x00%ad%x00%s", "--date=short"]
    cmd.append(ref if ref else "--all")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    achados: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    sha = data = assunto = "?"
    arquivo = "?"
    total_linhas = 0
    assert proc.stdout is not None
    for bruto in proc.stdout:
        linha = bruto.decode("utf-8", errors="replace").rstrip("\n")
        total_linhas += 1
        if linha.startswith("\x00COMMIT\x00"):
            partes = linha.split("\x00")
            if len(partes) >= 5:
                sha, data, assunto = partes[2][:9], partes[3], partes[4][:60]
            continue
        if linha.startswith("+++ b/"):
            arquivo = linha[6:]
            continue
        if not linha.startswith(("+", "-")) or RUIDO.match(linha):
            continue
        for nome, regex, gravidade in REGRAS:
            m = regex.search(linha)
            if not m:
                continue
            trecho = m.group(0)
            if nome == "e-mail" and EMAILS_CONHECIDOS.search(trecho):
                continue
            achados[nome].append((sha, arquivo, trecho[:80]))
    proc.wait()
    print("patch lines read: %d" % total_linhas, file=sys.stderr)
    return achados


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", default=None, help="one ref only (default: --all)")
    ap.add_argument("--por-regra", type=int, default=8, help="how many examples to show per rule")
    args = ap.parse_args()

    achados = varrer(args.ref)
    ordem = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    gravidade_de = {nome: g for nome, _, g in REGRAS}

    print("\n" + "=" * 78)
    print("HISTORY AUDIT —", args.ref or "every local ref")
    print("=" * 78)
    if not achados:
        print("\nNo occurrence of the shapes searched for.")
    for nome in sorted(achados, key=lambda n: (ordem[gravidade_de[n]], -len(achados[n]))):
        ocorrencias = achados[nome]
        commits = {c for c, _, _ in ocorrencias}
        print("\n[%s] %s — %d occurrences in %d commits"
              % (gravidade_de[nome], nome, len(ocorrencias), len(commits)))
        vistos: set[str] = set()
        mostrados = 0
        for sha, arquivo, trecho in ocorrencias:
            chave = arquivo + "|" + trecho
            if chave in vistos:
                continue
            vistos.add(chave)
            print("    %s  %-46s %s" % (sha, arquivo[-46:], trecho))
            mostrados += 1
            if mostrados >= args.por_regra:
                restante = len(vistos) - mostrados
                if restante > 0:
                    print("    … and %d more distinct" % restante)
                break

    print("\n" + "-" * 78)
    print("⚠️  THE LIMIT OF THIS SWEEP: it matches known SHAPES. It does not catch a shapeless secret")
    print("    (a password that looks like a common word) nor personal data in prose. Clean here")
    print("    means `nothing with these shapes`, not `nothing`.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
