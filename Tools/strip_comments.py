import ast
import io
import sys
import tokenize
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CHECK = "--check" in sys.argv


def strip_py(src):
    tree = ast.parse(src)
    lines = src.splitlines(keepends=True)
    drop = set()

    def mark(node):
        body = getattr(node, "body", [])
        if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
            if isinstance(body[0].value.value, str):
                for ln in range(body[0].lineno, body[0].end_lineno + 1):
                    drop.add(ln)

    mark(tree)
    for n in ast.walk(tree):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            mark(n)

    kept = [l for i, l in enumerate(lines, 1) if i not in drop]
    src = "".join(kept)

    cols = {}
    for tok in tokenize.generate_tokens(io.StringIO(src).readline):
        if tok.type == tokenize.COMMENT:
            cols[tok.start[0]] = tok.start[1]
    lines = src.splitlines(keepends=True)
    for ln, col in cols.items():
        line = lines[ln - 1]
        lines[ln - 1] = line[:col].rstrip() + ("\n" if line.endswith("\n") else "")
    out = "".join(lines)
    out = "\n".join(l.rstrip() for l in out.split("\n"))
    while "\n\n\n" in out:
        out = out.replace("\n\n\n", "\n\n")
    return out.lstrip("\n")


def has_comments(src):
    tree = ast.parse(src)
    nodes = [tree]
    for n in ast.walk(tree):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            nodes.append(n)
    for node in nodes:
        body = getattr(node, "body", [])
        if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant):
            if isinstance(body[0].value.value, str):
                return True
    for tok in tokenize.generate_tokens(io.StringIO(src).readline):
        if tok.type == tokenize.COMMENT:
            return True
    return False


dirty = 0
files = 0
for p in sorted(ROOT.glob("*.py")):
    if p.name.startswith("strip_comments"):
        continue
    files += 1
    src = p.read_text(encoding="utf-8")
    try:
        if not has_comments(src):
            continue
    except SyntaxError as e:
        print(f"skip (syntax): {p.name} {e}")
        continue
    dirty += 1
    if CHECK:
        print("comment: " + p.name)
        continue
    new = strip_py(src)
    try:
        ast.parse(new)
    except SyntaxError as e:
        print(f"skip (would break): {p.name} {e}")
        continue
    p.write_text(new, encoding="utf-8")
    print("stripped: " + p.name)

if CHECK:
    print("clean" if dirty == 0 else f"dirty: {dirty}/{files} files")
    sys.exit(0 if dirty == 0 else 1)
print(f"done: {dirty}/{files} files changed")
