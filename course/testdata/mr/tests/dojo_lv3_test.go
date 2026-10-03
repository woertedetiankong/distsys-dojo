// 练功房自动生成的测试文件，每次运行都会覆盖，不要修改。
package mr

import (
	"fmt"
	"math/rand"
	"reflect"
	"sort"
	"strings"
	"testing"
)

func TestLv3_Map(t *testing.T) {
	got := Map("a.txt", "The cat sat. The cat ran!")
	want := []KeyValue{{"The", "1"}, {"cat", "1"}, {"sat", "1"}, {"The", "1"}, {"cat", "1"}, {"ran", "1"}}
	if !reflect.DeepEqual(got, want) {
		fail(t, "map_words", fmt.Sprintf("Map(\"a.txt\", \"The cat sat. The cat ran!\") 应该返回 %v，实际是 %v。", want, got))
	}
	text := "Go 1.22 is here; e-mail me"
	got = Map("b.txt", text)
	want = nil
	for _, w := range refWords(text) {
		want = append(want, KeyValue{w, "1"})
	}
	if !reflect.DeepEqual(got, want) {
		fail(t, "map_split", fmt.Sprintf("遇到数字和标点时，应该返回 %v，实际是 %v。单词只由字母组成。", want, got))
	}
}

func TestLv3_Reduce(t *testing.T) {
	if got := Reduce("cat", []string{"1", "1", "1"}); got != "3" {
		fail(t, "reduce_count", fmt.Sprintf("Reduce(\"cat\", [\"1\" \"1\" \"1\"]) 应该返回 \"3\"，实际是 %q。", got))
	}
}

func TestLv3_Partition(t *testing.T) {
	var kvs []KeyValue
	for _, f := range inputNames {
		for _, w := range refWords(inputs[f]) {
			kvs = append(kvs, KeyValue{w, "1"})
		}
	}
	for _, n := range []int{1, 2, 3, 4} {
		got := Partition(append([]KeyValue(nil), kvs...), n)
		if len(got) != n {
			fail(t, "part_len", fmt.Sprintf("Partition(kvs, %d) 应该返回 %d 个桶，实际返回了 %d 个。", n, n, len(got)))
		}
		for y, b := range got {
			for _, kv := range b {
				if ihash(kv.Key)%n != y {
					fail(t, "part_bucket", fmt.Sprintf("nReduce=%d 时，%q 应该在第 %d 号桶，却出现在第 %d 号桶。", n, kv.Key, ihash(kv.Key)%n, y))
				}
			}
			var want []KeyValue
			for _, kv := range kvs {
				if ihash(kv.Key)%n == y {
					want = append(want, kv)
				}
			}
			if len(want) != len(b) || (len(b) > 0 && !reflect.DeepEqual(want, b)) {
				fail(t, "part_order", fmt.Sprintf("第 %d 号桶应有 %d 个键值对，并保持原来的顺序；实际有 %d 个。", y, len(want), len(b)))
			}
		}
	}
}

func TestLv3_ReduceLines(t *testing.T) {
	var kvs []KeyValue
	for _, w := range refWords(inputs["pg-1.txt"] + " " + inputs["pg-2.txt"]) {
		kvs = append(kvs, KeyValue{w, "1"})
	}
	rand.New(rand.NewSource(3)).Shuffle(len(kvs), func(i, j int) { kvs[i], kvs[j] = kvs[j], kvs[i] })
	got := ReduceLines(kvs, Reduce)
	want := refLines(refCounts(inputs["pg-1.txt"] + " " + inputs["pg-2.txt"]))
	keys := map[string]bool{}
	for _, l := range got {
		k := strings.SplitN(l, " ", 2)[0]
		if keys[k] {
			fail(t, "not_grouped", fmt.Sprintf("同一个键只能输出一行，但 %q 出现了多次。要先把相同的键分到一组。", k))
		}
		keys[k] = true
	}
	if !sort.StringsAreSorted(got) {
		fail(t, "unsorted", "输出要按键排序（sort.Strings 的默认顺序）。")
	}
	if !reflect.DeepEqual(got, want) {
		first := ""
		for i := range want {
			if i >= len(got) || got[i] != want[i] {
				g := "（没有）"
				if i < len(got) {
					g = got[i]
				}
				first = fmt.Sprintf("第 %d 行应为 %q，实际是 %q", i+1, want[i], g)
				break
			}
		}
		fail(t, "lines_content", "格式应该是 \"键 结果\"。"+first+"。")
	}
}
