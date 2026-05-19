import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TodoService, Todo } from '../../src/services/TodoService';

// Mock better-sqlite3
const mockAll = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();
const mockPrepare = vi.fn();

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      prepare: mockPrepare,
      transaction: vi.fn((fn) => {
        const wrapper = (...args: any[]) => fn(...args);
        return wrapper;
      }),
    })),
  };
});

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid-123'),
}));

describe('TodoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockReset();
    mockGet.mockReset();
    mockRun.mockReset();
    mockPrepare.mockReset();

    // Default mock behavior for prepare
    mockPrepare.mockReturnValue({
      all: mockAll,
      get: mockGet,
      run: mockRun,
    });
  });

  const createMockDb = () => ({
    prepare: mockPrepare,
    transaction: vi.fn((fn) => {
      const wrapper = (...args: any[]) => fn(...args);
      return wrapper;
    }),
  });

  describe('add', () => {
    it('adds a new todo with content', async () => {
      const { TodoService } = await import('../../src/services/TodoService');

      // First get() call returns sort order
      mockGet.mockReturnValueOnce({ next: 1 });
      // Second get() call returns the inserted row
      mockGet.mockReturnValueOnce({
        id: 'test-uuid-123',
        content: 'Test todo',
        sort_order: 1,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        completed_at: null,
        is_completed: 0,
      });

      const service = new TodoService(createMockDb() as any);
      const result = service.add({ content: 'Test todo' });

      expect(result).toEqual({
        id: 'test-uuid-123',
        content: 'Test todo',
        sortOrder: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        completedAt: null,
        isCompleted: false,
      });
    });

    it('trims whitespace from content', async () => {
      const { TodoService } = await import('../../src/services/TodoService');

      mockGet.mockReturnValueOnce({ next: 1 });
      mockGet.mockReturnValueOnce({
        id: 'test-uuid-123',
        content: 'Trimmed content',
        sort_order: 1,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        completed_at: null,
        is_completed: 0,
      });

      const service = new TodoService(createMockDb() as any);
      service.add({ content: '  Trimmed content  ' });

      expect(mockRun).toHaveBeenCalledWith(
        'test-uuid-123',
        'Trimmed content',
        1,
        expect.any(String),
        expect.any(String)
      );
    });

    it('throws error for empty content', async () => {
      const { TodoService } = await import('../../src/services/TodoService');
      const service = new TodoService(createMockDb() as any);

      expect(() => service.add({ content: '   ' })).toThrow('Content cannot be empty');
    });

    it('truncates content longer than 500 characters', async () => {
      const { TodoService } = await import('../../src/services/TodoService');
      const longContent = 'a'.repeat(600);

      mockGet.mockReturnValueOnce({ next: 1 });
      mockGet.mockReturnValueOnce({
        id: 'test-uuid-123',
        content: 'a'.repeat(500),
        sort_order: 1,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        completed_at: null,
        is_completed: 0,
      });

      const service = new TodoService(createMockDb() as any);
      service.add({ content: longContent });

      expect(mockRun).toHaveBeenCalledWith(
        'test-uuid-123',
        'a'.repeat(500),
        1,
        expect.any(String),
        expect.any(String)
      );
    });
  });

  describe('getAll', () => {
    it('returns all todos ordered by sort_order', async () => {
      const { TodoService } = await import('../../src/services/TodoService');

      mockAll.mockReturnValue([
        {
          id: '1',
          content: 'First todo',
          sort_order: 0,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          completed_at: null,
          is_completed: 0,
        },
        {
          id: '2',
          content: 'Second todo',
          sort_order: 1,
          created_at: '2024-01-02T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z',
          completed_at: '2024-01-02T00:00:00.000Z',
          is_completed: 1,
        },
      ]);

      const service = new TodoService(createMockDb() as any);
      const result = service.getAll();

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('First todo');
      expect(result[0].isCompleted).toBe(false);
      expect(result[1].content).toBe('Second todo');
      expect(result[1].isCompleted).toBe(true);
    });

    it('returns empty array when no todos exist', async () => {
      const { TodoService } = await import('../../src/services/TodoService');

      mockAll.mockReturnValue([]);

      const service = new TodoService(createMockDb() as any);
      const result = service.getAll();
      expect(result).toEqual([]);
    });
  });

  describe('toggle', () => {
    it('toggles todo from incomplete to complete', async () => {
      const { TodoService } = await import('../../src/services/TodoService');

      mockGet
        .mockReturnValueOnce({
          id: '1',
          content: 'Test todo',
          sort_order: 0,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          completed_at: null,
          is_completed: 0,
        })
        .mockReturnValueOnce({
          id: '1',
          content: 'Test todo',
          sort_order: 0,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z',
          completed_at: '2024-01-02T00:00:00.000Z',
          is_completed: 1,
        });

      const service = new TodoService(createMockDb() as any);
      const result = service.toggle('1');

      expect(result.isCompleted).toBe(true);
      expect(result.completedAt).not.toBeNull();
    });

    it('toggles todo from complete to incomplete', async () => {
      const { TodoService } = await import('../../src/services/TodoService');

      mockGet
        .mockReturnValueOnce({
          id: '1',
          content: 'Test todo',
          sort_order: 0,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          completed_at: '2024-01-01T00:00:00.000Z',
          is_completed: 1,
        })
        .mockReturnValueOnce({
          id: '1',
          content: 'Test todo',
          sort_order: 0,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z',
          completed_at: null,
          is_completed: 0,
        });

      const service = new TodoService(createMockDb() as any);
      const result = service.toggle('1');

      expect(result.isCompleted).toBe(false);
      expect(result.completedAt).toBeNull();
    });

    it('throws error when todo not found', async () => {
      const { TodoService } = await import('../../src/services/TodoService');

      mockGet.mockReturnValue(undefined);

      const service = new TodoService(createMockDb() as any);
      expect(() => service.toggle('non-existent')).toThrow('Todo not found');
    });
  });

  describe('delete', () => {
    it('deletes a todo by id', async () => {
      const { TodoService } = await import('../../src/services/TodoService');
      const mockDb = createMockDb();
      const service = new TodoService(mockDb as any);

      service.delete('1');

      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('returns matching todos', async () => {
      const { TodoService } = await import('../../src/services/TodoService');

      mockAll.mockReturnValue([
        {
          id: '1',
          content: 'Buy groceries',
          sort_order: 0,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          completed_at: null,
          is_completed: 0,
        },
      ]);

      const service = new TodoService(createMockDb() as any);
      const result = service.search('groceries');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Buy groceries');
    });

    it('returns empty array when no matches found', async () => {
      const { TodoService } = await import('../../src/services/TodoService');

      mockAll.mockReturnValue([]);

      const service = new TodoService(createMockDb() as any);
      const result = service.search('nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('updateSortOrder', () => {
    it('updates sort order for all provided ids', async () => {
      const { TodoService } = await import('../../src/services/TodoService');
      const mockDb = createMockDb();
      const service = new TodoService(mockDb as any);

      service.updateSortOrder(['id3', 'id1', 'id2']);

      expect(mockRun).toHaveBeenCalledTimes(3);
    });
  });
});