// Package dojo is the simulated cluster that the course tests run your code in.
//
// Workers are real goroutines, so locks, data races and scheduling are real.
// The network and the file system are simulated, the same idea as labrpc in
// MIT 6.5840: the tests can crash a worker, slow it down, and watch every RPC.
//
// 这个包由练功房自动生成，每次运行测试都会覆盖，不要修改。
package dojo

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

// Timeout 是协调者判断任务超时的阈值。真实的 Lab 1 用 10 秒，这里缩短为 2 秒，让测试跑得快一些。
const Timeout = 2 * time.Second

const (
	lineDelay = 2 * time.Millisecond // 写一行的耗时
	readDelay = 5 * time.Millisecond // 读一个文件的耗时
	maxCalls  = 3000                 // 单个 worker 的 RPC 次数上限
)

// FS 是 worker 能用的文件系统，对应 Lab 1 里的 os 包。
type FS interface {
	// ReadFile 读取整个文件，对应 os.ReadFile。
	ReadFile(name string) ([]byte, error)
	// WriteFile 先清空文件，再一行一行写入，不是原子的，对应 os.WriteFile。
	WriteFile(name string, data []byte) error
	// WriteTemp 写一个只有自己知道名字的临时文件并返回名字，对应 os.CreateTemp。
	WriteTemp(data []byte) (string, error)
	// Rename 原子地重命名，覆盖已有的同名文件，对应 os.Rename。
	Rename(oldname, newname string) error
}

// Cluster is one simulated run: a coordinator, some workers and a shared file system.
type Cluster struct {
	mu      sync.Mutex
	start   time.Time
	server  interface{}
	dead    map[int]bool
	slow    map[int]float64
	done    map[int]bool
	calls   map[int]int
	files   map[string][]byte
	events  []map[string]interface{}
	rng     *rand.Rand
	tmpSeq  int
	stopped bool

	// OnCall, if set, is called after every successful RPC with the
	// coordinator's copy of the arguments and reply.
	OnCall func(worker int, method string, args, reply interface{})
	spin int
}

func NewCluster(seed int64) *Cluster {
	return &Cluster{start: time.Now(), dead: map[int]bool{}, slow: map[int]float64{}, done: map[int]bool{},
		calls: map[int]int{}, files: map[string][]byte{}, rng: rand.New(rand.NewSource(seed)), spin: -1}
}

// Now returns seconds since the cluster started.
func (c *Cluster) Now() float64 { return time.Since(c.start).Seconds() }

// Ev records a trace event: Ev("assign", "w", 1, "task", "M0").
func (c *Cluster) Ev(kind string, kv ...interface{}) {
	e := map[string]interface{}{"t": float64(int(c.Now()*1000)) / 1000, "k": kind}
	for i := 0; i+1 < len(kv); i += 2 {
		e[kv[i].(string)] = kv[i+1]
	}
	c.mu.Lock()
	if len(c.events) < 4000 {
		c.events = append(c.events, e)
	}
	c.mu.Unlock()
}

func (c *Cluster) SetServer(s interface{}) { c.mu.Lock(); c.server = s; c.mu.Unlock() }
func (c *Cluster) SetSlow(id int, f float64) { c.mu.Lock(); c.slow[id] = f; c.mu.Unlock() }

func (c *Cluster) Put(name string, data []byte) {
	c.mu.Lock()
	c.files[name] = append([]byte(nil), data...)
	c.mu.Unlock()
}

func (c *Cluster) Get(name string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	d, ok := c.files[name]
	return append([]byte(nil), d...), ok
}

// Files lists file names with the given prefix, sorted.
func (c *Cluster) Files(prefix string) []string {
	c.mu.Lock()
	defer c.mu.Unlock()
	var out []string
	for n := range c.files {
		if strings.HasPrefix(n, prefix) {
			out = append(out, n)
		}
	}
	sort.Strings(out)
	return out
}

