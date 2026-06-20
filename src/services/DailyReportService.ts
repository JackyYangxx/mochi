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

    // 取一份副本给 archive.md 用, DB 不动 (历史数据需要保留给日历视图)
    if (completedTodos.length > 0) {
      this.todoService.archiveCompletedByDate(today);
      log.info('[DailyReport] Fetched completed todos for archive.md (DB unchanged)');
    }

    return { success: true, reportPath };
  }

  async generateManual(): Promise<{ success: boolean; reportPath?: string; error?: string }> {
    return this.generateDailyReport();
  }
}