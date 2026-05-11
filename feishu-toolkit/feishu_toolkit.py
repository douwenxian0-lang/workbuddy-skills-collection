#!/usr/bin/env python3
"""
Feishu/Lark API Toolkit — 补齐官方 MCP 无法覆盖的能力。

核心能力:
  - 图片上传（官方 MCP 不支持）
  - 富文本消息构建（含 @用户、图片、超链接）
  - 飞书文档创建与 Block 内容写入
  - 交互卡片消息构建
  - 通讯录查询（邮箱/手机号 → open_id）

用法 - 作为模块:
    from feishu_toolkit import FeishuClient
    client = FeishuClient(app_id="cli_xxx", app_secret="xxx")
    client.send_text("oc_xxx", "Hello!")

用法 - 作为 CLI:
    export FEISHU_APP_ID=cli_xxx
    export FEISHU_APP_SECRET=xxx
    python feishu_toolkit.py auth
    python feishu_toolkit.py list-chats
    python feishu_toolkit.py send-text oc_xxx "Hello"
    python feishu_toolkit.py upload-image /path/to/img.png
    python feishu_toolkit.py send-image oc_xxx /path/to/img.png
    python feishu_toolkit.py create-doc "Report Title"

依赖: requests (pip install requests)
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Optional

try:
    import requests
except ImportError:
    print("Error: 'requests' package required. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

BASE_URL = "https://open.feishu.cn/open-apis"


class FeishuAPIError(Exception):
    """飞书 API 返回的业务错误"""
    def __init__(self, code: int, msg: str, data: dict = None):
        self.code = code
        self.msg = msg
        self.data = data or {}
        super().__init__(f"[{code}] {msg}")


class FeishuClient:
    """飞书开放平台 API 客户端"""

    def __init__(self, app_id: str = None, app_secret: str = None, base_url: str = None):
        self.app_id = app_id or os.environ.get("FEISHU_APP_ID", "")
        self.app_secret = app_secret or os.environ.get("FEISHU_APP_SECRET", "")
        self.base_url = (base_url or os.environ.get("FEISHU_BASE_URL", BASE_URL)).rstrip("/")
        if not self.app_id or not self.app_secret:
            raise ValueError(
                "app_id/app_secret required. "
                "Pass directly or set FEISHU_APP_ID / FEISHU_APP_SECRET env vars."
            )
        self._token: Optional[str] = None
        self._token_expires_at: float = 0

    # ━━ Authentication ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @property
    def token(self) -> str:
        """获取 tenant_access_token，自动缓存和续期"""
        if self._token and time.time() < self._token_expires_at:
            return self._token
        resp = requests.post(
            f"{self.base_url}/auth/v3/tenant_access_token/internal",
            json={"app_id": self.app_id, "app_secret": self.app_secret},
        )
        data = resp.json()
        if data.get("code") != 0:
            raise FeishuAPIError(data.get("code", -1), data.get("msg", "Auth failed"))
        self._token = data["tenant_access_token"]
        self._token_expires_at = time.time() + data.get("expire", 7200) - 300
        return self._token

    def _request(self, method: str, path: str, **kwargs) -> dict:
        """统一 HTTP 请求，自动注入 token 并检查业务错误码"""
        url = f"{self.base_url}{path}"
        headers = kwargs.pop("headers", {})
        headers.setdefault("Authorization", f"Bearer {self.token}")
        resp = requests.request(method, url, headers=headers, **kwargs)
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != 0:
            raise FeishuAPIError(data.get("code", -1), data.get("msg", "Unknown"), data.get("data"))
        return data

    # ━━ Inline Element Builders (用于富文本消息) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @staticmethod
    def text(content: str) -> dict:
        return {"tag": "text", "text": content}

    @staticmethod
    def at(user_id: str, user_name: str = "") -> dict:
        """@指定用户, user_id 为 open_id/union_id/user_id"""
        return {"tag": "at", "user_id": user_id, "user_name": user_name}

    @staticmethod
    def at_all() -> dict:
        return {"tag": "at", "user_id": "all", "user_name": "所有人"}

    @staticmethod
    def link(text: str, href: str) -> dict:
        return {"tag": "a", "text": text, "href": href}

    @staticmethod
    def img(image_key: str) -> dict:
        return {"tag": "img", "image_key": image_key}

    @staticmethod
    def emotion(emoji_type: str) -> dict:
        """表情, 如 SMILE, THUMBSUP, HEART 等"""
        return {"tag": "emotion", "emoji_type": emoji_type}

    @staticmethod
    def media(file_key: str, image_key: str) -> dict:
        return {"tag": "media", "file_key": file_key, "image_key": image_key}

    # ━━ Send Messages ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def _send_message(self, receive_id: str, msg_type: str, content: dict,
                      receive_id_type: str = "chat_id") -> dict:
        return self._request(
            "POST",
            f"/im/v1/messages?receive_id_type={receive_id_type}",
            json={
                "receive_id": receive_id,
                "msg_type": msg_type,
                "content": json.dumps(content, ensure_ascii=False),
            },
        )

    def send_text(self, receive_id: str, text: str,
                  receive_id_type: str = "chat_id") -> dict:
        """发送纯文本消息"""
        return self._send_message(receive_id, "text", {"text": text}, receive_id_type)

    def send_rich_text(self, receive_id: str, title: str, content: list[list[dict]],
                       receive_id_type: str = "chat_id", lang: str = "zh_cn") -> dict:
        """
        发送富文本 (post) 消息。

        Args:
            content: 二维数组。外层 = 段落，内层 = 行内元素。
                     用 self.text() / self.at() / self.link() / self.img() 构建元素。
        Example:
            client.send_rich_text("oc_xxx", "报告", [
                [client.text("请"), client.at("ou_xxx", "张三"), client.text("查收")],
                [client.text("详情: "), client.link("点击查看", "https://example.com")],
            ])
        """
        return self._send_message(
            receive_id, "post",
            {lang: {"title": title, "content": content}},
            receive_id_type,
        )

    def send_image(self, receive_id: str, image_key: str,
                   receive_id_type: str = "chat_id") -> dict:
        """发送图片消息（image_key 通过 upload_image 获取）"""
        return self._send_message(receive_id, "image", {"image_key": image_key}, receive_id_type)

    def send_card(self, receive_id: str, card: dict,
                  receive_id_type: str = "chat_id") -> dict:
        """发送交互卡片消息"""
        return self._send_message(receive_id, "interactive", card, receive_id_type)

    # ━━ Image Upload ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def upload_image(self, image_path: str) -> str:
        """
        上传图片到飞书，返回 image_key。
        支持 JPEG/PNG/WEBP/GIF/TIFF/BMP/ICO，最大 10MB。
        """
        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")
        with open(path, "rb") as f:
            resp = requests.post(
                f"{self.base_url}/im/v1/images",
                headers={"Authorization": f"Bearer {self.token}"},
                data={"image_type": "message"},
                files={"image": (path.name, f)},
            )
        data = resp.json()
        if data.get("code") != 0:
            raise FeishuAPIError(data.get("code", -1), data.get("msg", "Upload failed"))
        return data["data"]["image_key"]

    # ━━ File Upload ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def upload_file(self, file_path: str, file_type: str = "stream") -> str:
        """
        上传文件到飞书，返回 file_key。

        Args:
            file_path: 本地文件路径
            file_type: 文件类型 — opus(音频), mp4(视频), pdf, doc, xls, ppt,
                       stream(通用二进制，推荐用于 zip/mp3 等)
        Returns:
            file_key 字符串 (e.g. "file_v2_xxx")

        注意:
            - 最大 30MB
            - 需要 im:resource 权限
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        with open(path, "rb") as f:
            resp = requests.post(
                f"{self.base_url}/im/v1/files",
                headers={"Authorization": f"Bearer {self.token}"},
                data={"file_type": file_type, "file_name": path.name},
                files={"file": (path.name, f)},
            )
        data = resp.json()
        if data.get("code") != 0:
            raise FeishuAPIError(data.get("code", -1), data.get("msg", "Upload failed"))
        return data["data"]["file_key"]

    def send_file(self, receive_id: str, file_key: str,
                  receive_id_type: str = "chat_id") -> dict:
        """发送文件消息（file_key 通过 upload_file 获取）"""
        return self._send_message(receive_id, "file", {"file_key": file_key}, receive_id_type)

    # ━━ Drive: Folder Operations ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def get_root_folder_token(self) -> str:
        """获取云盘根目录 token。"""
        data = self._request("GET", "/drive/explorer/v2/root_folder/meta")
        return data.get("data", {}).get("token", "")

    def create_folder(self, name: str, parent_node: str) -> str:
        """在云盘指定目录下创建文件夹，返回 folder token。"""
        data = self._request(
            "POST", "/drive/v1/files/create_folder",
            json={"name": name, "folder_token": parent_node},
        )
        return data.get("data", {}).get("token", "")

    def list_folder_children(self, folder_token: str,
                              page_size: int = 50) -> list[dict]:
        """列出文件夹下的文件/子文件夹。"""
        data = self._request(
            "GET",
            f"/drive/v1/files?folder_token={folder_token}"
            f"&page_size={page_size}",
        )
        return data.get("data", {}).get("files", [])

    def find_or_create_folder(self, name: str, parent_node: str) -> str:
        """查找或创建子文件夹，返回 folder token。"""
        try:
            children = self.list_folder_children(parent_node)
            for child in children:
                if child.get("name") == name and child.get("type") == "folder":
                    return child.get("token", "")
        except Exception:
            pass
        return self.create_folder(name, parent_node)

    # ━━ Drive: Chunked File Upload ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def upload_file_to_drive(
        self,
        file_path: str,
        parent_node: str,
        file_name: str = "",
        on_progress: callable = None,
    ) -> str:
        """
        分片上传文件到飞书云盘，返回 file_token。

        3 步流程:
          1. upload_prepare — 获取 upload_id + block 数量
          2. upload_part × N — 分片上传（每片 4MB）
          3. upload_finish — 完成上传

        Args:
            file_path: 本地文件路径
            parent_node: 父文件夹 token
            file_name: 上传后的文件名（默认用原始文件名）
            on_progress: 进度回调 fn(block_seq, block_num)

        Returns:
            file_token 字符串

        权限要求: drive:drive 或 drive:file:upload
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        file_size = path.stat().st_size
        upload_name = file_name or path.name

        # Step 1: upload_prepare
        prepare_data = self._request(
            "POST", "/drive/v1/files/upload_prepare",
            json={
                "file_name": upload_name,
                "parent_type": "explorer",
                "parent_node": parent_node,
                "size": file_size,
            },
        )
        upload_id = prepare_data["data"]["upload_id"]
        block_size = prepare_data["data"]["block_size"]
        block_num = prepare_data["data"]["block_num"]

        # Step 2: upload_part × N
        with open(path, "rb") as f:
            for seq in range(block_num):
                chunk = f.read(block_size)
                chunk_size = len(chunk)

                # Calculate Adler-32 checksum
                checksum = str(self._adler32(chunk))

                resp = requests.post(
                    f"{self.base_url}/drive/v1/files/upload_part",
                    headers={"Authorization": f"Bearer {self.token}"},
                    data={
                        "upload_id": upload_id,
                        "seq": str(seq),
                        "size": str(chunk_size),
                        "checksum": checksum,
                    },
                    files={"file": ("blob", chunk)},
                )
                resp_data = resp.json()
                if resp_data.get("code") != 0:
                    raise FeishuAPIError(
                        resp_data.get("code", -1),
                        resp_data.get("msg", f"Upload part {seq} failed"),
                    )

                if on_progress:
                    on_progress(seq + 1, block_num)

        # Step 3: upload_finish
        finish_data = self._request(
            "POST", "/drive/v1/files/upload_finish",
            json={
                "upload_id": upload_id,
                "block_num": block_num,
            },
        )
        return finish_data["data"]["file_token"]

    @staticmethod
    def _adler32(data: bytes) -> int:
        """计算 Adler-32 校验和。"""
        import zlib
        return zlib.adler32(data) & 0xffffffff

    # ━━ Drive: Permissions & Sharing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def set_drive_public_permission(
        self,
        file_token: str,
        file_type: str = "file",
        link_share_entity: str = "tenant_readable",
    ) -> dict:
        """
        设置云盘文件/文件夹的公共分享权限。

        Args:
            file_token: 文件 token
            file_type: 文件类型 (file/doc/docx/sheet/bitable/folder)
            link_share_entity: 链接分享范围
                - tenant_readable: 组织内获得链接的人可阅读
                - tenant_editable: 组织内获得链接的人可编辑
                - anyone_readable: 互联网上获得链接的人可阅读
                - anyone_editable: 互联网上获得链接的人可编辑

        Returns:
            API 响应
        """
        return self._request(
            "PATCH",
            f"/drive/v1/permissions/{file_token}/public"
            f"?type={file_type}",
            json={
                "external_access_entity": "open",
                "security_entity": "anyone_can_view",
                "comment_entity": "anyone_can_view",
                "share_entity": "anyone",
                "link_share_entity": link_share_entity,
            },
        )

    def get_drive_file_url(self, file_token: str) -> str:
        """构建云盘文件的访问 URL。"""
        return f"https://feishu.cn/file/{file_token}"

    # ━━ Contact / User ID Lookup ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def get_user_ids(self, emails: list[str] = None, mobiles: list[str] = None) -> list[dict]:
        """
        通过邮箱或手机号批量查询 open_id。
        返回: [{"email": "x@y.com", "user_id": "ou_xxx"}, ...]
        """
        body = {}
        if emails:
            body["emails"] = emails
        if mobiles:
            body["mobiles"] = mobiles
        data = self._request(
            "POST",
            "/contact/v3/users/batch_get_id?user_id_type=open_id",
            json=body,
        )
        return data.get("data", {}).get("user_list", [])

    def get_user_id_by_email(self, email: str) -> Optional[str]:
        """单个邮箱 → open_id"""
        users = self.get_user_ids(emails=[email])
        return users[0].get("user_id") if users else None

    def get_user_id_by_mobile(self, mobile: str) -> Optional[str]:
        """单个手机号 → open_id"""
        users = self.get_user_ids(mobiles=[mobile])
        return users[0].get("user_id") if users else None

    # ━━ Chat Operations ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def list_chats(self, page_size: int = 50) -> list[dict]:
        """列出机器人已加入的群组"""
        data = self._request("GET", f"/im/v1/chats?page_size={page_size}")
        return data.get("data", {}).get("items", [])

    # ━━ Document Operations ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def create_document(self, title: str, folder_token: str = None) -> dict:
        """
        创建飞书文档。
        返回: {"document_id": "xxx", "revision_id": 1, "title": "xxx"}
        """
        body = {"title": title}
        if folder_token:
            body["folder_token"] = folder_token
        data = self._request("POST", "/docx/v1/documents", json=body)
        return data["data"]["document"]

    def get_document_root_block(self, document_id: str) -> str:
        """获取文档根 Block ID（Page Block），用于后续添加子 Block"""
        data = self._request("GET", f"/docx/v1/documents/{document_id}/blocks")
        items = data.get("data", {}).get("items", [])
        for item in items:
            if item.get("block_type") == 1:  # Page block
                return item["block_id"]
        return document_id

    def add_document_blocks(self, document_id: str, parent_block_id: str,
                            children: list[dict], index: int = -1) -> dict:
        """向文档的指定 Block 下添加子 Block"""
        body = {"children": children}
        if index >= 0:
            body["index"] = index
        return self._request(
            "POST",
            f"/docx/v1/documents/{document_id}/blocks/{parent_block_id}/children",
            json=body,
        )

    def create_document_with_content(self, title: str, blocks: list[dict],
                                     folder_token: str = None) -> dict:
        """
        创建文档并写入内容（自动分批写入）。
        返回: {"document_id": "xxx", "url": "https://xxx.feishu.cn/docx/xxx"}
        """
        doc = self.create_document(title, folder_token)
        doc_id = doc["document_id"]
        root_block = self.get_document_root_block(doc_id)
        if blocks:
            # 飞书 API 每次最多写入 50 个 block，分批写入
            batch_size = 50
            for i in range(0, len(blocks), batch_size):
                batch = blocks[i:i + batch_size]
                self.add_document_blocks(doc_id, root_block, batch)
        return {
            "document_id": doc_id,
            "url": f"https://feishu.cn/docx/{doc_id}",
        }

    # ━━ Wiki (知识库) Operations ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def list_wiki_spaces(self, page_size: int = 50) -> list[dict]:
        """
        获取有权限访问的知识空间列表。
        应用需先被添加为知识空间成员/管理员，否则返回空列表。
        """
        data = self._request("GET", f"/wiki/v2/spaces?page_size={page_size}")
        return data.get("data", {}).get("items", [])

    def get_wiki_node(self, node_token: str) -> dict:
        """
        通过 node_token 获取节点信息（含实际 obj_token）。

        飞书 Wiki URL 中的 token 是 node_token，调用文档 API 需要 obj_token。
        例: URL https://xxx.feishu.cn/wiki/EpMmw... 中 EpMmw... 是 node_token。
        返回字段包括: node_token, obj_token, obj_type, title 等。
        """
        data = self._request("GET", f"/wiki/v2/spaces/get_node?token={node_token}")
        return data.get("data", {}).get("node", {})

    def move_doc_to_wiki(self, space_id: str, obj_token: str, obj_type: str = "docx",
                         parent_wiki_token: str = None, apply: bool = False) -> dict:
        """
        将云空间文档移动到知识库（异步接口）。

        Args:
            space_id: 目标知识空间 ID（通过 list_wiki_spaces 获取）
            obj_token: 文档 token（即 document_id）
            obj_type: 文档类型，docx/doc/sheet/bitable/file/slides 等
            parent_wiki_token: 挂载的父节点 wiki_token，不传则为知识空间一级节点
            apply: 无权限时是否发起申请（需审批后自动移动）

        Returns:
            含 wiki_token（已完成）或 task_id（进行中）的 dict
        """
        body: dict = {"obj_token": obj_token, "obj_type": obj_type}
        if parent_wiki_token:
            body["parent_wiki_token"] = parent_wiki_token
        if apply:
            body["apply"] = apply
        data = self._request(
            "POST",
            f"/wiki/v2/spaces/{space_id}/nodes/move_docs_to_wiki",
            json=body,
        )
        return data.get("data", {})

    def get_wiki_task_result(self, task_id: str) -> dict:
        """获取知识库异步任务结果（配合 move_doc_to_wiki 使用）"""
        data = self._request("GET", f"/wiki/v2/tasks/{task_id}?task_type=move")
        return data.get("data", {}).get("task", {})

    def create_document_in_wiki(self, space_id: str, title: str,
                                blocks: list[dict] = None,
                                parent_wiki_token: str = None) -> dict:
        """
        在知识库中创建文档并写入内容（一步到位）。

        流程: 云空间创建 docx → 写入 blocks → 异步移动到知识库 → 等待完成
        注意: 应用需已被添加为目标知识空间成员（list_wiki_spaces 返回非空即可）

        Args:
            space_id: 目标知识空间 ID
            title: 文档标题
            blocks: 文档块列表，使用 heading_block/text_block/bullet_block 等构建
            parent_wiki_token: 挂载父节点 wiki_token，不传则为知识空间一级节点

        Returns:
            {"wiki_token": "...", "obj_token": "...", "url": "https://feishu.cn/wiki/..."}

        Example:
            result = client.create_document_in_wiki(
                space_id="7034502641455497244",
                title="周报: 音乐数据分析",
                blocks=[
                    client.heading_block("概览", level=1),
                    client.text_block("本周各平台数据表现良好。"),
                    client.bullet_block("QQ音乐: 播放量 120万"),
                ],
            )
            print(f"文档已创建: {result['url']}")
        """
        # Step 1: 在云空间创建 docx
        doc = self.create_document(title)
        doc_id = doc["document_id"]

        # Step 2: 写入内容
        if blocks:
            root_block = self.get_document_root_block(doc_id)
            self.add_document_blocks(doc_id, root_block, blocks)

        # Step 3: 移动到知识库
        result = self.move_doc_to_wiki(space_id, doc_id, "docx", parent_wiki_token)
        wiki_token = result.get("wiki_token")
        task_id = result.get("task_id")

        # Step 4: 如果是异步任务，轮询等待（最多 15 秒）
        if task_id and not wiki_token:
            for _ in range(15):
                time.sleep(1)
                task = self.get_wiki_task_result(task_id)
                move_results = task.get("move_result", [])
                if move_results:
                    status = move_results[0].get("status")
                    if status == 0:
                        wiki_token = move_results[0].get("node", {}).get("node_token")
                        break
                    elif status == -1:
                        status_msg = move_results[0].get("status_msg", "unknown error")
                        raise FeishuAPIError(-1, f"Move to wiki failed: {status_msg}")

        return {
            "wiki_token": wiki_token,
            "obj_token": doc_id,
            "url": f"https://feishu.cn/wiki/{wiki_token}" if wiki_token else None,
        }

    # ━━ Document Block Builders ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @staticmethod
    def _text_elements(content: str) -> list:
        return [{"text_run": {"content": content}}]

    @staticmethod
    def text_block(content: str) -> dict:
        """普通文本段落"""
        return {
            "block_type": 2,
            "text": {"elements": [{"text_run": {"content": content}}], "style": {}},
        }

    @staticmethod
    def heading_block(content: str, level: int = 1) -> dict:
        """标题 Block（level 1-9）"""
        level = max(1, min(9, level))
        block_type = 2 + level  # heading1=3, heading2=4, ...
        field = f"heading{level}"
        return {
            "block_type": block_type,
            field: {"elements": [{"text_run": {"content": content}}]},
        }

    @staticmethod
    def code_block(code: str, language: int = None) -> dict:
        """
        代码块。

        注意: 创建 block 时不可带 style.language 字段（API 会报 field validation failed），
        language 仅用于读取时识别。创建时默认为 PlainText。
        """
        return {
            "block_type": 14,
            "code": {
                "elements": [{"text_run": {"content": code}}],
            },
        }

    @staticmethod
    def bullet_block(content: str) -> dict:
        """无序列表项"""
        return {
            "block_type": 12,
            "bullet": {"elements": [{"text_run": {"content": content}}]},
        }

    @staticmethod
    def ordered_block(content: str) -> dict:
        """有序列表项"""
        return {
            "block_type": 13,
            "ordered": {"elements": [{"text_run": {"content": content}}]},
        }

    @staticmethod
    def quote_block(content: str) -> dict:
        """引用块"""
        return {
            "block_type": 15,
            "quote": {"elements": [{"text_run": {"content": content}}]},
        }

    @staticmethod
    def divider_block() -> dict:
        """分割线"""
        return {"block_type": 22, "divider": {}}

    # ━━ Card Builders ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @staticmethod
    def build_card(title: str, elements: list[dict], color: str = "blue",
                   subtitle: str = None) -> dict:
        """
        构建交互卡片。
        color: blue/green/red/orange/purple/indigo/grey/turquoise/violet/wathet/yellow
        subtitle: 标题栏副标题（可选）
        """
        header: dict = {
            "title": {"content": title, "tag": "plain_text"},
            "template": color,
        }
        if subtitle:
            header["subtitle"] = {"content": subtitle, "tag": "plain_text"}
        return {
            "config": {"wide_screen_mode": True},
            "header": header,
            "elements": elements,
        }

    @staticmethod
    def card_markdown(content: str) -> dict:
        """卡片富文本块（lark_md 格式，支持加粗/颜色/表格/标题等语法）"""
        return {"tag": "div", "text": {"content": content, "tag": "lark_md"}}

    @staticmethod
    def card_fields(fields: list[tuple[str, bool]]) -> dict:
        """
        卡片双列字段布局。
        fields: [(markdown_content, is_short), ...]
        is_short=True 的相邻字段会并排显示（半列宽），False 则独占整行。
        """
        return {
            "tag": "div",
            "fields": [
                {"is_short": short, "text": {"content": text, "tag": "lark_md"}}
                for text, short in fields
            ],
        }

    @staticmethod
    def card_image(image_key: str, alt: str = "",
                   mode: str = "fit_horizontal") -> dict:
        """
        卡片图片块。
        mode: fit_horizontal（适应宽度）/ crop_center（居中裁剪）/ top_cropped（顶部）
        image_key 通过 upload_image() 获取。
        """
        return {
            "tag": "img",
            "img_key": image_key,
            "alt": {"tag": "plain_text", "content": alt},
            "mode": mode,
        }

    @staticmethod
    def card_button(text: str, url: str, button_type: str = "primary") -> dict:
        """单按钮（独占一行）。button_type: primary / default / danger"""
        return {
            "tag": "action",
            "actions": [{
                "tag": "button",
                "text": {"content": text, "tag": "plain_text"},
                "type": button_type,
                "url": url,
            }],
        }

    @staticmethod
    def card_action(*buttons: dict) -> dict:
        """
        多按钮横向排列（共用一行）。每个按钮用 card_btn() 构建。

        Example:
            client.card_action(
                client.card_btn("确认", url="https://...", btn_type="primary"),
                client.card_btn("取消", btn_type="default"),
                client.card_btn("删除", btn_type="danger",
                                confirm=("确认删除", "此操作不可恢复")),
            )
        """
        return {"tag": "action", "actions": list(buttons)}

    @staticmethod
    def card_btn(text: str, url: str = None, btn_type: str = "default",
                 value: dict = None, confirm: tuple = None) -> dict:
        """
        构建按钮对象，用于 card_action()。

        Args:
            text: 按钮文字
            url: 点击跳转链接
            btn_type: primary / default / danger
            value: 回调值 dict（不传 url 时用于回传数据）
            confirm: 二次确认弹窗 (title, content)
        """
        btn: dict = {
            "tag": "button",
            "text": {"content": text, "tag": "plain_text"},
            "type": btn_type,
        }
        if url:
            btn["url"] = url
        if value:
            btn["value"] = value
        if confirm:
            btn["confirm"] = {
                "title": {"content": confirm[0], "tag": "plain_text"},
                "text": {"content": confirm[1], "tag": "plain_text"},
            }
        return btn

    @staticmethod
    def card_column_set(*columns: dict, flex_mode: str = "none") -> dict:
        """
        多列布局容器。每列用 card_column() 构建。
        flex_mode: none / stretch / flow / bisect / trisect

        Example:
            client.card_column_set(
                client.card_column([client.card_markdown("**左列**\\n内容 A")], weight=1),
                client.card_column([client.card_markdown("**右列**\\n内容 B")], weight=1),
            )
        """
        return {
            "tag": "column_set",
            "flex_mode": flex_mode,
            "columns": list(columns),
        }

    @staticmethod
    def card_column(elements: list[dict], width: str = "weighted",
                    weight: int = 1) -> dict:
        """
        列布局中的单列。
        width: weighted（按权重）/ auto（自适应内容）
        weight: 相对宽度权重，width=weighted 时生效
        """
        return {
            "tag": "column",
            "width": width,
            "weight": weight,
            "elements": elements,
        }

    @staticmethod
    def card_note(*elements: dict) -> dict:
        """
        备注块（小号灰色，常用于卡片底部来源说明）。
        elements 使用 note_md() 或 note_img() 构建。

        Example:
            client.card_note(
                client.note_md("更新于 2024-01-01 · 数据来源: 监控系统")
            )
        """
        return {"tag": "note", "elements": list(elements)}

    @staticmethod
    def note_md(content: str) -> dict:
        """备注块内的文本元素（配合 card_note 使用）"""
        return {"tag": "lark_md", "content": content}

    @staticmethod
    def note_img(image_key: str, alt: str = "") -> dict:
        """备注块内的图片元素（配合 card_note 使用）"""
        return {"tag": "img", "img_key": image_key,
                "alt": {"tag": "plain_text", "content": alt}}

    @staticmethod
    def card_divider() -> dict:
        """分割线"""
        return {"tag": "hr"}

    # ━━ Card Markdown 富文本语法助手 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 返回字符串片段，拼接后传入 card_markdown() 使用

    @staticmethod
    def md_bold(text: str) -> str:
        """加粗 **text**"""
        return f"**{text}**"

    @staticmethod
    def md_italic(text: str) -> str:
        """斜体 *text*"""
        return f"*{text}*"

    @staticmethod
    def md_strike(text: str) -> str:
        """删除线 ~~text~~"""
        return f"~~{text}~~"

    @staticmethod
    def md_color(text: str, color: str = "red") -> str:
        """
        彩色文本。
        color: red/green/blue/grey/orange/purple/indigo/turquoise/wathet/yellow/lime/carmine/violet
        """
        return f"<font color='{color}'>{text}</font>"

    @staticmethod
    def md_tag(text: str, color: str = "blue") -> str:
        """
        文字标签（彩色圆角胶囊）。
        color: neutral/blue/turquoise/lime/orange/violet/indigo/wathet/green/yellow/red/purple/carmine
        """
        return f"<text_tag color='{color}'>{text}</text_tag>"

    @staticmethod
    def md_at(user_id: str) -> str:
        """@指定用户（open_id / user_id）"""
        return f"<at id={user_id}></at>"

    @staticmethod
    def md_at_all() -> str:
        """@所有人（需群主开启权限）"""
        return "<at id=all></at>"

    @staticmethod
    def md_link(text: str, url: str) -> str:
        """超链接 [text](url)"""
        return f"[{text}]({url})"

    @staticmethod
    def md_code_inline(code: str) -> str:
        """`行内代码`"""
        return f"`{code}`"

    @staticmethod
    def md_code_block(code: str, lang: str = "") -> str:
        """代码块，支持语法高亮（lang: python/json/sql/bash 等）"""
        return f"```{lang}\n{code}\n```"

    @staticmethod
    def md_header(text: str, level: int = 1) -> str:
        """标题，level 1-6"""
        return f"{'#' * max(1, min(6, level))} {text}"

    @staticmethod
    def md_hr() -> str:
        """分割线"""
        return "\n---\n"

    # ━━ Bitable (多维表格) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def create_bitable(self, name: str, folder_token: str = None) -> dict:
        body = {"name": name}
        if folder_token:
            body["folder_token"] = folder_token
        return self._request("POST", "/bitable/v1/apps", json=body)

    def list_bitable_tables(self, app_token: str) -> list[dict]:
        data = self._request("GET", f"/bitable/v1/apps/{app_token}/tables")
        return data.get("data", {}).get("items", [])

    def add_bitable_field(self, app_token: str, table_id: str,
                          field_name: str, field_type: int = 1) -> dict:
        """
        添加多维表格字段（列定义）。

        Args:
            app_token: 多维表格 app_token
            table_id: 数据表 ID
            field_name: 字段名
            field_type: 字段类型 (1=文本, 2=数字, 3=单选, 5=日期, 15=超链接)

        Returns:
            API 响应（含 field_id）
        """
        return self._request(
            "POST",
            f"/bitable/v1/apps/{app_token}/tables/{table_id}/fields",
            json={"field_name": field_name, "type": field_type},
        )

    def create_bitable_with_fields(
        self,
        name: str,
        fields: list[tuple[str, int]],
        folder_token: str = None,
    ) -> tuple[str, str, str]:
        """
        创建多维表格并定义字段，返回 (app_token, table_id, url)。

        通过 create table API 直接创建带自定义字段的表，
        然后删除默认的空"数据表"，避免出现多余的默认列和空行。

        Args:
            name: 表格名称
            fields: 字段列表 [(字段名, 类型), ...]  类型: 1=文本, 2=数字, 5=日期, 15=超链接
            folder_token: 可选，父文件夹 token

        Returns:
            (app_token, table_id, url) 三元组
        """
        # 1. 创建 bitable app（会附带一个默认空表）
        result = self.create_bitable(name, folder_token=folder_token)
        app_data = result.get("data", {}).get("app", {})
        app_token = app_data.get("app_token", "")
        default_table_id = app_data.get("default_table_id", "")
        url = app_data.get("url", "")

        # 2. 创建自定义表（带完整字段定义，首列即第一个字段）
        field_defs = [{"field_name": fn, "type": ft} for fn, ft in fields]
        table_result = self._request(
            "POST",
            f"/bitable/v1/apps/{app_token}/tables",
            json={
                "table": {
                    "name": name,
                    "default_view_name": "数据视图",
                    "fields": field_defs,
                }
            },
        )
        table_id = table_result.get("data", {}).get("table_id", "")

        # 3. 删除默认空表（避免用户看到多余的空白表）
        if default_table_id and table_id:
            try:
                self._request(
                    "DELETE",
                    f"/bitable/v1/apps/{app_token}/tables/{default_table_id}",
                )
            except Exception:
                pass  # 删不掉也没关系，不影响功能

        return app_token, table_id, url

    def create_bitable_records(self, app_token: str, table_id: str,
                               records: list[dict]) -> dict:
        """
        批量创建多维表格记录。
        records: [{"fields": {"字段名": "值", ...}}, ...]
        """
        return self._request(
            "POST",
            f"/bitable/v1/apps/{app_token}/tables/{table_id}/records/batch_create",
            json={"records": records},
        )

    def search_bitable_records(self, app_token: str, table_id: str,
                               filter_: dict = None, sort: list = None,
                               page_size: int = 20) -> dict:
        body = {"page_size": page_size}
        if filter_:
            body["filter"] = filter_
        if sort:
            body["sort"] = sort
        return self._request(
            "POST",
            f"/bitable/v1/apps/{app_token}/tables/{table_id}/records/search",
            json=body,
        )


# ━━ CLI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _print_json(data):
    print(json.dumps(data, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(
        description="Feishu Toolkit CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Environment variables: FEISHU_APP_ID, FEISHU_APP_SECRET",
    )
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("auth", help="测试认证，获取 tenant_access_token")

    sub.add_parser("list-chats", help="列出机器人已加入的群组")

    p = sub.add_parser("send-text", help="发送文本消息")
    p.add_argument("chat_id", help="群组 chat_id 或用户 open_id")
    p.add_argument("text", help="消息文本")
    p.add_argument("--type", default="chat_id", dest="id_type",
                   choices=["chat_id", "open_id", "union_id", "email"],
                   help="receive_id 类型 (默认 chat_id)")

    p = sub.add_parser("upload-image", help="上传图片，返回 image_key")
    p.add_argument("image_path", help="图片文件路径")

    p = sub.add_parser("send-image", help="上传并发送图片消息")
    p.add_argument("chat_id", help="群组 chat_id")
    p.add_argument("image_path", help="图片文件路径")

    p = sub.add_parser("get-user-id", help="通过邮箱/手机号查询 open_id")
    p.add_argument("--email", help="用户邮箱")
    p.add_argument("--mobile", help="用户手机号")

    p = sub.add_parser("create-doc", help="创建飞书文档")
    p.add_argument("title", help="文档标题")
    p.add_argument("--folder", help="目标文件夹 token", default=None)

    sub.add_parser("list-wikis", help="列出有权限的知识空间")

    p = sub.add_parser("create-wiki-doc", help="在知识库中创建文档（自动移动到知识空间）")
    p.add_argument("title", help="文档标题")
    p.add_argument("--space-id", required=True, dest="space_id", help="知识空间 ID（用 list-wikis 获取）")
    p.add_argument("--parent", default=None, dest="parent_wiki_token",
                   help="父节点 wiki_token，不传则为知识空间一级节点")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    try:
        client = FeishuClient()
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        if args.command == "auth":
            token = client.token
            print(f"Auth OK. Token: {token[:20]}...{token[-6:]}")
            print(f"App ID: {client.app_id}")

        elif args.command == "list-chats":
            chats = client.list_chats()
            if not chats:
                print("No chats found. Make sure the bot has been added to at least one group.")
            for c in chats:
                print(f"  {c.get('chat_id')}  |  {c.get('name', 'N/A')}  |  owner: {c.get('owner_id', 'N/A')}")

        elif args.command == "send-text":
            result = client.send_text(args.chat_id, args.text, args.id_type)
            _print_json(result)
            print("Message sent successfully.")

        elif args.command == "upload-image":
            key = client.upload_image(args.image_path)
            print(f"image_key: {key}")

        elif args.command == "send-image":
            key = client.upload_image(args.image_path)
            result = client.send_image(args.chat_id, key)
            _print_json(result)
            print("Image sent successfully.")

        elif args.command == "get-user-id":
            emails = [args.email] if args.email else None
            mobiles = [args.mobile] if args.mobile else None
            if not emails and not mobiles:
                print("Error: --email or --mobile required", file=sys.stderr)
                sys.exit(1)
            users = client.get_user_ids(emails=emails, mobiles=mobiles)
            _print_json(users)

        elif args.command == "create-doc":
            doc = client.create_document(args.title, args.folder)
            doc_id = doc["document_id"]
            print(f"Document created: {doc_id}")
            print(f"URL: https://feishu.cn/docx/{doc_id}")

        elif args.command == "list-wikis":
            spaces = client.list_wiki_spaces()
            if not spaces:
                print("No wiki spaces found.")
                print("Make sure the app is added as wiki member/admin.")
            for s in spaces:
                print(f"  {s.get('space_id')}  |  {s.get('name', 'N/A')}  |  {s.get('space_type', 'N/A')}")

        elif args.command == "create-wiki-doc":
            result = client.create_document_in_wiki(
                args.space_id, args.title,
                parent_wiki_token=args.parent_wiki_token,
            )
            print(f"Document created in wiki!")
            print(f"  wiki_token: {result['wiki_token']}")
            print(f"  obj_token:  {result['obj_token']}")
            print(f"  URL: {result['url']}")

    except FeishuAPIError as e:
        print(f"Feishu API Error: {e}", file=sys.stderr)
        sys.exit(1)
    except requests.HTTPError as e:
        print(f"HTTP Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
