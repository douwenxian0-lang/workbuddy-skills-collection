# -*- coding: utf-8 -*-
import sys, os, io, zipfile
from flask import Flask, request, jsonify, send_file, render_template_string
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_browser import extract_article

app = Flask(__name__)
OUTPUT_DIR = r'E:\微信推文图片'
os.makedirs(OUTPUT_DIR, exist_ok=True)

TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>翠鸟素材提取器</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,sans-serif;background:#f5f5f5;min-height:100vh;color:#333}
.hd{background:linear-gradient(135deg,#1a9f6c,#0d7a52);color:#fff;padding:24px 16px;text-align:center}
.hd h1{font-size:22px;margin-bottom:4px}
.hd p{font-size:13px;opacity:.8}
.wrap{max-width:800px;margin:0 auto;padding:16px}
.card{background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.card textarea{width:100%;height:80px;border:2px solid #e0e0e0;border-radius:8px;padding:12px;font-size:15px;resize:vertical;outline:none}
.card textarea:focus{border-color:#1a9f6c}
.btn{display:inline-block;padding:12px 24px;background:#1a9f6c;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;text-decoration:none}
.btn:hover{opacity:.9}
.btn:disabled{opacity:.5;cursor:not-allowed}
.w100{width:100%;text-align:center;margin-top:12px}
.res{display:none}
.res h2{font-size:18px;margin-bottom:6px}
.res .meta{font-size:13px;color:#888;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}
.grid img{width:100%;border-radius:6px;cursor:pointer;object-fit:cover;aspect-ratio:1;background:#eee}
.acts{margin-top:16px;display:flex;gap:10px;flex-wrap:wrap}
.ld{text-align:center;padding:40px;display:none}
.sp{display:inline-block;width:36px;height:36px;border:3px solid #e0e0e0;border-top-color:#1a9f6c;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.err{color:#e53935;font-size:14px;margin-top:8px;display:none}
.lb{position:fixed;inset:0;background:rgba(0,0,0,.92);display:none;align-items:center;justify-content:center;z-index:999;cursor:pointer}
.lb img{max-width:95vw;max-height:95vh;object-fit:contain}
</style>
</head>
<body>
<div class="hd"><h1>翠鸟素材提取器</h1><p>粘贴微信公众号文章链接，一键提取图片</p></div>
<div class="wrap">
<div class="card">
<textarea id="url" placeholder="粘贴微信文章链接..."></textarea>
<button class="btn w100" id="go" onclick="go()">提取图片</button>
<div class="err" id="err"></div>
</div>
<div class="ld" id="ld"><div class="sp"></div><p style="margin-top:12px;color:#888">正在提取...</p></div>
<div class="card res" id="res">
<h2 id="tt"></h2>
<div class="meta" id="mt"></div>
<div class="grid" id="gr"></div>
<div class="acts" id="ac"></div>
</div>
</div>
<div class="lb" id="lb" onclick="this.style.display='none'"><img id="lbi"></div>
<script>
function go(){
  var u=document.getElementById('url').value.trim();
  if(!u){document.getElementById('err').textContent='请粘贴链接';document.getElementById('err').style.display='block';return}
  document.getElementById('err').style.display='none';
  document.getElementById('go').disabled=true;
  document.getElementById('ld').style.display='block';
  document.getElementById('res').style.display='none';
  fetch('/api/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:u})})
  .then(function(r){return r.json()})
  .then(function(d){
    document.getElementById('ld').style.display='none';
    document.getElementById('go').disabled=false;
    if(d.error){document.getElementById('err').textContent=d.error;document.getElementById('err').style.display='block';return}
    document.getElementById('tt').textContent=d.title;
    document.getElementById('mt').textContent=d.saved+'张已保存, '+d.skipped+'张跳过';
    var g=document.getElementById('gr');g.innerHTML='';
    d.images.forEach(function(img){
      var i=document.createElement('img');i.src=img.thumb;i.title=img.name;
      i.onclick=function(){document.getElementById('lbi').src=img.full;document.getElementById('lb').style.display='flex'};
      g.appendChild(i);
    });
    var a=document.getElementById('ac');a.innerHTML='';
    if(d.zip_url){var z=document.createElement('a');z.className='btn';z.href=d.zip_url;z.download='';z.textContent='下载全部ZIP';a.appendChild(z)}
    var f=document.createElement('a');f.className='btn';f.href=d.folder_url;f.target='_blank';f.textContent='打开文件夹';a.appendChild(f);
    document.getElementById('res').style.display='block';
  })
  .catch(function(e){
    document.getElementById('ld').style.display='none';document.getElementById('go').disabled=false;
    document.getElementById('err').textContent='请求失败:'+e.message;document.getElementById('err').style.display='block';
  });
}
</script>
</body>
</html>
"""

@app.route("/")
def index():
    return render_template_string(TEMPLATE)

@app.route("/api/extract", methods=["POST"])
def api_extract():
    data = request.get_json(force=True)
    url = data.get("url", "").strip()
    if not url:
        return jsonify({"error": "请输入链接"}), 400
    if "mp.weixin.qq.com" not in url:
        return jsonify({"error": "仅支持微信公众号文章链接"}), 400
    import hashlib
    # Clean old folders with same URL hash
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    for d in os.listdir(OUTPUT_DIR):
        if d.endswith("_" + url_hash):
            import shutil
            old = os.path.join(OUTPUT_DIR, d)
            if os.path.isdir(old):
                shutil.rmtree(old)
    try:
        saved, skipped, save_dir, article_title = extract_article(url, OUTPUT_DIR)
    except Exception as e:
        return jsonify({"error": "提取失败: " + str(e)}), 500
    # Use the folder name that extract_article actually created
    folder = os.path.basename(save_dir)
    # URL-quote folder for routes (handles Chinese/special chars in URLs)
    from urllib.parse import quote
    qfolder = quote(folder, safe='')
    images = []
    for fn in sorted(os.listdir(save_dir)):
        if fn.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
            images.append({"name": fn, "thumb": "/thumb/" + qfolder + "/" + quote(fn, safe=''), "full": "/image/" + qfolder + "/" + quote(fn, safe='')})
    return jsonify({
        "title": article_title, "saved": saved, "skipped": skipped,
        "images": images,
        "zip_url": "/zip/" + qfolder if images else "",
        "folder_url": "/browse/" + qfolder if images else "",
    })

@app.route("/thumb/<folder>/<fn>")
def thumb(folder, fn):
    p = os.path.join(OUTPUT_DIR, folder, fn)
    if not os.path.exists(p):
        return "", 404
    from PIL import Image
    im = Image.open(p)
    im.thumbnail((200, 200))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=75)
    buf.seek(0)
    return send_file(buf, mimetype="image/jpeg")

@app.route("/image/<folder>/<fn>")
def image(folder, fn):
    p = os.path.join(OUTPUT_DIR, folder, fn)
    return send_file(p)

@app.route("/zip/<folder>")
def zip_folder(folder):
    d = os.path.join(OUTPUT_DIR, folder)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for fn in sorted(os.listdir(d)):
            if fn.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp")):
                z.write(os.path.join(d, fn), fn)
    buf.seek(0)
    return send_file(buf, mimetype="application/zip", as_attachment=True, download_name=folder + ".zip")

@app.route("/browse/<folder>")
def browse(folder):
    d = os.path.join(OUTPUT_DIR, folder)
    os.startfile(d)
    return "OK"

if __name__ == "__main__":
    print("翠鸟素材提取器 网页版")
    print("打开浏览器访问: http://localhost:5678")
    app.run(host="0.0.0.0", port=5678, debug=False)
