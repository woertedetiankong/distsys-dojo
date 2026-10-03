package mr

// worker 和协调者之间的 RPC 协议。字段名必须大写开头，才能通过 RPC 传输。

type TaskType int

const (
	MapTask    TaskType = iota // 执行一个 Map 任务
	ReduceTask                 // 执行一个 Reduce 任务
	WaitTask                   // 暂时没有任务，休息一下再来
	ExitTask                   // 作业结束，退出
)

type GetTaskArgs struct {
	WorkerID int
}

type GetTaskReply struct {
	Type    TaskType
	ID      int    // 任务编号：Map 是 0..NMap-1，Reduce 是 0..NReduce-1
	File    string // Map 任务的输入文件
	NReduce int    // Reduce 任务总数（Map 任务要分这么多个桶）
	NMap    int    // Map 任务总数（Reduce 任务要读这么多个中间文件）
}

type TaskDoneArgs struct {
	Type TaskType
	ID   int
}

type TaskDoneReply struct{}
