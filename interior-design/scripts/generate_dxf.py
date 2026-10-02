#!/usr/bin/env python3
"""
generate_dxf.py - 室内设计布局DXF生成器
使用ezdxf库生成CAD布局图

依赖: pip install ezdxf>=1.0.0
"""

import ezdxf
from ezdxf.enums import TextEntityAlignment
from dataclasses import dataclass
from typing import List, Optional, Tuple
import argparse
import json

# ============================================================
# 数据类定义
# ============================================================

@dataclass
class Room:
    """房间参数"""
    name: str
    width: float  # X方向，mm
    depth: float  # Y方向，mm
    height: float = 2800  # 层高，mm

@dataclass
class Furniture:
    """家具定义"""
    name: str
    x: float  # 左下角X坐标
    y: float  # 左下角Y坐标
    width: float  # 宽度，mm
    depth: float  # 进深，mm
    rotation: float = 0  # 旋转角度，度
    layer: str = "FURNITURE"
    color: int = 7  # AutoCAD颜色索引

@dataclass
class Door:
    """门定义"""
    x: float
    y: float
    width: float  # 门洞宽度
    rotation: float = 0  # 开门方向
    layer: str = "DOORS"
    
@dataclass
class Window:
    """窗户定义"""
    x: float
    y: float
    width: float
    height: float = 1500  # 窗高，mm
    sill_height: float = 900  # 窗台高，mm
    layer: str = "WINDOWS"

# ============================================================
# DXF生成器类
# ============================================================

