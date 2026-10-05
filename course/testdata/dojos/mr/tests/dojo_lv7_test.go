// 练功房自动生成的测试文件，每次运行都会覆盖，不要修改。
package mr

import (
	"testing"
	"time"
)

func TestLv7_SlowMap(t *testing.T) {
	runJob(t, jobOpts{workers: 3, nReduce: 3, seed: 31, slow: map[int]float64{0: 60}, limit: 15 * time.Second})
}

func TestLv7_SlowReduce(t *testing.T) {
	runJob(t, jobOpts{workers: 2, nReduce: 2, seed: 32, slow: map[int]float64{1: 60}, limit: 15 * time.Second})
}

func TestLv7_SlowAndCrash(t *testing.T) {
	runJob(t, jobOpts{workers: 3, nReduce: 2, seed: 33, slow: map[int]float64{2: 60}, crashes: []at{{20 * time.Millisecond, 0}}, limit: 15 * time.Second})
}
