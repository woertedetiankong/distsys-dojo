package kv

// 客户端和服务器之间的 RPC 协议，以及共用的小工具。这个文件已经写好，一般不需要修改。
// 字段名必须大写开头，才能通过 RPC 传输。
// The RPC protocol between client and server, plus small shared helpers. This file is complete;
// you normally don't need to change it. Field names must start with a capital letter to travel over RPC.

import (
	"math/rand"
	"time"
)

type Err string

const (
	OK         Err = "OK"
	ErrNoKey   Err = "ErrNoKey"   // Get 的键不存在；或者 Put 的版本号大于 0，键却不存在 / Get of a missing key; or a Put with a version above 0 on a missing key
	ErrVersion Err = "ErrVersion" // Put 的版本号和服务器上的对不上，没有执行 / the Put's version doesn't match the server's; it did not run
	ErrMaybe   Err = "ErrMaybe"   // 只由 Clerk 返回：重发过的 Put 被拒绝，可能已经执行过了 / returned only by the Clerk: a resent Put was refused, and may already have run
)

type GetArgs struct {
	Key string
}

type GetReply struct {
	Value   string
	Version int
	Err     Err
}

type PutArgs struct {
	Key     string
	Value   string
	Version int // 只有服务器上这个键的版本号等于它时才写入；新建一个键用 0 / write only if the key's version on the server equals this; use 0 to create a key
}

type PutReply struct {
	Err Err
}

// Caller 是 Clerk 用来发 RPC 的连接，测试会传入一个模拟的网络。
// Call 返回 false 表示没有收到回复：可能是请求丢了，也可能是回复丢了。
// Caller is the connection the Clerk sends RPCs on; the tests pass in a simulated network.
// Call returns false when no reply arrived: either the request or the reply was lost.
type Caller interface {
	Call(method string, args interface{}, reply interface{}) bool
}

// RetryWait 是 Call 失败后、重发前要等待的时间。真实的 Lab 2 用 100 毫秒，这里缩短为 10 毫秒，让测试跑得快一些。
// RetryWait is how long to wait after a failed Call before resending. The real Lab 2 uses 100 ms;
// it is 10 ms here so the tests run faster.
const RetryWait = 10 * time.Millisecond

// NewID 返回一个随机的 8 位字符串，用作锁的持有者 id（对应 Lab 2 的 kvtest.RandValue(8)）。
// NewID returns a random 8-character string to use as a lock holder's id (kvtest.RandValue(8) in Lab 2).
func NewID() string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