class InteriorDXFGenerator:
    """室内设计DXF生成器"""
    
    # AutoCAD颜色索引
    COLORS = {
        "wall": 5,      # 蓝色
        "furniture": 7, # 白色
        "door": 3,      # 绿色
        "window": 4,    # 青色
        "dimension": 2, # 黄色
        "text": 7,      # 白色
        "axis": 1,      # 红色
    }
    
    # 图层定义
    LAYERS = [
        ("WALLS", "墙体"),
        ("FURNITURE", "家具"),
        ("DOORS", "门"),
        ("WINDOWS", "窗"),
        ("DIMENSIONS", "标注"),
        ("TEXT", "文字"),
        ("AXIS", "轴线"),
        ("FLOOR", "地面铺装"),
    ]
    
    def __init__(self, dxf_version="R2018"):
        """初始化DXF文档"""
        self.doc = ezdxf.new(dxf_version, setup=True)
        self.msp = self.doc.modelspace()
        self._setup_layers()
        self._setup_styles()
    
    def _setup_layers(self):
        """设置图层"""
        for layer_name, desc in self.LAYERS:
            if layer_name not in self.doc.layers:
                self.doc.layers.new(name=layer_name, dxfattribs={})
    
    def _setup_styles(self):
        """设置文字样式"""
        # 创建中文文字样式（需要系统中文字体）
        if "SIMHEI" not in self.doc.styles:
            self.doc.styles.new("SIMHEI", dxfattribs={
                "font": "simhei.ttf",
                "width": 0.7
            })
    
    def draw_room(self, room: Room, origin: Tuple[float, float] = (0, 0)):
        """绘制房间轮廓（墙体）"""
        x0, y0 = origin
        x1, y1 = x0 + room.width, y0 + room.depth
        
        # 外墙线
        wall_thickness = 240  # 24墙
        
        # 外轮廓
        self.msp.add_lwpolyline([
            (x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)
        ], dxfattribs={"layer": "WALLS", "color": self.COLORS["wall"], "lineweight": 50})
        
        # 内轮廓（减去墙厚）
        self.msp.add_lwpolyline([
            (x0 + wall_thickness, y0 + wall_thickness),
            (x1 - wall_thickness, y0 + wall_thickness),
            (x1 - wall_thickness, y1 - wall_thickness),
            (x0 + wall_thickness, y1 - wall_thickness),
            (x0 + wall_thickness, y0 + wall_thickness)
        ], dxfattribs={"layer": "WALLS", "color": self.COLORS["wall"]})
        
        # 房间名称
        self.msp.add_text(
            room.name,
            dxfattribs={
                "layer": "TEXT",
                "height": 400,
                "color": self.COLORS["text"],
                "style": "SIMHEI"
            }
        ).set_placement((x0 + room.width/2, y0 + room.depth/2), align=TextEntityAlignment.MIDDLE_CENTER)
    
    def draw_furniture(self, furniture: Furniture):
        """绘制家具"""
        # 绘制家具轮廓矩形
        points = self._rotate_rect(
            furniture.x, furniture.y,
            furniture.width, furniture.depth,
            furniture.rotation
        )
        
        self.msp.add_lwpolyline(
            points + [points[0]],  # 闭合
            dxfattribs={
                "layer": furniture.layer,
                "color": furniture.color,
                "lineweight": 25
            }
        )
        
        # 家具名称标注
        cx = furniture.x + furniture.width / 2
        cy = furniture.y + furniture.depth / 2
        self.msp.add_text(
            furniture.name,
            dxfattribs={
                "layer": "TEXT",
                "height": 200,
                "color": self.COLORS["text"],
                "style": "SIMHEI"
            }
        ).set_placement((cx, cy), align=TextEntityAlignment.MIDDLE_CENTER)
    
    def draw_door(self, door: Door):
        """绘制门（含开启弧线）"""
        # 门洞开口
        self.msp.add_line(
            (door.x, door.y),
            (door.x + door.width, door.y),
            dxfattribs={"layer": "DOORS", "color": self.COLORS["door"]}
        )
        
        # 门板（90度开启弧线）
        import math
        arc_points = []
        for i in range(10):
            angle = math.radians(i * 9)  # 0-90度
            x = door.x + door.width * math.cos(angle)
            y = door.y + door.width * math.sin(angle)
            arc_points.append((x, y))
        
        self.msp.add_lwpolyline(
            arc_points,
            dxfattribs={"layer": "DOORS", "color": self.COLORS["door"]}
        )
    
    def draw_window(self, window: Window):
        """绘制窗户"""
        # 窗户符号（双线+中线）
        offset = 50  # 双线间距
        
        self.msp.add_line(
            (window.x, window.y),
            (window.x + window.width, window.y),
            dxfattribs={"layer": "WINDOWS", "color": self.COLORS["window"]}
        )
        self.msp.add_line(
            (window.x, window.y + offset),
            (window.x + window.width, window.y + offset),
            dxfattribs={"layer": "WINDOWS", "color": self.COLORS["window"]}
        )
        self.msp.add_line(
            (window.x, window.y + offset/2),
            (window.x + window.width, window.y + offset/2),
            dxfattribs={"layer": "WINDOWS", "color": self.COLORS["window"], "linetype": "CENTER"}
        )
    
    def draw_dimension(self, start: Tuple[float, float], end: Tuple[float, float], 
                       offset: float = 500, text: str = None):
        """绘制尺寸标注"""
        # 简化版标注（仅直线+文字）
        mid_x = (start[0] + end[0]) / 2
        mid_y = (start[1] + end[1]) / 2
        
        # 标注线
        self.msp.add_line(start, end, dxfattribs={"layer": "DIMENSIONS", "color": self.COLORS["dimension"]})
        
        # 引出线
        self.msp.add_line(start, (start[0], start[1] + offset), dxfattribs={"layer": "DIMENSIONS"})
        self.msp.add_line(end, (end[0], end[1] + offset), dxfattribs={"layer": "DIMENSIONS"})
        
        # 尺寸文字
        if text is None:
            length = abs(end[0] - start[0]) if abs(end[0] - start[0]) > abs(end[1] - start[1]) else abs(end[1] - start[1])
            text = f"{int(length)}mm"
        
        self.msp.add_text(
            text,
            dxfattribs={
                "layer": "DIMENSIONS",
                "height": 150,
                "color": self.COLORS["dimension"]
            }
        ).set_placement((mid_x, mid_y + offset), align=TextEntityAlignment.BOTTOM_CENTER)
    
    def draw_floor_tiles(self, room: Room, tile_size: Tuple[float, float] = (750, 1500),
                        origin: Tuple[float, float] = (0, 0)):
        """绘制地面铺装示意"""
        tile_w, tile_h = tile_size
        x0, y0 = origin
        
        for y in range(int(y0), int(y0 + room.depth), int(tile_h)):
            for x in range(int(x0), int(x0 + room.width), int(tile_w)):
                self.msp.add_lwpolyline([
                    (x, y), (x + tile_w, y), (x + tile_w, y + tile_h), 
                    (x, y + tile_h), (x, y)
                ], dxfattribs={"layer": "FLOOR", "color": 8, "linetype": "CONTINUOUS"})
    
    def _rotate_rect(self, x, y, w, h, angle) -> List[Tuple[float, float]]:
        """旋转矩形顶点"""
        import math
        rad = math.radians(angle)
        cos_a, sin_a = math.cos(rad), math.sin(rad)
        
        # 四个角点（相对于中心）
        cx, cy = x + w/2, y + h/2
        corners = [(-w/2, -h/2), (w/2, -h/2), (w/2, h/2), (-w/2, h/2)]
        
        # 旋转并平移
        return [(cx + px*cos_a - py*sin_a, cy + px*sin_a + py*cos_a) for px, py in corners]
    
    def save(self, filepath: str):
        """保存DXF文件"""
        self.doc.saveas(filepath)
        return filepath


