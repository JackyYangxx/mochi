import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class CLIExecutor {
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 30000) {
    this.defaultTimeout = defaultTimeout;
  }

  async execute(cliPath: string, args: string[], timeout?: number): Promise<ExecResult> {
    if (!path.isAbsolute(cliPath)) {
      throw new Error('CLI path must be an absolute path');
    }

    if (!fs.existsSync(cliPath)) {
      throw new Error('CLI tool not found');
    }

    try {
      fs.accessSync(cliPath, fs.constants.X_OK);
    } catch {
      throw new Error('CLI tool is not executable');
    }

    const maxWait = timeout ?? this.defaultTimeout;

    return new Promise<ExecResult>((resolve, reject) => {
      const child: ChildProcess = spawn(cliPath, args, {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill('SIGTERM');
          reject(new Error(`CLI execution timed out after ${maxWait}ms`));
        }
      }, maxWait);

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (err: NodeJS.ErrnoException) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          if (err.code === 'ENOENT') {
            reject(new Error('CLI tool not found'));
          } else {
            reject(new Error(`CLI execution failed: ${err.message}`));
          }
        }
      });

      child.on('close', (code) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            exitCode: code ?? 1,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          });
        }
      });
    });
  }

  validatePath(cliPath: string): string | null {
    if (!path.isAbsolute(cliPath)) {
      return 'CLI path must be an absolute path';
    }
    if (!fs.existsSync(cliPath)) {
      return 'CLI path does not exist';
    }
    try {
      fs.accessSync(cliPath, fs.constants.X_OK);
    } catch {
      return 'CLI path is not executable';
    }
    return null;
  }
}