# scripts/process.py
def format_text(text):
    # 删除多余空格
    text = ' '.join(text.split())

    # 首字母大写
    text = text.capitalize()

    # 添加句号（如果缺失）
    if not text.endswith(('.', '!', '?')):
        text += '.'

    return text