# ============================================================
# 便捷函数
# ============================================================

def create_living_room_layout(
    width: float = 10000,
    depth: float = 12000,
    style: str = "现代简约",
    output: str = "layout.dxf"
) -> str:
    """
    快速生成客厅布局
    
    Args:
        width: 客厅宽度 (mm)
        depth: 客厅进深 (mm)
        style: 设计风格
        output: 输出文件路径
    
    Returns:
        生成的DXF文件路径
    """
    gen = InteriorDXFGenerator()
    
    # 创建房间
    room = Room("客厅", width, depth, 2800)
    gen.draw_room(room)
    
    # 添加轴线标记
    gen.msp.add_line((0, 0), (width, 0), dxfattribs={"layer": "AXIS", "color": 1, "linetype": "CENTER"})
    gen.msp.add_line((0, 0), (0, depth), dxfattribs={"layer": "AXIS", "color": 1, "linetype": "CENTER"})
    
    # 地面铺装
    gen.draw_floor_tiles(room, (750, 1500))
    
    # 尺寸标注
    gen.draw_dimension((0, -500), (width, -500), 800)
    gen.draw_dimension((-500, 0), (-500, depth), 800)
    
    gen.save(output)
    return output


def create_2br_layout(
    width: float = 9000,
    depth: float = 10000,
    output: str = "layout_2br.dxf"
) -> str:
    """
    生成80㎡两房一厅户型布局
    
    Args:
        width: 全屋宽度 (mm), 默认9m
        depth: 全屋进深 (mm), 默认10m
        output: 输出文件路径
    
    Returns:
        生成的DXF文件路径
    """
    gen = InteriorDXFGenerator()
    
    # 户型布局（从左下角开始，顺时针布局）
    # 全屋 9000×10000mm
    
    # ========== 房间定义 ==========
    # 客餐厅（左下，最大空间）
    living_width, living_depth = 5000, 5500
    # 主卧（右上）
    master_width, master_depth = 3600, 4000
    # 次卧（右下）
    second_width, second_depth = 3600, 3000
    # 厨房（左上）
    kitchen_width, kitchen_depth = 4000, 2500
    # 卫生间（中上）
    bath_width, bath_depth = 2000, 2500
    
    # ========== 绘制外墙轮廓 ==========
    wall_thickness = 240
    # 外墙外轮廓
    gen.msp.add_lwpolyline([
        (0, 0), (width, 0), (width, depth), (0, depth), (0, 0)
    ], dxfattribs={"layer": "WALLS", "color": 5, "lineweight": 50})
    # 外墙内轮廓
    gen.msp.add_lwpolyline([
        (wall_thickness, wall_thickness),
        (width - wall_thickness, wall_thickness),
        (width - wall_thickness, depth - wall_thickness),
        (wall_thickness, depth - wall_thickness),
        (wall_thickness, wall_thickness)
    ], dxfattribs={"layer": "WALLS", "color": 5})
    
    # ========== 绘制内墙 ==========
    # 内墙厚度120mm
    inner_wall = 120
    
    # 1. 客餐厅与厨房隔墙（水平，y=5500）
    gen.msp.add_line((0, living_depth), (living_width, living_depth), 
                     dxfattribs={"layer": "WALLS", "color": 5, "lineweight": 35})
    gen.msp.add_line((0, living_depth - inner_wall), (living_width, living_depth - inner_wall), 
                     dxfattribs={"layer": "WALLS", "color": 5})
    
    # 2. 客餐厅与次卧隔墙（垂直，x=5000）
    gen.msp.add_line((living_width, 0), (living_width, second_depth), 
                     dxfattribs={"layer": "WALLS", "color": 5, "lineweight": 35})
    gen.msp.add_line((living_width - inner_wall, 0), (living_width - inner_wall, second_depth), 
                     dxfattribs={"layer": "WALLS", "color": 5})
    
    # 3. 次卧与主卧隔墙（水平，y=3000）
    gen.msp.add_line((living_width, second_depth), (width, second_depth), 
                     dxfattribs={"layer": "WALLS", "color": 5, "lineweight": 35})
    gen.msp.add_line((living_width, second_depth - inner_wall), (width, second_depth - inner_wall), 
                     dxfattribs={"layer": "WALLS", "color": 5})
    
    # 4. 厨房与卫生间隔墙（垂直，x=4000）
    gen.msp.add_line((kitchen_width, living_depth), (kitchen_width, living_depth + bath_depth), 
                     dxfattribs={"layer": "WALLS", "color": 5, "lineweight": 35})
    gen.msp.add_line((kitchen_width - inner_wall, living_depth), (kitchen_width - inner_wall, living_depth + bath_depth), 
                     dxfattribs={"layer": "WALLS", "color": 5})
    
    # 5. 卫生间与主卧隔墙（水平，y=8000）
    bath_top = living_depth + bath_depth
    gen.msp.add_line((0, bath_top), (kitchen_width, bath_top), 
                     dxfattribs={"layer": "WALLS", "color": 5, "lineweight": 35})
    gen.msp.add_line((0, bath_top - inner_wall), (kitchen_width, bath_top - inner_wall), 
                     dxfattribs={"layer": "WALLS", "color": 5})
    
    # ========== 房间名称标注 ==========
    rooms = [
        ("客餐厅", living_width/2, living_depth/2 - inner_wall),
        ("主卧", living_width + master_width/2, second_depth + master_depth/2),
        ("次卧", living_width + second_width/2, second_depth/2),
        ("厨房", kitchen_width/2, living_depth + kitchen_depth/2),
        ("卫生间", kitchen_width + bath_width/2, living_depth + bath_depth/2),
    ]
    for name, x, y in rooms:
        gen.msp.add_text(name, dxfattribs={
            "layer": "TEXT", "height": 350, "color": 7, "style": "SIMHEI"
        }).set_placement((x, y), align=TextEntityAlignment.MIDDLE_CENTER)
    
    # ========== 门的绘制 ==========
    # 客餐厅入户门（左下角，900mm）
    entry_door = Door(x=0, y=1500, width=900, layer="DOORS")
    gen.draw_door(entry_door)
    
    # 厨房门（从客餐厅进厨房，800mm）
    kitchen_door = Door(x=1500, y=living_depth - inner_wall, width=800, layer="DOORS")
    gen.draw_door(kitchen_door)
    
    # 卫生间门（700mm）
    bath_door = Door(x=kitchen_width + 200, y=living_depth, width=700, layer="DOORS")
    gen.draw_door(bath_door)
    
    # 次卧门（900mm）
    second_door = Door(x=living_width - inner_wall, y=1500, width=900, layer="DOORS")
    gen.draw_door(second_door)
    
    # 主卧门（900mm）
    master_door = Door(x=living_width + 1500, y=second_depth - inner_wall, width=900, layer="DOORS")
    gen.draw_door(master_door)
    
    # ========== 窗户绘制 ==========
    # 客餐厅落地窗（南向，3200mm）
    living_window = Window(x=800, y=0, width=3200, layer="WINDOWS")
    gen.draw_window(living_window)
    
    # 主卧窗（东向，1800mm）
    master_window = Window(x=width - wall_thickness, y=second_depth + 1000, width=1800, layer="WINDOWS")
    gen.draw_window(master_window)
    
    # 次卧窗（南向，1500mm）
    second_window = Window(x=living_width + 1000, y=0, width=1500, layer="WINDOWS")
    gen.draw_window(second_window)
    
    # 厨房窗（西向，600mm）
    kitchen_window = Window(x=0, y=living_depth + 800, width=600, layer="WINDOWS")
    gen.draw_window(kitchen_window)
    
    # ========== 尺寸标注 ==========
    # 总尺寸
    gen.draw_dimension((0, -800), (width, -800), 1200, f"{int(width)}mm")
    gen.draw_dimension((-800, 0), (-800, depth), 1200, f"{int(depth)}mm")
    
    # 分段尺寸
    gen.draw_dimension((0, -400), (living_width, -400), 600, f"{int(living_width)}mm")
    gen.draw_dimension((living_width, -400), (width, -400), 600, f"{int(width-living_width)}mm")
    
    # ========== 保存 ==========
    gen.save(output)
    return output


