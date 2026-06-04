# 知识库与个性化 LLM 设计

> Date: 2026-06-04
> Status: Draft

## 概述

让 Desktop Todo 在生成提醒和日报时，能结合**用户角色**和**个人知识库**做更贴合的输出。参考 llm-wiki 思路：

- 用户在 `role.md` 写明身份、目标、上下文 → 注入 LLM system prompt
- 用户配置 N 个 markdown 源目录 → 自动 watch、增量构建 wiki
- 每次 LLM 调用前，从 wiki 检索 top-k 相关片段 → 拼进 prompt
- 用户可选 wiki 输出目录（可放在 Obsidian vault 里直接打开）

整套实现不绑任何外部软件（无 Obsidian CLI 依赖），检索用自实现的 token 化打分（无 BM25 库、无 embedding、无向量数据库）。

## 架构

```
源目录 (用户配置的 markdown 目录，max 5)
  ↓ chokidar watch + SHA256 diff
入库队列 (SQLite 持久化)
  ↓ 串行消费
Two-step CoT LLM Ingest
  ↓ 写 markdown 文件到 wiki 目录
wiki 目录 (用户自选路径，Obsidian 兼容格式)
  ↓ 启动时构建 token 索引 (内存 + SQLite 持久化)
top-k 检索 (自实现打分)
  ↓ 拼进 prompt
ReminderService / DailyReportService 调 LLM 时
```

## 数据结构

### SQLite 新增表

迁移文件 `src/database/migrations/004_knowledge_base.ts`：

```sql
CREATE TABLE kb_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,           -- 用户配置的源目录绝对路径
  enabled INTEGER NOT NULL DEFAULT 1,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kb_files (
  path TEXT PRIMARY KEY,               -- 源文件绝对路径
  sha256 TEXT NOT NULL,                -- 文件内容 hash
  last_ingested_at DATETIME,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / processing / done / failed
  error TEXT
);

CREATE TABLE kb_ingest_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  enqueued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / processing / done / failed
  retry_count INTEGER DEFAULT 0,
  error TEXT
);

CREATE TABLE kb_pages (
  path TEXT PRIMARY KEY,               -- wiki 页面绝对路径
  title TEXT NOT NULL,
  page_type TEXT NOT NULL,             -- source / entity / concept / overview / index
  source_path TEXT,                    -- 主要源文件路径（source 类型必填；entity/concept 为最近一次更新者）
  sha256 TEXT,                         -- 主要源文件 sha256（page merge 后不再唯一，保留以 source 页为主）
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  content TEXT NOT NULL
);

CREATE INDEX idx_kb_pages_type ON kb_pages(page_type);
CREATE INDEX idx_kb_pages_source ON kb_pages(source_path);
```

设置存 `settings` 表（已有）：

| key | value 类型 | 说明 |
|---|---|---|
| `kb_enabled` | `'true'`/`'false'` | 知识库总开关 |
| `kb_wiki_dir` | string | wiki 输出根目录 |
| `kb_role_path` | string | role.md 路径（默认在 app 数据目录） |
| `kb_max_dirs` | int | 源目录上限（默认 5） |
| `kb_max_files` | int | 源文件总数上限（默认 30） |

源目录列表用单独的 `kb_sources` 表（每行一个），不走 settings 里的 JSON 数组。

**两重上限**：
- 源目录 ≤ 5 个（`kb_max_dirs`）
- 所有目录里**启用的源文件总数 ≤ 30**（`kb_max_files`，递归统计 `.md` / `.markdown` / `.mdx`）
- 两道校验：`addSource()` 时先看目录数，再扫该目录下的 md 文件数算 total，超额拒绝
- UI 在添加目录前提示"当前已用 18/30，本次将添加 12 个"
- 超额时引导用户先移除/缩减其他目录，或调整 `kb_max_files`（高级设置，不暴露在主 UI）

### 文件系统布局

**App 数据目录**（macOS: `~/Library/Application Support/Desktop Todo/`）：

```
role.md                  # 用户手写（提供示例模板）
```

**wiki 目录**（用户自选）：

```
<user-chosen-dir>/
  index.md               # 索引页（自动维护）
  overview.md            # 全局摘要（自动维护）
  log.md                 # 操作日志（自动维护）
  sources/
    <sha256-prefix>.md   # 每个源文件对应一页
  entities/
    *.md                 # 自动发现的实体
  concepts/
    *.md                 # 自动发现的概念
```

**重要**：wiki 目录**不得位于任何源目录内部**。chokidar 监听源目录递归，ingest 写出的 `sources/*.md`、`entities/*.md` 会被下一次 watch 事件捕获，**触发自循环 ingest + LLM 配额耗尽**。

