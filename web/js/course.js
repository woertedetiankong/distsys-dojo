// 课程数据：课程首页（hub.js）读这里。加一集 = 在 EPISODES 里加一项。
// 英文版的文字在 course.en.js 里，按 id 对应；没写英文的字段沿用这里的中文。
//
// status: ready = 全部材料齐了；partial = 只有部分材料；planned = 还没做，只在课程地图里占位
// steps:  按顺序列出这一集有的步骤，可选 video / reading / lab / dojo / assignment
//   video       需要 content/<id>/video.mp4 和 chapters.json（dev/sync_content.py 生成）
//   reading     {title, url?, urlLabel?, urlNote?, notes?, notesLabel?, links?: [{label, url, note?}], time?, read: [...], ask: [...]}
//   lab         {questions: 预测题个数, desc, time?} → content/<id>/lab.html；实验台把答过的题号存进 localStorage 'course.<id>.lab.answered'
//   dojo        练功房 id（= course/testdata/dojos/<dojo> 目录名），过关记录在 'dojo.<dojo>.passed'；dojoTime、dojoDesc、dojoLinks: [{label, url}]
//   assignment  {title, url, urlLabel?, short?（如 'Lab 1'）, desc?, notes: [...], time?} 真正的 MIT Lab
const MIT = 'https://pdos.csail.mit.edu/6.824/';

window.COURSE_META = {
  title: '分布式系统练功房',
  subtitle: 'MIT 6.5840 自学路线',
  mapNote: '按 MIT 6.5840 的课表和 Lab 顺序排列，一集讲清一个核心机制。',
  footer: '论文、讲义和 Lab 链接指向 MIT 6.5840 课程官网。这里的视频、实验台和练功房是自学用的辅助材料，题目和测试均为原创。如果你正在修这门课，请遵守课程的合作政策，独立完成 Lab。',
};