# ============================================================
# CLI接口
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="室内设计DXF布局生成器")
    parser.add_argument("--width", type=float, default=10000, help="房间宽度(mm)")
    parser.add_argument("--depth", type=float, default=12000, help="房间进深(mm)")
    parser.add_argument("--height", type=float, default=2800, help="房间高度(mm)")
    parser.add_argument("--style", type=str, default="现代简约", help="设计风格")
    parser.add_argument("--output", type=str, default="layout.dxf", help="输出文件路径")
    parser.add_argument("--json", type=str, help="从JSON文件读取家具配置")
    parser.add_argument("--layout", type=str, choices=["single", "2br"], default="single", help="户型布局: single=单房间, 2br=两房一厅")
    
    args = parser.parse_args()
    
    if args.layout == "2br":
        # 两房一厅户型
        output = create_2br_layout(
            width=args.width,
            depth=args.depth,
            output=args.output
        )
        print(f"2BR layout generated: {output}")
        return
    
    # 单房间布局
    gen = InteriorDXFGenerator()
    room = Room(f"{args.style}客厅", args.width, args.depth, args.height)
    gen.draw_room(room)
    
    # 如果提供了JSON配置文件，读取并添加家具
    if args.json:
        with open(args.json, 'r', encoding='utf-8') as f:
            config = json.load(f)
            for item in config.get("furniture", []):
                furniture = Furniture(**item)
                gen.draw_furniture(furniture)
    
    # 地面铺装
    gen.draw_floor_tiles(room, (750, 1500))
    
    # 轴线标注
    gen.draw_dimension((0, -500), (args.width, -500), 800)
    gen.draw_dimension((-500, 0), (-500, args.depth), 800)
    
    gen.save(args.output)
    print(f"DXF file generated: {args.output}")


if __name__ == "__main__":
    main()
