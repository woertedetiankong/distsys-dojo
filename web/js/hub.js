/* Course home: the current episode's steps as a bento grid, then the full course map. All data comes from course.js. */
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const META = window.COURSE_META, EPISODES = window.EPISODES;

/* ---------------- token from the runner's link ---------------- */
let token = new URLSearchParams(location.search).get('t');
try { if (token) sessionStorage.setItem('dojo.token', token); else token = sessionStorage.getItem('dojo.token'); } catch {}
if (location.search) history.replaceState(null, '', location.pathname + location.hash);

$('#brand').textContent = META.title; $('#sub').textContent = META.subtitle;
$('#mapNote').textContent = META.mapNote || ''; $('#foot').textContent = META.footer || '';
document.title = META.title;

let progress = load('course.progress', {});
const done = (ep, step) => !!(progress[ep] && progress[ep][step]);
function setDone(ep, step, v){ progress[ep] = progress[ep] || {}; progress[ep][step] = v; save('course.progress', progress); render(); }

// steps that track themselves: the lab page records answered questions, the dojo records passed levels
let dojoLevels = {};   // dojo id -> level count, from the runner
function autoState(ep){
  const s = {};
  if (ep.lab){ const n = load(`course.${ep.id}.lab.answered`, []).length, total = ep.lab.questions || 0; s.lab = {n, total, done: total > 0 && n >= total}; }
  if (ep.dojo){ const n = load(`dojo.${ep.dojo}.passed`, []).length, total = dojoLevels[ep.dojo] || 0; s.dojo = {n, total, done: total > 0 && n >= total}; }
  return s;
}
const stepDone = (ep, k, auto) => done(ep.id, k) || !!(auto[k] && auto[k].done);

/* ---------------- render ---------------- */
const open = e => e.status !== 'planned';
// default: the episode in the URL, else the first fully ready one, else the first with any material
let current = EPISODES.find(e => e.id === location.hash.slice(1) && open(e)) || EPISODES.find(e => e.status === 'ready') || EPISODES.find(open) || EPISODES[0];
let chapters = null, videoEl = null;

