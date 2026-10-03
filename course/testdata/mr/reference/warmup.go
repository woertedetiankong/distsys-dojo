package mr

import "sync"

func CountWords(texts []string, count func(text string) map[string]int) map[string]int {
	total := map[string]int{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for _, t := range texts {
		wg.Add(1)
		go func(t string) {
			defer wg.Done()
			m := count(t)
			mu.Lock()
			for k, v := range m {
				total[k] += v
			}
			mu.Unlock()
		}(t)
	}
	wg.Wait()
	return total
}

func RunPool(n int, jobs []int, f func(int) int) []int {
	results := make([]int, len(jobs))
	sem := make(chan struct{}, n)
	var wg sync.WaitGroup
	for i, j := range jobs {
		wg.Add(1)
		sem <- struct{}{}
		go func(i, j int) {
			defer wg.Done()
			results[i] = f(j)
			<-sem
		}(i, j)
	}
	wg.Wait()
	return results
}
