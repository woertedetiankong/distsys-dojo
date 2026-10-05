// 练功房自动生成的测试文件，每次运行都会覆盖，不要修改。
package kv

import (
	"fmt"
	"testing"
)

func TestLv1_NewKey(t *testing.T) {
	s := NewServer()
	if r := sget(s, "a"); r.Err != ErrNoKey {
		fail(t, "get_missing", fmt.Sprintf("Get 一个从没写过的键，应该返回 ErrNoKey，你返回了 %q。", r.Err))
	}
	if err := sput(s, "a", "1", 0); err != OK {
		fail(t, "put_new", fmt.Sprintf("Put(\"a\", \"1\", 0) 新建一个键，应该返回 OK，你返回了 %q。版本号 0 表示「这个键还不存在」。", err))
	}
	r := sget(s, "a")
	if r.Err != OK || r.Value != "1" {
		fail(t, "put_new", fmt.Sprintf("新建后 Get(\"a\") 应该得到 (\"1\", 1, OK)，你得到 (%q, %d, %q)。", r.Value, r.Version, r.Err))
	}
	if r.Version != 1 {
		fail(t, "version_not_bumped", fmt.Sprintf("新建的键版本号应该是 1，你的是 %d。", r.Version))
	}
}

func TestLv1_Versions(t *testing.T) {
	s := NewServer()
	sput(s, "a", "1", 0)
	if err := sput(s, "a", "2", 1); err != OK {
		fail(t, "put_match", fmt.Sprintf("键 a 现在是第 1 版，Put(\"a\", \"2\", 1) 版本对得上，应该返回 OK，你返回了 %q。", err))
	}
	if r := sget(s, "a"); r.Value != "2" || r.Version != 2 {
		fail(t, "version_not_bumped", fmt.Sprintf("写入成功后应该是 (\"2\", 版本 2)，你是 (%q, 版本 %d)。每次成功的 Put 都要把版本号加一。", r.Value, r.Version))
	}
	for _, v := range []int{0, 1, 3} {
		if err := sput(s, "a", "bad", v); err != ErrVersion {
			fail(t, "wrong_version_accepted", fmt.Sprintf("键 a 现在是第 2 版，Put(\"a\", \"bad\", %d) 版本对不上，应该返回 ErrVersion，你返回了 %q。", v, err))
		}
	}
	if r := sget(s, "a"); r.Value != "2" || r.Version != 2 {
		fail(t, "wrong_version_accepted", fmt.Sprintf("被拒绝的 Put 不能改任何东西：a 应该还是 (\"2\", 版本 2)，你的是 (%q, 版本 %d)。", r.Value, r.Version))
	}
}

func TestLv1_NoKey(t *testing.T) {
	s := NewServer()
	if err := sput(s, "b", "x", 3); err != ErrNoKey {
		fail(t, "no_key", fmt.Sprintf("键 b 不存在，Put(\"b\", \"x\", 3) 的版本号大于 0，应该返回 ErrNoKey，你返回了 %q。", err))
	}
	if r := sget(s, "b"); r.Err != ErrNoKey {
		fail(t, "no_key", "被拒绝的 Put 不应该新建键：之后 Get(\"b\") 应该还是 ErrNoKey。")
	}
}
