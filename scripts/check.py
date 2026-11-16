"""Site checks run by CI on every push and pull request.

1. Every page listed in assets/app.js (DOCS) has a markdown file in content/.
2. Every [label](cmd:...) link in the markdown points to a command that exists.
3. No private details (phone number, home address, personal email) slipped in.

Run locally:  python3 scripts/check.py
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
app = (ROOT / "assets" / "app.js").read_text(encoding="utf-8")
errors = []

# 1. DOCS paths exist
docs = re.findall(r"path:\s*'([^']+\.md)'", app)
for path in docs:
    if not (ROOT / "content" / path).is_file():
        errors.append(f"missing content file: content/{path}")

# 2. cmd: links point to real commands
known = set(re.findall(r"cmd:\s*'(/[^']+)'", app))
shell = {"ls", "cat", "whoami", "pwd", "help"}
for md in (ROOT / "content").rglob("*.md"):
    for target in re.findall(r"\]\(cmd:([^)]+)\)", md.read_text(encoding="utf-8")):
        if target not in known and target.split()[0] not in shell:
            errors.append(f"{md.relative_to(ROOT)}: unknown command link '{target}'")

# 3. no private details in published files
PRIVATE = [
    r"\+?63\s?9\d{2}\s?\d{3}\s?\d{4}",   # PH mobile number
    r"\b09\d{9}\b",
    r"\bbacoor\b",
    r"@gmail\.com",
]
for f in ROOT.rglob("*"):
    if f.is_file() and f.suffix in {".md", ".html", ".js", ".css"} and ".git" not in f.parts and f.name != "check.py":
        text = f.read_text(encoding="utf-8", errors="ignore")
        for pat in PRIVATE:
            if re.search(pat, text, re.IGNORECASE):
                errors.append(f"{f.relative_to(ROOT)}: looks like private info ({pat})")

if errors:
    print("Site check failed:")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print(f"Site check passed: {len(docs)} pages, {len(known)} commands, no private details.")
