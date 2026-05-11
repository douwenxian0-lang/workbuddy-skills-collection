# 飞书消息格式完整参考

调用 `POST /im/v1/messages?receive_id_type={type}` 发送消息时的 content 格式。
注意: `content` 字段是 **string 类型**，需要 `json.dumps()` 序列化。

## 文本消息

```json
{
  "receive_id": "oc_xxx",
  "msg_type": "text",
  "content": "{\"text\":\"Hello @所有人\"}"
}
```

在文本中 @用户: `<at user_id=\"ou_xxx\">名字</at>`

## 富文本消息 (post)

最灵活的消息类型，支持多段落混排文字、@、图片、链接。

```json
{
  "receive_id": "oc_xxx",
  "msg_type": "post",
  "content": "{\"zh_cn\":{\"title\":\"标题\",\"content\":[[{\"tag\":\"text\",\"text\":\"普通文本 \"},{\"tag\":\"a\",\"href\":\"https://example.com\",\"text\":\"链接\"},{\"tag\":\"at\",\"user_id\":\"ou_xxx\",\"user_name\":\"张三\"}],[{\"tag\":\"img\",\"image_key\":\"img_v3_xxx\"}]]}}"
}
```

## 图片消息

```json
{
  "receive_id": "oc_xxx",
  "msg_type": "image",
  "content": "{\"image_key\":\"img_v3_xxx\"}"
}
```

上传图片 API: `POST /im/v1/images`
- Content-Type: multipart/form-data
- 字段: image_type=message, image=二进制文件
- 限制: 最大 10MB, 支持 JPEG/PNG/WEBP/GIF/TIFF/BMP/ICO

## 交互卡片消息 (interactive)

```json
{
  "receive_id": "oc_xxx",
  "msg_type": "interactive",
  "content": "{\"config\":{\"wide_screen_mode\":true},\"header\":{\"title\":{\"content\":\"标题\",\"tag\":\"plain_text\"},\"template\":\"blue\"},\"elements\":[...]}"
}
```

## 消息大小限制

- 卡片及富文本消息请求体最大 **30KB**
- 图片上传最大 **10MB**
- 文件上传最大 **30MB**
