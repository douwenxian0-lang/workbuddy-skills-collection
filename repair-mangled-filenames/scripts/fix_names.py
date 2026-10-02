import os, re, html, unicodedata, sys

D = r"C:/Users/Administrator/.workbuddy/skills/tencentmap-jsapi-gl-skill/references/jsapigl/demos"
OK = ('.html', '.htm', '.js', '.css', '.json', '.md', '.png', '.jpg', '.svg', '.txt', '.ts')


CODECS = ('cp1252', 'cp1250', 'cp1251', 'cp1254', 'latin-1', 'mac_cyrillic')


def _plausible(res, cand):
    if not res or res == cand:
        return False
    if '  ' in res or '\x00' in res:
        return False
    return True


def decode_moji(name):
    """Names were produced by decoding UTF-8 bytes with a wrong single-byte codec.
    Reverse it; tolerate a truncated trailing byte sequence."""
    cands = []
    nfc = unicodedata.normalize('NFC', name)
    if nfc != name:
        cands.append(nfc)
    cands.append(name)
    # pass 1: strict decode with every candidate codec
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
            if _plausible(res, cand):
                return res
    # pass 2: tolerate truncated trailing bytes
    for cand in cands:
        for enc in CODECS:
            try:
                raw = cand.encode(enc)
            except Exception:
                continue
            res = raw.decode('utf-8', errors='ignore')
            if _plausible(res, cand):
                return res
    for cand in cands:
        # per-character tolerant path (skips combining marks)
        buf = bytearray()
        for ch in cand:
            if unicodedata.combining(ch):
                continue
            got = None
            for enc in ('cp1251', 'cp1252', 'latin-1'):
                try:
                    got = ch.encode(enc)
                    break
                except Exception:
                    continue
            buf += got if got is not None else b'\x00'
        res = buf.decode('utf-8', errors='ignore')
        if res and res != cand:
            return res
    return None


def is_moji(name):
    return any('\u0400' <= c <= '\u04FF' for c in name) or any(unicodedata.combining(c) for c in name)


def get_title(path):
    try:
        txt = open(path, encoding='utf-8', errors='ignore').read(4000)
    except Exception:
        return None
    m = re.search(r'<title>(.*?)</title>', txt, re.S | re.I)
    return html.unescape(m.group(1).strip()) if m else None


def safe(name):
    for bad in '/\\:*?"<>|':
        name = name.replace(bad, '_')
    return name.rstrip('. ')


def main(apply_changes=False):
    files = sorted(os.listdir(D))
    existing = set(files)
    bad = [f for f in files if os.path.splitext(f)[1].lower() not in OK]

    # categories used by intact files, for prefix completion of damaged names
    known = set()
    for f in files:
        if os.path.splitext(f)[1].lower() in OK and '_' in f:
            known.add(f.split('_')[0])

    plan = []
    for f in bad:
        stem = os.path.splitext(f)[0]
        ti = get_title(os.path.join(D, f))
        note = ''
        if is_moji(stem):
            dec = decode_moji(stem)
            if dec:
                cat = dec.split('_')[0] if '_' in dec else dec
                note = 'moji->' + dec
            else:
                cat = stem.split('_')[0]
                note = 'moji FAIL'
        else:
            cat = stem.split('_')[0]
        # complete a truncated category against categories seen in intact files
        if cat not in known:
            matches = [k for k in known if k.startswith(cat) and len(k) > len(cat)]
            if len(matches) == 1:
                note += ' | cat %s->%s' % (cat, matches[0])
                cat = matches[0]
        new = safe((cat + '_' + ti + '.html') if ti else (stem + '.html'))
        if not new.endswith('.html'):
            new += '.html'
        plan.append((f, new, note))

    for f, new, note in plan:
        tag = ''
        if new in existing and new != f:
            tag = '  <<< COLLISION -> fallback to stem'
            new = safe(os.path.splitext(f)[0] + '.html')
        if new == f:
            tag = '  (unchanged)'
        print('%-44s => %-46s %s%s' % (f[:44], new[:46], note, tag))

    names = [p[1] for p in plan]
    print('\ncollisions: %d   duplicate targets: %d   total: %d'
          % (sum(1 for p in plan if p[1] in existing and p[1] != p[0]),
             len(names) - len(set(names)), len(plan)))

    if not apply_changes:
        return
    done = 0
    for f, new, note in plan:
        if new == f or new in existing:
            continue
        src, dst = os.path.join(D, f), os.path.join(D, new)
        try:
            os.rename(src, dst)
        except OSError:
            # Windows swallows a trailing dot/space; use the extended-length prefix
            src_x = '\\\\?\\' + os.path.abspath(src)
            dst_x = '\\\\?\\' + os.path.abspath(dst)
            try:
                os.rename(src_x, dst_x)
            except OSError as e:
                print('FAIL: %r -> %r  %s' % (f, new, e))
                continue
        existing.add(new)
        done += 1
    print('renamed: %d' % done)


if __name__ == '__main__':
    main(apply_changes=(len(sys.argv) > 1 and sys.argv[1] == 'apply'))
