#!/usr/bin/env python3
"""
市场调研：痛点自动挖掘分析 — 工具脚本
立项没方向？自动深挖市场痛点，一份报告帮你稳过评审

目标用户: 产品经理、市场分析师、创业者
输出产物: 市场调研报告、需求优先级矩阵
"""

import sys, json, os, argparse
from datetime import datetime
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")


def ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)


def cmd_run(args):
    """市场调研：痛点自动挖掘分析 - 主工作流"""
    ensure_dirs()
    input_data = args.input or ""
    output_path = args.output or os.path.join(DATA_DIR, "output_{}.md".format(datetime.now().strftime("%Y%m%d_%H%M%S")))
    
    # Generate Markdown report
    report = f"""# 📋 市场调研：痛点自动挖掘分析

**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M')}
**输入**: {input_data}

## 分析结果

[此处将由AI基于web_search/web_fetch的真实数据填充]

## 详细内容

| 序号 | 项目 | 状态 | 说明 |
|------|------|------|------|
| 1 | [待填充] | [待填充] | [待填充] |

## 建议

[基于分析给出的具体建议]

---
*报告由AI自动生成，仅供参考*
"""
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)
    
    result = {
        "status": "success",
        "output_file": output_path,
        "input": input_data,
        "message": f"市场调研：痛点自动挖掘分析报告已生成到 {output_path}",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_status(args):
    """查看当前状态"""
    data_files = []
    if os.path.exists(DATA_DIR):
        data_files = [f for f in os.listdir(DATA_DIR) if not f.startswith(".")]
    result = {
        "skill": "market-pain-finder",
        "scene": "市场调研：痛点自动挖掘分析",
        "data_dir": DATA_DIR,
        "data_files": data_files,
        "file_count": len(data_files),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_export(args):
    """导出结果"""
    fmt = getattr(args, "format", "json") or "json"
    data_files = []
    if os.path.exists(DATA_DIR):
        data_files = [os.path.join(DATA_DIR, f) for f in os.listdir(DATA_DIR) if not f.startswith(".")]
    
    if fmt == "json":
        output = json.dumps({"files": data_files, "count": len(data_files)}, ensure_ascii=False, indent=2)
    else:
        output = "\n".join(data_files)
    
    print(output)
    return 0


def main():
    parser = argparse.ArgumentParser(description="市场调研：痛点自动挖掘分析")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    run_p = subparsers.add_parser("run", help="执行主工作流")
    run_p.add_argument("--input", "-i", help="输入数据或描述")
    run_p.add_argument("--output", "-o", help="输出文件路径")
    
    subparsers.add_parser("status", help="查看当前状态")
    
    export_p = subparsers.add_parser("export", help="导出结果")
    export_p.add_argument("format", nargs="?", default="json", help="导出格式")
    
    args = parser.parse_args()
    
    if args.command == "run":
        return cmd_run(args)
    elif args.command == "status":
        return cmd_status(args)
    elif args.command == "export":
        return cmd_export(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
