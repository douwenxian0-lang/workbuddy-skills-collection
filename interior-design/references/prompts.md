# AI提示词模板

## 目录

1. [彩平图提示词](#彩平图提示词)
2. [效果图提示词](#效果图提示词)
3. [SU/3D相机参数](#su3d相机参数)
4. [分风格提示词关键词](#分风格提示词关键词)

---

## 彩平图提示词

### 通用结构
```
[视图] [空间类型] [风格] 彩平图，
[布局描述：分区+家具+动线]，
[材质标注：地面+墙面+重点材质]，
[配色：主色+辅色+点缀色]，
[细节：绿植/装饰/标注]，
[技术：俯视，高清，精细线条，专业彩平图，标注清晰]
```

### 总图模板（全屋）
```
鸟瞰室内彩平图，[风格]风格，[面积]㎡全屋布局，
[空间1]：[家具+位置]，
[空间2]：[家具+位置]，
[空间3]：[家具+位置]，
地面：[材质+颜色]通铺，[分区材质变化]，
墙面：[材质+颜色]，
动线：主通道[宽度]mm，
标注：尺寸线+功能区标注，
风格：专业彩平图，精细线稿+色块填充，8K高清
```

### 分区放大模板
```
[空间名]放大彩平图，[风格]风格，
[家具1]：[位置+尺寸+材质+颜色]，
[家具2]：[位置+尺寸+材质+颜色]，
[家具3]：[位置+尺寸+材质+颜色]，
地面：[材质]，
灯光标注：[灯具位置+色温]，
细节：[绿植/挂画/地毯/装饰]，
技术：1:50比例，精细线稿，专业标注，高清
```

---

## 效果图提示词

### 三版结构

每个视角提供三版提示词：

#### 写实版
```
Interior photography, [空间] in [风格] style,
[主体描述：家具+布局+材质]，
[环境：窗户+光线+植物]，
[光线：自然光/人工光，方向+色温]，
[细节：纹理+反射+阴影]，
Photorealistic, 8K, DSLR, [焦距]mm, f/[光圈], natural lighting,
architectural photography, interior design magazine quality
```

#### 氛围版
```
Cinematic interior, [空间] in [风格] style,
[主体+氛围关键词：温馨/静谧/奢华/...]，
Soft [色温]K lighting, [光线特征]，
[情绪关键词：serene/warm/luxurious/...]，
Mood board aesthetic, film grain, color grading,
atmospheric, editorial style
```

#### 草图纸版
```
Interior sketch, [空间] in [风格] style,
[主体简述]，
Hand-drawn lines, pencil + watercolor wash,
architectural sketch, loose lines, [色调] tint,
concept art, work-in-progress feel
```

---

## SU/3D相机参数

### 视角预设

| 视角名称 | 焦距 | 相机高度 | 适用 |
|---------|------|---------|------|
| 全景广角 | 16mm | 1.2m | 大空间全貌 |
| 主视角 | 24mm | 1.6m | 人眼视角 |
| 中景 | 35mm | 1.5m | 单区展示 |
| 局部特写 | 50mm | 1.2m | 家具/材质细节 |
| 俯视 | 35mm | 3.0m | 布局鸟瞰 |
| 低角度 | 24mm | 0.6m | 空间感/层高 |

### 渲染参数（V-Ray/Enscape通用）

| 参数 | 白天 | 夜晚 | 黄昏 |
|------|------|------|------|
| 太阳高度角 | 45-60° | 关闭 | 10-20° |
| 太阳色温 | 5500K | - | 3000K |
| 环境HDRI强度 | 1.0 | 0.2 | 0.6 |
| 室内灯光 | 补充 | 主角 | 混合 |
| 灯带色温 | 3000K | 3000K | 3000K |
| 筒灯色温 | 3500K | 3500K | 3500K |
| 射灯色温 | 3000K | 2700K | 2700K |
| 曝光补偿 | 0 | +0.5~1.0 | +0.3 |

### 出图顺序（7张标准套）

1. **全景广角** — 空间全貌，16mm，白天自然光
2. **主视角** — 人眼高度，24mm，白天+辅助灯光
3. **焦点区** — 核心功能区，35mm，黄昏氛围
4. **细节特写** — 材质/家具，50mm，射灯重点
5. **夜景** — 主视角，24mm，纯灯光
6. **鸟瞰** — 俯视布局，35mm
7. **氛围** — 黄昏/夜晚，35mm，情绪向

---

## 分风格提示词关键词

### 现代简约
```
modern minimalist, clean lines, neutral palette, handleless cabinets, 
large format tiles, warm grey, oak accents, recessed lighting, 
minimalist furniture, negative space, subtle texture
```

### 日式侘寂
```
wabi-sabi, organic imperfection, micro-cement, natural wood, 
linen texture, paper lantern, muted earth tones, sparse, 
handmade ceramics, raw material beauty, shadows, tatami
```

### 意式轻奢
```
Italian luxury, velvet sofa, marble surface, brass accents, 
herringbone floor, crystal chandelier, curved furniture, 
dark moody palette, glossy finish, statement piece
```

### 北欧
```
Scandinavian, white walls, light oak, sheepskin, 
geometric rug, pendant light, pastel accents, 
hygge, natural light, minimalist, cozy, plants
```

### 新中式
```
neo-Chinese, walnut wood, ink wash, lattice screen, 
porcelain, calligraphy, jade green, vermilion accent, 
bamboo, ink painting, scholar's aesthetic, restrained elegance
```

### 法式
```
French elegance, crown molding, herringbone parquet, 
velvet upholstery, gilded mirror, crystal chandelier, 
cream palette, curved lines, romantic, ornate ceiling rose
```

### 工业LOFT
```
industrial loft, exposed brick, concrete floor, 
steel frame, factory light, distressed leather, 
pipe shelving, Edison bulbs, raw material, open ceiling
```