合法位置：
- `app.getPath('userData')/wiki/`（应用数据目录，最安全）
- Obsidian vault 根下的 `.desktop-todo-wiki/`（独立子目录，**不能**落在任何被配为源目录的子路径下）

`KnowledgeBaseService.addSource()` 校验 `wikiDir.startsWith(sourceDir) === false` 或 `sourceDir.startsWith(wikiDir) === false`，违反则拒绝添加。

## role.md

放在 app 数据目录，文件名固定。用户在设置面板点击"编辑 role.md"打开系统编辑器修改。

模板内容（首次生成时写入）：

```markdown
# 角色

## 身份
- 职业：后端工程师
- 所在公司/团队：（待填）
- 当前 focus：（待填）

## 当前目标
- 季度目标：（待填）
- 正在推进的项目：（待填）

## 工作原则
- （待填，比如"先小步验证再扩展"、"重视可观测性"）

## 输出偏好
- 提醒语气：（直接/温和）
- 日报格式：（简洁/详细）
```

加载逻辑：`RoleService.load()` 读 `role.md`，按段落切分。空段或 `# 角色` 这种标题跳过。`ReminderService` / `DailyReportService` 调 LLM 时把全部内容拼到 system prompt 头部：

```typescript
const systemPrompt = `
[角色上下文]
${roleContent || '(未配置 role.md，请在设置中编辑)'}

[相关知识]
${topKChunks.map(c => c.content).join('\n---\n')}

[任务]
${originalTaskPrompt}
`;
```

## 源目录配置

设置面板新增 **"知识库"** Tab（外观 / 智能 / 通知 / 系统 / **知识库**）：

```
┌─ 知识库 ──────────────────────────────────┐
│  [启用知识库增强] toggle                   │
│                                            │
│  角色说明                                  │
│  当前文件：~/Library/.../role.md           │
│  [在编辑器中打开]  [重置为模板]             │
│                                            │
│  源目录（已添加 2/5 目录，18/30 文件）     │
│  ✓ ~/Documents/notes (8)    [移除]          │
│  ✓ ~/Obsidian/work   (10)   [移除]          │
│  [+] 添加目录                              │
│                                            │
│  Wiki 输出目录                             │
│  路径：~/Obsidian/.desktop-todo-wiki       │
│  [更改]  [在 Finder 中显示]                │
│                                            │
│  状态                                      │
│  待入库：3  处理中：1  失败：0              │
│  [立即构建]  [重建索引]                    │
│  ─────────                                 │
│  上次入库：2026-06-04 18:30                 │
└────────────────────────────────────────────┘
```

行为：
- 添加目录：弹原生文件夹选择器，校验：
  1. 目录数 ≤ `kb_max_dirs`（5）
  2. 该目录内 md 文件数 + 已有总数 ≤ `kb_max_files`（30）
  3. wiki 目录不在该源目录内部（避免 ingest 自循环，见上方"重要"）
  4. 任一超额或冲突则拒绝添加并提示
- 移除：停 watch 该目录，从 `kb_sources` 删
- 启用开关：关掉时所有 watch 暂停，LLM 调用跳过知识库步骤
- "立即构建"：把当前所有 `kb_files.status='done'` 的源重新入队（强制刷新）
- "重建索引"：清 `kb_pages` + token 索引，重新走 ingest 流程

## Wiki 格式

Obsidian 兼容（YAML frontmatter + `[[wikilinks]]` + 标准 markdown），不绑 Obsidian 软件。

### 源文件摘要页 (`sources/<sha256-prefix>.md`)

```markdown
---
type: source
title: "How to write a good commit message"
source_path: /Users/.../notes/commits.md
ingested_at: 2026-06-04T18:30:00Z
---

# How to write a good commit message

（LLM 生成的摘要 + 关键观点）

## 核心观点
- 第一点
- 第二点

## 相关条目
- [[entity/git-best-practices]]
- [[concept/atomic-commits]]
```

### 实体页 (`entities/<name>.md`)

```markdown
---
type: entity
title: "Git"
updated_at: 2026-06-04T18:30:00Z
sources:
  - /Users/.../notes/commits.md
---

# Git

（实体描述）

## 出现于
- [[source/abc123|How to write a good commit message]]
```

### 概念页 (`concepts/<name>.md`)

格式同 entity，frontmatter `type: concept`。

### index.md

