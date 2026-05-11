#!/usr/bin/env python3
"""
验证技能描述中的数字声称
用法: python verify_counts.py <skill-directory>
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Tuple, Dict

def extract_numeric_claims(text: str) -> List[Tuple[str, int, str]]:
    """
    从文本中提取数字声称
    返回: [(完整匹配, 数字, 单位), ...]
    """
    # 匹配模式: 数字 + 个/种/款/台/套/个技能/个主题/个角色
    patterns = [
        (r'(\d+)\s*个\s*([^\s\d]{1,4})', '个'),  # 193个专家, 72个系统
        (r'(\d+)\s*种\s*([^\s\d]{1,4})', '种'),  # 31种设计
        (r'(\d+)\s*款\s*([^\s\d]{1,4})', '款'),
        (r'(\d+)\s*台\s*([^\s\d]{1,4})', '台'),
        (r'(\d+)\s*套\s*([^\s\d]{1,4})', '套'),
    ]
    
    claims = []
    for pattern, unit in patterns:
        matches = re.finditer(pattern, text)
        for match in matches:
            number = int(match.group(1))
            item_type = match.group(2) if len(match.groups()) > 1 else ''
            full_match = match.group(0)
            claims.append((full_match, number, item_type))
    
    return claims

def count_actual_items(directory: str, patterns: List[str] = None) -> Dict[str, int]:
    """
    统计目录中的实际项目数量
    """
    if not os.path.exists(directory):
        return {"exists": False, "count": 0}
    
    if patterns is None:
        patterns = ["*.md", "*.py", "*.js", "*.ts", "*.json"]
    
    counts = {}
    for pattern in patterns:
        items = list(Path(directory).glob(pattern))
        counts[pattern] = len(items)
    
    total = sum(counts.values())
    return {"exists": True, "count": total, "details": counts}

def verify_skill_description(skill_path: str, check_external: bool = True) -> List[Dict]:
    """
    验证技能描述的准确性
    返回验证结果列表
    
    Args:
        skill_path: 技能目录路径
        check_external: 是否检查外部引用的技能（如 BMAD 角色）
    """
    skill_md = os.path.join(skill_path, "SKILL.md")
    if not os.path.exists(skill_md):
        return [{"error": f"SKILL.md not found in {skill_path}"}]
    
    with open(skill_md, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 提取声称
    claims = extract_numeric_claims(content)
    
    results = []
    
    for full_match, number, item_type in claims:
        result = {
            "claim": full_match,
            "claimed_number": number,
            "item_type": item_type,
        }
        
        # 根据类型确定要检查的目录
        check_dir = None
        check_external_skills = False
        
        if '角色' in item_type or 'agent' in item_type.lower():
            check_dir = os.path.join(skill_path, "agents")
            check_external_skills = True  # 可能引用外部技能
        elif '主题' in item_type or 'theme' in item_type.lower():
            check_dir = os.path.join(skill_path, "themes")
        elif '设计' in item_type:
            check_dir = os.path.join(skill_path, "designs")
        elif '技能' in item_type or 'skill' in item_type.lower():
            check_dir = os.path.join(skill_path, "skills")
        
        result["check_directory"] = check_dir
        
        # 检查本地目录
        if check_dir and os.path.exists(check_dir):
            actual = count_actual_items(check_dir)
            result["actual_count"] = actual["count"]
            result["is_accurate"] = (number == actual["count"])
            result["details"] = actual.get("details", {})
            result["check_method"] = "local_directory"
        
        # 检查外部引用的技能
        elif check_external and check_external_skills and check_external:
            # 尝试在 ~/.workbuddy/skills/ 中查找匹配的技能
            external_skills = check_external_references(content, item_type)
            result["external_matches"] = external_skills
            result["actual_count"] = len(external_skills)
            result["is_accurate"] = (number == len(external_skills))
            result["check_method"] = "external_skills"
            if external_skills:
                result["details"] = {"matched_skills": external_skills}
        
        else:
            # 无法自动验证
            result["is_accurate"] = None
            result["reason"] = "无法自动验证此类型的声称"
            result["suggestion"] = "请手动验证或提供更具体的检查路径"
        
        results.append(result)
    
    return results


def check_external_references(content: str, item_type: str) -> List[str]:
    """
    检查内容中引用的外部技能
    返回匹配的技能名称列表
    """
    matched_skills = []
    
    # 获取所有已安装的技能
    skills_dir = os.path.expanduser("~/.workbuddy/skills")
    if not os.path.exists(skills_dir):
        return matched_skills
    
    # 根据内容上下文确定具体的技能模式
    skill_patterns = []
    
    if '角色' in item_type or 'agent' in item_type.lower():
        # 检查内容中是否明确提到了 BMAD
        if 'BMAD' in content or 'bmad' in content.lower():
            # 精确匹配 BMAD 的 6 个角色
            bmad_roles = [
                'bmad-orchestrator',
                'bmad-architect',
                'bmad-developer', 
                'bmad-product-manager',
                'bmad-scrum-master',
                'bmad-ux-designer'
            ]
            # 检查这些角色是否存在
            for role in bmad_roles:
                if os.path.exists(os.path.join(skills_dir, role)):
                    matched_skills.append(role)
        else:
            # 通用 agent 匹配（更严格的模式）
            skill_patterns = ['agent-', '-agent']
    
    # 如果没有精确匹配，使用通用模式
    if not matched_skills and skill_patterns:
        for skill_name in os.listdir(skills_dir):
            skill_path = os.path.join(skills_dir, skill_name)
            if os.path.isdir(skill_path):
                for pattern in skill_patterns:
                    if pattern.lower() in skill_name.lower():
                        matched_skills.append(skill_name)
                        break
    
    return matched_skills

def print_verification_report(results: List[Dict]):
    """
    打印验证报告
    """
    print("\n" + "="*60)
    print("🔍 技能描述验证报告")
    print("="*60 + "\n")
    
    accurate = []
    inaccurate = []
    unknown = []
    
    for r in results:
        if "error" in r:
            print(f"❌ 错误: {r['error']}")
            continue
        
        if r.get("is_accurate") is None:
            unknown.append(r)
        elif r["is_accurate"]:
            accurate.append(r)
        else:
            inaccurate.append(r)
    
    # 准确的声称
    if accurate:
        print("✅ 准确的声称:\n")
        for r in accurate:
            print(f"  • {r['claim']} → 实际: {r['actual_count']} 个")
        print()
    
    # 虚假的声称
    if inaccurate:
        print("❌ 虚假的声称 (需要修复):\n")
        for r in inaccurate:
            print(f"  • 声称: {r['claim']}")
            print(f"    实际: {r['actual_count']} 个")
            print(f"    建议: 更新描述为实际数量或删除此声称")
            if "details" in r:
                print(f"    详情: {r['details']}")
            print()
    
    # 无法验证的声称
    if unknown:
        print("⚠️  无法自动验证的声称 (需要手动检查):\n")
        for r in unknown:
            print(f"  • {r['claim']}")
            if "reason" in r:
                print(f"    原因: {r['reason']}")
            print()
    
    # 总结
    print("="*60)
    print(f"总结: {len(accurate)} 准确 | {len(inaccurate)} 虚假 | {len(unknown)} 待验证")
    print("="*60)
    
    # 返回是否有虚假声称
    return len(inaccurate) == 0

def main():
    if len(sys.argv) < 2:
        print("用法: python verify_counts.py <skill-directory>")
        print("\n示例:")
        print("  python verify_counts.py ~/.workbuddy/skills/super-human")
        print("  python verify_counts.py .workbuddy/skills/html-ppt")
        sys.exit(1)
    
    skill_path = sys.argv[1]
    
    if not os.path.exists(skill_path):
        print(f"❌ 错误: 目录不存在: {skill_path}")
        sys.exit(1)
    
    print(f"\n🔍 验证技能: {skill_path}\n")
    
    results = verify_skill_description(skill_path)
    all_accurate = print_verification_report(results)
    
    # 退出码: 0=全部准确, 1=有虚假声称
    sys.exit(0 if all_accurate else 1)

if __name__ == "__main__":
    main()
