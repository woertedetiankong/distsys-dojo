package mr

import "lab/dojo"

// ===== 第 4 关：Worker =====

// Worker 不停地向协调者要任务、执行、汇报，直到收到 ExitTask。
//
//	c.Call("Coordinator.GetTask", &args, &reply)   发 RPC，返回是否成功
//	fs.ReadFile / fs.WriteFile / fs.WriteTemp / fs.Rename   读写文件
//
// 中间文件叫 mr-X-Y，每行是一个用 json.Marshal 编码的 KeyValue；输出文件叫 mr-out-Y，每行是 "键 结果"。
func Worker(id int, c *dojo.Client, fs dojo.FS,
	mapf func(string, string) []KeyValue, reducef func(string, []string) string) {
	for {
		args := GetTaskArgs{WorkerID: id}
		reply := GetTaskReply{}
		if !c.Call("Coordinator.GetTask", &args, &reply) {
			return
		}
		// TODO: 根据 reply.Type 分别处理 MapTask、ReduceTask、WaitTask、ExitTask
		return
	}
}
