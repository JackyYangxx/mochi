import { spawn } from 'child_process';
import fs from 'fs';
import log from 'electron-log';

export class CLIExecutor {
  private timeout = 30000; // 30 seconds

  /**
   * Check if the CLI path exists and is a valid executable.
   */
  isValidPath(cliPath: string): boolean {
    try {
      return fs.existsSync(cliPath);
    } catch {
      return false;
    }
  }

  /**
   * Execute a CLI command with the given args.
   * Uses spawn with args array (NOT shell mode) for security.
   * Replaces {content} placeholder with actual content.
   * Returns stdout on success, throws on failure/timeout.
   */
  async execute(cliPath: string, cliArgs: string, content: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isValidPath(cliPath)) {
        log.error(`CLI path does not exist: ${cliPath}`);
        reject(new Error(`CLI path does not exist: ${cliPath}`));
        return;
      }

      // Replace {content} placeholder
      const resolvedArgs = cliArgs.replace(/\{content\}/g, content);

      // Parse args into array - no shell interpretation
      const args = resolvedArgs.split(' ').filter((s) => s.length > 0);

      log.info(`Executing CLI: ${cliPath} ${args.join(' ')}`);

      const proc = spawn(cliPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timer = setTimeout(() => {
        log.error(`CLI execution timed out after ${this.timeout}ms`);
        proc.kill();
        reject(new Error(`CLI execution timed out after ${this.timeout}ms`));
      }, this.timeout);

      proc.on('error', (err) => {
        clearTimeout(timer);
        log.error(`CLI spawn error: ${err.message}`);
        reject(err);
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          log.info(`CLI executed successfully`);
          resolve(stdout.trim());
        } else {
          log.error(`CLI exited with code ${code}: ${stderr}`);
          reject(new Error(`CLI exited with code ${code}: ${stderr.trim()}`));
        }
      });
    });
  }
}