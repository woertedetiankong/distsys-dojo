// English text for the mr dojo (mr.js). Levels are matched by n; fields not written here keep the Chinese.
enOverlay(window.COURSE, {
  title: 'Go Dojo',
  subtitle: 'MapReduce · 7 levels',
  finalNote: 'All 7 levels done! You are ready for the real MIT Lab 1.',
  timelineIntro: 'From level 4 on, the tests run in a simulated cluster. This shows when each worker took which task and when it crashed.',
  levels: {
    1: {
      title: 'Goroutines, WaitGroup and locks',
      concept: `<p>Distributed systems are full of things happening at the same time. Go expresses that with <b>goroutines</b>: put <code>go</code> in front of a function call and the function runs in the background; you don't wait for it to finish.</p>
        <p>Two questions follow. First, how do you know every goroutine has finished? Use <code>sync.WaitGroup</code>: <code>Add(1)</code> before starting, <code>Done()</code> at the end, and <code>Wait()</code> at the very end. Second, what if several goroutines change the same map at once? Wrap the change in a <code>sync.Mutex</code> so only one gets in at a time.</p>
        <p>The tests run with the <b>-race</b> data race detector. Forget a lock and it points at the two lines that collided.</p>`,
      task: ['Implement <code>CountWords</code>: start one goroutine per text to call count, and merge the results into total. All 6 texts must finish within 350 ms.'],
      tests: {TestLv1_Correct: 'Merged result is correct', TestLv1_Parallel: 'All texts processed at once', TestLv1_Repeat: 'Correct 30 runs in a row'},
      tiers: [
        'Write a for loop and start a goroutine in its body with go func(...) { ... }(t). Pass the loop variable in as an argument.',
        'Wait for every goroutine with a WaitGroup: wg.Add(1) in the loop, defer wg.Done() in the goroutine, wg.Wait() after the loop.',
        'Declare var mu sync.Mutex too. Once a goroutine has the result of count, mu.Lock(), add each word\'s count into total, then mu.Unlock().'],
      byCode: {
        not_parallel: 'count is being called one call after another. Each call needs its own new goroutine.',
        wrong_total: 'The result is wrong. The most common cause: CountWords returns before the goroutines are done. Wait for all of them with a WaitGroup.',
        flaky: 'Right sometimes and wrong other times is the classic symptom of a concurrent program returning before a goroutine has finished.',
        race: 'Two goroutines touched total at the same time without a lock. The report below names the two lines that collided.',
        concurrent_map: 'Go maps don\'t allow several goroutines to write at once. Wrap the code that changes total in mu.Lock() and mu.Unlock().',
      },
    },
    2: {
      title: 'Channels and worker pools',
      concept: `<p>Sometimes you can't start goroutines without limit; for example, only n tasks may use the disk at once. That calls for a <b>worker pool</b>.</p>
        <p>A Go <b>channel</b> is a pipe that carries data between goroutines. A buffered channel has a capacity: <code>make(chan struct{}, n)</code> holds at most n items, and putting one more in waits. Think of it as n passes: put one in before starting work, take one out when done, and at most n are working at any moment.</p>
        <p>This pattern comes back again and again, for example to limit how many RPCs are in flight.</p>`,
      task: ['Implement <code>RunPool</code>: at most n calls of f run at once, and n must actually be used; <code>results[i]</code> must be <code>f(jobs[i])</code>.'],
      tests: {TestLv2_PoolOf3: '3 at a time, 12 jobs', TestLv2_PoolOf1: '1 at a time', TestLv2_PoolWide: 'As many at a time as there are jobs'},
      tiers: [
        'Still run each job in its own goroutine, then find a way to limit how many run at once.',
        'Make a channel with capacity n to act as passes: put one in before starting a goroutine (it waits when full), and take one out when the goroutine is done.',
        'Write the result into results[i]. Each goroutine writes a different index, so no lock is needed. Don\'t forget a WaitGroup to wait for every job.'],
      byCode: {
        pool_order: 'The results are in the wrong order. Don\'t collect them with append; write results[i] directly, where i is the job\'s index in jobs.',
        pool_too_many: 'More than n ran at once, so nothing is limiting them. Try a channel with capacity n.',
        pool_serial: 'Fewer than n ran at once. Are you waiting for each job inside the main loop? Wait only after every job has started.',
        pool_slow: 'Too slow. Check that n jobs really run at the same time.',
        race: 'There is a data race. If several goroutines write the same variable, lock it; writing different indexes of results is safe.',
      },
    },
    3: {
      title: 'Map, reduce and partitioning',
      concept: `<p>MapReduce asks you for just two functions: <b>Map</b> turns one file into a list of intermediate key/value pairs, and <b>Reduce</b> combines all the values of one key into a result.</p>
        <p>Each Map's output is split among nReduce Reduce tasks. The same key must always go to the same Reduce, which is done with <code>ihash(key) % nReduce</code>; ihash is exactly the one from Lab 1.</p>
        <p>The pairs a Reduce receives are in no particular order, so first gather equal keys together, then call the reduce function once per key.</p>`,
      task: [
        '<code>Map</code>: split out the words with <code>strings.FieldsFunc</code> and <code>unicode.IsLetter</code>, returning <code>KeyValue{word, "1"}</code>. <code>Reduce</code>: return <code>strconv.Itoa(len(values))</code>.',
        '<code>Partition</code>: return nReduce buckets, keeping the original order.',
        '<code>ReduceLines</code>: group by key, sort, and return <code>"key result"</code> lines.'],
      tests: {TestLv3_Map: 'Map splits out words', TestLv3_Reduce: 'Reduce counts', TestLv3_Partition: 'Buckets by ihash', TestLv3_ReduceLines: 'Group, sort, call reduce'},
      tiers: [
        'Map is nearly the same as the wc.go that ships with Lab 1: FieldsFunc\'s second argument says which characters are separators, i.e. !unicode.IsLetter(r).',
        'Partition: make([][]KeyValue, nReduce) first, then append each kv to b[ihash(kv.Key)%nReduce]. ReduceLines: collect each key\'s values in a map[string][]string.',
        'After collecting, put the map\'s keys into a slice, sort.Strings it, and produce k + " " + reducef(k, groups[k]) in that order.'],
      byCode: {
        map_words: 'Check the return value: each item is KeyValue{word, "1"}, in the order the words appear in the text, with case unchanged.',
        map_split: 'strings.Fields splits only on whitespace, so punctuation sticks to words. Use strings.FieldsFunc and count only letters as part of a word.',
        reduce_count: 'Convert the count to a string with strconv.Itoa.',
        part_len: 'The returned slice must have length nReduce; keep empty buckets too.',
        part_bucket: 'The bucket number is ihash(kv.Key) % nReduce: hash the key.',
        part_order: 'Each bucket must keep the original order, with nothing lost or duplicated.',
        not_grouped: 'Each key gets exactly one line: collect all of its values first, then call reducef once.',
        unsorted: 'Sort the keys with sort.Strings.',
        lines_content: 'Each line is the key, one space, then the result of reducef.',
      },
    },
    4: {
      title: 'Worker: ask, work, report',
      concept: `<p>From this level on, your code runs in a <b>simulated cluster</b>: workers are real goroutines, while the network and file system are simulated by the tests, which can crash or slow down any worker at any moment. It is the same idea as MIT's own labrpc.</p>
        <p>The worker asks the coordinator for a task with <code>c.Call("Coordinator.GetTask", &amp;args, &amp;reply)</code>. The reply's <code>Type</code> is one of MapTask, ReduceTask, WaitTask, ExitTask. The protocol is defined in <code>rpc.go</code>.</p>
        <p>Intermediate files are named <code>mr-X-Y</code> (X is the Map number, Y the bucket), one <code>json.Marshal(kv)</code> per line; output files are named <code>mr-out-Y</code>, one <code>key result</code> per line. Read and write files through the <code>fs</code> argument, which stands in for the os package in Lab 1.</p>
        <p>This level tests your worker against a coordinator that replies from a script.</p>`,
      task: [
        'MapTask: read <code>reply.File</code> → mapf → Partition → write NReduce intermediate files (empty buckets too) → call TaskDone.',
        'ReduceTask: read <code>mr-0-Y</code> through <code>mr-(NMap-1)-Y</code> → json.Unmarshal each line → ReduceLines → write <code>mr-out-Y</code> → call TaskDone.',
        'WaitTask: <code>time.Sleep(100 * time.Millisecond)</code> and continue; ExitTask: return.'],
      tests: {TestLv4_MapTask: 'Runs a Map task', TestLv4_ReduceTask: 'Runs a Reduce task', TestLv4_Wait: 'Rests on Wait', TestLv4_Loop: 'Loops until Exit'},
      tiers: [
        'In the loop, switch on reply.Type into four branches. Write WaitTask and ExitTask first, then Map, then Reduce.',
        'Map branch: data, _ := fs.ReadFile(reply.File); kvs := mapf(reply.File, string(data)). For each bucket of Partition(kvs, reply.NReduce), encode each kv as one line with json.Marshal and write it to fmt.Sprintf("mr-%d-%d", reply.ID, y).',
        'Reduce branch: for x := 0; x < reply.NMap; x++ read mr-x-Y, split on "\\n" and json.Unmarshal each line into a KeyValue; once everything is in, call ReduceLines and write one file joined with strings.Join. Both branches end with c.Call("Coordinator.TaskDone", &TaskDoneArgs{...}, &TaskDoneReply{}).'],
      byCode: {
        no_inter_file: 'Every Map task must write all NReduce intermediate files, even an empty file for an empty bucket.',
        inter_format: 'Each line of an intermediate file is the output of json.Marshal(kv), with lines separated by "\\n".',
        inter_content: 'Check the partitioning: bucket y goes to mr-X-y, where X is reply.ID.',
        no_task_done: 'After finishing a task, report it with TaskDone; Type and ID must match the task you received.',
        no_output: 'Write the Reduce result to fmt.Sprintf("mr-out-%d", reply.ID).',
        out_content: 'Check that you read all NMap intermediate files and decoded every line. Each output line is "key result" and ends with a newline.',
        wait_count: 'Handle each reply exactly once: don\'t send extra requests and don\'t skip any.',
        no_sleep: 'After a WaitTask, time.Sleep for a while before asking again.',
        loop: 'After handling a task, go back to the top of the loop and ask again; return only on ExitTask.',
        not_exit: 'Return on ExitTask. Also check you aren\'t stuck somewhere else, such as an endless loop.',
        spin: 'The loop keeps sending requests nonstop. Sleep first on WaitTask.',
        panic: 'Look at the line the panic message points to. Common causes: a slice index out of range, or using something that is nil.',
      },
    },
    5: {
      title: 'Coordinator: handing out tasks',
      concept: `<p>The coordinator records a state for each task: <b>idle, in progress, done</b>.</p>
        <p>When a worker asks for a task, hand out Maps first. Until every Map is <b>done</b>, don't hand out a Reduce even if there is no Map left to give; reply WaitTask instead, because any unfinished Map may produce a key that some Reduce needs. Once every Reduce is done, <code>Done()</code> returns true and every later request gets ExitTask.</p>
        <p>Several workers call GetTask and TaskDone <b>at the same time</b>, and the test calls Done() concurrently too. So guard every field of the coordinator with one <code>sync.Mutex</code>: each method starts with <code>Lock()</code> and then <code>defer Unlock()</code>.</p>
        <p>This level has no failures and uses the worker you wrote in level 4.</p>`,
      task: ['Implement <code>MakeCoordinator</code>, <code>GetTask</code>, <code>TaskDone</code> and <code>Done</code>. Fill in NReduce and NMap in the reply.'],
      tests: {TestLv5_Basic: '3 workers finish the whole job', TestLv5_OneWorker: 'Only 1 worker', TestLv5_Parallel: 'Tasks run in parallel, never handed out twice', TestLv5_OneReduce: 'nReduce = 1'},
      tiers: [
        'Add mu sync.Mutex to the struct, plus a slice of states for the Maps and another for the Reduces.',
        'GetTask, in order: are there unfinished Maps? If so, find an idle one, hand it out and mark it in progress; if none is idle, reply WaitTask. Once every Map is done, do the same with the Reduces. When everything is done, reply ExitTask.',
        'TaskDone marks the task given by args.Type and args.ID as done. Done checks whether every Reduce is done. All three methods and Done start with c.mu.Lock(); defer c.mu.Unlock().'],
      byCode: {
        never_done: 'The job never finished. Check that TaskDone marks the task done, and check the condition in Done().',
        early_reduce: '"Handed out" is not "done". Start handing out Reduces only after TaskDone has arrived for every Map.',
        dup_assign: 'Mark a task in progress as soon as you hand it out, or the next worker gets the same task.',
        no_parallel: 'Whenever a worker asks and an idle task exists, hand it out right away.',
        no_exit: 'Once the job is done, any worker that asks should get ExitTask.',
        bad_reply: 'Check the reply fields: a Map needs ID, File and NReduce; a Reduce needs ID and NMap.',
        race: 'Several goroutines access the coordinator\'s fields at once. GetTask, TaskDone and Done each need the lock, including the read-only Done.',
        wrong_output: 'The output is wrong even without failures. First make sure levels 3 and 4 pass.',
        spin: 'Don\'t reply WaitTask when there is a task to hand out, and the worker should Sleep on WaitTask.',
        timeout: 'Possibly a deadlock: for example, returning early after taking the lock without unlocking. defer c.mu.Unlock() avoids that.',
      },
    },
    6: {
      short: 'Timeouts', title: 'Fault tolerance: reassign on timeout',
      concept: `<p>A worker can crash at any moment, and <b>a crashed worker tells no one</b>. The coordinator can't tell whether it died or is merely slow.</p>
        <p>The only way out is a clock: if a task has been out longer than some limit without finishing, treat it as failed and give it to someone else. Lab 1 uses 10 seconds; here it is <code>dojo.Timeout</code> (2 seconds) so the tests run faster. Record the start with <code>time.Now()</code> and test for a timeout with <code>time.Since(start) &gt; dojo.Timeout</code>.</p>
        <p>A worker judged timed out may only be slow and may still report done later. The same task can get TaskDone twice, and your coordinator has to handle that correctly.</p>`,
      task: ['In <code>coordinator.go</code>, import <code>"lab/dojo"</code> and <code>"time"</code>. Record each task\'s start time; a task in progress for longer than <code>dojo.Timeout</code> may be handed out again.'],
      tests: {TestLv6_CrashInMap: 'A worker crashes during Map', TestLv6_CrashInReduce: 'A worker crashes during Reduce', TestLv6_CrashTwice: 'Two crash, a new worker joins later'},
      tiers: [
        'When handing out a task, store time.Now() in that task\'s state.',
        'When GetTask looks for a task, besides idle ones, also treat tasks that are "in progress but time.Since(start) > dojo.Timeout" as available.',
        'Store each task as struct{ state int; start time.Time }. The condition for picking a task: state is idle, or state is in progress and it has timed out. When handing it out, update both state and start.'],
      byCode: {
        no_reassign: 'The tasks a crashed worker held will never finish. The coordinator must notice through the timeout and hand them out again. Open the timeline and see which task stays in progress forever.',
        never_done: 'If the job is stuck, look at the timeline: which task never finished? Did its worker crash?',
        wrong_output: 'Wrong output with crashes may mean duplicate TaskDone calls are handled wrongly.',
        race: 'The time fields must also be read and written under the lock.',
      },
    },
    7: {
      short: 'Atomic writes', title: 'Atomic writes: running twice does no harm',
      concept: `<p>Reassigning on timeout has a side effect: the original worker may not be dead, only slow. Then <b>two workers run the same task at once and write the same file</b>.</p>
        <p><code>fs.WriteFile</code> empties the file first, then writes it line by line. When two writers interleave, the file gets scrambled; another worker may also read an intermediate file that is only half written.</p>
        <p>The fix: first write a temporary file whose name only you know with <code>fs.WriteTemp</code>, then <code>fs.Rename</code> it to the final name. Rename is atomic, so a reader sees either the whole old file or the whole new one. In Lab 1 the equivalents are <code>os.CreateTemp</code> and <code>os.Rename</code>.</p>`,
      task: ['Replace every <code>fs.WriteFile</code> in <code>worker.go</code> with "<code>fs.WriteTemp</code> + <code>fs.Rename</code>", for both intermediate and output files.'],
      tests: {TestLv7_SlowMap: 'A slow machine makes a Map run twice', TestLv7_SlowReduce: 'A slow machine makes a Reduce run twice', TestLv7_SlowAndCrash: 'A slow machine plus a crash'},
      tiers: [
        'Not just the output files: two workers may write an intermediate file at the same time too.',
        'tmp, err := fs.WriteTemp(data) returns the temporary name; then fs.Rename(tmp, finalName).',
        'Write a helper func put(fs dojo.FS, name string, data []byte) that does WriteTemp then Rename, and replace every WriteFile with put.'],
      byCode: {
        wrong_output: 'Some counts are too high or too low: a file was written by two workers interleaved, or a Reduce read a half-written intermediate file. Open the timeline and look for a task that ran twice.',
        no_reassign: 'This level\'s tests have crashes and slow machines too. Make sure level 6 passes first.',
      },
    },
  },
  common: {
    build: 'The code did not compile. See the errors below; click one to jump to its line.',
    race: '-race found a data race. The two stack traces that come as a pair in the report are the two places that touched the same variable at once.',
    concurrent_map: 'Several goroutines wrote the same map at once. Guard it with a sync.Mutex.',
    panic: 'Your code panicked. Look for the line in your code that the error message points to.',
    timeout: 'The test timed out. A common cause is a deadlock: returning early after taking a lock without unlocking, or waiting on another goroutine while holding the lock.',
  },
});
