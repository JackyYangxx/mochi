# Pet Encouragement 设计

**日期**：2026-06-06
**作者**：Claude
**状态**：已批准

## 目标

宠物窗口偶尔自动显示一句激励用户的短句，让桌面伴侣更生动。

## 用户场景

用户长时间使用 Mochi 时，宠物定时显示一句温暖、轻松的短句。
不打断主要操作，不干扰待办管理。

## 行为

### 触发
- 应用启动后开始计时
- 5-15 分钟之间的随机间隔
- 渲染端维护一个 setTimeout 链：每轮触发 → 显示 → 7s 消失 → 进入下一轮随机间隔

### 内容来源
- **默认**：内置 40 条左右的中文短句列表
- **当用户配置了 LLM**（即设置中有 `llmEndpoint` + `llmApiKey`）：每次触发时调用 LLM 生成新短句
- 失败/超时/未配置 → 降级到内置列表

### 显示
- 复用现有 `.pet-tips` 气泡（在宠物头部上方）
- 持续 7 秒后淡出消失
- 单条长度建议 10-20 个中文字符

### 冲突处理
- 当外部 tip 在显示时（如"日报已生成"），激励语本轮不显示，30 秒后再试
- 当用户在交互时（输入框打开、设置打开），hook 暂停定时器
- 状态清零后从下一轮重新开始随机间隔

### 去重
- 内置列表模式下，最近 10 条内不重复抽同一句
- AI 模式下不主动去重（每次都是新生成）

## 架构

### 渲染端（新增）
- `src-renderer/data/encouragements.ts` — 内置 40 条短句常量数组
- `src-renderer/hooks/useEncouragement.ts` — hook

### 渲染端（修改）
- `src-renderer/components/PetView.tsx` — 引入 hook；将 hook 返回的 `currentTip` 与外部 `tipsMessage`（日报通知）合并显示

### 主进程（新增）
- `src/main/ipc.ts` 新增 `encouragement:generate` handler

### 主进程（修改）
- `src/preload/index.ts` 暴露 `window.todoAPI.generateEncouragement()`

## 数据流

```
useEncouragement (渲染端)
   ↓ setTimeout(随机 5-15min)
   ↓
pickPhrase():
   ├─ if (aiEnabled) → window.todoAPI.generateEncouragement()
   │     ↓
   │   main process IPC: encouragement:generate
   │     ↓
   │   LLM HTTP call (复用现有工具)
   │     ↓
   │   return string
   │
   └─ else → 随机抽内置列表（避开最近 10 条）
   ↓
setCurrentTip(phrase)  →  PetView 渲染 .pet-tips
   ↓ 7s
setCurrentTip(null)
   ↓
scheduleNext()
```

## 关键接口

### `useEncouragement(aiEnabled: boolean, isExternalTipActive: boolean): { currentTip: string | null }`

**参数：**
- `aiEnabled` — 由调用方传入的布尔值：表示 `LLMService.isConfigured() === true`（含 endpoint + model + apiKey 三者都已加载）。hook 端不做判断。
- `isExternalTipActive` — 外部 tip（如日报通知）当前是否在显示

**返回：**
- `currentTip` — 当前要显示的文案；null 表示不显示

**副作用：**
- 内部维护 setTimeout 链
- 卸载时清理所有 timer

### IPC `encouragement:generate(): Promise<string>`

**返回：** 一句激励短句（10-20 字）
**错误：** `'not-configured'` | `'timeout'` | `'llm-error'`

## 错误处理

| 场景 | 行为 |
|------|------|
| AI 未配置 | 降级到内置列表（hook 端用本地判断，不发 IPC） |
| AI 调用超时（>8s） | 降级到内置列表 |
| AI 返回空串/超长 | 降级到内置列表 |
| 内置列表为空 | 不显示气泡，进入下一轮 |
| IPC 整体未注册 | hook 端 try/catch 降级 |
| 用户在交互 | 暂停定时器 |

## 性能 & 资源

- 渲染端 hook 只在 `setTimeout` 触发时计算，平时不占用 CPU
- AI 调用最坏 8s 后降级，不阻塞主流程
- AI 调用频率受随机间隔控制：5-15 分钟一次，一天最多约 288 次，远低于 LLM 配额

## 测试

### 单元测试（hook）

1. **AI 关闭 → 抽内置列表**
   - Mock `window.todoAPI.generateEncouragement` 不被调用
   - 跑 100 次 pickPhrase，统计所有内置短句都被抽到过
   - 验证最近 10 条内无重复

2. **AI 开启 + IPC 成功**
   - Mock IPC 返回固定短句
   - 验证显示的是该短句

3. **AI 开启 + IPC 失败**
   - Mock IPC 抛错
   - 验证降级到内置列表

4. **外部 tip 激活时跳过本轮**
   - 设置 `isExternalTipActive = true`
   - 验证定时器到点后不显示，30s 后重试

### 手动验证

1. 启动应用 → 等 5-15 分钟 → 看到气泡
2. 气泡显示 7 秒后消失
3. 配置 LLM 后再次触发 → 气泡显示 LLM 生成的内容
4. 关闭 LLM 配置 → 重新降级到内置列表
5. 点宠物打开输入框 → 期间不再触发新气泡

## 未来可扩展（不做）

- 用户可自定义激励语列表
- 用户可调频率
- 节日/季节性特别语
- 国际化多语言

## 文件清单

**新增：**
- `src-renderer/data/encouragements.ts`
- `src-renderer/hooks/useEncouragement.ts`
- 测试文件

**修改：**
- `src-renderer/components/PetView.tsx`
- `src/main/ipc.ts`
- `src/preload/index.ts`
