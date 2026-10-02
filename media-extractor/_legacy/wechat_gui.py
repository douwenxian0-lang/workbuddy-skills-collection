# -*- coding: utf-8 -*-
"""翠鸟 - 全平台素材提取器 v2"""
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

import sys, os, re, hashlib, subprocess, threading
from pathlib import Path
from tkinterdnd2 import TkinterDnD
try:
    import tkinter as tk
    from tkinter import ttk, scrolledtext, messagebox, filedialog
except ImportError:
    print('Error: tkinter not found.'); sys.exit(1)

# ── 全平台 URL 匹配规则 ──
SUPPORTED_PATTERNS = [
    r'https?://mp\.weixin\.qq\.com/[^\s\'"<>]+',           # 微信公众号
    r'https?://www\.xiaohongshu\.com/[^\s\'"<>]+',          # 小红书
    r'https?://xhslink\.com/[a-zA-Z0-9]+',                 # 小红书短链
    r'https?://www\.toutiao\.com/[^\s\'"<>]+',              # 今日头条
    r'https?://www\.bilibili\.com/[^\s\'"<>]+',             # B站
    r'https?://b23\.tv/[a-zA-Z0-9]+',                       # B站短链
    r'https?://www\.douyin\.com/[^\s\'"<>]+',               # 抖音
    r'https?://v\.douyin\.com/[a-zA-Z0-9]+',                # 抖音短链
    r'https?://channels\.weixin\.qq\.com/[^\s\'"<>]+',      # 微信视频号
    r'https?://[^\s\'"<>]+\.[a-z]{2,}[^\s\'"<>]*',         # 通用网页（兜底）
]

PLATFORM_LABELS = {
    'mp.weixin.qq.com': '微信',
    'xiaohongshu.com': '小红书',
    'xhslink.com': '小红书',
    'toutiao.com': '头条',
    'bilibili.com': 'B站',
    'b23.tv': 'B站',
    'douyin.com': '抖音',
    'channels.weixin.qq.com': '视频号',
}

def detect_platform(url):
    for domain, label in PLATFORM_LABELS.items():
        if domain in url:
            return label
    return '网页'

def parse_urls(text):
    return list(dict.fromkeys(re.findall('|'.join(SUPPORTED_PATTERNS), text, re.I)))

def read_urls_from_file(fp):
    for enc in ('utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'latin1'):
        try:
            return parse_urls(open(fp, encoding=enc).read())
        except Exception:
            pass
    return []

def ocr_image(fp):
    try:
        from PIL import Image
        txt = pytesseract.image_to_string(Image.open(fp), lang='chi_sim+eng')
        urls = parse_urls(txt)
        return urls, txt[:300], True, None
    except Exception as e:
        return [], str(e), False, e

def clean_old_folders(url, out_dir):
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    try:
        for d in os.listdir(out_dir):
            if d.endswith('_' + url_hash):
                import shutil
                old = os.path.join(out_dir, d)
                if os.path.isdir(old):
                    shutil.rmtree(old)
    except Exception:
        pass


def do_extract(url, out_dir, log_fn):
    clean_old_folders(url, out_dir)
    script_dir = Path(__file__).parent

    # ── 微信文章走 Playwright（JS 渲染），其余走纯 HTTP ──
    if 'mp.weixin.qq.com' in url:
        extractor = str(script_dir / 'extract_browser.py')
        note = '[Playwright]'
    else:
        extractor = str(script_dir / 'extractor_v2.py')
        note = '[HTTP]'

    if not os.path.exists(extractor):
        log_fn('[错误] 找不到 %s' % extractor)
        return False

    cmd = [sys.executable, extractor, url, out_dir]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True,
                           encoding='utf-8', errors='replace', timeout=300)
        out = r.stdout + r.stderr
        log_fn('[%s] %s' % (note, out[-2000:] if len(out) > 2000 else out))
        return r.returncode == 0
    except subprocess.TimeoutExpired:
        log_fn('[超时] 超过300秒'); return False
    except Exception as e:
        log_fn('[错误] %s' % e); return False

