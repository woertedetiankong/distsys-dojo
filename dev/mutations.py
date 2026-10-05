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
}
