# 本地 ChatGPT 续作指令

你现在接手「UI工作室」项目，站点是 https://layerlab-studio-dany.xpbet-3575.chatgpt.site/，GitHub 仓库是 https://github.com/dannymz2021-max/UI- 。

**先核对本仓库是否包含真实源码。** 如果仍然只包含交接文档，明确指出不可运行，优先从原 Sites 项目取得源码并确认资源与依赖完整，不要声称已经完成迁移。

新版本将 Icon 预设模型编辑和 AI 生图合并为唯一「AI创作台」：输入自然语言 → 上传参考图 → 自动理解 → 调用真实图像模型 → 自然语言继续修改 → 下载 PNG/真正透明 PNG。停止要求用户手工建模、调整材质和摆饰。

需求必须忠实原文、可核对参考角色、可连续修改，验证真实模型接口、文件参数、透明背景、准确文字及版本恢复。旧主站 UI、活动页、拆层、Figma 设计变量来源和独立滚动需保留。

ChatGPT 订阅无法直接变成公开站点的 API 额度；需要服务器可用的模型提供商凭据和合理的额度/鉴权。任何密钥不得放进代码、聊天或 GitHub。

完整验收请阅读 docs/PROJECT_HANDOFF.md、docs/AI_CREATOR_SPEC.md 和 docs/SOURCE_RECOVERY.md。