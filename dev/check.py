"""Check the course tests: the reference must pass every level, and each broken
variant must fail at the level that teaches the fix.

    python3 dev/check.py            # needs `go` on PATH
"""
import json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = os.path.join(ROOT, "course", "testdata")
REF = os.path.join(C, "mr", "reference")


def ref(name):
    return open(os.path.join(REF, name)).read()


def variant(**repl):
    files = {f: ref(f) for f in os.listdir(REF)}
    for f, pairs in repl.items():
        for a, b in pairs:
            assert a in files[f + ".go"], (f, a)
            files[f + ".go"] = files[f + ".go"].replace(a, b)
    return files


VARIANTS = {
    "starter": {f: open(os.path.join(C, "mr", "starter", f)).read() for f in ("warmup.go", "mapreduce.go", "worker.go", "coordinator.go")},
    "reference": variant(),
    "count_no_lock": variant(warmup=[("\t\t\tmu.Lock()\n", ""), ("\t\t\tmu.Unlock()\n", ""), ("\tvar mu sync.Mutex\n", "")]),
    "count_serial": variant(warmup=[("\t\tgo func(t string) {", "\t\tfunc(t string) {")]),
    "pool_unbounded": variant(warmup=[("make(chan struct{}, n)", "make(chan struct{}, len(jobs)+1)")]),
    "no_sleep": variant(worker=[("\t\t\ttime.Sleep(100 * time.Millisecond)", "\t\t\t_ = time.Now()")]),
    "no_barrier": variant(coordinator=[("\t\t} else {\n\t\t\treply.Type = WaitTask\n\t\t}\n\t\treturn nil\n\t}\n\tif !allDone(c.reduces)",
                                         "\t\t\treturn nil\n\t\t}\n\t}\n\tif !allDone(c.reduces)")]),
    "coord_no_lock": variant(coordinator=[("func (c *Coordinator) Done() bool {\n\tc.mu.Lock()\n\tdefer c.mu.Unlock()\n", "func (c *Coordinator) Done() bool {\n")]),
    "no_timeout": variant(coordinator=[("const useTimeout = true", "const useTimeout = false")]),
    "non_atomic": variant(worker=[("const atomicWrites = true", "const atomicWrites = false")]),
}


def setup(ws, files):
    shutil.rmtree(ws, ignore_errors=True)
    os.makedirs(os.path.join(ws, "mr"))
    shutil.copytree(os.path.join(C, "dojo"), os.path.join(ws, "dojo"))
    open(os.path.join(ws, "go.mod"), "w").write("module lab\n\ngo 1.22\n")
    for f in ("common.go", "rpc.go"):
        shutil.copy(os.path.join(C, "mr", "starter", f), os.path.join(ws, "mr", f))
    for f, src in files.items():
        open(os.path.join(ws, "mr", f), "w").write(src)
    for f in os.listdir(os.path.join(C, "mr", "tests")):
        shutil.copy(os.path.join(C, "mr", "tests", f), os.path.join(ws, "mr", f))


def run_level(ws, lv):
    p = subprocess.run(["go", "test", "-race", "-count=1", "-json", "-timeout", "120s", "-run", f"^TestLv{lv}_", "./mr/"],
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


if __name__ == "__main__":
    only = sys.argv[1:]
    tmp = tempfile.mkdtemp(prefix="dojo-check-")
    for name, files in VARIANTS.items():
        if only and name not in only:
            continue
        ws = os.path.join(tmp, name)
        setup(ws, files)
        print(f"{name:15s}", " ".join(f"L{lv}:{run_level(ws, lv)}" for lv in range(1, 8)), flush=True)
    shutil.rmtree(tmp, ignore_errors=True)
