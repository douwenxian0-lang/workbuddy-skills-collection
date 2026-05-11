#!/bin/bash
# 通用对话框封装，自动检测可用的对话框工具

# 检测可用的对话框工具
_detect_dialog_tool() {
    if command -v zenity &> /dev/null; then
        echo "zenity"
    elif command -v kdialog &> /dev/null; then
        echo "kdialog"
    elif command -v notify-send &> /dev/null; then
        echo "notify-send"
    else
        echo "none"
    fi
}

DIALOG_TOOL=${DIALOG_TOOL:-$(_detect_dialog_tool)}

# 显示信息对话框
dialog_info() {
    local title="$1"
    local message="$2"
    local timeout="${3:-0}"

    case "$DIALOG_TOOL" in
        zenity)
            if [ "$timeout" -gt 0 ]; then
                zenity --info --title="$title" --text="$message" --timeout="$timeout" 2>/dev/null
            else
                zenity --info --title="$title" --text="$message" 2>/dev/null
            fi
            ;;
        kdialog)
            kdialog --title "$title" --msgbox "$message" 2>/dev/null
            ;;
        notify-send)
            notify-send "$title" "$message" 2>/dev/null
            ;;
        *)
            echo "[$title] $message" >&2
            ;;
    esac
}

# 显示确认对话框（两个按钮）
# 返回: 0=第一个按钮(已确认), 1=第二个按钮(稍后), 2=取消/超时
dialog_confirm() {
    local title="$1"
    local message="$2"
    local btn1="${3:-已确认}"
    local btn2="${4:-稍后（30分钟）}"

    case "$DIALOG_TOOL" in
        zenity)
            # zenity --question 只有 Yes/No，使用 --list 模拟两个按钮
            result=$(zenity --list --title="$title" --text="$message" \
                --column="选项" "$btn1" "$btn2" \
                --height=200 --width=300 2>/dev/null)
            if [ "$result" = "$btn1" ]; then
                return 0
            elif [ "$result" = "$btn2" ]; then
                return 1
            else
                return 2
            fi
            ;;
        kdialog)
            kdialog --title "$title" --yesno "$message\n\n选择：是=$btn1，否=$btn2" 2>/dev/null
            exit_code=$?
            if [ $exit_code -eq 0 ]; then
                return 0
            elif [ $exit_code -eq 1 ]; then
                return 1
            else
                return 2
            fi
            ;;
        notify-send)
            # notify-send 不支持交互式按钮，使用超时通知
            notify-send "$title" "$message" 2>/dev/null
            return 2
            ;;
        *)
            echo "[$title] $message" >&2
            echo "选项: 1=$btn1, 2=$btn2" >&2
            read -t 300 -p "选择 (1/2): " choice
            if [ "$choice" = "1" ]; then
                return 0
            elif [ "$choice" = "2" ]; then
                return 1
            else
                return 2
            fi
            ;;
    esac
}

# 显示通知（非阻塞）
dialog_notify() {
    local title="$1"
    local message="$2"

    if command -v notify-send &> /dev/null; then
        notify-send "$title" "$message" 2>/dev/null
    elif [ "$DIALOG_TOOL" = "zenity" ]; then
        # zenity 通知是阻塞的，在后台运行
        (zenity --notification --text="$title: $message" 2>/dev/null) &
    else
        echo "[$title] $message" >&2
    fi
}

# 导出函数以便其他脚本使用
export -f dialog_info dialog_confirm dialog_notify