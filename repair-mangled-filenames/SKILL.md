---
name: repair-mangled-filenames
description: 修复 Windows 上文件名乱码/截断/非法字符的问题。当目录里出现 `е‡ дЅ•и®Ўз®—еє“`、`å¤šè¾¹` 这种乱码名，或 `.ht`/`.h` 这种被截断的扩展名，或结尾带点号导致 `git add` 报错、Python 找不到文件时使用。也适用于批量把损坏名还原成可读中文名。
agent_created: true
---

# 修复乱码 / 截断 / 非法文件名

Windows + 中文文件名场景下的三类损坏，统一处理。

## 症状对照

| 症状 | 成因 |
|---|---|
| `е‡ дЅ•и®Ўз®—еє“` | UTF-8 字节被当成 cp1251 解码显示 |
| `å¤šè¾¹` | UTF-8 字节被当成 cp1252 解码，且处于 NFD 分解态（带组合符） |
| `ç‚ąć ‡č®°` | 混合编码（cp1250/cp1252 都出现过） |
| `xxx.ht` / `xxx.h` | 扩展名被截断 |
| `xxx显示.`（结尾点号） | 路径长度截断 + Windows 规则冲突 |
| 名字中途断掉无扩展名 | 路径长度截断 |

## 一、还原乱码名

核心：把字符串按单字节编码还原成字节，再按 UTF-8 解码。要点：

1. **先 NFC 归一化**。NFD 形态的组合符（U+0300–U+036F）必须合成后才能编码。
2. **两轮尝试**：第一轮所有编码 strict 解码；全都失败再进第二轮用 `errors='ignore'`——因为**乱码名的尾部字节本身也常常是被截断的**，strict 必然失败。
3. 编码候选顺序：`cp1252, cp1250, cp1251, cp1254, latin-1, mac_cyrillic`。Cyrillic 名字只有 cp1251 能编，所以顺序不影响；`cp1250` 必须排在 `cp1252` 之后但在 `cp1251` 之前。
4. 兜底：逐字符映射，跳过组合符。

```python
CODECS = ('cp1252', 'cp1250', 'cp1251', 'cp1254', 'latin-1', 'mac_cyrillic')


def decode_moji(name):
    cands = [unicodedata.normalize('NFC', name), name]
    # 第一轮：严格解码
    for cand in cands:
        for enc in CODECS:
            try:
                raw = cand.encode(enc)
            except Exception:
                continue
            try:
                res = raw.decode('utf-8')
            except UnicodeDecodeError:
                continue
            if res and res != cand:
                return res
    # 第二轮：容忍尾部被截断的字节
    for cand in cands:
        for enc in CODECS:
            try:
                raw = cand.encode(enc)
            except Exception:
                continue
            res = raw.decode('utf-8', errors='ignore')
            if res and res != cand and '  ' not in res and '\x00' not in res:
                return res
    return None
```

实测结果：`е‡ дЅ•и®Ўз®—еє“` → `几何计算库`；`и‡Єе®љд№‰ж …ж је›ѕе±‚` → `自定义栅格图层`；`ç‚ąć…` → `点标记与文本`。

## 二、用 HTML `<title>` 补全截断的名字

被截断的名字靠猜没用——**读文件内容里的 `<title>`**。这类成批下载的示例/文档，文件名通常是 `{分类}_{标题}.html`，标题就在 HTML 里。

```python
m = re.search(r'<title>(.*?)</title>', txt, re.S | re.I)
```

⚠️ 这个规律**只有约 78% 准确**（实测 60 个里 13 个不符）。所以只把 `<title>` 用在名字**已经被截断**的文件上，完好的文件绝不动。

分类前缀截断时，用目录里其他完好的文件名做**前缀补全**：若解出的分类是某个已有分类的前缀且唯一匹配，就用那个。

## 三、Windows 非法名（结尾带点号）

`os.rename` / `os.path.abspath` 会把结尾的点号吃掉，报 `FileNotFoundError` 或 `WinError 2`。

**解法：手工拼 `\\?\` 扩展路径，不要过 `abspath`。**

```python
src = '\\\\?\\' + D.replace('/', '\\') + '\\' + f   # f 保留结尾点号
dst = '\\\\?\\' + D.replace('/', '\\') + '\\' + new
os.rename(src, dst)
```

拼接时必须是已经绝对化的 D。若仍失败，退到 `ctypes.windll.kernel32.MoveFileW(src, dst)`。

另外：**批量改名一定要逐个 try/except**，否则一个坏文件会让整个脚本中断，前面改完的也要重跑。

## 四、验证

改完用扩展名白名单复核，必须为 0：

```python
OK = ('.html','.htm','.js','.css','.json','.md','.png','.jpg','.svg','.txt','.ts')
bad = [f for f in os.listdir(d) if os.path.splitext(f)[1].lower() not in OK]
```

改名后 `git status` 会显示成 delete + add 成对出现，属正常。

## 五、执行顺序建议

1. 先 dry-run 打印 `旧名 => 新名`，检查 **collision（新名与现存文件撞名）** 和 **duplicate targets（新旧名互撞）**，两者都必须为 0。
2. 再 apply。
3. 复核异常名归零。

脚本模板见 `scripts/fix_names.py`。
