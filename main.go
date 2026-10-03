// Go 练功房：本地运行器。
//
// It serves the web UI on 127.0.0.1, keeps your code as real files in a
// workspace folder, and runs `go test -race` on them when you press Run.
//
//	go run .                 # then open the printed link
//	go run . -workspace ~/my-lab -addr 127.0.0.1:9000
package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

//go:embed web
var webFS embed.FS

//go:embed all:course/testdata
var courseFS embed.FS

var (
	addr      = flag.String("addr", "127.0.0.1:7878", "监听地址（只允许本机）")
	workspace = flag.String("workspace", "workspace", "你的代码所在的目录")
	openFlag  = flag.Bool("open", true, "启动后自动打开浏览器")
	contentF  = flag.String("content", "content", "视频、实验台等课程内容所在的目录")
)

var (
	token    string
	wsDir    string
	goBin    string
	goVer    string
	raceOK   bool
	runMu    sync.Mutex
	nameRe   = regexp.MustCompile(`^[a-z][a-z0-9_]*\.go$`)
	buildErr = regexp.MustCompile(`^(?:\./|mr/)?([A-Za-z0-9_]+\.go):(\d+):(\d+): (.*)$`)
)

func main() {
	flag.Parse()
	host, _, err := net.SplitHostPort(*addr)
	if err != nil || !(host == "127.0.0.1" || host == "localhost" || host == "::1") {
		log.Fatal("为了安全，练功房只能监听本机地址，例如 127.0.0.1:7878")
	}
	if goBin, err = exec.LookPath("go"); err != nil {
		log.Fatal("没有找到 go 命令。请先安装 Go 1.22 或更新的版本：https://go.dev/dl/")
	}
	out, _ := exec.Command(goBin, "version").Output()
	goVer = strings.TrimSpace(strings.TrimPrefix(string(out), "go version "))
	if wsDir, err = filepath.Abs(*workspace); err != nil {
		log.Fatal(err)
	}
	if err := setupWorkspace(); err != nil {
		log.Fatal("准备代码目录失败：", err)
	}
	raceOK = probeRace()

	b := make([]byte, 16)
	rand.Read(b)
	token = hex.EncodeToString(b)

	web, _ := fs.Sub(webFS, "web")
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.FS(web)))
	contentDir, _ := filepath.Abs(*contentF)
	mux.Handle("/content/", http.StripPrefix("/content/", http.FileServer(http.Dir(contentDir))))
	mux.HandleFunc("/api/info", api(handleInfo))
	mux.HandleFunc("/api/files", api(handleFiles))
	mux.HandleFunc("/api/file", api(handleFile))
	mux.HandleFunc("/api/run", api(handleRun))

	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatal("无法监听 ", *addr, "：", err, "（可以用 -addr 换一个端口）")
	}
	url := fmt.Sprintf("http://%s/?t=%s", ln.Addr().String(), token)
	fmt.Printf("\n  分布式系统练功房已启动\n\n  课程首页：  %s\n  代码目录：  %s\n  Go 版本：   %s%s\n\n  按 Ctrl+C 退出。\n\n", url, filepath.Join(wsDir, "mr"), goVer, map[bool]string{true: "", false: "（未检测到 -race 支持，将不检查数据竞争）"}[raceOK])
	if *openFlag {
		openBrowser(url)
	}
	log.Fatal(http.Serve(ln, mux))
}

// ---------------------------------------------------------------- workspace

