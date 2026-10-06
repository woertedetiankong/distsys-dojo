# 分布式系统练功房

中文 | [English](README.en.md)

在浏览器里写 Go，一关一关实现 MapReduce 和带版本号的键值服务器。代码保存在你电脑上的真实文件里，测试用真正的 `go test -race` 运行。灵感来自 MIT 6.5840（6.824）分布式系统课程的 Lab 1，题目、测试和代码均为原创。

## 开始

1. 安装 Go 1.22 或更新的版本：<https://go.dev/dl/>（macOS 也可以 `brew install go`）
2. 下载并运行：

   ```bash
   git clone https://github.com/woertedetiankong/distsys-dojo.git
   cd distsys-dojo
   go run .
   ```

3. 打开终端里打印出来的链接（会自动打开浏览器），进入**课程首页**。

网页有中文和英文两种模式，点右上角的「中 / EN」切换；课程首页、练功房和实验台共用这个设置，默认跟随浏览器语言。

课程首页按集组织，每一集按顺序走：读论文或讲义 → 玩实验台 → 练功房写代码 → 做真正的 MIT Lab（讲解视频之后会加上）。论文和 Lab 链接指向 MIT 课程官网，进度会自动记录在浏览器里。

练功房里你的代码在 `workspace/<练功房>/` 里（MapReduce 是 `workspace/mr/`），既可以在网页里写，也可以用 VS Code 打开这个文件夹编辑，两边会自动同步。

### 视频和实验台

实验台放在 `content/<集>/` 里，运行器在 `/content/` 下提供它们。讲解视频暂时还没有公开，所以课程首页里不会出现「看视频」这一步；以后发布时，视频会放在对应的 `content/epNN/video.mp4`，首页会自动显示它。（作者制作新的一集后，用 `python3 dev/sync_content.py` 把成品复制进来。）

## 练功房

### MapReduce（`mr`，第 1 集）

| 关 | 内容 | 练什么 |
|---|---|---|
| 1 | goroutine、WaitGroup、Mutex | 并发基础，`-race` 数据竞争检测 |
| 2 | channel 与工作池 | 限制并发数量 |
| 3 | Map、Reduce、分区 | `ihash(key) % nReduce` |
| 4 | Worker | RPC 协议、中间文件 |
| 5 | Coordinator | 任务状态、Map 完成前不能开始 Reduce、加锁 |
| 6 | 超时重新分配 | worker 宕机不会通知任何人 |
| 7 | 原子写入 | 慢机器导致重复执行，用 WriteTemp + Rename 解决 |

从第 4 关开始，代码运行在一个模拟集群里：worker 是真正的 goroutine，网络和文件系统由测试模拟，可以让 worker 宕机或变慢，思路和 MIT 的 labrpc 相同。为了让测试跑得快，超时阈值是 2 秒（真实 Lab 1 是 10 秒）。

### KV 服务器（`kv`，第 2 集）

| 关 | 内容 | 练什么 |
|---|---|---|
| 1 | 带版本号的 Get 和 Put | 版本号对上才写入，写入后加一 |
| 2 | 同时到来的请求 | 处理函数加锁，`-race` |
| 3 | Clerk | 把调用变成 RPC |
| 4 | 重试 | 消息会丢，失败后 sleep 再重发 |
| 5 | ErrMaybe | 重发过的 Put 被拒绝时，可能已经执行过了 |
| 6 | 用 Put 做一把锁 | 锁空着才写入自己的 id |
| 7 | 不可靠网络上的锁 | 收到 ErrMaybe 后读回来确认 |

测试跑在 `course/testdata/shared/netsim/` 这个模拟网络上：它能随机丢消息，也能精确地丢掉某个客户端的第 n 个请求或回复，思路和 MIT 的 labrpc 相同。

## 安全

运行器会在你的电脑上编译、运行代码，所以它：

- 只监听本机地址（127.0.0.1）；
- 每次启动生成一个随机口令，网页请求必须带上它，其他网站无法调用运行器；
- 检查 Host 和 Origin，防止 DNS 重绑定攻击。

## 目录

| 路径 | 内容 |
|---|---|
| `main.go` | 本地运行器：提供网页、读写代码文件、运行测试 |
| `web/js/course.js` | 课程数据：每一集的步骤、链接、对应的练功房 |
| `web/js/course.en.js` | 课程数据的英文文字，按 id 覆盖到 course.js 上 |
| `web/js/i18n.js` | 中英切换：`L(中文, English)`、英文覆盖、`data-en` 静态文字 |
| `web/index.html`、`web/js/hub.js` | 课程首页：各集的学习步骤和课程地图 |
| `web/dojo.html`、`web/js/app.js` | 练功房编辑器（`dojo.html?d=mr`） |
| `web/js/dojos/<练功房>.js` | 关卡讲解、分层提示、按失败原因给出的提示 |
| `web/js/dojos/<练功房>.en.js` | 同上的英文版，按关卡号覆盖 |
| `content/` | 各集的视频、章节和实验台 |
| `dev/sync_content.py` | 把做好的视频和实验台复制进 `content/` |
| `course/testdata/shared/dojo/` | MapReduce 的模拟集群（复制到 `workspace/dojo/`） |
| `course/testdata/shared/netsim/` | KV 练功房的模拟网络（复制到 `workspace/netsim/`） |
| `course/testdata/dojos/<练功房>/starter/` | 初始代码 |
| `course/testdata/dojos/<练功房>/tests/` | 各关测试（每次运行前复制到 `workspace/<练功房>/`） |
| `course/testdata/dojos/<练功房>/reference/` | 参考答案，**剧透**，做完再看 |
| `dev/check.py`、`dev/mutations.py` | 验证测试：参考答案全部通过，初始代码不通过，典型错误被对应的关卡抓到 |

测试的失败信息同时带中文和英文（`msg` 和 `msg_en`，在测试辅助函数里用 `say(中文, English, 参数...)` 生成），网页按当前模式显示其中一种。

运行 `python3 dev/check.py` 需要 `go` 在 PATH 里，全部跑完约 5 分钟。

## 学术诚信

这个项目帮助你理解原理、练习 Go 并发，不提供 MIT Lab 的答案。如果你正在修这门课，请遵守课程的合作政策，独立完成 Lab。

## 许可证

MIT
