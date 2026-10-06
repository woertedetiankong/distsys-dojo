// English text for the kv dojo (kv.js). Levels are matched by n; fields not written here keep the Chinese.
enOverlay(window.COURSE, {
  title: 'Go Dojo',
  subtitle: 'KV server · 7 levels',
  finalNote: 'All 7 levels done! You are ready for the real MIT Lab 2.',
  timelineIntro: 'From level 3 on, the tests call the server over a simulated network. This draws every RPC of every client: a bar is one call, a red cross is a lost request or reply.',
  levels: {
    1: {
      short: 'Versions', title: 'Get and Put with versions',
      concept: `<p>For each key the server stores two things: a <b>value</b> and a <b>version</b>. Get returns both.</p>
        <p>Put carries a version, meaning "this is the version I saw". It writes only if that version matches the server's, and then adds one to the version; if it doesn't match, it returns <code>ErrVersion</code> and changes nothing. To create a key, use version 0; after the write it is at version 1.</p>
        <p>This rule underpins every later level: it lets the server recognize stale changes, including duplicate changes caused by resent messages.</p>`,
      task: [
        'Add a map to <code>Server</code> from key to "value and version", and initialize it in <code>NewServer</code>.',
        '<code>Get</code>: if the key exists, return its value, version and <code>OK</code>; otherwise <code>ErrNoKey</code>.',
        '<code>Put</code>: if the key doesn\'t exist, create it when the version is 0, else <code>ErrNoKey</code>; if it exists, write and add one only when the versions are equal, else <code>ErrVersion</code>.'],
      tests: {TestLv1_NewKey: 'Create a key', TestLv1_Versions: 'Write only when the version matches', TestLv1_NoKey: 'A key that doesn\'t exist'},
      tiers: [
        'Define a small struct type entry struct { value string; version int }, and put data map[string]entry in Server.',
        'Get: e, ok := s.data[args.Key]; if it doesn\'t exist, reply.Err = ErrNoKey. Otherwise fill reply with e.value, e.version and OK.',
        'Put: e, ok := s.data[args.Key]. If !ok && args.Version != 0, return ErrNoKey; if e.version != args.Version, return ErrVersion (for a missing key e.version is 0, which matches "create"); otherwise s.data[key] = entry{args.Value, e.version + 1}.'],
      byCode: {
        get_missing: 'For a Get of a key that doesn\'t exist, set reply.Err to ErrNoKey.',
        put_new: 'The rule for a new key: write when the key doesn\'t exist and args.Version == 0; afterwards its version is 1, and the reply is OK.',
        put_match: 'When the versions match, write, and set reply.Err to OK.',
        version_not_bumped: 'Every successful Put adds one to the version; a new key is at version 1.',
        wrong_version_accepted: 'Compare versions before writing: when args.Version differs from the server\'s version, return ErrVersion and leave the value alone.',
        no_key: 'The key doesn\'t exist but the version is above 0, so the caller believes the key already exists: return ErrNoKey and don\'t create it.',
      },
    },
    2: {
      short: 'Locking', title: 'Requests that arrive together',
      concept: `<p>A real server receives many RPCs at once, and Go runs each RPC in its own goroutine, so <code>Get</code> and <code>Put</code> run <b>at the same time</b> against the same map.</p>
        <p>Put's "compare the version, then write" must happen as one piece: if two Puts compare at the same time, both find the version matches, then write one after the other, one change is silently overwritten. Wrap each handler entirely in <code>s.mu</code> so they run one at a time.</p>
        <p>The tests run with <b>-race</b>: without the lock, it points at the two lines that touched the map at once.</p>`,
      task: ['Lock at the start of <code>Get</code> and <code>Put</code> and unlock before returning. The test has 8 goroutines increment a counter at once by "read the version, write with that version".'],
      tests: {TestLv2_ConcurrentCounter: '8 goroutines increment a counter at once', TestLv2_ManyKeys: 'Write many keys at once'},
      tiers: [
        'Get needs the lock too: reading the map while someone writes it is a data race as well.',
        'The simplest form: the first line of each handler is s.mu.Lock(), the second is defer s.mu.Unlock().',
        'The lock must cover the whole "read the version, compare, write" sequence, not just the line that writes.'],
      byCode: {
        lost_update: 'A change was overwritten: two Puts passed the version check at the same time. Put the comparison and the write in the same locked section.',
        put_never_ok: 'A Put with the version you just read never returns OK, so level 1\'s version rule isn\'t done yet. Go back and pass level 1 first.',
        race: '-race reported a data race: a handler read or wrote the map without the lock. Look at the two stack traces that come as a pair in the report.',
      },
    },
    3: {
      title: 'Clerk: turning calls into RPCs',
      concept: `<p>The <b>Clerk</b> is the client library. A program calls <code>ck.Get(key)</code>; the Clerk packs the arguments into <code>GetArgs</code>, sends them over the network to the server's <code>Server.Get</code>, and returns the result from <code>GetReply</code>.</p>
        <p><code>ck.end.Call("Server.Get", &args, &reply)</code> returns true when a reply arrived and reply has been filled in. The network in this level is reliable, so Call always returns true.</p>`,
      task: ['Implement <code>Clerk.Get</code>: call <code>"Server.Get"</code> and return the value, version and Err.', 'Implement <code>Clerk.Put</code>: call <code>"Server.Put"</code> and return Err.'],
      tests: {TestLv3_GetPut: 'Write, then read back', TestLv3_Errors: 'Errors passed through unchanged', TestLv3_TwoClerks: 'Two clients'},
      tiers: [
        'args := GetArgs{Key: key}; var reply GetReply; ck.end.Call("Server.Get", &args, &reply).',
        'Call\'s second and third arguments are pointers. The method names must be "Server.Get" and "Server.Put".',
        'Get returns reply.Value, reply.Version, reply.Err; Put returns reply.Err. Hand the server\'s errors (ErrNoKey, ErrVersion) to the caller unchanged.'],
      byCode: {
        clerk_get: 'Clerk.Get must return all three fields of the reply: Value, Version and Err. Check that the method name is "Server.Get".',
        clerk_put: 'Clerk.Put must return the server\'s reply.Err unchanged, including ErrVersion and ErrNoKey.',
        clerk_calls: 'On a reliable network, one Get or Put needs only one RPC.',
        clerk_hang: 'The Clerk is stuck. This level\'s network never loses messages, so Call returns true; return as soon as you have the reply.',
      },
    },
    4: {
      short: 'Retries', title: 'An unreliable network: retry',
      concept: `<p>Now the network loses messages. When <code>Call</code> returns false you don't know whether the request or the reply was lost, only that no answer came. The only remedy is to <b>resend</b> until a reply arrives.</p>
        <p>Wait a little before resending: <code>time.Sleep(RetryWait)</code>. Without the wait, a client on a broken network fires requests nonstop, flooding the network and the server for nothing.</p>
        <p>Resending a Get is always safe. And a Put? The version stops it from running twice, but there is a catch in what it returns; that's the next level.</p>`,
      task: ['Turn <code>Get</code> and <code>Put</code> into loops: when Call returns true, return the result; when it returns false, <code>time.Sleep(RetryWait)</code> and send again.'],
      tests: {TestLv4_LostRequest: 'The request is lost', TestLv4_LostReply: 'The reply is lost twice', TestLv4_PutLostRequest: 'A Put\'s request is lost', TestLv4_NoSpin: 'Don\'t flood a dead network', TestLv4_Unreliable: '20 reads and writes at 30% loss'},
      tiers: [
        'Wrap Call in for { … }. Return from the loop when Call returns true.',
        'Make a fresh reply variable on every pass (put var reply GetReply inside the loop) so nothing from the last attempt leaks in.',
        'After Call returns false and before the next pass, time.Sleep(RetryWait).'],
      byCode: {
        no_retry: 'When Call returns false, don\'t just return: resend until a reply arrives.',
        no_sleep: 'Resending too often. After each failure, time.Sleep(RetryWait) before resending.',
      },
    },
    5: {
      title: 'Maybe it worked: ErrMaybe',
      concept: `<p>Suppose a Put's reply is lost: the server has already run it and bumped the version. The Clerk resends the same Put, still with the old version, and gets <code>ErrVersion</code>.</p>
        <p>Now the Clerk can't tell two cases apart: its first attempt succeeded, or another client changed the key first. It can't say OK, and it can't say ErrVersion (that would claim "it didn't run"); the honest answer is <b><code>ErrMaybe</code></b>.</p>
        <p>The rule applies in exactly one case: <b>the Put was resent and got ErrVersion</b>. A rejection on the first send is a definite ErrVersion; an OK after resending is a definite OK.</p>`,
      task: ['In <code>Clerk.Put</code>, remember whether this Put has been resent. If it was resent and gets <code>ErrVersion</code>, return <code>ErrMaybe</code>; otherwise return as usual.'],
      tests: {TestLv5_LostPutReply: 'A Put\'s reply is lost', TestLv5_FirstTryRefused: 'Refused on the first try', TestLv5_RetriedThenOK: 'OK after resending', TestLv5_FreshEachPut: 'Each Put keeps its own record'},
      tiers: [
        'Declare retried := false before Put\'s loop, and set it to true when Call returns false.',
        'Once a reply arrives: if reply.Err == ErrVersion && retried { return ErrMaybe }, else return reply.Err.',
        'retried must be a local variable in Put, not a field of the Clerk struct, or one Put\'s state carries over to the next.'],
      byCode: {
        maybe_missing: 'When a resent Put gets ErrVersion, the first attempt may already have succeeded: return ErrMaybe.',
        maybe_too_eager: 'Refused on the first send, the Clerk knows for sure it didn\'t run: return ErrVersion. Only a resent Put says "maybe".',
        maybe_on_ok: 'OK is a definite success; return OK even after resending. ErrMaybe is only for "resent and got ErrVersion".',
        maybe_sticky: 'Whether a Put was resent belongs to that Put alone. Track it in a local variable in Put, not in the Clerk.',
        fail: 'The value on the server is wrong. Make sure levels 1 and 4 pass first.',
        no_retry: 'The Clerk didn\'t return, or gave up. When Call returns false, sleep and resend; level 4\'s retry logic is needed here too.',
      },
    },
    6: {
      short: 'Lock', title: 'A lock made from Put',
      concept: `<p>When many clients take turns using one thing, they need a lock. We represent it with one key: an empty string means nobody holds it; otherwise the value is the holder's <b>id</b> (each Lock makes one with <code>NewID()</code>).</p>
        <p>Acquire: read the lock's key; if it is free, Put your own id with the version you just read. When two clients grab at once, only one has a matching version; the other gets ErrVersion, reads again and waits again. If someone else holds the lock, wait a bit and read again.</p>
        <p>Release: write the value back to the empty string with the version you saw.</p>`,
      task: [
        '<code>Acquire</code>: loop reading the lock\'s key (treat a missing key as free, version 0); when it is free, Put your id and return on OK; otherwise sleep a bit and try again.',
        '<code>Release</code>: read the version and Put the value back to the empty string.'],
      tests: {TestLv6_OneClient: 'One client acquires and releases', TestLv6_Waits: 'Wait while the lock is held', TestLv6_Contention: '4 clients acquire 5 times each'},
      tiers: [
        'value, version, err := lk.ck.Get(lk.key); if err == ErrNoKey, treat value as "" and version as 0.',
        'Put(lk.key, lk.id, version) only when value == "". OK means you have the lock; ErrVersion means someone beat you, so go back to the top of the loop.',
        'When someone else holds the lock (value isn\'t empty), time.Sleep(RetryWait) and read again. Release: read the version, then Put(lk.key, "", version).'],
      byCode: {
        two_holders: 'Two clients hold the lock at once. Write your id only when the lock is free (value ""), and always with the version you just read.',
        lock_stuck: 'A client can never get the lock, or can\'t release it. Check: when the key doesn\'t exist, do you create it with version 0? Does release really write the empty string back?',
        lock_value: 'The lock\'s key should hold the holder\'s own id (lk.id), and the empty string after release.',
      },
    },
    7: {
      short: 'Lossy lock', title: 'Locking on a network that loses messages',
      concept: `<p>Now the Put that acquires the lock may also return <code>ErrMaybe</code>: your id may already be written, with only the reply lost.</p>
        <p>If you treat ErrMaybe as failure, the next read shows the lock "held by someone", and the someone is you: you wait forever. The right move is to <b>read it back and check</b>: if the lock's value is your own id, you have it.</p>
        <p>Release is the same: if the releasing Put returns ErrMaybe, or the value you read is no longer your id, an earlier release already took effect.</p>`,
      task: ['Make <code>Acquire</code> and <code>Release</code> handle <code>ErrMaybe</code> correctly and stay correct on a network that loses 20% of messages.'],
      tests: {TestLv7_LostAcquireReply: 'The acquire reply is lost', TestLv7_LostReleaseReply: 'The release reply is lost', TestLv7_Unreliable: '3 clients compete at 20% loss'},
      tiers: [
        'Each time Acquire reads the lock\'s value, first check value == lk.id: if so, an earlier Put already succeeded; return.',
        'When the acquiring Put returns ErrMaybe, go back to the top of the loop and read again; the check above decides.',
        'Release reads first: if the value is no longer your id, the release already took effect, so return. A Put that returns OK or ErrMaybe can both end it (nobody else changes the lock while you hold it).'],
      byCode: {
        maybe_lockout: 'After ErrMaybe, read the lock\'s value back. If it holds your own id, you already have the lock.',
        lock_stuck: 'A client is stuck. Common causes: not checking after ErrMaybe, or Release still waiting for an OK that will never come after the release reply was lost.',
        two_holders: 'Two clients hold the lock at once. Make sure you write only when the lock is free, and always with the version you just read.',
        lock_value: 'After release, the lock\'s key should be the empty string.',
      },
    },
  },
  common: {
    build: 'The code did not compile. See the errors below; click one to jump to its line.',
    race: '-race found a data race. The two stack traces that come as a pair in the report are the two places that touched the same variable at once.',
    concurrent_map: 'Several goroutines wrote the same map at once. Guard it with s.mu.',
    panic: 'Your code panicked. Look for the line in your code that the error message points to.',
    timeout: 'The test timed out. A common cause is a deadlock: returning early after taking a lock without unlocking, or looping forever waiting for a reply that never comes.',
  },
});
