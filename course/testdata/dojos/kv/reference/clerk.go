package kv

import "time"

// Clerk 是客户端库：把 Get 和 Put 变成发给服务器的 RPC。
// Clerk is the client library: it turns Get and Put into RPCs to the server.
type Clerk struct {
	end Caller
}

func MakeClerk(end Caller) *Clerk {
	return &Clerk{end: end}
}

// Get 通过 RPC "Server.Get" 读一个键，返回值、版本号和 Err。
// Get reads a key through the RPC "Server.Get" and returns its value, version and Err.
func (ck *Clerk) Get(key string) (string, int, Err) {
	args := GetArgs{Key: key}
	for {
		var reply GetReply
		if ck.end.Call("Server.Get", &args, &reply) {
			return reply.Value, reply.Version, reply.Err
		}
		time.Sleep(RetryWait)
	}
}

// Put 通过 RPC "Server.Put" 写一个键。
// 返回 OK、ErrNoKey、ErrVersion，或者（第 5 关）ErrMaybe。
// Put writes a key through the RPC "Server.Put".
// It returns OK, ErrNoKey, ErrVersion or (level 5) ErrMaybe.
func (ck *Clerk) Put(key, value string, version int) Err {
	args := PutArgs{Key: key, Value: value, Version: version}
	retried := false
	for {
		var reply PutReply
		if ck.end.Call("Server.Put", &args, &reply) {
			if reply.Err == ErrVersion && retried {
				return ErrMaybe
			}
			return reply.Err
		}
		retried = true
		time.Sleep(RetryWait)
	}
}