```markdown
---
type: index
updated_at: 2026-06-04T18:30:00Z
---

# Knowledge Index

## 源文件（12）
- [[source/abc123|How to write a good commit message]] — 2026-06-04
- ...

## 实体（8）
- [[entity/git|Git]]
- ...

## 概念（5）
- [[concept/atomic-commits|Atomic Commits]]
- ...
```

### overview.md

LLM 定期（每 10 个新 source 入库后）生成的整体摘要，反映 wiki 当前的"知识全貌"。

### log.md

追加式：

```markdown
## 2026-06-04 18:30:00
- ingested: source/abc123 (commits.md)
- updated: entity/git
- created: concept/atomic-commits

## 2026-06-04 18:25:00
- ...
```

## Ingest 流程

### 触发

1. **启动时**：扫描 `kb_sources` 中所有 enabled 目录，对每个文件算 SHA256，对比 `kb_files` 表：
   - 新文件 → 入 `kb_ingest_queue` (status=pending)
   - SHA256 变了 → 入队
   - 没变 → 跳过
2. **运行时**：chokidar watch 各源目录，文件 change/unlink/add 事件 debounce 5s 后入队
3. **手动**：设置面板"立即构建"全量入队

### 串行消费

`WikiIngestService.start()` 起一个 worker：

```typescript
while (true) {
  const job = pickNextJob();  // SELECT ... WHERE status='pending' ORDER BY enqueued_at LIMIT 1
  if (!job) { sleep(5s); continue; }
  await processJob(job);      // 一次只跑一个 LLM 任务
}
```

### Two-step CoT（参考 llm-wiki）

**Step 1: Analysis**（一次 LLM 调用）

输入：源文件全文（最多 8000 token，超长截断 + 提示）

System prompt：当前 `role.md` 摘要 + 已有的 wiki 概览（来自 `overview.md`）

输出（结构化 JSON）：

```json
{
  "summary": "这段材料讨论的核心...",
  "entities": [
    {"name": "Git", "type": "technology", "isNew": false},
    {"name": "Atomic Commits", "type": "concept", "isNew": true}
  ],
  "concepts": [
    {"name": "Atomic Commits", "description": "..."}
  ],
  "keyPoints": ["...", "..."],
  "linksTo": ["[[entity/git-best-practices]]"],
  "contradicts": []
}
```

**Step 2: Generation**（又一次 LLM 调用）

输入：Step 1 的分析 + 已有相关 wiki 页内容

输出：要写的所有 wiki 页内容（也是结构化 JSON）：

```json
{
  "sourcePage": { "path": "sources/abc123.md", "content": "..." },
  "entityPages": [
    { "name": "Git", "content": "...", "mergeWithExisting": true }
  ],
  "conceptPages": [
    { "name": "Atomic Commits", "content": "...", "mergeWithExisting": false }
  ],
  "indexUpdate": "...",
  "overviewUpdate": "...",
  "logEntries": ["..."]
}
```

`WikiIngestService` 收到后：
- `mergeWithExisting=true` 的页面用 LLM 给的内容 + 已有内容做合并（再调一次 LLM 做 merge，或简单拼接 + 标 `merged: true`）
- 写 markdown 文件到磁盘
- 更新 `kb_pages` 表（按 path upsert）
- 追加 `log.md`
- 重建 `index.md`（每次 ingest 后）

### 失败处理

- LLM 调用失败（网络/HTTP 错误）→ `retry_count +1`，状态 `failed`，最多重试 3 次
- LLM 输出 JSON 解析失败（用 zod 校验，未通过则视为失败）→ 同上
- HTTP 429 限流 → backoff **30s** 而非 2s，最多 5 次后转 `failed`（避免反复触发限流）
- 3 次后保留 `failed` 状态，UI 展示
- 用户点"重试"清错误重新入队
- 写文件失败 → 同上

**部分失败语义（Two-step CoT）**：

- 状态机扩展：`pending` → `processing` → `step1_done` → `done` / `failed`
- Step 1 完成、Step 2 失败 → `status='failed'`，**不**写 `kb_pages`，**不**写 wiki 文件
- 重试时从 Step 1 重跑（不缓存 Step 1 中间结果，简化状态机）
- 写 wiki 文件用**临时文件 + rename 原子提交**：先写 `xxx.md.tmp`，fsync 后 `rename(..., 'xxx.md')`，避免崩溃留下半截文件

### 限速

- 全局字段 `settings.kb_last_llm_call_at`（ISO 时间戳）；worker 在调 LLM 前 `await sleep(until 2s after last)`
- ingest 间隔：每完成一个 job 后等 2s 再起下一个（保护 LLM 配额）
- 同时只一个 worker 跑（避免抢占 LLM）

## 检索

### Token 索引构建

