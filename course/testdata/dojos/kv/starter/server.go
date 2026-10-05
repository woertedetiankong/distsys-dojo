package kv

import "sync"

// Server 是键值服务器。每个键存一个值和一个版本号。
// 它的 Get 和 Put 会被很多客户端同时调用（每个 RPC 在自己的 goroutine 里运行）。
type Server struct {
	mu sync.Mutex
	// TODO: 第 1 关，存放数据的结构
}

func NewServer() *Server {
	s := &Server{}
	// TODO: 第 1 关
	return s
}

// Get 返回键的值和版本号；键不存在时 reply.Err = ErrNoKey。
func (s *Server) Get(args *GetArgs, reply *GetReply) error {
	// TODO: 第 1 关
	return nil
}

// Put 只在 args.Version 等于键当前的版本号时写入，并把版本号加一。
// 键不存在时：Version 为 0 就新建（写入后版本号是 1），否则 ErrNoKey。
// 版本号对不上：ErrVersion，什么都不改。
func (s *Server) Put(args *PutArgs, reply *PutReply) error {
	// TODO: 第 1 关
	return nil
}
