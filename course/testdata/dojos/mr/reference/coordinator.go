package mr

import (
	"sync"
	"time"

	"lab/dojo"
)

const useTimeout = true

type task struct {
	state int // 0 idle, 1 running, 2 done
	start time.Time
}

type Coordinator struct {
	mu      sync.Mutex
	files   []string
	nReduce int
	maps    []task
	reduces []task
}

func MakeCoordinator(files []string, nReduce int) *Coordinator {
	return &Coordinator{files: files, nReduce: nReduce, maps: make([]task, len(files)), reduces: make([]task, nReduce)}
}

func pick(ts []task) int {
	for i := range ts {
		if ts[i].state == 0 || (useTimeout && ts[i].state == 1 && time.Since(ts[i].start) > dojo.Timeout) {
			ts[i] = task{1, time.Now()}
			return i
		}
	}
	return -1
}

func allDone(ts []task) bool {
	for _, t := range ts {
		if t.state != 2 {
			return false
		}
	}
	return true
}

func (c *Coordinator) GetTask(args *GetTaskArgs, reply *GetTaskReply) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	reply.NReduce, reply.NMap = c.nReduce, len(c.files)
	if !allDone(c.maps) {
		if i := pick(c.maps); i >= 0 {
			reply.Type, reply.ID, reply.File = MapTask, i, c.files[i]
		} else {
			reply.Type = WaitTask
		}
		return nil
	}
	if !allDone(c.reduces) {
		if i := pick(c.reduces); i >= 0 {
			reply.Type, reply.ID = ReduceTask, i
		} else {
			reply.Type = WaitTask
		}
		return nil
	}
	reply.Type = ExitTask
	return nil
}

func (c *Coordinator) TaskDone(args *TaskDoneArgs, reply *TaskDoneReply) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if args.Type == MapTask {
		c.maps[args.ID].state = 2
	} else {
		c.reduces[args.ID].state = 2
	}
	return nil
}

func (c *Coordinator) Done() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return allDone(c.reduces)
}