// Go starts worker id running f in its own goroutine.
func (c *Cluster) Go(id int, f func()) {
	c.mu.Lock()
	c.dead[id], c.done[id] = false, false
	s := c.slow[id]
	c.mu.Unlock()
	if s > 1 {
		c.Ev("spawn", "w", id, "slow", s)
	} else {
		c.Ev("spawn", "w", id)
	}
	go func() {
		defer func() {
			c.mu.Lock()
			dead := c.dead[id]
			c.done[id] = true
			c.mu.Unlock()
			if !dead {
				c.Ev("exit", "w", id)
			}
		}()
		f()
	}()
}

// Crash kills worker id: its next RPC or file operation never returns.
func (c *Cluster) Crash(id int) {
	c.mu.Lock()
	already := c.dead[id] || c.done[id]
	c.dead[id] = true
	c.mu.Unlock()
	if !already {
		c.Ev("crash", "w", id)
	}
}

// Finished reports whether worker id's function has returned (not crashed).
func (c *Cluster) Finished(id int) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.done[id] && !c.dead[id]
}

func (c *Cluster) Alive(id int) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return !c.dead[id] && !c.done[id]
}

// Spinning returns the id of a worker that made far too many RPCs, or -1.
func (c *Cluster) Spinning() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.spin
}

// Shutdown stops every worker at its next RPC or file operation.
func (c *Cluster) Shutdown() {
	c.mu.Lock()
	c.stopped = true
	c.mu.Unlock()
}

func (c *Cluster) check(id int) {
	c.mu.Lock()
	dead := c.dead[id] || c.stopped
	c.mu.Unlock()
	if dead {
		runtime.Goexit()
	}
}

func (c *Cluster) factor(id int) time.Duration {
	c.mu.Lock()
	defer c.mu.Unlock()
	if f := c.slow[id]; f > 1 {
		return time.Duration(f * 1000)
	}
	return 1000
}

func (c *Cluster) netDelay() time.Duration {
	c.mu.Lock()
	defer c.mu.Unlock()
	return time.Duration(500+c.rng.Intn(2500)) * time.Microsecond
}

// WriteTrace saves the trace for the web UI, if DOJO_TRACE_DIR is set.
func (c *Cluster) WriteTrace(test string) {
	dir := os.Getenv("DOJO_TRACE_DIR")
	if dir == "" {
		return
	}
	c.mu.Lock()
	data, _ := json.Marshal(map[string]interface{}{"t_end": c.Now(), "events": c.events})
	c.mu.Unlock()
	os.WriteFile(filepath.Join(dir, strings.ReplaceAll(test, "/", "_")+".json"), data, 0o644)
}

// ---------------------------------------------------------------- RPC

// Client is a worker's connection to the coordinator.
type Client struct {
	c  *Cluster
	id int
}

func (c *Cluster) Client(id int) *Client { return &Client{c: c, id: id} }

// Call sends an RPC to the coordinator, like call() in Lab 1:
//
//	ok := c.Call("Coordinator.GetTask", &args, &reply)
//
// Arguments and reply are copied as if they crossed a network, so only
// exported fields arrive. It returns false if the coordinator is unreachable
// or the handler returned an error.
func (cl *Client) Call(method string, args interface{}, reply interface{}) bool {
	c := cl.c
	c.check(cl.id)
	c.mu.Lock()
	c.calls[cl.id]++
	n, srv := c.calls[cl.id], c.server
	c.mu.Unlock()
	if n > maxCalls {
		c.mu.Lock()
		if c.spin < 0 {
			c.spin = cl.id
		}
		c.mu.Unlock()
		runtime.Goexit()
	}
	time.Sleep(c.netDelay())
	c.check(cl.id)
	if srv == nil {
		return false
	}
	name := method
	if i := strings.LastIndex(method, "."); i >= 0 {
		name = method[i+1:]
	}
	m := reflect.ValueOf(srv).MethodByName(name)
	if !m.IsValid() || m.Type().NumIn() != 2 || m.Type().NumOut() != 1 {
		panic(fmt.Sprintf("dojo: 协调者没有可以通过 RPC 调用的方法 %q（需要 func (c *Coordinator) %s(args *X, reply *Y) error）", method, name))
	}
	a := reflect.New(m.Type().In(0).Elem())
	r := reflect.New(m.Type().In(1).Elem())
	copyVia(args, a.Interface())
	out := m.Call([]reflect.Value{a, r})
	if err, _ := out[0].Interface().(error); err != nil {
		return false
	}
	if c.OnCall != nil {
		c.OnCall(cl.id, method, a.Interface(), r.Interface())
	}
	time.Sleep(c.netDelay())
	c.check(cl.id)
	copyVia(r.Interface(), reply)
	return true
}

