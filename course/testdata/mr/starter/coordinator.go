package mr

// ===== 第 5 ~ 7 关：Coordinator =====

type Coordinator struct {
	files   []string
	nReduce int
	// TODO: 记录每个任务的状态
}

// MakeCoordinator 创建协调者。files 是输入文件，每个文件是一个 Map 任务。
func MakeCoordinator(files []string, nReduce int) *Coordinator {
	c := &Coordinator{files: files, nReduce: nReduce}
	// TODO
	return c
}

// GetTask 由 worker 通过 RPC 调用，分配一个任务。
func (c *Coordinator) GetTask(args *GetTaskArgs, reply *GetTaskReply) error {
	// TODO
	reply.Type = ExitTask
	return nil
}

// TaskDone 由 worker 通过 RPC 调用，汇报一个任务完成了。
func (c *Coordinator) TaskDone(args *TaskDoneArgs, reply *TaskDoneReply) error {
	// TODO
	return nil
}

// Done 返回整个作业是否已经完成。测试会定期调用它。
func (c *Coordinator) Done() bool {
	// TODO
	return false
}
