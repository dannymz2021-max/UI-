# UI工作室 / AI创作台

## 可运行的重建版 · 2026-11-03

已根据原线上平台仍可读取的前端程序与静态资源，重建并发布 UI工作室。源码和素材位于 [platform/](platform/README.md)，可独立运行，不依赖原站继续存活。

- [打开重建平台](https://ui-studio-danny-rebuilt.voidgdszyy.chatgpt.site/studio/#start)（Sites 当前访问权限为私有）
- [平台源码和运行说明](platform/README.md)
- [原始交接包](UIStudio_Handoff_REDOWNLOAD.zip)

本地启动需要 Node.js 20 或更新版本：

```sh
cd platform
npm run dev
```

打开 http://127.0.0.1:4173/studio/#start 。无需安装第三方依赖。

## 已保留的能力

- 原有紫色工作室界面与首页。
- 3D Icon 主体、材质、装饰、图层、撤销和透明 PNG 导出。
- 图片自动拆层、手动选区及分层文件导出。
- Megwin 主站与活动原稿快照、文案编辑、变量模式、页面 ZIP/HTML 导出和自由模板。
- 组件与变量读取快照、灵感素材库及浏览器作品库。

已验证脚本语法、静态资源引用、实际透明 PNG、作品保存、自动拆层、主站文案修改与页面包导出。

## 恢复边界

这份代码是基于已发布前端的可运行重建。原服务端代码、历史仓库、密钥及旧域名浏览器内的个人作品没有恢复。AI 图像、AI 文案与 Figma 在线同步尚未接入服务；本地编辑、导出及设计快照可以继续使用。不会用示例图冒充模型生成结果。

## 后续 AI创作台目标

后续可将原「Icon 生成工作台」和「AI 图像生成」合并为自然语言创作流程：描述需求、可选参考图、真实模型生成、连续修改、版本恢复及透明 PNG 下载。这次重建先恢复原平台现有能力，统一 AI创作台及真实服务接入尚未完成。

模型调用需要独立服务端凭据和授权，ChatGPT 订阅不能代替网站 API 额度。

## 原交接资料

- [项目交接说明](docs/PROJECT_HANDOFF.md)
- [AI创作台需求](docs/AI_CREATOR_SPEC.md)
- [源码恢复背景](docs/SOURCE_RECOVERY.md)
- [原接手指令](docs/NEXT_CHAT_PROMPT.md)
- [.env.example](.env.example)

以上交接资料保留原记录，其缺失源码的描述反映交接时状态；最新可运行代码以 platform/ 为准。提交时不要包含真实密钥或个人浏览器数据。
