import { describe, it, expect } from 'vitest';
import { CLIExecutor } from '../../src/services/CLIExecutor';

describe('CLIExecutor', () => {
  let executor: CLIExecutor;

  beforeEach(() => {
    executor = new CLIExecutor();
  });

  it('detects invalid path for non-existent file', () => {
    expect(executor.isValidPath('/nonexistent/path/to/cli')).toBe(false);
  });

  it('rejects when CLI path does not exist', async () => {
    const promise = executor.execute('/nonexistent/cli', 'send {content}', 'test message');
    await expect(promise).rejects.toThrow('CLI path does not exist');
  });

  it('replaces {content} placeholder with actual content', async () => {
    // Test with /bin/echo on macOS
    const echoPath = '/bin/echo';
    if (!executor.isValidPath(echoPath)) {
      return; // Skip on systems without echo
    }
    const promise = executor.execute(echoPath, 'echo {content}', 'Hello World');
    await expect(promise).resolves.toContain('Hello World');
  });

  it('handles empty content gracefully', async () => {
    const echoPath = '/bin/echo';
    if (!executor.isValidPath(echoPath)) return;

    const promise = executor.execute(echoPath, 'echo {content}', '');
    await expect(promise).resolves.toBe('');
  });
});