func setupWorkspace() error {
	for _, d := range []string{"mr", "dojo"} {
		if err := os.MkdirAll(filepath.Join(wsDir, d), 0o755); err != nil {
			return err
		}
	}
	gomod := filepath.Join(wsDir, "go.mod")
	if _, err := os.Stat(gomod); errors.Is(err, os.ErrNotExist) {
		os.WriteFile(gomod, []byte("module lab\n\ngo 1.22\n"), 0o644)
	}
	// starter code: only written when missing, never overwrites your work
	starters, _ := fs.ReadDir(courseFS, "course/testdata/mr/starter")
	for _, e := range starters {
		dst := filepath.Join(wsDir, "mr", e.Name())
		if _, err := os.Stat(dst); errors.Is(err, os.ErrNotExist) {
			data, _ := courseFS.ReadFile("course/testdata/mr/starter/" + e.Name())
			if err := os.WriteFile(dst, data, 0o644); err != nil {
				return err
			}
		}
	}
	return refreshHarness()
}

// refreshHarness rewrites the simulator package and the tests, which are not yours to edit.
func refreshHarness() error {
	copyDir := func(src, dst string) error {
		ents, err := fs.ReadDir(courseFS, src)
		if err != nil {
			return err
		}
		for _, e := range ents {
			data, _ := courseFS.ReadFile(src + "/" + e.Name())
			if err := os.WriteFile(filepath.Join(dst, e.Name()), data, 0o644); err != nil {
				return err
			}
		}
		return nil
	}
	if err := copyDir("course/testdata/dojo", filepath.Join(wsDir, "dojo")); err != nil {
		return err
	}
	return copyDir("course/testdata/mr/tests", filepath.Join(wsDir, "mr"))
}

func probeRace() bool {
	cmd := exec.Command(goBin, "env", "CGO_ENABLED")
	out, _ := cmd.Output()
	return strings.TrimSpace(string(out)) == "1"
}

// ---------------------------------------------------------------- HTTP

func api(h func(http.ResponseWriter, *http.Request)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		host, port, _ := net.SplitHostPort(r.Host)
		_, myPort, _ := net.SplitHostPort(*addr)
		if !(host == "127.0.0.1" || host == "localhost" || host == "::1") || port != myPort {
			http.Error(w, "forbidden host", http.StatusForbidden)
			return
		}
		if o := r.Header.Get("Origin"); o != "" && o != "http://"+r.Host {
			http.Error(w, "forbidden origin", http.StatusForbidden)
			return
		}
		if r.Header.Get("X-Dojo-Token") != token {
			http.Error(w, "missing or wrong token", http.StatusUnauthorized)
			return
		}
		h(w, r)
	}
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(v)
}

func handleInfo(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]interface{}{"go": goVer, "race": raceOK, "workspace": filepath.Join(wsDir, "mr")})
}

type fileInfo struct {
	Name    string `json:"name"`
	Content string `json:"content"`
	Mtime   int64  `json:"mtime"`
}

