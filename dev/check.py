"""Check every dojo's tests: the reference passes every level, the starter passes none,
and each broken variant (dev/mutations.py) fails at the level that teaches the fix.

    python3 dev/check.py              # all dojos; needs `go` on PATH
    python3 dev/check.py warmup       # one dojo
"""
import json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, "course", "testdata")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mutations import MUTATIONS


def levels(dojo):
    ns = [int(m.group(1)) for f in os.listdir(os.path.join(C, "dojos", dojo, "tests")) if (m := re.match(r"dojo_lv(\d+)_test\.go$", f))]
    return range(1, max(ns) + 1)


def setup(ws, dojo, files):
    shutil.rmtree(ws, ignore_errors=True)
    os.makedirs(os.path.join(ws, dojo))
    for pkg in os.listdir(os.path.join(C, "shared")):
        shutil.copytree(os.path.join(C, "shared", pkg), os.path.join(ws, pkg))
    open(os.path.join(ws, "go.mod"), "w").write("module lab\n\ngo 1.22\n")
    starter = os.path.join(C, "dojos", dojo, "starter")
    for f in os.listdir(starter):  # files the reference doesn't override (shared types, rpc definitions)
        shutil.copy(os.path.join(starter, f), os.path.join(ws, dojo, f))
    for f, src in files.items():
        open(os.path.join(ws, dojo, f), "w").write(src)
    tests = os.path.join(C, "dojos", dojo, "tests")
    for f in os.listdir(tests):
        shutil.copy(os.path.join(tests, f), os.path.join(ws, dojo, f))


def run_level(ws, dojo, lv):
    p = subprocess.run(["go", "test", "-race", "-count=1", "-json", "-timeout", "120s", "-run", f"^TestLv{lv}_", f"./{dojo}/"],
                       cwd=ws, capture_output=True, text=True)
    codes, out = [], []
    for line in p.stdout.splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        o = e.get("Output", "")
        out.append(o)
        if "DOJO_FAIL " in o:
            codes.append(json.loads(o.split("DOJO_FAIL ", 1)[1])["code"])
    text = "".join(out) + p.stderr
    if "WARNING: DATA RACE" in text:
        codes.append("race")
    if "concurrent map" in text:
        codes.append("concurrent_map")
    if p.returncode and not codes:
        codes.append("build" if "[build failed]" in text or p.stderr.strip() else "fail")
    return "ok" if p.returncode == 0 else ",".join(sorted(set(codes)))


def read_dir(d):
    return {f: open(os.path.join(d, f)).read() for f in os.listdir(d)}


def variant(dojo, repl):
    files = read_dir(os.path.join(C, "dojos", dojo, "reference"))
    for f, pairs in repl.items():
        for a, b in pairs:
            assert a in files[f], f"{dojo}/{f}: mutation text not found: {a!r}"
            files[f] = files[f].replace(a, b)
    return files


if __name__ == "__main__":
    only = sys.argv[1:]
    tmp = tempfile.mkdtemp(prefix="dojo-check-")
    bad = 0
    for dojo in sorted(os.listdir(os.path.join(C, "dojos"))):
        if only and dojo not in only:
            continue
        lvs = levels(dojo)
        cases = {"reference": (variant(dojo, {}), {lv: "ok" for lv in lvs}),
                 "starter": (read_dir(os.path.join(C, "dojos", dojo, "starter")), {lv: "fail" for lv in lvs})}
        for name, (repl, expect) in MUTATIONS.get(dojo, {}).items():
            cases[name] = (variant(dojo, repl), expect)
        for name, (files, expect) in cases.items():
            ws = os.path.join(tmp, dojo, name)
            setup(ws, dojo, files)
            got = {lv: run_level(ws, dojo, lv) for lv in lvs}
            miss = [lv for lv, want in expect.items()
                    if (want == "ok" and got[lv] != "ok") or (want == "fail" and got[lv] == "ok")
                    or (want not in ("ok", "fail") and want not in got[lv].split(","))]
            bad += bool(miss)
            print(f"{'✗' if miss else '✓'} {dojo:10s} {name:16s}", " ".join(f"L{lv}:{got[lv]}" for lv in lvs),
                  f"  expected {', '.join(f'L{lv}:{expect[lv]}' for lv in miss)}" if miss else "", flush=True)
    shutil.rmtree(tmp, ignore_errors=True)
    sys.exit(1 if bad else 0)
