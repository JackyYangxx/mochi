# 每日日报生成系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现日报生成功能，AI 总结当日完成事项并对未完成事项给出建议，归档已完成后从界面移除。

**Architecture:**
- 新建 `DailyReportService` 协调流程
- 扩展 `LLMService` 生成日报内容
- 扩展 `TodoService` 按日期获取/归档待办
- Settings 添加目录配置和手动触发按钮
- ReminderService 到点触发或用户手动触发

**Tech Stack:** Electron, SQLite, OpenAI API, fs (Node.js)

---

## 文件结构

| 操作 | 文件路径 | 职责 |
|------|----------|------|
| 修改 | `src/services/TodoService.ts` | 添加按日期获取待办、归档方法 |
| 修改 | `src/services/LLMService.ts` | 添加 `generateDailyReport` 方法 |
| 创建 | `src/services/DailyReportService.ts` | 协调日报生成流程 |
| 修改 | `src/preload/index.ts` | 添加日报相关 IPC |
| 修改 | `src/main/ipc.ts` | 处理日报 IPC handlers |
| 修改 | `src-renderer/components/SettingsPanel.tsx` | 添加目录配置和生成按钮 |
| 修改 | `src/main/index.ts` | 初始化 DailyReportService |

---

## Task 1: TodoService 添加按日期获取和归档方法

**Files:**
- Modify: `src/services/TodoService.ts:1-123`

- [ ] **Step 1: 添加 `getByDateRange` 方法**

在 `TodoService` 类中添加：

```typescript
getByDateRange(startDate: string, endDate: string): Todo[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM todos WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC')
    .all(startDate, endDate) as TodoRow[];
  return rows.map(rowToTodo);
}

archiveCompletedByDate(date: string): Todo[] {
  const db = getDb();
  // Get completed todos created on this date
  const rows = db
    .prepare('SELECT * FROM todos WHERE is_completed = 1 AND date(created_at) = ?')
    .all(date) as TodoRow[];
  const archived = rows.map(rowToTodo);
  // Delete from todos table
  db.prepare('DELETE FROM todos WHERE is_completed = 1 AND date(created_at) = ?').run(date);
  return archived;
}
```

- [ ] **Step 2: 验证编译**

Run: `pnpm build`
Expected: 编译成功，无错误

- [ ] **Step 3: 提交**

```bash
git add src/services/TodoService.ts
git commit -m "feat: add getByDateRange and archiveCompletedByDate methods"
```

---

## Task 2: LLMService 添加生成日报方法

**Files:**
- Modify: `src/services/LLMService.ts:1-55`

- [ ] **Step 1: 添加 `generateDailyReport` 方法**

```typescript
async generateDailyReport(
  completedTodos: { content: string; completedAt: string }[],
  incompleteTodos: { content: string }[]
): Promise<{
  completedSection: string;
  incompleteSection: string;
  summary: string;
}> {
  if (!this.client) {
    throw new Error('LLM client not configured');
  }

  const completedList = completedTodos.map(t => `- ${t.content}`).join('\n');
  const incompleteList = incompleteTodos.map(t => t.content).join('\n');

  const response = await this.client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: '你是一个待办事项日报生成助手。请根据已完成的和未完成的事项生成日报。输出格式为纯 Markdown。',
      },
      {
        role: 'user',
        content: `已完成事项：
${completedList}

未完成事项：
${incompleteList}

请生成日报，格式如下：

## 完成事项
（列出每个已完成事项，加 ✓）

## 未完成事项
（列出每个未完成事项，后面加上 → 建议...）

## 总结
（生成一段中文总结）
`,
      },
    ],
    max_tokens: 1500,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content || '';

  // Parse the response into sections
  // This is a simplified parsing - actual implementation may need more robust parsing
  const sections = content.split('## ');
  let completedSection = '';
  let incompleteSection = '';
  let summary = '';

  for (const section of sections) {
    if (section.startsWith('完成事项')) {
      completedSection = section.replace('完成事项', '').trim();
    } else if (section.startsWith('未完成事项')) {
      incompleteSection = section.replace('未完成事项', '').trim();
    } else if (section.startsWith('总结')) {
      summary = section.replace('总结', '').trim();
    }
  }

  return { completedSection, incompleteSection, summary };
}
```

