// 练功房自动生成的测试文件，每次运行都会覆盖，不要修改。
package kv

import (
	"fmt"
	"testing"
	"time"
)

func TestLv4_LostRequest(t *testing.T) {
	e := newEnv(t)
	ck := e.clerk("C1")
	e.srv.Put(&PutArgs{Key: "x", Value: "hello"}, &PutReply{})
	e.net.Drop("C1", "req", 1)
	within(t, 2*time.Second, "no_retry", "第一个请求丢了以后，Clerk 一直没有返回。", func() {
		v, ver, err := ck.Get("x")
		if v != "hello" || ver != 1 || err != OK {
			fail(t, "no_retry", fmt.Sprintf("第一个 Get 请求在网络里丢了。Clerk 应该重发，最终返回 (\"hello\", 1, OK)，你返回了 (%q, %d, %q)：Call 返回 false 时不能直接放弃。", v, ver, err))
		}
	})
}

func TestLv4_LostReply(t *testing.T) {
	e := newEnv(t)
	ck := e.clerk("C1")
	e.srv.Put(&PutArgs{Key: "x", Value: "hello"}, &PutReply{})
	e.net.Drop("C1", "rep", 1)
	e.net.Drop("C1", "rep", 2)
	within(t, 2*time.Second, "no_retry", "回复丢了以后，Clerk 一直没有返回。", func() {
		v, _, err := ck.Get("x")
		if v != "hello" || err != OK {
			fail(t, "no_retry", fmt.Sprintf("前两个回复都丢了，Clerk 应该一直重发，直到拿到 (\"hello\", OK)，你返回了 (%q, %q)。", v, err))
		}
	})
	if n := e.net.Calls("C1"); n != 3 {
		fail(t, "no_retry", fmt.Sprintf("丢了两个回复，应该正好发 3 次 Get，你发了 %d 次。", n))
	}
}

func TestLv4_PutLostRequest(t *testing.T) {
	e := newEnv(t)
	ck := e.clerk("C1")
	e.net.Drop("C1", "req", 1)
	within(t, 2*time.Second, "no_retry", "Put 的请求丢了以后，Clerk 一直没有返回。", func() {
		if err := ck.Put("x", "v", 0); err != OK {
			fail(t, "no_retry", fmt.Sprintf("第一个 Put 请求丢了，服务器根本没收到；重发的那次会成功，应该返回 OK，你返回了 %q。", err))
		}
	})
	if r := sget(e.srv, "x"); r.Value != "v" || r.Version != 1 {
		fail(t, "no_retry", fmt.Sprintf("服务器上 x 应该是 (\"v\", 1)，实际是 (%q, %d)。", r.Value, r.Version))
	}
}

func TestLv4_NoSpin(t *testing.T) {
	e := newEnv(t)
	ck := e.clerk("C1")
	e.srv.Put(&PutArgs{Key: "x", Value: "hello"}, &PutReply{})
	e.net.SetDown(true)
	go func() { time.Sleep(300 * time.Millisecond); e.net.SetDown(false) }()
	within(t, 3*time.Second, "no_retry", "网络恢复后，Clerk 还是没有返回。", func() { ck.Get("x") })
	if n := e.net.Calls("C1"); n > 40 {
		fail(t, "no_sleep", fmt.Sprintf("网络断了 300 毫秒，Clerk 发了 %d 次请求。每次失败后应该先 time.Sleep(RetryWait) 再重发，大约 25 次就够了。", n))
	}
}

func TestLv4_Unreliable(t *testing.T) {
	e := newEnv(t)
	e.net.SetLoss(0.3)
	ck := e.clerk("C1")
	within(t, 10*time.Second, "no_retry", "在 30% 丢包的网络上，Clerk 没能在 10 秒内做完 20 次读写。", func() {
		ck.Put("x", "0", 0)
		for i := 1; i <= 20; i++ {
			_, ver, err := ck.Get("x")
			if err != OK {
				fail(t, "no_retry", fmt.Sprintf("第 %d 次 Get 返回了 %q。网络会丢消息，但 Get 重试到底，总能拿到结果。", i, err))
			}
			ck.Put("x", fmt.Sprint(i), ver)
		}
	})
}
