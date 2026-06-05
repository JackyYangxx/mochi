import { describe, it, test, expect, vi, beforeEach } from 'vitest';
import { LLMService } from '../../src/services/LLMService';

// Mock the openai package so configure() can create a real (mocked) client.
// `mockCreate` is shared so tests can configure return values and inspect call
// arguments directly.
const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

// Mock KeyStore so the import chain (LLMService -> KeyStore -> electron) does
// not try to load the electron binary in the test environment.
vi.mock('../../src/services/KeyStore', () => ({
  KeyStore: vi.fn().mockImplementation(function (this: any) {
    this.get = vi.fn();
    this.set = vi.fn();
  }),
}));

// electron-log is loaded for `log.info` in `configure()`.
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('LLMService', () => {
  let svc: LLMService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockReset();
    svc = new LLMService();
    // Stub dependencies used by chat() for KB context (F2 tests). For the
    // generateReminderSummary tests, chat() short-circuits on the KB path when
    // settings.get('kb_enabled') is not 'true', so these stubs are harmless.
    (svc as any).settings = { get: vi.fn().mockReturnValue(null) };
    (svc as any).roleService = { load: vi.fn().mockResolvedValue('') };
    (svc as any).indexService = { search: vi.fn().mockReturnValue([]) };
  });

  describe('configure', () => {
    it('creates OpenAI client with provided credentials', async () => {
      await svc.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      expect(svc.isConfigured()).toBe(true);
    });
  });

  describe('chat()', () => {
    test('chat() calls OpenAI with constructed messages', async () => {
      mockCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });
      await svc.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      const result = await svc.chat({ systemPrompt: 'sys', userPrompt: 'user', kbContext: false });
      expect(result).toBe('ok');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system', content: 'sys' }),
            expect.objectContaining({ role: 'user', content: 'user' }),
          ]),
        }),
      );
    });

    test('chat() injects role + wiki when kbContext=true and kb_enabled=true', async () => {
      (svc as any).settings.get.mockImplementation((k: string) =>
        k === 'kb_enabled' ? 'true' : null,
      );
      (svc as any).roleService.load.mockResolvedValue('# My Role');
      (svc as any).indexService.search.mockReturnValue([{ path: '/w/x.md', content: 'wiki text' }]);
      mockCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });
      await svc.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      await svc.chat({ systemPrompt: 'sys', userPrompt: 'user', kbContext: true });
      const sysMsg = mockCreate.mock.calls[0][0].messages[0].content;
      expect(sysMsg).toContain('# My Role');
      expect(sysMsg).toContain('wiki text');
    });
  });

  describe('generateReminderSummary', () => {
    it('filters out completed todos', async () => {
      const todos = [
        { id: '1', content: 'Buy milk', isCompleted: true },
        { id: '2', content: 'Walk dog', isCompleted: false },
      ];
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Reminder content' } }],
      });
      await svc.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      await svc.generateReminderSummary(todos);
      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      expect(userMessage.content).toContain('Walk dog');
      expect(userMessage.content).not.toContain('Buy milk');
    });

    it('returns empty string when all todos are completed', async () => {
      const todos = [
        { content: 'Task 1', isCompleted: true },
        { content: 'Task 2', isCompleted: true },
      ];
      await svc.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      const result = await svc.generateReminderSummary(todos);
      expect(result).toBe('');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('generates reminder content from LLM response', async () => {
      const todos = [
        { content: 'Buy milk', isCompleted: false },
        { content: 'Walk dog', isCompleted: false },
      ];
      const expectedContent = '【摘要】\n2件待办事项\n\n【行动建议】\n1. 买牛奶\n2. 遛狗';
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: expectedContent } }],
      });
      await svc.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      const result = await svc.generateReminderSummary(todos);
      expect(result).toBe(expectedContent);
    });

    it('throws error when LLM API fails', async () => {
      const todos = [
        { content: 'Task 1', isCompleted: false },
        { content: 'Task 2', isCompleted: false },
      ];
      mockCreate.mockRejectedValue(new Error('API error'));
      await svc.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      await expect(svc.generateReminderSummary(todos)).rejects.toThrow('API error');
    });

    it('throws error when LLM client not configured', async () => {
      // No configure() call, so this.client is null and the chat() guard fires.
      const todos = [{ content: 'Test', isCompleted: false }];
      await expect(svc.generateReminderSummary(todos)).rejects.toThrow('LLM client not configured');
    });
  });

  describe('generateReminderSummary (F2 thin wrapper)', () => {
    test('delegates to chat() with kbContext=true', async () => {
      const chatSpy = vi.spyOn(svc, 'chat').mockResolvedValue('summary');
      const result = await svc.generateReminderSummary([{ content: 'todo', isCompleted: false }]);
      expect(result).toBe('summary');
      expect(chatSpy).toHaveBeenCalledWith(expect.objectContaining({ kbContext: true }));
    });
  });
});
