"""Copy finished episode media into content/, which the runner serves at /content/.

Sources live next to this repo (the episode build folders). Run after re-rendering a video
or editing an episode's lab page:  python3 dev/sync_content.py
"""
import json, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.dirname(ROOT)
EPISODES = {
    "ep00": {"video": "distributed-systems-explainer.mp4", "timeline": "explainer-video/timeline.json"},
    "ep01": {"video": "ep01-mapreduce.mp4", "timeline": "ep01-mapreduce/timeline.json", "lab": "ep01-mapreduce/lab.html"},
}

for ep, src in EPISODES.items():
    out = os.path.join(ROOT, "content", ep)
    os.makedirs(out, exist_ok=True)
    v = os.path.join(SRC, src["video"])
    dst = os.path.join(out, "video.mp4")
    if not os.path.exists(dst) or os.path.getmtime(v) > os.path.getmtime(dst):
        shutil.copy2(v, dst)
    tl = json.load(open(os.path.join(SRC, src["timeline"])))
    chapters = [{"t": round(s["start"], 2), "title": s["zh"]} for s in tl["scenes"]]
    json.dump({"duration": tl["total"], "chapters": chapters}, open(os.path.join(out, "chapters.json"), "w"), ensure_ascii=False, indent=1)
    if "lab" in src:
        body = open(os.path.join(SRC, src["lab"])).read()
        page = '<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n' + body + '\n</body>\n</html>\n'
        open(os.path.join(out, "lab.html"), "w").write(page)
    print(ep, sorted(os.listdir(out)))
