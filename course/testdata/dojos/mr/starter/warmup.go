package mr

// ===== 第 1 关：goroutine、WaitGroup 与 Mutex =====

// CountWords 用 count 统计每段文本的词频，再把结果合并成一个 map。
// count 很慢（每次约 100 毫秒），所以要用 goroutine 同时处理所有文本。
func CountWords(texts []string, count func(text string) map[string]int) map[string]int {
	total := map[string]int{}
	// TODO
	return total
}

// ===== 第 2 关：channel 与工作池 =====

// RunPool 对 jobs 里的每个数调用 f，同一时刻最多有 n 个 f 在运行。
// 返回的结果顺序要和 jobs 一致：results[i] = f(jobs[i])。
func RunPool(n int, jobs []int, f func(int) int) []int {
	results := make([]int, len(jobs))
	// TODO
	return results
}
