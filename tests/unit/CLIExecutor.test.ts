import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CLIExecutor } from '../../src/services/CLIExecutor';
import { EventEmitter } from 'events';
import child_process from 'child_process';

const { mockChild, mockStdout, mockStderr } = vi.hoisted(() => {
  const mockStdout = new EventEmitter();
  const mockStderr = new EventEmitter();
  const mockChild = new EventEmitter() as any;
  mockChild.stdout = mockStdout;
  mockChild.stderr = mockStderr;
  mockChild.kill = vi.fn();
  return { mockChild, mockStdout, mockStderr };
});

vi.mock('child_process', () => {
  return {
    default: {
      spawn: vi.fn(() => mockChild),
    },
    spawn: vi.fn(() => mockChild),
  };
});

describe('CLIExecutor', () => {
  let executor: CLIExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new CLIExecutor(30000);
  });

  it('executes CLI with arguments array (no shell)', async () => {
    const resultPromise = executor.execute('/usr/bin/echo', ['hello world']);

    mockStdout.emit('data', Buffer.from('hello world\n'));
    mockChild.emit('close', 0);

    const result = await resultPromise;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello world');
  });

  it('uses spawn with shell: false', async () => {
    const resultPromise = executor.execute('/usr/bin/echo', ['test']);

    mockStdout.emit('data', Buffer.from('test\n'));
    mockChild.emit('close', 0);
    await resultPromise;

    const spawnCall = (child_process.spawn as any).mock.calls[0];
    expect(spawnCall[2].shell).toBe(false);
  });

  it('passes {content} placeholder as literal argument', async () => {
    const resultPromise = executor.execute('/bin/cli', ['send', '--msg', 'hello; rm -rf /']);

    mockChild.emit('close', 0);
    await resultPromise;

    const spawnCall = (child_process.spawn as any).mock.calls[0];
    const args = spawnCall[1];
    expect(args).toContain('hello; rm -rf /');
  });

  it('rejects when CLI path not found', async () => {
    const error = new Error('ENOENT');
    (error as any).code = 'ENOENT';
    mockChild.emit('error', error);

    await expect(executor.execute('/nonexistent/cli', [])).rejects.toThrow('CLI tool not found');
  });

  it('times out after configured duration', async () => {
    vi.useFakeTimers();
    const resultPromise = executor.execute('/bin/sleep', ['100']);
    vi.advanceTimersByTime(31000);
    await expect(resultPromise).rejects.toThrow('timed out');
    expect(mockChild.kill).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('validates that CLI path is an absolute path', async () => {
    await expect(executor.execute('./relative/path', [])).rejects.toThrow('must be an absolute path');
  });
});