func userFiles() ([]fileInfo, error) {
	ents, err := os.ReadDir(filepath.Join(wsDir, "mr"))
	if err != nil {
		return nil, err
	}
	var out []fileInfo
	for _, e := range ents {
		n := e.Name()
		if e.IsDir() || !nameRe.MatchString(n) || strings.HasSuffix(n, "_test.go") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(wsDir, "mr", n))
		if err != nil {
			continue
		}
		st, _ := e.Info()
		out = append(out, fileInfo{n, string(data), st.ModTime().UnixMilli()})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

func handleFiles(w http.ResponseWriter, r *http.Request) {
	files, err := userFiles()
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	writeJSON(w, files)
}

func handleFile(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if r.Method != http.MethodPut || !nameRe.MatchString(name) || strings.HasSuffix(name, "_test.go") {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	p := filepath.Join(wsDir, "mr", name)
	if err := os.WriteFile(p, data, 0o644); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	st, _ := os.Stat(p)
	writeJSON(w, map[string]int64{"mtime": st.ModTime().UnixMilli()})
}

// ---------------------------------------------------------------- running tests

type buildError struct {
	File string `json:"file"`
	Line int    `json:"line"`
	Col  int    `json:"col"`
	Msg  string `json:"msg"`
}

type testResult struct {
	Name    string                 `json:"name"`
	OK      bool                   `json:"ok"`
	Elapsed float64                `json:"elapsed"`
	Code    string                 `json:"code,omitempty"`
	Msg     string                 `json:"msg,omitempty"`
	Detail  string                 `json:"detail,omitempty"`
	Diff    map[string]interface{} `json:"diff,omitempty"`
	Output  string                 `json:"output,omitempty"`
	Events  json.RawMessage        `json:"events,omitempty"`
	TEnd    float64                `json:"t_end,omitempty"`
}

type runResult struct {
	Level       int          `json:"level"`
	OK          bool         `json:"ok"`
	Race        bool         `json:"race"`
	BuildErrors []buildError `json:"build_errors,omitempty"`
	Fatal       *testResult  `json:"fatal,omitempty"`
	Tests       []testResult `json:"tests"`
	Seconds     float64      `json:"seconds"`
}

type goEvent struct {
	Action  string
	Test    string
	Output  string
	Elapsed float64
}

func handleRun(w http.ResponseWriter, r *http.Request) {
	var req struct{ Level int }
	if r.Method != http.MethodPost || json.NewDecoder(r.Body).Decode(&req) != nil || req.Level < 1 || req.Level > 7 {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if !runMu.TryLock() {
		http.Error(w, "已经有测试在运行", http.StatusConflict)
		return
	}
	defer runMu.Unlock()
	writeJSON(w, runLevel(req.Level))
}

func runLevel(level int) runResult {
	start := time.Now()
	res := runResult{Level: level, Race: raceOK, Tests: []testResult{}}
	if err := refreshHarness(); err != nil {
		res.Fatal = &testResult{Code: "internal", Msg: "准备测试文件失败：" + err.Error()}
		return res
	}
	traceDir, _ := os.MkdirTemp("", "dojo-trace-")
	defer os.RemoveAll(traceDir)

	args := []string{"test", "-count=1", "-json", "-timeout", "90s", "-run", fmt.Sprintf("^TestLv%d_", level), "./mr/"}
	if raceOK {
		args = append([]string{"test", "-race"}, args[1:]...)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, goBin, args...)
	cmd.Dir = wsDir
	cmd.Env = append(os.Environ(), "DOJO_TRACE_DIR="+traceDir, "GOFLAGS=-mod=mod")
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	err := cmd.Run()
	res.Seconds = time.Since(start).Seconds()

	// build errors come on stderr as plain text
	for _, ln := range strings.Split(stderr.String(), "\n") {
		if m := buildErr.FindStringSubmatch(strings.TrimSpace(ln)); m != nil {
			var line, col int
			fmt.Sscan(m[2], &line)
			fmt.Sscan(m[3], &col)
			res.BuildErrors = append(res.BuildErrors, buildError{m[1], line, col, m[4]})
		}
	}

	tests := map[string]*testResult{}
	var order []string
	var pkgOut strings.Builder
	sc := bufio.NewScanner(&stdout)
	sc.Buffer(make([]byte, 1<<20), 1<<24)
	for sc.Scan() {
		var e goEvent
		if json.Unmarshal(sc.Bytes(), &e) != nil {
			continue
		}
		if e.Test == "" {
			if e.Action == "output" {
				pkgOut.WriteString(e.Output)
			}
			continue
		}
		name := strings.SplitN(e.Test, "/", 2)[0]
		t := tests[name]
		if t == nil {
			t = &testResult{Name: name}
			tests[name] = t
			order = append(order, name)
		}
		switch e.Action {
		case "output":
			if !strings.HasPrefix(e.Output, "=== ") && !strings.HasPrefix(e.Output, "--- ") {
				t.Output += e.Output
			}
		case "pass":
			t.OK, t.Elapsed = true, e.Elapsed
		case "fail":
			t.OK, t.Elapsed = false, e.Elapsed
		}
	}
	for _, name := range order {
		t := tests[name]
		classify(t)
		if data, err := os.ReadFile(filepath.Join(traceDir, name+".json")); err == nil {
			var tr struct {
				TEnd   float64         `json:"t_end"`
				Events json.RawMessage `json:"events"`
			}
			if json.Unmarshal(data, &tr) == nil {
				t.Events, t.TEnd = tr.Events, tr.TEnd
			}
		}
		res.Tests = append(res.Tests, *t)
	}
	// a fatal error kills the whole test binary, so it may not belong to any single test
	po := pkgOut.String()
	if strings.Contains(po, "fatal error:") || strings.Contains(po, "panic:") {
		f := &testResult{Output: tail(po, 4000)}
		classify(f)
		res.Fatal = f
	}
	if len(res.BuildErrors) == 0 && len(res.Tests) == 0 && res.Fatal == nil && err != nil {
		res.Fatal = &testResult{Code: "build", Msg: "编译或运行失败。", Detail: tail(stderr.String()+stdout.String(), 4000)}
	}
	if ctx.Err() != nil {
		res.Fatal = &testResult{Code: "timeout", Msg: "测试运行超过 150 秒，已经强行停止。可能有死循环或死锁。"}
	}
	res.OK = err == nil && len(res.Tests) > 0
	return res
}

// classify turns raw test output into a failure code the UI has hints for.
func classify(t *testResult) {
	out := t.Output
	var clean []string
	for _, ln := range strings.Split(out, "\n") {
		if i := strings.Index(ln, "DOJO_FAIL "); i >= 0 {
			var f map[string]interface{}
			if json.Unmarshal([]byte(ln[i+len("DOJO_FAIL "):]), &f) == nil {
				t.Code, _ = f["code"].(string)
				t.Msg, _ = f["msg"].(string)
				if d, ok := f["diff"].(map[string]interface{}); ok {
					t.Diff = d
				}
			}
			continue
		}
		clean = append(clean, ln)
	}
	t.Output = strings.TrimSpace(tail(strings.Join(clean, "\n"), 6000))
	switch {
	case strings.Contains(out, "WARNING: DATA RACE"):
		t.Code, t.Msg = "race", "-race 检测到数据竞争：两个 goroutine 同时访问了同一个变量，而且至少有一个在写。"
		t.Detail = raceReport(out)
	case strings.Contains(out, "concurrent map"):
		t.Code, t.Msg = "concurrent_map", "Go 运行时检测到多个 goroutine 同时写同一个 map，程序直接崩溃了。"
		t.Detail = section(out, "fatal error:", 30)
	case strings.Contains(out, "panic: test timed out"):
		t.Code, t.Msg = "timeout", "测试超时，可能有死锁：比如加了锁忘了解锁，或者在持有锁时等待别的 goroutine。"
	case strings.Contains(out, "panic:") && t.Code == "":
		t.Code, t.Msg = "panic", "代码发生了 panic。"
		t.Detail = section(out, "panic:", 30)
	case !t.OK && t.Code == "":
		t.Code, t.Msg = "fail", "测试失败。"
	}
}

func raceReport(out string) string {
	s := section(out, "WARNING: DATA RACE", 60)
	var keep []string
	for _, ln := range strings.Split(s, "\n") {
		if strings.Contains(ln, "/dojo/") || strings.Contains(ln, "/src/") || strings.Contains(ln, "/runtime/") {
			continue
		}
		if i := strings.Index(ln, "/mr/"); i >= 0 {
			ln = strings.Repeat(" ", len(ln)-len(strings.TrimLeft(ln, " \t"))) + ln[i+4:]
		}
		keep = append(keep, ln)
	}
	return strings.Join(keep, "\n")
}

func section(out, start string, n int) string {
	i := strings.Index(out, start)
	if i < 0 {
		return ""
	}
	ls := strings.Split(out[i:], "\n")
	if len(ls) > n {
		ls = ls[:n]
	}
	return strings.Join(ls, "\n")
}

func tail(s string, n int) string {
	if len(s) > n {
		return "…" + s[len(s)-n:]
	}
	return s
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	cmd.Start()
}
