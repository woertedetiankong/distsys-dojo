(() => {
const C = window.COURSE;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store = {
  get(k, d){ try { const v = localStorage.getItem('dojo.' + C.id + '.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v){ try { localStorage.setItem('dojo.' + C.id + '.' + k, JSON.stringify(v)); } catch {} },
};

/* ---------------- token ---------------- */
let token = new URLSearchParams(location.search).get('t');
try { if (token) sessionStorage.setItem('dojo.token', token); else token = sessionStorage.getItem('dojo.token'); } catch {}
if (token && location.search) history.replaceState(null, '', location.pathname);

async function api(path, opts = {}){
  const r = await fetch(path, {...opts, headers: {...(opts.headers || {}), 'X-Dojo-Token': token || ''}});
  if (r.status === 401){ $('#gate').hidden = false; throw new Error('unauthorized'); }
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ---------------- state ---------------- */
let level = store.get('level', 1);
let passed = new Set(store.get('passed', []));
let hintsShown = store.get('hints', {});
let results = {};                 // level -> run result
let files = {};                   // name -> {doc, mtime, saved (content on disk), dirty}
let current = null, editor, running = false, tlTest = null, errMarks = [];

/* ---------------- editor + files ---------------- */
function setSaved(text){ $('#saved').textContent = text; }
async function loadFiles(initial){
  const list = await api('/api/files');
  for (const f of list){
    const have = files[f.name];
    if (!have){
      files[f.name] = {doc: CodeMirror.Doc(f.content, 'text/x-go'), mtime: f.mtime, saved: f.content, dirty: false};
      files[f.name].doc.on('change', () => onEdit(f.name));
    } else if (f.mtime > have.mtime && f.content !== have.saved){
      if (!have.dirty){
        const cur = have.doc.getCursor(); have.doc.setValue(f.content); have.doc.setCursor(cur);
        have.saved = f.content; have.mtime = f.mtime; have.dirty = false;
        setSaved(`${f.name} 在别的编辑器里改过，已经同步。`);
      } else setSaved(`注意：${f.name} 在别的编辑器里也改过。这里的修改保存时会覆盖它。`);
    }
  }
  if (initial) renderTabs();
}
const saveTimers = {};
function onEdit(name){
  const f = files[name];
  f.dirty = f.doc.getValue() !== f.saved;
  renderTabs();
  clearTimeout(saveTimers[name]);
  saveTimers[name] = setTimeout(() => save(name), 600);
}
async function save(name){
  const f = files[name]; if (!f || !f.dirty) return;
  const content = f.doc.getValue();
  try {
    const r = await api('/api/file?name=' + encodeURIComponent(name), {method: 'PUT', body: content});
    f.saved = content; f.mtime = r.mtime; f.dirty = f.doc.getValue() !== content;
    setSaved(`已保存 · mr/${name}`);
  } catch (e){ setSaved(`保存 ${name} 失败：${e.message}`); }
  renderTabs();
}
async function saveAll(){ await Promise.all(Object.keys(files).map(n => { clearTimeout(saveTimers[n]); return save(n); })); }
function open(name, line){
  if (!files[name]) return;
  clearMarks(); current = name; editor.swapDoc(files[name].doc); renderTabs(); markErrors();
  if (line){ editor.setCursor({line: line - 1, ch: 0}); editor.scrollIntoView({line: line - 1, ch: 0}, 120); editor.focus(); }
}
const ORDER = ['warmup.go', 'mapreduce.go', 'worker.go', 'coordinator.go', 'rpc.go', 'common.go'];
function renderTabs(){
  const lv = C.levels.find(l => l.n === level);
  const names = Object.keys(files).sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  $('#tabs').innerHTML = names.map(n => `<button class="tab ${n === current ? 'on' : ''} ${n === lv.file ? 'focus-file' : ''}" type="button" role="tab" aria-selected="${n === current}" data-f="${esc(n)}">${esc(n)}${files[n].dirty ? '<span class="dirty"> *</span>' : ''}</button>`).join('');
  $('#tabs').querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => open(b.dataset.f)));
}

/* ---------------- run ---------------- */
async function run(){
  if (running) return;
  running = true; $('#run').disabled = true;
  $('#results').innerHTML = `<div class="running"><span class="pencil"></span>正在编译并运行 go test${info.race ? ' -race' : ''}……</div>`;
  try {
    await saveAll();
    const r = await api('/api/run', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({level})});
    results[r.level] = r;
    const ok = r.ok && r.tests.length && r.tests.every(t => t.ok);
    if (ok && !passed.has(r.level)){ passed.add(r.level); store.set('passed', [...passed]); }
    tlTest = r.tests.find(t => !t.ok && t.events) || r.tests.find(t => t.events) || null;
  } catch (e){
    results[level] = {level, ok: false, tests: [], fatal: {code: 'internal', msg: '没能运行测试：' + e.message + '。本地运行器还在运行吗？'}};
  }
  running = false; $('#run').disabled = false;
  renderLevels(); renderResults(); renderHints(); renderTimeline(); markErrors();
}

/* ---------------- error marks in the editor ---------------- */
function clearMarks(){
  errMarks.forEach(l => { editor.removeLineClass(l, 'wrap', 'err-line'); editor.setGutterMarker(l, 'errs', null); });
  errMarks = [];
}
function markErrors(){
  clearMarks();
  const r = results[level], note = $('#penNote');
  note.hidden = true;
  if (!r || !current) return;
  const marks = [];
  (r.build_errors || []).forEach(b => b.file === current && marks.push([b.line, b.msg]));
  const texts = [r.fatal?.detail, r.fatal?.output, ...r.tests.flatMap(t => [t.detail, t.output])].filter(Boolean).join('\n');
  const re = new RegExp('(?:^|[\\s/])' + current.replace('.', '\\.') + ':(\\d+)', 'gm');
  for (const m of texts.matchAll(re)) if (!marks.some(x => x[0] === +m[1])) marks.push([+m[1], null]);
  marks.slice(0, 8).forEach(([n]) => {
    if (n < 1 || n > editor.lineCount()) return;
    const h = editor.addLineClass(n - 1, 'wrap', 'err-line');
    const g = document.createElement('span'); g.className = 'err-gutter'; g.textContent = '✗';
    editor.setGutterMarker(n - 1, 'errs', g); errMarks.push(h);
  });
  const first = marks.find(m => m[1]) || marks[0];
  if (first){ note.hidden = false; note.textContent = `↑ 第 ${first[0]} 行${first[1] ? '：' + first[1] : '：测试报告里提到了这一行'}`; }
}

/* ---------------- results ---------------- */
function renderResults(){
  const box = $('#results'), r = results[level], lv = C.levels.find(l => l.n === level);
  if (!r){
    box.innerHTML = `<div class="empty"><span class="big">还没跑过第 ${level} 关</span><p>写好代码后点「运行测试」，或者按 ⌘/Ctrl + Enter。代码会先保存到你电脑上的文件，然后运行真正的 <code>go test${info.race ? ' -race' : ''}</code>。</p></div>`;
    return;
  }
  let h = '';
  if (r.build_errors?.length){
    h += `<div class="score"><span class="ring">!</span><span class="say">没能编译<small>点击错误跳到对应的行</small></span></div><div class="berr">${r.build_errors.map((b, i) => `<button type="button" data-be="${i}">${esc(b.file)}:${b.line}:${b.col}  ${esc(b.msg)}</button>`).join('')}</div>`;
    box.innerHTML = h;
    box.querySelectorAll('[data-be]').forEach(b => b.addEventListener('click', () => { const e = r.build_errors[+b.dataset.be]; open(e.file, e.line); }));
    return;
  }
  const n = r.tests.length, k = r.tests.filter(t => t.ok).length, all = n && k === n;
  if (n) h += `<div class="score ${all ? 'all' : ''}"><span class="ring">${k}/${n}</span><span class="say">${all ? '全部通过！' : n > 1 && k === n - 1 ? '还差一个！' : '继续加油'}<small>用时 ${r.seconds.toFixed(1)} 秒${r.race ? ' · 开着 -race' : ''}</small></span></div>`;
  if (all){
    const next = C.levels.find(l => l.n === level + 1);
    h += `<div class="pass"><b>第 ${level} 关通过</b><span>${next ? '下一关：' + esc(next.title) : '7 关全部完成！现在可以去写真正的 MIT Lab 1 了。'}</span>${next ? `<button class="btn next" type="button" id="next">去第 ${next.n} 关 →</button>` : ''}</div>`;
  }
  if (r.fatal){
    h += `<div class="test bad"><div class="body" style="padding-left:0"><p class="msg">${esc(r.fatal.msg || C.common[r.fatal.code] || '运行出错')}</p>${r.fatal.detail ? `<pre class="box">${esc(r.fatal.detail)}</pre>` : ''}${r.fatal.output ? `<pre class="box">${esc(r.fatal.output)}</pre>` : ''}</div></div>`;
  }
  const firstBad = r.tests.findIndex(t => !t.ok);
  h += r.tests.map((t, i) => `<details class="test ${t.ok ? 'ok' : 'bad'}" ${i === firstBad ? 'open' : ''}>
    <summary><span class="m">${t.ok ? '✓' : '×'}</span><span class="nm">${esc(lv.tests[t.name] || t.name)}</span><span class="el">${t.elapsed.toFixed(1)}s</span></summary>
    <div class="body">
      ${t.ok ? '' : `<p class="msg">${esc(t.msg || C.common[t.code] || '测试失败')}</p>`}
      ${t.detail ? `<pre class="box">${esc(t.detail)}</pre>` : ''}
      ${t.diff ? `<div class="diff"><div class="m"><b>应该有</b><pre class="box">${esc((t.diff.missing || []).join('\n') || '—')}</pre></div><div class="x"><b>实际多出</b><pre class="box">${esc((t.diff.extra || []).join('\n') || '—')}</pre></div></div>` : ''}
      ${t.output && !t.ok ? `<details><summary class="linkish">程序输出</summary><pre class="box">${esc(t.output)}</pre></details>` : ''}
      ${t.events ? `<button class="linkish" type="button" data-tl="${i}">在时间线里看看 →</button>` : ''}
    </div></details>`).join('');
  box.innerHTML = h;
  $('#next')?.addEventListener('click', () => go(level + 1));
  box.querySelectorAll('[data-tl]').forEach(b => b.addEventListener('click', () => { tlTest = r.tests[+b.dataset.tl]; renderTimeline(); $('#timeline').scrollIntoView({behavior: 'smooth', block: 'nearest'}); }));
}

/* ---------------- timeline (hand-drawn) ---------------- */
function wobble(x, y, w, h){
  const r = Math.min(6, w / 2, h / 2);
  return `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`;
}
function renderTimeline(){
  const box = $('#timeline'), r = results[level];
  const withEv = r ? r.tests.filter(t => t.events && t.events.length) : [];
  if (!withEv.length){
    box.innerHTML = `<h2>时间线</h2><p class="muted" style="color:var(--mute);font-size:13.5px">从第 4 关开始，测试运行在模拟集群里。这里会画出每个 worker 在什么时候领了什么任务、什么时候宕机。</p>`;
    return;
  }
  if (!withEv.includes(tlTest)) tlTest = withEv[0];
  const ev = tlTest.events, lv = C.levels.find(l => l.n === level);
  const workers = [...new Set(ev.filter(e => e.k === 'spawn').map(e => e.w))].sort((a, b) => a - b);
  const slow = Object.fromEntries(ev.filter(e => e.k === 'spawn').map(e => [e.w, e.slow]));
  const tReal = Math.max(tlTest.t_end || 0, ...ev.map(e => e.t), 0.5), lastEv = Math.max(...ev.map(e => e.t), 0);
  const tEnd = Math.min(tReal, Math.max(0.5, lastEv * 1.25 + 0.3)), quiet = tReal - tEnd > 1;
  const W = Math.max(300, box.clientWidth - 44), L = 44, Rm = 10, top = 30, lane = 42, H = top + workers.length * lane + 26;
  const X = t => L + (t / tEnd) * (W - L - Rm), Y = w => top + workers.indexOf(w) * lane + lane / 2;
  const col = task => task[0] === 'M' ? 'var(--acc)' : ['var(--l1)', 'var(--l2)', 'var(--l3)', 'var(--l0)'][(+task.slice(1)) % 4];
  let s = '';
  const step = [0.1, 0.25, 0.5, 1, 2, 5, 10].find(x => tEnd / x <= 6) || 20;
  for (let t = 0; t <= tEnd + 1e-9; t += step) s += `<text x="${X(t)}" y="${H - 6}" font-size="10.5" fill="var(--faint)" text-anchor="middle">${+t.toFixed(2)}s</text>`;
  workers.forEach(w => {
    const y = Y(w), sp = ev.find(e => e.k === 'spawn' && e.w === w);
    s += `<text x="4" y="${y + 6}" font-size="12.5" font-weight="600" fill="var(--ink)">W${w}</text>`;
    if (slow[w]) s += `<text x="4" y="${y + 18}" font-size="10" fill="var(--warn)">慢</text>`;
    s += `<path d="M${X(sp ? sp.t : 0)},${y} L${X(tEnd)},${y}" stroke="var(--edge-2)" stroke-width="1.5" stroke-dasharray="2 5" fill="none"/>`;
  });
  ev.forEach((e, i) => {
    if (e.k !== 'assign' || !/^[MR]\d+$/.test(e.task)) return;
    let end = tEnd, how = 'open';
    for (let j = i + 1; j < ev.length; j++){
      const f = ev[j]; if (f.w !== e.w) continue;
      if (f.k === 'report' && f.task === e.task){ end = f.t; how = 'done'; break; }
      if (f.k === 'crash'){ end = f.t; how = 'crash'; break; }
      if (f.k === 'assign'){ end = f.t; break; }
    }
    const x = X(e.t), w = Math.max(4, X(end) - x), y = Y(e.w), c = col(e.task);
    s += `<g><title>${e.task} · W${e.w} · ${e.t.toFixed(2)}s → ${end.toFixed(2)}s${how === 'crash' ? '（宕机中断）' : how === 'done' ? '' : '（没有汇报完成）'}</title>
      <path d="${wobble(x, y - 11, w, 22)}" fill="${c}" fill-opacity="${how === 'done' ? .18 : .06}" stroke="${c}" stroke-width="1.5" ${how !== 'done' ? 'stroke-dasharray="5 4"' : ''}/>
      ${w > 22 ? `<text x="${x + 5}" y="${y + 6}" font-size="11" font-weight="600" fill="${c}">${e.task}</text>` : ''}</g>`;
  });
  ev.forEach(e => {
    const x = X(e.t), y = e.w != null && workers.includes(e.w) ? Y(e.w) : 0;
    if (e.k === 'crash') s += `<g stroke="var(--bad)" stroke-width="2.5" stroke-linecap="round"><title>W${e.w} 宕机 @ ${e.t}s</title><path d="M${x - 8},${y - 9} L${x + 7},${y + 8} M${x + 8},${y - 8} L${x - 7},${y + 9}"/></g>`;
    if (e.k === 'exit') s += `<path d="M${x},${y - 11} L${x + 1},${y + 11}" stroke="var(--ink-2)" stroke-width="2.5" stroke-linecap="round"><title>W${e.w} 退出</title></path>`;
    if (e.k === 'done') s += `<path d="M${x},${top - 16} L${x + 1},${H - 24}" stroke="var(--ok)" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${x > W - 70 ? x - 4 : x + 4}" y="${top - 18}" font-size="11" font-weight="600" fill="var(--ok)" text-anchor="${x > W - 70 ? 'end' : 'start'}">Done()</text>`;
  });
  const desc = e => ({spawn: '启动' + (e.slow ? `（慢机器，慢 ${e.slow} 倍）` : ''), assign: e.task === 'wait' ? '收到 WaitTask' : e.task === 'exit' ? '收到 ExitTask' : `领到 ${e.task}`, report: `汇报完成 ${e.task}`, crash: '宕机', exit: '退出', done: 'Done() 返回 true', write: `开始直接写 ${e.f}`, wrote: `写完 ${e.f}`, rename: `rename → ${e.f}`, read: `读 ${e.f}`})[e.k] || e.k;
  // name the stuck tasks: assigned, never reported, and why
  const stuck = [];
  if (!tlTest.ok){
    const reported = new Set(ev.filter(e => e.k === 'report').map(e => e.task));
    const lastAssign = {};
    ev.forEach(e => { if (e.k === 'assign' && /^[MR]\d+$/.test(e.task)) lastAssign[e.task] = e; });
    for (const [task, e] of Object.entries(lastAssign)){
      if (reported.has(task)) continue;
      const cr = ev.find(f => f.k === 'crash' && f.w === e.w && f.t >= e.t);
      stuck.push(cr ? `${task} 在 ${e.t.toFixed(2)}s 分给了 W${e.w}，W${e.w} 在 ${cr.t.toFixed(2)}s 宕机，之后再也没有人重新领取 ${task}。` : `${task} 在 ${e.t.toFixed(2)}s 分给了 W${e.w}，一直没有汇报完成。`);
    }
  }
  const list = ev.filter(e => !['read', 'wrote'].includes(e.k) && !(e.k === 'assign' && e.task === 'wait')).slice(0, 400);
  box.innerHTML = `<h2>时间线</h2>
    <select id="tlSel" aria-label="选择测试">${withEv.map((t, i) => `<option value="${i}" ${t === tlTest ? 'selected' : ''}>${t.ok ? '✓' : '✗'} ${esc(lv.tests[t.name] || t.name)}</option>`).join('')}</select>
    <svg class="tl-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="worker 时间线">${s}</svg>
    ${stuck.slice(0, 3).map(x => `<p class="tl-note">${esc(x)}</p>`).join('')}
    ${quiet ? `<p class="tl-note">${lastEv.toFixed(2)}s 之后，直到 ${tReal.toFixed(1)}s 测试结束，再也没有任何动静。</p>` : ''}
    ${!tlTest.ok ? `<p class="muted" style="color:var(--mute);font-size:12.5px">虚线框：领了任务却没有汇报完成。红叉：宕机。</p>` : ''}
    <ol class="evlist">${list.map(e => `<li class="${e.k}"><span class="t">${e.t.toFixed(2)}s</span><span class="w">${e.w != null ? 'W' + e.w : ''}</span><span>${esc(desc(e))}</span></li>`).join('')}</ol>`;
  $('#tlSel').addEventListener('change', e => { tlTest = withEv[+e.target.value]; renderTimeline(); });
}

/* ---------------- lesson, hints, levels ---------------- */
function renderLesson(){
  const lv = C.levels.find(l => l.n === level);
  $('#lesson').innerHTML = `<span class="lvn">Level ${lv.n}</span><h1>${esc(lv.title)}</h1><div class="concept">${lv.concept}</div>
    <p class="task-h">要做的事</p><ol class="task">${lv.task.map(t => `<li>${t}</li>`).join('')}</ol>
    <button class="file-link" type="button" id="openFile">打开 ${esc(lv.file)} →</button>`;
  $('#openFile').addEventListener('click', () => open(lv.file));
}
function renderHints(){
  const lv = C.levels.find(l => l.n === level), r = results[level];
  const codes = r ? [...new Set([r.fatal?.code, ...(r.build_errors?.length ? ['build'] : []), ...r.tests.filter(t => !t.ok).map(t => t.code)].filter(Boolean))] : [];
  const targeted = codes.map(c => lv.byCode[c] || C.common[c]).filter(Boolean).slice(0, 2);
  const shown = hintsShown[level] || 0;
  let h = '<h2>提示</h2>';
  h += targeted.map(t => `<div class="hint targeted"><span class="k">针对刚才的失败</span><span>${t}</span></div>`).join('');
  h += lv.tiers.slice(0, shown).map((t, i) => `<div class="hint"><span class="k">提示 ${i + 1}${i === 2 ? ' · 思路' : ''}</span><span>${esc(t)}</span></div>`).join('');
  if (!targeted.length && !shown) h += `<p class="muted">先自己试试。跑一下测试，失败了这里会告诉你原因。</p>`;
  if (shown < lv.tiers.length) h += `<button class="btn" type="button" id="moreHint">${shown ? '翻到下一条' : '我卡住了'} →（${shown + 1}/${lv.tiers.length}）</button>`;
  else h += `<p class="muted">提示都翻完了。还卡着的话，打开时间线看看到底发生了什么。</p>`;
  $('#hints').innerHTML = h;
  $('#moreHint')?.addEventListener('click', () => { hintsShown[level] = shown + 1; store.set('hints', hintsShown); renderHints(); });
}
function renderLevels(){
  $('#levels').innerHTML = C.levels.map(l => `<button class="lv ${passed.has(l.n) ? 'done' : ''} ${l.n === level ? 'cur' : ''}" type="button" data-lv="${l.n}" title="第 ${l.n} 关：${esc(l.title)}"><span class="n">${passed.has(l.n) && l.n !== level ? '✓' : l.n}</span>${esc(l.short)}</button>`).join('');
  $('#levels').querySelectorAll('.lv').forEach(b => b.addEventListener('click', () => go(+b.dataset.lv)));
}
function go(n){
  level = n; store.set('level', n);
  renderLevels(); renderLesson(); renderHints(); renderResults(); renderTimeline();
  const lv = C.levels.find(l => l.n === n);
  if (files[lv.file]) open(lv.file); else renderTabs();
}

/* ---------------- boot ---------------- */
let info = {};
async function boot(){
  if (!token){ $('#gate').hidden = false; return; }
  editor = CodeMirror.fromTextArea($('#code'), {
    mode: 'text/x-go', lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: true, matchBrackets: true, autoCloseBrackets: true,
    styleActiveLine: true, gutters: ['errs', 'CodeMirror-linenumbers'],
    extraKeys: {'Cmd-Enter': run, 'Ctrl-Enter': run, 'Cmd-S': () => saveAll(), 'Ctrl-S': () => saveAll()},
  });
  try {
    info = await api('/api/info');
    $('#runner').className = 'runner ok';
    $('#runnerText').textContent = `本地运行器已连接 · ${info.go.split(' ')[0]}${info.race ? '' : ' · 无 -race'}`;
    await loadFiles(true);
  } catch (e){
    if (e.message === 'unauthorized') return;
    $('#runner').className = 'runner bad'; $('#runnerText').textContent = '连不上本地运行器，请在终端运行 go run .';
  }
  $('#run').addEventListener('click', run);
  go(level);
  setSaved(info.workspace ? '代码就在你电脑上的 mr 文件夹里，也可以用 VS Code 打开编辑。' : '');
  if (info.workspace) $('#saved').title = info.workspace;
  const sync = () => loadFiles(false).catch(() => {});
  addEventListener('focus', sync);
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 4000);
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderTimeline, 150); });
}
boot();
})();
