(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const MIT = 'https://pdos.csail.mit.edu/6.824/';

/* ---------------- token from the runner's link ---------------- */
let token = new URLSearchParams(location.search).get('t');
try { if (token) sessionStorage.setItem('dojo.token', token); else token = sessionStorage.getItem('dojo.token'); } catch {}
if (location.search) history.replaceState(null, '', location.pathname + location.hash);

/* ---------------- course data ---------------- */
// status: ready = 全部材料齐了；partial = 只有部分材料；planned = 还没做
const EPISODES = [
  {id: 'ep00', n: 0, title: '总览：分布式系统是什么', group: '开篇', status: 'partial',
   desc: '从一台机器的极限讲起：横向扩展、不可靠的网络、复制与共识。先建立一张全局地图，再进入第 1 集。',
   steps: ['video']},
  {id: 'ep01', n: 1, title: 'MapReduce', group: '基础', status: 'ready', lab: 'Lab 1',
   desc: '你只写 map 和 reduce 两个函数，框架负责拆分、调度和容错。这一集的重点是：worker 宕机后怎么办，以及为什么重复执行也不会出错。',
   steps: ['video', 'paper', 'lab', 'dojo', 'mitlab'],
   paper: {pdf: MIT + 'papers/mapreduce.pdf', notes: MIT + 'notes/l01.txt', title: 'MapReduce: Simplified Data Processing on Large Clusters（OSDI 2004）',
     read: ['第 1、2 节：编程模型和例子，快速读', '第 3 节：实现，重点读', '§3.3 容错：worker 宕机和 master 宕机分别怎么处理', '§3.6 备份任务：为什么要给"拖后腿"的任务再跑一份'],
     ask: ['已完成的 Map 任务为什么也要重跑，已完成的 Reduce 却不用？', 'Map 函数如果不是确定性的，会出什么问题？', '论文里的 master 宕机了怎么办？为什么这样设计是可以接受的？']},
   mitlab: MIT + 'labs/lab-mr.html', dojoLevels: 7},
  {id: 'ep02', n: 2, title: 'RPC 与 Go 并发', group: '基础', status: 'planned', lab: 'Lab 2'},
  {id: 'ep03', n: 3, title: '线性一致性', group: '基础', status: 'planned', lab: 'Lab 2'},
  {id: 'ep04', n: 4, title: '主备复制：VMware FT', group: '复制', status: 'planned'},
  {id: 'ep05', n: 5, title: 'GFS', group: '复制', status: 'planned'},
  {id: 'ep06', n: 6, title: 'Raft：选出领导者', group: 'Raft', status: 'planned', lab: 'Lab 3A'},
  {id: 'ep07', n: 7, title: 'Raft：日志复制', group: 'Raft', status: 'planned', lab: 'Lab 3B'},
  {id: 'ep08', n: 8, title: 'Raft：持久化与安全性', group: 'Raft', status: 'planned', lab: 'Lab 3C'},
  {id: 'ep09', n: 9, title: 'Raft：快照', group: 'Raft', status: 'planned', lab: 'Lab 3D'},
  {id: 'ep10', n: 10, title: '在 Raft 上搭 KV 服务', group: 'Raft', status: 'planned', lab: 'Lab 4'},
  {id: 'ep11', n: 11, title: 'ZooKeeper', group: '协调服务', status: 'planned'},
  {id: 'ep12', n: 12, title: '链式复制与 CRAQ', group: '协调服务', status: 'planned'},
  {id: 'ep13', n: 13, title: '分片与配置变更', group: '分片与事务', status: 'planned', lab: 'Lab 5'},
  {id: 'ep14', n: 14, title: '分布式事务：2PC 与 2PL', group: '分片与事务', status: 'planned'},
  {id: 'ep15', n: 15, title: 'Spanner', group: '分片与事务', status: 'planned'},
  {id: 'ep16', n: 16, title: 'FaRM', group: '分片与事务', status: 'planned'},
  {id: 'ep17', n: 17, title: 'Aurora', group: '存储与缓存', status: 'planned'},
  {id: 'ep18', n: 18, title: 'Frangipani', group: '存储与缓存', status: 'planned'},
  {id: 'ep19', n: 19, title: 'Memcache at Facebook', group: '存储与缓存', status: 'planned'},
  {id: 'ep20', n: 20, title: 'Spark、COPS 与 Bitcoin', group: '拓展', status: 'planned'},
];

let progress = load('course.progress', {});
const done = (ep, step) => !!(progress[ep] && progress[ep][step]);
function setDone(ep, step, v){ progress[ep] = progress[ep] || {}; progress[ep][step] = v; save('course.progress', progress); render(); }

// steps that track themselves
function autoState(ep){
  const s = {};
  if (ep.id === 'ep01'){
    const answered = load('course.ep01.lab.answered', []).length;
    s.lab = {n: answered, total: 6, done: answered >= 6};
    const passed = load('dojo.go-mr.passed', []).length;
    s.dojo = {n: passed, total: ep.dojoLevels, done: passed >= ep.dojoLevels};
  }
  return s;
}
const stepDone = (ep, k, auto) => done(ep.id, k) || !!(auto[k] && auto[k].done);

/* ---------------- render ---------------- */
let current = (location.hash.slice(1) && EPISODES.find(e => e.id === location.hash.slice(1) && e.status !== 'planned')) || EPISODES.find(e => e.id === 'ep01');
let chapters = null, videoEl = null;

function render(){
  const ep = current, auto = autoState(ep);
  const n = ep.steps.filter(k => stepDone(ep, k, auto)).length, total = ep.steps.length;
  $('#epHead').innerHTML = `<div>
      <p class="eyebrow">第 ${ep.n} 集 · ${esc(ep.group)}${ep.lab ? ' · 对应 ' + esc(ep.lab) : ''}</p>
      <h1>${esc(ep.title)}</h1>
      <p class="desc">${esc(ep.desc || '')}</p></div>
    <div class="prog"><b>${n}<small> / ${total} 步</small></b><span class="track"><i style="width:${total ? n / total * 100 : 0}%"></i></span><span>${n === total ? '这一集学完了' : '按顺序一步一步来'}</span></div>`;

  const cards = ep.steps.map((k, i) => stepCard(ep, k, i + 1, auto)).join('');
  // keep the playing video alive across re-renders
  const keep = videoEl && videoEl.isConnected && videoEl.getAttribute('src') === `content/${ep.id}/video.mp4` ? videoEl : null;
  $('#steps').innerHTML = cards;
  if (keep){ const slot = $('#steps video'); if (slot) slot.replaceWith(keep); }
  bindSteps(ep, !!keep);
  renderMap();
}

function check(ep, k, label = '已完成'){
  return `<label class="check"><input type="checkbox" data-done="${k}" ${done(ep.id, k) ? 'checked' : ''}>${label}</label>`;
}

function stepCard(ep, k, no, auto){
  const isDone = stepDone(ep, k, auto);
  const head = (title, time) => `<div class="step-h"><span class="no">${isDone ? '✓' : no}</span><h3>${title}</h3><span class="time">${time}</span></div>`;
  if (k === 'video'){
    return `<article class="step wide ${isDone ? 'done' : ''}">
      ${head('看视频', ep.id === 'ep00' ? '约 3 分钟' : '约 6 分钟')}
      <div class="player" id="player"><div><video id="video" controls preload="metadata" src="content/${ep.id}/video.mp4"></video></div><ol class="chapters" id="chapters"></ol></div>
      <div class="acts"><span class="status ${isDone ? 'ok' : ''}">${isDone ? '已看完' : '看到 90% 会自动记为完成，也可以按章节跳着看'}</span>${check(ep, 'video', '标记为看完')}</div>
    </article>`;
  }
  if (k === 'paper'){
    const p = ep.paper;
    return `<article class="step ${isDone ? 'done' : ''}">
      ${head('读论文', '2 到 4 小时')}
      <p class="what">${esc(p.title)}</p>
      <ul>${p.read.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="what" style="font-weight:600;margin-top:4px">读完试着回答</p>
      <ul>${p.ask.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      <div class="acts">
        <a class="go main" href="${p.pdf}" target="_blank" rel="noopener">打开论文 PDF <span class="ext">MIT ↗</span></a>
        <a class="go" href="${p.notes}" target="_blank" rel="noopener">第 1 讲讲义 <span class="ext">↗</span></a>
        <a class="go" href="https://www.youtube.com/results?search_query=MIT+6.824+Lecture+1+Introduction" target="_blank" rel="noopener">课堂录像 <span class="ext">YouTube 搜索 ↗</span></a>
        ${check(ep, 'paper', '读完了')}
      </div></article>`;
  }
  if (k === 'lab'){
    const a = auto.lab;
    return `<article class="step ${isDone ? 'done' : ''}">
      ${head('玩实验台', '约 1 小时')}
      <p class="what">先做 6 道预测题：每题先自己选答案，再在模拟器里运行同样的场景验证。然后自己动手让 worker 宕机、制造慢机器、关掉原子重命名。</p>
      <span class="status ${a.done ? 'ok' : a.n ? 'warn' : ''}">预测题 ${a.n} / ${a.total}</span>
      <div class="acts"><a class="go main" href="content/${ep.id}/lab.html">打开实验台</a>${check(ep, 'lab', '玩过了')}</div></article>`;
  }
  if (k === 'dojo'){
    const a = auto.dojo;
    return `<article class="step ${isDone ? 'done' : ''}">
      ${head('练功房写代码', '6 到 15 小时')}
      <p class="what">用 Go 一关一关实现 MapReduce：goroutine 与锁、channel、Map/Reduce、Worker、Coordinator、超时重试、原子写入。测试用真正的 go test -race 运行。</p>
      <span class="status ${a.done ? 'ok' : a.n ? 'warn' : ''}">已通过 ${a.n} / ${a.total} 关</span>
      <div class="acts"><a class="go main" href="dojo.html">进入练功房</a><a class="go" href="https://go.dev/tour/" target="_blank" rel="noopener">没学过 Go？先做 A Tour of Go <span class="ext">↗</span></a></div></article>`;
  }
  if (k === 'mitlab'){
    return `<article class="step ${isDone ? 'done' : ''}">
      ${head('做真正的 Lab 1', '5 到 15 小时')}
      <p class="what">去 MIT 课程官网拿 Lab 1 的代码，用 test-mr.sh 测试。思路和练功房完全相同，需要改的是接口：</p>
      <ul><li>RPC 用 Go 标准库 net/rpc，通过 unix socket 通信</li><li>文件读写用 os 包：os.CreateTemp 加 os.Rename</li><li>超时阈值是 10 秒，练功房里是 2 秒</li><li>worker 和协调者是不同的进程，用 go run 分别启动</li></ul>
      <div class="acts"><a class="go main" href="${ep.mitlab}" target="_blank" rel="noopener">打开 Lab 1 说明 <span class="ext">MIT ↗</span></a>${check(ep, 'mitlab', '通过了')}</div></article>`;
  }
  return '';
}

function bindSteps(ep, kept){
  document.querySelectorAll('[data-done]').forEach(cb => cb.addEventListener('change', () => setDone(ep.id, cb.dataset.done, cb.checked)));
  const v = $('#video');
  if (!v) return;
  videoEl = v;
  if (kept){ renderChapters(v); highlightChapter(v.currentTime); return; }
  const markWatched = () => { if (v.duration && v.currentTime / v.duration > .9 && !done(ep.id, 'video')){ progress[ep.id] = progress[ep.id] || {}; progress[ep.id].video = true; save('course.progress', progress); const st = v.closest('.step'); st.classList.add('done'); st.querySelector('.no').textContent = '✓'; st.querySelector('.status').textContent = '已看完'; st.querySelector('.status').classList.add('ok'); st.querySelector('[data-done]').checked = true; renderHeadOnly(); } };
  v.addEventListener('timeupdate', () => { markWatched(); highlightChapter(v.currentTime); });
  v.addEventListener('error', () => { $('#player').innerHTML = `<div class="missing">没有找到这一集的视频。视频文件比较大，没有放进 git 仓库：请从项目的 Releases 页面下载，保存为 <code>content/${ep.id}/video.mp4</code>，然后刷新页面。</div>`; });
  loadChapters(ep).then(() => renderChapters(v));
}
function renderHeadOnly(){ const y = scrollY; render(); scrollTo(0, y); }

async function loadChapters(ep){
  try { chapters = await (await fetch(`content/${ep.id}/chapters.json`)).json(); } catch { chapters = null; }
}
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function renderChapters(v){
  const box = $('#chapters'); if (!box || !chapters) return;
  box.innerHTML = chapters.chapters.map((c, i) => `<li><button type="button" data-i="${i}"><span class="ct">${fmt(c.t)}</span><span>${esc(c.title)}</span></button></li>`).join('');
  box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { v.currentTime = chapters.chapters[+b.dataset.i].t + 0.05; v.play().catch(() => {}); }));
}
function highlightChapter(t){
  if (!chapters) return;
  let idx = 0; chapters.chapters.forEach((c, i) => { if (t >= c.t) idx = i; });
  document.querySelectorAll('#chapters button').forEach((b, i) => b.classList.toggle('on', i === idx));
}