`WikiIndexService` 启动时（`App.whenReady` 后台）：

1. 读 `kb_pages` 表所有行
2. 对每页 `content` 做 token 化（见下）
3. 倒排索引：`Map<token, Set<pagePath>>`，存到内存
4. 同步写入 SQLite `kb_tokens (token TEXT, page_path TEXT, tf INTEGER)` 表（增量更新用）

### Token 化

```typescript
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  // 英文：转小写，按 \W+ 切，去停用词
  const words = text.toLowerCase().split(/[^a-z0-9一-龥]+/i).filter(Boolean);
  tokens.push(...words.filter(w => !STOP_WORDS.has(w)));
  // 中文 bigram：每两个相邻汉字成一个 token
  const cjk = text.match(/[一-龥]/g) || [];
  for (let i = 0; i < cjk.length - 1; i++) {
    tokens.push(cjk[i] + cjk[i+1]);
  }
  return tokens;
}
```

### 查询

```typescript
function search(query: string, topK: number = 5): Page[] {
  const qTokens = tokenize(query);
  const scores = new Map<string, number>();
  for (const t of qTokens) {
    const pages = invertedIndex.get(t);
    if (pages) for (const p of pages) {
      scores.set(p, (scores.get(p) || 0) + 1);
    }
  }
  // title bonus
  for (const t of qTokens) {
    for (const [path, page] of pageIndex) {
      if (page.title.toLowerCase().includes(t)) {
        scores.set(path, (scores.get(path) || 0) + 10);
      }
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([path]) => pageIndex.get(path));
}
```

零依赖。索引大小估算：1000 页 × 平均 500 字 × 4 token/字 ≈ 2M token entry，内存约 50MB，可接受。

## 集成到现有 LLM 调用

### `LLMService` 新增可选参数

```typescript
async chat(opts: {
  systemPrompt: string;
  userPrompt: string;
  // 新增
  kbContext?: boolean;  // 默认 true（如果 kb_enabled）
}): Promise<string>
```

实现：
1. 如果 `kbContext && settings.get('kb_enabled') === 'true'`：
   - 加载 `role.md`
   - 用 `userPrompt` 前 200 字做 query，调 `search()` 取 top-5
   - 拼成完整 system prompt
2. 否则只用传入的 `systemPrompt`

### `ReminderService` / `DailyReportService`

调用方**不直接调 `chat()`**。原 `generateReminderSummary()` / `generateDailyReport()` 保留为 thin wrapper：

```typescript
async generateReminderSummary(todos) {
  return this.chat({
    systemPrompt: '你是一个待办事项提醒助手...',
    userPrompt: todos.map(t => `- ${t.content}`).join('\n'),
    kbContext: true,
  });
}
```

`ReminderService` / `DailyReportService` 零改动，所有 LLM 调用自动经 KB 路径。

Prompt 拼接顺序：

```
[1] role.md 内容
[2] 检索到的 wiki 片段（按相关度排序，每段标注来源 path）
[3] 任务指令
[4] 当前 todos / 提醒时间等动态数据
```

## 设置面板 UI

新 Tab "知识库"（在 Tabs 数组里加一项 `kb`，label "知识库"），UI 已在上面画了。

需要：
- 复用现有 form-field / toggle-row / btn 等样式（refactor 后的 design token）
- 路径展示用 readonly input + "更改"按钮（弹原生 dialog）
- 状态徽章用现有 `.form-hint` 样式

## 限制

- 源目录上限 5 个、源文件总数上限 30 个（在 `addSource` 双重校验）
- 单文件最大 8000 token（LLM 上下文限制），超长截断 + 在源页标注 `truncated: true`
- 中文 bigram 不完美（bigram 不覆盖三字以上词的语义），但对个人笔记够用；后续可换 jieba 之类的
- wiki 目录用户选定后**不可热切换**（避免重新生成索引的复杂度）。切换行为：
  - 设置面板保存 `kb_wiki_dir` 时检测值变化，若改变则**阻止保存**并提示"请重启应用后再次修改"
  - 重启后 `WikiIndexService` 启动时读 `kb_wiki_dir_last_indexed`（上次索引时的值）；不一致则：
    1. 把 `kb_pages` 中 path 不在新目录下**或文件已不存在**的行全部删除
    2. 重新构建 token 索引（异步进行，期间 KB 检索返回空）
    3. 旧目录保留为孤儿文件，用户手动清理
    4. 索引完成后更新 `kb_wiki_dir_last_indexed`
- role.md 修改后下次 LLM 调用即生效（不缓存，每次都读盘）
- 不做跨语言（角色中文写就用中文 prompt，英文就英文）
- 不做 LLM 失败时的降级（直接报错让用户重试）

