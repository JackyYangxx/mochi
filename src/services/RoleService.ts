import fs from 'fs';
import path from 'path';
import { shell } from 'electron';
import log from 'electron-log';

const TEMPLATE = `# 角色

## 身份
- 职业：（待填）
- 所在公司/团队：（待填）
- 当前 focus：（待填）

## 当前目标
- 季度目标：（待填）
- 正在推进的项目：（待填）

## 工作原则
- （待填，比如"先小步验证再扩展"、"重视可观测性"）

## 输出偏好
- 提醒语气：（直接/温和）
- 日报格式：（简洁/详细）
`;

export class RoleService {
  constructor(private dataDir: string) {}

  get filePath(): string {
    return path.join(this.dataDir, 'role.md');
  }

  async load(): Promise<string> {
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, TEMPLATE, 'utf-8');
      log.info(`[RoleService] Created template at ${this.filePath}`);
    }
    return fs.readFileSync(this.filePath, 'utf-8');
  }

  async save(content: string): Promise<void> {
    fs.writeFileSync(this.filePath, content, 'utf-8');
  }

  async reset(): Promise<void> {
    fs.writeFileSync(this.filePath, TEMPLATE, 'utf-8');
  }

  async openInEditor(): Promise<void> {
    await shell.openPath(this.filePath);
  }
}
