package mr

import (
	"sort"
	"strconv"
	"strings"
	"unicode"
)

func Map(filename string, contents string) []KeyValue {
	words := strings.FieldsFunc(contents, func(r rune) bool { return !unicode.IsLetter(r) })
	kvs := make([]KeyValue, 0, len(words))
	for _, w := range words {
		kvs = append(kvs, KeyValue{w, "1"})
	}
	return kvs
}

func Reduce(key string, values []string) string {
	return strconv.Itoa(len(values))
}

func Partition(kvs []KeyValue, nReduce int) [][]KeyValue {
	b := make([][]KeyValue, nReduce)
	for _, kv := range kvs {
		y := ihash(kv.Key) % nReduce
		b[y] = append(b[y], kv)
	}
	return b
}

func ReduceLines(kvs []KeyValue, reducef func(string, []string) string) []string {
	groups := map[string][]string{}
	for _, kv := range kvs {
		groups[kv.Key] = append(groups[kv.Key], kv.Value)
	}
	keys := make([]string, 0, len(groups))
	for k := range groups {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	out := make([]string, 0, len(keys))
	for _, k := range keys {
		out = append(out, k+" "+reducef(k, groups[k]))
	}
	return out
}
