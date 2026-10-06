# Distributed Systems Dojo

[中文](README.md) | English

Write Go in your browser and build MapReduce and a versioned key/value server one level at a time. Your code lives in real files on your computer, and the tests run with the real `go test -race`. Inspired by Lab 1 and Lab 2 of MIT 6.5840 (6.824) Distributed Systems; the exercises, tests and code are original.

## Getting started

1. Install Go 1.22 or newer: <https://go.dev/dl/> (on macOS, `brew install go` works too)
2. Download and run:

   ```bash
   git clone https://github.com/woertedetiankong/distsys-dojo.git
   cd distsys-dojo
   go run .
   ```

3. Open the link printed in the terminal (the browser opens automatically) to reach the **course home**.

The site has a Chinese and an English mode; switch with "中 / EN" in the top-right corner. The course home, the dojo and the lab pages share the setting, which defaults to your browser's language.

The course home is organized by episode, and each episode goes in order: read the paper or lecture notes → play with the lab page → code it in the dojo → do the real MIT lab (explainer videos will be added later). Paper and lab links point to the MIT course site, and your progress is saved in the browser.

In the dojo your code is in `workspace/<dojo>/` (`workspace/mr/` for MapReduce). Edit it in the page or open the folder in VS Code; the two stay in sync.

### Videos and lab pages

Lab pages live in `content/<episode>/`, and the runner serves them under `/content/`. The explainer videos are not public yet, so the course home has no "watch the video" step; once published, a video goes in `content/epNN/video.mp4` and the home page shows it automatically. (After making a new episode, the author copies the finished files in with `python3 dev/sync_content.py`.)

## Dojos

### MapReduce (`mr`, episode 1)

| Level | Topic | What you practice |
|---|---|---|
| 1 | goroutines, WaitGroup, Mutex | concurrency basics, the `-race` detector |
| 2 | channels and worker pools | limiting concurrency |
| 3 | Map, Reduce, partitioning | `ihash(key) % nReduce` |
| 4 | Worker | the RPC protocol, intermediate files |
| 5 | Coordinator | task states, no Reduce before every Map is done, locking |
| 6 | Reassign on timeout | a crashed worker tells no one |
| 7 | Atomic writes | slow machines cause duplicate runs; WriteTemp + Rename fixes it |

From level 4 on, your code runs in a simulated cluster: workers are real goroutines, while the network and the file system are simulated by the tests, which can crash or slow down a worker, the same idea as MIT's labrpc. To keep the tests fast, the timeout is 2 seconds (10 seconds in the real Lab 1).

### KV server (`kv`, episode 2)

| Level | Topic | What you practice |
|---|---|---|
| 1 | Get and Put with versions | write only when the version matches, then add one |
| 2 | Requests that arrive together | locking the handlers, `-race` |
| 3 | Clerk | turning calls into RPCs |
| 4 | Retries | messages get lost; sleep, then resend |
| 5 | ErrMaybe | a resent Put that is refused may already have run |
| 6 | A lock made from Put | write your id only when the lock is free |
| 7 | A lock on an unreliable network | after ErrMaybe, read back and check |

The tests run on the simulated network in `course/testdata/shared/netsim/`: it can drop messages at random, or drop exactly a given client's nth request or reply, the same idea as MIT's labrpc.

## Safety

The runner compiles and runs code on your computer, so it:

- listens only on this machine (127.0.0.1);
- makes a random token at each start that every web request must carry, so other websites cannot call the runner;
- checks Host and Origin to block DNS rebinding attacks.

## Layout

| Path | Contents |
|---|---|
| `main.go` | The local runner: serves the pages, reads and writes your code files, runs the tests |
| `web/js/course.js` | Course data: each episode's steps, links and dojo |
| `web/js/course.en.js` | English text for the course data, overlaid on course.js by id |
| `web/js/i18n.js` | Chinese/English switching: `L(zh, en)`, English overlays, `data-en` static text |
| `web/index.html`, `web/js/hub.js` | The course home: each episode's steps and the course map |
| `web/dojo.html`, `web/js/app.js` | The dojo editor (`dojo.html?d=mr`) |
| `web/js/dojos/<dojo>.js` | Level explanations, layered hints, hints for each failure cause |
| `web/js/dojos/<dojo>.en.js` | The same in English, overlaid by level number |
| `content/` | Each episode's video, chapters and lab page |
| `dev/sync_content.py` | Copies finished videos and lab pages into `content/` |
| `course/testdata/shared/dojo/` | The MapReduce simulated cluster (copied to `workspace/dojo/`) |
| `course/testdata/shared/netsim/` | The KV dojo's simulated network (copied to `workspace/netsim/`) |
| `course/testdata/dojos/<dojo>/starter/` | Starting code |
| `course/testdata/dojos/<dojo>/tests/` | Tests for each level (copied into `workspace/<dojo>/` before every run) |
| `course/testdata/dojos/<dojo>/reference/` | Reference solutions, **spoilers**; look only when you're done |
| `dev/check.py`, `dev/mutations.py` | Checks the tests: the reference passes everything, the starter passes nothing, and typical mistakes are caught by the right level |

Test failure messages carry both languages (`msg` and `msg_en`, made with `say(中文, English, args...)` in the test helpers), and the page shows the one for the current mode.

`python3 dev/check.py` needs `go` on your PATH and takes about 5 minutes for everything.

## Academic integrity

This project helps you understand the ideas and practice Go concurrency; it does not provide answers to the MIT labs. If you are taking the course, follow its collaboration policy and do the labs on your own.

## License

MIT
