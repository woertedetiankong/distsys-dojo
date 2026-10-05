// 练功房自动生成的测试文件，每次运行都会覆盖，不要修改。
package mr

import (
	"fmt"
	"sync/atomic"
	"testing"
	"time"
)

func poolCheck(t *testing.T, n, jobsN int) {
	var active, peak int32
	f := func(x int) int {
		a := atomic.AddInt32(&active, 1)
		for {
			p := atomic.LoadInt32(&peak)
			if a <= p || atomic.CompareAndSwapInt32(&peak, p, a) {
				break
			}
		}
		time.Sleep(40 * time.Millisecond)
		atomic.AddInt32(&active, -1)
		return x * x
	}
	jobs := make([]int, jobsN)
	for i := range jobs {
		jobs[i] = i + 1
	}
	start := time.Now()
	res := RunPool(n, jobs, f)
	el := time.Since(start)
	if len(res) != jobsN {
		fail(t, "pool_order", fmt.Sprintf("应该返回 %d 个结果，实际返回了 %d 个。", jobsN, len(res)))
	}
	for i, j := range jobs {
		if res[i] != j*j {
			fail(t, "pool_order", fmt.Sprintf("results[%d] 应该是 f(%d) = %d，实际是 %d。结果的顺序要和 jobs 一致。", i, j, j*j, res[i]))
		}
	}
	if int(peak) > n {
		fail(t, "pool_too_many", fmt.Sprintf("同一时刻最多应该有 %d 个 f 在运行，实际最多有 %d 个。", n, peak))
	}
	if int(peak) < n {
		fail(t, "pool_serial", fmt.Sprintf("允许同时运行 %d 个，但最多只有 %d 个在同时运行，没有用满工作池。", n, peak))
	}
	limit := time.Duration((jobsN+n-1)/n) * 40 * time.Millisecond * 18 / 10
	if el > limit {
		fail(t, "pool_slow", fmt.Sprintf("用了 %v，超过了 %v。", el.Round(time.Millisecond), limit))
	}
}

func TestLv2_PoolOf3(t *testing.T) { poolCheck(t, 3, 12) }
func TestLv2_PoolOf1(t *testing.T) { poolCheck(t, 1, 5) }
func TestLv2_PoolWide(t *testing.T) { poolCheck(t, 8, 8) }
