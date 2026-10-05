package kv

// Clerk 是客户端库：把 Get 和 Put 变成发给服务器的 RPC。
type Clerk struct {
	end Caller
}

func MakeClerk(end Caller) *Clerk {
	return &Clerk{end: end}
}

// Get 通过 RPC "Server.Get" 读一个键，返回值、版本号和 Err。
func (ck *Clerk) Get(key string) (string, int, Err) {
	// TODO: 第 3 关；第 4 关加上重试
	return "", 0, ErrNoKey
}

// Put 通过 RPC "Server.Put" 写一个键。
// 返回 OK、ErrNoKey、ErrVersion，或者（第 5 关）ErrMaybe。
func (ck *Clerk) Put(key, value string, version int) Err {
	// TODO: 第 3 关；第 4 关加上重试；第 5 关加上 ErrMaybe 规则
	return ErrNoKey
}
