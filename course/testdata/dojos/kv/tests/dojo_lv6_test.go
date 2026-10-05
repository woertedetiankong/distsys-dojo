// 练功房自动生成的测试文件，每次运行都会覆盖，不要修改。
package kv

import (
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// contend runs n clients that each take the lock rounds times, and checks nobody overlaps.
func contend(t *testing.T, e *env, n, rounds int) {
	var inside, maxIn, total int32
	var wg sync.WaitGroup
	within(t, 15*time.Second, "lock_stuck", fmt.Sprintf("%d 个客户端轮流加锁、解锁，15 秒内没有全部完成。可能有人解锁失败，或者 Acquire 在锁空着的时候也在等。", n), func() {
		for c := 0; c < n; c++ {
			wg.Add(1)
			go func(c int) {
				defer wg.Done()
				lk := MakeLock(e.clerk(fmt.Sprintf("C%d", c+1)), "lock")
				for r := 0; r < rounds; r++ {
					lk.Acquire()
					now := atomic.AddInt32(&inside, 1)
					for {
						m := atomic.LoadInt32(&maxIn)
						if now <= m || atomic.CompareAndSwapInt32(&maxIn, m, now) {
							break
						}
					}
					time.Sleep(2 * time.Millisecond)
					atomic.AddInt32(&inside, -1)
					atomic.AddInt32(&total, 1)
					lk.Release()
				}
			}(c)
		}
		wg.Wait()
	})
	if maxIn > 1 {
		fail(t, "two_holders", fmt.Sprintf("同一时刻有 %d 个客户端都以为自己拿着锁。加锁必须用带版本号的 Put，而且只在锁空着（值为空）时写入自己的 id。", maxIn))
	}
	if total != int32(n*rounds) {
		fail(t, "lock_stuck", fmt.Sprintf("应该一共加锁 %d 次，只完成了 %d 次。", n*rounds, total))
	}
}

func TestLv6_OneClient(t *testing.T) {
	e := newEnv(t)
	lk := MakeLock(e.clerk("C1"), "lock")
	within(t, 2*time.Second, "lock_stuck", "锁的键还不存在，一个客户端加锁却一直没有返回。键不存在时，用版本号 0 的 Put 新建它。", func() { lk.Acquire() })
	if r := sget(e.srv, "lock"); r.Value != lk.id {
		fail(t, "lock_value", fmt.Sprintf("拿到锁以后，锁的键里应该是自己的 id（%q），实际是 %q。", lk.id, r.Value))
	}
	within(t, 2*time.Second, "lock_stuck", "解锁没有返回。", func() { lk.Release() })
	if r := sget(e.srv, "lock"); r.Value != "" {
		fail(t, "lock_value", fmt.Sprintf("解锁后锁的键应该是空字符串，实际是 %q。", r.Value))
	}
	within(t, 2*time.Second, "lock_stuck", "解锁后再加锁，一直没有返回。", func() { lk.Acquire(); lk.Release() })
}

func TestLv6_Waits(t *testing.T) {
	e := newEnv(t)
	a := MakeLock(e.clerk("C1"), "lock")
	b := MakeLock(e.clerk("C2"), "lock")
	within(t, 2*time.Second, "lock_stuck", "锁空着，C1 加锁却一直没有返回。", func() { a.Acquire() })
	got := make(chan struct{})
	go func() { b.Acquire(); close(got) }()
	select {
	case <-got:
		fail(t, "two_holders", fmt.Sprintf("C1 拿着锁，C2 的 Acquire 却也返回了。现在锁的值是 %q。锁不空（值不是空字符串）时不能写入，要等一会儿再读。", sget(e.srv, "lock").Value))
	case <-time.After(50 * time.Millisecond):
	}
	if r := sget(e.srv, "lock"); r.Value != a.id {
		fail(t, "two_holders", fmt.Sprintf("C1 拿着锁时，锁的值被改成了 %q。只有锁空着时才能写入自己的 id。", r.Value))
	}
	within(t, 2*time.Second, "lock_stuck", "C1 解锁没有返回。", func() { a.Release() })
	select {
	case <-got:
	case <-time.After(2 * time.Second):
		fail(t, "lock_stuck", "C1 解锁以后，等着的 C2 两秒内都没拿到锁。等待时要隔一会儿重新读锁的值。")
	}
	within(t, 2*time.Second, "lock_stuck", "C2 解锁没有返回。", func() { b.Release() })
}

func TestLv6_Contention(t *testing.T) { contend(t, newEnv(t), 4, 5) }
