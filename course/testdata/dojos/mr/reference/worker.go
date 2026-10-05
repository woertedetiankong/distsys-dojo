package mr

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"lab/dojo"
)

const atomicWrites = true

func put(fs dojo.FS, name string, data []byte) {
	if atomicWrites {
		tmp, _ := fs.WriteTemp(data)
		fs.Rename(tmp, name)
	} else {
		fs.WriteFile(name, data)
	}
}

func Worker(id int, c *dojo.Client, fs dojo.FS,
	mapf func(string, string) []KeyValue, reducef func(string, []string) string) {
	for {
		args := GetTaskArgs{WorkerID: id}
		reply := GetTaskReply{}
		if !c.Call("Coordinator.GetTask", &args, &reply) {
			return
		}
		switch reply.Type {
		case MapTask:
			data, err := fs.ReadFile(reply.File)
			if err != nil {
				continue
			}
			for y, bucket := range Partition(mapf(reply.File, string(data)), reply.NReduce) {
				var sb strings.Builder
				for _, kv := range bucket {
					b, _ := json.Marshal(kv)
					sb.Write(b)
					sb.WriteByte('\n')
				}
				put(fs, fmt.Sprintf("mr-%d-%d", reply.ID, y), []byte(sb.String()))
			}
			c.Call("Coordinator.TaskDone", &TaskDoneArgs{MapTask, reply.ID}, &TaskDoneReply{})
		case ReduceTask:
			var kvs []KeyValue
			for x := 0; x < reply.NMap; x++ {
				data, err := fs.ReadFile(fmt.Sprintf("mr-%d-%d", x, reply.ID))
				if err != nil {
					continue
				}
				for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
					var kv KeyValue
					if json.Unmarshal([]byte(line), &kv) == nil {
						kvs = append(kvs, kv)
					}
				}
			}
			out := strings.Join(ReduceLines(kvs, reducef), "\n")
			if out != "" {
				out += "\n"
			}
			put(fs, fmt.Sprintf("mr-out-%d", reply.ID), []byte(out))
			c.Call("Coordinator.TaskDone", &TaskDoneArgs{ReduceTask, reply.ID}, &TaskDoneReply{})
		case WaitTask:
			time.Sleep(100 * time.Millisecond)
		default:
			return
		}
	}
}
