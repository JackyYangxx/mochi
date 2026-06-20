import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TodoService, Todo } from '../../src/services/TodoService';

// Mock functions
const mockAll = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();
const mockPrepare = vi.fn();

// Mock database
const mockDb = {
  prepare: mockPrepare,
  transaction: vi.fn((fn) => {
    const wrapper = (...args: any[]) => fn(...args);
    return wrapper;
  }),
};

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid-123'),
}));

// Mock the connection module
vi.mock('../../src/database/connection', () => ({
  getDb: vi.fn(() => mockDb),
}));

describe('TodoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock behavior for prepare
    mockPrepare.mockReturnValue({
      all: mockAll,
      get: mockGet,
      run: mockRun,
    });
  });

  describe('add', () => {
    it('adds a new todo with content', () => {
      mockGet
        .mockReturnValueOnce({ next: 1 })
        .mockReturnValueOnce({
          id: 'test-uuid-123',
          content: 'Test todo',
          sort_order: 1,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          completed_at: null,
          is_completed: 0,
        });

      const service = new TodoService(mockDb as any);
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

    it('trims whitespace from content', () => {
      mockGet
        .mockReturnValueOnce({ next: 1 })
        .mockReturnValueOnce({
          id: 'test-uuid-123',
          content: 'Trimmed content',
          sort_order: 1,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          completed_at: null,
          is_completed: 0,
        });

      const service = new TodoService(mockDb as any);
      service.add({ content: '  Trimmed content  ' });

      expect(mockRun).toHaveBeenCalledWith(
        'test-uuid-123',
        'Trimmed content',
        1,
        expect.any(String),
        expect.any(String),
        null
      );
    });

    it('throws error for empty content', () => {
      const service = new TodoService(mockDb as any);
      expect(() => service.add({ content: '   ' })).toThrow('Content cannot be empty');
    });

    it('stores full content without truncation', () => {
      mockGet
        .mockReturnValueOnce({ next: 1 })
        .mockReturnValueOnce({
          id: 'test-uuid-123',
          content: 'a'.repeat(600),
          sort_order: 1,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          completed_at: null,
          is_completed: 0,
        });

      const service = new TodoService(mockDb as any);
      service.add({ content: 'a'.repeat(600) });

      expect(mockRun).toHaveBeenCalledWith(
        'test-uuid-123',
        'a'.repeat(600),
        1,
        expect.any(String),
        expect.any(String),
        null
      );
    });
  });

  describe('getAll', () => {
    it('returns all todos ordered by sort_order', () => {
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

      const service = new TodoService(mockDb as any);
      const result = service.getAll();

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('First todo');
      expect(result[0].isCompleted).toBe(false);
      expect(result[1].content).toBe('Second todo');
      expect(result[1].isCompleted).toBe(true);
    });

    it('returns empty array when no todos exist', () => {
      mockAll.mockReturnValue([]);

      const service = new TodoService(mockDb as any);
      const result = service.getAll();
      expect(result).toEqual([]);
    });
  });

  describe('toggle', () => {
    it('toggles todo from incomplete to complete', () => {
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

      const service = new TodoService(mockDb as any);
      const result = service.toggle('1');

      expect(result.isCompleted).toBe(true);
      expect(result.completedAt).not.toBeNull();
    });

    it('toggles todo from complete to incomplete', () => {
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

      const service = new TodoService(mockDb as any);
      const result = service.toggle('1');

      expect(result.isCompleted).toBe(false);
      expect(result.completedAt).toBeNull();
    });

    it('throws error when todo not found', () => {
      mockGet.mockReturnValue(undefined);

      const service = new TodoService(mockDb as any);
      expect(() => service.toggle('non-existent')).toThrow('Todo not found');
    });
  });

  describe('delete', () => {
    it('deletes a todo by id', () => {
      const service = new TodoService(mockDb as any);
      service.delete('1');

      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('returns matching todos', () => {
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

      const service = new TodoService(mockDb as any);
      const result = service.search('groceries');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Buy groceries');
    });

    it('returns empty array when no matches found', () => {
      mockAll.mockReturnValue([]);

      const service = new TodoService(mockDb as any);
      const result = service.search('nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('updateSortOrder', () => {
    it('updates sort order for all provided ids', () => {
      const service = new TodoService(mockDb as any);
      service.updateSortOrder(['id3', 'id1', 'id2']);

      expect(mockRun).toHaveBeenCalledTimes(3);
    });
  });

  describe('archiveCompletedByDate', () => {
    it('returns completed todos created on the given date', () => {
      mockAll.mockReturnValue([
        {
          id: '1',
          content: 'Yesterday done',
          sort_order: 0,
          created_at: '2026-06-20T10:00:00.000Z',
          updated_at: '2026-06-20T10:00:00.000Z',
          completed_at: '2026-06-20T18:00:00.000Z',
          is_completed: 1,
        },
      ]);
      const service = new TodoService(mockDb as any);
      const result = service.archiveCompletedByDate('2026-06-20');
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Yesterday done');
    });

    it('does NOT delete from the database (regression: 前台过滤语义, DB 必须保留)', () => {
      // 收集所有被 prepare 过的 SQL, 确保没有 DELETE
      const preparedStmts: string[] = [];
      mockPrepare.mockImplementation((sql: string) => {
        preparedStmts.push(sql);
        return { all: mockAll, get: mockGet, run: mockRun };
      });
      mockAll.mockReturnValue([]);

      const service = new TodoService(mockDb as any);
      service.archiveCompletedByDate('2026-06-20');

      expect(preparedStmts.some((s) => /\bDELETE\b/i.test(s))).toBe(false);
    });
  });
});