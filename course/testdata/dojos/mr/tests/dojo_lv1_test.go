// 练功房自动生成的测试文件，每次运行都会覆盖，不要修改。
package mr

import (
	"fmt"
	"reflect"
	"testing"
	"time"
)

var lv1Texts = []string{inputs["pg-0.txt"], inputs["pg-1.txt"], inputs["pg-2.txt"], inputs["pg-3.txt"], "the cat and the dog", "a cat a hat"}

func slowCount(s string) map[string]int {
	time.Sleep(100 * time.Millisecond)
	return refCounts(s)
}

func TestLv1_Correct(t *testing.T) {
	got := CountWords(lv1Texts, func(s string) map[string]int { return refCounts(s) })
	want := refCounts(lv1Texts...)
	if !reflect.DeepEqual(got, want) {
		fail(t, "wrong_total", fmt.Sprintf("合并后的词频不对。比如 \"the\" 应该是 %d，你的结果是 %d；一共应有 %d 个不同的词，你有 %d 个。", want["the"], got["the"], len(want), len(got)))
	}
}

func TestLv1_Parallel(t *testing.T) {
	start := time.Now()
	got := CountWords(lv1Texts, slowCount)
	el := time.Since(start)
	if !reflect.DeepEqual(got, refCounts(lv1Texts...)) {
		fail(t, "wrong_total", "合并后的词频不对。")
	}
	if el > 350*time.Millisecond {
		fail(t, "not_parallel", fmt.Sprintf("6 段文本用了 %v。每段要 100ms，同时处理应该只要 100ms 多一点；这说明它们是一段一段依次处理的。", el.Round(time.Millisecond)))
	}
}

func TestLv1_Repeat(t *testing.T) {
	want := refCounts(lv1Texts...)
	for i := 0; i < 30; i++ {
		if got := CountWords(lv1Texts, func(s string) map[string]int { return refCounts(s) }); !reflect.DeepEqual(got, want) {
			fail(t, "flaky", fmt.Sprintf("第 %d 次运行结果不对。并发程序要每次都对，很可能是有 goroutine 还没做完，CountWords 就返回了。", i+1))
		}
	}
}
