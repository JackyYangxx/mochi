import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use hoisted to create mocks before vi.mock is called
const mockCreate = vi.fn();

const { mockKeyStoreGet, mockKeyStoreSet } = vi.hoisted(() => {
  return {
    mockKeyStoreGet: vi.fn(),
    mockKeyStoreSet: vi.fn(),
  };
});

// Mock openai - must use hoisted mockCreate
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    initialize: vi.fn(),
  },
}));

// Mock KeyStore
vi.mock('../../src/services/KeyStore', () => ({
  KeyStore: vi.fn().mockImplementation(function(this: any) {
    this.get = mockKeyStoreGet;
    this.set = mockKeyStoreSet;
  }),
}));

describe('LLMService', () => {
  let llmService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCreate.mockReset();
    mockKeyStoreGet.mockReset();
    mockKeyStoreSet.mockReset();

    const { LLMService } = await import('../../src/services/LLMService');
    llmService = new LLMService();
  });

  describe('configure', () => {
    it('creates OpenAI client with provided credentials', async () => {
      await llmService.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      expect(llmService.isConfigured()).toBe(true);
    });
  });

  describe('generateReminderSummary', () => {
    it('filters out completed todos', async () => {
      const todos = [
        { id: '1', content: 'Buy milk', isCompleted: true },
        { id: '2', content: 'Walk dog', isCompleted: false },
      ];

      mockCreate.mockResolvedValue({
        choices: [{
          message: { content: 'Reminder content' },
        }],
      });

      await llmService.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      await llmService.generateReminderSummary(todos);

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

      await llmService.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      const result = await llmService.generateReminderSummary(todos);
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
        choices: [{
          message: { content: expectedContent },
        }],
      });

      await llmService.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      const result = await llmService.generateReminderSummary(todos);
      expect(result).toBe(expectedContent);
    });

    it('throws error when LLM API fails', async () => {
      const todos = [
        { content: 'Task 1', isCompleted: false },
        { content: 'Task 2', isCompleted: false },
      ];

      mockCreate.mockRejectedValue(new Error('API error'));

      await llmService.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      await expect(llmService.generateReminderSummary(todos)).rejects.toThrow('API error');
    });

    it('throws error when LLM client not configured', async () => {
      const todos = [{ content: 'Test', isCompleted: false }];

      await expect(llmService.generateReminderSummary(todos)).rejects.toThrow('LLM client not configured');
    });

    it('uses correct model and parameters', async () => {
      const todos = [{ content: 'Test task', isCompleted: false }];

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Summary' } }],
      });

      await llmService.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      await llmService.generateReminderSummary(todos);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe('gpt-4o-mini');
      expect(callArgs.max_tokens).toBe(200);
      expect(callArgs.temperature).toBe(0.7);
    });

    it('returns raw todo list when response has no content', async () => {
      const todos = [{ content: 'Test task', isCompleted: false }];

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      await llmService.configure('https://api.openai.com/v1', 'gpt-4o-mini', 'test-key');
      const result = await llmService.generateReminderSummary(todos);
      expect(result).toContain('Test task');
    });
  });
});