## 组件改动清单

### 新增

| 文件 | 职责 |
|---|---|
| `src/services/RoleService.ts` | 读写 role.md，导出 `loadRole(): string` |
| `src/services/KnowledgeBaseService.ts` | 源目录管理（增删查），kb_sources 维护 |
| `src/services/KnowledgeWatcher.ts` | chokidar 实例封装，文件 change 事件入队 |
| `src/services/WikiIngestService.ts` | 队列消费、Two-step CoT、文件写入 |
| `src/services/WikiIndexService.ts` | token 索引构建、查询 |
| `src/database/migrations/004_knowledge_base.ts` | 新增 4 张表 |
| `src/preload/index.ts` | 暴露 KB 相关 IPC |

### 修改

| 文件 | 改动 |
|---|---|
| `src/services/LLMService.ts` | 新增 `chat()` 方法（KB 路径），旧 `generateReminderSummary` / `generateDailyReport` 改写为 thin wrapper 转调 `chat()` |
| `src/database/connection.ts` | `runMigrations()` 数组追加 `004_knowledge_base`（加载器**硬编码**，新文件不会被自动发现） |
| `src/services/ReminderService.ts` | 调 `chat()` 时默认 `kbContext: true` |
| `src/services/DailyReportService.ts` | 同上 |
| `src/main/index.ts` | 启动 `KnowledgeWatcher` + `WikiIngestService` worker + `WikiIndexService` 初始化 |
| `src/main/ipc.ts` | 新增 `kb:addSource`, `kb:removeSource`, `kb:rebuild`, `kb:openRole` 等 handler |
| `src-renderer/components/SettingsPanel.tsx` | 新增"知识库"Tab 渲染逻辑 |
| `src-renderer/components/SettingsPanel.css` | 知识库 Tab 样式 |
| `src-renderer/store/index.ts` | `kbSources`, `kbStats` 状态 + 同步 action |
| `src-renderer/types/` | 新增 `KbSource`, `KbStats` 类型 |

### 新增 npm 依赖

| 包 | 用途 | 必要性 |
|---|---|---|
| `chokidar@^3.6.0` | 跨平台文件 watch | 必须；**锁版本** v4 是 ESM-only，与项目 CJS（`require`）不兼容 |
| `@types/chokidar` | 类型 | devDep |

无其他新增依赖（不引 BM25 库、不引 embedding、不引 Obsidian CLI、不引 markdown parser——模板字符串生成 YAML/markdown 够用）。

## 实现阶段

不一次性做完，分 4 个阶段，每阶段独立可测试：

**Phase 1：基础设施（无 LLM）**
- 数据库迁移 + 表结构
- `RoleService`（读写 role.md + 模板生成）
- `KnowledgeBaseService`（源目录 CRUD + 上限校验）
- 设置面板"知识库"Tab 的 UI（不含 LLM 部分）
- `kb_enabled` / `kb_wiki_dir` / `kb_role_path` 设置读写
- 验证：能在设置里添加/移除源目录、编辑 role.md

**Phase 2：Watch + 索引（无 LLM 写入）**
- `KnowledgeWatcher`（chokidar 启动/停止）
- `WikiIndexService`（启动时读已有 wiki 页构建 token 索引，检索可用）
- 手动放几个示例 wiki 页面，验证检索能命中

**Phase 3：Ingest 管道**
- `WikiIngestService`（队列消费 + Two-step CoT + 写文件 + 写 kb_pages）
- 串行 worker，retry 3 次
- index.md / log.md / overview.md 自动维护
- 验证：放一个源文件到源目录，触发 ingest，检查生成的所有 wiki 页

**Phase 4：LLM 集成**
- `LLMService.chat()` 拼 role + wiki 片段
- `ReminderService` / `DailyReportService` 启用
- 验证：到点提醒、生成日报，看输出质量

每阶段完成后 commit 一次，发布版本可单独决定。

## 验证方法

按 CLAUDE.md 已有的 `desktop-todo-verification-method.md` 流程：
1. `pnpm build` 无 error
2. `pnpm start` 启动无 React error
3. 手动测试每阶段的功能
4. Phase 3 完成后做一次 e2e：添加源目录 → 放一个测试 md → 等 ingest 完成 → 看 wiki 文件 + 数据库

## 不在本次范围

- 多用户/多 profile
- wiki 内容的 Web 渲染
- 移动端/网页端
- 知识图谱 / Louvain / Deep Research
- vector embedding / RAG
- 自动 watch 整个 Obsidian vault（用户自己挑目录）
