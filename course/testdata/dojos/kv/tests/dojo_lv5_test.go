// 练功房自动生成的测试文件，每次运行都会覆盖，不要修改。
package kv

import (
	"fmt"
	"testing"
	"time"
)

func TestLv5_LostPutReply(t *testing.T) {
	e := newEnv(t)
	ck := e.clerk("C1")
	e.net.Drop("C1", "rep", 1)
	var err Err
	within(t, 2*time.Second, "no_retry", "Clerk 没有返回。", func() { err = ck.Put("x", "v", 0) })
	if r := sget(e.srv, "x"); r.Version != 1 {
		fail(t, "fail", fmt.Sprintf("服务器上 x 应该是第 1 版（第一次就执行了，重发的被版本号挡住），实际是第 %d 版。", r.Version))
	}
	if err != ErrMaybe {
		fail(t, "maybe_missing", fmt.Sprintf("Put 执行了，但回复丢了；重发的 Put 收到 ErrVersion。Clerk 分不清是自己的第一次成功了，还是被别人抢先了，应该返回 ErrMaybe，你返回了 %q。", err))
	}
}

func TestLv5_FirstTryRefused(t *testing.T) {
	e := newEnv(t)
	ck := e.clerk("C1")
	var err Err
	within(t, 2*time.Second, "no_retry", "Clerk 没有返回。", func() {
		ck.Put("x", "a", 0)
		err = ck.Put("x", "b", 0)
	})
	if err != ErrVersion {
		fail(t, "maybe_too_eager", fmt.Sprintf("这个 Put 第一次发送就被拒绝了，Clerk 确切知道它没有执行，应该返回 ErrVersion，你返回了 %q。只有重发过的 Put 才说「可能」。", err))
	}
}

func TestLv5_RetriedThenOK(t *testing.T) {
	e := newEnv(t)
	ck := e.clerk("C1")
	e.net.Drop("C1", "req", 1)
	var err Err
	within(t, 2*time.Second, "no_retry", "Clerk 没有返回。", func() { err = ck.Put("x", "v", 0) })
	if err != OK {
		fail(t, "maybe_on_ok", fmt.Sprintf("请求丢了，重发的那次成功执行并回复了 OK。收到 OK 就是确定的成功，应该返回 OK，你返回了 %q。", err))
	}
}

func TestLv5_FreshEachPut(t *testing.T) {
	e := newEnv(t)
	ck := e.clerk("C1")
	e.net.Drop("C1", "rep", 1)
	var first, second Err
	within(t, 2*time.Second, "no_retry", "Clerk 没有返回。", func() {
		first = ck.Put("x", "v", 0)  // retried → ErrMaybe
		second = ck.Put("x", "w", 0) // first try refused → ErrVersion
	})
	if first != ErrMaybe {
		fail(t, "maybe_missing", fmt.Sprintf("第一个 Put 的回复丢了，重发后被拒绝，应该返回 ErrMaybe，你返回了 %q。", first))
	}
	if second != ErrVersion {
		fail(t, "maybe_sticky", fmt.Sprintf("第二个 Put 一次就送到了，却返回了 %q，应该是 ErrVersion。「是否重发过」要每个 Put 单独记，不能留到下一个 Put。", second))
	}
}
