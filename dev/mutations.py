"""Broken variants of each dojo's reference solution, for dev/check.py.

Each mutation applies exact text replacements to reference files and says which level must catch it.
A good dojo has one mutation per mistake the hints talk about: if the mistake slips through every
level, the tests are too weak; if it fails a level with the wrong code, the targeted hint is wrong.

MUTATIONS[dojo][name] = ({file: [(old, new), ...]}, {level: "code" | "fail"})
  "fail" = any failure is fine; "code" = this failure code must be among the reported ones.
"""
MUTATIONS = {
    "mr": {
        "count_no_lock": ({"warmup.go": [("\t\t\tmu.Lock()\n", ""), ("\t\t\tmu.Unlock()\n", ""), ("\tvar mu sync.Mutex\n", "")]}, {1: "race"}),
        "count_serial": ({"warmup.go": [("\t\tgo func(t string) {", "\t\tfunc(t string) {")]}, {1: "not_parallel"}),
        "pool_unbounded": ({"warmup.go": [("make(chan struct{}, n)", "make(chan struct{}, len(jobs)+1)")]}, {2: "pool_too_many"}),
        "no_sleep": ({"worker.go": [("\t\t\ttime.Sleep(100 * time.Millisecond)", "\t\t\t_ = time.Now()")]}, {4: "no_sleep"}),
        "no_barrier": ({"coordinator.go": [("\t\t} else {\n\t\t\treply.Type = WaitTask\n\t\t}\n\t\treturn nil\n\t}\n\tif !allDone(c.reduces)",
                                            "\t\t\treturn nil\n\t\t}\n\t}\n\tif !allDone(c.reduces)")]}, {5: "early_reduce"}),
        "coord_no_lock": ({"coordinator.go": [("func (c *Coordinator) Done() bool {\n\tc.mu.Lock()\n\tdefer c.mu.Unlock()\n", "func (c *Coordinator) Done() bool {\n")]}, {5: "race"}),
        "no_timeout": ({"coordinator.go": [("const useTimeout = true", "const useTimeout = false")]}, {6: "no_reassign"}),
        "non_atomic": ({"worker.go": [("const atomicWrites = true", "const atomicWrites = false")]}, {7: "wrong_output"}),
    },
    "kv": {
        "no_version_check": ({"server.go": [("\tif e.version != args.Version {", "\tif false {")]}, {1: "wrong_version_accepted"}),
        "no_bump": ({"server.go": [("entry{args.Value, e.version + 1}", "entry{args.Value, e.version}")]}, {1: "version_not_bumped"}),
        "server_no_lock": ({"server.go": [("\ts.mu.Lock()\n\tdefer s.mu.Unlock()\n\te, ok := s.data[args.Key]\n\tif !ok && args.Version", "\te, ok := s.data[args.Key]\n\tif !ok && args.Version")]}, {2: "race"}),
        "no_retry": ({"clerk.go": [("\t\tif ck.end.Call(\"Server.Get\", &args, &reply) {\n\t\t\treturn reply.Value, reply.Version, reply.Err\n\t\t}",
                                    "\t\tck.end.Call(\"Server.Get\", &args, &reply)\n\t\treturn reply.Value, reply.Version, reply.Err")]}, {4: "no_retry"}),
        "no_sleep": ({"clerk.go": [("\t\ttime.Sleep(RetryWait)\n\t}\n}\n\n// Put", "\t\t_ = time.Now()\n\t}\n}\n\n// Put")]}, {4: "no_sleep"}),
        "no_maybe": ({"clerk.go": [("if reply.Err == ErrVersion && retried {", "if false && retried {")]}, {5: "maybe_missing"}),
        "maybe_always": ({"clerk.go": [("if reply.Err == ErrVersion && retried {", "if reply.Err == ErrVersion && (retried || true) {")]}, {5: "maybe_too_eager"}),
        "maybe_on_ok": ({"clerk.go": [("if reply.Err == ErrVersion && retried {", "if retried {")]}, {5: "maybe_on_ok"}),
        "retried_sticky": ({"clerk.go": [("type Clerk struct {\n\tend Caller\n}", "type Clerk struct {\n\tend     Caller\n\tretried bool\n}"),
                                          ("\tretried := false\n", ""), ("&& retried {", "&& ck.retried {"), ("\t\tretried = true\n", "\t\tck.retried = true\n")]}, {5: "maybe_sticky"}),
        "lock_blind_put": ({"lock.go": [("\t\tif value == \"\" {\n", "\t\tif true {\n")]}, {6: "two_holders"}),
        "lock_maybe_fails": ({"lock.go": [("\t\tif value == lk.id {\n\t\t\treturn // an earlier Put of ours landed (its reply was lost)\n\t\t}\n", "")]}, {7: "maybe_lockout"}),
    },
}
