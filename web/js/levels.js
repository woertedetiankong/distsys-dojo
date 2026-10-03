// 课程内容：每关的讲解、任务、分层提示，以及按失败原因给出的定向提示。
window.COURSE = {
  id: 'go-mr',
  levels: [
    {
      n: 1, short: 'goroutine', title: 'goroutine、WaitGroup 与锁', file: 'warmup.go',
      concept: `<p>分布式系统里到处是"同时发生的事"。Go 用 <b>goroutine</b> 表达它：在函数调用前加一个 <code>go</code>，这个函数就在后台运行，不用等它结束。</p>
        <p>两个问题随之而来。第一，怎么知道所有 goroutine 都做完了？用 <code>sync.WaitGroup</code>：开始前 <code>Add(1)</code>，结束时 <code>Done()</code>，最后 <code>Wait()</code>。第二，多个 goroutine 同时改同一个 map 怎么办？用 <code>sync.Mutex</code> 把修改包起来，一次只让一个进去。</p>
        <p>测试会开着 <b>-race</b> 数据竞争检测器运行。忘了加锁，它会当场指出是哪两行代码在打架。</p>`,
      task: ['实现 <code>CountWords</code>：为每段文本启动一个 goroutine 调用 count，把结果合并进 total。6 段文本要在 350 毫秒内全部完成。'],
      tests: {TestLv1_Correct: '合并结果正确', TestLv1_Parallel: '同时处理所有文本', TestLv1_Repeat: '连续运行 30 次都正确'},
      tiers: [
        '先写一个 for 循环，循环体里用 go func(...) { ... }(t) 启动 goroutine。注意把循环变量当参数传进去。',
        '用 WaitGroup 等所有 goroutine 结束：循环里 wg.Add(1)，goroutine 里 defer wg.Done()，循环后 wg.Wait()。',
        '再声明一个 var mu sync.Mutex。goroutine 拿到 count 的结果后，mu.Lock()，把每个词的次数加进 total，再 mu.Unlock()。'],
      byCode: {
        not_parallel: '这说明 count 是一次一次依次调用的。每次调用都要放进一个新的 goroutine 里。',
        wrong_total: '结果不对，最常见的原因是 CountWords 在 goroutine 做完之前就返回了。用 WaitGroup 等它们全部结束。',
        flaky: '有时对有时错，是并发程序的典型症状：有 goroutine 还没做完，函数就返回了。',
        race: '有两个 goroutine 在没有加锁的情况下同时访问了 total。看下面的报告，它指出了冲突的两行。',
        concurrent_map: 'Go 的 map 不允许多个 goroutine 同时写。修改 total 的代码要用 mu.Lock() 和 mu.Unlock() 包起来。',
      },
    },
    {
      n: 2, short: 'channel', title: 'channel 与工作池', file: 'warmup.go',
      concept: `<p>有时候不能无限制地开 goroutine，比如同时只允许 n 个任务访问磁盘。这就需要<b>工作池</b>。</p>
        <p>Go 的 <b>channel</b> 是 goroutine 之间传递数据的管道。带缓冲的 channel 有容量上限：<code>make(chan struct{}, n)</code> 最多装 n 个东西，装满了再往里放就会等待。把它当成 n 张通行证：开始干活前放一个进去，干完拿一个出来，同一时刻就最多只有 n 个在干活。</p>
        <p>这个模式之后会反复出现，比如限制同时发出的 RPC 数量。</p>`,
      task: ['实现 <code>RunPool</code>：同一时刻最多 n 个 f 在运行，并且要用满 n 个；<code>results[i]</code> 必须是 <code>f(jobs[i])</code>。'],
      tests: {TestLv2_PoolOf3: '3 个并发，12 个任务', TestLv2_PoolOf1: '1 个并发', TestLv2_PoolWide: '并发数等于任务数'},
      tiers: [
        '每个任务还是放在自己的 goroutine 里运行，再想办法限制同时运行的数量。',
        '建一个容量为 n 的 channel 当通行证：启动 goroutine 前往里放一个（满了会自动等待），goroutine 做完再取出一个。',
        '结果写进 results[i]，每个 goroutine 写的是不同的下标，所以不需要加锁。别忘了用 WaitGroup 等所有任务结束。'],
      byCode: {
        pool_order: '结果顺序不对。不要用 append 收集结果，直接写 results[i]，i 是任务在 jobs 里的下标。',
        pool_too_many: '同时运行的超过了 n 个，说明没有限制住。试试容量为 n 的 channel。',
        pool_serial: '同时运行的不到 n 个。是不是在主循环里等了每个任务结束？等待应该放在所有任务启动之后。',
        pool_slow: '太慢了，检查是否真的有 n 个任务在同时运行。',
        race: '有数据竞争。如果多个 goroutine 写同一个变量，要加锁；写 results 的不同下标是安全的。',
      },
    },
    {
      n: 3, short: 'map/reduce', title: 'map、reduce 与分区', file: 'mapreduce.go',
      concept: `<p>MapReduce 只让你写两个函数：<b>Map</b> 把一个文件变成一串中间键值对，<b>Reduce</b> 把一个键的所有值合并成结果。</p>
        <p>每个 Map 的输出要分给 nReduce 个 Reduce 任务。同一个键必须总是去同一个 Reduce，做法是 <code>ihash(key) % nReduce</code>，ihash 和 Lab 1 的完全相同。</p>
        <p>Reduce 收到的键值对是乱序的，要先把相同的键聚到一起，再对每个键调用一次 reduce 函数。</p>`,
      task: [
        '<code>Map</code>：用 <code>strings.FieldsFunc</code> 和 <code>unicode.IsLetter</code> 切出单词，返回 <code>KeyValue{单词, "1"}</code>。<code>Reduce</code>：返回 <code>strconv.Itoa(len(values))</code>。',
        '<code>Partition</code>：返回 nReduce 个桶，保持原来的顺序。',
        '<code>ReduceLines</code>：按键分组、排序，返回 <code>"键 结果"</code> 行。'],
      tests: {TestLv3_Map: 'Map 切出单词', TestLv3_Reduce: 'Reduce 计数', TestLv3_Partition: '用 ihash 分桶', TestLv3_ReduceLines: '分组、排序、调用 reduce'},
      tiers: [
        'Map 和 Lab 1 自带的 wc.go 几乎一样：FieldsFunc 的第二个参数是"哪些字符是分隔符"，也就是 !unicode.IsLetter(r)。',
        'Partition：先 make([][]KeyValue, nReduce)，再把每个 kv 追加到 b[ihash(kv.Key)%nReduce]。ReduceLines：用 map[string][]string 收集每个键的值。',
        'ReduceLines 收集完以后，把 map 的键放进一个切片，sort.Strings 排序，再按顺序生成 k + " " + reducef(k, groups[k])。'],
      byCode: {
        map_words: '检查返回值：每一项是 KeyValue{单词, "1"}，顺序和单词在文本中出现的顺序一致，大小写保持原样。',
        map_split: 'strings.Fields 只按空白切分，标点会粘在单词上。换成 strings.FieldsFunc，并且只把字母当作单词的一部分。',
        reduce_count: '用 strconv.Itoa 把个数转成字符串。',
        part_len: '返回的切片长度必须等于 nReduce，空桶也要保留。',
        part_bucket: '桶号是 ihash(kv.Key) % nReduce，是对键做哈希。',
        part_order: '每个桶里要保持原来的顺序，也不能丢失或重复。',
        not_grouped: '同一个键只能输出一行，要先把它所有的值收齐，再调用一次 reducef。',
        unsorted: '用 sort.Strings 对键排序。',
        lines_content: '每行的格式是：键、一个空格、reducef 的结果。',
      },
    },
    {
      n: 4, short: 'Worker', title: 'Worker：要任务、干活、汇报', file: 'worker.go',
      concept: `<p>从这一关开始，你的代码运行在一个<b>模拟集群</b>里：worker 是真正的 goroutine，网络和文件系统由测试模拟，可以随时让某个 worker 宕机或变慢。这和 MIT 自己的 labrpc 是同一个思路。</p>
        <p>Worker 用 <code>c.Call("Coordinator.GetTask", &amp;args, &amp;reply)</code> 向协调者要任务，回复里的 <code>Type</code> 有四种：MapTask、ReduceTask、WaitTask、ExitTask。协议定义在 <code>rpc.go</code>。</p>
        <p>中间文件叫 <code>mr-X-Y</code>（X 是 Map 编号，Y 是桶号），每行是一个 <code>json.Marshal(kv)</code>；输出文件叫 <code>mr-out-Y</code>，每行是 <code>键 结果</code>。文件读写用参数里的 <code>fs</code>，它对应 Lab 1 里的 os 包。</p>
        <p>这一关用一个按剧本回复的协调者来测试你的 worker。</p>`,
      task: [
        'MapTask：读 <code>reply.File</code> → mapf → Partition → 写 NReduce 个中间文件（空桶也要写）→ 调用 TaskDone。',
        'ReduceTask：读 <code>mr-0-Y</code> 到 <code>mr-(NMap-1)-Y</code> → 逐行 json.Unmarshal → ReduceLines → 写 <code>mr-out-Y</code> → 调用 TaskDone。',
        'WaitTask：<code>time.Sleep(100 * time.Millisecond)</code> 后继续；ExitTask：return。'],
      tests: {TestLv4_MapTask: '执行 Map 任务', TestLv4_ReduceTask: '执行 Reduce 任务', TestLv4_Wait: '收到 Wait 时先休息', TestLv4_Loop: '循环到 Exit 为止'},
      tiers: [
        '在循环里用 switch reply.Type 分出四个分支，先把 WaitTask 和 ExitTask 写好，再写 Map，最后写 Reduce。',
        'Map 分支：data, _ := fs.ReadFile(reply.File)，kvs := mapf(reply.File, string(data))，对 Partition(kvs, reply.NReduce) 的每个桶，把每个 kv 用 json.Marshal 编码成一行，写到 fmt.Sprintf("mr-%d-%d", reply.ID, y)。',
        'Reduce 分支：对 x := 0; x < reply.NMap; x++ 读 mr-x-Y，按 "\\n" 切分后逐行 json.Unmarshal 成 KeyValue；全部收齐后调用 ReduceLines，用 strings.Join 拼成一个文件写出。最后两个分支都要 c.Call("Coordinator.TaskDone", &TaskDoneArgs{...}, &TaskDoneReply{})。'],
      byCode: {
        no_inter_file: '每个 Map 任务都要写满 NReduce 个中间文件，桶是空的也要写一个空文件。',
        inter_format: '中间文件每一行是 json.Marshal(kv) 的结果，行与行之间用 "\\n" 分隔。',
        inter_content: '检查分区：第 y 个桶写到 mr-X-y，X 是 reply.ID。',
        no_task_done: '做完任务后要调用 TaskDone 汇报，Type 和 ID 要和收到的任务一致。',
        no_output: 'Reduce 的结果写到 fmt.Sprintf("mr-out-%d", reply.ID)。',
        out_content: '检查是否读了全部 NMap 个中间文件，以及每行是否正确解码。输出每行是 "键 结果"，行尾要有换行。',
        wait_count: '每收到一次回复就处理一次，不要多发也不要漏发请求。',
        no_sleep: '收到 WaitTask 后要 time.Sleep 一会儿再请求。',
        loop: '处理完一个任务后要回到循环开头继续请求，只有收到 ExitTask 才 return。',
        not_exit: '收到 ExitTask 时要 return。也检查一下有没有在别的地方卡住，比如死循环。',
        spin: '循环里不停地发请求。收到 WaitTask 要先 Sleep。',
        panic: '看 panic 信息里指向的那一行。常见原因是切片越界，或者对 nil 做了操作。',
      },
    },
    {
      n: 5, short: 'Coordinator', title: 'Coordinator：分配任务', file: 'coordinator.go',
      concept: `<p>协调者为每个任务记录状态：<b>待分配、进行中、已完成</b>。</p>
        <p>worker 来要任务时先分 Map。所有 Map <b>完成</b>之前，即使没有 Map 可分，也不能发 Reduce，只能回 WaitTask，因为任何一个还没完成的 Map 都可能产出某个 Reduce 需要的键。全部 Reduce 完成后 <code>Done()</code> 返回 true，之后来请求的 worker 都回 ExitTask。</p>
        <p>多个 worker 会<b>同时</b>调用 GetTask 和 TaskDone，测试也会同时调用 Done()。所以协调者的所有字段都要用一把 <code>sync.Mutex</code> 保护，每个方法一开始就 <code>Lock()</code>，再 <code>defer Unlock()</code>。</p>
        <p>这一关没有故障，用的是你在第 4 关写的 worker。</p>`,
      task: ['实现 <code>MakeCoordinator</code>、<code>GetTask</code>、<code>TaskDone</code>、<code>Done</code>。回复里填好 NReduce 和 NMap。'],
      tests: {TestLv5_Basic: '3 个 worker 跑完整个作业', TestLv5_OneWorker: '只有 1 个 worker', TestLv5_Parallel: '任务并行且不重复分配', TestLv5_OneReduce: 'nReduce = 1'},
      tiers: [
        '在结构体里加一把 mu sync.Mutex，再为 Map 和 Reduce 各存一个状态切片。',
        'GetTask 的顺序：还有没完成的 Map 吗？有的话找一个待分配的分出去并标成进行中，找不到就回 WaitTask。Map 全部完成后，用同样的方法处理 Reduce。全部完成就回 ExitTask。',
        'TaskDone 根据 args.Type 和 args.ID 把任务标成已完成。Done 判断是否所有 Reduce 都已完成。三个方法和 Done 都要先 c.mu.Lock(); defer c.mu.Unlock()。'],
      byCode: {
        never_done: '作业一直没结束。检查 TaskDone 有没有把任务标成已完成，以及 Done() 的判断条件。',
        early_reduce: '"已经分出去"不等于"已经完成"。只有所有 Map 都收到 TaskDone 之后，才能开始分 Reduce。',
        dup_assign: '分出去的任务要立刻标成进行中，否则下一个 worker 会领到同一个任务。',
        no_parallel: '每个 worker 来请求时，只要还有待分配的任务，就应该马上分给它。',
        no_exit: '作业完成后，再来请求的 worker 应该收到 ExitTask。',
        bad_reply: '检查回复的字段：Map 要填 ID、File、NReduce；Reduce 要填 ID、NMap。',
        race: '协调者的字段被多个 goroutine 同时访问。GetTask、TaskDone、Done 每个方法都要加锁，包括只读的 Done。',
        wrong_output: '输出不对，但没有故障。先确认第 3、4 关都通过了。',
        spin: '可以分配任务时不要回 WaitTask；worker 收到 WaitTask 也要 Sleep。',
        timeout: '可能是死锁：比如加了锁之后提前 return 却没有解锁。用 defer c.mu.Unlock() 可以避免。',
      },
    },
    {
      n: 6, short: '超时重试', title: '容错：超时重新分配', file: 'coordinator.go',
      concept: `<p>worker 随时可能宕机，而<b>宕机的 worker 不会通知任何人</b>。协调者分不清它是死了，还是只是慢。</p>
        <p>唯一的办法是计时：任务分出去超过一段时间还没完成，就当它失败了，重新分给别人。Lab 1 用 10 秒，这里用 <code>dojo.Timeout</code>（2 秒），让测试跑快一些。记录开始时间用 <code>time.Now()</code>，判断超时用 <code>time.Since(start) &gt; dojo.Timeout</code>。</p>
        <p>被判定超时的 worker 可能只是慢，之后仍然可能汇报完成。同一个任务可能收到两次 TaskDone，你的协调者要能正确处理。</p>`,
      task: ['在 <code>coordinator.go</code> 里 import <code>"lab/dojo"</code> 和 <code>"time"</code>。记录每个任务的开始时间，进行中超过 <code>dojo.Timeout</code> 的任务可以重新分配。'],
      tests: {TestLv6_CrashInMap: 'Map 进行中 worker 宕机', TestLv6_CrashInReduce: 'Reduce 进行中 worker 宕机', TestLv6_CrashTwice: '两台宕机，后来加入新 worker'},
      tiers: [
        '分配任务时，把 time.Now() 存到这个任务的状态里。',
        '在 GetTask 里找任务时，除了待分配的，还要把"进行中，但 time.Since(开始时间) > dojo.Timeout"的任务也当成可以分配的。',
        '每个任务存成 struct{ state int; start time.Time }。找任务的条件写成：state 是待分配，或者 state 是进行中且已经超时。分出去时同时更新 state 和 start。'],
      byCode: {
        no_reassign: '宕机的 worker 手上的任务永远不会完成。协调者要靠超时发现，把任务重新分出去。打开时间线，看看是哪个任务一直处于进行中。',
        never_done: '如果作业卡住，看看时间线：哪个任务一直没完成？它所在的 worker 是不是宕机了？',
        wrong_output: '有宕机时输出出错，可能是重复的 TaskDone 处理错了。',
        race: '记录时间的字段同样要在锁里读写。',
      },
    },
    {
      n: 7, short: '原子写入', title: '原子写入：重复执行也无害', file: 'worker.go',
      concept: `<p>超时重新分配有一个副作用：原来的 worker 可能没死，只是慢。于是<b>两个 worker 同时执行同一个任务，写同一个文件</b>。</p>
        <p><code>fs.WriteFile</code> 会先清空文件，再一行一行写入。两个写者交错时，文件内容就乱了；另一个 worker 也可能读到写了一半的中间文件。</p>
        <p>解决办法：先用 <code>fs.WriteTemp</code> 写一个只有自己知道名字的临时文件，写完再 <code>fs.Rename</code> 成最终名字。Rename 是原子的，读者要么看到完整的旧文件，要么看到完整的新文件。Lab 1 里对应的是 <code>os.CreateTemp</code> 和 <code>os.Rename</code>。</p>`,
      task: ['把 <code>worker.go</code> 里所有的 <code>fs.WriteFile</code> 改成"<code>fs.WriteTemp</code> + <code>fs.Rename</code>"，中间文件和输出文件都要改。'],
      tests: {TestLv7_SlowMap: '慢机器导致 Map 重复执行', TestLv7_SlowReduce: '慢机器导致 Reduce 重复执行', TestLv7_SlowAndCrash: '慢机器加宕机'},
      tiers: [
        '不只是输出文件，中间文件也可能被两个 worker 同时写。',
        'tmp, err := fs.WriteTemp(data) 返回临时文件名，再 fs.Rename(tmp, 最终名字)。',
        '写一个辅助函数 func put(fs dojo.FS, name string, data []byte)，里面先 WriteTemp 再 Rename，然后把所有 WriteFile 换成 put。'],
      byCode: {
        wrong_output: '有的计数偏大或偏小，说明有文件被两个 worker 交错写入，或者 Reduce 读到了写了一半的中间文件。打开时间线，找找同一个任务被执行了两次的地方。',
        no_reassign: '这一关的测试里也有宕机和慢机器，先确保第 6 关通过。',
      },
    },
  ],
  common: {
    build: '代码没能编译。看下面的错误，点击可以跳到对应的行。',
    race: '-race 检测到数据竞争。报告里成对出现的两段调用栈，就是同时访问同一个变量的两处代码。',
    concurrent_map: '多个 goroutine 同时写了同一个 map。用 sync.Mutex 保护它。',
    panic: '代码发生了 panic，看错误信息里指向你代码的那一行。',
    timeout: '测试超时，常见原因是死锁：加锁后提前 return 忘了解锁，或者持有锁时等待别的 goroutine。',
  },
};
