#!/usr/bin/env python3
"""
Picset AI 完整自动化流程
上传 → 选择 → 生成 → 下载

使用方法:
    python picset_ai_full_flow.py --image ./images/product.jpg
    python picset_ai_full_flow.py --folder ./images --style "3:4 竖版"
    python picset_ai_full_flow.py --interactive
"""

import asyncio
import argparse
import os
import sys
from pathlib import Path
from datetime import datetime
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout


class PicsetAIFullFlow:
    """Picset AI 完整自动化流程"""

    def __init__(self, headless=False, slow_mo=300):
        self.headless = headless
        self.slow_mo = slow_mo
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.download_path = None

    async def __aenter__(self):
        await self.init_browser()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def init_browser(self):
        """初始化浏览器"""
        print("🚀 初始化浏览器...")
        self.playwright = await async_playwright().start()

        self.browser = await self.playwright.chromium.launch(
            headless=self.headless,
            slow_mo=self.slow_mo,
            args=['--start-maximized']
        )

        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )

        # 设置下载路径
        self.download_path = Path("./downloads")
        self.download_path.mkdir(exist_ok=True)
        await self.context.set_extra_http_headers({
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
        })

        self.page = await self.context.new_page()
        print("✅ 浏览器就绪")

    async def _dismiss_popups(self):
        """关闭所有弹窗和通知"""
        try:
            # 关闭更新日志弹窗
            close_btn = await self.page.query_selector("button:has-text('立即体验'), button:has-text('关闭'):not(:has-text('生成结果'))")
            if close_btn:
                await close_btn.click()
                await self.page.wait_for_timeout(500)
        except:
            pass
        # 按 ESC 关闭可能的其他弹窗
        await self.page.keyboard.press('Escape')
        await self.page.wait_for_timeout(300)

    async def _check_upload_error(self):
        """检测上传/审核错误通知，返回错误信息或 None"""
        try:
            # 查找页面上的错误通知
            error_selectors = [
                "text=审核服务暂不可用",
                "text=上传失败",
                "text=请上传图片",
                "text=服务暂时不可用",
                "[class*='toast']:has-text('审核')",
                "[class*='notification']:has-text('审核')",
                "[class*='message']:has-text('审核')",
                "[class*='error']",
            ]
            for sel in error_selectors:
                try:
                    el = await self.page.query_selector(sel)
                    if el and await el.is_visible():
                        text = await el.inner_text()
                        if any(kw in text for kw in ['审核', '失败', '错误', '不可用', 'error', 'failed']):
                            return text[:200]
                except:
                    pass
            return None
        except:
            return None

    async def _wait_for_upload_done(self, timeout=30):
        """等待上传完成，检测成功或失败"""
        for i in range(timeout // 2):
            await self.page.wait_for_timeout(2000)

            # 检测错误
            err = await self._check_upload_error()
            if err:
                print(f"⚠️ 检测到错误通知: {err}")

            # 检查"分析产品"按钮是否解锁（上传成功的标志）
            try:
                btn = await self.page.query_selector("button:has-text('分析产品')")
                if btn:
                    is_disabled = await btn.get_attribute("disabled")
                    is_aria_disabled = await btn.get_attribute("aria-disabled")
                    if not is_disabled and is_aria_disabled != "true":
                        # 检查按钮是否真的可点击
                        try:
                            await btn.click(timeout=1000)
                            print("✅ 图片上传成功（按钮已解锁）")
                            return True
                        except:
                            pass
            except:
                pass

            # 备用检测：上传区域是否有预览图
            previews = await self.page.query_selector_all("[class*='preview'], [class*='thumbnail'], img[src*='blob']")
            if len(previews) > 0:
                print(f"✅ 检测到图片预览（{len(previews)} 张）")
                return True

            print(f"⏳ 等待上传完成... ({i*2+2}s/{timeout}s)")

        print("⚠️ 上传等待超时")
        return False

    async def open_studio(self):
        """打开全品类商品图页面"""
        print("🌐 打开 Picset AI...")
        await self.page.goto("https://picsetai.cn/studio-genesis", wait_until="domcontentloaded", timeout=60000)
        await self.page.wait_for_timeout(2000)
        print(f"✅ 页面加载: {await self.page.title()}")

        # 关闭弹窗
        await self._dismiss_popups()

    async def upload_image(self, image_path):
        """上传图片（支持新页面结构：隐藏 file input + 拖拽区）"""
        print(f"📤 上传图片: {image_path}")

        if not os.path.exists(image_path):
            print(f"❌ 文件不存在: {image_path}")
            return False

        abs_path = os.path.abspath(image_path)
        max_retries = 3

        for attempt in range(1, max_retries + 1):
            try:
                print(f"📤 上传尝试 {attempt}/{max_retries}...")

                # 关闭弹窗（每次尝试前都关）
                await self._dismiss_popups()

                # 等待上传区域加载
                upload_region = await self.page.wait_for_selector(
                    "region:has([class*='dashed']), [class*='dashed'][class*='border']",
                    timeout=10000
                )

                # 方法1：直接设置隐藏 file input 的值
                file_input = await self.page.wait_for_selector(
                    "input[type='file']",
                    timeout=5000
                )
                await file_input.set_input_files(abs_path)
                print("✅ 文件已选中，等待上传...")

                # 等待上传完成
                upload_ok = await self._wait_for_upload_done(timeout=30)

                # 上传后再次检测错误通知
                err = await self._check_upload_error()
                if err:
                    if "审核" in err or "不可用" in err:
                        print(f"⚠️ 服务器审核服务异常: {err}")
                        if attempt < max_retries:
                            print("🔄 等待 5 秒后重试...")
                            await self.page.wait_for_timeout(5000)
                            continue
                        else:
                            print("❌ 重试次数耗尽，请稍后再试（服务器审核服务暂时不可用）")
                            return False
                    else:
                        print(f"⚠️ 上传错误: {err}")
                        if attempt < max_retries:
                            continue

                if upload_ok:
                    return True

            except PlaywrightTimeout:
                print(f"⚠️ 等待超时（尝试 {attempt}）")
                if attempt < max_retries:
                    await self.page.wait_for_timeout(3000)
                    continue
            except Exception as e:
                print(f"❌ 上传异常: {e}")
                if attempt < max_retries:
                    await self.page.wait_for_timeout(2000)
                    continue

        print("❌ 上传失败，已达最大重试次数")
        return False

    async def select_mode(self, mode="主图"):
        """选择生成模式（按钮结构）"""
        print(f"🎯 选择模式: {mode}")

        try:
            mode_btn = await self.page.wait_for_selector(
                f"button[aria-label*='{mode}'], button:has-text('{mode}'):not([disabled])",
                timeout=5000
            )
            await mode_btn.click()
            await self.page.wait_for_timeout(500)
            print(f"✅ 已选择模式: {mode}")
            return True
        except Exception as e:
            print(f"⚠️ 模式选择失败: {e}")
            return False

    async def select_style(self, style="3:4 竖版"):
        """选择尺寸风格（下拉框结构）"""
        print(f"🎨 选择风格: {style}")

        try:
            # 找尺寸下拉框并点击展开
            style_dropdown = await self.page.query_selector(
                "region:has(heading:has-text('一键生成')) [class*='combobox'], "
                "combobox:has-text('3:4')"
            )
            if style_dropdown:
                await style_dropdown.click()
                await self.page.wait_for_timeout(500)
                # 选择对应选项
                option = await self.page.query_selector(f"text={style}")
                if option:
                    await option.click()
                    await self.page.wait_for_timeout(300)
                    print(f"✅ 已选择风格: {style}")
                    return True

            # 备用：直接找文本
            style_btn = await self.page.query_selector(
                f"[class*='combobox']:has-text('{style}')"
            )
            if style_btn:
                await style_btn.click()
                await self.page.wait_for_timeout(500)
                print(f"✅ 已选择风格: {style}")
                return True

            print(f"⚠️ 未找到风格选项: {style}")
            return False
        except Exception as e:
            print(f"⚠️ 风格选择失败: {e}")
            return False

    async def select_quality(self, quality="2K 高清"):
        """选择图片质量"""
        print(f"📷 选择质量: {quality}")

        try:
            quality_btn = await self.page.query_selector(
                f"combobox:has-text('{quality}'), [class*='dropdown']:has-text('{quality}')"
            )
            if quality_btn:
                await quality_btn.click()
                await self.page.wait_for_timeout(500)
                print(f"✅ 已选择质量: {quality}")
                return True
            print(f"⚠️ 未找到质量选项: {quality}")
            return False
        except Exception as e:
            print(f"⚠️ 质量选择失败: {e}")
            return False

    async def select_count(self, count="1 张"):
        """选择生成数量"""
        print(f"🔢 选择数量: {count}")

        try:
            count_btn = await self.page.query_selector(
                f"combobox:has-text('{count}'), [class*='count']:has-text('{count}')"
            )
            if count_btn:
                await count_btn.click()
                await self.page.wait_for_timeout(500)
                print(f"✅ 已选择数量: {count}")
                return True
            print(f"⚠️ 未找到数量选项: {count}")
            return False
        except Exception as e:
            print(f"⚠️ 数量选择失败: {e}")
            return False

    async def analyze_product(self):
        """点击分析产品按钮"""
        print("🔍 分析产品...")

        try:
            # 先关闭弹窗
            await self._dismiss_popups()
            await self.page.wait_for_timeout(500)

            # 查找分析产品按钮
            analyze_btn = await self.page.wait_for_selector(
                "button:has-text('分析产品')",
                timeout=10000
            )

            # 检查是否真的可用（没有被禁用）
            disabled = await analyze_btn.get_attribute("disabled")
            aria_disabled = await analyze_btn.get_attribute("aria-disabled")

            if disabled is not None or aria_disabled == "true":
                print("⚠️ 分析按钮仍被禁用，请先上传图片")
                return False

            await analyze_btn.click()
            print("✅ 已点击分析按钮")
            return True
        except Exception as e:
            print(f"❌ 分析按钮点击失败: {e}")
            return False

    async def wait_for_generation(self, timeout=180):
        """等待生成完成

        Args:
            timeout: 超时时间（秒）
        """
        print("⏳ 等待生成完成...")

        try:
            # 轮询检测生成状态
            for i in range(timeout // 5):
                await self.page.wait_for_timeout(5000)

                # 检测审核/服务错误
                err = await self._check_upload_error()
                if err and any(kw in err for kw in ['审核', '服务不可用', 'failed', 'error']):
                    print(f"⚠️ 服务异常: {err}")
                    return False

                # 检查是否有下载按钮
                download_btns = await self.page.query_selector_all("button:has-text('下载')")
                if download_btns:
                    visible_btns = [b for b in download_btns if await b.is_visible()]
                    if visible_btns:
                        print(f"✅ 生成完成！找到 {len(visible_btns)} 个下载按钮")
                        return True

                # 检测是否还在生成中
                loading_els = await self.page.query_selector_all(
                    "[class*='progress'], [class*='loading'], [class*='spinner'], "
                    "text=生成中, text=处理中, text=稍等"
                )
                if loading_els:
                    print(f"⏳ 仍在生成中... ({i*5+5}s/{timeout}s)")

                # 每15秒打印一次进度
                if (i * 5) % 15 == 0:
                    print(f"⏳ 等待中... ({i*5}s/{timeout}s)")

            print("⚠️ 生成超时")
            return False

        except Exception as e:
            print(f"⚠️ 等待生成时出错: {e}")
            return False

    async def download_results(self, output_folder=None):
        """下载生成的结果"""
        print("⬇️ 下载结果...")

        if output_folder is None:
            output_folder = self.download_path
        else:
            output_folder = Path(output_folder)
            output_folder.mkdir(parents=True, exist_ok=True)

        try:
            # 等待下载按钮出现
            download_btn = await self.page.wait_for_selector(
                "button:has-text('下载'):visible",
                timeout=60000
            )

            # 使用 expect_download 捕获下载
            async with self.page.expect_download(timeout=60000) as download_info:
                await download_btn.click()

            download = await download_info.value
            filename = output_folder / download.suggested_filename
            await download.save_as(str(filename))
            print(f"✅ 下载完成: {filename}")
            return str(filename)

        except PlaywrightTimeout:
            print("⚠️ 下载按钮等待超时，尝试备选方法...")
            return await self._download_fallback(output_folder)
        except Exception as e:
            print(f"⚠️ 下载失败: {e}，尝试备选方法...")
            return await self._download_fallback(output_folder)

    async def _download_fallback(self, output_folder):
        """备选下载：直接点击下载按钮后等待文件"""
        try:
            download_btns = await self.page.query_selector_all("button:has-text('下载')")
            for btn in download_btns:
                if await btn.is_visible():
                    await btn.click()
                    await self.page.wait_for_timeout(5000)
                    print("✅ 已点击下载按钮")
                    return str(output_folder)
            return None
        except Exception as e:
            print(f"❌ 备选下载失败: {e}")
            return None

    async def full_flow(self, image_path, mode="主图", style="3:4 竖版", quality="2K 高清", count="1 张"):
        """完整流程：上传 → 选择 → 生成 → 下载

        Args:
            image_path: 图片路径
            mode: 模式（主图/详情图）
            style: 风格（3:4 竖版/1:1 方版等）
            quality: 质量（2K 高清/4K 超清）
            count: 数量（1 张/4 张）
        """
        print("\n" + "="*60)
        print("Picset AI 完整自动化流程")
        print("="*60)
        print(f"📷 图片: {image_path}")
        print(f"🎯 模式: {mode}")
        print(f"🎨 风格: {style}")
        print(f"📷 质量: {quality}")
        print(f"🔢 数量: {count}")
        print("="*60 + "\n")

        # 1. 打开页面
        await self.open_studio()

        # 2. 上传图片（必须先成功上传，按钮才会解锁）
        if not await self.upload_image(image_path):
            # 上传失败，尝试截图留证
            await self.screenshot("upload_failed.png")
            return False

        # 3. 选择模式
        await self.select_mode(mode)

        # 4. 选择风格
        await self.select_style(style)

        # 5. 选择质量
        await self.select_quality(quality)

        # 6. 选择数量
        await self.select_count(count)

        # 7. 点击分析
        if not await self.analyze_product():
            await self.screenshot("analyze_failed.png")
            return False

        # 8. 等待生成
        if not await self.wait_for_generation(timeout=180):
            await self.screenshot("generation_timeout.png")
            return False

        # 9. 下载结果
        result = await self.download_results()

        print("\n" + "="*60)
        if result:
            print(f"✅ 流程完成！文件已保存: {result}")
        else:
            print("⚠️ 流程完成，但下载可能失败")
        print("="*60)

        return result

    async def batch_process(self, folder, mode="主图", style="3:4 竖版", quality="2K 高清"):
        """批量处理文件夹中的所有图片"""
        print(f"\n📦 批量处理: {folder}")

        # 获取所有图片
        images = []
        for ext in ['*.jpg', '*.jpeg', '*.png', '*.webp']:
            images.extend(Path(folder).glob(ext))
            images.extend(Path(folder).glob(ext.upper()))

        print(f"📊 找到 {len(images)} 张图片")

        results = []
        for i, image_path in enumerate(images, 1):
            print(f"\n{'#'*60}")
            print(f"处理第 {i}/{len(images)} 张: {image_path.name}")
            print(f"{'#'*60}")

            # 打开新页面处理
            page = await self.context.new_page()
            self.page = page

            try:
                result = await self.full_flow(
                    str(image_path),
                    mode=mode,
                    style=style,
                    quality=quality
                )
                results.append({"image": str(image_path), "result": result})
            except Exception as e:
                print(f"❌ 处理失败: {e}")
                results.append({"image": str(image_path), "result": None})

            await page.close()

        # 总结
        print("\n" + "="*60)
        print("批量处理完成")
        print("="*60)
        success = sum(1 for r in results if r["result"])
        print(f"✅ 成功: {success}/{len(results)}")
        for r in results:
            status = "✅" if r["result"] else "❌"
            print(f"{status} {Path(r['image']).name}")

        return results

    async def screenshot(self, filename="picset.png"):
        """截图"""
        await self.page.screenshot(path=filename, full_page=True)
        print(f"📸 截图: {filename}")

    async def close(self):
        """关闭浏览器"""
        print("🔴 关闭浏览器...")
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        print("✅ 完成")


async def interactive_mode():
    """交互模式"""
    print("\n" + "="*60)
    print("Picset AI 自动化 - 交互模式")
    print("="*60)

    async with PicsetAIFullFlow(headless=False, slow_mo=300) as bot:
        # 打开页面
        await bot.open_studio()

        while True:
            print("\n可用命令:")
            print("  1. upload [路径]  - 上传图片")
            print("  2. mode [主图/详情图] - 选择模式")
            print("  3. style [风格] - 选择风格")
            print("  4. analyze       - 分析产品")
            print("  5. wait          - 等待生成")
            print("  6. download      - 下载结果")
            print("  7. shot          - 截图")
            print("  8. close         - 关闭弹窗")
            print("  9. flow          - 完整流程")
            print("  0. quit          - 退出")

            cmd = input("\n输入命令: ").strip()

            if cmd == "quit":
                break
            elif cmd.startswith("upload "):
                await bot.upload_image(cmd[7:])
            elif cmd.startswith("mode "):
                await bot.select_mode(cmd[5:])
            elif cmd.startswith("style "):
                await bot.select_style(cmd[6:])
            elif cmd == "analyze":
                await bot.analyze_product()
            elif cmd == "wait":
                await bot.wait_for_generation()
            elif cmd == "download":
                await bot.download_results()
            elif cmd == "shot":
                await bot.screenshot()
            elif cmd == "close":
                await bot._dismiss_popups()
                print("✅ 弹窗已关闭")
            elif cmd == "flow":
                image = input("图片路径: ").strip()
                await bot.full_flow(image)


def main():
    parser = argparse.ArgumentParser(
        description="Picset AI 完整自动化流程",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python picset_ai_full_flow.py --image ./product.jpg
  python picset_ai_full_flow.py --folder ./images
  python picset_ai_full_flow.py --image ./photo.jpg --mode 详情图 --quality 4K 超清
  python picset_ai_full_flow.py --interactive
        """
    )
    parser.add_argument("--image", "-i", help="单张图片路径")
    parser.add_argument("--folder", "-f", help="图片文件夹（批量处理）")
    parser.add_argument("--mode", "-m", default="主图",
                        help="模式: 主图 / 详情图（默认: 主图）")
    parser.add_argument("--style", "-s", default="3:4 竖版",
                        help="尺寸: 3:4 竖版 / 1:1 方版 / 16:9 横版（默认: 3:4 竖版）")
    parser.add_argument("--quality", "-q", default="2K 高清",
                        help="质量: 2K 高清 / 4K 超清（默认: 2K 高清）")
    parser.add_argument("--count", "-c", default="1 张",
                        help="数量: 1 张 / 4 张（默认: 1 张）")
    parser.add_argument("--interactive", action="store_true",
                        help="交互模式（可逐步控制每个步骤）")
    parser.add_argument("--headless", action="store_true",
                        help="无头模式（不显示浏览器窗口）")

    args = parser.parse_args()

    if args.interactive:
        asyncio.run(interactive_mode())
    elif args.folder:
        asyncio.run(PicsetAIFullFlow(headless=args.headless).batch_process(
            args.folder, args.mode, args.style, args.quality
        ))
    elif args.image:
        asyncio.run(PicsetAIFullFlow(headless=args.headless).full_flow(
            args.image, args.mode, args.style, args.quality, args.count
        ))
    else:
        parser.print_help()
        print("\n示例:")
        print("  python picset_ai_full_flow.py --image ./product.jpg")
        print("  python picset_ai_full_flow.py --folder ./images")
        print("  python picset_ai_full_flow.py --interactive")


if __name__ == "__main__":
    main()
