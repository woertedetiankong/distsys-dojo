// 练功房自动生成的测试文件，每次运行都会覆盖，不要修改。
package kv

import (
	"fmt"
	"testing"
	"time"
)

func TestLv3_GetPut(t *testing.T) {
	e := newEnv(t)
	ck := e.clerk("C1")
	within(t, 2*time.Second, "clerk_hang", "Clerk 在可靠的网络上没有返回。是不是一直在循环？", func() {
		if err := ck.Put("x", "hello", 0); err != OK {
			fail(t, "clerk_put", fmt.Sprintf("通过 Clerk 新建键 x，应该返回 OK，你返回了 %q。检查 Put 是否调用了 \"Server.Put\"，并把 reply.Err 返回。", err))
		}
		v, ver, err := ck.Get("x")
		if v != "hello" || ver != 1 || err != OK {
			fail(t, "clerk_get", fmt.Sprintf("通过 Clerk Get(\"x\") 应该得到 (\"hello\", 1, OK)，你得到 (%q, %d, %q)。检查 Get 是否调用了 \"Server.Get\"，并把 reply 里的三个字段都返回。", v, ver, err))
		}
	})
	if n := e.net.Calls("C1"); n != 2 {
		fail(t, "clerk_calls", fmt.Sprintf("网络很可靠，一次 Put 加一次 Get 应该正好发 2 个 RPC，你发了 %d 个。", n))
	}
}

func TestLv3_Errors(t *testing.T) {
	e := newEnv(t)
	ck := e.clerk("C1")
	within(t, 2*time.Second, "clerk_hang", "Clerk 在可靠的网络上没有返回。", func() {
		if _, _, err := ck.Get("nope"); err != ErrNoKey {
			fail(t, "clerk_get", fmt.Sprintf("Get 不存在的键，Clerk 应该把服务器的 ErrNoKey 原样返回，你返回了 %q。", err))
		}
		ck.Put("x", "1", 0)
		if err := ck.Put("x", "2", 0); err != ErrVersion {
			fail(t, "clerk_put", fmt.Sprintf("x 已经是第 1 版，Put(\"x\", \"2\", 0) 应该返回 ErrVersion，你返回了 %q。", err))
		}
	})
}

func TestLv3_TwoClerks(t *testing.T) {
	e := newEnv(t)
	a, b := e.clerk("C1"), e.clerk("C2")
	within(t, 2*time.Second, "clerk_hang", "Clerk 在可靠的网络上没有返回。", func() {
		a.Put("k", "from-a", 0)
		v, ver, _ := b.Get("k")
		if v != "from-a" || ver != 1 {
			fail(t, "clerk_get", fmt.Sprintf("C1 写入后，C2 应该读到 (\"from-a\", 1)，读到的是 (%q, %d)。", v, ver))
		}
		if err := b.Put("k", "from-b", 1); err != OK {
			fail(t, "clerk_put", fmt.Sprintf("C2 用第 1 版改 k，应该 OK，返回了 %q。", err))
		}
		if err := a.Put("k", "again", 1); err != ErrVersion {
			fail(t, "clerk_put", fmt.Sprintf("k 已经被 C2 改到第 2 版，C1 再用第 1 版写，应该 ErrVersion，返回了 %q。", err))
		}
	})
}
