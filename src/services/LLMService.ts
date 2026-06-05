import OpenAI from 'openai';
import { KeyStore } from './KeyStore';
import { SettingsService } from './SettingsService';
import { RoleService } from './RoleService';
import { WikiIndexService } from './WikiIndexService';
import log from 'electron-log';

interface ChatOpts { systemPrompt: string; userPrompt: string; kbContext?: boolean; }
interface ChatContext { role: string; wikiHits: { path: string; content: string }[]; }

export class LLMService {
  private client: OpenAI | null = null;
  private keyStore: KeyStore;
  private settings!: SettingsService;
  private roleService!: RoleService;
  private indexService!: WikiIndexService;

  constructor() {
    this.keyStore = new KeyStore();
  }

  // Wire dependencies (called from main process startup)
  setContext(s: SettingsService, r: RoleService, i: WikiIndexService): void {
    this.settings = s;
    this.roleService = r;
    this.indexService = i;
  }

  async configure(endpoint: string, model: string, apiKey: string): Promise<void> {
    this.client = new OpenAI({ apiKey, baseURL: endpoint });
    log.info(`LLMService configured: ${endpoint}, ${model}`);
  }

  isConfigured(): boolean { return this.client !== null; }

  async chat(opts: ChatOpts): Promise<string> {
    if (!this.client) throw new Error('LLM client not configured');

    let systemPrompt = opts.systemPrompt;
    if (opts.kbContext !== false && this.settings?.get('kb_enabled') === 'true') {
      const ctx = await this.buildKbContext(opts.userPrompt);
      systemPrompt = `[角色]\n${ctx.role || '(未配置 role.md)'}\n\n[相关知识]\n${ctx.wikiHits.map(h => `[${h.path}]\n${h.content}`).join('\n---\n') || '(无)'}\n\n[任务]\n${opts.systemPrompt}`;
    }

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
    });
    return response.choices[0]?.message?.content || '';
  }

  private async buildKbContext(query: string): Promise<ChatContext> {
    const role = await this.roleService?.load() ?? '';
    const topK = this.indexService?.search(query.slice(0, 200), 5) ?? [];
    return { role, wikiHits: topK.map(p => ({ path: p.path, content: p.content })) };
  }

  // F2: thin wrappers (unchanged signatures for ReminderService / DailyReportService)
  async generateReminderSummary(todos: { content: string; isCompleted: boolean }[]): Promise<string> {
    const incomplete = todos.filter(t => !t.isCompleted);
    if (incomplete.length === 0) return '';
    return this.chat({
      systemPrompt: '你是一个待办事项提醒助手。请根据待办列表生成一段简洁的中文提醒，包含摘要和行动建议。',
      userPrompt: `待办事项：\n${incomplete.map(t => `- ${t.content}`).join('\n')}\n\n请生成提醒内容：`,
      kbContext: true,
    });
  }

  async generateDailyReport(
    completedTodos: { content: string; completedAt: string }[],
    incompleteTodos: { content: string }[],
  ): Promise<{ completedSection: string; incompleteSection: string; summary: string }> {
    const completedList = completedTodos.map(t => `- ${t.content}`).join('\n');
    const incompleteList = incompleteTodos.map(t => `- ${t.content}`).join('\n');
    const content = await this.chat({
      systemPrompt: '你是工作日报助手。返回 JSON 包含 completedSection / incompleteSection / summary。',
      userPrompt: `完成：\n${completedList || '（无）'}\n未完成：\n${incompleteList || '（无）'}`,
      kbContext: true,
    });
    try { return JSON.parse(content); }
    catch {
      return {
        completedSection: completedList || '（无）',
        incompleteSection: incompleteList || '（无）',
        summary: '请手动查看待办事项。',
      };
    }
  }
}
