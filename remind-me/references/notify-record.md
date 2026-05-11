## 工作流程

Mac 平台执行示例：

```bash
osascript -e '
  tell application "Reminders"
    tell list "提醒事项"
      make new reminder with properties {name:"📖 DeskTerm 学习 Day1: Swift 基础 — 官方 Guided Tour (2h)",
        body:"https://docs.swift.org/swift-book/GuidedTour.html\n重点: enum/struct/class、optional、闭包语法"}
    end tell
  end tell
'
```

Windows 平台执行示例：

```powershell
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show("📖 DeskTerm 学习 Day1: Swift 基础 — 官方 Guided Tour (2h)`nhttps://docs.swift.org/swift-book/GuidedTour.html`n重点: enum/struct/class、optional、闭包语法", "提醒事项")
```