function renderMap(){
  $('#map').innerHTML = EPISODES.map(e => {
    const auto = autoState(e), n = (e.steps || []).filter(k => stepDone(e, k, auto)).length;
    const tag = e.status === 'planned' ? '制作中' : n === e.steps.length ? '已学完' : n ? `进行中 ${n}/${e.steps.length}` : e.status === 'partial' ? '有视频' : '可以开始';
    const cls = `ep ${e.status === 'planned' ? 'planned' : 'ready'} ${e === current ? 'cur' : ''}`;
    const inner = `<span class="n">第 ${e.n} 集 · <span class="group">${esc(e.group)}</span></span><b>${esc(e.title)}</b><span class="tag">${tag}${e.lab ? ' · ' + esc(e.lab) : ''}</span>`;
    return e.status === 'planned' ? `<div class="${cls}">${inner}</div>` : `<a class="${cls}" href="#${e.id}">${inner}</a>`;
  }).join('');
}

addEventListener('hashchange', () => {
  const e = EPISODES.find(x => x.id === location.hash.slice(1) && x.status !== 'planned');
  if (e && e !== current){ current = e; videoEl = null; render(); scrollTo({top: 0, behavior: 'smooth'}); }
});
addEventListener('focus', render);

/* ---------------- runner status ---------------- */
(async () => {
  const r = $('#runner'), t = $('#runnerText');
  if (!token){ r.className = 'runner bad'; t.textContent = '没有口令：练功房需要用终端里打印的链接打开'; return; }
  try {
    const res = await fetch('/api/info', {headers: {'X-Dojo-Token': token}});
    if (!res.ok) throw new Error(res.status);
    const info = await res.json();
    r.className = 'runner ok'; t.textContent = `本地运行器已连接 · ${info.go.split(' ')[0]}`;
  } catch { r.className = 'runner bad'; t.textContent = '连不上本地运行器'; }
})();

render();
})();
