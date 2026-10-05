package kv

// 客户端和服务器之间的 RPC 协议，以及共用的小工具。这个文件已经写好，一般不需要修改。
// 字段名必须大写开头，才能通过 RPC 传输。

import (
	"math/rand"
	"time"
)

type Err string

const (
	OK         Err = "OK"
	ErrNoKey   Err = "ErrNoKey"   // Get 的键不存在；或者 Put 的版本号大于 0，键却不存在
	ErrVersion Err = "ErrVersion" // Put 的版本号和服务器上的对不上，没有执行
	ErrMaybe   Err = "ErrMaybe"   // 只由 Clerk 返回：重发过的 Put 被拒绝，可能已经执行过了
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
	Version int // 只有服务器上这个键的版本号等于它时才写入；新建一个键用 0
}

type PutReply struct {
	Err Err
}

// Caller 是 Clerk 用来发 RPC 的连接，测试会传入一个模拟的网络。
// Call 返回 false 表示没有收到回复：可能是请求丢了，也可能是回复丢了。
type Caller interface {
	Call(method string, args interface{}, reply interface{}) bool
}

// RetryWait 是 Call 失败后、重发前要等待的时间。真实的 Lab 2 用 100 毫秒，这里缩短为 10 毫秒，让测试跑得快一些。
const RetryWait = 10 * time.Millisecond

// NewID 返回一个随机的 8 位字符串，用作锁的持有者 id（对应 Lab 2 的 kvtest.RandValue(8)）。
func NewID() string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
