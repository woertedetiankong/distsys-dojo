package mr

// ===== 第 5 ~ 7 关：Coordinator =====
// ===== Levels 5 to 7: Coordinator =====

type Coordinator struct {
	files   []string
	nReduce int
	// TODO: 记录每个任务的状态
	// TODO: record the state of every task
}

// MakeCoordinator 创建协调者。files 是输入文件，每个文件是一个 Map 任务。
// MakeCoordinator creates the coordinator. files are the input files, one Map task each.
func MakeCoordinator(files []string, nReduce int) *Coordinator {
	c := &Coordinator{files: files, nReduce: nReduce}
	// TODO
	return c
}

// GetTask 由 worker 通过 RPC 调用，分配一个任务。
// GetTask is called by a worker over RPC and hands out a task.
func (c *Coordinator) GetTask(args *GetTaskArgs, reply *GetTaskReply) error {
	// TODO
	reply.Type = ExitTask
	return nil
}

// TaskDone 由 worker 通过 RPC 调用，汇报一个任务完成了。
// TaskDone is called by a worker over RPC to report a finished task.
func (c *Coordinator) TaskDone(args *TaskDoneArgs, reply *TaskDoneReply) error {
	// TODO
	return nil
}

// Done 返回整个作业是否已经完成。测试会定期调用它。
// Done reports whether the whole job is finished. The tests call it periodically.
func (c *Coordinator) Done() bool {
	// TODO
	return false
}
