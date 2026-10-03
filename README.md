# 分布式系统练功房

在浏览器里写 Go，一关一关实现 MapReduce。代码保存在你电脑上的真实文件里，测试用真正的 `go test -race` 运行。灵感来自 MIT 6.5840（6.824）分布式系统课程的 Lab 1，题目、测试和代码均为原创。

## 开始

1. 安装 Go 1.22 或更新的版本：<https://go.dev/dl/>（macOS 也可以 `brew install go`）
2. 下载并运行：

   ```bash
   git clone https://github.com/woertedetiankong/distsys-dojo.git
   cd distsys-dojo
   go run .
   ```

3. 打开终端里打印出来的链接（会自动打开浏览器），进入**课程首页**。

课程首页按集组织，每一集分 5 步：看视频 → 读论文 → 玩实验台 → 练功房写代码 → 做真正的 MIT Lab。视频可以按章节跳着看，论文和 Lab 链接指向 MIT 课程官网，进度会自动记录在浏览器里。

练功房里你的代码在 `workspace/mr/` 里，既可以在网页里写，也可以用 VS Code 打开这个文件夹编辑，两边会自动同步。

### 视频和实验台

视频和实验台放在 `content/<集>/` 里，运行器在 `/content/` 下提供它们。视频文件较大，没有放进 git 仓库，会发布在 GitHub 的 Releases 页面：下载后放到对应的 `content/epNN/video.mp4` 即可。（作者制作新的一集后，用 `python3 dev/sync_content.py` 把成品复制进来。）

## 7 关

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

## 安全

运行器会在你的电脑上编译、运行代码，所以它：

- 只监听本机地址（127.0.0.1）；
- 每次启动生成一个随机口令，网页请求必须带上它，其他网站无法调用运行器；
- 检查 Host 和 Origin，防止 DNS 重绑定攻击。

## 目录

| 路径 | 内容 |
|---|---|
| `main.go` | 本地运行器：提供网页、读写代码文件、运行测试 |
| `web/index.html`、`web/js/hub.js` | 课程首页：各集的学习步骤和课程地图 |
| `web/dojo.html`、`web/js/app.js` | 练功房编辑器 |
| `content/` | 各集的视频、章节和实验台 |
| `dev/sync_content.py` | 把做好的视频和实验台复制进 `content/` |
| `web/js/levels.js` | 关卡讲解、分层提示、按失败原因给出的提示 |
| `course/testdata/dojo/` | 模拟集群（复制到 `workspace/dojo/`） |
| `course/testdata/mr/starter/` | 初始代码 |
| `course/testdata/mr/tests/` | 各关测试（每次运行前复制到 `workspace/mr/`） |
| `course/testdata/mr/reference/` | 参考答案，**剧透**，做完再看 |
| `dev/check.py` | 验证测试：参考答案全部通过，典型错误被对应的关卡抓到 |

运行 `python3 dev/check.py` 需要 `go` 在 PATH 里，全部跑完约 5 分钟。

## 学术诚信

这个项目帮助你理解原理、练习 Go 并发，不提供 MIT Lab 的答案。如果你正在修这门课，请遵守课程的合作政策，独立完成 Lab。

## 许可证

MIT
