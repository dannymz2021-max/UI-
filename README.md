# UI工作室 · AI创作台

Icon生成和AI图像生成已合并为同一个自然语言创作入口。原手工建模流程已退出主界面，主站、活动、拆层、组件快照与作品库继续保留。

- [打开平台](https://ui-studio-danny-rebuilt.voidgdszyy.chatgpt.site/studio/#creator)（当前为私有访问）
- [完整平台源码与运行说明](platform/README.md)
- [验收记录与边界](platform/docs/verification-2026-11-03.json)

主要流程：描述需求、可选参考图、需求清单、模型生成、自然语言修改、历史版本、PNG下载。参考图可明确只参考主体、材质、风格、颜色或构图。

服务端包含登录鉴权、任务防重、用户隔离、额度错误分类以及真实PNG/Alpha校验。模型凭据需要单独安全配置，可用API额度及真实生成/编辑验收也是独立条件。接口模拟测试通过不代表模型画面质量已验收。

需要Node.js 22.13+及pnpm 11.25.0，详见platform/README.md。真实密钥和本地个人记录不包含在仓库。

## 原交接资料

- [原始交接包](UIStudio_Handoff_REDOWNLOAD.zip)
- [项目交接说明](docs/PROJECT_HANDOFF.md)
- [AI创作台需求](docs/AI_CREATOR_SPEC.md)
- [源码恢复背景](docs/SOURCE_RECOVERY.md)

旧交接材料反映当时状态，当前实现以platform/中的代码和验收边界为准。
