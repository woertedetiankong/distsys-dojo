package kv

import "time"

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
	for {
		value, version, err := lk.ck.Get(lk.key)
		if err == ErrNoKey {
			value, version = "", 0
		}
		if value == lk.id {
			return // an earlier Put of ours landed (its reply was lost)
		}
		if value == "" {
			switch lk.ck.Put(lk.key, lk.id, version) {
			case OK:
				return
			case ErrMaybe:
				continue // read the key again: is it our id?
			}
		}
		time.Sleep(RetryWait)
	}
}

// Release 释放自己拿着的锁。
// Release releases the lock you hold.
func (lk *Lock) Release() {
	for {
		value, version, _ := lk.ck.Get(lk.key)
		if value != lk.id {
			return // not ours any more: an earlier release landed
		}
		if err := lk.ck.Put(lk.key, "", version); err == OK || err == ErrMaybe {
			return
		}
	}
}
