package mr

// worker 和协调者之间的 RPC 协议。字段名必须大写开头，才能通过 RPC 传输。
// The RPC protocol between worker and coordinator. Field names must start with a capital letter to travel over RPC.

type TaskType int

const (
	MapTask    TaskType = iota // 执行一个 Map 任务 / run a Map task
	ReduceTask                 // 执行一个 Reduce 任务 / run a Reduce task
	WaitTask                   // 暂时没有任务，休息一下再来 / no task right now; rest and ask again
	ExitTask                   // 作业结束，退出 / the job is done; exit
)

type GetTaskArgs struct {
	WorkerID int
}

type GetTaskReply struct {
	Type    TaskType
	ID      int    // 任务编号：Map 是 0..NMap-1，Reduce 是 0..NReduce-1 / task number: 0..NMap-1 for Map, 0..NReduce-1 for Reduce
	File    string // Map 任务的输入文件 / input file of a Map task
	NReduce int    // Reduce 任务总数（Map 任务要分这么多个桶） / number of Reduce tasks (a Map splits into this many buckets)
	NMap    int    // Map 任务总数（Reduce 任务要读这么多个中间文件） / number of Map tasks (a Reduce reads this many intermediate files)
}

type TaskDoneArgs struct {
	Type TaskType
	ID   int
}

type TaskDoneReply struct{}
