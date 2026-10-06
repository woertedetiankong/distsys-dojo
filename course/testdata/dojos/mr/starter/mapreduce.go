package mr

// ===== 第 3 关：map、reduce 与分区 =====
// ===== Level 3: map, reduce and partitioning =====

// Map 是词频统计的 map 函数：找出 contents 里的每个单词（连续的字母），
// 按出现顺序返回 KeyValue{单词, "1"}。
// Map is the word-count map function: find every word (a run of letters) in contents
// and return KeyValue{word, "1"} in order of appearance.
func Map(filename string, contents string) []KeyValue {
	// TODO
	return nil
}

// Reduce 是词频统计的 reduce 函数：values 是某个单词的所有 "1"，返回出现次数。
// Reduce is the word-count reduce function: values are all the "1"s of one word; return the count.
func Reduce(key string, values []string) string {
	// TODO
	return "0"
}

// Partition 把键值对分进 nReduce 个桶：返回长度为 nReduce 的切片，
// 第 y 个桶装着所有 ihash(Key) % nReduce == y 的键值对，保持原来的顺序。
// Partition splits the pairs into nReduce buckets: it returns a slice of length nReduce whose
// bucket y holds every pair with ihash(Key) % nReduce == y, in the original order.
func Partition(kvs []KeyValue, nReduce int) [][]KeyValue {
	// TODO
	return nil
}

// ReduceLines 按键分组，对每个键调用一次 reducef，返回按键排序的 "键 结果" 行。
// ReduceLines groups by key, calls reducef once per key, and returns "key result" lines sorted by key.
func ReduceLines(kvs []KeyValue, reducef func(string, []string) string) []string {
	// TODO
	return nil
}