class App(TkinterDnD.DnDWrapper):
    def __init__(self, root):
        self.root = root
        self.root.title('翠鸟 - 全平台素材提取器')
        self.root.geometry('700x640')
        self.root.configure(bg='#f0f0f0')
        self.out_dir = r'E:\微信推文图片'
        os.makedirs(self.out_dir, exist_ok=True)
        self._ui()
        self.root.after(100, self._bring_to_front)
        threading.Thread(target=self._test_ocr_async, daemon=True).start()

    def _bring_to_front(self):
        self.root.attributes('-topmost', True)
        self.root.lift()
        self.root.focus_force()
        self.root.attributes('-topmost', False)

    def _test_ocr_async(self):
        try:
            from PIL import Image, ImageDraw, ImageFont
            test_img = Image.new('RGB', (320, 50), 'white')
            draw = ImageDraw.Draw(test_img)
            try:
                fnt = ImageFont.truetype('msyh.ttc', 18)
            except Exception:
                fnt = ImageFont.load_default()
            draw.text((8, 8), 'https://mp.weixin.qq.com/s/test', fill='black', font=fnt)
            tmp = os.path.join(os.path.dirname(__file__), '_ocr_test_tmp.png')
            test_img.save(tmp)
            txt = pytesseract.image_to_string(tmp, lang='chi_sim+eng')
            ok = 'weixin' in txt.lower() or 'test' in txt.lower()
            try: os.remove(tmp)
            except Exception: pass
            if ok:
                self._update_ocr('[OCR: 就绪]', '#2a2')
            else:
                self._update_ocr('[OCR: 可用]', '#c80')
        except Exception as e:
            self._update_ocr('[OCR: 异常]', '#c00')

    def _update_ocr(self, text, fg='#888'):
        def a(): self.ocr_lbl.config(text=text, fg=fg)
        self.root.after(0, a)

    def _ui(self):
        header = tk.Frame(self.root, bg='#2c3e50', height=40)
        header.pack(fill='x')
        header.pack_propagate(False)
        tk.Label(header, text='翠鸟 - 全平台素材提取器', bg='#2c3e50',
                 font=('Arial', 13, 'bold'), fg='white').pack(side='left', padx=16, pady=6)

        tag_frame = tk.Frame(self.root, bg='#ecf0f1')
        tag_frame.pack(fill='x')
        platforms = ['微信(Playwright)', '小红书', '头条', 'B站', '抖音', '视频号', '通用网页']
        for p in platforms:
            tk.Label(tag_frame, text=p, bg='#3498db', fg='white',
                     font=('', 8), padx=6, pady=1).pack(side='left', padx=3, pady=3)

        main = tk.Frame(self.root, bg='#f0f0f0')
        main.pack(fill='both', expand=True, padx=16, pady=8)

        tk.Label(main, text='输入链接（支持微信/小红书/头条/B站/抖音/视频号/通用网页，每行一个）',
                 bg='#f0f0f0', font=('', 11, 'bold'), fg='#333').pack(anchor='w')

        drop_frame = tk.Frame(main, bg='#dce8f5', relief='solid', bd=2, height=56)
        drop_frame.pack(fill='x', pady=(6, 4))
        drop_frame.pack_propagate(False)
        tk.Label(drop_frame,
                 text='\u2193 \u62d6\u5165 txt \u6587\u4ef6\uff08\u6279\u91cf\u94fe\u63a5\uff09\u6216 \u622a\u56fe\uff08OCR\u8bc6\u522b\u94fe\u63a5\uff09 \u2193',
                 bg='#dce8f5', font=('', 10), fg='#4a90d9', justify='center').pack(fill='both', expand=True)
        drop_frame.drop_target_register('DND_Files')
        drop_frame.dnd_bind('<<Drop>>', lambda e: self._on_drop(e.data))

        self.text = scrolledtext.ScrolledText(main, height=8, font=('', 11),
                                               relief='solid', bd=1)
        self.text.pack(fill='x', pady=4)

        btns = tk.Frame(main, bg='#f0f0f0')
        btns.pack(fill='x', pady=4)
        for t, cmd in [
            ('开始提取', self.go),
            ('选择目录', self.pick_dir),
            ('加载文件', self.load_file),
            ('清空', lambda: self.text.delete('1.0', 'end')),
        ]:
            tk.Button(btns, text=t, command=cmd, font=('', 10),
                      bg='#4a90d9', fg='white', relief='flat',
                      padx=10, pady=3).pack(side='left', padx=4)
        self.ocr_lbl = tk.Label(btns, text='[OCR: 检测中...]', font=('', 9),
                                bg='#f0f0f0', fg='#888')
        self.ocr_lbl.pack(side='right')

        self.dir_lbl = tk.Label(main, text='保存至: %s' % self.out_dir,
                                bg='#f0f0f0', font=('', 9), fg='#555', anchor='w')
        self.dir_lbl.pack(fill='x')

        note = tk.Label(main,
            text='注意：从微信对话框直接拖拽到本窗口暂不支持（微信窗口拖拽协议限制）\n'
                 '替代方法：① 复制链接 → Ctrl+V 粘贴  ② 截图 → 拖入  ③ 拖入txt文件',
            bg='#fff8e1', font=('', 9), fg='#b8860b', anchor='w', justify='left',
            padx=8, pady=6, relief='solid', bd=1)
        note.pack(fill='x', pady=(4, 0))

        tk.Frame(main, height=2, bg='#ccc').pack(fill='x', pady=8)

        tk.Label(main, text='提取日志', bg='#f0f0f0',
                 font=('', 10, 'bold'), anchor='w').pack(anchor='w')
        self.log = scrolledtext.ScrolledText(main, font=('Consolas', 9),
                                             state='disabled', fg='#222',
                                             relief='solid', bd=1, bg='#fafafa')
        self.log.pack(fill='both', expand=True, pady=4)

    def _log(self, msg):
        def a():
            self.log.config(state='normal')
            self.log.insert('end', msg + '\n')
            self.log.see('end')
            self.log.config(state='disabled')
        self.root.after(0, a)

    def pick_dir(self):
        d = filedialog.askdirectory(initialdir=self.out_dir)
        if d:
            self.out_dir = d
            self.dir_lbl.config(text='保存至: %s' % d)

    def load_file(self):
        fp = filedialog.askopenfilename(title='选择文件',
            filetypes=[('文本', '*.txt *.md *.csv'), ('所有', '*.*')])
        if not fp: return
        urls = read_urls_from_file(fp)
        if not urls:
            messagebox.showwarning('未找到', '文件中未识别到有效链接')
            return
        self.text.delete('1.0', 'end')
        self.text.insert('1.0', '\n'.join(urls))
        self._log('[已加载] %d 个链接' % len(urls))

    def _on_drop(self, data):
        raw = data.strip()
        self._log('[调试] 原始数据: %s' % raw[:100])

        files = []
        i = 0
        while i < len(raw):
            if raw[i] == '{':
                end = raw.find('}', i)
                if end == -1:
                    end = len(raw)
                files.append(raw[i+1:end])
                i = end + 1
            elif raw[i] not in ' \t':
                end = i
                while end < len(raw) and raw[end] not in ' \t':
                    end += 1
                files.append(raw[i:end])
                i = end
            else:
                i += 1

        if not files:
            self._log('! 未能解析拖入的文件')
            return

        f = files[0].strip()
        self._log('[调试] 解析到的文件: %s' % f)

        if not os.path.exists(f):
            self._log('! 文件不存在: %s' % f)
            return

        ext = os.path.splitext(f.lower())[1]
        if ext in ('.txt', '.md', '.csv'):
            urls = read_urls_from_file(f)
            if not urls:
                self._log('! 文件中未找到有效链接')
                return
            self.text.delete('1.0', 'end')
            self.text.insert('1.0', '\n'.join(urls))
            self._log('[拖入txt] %d 个链接' % len(urls))
        elif ext in ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'):
            self._log('[拖入图片] OCR识别: %s' % os.path.basename(f))
            urls, preview, ok_flag, err = ocr_image(f)
            if err:
                self._log('[OCR错误] %s' % err)
            if not urls:
                self._log('! 未从截图找到有效链接')
                self._log('[OCR识别内容] %s' % (preview or '(无)'))
                return
            self._log('[OCR文字预览]\n%s\n---' % preview)
            self.text.delete('1.0', 'end')
            self.text.insert('1.0', '\n'.join(urls))
            self._log('[OCR] %d 个链接' % len(urls))
            self._update_ocr('[OCR: OK]', 'green')
        else:
            self._log('! 不支持的文件类型: %s' % ext)

    def go(self):
        raw = self.text.get('1.0', 'end').strip()
        if not raw:
            messagebox.showwarning('输入为空', '请输入链接')
            return
        urls = parse_urls(raw)
        if not urls:
            messagebox.showwarning('未识别', '未找到有效链接')
            return
        self._bring_to_front()
        self._set_btns(False)
        self._log('开始提取 %d 条...' % len(urls))
        def worker():
            ok = fail = 0
            for i, url in enumerate(urls, 1):
                platform = detect_platform(url)
                self._log('[%d/%d] [%s] %s' % (i, len(urls), platform, url))
                if do_extract(url, self.out_dir, self._log):
                    ok += 1; self._log('  OK')
                else:
                    fail += 1; self._log('  FAIL')
            self._log('\n=== %d/%d 完成  保存: %s ===' % (ok, len(urls), self.out_dir))
            self.root.after(0, lambda: self._set_btns(True))
            self.root.after(0, lambda: messagebox.showinfo(
                '完成', '%d/%d 条内容提取完成\n%s' % (ok, self.out_dir)))
        threading.Thread(target=worker, daemon=True).start()

    def _set_btns(self, enabled):
        def a():
            for w in self.root.pack_slaves():
                if isinstance(w, tk.Frame):
                    for btn in w.pack_slaves():
                        if isinstance(btn, tk.Button):
                            btn.configure(state='normal' if enabled else 'disabled')
        self.root.after(0, a)

def main():
    root = TkinterDnD.Tk()
    App(root)
    root.mainloop()

if __name__ == '__main__':
    main()