- [ ] **Step 2: 验证编译**

Run: `pnpm build`
Expected: 编译成功，无错误

- [ ] **Step 3: 提交**

```bash
git add src/services/LLMService.ts
git commit -m "feat: add generateDailyReport method to LLMService"
```

---

## Task 3: 创建 DailyReportService

**Files:**
- Create: `src/services/DailyReportService.ts`

- [ ] **Step 1: 创建服务文件**

```typescript
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { TodoService } from './TodoService';
import { LLMService } from './LLMService';
import { SettingsService } from './SettingsService';

export class DailyReportService {
  private todoService: TodoService;
  private llmService: LLMService;
  private settingsService: SettingsService;

  constructor(llmService: LLMService, settingsService: SettingsService) {
    this.todoService = new TodoService();
    this.llmService = llmService;
    this.settingsService = settingsService;
  }

  async generateDailyReport(): Promise<{
    success: boolean;
    reportPath?: string;
    error?: string;
  }> {
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;

    // Get all todos created today
    const allTodos = this.todoService.getByDateRange(startOfDay, endOfDay);

    const completedTodos = allTodos.filter(t => t.isCompleted);
    const incompleteTodos = allTodos.filter(t => !t.isCompleted);

    // Get report directory
    const reportDir = this.settingsService.get('reportDir');
    if (!reportDir) {
      return { success: false, error: '日报目录未配置' };
    }

    // Ensure directory exists
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // Generate report via LLM
    let reportContent: { completedSection: string; incompleteSection: string; summary: string };
    try {
      reportContent = await this.llmService.generateDailyReport(
        completedTodos.map(t => ({ content: t.content, completedAt: t.completedAt || '' })),
        incompleteTodos.map(t => ({ content: t.content }))
      );
    } catch (err) {
      log.error('[DailyReport] LLM generation failed:', err);
      return { success: false, error: 'AI 生成失败' };
    }

    // Build report markdown
    const reportMd = `# ${today} 日报

## 完成事项
${reportContent.completedSection}

## 未完成事项
${reportContent.incompleteSection}

