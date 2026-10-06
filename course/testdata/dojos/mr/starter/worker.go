package mr

import "lab/dojo"

// ===== 第 4 关：Worker =====
// ===== Level 4: Worker =====

// Worker 不停地向协调者要任务、执行、汇报，直到收到 ExitTask。
//
//	c.Call("Coordinator.GetTask", &args, &reply)   发 RPC，返回是否成功
//	fs.ReadFile / fs.WriteFile / fs.WriteTemp / fs.Rename   读写文件
//
// 中间文件叫 mr-X-Y，每行是一个用 json.Marshal 编码的 KeyValue；输出文件叫 mr-out-Y，每行是 "键 结果"。
// Worker keeps asking the coordinator for tasks, running them and reporting, until it gets ExitTask.
//
//	c.Call("Coordinator.GetTask", &args, &reply)   send an RPC; returns whether it succeeded
//	fs.ReadFile / fs.WriteFile / fs.WriteTemp / fs.Rename   read and write files
//
// Intermediate files are named mr-X-Y, one json.Marshal-encoded KeyValue per line; output files are
// named mr-out-Y, one "key result" per line.
func Worker(id int, c *dojo.Client, fs dojo.FS,
	mapf func(string, string) []KeyValue, reducef func(string, []string) string) {
	for {
		args := GetTaskArgs{WorkerID: id}
		reply := GetTaskReply{}
		if !c.Call("Coordinator.GetTask", &args, &reply) {
			return
		}
		// TODO: 根据 reply.Type 分别处理 MapTask、ReduceTask、WaitTask、ExitTask
		// TODO: handle MapTask, ReduceTask, WaitTask and ExitTask according to reply.Type
		return
	}
}
