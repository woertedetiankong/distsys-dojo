package kv

// Lock 是建立在 Clerk 之上的锁：很多客户端用同一个 key 争同一把锁。
// 锁的值是空字符串表示没人拿着，否则是持有者的 id。
// Lock is a lock built on the Clerk: many clients compete for one lock through the same key.
// An empty value means nobody holds it; otherwise the value is the holder's id.
type Lock struct {
	ck  *Clerk
	key string
	id  string
}

func MakeLock(ck *Clerk, key string) *Lock {
	return &Lock{ck: ck, key: key, id: NewID()}
}

// Acquire 一直等到拿到锁才返回。
// Acquire returns only once it holds the lock.
func (lk *Lock) Acquire() {
	// TODO: 第 6 关；第 7 关处理 ErrMaybe
	// TODO: level 6; handle ErrMaybe in level 7
}

// Release 释放自己拿着的锁。
// Release releases the lock you hold.
func (lk *Lock) Release() {
	// TODO: 第 6 关
	// TODO: level 6
}