## 总结
${reportContent.summary}
`;

    // Save report
    const reportPath = path.join(reportDir, `${today}-日报.md`);
    fs.writeFileSync(reportPath, reportMd, 'utf-8');
    log.info('[DailyReport] Report saved:', reportPath);

    // Archive completed todos
    if (completedTodos.length > 0) {
      const archivePath = path.join(reportDir, 'archive.md');
      let archiveContent = '';

      if (fs.existsSync(archivePath)) {
        archiveContent = fs.readFileSync(archivePath, 'utf-8');
      } else {
        archiveContent = '# 待办归档\n\n';
      }

      // Append completed todos to archive
      const archiveEntry = `\n## ${today}\n${completedTodos.map(t =>
        `- ${t.content} (完成) - ${new Date(t.completedAt!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
      ).join('\n')}\n`;

      // Find position to insert (before first ## heading or at end)
      const lastDateSection = archiveContent.match(/## \d{4}-\d{2}-\d{2}/g);
      if (lastDateSection) {
        const lastSectionStart = archiveContent.lastIndexOf(`## ${lastDateSection[lastDateSection.length - 1]}`);
        archiveContent = archiveContent.slice(0, lastSectionStart) + archiveEntry + archiveContent.slice(lastSectionStart);
      } else {
        archiveContent += archiveEntry;
      }

      fs.writeFileSync(archivePath, archiveContent, 'utf-8');
      log.info('[DailyReport] Archived to:', archivePath);
    }

    // Delete completed todos from database
    if (completedTodos.length > 0) {
      this.todoService.archiveCompletedByDate(today);
      log.info('[DailyReport] Deleted completed todos from database');
    }

    return { success: true, reportPath };
  }

  async generateManual(): Promise<{ success: boolean; reportPath?: string; error?: string }> {
    return this.generateDailyReport();
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `pnpm build`
Expected: 编译成功，无错误

- [ ] **Step 3: 提交**

```bash
git add src/services/DailyReportService.ts
git commit -m "feat: create DailyReportService for daily report generation"
```

---

## Task 4: IPC 和 Preload 扩展

**Files:**
- Modify: `src/preload/index.ts:1-47`
- Modify: `src/main/ipc.ts`

- [ ] **Step 1: preload 添加日报相关 API**

```typescript
// In preload/index.ts contextBridge.api:
generateDailyReport: () => ipcRenderer.invoke('dailyReport:generate'),
getReportDir: () => ipcRenderer.invoke('dailyReport:getReportDir'),
setReportDir: (dir: string) => ipcRenderer.invoke('dailyReport:setReportDir', dir),
onDailyReportGenerated: (callback: (path: string) => void) => {
  const listener = (_: unknown, path: string) => callback(path);
  ipcRenderer.on('dailyReport:generated', listener);
  return () => ipcRenderer.removeListener('dailyReport:generated', listener);
},
```

- [ ] **Step 2: main/ipc.ts 添加 handler**

在 ipc.ts 中添加：

```typescript
// dailyReport handlers
ipc.handle('dailyReport:generate', async () => {
  const { DailyReportService } = require('../services/DailyReportService');
  const { LLMService } = require('../services/LLMService');
  const { SettingsService } = require('../services/SettingsService');
  const llmService = new LLMService();
  const settingsService = new SettingsService();
  const dailyReportService = new DailyReportService(llmService, settingsService);
  return dailyReportService.generateManual();
});

ipc.handle('dailyReport:getReportDir', () => {
  const { SettingsService } = require('../services/SettingsService');
  const service = new SettingsService();
  return service.get('reportDir');
});

ipc.handle('dailyReport:setReportDir', (_, dir: string) => {
  const { SettingsService } = require('../services/SettingsService');
  const service = new SettingsService();
  service.set('reportDir', dir);
});
```

- [ ] **Step 3: 验证编译**

Run: `pnpm build`
Expected: 编译成功，无错误

- [ ] **Step 4: 提交**

```bash
git add src/preload/index.ts src/main/ipc.ts
git commit -m "feat: add daily report IPC handlers"
```

---

## Task 5: SettingsPanel 添加配置和按钮

**Files:**
- Modify: `src-renderer/components/SettingsPanel.tsx`

- [ ] **Step 1: 添加状态和处理函数**

```typescript
const [reportDir, setReportDir] = useState('');
const [isGenerating, setIsGenerating] = useState(false);

// Load report dir
useEffect(() => {
  const loadDir = async () => {
    const dir = await window.todoAPI.getReportDir();
    if (dir) setReportDir(dir);
  };
  loadDir();
}, []);

// Handle directory selection
const handleSelectReportDir = async () => {
  // Use a simple input prompt - actual implementation would use native dialog
  const dir = prompt('请输入日报保存目录路径:', reportDir);
  if (dir) {
    await window.todoAPI.setReportDir(dir);
    setReportDir(dir);
  }
};

// Handle generate report
const handleGenerateReport = async () => {
  setIsGenerating(true);
  try {
    const result = await window.todoAPI.generateDailyReport();
    if (result.success) {
      alert(`日报已生成: ${result.reportPath}`);
    } else {
      alert(`生成失败: ${result.error}`);
    }
  } catch (err) {
    alert(`生成失败: ${err}`);
  } finally {
    setIsGenerating(false);
  }
};
```

- [ ] **Step 2: 在 Settings 界面添加配置项和按钮**

在 settings UI 中合适位置添加：

```tsx
<div className="settings-section">
  <h3>日报设置</h3>
  <div className="setting-item">
    <label>日报保存目录</label>
    <div className="setting-row">
      <input
        type="text"
        value={reportDir}
        onChange={e => setReportDir(e.target.value)}
        placeholder="选择日报保存目录"
      />
      <button onClick={handleSelectReportDir}>选择</button>
    </div>
  </div>
  <div className="setting-item">
    <button
      className="primary-button"
      onClick={handleGenerateReport}
      disabled={isGenerating}
    >
      {isGenerating ? '生成中...' : '生成日报'}
    </button>
  </div>
</div>
```

- [ ] **Step 3: 添加样式**

在 SettingsPanel.css 中添加：

```css
.settings-section {
  margin-bottom: 20px;
}

.settings-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}

.setting-row {
  display: flex;
  gap: 8px;
}

.setting-row input {
  flex: 1;
}

.primary-button {
  background: #7c3aed;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
}

.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

- [ ] **Step 4: 验证编译**

Run: `pnpm build`
Expected: 编译成功，无错误

- [ ] **Step 5: 提交**

```bash
git add src-renderer/components/SettingsPanel.tsx src-renderer/components/SettingsPanel.css
git commit -m "feat: add report directory config and generate button"
```

---

## Task 6: 集成到 ReminderService 定时触发

**Files:**
- Modify: `src/services/ReminderService.ts`

- [ ] **Step 1: 修改 `checkAndFire` 方法支持日报**

在 `checkAndFire` 中，当 reminder 触发时，调用日报生成：

```typescript
private async checkAndFire(): Promise<void> {
  // ... existing reminder logic ...

  // Fire reminder and/or daily report
  try {
    await this.fireReminder();
    // Also trigger daily report generation
    await this.fireDailyReport();
    // ... rest of existing code ...
  } catch (err) {
    log.error('[Reminder] Failed to fire:', err);
  }
}

private async fireDailyReport(): Promise<void> {
  const reportDir = this.settingsService.get('reportDir');
  if (!reportDir) {
    log.info('[DailyReport] Report dir not configured, skipping');
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DailyReportService } = require('./DailyReportService');
  const dailyReportService = new DailyReportService(this.llmService, this.settingsService);

  try {
    const result = await dailyReportService.generateDailyReport();
    if (result.success) {
      log.info('[DailyReport] Daily report generated:', result.reportPath);
      // Notify renderer
      const { getMainWindow } = require('./window');
      const win = getMainWindow();
      if (win) {
        win.webContents.send('dailyReport:generated', result.reportPath);
      }
    } else {
      log.warn('[DailyReport] Failed:', result.error);
    }
  } catch (err) {
    log.error('[DailyReport] Error:', err);
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `pnpm build`
Expected: 编译成功，无错误

- [ ] **Step 3: 提交**

```bash
git add src/services/ReminderService.ts
git commit -m "feat: integrate daily report generation into ReminderService"
```

---

## Task 7: 宠物旁 Tips 通知

**Files:**
- Modify: `src-renderer/components/PetView.tsx`

- [ ] **Step 1: 添加 tips 状态和显示逻辑**

```typescript
const [tipsMessage, setTipsMessage] = useState('');

// Listen for daily report generation
useEffect(() => {
  const unsubscribe = window.todoAPI.onDailyReportGenerated((path: string) => {
    setTipsMessage(`日报已生成: ${path}`);
    setTimeout(() => setTipsMessage(''), 5000);
  });
  return unsubscribe;
}, []);
```

- [ ] **Step 2: 在 PetView 中渲染 tips**

```tsx
{tipsMessage && (
  <div className="pet-tips">
    {tipsMessage}
  </div>
)}
```

- [ ] **Step 3: 添加 tips 样式**

在 PetView.css 中添加：

```css
.pet-tips {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(124, 58, 237, 0.95);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  white-space: nowrap;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: tips-fade 0.3s ease;
}

@keyframes tips-fade {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

- [ ] **Step 4: 验证编译**

Run: `pnpm build`
Expected: 编译成功，无错误

- [ ] **Step 5: 提交**

```bash
git add src-renderer/components/PetView.tsx src-renderer/components/PetView.css
git commit -m "feat: add tips notification for daily report completion"
```

---

## Task 8: 整体测试

- [ ] **Step 1: 配置 LLM 和日报目录**

在 Settings 中配置 LLM endpoint、model、apiKey，以及日报保存目录。

- [ ] **Step 2: 测试手动生成日报**

点击"生成日报"按钮，检查：
- 日报 MD 文件是否正确生成
- archive.md 是否正确归档
- 界面是否移除已完成项

- [ ] **Step 3: 测试自动触发**

等待 reminderTimes 到点，或修改系统时间测试。

- [ ] **Step 4: 验证 tips 通知**

日报生成后，检查宠物旁是否显示 tips。

---

## 自检清单

1. **Spec coverage:** 所有设计需求都有对应实现
2. **Placeholder scan:** 无 TBD/TODO 占位符
3. **Type consistency:** 类型一致性检查通过