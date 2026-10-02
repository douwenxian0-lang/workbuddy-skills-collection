#!/usr/bin/env python3
"""
自动检查生成的Agent人设文件是否通过质量标准。
检查 SOUL.md 的结构、内容完整性和风格辨识度。

用法:
    python3 quality_check.py <SOUL.md路径>

示例:
    python3 quality_check.py ./SOUL.md
    
在 SKILL.md Phase 4 中的调用方式:
    python3 {SKILL_DIR}/scripts/quality_check.py ./SOUL.md
"""

import sys
import re
from pathlib import Path


def check_line_count(content: str) -> tuple[bool, str]:
    """检查SOUL.md行数（≤100行）"""
    lines = content.strip().split('\n')
    count = len(lines)
    passed = count <= 100
    return passed, f"{count}行 {'✅' if passed else '❌ (应≤100行)'}"


def check_person_perspective(content: str) -> tuple[bool, str]:
    """检查是否使用第二人称"""
    # 检查「你是」「你的」等第二人称标记
    second_person = len(re.findall(r'你是|你的|你会|你不会|你从不|你总是|你看', content))
    # 检查是否错误使用第三人称「他是」「他的」
    third_person = len(re.findall(r'他是|他的|她是|她的|此人', content))
    if second_person == 0:
        return False, "❌ 未找到第二人称表述（应使用「你是...」）"
    if third_person > second_person:
        return False, f"❌ 第三人称({third_person})多于第二人称({second_person})，应以第二人称为主"
    passed = second_person >= 3
    return passed, f"第二人称: {second_person}处 {'✅' if passed else '❌ (应≥3处)'}"


def check_core_principles(content: str) -> tuple[bool, str]:
    """检查核心准则（3-5条）"""
    # 找核心准则section
    section_match = re.search(r'(?:##\s+.*核心准则|## Core)(.*?)(?=\n##\s|\Z)', content, re.DOTALL | re.IGNORECASE)
    if not section_match:
        return False, "❌ 未找到核心准则section"

    section_text = section_match.group(1)
    # 数加粗项作为准则条目
    principles = re.findall(r'\*\*[^*]+\*\*', section_text)
    count = len(principles)
    passed = 3 <= count <= 5
    return passed, f"核心准则: {count}条 {'✅' if passed else '❌ (应为3-5条)'}"


def check_expression_style(content: str) -> tuple[bool, str]:
    """检查表达风格辨识度"""
    style_section = bool(re.search(r'表达风格|Expression Style', content, re.IGNORECASE))
    if not style_section:
        return False, "❌ 未找到表达风格section"

    style_markers = len(re.findall(r'句式|词汇|语气|幽默|节奏|确定性|引用|口头禅|禁忌词|怼人', content))
    passed = style_markers >= 3
    return passed, f"表达风格特征: {style_markers}项 {'✅' if passed else '❌ (应≥3项)'}"


def check_workflow(content: str) -> tuple[bool, str]:
    """检查回答工作流"""
    has_workflow = bool(re.search(r'回答工作流|Agentic Protocol|工作流', content, re.IGNORECASE))
    if not has_workflow:
        return False, "❌ 未找到回答工作流section"

    has_classify = bool(re.search(r'需要事实|纯框架|混合', content))
    has_research = bool(re.search(r'研究重点|研究维度|搜索时', content))
    steps = sum([has_classify, has_research])
    passed = steps >= 1
    return passed, f"回答工作流包含 {steps}/2 个核心组件 {'✅' if passed else '❌ (应≥1个)'}"


def check_boundaries(content: str) -> tuple[bool, str]:
    """检查边界/局限（至少2条）"""
    boundary_match = re.search(r'(?:##\s+.*边界|## Boundary)(.*?)(?=\n##\s|\Z)', content, re.DOTALL | re.IGNORECASE)
    if not boundary_match:
        return False, "❌ 未找到边界section"

    boundary_text = boundary_match.group(1)
    items = re.findall(r'^[-*]\s+', boundary_text, re.MULTILINE)
    count = len(items)
    passed = count >= 2
    return passed, f"边界: {count}条 {'✅' if passed else '❌ (应≥2条)'}"


def check_continuity(content: str) -> tuple[bool, str]:
    """检查连续性section"""
    has_continuity = bool(re.search(r'连续性|Continuity|每次会话醒来', content, re.IGNORECASE))
    return has_continuity, "有连续性说明 ✅" if has_continuity else "❌ 未找到连续性section"


def main():
    if len(sys.argv) < 2:
        print("用法: python3 quality_check.py <SOUL.md路径>")
        sys.exit(1)

    soul_path = Path(sys.argv[1])
    if not soul_path.exists():
        print(f"❌ 文件不存在: {soul_path}")
        sys.exit(1)

    content = soul_path.read_text(encoding='utf-8')

    checks = [
        ("行数限制", check_line_count),
        ("第二人称", check_person_perspective),
        ("核心准则", check_core_principles),
        ("表达风格", check_expression_style),
        ("回答工作流", check_workflow),
        ("边界", check_boundaries),
        ("连续性", check_continuity),
    ]

    print(f"Agent人设质量检查: {soul_path.name}")
    print("=" * 50)

    passed_count = 0
    total = len(checks)

    for name, check_fn in checks:
        passed, detail = check_fn(content)
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {name:<10} {status}  {detail}")
        if passed:
            passed_count += 1

    print("=" * 50)
    print(f"结果: {passed_count}/{total} 通过")

    if passed_count == total:
        print("🎉 全部通过，Agent人设可以写入")
    elif passed_count >= total - 1:
        print("⚠️ 基本通过，建议修复不通过项")
    else:
        print("❌ 多项不通过，建议回到Phase 2迭代")

    sys.exit(0 if passed_count == total else 1)


if __name__ == '__main__':
    main()
