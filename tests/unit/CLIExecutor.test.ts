import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CLIExecutor } from '../../src/services/CLIExecutor';

describe('CLIExecutor', () => {
  let executor: CLIExecutor;

  beforeEach(() => {
    executor = new CLIExecutor(30000);
  });

  it('validates that CLI path must be absolute', () => {
    const result = executor.validatePath('./relative/path');
    expect(result).toBe('CLI path must be an absolute path');
  });

  it('validates non-existent paths', () => {
    const result = executor.validatePath('/nonexistent/path/to/cli');
    expect(result).toBe('CLI path does not exist');
  });

  it('validates /bin/echo exists', () => {
    const result = executor.validatePath('/bin/echo');
    expect(result).toBeNull();
  });

  it('validates that real CLI is executable', () => {
    // /bin/echo is executable on Unix systems
    const result = executor.validatePath('/bin/echo');
    expect(result).toBeNull();
  });

  it('executes echo and returns result', async () => {
    // Use real /bin/echo
    const result = await executor.execute('/bin/echo', ['hello world']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello world');
  });

  it('passes args array directly (no shell)', async () => {
    // Test that shell special chars in args are passed literally
    const result = await executor.execute('/bin/echo', ['hello; rm -rf /']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello; rm -rf /');
  });

  it('rejects relative path', async () => {
    await expect(executor.execute('./relative', ['arg'])).rejects.toThrow('must be an absolute path');
  });

  it('rejects non-existent path', async () => {
    await expect(executor.execute('/nonexistent/cli', [])).rejects.toThrow('CLI tool not found');
  });

  it('times out with custom duration', async () => {
    vi.useFakeTimers();
    const shortExecutor = new CLIExecutor(100);
    const promise = shortExecutor.execute('/bin/sleep', ['10']);

    vi.advanceTimersByTime(150);
    await expect(promise).rejects.toThrow('timed out');
    vi.useRealTimers();
  });

  it('collects stderr output', async () => {
    // Use a command that writes to stderr
    const result = await executor.execute('/bin/sh', ['-c', 'echo error >&2']);
    expect(result.stderr).toBe('error');
  });
});