window.EPISODES = [
  {id: 'ep00', n: 0, title: '总览：分布式系统是什么', group: '开篇', status: 'partial',
   desc: '从一台机器的极限讲起：横向扩展、不可靠的网络、复制与共识。先建立一张全局地图，再进入第 1 集。',
   steps: ['video'], videoTime: '约 3 分钟'},
  {id: 'ep01', n: 1, title: 'MapReduce', group: '基础', status: 'ready',
   desc: '你只写 map 和 reduce 两个函数，框架负责拆分、调度和容错。这一集的重点是：worker 宕机后怎么办，以及为什么重复执行也不会出错。',
   steps: ['video', 'reading', 'lab', 'dojo', 'assignment'], videoTime: '约 6 分钟',
   reading: {title: 'MapReduce: Simplified Data Processing on Large Clusters（OSDI 2004）', time: '2 到 4 小时',
     url: MIT + 'papers/mapreduce.pdf', urlLabel: '打开论文 PDF', urlNote: 'MIT ↗', notes: MIT + 'notes/l01.txt', notesLabel: '第 1 讲讲义',
     links: [{label: '课堂录像', note: 'YouTube 搜索 ↗', url: 'https://www.youtube.com/results?search_query=MIT+6.824+Lecture+1+Introduction'}],
     read: ['第 1、2 节：编程模型和例子，快速读', '第 3 节：实现，重点读', '§3.3 容错：worker 宕机和 master 宕机分别怎么处理', '§3.6 备份任务：为什么要给"拖后腿"的任务再跑一份'],
     ask: ['已完成的 Map 任务为什么也要重跑，已完成的 Reduce 却不用？', 'Map 函数如果不是确定性的，会出什么问题？', '论文里的 master 宕机了怎么办？为什么这样设计是可以接受的？']},
   lab: {questions: 6, time: '约 1 小时', desc: '先做 6 道预测题：每题先自己选答案，再在模拟器里运行同样的场景验证。然后自己动手让 worker 宕机、制造慢机器、关掉原子重命名。'},
   dojo: 'mr', dojoTime: '6 到 15 小时',
   dojoDesc: '用 Go 一关一关实现 MapReduce：goroutine 与锁、channel、Map/Reduce、Worker、Coordinator、超时重试、原子写入。测试用真正的 go test -race 运行。',
   dojoLinks: [{label: '没学过 Go？先做 A Tour of Go', url: 'https://go.dev/tour/'}],
   assignment: {title: '做真正的 Lab 1', short: 'Lab 1', time: '5 到 15 小时', url: MIT + 'labs/lab-mr.html', urlLabel: '打开 Lab 1 说明', urlNote: 'MIT ↗',
     desc: '去 MIT 课程官网拿 Lab 1 的代码，用 test-mr.sh 测试。思路和练功房完全相同，需要改的是接口：',
     notes: ['RPC 用 Go 标准库 net/rpc，通过 unix socket 通信', '文件读写用 os 包：os.CreateTemp 加 os.Rename', '超时阈值是 10 秒，练功房里是 2 秒', 'worker 和协调者是不同的进程，用 go run 分别启动']}},
  {id: 'ep02', n: 2, title: 'RPC 与 Go 并发', group: '基础', status: 'ready',
   desc: '网络会弄丢消息：等不到回复时，客户端分不清是请求丢了、回复丢了还是服务器挂了。重试能补救，却可能让同一个操作执行两次；带版本号的 Put 让重复的请求不会被执行第二次。',
   steps: ['video', 'reading', 'lab', 'dojo', 'assignment'], videoTime: '约 6 分钟',
   reading: {title: '第 2 讲 RPC and Threads 的讲义和示例代码（这一讲没有论文）', time: '1 到 2 小时',
     url: MIT + 'notes/l-rpc.txt', urlLabel: '打开讲义', urlNote: 'MIT ↗',
     links: [{label: 'kv.go', url: MIT + 'notes/kv.go'}, {label: 'crawler.go', url: MIT + 'notes/crawler.go'}, {label: 'A Tour of Go', url: 'https://go.dev/tour/'}],
     read: ['讲义前半：为什么用 Go、goroutine、锁、channel、条件变量', 'crawler.go：同一个爬虫的串行、加锁、channel 三种写法', 'kv.go：一个最小的 RPC 键值服务，对照客户端和服务器两边', '讲义后半：RPC 的失败、至少一次与至多一次'],
     ask: ['crawler 的加锁版本里，如果不加锁会出什么事？-race 会报什么？', 'kv.go 的服务器为什么每个处理函数都要加锁？', '收不到回复时，客户端能区分「请求丢了」和「回复丢了」吗？']},
   lab: {questions: 6, time: '约 1 小时', desc: '先做 6 道预测题，再在模拟器里亲手弄丢一封信或一封回信、关掉重试、关掉 ErrMaybe 规则，看重复执行和「不是实话的答复」怎么出现。'},
   dojo: 'kv', dojoTime: '4 到 8 小时',
   dojoDesc: '用 Go 一关一关写出键值服务器：版本号规则、加锁、Clerk、重试、ErrMaybe、用 Put 做锁。测试跑在一个会按指定方式丢消息的模拟网络上，用真正的 go test -race 运行。',
   assignment: {title: '做真正的 Lab 2', short: 'Lab 2', time: '5 到 10 小时', url: MIT + 'labs/lab-kvsrv1.html', urlLabel: '打开 Lab 2 说明', urlNote: 'MIT ↗',
     desc: '去 MIT 课程官网拿 Lab 2 的代码，分四步：',
     notes: ['可靠网络上的 Get 和带版本号的 Put（server.go、client.go）', '用 Clerk 实现锁（lock/lock.go），用 kvtest.RandValue(8) 生成客户端 id', '不可靠网络：Call 失败就 sleep 100 毫秒重发；重发过的 Put 收到 ErrVersion 返回 ErrMaybe', '在不可靠网络上让锁也正确']}},
  {id: 'ep03', n: 3, title: '线性一致性', group: '基础', status: 'planned', assignment: {short: 'Lab 2'}},
  {id: 'ep04', n: 4, title: '主备复制：VMware FT', group: '复制', status: 'planned'},
  {id: 'ep05', n: 5, title: 'GFS', group: '复制', status: 'planned'},
  {id: 'ep06', n: 6, title: 'Raft：选出领导者', group: 'Raft', status: 'planned', assignment: {short: 'Lab 3A'}},
  {id: 'ep07', n: 7, title: 'Raft：日志复制', group: 'Raft', status: 'planned', assignment: {short: 'Lab 3B'}},
  {id: 'ep08', n: 8, title: 'Raft：持久化与安全性', group: 'Raft', status: 'planned', assignment: {short: 'Lab 3C'}},
  {id: 'ep09', n: 9, title: 'Raft：快照', group: 'Raft', status: 'planned', assignment: {short: 'Lab 3D'}},
  {id: 'ep10', n: 10, title: '在 Raft 上搭 KV 服务', group: 'Raft', status: 'planned', assignment: {short: 'Lab 4'}},
  {id: 'ep11', n: 11, title: 'ZooKeeper', group: '协调服务', status: 'planned'},
  {id: 'ep12', n: 12, title: '链式复制与 CRAQ', group: '协调服务', status: 'planned'},
  {id: 'ep13', n: 13, title: '分片与配置变更', group: '分片与事务', status: 'planned', assignment: {short: 'Lab 5'}},
  {id: 'ep14', n: 14, title: '分布式事务：2PC 与 2PL', group: '分片与事务', status: 'planned'},
  {id: 'ep15', n: 15, title: 'Spanner', group: '分片与事务', status: 'planned'},
  {id: 'ep16', n: 16, title: 'FaRM', group: '分片与事务', status: 'planned'},
  {id: 'ep17', n: 17, title: 'Aurora', group: '存储与缓存', status: 'planned'},
  {id: 'ep18', n: 18, title: 'Frangipani', group: '存储与缓存', status: 'planned'},
  {id: 'ep19', n: 19, title: 'Memcache at Facebook', group: '存储与缓存', status: 'planned'},
  {id: 'ep20', n: 20, title: 'Spark、COPS 与 Bitcoin', group: '拓展', status: 'planned'},
];

// 2026-10 起练功房按 id 区分（mr、kv），步骤名改成 reading / assignment。把旧版本存下的进度搬过来，只搬一次。
(() => { try {
  for (const k of ['level', 'passed', 'hints']){
    const o = localStorage.getItem('dojo.go-mr.' + k);
    if (o != null && localStorage.getItem('dojo.mr.' + k) == null) localStorage.setItem('dojo.mr.' + k, o);
  }
  const p = JSON.parse(localStorage.getItem('course.progress') || '{}');
  let changed = false;
  for (const ep of Object.values(p)){
    if ('paper' in ep && !('reading' in ep)){ ep.reading = ep.paper; delete ep.paper; changed = true; }
    if ('mitlab' in ep && !('assignment' in ep)){ ep.assignment = ep.mitlab; delete ep.mitlab; changed = true; }
  }
  if (changed) localStorage.setItem('course.progress', JSON.stringify(p));
} catch {} })();
