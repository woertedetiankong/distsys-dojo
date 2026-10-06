package mr

import "hash/fnv"

// KeyValue 是 Map 输出的一个键值对。
// KeyValue is one key/value pair emitted by Map.
type KeyValue struct {
	Key   string
	Value string
}

// ihash 选择一个键该去哪个 Reduce 任务：ihash(key) % nReduce。和 Lab 1 完全相同。
// ihash picks the Reduce task a key goes to: ihash(key) % nReduce. Exactly as in Lab 1.
func ihash(key string) int {
	h := fnv.New32a()
	h.Write([]byte(key))
	return int(h.Sum32() & 0x7fffffff)
}