func copyVia(from, to interface{}) {
	b, err := json.Marshal(from)
	if err != nil {
		panic(fmt.Sprintf("dojo: RPC 参数无法编码：%v", err))
	}
	v := reflect.ValueOf(to)
	if v.Kind() == reflect.Ptr && !v.IsNil() {
		v.Elem().Set(reflect.Zero(v.Elem().Type()))
	}
	if err := json.Unmarshal(b, to); err != nil {
		panic(fmt.Sprintf("dojo: RPC 回复的类型和参数对不上：%v", err))
	}
}

// ---------------------------------------------------------------- file system

type workerFS struct {
	c  *Cluster
	id int
}

func (c *Cluster) FS(id int) FS { return &workerFS{c: c, id: id} }

func (f *workerFS) ReadFile(name string) ([]byte, error) {
	c := f.c
	c.check(f.id)
	time.Sleep(readDelay * c.factor(f.id) / 1000)
	c.check(f.id)
	c.mu.Lock()
	d, ok := c.files[name]
	d = append([]byte(nil), d...)
	c.mu.Unlock()
	if !ok {
		return nil, fmt.Errorf("open %s: no such file or directory", name)
	}
	c.Ev("read", "w", f.id, "f", name)
	return d, nil
}

func (f *workerFS) write(name string, data []byte, traced bool) {
	c := f.c
	c.mu.Lock()
	c.files[name] = []byte{}
	c.mu.Unlock()
	lines := strings.SplitAfter(string(data), "\n")
	if traced {
		c.Ev("write", "w", f.id, "f", name, "n", len(lines))
	}
	for _, ln := range lines {
		if ln == "" {
			continue
		}
		time.Sleep(lineDelay * c.factor(f.id) / 1000)
		c.check(f.id)
		c.mu.Lock()
		c.files[name] = append(c.files[name], ln...)
		c.mu.Unlock()
	}
	if traced {
		c.Ev("wrote", "w", f.id, "f", name)
	}
}

func (f *workerFS) WriteFile(name string, data []byte) error {
	f.c.check(f.id)
	f.write(name, data, true)
	return nil
}

func (f *workerFS) WriteTemp(data []byte) (string, error) {
	c := f.c
	c.check(f.id)
	c.mu.Lock()
	c.tmpSeq++
	name := fmt.Sprintf("tmp-w%d-%d", f.id, c.tmpSeq)
	c.mu.Unlock()
	f.write(name, data, false)
	return name, nil
}

func (f *workerFS) Rename(oldname, newname string) error {
	c := f.c
	c.check(f.id)
	time.Sleep(time.Millisecond)
	c.check(f.id)
	c.mu.Lock()
	d, ok := c.files[oldname]
	if ok {
		c.files[newname] = d
		delete(c.files, oldname)
	}
	c.mu.Unlock()
	if !ok {
		return fmt.Errorf("rename %s %s: no such file or directory", oldname, newname)
	}
	c.Ev("rename", "w", f.id, "f", newname, "src", oldname)
	return nil
}
