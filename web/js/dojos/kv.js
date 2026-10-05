// 练功房 kv 的课程内容：每关的讲解、任务、分层提示，以及按失败原因给出的定向提示。
// 文件名 = 练功房 id = course/testdata/dojos/kv/ 目录名 = Go 包名。
window.COURSE = {
  id: 'kv',
  title: 'Go 练功房',
  subtitle: 'KV 服务器 · 7 关',
  fileOrder: ['server.go', 'clerk.go', 'lock.go', 'common.go'],
  finalNote: '7 关全部完成！现在可以去写真正的 MIT Lab 2 了。',
  timelineIntro: '从第 3 关开始，测试通过模拟网络调用服务器。这里会画出每个客户端的每一次 RPC：一条横条是一次调用，红叉是丢掉的请求或回复。',
  levels: [
    {
      n: 1, short: '版本号', title: '带版本号的 Get 和 Put', file: 'server.go',
      concept: `<p>服务器为每个键存两样东西：<b>值</b>和<b>版本号</b>。Get 把两样都返回。</p>
        <p>Put 带着一个版本号，意思是「我看到的是第几版」。只有版本号和服务器上的一致时才写入，并把版本号加一；对不上就返回 <code>ErrVersion</code>，什么都不改。新建一个键时用版本号 0，写入后它是第 1 版。</p>
        <p>这个规则是后面所有关卡的基础：它让服务器能识别「过时的」修改，包括网络重发造成的重复修改。</p>`,
      task: [
        '在 <code>Server</code> 里加一个 map，从键映射到「值和版本号」；在 <code>NewServer</code> 里初始化它。',
        '<code>Get</code>：键存在就返回值、版本号和 <code>OK</code>，否则 <code>ErrNoKey</code>。',
        '<code>Put</code>：键不存在时，版本号是 0 就新建，否则 <code>ErrNoKey</code>；键存在时，版本号相等才写入并加一，否则 <code>ErrVersion</code>。'],
      tests: {TestLv1_NewKey: '新建一个键', TestLv1_Versions: '版本号对上才写入', TestLv1_NoKey: '不存在的键'},
      tiers: [
        '先定义一个小结构体 type entry struct { value string; version int }，再在 Server 里放 data map[string]entry。',
        'Get：e, ok := s.data[args.Key]，不存在就 reply.Err = ErrNoKey。存在就把 e.value、e.version 和 OK 填进 reply。',
        'Put：e, ok := s.data[args.Key]。如果 !ok && args.Version != 0 返回 ErrNoKey；如果 e.version != args.Version 返回 ErrVersion（键不存在时 e.version 是 0，正好对得上「新建」）；否则 s.data[key] = entry{args.Value, e.version + 1}。'],
      byCode: {
        get_missing: 'Get 一个不存在的键时，要把 reply.Err 设成 ErrNoKey。',
        put_new: '新建键的规则：键不存在且 args.Version == 0 时写入，写入后版本号是 1，返回 OK。',
        put_match: '版本号对得上时要写入，并把 reply.Err 设成 OK。',
        version_not_bumped: '每次成功的 Put 都要把版本号加一，新建的键是第 1 版。',
        wrong_version_accepted: '先比较版本号再写入：args.Version 和服务器上的版本号不相等时，返回 ErrVersion，不能改值。',
        no_key: '键不存在、版本号又大于 0，说明调用者以为这个键已经存在了，要返回 ErrNoKey，并且不要新建它。',
      },
    },
    {
      n: 2, short: '加锁', title: '同时到来的请求', file: 'server.go',
      concept: `<p>真实的服务器会同时收到很多 RPC，Go 为每个 RPC 启动一个 goroutine，所以 <code>Get</code> 和 <code>Put</code> 会<b>同时</b>运行，改的是同一个 map。</p>
        <p>Put 的「先比较版本号、再写入」必须是一个整体：如果两个 Put 同时比较、都发现版本号对得上、再先后写入，就有一次修改被悄悄覆盖了。用 <code>s.mu</code> 把每个处理函数整个包起来，让它们一个一个地执行。</p>
        <p>测试开着 <b>-race</b>：没加锁的话，它会指出是哪两行代码在同时访问 map。</p>`,
      task: ['在 <code>Get</code> 和 <code>Put</code> 的开头加锁，在返回前解锁。测试会让 8 个 goroutine 同时用「读版本、带版本写」的方式给一个计数器加一。'],
      tests: {TestLv2_ConcurrentCounter: '8 个 goroutine 同时加计数器', TestLv2_ManyKeys: '同时写很多个键'},
      tiers: [
        'Get 也要加锁：读 map 的同时别人在写，同样是数据竞争。',
        '最简单的写法是每个处理函数第一行 s.mu.Lock()，第二行 defer s.mu.Unlock()。',
        '锁要覆盖「读版本号、比较、写入」整个过程，不能只包住写入那一行。'],
      byCode: {
        lost_update: '有修改被覆盖了：两个 Put 同时通过了版本号检查。把比较和写入放在同一段加锁的代码里。',
        put_never_ok: '用刚读到的版本号 Put 却一直不 OK，说明第 1 关的版本号规则还没写好，先回去通过第 1 关。',
        race: '-race 报告了数据竞争：有处理函数在没加锁的情况下读写了 map。看报告里成对出现的两段调用栈。',
      },
    },
    {
      n: 3, short: 'Clerk', title: 'Clerk：把调用变成 RPC', file: 'clerk.go',
      concept: `<p><b>Clerk</b> 是客户端库。程序调用 <code>ck.Get(key)</code>，Clerk 把参数装进 <code>GetArgs</code>，通过网络发给服务器的 <code>Server.Get</code>，再把 <code>GetReply</code> 里的结果返回。</p>
        <p><code>ck.end.Call("Server.Get", &args, &reply)</code> 返回 true 表示收到了回复，reply 已经填好。这一关的网络是可靠的，Call 总会返回 true。</p>`,
      task: ['实现 <code>Clerk.Get</code>：调用 <code>"Server.Get"</code>，返回值、版本号和 Err。', '实现 <code>Clerk.Put</code>：调用 <code>"Server.Put"</code>，返回 Err。'],
      tests: {TestLv3_GetPut: '写入再读出', TestLv3_Errors: '错误原样返回', TestLv3_TwoClerks: '两个客户端'},
      tiers: [
        'args := GetArgs{Key: key}；var reply GetReply；ck.end.Call("Server.Get", &args, &reply)。',
        'Call 的第二、三个参数要传指针。方法名必须是 "Server.Get" 和 "Server.Put"。',
        'Get 返回 reply.Value, reply.Version, reply.Err；Put 返回 reply.Err。服务器的错误（ErrNoKey、ErrVersion）要原样交给调用者。'],
      byCode: {
        clerk_get: 'Clerk.Get 要把 reply 里的 Value、Version、Err 三个字段都返回。检查方法名是不是 "Server.Get"。',
        clerk_put: 'Clerk.Put 要把服务器的 reply.Err 原样返回，包括 ErrVersion 和 ErrNoKey。',
        clerk_calls: '可靠的网络上，一次 Get 或 Put 只需要发一个 RPC。',
        clerk_hang: 'Clerk 卡住了。这一关的网络不会丢消息，Call 会返回 true，收到回复就该返回。',
      },
    },
    {
      n: 4, short: '重试', title: '不可靠的网络：重试', file: 'clerk.go',
      concept: `<p>现在网络会丢消息。<code>Call</code> 返回 false 时，你不知道丢的是请求还是回复，只知道没收到答复。唯一的办法是<b>重发</b>，直到收到回复为止。</p>
        <p>重发前先等一下：<code>time.Sleep(RetryWait)</code>。不等的话，网络断开时客户端会疯狂地发请求，白白占满网络和服务器。</p>
        <p>对 Get 来说，重发永远安全。对 Put 呢？版本号会挡住重复执行，但返回值有个坑，留到下一关。</p>`,
      task: ['把 <code>Get</code> 和 <code>Put</code> 改成循环：Call 返回 true 就返回结果；返回 false 就 <code>time.Sleep(RetryWait)</code> 再发一次。'],
      tests: {TestLv4_LostRequest: '请求丢了', TestLv4_LostReply: '回复连丢两次', TestLv4_PutLostRequest: 'Put 的请求丢了', TestLv4_NoSpin: '断网时不要狂发', TestLv4_Unreliable: '30% 丢包下读写 20 次'},
      tiers: [
        '用 for { … } 包住 Call。Call 返回 true 时从循环里 return。',
        '每次循环都要新建 reply 变量（var reply GetReply 放在循环里面），免得上一次的残留混进来。',
        'Call 返回 false 后、下一次循环前，time.Sleep(RetryWait)。'],
      byCode: {
        no_retry: 'Call 返回 false 时不能直接返回，要重发，直到收到回复。',
        no_sleep: '重发太频繁了。每次失败后先 time.Sleep(RetryWait) 再重发。',
      },
    },
    {
      n: 5, short: 'ErrMaybe', title: '可能成功了：ErrMaybe', file: 'clerk.go',
      concept: `<p>设想 Put 的回复丢了：服务器已经执行了，版本号加了一。Clerk 重发同一个 Put，带的还是旧版本号，于是收到 <code>ErrVersion</code>。</p>
        <p>这时 Clerk 分不清两种情况：是自己第一次已经成功了，还是被别的客户端抢先改了。它不能说 OK，也不能说 ErrVersion（那等于断言「没执行」），只能如实返回 <b><code>ErrMaybe</code></b>。</p>
        <p>规则只在一种情况下生效：<b>这个 Put 重发过，而且收到 ErrVersion</b>。第一次发送就被拒绝，是确定的 ErrVersion；重发后收到 OK，就是确定的 OK。</p>`,
      task: ['在 <code>Clerk.Put</code> 里记住「这个 Put 有没有重发过」。重发过又收到 <code>ErrVersion</code> 时返回 <code>ErrMaybe</code>，其他情况照常返回。'],
      tests: {TestLv5_LostPutReply: 'Put 的回复丢了', TestLv5_FirstTryRefused: '第一次就被拒绝', TestLv5_RetriedThenOK: '重发后成功', TestLv5_FreshEachPut: '每个 Put 单独记'},
      tiers: [
        '在 Put 的循环前面声明 retried := false；Call 返回 false 时把它设成 true。',
        '收到回复后：if reply.Err == ErrVersion && retried { return ErrMaybe }，否则 return reply.Err。',
        'retried 要是 Put 里的局部变量，不要放进 Clerk 结构体，否则上一个 Put 的状态会带到下一个。'],
      byCode: {
        maybe_missing: '重发过的 Put 收到 ErrVersion 时，第一次可能已经成功了，要返回 ErrMaybe。',
        maybe_too_eager: '第一次发送就被拒绝，Clerk 确切知道它没有执行，要返回 ErrVersion。只有重发过的 Put 才说「可能」。',
        maybe_on_ok: '收到 OK 就是确定的成功，即使重发过也返回 OK。ErrMaybe 只用于「重发过并且收到 ErrVersion」。',
        maybe_sticky: '「是否重发过」是每个 Put 自己的事。用 Put 里的局部变量记，不要存在 Clerk 里。',
        fail: '服务器上的结果不对，先确认第 1 关和第 4 关都已经通过。',
        no_retry: 'Clerk 没有返回或者放弃了。Call 返回 false 时要 sleep 后重发，第 4 关的重试逻辑这里同样需要。',
      },
    },
    {
      n: 6, short: '锁', title: '用 Put 做一把锁', file: 'lock.go',
      concept: `<p>很多客户端想轮流使用一样东西，就需要一把锁。我们用一个键来表示它：值是空字符串表示没人拿着，否则是持有者的 <b>id</b>（每个 Lock 用 <code>NewID()</code> 生成）。</p>
        <p>加锁：读锁的键；如果空着，就用刚读到的版本号 Put 自己的 id。两个客户端同时抢时，只有一个的版本号对得上，另一个收到 ErrVersion，重新读、重新等。锁被别人拿着时，等一会儿再读。</p>
        <p>解锁：用自己看到的版本号把值写回空字符串。</p>`,
      task: [
        '<code>Acquire</code>：循环读锁的键（不存在时当作空，版本号 0）；空着就 Put 自己的 id，OK 就返回；否则 sleep 一下再来。',
        '<code>Release</code>：读到版本号，把值 Put 成空字符串。'],
      tests: {TestLv6_OneClient: '一个客户端加锁解锁', TestLv6_Waits: '锁被拿着时要等', TestLv6_Contention: '4 个客户端各加锁 5 次'},
      tiers: [
        'value, version, err := lk.ck.Get(lk.key)；如果 err == ErrNoKey，把 value 当作 ""，version 当作 0。',
        '只有 value == "" 时才 Put(lk.key, lk.id, version)。收到 OK 就拿到了锁；收到 ErrVersion 说明被别人抢先，回到循环开头。',
        '锁被别人拿着（value 不是空）时，time.Sleep(RetryWait) 后再读。Release：读出 version，Put(lk.key, "", version)。'],
      byCode: {
        two_holders: '两个客户端同时拿着锁。只有锁空着（值为 ""）时才能写入自己的 id，而且要带上刚读到的版本号。',
        lock_stuck: '有客户端一直拿不到锁或者解不了锁。检查：键不存在时有没有用版本号 0 新建；解锁有没有真的把值写回空字符串。',
        lock_value: '锁的键里应该是持有者自己的 id（lk.id），解锁后应该是空字符串。',
      },
    },
    {
      n: 7, short: '不可靠的锁', title: '在会丢消息的网络上加锁', file: 'lock.go',
      concept: `<p>现在加锁的 Put 也可能收到 <code>ErrMaybe</code>：自己的 id 也许已经写进去了，只是回复丢了。</p>
        <p>如果把 ErrMaybe 当作失败，接下来读到的锁「被人拿着」，等的正是自己，永远等不到。正确的做法是<b>读回来确认</b>：锁的值等于自己的 id，就是拿到了。</p>
        <p>解锁也一样：解锁的 Put 收到 ErrMaybe，或者读到的值已经不是自己的 id，说明之前的解锁已经生效了。</p>`,
      task: ['让 <code>Acquire</code> 和 <code>Release</code> 正确处理 <code>ErrMaybe</code>，并在 20% 丢包的网络上保持正确。'],
      tests: {TestLv7_LostAcquireReply: '加锁的回复丢了', TestLv7_LostReleaseReply: '解锁的回复丢了', TestLv7_Unreliable: '20% 丢包下 3 个客户端争锁'},
      tiers: [
        'Acquire 每次读到锁的值后，先检查 value == lk.id：如果是，说明之前的某次 Put 已经成功，直接返回。',
        '加锁的 Put 返回 ErrMaybe 时，回到循环开头重新读，由上面那条检查来判断。',
        'Release 先读：如果值已经不是自己的 id，说明解锁已经生效，直接返回；Put 返回 OK 或 ErrMaybe 都可以结束（拿着锁时别人不会改它）。'],
      byCode: {
        maybe_lockout: '收到 ErrMaybe 后要读回锁的值。如果里面是你自己的 id，你已经拿到锁了。',
        lock_stuck: '有客户端卡住了。常见原因：收到 ErrMaybe 后没有确认；或者解锁的回复丢了以后，Release 还在等一个永远不会来的 OK。',
        two_holders: '两个客户端同时拿着锁。确认只在锁空着时写入，并且一定带上刚读到的版本号。',
        lock_value: '解锁后锁的键应该是空字符串。',
      },
    },
  ],
  common: {
    build: '代码没能编译。看下面的错误，点击可以跳到对应的行。',
    race: '-race 检测到数据竞争。报告里成对出现的两段调用栈，就是同时访问同一个变量的两处代码。',
    concurrent_map: '多个 goroutine 同时写了同一个 map。用 s.mu 保护它。',
    panic: '代码发生了 panic，看错误信息里指向你代码的那一行。',
    timeout: '测试超时，常见原因是死锁：加锁后提前 return 忘了解锁，或者在循环里一直等一个不会来的回复。',
  },
};