function render(){
  const ep = current, auto = autoState(ep), steps = ep.steps || [];
  const n = steps.filter(k => stepDone(ep, k, auto)).length, total = steps.length;
  const tag = ep.assignment && ep.assignment.short ? ' · 对应 ' + esc(ep.assignment.short) : '';
  $('#epHead').innerHTML = `<div>
      <p class="eyebrow">第 ${ep.n} 集 · ${esc(ep.group)}${tag}</p>
      <h1>${esc(ep.title)}</h1>
      <p class="desc">${esc(ep.desc || '')}</p></div>
    <div class="prog"><b>${n}<small> / ${total} 步</small></b><span class="track"><i style="width:${total ? n / total * 100 : 0}%"></i></span><span>${n === total ? '这一集学完了' : '按顺序一步一步来'}</span></div>`;

  const cards = steps.map((k, i) => stepCard(ep, k, i + 1, auto)).join('');
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
const ext = (href, label, note = '↗', main = false) => `<a class="go ${main ? 'main' : ''}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)} <span class="ext">${esc(note)}</span></a>`;
const list = xs => xs && xs.length ? `<ul>${xs.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '';

function stepCard(ep, k, no, auto){
  const isDone = stepDone(ep, k, auto);
  const head = (title, time) => `<div class="step-h"><span class="no">${isDone ? '✓' : no}</span><h3>${title}</h3><span class="time">${esc(time || '')}</span></div>`;
  if (k === 'video'){
    return `<article class="step wide ${isDone ? 'done' : ''}">
      ${head('看视频', ep.videoTime)}
      <div class="player" id="player"><div><video id="video" controls preload="metadata" src="content/${ep.id}/video.mp4"></video></div><ol class="chapters" id="chapters"></ol></div>
      <div class="acts"><span class="status ${isDone ? 'ok' : ''}">${isDone ? '已看完' : '看到 90% 会自动记为完成，也可以按章节跳着看'}</span>${check(ep, 'video', '标记为看完')}</div>
    </article>`;
  }
  if (k === 'reading'){
    const p = ep.reading;
    return `<article class="step ${isDone ? 'done' : ''}">
      ${head('读材料', p.time)}
      <p class="what">${esc(p.title)}</p>
      ${list(p.read)}
      ${p.ask && p.ask.length ? `<p class="what" style="font-weight:600;margin-top:4px">读完试着回答</p>${list(p.ask)}` : ''}
      <div class="acts">
        ${p.url ? ext(p.url, p.urlLabel || '打开原文', p.urlNote || '↗', true) : ''}
        ${p.notes ? ext(p.notes, p.notesLabel || '讲义') : ''}
        ${(p.links || []).map(l => ext(l.url, l.label, l.note || '↗')).join('')}
        ${check(ep, 'reading', '读完了')}
      </div></article>`;
  }
  if (k === 'lab'){
    const a = auto.lab;
    return `<article class="step ${isDone ? 'done' : ''}">
      ${head('玩实验台', ep.lab.time)}
      <p class="what">${esc(ep.lab.desc || '')}</p>
      <span class="status ${a.done ? 'ok' : a.n ? 'warn' : ''}">预测题 ${a.n} / ${a.total}</span>
      <div class="acts"><a class="go main" href="content/${ep.id}/lab.html">打开实验台</a>${check(ep, 'lab', '玩过了')}</div></article>`;
  }
  if (k === 'dojo'){
    const a = auto.dojo;
    return `<article class="step ${isDone ? 'done' : ''}">
      ${head('练功房写代码', ep.dojoTime)}
      <p class="what">${esc(ep.dojoDesc || '')}</p>
      <span class="status ${a.done ? 'ok' : a.n ? 'warn' : ''}">已通过 ${a.n} / ${a.total || '?'} 关</span>
      <div class="acts"><a class="go main" href="dojo.html?d=${encodeURIComponent(ep.dojo)}">进入练功房</a>${(ep.dojoLinks || []).map(l => ext(l.url, l.label, l.note || '↗')).join('')}</div></article>`;
  }
  if (k === 'assignment'){
    const a = ep.assignment;
    return `<article class="step ${isDone ? 'done' : ''}">
      ${head(esc(a.title), a.time)}
      ${a.desc ? `<p class="what">${esc(a.desc)}</p>` : ''}
      ${list(a.notes)}
      <div class="acts">${ext(a.url, a.urlLabel || '打开作业说明', a.urlNote || '↗', true)}${check(ep, 'assignment', '通过了')}</div></article>`;
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
    const auto = autoState(e), steps = e.steps || [], n = steps.filter(k => stepDone(e, k, auto)).length;
    const tag = !open(e) ? '制作中' : n === steps.length ? '已学完' : n ? `进行中 ${n}/${steps.length}` : e.status === 'partial' ? '有视频' : '可以开始';
    const short = e.assignment && e.assignment.short ? ' · ' + esc(e.assignment.short) : '';
    const cls = `ep ${open(e) ? 'ready' : 'planned'} ${e === current ? 'cur' : ''}`;
    const inner = `<span class="n">第 ${e.n} 集 · <span class="group">${esc(e.group)}</span></span><b>${esc(e.title)}</b><span class="tag">${tag}${short}</span>`;
    return open(e) ? `<a class="${cls}" href="#${e.id}">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
  }).join('');
}

addEventListener('hashchange', () => {
  const e = EPISODES.find(x => x.id === location.hash.slice(1) && open(x));
  if (e && e !== current){ current = e; videoEl = null; render(); scrollTo({top: 0, behavior: 'smooth'}); }
});
addEventListener('focus', render);

/* ---------------- runner status ---------------- */
(async () => {
  const r = $('#runner'), t = $('#runnerText');
  if (!token){ r.className = 'runner bad'; t.textContent = '没有口令：请用终端里打印的链接打开'; return; }
  try {
    const res = await fetch('/api/info', {headers: {'X-Dojo-Token': token}});
    if (!res.ok) throw new Error(res.status);
    const info = await res.json();
    dojoLevels = info.dojos || {};
    r.className = 'runner ok'; t.textContent = `本地运行器已连接 · ${info.go.split(' ')[0]}`;
    render();
  } catch { r.className = 'runner bad'; t.textContent = '连不上本地运行器'; }
})();

render();
})();
