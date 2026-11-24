"""Fail if a publishable git tree contains credential files or common secret formats."""
from pathlib import PurePosixPath
import re
import subprocess
import sys

def git(*args):
    return subprocess.check_output(["git", *args])

patterns = [
    rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
    rb"(?:gh[pousr]_|github_pat_|gsk_|sk-or-v1-|sk-proj-|nvapi-|csk-)[A-Za-z0-9_-]{18,}",
    rb"AIza[0-9A-Za-z_-]{35}", rb"AKIA[A-Z0-9]{16}",
    rb"(?:postgres(?:ql)?|https?)://[^\s/:]+:[^\s/@]+@",
    rb"(?im)^\s*(?:ENCRYPTION_SECRET|AUTH_SECRET|GOOGLE_CLIENT_SECRET|API_KEY|ACCESS_TOKEN)\s*=\s*[\"']?[A-Za-z0-9_/-]{20,}",
]
seen = set()
problems = []
for commit in git("rev-list", "--all").splitlines():
    for entry in git("ls-tree", "-r", "-z", commit.decode()).split(b"\0"):
        if not entry:
            continue
        meta, rawname = entry.split(b"\t", 1)
        name = rawname.decode()
        oid = meta.split()[-1]
        if (name, oid) in seen:
            continue
        seen.add((name, oid))
        base = PurePosixPath(name).name
        forbidden = (base.startswith(".env") and base != ".env.example") or base.endswith((".pem", ".key", ".db"))
        if forbidden or any(re.search(p, blob) for blob in [git("cat-file", "blob", oid.decode())] for p in patterns):
            problems.append(name)
if problems:
    sys.exit("Review flagged paths before publishing: " + ", ".join(sorted(set(problems))))
print("Checked", len(seen), "unique file versions across all refs.")
