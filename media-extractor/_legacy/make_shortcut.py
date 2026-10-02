# -*- coding: utf-8 -*-
"""
Create WechatExtractor.lnk on desktop using PowerShell COM
"""
import os, sys, subprocess

DESKTOP = os.path.join(os.environ['USERPROFILE'], 'Desktop')
SKILL   = r'C:\Users\Administrator\.qclaw\skills\media-extractor'
BAT     = os.path.join(SKILL, '启动微信图片提取器.bat')
ICO     = os.path.join(SKILL, 'wechat.ico')
LNK     = os.path.join(DESKTOP, 'WechatExtractor.lnk')

# Escape paths for PowerShell double-quoted string
def ps_escape(s):
    return s.replace('\\', '\\\\').replace('"', '`\"').replace('$', '`$')

ps = r'''
$bat = "%s"
$ico = "%s"
$lnk = "%s"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($lnk)
$shortcut.TargetPath = $bat
$shortcut.WorkingDirectory = $bat.Substring(0, $bat.LastIndexOf('\'))
$shortcut.IconLocation = $ico
$shortcut.Description = "Wechat Image Extractor"
$shortcut.Save()
Write-Output "OK: $lnk created"
''' % (BAT.replace('\\','\\\\'), ICO.replace('\\','\\\\'), LNK.replace('\\','\\\\'))

r = subprocess.run(
    ['powershell', '-ExecutionPolicy', 'Bypass', '-NoProfile', '-Command', ps],
    capture_output=True, text=True,
    encoding='utf-8', errors='replace'
)
print('stdout:', r.stdout)
print('stderr:', r.stderr)
print('returncode:', r.returncode)

if os.path.exists(LNK):
    print('LNK size:', os.path.getsize(LNK), 'bytes')
else:
    print('ERROR: LNK not created')
    sys.exit(1)
