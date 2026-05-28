import OpenAI from 'openai';
import { KeyStore } from './KeyStore';
import log from 'electron-log';

export class LLMService {
  private client: OpenAI | null = null;
  private keyStore: KeyStore;

  constructor() {
    this.keyStore = new KeyStore();
  }

  async configure(endpoint: string, model: string, apiKey: string): Promise<void> {
    this.client = new OpenAI({
      apiKey,
      baseURL: endpoint,
    });
    log.info(`LLMService configured with endpoint: ${endpoint}, model: ${model}`);
  }

  async generateReminderSummary(todos: { content: string; isCompleted: boolean }[]): Promise<string> {
    if (!this.client) {
      throw new Error('LLM client not configured');
    }

    const incompleteTodos = todos.filter((t) => !t.isCompleted);
    if (incompleteTodos.length === 0) {
      return '';
    }

    const todoList = incompleteTodos.map((t) => `- ${t.content}`).join('\n');

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '你是一个待办事项提醒助手。请根据以下待办列表，生成一段简洁的中文提醒内容，包含摘要和行动建议。',
        },
        {
          role: 'user',
          content: `待办事项：\n${todoList}\n\n请生成提醒内容：`,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || todoList;
  }

  async generateDailyReport(
    completedTodos: { content: string; completedAt: string }[],
    incompleteTodos: { content: string }[]
  ): Promise<{ completedSection: string; incompleteSection: string; summary: string }> {
    if (!this.client) {
      throw new Error('LLM client not configured');
    }

    const completedList = completedTodos.map((t) => `- ${t.content}`).join('\n');
    const incompleteList = incompleteTodos.map((t) => `- ${t.content}`).join('\n');

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '你是一个工作日报助手。请根据以下完成和未完成的待办事项，生成中文日报内容。返回 JSON 格式，包含 completedSection、incompleteSection 和 summary 三个字段。',
        },
        {
          role: 'user',
          content: `完成事项：\n${completedList || '（无）'}\n\n未完成事项：\n${incompleteList || '（无）'}\n\n请生成日报，返回 JSON 格式。`,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '';
    try {
      return JSON.parse(content);
    } catch {
      return {
        completedSection: completedList || '（无）',
        incompleteSection: incompleteList || '（无）',
        summary: '请手动查看待办事项。',
      };
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }
}
