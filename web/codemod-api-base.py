#!/usr/bin/env python3
"""Codemod: wrap relative /api/* fetch URLs with apiUrl() (VITE_API_URL base).

Phase A: fetch("/api/...") / fetch('/api/...') / fetch(`/api/...`) -> fetch(apiUrl(...))
Phase B: const NAME = "/api/..." / `/api/...` (URL constants) -> const NAME = apiUrl("...")
         Only for names that look like API URL holders.
Adds `import { apiUrl } from "@/lib/apiBase";` to modified files (after the last
import, or at the top if there are none).

Usage: python3 codemod-api-base.py [--apply]   (default = dry run, prints changes)
"""
import re
import sys
from pathlib import Path

SRC = Path("/home/hatch/workspace/og-scan-render/web/src")
IMPORT_LINE = 'import { apiUrl } from "@/lib/apiBase";'

# Phase A: fetch( <quote>/api/...<quote>  — capture quote + body, keep the rest.
FETCH_RE = re.compile(
    r"""fetch\(\s*(?P<q>["'`])(?P<url>/api/.*?)(?P=q)""",
    re.DOTALL,
)
# Phase B: const|let|var NAME = <quote>/api/...<quote>
NAME_RE = re.compile(
    r"""(?P<kw>(?:const|let|var)\s+)(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?P<q>["'`])(?P<url>/api/.*?)(?P=q)""",
    re.DOTALL,
)
NAME_HINT = re.compile(r"API|BACKEND|PATH|URL|BASE|ENDPOINT|FEED|HUB|COMMAND|EXPORT|ROUTE|CLAIM|EXPIRE|CANCEL", re.I)
IMPORT_RE = re.compile(r"^import\s.+from\s+[\"'][^\"']+[\"'];?\s*$", re.M)


def already_wrapped(text, idx):
    """True if the match at idx is already inside apiUrl( ... )."""
    before = text[max(0, idx - 12):idx]
    return "apiUrl(" in before


def process_file(path, apply):
    text = path.read_text()
    orig = text
    changes = []

    def fetch_sub(m):
        if already_wrapped(text, m.start()):
            return m.group(0)
        q, url = m.group("q"), m.group("url")
        changes.append(f"fetch {q}{url[:50]}")
        return f"fetch(apiUrl({q}{url}{q})"

    def name_sub(m):
        if already_wrapped(text, m.start()):
            return m.group(0)
        if not NAME_HINT.search(m.group("name")):
            return m.group(0)
        q, url = m.group("q"), m.group("url")
        changes.append(f"{m.group('name')} = {q}{url[:50]}")
        return f"{m.group('kw')}{m.group('name')} = apiUrl({q}{url}{q})"

    text = FETCH_RE.sub(fetch_sub, text)
    text = NAME_RE.sub(name_sub, text)
    if text == orig or not changes:
        return None
    # Add the import if not already present.
    if "apiUrl" not in orig or "@//lib/apiBase" not in orig and 'from "@/lib/apiBase"' not in orig:
        if 'from "@/lib/apiBase"' not in text and "lib/apiBase" not in text:
            imports = list(IMPORT_RE.finditer(text))
            if imports:
                end = imports[-1].end()
                text = text[:end] + "\n" + IMPORT_LINE + text[end:]
            else:
                text = IMPORT_LINE + "\n" + text
    if apply:
        path.write_text(text)
    return changes


def main():
    apply = "--apply" in sys.argv
    files = sorted(SRC.rglob("*.ts")) + sorted(SRC.rglob("*.tsx"))
    # Skip the helper itself and test files that only test the helper.
    files = [f for f in files if f.name != "apiBase.ts"]
    total_files = 0
    total_changes = 0
    for f in files:
        try:
            ch = process_file(f, apply)
        except Exception as e:
            print(f"ERROR {f}: {e}")
            continue
        if ch:
            total_files += 1
            total_changes += len(ch)
            print(f"{f.relative_to(SRC)}: {len(ch)} change(s)")
            for c in ch[:6]:
                print(f"    {c}")
    print(f"\n{'APPLIED' if apply else 'DRY RUN'}: {total_files} files, {total_changes} changes")


if __name__ == "__main__":
    main()
